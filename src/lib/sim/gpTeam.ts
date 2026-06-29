/**
 * GP team formation: the "Roles & Responsibilities" matrix that splits GP economics across the
 * functions a sponsorship team must cover, plus the standard fee schedule. Derived from the real
 * GP Roles & Responsibilities workbook (six weighted buckets, suggested ranges, acquisition-fee
 * ladder). Pure + deterministic so the UI and tests share one source of truth.
 *
 * Model: each bucket carries a WEIGHT (its share of total GP profit). Within each bucket, the
 * partners split 100%. A partner's share of GP = Σ_bucket (their % of that bucket × bucket weight).
 * Their share of the whole deal = overall GP% × their GP share.
 */

export interface GPBucket {
  id: string;
  label: string;
  short: string;
  /** default share of GP profit (the six weights sum to 1.0) */
  weight: number;
  /** suggested weight range (decimal) shown as guidance */
  rangeLo: number;
  rangeHi: number;
  /** what this bucket covers — used for the learn-as-you-go ⓘ */
  blurb: string;
  /** the single most important compliance / risk note for this bucket */
  flag?: string;
}

/** The six functions a GP team must cover, with weights + ranges from the real workbook. */
export const GP_BUCKETS: GPBucket[] = [
  {
    id: 'sourcing',
    label: 'Deal Sourcing / Vetting / LOI',
    short: 'Sourcing',
    weight: 0.05,
    rangeLo: 0.05,
    rangeHi: 0.1,
    blurb:
      'Finding the deal and taking it to close: off-market seller relationships (worth more than on-market brokered deals), underwriting & vetting, LOI and PSA negotiation, and managing the contract-to-close process. Often fronts the initial legal counsel for the LOI/PSA — money that is lost if the deal falls through.',
  },
  {
    id: 'risk',
    label: 'Risk Money $',
    short: 'Risk $',
    weight: 0.05,
    rangeLo: 0.05,
    rangeHi: 0.1,
    blurb:
      'At-risk capital needed BEFORE a successful close: escrow & additional deposits, DD fees, vendor invoices, loan deposit, appraisal, lender inspection, environmental (Phase I), survey, and legal deposits. May be refunded at closing or roll into equity.',
    flag: 'Risk of 100% loss of this capital if the deal falls through.',
  },
  {
    id: 'balance',
    label: 'Balance Sheet / Loan Guarantor',
    short: 'Guarantor',
    weight: 0.25,
    rangeLo: 0.15,
    rangeHi: 0.3,
    blurb:
      'Signs for the debt. Underwritten on net worth ≈ the loan amount, liquidity ≈ 10% of the loan, and experience for the loan type and market (agency, Class A, $100M+, etc.). Multiple people can combine balance sheets to qualify. Recourse vs. non-recourse changes the value of this role.',
  },
  {
    id: 'consultant',
    label: 'Sponsor Consultant',
    short: 'Consultant',
    weight: 0.1,
    rangeLo: 0.1,
    rangeHi: 0.1,
    blurb:
      'Full-cycle deal support: guides the contract-to-close and capital-raise execution, vets and recommends team members to fill gaps, and connects the team to third parties (insurance, lenders, trades, PM).',
    flag: 'Not responsible for ultimate success — the deal owner / sponsor is.',
  },
  {
    id: 'fundmgr',
    label: 'Fund Manager / Investor Relations',
    short: 'Capital / IR',
    weight: 0.25,
    rangeLo: 0.2,
    rangeHi: 0.35,
    blurb:
      'Raises and manages the external equity (fund-of-funds structure preferred). Must stay in the deal after closing: investor engagement, communications, and GP decision participation through the life of the deal. Pref/JV equity relationships may earn a GP allocation here.',
    flag: 'Any payment as a % of capital raised is PROHIBITED — this is a GP economics allocation, not a commission.',
  },
  {
    id: 'am',
    label: 'Asset Management',
    short: 'AM',
    weight: 0.3,
    rangeLo: 0.2,
    rangeHi: 0.3,
    blurb:
      'Operates the asset: PM oversight, capex/R&M, marketing, boots-on-the-ground, bookkeeping/accounting/distributions/K-1s/taxes, refi/sale/capital calls, and insurance/tax-protest/cost-seg. Key roles to agree up front: Managing PM, Finances, Capex/R&M, Marketing.',
    flag: 'This % can be reallocated during the deal if a partner abdicates or is voted off their role.',
  },
];

/** Acquisition-fee ladder by purchase price (decimal of price), from the workbook recommendations. */
export interface AcqFeeBracket {
  loInclusive: number;
  hiExclusive: number;
  label: string;
  pct: number;
}
export const ACQ_FEE_LADDER: AcqFeeBracket[] = [
  { loInclusive: 0, hiExclusive: 2_000_000, label: '$1M – $2M', pct: 0.05 },
  { loInclusive: 2_000_000, hiExclusive: 5_000_000, label: '$2M – $5M', pct: 0.04 },
  { loInclusive: 5_000_000, hiExclusive: 10_000_000, label: '$5M – $10M', pct: 0.03 },
  { loInclusive: 10_000_000, hiExclusive: 75_000_000, label: '$10M – $75M', pct: 0.02 },
  { loInclusive: 75_000_000, hiExclusive: Infinity, label: '$75M+', pct: 0.01 },
];

/** Standard ongoing fees (decimal). */
export const STANDARD_FEES = {
  assetManagement: 0.02, // of revenue, annual
  refinance: 0.01,
  disposition: 0.01,
} as const;

