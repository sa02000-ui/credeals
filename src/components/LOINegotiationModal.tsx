'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { negotiateLOI, usd, type LOITerms, type NegResult, type Persona } from '@/lib/sim';

/**
 * Live LOI negotiation (game mode). Day-paced, not real-time: each round you send terms, a few days
 * pass while the broker relays it, and the seller responds — counter / accept / reject. Holding your
 * line is a legitimate play (if your price is at or above their reservation and your terms are clean,
 * a disciplined hold can win). Competing-buyer pressure rises with the market and with rounds dragging
 * on — not with a stopwatch — so you can think without being punished for it.
 */
export function LOINegotiationModal({
  dealName,
  askPrice,
  seller,
  initialTerms,
  onAccepted,
  onLost,
  onClose,
}: {
  dealName: string;
  askPrice: number;
  seller: Persona;
  initialTerms: LOITerms;
  onAccepted: (terms: LOITerms) => void;
  onLost: () => void;
  onClose: () => void;
}) {
  const { game, advanceDays, day } = useApp();
  const [terms, setTerms] = useState<LOITerms>(initialTerms);
  const [round, setRound] = useState(1);
  const [cp, setCp] = useState(0);
  const [result, setResult] = useState<NegResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isCounter = result?.outcome === 'counter';

  function send(currentTerms: LOITerms) {
    setSubmitting(true);
    advanceDays(2); // the broker relays your terms; the seller responds a few days later
    // Responsiveness is no longer a stopwatch — staying prompt over the deal's life is the default;
    // it only erodes slightly if the back-and-forth drags across many rounds.
    const responsiveness = Math.max(0.5, 1 - 0.1 * (round - 1));
    const r = negotiateLOI({ terms: currentTerms, askPrice, seller, market: game.market, brokerRep: game.reputation.broker, responsiveness, round, competingPressure: cp });
    setCp(r.competingPressure);
    setResult(r);
    setSubmitting(false);
    if (r.outcome === 'accepted') return onAccepted(currentTerms);
    if (r.outcome === 'lost') return onLost();
    setRound((n) => n + 1); // counter or rejected — you can revise and resend
  }

  function acceptCounter() {
    if (result?.counter) {
      setTerms(result.counter);
      onAccepted(result.counter);
    }
  }

  const set = (patch: Partial<LOITerms>) => setTerms((s) => ({ ...s, ...patch }));
  const emdPctNum = +(terms.emdPct * 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">🎭 Negotiating — {dealName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mt-0.5 text-xs text-slate-600">
          Seller: <b>{seller.name}</b> — {seller.blurb} <span className="text-violet-700">💡 {seller.tells[0]}</span>
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">📅 Day {day} · Round {round} {round > 1 && '· the back-and-forth takes a few days each pass'}</p>

        {/* competing-buyer pressure (rises with hot market + rounds dragging, not a stopwatch) */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500"><span>Competing-buyer interest</span><span>{Math.round(cp * 100)}%</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${cp > 0.66 ? 'bg-red-500' : cp > 0.33 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${cp * 100}%` }} /></div>
        </div>

        {/* term editor */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 text-sm">
          <Field label="Offer price">
            <input type="number" value={terms.price} step={50_000} onChange={(e) => set({ price: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" />
            <div className="text-[10px] text-slate-400">ask {usd(askPrice, { compact: true })} · {(((askPrice - terms.price) / askPrice) * 100).toFixed(1)}% off</div>
          </Field>
          <Field label="Earnest money %">
            <input type="number" value={emdPctNum} step={0.25} onChange={(e) => set({ emdPct: Number(e.target.value) / 100 })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" />
          </Field>
          <Field label="Due-diligence days">
            <input type="number" value={terms.ddDays} onChange={(e) => set({ ddDays: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" />
          </Field>
          <Field label="Closing days">
            <input type="number" value={terms.closeDays} onChange={(e) => set({ closeDays: Number(e.target.value) })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:outline-none" />
          </Field>
          <label className="col-span-2 mt-1 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={terms.financingContingency} onChange={(e) => set({ financingContingency: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Keep a financing contingency (safer for you, weaker offer)
          </label>
        </div>

        {/* result — framed as the seller's response a few days later */}
        {result && (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${result.outcome === 'accepted' ? 'border-emerald-200 bg-emerald-50' : result.outcome === 'lost' || result.outcome === 'rejected' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">A few days later, the broker calls back</div>
            <div className="mt-0.5 font-semibold">{result.message}</div>
            <div className="mt-1 text-xs text-slate-600">💡 {result.lesson}</div>
          </div>
        )}

        {/* actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {!isCounter && (
            <button onClick={() => send(terms)} disabled={submitting} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              {round === 1 ? 'Send the LOI →' : 'Send revised offer →'}
            </button>
          )}
          {isCounter && result?.counter && (
            <>
              <button onClick={acceptCounter} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Accept their counter</button>
              <button onClick={() => send(terms)} className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">Hold / counter back with your terms</button>
              <button onClick={onLost} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Walk away</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
