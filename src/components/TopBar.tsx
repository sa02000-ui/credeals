'use client';

import { useApp } from '@/lib/store';
import { usd } from '@/lib/sim';
import { AuthStatus } from '@/components/AuthStatus';

export function TopBar() {
  const { mode, setMode, cashBalance, day, resetAll, isAdmin, setAdmin } = useApp();
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
            <button
              onClick={() => setAdmin(false)}
              title="Admin mode on (persona tuning visible). Click to exit."
              className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              ★ Admin
            </button>
          )}
          {/* Treasury — game mode only (see DESIGN §4.5) */}
          {mode === 'game' && (
            <div
              className={`rounded-lg border px-3 py-1.5 text-right ${
                low ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'
              }`}
              title="Simulated bank balance. Outflows: pursuit/diligence costs, EMD. Off in real mode."
            >
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Cash on hand</div>
              <div className={`text-sm font-semibold ${low ? 'text-red-600' : 'text-slate-900'}`}>
                {usd(cashBalance)}
              </div>
            </div>
          )}
          {/* Day — game mode only (no simulated time in real mode) */}
          {mode === 'game' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Day</div>
              <div className="text-sm font-semibold">{day}</div>
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

          <button
            onClick={() => {
              if (confirm('Reset all progress (buy box, statuses, cash)?')) resetAll();
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
          >
            Reset
          </button>

          <AuthStatus />
        </div>
      </div>
    </header>
  );
}
