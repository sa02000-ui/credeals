/**
 * Game / consequence engine. Pure + deterministic given inputs.
 *
 * Turns player decisions into outcomes using counterparty personas (§17), market conditions, and the
 * player's reputation. The lifecycle stages call these resolvers; outcomes adjust cash/reputation and
 * carry a teaching "lesson". Forgiving: bad calls degrade position and usually offer a recovery branch.
 */

import type { Persona } from './personas';
import { usd } from './format';

export type MarketCondition = 'hot' | 'balanced' | 'tough';

/** Difficulty / realism level, chosen at the start of a game (DESIGN §22 H). */
export type Difficulty = 'guided' | 'standard' | 'expert';

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string; startingCash: number }> = {
  guided: { label: 'Guided', blurb: 'Coaching prompts + hints, generous capital, forgiving counterparties. Best for learning.', startingCash: 400_000 },
  standard: { label: 'Standard', blurb: 'Objectives on, market-rate capital and personas. The intended experience.', startingCash: 250_000 },
  expert: { label: 'Expert', blurb: 'No hints, tight capital, tougher sellers and more retrades. For pros.', startingCash: 150_000 },
};

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

// --- LOI live negotiation (DESIGN §22 E1) ---

export interface LOITerms {
  price: number;
  emdPct: number; // EMD as a fraction of price (higher pleases seller)
  ddDays: number; // shorter pleases seller
  closeDays: number; // shorter pleases seller
  financingContingency: boolean; // removing it pleases seller
  /** earnest money goes hard at PSA (non-refundable) — strong certainty-of-close signal */
  nonRefundableEmd?: boolean;
  /** who pays title insurance — buyer paying pleases the seller */
  titlePayer?: 'seller' | 'buyer' | 'split';
}

export interface NegInput {
  terms: LOITerms;
  askPrice: number;
  seller: Persona;
  market: MarketCondition;
  brokerRep: number; // 0–100
  responsiveness: number; // 0–1 (1 = replied fast)
  round: number; // 1-based
  competingPressure: number; // 0–1, accumulates
}

export interface NegResult {
  outcome: 'accepted' | 'counter' | 'rejected' | 'lost';
  counter?: LOITerms;
  changes: string[];
  competingPressure: number;
  message: string;
  lesson: string;
}

export function negotiateLOI(i: NegInput): NegResult {
  const t = i.terms;
  const maxDisc = maxAcceptableDiscount({ offerPrice: t.price, askPrice: i.askPrice, seller: i.seller, market: i.market, brokerRep: i.brokerRep });
  const reservationPrice = i.askPrice * (1 - maxDisc);
  const flex = i.seller.traits.priceFlex ?? 0.4;

  // competing-buyer pressure: rises with hot market, slow responses, and rounds dragging on
  const baseGrow = i.market === 'hot' ? 0.24 : i.market === 'balanced' ? 0.11 : 0.02;
  const grow = baseGrow * (1.2 - i.responsiveness) * (1 + 0.18 * (i.round - 1));
  const competingPressure = clamp(i.competingPressure + grow, 0, 1);

  // term-by-term satisfaction
  const priceScore = clamp((t.price - reservationPrice * 0.96) / (i.askPrice - reservationPrice * 0.96 + 1), 0, 1);
  const emdScore = clamp(t.emdPct / 0.02, 0, 1);
  const ddScore = clamp((45 - t.ddDays) / 30, 0, 1);
  const closeScore = clamp((75 - t.closeDays) / 45, 0, 1);
  const contScore = t.financingContingency ? 0.35 : 1;
  const hardScore = t.nonRefundableEmd ? 1 : 0.4; // EMD going hard at PSA = strong certainty of close
  const titleScore = t.titlePayer === 'buyer' ? 1 : t.titlePayer === 'split' ? 0.6 : 0.3;
  const score =
    priceScore * 0.46 + emdScore * 0.08 + ddScore * 0.1 + closeScore * 0.06 + contScore * 0.16 +
    hardScore * 0.1 + titleScore * 0.05 + i.responsiveness * 0.05;

  const gapBelow = (reservationPrice - t.price) / i.askPrice;
  const insulting = gapBelow > 0.06 && flex < 0.45;

  // lost to a competitor when pressure maxes out in a competitive market
  if (competingPressure >= 1 && i.market !== 'tough') {
    return { outcome: 'lost', changes: [], competingPressure, message: `${i.seller.name} went with a competing buyer who moved faster.`, lesson: 'In a hot market, speed wins. Decisive, prompt responses keep you ahead of other bidders.' };
  }
  if (insulting && i.round === 1) {
    return { outcome: 'rejected', changes: [], competingPressure, message: `${i.seller.name} rejects the offer — it's well below what they'll consider.`, lesson: 'Match aggression to the seller. A firm seller walks from a lowball instead of countering.' };
  }

  const acceptThreshold = 0.6;
  if (t.price >= reservationPrice && score >= acceptThreshold) {
    return { outcome: 'accepted', changes: [], competingPressure, message: `${i.seller.name} accepts your terms at ${fmt(t.price)}.`, lesson: score > 0.85 ? 'Clean, decisive terms — sellers reward certainty of close.' : 'Accepted just inside their reservation. Well judged.' };
  }

  // build a counter: move the weak terms toward the seller
  const counter: LOITerms = {
    price: Math.round(Math.max(t.price, reservationPrice)),
    emdPct: Math.max(t.emdPct, 0.015),
    ddDays: Math.min(t.ddDays, 30),
    closeDays: Math.min(t.closeDays, 45),
    financingContingency: false,
    nonRefundableEmd: true,
    titlePayer: t.titlePayer === 'seller' ? 'split' : t.titlePayer ?? 'split',
  };
  const changes: string[] = [];
  if (counter.price > t.price) changes.push(`raise price to ${fmt(counter.price)}`);
  if (counter.emdPct > t.emdPct + 1e-6) changes.push(`increase earnest money to ${(counter.emdPct * 100).toFixed(1)}%`);
  if (!t.nonRefundableEmd) changes.push('make the earnest money non-refundable at PSA');
  if (counter.ddDays < t.ddDays) changes.push(`shorten due diligence to ${counter.ddDays} days`);
  if (counter.closeDays < t.closeDays) changes.push(`close within ${counter.closeDays} days`);
  if (t.financingContingency) changes.push('drop the financing contingency');
  if (t.titlePayer === 'seller') changes.push('split the title insurance cost');
  if (changes.length === 0) changes.push('hold firm on current terms');

  return {
    outcome: 'counter',
    counter,
    changes,
    competingPressure,
    message: `${i.seller.name} counters — they want you to ${changes.join(', ')}.`,
    lesson: 'A counter means you are in the zone. Concede what costs you least (often terms, not price) and respond quickly.',
  };
}

