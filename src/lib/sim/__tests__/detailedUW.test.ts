import { describe, it, expect } from 'vitest';
import { runDetailedUW, defaultDetailedInputs, computeExitOutcome, irr, lineAmount, type DetailedUWInputs } from '../detailedUW';

const DEAL = {
  askPrice: 10_000_000,
  unitCount: 100,
  avgMarketRent: 1_200,
  otherIncomePerUnitPerYr: 600,
  stabilizedVacancy: 0.07,
  expensePerUnit: 5_000,
  stabilizedCapRate: 0.06,
};

function base(): DetailedUWInputs {
  return defaultDetailedInputs(DEAL);
}

describe('irr', () => {
  // The bisection converges to within $1 of NPV, so it's tested at deal scale (its real use).
  it('solves a simple one-period return', () => {
    expect(irr([-1_000_000, 1_100_000])).toBeCloseTo(0.1, 4);
  });
  it('solves a multi-period return', () => {
    // $1M in, 5 yrs, ends at $1.61051M → 10%
    expect(irr([-1_000_000, 0, 0, 0, 0, 1_610_510])).toBeCloseTo(0.1, 3);
  });
  it('returns NaN when there is no sign change', () => {
    expect(Number.isNaN(irr([100, 110]))).toBe(true);
  });
});

describe('lineAmount', () => {
  it('resolves each basis correctly', () => {
    const ctx = { units: 100, price: 1_000_000, loan: 650_000, egi: 500_000 };
    expect(lineAmount({ id: 'a', label: '', amount: 50, basis: 'perUnit' }, ctx)).toBe(5_000);
    expect(lineAmount({ id: 'b', label: '', amount: 1_234, basis: 'total' }, ctx)).toBe(1_234);
    expect(lineAmount({ id: 'c', label: '', amount: 0.02, basis: 'pctPrice' }, ctx)).toBe(20_000);
    expect(lineAmount({ id: 'd', label: '', amount: 0.01, basis: 'pctLoan' }, ctx)).toBe(6_500);
    expect(lineAmount({ id: 'e', label: '', amount: 0.03, basis: 'pctEGI' }, ctx)).toBe(15_000);
    // millage: rate × assessedRatio × price
    expect(lineAmount({ id: 'f', label: '', amount: 0.022, basis: 'millage', assessedRatio: 0.8 }, ctx)).toBeCloseTo(17_600, 0);
  });
});

describe('runDetailedUW — core identities', () => {
  const r = runDetailedUW(base());

  it('NOI equals EGI minus opex each year', () => {
    for (const y of r.years) expect(y.noi).toBeCloseTo(y.egi - y.opex, 2);
  });

  it('cash flow equals NOI minus total debt service', () => {
    for (const y of r.years) expect(y.cashFlow).toBeCloseTo(y.noi - y.debtService, 2);
  });

  it('going-in cap equals year-1 NOI over price', () => {
    expect(r.goingInCap).toBeCloseTo(r.years[0].noi / base().purchasePrice, 4);
  });

  it('equity required = total uses minus debt at close', () => {
    expect(r.equityRequired).toBeCloseTo(r.totalUses - r.debtAtClose, 2);
  });

  it('common equity splits into LP + GP', () => {
    expect(r.lpEquity + r.gpEquity).toBeCloseTo(r.commonEquity, 2);
  });

  it('produces finite headline returns', () => {
    expect(Number.isFinite(r.leveredIRR)).toBe(true);
    expect(Number.isFinite(r.equityMultiple)).toBe(true);
    expect(r.equityMultiple).toBeGreaterThan(0);
  });

  it('distributions reconcile to distributable cash (no pref)', () => {
    const distributed = r.waterfall.reduce((a, w) => a + w.lp + w.gp + w.pref, 0);
    const sources = r.years.reduce((a, y) => a + y.cashFlow + y.financingProceeds, 0) + r.netSaleProceeds;
    expect(distributed).toBeCloseTo(sources, 0);
  });
});

describe('runDetailedUW — overrides', () => {
  it('a $ override sets that year and compounds forward', () => {
    const inp = base();
    const taxId = inp.expenses[0].id;
    const r0 = runDetailedUW(inp);
    const before = r0.expenseDetail[taxId][1]; // year 2
    const inp2: DetailedUWInputs = { ...inp, lineOverrides: { [taxId]: { 2: 999_999 } } };
    const r1 = runDetailedUW(inp2);
    expect(r1.expenseDetail[taxId][1]).toBe(999_999);
    expect(r1.expenseDetail[taxId][1]).not.toBeCloseTo(before, 0);
    // year 3 grows FROM the overridden year 2
    expect(r1.expenseDetail[taxId][2]).toBeGreaterThan(999_999);
  });

  it('a growth override changes only that step', () => {
    const inp = base();
    const id = inp.otherIncome[0].id;
    const inp2: DetailedUWInputs = { ...inp, growthOverrides: { [id]: { 2: 0.5 } } };
    const r = runDetailedUW(inp2);
    expect(r.incomeDetail[id][1]).toBeCloseTo(r.incomeDetail[id][0] * 1.5, 2);
  });
});

describe('runDetailedUW — input clamping', () => {
  it('clamps absurd vacancy / LTV instead of producing nonsense', () => {
    const r = runDetailedUW({ ...base(), vacancy: 2, ltv: 5 });
    // vacancy clamped to 1 → EGI 0 → NOI negative but finite
    expect(Number.isFinite(r.years[0].noi)).toBe(true);
    // LTV clamped to 1 → loan never exceeds price
    expect(r.debtAtClose).toBeLessThanOrEqual(base().purchasePrice + base().sellerAmount + 1);
  });
});

describe('runDetailedUW — preferred equity carry', () => {
  it('pays current + accrued pref and reports a finite pref IRR', () => {
    const r = runDetailedUW({ ...base(), prefEquityEnabled: true, prefEquityPct: 0.4, prefCurrentRate: 0.07, prefAccrueRate: 0.07 });
    expect(r.prefEquity).toBeGreaterThan(0);
    const prefPaid = r.waterfall.reduce((a, w) => a + w.pref, 0);
    expect(prefPaid).toBeGreaterThan(0);
    expect(Number.isFinite(r.prefIRR)).toBe(true);
  });
});

describe('runDetailedUW — loan maturity alert', () => {
  it('flags a senior loan that balloons before exit with no refi', () => {
    const r = runDetailedUW({ ...base(), loanTermYears: 3, holdYears: 5, refiEnabled: false });
    expect(r.seniorMaturesEarly).toBe(true);
  });
  it('does not flag when a refinance covers it', () => {
    const r = runDetailedUW({ ...base(), loanTermYears: 3, holdYears: 5, refiEnabled: true });
    expect(r.seniorMaturesEarly).toBe(false);
  });
});

describe('computeExitOutcome', () => {
  it('beats projection when realized NOI exceeds the underwritten exit NOI', () => {
    const inp = base();
    const projected = runDetailedUW(inp);
    const out = computeExitOutcome(inp, projected.exitNOI * 1.2, 'balanced');
    expect(out.actualIRR).toBeGreaterThan(out.projectedIRR);
    expect(out.actualSale).toBeGreaterThan(out.projectedSale);
  });
  it('misses projection when realized NOI is below + the market turns tough', () => {
    const inp = base();
    const projected = runDetailedUW(inp);
    const out = computeExitOutcome(inp, projected.exitNOI * 0.85, 'tough');
    expect(out.actualIRR).toBeLessThan(out.projectedIRR);
    expect(out.actualExitCap).toBeGreaterThan(out.projectedExitCap); // tough market widens caps
  });
});
