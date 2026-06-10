'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { ClosingScorecardModal } from '@/components/ClosingScorecardModal';
import {
  buildC2CDeck,
  C2C_DAY_BUDGET,
  defaultDetailedInputs,
  resolveClosing,
  runDetailedUW,
  usd,
  type ClosingResult,
  type DeckOption,
  type MarketDeal,
} from '@/lib/sim';

interface PSAState { done: boolean; caught: string[]; missed: string[] }
interface DeckState { choices: Record<string, string> }
interface Scenario { inputs: Parameters<typeof runDetailedUW>[0] }

/** E3 — the Contract-to-Close decision deck (game mode), feeding E4 closing resolution. */
export function C2CDeck({ deal }: { deal: MarketDeal }) {
  const { difficulty, game, applyGameOutcome, setStatus, statusOf } = useApp();
  const [psa] = useDealLocal<PSAState>('psa', deal.id, { done: false, caught: [], missed: [] });
  const [deckState, setDeckState] = useDealLocal<DeckState>('c2cdeck', deal.id, { choices: {} });
  const [scenarios] = useDealLocal<Scenario[]>('uw-scenarios-v2', deal.id, [{ inputs: defaultDetailedInputs(deal) }]);
  const [scorecard, setScorecard] = useState<ClosingResult | null>(null);

  const deck = useMemo(
    () => buildC2CDeck({ market: game.market, difficulty: difficulty ?? 'standard', missedPSATraps: psa.missed.length }),
    [game.market, difficulty, psa.missed.length],
  );

  const chosen = deckState.choices;
  const current = deck.find((c) => !chosen[c.id]) ?? null;
  const allDone = deck.every((c) => chosen[c.id]);
  const closed = statusOf(deal.id) === 'am';

  function pick(cardId: string, opt: DeckOption) {
    if (opt.effect.ends === 'walk') {
      applyGameOutcome({ dealId: deal.id, repDelta: { broker: -3 }, event: { title: `Walked: ${deal.name}`, detail: opt.result, lesson: 'Walking protects capital. Sometimes the discipline to pass is the best move.' } });
      setStatus(deal.id, 'archived');
      return;
    }
    applyGameOutcome({
      dealId: deal.id,
      cashDelta: opt.effect.cash,
      cashLabel: `${current?.title} — ${deal.name}`,
      repDelta: opt.effect.rep,
      event: { title: `${current?.title}: ${opt.label}`, detail: opt.result },
    });
    setDeckState((s) => ({ choices: { ...s.choices, [cardId]: opt.id } }));
  }

  function review() {
    // aggregate closing factors from the choices
    let totalDays = 5;
    let contingenciesCleared = false;
    let raiseFunded = false;
    let ddDone = false;
    let lenderOk = false;
    let appraisalOk = false;
    for (const c of deck) {
      const opt = c.options.find((o) => o.id === chosen[c.id]);
      if (!opt) continue;
      totalDays += opt.effect.days ?? 0;
      if (opt.effect.closing?.raiseFunded) raiseFunded = true;
      if (opt.effect.closing?.ddDone) ddDone = true;
      if (c.id === 'lender' && opt.effect.closing?.contingenciesCleared) lenderOk = true;
      if (c.id === 'appraisal' && opt.effect.closing?.contingenciesCleared) appraisalOk = true;
    }
    contingenciesCleared = lenderOk && appraisalOk;
    const total = psa.caught.length + psa.missed.length;
    const psaProtection = total > 0 ? psa.caught.length / total : 0.5;
    const result = resolveClosing({ contingenciesCleared, raiseFunded, onTime: totalDays <= C2C_DAY_BUDGET, psaProtection, ddDone, difficulty: difficulty ?? 'standard' });
    setScorecard(result);
  }

  const projected = useMemo(() => {
    const r = runDetailedUW(scenarios[0]?.inputs ?? defaultDetailedInputs(deal));
    return { leveredIRR: r.leveredIRR, equityMultiple: r.equityMultiple, avgCashOnCash: r.avgCashOnCash };
  }, [scenarios, deal]);

  if (closed) {
    return <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">✅ Closed — the asset is in your portfolio. Head to Asset Management.</div>;
  }

  return (
    <div className="mt-4 rounded-lg border-2 border-emerald-200 bg-emerald-50/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-bold text-slate-800">🃏 Close the deal — decisions</h3>
        <span className="text-xs text-slate-500">{Object.keys(chosen).length}/{deck.length} resolved</span>
      </div>

      {current ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{current.title}</div>
          <p className="mt-1 text-sm text-slate-700">{current.prompt}</p>
          <div className="mt-3 space-y-2">
            {current.options.map((opt) => (
              <button key={opt.id} onClick={() => pick(current.id, opt)} className="block w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-900 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                  <span className="flex items-center gap-2 text-[11px]">
                    {opt.effect.cash ? <span className="text-red-600 tabular-nums">{usd(opt.effect.cash, { compact: true })}</span> : null}
                    {opt.effect.days ? <span className="text-slate-400">+{opt.effect.days}d</span> : null}
                    <span className={`rounded px-1.5 py-0.5 ${opt.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : opt.tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{opt.tone}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{opt.detail}</p>
              </button>
            ))}
          </div>
        </div>
      ) : allDone ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-sm text-slate-700">All decisions made. Time to close.</p>
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
          onRecover={() => { setDeckState({ choices: {} }); setScorecard(null); }}
          onClose={() => setScorecard(null)}
        />
      )}
    </div>
  );
}
