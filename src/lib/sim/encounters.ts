/**
 * Encounter content for the game's signature moments (DESIGN §22):
 *  - E2: a PSA "catch the trap" clause library + a builder that deals a hand of clauses.
 *  - E3: a Contract-to-Close decision deck (event cards with consequential options).
 * Pure data/logic; the modals/components render and resolve these.
 */

import type { Difficulty, MarketCondition, Reputation } from './gameEngine';

// ---------------------------------------------------------------------------
//  E2 — PSA "catch the trap"
// ---------------------------------------------------------------------------

export interface PSAClause {
  id: string;
  title: string;
  text: string; // the clause as drafted by the seller's counsel
  sneaky: boolean; // true = a trap that hurts the buyer
  explain: string; // why it's a trap (or why it's standard/fine)
}

/** Real CRE PSA gotchas (sneaky) mixed with standard market clauses (benign). */
export const PSA_CLAUSE_LIBRARY: PSAClause[] = [
  { id: 'go-hard-signing', title: 'Earnest money', text: 'The Earnest Money Deposit shall be non-refundable upon execution of this Agreement.', sneaky: true, explain: 'Your EMD should only "go hard" AFTER due diligence — not at signing. This puts your deposit at risk before you have inspected anything.' },
  { id: 'as-is-no-reps', title: 'Property condition', text: 'Purchaser accepts the Property strictly AS-IS, WHERE-IS, with NO representations or warranties of any kind, express or implied.', sneaky: true, explain: 'Zero reps means the seller warrants nothing — title, environmental, leases, litigation. Push for at least standard reps with a survival period.' },
  { id: 'reps-survival-0', title: 'Survival of representations', text: 'All representations and warranties of Seller shall terminate and not survive Closing.', sneaky: true, explain: 'If reps do not survive closing, you cannot recover for a misstatement discovered after you own it. Negotiate a 6–12 month survival period with a cap/basket.' },
  { id: 'dd-shortened', title: 'Inspection period', text: 'Purchaser shall have ten (10) days from the Effective Date to complete all inspections and investigations.', sneaky: true, explain: 'Ten days is far too short for a full lease audit, third-party reports, and financing. Standard is ~30 days; a quietly short window pressures you to waive DD.' },
  { id: 'seller-retrade', title: 'Appraisal', text: 'Seller reserves the right to renegotiate the Purchase Price if the lender appraisal exceeds the agreed value by any amount.', sneaky: true, explain: 'This is a one-way retrade in the seller’s favor — they can raise the price on a high appraisal but you get no relief on a low one. Strike it or make it mutual.' },
  { id: 'assignment-prohibited', title: 'Assignment', text: 'This Agreement may not be assigned by Purchaser under any circumstances, including to an affiliated entity.', sneaky: true, explain: 'You almost always close in a newly-formed SPV/“and/or assigns.” A blanket no-assignment clause blocks your standard structure. Carve out affiliates.' },
  { id: 'credit-cap', title: 'Repair credits', text: 'Any Seller credit for required repairs shall not exceed $10,000 in the aggregate, regardless of findings.', sneaky: true, explain: 'A hard cap far below likely repair costs leaves you holding the bag for deferred maintenance DD uncovers. Tie credits to actual findings.' },
  { id: 'tax-proration-seller', title: 'Tax proration', text: 'Real estate taxes shall be prorated based on the most recent ASSESSED value rather than the current tax bill.', sneaky: true, explain: 'On a recently reassessed/rising-tax property this shifts cost to you. Standard is proration on the current bill (or re-prorated when the actual bill issues).' },

  { id: 'title-cure', title: 'Title', text: 'Seller shall convey marketable, insurable title and shall have the right and obligation to cure title objections prior to Closing.', sneaky: false, explain: 'Standard and buyer-friendly: seller must deliver clean, insurable title and cure objections.' },
  { id: 'estoppels', title: 'Tenant estoppels', text: 'Seller shall use commercially reasonable efforts to obtain tenant estoppel certificates prior to Closing.', sneaky: false, explain: 'Standard — estoppels confirm lease terms. You’d prefer “shall deliver,” but “reasonable efforts” is common and not a trap.' },
  { id: 'casualty-standard', title: 'Casualty / condemnation', text: 'In the event of material casualty or condemnation prior to Closing, Purchaser may terminate and receive a refund of the Earnest Money.', sneaky: false, explain: 'Standard and protective of the buyer — you can walk if the asset is materially damaged before closing.' },
  { id: 'closing-costs-customary', title: 'Closing costs', text: 'Closing costs shall be allocated between the parties in accordance with the custom of the county where the Property is located.', sneaky: false, explain: 'Standard market allocation — not a trap, though you can negotiate specifics.' },
  { id: 'access-dd', title: 'Inspection access', text: 'Seller shall provide Purchaser and its consultants reasonable access to the Property and its books and records during the Inspection Period.', sneaky: false, explain: 'Standard and necessary for diligence — this one is good for you.' },
  { id: 'broker-reps', title: 'Brokerage', text: 'Each party represents that it has dealt with no broker other than those identified herein, and indemnifies the other for breach.', sneaky: false, explain: 'Boilerplate broker representation — standard.' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

/** Deal a PSA: a mix of sneaky + benign clauses; count + trap share scale with difficulty. */
export function buildPSA(difficulty: Difficulty): PSAClause[] {
  const sneaky = shuffle(PSA_CLAUSE_LIBRARY.filter((c) => c.sneaky));
  const benign = shuffle(PSA_CLAUSE_LIBRARY.filter((c) => !c.sneaky));
  const nSneaky = difficulty === 'guided' ? 3 : difficulty === 'standard' ? 4 : 5;
  const nBenign = difficulty === 'guided' ? 4 : difficulty === 'standard' ? 4 : 4;
  return shuffle([...sneaky.slice(0, nSneaky), ...benign.slice(0, nBenign)]);
}

// ---------------------------------------------------------------------------
//  E3 — Contract-to-Close decision deck
// ---------------------------------------------------------------------------

export interface DeckEffect {
  cash?: number; // signed $ (usually negative cost)
  rep?: Partial<Reputation>;
  days?: number; // time consumed
  closing?: Partial<{ contingenciesCleared: boolean; raiseFunded: boolean; ddDone: boolean }>;
  ends?: 'walk'; // walking the deal
}
export interface DeckOption {
  id: string;
  label: string;
  detail: string;
  result: string;
  tone: 'good' | 'warn' | 'bad';
  effect: DeckEffect;
}
export interface EventCard {
  id: string;
  title: string;
  prompt: string;
  options: DeckOption[];
}

export const C2C_DAY_BUDGET = 75;

/** Build the event deck for a Contract-to-Close run. */
export function buildC2CDeck(ctx: { market: MarketCondition; difficulty: Difficulty; missedPSATraps: number }): EventCard[] {
  const hard = ctx.difficulty === 'expert';
  const insuranceHit = hard ? -45_000 : -25_000;

  const lender: EventCard = {
    id: 'lender',
    title: 'Choose your lender',
    prompt: 'Five quotes are in. Each lender is a different tradeoff of rate, leverage, speed, and recourse.',
    options: [
      { id: 'agency', label: 'Agency (Fannie/Freddie)', detail: 'Best rate, non-recourse — but slow and strict DSCR.', result: 'Cheapest money, but the long timeline eats into your critical dates.', tone: 'good', effect: { days: 25, closing: { contingenciesCleared: true } } },
      { id: 'bridge', label: 'Bridge / debt fund', detail: 'Fast and flexible, higher cost — good for heavy value-add.', result: 'You lock financing fast, but pay up for it.', tone: 'warn', effect: { days: 10, cash: -20_000, closing: { contingenciesCleared: true } } },
      { id: 'bank', label: 'Local bank (recourse)', detail: 'Relationship lender, lower leverage, wants a guarantor.', result: 'Solid terms, but you sign personally and raise more equity.', tone: 'warn', effect: { days: 18, rep: { lender: 2 }, closing: { contingenciesCleared: true } } },
    ],
  };

  const appraisal: EventCard = {
    id: 'appraisal',
    title: 'The appraisal came in low',
    prompt: 'The lender appraisal is ~4% under your contract price, opening a financing gap.',
    options: [
      { id: 'retrade', label: 'Retrade the seller', detail: 'Ask the seller to lower price to the appraisal.', result: 'You protect your equity, but the broker remembers the retrade.', tone: 'warn', effect: { rep: { broker: -4 }, days: 7, closing: { contingenciesCleared: true } } },
      { id: 'addequity', label: 'Add equity to cover the gap', detail: 'Bring more cash and keep the price.', result: 'The deal stays clean, but it costs you more equity.', tone: 'warn', effect: { cash: -60_000, closing: { contingenciesCleared: true } } },
      { id: 'walk', label: 'Walk away', detail: 'The numbers no longer work.', result: 'You forfeit time spent, but protect your capital.', tone: 'bad', effect: { ends: 'walk' } },
    ],
  };

  const dd: EventCard = {
    id: 'dd',
    title: 'Due diligence',
    prompt: ctx.missedPSATraps > 0 ? 'Your PSA left some gaps. How hard do you diligence the asset?' : 'How thoroughly do you diligence the asset before your money goes hard?',
    options: [
      { id: 'full', label: 'Full DD (inspections + lease audit + Phase I)', detail: 'Costs time and money, but reveals the truth.', result: ctx.missedPSATraps > 1 ? 'You uncover deferred maintenance the weak PSA won’t let you fully recover — but at least you know.' : 'Clean bill of health — you negotiate a fair repair credit.', tone: 'good', effect: { cash: -18_000, days: 21, closing: { ddDone: true } } },
      { id: 'light', label: 'Light DD to save time & money', detail: 'Faster and cheaper — but you fly partly blind.', result: 'You save cash now; any hidden issues surface after you own it.', tone: 'bad', effect: { cash: -4_000, days: 8, closing: { ddDone: false } } },
    ],
  };

  const insurance: EventCard = {
    id: 'insurance',
    title: 'Insurance quote spiked',
    prompt: 'The first insurance quote came back ~30% over your underwriting.',
    options: [
      { id: 'shop', label: 'Shop multiple carriers', detail: 'Takes time, usually finds a better rate.', result: 'You claw most of the increase back by shopping.', tone: 'good', effect: { days: 10 } },
      { id: 'accept', label: 'Accept the quote to stay on schedule', detail: 'Fast, but you eat the higher premium.', result: 'You stay on schedule but NOI takes a permanent hit.', tone: 'warn', effect: { cash: insuranceHit } },
      { id: 'deductible', label: 'Raise the deductible', detail: 'Lower premium, more risk retained.', result: 'Premium drops, but a big loss would sting.', tone: 'warn', effect: { rep: {}, days: 4 } },
    ],
  };

  const raise: EventCard = {
    id: 'raise',
    title: 'Raise the equity',
    prompt: 'Funds are due to title. How do you cover the equity check?',
    options: [
      { id: 'solo', label: 'Raise solo', detail: 'Keep the full promote — but it’s on your network alone.', result: ctx.market === 'tough' ? 'In this tough capital market, you scrape it together just in time.' : 'Your network comes through.', tone: ctx.market === 'tough' ? 'warn' : 'good', effect: { days: 20, closing: { raiseFunded: true } } },
      { id: 'partners', label: 'Bring capital partners', detail: 'Wider reach and a faster close — you share the promote.', result: 'Partners fill the raise quickly and de-risk the close.', tone: 'good', effect: { days: 12, rep: { lp: 3 }, closing: { raiseFunded: true } } },
    ],
  };

  return [lender, appraisal, dd, insurance, raise];
}
