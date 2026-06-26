/**
 * Scenario authoring framework (DESIGN §22; owner ask 2026-06-10).
 *
 * A scenario is a small branching decision tree the owner can author by hand. Each STEP shows a
 * prompt + OPTIONS; choosing an option applies effects (cash/time/reputation/flags), narrates a
 * RESULT, and advances to a `next` step — or, for uncertainty, picks among weighted `branches`.
 * Chains of steps create deep, multi-layer encounters (retrade → seller accepts/refuses → counter …).
 *
 * The runner (ScenarioRunner.tsx) plays one scenario; flags it accumulates feed game outcomes.
 * See docs/scenario_authoring.md for the authoring guide + worked examples.
 */

import type { Difficulty, MarketCondition, Reputation } from './gameEngine';
import type { Persona } from './personas';

export interface ScenarioEffects {
  cash?: number; // signed $ (negative = cost)
  days?: number; // time consumed
  rep?: Partial<Reputation>;
  set?: Record<string, boolean>; // flags raised (e.g. { ddDone: true })
}

export interface ScenarioBranch {
  weight: number; // relative likelihood
  next?: string; // step to go to (omit = ends the scenario)
  result?: string; // narration for this branch
  effects?: ScenarioEffects;
}

export interface ScenarioOption {
  id: string;
  label: string;
  detail?: string;
  requires?: string; // only offered when this flag is set
  tone?: 'good' | 'warn' | 'bad';
  effects?: ScenarioEffects;
  result?: string; // narration when chosen
  next?: string; // deterministic next step (omit + no branches = ends)
  branches?: ScenarioBranch[]; // uncertain outcome — one is picked by weight
}

export interface ScenarioStep {
  id: string;
  speaker?: string; // "Broker", "Seller", "Your analyst"…
  prompt: string;
  options: ScenarioOption[];
}

export interface Scenario {
  id: string;
  title: string;
  entry: string; // starting step id
  steps: Record<string, ScenarioStep>;
}

// ---------------------------------------------------------------------------
//  Contract-to-Close deck, authored as branching scenarios (deep, not shallow)
// ---------------------------------------------------------------------------

export interface DeckCtx {
  market: MarketCondition;
  difficulty: Difficulty;
  missedPSATraps: number;
}

