import { describe, expect, it } from 'vitest';
import { evaluateExitOutcome, classifyTerminalOutcome } from '../exitEngine';
import { SEED_DEALS } from '../seed';

describe('classifyTerminalOutcome', () => {
  it('classifies blown-up when capital loss is severe', () => {
    const out = classifyTerminalOutcome({
      projectedIRR: 0.14,
      adjustedActualIRR: -0.31,
      investorCapitalLostPct: 0.82,
    });
    expect(out).toBe('blown-up');
  });

  it('classifies won when adjusted actual meets projection', () => {
    const out = classifyTerminalOutcome({
      projectedIRR: 0.12,
      adjustedActualIRR: 0.14,
      investorCapitalLostPct: 0,
    });
    expect(out).toBe('won');
  });
});

describe('evaluateExitOutcome', () => {
  it('is deterministic for same seed + quarter in deterministic mode', () => {
    const deal = SEED_DEALS[0];
    const a = evaluateExitOutcome({
      deal,
      market: 'balanced',
      projectedIRR: 0.15,
      actualIRR: 0.11,
      seed: 777,
      holdQuarter: 7,
      variabilityMode: 'deterministic',
    });
    const b = evaluateExitOutcome({
      deal,
      market: 'balanced',
      projectedIRR: 0.15,
      actualIRR: 0.11,
      seed: 777,
      holdQuarter: 7,
      variabilityMode: 'deterministic',
    });
    expect(a).toEqual(b);
  });

  it('returns bounded property and area scores', () => {
    const out = evaluateExitOutcome({
      deal: SEED_DEALS[1],
      market: 'tough',
      projectedIRR: 0.13,
      actualIRR: 0.06,
      seed: 1,
      holdQuarter: 4,
      variabilityMode: 'deterministic',
    });
    expect(out.risk.propertyScore).toBeGreaterThanOrEqual(0);
    expect(out.risk.propertyScore).toBeLessThanOrEqual(100);
    expect(out.risk.areaScore).toBeGreaterThanOrEqual(0);
    expect(out.risk.areaScore).toBeLessThanOrEqual(100);
  });
});
