import { describe, it, expect } from 'vitest';
import { resolveOffer, resolveCapitalRaise, negotiateLOI, resolveClosing, tierFor, repAverage } from '../gameEngine';
import type { Persona } from '../personas';

const seller = (priceFlex: number, motivation = 0.5): Persona => ({
  id: 's', kind: 'seller', name: 'Test Seller', blurb: '', traits: { motivation, priceFlex, retradeRisk: 0.3 }, tells: ['—'],
});

describe('resolveOffer', () => {
  it('accepts an at-ask offer', () => {
    const o = resolveOffer({ offerPrice: 10_000_000, askPrice: 10_000_000, seller: seller(0.4), market: 'balanced', brokerRep: 50 });
    expect(o.result).toBe('accepted');
  });
  it('rejects an insulting lowball to a firm seller', () => {
    const o = resolveOffer({ offerPrice: 7_000_000, askPrice: 10_000_000, seller: seller(0.2), market: 'balanced', brokerRep: 50 });
    expect(o.result).toBe('rejected');
  });
  it('counters an offer just below reservation', () => {
    // firm seller (low flex/motivation) → reservation ≈ 9.26M; a 9.0M offer is below it but not insulting
    const o = resolveOffer({ offerPrice: 9_000_000, askPrice: 10_000_000, seller: seller(0.3, 0.3), market: 'balanced', brokerRep: 50 });
    expect(o.result).toBe('countered');
    expect(o.counterPrice).toBeGreaterThan(9_000_000);
  });
});

describe('resolveCapitalRaise', () => {
  it('funds a partner raise', () => {
    const r = resolveCapitalRaise({ equityNeeded: 1_000_000, strategy: 'partners', market: 'balanced', lpRep: 60, dealsClosed: 2 });
    expect(r.success).toBe(true);
    expect(r.raised).toBe(1_000_000);
  });
  it('can come up short raising solo in a tough market with low reputation', () => {
    const r = resolveCapitalRaise({ equityNeeded: 5_000_000, strategy: 'solo', market: 'tough', lpRep: 20, dealsClosed: 0 });
    expect(r.success).toBe(false);
    expect(r.recovery).toBeTruthy();
  });
});

describe('negotiateLOI', () => {
  const strong = { price: 10_000_000, emdPct: 0.02, ddDays: 21, closeDays: 45, financingContingency: false };
  it('accepts strong full-price terms', () => {
    const r = negotiateLOI({ terms: strong, askPrice: 10_000_000, seller: seller(0.4), market: 'balanced', brokerRep: 60, responsiveness: 1, round: 1, competingPressure: 0 });
    expect(r.outcome).toBe('accepted');
  });
  it('counters weak terms with specific demands', () => {
    const weak = { price: 9_200_000, emdPct: 0.005, ddDays: 60, closeDays: 90, financingContingency: true };
    const r = negotiateLOI({ terms: weak, askPrice: 10_000_000, seller: seller(0.6, 0.7), market: 'tough', brokerRep: 50, responsiveness: 1, round: 1, competingPressure: 0 });
    expect(r.outcome).toBe('counter');
    expect(r.changes.length).toBeGreaterThan(0);
  });
  it('grows competing pressure faster when responses are slow', () => {
    const fast = negotiateLOI({ terms: strong, askPrice: 10_000_000, seller: seller(0.4), market: 'hot', brokerRep: 50, responsiveness: 1, round: 2, competingPressure: 0.2 });
    const slow = negotiateLOI({ terms: strong, askPrice: 10_000_000, seller: seller(0.4), market: 'hot', brokerRep: 50, responsiveness: 0, round: 2, competingPressure: 0.2 });
    expect(slow.competingPressure).toBeGreaterThan(fast.competingPressure);
  });
});

describe('resolveClosing', () => {
  const good = { contingenciesCleared: true, raiseFunded: true, onTime: true, psaProtection: 1, ddDone: true };
  it('succeeds when everything is handled (guided)', () => {
    const r = resolveClosing({ ...good, difficulty: 'guided' });
    expect(r.success).toBe(true);
    expect(r.closeScore).toBe(100);
    expect(r.performanceFactor).toBeGreaterThan(0.9);
  });
  it('fails when nothing is handled (expert) and offers recovery', () => {
    const r = resolveClosing({ contingenciesCleared: false, raiseFunded: false, onTime: false, psaProtection: 0, ddDone: false, difficulty: 'expert' });
    expect(r.success).toBe(false);
    expect(r.recovery).toBeTruthy();
    expect(r.performanceFactor).toBeGreaterThanOrEqual(0.5);
  });
  it('keeps the performance factor within bounds', () => {
    const r = resolveClosing({ ...good, difficulty: 'standard' });
    expect(r.performanceFactor).toBeLessThanOrEqual(1.05);
  });
});

describe('career tiers', () => {
  it('maps deals + reputation to a tier', () => {
    expect(tierFor(0, 50)).toBe('House Hacker');
    expect(tierFor(1, 55)).toBe('Syndicator');
    expect(tierFor(4, 60)).toBe('Operator');
    expect(tierFor(8, 70)).toBe('Fund Manager');
  });
  it('averages reputation', () => {
    expect(repAverage({ broker: 60, lender: 60, lp: 60 })).toBe(60);
  });
});
