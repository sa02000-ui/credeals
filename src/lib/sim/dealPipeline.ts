/**
 * Day-driven deal flow (game-flow redesign, Phase B). Real deal flow comes TO you over time through
 * different channels — a broker calls, a listing matches your box, an off-market look lands. This turns
 * a flat pool of deals into a seeded schedule: each deal gets an arrival day, a sourcing channel, and an
 * expiry (off-market moves fastest). Pure + deterministic from the session seed, so no DB schema change.
 */

import type { MarketDeal, DealChannel } from './types';
import type { SessionSeed } from './gameTypes';

export interface PipelineEntry {
  deal: MarketDeal;
  channel: DealChannel;
  arrivalDay: number;
  /** un-pursued deals trade away after this day */
  expiresOnDay: number;
}

const CHANNELS: DealChannel[] = ['website-match', 'broker-on-market', 'broker-off-market'];

/** Days a deal stays live before it trades away if you don't pursue it. Off-market = urgency. */
const FUSE: Record<DealChannel, number> = {
  'website-match': 24, // listings linger
  'broker-on-market': 16,
  'broker-off-market': 10, // first looks move fast — reward acting (and relationships)
};

const FIRST_ARRIVAL = 2; // nothing on day 1 (you're setting up your buy box); first deals land on day 2
const BATCH_SIZE = 2; // deals per arrival wave
const CADENCE = 2; // days between waves

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Build the arrival schedule for a pool of game-mode deals. Deterministic from the seed: deal order,
 * channel mix, and arrival waves all derive from seed.value + the deal id, so a given session always
 * plays the same flow, but different sessions differ.
 */
export function buildPipeline(deals: MarketDeal[], seed: SessionSeed): PipelineEntry[] {
  // seeded, stable ordering of the pool
  const ordered = [...deals].sort((a, b) => hash(`${seed.value}:${a.id}`) - hash(`${seed.value}:${b.id}`));
  return ordered.map((deal, i) => {
    const channel = CHANNELS[hash(`${seed.value}:ch:${deal.id}`) % CHANNELS.length];
    const arrivalDay = FIRST_ARRIVAL + Math.floor(i / BATCH_SIZE) * CADENCE;
    return { deal, channel, arrivalDay, expiresOnDay: arrivalDay + FUSE[channel] };
  });
}

export const CHANNEL_LABEL: Record<DealChannel, string> = {
  'website-match': 'Listing — matched your buy box',
  'broker-on-market': 'Broker call — on-market',
  'broker-off-market': 'Broker call — off-market',
};

export const CHANNEL_SHORT: Record<DealChannel, string> = {
  'website-match': '🌐 Listing',
  'broker-on-market': '📞 On-market',
  'broker-off-market': '🤝 Off-market',
};

/** A short arrival line for the notification inbox. */
export function arrivalNote(e: PipelineEntry): { title: string; body: string } {
  const where = `${e.deal.city}, ${e.deal.state}`;
  switch (e.channel) {
    case 'broker-off-market':
      return { title: '🤝 Off-market look', body: `A broker called you first on ${e.deal.name} (${where}) before it hits the market. These move fast — take a look soon.` };
    case 'broker-on-market':
      return { title: '📞 Broker call', body: `A broker pitched you ${e.deal.name} (${where}), now on the market. Want to underwrite it?` };
    default:
      return { title: '🌐 New listing matched', body: `${e.deal.name} (${where}) just listed and fits your buy box. Worth a napkin underwrite?` };
  }
}
