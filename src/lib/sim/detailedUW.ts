/**
 * Detailed underwriting engine — the Synthesis core, rebuilt (owner items 6 + round-2 feedback).
 *
 * Models, end to end:
 *  - Line-item income & expenses where EACH item can be entered as a $ total, $/unit, % of price,
 *    % of loan, % of EGI, or a property-tax MILLAGE (rate × assessed-ratio × price).
 *  - A full debt stack: senior loan (IO + amortizing, with a balloon term), an optional supplemental
 *    loan (at close or later), optional seller financing (amortizing note with a term/balloon), and an
 *    optional mid-hold refinance. Debt service is tracked PER LIEN for the proforma.
 *  - An equity stack: optional preferred equity with a CARRY split (current pay rate paid from cash +
 *    an accrued/compounding rate paid at capital events), then common equity split GP co-invest vs LP,
 *    through an LP/GP promote waterfall (pref → return of capital → promote split).
 *  - Capital line-item lists (capex, closing, exit costs), a sale at an exit cap, investor returns,
 *    a sample LP's return on a user-specified check size, and loan-maturity alerts.
 *
 * Pure + deterministic. Aggregate (not unit-by-unit); T-12/rent-roll parsing will seed Year-1 later.
 */

import { pmt } from './napkin';

export type LineBasis = 'total' | 'perUnit' | 'pctPrice' | 'pctLoan' | 'pctEGI' | 'millage';

export interface LineItem {
  id: string;
  label: string;
  /** meaning depends on basis: total=$, perUnit=$/unit, pct*=decimal, millage=mill rate decimal */
  amount: number;
  basis: LineBasis;
  /** millage only: assessed value as a fraction of purchase price (e.g. 0.8) */
  assessedRatio?: number;
}

export interface LineCtx {
  units: number;
  price: number;
  loan: number;
  egi: number;
}

/** Resolve a line item to a dollar figure given the deal context. */
export function lineAmount(it: LineItem, ctx: LineCtx): number {
  switch (it.basis) {
    case 'perUnit':
      return it.amount * ctx.units;
    case 'pctPrice':
      return it.amount * ctx.price;
    case 'pctLoan':
      return it.amount * ctx.loan;
    case 'pctEGI':
      return it.amount * ctx.egi;
    case 'millage':
      return ctx.price * (it.assessedRatio ?? 1) * it.amount;
    case 'total':
    default:
      return it.amount;
  }
}
function sumLines(items: LineItem[], ctx: LineCtx): number {
  return items.reduce((a, it) => a + lineAmount(it, ctx), 0);
}

/** Human label for a basis (used by the UI + field list). */
export const BASIS_LABEL: Record<LineBasis, string> = {
  total: '$ total',
  perUnit: '$ / unit',
  pctPrice: '% of price',
  pctLoan: '% of loan',
  pctEGI: '% of EGI',
  millage: 'millage × price',
};

export interface DetailedUWInputs {
  purchasePrice: number;
  units: number;

  // --- Income (Year 1) ---
  avgRentMo: number; // base GPR driver, $/unit/mo
  vacancy: number; // economic, decimal
  otherIncome: LineItem[];
  rentGrowthPct: number;
  otherIncomeGrowthPct: number;

  // --- Operating expenses (Year 1) ---
  expenses: LineItem[];
  expenseGrowthPct: number;

  // --- Capital (uses at close) ---
  capexItems: LineItem[];
  closingItems: LineItem[];
  acqFeePct: number;
  reservesPerUnit: number;

  // --- Senior financing ---
  financingType: 'new' | 'assumption';
  loanAmount: number;
  ltv: number; // used when financingType === 'new' to size the loan
  interestRate: number;
  amortMonths: number;
  ioMonths: number;
  loanTermYears: number; // balloon / maturity

  // --- Supplemental loan (optional) ---
  suppEnabled: boolean;
  suppAmount: number;
  suppRate: number;
  suppAmortMonths: number;
  suppFundYear: number; // 0 = at close (a source); >0 funds at start of year N (cash-out)

  // --- Seller financing (optional, amortizing note with a balloon term) ---
  sellerEnabled: boolean;
  sellerAmount: number;
  sellerRate: number;
  sellerAmortMonths: number;
  sellerTermYears: number;

  // --- Refinance (optional) ---
  refiEnabled: boolean;
  refiYear: number;
  refiLtv: number;
  refiCapRate: number;
  refiRate: number;
  refiAmortMonths: number;
  refiCostPct: number;