export function buildC2CScenarios(ctx: DeckCtx): Scenario[] {
  const hard = ctx.difficulty === 'expert';
  const insuranceHit = hard ? -45_000 : -25_000;
  const retradeOdds = ctx.market === 'hot' ? 0.35 : ctx.market === 'tough' ? 0.8 : 0.6; // seller more flexible in soft markets

  const lender: Scenario = {
    id: 'lender',
    title: 'Choose your lender',
    entry: 'pick',
    steps: {
      pick: {
        id: 'pick', speaker: 'Mortgage broker', prompt: 'Five quotes are in. Each lender is a different tradeoff of rate, leverage, speed, and recourse.',
        options: [
          { id: 'agency', label: 'Agency (Fannie/Freddie)', detail: 'Best rate, non-recourse — but slow and strict DSCR.', tone: 'good', effects: { days: 25, set: { lenderCleared: true } }, result: 'You lock the cheapest money, but the long timeline tightens your dates.' },
          { id: 'bridge', label: 'Bridge / debt fund', detail: 'Fast and flexible, higher cost.', tone: 'warn', next: 'points', result: 'The fund is hungry — but they want extra points.' },
          { id: 'bank', label: 'Local bank (recourse)', detail: 'Lower leverage, wants a guarantor.', tone: 'warn', effects: { days: 18, rep: { lender: 2 }, set: { lenderCleared: true } }, result: 'Solid terms — you sign personally and raise a bit more equity.' },
        ],
      },
      points: {
        id: 'points', speaker: 'Bridge lender', prompt: 'The bridge lender wants 1.5 points up front. Push back?',
        options: [
          { id: 'negotiate', label: 'Negotiate the points down', detail: 'Costs a little time; you have leverage.', tone: 'good', branches: [
            { weight: 0.6, result: 'They blink — points cut to 0.75%.', effects: { cash: -10_000, days: 6, set: { lenderCleared: true } } },
            { weight: 0.4, result: 'They hold firm; you pay up to keep the timeline.', effects: { cash: -20_000, days: 3, set: { lenderCleared: true } } },
          ] },
          { id: 'accept', label: 'Accept and move fast', detail: 'Pay the points, keep momentum.', tone: 'warn', effects: { cash: -20_000, days: 1, set: { lenderCleared: true } }, result: 'You eat the points to keep things moving.' },
        ],
      },
    },
  };

  const appraisal: Scenario = {
    id: 'appraisal',
    title: 'The appraisal came in low',
    entry: 'a1',
    steps: {
      a1: {
        id: 'a1', speaker: 'Lender', prompt: 'The appraisal is ~4% under your contract price, opening a financing gap. How do you respond?',
        options: [
          { id: 'retrade', label: 'Retrade the seller', detail: 'Ask them to lower price to the appraisal.', tone: 'warn', effects: { rep: { broker: -3 }, days: 5, set: { retraded: true } }, branches: [
            { weight: retradeOdds, next: 'a_accept', result: 'The seller agrees to lower the price to the appraised value.' },
            { weight: 1 - retradeOdds, next: 'a_refuse', result: 'The seller refuses to retrade and calls your bluff.' },
          ] },
          { id: 'addequity', label: 'Add equity to cover the gap', detail: 'Keep the price, bring more cash.', tone: 'warn', effects: { cash: -60_000, set: { appraisalResolved: true } }, result: 'You keep the deal clean — but it costs more equity.' },
          { id: 'walk', label: 'Walk away', detail: 'The numbers no longer work.', tone: 'bad', effects: { set: { walk: true } }, result: 'You walk to protect your capital.' },
        ],
      },
      a_accept: {
        id: 'a_accept', speaker: 'Broker', prompt: 'Price reset to the appraisal. Your equity is protected — but the broker noticed the retrade.',
        options: [{ id: 'ok', label: 'Lock it in', tone: 'good', effects: { set: { appraisalResolved: true } }, result: 'Re-cut at the lower price. Onward.' }],
      },
      a_refuse: {
        id: 'a_refuse', speaker: 'Seller', prompt: 'The seller held firm. You can still close — but you must cover the gap or walk.',
        options: [
          { id: 'cover', label: 'Cover the gap with equity', detail: 'Pay up and keep the deal.', tone: 'warn', effects: { cash: -65_000, set: { appraisalResolved: true } }, result: 'You bring the extra equity and move on.' },
          { id: 'walk2', label: 'Walk away', detail: 'Hold your discipline.', tone: 'bad', effects: { set: { walk: true } }, result: 'You walk rather than overpay.' },
        ],
      },
    },
  };

  const dd: Scenario = {
    id: 'dd',
    title: 'Due diligence',
    entry: 'd1',
    steps: {
      d1: {
        id: 'd1', speaker: 'Your analyst', prompt: ctx.missedPSATraps > 0 ? 'Your PSA left some gaps. How hard do you diligence the asset before your money goes hard?' : 'How thoroughly do you diligence the asset before your money goes hard?',
        options: [
          { id: 'full', label: 'Full DD (inspections + lease audit + Phase I)', detail: 'Costs time and money — reveals the truth.', tone: 'good', effects: { cash: -18_000, days: 21, set: { ddDone: true } }, next: ctx.missedPSATraps > 1 ? 'd_finding' : undefined, result: ctx.missedPSATraps > 1 ? 'The inspectors flag deferred maintenance…' : 'Clean bill of health — you negotiate a fair repair credit.' },
          { id: 'light', label: 'Light DD to save time & money', detail: 'Faster and cheaper — but you fly partly blind.', tone: 'bad', effects: { cash: -4_000, days: 8, set: { ddDone: false } }, result: 'You save cash now; any hidden issues surface after you own it.' },
        ],
      },
      d_finding: {
        id: 'd_finding', speaker: 'Inspector', prompt: 'Roofs and plumbing need ~$200k of work the weak PSA caps your recovery on. What now?',
        options: [
          { id: 'credit', label: 'Push for a seller credit anyway', detail: 'Try to recover despite the cap.', tone: 'warn', branches: [
            { weight: 0.5, result: 'Seller grants a partial credit.', effects: { cash: 40_000 } },
            { weight: 0.5, result: 'Seller hides behind the PSA cap — you eat most of it.', effects: { cash: -20_000 } },
          ] },
          { id: 'budget', label: 'Re-budget the capex and proceed', detail: 'Absorb it into your plan.', tone: 'warn', effects: { cash: -30_000 }, result: 'You fold the repairs into your capex plan.' },
        ],
      },
    },
  };

  const insurance: Scenario = {
    id: 'insurance',
    title: 'Insurance quote spiked',
    entry: 'i1',
    steps: {
      i1: {
        id: 'i1', speaker: 'Insurance broker', prompt: 'The first quote came back ~30% over your underwriting.',
        options: [
          { id: 'shop', label: 'Shop multiple carriers', detail: 'Takes time, usually finds a better rate.', tone: 'good', effects: { days: 10 }, result: 'You claw most of the increase back by shopping.' },
          { id: 'accept', label: 'Accept the quote to stay on schedule', detail: 'Fast, but NOI takes a hit.', tone: 'warn', effects: { cash: insuranceHit }, result: 'You stay on schedule but eat a permanent NOI hit.' },
          { id: 'deductible', label: 'Raise the deductible', detail: 'Lower premium, more risk retained.', tone: 'warn', effects: { days: 4 }, result: 'Premium drops — but a big loss would sting.' },
        ],
      },
    },
  };

  const raise: Scenario = {
    id: 'raise',
    title: 'Raise the equity',
    entry: 'r1',
    steps: {
      r1: {
        id: 'r1', speaker: 'Capital partner', prompt: 'Funds are due to title. How do you cover the equity check?',
        options: [
          { id: 'solo', label: 'Raise solo', detail: 'Keep the full promote — on your network alone.', tone: ctx.market === 'tough' ? 'warn' : 'good', branches: [
            { weight: ctx.market === 'tough' ? 0.5 : 0.85, result: 'Your network comes through and the raise closes.', effects: { days: 20, set: { raiseFunded: true } } },
            { weight: ctx.market === 'tough' ? 0.5 : 0.15, next: 'r_short', result: 'You come up short of the equity needed.' },
          ] },
          { id: 'partners', label: 'Bring capital partners', detail: 'Wider reach, faster close — shared promote.', tone: 'good', effects: { days: 12, rep: { lp: 3 }, set: { raiseFunded: true } }, result: 'Partners fill the raise quickly and de-risk the close.' },
        ],
      },
      r_short: {
        id: 'r_short', speaker: 'Capital partner', prompt: 'You are short on the raise with days to close. Recover how?',
        options: [
          { id: 'partner_now', label: 'Bring a capital partner now', detail: 'Share promote to close.', tone: 'warn', effects: { rep: { lp: 1 }, set: { raiseFunded: true } }, result: 'A partner steps in and covers the gap — at a cost to your promote.' },
          { id: 'rightsize', label: 'Right-size: more debt / less price', detail: 'Restructure to a smaller check.', tone: 'warn', effects: { days: 8, set: { raiseFunded: true } }, result: 'You restructure to a smaller equity check and just make it.' },
        ],
      },
    },
  };

  return [lender, appraisal, dd, insurance, raise];
}

