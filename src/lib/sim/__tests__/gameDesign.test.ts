import { describe, it, expect } from 'vitest';
import { scoreUW } from '../uwScore';
import { seededRng, generateSessionSeed, jitterWeight, CURVEBALL_IDS } from '../sessionSeed';
import { INITIAL_PLAYER_MODEL, updatePlayerModel, shouldDeliverLesson, recordLesson } from '../playerModel';
import { newRelationship, recordInteraction, applyBrokerRelToSellerTraits } from '../relationshipLedger';
import { drawAMCards, AM_CARDS } from '../amCards';
import { PSA_CLAUSE_LIBRARY } from '../encounters';
import { buildPipeline } from '../dealPipeline';
import { SEED_DEALS } from '../seed';
import { pickPersona, dealCounterparties } from '../personas';
import { buildNapkinScenarios, buildLOIScenarios, buildC2CScenarios, type Scenario } from '../scenarios';
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

describe('deal pipeline (day-driven flow)', () => {
  const seed: SessionSeed = { value: 4242, dealPoolIndices: [], curveballDeck: [], curveballQuarters: [], marketShiftDay: 100, marketShiftTo: 'tough' };
  it('schedules every deal with a channel, arrival >= 2, and a later expiry', () => {
    const pipe = buildPipeline(SEED_DEALS, seed);
    expect(pipe).toHaveLength(SEED_DEALS.length);
    for (const e of pipe) {
      expect(['website-match', 'broker-on-market', 'broker-off-market']).toContain(e.channel);
      expect(e.arrivalDay).toBeGreaterThanOrEqual(2);
      expect(e.expiresOnDay).toBeGreaterThan(e.arrivalDay);
    }
  });
  it('is deterministic for the same seed', () => {
    const a = buildPipeline(SEED_DEALS, seed).map((e) => `${e.deal.id}:${e.channel}:${e.arrivalDay}`);
    const b = buildPipeline(SEED_DEALS, seed).map((e) => `${e.deal.id}:${e.channel}:${e.arrivalDay}`);
    expect(a).toEqual(b);
  });
  it('arrivals are spread across multiple days (not all at once)', () => {
    const days = new Set(buildPipeline(SEED_DEALS, seed).map((e) => e.arrivalDay));
    expect(days.size).toBeGreaterThan(1);
  });
});

describe('persona jitter (session seed)', () => {
  it('is stable for the same deal + salt', () => {
    expect(pickPersona('seller', 'deal-1', 42).id).toBe(pickPersona('seller', 'deal-1', 42).id);
  });
  it('the same deal can draw a different seller across sessions', () => {
    const ids = new Set(Array.from({ length: 20 }, (_, salt) => pickPersona('seller', 'deal-1', salt).id));
    expect(ids.size).toBeGreaterThan(1);
  });
  it('dealCounterparties threads the salt', () => {
    const a = dealCounterparties('deal-x', 1);
    const b = dealCounterparties('deal-x', 1);
    expect(a.broker.id).toBe(b.broker.id);
    expect(a.seller.id).toBe(b.seller.id);
  });
});

describe('scenario decks are structurally sound', () => {
  // every entry step exists, and every next/branch.next points at a real step (no dead ends)
  function assertValid(s: Scenario) {
    expect(s.steps[s.entry], `${s.id}: entry "${s.entry}" missing`).toBeTruthy();
    for (const step of Object.values(s.steps)) {
      expect(step.options.length, `${s.id}.${step.id}: no options`).toBeGreaterThan(0);
      for (const opt of step.options) {
        if (opt.next) expect(s.steps[opt.next], `${s.id}.${step.id}.${opt.id}: next "${opt.next}" missing`).toBeTruthy();
        for (const b of opt.branches ?? []) {
          if (b.next) expect(s.steps[b.next], `${s.id}.${step.id}.${opt.id}: branch next "${b.next}" missing`).toBeTruthy();
        }
      }
    }
  }
  const ctx = { market: 'balanced' as const, difficulty: 'standard' as const };
  it('napkin deck is valid (both market orderings)', () => {
    buildNapkinScenarios(ctx).forEach(assertValid);
    buildNapkinScenarios({ ...ctx, market: 'hot' }).forEach(assertValid);
  });
  it('LOI deck is valid', () => {
    buildLOIScenarios(ctx).forEach(assertValid);
  });
  it('LOI deck includes multiple decision beats', () => {
    expect(buildLOIScenarios(ctx).length).toBeGreaterThanOrEqual(3);
  });
  it('C2C deck is valid', () => {
    buildC2CScenarios({ ...ctx, missedPSATraps: 2 }).forEach(assertValid);
  });
  it('seller intel fires at napkin (not LOI) and varies by seller archetype', () => {
    const mk = (id: string) => ({ id, kind: 'seller' as const, name: id, blurb: '', traits: {}, tells: ['—'] });
    const distressed = buildNapkinScenarios({ ...ctx, seller: mk('seller-distressed') });
    const institutional = buildNapkinScenarios({ ...ctx, seller: mk('seller-institutional') });
    const pa = distressed.find((s) => s.id === 'napkin-seller-intel')!.steps.s1.prompt;
    const pb = institutional.find((s) => s.id === 'napkin-seller-intel')!.steps.s1.prompt;
    expect(pa).toBeTruthy();
    expect(pa).not.toEqual(pb); // different archetypes ⇒ different broker intel
    // the LOI stage no longer carries a seller-intel scenario
    expect(buildLOIScenarios(ctx).some((s) => /seller-intel/.test(s.id))).toBe(false);
  });
});

describe('content additions (audit gaps)', () => {
  it('includes the three added PSA clauses, all flagged sneaky', () => {
    for (const id of ['survey-exception', 'force-majeure-broad', 'condition-precedent-seller']) {
      const c = PSA_CLAUSE_LIBRARY.find((x) => x.id === id);
      expect(c, `missing PSA clause ${id}`).toBeTruthy();
      expect(c!.sneaky, `${id} should be sneaky`).toBe(true);
      expect(c!.explain.length).toBeGreaterThan(20);
    }
  });
  it('includes the added AM cards with well-formed options', () => {
    const added = [
      'tenant-dispute',
      'lease-renewal-season',
      'renovation-delay',
      'loan-maturity-wall',
      'broker-repair-mission',
      'marketed-sale-process',
      'weather-event-response',
      'geopolitical-oil-shock',
      'market-move-whipsaw',
    ];
    for (const id of added) {
      const card = AM_CARDS.find((c) => c.id === id);
      expect(card, `missing AM card ${id}`).toBeTruthy();
      expect(card!.options.length).toBeGreaterThan(0);
      // each option resolves to a direct outcome OR a set of weighted branches, never neither
      for (const o of card!.options) {
        expect(!!o.effects || (o.branches?.length ?? 0) > 0, `${id}.${o.id}: no effects and no branches`).toBe(true);
      }
    }
  });
  it('every AM card id is unique', () => {
    const ids = AM_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
