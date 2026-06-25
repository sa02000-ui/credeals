'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { CalibrationReview } from '@/components/CalibrationReview';
import { computeExitOutcome, defaultDetailedInputs, drawAMCards, usd, type AMCard, type AMEffect, type AMOption, type DetailedUWInputs, type MarketDeal } from '@/lib/sim';

/** E-AM — the quarterly Asset Management card phase (design doc Part 3). Game mode. */
export function AMPhase({ deal }: { deal: MarketDeal }) {
  const { amStates, initAMState, applyAMEffect, advanceAMQuarter, dealDNA, playerModel, sessionSeed, setStatus, statusOf } = useApp();

  // seed AM state once from the deal's stabilized economics
  const est = useMemo(() => {
    const noi = Math.round(deal.avgMarketRent * 12 * deal.unitCount * (1 - deal.stabilizedVacancy) - deal.expensePerUnit * deal.unitCount);
    const annualDS = Math.round(deal.askPrice * 0.65 * 0.06);
    return { noi, annualDS };
  }, [deal]);
  const am = amStates[deal.id];
  // Seed AM state once (in an effect, not during render).
  useEffect(() => {
    if (!amStates[deal.id]) initAMState(deal.id, 1 - deal.stabilizedVacancy, est.noi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id, am]);
  if (!am) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Taking over the asset…</div>;
  }

  const archived = statusOf(deal.id) === 'archived';
  if (archived) return <CalibrationReview deal={deal} />;

  return <AMQuarter deal={deal} am={am} est={est} dna={dealDNA[deal.id]} weakSpots={playerModel.weakSpots} seed={sessionSeed} applyAMEffect={applyAMEffect} advanceAMQuarter={advanceAMQuarter} setStatus={setStatus} />;
}

