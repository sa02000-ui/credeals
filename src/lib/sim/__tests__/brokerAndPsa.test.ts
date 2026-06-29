import { describe, expect, it } from 'vitest';
import { evaluateBrokerAdlib } from '../brokerCalls';
import { personaById } from '../personas';
import { resolvePSANegotiation } from '../encounters';

describe('evaluateBrokerAdlib', () => {
  const broker = personaById('broker-institutional');
  if (!broker) throw new Error('expected broker persona to exist');

  it('rewards specific, credible broker lines', () => {
    const out = evaluateBrokerAdlib(
      'Value-add multifamily in Dallas and Houston, 80 to 220 units, proof of funds ready, can close clean in 45 days. Any off-market first looks?',
      broker,
      'balanced',
      62,
    );
    expect(out.repBrokerDelta).toBeGreaterThan(0);
    expect(['shortlist', 'off-market']).toContain(out.lead);
  });

  it('penalizes vague low-quality asks', () => {
    const out = evaluateBrokerAdlib(
      'Send me anything cheap, best discount only.',
      broker,
      'hot',
      50,
    );
    expect(out.lead).toBe('none');
    expect(out.repBrokerDelta).toBeLessThan(0);
  });
});

describe('resolvePSANegotiation', () => {
  it('aggressive stance can recover missed clauses', () => {
    const out = resolvePSANegotiation({
      caughtCount: 3,
      missedCount: 4,
      stance: 'aggressive',
      difficulty: 'guided',
    });
    expect(out.salvaged).toBeGreaterThanOrEqual(1);
    expect(out.unresolved).toBeLessThan(4);
  });

  it('harder mode leaves more unresolved risk', () => {
    const soft = resolvePSANegotiation({
      caughtCount: 4,
      missedCount: 4,
      stance: 'balanced',
      difficulty: 'guided',
    });
    const hard = resolvePSANegotiation({
      caughtCount: 4,
      missedCount: 4,
      stance: 'balanced',
      difficulty: 'expert',
    });
    expect(hard.unresolved).toBeGreaterThanOrEqual(soft.unresolved);
  });
});

