/**
 * Detailed underwriting engine — the Synthesis core, rebuilt (owner item 6).
 *
 * Models, end to end:
 *  - Line-item income (base rent + a list of other-income items) and a list of operating expenses.
 *  - A full debt stack: senior loan (IO + amortizing), an optional supplemental loan (at close or
 *    later), optional seller financing (interest-only note), and an optional mid-hold refinance.
 *  - An equity stack: optional preferred equity, then common equity split GP co-invest vs LP, run
 *    through an LP/GP promote waterfall (pref return → return of capital → promote split).
 *  - Capital line-item lists (capex, closing costs, exit costs), a sale at an exit cap, and the
 *    resulting investor returns (project / levered / LP / pref IRR, equity multiple, cash-on-cash).
 *
 * Pure + deterministic. Aggregate (not unit-by-unit); T-12/rent-roll parsing will seed Year-1 later.
 */

import { pmt } from './napkin';

export interface LineItem {
  id: string;
  label: string;
  /** annual amount; interpreted per-unit when `perUnit`, else a total $ figure */
  amount: number;
  perUnit?: boolean;
}

export interface DetailedUWInputs {
  purchasePrice: number;
  units: number;

  // --- Income (Year 1) ---
  avgRentMo: number; // base GPR driver, $/unit/mo
  vacancy: number; // economic, decimal
  otherIncome: LineItem[]; // each annual ($/unit or total)
  rentGrowthPct: number;
  otherIncomeGrowthPct: number;

  // --- Operating expenses (Year 1) ---
  expenses: LineItem[]; // each annual ($/unit or total)
  expenseGrowthPct: number;

  // --- Capital (uses at close) ---
  capexItems: LineItem[]; // one-time $ totals (or per-unit)
  closingItems: LineItem[]; // one-time $ totals (or per-unit)
  acqFeePct: number; // sponsor acquisition fee, % of price
  reservesPerUnit: number;

  // --- Senior financing ---
  loanAmount: number;
  interestRate: number;
  amortMonths: number;
  ioMonths: number;

  // --- Supplemental loan (optional) ---
  suppEnabled: boolean;
  suppAmount: number;
  suppRate: number;
  suppAmortMonths: number;
  suppFundYear: number; // 0 = at close (a source); >0 funds at start of year N (cash-out)

  // --- Seller financing (optional, interest-only note, balloon at exit) ---
  sellerEnabled: boolean;
  sellerAmount: number;
  sellerRate: number;

  // --- Refinance (optional) ---
  refiEnabled: boolean;
  refiYear: number; // refi at start of year N
  refiLtv: number; // size new loan to this LTV of then-value
  refiCapRate: number; // value = that year's NOI / refiCapRate
  refiRate: number;
  refiAmortMonths: number;
  refiCostPct: number; // % of new loan

  // --- Equity stack ---
  prefEquityEnabled: boolean;
  prefEquityPct: number; // share of required equity funded by preferred
  prefRate: number; // accruing preferred return
  gpCoinvestPct: number; // GP share of COMMON equity
  lpPrefReturn: number; // common hurdle before promote
  promoteToGp: number; // GP share of residual above the hurdle

  // --- Exit ---
  holdYears: number;
  exitCapRate: number;
  saleCostPct: number; // commission etc., % of sale price
  exitItems: LineItem[]; // fixed exit costs ($ totals, e.g. prepay penalty, legal)
}

export interface UWYear {
  year: number;
  gpr: number;
  otherIncome: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlow: number; // after debt, before capital events
  financingProceeds: number; // supplemental funding / refi cash-out in this year
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

export interface DetailedUWResult {
  years: UWYear[];

  // sources & uses
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

  // refi
  refiNewLoan: number;
  refiPayoff: number;
  refiNetCashOut: number;

  // exit
  exitNOI: number;
  salePrice: number;
  saleCosts: number;
  debtPayoffAtExit: number;
  netSaleProceeds: number;

  // returns
  projectIRR: number; // unlevered
  leveredIRR: number; // whole common equity
  equityMultiple: number; // common
  avgCashOnCash: number; // common, operating only
  lpIRR: number;
  lpEquityMultiple: number;
  lpAvgCashOnCash: number;
  gpProfit: number; // promote + co-invest gain + acq fee
  gpMultiple: number;
  prefIRR: number;