// ---------------------------------------------------------------------------
//  Early-stage decks — these make the game feel alive BEFORE the contract.
//  Napkin (sourcing/first-look color) and LOI (pre-offer color) scenarios so a
//  player meets live decisions from the very first deal, not only at C2C.
// ---------------------------------------------------------------------------

export interface EarlyCtx {
  market: MarketCondition;
  difficulty: Difficulty;
  /** the deal's seller persona — drives archetype-specific broker intel so deals don't feel identical */
  seller?: Persona;
}

/**
 * Broker intel about WHY this seller is selling — varies by seller archetype so three different deals
 * play differently (owner feedback: the "1031 seller" intel was identical across deals). Fires at the
 * napkin/review stage (deal-open), where understanding motivation actually shapes how you underwrite
 * and structure — not at LOI.
 */
function sellerIntel(seller?: Persona): Scenario {
  const id = seller?.id ?? 'seller-tired';
  const intel: Record<string, { prompt: string; play: { label: string; detail: string; result: string }; standard: string }> = {
    'seller-distressed': {
      prompt: `"Between us — the seller's got a 1031 clock running and needs to close before quarter-end, and they need the liquidity. Speed and certainty are worth real basis here."`,
      play: { label: 'Structure around their timeline', detail: 'Offer the fast, certain close they need — ask for price in return.', result: 'You trade certainty for basis. Reading a motivated seller is half of every negotiation.' },
      standard: 'You run a vanilla LOI and leave their urgency — your biggest lever — on the table.',
    },
    'seller-tired': {
      prompt: `"This is a burned-out landlord — thirty years of 2am maintenance calls. They want a clean, drama-free exit more than top dollar. Heads up: the building's got deferred maintenance your DD will find."`,
      play: { label: 'Lead with an easy, certain process', detail: 'Make it smooth; plan to negotiate credits when DD finds the capex.', result: 'You position as the low-drama buyer and keep powder dry for a DD retrade on real findings.' },
      standard: 'You push hard on price up front. A tired seller may just take a smoother offer over yours.',
    },
    'seller-institutional': {
      prompt: `"This is a fund disposition — best-and-final, they won't retrade, and they expect certainty. Firm price, hard dates. Perform or you lose your deposit."`,
      play: { label: 'Bring certainty, not games', detail: 'Proof of funds, tight contingencies, hit their price if it pencils.', result: 'You present as an institutional-grade buyer. With this seller, certainty of close wins the deal — not a clever number.' },
      standard: 'You submit a price-led, contingency-heavy offer. An institutional seller screens it straight out.',
    },
    'seller-unrealistic': {
      prompt: `"Full transparency — the seller's anchored to a 2021 number the market left behind, and they're not truly motivated. This one might be a dead deal."`,
      play: { label: 'Drop a disciplined low anchor and wait', detail: 'Underwrite to your number; let reality (and time) work on them.', result: "You plant a disciplined anchor and move on. Half of these never trade — but the ones that do, come back to the buyer who didn't chase." },
      standard: 'You stretch toward their dream number to keep it alive. That is how buyers overpay for someone else’s nostalgia.',
    },
  };
  const c = intel[id] ?? intel['seller-tired'];
  return {
    id: 'napkin-seller-intel',
    title: 'Why is the seller selling?',
    entry: 's1',
    steps: {
      s1: {
        id: 's1', speaker: 'Marcus Chen (broker)', prompt: c.prompt,
        options: [
          { id: 'use', label: c.play.label, detail: c.play.detail, tone: 'good', effects: { rep: { broker: 2 }, set: { sellerMotivationRead: true } }, result: c.play.result },
          { id: 'standard', label: 'Run standard terms', detail: 'Ignore the intel and play it straight.', tone: 'warn', result: c.standard },
        ],
      },
    },
  };
}

