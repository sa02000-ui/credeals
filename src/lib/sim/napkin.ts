/**
 * Napkin underwriting engine — Multifamily.
 *
 * Ported from the Synthesis "Napkin" tab (see docs/functionality_maps.md §A) and extended per
 * owner feedback: proforma is driven by a user-specified expense RATIO and a user-specified
 * valuation CAP RATE, and value sensitivity is a 2-D grid of cap rate × expense ratio.
 *
 * Pure + deterministic.
 */

import type { FinancingType } from './types';

export interface NapkinScenarioInput {
  /** Average effective rent, monthly $/unit */
  avgEffectiveRent: number;
  /** Other income, annual $/unit */
  otherIncomePerUnitPerYr: number;
  /** Number of units / doors */
  unitCount: number;
  /** Ask / offer price, $ */
  askPrice: number;
  /** Cap rate as a decimal */
  capRate: number;
  /** Economic vacancy as a decimal */
  vacancyRate: number;
  /** Expenses as annual $/unit (used when expenseRatio is undefined) */
  expensePerUnit?: number;
  /** Expenses as a ratio of effective gross income (takes precedence if provided) */
  expenseRatio?: number;
}

export interface NapkinScenarioOutput {
  gpr: number;
  otherIncomeTotal: number;
  economicIncome: number;
  expenseTotal: number;
  expenseRatio: number;
  noi: number;
  valueAtCap: number;
  valuePerUnit: number;
  pricePerUnit: number;
  pctOfAsk: number;
  pctVsAsk: number;
  verdict: 'paying-over-ask' | 'at-ask' | 'below-ask';
}

export function computeScenario(i: NapkinScenarioInput): NapkinScenarioOutput {
  const gpr = i.avgEffectiveRent * i.unitCount * 12;
  const otherIncomeTotal = i.otherIncomePerUnitPerYr * i.unitCount;
  const economicIncome = (gpr + otherIncomeTotal) * (1 - i.vacancyRate);

  const expenseTotal =
    i.expenseRatio !== undefined
      ? economicIncome * i.expenseRatio
      : (i.expensePerUnit ?? 0) * i.unitCount;

  const expenseRatio = economicIncome > 0 ? expenseTotal / economicIncome : 0;
  const noi = economicIncome - expenseTotal;
  const valueAtCap = i.capRate > 0 ? noi / i.capRate : 0;
  const valuePerUnit = i.unitCount > 0 ? valueAtCap / i.unitCount : 0;
  const pricePerUnit = i.unitCount > 0 ? i.askPrice / i.unitCount : 0;
  const pctOfAsk = i.askPrice > 0 ? valueAtCap / i.askPrice : 0;
  const pctVsAsk = pctOfAsk - 1;

  let verdict: NapkinScenarioOutput['verdict'];
  if (pctVsAsk < -0.005) verdict = 'paying-over-ask';
  else if (pctVsAsk > 0.005) verdict = 'below-ask';
  else verdict = 'at-ask';

  return {
    gpr,
    otherIncomeTotal,
    economicIncome,
    expenseTotal,
    expenseRatio,
    noi,
    valueAtCap,
    valuePerUnit,
    pricePerUnit,
    pctOfAsk,
    pctVsAsk,
    verdict,
  };
}

// --- DSCR quick-check ---

export interface DscrInput {
  offerPrice: number;
  ltv: number;
  interestRate: number;
  amortMonths: number;
  noi: number;
}

export interface DscrOutput {
  loanAmount: number;
  monthlyPayment: number;
  annualDebtService: number;
  dscr: number;
  financeable: boolean;
}

export function pmt(ratePerPeriod: number, nper: number, pv: number): number {
  // Guard the amortization period: 0/NaN months would divide by zero → Infinity payment.
  const n = Number.isFinite(nper) && nper >= 1 ? nper : 1;
  if (ratePerPeriod === 0) return pv / n;
  return (pv * ratePerPeriod) / (1 - Math.pow(1 + ratePerPeriod, -n));
}

export const DSCR_LENDING_THRESHOLD = 1.25;

export function computeDscr(i: DscrInput): DscrOutput {
  const loanAmount = i.ltv * i.offerPrice;
  const monthlyPayment = pmt(i.interestRate / 12, i.amortMonths, loanAmount);
  const annualDebtService = monthlyPayment * 12;
  const dscr = annualDebtService > 0 ? i.noi / annualDebtService : 0;
  return {
    loanAmount,
    monthlyPayment,
    annualDebtService,
    dscr,
    financeable: dscr >= DSCR_LENDING_THRESHOLD,
  };
}

// --- Financing: new loan (size to LTV) vs assumption (specify loan amount) ---

export interface FinancingInput {
  financingType: FinancingType;
  offerPrice: number;
  /** new loan: loan = ltv × offer */
  ltv: number;
  /** assumption: the loan you take over */
  assumedLoanAmount: number;
  interestRate: number;
  amortMonths: number;
  noi: number;
}

