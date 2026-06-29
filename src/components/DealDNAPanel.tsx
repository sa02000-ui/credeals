'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { dealCounterparties, pct, type MarketDeal } from '@/lib/sim';

function uwLabel(s: number): string {
  return s >= 3.5 ? 'Very aggressive' : s >= 2.8 ? 'Aggressive' : s >= 2.0 ? 'Market' : 'Conservative';
}
function relLabel(n: number): string {
  return n >= 70 ? 'Strong' : n >= 45 ? 'Warm' : 'Cool';
}

/**
 * Deal DNA — a collapsible fingerprint of the decisions accumulated on this deal (UW aggressiveness,
 * broker standing at LOI, PSA discipline, DD depth, raise/plan, closing score, and at exit the
 * projected-vs-actual IRR). The data already drives the player model + calibration review; this just
 * surfaces it so the player can see the shape of how they ran the deal. Game mode only.
 */
export function DealDNAPanel({ deal }: { deal: MarketDeal }) {
  const { mode, difficulty, dealDNA, sessionSeed } = useApp();
  const [open, setOpen] = useState(false);
  if (mode !== 'game' || !difficulty) return null;

  const dna = dealDNA[deal.id];
  const { broker, seller } = dealCounterparties(deal.id, sessionSeed?.value ?? 0);

  // rows are only shown once their value has actually been set during play
  const rows: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }[] = [];
  if (dna) {
    rows.push({ label: 'Underwriting', value: `${uwLabel(dna.uwScore)} · ${dna.uwScore.toFixed(1)}/4`, tone: dna.uwScore >= 3 ? 'warn' : 'good' });
    if (dna.brokerPersonaId) rows.push({ label: 'Broker', value: broker.name });
    if (dna.sellerPersonaId) rows.push({ label: 'Seller', value: seller.name });
    if (dna.brokerRelAtLOI) rows.push({ label: 'Broker standing at LOI', value: `${relLabel(dna.brokerRelAtLOI)} · ${Math.round(dna.brokerRelAtLOI)}` });
    if (dna.psaCatchScore > 0) rows.push({ label: 'PSA traps caught', value: pct(dna.psaCatchScore), tone: dna.psaCatchScore >= 0.6 ? 'good' : 'warn' });
    if (dna.ddDepth) rows.push({ label: 'Due diligence', value: dna.ddDepth, tone: dna.ddDepth === 'light' ? 'warn' : 'good' });
    if (dna.lenderChosen) rows.push({ label: 'Lender', value: dna.lenderChosen });
    if (dna.raiseStructure) rows.push({ label: 'Capital raise', value: dna.raiseStructure });
    if (dna.businessPlan) rows.push({ label: 'Business plan', value: dna.businessPlan });
    if (dna.closingScore > 0) rows.push({ label: 'Closing score', value: `${Math.round(dna.closingScore)}/100`, tone: dna.closingScore >= 80 ? 'good' : 'warn' });
    if (dna.projectedIRR != null) rows.push({ label: 'Projected IRR', value: pct(dna.projectedIRR) });
    if (dna.actualIRR != null) rows.push({ label: 'Actual IRR (at exit)', value: pct(dna.actualIRR), tone: (dna.actualIRR ?? 0) >= (dna.projectedIRR ?? 0) ? 'good' : 'bad' });
    if (dna.terminalOutcome) rows.push({ label: 'Terminal outcome', value: dna.terminalOutcome });
    if (dna.exitShock) rows.push({ label: 'Exit shock', value: `${dna.exitShock}${dna.exitShockDirection ? ` (${dna.exitShockDirection})` : ''}` });
    if (dna.propertyScore != null) rows.push({ label: 'Property score', value: `${Math.round(dna.propertyScore)}/100` });
    if (dna.areaScore != null) rows.push({ label: 'Area score', value: `${Math.round(dna.areaScore)}/100` });
  }

  const toneClass = (t?: string) => (t === 'good' ? 'text-emerald-600' : t === 'warn' ? 'text-amber-600' : t === 'bad' ? 'text-red-600' : 'text-slate-700');

  return (
    <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="text-sm">🧬</span>
        <span className="text-sm font-semibold text-fuchsia-800">Deal DNA</span>
        <span className="text-[11px] text-fuchsia-600">{rows.length > 0 ? `${rows.length} traits recorded` : 'builds as you work the deal'}</span>
        <span className="ml-auto text-fuchsia-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-fuchsia-100 p-3">
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500">No decisions recorded yet. As you underwrite, negotiate the LOI, redline the PSA, close, and operate, this fingerprint fills in — and it feeds your end-of-deal Calibration Review.</p>
          ) : (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-fuchsia-100/70 pb-1">
                  <dt className="text-[11px] text-slate-500">{r.label}</dt>
                  <dd className={`text-xs font-semibold capitalize ${toneClass(r.tone)}`}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
