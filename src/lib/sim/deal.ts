import type { MarketDeal, NapkinOverrides } from './types';
import { computeScenario, runNapkin, type NapkinInputs, type NapkinResult } from './napkin';

/** In-place (current) expense ratio implied by the deal's financials. */
export function currentExpenseRatio(deal: MarketDeal): number {
  const s = computeScenario({
    avgEffectiveRent: deal.avgInPlaceRent,
    otherIncomePerUnitPerYr: deal.otherIncomePerUnitPerYr,
    unitCount: deal.unitCount,
    askPrice: deal.askPrice,
    capRate: deal.walkInCapRate,
    vacancyRate: deal.currentVacancy,
    expensePerUnit: deal.expensePerUnit,
  });
  return s.expenseRatio;
}

/** Default napkin "blue cell" inputs derived from a seeded deal. */
export function defaultOverrides(deal: MarketDeal): NapkinOverrides {
  return {
    avgInPlaceRent: deal.avgInPlaceRent,
    currentExpensePerUnit: deal.expensePerUnit,
    walkInCapRate: deal.walkInCapRate,
    currentVacancy: deal.currentVacancy,
    offerPrice: deal.askPrice,
    avgMarketRent: deal.avgMarketRent,
    // proforma expense ratio prefilled from the in-place financials; player can improve it
    proformaExpenseRatio: +currentExpenseRatio(deal).toFixed(4),
    stabilizedCapRate: deal.stabilizedCapRate,
    stabilizedVacancy: deal.stabilizedVacancy,
    // financing
    financingType: 'new',
    ltv: 0.6,
    assumedLoanAmount: Math.round(deal.askPrice * 0.6),
    interestRate: 0.06,
    amortMonths: 360,
  };
}

export function napkinInputsFor(
  deal: MarketDeal,
  overrides?: Partial<NapkinOverrides>,
): NapkinInputs {
  const o = { ...defaultOverrides(deal), ...overrides };
  return {
    current: {
      avgEffectiveRent: o.avgInPlaceRent,
      otherIncomePerUnitPerYr: deal.otherIncomePerUnitPerYr,
      unitCount: deal.unitCount,
      askPrice: o.offerPrice,
      capRate: o.walkInCapRate,
      vacancyRate: o.currentVacancy,
      expensePerUnit: o.currentExpensePerUnit,
    },
    proforma: {
      avgEffectiveRent: o.avgMarketRent,
      otherIncomePerUnitPerYr: deal.otherIncomePerUnitPerYr,
      unitCount: deal.unitCount,
      askPrice: o.offerPrice,
      capRate: o.stabilizedCapRate,
      vacancyRate: o.stabilizedVacancy,
      expenseRatio: o.proformaExpenseRatio,
    },
    financing: {
      financingType: o.financingType,
      offerPrice: o.offerPrice,
      ltv: o.ltv,
      assumedLoanAmount: o.assumedLoanAmount,
      interestRate: o.interestRate,
      amortMonths: o.amortMonths,
    },
    avgAnnualIncome: deal.lookups.medianHouseholdIncome,
  };
}

export function analyzeDeal(deal: MarketDeal, overrides?: Partial<NapkinOverrides>): NapkinResult {
  return runNapkin(napkinInputsFor(deal, overrides));
}
