import { describe, it, expect } from 'vitest';
import { scoreUW } from '../uwScore';
import { seededRng, generateSessionSeed, jitterWeight, CURVEBALL_IDS } from '../sessionSeed';
import { INITIAL_PLAYER_MODEL, updatePlayerModel, shouldDeliverLesson, recordLesson } from '../playerModel';
import { newRelationship, recordInteraction, applyBrokerRelToSellerTraits } from '../relationshipLedger';
import { drawAMCards, AM_CARDS } from '../amCards';
import type { DealDNA, SessionSeed } from '../gameTypes';

describe('scoreUW', () => {
  it('scores conservative assumptions low and aggressive high', () => {
    const conservative = scoreUW({ rentVsMarket: 1.05, expenseRatio: 0.45, exitCapRate: 0.065, capexPerUnit: 10000, vacancyStabilized: 0.08 }, 'multifamily');
    const aggressive = scoreUW({ rentVsMarket: 1.2, expenseRatio: 0.36, exitCapRate: 0.055, capexPerUnit: 5000, vacancyStabilized: 0.04 }, 'multifamily');
    expect(conservative.score).toBeLessThan(aggressive.score);
    expect(conservative.label).toBe('Very Conservative');
    expect(aggressive.label).toBe('Very Aggressive');
  });
  it('keeps the score within 1–4', () => {
    const r = scoreUW({ rentVsMarket: 1.5, expenseRatio: 0.2, exitCapRate: 0.04, capexPerUnit: 0, vacancyStabilized: 0 }, 'multifamily');
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(4);
  });
});

describe('sessionSeed', () => {
  it('seededRng is deterministic for the same seed', () => {
    const a = seededRng(123); const b = seededRng(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('generateSessionSeed returns a well-formed seed', () => {
    const s = generateSessionSeed(40, 8);
    expect(s.dealPoolIndices).toHaveLength(8);
    expect(new Set(s.dealPoolIndices).size).toBe(8); // unique
    expect(s.curveballDeck).toHaveLength(4);
    expect(s.curveballDeck.every((c) => CURVEBALL_IDS.includes(c))).toBe(true);
    expect(new Set(s.curveballQuarters).size).toBe(4); // unique quarters
    expect(s.marketShiftDay).toBeGreaterThanOrEqual(60);
    expect(s.marketShiftDay).toBeLessThanOrEqual(200);
  });
  it('jitterWeight stays within bounds', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 50; i++) {
      const w = jitterWeight(0.4, rng);
      expect(w).toBeGreaterThanOrEqual(0.05);
      expect(w).toBeLessThanOrEqual(0.95);
    }
  });
});

describe('playerModel', () => {
  const dna = (over: Partial<DealDNA>): DealDNA => ({
    dealId: 'd', uwScore: 2, brokerRelAtLOI: 50, sellerPersonaId: '', brokerPersonaId: '', psaCatchScore: 1,
    ddDepth: 'full', lenderChosen: '', raiseStructure: 'partners', businessPlan: 'value-add', closingScore: 80, amDecisions: [], ...over,
  });

  it('flags light-dd after two light diligence deals', () => {
    let m = updatePlayerModel(INITIAL_PLAYER_MODEL, dna({ ddDepth: 'light' }));
    expect(m.weakSpots).not.toContain('light-dd');
    m = updatePlayerModel(m, dna({ ddDepth: 'light' }));
    expect(m.weakSpots).toContain('light-dd');
  });

  it('flags aggressive-uw when high UW scores miss projections', () => {
    const m = updatePlayerModel(INITIAL_PLAYER_MODEL, dna({ uwScore: 3.5, projectedIRR: 0.18, actualIRR: 0.1 }));
    expect(m.weakSpots).toContain('aggressive-uw');
  });

  it('lesson delivery: first yes, second suppressed', () => {
    const m0 = INITIAL_PLAYER_MODEL;
    expect(shouldDeliverLesson(m0, 'light-dd-warning')).toBe(true);
    const m1 = recordLesson(m0, 'light-dd-warning');
    expect(shouldDeliverLesson(m1, 'light-dd-warning')).toBe(false);
  });
});

describe('relationshipLedger', () => {
  it('a clean broker close raises the score and, twice, unlocks off-market priority', () => {
    let rel = newRelationship('broker-relationship');
    rel = recordInteraction(rel, 'closed-clean', 'd1', 'closed', 10);
    expect(rel.personalScore).toBe(65);
    rel = recordInteraction(rel, 'closed-clean', 'd2', 'closed', 20);
    expect(rel.unlockedBehaviors).toContain('off-market-priority');
    expect(rel.memoryFlags).toContain('closed-clean-twice');
  });

  it('two retrades make the broker stop sending deals and stiffen sellers', () => {
    let rel = newRelationship('broker-relationship');
    rel = recordInteraction(rel, 'retraded', 'd1', 'r', 5);
    rel = recordInteraction(rel, 'retraded', 'd2', 'r', 15);
    expect(rel.unlockedBehaviors).toContain('stopped-sending-deals');
    const traits = applyBrokerRelToSellerTraits({ priceFlex: 0.4, motivation: 0.5 }, rel);
    expect(traits.priceFlex).toBeLessThan(0.4);
  });
});

describe('drawAMCards', () => {
  const seed: SessionSeed = { value: 999, dealPoolIndices: [], curveballDeck: ['hvac-failure', 'rate-hike-shock', 'unsolicited-buyer-offer', 'lp-cold-feet'], curveballQuarters: [1, 3, 5, 7], marketShiftDay: 100, marketShiftTo: 'tough' };

  it('fires the seeded curveball assigned to the quarter first', () => {
    const cards = drawAMCards({ quarter: 1, seed, firedIds: [], count: 2 });
    expect(cards.some((c) => c.id === 'hvac-failure')).toBe(true);
  });
  it('is deterministic for the same quarter/seed', () => {
    const a = drawAMCards({ quarter: 2, seed, firedIds: [], count: 2 }).map((c) => c.id);
    const b = drawAMCards({ quarter: 2, seed, firedIds: [], count: 2 }).map((c) => c.id);
    expect(a).toEqual(b);
  });
  it('never redraws a fired card', () => {
    const cards = drawAMCards({ quarter: 4, seed, firedIds: AM_CARDS.map((c) => c.id).filter((id) => id !== 'lp-update'), count: 2 });
    expect(cards.every((c) => c.id === 'lp-update' || c.id === 'unsolicited-buyer-offer' || c.id === 'lp-cold-feet' || c.id === 'rate-hike-shock')).toBe(true);
  });
  it('respects requires (value-add only cards hidden otherwise)', () => {
    const cards = drawAMCards({ quarter: 6, seed, dna: { businessPlan: 'light-touch' }, firedIds: [], count: 8 });
    expect(cards.some((c) => c.id === 'renovation-decision')).toBe(false);
  });
});
