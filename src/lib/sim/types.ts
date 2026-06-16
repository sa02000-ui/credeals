/** Core domain types for the CRE deal-lifecycle sim. */

export type SimMode = 'game' | 'real';

export type AssetClass =
  | 'multifamily'
  | 'retail-nnn'
  | 'storage'
  | 'mixed-use'
  | 'industrial'
  | 'rv-park'
  | 'mobile-home-park'
  | 'raw-land'
  | 'land-development';

export interface AssetClassDef {
  id: AssetClass;
  label: string;
  /** Only active classes can be selected/underwritten for now. */
  active: boolean;
}

export const ASSET_CLASSES: AssetClassDef[] = [
  { id: 'multifamily', label: 'Multifamily', active: true },
  { id: 'retail-nnn', label: 'Retail / NNN', active: true },
  { id: 'storage', label: 'Self-Storage', active: true },
  { id: 'mixed-use', label: 'Mixed Use', active: true },
  { id: 'industrial', label: 'Industrial', active: true },
  { id: 'rv-park', label: 'RV Park', active: true },
  { id: 'mobile-home-park', label: 'Mobile Home Park', active: true },
  { id: 'raw-land', label: 'Raw Land', active: false },
  { id: 'land-development', label: 'Land Development', active: false },
];

/** Deal lifecycle stages — the full pipeline (feed groups + per-deal phases). */
export type DealStage = 'new' | 'napkin' | 'detailed' | 'loi' | 'c2c' | 'am' | 'lost' | 'archived';

export type StageColor = 'amber' | 'sky' | 'indigo' | 'violet' | 'emerald' | 'teal' | 'slate' | 'rose';

export interface StageDef {
  id: DealStage;
  label: string;
  /** short label used on phase tabs / decision buttons */
  short: string;
  color: StageColor;
}

export const STAGES: StageDef[] = [
  { id: 'new', label: 'New Deals', short: 'New', color: 'amber' },
  { id: 'napkin', label: 'Napkin UW', short: 'Napkin UW', color: 'sky' },
  { id: 'detailed', label: 'Detailed UW', short: 'Detailed UW', color: 'indigo' },
  { id: 'loi', label: 'LOI', short: 'LOI', color: 'violet' },
  { id: 'c2c', label: 'Contract to Close', short: 'C2C', color: 'emerald' },
  { id: 'am', label: 'Asset Management', short: 'AM', color: 'teal' },
  { id: 'lost', label: 'Lost Deals', short: 'Lost', color: 'rose' },
  { id: 'archived', label: 'Archived', short: 'Archived', color: 'slate' },
];

/** Per-deal phases (the lifecycle after a deal is picked), in order. */
export const PHASES: DealStage[] = ['napkin', 'detailed', 'loi', 'c2c', 'am'];

export function stageDef(id: DealStage): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export function stageIndex(id: DealStage): number {
  return PHASES.indexOf(id);
}

/** Address-driven context, "auto-pulled" when a deal enters underwriting (simulated). */
export interface DealLookups {
  medianHouseholdIncome: number; // annual $
  floodZone: string; // e.g. "Zone X (minimal risk)"
  crimeIndex: number; // 1 (safe) – 100 (high)
  populationTrendPct: number; // annual %, + growing / − shrinking
  rentGrowthYoYPct: number; // submarket asking-rent growth, %
}

/** A deal as it appears in the sourcing feed. */
export interface MarketDeal {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  msa: string;
  assetClass: AssetClass;

  // physical
  vintage: number; // year built
  unitCount: number;
  rentableSqft: number;

  // pricing
  askPrice: number;

  // current operations (in-place)
  avgInPlaceRent: number; // monthly $/unit
  avgMarketRent: number; // monthly $/unit (proforma target)
  otherIncomePerUnitPerYr: number; // annual $/unit
  expensePerUnit: number; // annual $/unit (drives the CURRENT expense ratio)
  currentVacancy: number; // economic, decimal
  stabilizedVacancy: number; // decimal

  // cap-rate assumptions
  walkInCapRate: number; // decimal (values current NOI)
  stabilizedCapRate: number; // decimal (the proforma "valuation cap")

  // ratings
  propertyRating: number; // 1–5
  locationRating: number; // 1–5

  // address-driven lookups
  lookups: DealLookups;

  // narrative
  broker: string;
  source: string;
  blurb: string;

  /** true for player-added deals */
  custom?: boolean;
  /** which world this deal lives in (DB-backed deals) */
  simMode?: SimMode;

  // ── day-driven deal flow (game mode; derived from the session seed, set by the store) ──
  /** how this deal reached you */
  channel?: DealChannel;
  /** simulated day this deal showed up in your feed */
  arrivalDay?: number;
  /** simulated day an un-pursued deal trades away to someone else */
  expiresOnDay?: number;
}

