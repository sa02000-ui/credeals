import { describe, it, expect } from 'vitest';
import { buildSensitivityCases, computeDualScore } from '../debrief';
import { defaultDetailedInputs } from '../detailedUW';

describe('computeDualScore', () => {
  it('returns bounded 0..100 scores', () => {
    const r = computeDualScore({
      projectedIRR: 0.14,
      actualIRR: 0.12,
      projectedEM: 1.9,
      actualEM: 1.75,
      closeScore: 72,
      ddDepth: 'moderate',
      psaCatchScore: 0.6,
      reputation: { broker: 62, lender: 58, lp: 64 },
    });
    expect(r.investment).toBeGreaterThanOrEqual(0);
    expect(r.investment).toBeLessThanOrEqual(100);
    expect(r.execution).toBeGreaterThanOrEqual(0);
    expect(r.execution).toBeLessThanOrEqual(100);
  });

  it('improves investment score when realized returns improve', () => {
    const weak = computeDualScore({
      projectedIRR: 0.14,
      actualIRR: 0.08,
      projectedEM: 1.8,
      actualEM: 1.5,
      closeScore: 68,
      ddDepth: 'moderate',
      psaCatchScore: 0.55,
      reputation: { broker: 60, lender: 60, lp: 60 },
    });
    const strong = computeDualScore({
      projectedIRR: 0.14,
      actualIRR: 0.17,
      projectedEM: 1.8,
      actualEM: 2.15,
      closeScore: 68,
      ddDepth: 'moderate',
      psaCatchScore: 0.55,
      reputation: { broker: 60, lender: 60, lp: 60 },
    });
    expect(strong.investment).toBeGreaterThan(weak.investment);
  });
});

describe('buildSensitivityCases', () => {
  it('returns the four expected alternate-path probes', () => {
    const inputs = defaultDetailedInputs({
      askPrice: 10_000_000,
      unitCount: 100,
      avgMarketRent: 1_200,
      otherIncomePerUnitPerYr: 600,
      stabilizedVacancy: 0.07,
      expensePerUnit: 5_000,
      stabilizedCapRate: 0.06,
    });
    const out = buildSensitivityCases(inputs, 1_000_000, 'balanced');
    expect(out).toHaveLength(4);
    expect(out.map((c) => c.id).sort()).toEqual([
      'capex-up-15pct',
      'exit-cap-up-50bps',
      'rates-up-100bps',
      'rents-down-5pct',
    ]);
  });
});
