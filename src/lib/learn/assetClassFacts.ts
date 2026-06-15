/**
 * Asset-class expectation facts — from the owner's "Asset Class Risk return and other categories" slide.
 * Surfaces as buy-box education (hover an asset class, or "Compare asset classes") and feeds scenario
 * authoring. Numeric fields are simple 1–5 scales so they read clearly and compare side-by-side;
 * returns are annualized targets. Rewritten to be far less wordy than the original slide.
 */

import type { AssetClass } from '@/lib/sim';

export interface AssetClassFacts {
  label: string;
  /** annualized target return, clean range e.g. "15–20%" */
  targetReturn: string;
  /** 1 (low) – 5 (high) */
  risk: number;
  /** acquisition competition: 1 (open) – 5 (fierce) */
  competition: number;
  /** tenant turnover: 1 (very sticky) – 5 (constant churn); null = n/a */
  turnover: number | null;
  /** management difficulty: 1 (easy) – 5 (hard) */
  mgmt: number;
  leaseLength: string;
  escalation: string;
  hold: string;
  /** one plain-English sentence */
  summary: string;
}

/** Keyed by our AssetClass ids. */
export const ASSET_CLASS_FACTS: Partial<Record<AssetClass, AssetClassFacts>> = {
  multifamily: {
    label: 'Multifamily',
    targetReturn: '15–20%',
    risk: 3,
    competition: 5,
    turnover: 4,
    mgmt: 3,
    leaseLength: '1 year',
    escalation: 'Market',
    hold: '3–5 yrs',
    summary: 'The workhorse asset class. Class A–B is lower-risk and easier to run (~15–18%); Class B–C adds value-add upside (~16–20%) with more hands-on management.',
  },
  'mobile-home-park': {
    label: 'Mobile Home Park',
    targetReturn: '16–20%',
    risk: 4,
    competition: 3,
    turnover: 2,
    mgmt: 4,
    leaseLength: '1 year (lot)',
    escalation: 'Market',
    hold: '3–5 yrs',
    summary: "Tenants own their homes, so they rarely leave — very sticky income. But the infrastructure (water, sewer, roads) makes it demanding to manage.",
  },
  'rv-park': {
    label: 'RV Park',
    targetReturn: '16–20%',
    risk: 3,
    competition: 3,
    turnover: 5,
    mgmt: 3,
    leaseLength: 'Nightly / weekly',
    escalation: 'Market',
    hold: '3–5 yrs',
    summary: 'Runs like hospitality — nightly stays, constant turnover, and seasonal demand swings.',
  },
  storage: {
    label: 'Self-Storage',
    targetReturn: '16–20%',
    risk: 2,
    competition: 5,
    turnover: 2,
    mgmt: 2,
    leaseLength: 'Month-to-month',
    escalation: 'Market',
    hold: '3–5 yrs',
    summary: 'Light to manage and reprices quickly on monthly leases — but heavily competed by institutional buyers.',
  },
  'retail-nnn': {
    label: 'Triple Net (NNN)',
    targetReturn: '10–15%',
    risk: 1,
    competition: 3,
    turnover: 1,
    mgmt: 1,
    leaseLength: '3–5+ yrs',
    escalation: '2–3% / yr',
    hold: '3–5 yrs',
    summary: 'The tenant pays taxes, insurance, and maintenance. Bond-like income, the lowest risk — and the lowest return. The tenant’s credit is everything.',
  },
  'land-development': {
    label: 'Land Development',
    targetReturn: '18–25%',
    risk: 5,
    competition: 3,
    turnover: null,
    mgmt: 4,
    leaseLength: '—',
    escalation: '—',
    hold: '1–10 yrs',
    summary: 'No income during the hold — all the return comes at exit. Highest risk and highest target return; entitlement and construction risk drive everything.',
  },
};

/** Classes on the slide we don't model yet (kept for education + future classes). */
export const EXTRA_CLASS_FACTS: AssetClassFacts[] = [
  {
    label: 'Residential Assisted Living',
    targetReturn: '18–20%',
    risk: 1,
    competition: 3,
    turnover: 1,
    mgmt: 5,
    leaseLength: '1 year',
    escalation: 'Market',
    hold: 'Open-ended',
    summary: 'More an operating business than real estate — care staffing and licensing drive the outcome.',
  },
];

/** Plain-English label for a 1–5 scale (used by the hover card + compare table). */
export function scaleLabel(n: number | null, kind: 'risk' | 'competition' | 'turnover' | 'mgmt'): string {
  if (n == null) return 'n/a';
  const words: Record<string, [string, string, string, string, string]> = {
    risk: ['Very low', 'Low', 'Moderate', 'High', 'Very high'],
    competition: ['Light', 'Some', 'Moderate', 'Heavy', 'Fierce'],
    turnover: ['Very sticky', 'Sticky', 'Moderate', 'High', 'Constant'],
    mgmt: ['Hands-off', 'Easy', 'Moderate', 'Hands-on', 'Intensive'],
  };
  return words[kind][Math.min(4, Math.max(0, n - 1))];
}
