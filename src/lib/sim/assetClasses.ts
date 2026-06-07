import type { AssetClass } from './types';

/**
 * Asset-class registry. The whole app branches off the selected asset class so nothing is
 * hard-coded to multifamily. The lifecycle STEPS stay the same across classes; only terminology
 * and (later) the underwriting variant change. Raw Land / Land Development are not yet active.
 */
export interface AssetClassConfig {
  id: AssetClass;
  label: string;
  active: boolean;
  /** unit of count, singular/plural — e.g. door / suite / pad / lot / acre */
  unitNoun: string;
  unitNounPlural: string;
  /** underwriting variant to render for this class */
  napkinVariant: 'multifamily' | 'nnn' | 'per-sf' | 'pad' | 'land';
  note?: string;
}

export const ASSET_CLASS_CONFIG: Record<AssetClass, AssetClassConfig> = {
  multifamily: { id: 'multifamily', label: 'Multifamily', active: true, unitNoun: 'unit', unitNounPlural: 'units', napkinVariant: 'multifamily' },
  'retail-nnn': { id: 'retail-nnn', label: 'Retail / NNN', active: true, unitNoun: 'suite', unitNounPlural: 'suites', napkinVariant: 'nnn' },
  storage: { id: 'storage', label: 'Self-Storage', active: true, unitNoun: 'unit', unitNounPlural: 'units', napkinVariant: 'per-sf' },
  'mixed-use': { id: 'mixed-use', label: 'Mixed Use', active: true, unitNoun: 'unit', unitNounPlural: 'units', napkinVariant: 'multifamily' },
  industrial: { id: 'industrial', label: 'Industrial', active: true, unitNoun: 'unit', unitNounPlural: 'units', napkinVariant: 'per-sf' },
  'rv-park': { id: 'rv-park', label: 'RV Park', active: true, unitNoun: 'pad', unitNounPlural: 'pads', napkinVariant: 'pad' },
  'mobile-home-park': { id: 'mobile-home-park', label: 'Mobile Home Park', active: true, unitNoun: 'pad', unitNounPlural: 'pads', napkinVariant: 'pad' },
  'raw-land': {
    id: 'raw-land', label: 'Raw Land', active: false, unitNoun: 'acre', unitNounPlural: 'acres', napkinVariant: 'land',
    note: 'Land underwriting (entitlement, hold-to-sell) differs from income property — coming later.',
  },
  'land-development': {
    id: 'land-development', label: 'Land Development', active: false, unitNoun: 'lot', unitNounPlural: 'lots', napkinVariant: 'land',
    note: 'Development pro forma (construction draw, lot absorption) — coming later.',
  },
};

export function assetConfig(a: AssetClass): AssetClassConfig {
  return ASSET_CLASS_CONFIG[a];
}