/** Sourcing / napkin-stage encounters — broker dynamics + underwriting discipline. */
export function buildNapkinScenarios(ctx: EarlyCtx): Scenario[] {
  const competitive = ctx.market === 'hot';
  // hot markets punish slow, disciplined buyers more (you lose looks); soft markets reward patience
  const firstLookOdds = competitive ? 0.45 : 0.75;

  const brokerCall: Scenario = {
    id: 'napkin-broker-call',
    title: 'The broker calls',
    entry: 'c1',
    steps: {
      c1: {
        id: 'c1', speaker: 'Marcus Chen (broker)',
        prompt: `"I've got two other groups looking at this one. If you're serious, I can get you an early look — but I need to know you can move."`,
        options: [
          { id: 'homework', label: 'Run the napkin properly first', detail: 'Do the five-minute math before you commit time.', tone: 'good', effects: { days: 1, rep: { broker: 1 } }, result: 'You tell Marcus you respect his time and will come back with a real read. Pros do their homework before they tour.' },
          { id: 'fast', label: 'Drop everything and tour tomorrow', detail: 'Speed can win the look — or waste a week.', tone: 'warn', branches: [
            { weight: firstLookOdds, result: 'Marcus puts you at the front of the line. The hustle paid off.', effects: { rep: { broker: 3 }, days: 1 } },
            { weight: 1 - firstLookOdds, result: 'You burned two days on a deal that never penciled. Speed without a filter is just noise.', effects: { days: 2 } },
          ] },
          { id: 'proof', label: 'Send proof of funds + your buy box', detail: 'Show you are real without overcommitting.', tone: 'good', effects: { rep: { broker: 2 } }, result: 'Marcus now knows you can close. You move up his call list for the next one too.' },
        ],
      },
    },
  };

  const rosyOM: Scenario = {
    id: 'napkin-om-rosy',
    title: 'The OM looks a little too good',
    entry: 'v1',
    steps: {
      v1: {
        id: 'v1', speaker: 'Your analyst',
        prompt: 'The offering memo shows 96% occupancy and expenses well below comps. Take it at face value, or verify against the real T-12?',
        options: [
          { id: 'verify', label: 'Pull the actual T-12 and verify', detail: 'Costs a little time — reveals the truth.', tone: 'good', effects: { days: 2, set: { t12Verified: true } }, branches: [
            { weight: 0.55, result: 'The numbers mostly hold. You underwrite with confidence.' },
            { weight: 0.45, result: 'In-place rents are below the OM and expenses are understated. Good thing you checked — re-cut your assumptions down.', effects: { set: { omInflated: true } } },
          ] },
          { id: 'trust', label: 'Trust the OM and move fast', detail: 'Faster — but the broker works for the seller.', tone: 'bad', effects: { set: { trustedOM: true } }, result: 'You take the marketing numbers at face value. If they were optimistic, it will surface after you own it.' },
        ],
      },
    },
  };

  // seller intel leads (understanding motivation shapes how you underwrite), then broker + OM dynamics
  return competitive ? [sellerIntel(ctx.seller), brokerCall, rosyOM] : [sellerIntel(ctx.seller), rosyOM, brokerCall];
}

