/**
 * Game / consequence engine. Pure + deterministic given inputs.
 *
 * Turns player decisions into outcomes using counterparty personas (§17), market conditions, and the
 * player's reputation. The lifecycle stages call these resolvers; outcomes adjust cash/reputation and
 * carry a teaching "lesson". Forgiving: bad calls degrade position and usually offer a recovery branch.
 */

import type { Persona } from './personas';

export type MarketCondition = 'hot' | 'balanced' | 'tough';

export interface Reputation {
  broker: number; // 0–100
  lender: number;
  lp: number;
}

export interface GameEvent {
  id: string;
  ts: number;
  dealId?: string;
  title: string;
  detail: string;
  lesson?: string;
}

export interface GameState {
  reputation: Reputation;
  dealsPursued: number;
  dealsClosed: number;
  market: MarketCondition;
  log: GameEvent[];
}

export const INITIAL_GAME: GameState = {
  reputation: { broker: 50, lender: 50, lp: 50 },
  dealsPursued: 0,
  dealsClosed: 0,
  market: 'balanced',
  log: [],
};

export const MARKET_INFO: Record<MarketCondition, { label: string; note: string }> = {
  hot: { label: 'Hot market', note: 'Sellers firm, competition fierce, but capital is plentiful.' },
  balanced: { label: 'Balanced market', note: 'Normal conditions on both sides.' },
  tough: { label: 'Tough market', note: 'Sellers flexible — but equity is scarce and lenders cautious.' },
};

// --- Career tiers ---

export type Tier = 'House Hacker' | 'Syndicator' | 'Operator' | 'Fund Manager';

export function tierFor(dealsClosed: number, repAvg: number): Tier {
  if (dealsClosed >= 8 && repAvg >= 70) return 'Fund Manager';
  if (dealsClosed >= 4 && repAvg >= 60) return 'Operator';
  if (dealsClosed >= 1) return 'Syndicator';
  return 'House Hacker';
}

