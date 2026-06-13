'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { answerCoachQuestion } from '@/lib/sim';

/**
 * Ray Mendez — the in-game coach (design doc). A slide-in chat panel + floating button. Proactive
 * nudges arrive via the store's coachMessages (pushed by the lifecycle); the player can also ask
 * questions, answered from the shared glossary knowledge base. Game mode only.
 */
export function CoachPanel() {
  const { mode, difficulty, coachingMode, coachMessages, addCoachMessage } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  const unread = Math.max(0, coachMessages.length - seen);
  useEffect(() => {
    if (open) {
      setSeen(coachMessages.length);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, coachMessages.length]);

  if (mode !== 'game' || !difficulty) return null;

  function ask() {
    const q = text.trim();
    if (!q) return;
    addCoachMessage({ from: 'player', text: q });
    const a = answerCoachQuestion(q);
    setText('');
    // small delay so it reads like a reply
    setTimeout(() => addCoachMessage({ from: 'coach', text: a }), 200);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-xl hover:bg-indigo-50 ${unread > 0 ? 'animate-pulse border-amber-400 ring-2 ring-amber-300' : 'border-indigo-300'}`}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-white">R</span>
          Ask Ray
          {unread > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[11px] font-bold text-white">{unread}</span>}
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-indigo-600 px-4 py-3 text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 font-bold">R</span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Ray Mendez</div>
                <div className="text-[11px] text-indigo-100">Your coach · {coachingMode === 'silent' ? 'answers when asked' : 'coaching on'}</div>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-indigo-100 hover:text-white">✕</button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {coachMessages.length === 0 && (
                <p className="text-xs text-slate-400">Ray will chime in as you work. You can also ask him anything — a term, a number, or what to do next.</p>
              )}
              {coachMessages.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'player' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.from === 'player' ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-slate-800'}`}>
                    {m.from === 'coach' && <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-indigo-500">Ray</span>}
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="border-t border-slate-100 p-3">
              <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ask Ray… (e.g. what's a good DSCR?)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Ask</button>
              </form>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