/** How a deal reached the player. Off-market = better economics, shorter fuse → rewards relationships. */
export type DealChannel = 'website-match' | 'broker-on-market' | 'broker-off-market';

/** The player's acquisition criteria. */
export interface BuyBox {
  assetClasses: AssetClass[];
  states: string[];
  minUnits: number;
  maxUnits: number;
  minVintage: number;
  maxVintage: number;
  minPrice: number;
  maxPrice: number;
  /** minimum acceptable stabilized cap rate, decimal */
  minStabilizedCapRate: number;
}

export const DEFAULT_BUY_BOX: BuyBox = {
  assetClasses: ['multifamily'],
  states: ['TX'],
  minUnits: 75,
  maxUnits: 350,
  minVintage: 1980,
  maxVintage: 2025,
  minPrice: 0,
  maxPrice: 40_000_000,
  minStabilizedCapRate: 0.06,
};

export type DealStatus = DealStage;

export interface DealState {
  dealId: string;
  status: DealStatus;
  napkinOverrides?: Partial<NapkinOverrides>;
}

/** New loan = size to LTV; assumption = take over seller's loan (specify amount + rate). */
export type FinancingType = 'new' | 'assumption';

export interface NapkinOverrides {
  // current scenario (from financials)
  avgInPlaceRent: number;
  currentExpensePerUnit: number;
  walkInCapRate: number;
  currentVacancy: number;
  offerPrice: number;
  // proforma scenario (player's plan)
  avgMarketRent: number;
  /** user-specified proforma expense ratio (decimal) */
  proformaExpenseRatio: number;
  /** user-specified valuation cap rate (decimal) used to value proforma NOI */
  stabilizedCapRate: number;
  stabilizedVacancy: number;
  // financing
  financingType: FinancingType;
  /** new-loan: drives loan = ltv × offer; down payment is derived */
  ltv: number;
  /** assumption: the loan you take over; down payment = offer − loan (derived) */
  assumedLoanAmount: number;
  interestRate: number;
  amortMonths: number;
}

/** Per-deal comment (the Monday "bubble" thread). Threaded + @tags. Local for now. */
export interface DealComment {
  id: string;
  author: string;
  text: string;
  ts: number;
  /** id of the comment this replies to; undefined = top-level */
  parentId?: string;
  /** names/emails of people who 👍'd (read-acknowledge / like) */
  likes?: string[];
}

/** A person assigned to a deal (Monday-style access model). Drives leads/assignees + access scope. */
export interface DealPerson {
  id: string;
  name: string;
  email?: string;
  access: 'edit' | 'view';
  /** lifecycle phases this person participates in; empty = all phases */
  phases: DealStage[];
}

/** A file attached to a deal (broker OM, CoStar report, T-12, rent roll, etc.). */
export type DealFileKind = 'T12' | 'RentRoll' | 'OM' | 'CoStar' | 'PSA' | 'LOI' | 'Other';

export interface DealFile {
  id: string;
  name: string;
  kind: DealFileKind;
  sizeBytes: number;
  ts: number;
}

// --- Buy-box matching ---

export interface BuyBoxMatch {
  matches: boolean;
  reasons: string[];
}

export function matchBuyBox(deal: MarketDeal, box: BuyBox): BuyBoxMatch {
  const reasons: string[] = [];
  if (!box.assetClasses.includes(deal.assetClass)) reasons.push(`${deal.assetClass} not targeted`);
  if (!box.states.includes(deal.state)) reasons.push(`${deal.state} not in target states`);
  if (deal.unitCount < box.minUnits) reasons.push(`${deal.unitCount} units < min ${box.minUnits}`);
  if (deal.unitCount > box.maxUnits) reasons.push(`${deal.unitCount} units > max ${box.maxUnits}`);
  if (deal.vintage < box.minVintage) reasons.push(`built ${deal.vintage} < ${box.minVintage}`);
  if (deal.vintage > box.maxVintage) reasons.push(`built ${deal.vintage} > ${box.maxVintage}`);
  if (deal.askPrice < box.minPrice) reasons.push(`ask below price range`);
  if (deal.askPrice > box.maxPrice) reasons.push(`ask above price range`);
  if (deal.stabilizedCapRate < box.minStabilizedCapRate)
    reasons.push(`stabilized cap ${(deal.stabilizedCapRate * 100).toFixed(1)}% < target`);
  return { matches: reasons.length === 0, reasons };
}

// --- Treasury (game mode only; see DESIGN §4.5) ---

export interface CashEvent {
  id: string;
  day: number;
  label: string;
  amount: number; // signed: + inflow / − outflow
}

export interface TreasuryState {
  startingBalance: number;
  events: CashEvent[];
}

export function treasuryBalance(t: TreasuryState): number {
  return t.events.reduce((sum, e) => sum + e.amount, t.startingBalance);
}