  // --- Equity stack ---
  prefEquityEnabled: boolean;
  prefEquityPct: number;
  prefCurrentRate: number; // paid from operating cash
  prefAccrueRate: number; // accrues/compounds, paid at capital events
  gpCoinvestPct: number;
  lpPrefReturn: number;
  promoteToGp: number;

  // --- Exit ---
  holdYears: number;
  exitCapRate: number;
  saleCostPct: number;
  exitItems: LineItem[];

  // --- Sample investor ---
  sampleInvestment: number;
}

export interface UWYear {
  year: number;
  gpr: number;
  otherIncome: number;
  egi: number;
  opex: number;
  noi: number;
  dsSenior: number;
  dsSupp: number;
  dsSeller: number;
  dsRefi: number;
  debtService: number;
  cashFlow: number;
  financingProceeds: number;
  dscr: number;
  debtBalanceEnd: number;
}

export interface WaterfallYear {
  year: number;
  distributable: number;
  pref: number;
  lp: number;
  gp: number;
}

export interface SampleReturn {
  invested: number;
  totalReturned: number;
  profit: number;
  irr: number;
  equityMultiple: number;
}

export interface DetailedUWResult {
  years: UWYear[];
  hold: number;

  totalUses: number;
  debtAtClose: number;
  equityRequired: number;
  prefEquity: number;
  commonEquity: number;
  lpEquity: number;
  gpEquity: number;
  acqFee: number;

  goingInCap: number;
  year1DSCR: number;

  refiNewLoan: number;
  refiPayoff: number;
  refiNetCashOut: number;

  exitNOI: number;
  salePrice: number;
  saleCosts: number;
  debtPayoffAtExit: number;
  netSaleProceeds: number;

  projectIRR: number;
  leveredIRR: number;
  equityMultiple: number;
  avgCashOnCash: number;
  lpIRR: number;
  lpEquityMultiple: number;
  lpAvgCashOnCash: number;
  gpProfit: number;
  gpMultiple: number;
  prefIRR: number;

  waterfall: WaterfallYear[];
  sampleReturn: SampleReturn;

  // alerts
  seniorMaturesEarly: boolean;
  sellerMaturesEarly: boolean;
}

