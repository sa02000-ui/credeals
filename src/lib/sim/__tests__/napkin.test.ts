import { describe, it, expect } from 'vitest';
import { pmt, computeScenario } from '../napkin';

describe('pmt', () => {
  it('matches a standard 30-yr amortizing payment', () => {
    // $100k @ 6% over 360 months ≈ $599.55/mo
    expect(pmt(0.06 / 12, 360, 100_000)).toBeCloseTo(599.55, 1);
  });
  it('handles a zero rate as straight-line', () => {
    expect(pmt(0, 120, 120_000)).toBe(1_000);
  });
});

describe('computeScenario (napkin)', () => {
  const out = computeScenario({
    avgEffectiveRent: 1_000,
    otherIncomePerUnitPerYr: 0,
    unitCount: 100,
    askPrice: 10_000_000,
    capRate: 0.06,
    vacancyRate: 0.1,
    expenseRatio: 0.45,
  });

  it('computes GPR, EGI, NOI and value at cap', () => {
    expect(out.gpr).toBe(1_200_000); // 1000 × 100 × 12
    expect(out.economicIncome).toBeCloseTo(1_080_000, 0); // × (1 - 0.10)
    expect(out.expenseTotal).toBeCloseTo(486_000, 0); // 45% of EGI
    expect(out.noi).toBeCloseTo(594_000, 0);
    expect(out.valueAtCap).toBeCloseTo(594_000 / 0.06, 0);
  });

  it('flags paying over ask when value < price', () => {
    expect(out.valueAtCap).toBeLessThan(10_000_000);
    expect(out.verdict).toBe('paying-over-ask');
  });

  it('guards divide-by-zero on a zero cap rate', () => {
    const z = computeScenario({ avgEffectiveRent: 1_000, otherIncomePerUnitPerYr: 0, unitCount: 100, askPrice: 1, capRate: 0, vacancyRate: 0.1, expenseRatio: 0.45 });
    expect(z.valueAtCap).toBe(0);
  });
});
