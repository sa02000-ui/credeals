'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ASSET_CLASS_FACTS, scaleLabel, type AssetClassFacts } from '@/lib/learn/assetClassFacts';
import { ASSET_CLASSES, type AssetClass } from '@/lib/sim';

type ScaleKind = 'risk' | 'competition' | 'turnover' | 'mgmt';

/** 1–5 as colored dots + a plain-English word. */
function Scale({ n, kind }: { n: number | null; kind: ScaleKind }) {
  if (n == null) return <span className="text-[11px] text-slate-400">n/a</span>;
  const tone = kind === 'risk' ? (n >= 4 ? 'bg-red-500' : n === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-indigo-500';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= n ? tone : 'bg-slate-200'}`} />
        ))}
      </span>
      <span className="text-[11px] font-medium text-slate-600">{scaleLabel(n, kind)}</span>
    </span>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-[11px] font-medium text-slate-700">{children}</span>
    </div>
  );
}

/** The detail card for one asset class — used inside the hover popover. */
export function AssetFactCard({ f }: { f: AssetClassFacts }) {
  return (
    <div className="w-72">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">{f.label}</span>
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{f.targetReturn}<span className="font-normal"> target</span></span>
      </div>
      <div className="mt-2">
        <FactRow label="Risk"><Scale n={f.risk} kind="risk" /></FactRow>
        <FactRow label="Acquisition competition"><Scale n={f.competition} kind="competition" /></FactRow>
        <FactRow label="Tenant turnover"><Scale n={f.turnover} kind="turnover" /></FactRow>
        <FactRow label="Management"><Scale n={f.mgmt} kind="mgmt" /></FactRow>
        <FactRow label="Lease length">{f.leaseLength}</FactRow>
        <FactRow label="Rent escalation">{f.escalation}</FactRow>
        <FactRow label="Typical hold">{f.hold}</FactRow>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{f.summary}</p>
    </div>
  );
}

/**
 * Wraps an asset-class control; on hover (or focus/tap) it shows the fact card in a popover — so
 * players see what they're picking without clicking to expand. Falls back to a "coming soon" note
 * for classes we don't have facts for yet.
 */
export function AssetClassHover({ id, children }: { id: AssetClass; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const f = ASSET_CLASS_FACTS[id];
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
          {f ? <AssetFactCard f={f} /> : <span className="block w-48 text-[11px] text-slate-500">{ASSET_CLASSES.find((a) => a.id === id)?.label ?? id}: details coming soon.</span>}
        </span>
      )}
    </span>
  );
}

const COMPARE_ORDER: AssetClass[] = ['multifamily', 'storage', 'retail-nnn', 'mobile-home-park', 'rv-park', 'land-development'];

/** Button + modal: a side-by-side comparison table across asset classes. */
export function CompareAssetClassesButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rows = COMPARE_ORDER.map((id) => ({ id, f: ASSET_CLASS_FACTS[id] })).filter((r) => r.f) as { id: AssetClass; f: AssetClassFacts }[];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-sky-400 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
      >
        ⚖️ Compare asset classes
      </button>
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">⚖️ Compare asset classes</h3>
              <button onClick={() => setOpen(false)} className="ml-auto text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Asset class</th>
                    <th className="py-2 pr-3 font-semibold">Target return</th>
                    <th className="py-2 pr-3 font-semibold">Risk</th>
                    <th className="py-2 pr-3 font-semibold">Competition</th>
                    <th className="py-2 pr-3 font-semibold">Turnover</th>
                    <th className="py-2 pr-3 font-semibold">Mgmt</th>
                    <th className="py-2 pr-3 font-semibold">Lease</th>
                    <th className="py-2 font-semibold">Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ id, f }) => (
                    <tr key={id} className="border-b border-slate-100 align-top">
                      <td className="py-2.5 pr-3 font-bold text-slate-800">{f.label}</td>
                      <td className="py-2.5 pr-3 font-bold text-emerald-700">{f.targetReturn}</td>
                      <td className="py-2.5 pr-3"><Scale n={f.risk} kind="risk" /></td>
                      <td className="py-2.5 pr-3"><Scale n={f.competition} kind="competition" /></td>
                      <td className="py-2.5 pr-3"><Scale n={f.turnover} kind="turnover" /></td>
                      <td className="py-2.5 pr-3"><Scale n={f.mgmt} kind="mgmt" /></td>
                      <td className="py-2.5 pr-3 text-slate-600">{f.leaseLength}</td>
                      <td className="py-2.5 text-slate-600">{f.hold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Returns are annualized targets and vary with the deal, market, and your business plan. Higher return generally
              comes with higher risk or more hands-on management — discipline in your buy box is how you pick your spots.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
