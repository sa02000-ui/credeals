'use client';

import { useApp } from '@/lib/store';
import { MARKET_INFO, repAverage, tierFor, usd, type MarketCondition } from '@/lib/sim';

/** Game-mode career HUD: reputation, tier, net worth, market, latest lesson. */
export function CareerHud() {
  const { game, cashBalance, isAdmin, setMarket } = useApp();
  const repAvg = repAverage(game.reputation);
  const tier = tierFor(game.dealsClosed, repAvg);
  const latest = game.log[0];

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-900">🎮 {tier}</span>
        <Stat label="Net worth" value={usd(cashBalance, { compact: true })} />
        <Stat label="Deals closed" value={String(game.dealsClosed)} />
        <RepBar label="Broker" v={game.reputation.broker} />
        <RepBar label="Lender" v={game.reputation.lender} />
        <RepBar label="LP" v={game.reputation.lp} />
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-600" title={MARKET_INFO[game.market].note}>
          📈 {MARKET_INFO[game.market].label}
          {isAdmin && (
            <select
              value={game.market}
              onChange={(e) => setMarket(e.target.value as MarketCondition)}
              className="rounded border border-amber-300 bg-white px-1 py-0.5 text-[11px]"
              title="Admin: set market condition"
            >
              <option value="hot">hot</option>
              <option value="balanced">balanced</option>
              <option value="tough">tough</option>
            </select>
          )}
        </span>
      </div>
      {latest && (
        <div className="mt-2 rounded-md bg-white/70 px-2 py-1 text-[11px] text-slate-600">
          <b>{latest.title}</b>{latest.lesson ? ` — 💡 ${latest.lesson}` : ''}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-slate-600">
      {label}: <b className="text-slate-900">{value}</b>
    </span>
  );
}

function RepBar({ label, v }: { label: string; v: number }) {
  const color = v >= 65 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className="flex items-center gap-1 text-[11px] text-slate-600" title={`${label} reputation ${v}/100`}>
      {label}
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
        <span className={`block h-full ${color}`} style={{ width: `${v}%` }} />
      </span>
    </span>
  );
}