/** Pick the acquisition-fee % recommended for a given purchase price. */
export function acqFeePct(purchasePrice: number): number {
  const b = ACQ_FEE_LADDER.find((x) => purchasePrice >= x.loInclusive && purchasePrice < x.hiExclusive);
  return b ? b.pct : ACQ_FEE_LADDER[ACQ_FEE_LADDER.length - 1].pct;
}
export function acqFeeBracket(purchasePrice: number): AcqFeeBracket {
  return (
    ACQ_FEE_LADDER.find((x) => purchasePrice >= x.loInclusive && purchasePrice < x.hiExclusive) ??
    ACQ_FEE_LADDER[ACQ_FEE_LADDER.length - 1]
  );
}

// ── The editable matrix state ───────────────────────────────────────────────────────────────────

/** A member of the GP team. The sponsor (player) is always present as the first member. */
export interface GPMember {
  id: string;
  name: string;
  /** entity/LLC this member signs through (optional; shown on the org chart) */
  entity?: string;
  /** % of each bucket this member takes, keyed by bucket id (decimal, 0..1) */
  alloc: Record<string, number>;
  /** $ amounts for dollar-entry buckets (risk money, equity raise); the alloc % is derived pro-rata
   *  from the column total. Keyed by bucket id. */
  dollars?: Record<string, number>;
}

/** Buckets entered as DOLLARS (the % is computed pro-rata of the column total) rather than as a % —
 *  Risk Money and the Fund-Manager/IR bucket (the equity-raise column). */
export const DOLLAR_BUCKETS = ['risk', 'fundmgr'];

/** The headline deal economics, each pulled from the Detailed UW but overridable here. An undefined
 *  field is "linked" (shows the live UW number); a defined field is a manual override (link broken). */
export interface GPKeyNumbers {
  dealSize?: number;
  equityRequired?: number; // total equity to raise/bring
  gpProfit?: number; // total GP profit to split (the pool), excluding fees
  acqFee?: number; // acquisition fee at closing
  amFees?: number; // asset-management fees over the life of the deal
}

export interface GPTeamState {
  /** overall GP share of the deal (the GP/LP split GP side), decimal */
  gpPct: number;
  /** editable bucket weights keyed by bucket id (should sum to 1.0), decimal */
  weights: Record<string, number>;
  members: GPMember[];
  /** total GP profit to distribute ($). When linked to UW this is overridden by the model. */
  totalGPProfit: number;
  /** when true, totalGPProfit + price are pulled from the Detailed-UW base scenario */
  linkToUW: boolean;
  /** per-field overrides of the UW-linked key numbers (undefined = linked) */
  keyNumbers?: GPKeyNumbers;
}

export const DEFAULT_GP_PCT = 0.3;

export function defaultWeights(): Record<string, number> {
  return Object.fromEntries(GP_BUCKETS.map((b) => [b.id, b.weight]));
}

export function emptyAlloc(): Record<string, number> {
  return Object.fromEntries(GP_BUCKETS.map((b) => [b.id, 0]));
}

export function defaultGPTeam(sponsorName: string): GPTeamState {
  return {
    gpPct: DEFAULT_GP_PCT,
    weights: defaultWeights(),
    // The sponsor starts owning the sourcing/LOI bucket outright — they found and tied up the deal.
    members: [{ id: 'sponsor', name: sponsorName || 'You (Sponsor)', alloc: { ...emptyAlloc(), sourcing: 1 } }],
    totalGPProfit: 0,
    linkToUW: true,
    keyNumbers: {},
  };
}

// ── Derived math ────────────────────────────────────────────────────────────────────────────────

export interface MemberResult {
  member: GPMember;
  /** Σ bucket% × bucket weight → share of GP profit (decimal) */
  gpShare: number;
  /** gpPct × gpShare → share of the whole deal (decimal) */
  dealShare: number;
  /** totalGPProfit × gpShare ($) */
  profit: number;
  /** this member's % of the Asset-Management column (drives AM-fee allocation) */
  amBucketPct: number;
  /** AM-weighted share = amBucketPct × AM weight (the part of gpShare that comes from AM) */
  amShare: number;
  /** non-AM share = gpShare − amShare (drives the at-closing acquisition fee) */
  nonAMShare: number;
}

export interface GPTeamResult {
  members: MemberResult[];
  /** per-bucket column total of member allocations (should be 1.0 each) */
  bucketFill: Record<string, number>;
  /** Σ of all weights (should be 1.0) */
  weightSum: number;
  /** Σ of member gpShares (should be 1.0 when every bucket is fully allocated) */
  gpShareSum: number;
}

export function runGPTeam(s: GPTeamState): GPTeamResult {
  const bucketFill: Record<string, number> = {};
  for (const b of GP_BUCKETS) {
    bucketFill[b.id] = s.members.reduce((sum, m) => sum + (m.alloc[b.id] ?? 0), 0);
  }
  const weightSum = GP_BUCKETS.reduce((sum, b) => sum + (s.weights[b.id] ?? 0), 0);

  const amWeight = s.weights['am'] ?? 0;
  const members: MemberResult[] = s.members.map((member) => {
    const gpShare = GP_BUCKETS.reduce((sum, b) => sum + (member.alloc[b.id] ?? 0) * (s.weights[b.id] ?? 0), 0);
    const dealShare = s.gpPct * gpShare;
    const profit = s.totalGPProfit * gpShare;
    const amBucketPct = member.alloc['am'] ?? 0;
    const amShare = amBucketPct * amWeight;
    const nonAMShare = gpShare - amShare;
    return { member, gpShare, dealShare, profit, amBucketPct, amShare, nonAMShare };
  });

  const gpShareSum = members.reduce((sum, m) => sum + m.gpShare, 0);
  return { members, bucketFill, weightSum, gpShareSum };
}
