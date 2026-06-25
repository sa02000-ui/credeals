'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { buildSensitivityCases, calibrationInsight, computeDualScore, computeExitOutcome, defaultDetailedInputs, pct, usd, type DetailedUWInputs, type MarketDeal } from '@/lib/sim';

interface Scenario { inputs: DetailedUWInputs }

const UW_LABEL = (s: number) => (s < 1.5 ? 'Very Conservative' : s < 2.0 ? 'Conservative' : s < 2.8 ? 'Market' : s < 3.5 ? 'Aggressive' : 'Very Aggressive');

/** E-Exit — the calibration review shown when a deal exits (status → archived) in game mode. */
export function CalibrationReview({ deal }: { deal: MarketDeal }) {
  const { dealDNA, amStates, playerModel, cashBalance, game, setSelectedDeal } = useApp();
  const [scenarios] = useDealLocal<Scenario[]>('uw-scenarios-v2', deal.id, [{ inputs: defaultDetailedInputs(deal) }]);
  const [selectedCaseId, setSelectedCaseId] = useDealLocal<string | null>('debrief-sim-case-v1', deal.id, null);
  const dna = dealDNA[deal.id];
  const am = amStates[deal.id];

  const inputs = useMemo(
    () => scenarios[0]?.inputs ?? defaultDetailedInputs(deal),
    [scenarios, deal],
  );
  const actualNOI = useMemo(
    () =>
      am?.noiCurrent ??
      deal.avgMarketRent * 12 * deal.unitCount * (1 - deal.stabilizedVacancy) -
        deal.expensePerUnit * deal.unitCount,
    [am, deal],
  );

  const out = useMemo(() => {
    return computeExitOutcome(inputs, actualNOI, game.market);
  }, [inputs, actualNOI, game.market]);
  const sensitivity = useMemo(
    () => buildSensitivityCases(inputs, actualNOI, game.market),
    [inputs, actualNOI, game.market],
  );
  const selectedCase = sensitivity.find((c) => c.id === selectedCaseId) ?? null;
  const shown = selectedCase?.outcome ?? out;

  const irrDelta = out.actualIRR - out.projectedIRR;
  const beat = irrDelta >= 0;
  const totalDistributed = (am?.cashFlowHistory ?? []).reduce((a, h) => a + h.amount, 0);
  const insight = calibrationInsight(playerModel);
  const scoreBase = useMemo(
    () =>
      computeDualScore({
        projectedIRR: out.projectedIRR,
        actualIRR: out.actualIRR,
        projectedEM: out.projectedEM,
        actualEM: out.actualEM,
        closeScore: dna?.closingScore ?? 55,
        ddDepth: dna?.ddDepth ?? 'moderate',
        psaCatchScore: dna?.psaCatchScore ?? 0.5,
        reputation: game.reputation,
      }),
    [out, dna?.closingScore, dna?.ddDepth, dna?.psaCatchScore, game.reputation],
  );
  const scoreShown = useMemo(
    () =>
      computeDualScore({
        projectedIRR: shown.projectedIRR,
        actualIRR: shown.actualIRR,
        projectedEM: shown.projectedEM,
        actualEM: shown.actualEM,
        closeScore: dna?.closingScore ?? 55,
        ddDepth: dna?.ddDepth ?? 'moderate',
        psaCatchScore: dna?.psaCatchScore ?? 0.5,
        reputation: game.reputation,
      }),
    [shown, dna?.closingScore, dna?.ddDepth, dna?.psaCatchScore, game.reputation],
  );

  const rayLine = beat
    ? 'You beat your projections. Conservative, well-operated deals are how you earn the next one — LPs remember who delivers.'
    : irrDelta > -0.03
      ? 'Close to plan. The market and your operations roughly matched the model — that\'s a solid, honest outcome.'
      : 'You came in under your projection. Look at where the gap opened — aggressive rent assumptions and skipped diligence are the usual culprits. Underwrite to what\'s real next time.';

  return (
    <div className="rounded-xl border-2 border-slate-300 bg-white">
      <div className={`flex items-center gap-2 px-4 py-3 text-white ${beat ? 'bg-emerald-600' : 'bg-slate-700'}`}>
        <span className="text-2xl">{beat ? '🏁' : '📉'}</span>
        <div>
          <div className="text-base font-bold">Deal closed — Calibration Review</div>
          <div className="text-xs opacity-90">{deal.name} · exited day {dna?.exitDay ?? '—'}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-wide opacity-80">Realized IRR</div>
          <div className="text-lg font-extrabold">{pct(out.actualIRR)}</div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* modeled vs actual */}
        <div>
          <h4 className="mb-1 text-sm font-bold text-slate-800">Modeled vs. realized</h4>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                <th className="px-3 py-1.5 text-left font-medium">Metric</th>
                <th className="px-3 py-1.5 text-right font-medium">Underwrote</th>
                <th className="px-3 py-1.5 text-right font-medium">{selectedCase ? 'Simulated' : 'Realized'}</th>
                <th className="px-3 py-1.5 text-right font-medium">Δ</th>
              </tr></thead>
              <tbody className="tabular-nums">
                <Row label="Levered IRR" a={pct(shown.projectedIRR)} b={pct(shown.actualIRR)} better={shown.actualIRR >= shown.projectedIRR} />
                <Row label="Equity multiple" a={`${shown.projectedEM.toFixed(2)}x`} b={`${shown.actualEM.toFixed(2)}x`} better={shown.actualEM >= shown.projectedEM} />
                <Row label="Exit NOI" a={usd(shown.projectedNOI, { compact: true })} b={usd(shown.actualNOI, { compact: true })} better={shown.actualNOI >= shown.projectedNOI} />
                <Row label="Exit cap" a={pct(shown.projectedExitCap)} b={pct(shown.actualExitCap)} better={shown.actualExitCap <= shown.projectedExitCap} />
                <Row label="Sale price" a={usd(shown.projectedSale, { compact: true })} b={usd(shown.actualSale, { compact: true })} better={shown.actualSale >= shown.projectedSale} />
              </tbody>
            </table>
          </div>
          {selectedCase && (
            <p className="mt-1 text-xs text-indigo-700">
              Alt-path active: <b>{selectedCase.label}</b> — {selectedCase.note}
            </p>
          )}
        </div>

        <div>
          <h4 className="mb-1 text-sm font-bold text-slate-800">Dual scorecard</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ScoreCard
              label="Investment outcome"
              score={scoreShown.investment}
              baseline={scoreBase.investment}
              detail={`IRR ${pct(shown.actualIRR)} · EM ${shown.actualEM.toFixed(2)}x`}
            />
            <ScoreCard
              label="Execution quality"
              score={scoreShown.execution}
              baseline={scoreBase.execution}
              detail={`Close ${dna?.closingScore ?? '—'}/100 · PSA catch ${Math.round((dna?.psaCatchScore ?? 0.5) * 100)}%`}
            />
          </div>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-bold text-slate-800">One-click alternate paths</h4>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCaseId(null)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${selectedCase == null ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
            >
              Baseline
            </button>
            {sensitivity.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`rounded-md border px-2 py-1 text-xs font-medium ${selectedCaseId === c.id ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
                title={c.note}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            These are rapid deterministic probes for "what changed outcome" learning — not a full model rebuild.
          </p>
        </div>

        {/* decisions that mattered */}
        {dna && (
          <div>
            <h4 className="mb-1 text-sm font-bold text-slate-800">Decisions that mattered most</h4>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>• Underwriting was <b>{UW_LABEL(dna.uwScore)}</b> ({dna.uwScore.toFixed(1)}) — {dna.uwScore >= 3 ? 'aggressive assumptions raised the bar your operations had to clear.' : 'a disciplined model you could actually hit.'}</li>
              <li>• Due diligence: <b>{dna.ddDepth}</b>{dna.ddDepth === 'light' ? ' — cheaper up front, but it leaves surprises for the hold.' : ' — you bought with your eyes open.'}</li>
              <li>• PSA review caught <b>{Math.round((dna.psaCatchScore ?? 0) * 100)}%</b> of the traps.</li>
              <li>• Capital raise: <b>{dna.raiseStructure}</b>. Closing quality: <b>{dna.closingScore || '—'}</b>/100.</li>
              {am && <li>• You made <b>{am.decisions.length}</b> asset-management decisions over <b>{am.quarter - 1}</b> quarters.</li>}
            </ul>
          </div>
        )}

        {/* reputation + cash */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1.5 text-xs font-bold text-slate-600">Reputation</div>
            <RepBar label="Broker" v={game.reputation.broker} />
            <RepBar label="Lender" v={game.reputation.lender} />
            <RepBar label="LP" v={game.reputation.lp} />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1.5 text-xs font-bold text-slate-600">Cash</div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Distributions over the hold</span><span className="font-semibold tabular-nums text-emerald-700">{usd(totalDistributed, { compact: true })}</span></div>
            <div className="mt-1 flex justify-between text-sm"><span className="text-slate-500">Cash on hand now</span><span className="font-semibold tabular-nums">{usd(cashBalance)}</span></div>
          </div>
        </div>

        {/* coach */}
        <div className="rounded-lg bg-indigo-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-[10px] text-white">R</span> What Ray would say</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{rayLine}</p>
          {insight && <p className="mt-2 border-t border-indigo-100 pt-2 text-xs text-slate-600">{insight}</p>}
          {playerModel.weakSpots.length > 0 && <p className="mt-1 text-[11px] text-slate-500">Patterns I&apos;m watching: {playerModel.weakSpots.join(', ')}. The next game will lean on these.</p>}
        </div>

        <div className="text-center">
          <button onClick={() => setSelectedDeal(null)} className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">Find your next deal →</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, a, b, better }: { label: string; a: string; b: string; better: boolean }) {
  return (
    <tr className="border-t border-slate-50">
      <td className="px-3 py-1.5 text-left text-slate-700">{label}</td>
      <td className="px-3 py-1.5 text-right text-slate-500">{a}</td>
      <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{b}</td>
      <td className={`px-3 py-1.5 text-right text-xs ${better ? 'text-emerald-600' : 'text-red-600'}`}>{better ? '▲' : '▼'}</td>
    </tr>
  );
}

function ScoreCard({
  label,
  score,
  baseline,
  detail,
}: {
  label: string;
  score: number;
  baseline: number;
  detail: string;
}) {
  const delta = score - baseline;
  const tone = score >= 75 ? 'text-emerald-700' : score >= 55 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{score}</div>
      <div className="text-[11px] text-slate-500">{detail}</div>
      {delta !== 0 && (
        <div className={`mt-1 text-[11px] font-medium ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {delta > 0 ? '+' : ''}{delta} vs baseline
        </div>
      )}
    </div>
  );
}

function RepBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-xs">
      <span className="w-12 text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v}%` }} /></div>
      <span className="w-7 text-right font-semibold tabular-nums text-slate-700">{Math.round(v)}</span>
    </div>
  );
}