// --- Closing resolution + scorecard (DESIGN §22 E4) ---

export interface ClosingFactors {
  contingenciesCleared: boolean;
  raiseFunded: boolean;
  onTime: boolean;
  psaProtection: number; // 0–1 share of sneaky clauses caught
  ddDone: boolean;
  difficulty: Difficulty;
}
export interface DealGrade { label: string; grade: 'A' | 'B' | 'C' | 'D'; note: string }
export interface ClosingResult {
  success: boolean;
  closeScore: number; // 0–100
  performanceFactor: number; // multiplier applied to projected returns
  grades: DealGrade[];
  message: string;
  lesson: string;
  recovery?: string;
}

export function resolveClosing(f: ClosingFactors): ClosingResult {
  let score = 0;
  score += f.contingenciesCleared ? 30 : 0;
  score += f.raiseFunded ? 30 : 0;
  score += f.onTime ? 15 : 0;
  score += Math.round(f.psaProtection * 15);
  score += f.ddDone ? 10 : 0;

  const pass = f.difficulty === 'guided' ? 50 : f.difficulty === 'expert' ? 70 : 60;
  const success = score >= pass;
  const performanceFactor = clamp(0.62 + (score / 100) * 0.45 - (f.ddDone ? 0 : 0.05) - (1 - f.psaProtection) * 0.06, 0.5, 1.05);

  const g = (ok: boolean, label: string, okNote: string, badNote: string): DealGrade => ({ label, grade: ok ? 'A' : 'C', note: ok ? okNote : badNote });
  const grades: DealGrade[] = [
    g(f.raiseFunded, 'Capital raise', 'Fully funded the equity', 'Came up short on the raise'),
    g(f.contingenciesCleared, 'Diligence & debt', 'Cleared contingencies cleanly', 'Left contingencies unresolved'),
    g(f.onTime, 'Critical dates', 'Closed on schedule', 'Slipped key deadlines'),
    { label: 'Contract protection', grade: f.psaProtection >= 0.8 ? 'A' : f.psaProtection >= 0.5 ? 'B' : 'D', note: `Caught ${Math.round(f.psaProtection * 100)}% of the PSA traps` },
    g(f.ddDone, 'Due diligence', 'Did the work — no surprises', 'Skipped DD — hidden risks remain'),
  ];

  return {
    success,
    closeScore: score,
    performanceFactor,
    grades,
    message: success ? 'You closed the deal!' : 'The deal stumbled at the closing table.',
    lesson: success
      ? 'Certainty of close comes from a funded raise, cleared contingencies, and hit dates — protect all three.'
      : 'A miss here is recoverable: bring a partner, extend, or right-size — but it costs you.',
    recovery: success ? undefined : !f.raiseFunded ? 'Bring a capital partner to cover the equity gap (shared promote).' : 'Negotiate an extension and re-clear the open items.',
  };
}

export function applyRep(r: Reputation, patch: Partial<Reputation>): Reputation {
  return {
    broker: clamp(r.broker + (patch.broker ?? 0)),
    lender: clamp(r.lender + (patch.lender ?? 0)),
    lp: clamp(r.lp + (patch.lp ?? 0)),
  };
}

// Currency formatting lives in format.ts (usd) — delegate so there's one source of truth.
function fmt(n: number): string {
  return usd(n, { compact: true });
}
