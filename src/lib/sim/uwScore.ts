/**
 * Underwriting-aggressiveness scoring (design doc): compares the player's assumptions to asset-class
 * consensus ranges and returns a 1–4 score per dimension + an overall label. Drives Deal DNA, coach
 * nudges, and downstream AM card weighting. Pure.
 */

import type { AssetClass } from './types';
import type { UWAssumptions, UWAggressivenessResult } from './gameTypes';

interface ConsensusRange {
  rent: { conservative: number; aggressive: number };
  expenseRatio: { conservative: number; aggressive: number };
  exitCap: { conservative: number; aggressive: number };
  capexPerUnit: { conservative: number; aggressive: number };
  vacancy: { conservative: number; aggressive: number };
}

const CONSENSUS: Record<AssetClass, ConsensusRange> = {
  multifamily:        { rent: { conservative: 1.05, aggressive: 1.2 },  expenseRatio: { conservative: 0.45, aggressive: 0.36 }, exitCap: { conservative: 0.065, aggressive: 0.055 }, capexPerUnit: { conservative: 10000, aggressive: 5000 }, vacancy: { conservative: 0.08, aggressive: 0.04 } },
  'retail-nnn':       { rent: { conservative: 1.03, aggressive: 1.12 }, expenseRatio: { conservative: 0.2,  aggressive: 0.1 },  exitCap: { conservative: 0.07,  aggressive: 0.058 }, capexPerUnit: { conservative: 8000,  aggressive: 3000 }, vacancy: { conservative: 0.06, aggressive: 0.02 } },
  storage:            { rent: { conservative: 1.04, aggressive: 1.18 }, expenseRatio: { conservative: 0.42, aggressive: 0.32 }, exitCap: { conservative: 0.065, aggressive: 0.05 },  capexPerUnit: { conservative: 4000,  aggressive: 1500 }, vacancy: { conservative: 0.1,  aggressive: 0.05 } },
  'mixed-use':        { rent: { conservative: 1.05, aggressive: 1.22 }, expenseRatio: { conservative: 0.48, aggressive: 0.38 }, exitCap: { conservative: 0.068, aggressive: 0.055 }, capexPerUnit: { conservative: 12000, aggressive: 6000 }, vacancy: { conservative: 0.09, aggressive: 0.04 } },
  industrial:         { rent: { conservative: 1.04, aggressive: 1.16 }, expenseRatio: { conservative: 0.35, aggressive: 0.22 }, exitCap: { conservative: 0.058, aggressive: 0.045 }, capexPerUnit: { conservative: 5000,  aggressive: 2000 }, vacancy: { conservative: 0.06, aggressive: 0.02 } },
  'rv-park':          { rent: { conservative: 1.05, aggressive: 1.2 },  expenseRatio: { conservative: 0.45, aggressive: 0.35 }, exitCap: { conservative: 0.075, aggressive: 0.06 },  capexPerUnit: { conservative: 3000,  aggressive: 1000 }, vacancy: { conservative: 0.1,  aggressive: 0.05 } },
  'mobile-home-park': { rent: { conservative: 1.04, aggressive: 1.18 }, expenseRatio: { conservative: 0.4,  aggressive: 0.3 },  exitCap: { conservative: 0.07,  aggressive: 0.055 }, capexPerUnit: { conservative: 3500,  aggressive: 1200 }, vacancy: { conservative: 0.08, aggressive: 0.03 } },
  'raw-land':         { rent: { conservative: 1.0,  aggressive: 1.0 },  expenseRatio: { conservative: 0.1,  aggressive: 0.05 }, exitCap: { conservative: 0.08,  aggressive: 0.06 },  capexPerUnit: { conservative: 0,     aggressive: 0 },    vacancy: { conservative: 0.0,  aggressive: 0.0 } },
  'land-development': { rent: { conservative: 1.0,  aggressive: 1.0 },  expenseRatio: { conservative: 0.15, aggressive: 0.08 }, exitCap: { conservative: 0.07,  aggressive: 0.055 }, capexPerUnit: { conservative: 0,     aggressive: 0 },    vacancy: { conservative: 0.0,  aggressive: 0.0 } },
};

function scoreDimension(value: number, conservative: number, aggressive: number, higherIsWorse: boolean): 1 | 2 | 3 | 4 {
  const lo = Math.min(conservative, aggressive);
  const hi = Math.max(conservative, aggressive);
  const normalized = hi === lo ? 0.5 : (value - lo) / (hi - lo);
  const aggr = higherIsWorse ? 1 - normalized : normalized;
  if (aggr < 0.25) return 1;
  if (aggr < 0.5) return 2;
  if (aggr < 0.75) return 3;
  return 4;
}

export function scoreUW(a: UWAssumptions, assetClass: AssetClass): UWAggressivenessResult {
  const c = CONSENSUS[assetClass] ?? CONSENSUS.multifamily;
  const rent = scoreDimension(a.rentVsMarket, c.rent.conservative, c.rent.aggressive, false);
  const expense = scoreDimension(a.expenseRatio, c.expenseRatio.conservative, c.expenseRatio.aggressive, true);
  const exitCap = scoreDimension(a.exitCapRate, c.exitCap.conservative, c.exitCap.aggressive, true);
  const capex = scoreDimension(a.capexPerUnit, c.capexPerUnit.conservative, c.capexPerUnit.aggressive, true);
  const vacancy = scoreDimension(a.vacancyStabilized, c.vacancy.conservative, c.vacancy.aggressive, true);
  const score = Math.round(((rent + expense + exitCap + capex + vacancy) / 5) * 10) / 10;
  const labels: UWAggressivenessResult['label'][] = ['Very Conservative', 'Conservative', 'Market', 'Aggressive', 'Very Aggressive'];
  const idx = score < 1.5 ? 0 : score < 2.0 ? 1 : score < 2.8 ? 2 : score < 3.5 ? 3 : 4;
  return { score, dimensions: { rent, expense, exitCap, capex, vacancy }, label: labels[idx] };
}
