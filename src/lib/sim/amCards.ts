/**
 * Asset-management quarterly card decks (design doc Part 3). Over the hold, each quarter draws a few
 * cards: any seeded curveball assigned to that quarter fires first, then standard cards are drawn from
 * the eligible pool (filtered by Deal DNA, weighted toward the player's weak spots). Pure.
 */

import type { AMCard, DealDNA, SessionSeed } from './gameTypes';
import { seededRng } from './sessionSeed';

export const AM_CARDS: AMCard[] = [
  // ── Operations ──
  {
    id: 'hvac-failure', deck: 'operations', speaker: 'Property manager',
    title: 'HVAC system failure', prompt: 'Three rooftop units died in a heat wave. Tenants are calling. Replace now or patch and defer?',
    weightBoost: { condition: { ddDepth: 'light' }, factor: 2 },
    options: [
      { id: 'replace', label: 'Replace the units now', detail: 'Expensive, but done right.', tone: 'good', effects: { cash: -85_000, setFlag: 'hvac-replaced' }, result: 'New units installed. NOI stable, tenants happy.' },
      { id: 'patch', label: 'Patch and defer', detail: 'Cheaper now — gamble on the summer.', tone: 'warn', branches: [
        { weight: 0.5, result: 'The patch holds through the season. You got lucky.', effects: { cash: -12_000 } },
        { weight: 0.5, result: 'A unit fails again mid-August — emergency replacement at a premium.', effects: { cash: -110_000, occupancyDelta: -0.03 } },
      ] },
    ],
  },
  {
    id: 'property-manager-underperform', deck: 'operations', speaker: 'Asset manager',
    title: 'Your PM is slipping', prompt: 'Occupancy is drifting and work orders are aging. The property manager is overstretched.',
    options: [
      { id: 'replace-pm', label: 'Replace the PM', detail: 'Disruptive, but resets operations.', tone: 'warn', effects: { days: 30, occupancyDelta: 0.03, cash: -8_000 }, result: 'New PM stabilizes the asset over the next quarter.' },
      { id: 'coach-pm', label: 'Coach the current PM', detail: 'Cheaper; depends on the person.', tone: 'warn', branches: [
        { weight: 0.55, result: 'They step up — occupancy recovers.', effects: { occupancyDelta: 0.02 } },
        { weight: 0.45, result: 'No change. You lose a quarter before acting.', effects: { occupancyDelta: -0.02 } },
      ] },
    ],
  },
  {
    id: 'renovation-decision', deck: 'operations', speaker: 'Asset manager',
    title: 'Renovation pace', prompt: 'You can accelerate unit renovations to push rents, or hold capital.',
    requires: { businessPlan: 'value-add' },
    options: [
      { id: 'accelerate', label: 'Accelerate renovations', detail: 'Spend now to lift rents.', tone: 'good', effects: { cash: -120_000, noiDelta: 45_000 }, result: 'Renovated units lease at a premium — NOI steps up.' },
      { id: 'hold', label: 'Hold the pace', detail: 'Preserve cash.', tone: 'warn', effects: {}, result: 'You keep the renovation budget in reserve for now.' },
    ],
  },

  // ── Market ──
  {
    id: 'new-supply-announcement', deck: 'market', speaker: 'Market report',
    title: 'New supply announced', prompt: 'A 300-unit project broke ground two miles away. Lease-up competition is coming in ~12 months.',
    options: [
      { id: 'pre-lease', label: 'Get ahead — offer renewals early', detail: 'Lock tenants before the new product opens.', tone: 'good', effects: { cash: -20_000, setFlag: 'pre-leased' }, result: 'You lock in renewals; occupancy holds through the lease-up wave.' },
      { id: 'ride', label: 'Ride it out', detail: 'Do nothing and hope.', tone: 'warn', branches: [
        { weight: 0.5, result: 'Demand absorbs the supply — no impact.', effects: {} },
        { weight: 0.5, result: 'Concessions next door pull your occupancy down.', effects: { occupancyDelta: -0.05, noiDelta: -25_000 } },
      ] },
    ],
  },
  {
    id: 'rate-hike-shock', deck: 'market', speaker: 'Lender',
    title: 'Rates spike', prompt: 'Rates jumped 75 bps. If you have floating-rate or near-term maturity debt, your coverage is squeezed.',
    options: [
      { id: 'rate-cap', label: 'Buy a rate cap', detail: 'Costs cash; caps the downside.', tone: 'good', effects: { cash: -45_000, setFlag: 'rate-capped' }, result: 'You cap the rate — debt service is protected.' },
      { id: 'absorb', label: 'Absorb it', detail: 'Hope rates come back down.', tone: 'bad', effects: { noiDelta: -30_000 }, result: 'Higher debt service eats into cash flow each quarter.' },
    ],
  },
  {
    id: 'favorable-comp-lease', deck: 'market', speaker: 'Leasing agent',
    title: 'A strong comp prints', prompt: 'A comparable property just leased well above your in-place rents. You have pricing power.',
    options: [
      { id: 'push-rents', label: 'Push rents on renewals', detail: 'Capture the upside; risk a little turnover.', tone: 'good', branches: [
        { weight: 0.7, result: 'Renewals hold at the higher rents — NOI rises.', effects: { noiDelta: 35_000 } },
        { weight: 0.3, result: 'A few tenants leave; net positive but some turn cost.', effects: { noiDelta: 18_000, occupancyDelta: -0.02 } },
      ] },
      { id: 'steady', label: 'Keep rents steady', detail: 'Prioritize occupancy.', tone: 'warn', effects: {}, result: 'You hold rents and keep the building full.' },
    ],
  },

  // ── Capital ──
  {
    id: 'refi-window', deck: 'capital', speaker: 'Mortgage broker',
    title: 'Refinance window opens', prompt: 'You\'ve grown NOI. A cash-out refi could return capital to investors — but resets your debt.',
    options: [
      { id: 'refi', label: 'Refinance and return capital', detail: 'Tax-free cash-out; higher debt service.', tone: 'good', effects: { cash: 250_000, noiDelta: -20_000, setFlag: 'refinanced' }, result: 'You pull out equity for investors — they love it. Coverage is tighter now.' },
      { id: 'hold-debt', label: 'Hold the current loan', detail: 'Keep it simple.', tone: 'warn', effects: {}, result: 'You leave the financing as-is for now.' },
    ],
  },
  {
    id: 'capital-call-trigger', deck: 'capital', speaker: 'You',
    title: 'Cash is running low', prompt: 'Reserves are nearly depleted. You need capital to cover the next few quarters.',
    weightBoost: { condition: { uwScore: 3 }, factor: 2 },
    options: [
      { id: 'capital-call', label: 'Issue a capital call to LPs', detail: 'Fills the gap — but signals trouble.', tone: 'bad', effects: { cash: 150_000, rep: { lp: -8 } }, result: 'LPs wire the call, but trust takes a hit. They\'ll scrutinize the next raise.' },
      { id: 'self-fund-reserve', label: 'Self-fund the reserve', detail: 'Protects LP trust; drains your cash.', tone: 'warn', effects: { cash: -150_000 }, result: 'You quietly top up reserves yourself. LPs never knew.' },
    ],
  },
  {
    id: 'lp-cold-feet', deck: 'capital', speaker: 'LP',
    title: 'An LP wants out', prompt: 'A limited partner is asking about secondary options to exit their position early.',
    options: [
      { id: 'buy-out', label: 'Arrange a buyout at fair value', detail: 'Clean, preserves goodwill.', tone: 'good', effects: { cash: -60_000, rep: { lp: 4 } }, result: 'You facilitate a fair exit; the LP refers a friend later.' },
      { id: 'stall', label: 'Stall and hope they forget', detail: 'Avoids cash outlay; risky.', tone: 'bad', effects: { rep: { lp: -10 } }, result: 'The LP feels ignored. Word travels in the LP community.' },
    ],
  },

  // ── Relationship ──
  {
    id: 'seller-network-referral', deck: 'relationship', speaker: 'Former seller',
    title: 'A referral comes in', prompt: 'The seller from a clean past close calls: a friend is quietly selling a similar asset off-market.',
    options: [
      { id: 'take-look', label: 'Take the look', detail: 'Off-market shot at your next deal.', tone: 'good', effects: { rep: { broker: 5 }, setFlag: 'off-market-lead' }, result: 'You\'re first in line on an off-market deal — exactly how repeat business compounds.' },
      { id: 'pass', label: 'Pass — focused on this asset', detail: 'Stay disciplined.', tone: 'warn', effects: {}, result: 'You thank them and stay focused on the asset at hand.' },
    ],
  },
  {
    id: 'lp-update', deck: 'relationship', speaker: 'Asset manager',
    title: 'Quarterly investor update due', prompt: 'It\'s time for the investor report. Performance is roughly on plan.',
    options: [
      { id: 'transparent', label: 'Send a full, transparent report', detail: 'Numbers + a variance note.', tone: 'good', effects: { rep: { lp: 5 } }, result: 'Investors appreciate the candor — your next raise gets easier.' },
      { id: 'thin', label: 'Send a thin update', detail: 'Saves time.', tone: 'warn', effects: { rep: { lp: -3 } }, result: 'A bare-bones update leaves LPs wanting more.' },
    ],
  },

  // ── Disposition ──
  {
    id: 'unsolicited-buyer-offer', deck: 'disposition', speaker: 'Broker',
    title: 'Unsolicited offer', prompt: 'A buyer made an unsolicited offer near your projected exit value. Sell now, or keep operating?',
    options: [
      { id: 'sell-now', label: 'Sell now', detail: 'Lock the gain; end the hold.', tone: 'good', effects: { setFlag: 'exit-now' }, result: 'You take the bird in hand and head to disposition.' },
      { id: 'counter', label: 'Counter higher', detail: 'Test their ceiling.', tone: 'warn', branches: [
        { weight: 0.5, result: 'They meet you near your counter — even better exit.', effects: { performanceFactor: 1.04, setFlag: 'exit-now' } },
        { weight: 0.5, result: 'They walk. You keep operating.', effects: {} },
      ] },
      { id: 'decline', label: 'Decline — keep operating', detail: 'Bet on more upside.', tone: 'warn', effects: {}, result: 'You hold for more NOI growth.' },
    ],
  },
];