/** IRR via bisection on NPV. cashflows[0] is the (negative) initial outlay. */
export function irr(cashflows: number[]): number {
  const npv = (rate: number) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.95;
  let hi = 2.0;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const nm = npv(mid);
    if (Math.abs(nm) < 1) return mid;
    if (npv(lo) * nm < 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

type TrancheKind = 'senior' | 'supp' | 'seller' | 'refi';
interface Tranche {
  kind: TrancheKind;
  amount: number;
  rate: number;
  amortMonths: number;
  ioMonths: number;
  startMonth: number;
  endMonth: number;
}

function tranchePayment(t: Tranche): number {
  return pmt(t.rate / 12, t.amortMonths, t.amount);
}
function trancheBalanceAt(t: Tranche, globalMonth: number): number {
  if (globalMonth < t.startMonth) return 0;
  if (globalMonth >= t.endMonth) return 0;
  const age = globalMonth - t.startMonth + 1;
  const r = t.rate / 12;
  const pay = tranchePayment(t);
  let bal = t.amount;
  for (let m = 1; m <= age; m++) {
    const interest = bal * r;
    if (m > t.ioMonths) bal -= pay - interest;
  }
  return Math.max(0, bal);
}
function tranchePayoff(t: Tranche, globalMonth: number): number {
  if (globalMonth < t.startMonth) return 0;
  const age = Math.min(globalMonth, t.endMonth) - t.startMonth + 1;
  if (age <= 0) return 0;
  const r = t.rate / 12;
  const pay = tranchePayment(t);
  let bal = t.amount;
  for (let m = 1; m <= age; m++) {
    const interest = bal * r;
    if (m > t.ioMonths) bal -= pay - interest;
  }
  return Math.max(0, bal);
}
function trancheDS(t: Tranche, globalMonth: number): number {
  if (globalMonth < t.startMonth || globalMonth > t.endMonth) return 0;
  const age = globalMonth - t.startMonth + 1;
  const r = t.rate / 12;
  return age <= t.ioMonths ? t.amount * r : tranchePayment(t);
}

export function runDetailedUW(i: DetailedUWInputs): DetailedUWResult {
  const hold = Math.max(1, Math.min(12, Math.round(i.holdYears)));
  const units = i.units;
  const price = i.purchasePrice;
  const seniorLoan = i.financingType === 'new' ? Math.round(price * i.ltv) : i.loanAmount;
  const grow = (rate: number, y: number) => Math.pow(1 + rate, y - 1);

  // --- P&L through hold+1 ---
  const noiByYear: number[] = [];
  const pnl: UWYear[] = [];
  for (let y = 1; y <= hold + 1; y++) {
    const gpr = i.avgRentMo * 12 * units * grow(i.rentGrowthPct, y);
    const incCtx: LineCtx = { units, price, loan: seniorLoan, egi: 0 };
    const otherIncome = sumLines(i.otherIncome, incCtx) * grow(i.otherIncomeGrowthPct, y);
    const egi = (gpr + otherIncome) * (1 - i.vacancy);
    const expCtx: LineCtx = { units, price, loan: seniorLoan, egi };
    const opex = sumLines(i.expenses, expCtx) * grow(i.expenseGrowthPct, y);
    const noi = egi - opex;
    noiByYear[y] = noi;
    pnl.push({ year: y, gpr, otherIncome, egi, opex, noi, dsSenior: 0, dsSupp: 0, dsSeller: 0, dsRefi: 0, debtService: 0, cashFlow: 0, financingProceeds: 0, dscr: 0, debtBalanceEnd: 0 });
  }

  // --- Debt tranches ---
  const holdMonths = hold * 12;
  const refiMonth = i.refiEnabled ? (i.refiYear - 1) * 12 + 1 : 0;
  const tranches: Tranche[] = [];
  const seniorEnd = i.refiEnabled ? refiMonth - 1 : holdMonths;
  const senior: Tranche = { kind: 'senior', amount: seniorLoan, rate: i.interestRate, amortMonths: i.amortMonths, ioMonths: i.ioMonths, startMonth: 1, endMonth: seniorEnd };
  tranches.push(senior);

  if (i.sellerEnabled && i.sellerAmount > 0) {
    const sellerEnd = Math.min(holdMonths, i.sellerTermYears > 0 ? i.sellerTermYears * 12 : holdMonths);
    tranches.push({ kind: 'seller', amount: i.sellerAmount, rate: i.sellerRate, amortMonths: i.sellerAmortMonths || 360, ioMonths: 0, startMonth: 1, endMonth: sellerEnd });
  }

  let suppCashOutYear = 0;
  if (i.suppEnabled && i.suppAmount > 0) {
    const startM = i.suppFundYear <= 0 ? 1 : (i.suppFundYear - 1) * 12 + 1;
    if (i.suppFundYear > 0) suppCashOutYear = i.suppFundYear;
    tranches.push({ kind: 'supp', amount: i.suppAmount, rate: i.suppRate, amortMonths: i.suppAmortMonths, ioMonths: 0, startMonth: startM, endMonth: holdMonths });
  }

  let refiNewLoan = 0;
  let refiPayoff = 0;
  let refiNetCashOut = 0;
  if (i.refiEnabled) {
    const refiNOI = noiByYear[i.refiYear] ?? noiByYear[hold];
    const refiValue = i.refiCapRate > 0 ? refiNOI / i.refiCapRate : 0;
    refiNewLoan = Math.max(0, refiValue * i.refiLtv);
    refiPayoff = tranchePayoff(senior, refiMonth - 1);
    refiNetCashOut = Math.max(0, refiNewLoan - refiPayoff - refiNewLoan * i.refiCostPct);
    tranches.push({ kind: 'refi', amount: refiNewLoan, rate: i.refiRate, amortMonths: i.refiAmortMonths, ioMonths: 0, startMonth: refiMonth, endMonth: holdMonths });
  }

  // --- Annual debt service per lien + balances ---
  for (let y = 1; y <= hold; y++) {
    const yr = pnl[y - 1];
    for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) {
      for (const t of tranches) {
        const ds = trancheDS(t, m);
        if (t.kind === 'senior') yr.dsSenior += ds;
        else if (t.kind === 'supp') yr.dsSupp += ds;
        else if (t.kind === 'seller') yr.dsSeller += ds;
        else yr.dsRefi += ds;
      }
    }
    yr.debtService = yr.dsSenior + yr.dsSupp + yr.dsSeller + yr.dsRefi;
    yr.cashFlow = yr.noi - yr.debtService;
    yr.dscr = yr.debtService > 0 ? yr.noi / yr.debtService : 0;
    yr.debtBalanceEnd = tranches.reduce((a, t) => a + trancheBalanceAt(t, y * 12), 0);
    yr.financingProceeds = (suppCashOutYear === y ? i.suppAmount : 0) + (i.refiEnabled && i.refiYear === y ? refiNetCashOut : 0);
  }

  // --- Sources & Uses ---
  const closeCtx: LineCtx = { units, price, loan: seniorLoan, egi: 0 };
  const acqFee = price * i.acqFeePct;
  const closing = sumLines(i.closingItems, closeCtx);
  const capex = sumLines(i.capexItems, closeCtx);
  const reserves = i.reservesPerUnit * units;
  const totalUses = price + acqFee + closing + capex + reserves;

  const debtAtClose = seniorLoan + (i.sellerEnabled ? i.sellerAmount : 0) + (i.suppEnabled && i.suppFundYear <= 0 ? i.suppAmount : 0);
  const equityRequired = Math.max(0, totalUses - debtAtClose);
  const prefEquity = i.prefEquityEnabled ? equityRequired * i.prefEquityPct : 0;
  const commonEquity = equityRequired - prefEquity;
  const gpEquity = commonEquity * i.gpCoinvestPct;
  const lpEquity = commonEquity - gpEquity;

  const goingInCap = price > 0 ? noiByYear[1] / price : 0;

  // --- Exit ---
  const exitNOI = noiByYear[hold + 1];
  const salePrice = i.exitCapRate > 0 ? exitNOI / i.exitCapRate : 0;
  const saleCosts = salePrice * i.saleCostPct + sumLines(i.exitItems, { units, price, loan: seniorLoan, egi: 0 });
  const debtPayoffAtExit = tranches.reduce((a, t) => a + tranchePayoff(t, holdMonths), 0);
  const netSaleProceeds = salePrice - saleCosts - debtPayoffAtExit;

  // --- Distributable cash per year ---
  const distributable: number[] = [];
  for (let y = 1; y <= hold; y++) {
    const yr = pnl[y - 1];
    distributable[y] = yr.cashFlow + yr.financingProceeds + (y === hold ? netSaleProceeds : 0);
  }

  // --- Waterfall with carried (accrued) preferred ---
  const waterfall: WaterfallYear[] = [];
  const prefCash: number[] = [];
  const lpCash: number[] = [];
  const gpCash: number[] = [];

  let prefCapital = prefEquity;
  let prefAccrued = 0;
  let lpCapital = lpEquity;
  let gpCapital = gpEquity;
  let lpAccrued = 0;
  let gpAccrued = 0;

  for (let y = 1; y <= hold; y++) {
    let cash = distributable[y];
    let prefPaid = 0;
    const isEvent = (pnl[y - 1].financingProceeds > 0) || y === hold;

    if (cash < 0) {
      const denom = commonEquity > 0 ? commonEquity : 1;
      lpCash[y] = cash * (lpEquity / denom);
      gpCash[y] = cash * (gpEquity / denom);
      prefCash[y] = 0;
      // still accrue pref while underwater
      if (prefCapital > 0) prefAccrued += (prefCapital + prefAccrued) * i.prefAccrueRate;
      waterfall.push({ year: y, distributable: cash, pref: 0, lp: lpCash[y], gp: gpCash[y] });
      continue;
    }

    // 1) preferred — current pay, then accrue, then capital-event payoff
    if (prefCapital > 0 || prefAccrued > 0) {
      const wantCurrent = prefCapital * i.prefCurrentRate;
      const payCurrent = Math.min(cash, wantCurrent);
      cash -= payCurrent;
      prefPaid += payCurrent;
      if (wantCurrent - payCurrent > 0) prefAccrued += wantCurrent - payCurrent; // unpaid current rolls to accrued
      prefAccrued += (prefCapital + prefAccrued) * i.prefAccrueRate; // compound the carry
      if (isEvent) {
        const payAccrued = Math.min(cash, prefAccrued);
        prefAccrued -= payAccrued;
        cash -= payAccrued;
        prefPaid += payAccrued;
        const payCapital = Math.min(cash, prefCapital);
        prefCapital -= payCapital;
        cash -= payCapital;
        prefPaid += payCapital;
      }
    }

    // 2) common pref return (hurdle), accruing
    lpAccrued += lpCapital * i.lpPrefReturn;
    gpAccrued += gpCapital * i.lpPrefReturn;
    let lpPaid = 0;
    let gpPaid = 0;
    const accrTot = lpAccrued + gpAccrued;
    if (accrTot > 0 && cash > 0) {
      const payAccr = Math.min(cash, accrTot);
      const lpA = payAccr * (lpAccrued / accrTot);
      const gpA = payAccr - lpA;
      lpAccrued -= lpA;
      gpAccrued -= gpA;
      lpPaid += lpA;
      gpPaid += gpA;
      cash -= payAccr;
    }
    // 3) return of capital
    const capTot = lpCapital + gpCapital;
    if (capTot > 0 && cash > 0) {
      const payCap = Math.min(cash, capTot);
      const lpC = payCap * (lpCapital / capTot);
      const gpC = payCap - lpC;
      lpCapital -= lpC;
      gpCapital -= gpC;
      lpPaid += lpC;
      gpPaid += gpC;
      cash -= payCap;
    }
    // 4) promote split
    if (cash > 0) {
      const gpPromote = cash * i.promoteToGp;
      lpPaid += cash - gpPromote;
      gpPaid += gpPromote;
      cash = 0;
    }

    prefCash[y] = prefPaid;
    lpCash[y] = lpPaid;
    gpCash[y] = gpPaid;
    waterfall.push({ year: y, distributable: distributable[y], pref: prefPaid, lp: lpPaid, gp: gpPaid });
  }

  // --- Returns ---
  const opYears = pnl.slice(0, hold);
  const unleveredFlows = [-totalUses, ...opYears.map((yr, idx) => yr.noi + (idx === hold - 1 ? salePrice - saleCosts : 0))];
  const projectIRR = irr(unleveredFlows);

  const commonFlows = [-commonEquity, ...Array.from({ length: hold }, (_, idx) => lpCash[idx + 1] + gpCash[idx + 1])];
  const leveredIRR = irr(commonFlows);
  const commonDistribs = lpCash.slice(1).reduce((a, b) => a + b, 0) + gpCash.slice(1).reduce((a, b) => a + b, 0);
  const equityMultiple = commonEquity > 0 ? commonDistribs / commonEquity : 0;
  const avgCashOnCash = commonEquity > 0 ? opYears.reduce((a, yr) => a + Math.max(0, yr.cashFlow) / commonEquity, 0) / hold : 0;

  const lpFlows = [-lpEquity, ...lpCash.slice(1)];
  const lpIRR = irr(lpFlows);
  const lpDistribs = lpCash.slice(1).reduce((a, b) => a + b, 0);
  const lpEquityMultiple = lpEquity > 0 ? lpDistribs / lpEquity : 0;
  const lpAvgCashOnCash = lpEquity > 0 ? opYears.reduce((a, yr) => a + Math.max(0, yr.cashFlow * (lpEquity / (commonEquity || 1))) / lpEquity, 0) / hold : 0;

  const prefFlows = [-prefEquity, ...prefCash.slice(1)];
  const prefIRR = prefEquity > 0 ? irr(prefFlows) : 0;

  const gpDistribs = gpCash.slice(1).reduce((a, b) => a + b, 0);
  const gpProfit = gpDistribs - gpEquity + acqFee;
  const gpMultiple = gpEquity > 0 ? gpDistribs / gpEquity : 0;

  // --- Sample LP return on a user check size (rides the LP class pro-rata) ---
  const share = lpEquity > 0 ? i.sampleInvestment / lpEquity : 0;
  const sampleReturn: SampleReturn = {
    invested: i.sampleInvestment,
    totalReturned: lpDistribs * share,
    profit: lpDistribs * share - i.sampleInvestment,
    irr: lpIRR,
    equityMultiple: lpEquityMultiple,
  };

  return {
    years: opYears,
    hold,
    totalUses,
    debtAtClose,
    equityRequired,
    prefEquity,
    commonEquity,
    lpEquity,
    gpEquity,
    acqFee,
    goingInCap,
    year1DSCR: opYears[0].dscr,
    refiNewLoan,
    refiPayoff,
    refiNetCashOut,
    exitNOI,
    salePrice,
    saleCosts,
    debtPayoffAtExit,
    netSaleProceeds,
    projectIRR,
    leveredIRR,
    equityMultiple,
    avgCashOnCash,
    lpIRR,
    lpEquityMultiple,
    lpAvgCashOnCash,
    gpProfit,
    gpMultiple,
    prefIRR,
    waterfall,
    sampleReturn,
    seniorMaturesEarly: !i.refiEnabled && i.loanTermYears > 0 && i.loanTermYears < hold,
    sellerMaturesEarly: i.sellerEnabled && i.sellerTermYears > 0 && i.sellerTermYears < hold,
  };
}

let _id = 0;
const lid = () => `li${Date.now().toString(36)}${(_id++).toString(36)}`;
export function newLineId(): string {
  return lid();
}

/** Sensible defaults for a deal entering detailed UW (seeded from its napkin-level figures). */
export function defaultDetailedInputs(d: {
  askPrice: number;
  unitCount: number;
  avgMarketRent: number;
  otherIncomePerUnitPerYr: number;
  stabilizedVacancy: number;
  expensePerUnit: number;
  stabilizedCapRate: number;
}): DetailedUWInputs {
  const exp = d.expensePerUnit;
  const expenses: LineItem[] = [
    { id: lid(), label: 'Property taxes', amount: 0.022, basis: 'millage', assessedRatio: 0.8 },
    { id: lid(), label: 'Insurance', amount: Math.round(exp * 0.1), basis: 'perUnit' },
    { id: lid(), label: 'Payroll', amount: Math.round(exp * 0.18), basis: 'perUnit' },
    { id: lid(), label: 'Repairs & maintenance', amount: Math.round(exp * 0.14), basis: 'perUnit' },
    { id: lid(), label: 'Utilities', amount: Math.round(exp * 0.12), basis: 'perUnit' },
    { id: lid(), label: 'Management fee', amount: 0.03, basis: 'pctEGI' },
    { id: lid(), label: 'G&A / marketing / contracts', amount: Math.round(exp * 0.1), basis: 'perUnit' },
  ];
  const otherIncome: LineItem[] = [
    { id: lid(), label: 'Utility reimbursement (RUBS)', amount: Math.round(d.otherIncomePerUnitPerYr * 0.6), basis: 'perUnit' },
    { id: lid(), label: 'Fees / parking / other', amount: Math.round(d.otherIncomePerUnitPerYr * 0.4), basis: 'perUnit' },
  ];
  return {
    purchasePrice: d.askPrice,
    units: d.unitCount,
    avgRentMo: d.avgMarketRent,
    vacancy: d.stabilizedVacancy,
    otherIncome,
    rentGrowthPct: 0.03,
    otherIncomeGrowthPct: 0.03,
    expenses,
    expenseGrowthPct: 0.025,
    capexItems: [
      { id: lid(), label: 'Interior renovations', amount: 5000, basis: 'perUnit' },
      { id: lid(), label: 'Exterior / common areas', amount: Math.round(d.unitCount * 300), basis: 'total' },
    ],
    closingItems: [
      { id: lid(), label: 'Financing / lender fees', amount: 0.01, basis: 'pctLoan' },
      { id: lid(), label: 'Legal / title / transfer', amount: 0.01, basis: 'pctPrice' },
    ],
    acqFeePct: 0.02,
    reservesPerUnit: 300,
    financingType: 'new',
    loanAmount: Math.round(d.askPrice * 0.65),
    ltv: 0.65,
    interestRate: 0.06,
    amortMonths: 360,
    ioMonths: 24,
    loanTermYears: 10,
    suppEnabled: false,
    suppAmount: Math.round(d.askPrice * 0.1),
    suppRate: 0.075,
    suppAmortMonths: 360,
    suppFundYear: 3,
    sellerEnabled: false,
    sellerAmount: Math.round(d.askPrice * 0.1),
    sellerRate: 0.05,
    sellerAmortMonths: 360,
    sellerTermYears: 5,
    refiEnabled: false,
    refiYear: 3,
    refiLtv: 0.65,
    refiCapRate: +d.stabilizedCapRate.toFixed(4),
    refiRate: 0.06,
    refiAmortMonths: 360,
    refiCostPct: 0.01,
    prefEquityEnabled: false,
    prefEquityPct: 0.4,
    prefCurrentRate: 0.07,
    prefAccrueRate: 0.07,
    gpCoinvestPct: 0.1,
    lpPrefReturn: 0.08,
    promoteToGp: 0.3,
    holdYears: 5,
    exitCapRate: +(d.stabilizedCapRate + 0.005).toFixed(4),
    saleCostPct: 0.02,
    exitItems: [{ id: lid(), label: 'Disposition / legal', amount: 0.005, basis: 'pctPrice' }],
    sampleInvestment: 100_000,
  };
}