  waterfall: WaterfallYear[];
}

/** IRR via bisection on NPV. cashflows[0] is the (negative) initial outlay. */
export function irr(cashflows: number[]): number {
  const npv = (rate: number) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.95;
  let hi = 2.0;
  const nlo = npv(lo);
  const nhi = npv(hi);
  if (nlo * nhi > 0) return NaN;
  let loR = lo;
  let hiR = hi;
  for (let i = 0; i < 200; i++) {
    const mid = (loR + hiR) / 2;
    const nm = npv(mid);
    if (Math.abs(nm) < 1) return mid;
    if (npv(loR) * nm < 0) hiR = mid;
    else loR = mid;
  }
  return (loR + hiR) / 2;
}

export function lineAnnual(item: LineItem, units: number): number {
  return item.perUnit ? item.amount * units : item.amount;
}
function sumLines(items: LineItem[], units: number): number {
  return items.reduce((a, it) => a + lineAnnual(it, units), 0);
}

/** A debt tranche with a global start month. */
interface Tranche {
  amount: number;
  rate: number; // annual
  amortMonths: number;
  ioMonths: number;
  startMonth: number; // 1-based global
  endMonth: number; // inclusive; paid off after this month
}

/** Monthly payment for a tranche. */
function tranchePayment(t: Tranche): number {
  return pmt(t.rate / 12, t.amortMonths, t.amount);
}

/** Balance of a tranche at the end of a given GLOBAL month. */
function trancheBalanceAt(t: Tranche, globalMonth: number): number {
  if (globalMonth < t.startMonth) return 0;
  if (globalMonth >= t.endMonth) return 0; // considered paid off after endMonth
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

/** Payoff balance (the amount needed to retire the tranche) at end of a global month. */
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

/** Debt service of a tranche during a global month. */
function trancheDS(t: Tranche, globalMonth: number): number {
  if (globalMonth < t.startMonth || globalMonth > t.endMonth) return 0;
  const age = globalMonth - t.startMonth + 1;
  const r = t.rate / 12;
  return age <= t.ioMonths ? t.amount * r : tranchePayment(t);
}

export function runDetailedUW(i: DetailedUWInputs): DetailedUWResult {
  const hold = Math.max(1, Math.min(10, Math.round(i.holdYears)));
  const units = i.units;
  const grow = (rate: number, y: number) => Math.pow(1 + rate, y - 1);

  // --- P&L through hold+1 (forward NOI drives the exit) ---
  const noiByYear: number[] = [];
  const pnl: UWYear[] = [];
  for (let y = 1; y <= hold + 1; y++) {
    const gpr = i.avgRentMo * 12 * units * grow(i.rentGrowthPct, y);
    const otherIncome = sumLines(i.otherIncome, units) * grow(i.otherIncomeGrowthPct, y);
    const egi = (gpr + otherIncome) * (1 - i.vacancy);
    const opex = sumLines(i.expenses, units) * grow(i.expenseGrowthPct, y);
    const noi = egi - opex;
    noiByYear[y] = noi;
    pnl.push({ year: y, gpr, otherIncome, egi, opex, noi, debtService: 0, cashFlow: 0, financingProceeds: 0, dscr: 0, debtBalanceEnd: 0 });
  }

  // --- Build debt tranches ---
  const holdMonths = hold * 12;
  const refiMonth = i.refiEnabled ? (i.refiYear - 1) * 12 + 1 : 0;
  const tranches: Tranche[] = [];

  // Senior — ends at refi (paid off) or runs through exit
  const seniorEnd = i.refiEnabled ? refiMonth - 1 : holdMonths;
  const senior: Tranche = { amount: i.loanAmount, rate: i.interestRate, amortMonths: i.amortMonths, ioMonths: i.ioMonths, startMonth: 1, endMonth: seniorEnd };
  tranches.push(senior);

  // Seller note — interest-only, balloon at exit
  if (i.sellerEnabled && i.sellerAmount > 0) {
    tranches.push({ amount: i.sellerAmount, rate: i.sellerRate, amortMonths: 360, ioMonths: 100000, startMonth: 1, endMonth: holdMonths });
  }

  // Supplemental — funds at close or start of a later year
  let suppCashOutYear = 0;
  if (i.suppEnabled && i.suppAmount > 0) {
    const startM = i.suppFundYear <= 0 ? 1 : (i.suppFundYear - 1) * 12 + 1;
    if (i.suppFundYear > 0) suppCashOutYear = i.suppFundYear;
    tranches.push({ amount: i.suppAmount, rate: i.suppRate, amortMonths: i.suppAmortMonths, ioMonths: 0, startMonth: startM, endMonth: holdMonths });
  }

  // Refinance — sized to LTV of then-value, replaces senior
  let refiNewLoan = 0;
  let refiPayoff = 0;
  let refiNetCashOut = 0;
  if (i.refiEnabled) {
    const refiNOI = noiByYear[i.refiYear] ?? noiByYear[hold];
    const refiValue = i.refiCapRate > 0 ? refiNOI / i.refiCapRate : 0;
    refiNewLoan = Math.max(0, refiValue * i.refiLtv);
    refiPayoff = tranchePayoff(senior, refiMonth - 1);
    refiNetCashOut = Math.max(0, refiNewLoan - refiPayoff - refiNewLoan * i.refiCostPct);
    tranches.push({ amount: refiNewLoan, rate: i.refiRate, amortMonths: i.refiAmortMonths, ioMonths: 0, startMonth: refiMonth, endMonth: holdMonths });
  }

  // --- Annual debt service + balances + financing proceeds ---
  for (let y = 1; y <= hold; y++) {
    let ds = 0;
    for (let m = (y - 1) * 12 + 1; m <= y * 12; m++) {
      for (const t of tranches) ds += trancheDS(t, m);
    }
    const yr = pnl[y - 1];
    yr.debtService = ds;
    yr.cashFlow = yr.noi - ds;
    yr.dscr = ds > 0 ? yr.noi / ds : 0;
    yr.debtBalanceEnd = tranches.reduce((a, t) => a + trancheBalanceAt(t, y * 12), 0);
    yr.financingProceeds = (suppCashOutYear === y ? i.suppAmount : 0) + (i.refiEnabled && i.refiYear === y ? refiNetCashOut : 0);
  }

  // --- Sources & Uses ---
  const acqFee = i.purchasePrice * i.acqFeePct;
  const closing = sumLines(i.closingItems, units);
  const capex = sumLines(i.capexItems, units);
  const reserves = i.reservesPerUnit * units;
  const totalUses = i.purchasePrice + acqFee + closing + capex + reserves;

  const debtAtClose = i.loanAmount + (i.sellerEnabled ? i.sellerAmount : 0) + (i.suppEnabled && i.suppFundYear <= 0 ? i.suppAmount : 0);
  const equityRequired = Math.max(0, totalUses - debtAtClose);
  const prefEquity = i.prefEquityEnabled ? equityRequired * i.prefEquityPct : 0;
  const commonEquity = equityRequired - prefEquity;
  const gpEquity = commonEquity * i.gpCoinvestPct;
  const lpEquity = commonEquity - gpEquity;

  const goingInCap = i.purchasePrice > 0 ? noiByYear[1] / i.purchasePrice : 0;

  // --- Exit ---
  const exitNOI = noiByYear[hold + 1];
  const salePrice = i.exitCapRate > 0 ? exitNOI / i.exitCapRate : 0;
  const saleCosts = salePrice * i.saleCostPct + sumLines(i.exitItems, units);
  const debtPayoffAtExit = tranches.reduce((a, t) => a + tranchePayoff(t, holdMonths), 0);
  const netSaleProceeds = salePrice - saleCosts - debtPayoffAtExit;

  // --- Distributable cash to the equity stack, per year ---
  const distributable: number[] = [];
  for (let y = 1; y <= hold; y++) {
    const yr = pnl[y - 1];
    distributable[y] = yr.cashFlow + yr.financingProceeds + (y === hold ? netSaleProceeds : 0);
  }

  // --- Waterfall ---
  const waterfall: WaterfallYear[] = [];
  const prefCash: number[] = [];
  const lpCash: number[] = [];
  const gpCash: number[] = [];

  let prefAccount = prefEquity; // accrues, repaid from cash
  let lpCapital = lpEquity;
  let gpCapital = gpEquity;
  let lpAccrued = 0;
  let gpAccrued = 0;

  for (let y = 1; y <= hold; y++) {
    let cash = distributable[y];
    let prefPaid = 0;
    let lpPaid = 0;
    let gpPaid = 0;

    if (cash < 0) {
      // capital call: common bears it pro-rata by equity
      const denom = commonEquity > 0 ? commonEquity : 1;
      lpPaid = cash * (lpEquity / denom);
      gpPaid = cash * (gpEquity / denom);
    } else {
      // 1) preferred equity (accrues, senior to common)
      if (prefAccount > 0) {
        prefAccount *= 1 + i.prefRate;
        prefPaid = Math.min(cash, prefAccount);
        prefAccount -= prefPaid;
        cash -= prefPaid;
      }
      // 2) common pref return (hurdle), accruing
      lpAccrued += lpCapital * i.lpPrefReturn;
      gpAccrued += gpCapital * i.lpPrefReturn;
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
      // 3) return of capital, pro-rata
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
      // 4) residual split via promote
      if (cash > 0) {
        const gpPromote = cash * i.promoteToGp;
        const lpResid = cash - gpPromote;
        lpPaid += lpResid;
        gpPaid += gpPromote;
        cash = 0;
      }
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
  const lpAvgCashOnCash =
    lpEquity > 0 ? opYears.reduce((a, yr) => a + Math.max(0, yr.cashFlow * (lpEquity / (commonEquity || 1))) / lpEquity, 0) / hold : 0;

  const prefFlows = [-prefEquity, ...prefCash.slice(1)];
  const prefIRR = prefEquity > 0 ? irr(prefFlows) : 0;

  const gpDistribs = gpCash.slice(1).reduce((a, b) => a + b, 0);
  const gpProfit = gpDistribs - gpEquity + acqFee;
  const gpMultiple = gpEquity > 0 ? gpDistribs / gpEquity : 0;

  // attach forward year for display trimming
  return {
    years: opYears,
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
  };
}

let _id = 0;
const lid = () => `li${Date.now().toString(36)}${(_id++).toString(36)}`;

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
  // split the single expense/unit figure into standard categories (rough industry weighting)
  const exp = d.expensePerUnit;
  const expenses: LineItem[] = [
    { id: lid(), label: 'Property taxes', amount: Math.round(exp * 0.28), perUnit: true },
    { id: lid(), label: 'Insurance', amount: Math.round(exp * 0.1), perUnit: true },
    { id: lid(), label: 'Payroll', amount: Math.round(exp * 0.18), perUnit: true },
    { id: lid(), label: 'Repairs & maintenance', amount: Math.round(exp * 0.14), perUnit: true },
    { id: lid(), label: 'Utilities', amount: Math.round(exp * 0.12), perUnit: true },
    { id: lid(), label: 'Management fee', amount: Math.round(exp * 0.08), perUnit: true },
    { id: lid(), label: 'G&A / marketing / contracts', amount: Math.round(exp * 0.1), perUnit: true },
  ];
  const otherIncome: LineItem[] = [
    { id: lid(), label: 'Utility reimbursement (RUBS)', amount: Math.round(d.otherIncomePerUnitPerYr * 0.6), perUnit: true },
    { id: lid(), label: 'Fees / parking / other', amount: Math.round(d.otherIncomePerUnitPerYr * 0.4), perUnit: true },
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
      { id: lid(), label: 'Interior renovations', amount: 5000, perUnit: true },
      { id: lid(), label: 'Exterior / common areas', amount: Math.round(d.unitCount * 300), perUnit: false },
    ],
    closingItems: [
      { id: lid(), label: 'Lender / financing fees', amount: Math.round(d.askPrice * 0.01), perUnit: false },
      { id: lid(), label: 'Legal / title / transfer', amount: Math.round(d.askPrice * 0.01), perUnit: false },
    ],
    acqFeePct: 0.02,
    reservesPerUnit: 300,
    loanAmount: Math.round(d.askPrice * 0.65),
    interestRate: 0.06,
    amortMonths: 360,
    ioMonths: 24,
    suppEnabled: false,
    suppAmount: Math.round(d.askPrice * 0.1),
    suppRate: 0.075,
    suppAmortMonths: 360,
    suppFundYear: 3,
    sellerEnabled: false,
    sellerAmount: Math.round(d.askPrice * 0.1),
    sellerRate: 0.05,
    refiEnabled: false,
    refiYear: 3,
    refiLtv: 0.65,
    refiCapRate: +(d.stabilizedCapRate).toFixed(4),
    refiRate: 0.06,
    refiAmortMonths: 360,
    refiCostPct: 0.01,
    prefEquityEnabled: false,
    prefEquityPct: 0.4,
    prefRate: 0.09,
    gpCoinvestPct: 0.1,
    lpPrefReturn: 0.08,
    promoteToGp: 0.3,
    holdYears: 5,
    exitCapRate: +(d.stabilizedCapRate + 0.005).toFixed(4),
    saleCostPct: 0.02,
    exitItems: [{ id: lid(), label: 'Disposition / legal', amount: Math.round(d.askPrice * 0.005), perUnit: false }],
  };
}

/** Stable id generator for new user-added line items (used by the UI). */
export function newLineId(): string {
  return lid();
}