function AMQuarter({ deal, am, est, dna, weakSpots, seed, applyAMEffect, advanceAMQuarter, setStatus }: {
  deal: MarketDeal;
  am: ReturnType<typeof useApp>['amStates'][string];
  est: { noi: number; annualDS: number };
  dna: ReturnType<typeof useApp>['dealDNA'][string] | undefined;
  weakSpots: string[];
  seed: ReturnType<typeof useApp>['sessionSeed'];
  applyAMEffect: ReturnType<typeof useApp>['applyAMEffect'];
  advanceAMQuarter: ReturnType<typeof useApp>['advanceAMQuarter'];
  setStatus: ReturnType<typeof useApp>['setStatus'];
}) {
  const { game, finalizeExit } = useApp();
  const [scenarios] = useDealLocal<{ inputs: DetailedUWInputs }[]>('uw-scenarios-v2', deal.id, [{ inputs: defaultDetailedInputs(deal) }]);

  function doExit() {
    if (!confirm('Exit (sell) this asset now? This ends the hold and scores the deal.')) return;
    const inputs = scenarios[0]?.inputs ?? defaultDetailedInputs(deal);
    const outcome = computeExitOutcome(inputs, am.noiCurrent, game.market);
    finalizeExit(deal.id, outcome.projectedIRR, outcome.actualIRR);
    setStatus(deal.id, 'archived');
  }

  // cards for this quarter — computed once per quarter (prior-quarter decisions are "fired")
  const cards = useMemo(() => {
    if (!seed) return [];
    const firedIds = am.decisions.filter((d) => d.quarter < am.quarter).map((d) => d.cardId);
    return drawAMCards({ quarter: am.quarter, seed, dna, firedIds, weakSpots, count: am.quarter === 1 ? 1 : 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [am.quarter, seed?.value]);

  const resolvedThisQ = new Set(am.decisions.filter((d) => d.quarter === am.quarter).map((d) => d.cardId));
  const allResolved = cards.every((c) => resolvedThisQ.has(c.id));
  const quarterlyCF = Math.round(am.noiCurrent / 4 - est.annualDS / 4);
  const distribution = Math.max(0, quarterlyCF);
  const exitFlag = am.activeFlags.includes('exit-now');

  const projectedNOI = est.noi;
  const noiDelta = am.noiCurrent - projectedNOI;

  return (
    <div className="rounded-xl border-2 border-teal-300 bg-teal-50/30">
      {/* summary band */}
      <div className="flex flex-wrap items-center gap-3 border-b border-teal-200 bg-teal-600 px-4 py-2 text-white">
        <h3 className="text-base font-bold">🏢 Asset Management — Quarter {am.quarter}</h3>
        <span className="ml-auto text-xs">~{Math.round((am.quarter - 1) * 90)} days held</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <Stat label="Occupancy" value={`${(am.occupancy * 100).toFixed(1)}%`} tone={am.occupancy >= 0.9 ? 'good' : am.occupancy >= 0.85 ? 'warn' : 'bad'} />
        <Stat label="NOI (annual)" value={usd(am.noiCurrent, { compact: true })} tone={noiDelta >= 0 ? 'good' : 'bad'} />
        <Stat label="vs. proforma" value={`${noiDelta >= 0 ? '+' : ''}${usd(noiDelta, { compact: true })}`} tone={noiDelta >= 0 ? 'good' : 'bad'} />
        <Stat label="Last distribution" value={am.cashFlowHistory.length ? usd(am.cashFlowHistory[am.cashFlowHistory.length - 1].amount, { compact: true }) : '—'} />
      </div>

      {/* this quarter's cards */}
      <div className="space-y-3 p-3">
        {cards.length === 0 && <p className="text-sm text-slate-500">A quiet quarter — no events. Collect your distribution and move on.</p>}
        {cards.map((card) => (
          <AMCardRunner key={card.id} card={card} resolved={resolvedThisQ.has(card.id)} dealId={deal.id} quarter={am.quarter} applyAMEffect={applyAMEffect} />
        ))}
      </div>

      {/* quarter footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-teal-200 p-3">
        {am.activeFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {am.activeFlags.map((f) => (<span key={f} className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">{f}</span>))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Quarterly distribution: <b className="text-emerald-700">{usd(distribution, { compact: true })}</b></span>
          <button
            disabled={!allResolved}
            onClick={() => advanceAMQuarter(deal.id, distribution)}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {allResolved ? 'Advance a quarter →' : 'Resolve the cards above'}
          </button>
        </div>
      </div>

      {/* exit */}
      <div className={`flex items-center justify-between gap-2 border-t border-teal-200 px-3 py-2 ${exitFlag ? 'bg-amber-50' : ''}`}>
        <span className="text-xs text-slate-600">{exitFlag ? '📨 You have an offer on the table — sell now?' : `Hold and operate, or exit when the numbers are right (Q${am.quarter}, NOI ${usd(am.noiCurrent, { compact: true })}).`}</span>
        <button
          onClick={doExit}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${exitFlag ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}
        >
          Sell / exit →
        </button>
      </div>
    </div>
  );
}

function AMCardRunner({ card, resolved, dealId, quarter, applyAMEffect }: {
  card: AMCard;
  resolved: boolean;
  dealId: string;
  quarter: number;
  applyAMEffect: ReturnType<typeof useApp>['applyAMEffect'];
}) {
  const [result, setResult] = useState<string | null>(resolved ? '(resolved)' : null);

  function pick(opt: AMOption) {
    let eff: AMEffect = opt.effects ?? {};
    let text = opt.result ?? 'Done.';
    if (opt.branches && opt.branches.length) {
      const total = opt.branches.reduce((a, b) => a + b.weight, 0);
      let r = Math.random() * total;
      let chosen = opt.branches[0];
      for (const b of opt.branches) { r -= b.weight; if (r <= 0) { chosen = b; break; } }
      eff = { ...eff, ...chosen.effects };
      text = chosen.result;
    }
    applyAMEffect(dealId, eff, quarter, card.id, opt.id);
    setResult(text);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-600">{card.deck}{card.speaker ? ` · ${card.speaker}` : ''}</div>
      <div className="text-sm font-bold text-slate-900">{card.title}</div>
      <p className="mt-0.5 text-sm text-slate-700">{card.prompt}</p>
      {result == null ? (
        <div className="mt-3 space-y-2">
          {card.options.map((opt) => (
            <button key={opt.id} onClick={() => pick(opt)} className="block w-full rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-slate-900 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                <span className="flex items-center gap-2 text-[11px]">
                  {opt.effects?.cash ? <span className={opt.effects.cash < 0 ? 'text-red-600 tabular-nums' : 'text-emerald-600 tabular-nums'}>{usd(opt.effects.cash, { compact: true })}</span> : null}
                  <span className={`rounded px-1.5 py-0.5 ${opt.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : opt.tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{opt.tone}</span>
                </span>
              </div>
              {opt.detail && <p className="mt-0.5 text-xs text-slate-500">{opt.detail}</p>}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{result === '(resolved)' ? 'Resolved earlier this quarter.' : `✓ ${result}`}</div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
