/**
 * Counterparty relationship ledger (design doc): a per-persona score (0–100) + memory flags +
 * unlocked behaviors, driven by how you treat brokers/lenders/LPs/sellers across deals. Past
 * behavior feeds back into future deals (e.g. a burned broker stops advocating → sellers turn firm). Pure.
 */

import type { CounterpartyKind } from './personas';
import { PERSONAS } from './personas';
import type { CounterpartyRelationship, InteractionType } from './gameTypes';

export function newRelationship(personaId: string): CounterpartyRelationship {
  const persona = PERSONAS.find((p) => p.id === personaId);
  return {
    personaId,
    kind: (persona?.kind ?? 'broker') as CounterpartyKind,
    name: persona?.name ?? personaId,
    personalScore: 50,
    interactionLog: [],
    memoryFlags: [],
    unlockedBehaviors: [],
  };
}

const INTERACTION_DELTA: Record<InteractionType, number> = {
  'closed-clean': +15, retraded: -12, lowballed: -8, 'slow-response': -5, 'full-dd': +4, ghosted: -18, 'referral-sent': +10,
};

export function recordInteraction(rel: CounterpartyRelationship, type: InteractionType, dealId: string, note: string, day: number): CounterpartyRelationship {
  const delta = INTERACTION_DELTA[type] ?? 0;
  const personalScore = Math.max(0, Math.min(100, rel.personalScore + delta));
  const log = [...rel.interactionLog, { dealId, type, day, note }];

  const flags = new Set(rel.memoryFlags);
  const closedClean = log.filter((i) => i.type === 'closed-clean').length;
  const retraded = log.filter((i) => i.type === 'retraded').length;
  if (closedClean >= 2) flags.add('closed-clean-twice');
  if (retraded >= 1) flags.add('retraded-once');
  if (retraded >= 2) flags.add('retraded-twice');
  if (type === 'ghosted') flags.add('ghosted');
  if (type === 'referral-sent') flags.add('referred-a-deal');

  const behaviors = new Set(rel.unlockedBehaviors);
  if (closedClean >= 2 && rel.kind === 'broker') behaviors.add('off-market-priority');
  if (closedClean >= 3 && rel.kind === 'broker') behaviors.add('shares-reservation-price');
  if (retraded >= 2) behaviors.add('stopped-sending-deals');
  if (type === 'ghosted' && rel.kind === 'lp') behaviors.add('exploring-exit-rights');
  if (closedClean >= 1 && rel.kind === 'seller') behaviors.add('seller-network-referral-eligible');

  return { ...rel, personalScore, interactionLog: log, memoryFlags: Array.from(flags), unlockedBehaviors: Array.from(behaviors) };
}

/** A broker's standing nudges how flexible the seller is at the table. */
export function applyBrokerRelToSellerTraits(sellerTraits: Record<string, number>, brokerRel: CounterpartyRelationship): Record<string, number> {
  const m = { ...sellerTraits };
  if (brokerRel.unlockedBehaviors.includes('stopped-sending-deals')) {
    m.priceFlex = Math.max(0, (m.priceFlex ?? 0.4) - 0.1);
  } else if (brokerRel.personalScore >= 70) {
    m.priceFlex = Math.min(1, (m.priceFlex ?? 0.4) + 0.08);
    m.motivation = Math.min(1, (m.motivation ?? 0.5) + 0.05);
  } else if (brokerRel.personalScore < 50) {
    m.priceFlex = Math.max(0, (m.priceFlex ?? 0.4) - 0.05);
  }
  return m;
}
