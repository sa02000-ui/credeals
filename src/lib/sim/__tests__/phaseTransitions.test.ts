import { describe, expect, it } from 'vitest';
import { guardDealTransition, nextActiveStage } from '../phaseTransitions';

describe('guardDealTransition', () => {
  it('allows normal forward lifecycle transitions', () => {
    expect(guardDealTransition('new', 'napkin').ok).toBe(true);
    expect(guardDealTransition('napkin', 'detailed').ok).toBe(true);
    expect(guardDealTransition('detailed', 'loi').ok).toBe(true);
    expect(guardDealTransition('loi', 'c2c').ok).toBe(true);
    expect(guardDealTransition('c2c', 'am').ok).toBe(true);
    expect(guardDealTransition('am', 'archived').ok).toBe(true);
  });

  it('allows terminalization from active phases', () => {
    expect(guardDealTransition('loi', 'lost').ok).toBe(true);
    expect(guardDealTransition('napkin', 'archived').ok).toBe(true);
  });

  it('blocks skipping forward phases', () => {
    const bad = guardDealTransition('napkin', 'loi');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toContain('Invalid stage transition');
  });

  it('blocks transitions out of terminal states', () => {
    expect(guardDealTransition('lost', 'napkin').ok).toBe(false);
    expect(guardDealTransition('archived', 'am').ok).toBe(false);
  });
});

describe('nextActiveStage', () => {
  it('returns the next stage in the six-stage lifecycle', () => {
    expect(nextActiveStage('new')).toBe('napkin');
    expect(nextActiveStage('napkin')).toBe('detailed');
    expect(nextActiveStage('detailed')).toBe('loi');
    expect(nextActiveStage('loi')).toBe('c2c');
    expect(nextActiveStage('c2c')).toBe('am');
    expect(nextActiveStage('am')).toBe(null);
  });
});

