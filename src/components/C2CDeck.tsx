'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { fetchActiveScenarios, type AuthoredScenario } from '@/lib/data/scenarios';
import { ScenarioRunner } from '@/components/ScenarioRunner';
import { EncounterModal, EncounterChip } from '@/components/EncounterModal';
import { ClosingScorecardModal } from '@/components/ClosingScorecardModal';
import {
  buildC2CScenarios,
  C2C_DAY_BUDGET,
  defaultDetailedInputs,
  resolveClosing,
  runDetailedUW,
  type ClosingResult,
  type ScenarioEffects,
  type MarketDeal,
} from '@/lib/sim';

interface PSAState { done: boolean; caught: string[]; missed: string[] }
interface DeckState { idx: number; flags: Record<string, boolean>; days: number }
interface Scenario { inputs: Parameters<typeof runDetailedUW>[0] }

/** E3 — the Contract-to-Close decision deck (game mode): a sequence of branching scenarios → E4. */
export function C2CDeck({ deal }: { deal: MarketDeal }) {
  const { difficulty, game, applyGameOutcome, setStatus, statusOf, advanceDays } = useApp();
  const [psa] = useDealLocal<PSAState>('psa', deal.id, { done: false, caught: [], missed: [] });
  const [state, setState] = useDealLocal<DeckState>('c2cdeck-v2', deal.id, { idx: 0, flags: {}, days: 5 });
  const [scenarios] = useDealLocal<Scenario[]>('uw-scenarios-v2', deal.id, [{ inputs: defaultDetailedInputs(deal) }]);
  const [scorecard, setScorecard] = useState<ClosingResult | null>(null);
  // encounters pop up like the game-start modal; minimize leaves a "decide" chip inline
  const [popupOpen, setPopupOpen] = useState(true);

  // Storylet pool: built-in scenarios + admin-authored ACTIVE ones from the Scenario Builder.
  // An authored scenario with the same id REPLACES the built-in (admin tuning wins).
  const [authored, setAuthored] = useState<AuthoredScenario[]>([]);
  useEffect(() => {
    let on = true;
    fetchActiveScenarios('c2c').then((list) => { if (on) setAuthored(list); });
    return () => { on = false; };
  }, []);

  const deck = useMemo(() => {
    const builtins = buildC2CScenarios({ market: game.market, difficulty: difficulty ?? 'standard', missedPSATraps: psa.missed.length });
    const authoredIds = new Set(authored.map((a) => a.id));
    return [...builtins.filter((b) => !authoredIds.has(b.id)), ...authored];
  }, [game.market, difficulty, psa.missed.length, authored]);

  const current = deck[state.idx] ?? null;
  const allDone = state.idx >= deck.length;
  const closed = statusOf(deal.id) === 'am';
  const archived = statusOf(deal.id) === 'archived';

  function onEffects(e: ScenarioEffects) {
    if (e.cash || e.rep) applyGameOutcome({ dealId: deal.id, cashDelta: e.cash, cashLabel: `${current?.title} — ${deal.name}`, repDelta: e.rep });
    if (e.days) {
      setState((s) => ({ ...s, days: s.days + (e.days ?? 0) })); // deal-level on-time tracking
      advanceDays(e.days); // the global clock moves too — decisions consume real time
    }
  }

  function onComplete(flags: Record<string, boolean>) {
    const merged = { ...state.flags, ...flags };
    if (flags.walk) {
      applyGameOutcome({ dealId: deal.id, repDelta: { broker: -3 }, event: { title: `Walked: ${deal.name}`, detail: 'You walked from the deal.', lesson: 'Walking protects capital. The discipline to pass is a skill.' } });
      setStatus(deal.id, 'archived');
      setState((s) => ({ ...s, flags: merged }));
      return;
    }
    setState((s) => ({ ...s, idx: s.idx + 1, flags: merged }));
  }

  function review() {
    const f = state.flags;
    const total = psa.caught.length + psa.missed.length;
    const psaProtection = total > 0 ? psa.caught.length / total : 0.5;
    const result = resolveClosing({
      contingenciesCleared: !!(f.lenderCleared && f.appraisalResolved),
      raiseFunded: !!f.raiseFunded,
      onTime: state.days <= C2C_DAY_BUDGET,
      psaProtection,
      ddDone: !!f.ddDone,
      difficulty: difficulty ?? 'standard',
    });
    setScorecard(result);
  }

  const projected = useMemo(() => {
    const r = runDetailedUW(scenarios[0]?.inputs ?? defaultDetailedInputs(deal));
    return { leveredIRR: r.leveredIRR, equityMultiple: r.equityMultiple, avgCashOnCash: r.avgCashOnCash };
  }, [scenarios, deal]);

  if (closed) return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">✅ Closed — the asset is in your portfolio. Head to Asset Management.</div>;
  if (archived) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">This deal was archived during the close. Pick another deal from the feed.</div>;

  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-bold text-slate-900">🃏 Close the deal — live decisions</h3>
        <span className="ml-auto text-xs text-slate-500">{Math.min(state.idx, deck.length)}/{deck.length} cleared · day cost {state.days}d</span>
      </div>

      {current ? (
        popupOpen ? (
          <EncounterModal
            icon="🃏"
            title={current.title}
            subtitle={`Closing decision ${Math.min(state.idx + 1, deck.length)} of ${deck.length} — ${deal.name}`}
            onMinimize={() => setPopupOpen(false)}
          >
            <ScenarioRunner key={current.id} scenario={current} onEffects={onEffects} onComplete={onComplete} />
          </EncounterModal>
        ) : (
          <EncounterChip icon="🃏" label={`Decision waiting: ${current.title}`} onOpen={() => setPopupOpen(true)} />
        )
      ) : allDone ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-sm text-slate-700">All decisions made — time to close.</p>
          <button onClick={review} className="mt-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Go to the closing table →</button>
        </div>
      ) : null}

      {scorecard && (
        <ClosingScorecardModal
          dealName={deal.name}
          result={scorecard}
          projected={projected}
          actual={{ leveredIRR: projected.leveredIRR * scorecard.performanceFactor, equityMultiple: projected.equityMultiple * scorecard.performanceFactor, avgCashOnCash: projected.avgCashOnCash * scorecard.performanceFactor }}
          onEnterAM={() => {
            applyGameOutcome({ dealId: deal.id, closed: true, repDelta: { lp: 2, broker: 2 }, event: { title: `Closed: ${deal.name}`, detail: 'Deal closed and added to the portfolio.', lesson: 'Onward — bigger deals unlock as your track record grows.' } });
            setStatus(deal.id, 'am');
            setScorecard(null);
          }}
          onRecover={() => { setState((s) => ({ ...s, idx: Math.max(0, deck.length - 1), flags: { ...s.flags } })); setScorecard(null); }}
          onClose={() => setScorecard(null)}
        />
      )}
    </div>
  );
}
