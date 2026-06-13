'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { PROFILE_CONFIGS, usd, type ExperienceProfile } from '@/lib/sim';

const SPEEDS = [2, 5, 10]; // real minutes per simulated day
const PROFILE_ORDER: ExperienceProfile[] = ['brand-new', 'studied', 'some-experience', 'mixed', 'expert'];

/**
 * Day-0 onboarding (design doc Part 3): the player picks an EXPERIENCE PROFILE (which sets starting
 * cash, carry, coaching mode, and counterparty difficulty) + clock pace. Shown when game mode is on
 * and no profile has been chosen yet. After this the Objective/Coach HUD takes over and the clock starts.
 */
export function GameStartModal() {
  const { setExperienceProfile, setMode } = useApp();
  const [speed, setSpeed] = useState(2);

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
          <IntroCard icon="🎯" title="Goal" body="Build net worth. Close good deals, operate them well, and exit for a profit — then do it again, bigger." />
          <IntroCard icon="🔁" title="How it works" body="Source a deal → underwrite it → submit an LOI and negotiate → sign the PSA → close → operate → sell. The app prompts you each step." />
          <IntroCard icon="⏱️" title="Time = money" body="A clock ticks in real time: every simulated DAY is a few real MINUTES. Carrying costs and diligence drain your cash as days pass — move with purpose. Pause anytime; you resume right where you left." />
        </div>

        {/* Clock pace */}
        <h3 className="mt-6 text-sm font-semibold text-slate-800">Clock pace</h3>
        <p className="text-[11px] text-slate-500">How many real minutes equal one simulated day. Slower = more time to think.</p>
        <div className="mt-1.5 flex gap-2">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${speed === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s} min / day</button>
          ))}
        </div>

        {/* Experience profile — sets starting cash, carry, coaching, and difficulty */}
        <h3 className="mt-5 text-sm font-semibold text-slate-800">How experienced are you? (pick one to begin)</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROFILE_ORDER.map((p) => {
            const cfg = PROFILE_CONFIGS[p];
            return (
              <button key={p} onClick={() => setExperienceProfile(p, speed)} className="rounded-xl border-2 border-slate-200 p-3 text-left transition hover:border-slate-900 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{cfg.label}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{usd(cfg.startingCash, { compact: true })} · ${cfg.carryPerDay}/day</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{cfg.blurb}</p>
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
