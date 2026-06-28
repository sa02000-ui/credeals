/**
 * Encounter content for the game's signature moments (DESIGN §22):
 *  - E2: a PSA "catch the trap" clause library + a builder that deals a hand of clauses.
 * (The Contract-to-Close deck lives in scenarios.ts as branching scenarios — buildC2CScenarios.)
 * Pure data/logic; the modals/components render and resolve these.
 */

import type { Difficulty } from './gameEngine';

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
  { id: 'survey-exception', title: 'Survey', text: 'Purchaser accepts title subject to all matters that an accurate survey of the Property would disclose, whether or not of record.', sneaky: true, explain: 'This makes you take title subject to encroachments, easements, and boundary problems a survey would reveal — sight unseen. Order your own ALTA survey during DD and make these matters title objections you can raise.' },
  { id: 'force-majeure-broad', title: 'Force majeure', text: 'Seller’s obligation to close shall be excused, and the Closing Date extended indefinitely, for any cause beyond Seller’s reasonable control, including market or financing conditions.', sneaky: true, explain: 'A force-majeure clause this broad lets the seller delay closing indefinitely — “market or financing conditions” is not a real force-majeure event. Cap any extension to a fixed number of days and strike the economic carve-outs.' },
  { id: 'condition-precedent-seller', title: 'Conditions to closing', text: 'Closing is expressly conditioned upon Seller’s satisfaction, in its sole and absolute discretion, with the terms of its concurrent replacement (1031) acquisition.', sneaky: true, explain: 'This hands the seller a unilateral out: if their 1031 replacement falls through, they walk and you’ve spent weeks and DD money for nothing. Make it mutual or strike it — your obligations shouldn’t hinge on the seller’s separate deal.' },

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

/** Day budget for a Contract-to-Close run (read by the C2C deck for the on-time closing check). */
export const C2C_DAY_BUDGET = 75;

export type PSANegotiationStance = 'aggressive' | 'balanced' | 'accommodating';

export interface PSANegotiationResult {
  salvaged: number;
  unresolved: number;
  message: string;
  lesson: string;
}

/**
 * Resolve post-redline negotiation with seller counsel:
 * - "salvaged" = number of previously-missed traps recovered during negotiation.
 * - "unresolved" = residual latent trap count that carries into closing risk.
 */
export function resolvePSANegotiation(args: {
  caughtCount: number;
  missedCount: number;
  stance: PSANegotiationStance;
  difficulty: Difficulty;
}): PSANegotiationResult {
  const total = args.caughtCount + args.missedCount;
  const detectionRate = total > 0 ? args.caughtCount / total : 0.5;
  const stanceBoost =
    args.stance === 'aggressive' ? 0.18 : args.stance === 'balanced' ? 0.12 : 0.06;
  const difficultyPenalty =
    args.difficulty === 'expert' ? 0.08 : args.difficulty === 'standard' ? 0.04 : 0;
  const salvageRate = Math.max(0, Math.min(0.9, detectionRate * 0.45 + stanceBoost - difficultyPenalty));
  const salvaged = Math.min(args.missedCount, Math.round(args.missedCount * salvageRate));
  const unresolved = Math.max(0, args.missedCount - salvaged);

  if (salvaged === 0) {
    return {
      salvaged,
      unresolved,
      message:
        'Seller counsel held the line. Your missed clauses stayed largely in place.',
      lesson:
        'Spotting traps early is still the highest-leverage move; negotiation cannot always rescue missed language.',
    };
  }
  return {
    salvaged,
    unresolved,
    message: `Counsel accepted revisions on ${salvaged} previously missed clause${salvaged === 1 ? '' : 's'}.`,
    lesson:
      args.stance === 'aggressive'
        ? 'Strong redlines can recover protection, but they rely on prepared support and timing.'
        : args.stance === 'balanced'
          ? 'A balanced negotiation recovered protections without overextending the process.'
          : 'A cooperative tone can still recover risk if your factual support is credible.',
  };
}
