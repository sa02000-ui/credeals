/**
 * Detailed underwriting engine — the Synthesis core, condensed.
 * Multi-year proforma (income/expense growth) → debt service (IO + amortizing) → exit at cap →
 * levered & unlevered returns (IRR, equity multiple, cash-on-cash, DSCR). Pure + deterministic.
 *
 * Aggregate (not unit-by-unit) for now; T-12/rent-roll parsing will populate Year-1 + unit mix later.
 */

import { pmt } from './napkin';

export interface DetailedUWInputs {
  purchasePrice: number;
  units: number;

  // Year-1 operations (proforma starting point)
  avgRentMo: number; // $/unit/mo
  otherIncomePerUnitYr: number; // $/unit/yr
  vacancy: number; // economic, decimal
  expensePerUnitYr: number; // $/unit/yr

  // Growth (decimals)
  rentGrowthPct: number;
  otherIncomeGrowthPct: number;
  expenseGrowthPct: number;

  // Capital
  capexBudget: number;
  closingCostPct: number; // of price
  acqFeePct: number; // of price
  reservesPerUnit: number;

  // Financing
  loanAmount: number;
  interestRate: number;
  amortMonths: number;
  ioMonths: number;

  // Exit
  holdYears: number; // 1–10
  exitCapRate: number;
  saleCostPct: number; // of sale price
}

export interface UWYear {
  year: number;
  gpr: number;
  otherIncome: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlow: number; // after debt
  dscr: number;
  loanBalanceEnd: number;
}

export interface DetailedUWResult {
  years: UWYear[];
  totalCost: number;
  equityRequired: number;
  goingInCap: number;
  year1DSCR: number;
  exitNOI: number;
  salePrice: number;
  saleCosts: number;
  loanPayoff: number;
  netSaleProceeds: number;
  unleveredIRR: number;
  leveredIRR: number;
  equityMultiple: number;
  avgCashOnCash: number;
}