function eligible(card: AMCard, dna?: Partial<DealDNA>): boolean {
  const r = card.requires;
  if (!r) return true;
  if (r.businessPlan && dna?.businessPlan !== r.businessPlan) return false;
  if (r.ddDepth && dna?.ddDepth !== r.ddDepth) return false;
  if (r.lenderChosen && dna?.lenderChosen !== r.lenderChosen) return false;
  return true;
}

/** Draw this quarter's cards: seeded curveball first (if assigned), then standard cards by weight. */
export function drawAMCards(args: { quarter: number; seed: SessionSeed; dna?: Partial<DealDNA>; firedIds: string[]; weakSpots?: string[]; count?: number }): AMCard[] {
  const { quarter, seed, dna, firedIds, weakSpots = [], count = 2 } = args;
  const rng = seededRng(seed.value + quarter * 7919);
  const out: AMCard[] = [];

  // curveball assigned to this quarter (if it maps to a real card)
  const idx = seed.curveballQuarters.indexOf(quarter);
  if (idx >= 0) {
    const cb = AM_CARDS.find((c) => c.id === seed.curveballDeck[idx]);
    if (cb && !firedIds.includes(cb.id)) out.push(cb);
  }

  // weighted draw from the remaining eligible pool
  const pool = AM_CARDS.filter((c) => !firedIds.includes(c.id) && !out.includes(c) && eligible(c, dna));
  const weighted = pool.map((c) => {
    let w = 1;
    if (c.weightBoost) {
      const cond = c.weightBoost.condition;
      const dnaUw = dna?.uwScore ?? 0;
      const matches = (cond.ddDepth ? dna?.ddDepth === cond.ddDepth : true) && (cond.uwScore ? dnaUw >= cond.uwScore : true);
      if (matches) w *= c.weightBoost.factor;
    }
    // bias toward the player's weak spots
    if (weakSpots.includes('light-dd') && c.deck === 'operations') w *= 1.5;
    if (weakSpots.includes('aggressive-uw') && c.deck === 'market') w *= 1.5;
    return { c, w };
  });

  while (out.length < count && weighted.length) {
    const total = weighted.reduce((a, x) => a + x.w, 0);
    let r = rng() * total;
    let pick = 0;
    for (let i = 0; i < weighted.length; i++) { r -= weighted[i].w; if (r <= 0) { pick = i; break; } }
    out.push(weighted[pick].c);
    weighted.splice(pick, 1);
  }
  return out;
}