export function repAverage(r: Reputation): number {
  return Math.round((r.broker + r.lender + r.lp) / 3);
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// --- Offer negotiation (LOI) ---

export interface OfferInput {
  offerPrice: number;
  askPrice: number;
  seller: Persona; // traits: motivation, priceFlex, retradeRisk
  market: MarketCondition;
  brokerRep: number; // 0–100
}

export interface OfferOutcome {
  result: 'accepted' | 'countered' | 'rejected';
  counterPrice?: number;
  /** seller's reservation price (lowest they'd take) — for feedback */
  reservationPrice: number;
  repBrokerDelta: number;
  message: string;
  lesson: string;
}

/** Max discount below ask a seller will accept, given motivation/flex/market/your reputation. */
function maxAcceptableDiscount(i: OfferInput): number {
  const flex = i.seller.traits.priceFlex ?? 0.4;
  const motivation = i.seller.traits.motivation ?? 0.5;
  const marketAdj = i.market === 'tough' ? 0.03 : i.market === 'hot' ? -0.02 : 0;
  const repBonus = ((i.brokerRep - 50) / 100) * 0.03; // ±0.015
  return Math.max(0, 0.02 + flex * 0.12 + motivation * 0.06 + marketAdj + repBonus);
}

export function resolveOffer(i: OfferInput): OfferOutcome {
  const maxDisc = maxAcceptableDiscount(i);
  const reservationPrice = i.askPrice * (1 - maxDisc);
  const offerDisc = 1 - i.offerPrice / i.askPrice;
  const retradeRisk = i.seller.traits.retradeRisk ?? 0.3;

  if (i.offerPrice >= reservationPrice) {
    return {
      result: 'accepted',
      reservationPrice,
      repBrokerDelta: +4,
      message: `${i.seller.name} accepts your offer of ${fmt(i.offerPrice)}.`,
      lesson:
        offerDisc > maxDisc + 0.03
          ? 'You left money on the table — they would have taken less. Knowing the seller lets you anchor lower.'
          : 'Well-judged: priced just inside their reservation. Brokers remember a clean, decisive buyer.',
    };
  }

  // Below reservation: counter if "close", reject if an insulting lowball (esp. firm/low-flex sellers)
  const gap = (reservationPrice - i.offerPrice) / i.askPrice; // how far below reservation, as % of ask
  const insulting = gap > 0.06 && (i.seller.traits.priceFlex ?? 0.4) < 0.45;
  if (insulting) {
    return {
      result: 'rejected',
      reservationPrice,
      repBrokerDelta: -(retradeRisk > 0.3 ? 6 : 3),
      message: `${i.seller.name} rejects the offer outright — it's well below what they'll consider.`,
      lesson: 'Lowballing a firm seller can cost you the deal and the relationship. Match your aggression to the seller persona.',
    };
  }
  return {
    result: 'countered',
    counterPrice: Math.round((reservationPrice + i.offerPrice) / 2),
    reservationPrice,
    repBrokerDelta: 0,
    message: `${i.seller.name} counters at ${fmt(Math.round((reservationPrice + i.offerPrice) / 2))}.`,
    lesson: 'A counter means you are in the zone. Meet near their reservation or walk — don’t chase past your underwriting.',
  };
}

// --- Capital raise (Contract-to-Close) ---

export interface RaiseInput {
  equityNeeded: number;
  strategy: 'solo' | 'partners';
  market: MarketCondition;
  lpRep: number; // 0–100
  dealsClosed: number;
}

export interface RaiseOutcome {
  capacity: number;
  raised: number;
  shortfall: number;
  success: boolean;
  /** offered recovery if short */
  recovery?: string;
  repLpDelta: number;
  message: string;
  lesson: string;
}

export function resolveCapitalRaise(i: RaiseInput): RaiseOutcome {
  const marketFactor = i.market === 'tough' ? 0.6 : i.market === 'hot' ? 1.15 : 1.0;
  const trackBonus = 1 + 0.08 * Math.min(i.dealsClosed, 6);
  const repFactor = 0.5 + (i.lpRep / 100); // 0.5–1.5
  const base = i.strategy === 'partners' ? 1.6 : 0.85;
  const capacity = i.equityNeeded * base * repFactor * trackBonus * marketFactor;
  const raised = Math.min(i.equityNeeded, Math.round(capacity));
  const shortfall = Math.max(0, i.equityNeeded - raised);
  const success = shortfall <= 0;

  if (success) {
    return {
      capacity: Math.round(capacity),
      raised,
      shortfall: 0,
      success: true,
      repLpDelta: +3,
      message: `Raise complete — ${fmt(raised)} committed.`,
      lesson:
        i.strategy === 'solo'
          ? 'Your network + track record carried the raise solo. As deals get bigger this gets harder.'
          : 'Bringing capital partners widened your reach and de-risked the close.',
    };
  }
  return {
    capacity: Math.round(capacity),
    raised,
    shortfall,
    success: false,
    recovery:
      i.strategy === 'solo'
        ? 'Bring a capital-raising partner (GP split) to cover the gap — at the cost of some promote.'
        : 'Extend the raise timeline or reduce the deal size / leverage to close the gap.',
    repLpDelta: -2,
    message: `Short by ${fmt(shortfall)} of the ${fmt(i.equityNeeded)} needed.`,
    lesson:
      i.market === 'tough'
        ? 'In a tough capital market, solo raises fall short. This is exactly when GP partners matter (your original example).'
        : 'You overreached your network. Partner up or right-size the deal.',
  };
}

export function applyRep(r: Reputation, patch: Partial<Reputation>): Reputation {
  return {
    broker: clamp(r.broker + (patch.broker ?? 0)),
    lender: clamp(r.lender + (patch.lender ?? 0)),
    lp: clamp(r.lp + (patch.lp ?? 0)),
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(n);
}
