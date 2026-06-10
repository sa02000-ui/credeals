'use client';

import { useApp } from '@/lib/store';
import { DIFFICULTY_INFO, usd, type Difficulty } from '@/lib/sim';

/**
 * Shown once when a game hasn't been started (game mode + no difficulty chosen). Gives the high-level
 * goal + how-to-play, then asks the player to pick a difficulty (DESIGN §22 C/H). After this the
 * Objective/Coach HUD takes over and the clock starts.
 */
export function GameStartModal() {
  const { startGame, setMode } = useApp();
  const order: Difficulty[] = ['guided', 'standard', 'expert'];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl">🏗️</div>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Become a real-estate sponsor</h2>
          <p className="mt-1 text-sm text-slate-600">Buy, improve, and exit deals to grow your net worth — learning real underwriting as you play.</p>
        </div>

        {/* 3-card intro */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <IntroCard icon="🎯" title="Goal" body="Build net worth. Close good deals, operate them well, and exit for a profit." />
          <IntroCard icon="🔁" title="How it works" body="Source → underwrite → offer → negotiate → close → operate → sell. Repeat, bigger each time." />
          <IntroCard icon="⏱️" title="Heads-up" body="A clock ticks and things cost money from your starting capital. You can pause anytime and resume." />
        </div>

        {/* Difficulty */}
        <h3 className="mt-6 text-sm font-semibold text-slate-800">Choose your difficulty</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {order.map((d) => {
            const info = DIFFICULTY_INFO[d];
            return (
              <button key={d} onClick={() => startGame(d)} className="rounded-xl border-2 border-slate-200 p-3 text-left transition hover:border-slate-900 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{info.label}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{usd(info.startingCash, { compact: true })}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{info.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-center">
          <button onClick={() => setMode('real')} className="text-xs text-slate-400 underline hover:text-slate-700">or switch to Real mode (do an actual deal — no game layer)</button>
        </div>
      </div>
    </div>
  );
}

function IntroCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xl">{icon}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{title}</div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
