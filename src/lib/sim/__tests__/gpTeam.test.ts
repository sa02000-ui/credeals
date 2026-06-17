import { describe, it, expect } from 'vitest';
import {
  GP_BUCKETS,
  acqFeePct,
  defaultGPTeam,
  defaultWeights,
  emptyAlloc,
  runGPTeam,
  type GPTeamState,
} from '../gpTeam';

describe('GP bucket weights', () => {
  it('default weights sum to 1.0', () => {
    const total = GP_BUCKETS.reduce((s, b) => s + b.weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });
  it('each default weight sits inside its suggested range', () => {
    for (const b of GP_BUCKETS) {
      expect(b.weight).toBeGreaterThanOrEqual(b.rangeLo);
      expect(b.weight).toBeLessThanOrEqual(b.rangeHi);
    }
  });
});

describe('acquisition fee ladder', () => {
  it('maps price to the recommended %', () => {
    expect(acqFeePct(1_500_000)).toBe(0.05);
    expect(acqFeePct(3_000_000)).toBe(0.04);
    expect(acqFeePct(8_000_000)).toBe(0.03);
    expect(acqFeePct(20_000_000)).toBe(0.02);
    expect(acqFeePct(120_000_000)).toBe(0.01);
  });
});

describe('runGPTeam', () => {
  it('a single member who owns every bucket takes 100% of GP', () => {
    const s = defaultGPTeam('Solo');
    s.members = [{ id: 'solo', name: 'Solo', alloc: Object.fromEntries(GP_BUCKETS.map((b) => [b.id, 1])) }];
    s.totalGPProfit = 1_000_000;
    const r = runGPTeam(s);
    expect(r.members[0].gpShare).toBeCloseTo(1, 6);
    expect(r.members[0].dealShare).toBeCloseTo(s.gpPct, 6);
    expect(r.members[0].profit).toBeCloseTo(1_000_000, 2);
    for (const b of GP_BUCKETS) expect(r.bucketFill[b.id]).toBeCloseTo(1, 6);
  });

  it('weights each member by bucket weight', () => {
    // Member A takes Asset Management (weight .30), Member B takes Sourcing (weight .05).
    const s: GPTeamState = {
      gpPct: 0.3,
      weights: defaultWeights(),
      totalGPProfit: 1_200_000,
      linkToUW: false,
      members: [
        { id: 'a', name: 'A', alloc: { ...emptyAlloc(), am: 1 } },
        { id: 'b', name: 'B', alloc: { ...emptyAlloc(), sourcing: 1 } },
      ],
    };
    const r = runGPTeam(s);
    expect(r.members[0].gpShare).toBeCloseTo(0.3, 6);
    expect(r.members[1].gpShare).toBeCloseTo(0.05, 6);
    expect(r.members[0].profit).toBeCloseTo(360_000, 2);
    expect(r.members[1].profit).toBeCloseTo(60_000, 2);
  });
});
