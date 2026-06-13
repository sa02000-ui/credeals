'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';

const BEHAVIOR_LABEL: Record<string, string> = {
  'off-market-priority': 'Shows you deals before they hit market',
  'shares-reservation-price': "Tips you the seller's floor in negotiations",
  'stopped-sending-deals': 'Stopped sending you deals',
  'exploring-exit-rights': 'Looking into exiting their position',
  'seller-network-referral-eligible': 'May refer their network to you',
};

/** Relationship ledger — per-counterparty score, memory, and unlocked behaviors. Game mode. */
export function RelationshipLedger() {
  const { mode, difficulty, relationships } = useApp();
  const [open, setOpen] = useState(false);
  if (mode !== 'game' || !difficulty) return null;

  const rels = Object.values(relationships).sort((a, b) => b.personalScore - a.personalScore);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Your counterparty relationships"
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        🤝 Relationships{rels.length > 0 && <span className="ml-1 text-slate-400">{rels.length}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold">🤝 Relationships</div>
              <button onClick={() => setOpen(false)} className="ml-auto text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {rels.length === 0 && <p className="text-xs text-slate-400">No relationships yet. They build as you work with brokers, lenders, LPs, and sellers — close clean and they remember; retrade or ghost and they remember that too.</p>}
              {rels.map((r) => (
                <div key={r.personaId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{r.name.slice(0, 1)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{r.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{r.kind}</div>
                    </div>
                    <span className={`ml-auto text-sm font-bold tabular-nums ${r.personalScore >= 70 ? 'text-emerald-600' : r.personalScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(r.personalScore)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${r.personalScore >= 70 ? 'bg-emerald-500' : r.personalScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${r.personalScore}%` }} />
                  </div>
                  {r.unlockedBehaviors.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.unlockedBehaviors.map((b) => (
                        <li key={b} className="text-[11px] text-slate-600">• {BEHAVIOR_LABEL[b] ?? b}</li>
                      ))}
                    </ul>
                  )}
                  {r.interactionLog.length > 0 && (
                    <div className="mt-2 border-t border-slate-100 pt-1.5">
                      {r.interactionLog.slice(-3).reverse().map((i, idx) => (
                        <div key={idx} className="flex items-baseline gap-2 text-[11px]">
                          <span className="shrink-0 rounded bg-slate-100 px-1 text-[9px] tabular-nums text-slate-500">d{i.day}</span>
                          <span className="text-slate-600">{i.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
