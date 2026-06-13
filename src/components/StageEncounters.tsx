'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { fetchActiveScenarios, type AuthoredScenario } from '@/lib/data/scenarios';
import { ScenarioRunner } from '@/components/ScenarioRunner';
import { EncounterModal, EncounterChip } from '@/components/EncounterModal';
import type { Scenario, ScenarioEffects, MarketDeal } from '@/lib/sim';

interface DeckState { idx: number; flags: Record<string, boolean> }

/**
 * Generic early-stage encounter deck: surfaces built-in scenarios for a lifecycle phase, merged with
 * admin-authored ACTIVE scenarios from the Scenario Builder (authored id REPLACES a built-in of the
 * same id), and plays them as pop-ups — the same pattern the C2C deck uses, generalized so the napkin
 * and LOI stages aren't empty. Effects flow to cash / reputation / the global clock. Game mode only.
 */
export function StageEncounters({
  deal,
  phase,
  builtins,
  icon = '🎲',
}: {
  deal: MarketDeal;
  phase: string;
  builtins: Scenario[];
  icon?: string;
}) {
  const { applyGameOutcome, advanceDays } = useApp();
  const [state, setState] = useDealLocal<DeckState>(`enc-${phase}-v1`, deal.id, { idx: 0, flags: {} });
  const [popupOpen, setPopupOpen] = useState(true);

  const [authored, setAuthored] = useState<AuthoredScenario[]>([]);
  useEffect(() => {
    let on = true;
    fetchActiveScenarios(phase).then((list) => { if (on) setAuthored(list); });
    return () => { on = false; };
  }, [phase]);

  const deck = useMemo(() => {
    const authoredIds = new Set(authored.map((a) => a.id));
    return [...builtins.filter((b) => !authoredIds.has(b.id)), ...authored];
  }, [builtins, authored]);

  const current = deck[state.idx] ?? null;

  function onEffects(e: ScenarioEffects) {
    if (e.cash || e.rep) applyGameOutcome({ dealId: deal.id, cashDelta: e.cash, cashLabel: `${current?.title} — ${deal.name}`, repDelta: e.rep });
    if (e.days) advanceDays(e.days);
  }

  function onComplete(flags: Record<string, boolean>) {
    setState((s) => ({ idx: s.idx + 1, flags: { ...s.flags, ...flags } }));
    setPopupOpen(true);
  }

  if (!current) return null; // deck exhausted — stay out of the way

  return popupOpen ? (
    <EncounterModal
      icon={icon}
      title={current.title}
      subtitle={`${deal.name} — ${state.idx + 1} of ${deck.length}`}
      onMinimize={() => setPopupOpen(false)}
    >
      <ScenarioRunner key={current.id} scenario={current} onEffects={onEffects} onComplete={onComplete} />
    </EncounterModal>
  ) : (
    <div className="mb-3">
      <EncounterChip icon={icon} label={`Decision waiting: ${current.title}`} onOpen={() => setPopupOpen(true)} />
    </div>
  );
}
