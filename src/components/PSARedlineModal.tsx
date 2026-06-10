'use client';

import { useMemo, useState } from 'react';
import type { PSAClause } from '@/lib/sim';

/**
 * E2 — PSA "catch the trap". The player flags the clauses they think hurt them; on submit we reveal
 * which were sneaky. Caught traps are negotiated out; missed traps become latent risks (passed back).
 */
export function PSARedlineModal({
  dealName,
  clauses,
  onDone,
  onClose,
}: {
  dealName: string;
  clauses: PSAClause[];
  onDone: (caughtIds: string[], missedIds: string[]) => void;
  onClose: () => void;
}) {
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => setFlagged((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const { sneakyTotal, caught, missed, falsePos } = useMemo(() => {
    const sneaky = clauses.filter((c) => c.sneaky);
    const caughtIds = sneaky.filter((c) => flagged.has(c.id)).map((c) => c.id);
    const missedIds = sneaky.filter((c) => !flagged.has(c.id)).map((c) => c.id);
    const fp = clauses.filter((c) => !c.sneaky && flagged.has(c.id)).length;
    return { sneakyTotal: sneaky.length, caught: caughtIds, missed: missedIds, falsePos: fp };
  }, [clauses, flagged]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4">
          <h3 className="text-lg font-bold text-slate-900">📜 Review the PSA — {dealName}</h3>
          <p className="mt-0.5 text-xs text-slate-600">{submitted ? 'Here’s what the seller’s counsel slipped in.' : 'The seller’s counsel sent the contract. Flag every clause that hurts you — some are traps, some are standard.'}</p>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {clauses.map((c) => {
            const isFlagged = flagged.has(c.id);
            const reveal = submitted;
            const correct = reveal && ((c.sneaky && isFlagged) || (!c.sneaky && !isFlagged));
            const wrong = reveal && !correct;
            return (
              <div key={c.id} className={`rounded-lg border p-3 ${!reveal ? (isFlagged ? 'border-amber-300 bg-amber-50' : 'border-slate-200') : correct ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.title}</div>
                    <p className="mt-0.5 text-sm text-slate-700">{c.text}</p>
                    {reveal && (
                      <p className={`mt-1.5 text-xs ${c.sneaky ? 'text-red-700' : 'text-emerald-700'}`}>
                        {c.sneaky ? '⚠ Trap: ' : '✓ Standard: '}{c.explain}
                      </p>
                    )}
                  </div>
                  {!reveal ? (
                    <button onClick={() => toggle(c.id)} className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${isFlagged ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                      {isFlagged ? '🚩 Flagged' : 'Flag'}
                    </button>
                  ) : (
                    <span className={`shrink-0 text-lg ${correct ? 'text-emerald-600' : 'text-red-600'}`}>{correct ? '✓' : '✕'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 p-4">
          {!submitted ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{flagged.size} flagged</span>
              <button onClick={() => setSubmitted(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Submit redline</button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold text-emerald-700">Caught {caught.length}/{sneakyTotal} traps</span>
                {missed.length > 0 && <span className="ml-2 text-red-600">· {missed.length} missed (latent risk)</span>}
                {falsePos > 0 && <span className="ml-2 text-slate-400">· {falsePos} over-flagged</span>}
              </div>
              <button onClick={() => onDone(caught, missed)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Sign &amp; start the close →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
