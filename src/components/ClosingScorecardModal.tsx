'use client';

import { pct, type ClosingResult } from '@/lib/sim';

interface Returns { leveredIRR: number; equityMultiple: number; avgCashOnCash: number }

/**
 * E4 — closing resolution + deal scorecard. Success enters Asset Management; a stumble offers a
 * recovery branch. Shows projected vs. locked returns + decision grades + the lesson.
 */
export function ClosingScorecardModal({
  dealName,
  result,
  projected,
  actual,
  onEnterAM,
  onRecover,
  onClose,
}: {
  dealName: string;
  result: ClosingResult;
  projected: Returns;
  actual: Returns;
  onEnterAM: () => void;
  onRecover: () => void;
  onClose: () => void;
}) {
  const confetti = ['🎉', '🎊', '✨', '🥂', '🔑', '🏢', '📈', '💰'];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {result.success && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confetti.concat(confetti).map((c, i) => (
              <span key={i} className="absolute animate-bounce text-xl" style={{ left: `${(i * 6.5) % 100}%`, top: `${(i % 4) * 18}%`, animationDelay: `${(i % 6) * 0.12}s`, animationDuration: '1.6s' }}>{c}</span>
            ))}
          </div>
        )}
        <div className="relative">
          <div className="text-center">
            <div className="text-4xl">{result.success ? '🎉' : '😬'}</div>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{result.message}</h3>
            <p className="text-xs text-slate-500">{dealName} · close score {result.closeScore}/100</p>
          </div>

          {/* projected vs actual */}
          {result.success && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                  <th className="px-3 py-1.5 text-left font-medium">Return</th>
                  <th className="px-3 py-1.5 text-right font-medium">Projected</th>
                  <th className="px-3 py-1.5 text-right font-medium">Locked at close</th>
                </tr></thead>
                <tbody className="tabular-nums">
                  <ScoreRow label="Levered IRR" a={pct(projected.leveredIRR)} b={pct(actual.leveredIRR)} />
                  <ScoreRow label="Equity multiple" a={`${projected.equityMultiple.toFixed(2)}x`} b={`${actual.equityMultiple.toFixed(2)}x`} />
                  <ScoreRow label="Avg cash-on-cash" a={pct(projected.avgCashOnCash)} b={pct(actual.avgCashOnCash)} />
                </tbody>
              </table>
            </div>
          )}

          {/* grades */}
          <div className="mt-4 space-y-1.5">
            {result.grades.map((g) => (
              <div key={g.label} className="flex items-center gap-2 text-sm">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${g.grade === 'A' ? 'bg-emerald-100 text-emerald-700' : g.grade === 'B' ? 'bg-sky-100 text-sky-700' : g.grade === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{g.grade}</span>
                <span className="font-medium text-slate-700">{g.label}</span>
                <span className="ml-auto text-xs text-slate-500">{g.note}</span>
              </div>
            ))}
          </div>

          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">💡 {result.lesson}</p>

          <div className="mt-4 flex gap-2">
            {result.success ? (
              <button onClick={onEnterAM} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Enter Asset Management →</button>
            ) : (
              <>
                <button onClick={onClose} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Back</button>
                <button onClick={onRecover} className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">{result.recovery ?? 'Try a recovery'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-t border-slate-50">
      <td className="px-3 py-1.5 text-left text-slate-700">{label}</td>
      <td className="px-3 py-1.5 text-right text-slate-500">{a}</td>
      <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{b}</td>
    </tr>
  );
}
