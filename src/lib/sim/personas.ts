/**
 * Counterparty personas — the heart of game-mode learning.
 *
 * Each party (broker / lender / LP / seller) has archetypes with traits (0–1 scales) and "tells".
 * In game mode they react to the player's decisions (lowball offers, retrades, slow closes, weak
 * capital stack) per their traits. Real mode ignores them. This registry is the source of truth;
 * the consequence engine (later) reads traits to branch outcomes.
 */

export type CounterpartyKind = 'broker' | 'lender' | 'lp' | 'seller' | 'exit-buyer';

export interface Persona {
  id: string;
  kind: CounterpartyKind;
  name: string;
  blurb: string;
  /** 0–1 trait scales, keyed per kind */
  traits: Record<string, number>;
  /** behavioral tells / how to play them */
  tells: string[];
}

export const PERSONAS: Persona[] = [
  // --- Brokers ---
  { id: 'broker-relationship', kind: 'broker', name: 'Relationship Broker', blurb: 'Sends you repeat deals if you perform and close clean.',
    traits: { loyalty: 0.9, transparency: 0.7, competitiveness: 0.4 }, tells: ['Rewards certainty of close over top dollar', 'Retrading once can cost you future looks'] },
  { id: 'broker-institutional', kind: 'broker', name: 'Institutional Broker', blurb: 'CBRE/JLL-style polished, runs a competitive call-for-offers.',
    traits: { loyalty: 0.3, transparency: 0.6, competitiveness: 0.9 }, tells: ['Best-and-final processes', 'Needs proof of funds + track record to shortlist you'] },
  { id: 'broker-pocket', kind: 'broker', name: 'Pocket-Listing Broker', blurb: 'Off-market deals to a short list; guards information.',
    traits: { loyalty: 0.6, transparency: 0.3, competitiveness: 0.3 }, tells: ['Wants discretion + quick reads', 'Thin financials up front — DD reveals more'] },
  { id: 'broker-churn', kind: 'broker', name: 'Churn-and-Burn Broker', blurb: 'Lists everything, low info, sprays the market.',
    traits: { loyalty: 0.2, transparency: 0.4, competitiveness: 0.7 }, tells: ['High deal flow, low quality', 'Verify everything yourself'] },

  // --- Lenders ---
  { id: 'lender-agency', kind: 'lender', name: 'Agency (Fannie/Freddie)', blurb: 'Best rates, non-recourse, strict DSCR + slow.',
    traits: { speed: 0.3, leverage: 0.7, cost: 0.2, flexibility: 0.3, recourse: 0.0 }, tells: ['Needs ≥1.25 DSCR', 'Rate-locks late; long timeline'] },
  { id: 'lender-bridge', kind: 'lender', name: 'Bridge / Debt Fund', blurb: 'Fast, flexible, higher cost; good for heavy value-add.',
    traits: { speed: 0.9, leverage: 0.85, cost: 0.8, flexibility: 0.9, recourse: 0.4 }, tells: ['Closes fast', 'Expensive — plan the refi/exit'] },
  { id: 'lender-bank', kind: 'lender', name: 'Local Bank', blurb: 'Relationship lender, recourse, conservative LTV.',
    traits: { speed: 0.6, leverage: 0.6, cost: 0.4, flexibility: 0.5, recourse: 0.9 }, tells: ['Wants a guarantor/balance sheet', 'Lower leverage'] },
  { id: 'lender-lifeco', kind: 'lender', name: 'Life Company', blurb: 'Cheapest long-term money, low leverage, picky on asset/sponsor.',
    traits: { speed: 0.4, leverage: 0.5, cost: 0.1, flexibility: 0.3, recourse: 0.0 }, tells: ['Only A-quality assets', 'Long fixed terms'] },

  // --- LPs ---
  { id: 'lp-passive', kind: 'lp', name: 'Passive Investor', blurb: 'Wants cash flow + simplicity; trusts the sponsor.',
    traits: { checkSize: 0.3, sophistication: 0.3, patience: 0.7 }, tells: ['Cares about distributions + comms', 'Light on term negotiation'] },
  { id: 'lp-familyoffice', kind: 'lp', name: 'Family Office', blurb: 'Sophisticated, negotiates terms, may want co-GP rights.',
    traits: { checkSize: 0.8, sophistication: 0.9, patience: 0.5 }, tells: ['Negotiates promote/pref', 'Wants control + reporting'] },
  { id: 'lp-friendsfamily', kind: 'lp', name: 'Friends & Family', blurb: 'Trust-based small checks; relationship risk if it goes wrong.',
    traits: { checkSize: 0.2, sophistication: 0.2, patience: 0.8 }, tells: ['Fast to commit', 'Reputational stakes are personal'] },
  { id: 'lp-institutional', kind: 'lp', name: 'Institutional LP', blurb: 'Big check, strict diligence, demands track record.',
    traits: { checkSize: 1.0, sophistication: 1.0, patience: 0.3 }, tells: ['Needs proven track record', 'Heavy reporting + control terms'] },

  // --- Sellers ---
  { id: 'seller-distressed', kind: 'seller', name: 'Motivated / Distressed', blurb: 'Price-flexible, wants a fast certain close.',
    traits: { motivation: 0.9, priceFlex: 0.8, retradeRisk: 0.2 }, tells: ['Reward speed/certainty', 'Room to negotiate price'] },
  { id: 'seller-tired', kind: 'seller', name: 'Tired Landlord', blurb: 'Wants a clean exit; deferred maintenance likely.',
    traits: { motivation: 0.7, priceFlex: 0.5, retradeRisk: 0.3 }, tells: ['DD will find capex', 'Values a smooth process'] },
  { id: 'seller-institutional', kind: 'seller', name: 'Institutional Seller', blurb: "Won't retrade or hand-hold; expects certainty.",
    traits: { motivation: 0.4, priceFlex: 0.2, retradeRisk: 0.1 }, tells: ['Firm price', 'Hard close dates — perform or lose EMD'] },
  { id: 'seller-unrealistic', kind: 'seller', name: 'Unrealistic Seller', blurb: 'Over-priced, slow, anchored to a dream number.',
    traits: { motivation: 0.3, priceFlex: 0.3, retradeRisk: 0.4 }, tells: ['Often a dead deal', 'Patience + a low anchor, or pass'] },

  // --- Exit buyers ---
  { id: 'buyer-core-fund', kind: 'exit-buyer', name: 'Core Fund Buyer', blurb: 'Low-yield buyer seeking stable cash flow and low operational variance.',
    traits: { priceDiscipline: 0.5, certainty: 0.9, speed: 0.5, riskTolerance: 0.25 }, tells: ['Pays up for stability', 'Penalizes unresolved operational volatility'] },
  { id: 'buyer-value-add', kind: 'exit-buyer', name: 'Value-Add Buyer', blurb: 'Underwrites upside and may move quickly if there is meat left on the bone.',
    traits: { priceDiscipline: 0.75, certainty: 0.65, speed: 0.75, riskTolerance: 0.7 }, tells: ['Will absorb some mess if basis is right', 'Negotiates hard on capex and deferred risks'] },
  { id: 'buyer-1031', kind: 'exit-buyer', name: '1031 Exchange Buyer', blurb: 'Deadline-driven buyer; values certainty and speed over perfection.',
    traits: { priceDiscipline: 0.4, certainty: 0.95, speed: 0.95, riskTolerance: 0.45 }, tells: ['Can move fast under exchange pressure', 'Execution certainty can beat pure price'] },
  { id: 'buyer-distressed', kind: 'exit-buyer', name: 'Distressed Opportunistic Buyer', blurb: 'Looks for broken stories and demands deep discounts.',
    traits: { priceDiscipline: 0.95, certainty: 0.55, speed: 0.65, riskTolerance: 0.9 }, tells: ['Shows up when markets freeze', 'Prices macro and operational pain aggressively'] },
];

export function personasByKind(kind: CounterpartyKind): Persona[] {
  return PERSONAS.filter((p) => p.kind === kind);
}

export function personaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Assign a persona of a kind to a deal. Deterministic per (deal, session): the optional `salt` is the
 * session seed, so the SAME property draws a different seller/broker personality across playthroughs
 * (design doc Part 4, layer 2) while staying stable within a session.
 */
export function pickPersona(kind: CounterpartyKind, seedKey: string, salt = 0): Persona {
  const list = personasByKind(kind);
  return list[hash(`${kind}:${seedKey}:${salt}`) % list.length];
}

/** Broker + seller for a deal (the two counterparties active at sourcing/napkin). */
export function dealCounterparties(seedKey: string, salt = 0): { broker: Persona; seller: Persona } {
  return { broker: pickPersona('broker', seedKey, salt), seller: pickPersona('seller', seedKey, salt) };
}

/** Exit-stage buyer profile (who is on the other side of your sale). */
export function dealExitBuyer(seedKey: string, salt = 0): Persona {
  return pickPersona('exit-buyer', seedKey, salt);
}
