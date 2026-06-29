'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/lib/store';
import { ScenarioRunner } from '@/components/ScenarioRunner';
import {
  personasByKind,
  buildBrokerCall,
  brokerCallOutcome,
  evaluateBrokerAdlib,
  type BrokerAdlibOutcome,
  type ScenarioEffects,
} from '@/lib/sim';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/**
 * "Reach out to brokers" — a simulated phone call (text chat). Picks a broker persona, plays the
 * scripted conversation (broker tests your buy box + equity source, rewards rapport), shows the
 * outcome, and lets you call another broker or finish. Earned off-market/on-market leads are tallied
 * (wired to the deal feed once the deal database lands). Game mode.
 */
export function BrokerCallModal({ onClose }: { onClose: () => void }) {
  const { applyGameOutcome, advanceDays, sessionSeed, game } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const brokers = useMemo(() => personasByKind('broker'), []);
  const [callIdx, setCallIdx] = useState(0);
  const broker = useMemo(() => brokers[hash(`${sessionSeed?.value ?? 1}:${callIdx}`) % brokers.length], [brokers, callIdx, sessionSeed?.value]);
  const scenario = useMemo(
    () => buildBrokerCall(broker, { salt: callIdx, market: game.market }),
    [broker, callIdx, game.market],
  );

  const [outcome, setOutcome] = useState<ReturnType<typeof brokerCallOutcome> | null>(null);
  const [adlibOutcome, setAdlibOutcome] = useState<BrokerAdlibOutcome | null>(null);
  const [adlibLine, setAdlibLine] = useState('');
  const [adlibUsed, setAdlibUsed] = useState(false);
  const [listening, setListening] = useState(false);
  const [leads, setLeads] = useState<{ name: string; lead: string }[]>([]);
  const canDictate =
    mounted &&
    typeof window !== 'undefined' &&
    !!((window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition);

  function onEffects(e: ScenarioEffects) {
    if (e.cash || e.rep) applyGameOutcome({ cashDelta: e.cash, cashLabel: `Broker call — ${broker.name}`, repDelta: e.rep });
    if (e.days) advanceDays(e.days);
  }
  function onComplete(flags: Record<string, boolean>) {
    const o = brokerCallOutcome(flags);
    setOutcome(o);
    if (o.lead === 'off-market' || o.lead === 'on-market' || o.lead === 'shortlist') {
      setLeads((l) => [...l, { name: broker.name, lead: o.lead }]);
    }
  }

  function submitAdlib() {
    const o = evaluateBrokerAdlib(adlibLine, broker, game.market, game.reputation.broker);
    setAdlibOutcome(o);
    setAdlibUsed(true);
    applyGameOutcome({
      repDelta: { broker: o.repBrokerDelta },
      event: {
        title: `Ad-lib broker line — ${broker.name}`,
        detail: o.brokerReply,
        lesson: o.lesson,
      },
    });
    if (o.lead === 'off-market' || o.lead === 'on-market' || o.lead === 'shortlist') {
      setLeads((l) => [...l, { name: broker.name, lead: o.lead }]);
    }
  }

  function dictate() {
    if (!canDictate || listening) return;
    const Ctor =
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const t = event.results?.[0]?.[0]?.transcript ?? '';
      if (t) setAdlibLine((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function callAnother() {
    setOutcome(null);
    setAdlibOutcome(null);
    setAdlibLine('');
    setAdlibUsed(false);
    setCallIdx((i) => i + 1);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid justify-center overflow-y-auto bg-black/60 p-4 py-8" onClick={onClose}>
      <div className="w-full max-w-lg self-start" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2 text-white">
          <div className="text-xl font-bold">📞 Reaching out to brokers</div>
          <button onClick={onClose} className="ml-auto rounded-md bg-white/15 px-2 py-1 text-sm hover:bg-white/25">Done hunting ✕</button>
        </div>

        {leads.length > 0 && (
          <div className="mb-3 rounded-lg bg-emerald-500/90 p-2.5 text-xs text-white">
            Leads so far: {leads.map((l, i) => <span key={i} className="mr-2 font-semibold">{l.name} ({l.lead})</span>)}
          </div>
        )}

        {!outcome ? (
          <div className="rounded-2xl bg-white p-1 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-sm font-bold text-white">{broker.name.slice(0, 1)}</span>
              <div>
                <div className="text-sm font-bold text-slate-900">{broker.name}</div>
                <div className="text-[11px] text-slate-500">{broker.blurb}</div>
              </div>
              <span className="ml-auto text-[10px] font-semibold text-emerald-600">● on the line</span>
            </div>
            <div className="p-2">
              <ScenarioRunner key={scenario.id} scenario={scenario} onEffects={onEffects} onComplete={onComplete} />
            </div>
            <div className="mx-3 mb-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Dynamic line (type or voice)</div>
              <p className="mt-0.5 text-xs text-slate-600">Say your own line to the broker and get a dynamic response. This stacks with scenario choices.</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={adlibLine}
                  onChange={(e) => setAdlibLine(e.target.value)}
                  disabled={adlibUsed}
                  placeholder="e.g., Value-add MF in DFW, 80-220 units, proof of funds ready, can close fast."
                  className="flex-1 rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-violet-500 focus:outline-none disabled:bg-slate-100"
                />
                {canDictate && (
                  <button
                    onClick={dictate}
                    disabled={adlibUsed || listening}
                    className="rounded-md border border-violet-300 bg-white px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {listening ? '🎙️…' : '🎙️ Mic'}
                  </button>
                )}
                <button
                  onClick={submitAdlib}
                  disabled={adlibUsed || !adlibLine.trim()}
                  className="rounded-md bg-violet-600 px-2 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Send line
                </button>
              </div>
              {adlibOutcome && (
                <div className="mt-2 rounded-md border border-violet-200 bg-white p-2 text-xs">
                  <div className="font-semibold text-slate-800">{adlibOutcome.headline}</div>
                  <div className="mt-0.5 text-slate-600">{adlibOutcome.brokerReply}</div>
                </div>
              )}
            </div>
            <p className="px-4 pb-2 text-[11px] text-slate-400">💡 {broker.tells[0]}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-2xl">
            <div className="text-base font-bold text-slate-900">{outcome.headline}</div>
            <p className="mt-2 rounded-lg bg-indigo-50 p-3 text-sm leading-relaxed text-slate-700">💡 {outcome.lesson}</p>
            {outcome.lead === 'off-market' && (
              <p className="mt-2 text-xs text-emerald-700">A first-look deal from {broker.name} will land in your feed. (Deal database wiring in progress — for now this counts as a warm lead.)</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={callAnother} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">📞 Call another broker</button>
              <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Done — back to the deal feed</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