/** IRR via bisection on NPV. cashflows[0] is the (negative) initial outlay. */
export function irr(cashflows: number[]): number {
  const npv = (rate: number) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.9;
  let hi = 1.0;
  const nlo = npv(lo);
  const nhi = npv(hi);
  if (nlo * nhi > 0) return NaN; // no sign change in range
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const nm = npv(mid);
    if (Math.abs(nm) < 1) return mid;
    if (nlo * nm < 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Remaining loan balance after `monthsElapsed`, honoring an interest-only period. */
function loanBalance(loan: number, annualRate: number, amortMonths: number, ioMonths: number, monthsElapsed: number): number {
  const r = annualRate / 12;
  let bal = loan;
  const payment = pmt(r, amortMonths, loan);
  for (let m = 1; m <= monthsElapsed; m++) {
    const interest = bal * r;
    if (m <= ioMonths) {
      // interest only — balance unchanged
    } else {
      bal = bal - (payment - interest);
    }
  }
  return Math.max(0, bal);
}

export function runDetailedUW(i: DetailedUWInputs): DetailedUWResult {
  const hold = Math.max(1, Math.min(10, Math.round(i.holdYears)));
  const r = i.interestRate / 12;
  const monthlyPayment = pmt(r, i.amortMonths, i.loanAmount);

  // We need NOI through hold+1 for the forward-looking exit.
  const years: UWYear[] = [];
  for (let y = 1; y <= hold + 1; y++) {
    const grow = (rate: number) => Math.pow(1 + rate, y - 1);
    const gpr = i.avgRentMo * 12 * i.units * grow(i.rentGrowthPct);
    const otherIncome = i.otherIncomePerUnitYr * i.units * grow(i.otherIncomeGrowthPct);
    const egi = (gpr + otherIncome) * (1 - i.vacancy);
    const opex = i.expensePerUnitYr * i.units * grow(i.expenseGrowthPct);
    const noi = egi - opex;

    // annual debt service: IO portion vs amortizing portion within the year
    let debtService = 0;
    for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) {
      debtService += m <= i.ioMonths ? i.loanAmount * r : monthlyPayment;
    }
    const cashFlow = noi - debtService;
    const dscr = debtService > 0 ? noi / debtService : 0;
    const loanBalanceEnd = loanBalance(i.loanAmount, i.interestRate, i.amortMonths, i.ioMonths, y * 12);
    years.push({ year: y, gpr, otherIncome, egi, opex, noi, debtService, cashFlow, dscr, loanBalanceEnd });
  }

  const closing = i.purchasePrice * i.closingCostPct;
  const acqFee = i.purchasePrice * i.acqFeePct;
  const reserves = i.reservesPerUnit * i.units;
  const totalCost = i.purchasePrice + closing + acqFee + i.capexBudget + reserves;
  const equityRequired = Math.max(0, totalCost - i.loanAmount);

  const year1 = years[0];
  const goingInCap = i.purchasePrice > 0 ? year1.noi / i.purchasePrice : 0;

  // Exit: forward NOI = year hold+1
  const exitNOI = years[hold].noi;
  const salePrice = i.exitCapRate > 0 ? exitNOI / i.exitCapRate : 0;
  const saleCosts = salePrice * i.saleCostPct;
  const loanPayoff = loanBalance(i.loanAmount, i.interestRate, i.amortMonths, i.ioMonths, hold * 12);
  const netSaleProceeds = salePrice - saleCosts - loanPayoff;

  // Returns over the hold (years 1..hold)
  const opYears = years.slice(0, hold);
  const unleveredFlows = [-totalCost, ...opYears.map((yr, idx) => yr.noi + (idx === hold - 1 ? salePrice - saleCosts : 0))];
  const leveredDistribs = opYears.map((yr, idx) => yr.cashFlow + (idx === hold - 1 ? netSaleProceeds : 0));
  const leveredFlows = [-equityRequired, ...leveredDistribs];

  const unleveredIRR = irr(unleveredFlows);
  const leveredIRR = irr(leveredFlows);
  const totalDistribs = leveredDistribs.reduce((a, b) => a + b, 0);
  const equityMultiple = equityRequired > 0 ? totalDistribs / equityRequired : 0;
  const avgCashOnCash =
    equityRequired > 0 ? opYears.reduce((a, yr) => a + yr.cashFlow / equityRequired, 0) / hold : 0;

  return {
    years: opYears,
    totalCost,
    equityRequired,
    goingInCap,
    year1DSCR: year1.dscr,
    exitNOI,
    salePrice,
    saleCosts,
    loanPayoff,
    netSaleProceeds,
    unleveredIRR,
    leveredIRR,
    equityMultiple,
    avgCashOnCash,
  };
}

/** Sensible defaults for a deal entering detailed UW (from its napkin-level data). */
export function defaultDetailedInputs(d: {
  askPrice: number;
  unitCount: number;
  avgMarketRent: number;
  otherIncomePerUnitPerYr: number;
  stabilizedVacancy: number;
  expensePerUnit: number;
  stabilizedCapRate: number;
}): DetailedUWInputs {
  return {
    purchasePrice: d.askPrice,
    units: d.unitCount,
    avgRentMo: d.avgMarketRent,
    otherIncomePerUnitYr: d.otherIncomePerUnitPerYr,
    vacancy: d.stabilizedVacancy,
    expensePerUnitYr: d.expensePerUnit,
    rentGrowthPct: 0.03,
    otherIncomeGrowthPct: 0.03,
    expenseGrowthPct: 0.03,
    capexBudget: Math.round(d.unitCount * 5000),
    closingCostPct: 0.02,
    acqFeePct: 0.02,
    reservesPerUnit: 300,
    loanAmount: Math.round(d.askPrice * 0.65),
    interestRate: 0.06,
    amortMonths: 360,
    ioMonths: 24,
    holdYears: 5,
    exitCapRate: +(d.stabilizedCapRate + 0.005).toFixed(4),
    saleCostPct: 0.02,
  };
}
