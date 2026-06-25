import type { MarketCondition, Reputation } from './gameEngine';
import { computeExitOutcome, type DetailedUWInputs, type ExitOutcome, type LineItem } from './detailedUW';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

export interface DualScoreInput {
  projectedIRR: number;
  actualIRR: number;
  projectedEM: number;
  actualEM: number;
  closeScore: number;
  ddDepth: 'full' | 'moderate' | 'light';
  psaCatchScore: number;
  reputation: Reputation & { seller?: number };
}

export interface DualScoreResult {
  investment: number;
  execution: number;
  investmentComponents: {
    riskAdjustedReturn: number;
    downsideProtection: number;
    covenantHeadroom: number;
    capitalEfficiency: number;
  };
  executionComponents: {
    processDiscipline: number;
    relationshipCapital: number;
    ethics: number;
    timeDiscipline: number;
  };
}

/**
 * Dual-axis end-of-deal grading:
 * - Investment outcome: return quality + downside resilience.
 * - Execution quality: discipline + relationships + trust behavior.
 */
export function computeDualScore(i: DualScoreInput): DualScoreResult {
  const missPenalty = Math.max(0, i.projectedIRR - i.actualIRR);
  const riskAdjustedReturn = clamp(
    (clamp01((i.actualIRR + 0.1) / 0.35) - missPenalty * 1.2) * 100,
  );
  const downsideProtection = clamp(
    (clamp01(i.projectedIRR > 0 ? i.actualIRR / i.projectedIRR : 0.5) * 0.7 +
      clamp01((i.actualIRR + 0.05) / 0.2) * 0.3) *
      100,
  );
  const covenantHeadroom = clamp(i.closeScore);
  const capitalEfficiency = clamp(clamp01(i.actualEM / 2.0) * 100);

  const investment = Math.round(
    riskAdjustedReturn * 0.4 +
      downsideProtection * 0.25 +
      covenantHeadroom * 0.2 +
      capitalEfficiency * 0.15,
  );

  const ddAdj = i.ddDepth === 'full' ? 8 : i.ddDepth === 'moderate' ? 2 : -10;
  const processDiscipline = clamp(i.closeScore + ddAdj);
  const sellerRep = i.reputation.seller ?? (i.reputation.broker + i.reputation.lp) / 2;
  const relationshipCapital = clamp(
    (i.reputation.broker + i.reputation.lender + i.reputation.lp + sellerRep) / 4,
  );
  const ethics = clamp(
    35 + i.psaCatchScore * 55 + (i.ddDepth === 'light' ? -12 : i.ddDepth === 'full' ? 6 : 0),
  );
  const timeDiscipline = clamp(i.closeScore * 0.9 + (i.ddDepth === 'light' ? -8 : 4));

  const execution = Math.round(
    processDiscipline * 0.3 +
      relationshipCapital * 0.25 +
      ethics * 0.25 +
      timeDiscipline * 0.2,
  );

  return {
    investment,
    execution,
    investmentComponents: { riskAdjustedReturn, downsideProtection, covenantHeadroom, capitalEfficiency },
    executionComponents: { processDiscipline, relationshipCapital, ethics, timeDiscipline },
  };
}

export interface SensitivityCase {
  id: string;
  label: string;
  note: string;
  outcome: ExitOutcome;
}

const bumpLines = (items: LineItem[], factor: number): LineItem[] =>
  items.map((it) => ({ ...it, amount: it.amount * factor }));

/**
 * One-click alternate-path simulation set for post-run learning. These are deterministic,
 * quick "what changed outcome" probes, not a full re-underwrite.
 */
export function buildSensitivityCases(
  inputs: DetailedUWInputs,
  actualNOI: number,
  market: MarketCondition,
): SensitivityCase[] {
  const rateShockInputs: DetailedUWInputs = {
    ...inputs,
    interestRate: inputs.interestRate + 0.01,
    refiRate: inputs.refiRate + 0.01,
    exitCapRate: inputs.exitCapRate + 0.01,
  };
  const rentShockNOI = actualNOI * 0.95;
  const capexShockInputs: DetailedUWInputs = {
    ...inputs,
    capexItems: bumpLines(inputs.capexItems, 1.15),
  };
  const exitCapShockInputs: DetailedUWInputs = {
    ...inputs,
    exitCapRate: inputs.exitCapRate + 0.005,
  };

  return [
    {
      id: 'rates-up-100bps',
      label: 'Rates +100 bps',
      note: 'Interest and exit cap widen together.',
      outcome: computeExitOutcome(rateShockInputs, actualNOI, market),
    },
    {
      id: 'rents-down-5pct',
      label: 'Rents -5%',
      note: 'NOI softens from weaker rent realization.',
      outcome: computeExitOutcome(inputs, rentShockNOI, market),
    },
    {
      id: 'capex-up-15pct',
      label: 'CapEx +15%',
      note: 'Higher renovation spend compresses returns.',
      outcome: computeExitOutcome(capexShockInputs, actualNOI, market),
    },
    {
      id: 'exit-cap-up-50bps',
      label: 'Exit cap +50 bps',
      note: 'Terminal valuation multiple compresses at sale.',
      outcome: computeExitOutcome(exitCapShockInputs, actualNOI, market),
    },
  ];
}
