/**
 * Asset-class expectation facts — from the owner's "Asset Class Risk return and other categories"
 * slide (docs/reference/*.pptx). Surfaces as buy-box education ("what to expect for this asset
 * class") and feeds scenario authoring. 1–5 scales noted per field; returns are annualized targets.
 */

import type { AssetClass } from '@/lib/sim';

export interface AssetClassFacts {
  label: string;
  /** 1 (little) – 5 (fierce) */
  acquisitionCompetition: number | null;
  /** 1 (sticky tenants) – 5 (constant churn); null = n/a */
  tenantTurnover: number | null;
  leaseLength: string;
  rentEscalation: string;
  /** "1 = easy … 5 = hard" */
  easeOfManagement: string;
  dealDuration: string;
  annualizedReturn: string;
  /** 1 (low) – 5 (high) */
  risk: number;
  note?: string;
}

/** Keyed by our AssetClass ids; multifamily carries both class profiles from the slide. */
export const ASSET_CLASS_FACTS: Partial<Record<AssetClass, AssetClassFacts>> = {
  multifamily: {
    label: 'Multifamily',
    acquisitionCompetition: 5,
    tenantTurnover: 4,
    leaseLength: '1 year',
    rentEscalation: 'Market',
    easeOfManagement: 'Class A–B: 1–3 · Class B–C: 3–5',
    dealDuration: '3–5 years',
    annualizedReturn: 'Class A–B: 15–18% · Class B–C: 16–20%',
    risk: 3,
    note: 'Class A–B: lower risk (≈2), easier to manage, slightly lower returns. Class B–C: value-add upside (≈16–20%) with more management intensity and risk (≈4).',
  },
  'mobile-home-park': {
    label: 'Mobile Home Park',
    acquisitionCompetition: 3,
    tenantTurnover: 2,
    leaseLength: '1 year',
    rentEscalation: 'Market',
    easeOfManagement: '3–5 (harder)',
    dealDuration: '3–5 years',
    annualizedReturn: '16–20%',
    risk: 4,
    note: 'Tenants own their homes — sticky, low turnover; management/infrastructure can be demanding.',
  },
  'rv-park': {
    label: 'RV Park',
    acquisitionCompetition: 3,
    tenantTurnover: 5,
    leaseLength: 'Days',
    rentEscalation: 'Market',
    easeOfManagement: '2–4',
    dealDuration: '3–5 years',
    annualizedReturn: '16–20%',
    risk: 3,
    note: 'Hospitality-like: nightly/weekly stays, constant turnover, seasonal demand.',
  },
  storage: {
    label: 'Self-Storage',
    acquisitionCompetition: 5,
    tenantTurnover: 2,
    leaseLength: 'Month-to-month',
    rentEscalation: 'Market',
    easeOfManagement: '1–2 (easy)',
    dealDuration: '3–5 years',
    annualizedReturn: '16–20%',
    risk: 2,
    note: 'Light management, monthly leases reprice fast; heavily competed by institutional buyers.',
  },
  'retail-nnn': {
    label: 'Triple Net (NNN)',
    acquisitionCompetition: 3,
    tenantTurnover: 1,
    leaseLength: '3–5+ years',
    rentEscalation: '2–3% / year',
    easeOfManagement: '1–2 (easy)',
    dealDuration: '3–5 years',
    annualizedReturn: '10–15%',
    risk: 1,
    note: 'Tenant pays taxes/insurance/maintenance. Bond-like income, lowest risk — and lower returns; credit of the tenant is everything.',
  },
  'land-development': {
    label: 'Land Development',
    acquisitionCompetition: 3,
    tenantTurnover: null,
    leaseLength: 'n/a',
    rentEscalation: 'n/a',
    easeOfManagement: '1–5 (varies by project)',
    dealDuration: '1–10 years',
    annualizedReturn: '18–25%',
    risk: 5,
    note: 'NO income during the hold — returns come entirely at exit. Highest risk, highest target returns; entitlement and construction risk drive everything.',
  },
};

/** Classes on the slide we don't model yet (kept for education + future classes). */
export const EXTRA_CLASS_FACTS: AssetClassFacts[] = [
  {
    label: 'Residential Assisted Living',
    acquisitionCompetition: 3,
    tenantTurnover: 1,
    leaseLength: '1 year',
    rentEscalation: 'Market',
    easeOfManagement: '3–5 (operating business)',
    dealDuration: 'Open-ended',
    annualizedReturn: '18–20%',
    risk: 1,
    note: 'More operating business than real estate — care staffing drives outcomes.',
  },
];
