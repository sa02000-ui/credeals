/**
 * Per-session randomization (design doc Part 4): one seed drawn at game start drives the deal pool,
 * persona jitter, branch-weight jitter, the mid-game market shift, and the curveball deck — so the
 * same profile + same decisions still produce a different playthrough. Pure + deterministic given a seed.
 */

import type { MarketCondition } from './gameEngine';
import type { SessionSeed } from './gameTypes';

/** Seeded PRNG (mulberry32). */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CURVEBALL_IDS = [
  'hvac-failure', 'roof-end-of-life', 'property-manager-underperform',
  'tenant-dispute', 'competing-lp-offer', 'new-supply-announcement',
  'rate-hike-shock', 'insurance-market-hardening', 'city-rezoning-threat',
  'corporate-tenant-opportunity', 'contractor-dispute', 'key-tenant-departure',
  'flood-event', 'favorable-comp-lease', 'lender-covenant-breach',
  'seller-network-referral', 'broker-repair-mission', 'lp-cold-feet',
  'unsolicited-buyer-offer', 'capital-call-trigger',
];

const MARKETS: MarketCondition[] = ['hot', 'balanced', 'tough'];

export function generateSessionSeed(masterPoolSize: number, dealCount = 8): SessionSeed {
  const value = Math.floor(Math.random() * 2 ** 32);
  const rng = seededRng(value);

  const all = Array.from({ length: Math.max(dealCount, masterPoolSize) }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const dealPoolIndices = all.slice(0, dealCount);

  const shuffledCurve = [...CURVEBALL_IDS].sort(() => rng() - 0.5);
  const curveballDeck = shuffledCurve.slice(0, 4);

  const usedQuarters = new Set<number>();
  const curveballQuarters = curveballDeck.map(() => {
    let q: number;
    do { q = Math.floor(rng() * 8) + 1; } while (usedQuarters.has(q));
    usedQuarters.add(q);
    return q;
  });

  const marketShiftDay = Math.floor(rng() * 140) + 60; // Day 60–200
  const marketShiftTo = MARKETS[Math.floor(rng() * 3)];

  return { value, dealPoolIndices, curveballDeck, curveballQuarters, marketShiftDay, marketShiftTo };
}

/** Jitter a base probability ±10% (clamped), deterministic given the session rng. */
export function jitterWeight(base: number, rng: () => number): number {
  return Math.max(0.05, Math.min(0.95, base + (rng() - 0.5) * 0.2));
}
