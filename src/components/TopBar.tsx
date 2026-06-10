'use client';

import Link from 'next/link';
import { useApp } from '@/lib/store';
import { usd } from '@/lib/sim';
import { AuthStatus } from '@/components/AuthStatus';

export function TopBar() {
  const { mode, setMode, cashBalance, day, resetAll, isAdmin, difficulty, clockPaused, setClockPaused, clockMinutesPerDay, setClockSpeed } = useApp();
  const low = cashBalance < 25_000;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            M
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Massive Deal Sim</div>
            <div className="text-xs text-slate-500">Multifamily · Slice 1</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              title="Open the admin console"
              className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              ★ Admin
            </Link>
          )}
          {/* Prominent cash + clock HUD — game mode only (off in real mode) */}
          {mode === 'game' && (
            <div className="flex items-stretch gap-2">
              <div
                className={`flex flex-col justify-center rounded-xl border-2 px-4 py-1.5 text-right ${low ? 'border-red-400 bg-red-50' : 'border-emerald-300 bg-emerald-50'}`}
                title="Simulated bank balance. Outflows: carrying costs, pursuit/diligence, EMD. Off in real mode."
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">💵 Cash</div>
                <div className={`text-lg font-extrabold leading-none tabular-nums ${low ? 'text-red-600' : 'text-emerald-700'}`}>{usd(cashBalance)}</div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-300 bg-indigo-50 px-3 py-1.5">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">📅 Day</div>
                  <div className="text-lg font-extrabold leading-none tabular-nums text-indigo-700">{day}</div>
                </div>
                {difficulty && (
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => setClockPaused(!clockPaused)}
                      title={clockPaused ? 'Resume the clock' : 'Pause the clock'}
                      className={`grid h-7 w-7 place-items-center rounded-md border text-sm ${clockPaused ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
                    >
                      {clockPaused ? '▶' : '⏸'}
                    </button>
                    <select
                      value={clockMinutesPerDay}
                      onChange={(e) => setClockSpeed(Number(e.target.value))}
                      title="Real minutes per simulated day"
                      className="rounded border border-indigo-200 bg-white px-0.5 text-[10px] text-slate-600 focus:outline-none"
                    >
                      {[2, 5, 10].map((s) => (<option key={s} value={s}>{s}m/d</option>))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs font-medium">
            <button
              onClick={() => setMode('game')}
              className={`rounded-md px-3 py-1 ${
                mode === 'game' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🎮 Game
            </button>
            <button
              onClick={() => setMode('real')}
              className={`rounded-md px-3 py-1 ${
                mode === 'real' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🏢 Real
            </button>
          </div>

          {/* Reset is a game-mode concept (resets simulated progress); nothing to reset on live deals */}
          {mode === 'game' && (
            <button
              onClick={() => {
                if (confirm('Reset simulated progress (buy box, statuses, cash)?')) resetAll();
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
          )}

          <AuthStatus />
        </div>
      </div>
    </header>
  );
}