export interface FinancingOutput {
  loanAmount: number;
  /** derived: offer − loan */
  downPayment: number;
  /** derived: downPayment / offer */
  downPaymentPct: number;
  /** effective LTV (= loan / offer; equals input ltv for new loans) */
  ltv: number;
  monthlyPayment: number;
  annualDebtService: number;
  dscr: number;
  financeable: boolean;
}

export function computeFinancing(i: FinancingInput): FinancingOutput {
  const loanAmount =
    i.financingType === 'assumption' ? i.assumedLoanAmount : i.ltv * i.offerPrice;
  const downPayment = i.offerPrice - loanAmount;
  const downPaymentPct = i.offerPrice > 0 ? downPayment / i.offerPrice : 0;
  const ltv = i.offerPrice > 0 ? loanAmount / i.offerPrice : 0;
  const monthlyPayment = pmt(i.interestRate / 12, i.amortMonths, loanAmount);
  const annualDebtService = monthlyPayment * 12;
  const dscr = annualDebtService > 0 ? i.noi / annualDebtService : 0;
  return {
    loanAmount,
    downPayment,
    downPaymentPct,
    ltv,
    monthlyPayment,
    annualDebtService,
    dscr,
    financeable: dscr >= DSCR_LENDING_THRESHOLD,
  };
}

// --- Affordability ---

export function affordableRent(avgAnnualIncome: number): number {
  return avgAnnualIncome / 12 / 3;
}

// --- 2-D sensitivity: value = income × (1 − expenseRatio) / capRate ---

/** Build an axis of `count` values centered on `center`, spaced by `step`. count should be odd. */
export function axisAround(center: number, step: number, count: number, min = 0): number[] {
  const half = Math.floor(count / 2);
  const out: number[] = [];
  for (let k = -half; k <= half; k++) out.push(Math.max(min, +(center + k * step).toFixed(6)));
  return out;
}

export interface Sensitivity2D {
  /** column axis */
  capRates: number[];
  /** row axis */
  expenseRatios: number[];
  /** effective gross income the grid is built from */
  income: number;
  /** values[row][col] */
  values: number[][];
  /** index in capRates of the user's valuation cap */
  centerCol: number;
  /** index in expenseRatios of the user's proforma expense ratio */
  centerRow: number;
  /** index in expenseRatios nearest the in-place (current) expense ratio, or -1 if off-grid */
  currentRow: number;
}

export interface Sensitivity2DParams {
  income: number;
  capCenter: number;
  expenseRatioCenter: number;
  /** the in-place expense ratio to flag, if it lands on the grid */
  currentExpenseRatio: number;
  capStep?: number;
  capCount?: number;
  ratioStep?: number;
  ratioCount?: number;
}

export function sensitivity2D(p: Sensitivity2DParams): Sensitivity2D {
  const capStep = p.capStep ?? 0.005;
  const capCount = p.capCount ?? 7;
  const ratioStep = p.ratioStep ?? 0.025;
  const ratioCount = p.ratioCount ?? 7;

  const capRates = axisAround(p.capCenter, capStep, capCount, 0.005);
  const expenseRatios = axisAround(p.expenseRatioCenter, ratioStep, ratioCount, 0);

  const values = expenseRatios.map((er) =>
    capRates.map((c) => (c > 0 ? (p.income * (1 - er)) / c : 0)),
  );

  const centerCol = Math.floor(capCount / 2);
  const centerRow = Math.floor(ratioCount / 2);

  // nearest expense-ratio row to the current ratio
  let currentRow = -1;
  let best = Infinity;
  expenseRatios.forEach((er, idx) => {
    const d = Math.abs(er - p.currentExpenseRatio);
    if (d < best && d <= ratioStep / 2 + 1e-9) {
      best = d;
      currentRow = idx;
    }
  });

  return { capRates, expenseRatios, income: p.income, values, centerCol, centerRow, currentRow };
}

// --- Full napkin result for a deal ---

export interface NapkinResult {
  current: NapkinScenarioOutput;
  proforma: NapkinScenarioOutput;
  financing: FinancingOutput;
  affordableRent: number;
  sensitivity: Sensitivity2D;
}

export interface NapkinInputs {
  current: NapkinScenarioInput;
  proforma: NapkinScenarioInput;
  financing: Omit<FinancingInput, 'noi'>;
  avgAnnualIncome?: number;
}

export const DSCR_DEFAULTS = { ltv: 0.6, interestRate: 0.06, amortMonths: 360 };

export function runNapkin(inputs: NapkinInputs): NapkinResult {
  const current = computeScenario(inputs.current);
  const proforma = computeScenario(inputs.proforma);
  const financing = computeFinancing({ ...inputs.financing, noi: proforma.noi });

  const sensitivity = sensitivity2D({
    income: proforma.economicIncome,
    capCenter: inputs.proforma.capRate,
    expenseRatioCenter: proforma.expenseRatio,
    currentExpenseRatio: current.expenseRatio,
  });

  return {
    current,
    proforma,
    financing,
    affordableRent: affordableRent(inputs.avgAnnualIncome ?? 0),
    sensitivity,
  };
}
