'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { calibrationInsight, computeExitOutcome, defaultDetailedInputs, pct, usd, type DetailedUWInputs, type MarketDeal } from '@/lib/sim';

interface Scenario { inputs: DetailedUWInputs }

const UW_LABEL = (s: number) => (s < 1.5 ? 'Very Conservative' : s < 2.0 ? 'Conservative' : s < 2.8 ? 'Market' : s < 3.5 ? 'Aggressive' : 'Very Aggressive');

/** E-Exit — the calibration review shown when a deal exits (status → archived) in game mode. */
export function CalibrationReview({ deal }: { deal: MarketDeal }) {
  const { dealDNA, amStates, playerModel, cashBalance, game, setSelectedDeal } = useApp();
  const [scenarios] = useDealLocal<Scenario[]>('uw-scenarios-v2', deal.id, [{ inputs: defaultDetailedInputs(deal) }]);
  const dna = dealDNA[deal.id];
  const am = amStates[deal.id];

  const out = useMemo(() => {
    const inputs = scenarios[0]?.inputs ?? defaultDetailedInputs(deal);
    const actualNOI = am?.noiCurrent ?? deal.avgMarketRent * 12 * deal.unitCount * (1 - deal.stabilizedVacancy) - deal.expensePerUnit * deal.unitCount;
    return computeExitOutcome(inputs, actualNOI, game.market);
  }, [scenarios, am, deal, game.market]);

  const irrDelta = out.actualIRR - out.projectedIRR;
  const beat = irrDelta >= 0;
  const totalDistributed = (am?.cashFlowHistory ?? []).reduce((a, h) => a + h.amount, 0);
  const insight = calibrationInsight(playerModel);

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
                <th className="px-3 py-1.5 text-right font-medium">Realized</th>
                <th className="px-3 py-1.5 text-right font-medium">Δ</th>
              </tr></thead>
              <tbody className="tabular-nums">
                <Row label="Levered IRR" a={pct(out.projectedIRR)} b={pct(out.actualIRR)} better={beat} />
                <Row label="Equity multiple" a={`${out.projectedEM.toFixed(2)}x`} b={`${out.actualEM.toFixed(2)}x`} better={out.actualEM >= out.projectedEM} />
                <Row label="Exit NOI" a={usd(out.projectedNOI, { compact: true })} b={usd(out.actualNOI, { compact: true })} better={out.actualNOI >= out.projectedNOI} />
                <Row label="Exit cap" a={pct(out.projectedExitCap)} b={pct(out.actualExitCap)} better={out.actualExitCap <= out.projectedExitCap} />
                <Row label="Sale price" a={usd(out.projectedSale, { compact: true })} b={usd(out.actualSale, { compact: true })} better={out.actualSale >= out.projectedSale} />
              </tbody>
            </table>
          </div>
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

function RepBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-xs">
      <span className="w-12 text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v}%` }} /></div>
      <span className="w-7 text-right font-semibold tabular-nums text-slate-700">{Math.round(v)}</span>
    </div>
  );
}
