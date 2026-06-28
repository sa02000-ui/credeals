'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { InfoTip } from '@/components/InfoTip';
import type { DealFile, DealFileKind, MarketDeal } from '@/lib/sim';

const KINDS: DealFileKind[] = ['OM', 'CoStar', 'T12', 'RentRoll', 'LOI', 'PSA', 'Other'];
const KIND_LABEL: Record<DealFileKind, string> = {
  OM: 'Offering Memorandum',
  CoStar: 'CoStar / market reports',
  T12: 'T-12 (trailing financials)',
  RentRoll: 'Rent roll',
  LOI: 'Letters of Intent',
  PSA: 'Purchase & Sale Agreement',
  Other: 'Other documents',
};
const PHASE_LABEL: Record<string, string> = {
  napkin: 'Napkin UW', detailed: 'Detailed UW', loi: 'LOI', c2c: 'Contract-to-Close', am: 'Asset Mgmt',
};
const KIND_BADGE: Record<DealFileKind, string> = {
  T12: 'bg-indigo-100 text-indigo-700',
  RentRoll: 'bg-violet-100 text-violet-700',
  OM: 'bg-amber-100 text-amber-700',
  CoStar: 'bg-sky-100 text-sky-700',
  PSA: 'bg-emerald-100 text-emerald-700',
  LOI: 'bg-rose-100 text-rose-700',
  Other: 'bg-slate-100 text-slate-600',
};

export function DocumentsPanel({ deal }: { deal: MarketDeal }) {
  const { filesOf, addFiles } = useApp();
  const files = filesOf(deal.id);
  const [kind, setKind] = useState<DealFileKind>('OM');

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    addFiles(deal.id, picked.map((file) => ({ id: `${deal.id}-${file.name}-${Date.now()}`, name: file.name, kind, sizeBytes: file.size, ts: Date.now() })));
    e.target.value = '';
  }

  const byKind = (k: DealFileKind) => files.filter((f) => f.kind === k);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">📁 Deal Documents</h2>
          <InfoTip title="Deal Documents" what="Every file for this deal in one place — the OM, market reports, T-12 and rent roll, the LOI and signed PSA, and anything else — instead of a scattered folder per deal." app="Upload here or from any phase (napkin Files, C2C PSA, LOI executed). They all collect into this central repository." />
        </div>
        <p className="mt-1 text-sm text-slate-600">All files for {deal.name}, organized — your one-stop drive for this deal.</p>
      </div>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 p-4">
        <span className="text-xs font-medium text-slate-600">Add a document:</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as DealFileKind)} className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none">
          {KINDS.map((k) => (<option key={k} value={k}>{KIND_LABEL[k]}</option>))}
        </select>
        <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
          + Upload file(s)
          <input type="file" multiple className="hidden" onChange={onPick} />
        </label>
        <span className="ml-auto text-xs text-slate-400">{files.length} file{files.length === 1 ? '' : 's'} total</span>
      </div>

      {/* Grouped list */}
      <div className="divide-y divide-slate-100">
        {files.length === 0 && <p className="p-4 text-sm text-slate-400">No documents yet. Upload the OM, T-12, rent roll, LOI, PSA, etc.</p>}
        {KINDS.map((k) => {
          const list = byKind(k);
          if (list.length === 0) return null;
          return (
            <div key={k} className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND_BADGE[k]}`}>{k}</span>
                <span className="text-sm font-semibold text-slate-700">{KIND_LABEL[k]}</span>
                <span className="text-xs text-slate-400">({list.length})</span>
              </div>
              <ul className="space-y-1">
                {list.map((f: DealFile) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-1.5 text-sm">
                    <span className="truncate text-slate-700">{f.name}</span>
                    {f.taskLabel ? (
                      <span className="shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-medium text-teal-700" title={`Attached to a task${f.phase ? ` in ${PHASE_LABEL[f.phase] ?? f.phase}` : ''}`}>🔗 {f.taskLabel}</span>
                    ) : f.phase ? (
                      <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700">{PHASE_LABEL[f.phase] ?? f.phase}</span>
                    ) : (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-400" title="Not tied to a step or task">standalone</span>
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">{Math.max(1, Math.round(f.sizeBytes / 1024))} KB · {new Date(f.ts).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="border-t border-slate-100 p-3 text-[11px] text-slate-400">Each file shows whether it&apos;s tied to a <span className="text-teal-700">task</span>, a <span className="text-indigo-700">step</span>, or is standalone. Documents attached from a step or AM task land here automatically. Cloud storage with preview &amp; download (Supabase Storage) wires in with AI parsing.</p>
    </section>
  );
}
