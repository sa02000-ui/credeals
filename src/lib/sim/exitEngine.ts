import type { MarketCondition } from './gameEngine';
import type { MarketDeal } from './types';
import type { ExitOutcomeClass, ExitShockType, VariabilityMode } from './gameTypes';
import { deriveSeed, seededRng } from './sessionSeed';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const chance = (rng: () => number, p: number) => rng() < p;

export interface ExitShock {
  type: ExitShockType;
  direction: 'positive' | 'negative';
  impactPct: number;
  note: string;
}

export interface ExitRiskProfile {
  propertyScore: number; // 0..100
  areaScore: number; // 0..100
  marketRisk: number; // 0..1
  weatherRisk: number; // 0..1
  geopoliticalRisk: number; // 0..1
}

export interface ExitEvaluationInput {
  deal: MarketDeal;
  market: MarketCondition;
  projectedIRR: number;
  actualIRR: number;
  seed: number;
  holdQuarter: number;
  variabilityMode?: VariabilityMode;
}

export interface ExitEvaluationResult {
  projectedIRR: number;
  actualIRR: number;
  adjustedActualIRR: number;
  shock: ExitShock | null;
  terminal: ExitOutcomeClass;
  investorCapitalLostPct: number;
  risk: ExitRiskProfile;
}

export function buildExitRiskProfile(deal: MarketDeal, market: MarketCondition): ExitRiskProfile {
  const propertyScore = clamp(Math.round((deal.propertyRating / 5) * 100), 0, 100);
  const incomeAdj = clamp((deal.lookups.medianHouseholdIncome - 40_000) / 50_000, 0, 1);
  const crimeAdj = clamp(1 - deal.lookups.crimeIndex / 100, 0, 1);
  const locationBase = clamp(deal.locationRating / 5, 0, 1);
  const areaScore = Math.round((locationBase * 0.45 + incomeAdj * 0.3 + crimeAdj * 0.25) * 100);

  const weatherRisk =
    deal.lookups.floodZone.includes('AE') || deal.lookups.floodZone.includes('V')
      ? 0.75
      : deal.lookups.floodZone.includes('shaded')
        ? 0.45
        : 0.2;
  const marketRisk = market === 'hot' ? 0.45 : market === 'balanced' ? 0.35 : 0.6;
  const geopoliticalRisk = 0.2;

  return { propertyScore, areaScore, marketRisk, weatherRisk, geopoliticalRisk };
}

function maybeShock(
  risk: ExitRiskProfile,
  market: MarketCondition,
  seed: number,
  dealId: string,
  holdQuarter: number,
  variabilityMode: VariabilityMode,
): ExitShock | null {
  const rng =
    variabilityMode === 'stochastic'
      ? Math.random
      : seededRng(deriveSeed(seed, dealId, holdQuarter, 'exit-shock'));

  const pMarket = risk.marketRisk * 0.25 + (market === 'tough' ? 0.12 : 0);
  const pWeather = risk.weatherRisk * 0.2;
  const pGeo = risk.geopoliticalRisk * 0.08;

  if (chance(rng, pWeather)) {
    const negative = chance(rng, 0.7);
    const impact = negative ? 0.08 + rng() * 0.12 : 0.03 + rng() * 0.05;
    return {
      type: 'weather-event',
      direction: negative ? 'negative' : 'positive',
      impactPct: impact,
      note: negative
        ? 'Severe weather event disrupted operations and exit timing.'
        : 'Weather incident was managed exceptionally; insurer/ops response preserved value.',
    };
  }
  if (chance(rng, pGeo)) {
    const impact = 0.1 + rng() * 0.2;
    return {
      type: 'geopolitical-shock',
      direction: 'negative',
      impactPct: impact,
      note: 'Macro geopolitical shock widened risk premiums and reduced buyer demand.',
    };
  }
  if (chance(rng, pMarket)) {
    const positive = chance(rng, market === 'hot' ? 0.55 : 0.35);
    const impact = 0.04 + rng() * 0.1;
    return {
      type: 'market-move',
      direction: positive ? 'positive' : 'negative',
      impactPct: impact,
      note: positive
        ? 'Market liquidity improved into exit, boosting valuation.'
        : 'Market softened into exit, compressing valuation and terms.',
    };
  }
  if (chance(rng, 0.08 + risk.marketRisk * 0.08)) {
    const negative = chance(rng, 0.65);
    const impact = 0.03 + rng() * 0.08;
    return {
      type: 'interest-rate-shock',
      direction: negative ? 'negative' : 'positive',
      impactPct: impact,
      note: negative
        ? 'Late-cycle rate move hurt takeout terms and pricing.'
        : 'Favorable rate move improved debt markets and buyer underwriting.',
    };
  }
  return null;
}

export function classifyTerminalOutcome({
  projectedIRR,
  adjustedActualIRR,
  investorCapitalLostPct,
}: {
  projectedIRR: number;
  adjustedActualIRR: number;
  investorCapitalLostPct: number;
}): ExitOutcomeClass {
  if (investorCapitalLostPct >= 0.8 || adjustedActualIRR <= -0.25) return 'blown-up';
  if (adjustedActualIRR >= projectedIRR && adjustedActualIRR > 0) return 'won';
  return 'pyrrhic';
}

export function evaluateExitOutcome(i: ExitEvaluationInput): ExitEvaluationResult {
  const variabilityMode = i.variabilityMode ?? 'deterministic';
  const risk = buildExitRiskProfile(i.deal, i.market);
  const shock = maybeShock(
    risk,
    i.market,
    i.seed,
    i.deal.id,
    i.holdQuarter,
    variabilityMode,
  );
  const signedShock =
    shock == null
      ? 0
      : shock.direction === 'positive'
        ? shock.impactPct
        : -shock.impactPct;
  const adjustedActualIRR = i.actualIRR + signedShock;
  const investorCapitalLostPct = clamp(
    adjustedActualIRR < 0 ? Math.min(0.98, Math.abs(adjustedActualIRR) / 0.4) : 0,
    0,
    0.98,
  );
  const terminal = classifyTerminalOutcome({
    projectedIRR: i.projectedIRR,
    adjustedActualIRR,
    investorCapitalLostPct,
  });

  return {
    projectedIRR: i.projectedIRR,
    actualIRR: i.actualIRR,
    adjustedActualIRR,
    shock,
    terminal,
    investorCapitalLostPct,
    risk,
  };
}