/** LOI-stage color — competing buyers + seller intel — before the live negotiation. */
export function buildLOIScenarios(ctx: EarlyCtx): Scenario[] {
  const tight = ctx.market === 'hot';
  const winOdds = tight ? 0.5 : 0.7;
  const certaintyOdds = tight ? 0.62 : 0.78;
  const hard = ctx.difficulty === 'expert';

  const competing: Scenario = {
    id: 'loi-competing-buyer',
    title: 'Another buyer is circling',
    entry: 'b1',
    steps: {
      b1: {
        id: 'b1', speaker: 'Marcus Chen (broker)',
        prompt: `"Full transparency — there's a second LOI coming in. The seller likes you, but money talks. How do you want to position?"`,
        options: [
          { id: 'sharpen', label: 'Sharpen terms (faster close, harder EMD)', detail: 'Win on certainty, not just price.', tone: 'good', effects: { set: { sharpenedTerms: true } }, branches: [
            { weight: winOdds, result: 'The seller values certainty over the other bid. You keep pole position.', effects: { rep: { broker: 2 } } },
            { weight: 1 - winOdds, result: 'It comes down to price anyway — but you are still in the conversation.', effects: { days: 1 } },
          ] },
          { id: 'hold', label: 'Hold your line — discipline over FOMO', detail: 'Refuse to bid against yourself.', tone: 'warn', branches: [
            { weight: 0.6, result: 'The seller respects the discipline and stays at the table.', effects: { rep: { broker: 1 } } },
            { weight: 0.4, result: 'You lose the early look, but you did not overpay for someone else’s upside.', effects: { days: 1 } },
          ] },
        ],
      },
    },
  };

  const certainty: Scenario = {
    id: 'loi-certainty-proof',
    title: 'Seller asks for certainty proof',
    entry: 'p1',
    steps: {
      p1: {
        id: 'p1',
        speaker: 'Seller counsel',
        prompt:
          'The seller wants proof you can close: source-of-funds backup, lender signals, and a tighter timeline. How do you respond?',
        options: [
          {
            id: 'full-proof',
            label: 'Provide full proof package + tighter close path',
            detail: 'More prep work now, stronger credibility.',
            tone: 'good',
            effects: { days: 1, rep: { broker: 2 }, set: { loiCertaintyStrong: true } },
            branches: [
              {
                weight: certaintyOdds,
                result: 'The seller marks you as the most executable buyer.',
                effects: { set: { certaintyLead: true } },
              },
              {
                weight: 1 - certaintyOdds,
                result: 'They still want better economics, but you stay at the top of the stack.',
              },
            ],
          },
          {
            id: 'light-proof',
            label: 'Share a light package and keep optionality',
            detail: 'Less effort now, weaker signaling.',
            tone: 'warn',
            branches: [
              {
                weight: 0.55,
                result: 'Seller accepts the package but asks for tougher terms later.',
                effects: { days: 1 },
              },
              {
                weight: 0.45,
                result: 'Seller doubts execution certainty and elevates the competing buyer.',
                effects: { rep: { broker: -1 } },
              },
            ],
          },
        ],
      },
    },
  };

  const emdPressure: Scenario = {
    id: 'loi-emd-pressure',
    title: 'EMD hardening pressure',
    entry: 'e1',
    steps: {
      e1: {
        id: 'e1',
        speaker: 'Broker',
        prompt:
          'The seller asks for earlier hard money to prove commitment. This increases your downside if DD uncovers surprises.',
        options: [
          {
            id: 'harden-early',
            label: 'Harden EMD earlier and shorten DD',
            detail: 'Improves win odds, raises execution risk.',
            tone: 'warn',
            branches: [
              {
                weight: hard ? 0.5 : 0.62,
                result: 'Seller values certainty and pushes your LOI ahead of a higher price.',
                effects: { rep: { broker: 2 }, set: { emdHardenedEarly: true } },
              },
              {
                weight: hard ? 0.5 : 0.38,
                result: 'Seller still pushes for price. You gave certainty without fully winning economics.',
                effects: { days: 1 },
              },
            ],
          },
          {
            id: 'balanced-middle',
            label: 'Offer a balanced compromise (partial hard money)',
            detail: 'Share risk without overexposing yourself.',
            tone: 'good',
            effects: { set: { emdCompromise: true }, rep: { broker: 1 } },
            result: 'You structure partial hard money and preserve some downside protection.',
          },
          {
            id: 'refuse-harden',
            label: 'Refuse hard money and hold DD protection',
            detail: 'Protects downside, may weaken position.',
            tone: 'warn',
            branches: [
              {
                weight: tight ? 0.35 : 0.55,
                result: 'Seller accepts your discipline and keeps negotiating.',
              },
              {
                weight: tight ? 0.65 : 0.45,
                result: 'Seller interprets this as low certainty and pivots to another buyer.',
                effects: { rep: { broker: -2 } },
              },
            ],
          },
        ],
      },
    },
  };

  // Seller motivation/intel now fires at the napkin/review stage (sellerIntel). LOI focuses on
  // competitive positioning, certainty signaling, and EMD/timeline risk tradeoffs.
  return [competing, certainty, emdPressure];
}
