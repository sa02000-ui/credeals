'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { treasuryBalance, usd } from '@/lib/sim';
import { AuthStatus } from '@/components/AuthStatus';
import { RelationshipLedger } from '@/components/RelationshipLedger';
import { NotificationInbox } from '@/components/NotificationInbox';

export function TopBar() {
  const { mode, setMode, cashBalance, day, resetAll, isAdmin, difficulty, clockPaused, setClockPaused, clockMinutesPerDay, setClockSpeed, treasury, gameEnabled } = useApp();
  const showGameUi = gameEnabled || isAdmin;
  const low = cashBalance < 25_000;
  const [showLedger, setShowLedger] = useState(false);
  const carryingCost = treasuryBalance(treasury) - cashBalance; // accumulated daily carrying costs

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
              <div className="relative">
                <button
                  onClick={() => setShowLedger((v) => !v)}
                  className={`flex h-full flex-col justify-center rounded-xl border-2 px-4 py-1.5 text-right transition hover:brightness-95 ${low ? 'border-red-400 bg-red-50' : 'border-emerald-300 bg-emerald-50'}`}
                  title="Click to see where your cash went"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">💵 Cash ▾</div>
                  <div className={`text-lg font-extrabold leading-none tabular-nums ${low ? 'text-red-600' : 'text-emerald-700'}`}>{usd(cashBalance)}</div>
                </button>
                {showLedger && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowLedger(false)} />
                    <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                      <div className="mb-2 text-sm font-bold text-slate-800">Where your cash went</div>
                      <div className="max-h-72 space-y-1 overflow-y-auto">
                        <LedgerRow label="Starting capital" day={1} amount={treasury.startingBalance} />
                        {[...treasury.events].reverse().map((e) => (
                          <LedgerRow key={e.id} label={e.label} day={e.day} amount={e.amount} />
                        ))}
                        {carryingCost > 0 && (
                          <LedgerRow label={`Carrying costs (overhead, ${day - 1} day${day - 1 === 1 ? '' : 's'})`} day={day} amount={-carryingCost} />
                        )}
                      </div>
                      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                        <span className="text-slate-700">Balance</span>
                        <span className={`tabular-nums ${low ? 'text-red-600' : 'text-emerald-700'}`}>{usd(cashBalance)}</span>
                      </div>
                    </div>
                  </>
                )}
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

          {/* Mode toggle — hidden entirely when the admin has switched the game off (admins still see it) */}
          {showGameUi && (
            <div className="flex items-center gap-1">
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
              {!gameEnabled && isAdmin && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700" title="Game mode is hidden from users (admin-only preview). Toggle in Admin.">
                  hidden
                </span>
              )}
            </div>
          )}

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

          <NotificationInbox />
          <RelationshipLedger />
          <AuthStatus />
        </div>
      </div>
    </header>
  );
}

function LedgerRow({ label, day, amount }: { label: string; day: number; amount: number }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] tabular-nums text-slate-500">d{day}</span>
      <span className="min-w-0 flex-1 truncate text-slate-700" title={label}>{label}</span>
      <span className={`shrink-0 font-semibold tabular-nums ${amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
        {amount < 0 ? '−' : '+'}{usd(Math.abs(amount))}
      </span>
    </div>
  );
}
