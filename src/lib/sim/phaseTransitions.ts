import type { DealStatus } from './types';

export const ACTIVE_DEAL_FLOW: DealStatus[] = [
  'new',
  'napkin',
  'detailed',
  'loi',
  'c2c',
  'am',
];

export const TERMINAL_DEAL_STATUSES: DealStatus[] = ['lost', 'archived'];

const ALLOWED_TRANSITIONS: Record<DealStatus, ReadonlySet<DealStatus>> = {
  new: new Set(['napkin', 'archived', 'lost']),
  napkin: new Set(['detailed', 'archived', 'lost']),
  detailed: new Set(['loi', 'archived', 'lost']),
  loi: new Set(['c2c', 'archived', 'lost']),
  c2c: new Set(['am', 'archived', 'lost']),
  am: new Set(['archived', 'lost']),
  lost: new Set([]),
  archived: new Set([]),
};

export interface TransitionGuardResult {
  ok: boolean;
  reason?: string;
}

/**
 * Explicit lifecycle transition guard:
 * - Enforces forward-only progression through the six active phases.
 * - Allows early terminalization (lost/archived) from active phases.
 * - Blocks transitions out of terminal states.
 */
export function guardDealTransition(from: DealStatus, to: DealStatus): TransitionGuardResult {
  if (from === to) return { ok: true };
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.has(to)) {
    const expected = Array.from(allowed.values());
    return {
      ok: false,
      reason:
        expected.length > 0
          ? `Invalid stage transition: ${from} -> ${to}. Allowed from ${from}: ${expected.join(', ')}.`
          : `Invalid stage transition: ${from} -> ${to}. ${from} is terminal.`,
    };
  }
  return { ok: true };
}

export function nextActiveStage(status: DealStatus): DealStatus | null {
  const idx = ACTIVE_DEAL_FLOW.indexOf(status);
  if (idx < 0 || idx >= ACTIVE_DEAL_FLOW.length - 1) return null;
  return ACTIVE_DEAL_FLOW[idx + 1];
}

