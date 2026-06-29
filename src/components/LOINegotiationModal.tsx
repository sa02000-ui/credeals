'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { negotiateLOI, usd, type LOITerms, type NegResult, type Persona } from '@/lib/sim';

/**
 * Live LOI negotiation (game mode). Day-paced, not real-time: each round you send terms, a few days
 * pass while the broker relays it, and the seller responds — counter / accept / reject — as a running
 * chat thread. The full term set is negotiable (price, earnest money + whether it goes hard, due
 * diligence, close, financing contingency, title). Holding your line is a legitimate play; competing-
 * buyer pressure rises with the market and with rounds dragging on, not with a stopwatch.
 */
type Msg = { role: 'you' | 'seller'; text: string; tone: 'neutral' | 'good' | 'bad' };
type Approach = 'assertive' | 'balanced' | 'collaborative';

function termSummary(t: LOITerms, askPrice: number): string {
  const off = (((askPrice - t.price) / askPrice) * 100).toFixed(1);
  return [
    `${usd(t.price, { compact: true })} (${off}% off ask)`,
    `EMD ${(t.emdPct * 100).toFixed(1)}%${t.nonRefundableEmd ? ' hard at PSA' : ''}`,
    `DD ${t.ddDays}d`,
    `close ${t.closeDays}d`,
    t.financingContingency ? 'financing contingency' : 'no financing contingency',
    `title: ${t.titlePayer ?? 'seller'}`,
  ].join(' · ');
}

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
  const { game, applyGameOutcome, advanceDays, day } = useApp();
  const [terms, setTerms] = useState<LOITerms>({ nonRefundableEmd: false, titlePayer: 'seller', ...initialTerms });
  const [round, setRound] = useState(1);
  const [cp, setCp] = useState(0);
  const [result, setResult] = useState<NegResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [thread, setThread] = useState<Msg[]>([]);
  const [approach, setApproach] = useState<Approach>('balanced');
  const [note, setNote] = useState('');

  const isCounter = result?.outcome === 'counter';

  function send(currentTerms: LOITerms) {
    setSubmitting(true);
    const approachLine =
      approach === 'assertive'
        ? 'assertive stance'
        : approach === 'collaborative'
          ? 'collaborative stance'
          : 'balanced stance';
    const youMsg: Msg = {
      role: 'you',
      text: `${termSummary(currentTerms, askPrice)} · ${approachLine}${note.trim() ? ` · note: "${note.trim()}"` : ''}`,
      tone: 'neutral',
    };
    advanceDays(2); // the broker relays your terms; the seller responds a few days later
    let responsiveness = Math.max(0.5, 1 - 0.1 * (round - 1));
    if (approach === 'collaborative') responsiveness += 0.1;
    if (approach === 'assertive') responsiveness -= 0.05;
    if (/certainty|close|proof|funded|timeline/i.test(note)) responsiveness += 0.08;
    if (/cheap|discount|urgent low|take it or leave it/i.test(note)) responsiveness -= 0.1;
    responsiveness = Math.max(0.35, Math.min(1, responsiveness));
    const r = negotiateLOI({ terms: currentTerms, askPrice, seller, market: game.market, brokerRep: game.reputation.broker, responsiveness, round, competingPressure: cp });
    const repDelta =
      approach === 'collaborative' ? 1 : approach === 'assertive' ? -1 : 0;
    if (repDelta !== 0) applyGameOutcome({ repDelta: { broker: repDelta } });
    setCp(r.competingPressure);
    setResult(r);
    const tone = r.outcome === 'accepted' ? 'good' : r.outcome === 'counter' ? 'neutral' : 'bad';
    setThread((h) => [...h, youMsg, { role: 'seller', text: r.message, tone }]);
    setSubmitting(false);
    if (r.outcome === 'accepted') return onAccepted(currentTerms);
    if (r.outcome === 'lost') return onLost();
    setRound((n) => n + 1); // counter or rejected — you can revise and resend
  }

  function acceptCounter() {
    if (result?.counter) {
      setThread((h) => [...h, { role: 'you', text: `Accepted the counter — ${termSummary(result.counter!, askPrice)}`, tone: 'good' }]);
      setTerms(result.counter);
      onAccepted(result.counter);
    }
  }

  const set = (patch: Partial<LOITerms>) => setTerms((s) => ({ ...s, ...patch }));
  const emdPctNum = +(terms.emdPct * 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">🎭 Negotiating — {dealName}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mt-0.5 text-xs text-slate-600">
          Seller: <b>{seller.name}</b> — {seller.blurb} <span className="text-violet-700">💡 {seller.tells[0]}</span>
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">📅 Day {day} · Round {round} {round > 1 && '· each pass takes a few days'}</p>

        {/* competing-buyer pressure */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500"><span>Competing-buyer interest</span><span>{Math.round(cp * 100)}%</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${cp > 0.66 ? 'bg-red-500' : cp > 0.33 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${cp * 100}%` }} /></div>
        </div>

        {/* chat thread */}
        {thread.length > 0 && (
          <div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            {thread.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                  m.role === 'you'
                    ? 'rounded-br-sm bg-violet-600 text-white'
                    : m.tone === 'good' ? 'rounded-bl-sm bg-emerald-100 text-emerald-900' : m.tone === 'bad' ? 'rounded-bl-sm bg-red-100 text-red-900' : 'rounded-bl-sm bg-white text-slate-700 ring-1 ring-slate-200'
                }`}>
                  <div className="text-[9px] font-semibold uppercase tracking-wide opacity-60">{m.role === 'you' ? 'You offered' : seller.name}</div>
                  {m.text}
                </div>
              </div>
            ))}
            {result && (isCounter || result.outcome === 'counter') && <div className="text-center text-[10px] text-slate-400">💡 {result.lesson}</div>}
          </div>
        )}

        {/* term editor */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 text-sm">
          <Field label="Negotiation approach">
            <select
              value={approach}
              onChange={(e) => setApproach(e.target.value as Approach)}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none"
            >
              <option value="balanced">Balanced</option>
              <option value="collaborative">Collaborative</option>
              <option value="assertive">Assertive</option>
            </select>
          </Field>
          <Field label="Message to seller/broker (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Proof of funds ready, clean timeline, can wire EMD immediately."
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none"
            />
          </Field>
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
          <Field label="Title insurance paid by">
            <select value={terms.titlePayer ?? 'seller'} onChange={(e) => set({ titlePayer: e.target.value as LOITerms['titlePayer'] })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none">
              <option value="seller">Seller</option>
              <option value="buyer">Buyer</option>
              <option value="split">Split</option>
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-1 text-xs text-slate-600">
            <input type="checkbox" checked={!!terms.nonRefundableEmd} onChange={(e) => set({ nonRefundableEmd: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            EMD non-refundable at PSA
          </label>
          <label className="col-span-2 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={terms.financingContingency} onChange={(e) => set({ financingContingency: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Keep a financing contingency (safer for you, weaker offer)
          </label>
        </div>

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
              <button onClick={() => send(terms)} className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">Hold / counter back</button>
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
