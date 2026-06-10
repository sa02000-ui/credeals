'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import {
  STAGES,
  analyzeDeal,
  matchBuyBox,
  pct,
  usd,
  type DealStage,
  type MarketDeal,
} from '@/lib/sim';

const ACCENT: Record<string, string> = {
  amber: 'border-l-amber-400 bg-amber-50',
  sky: 'border-l-sky-400 bg-sky-50',
  indigo: 'border-l-indigo-400 bg-indigo-50',
  violet: 'border-l-violet-400 bg-violet-50',
  emerald: 'border-l-emerald-400 bg-emerald-50',
  teal: 'border-l-teal-400 bg-teal-50',
  slate: 'border-l-slate-400 bg-slate-100',
};

export function DealFeed({
  selectedId,
  onSelect,
  onAddDeal,
  onOpenConversation,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddDeal: () => void;
  onOpenConversation: (id: string) => void;
}) {
  const { deals, statusOf } = useApp();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ archived: true });

  const byStage = (stage: DealStage) => deals.filter((d) => statusOf(d.id) === stage);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Step 2 · Deal Feed</h2>
        <button
          onClick={onAddDeal}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          + Add deal
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {STAGES.map((stage) => {
          const items = byStage(stage.id);
          const isCollapsed = collapsed[stage.id];
          return (
            <div key={stage.id}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [stage.id]: !c[stage.id] }))}
                className={`flex w-full items-center gap-2 border-l-[6px] px-3 py-3 text-left ${ACCENT[stage.color]}`}
              >
                <span className="text-base text-slate-600">{isCollapsed ? '▸' : '▾'}</span>
                <span className="text-base font-extrabold uppercase tracking-wide text-slate-900">{stage.label}</span>
                <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold text-slate-800 shadow-sm">
                  {items.length}
                </span>
              </button>
              {!isCollapsed &&
                (items.length === 0 ? (
                  <div className="px-4 py-2 text-xs text-slate-400">—</div>
                ) : (
                  <ul>
                    {items.map((deal) => (
                      <DealRow
                        key={deal.id}
                        deal={deal}
                        selected={selectedId === deal.id}
                        onSelect={() => onSelect(deal.id)}
                        onOpenConversation={() => onOpenConversation(deal.id)}
                      />
                    ))}
                  </ul>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DealRow({
  deal,
  selected,
  onSelect,
  onOpenConversation,
}: {
  deal: MarketDeal;
  selected: boolean;
  onSelect: () => void;
  onOpenConversation: () => void;
}) {
  const { buyBox, overridesOf, commentsOf } = useApp();
  const match = matchBuyBox(deal, buyBox);
  const r = analyzeDeal(deal, overridesOf(deal.id));
  const comments = commentsOf(deal.id);

  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full px-4 py-2.5 text-left transition ${
          selected ? 'bg-slate-50 ring-2 ring-inset ring-slate-900' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{deal.name}</span>
              {/* Monday-style communication bubble — opens the conversation slide-over */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenConversation();
                }}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition ${
                  comments.length > 0
                    ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                    : 'border-slate-200 text-slate-400 hover:border-sky-300 hover:text-sky-600'
                }`}
                title="Open deal conversation"
              >
                <span className="text-base leading-none">💬</span>
                {comments.length > 0 && <span className="font-semibold tabular-nums">{comments.length}</span>}
              </span>
              {deal.custom && (
                <span className="rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-700">yours</span>
              )}
            </div>
            <div className="truncate text-xs text-slate-500">
              📍 {deal.city}, {deal.state} · {deal.unitCount} units · {deal.vintage}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums">{usd(deal.askPrice, { compact: true })}</div>
            <div className="text-[11px] text-slate-500 tabular-nums">{usd(deal.askPrice / deal.unitCount)}/u</div>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            Existing MF
          </span>
          {match.matches ? (
            <Tag tone="good">✓ In box</Tag>
          ) : (
            <Tag tone="warn" title={match.reasons.join(' · ')}>
              ✕ {match.reasons[0]}
            </Tag>
          )}
          <Tag tone={r.proforma.pctVsAsk >= 0 ? 'good' : 'bad'}>
            PF {r.proforma.pctVsAsk >= 0 ? '+' : ''}
            {pct(r.proforma.pctVsAsk)}
          </Tag>
          <Tag tone={r.financing.financeable ? 'good' : 'bad'}>DSCR {r.financing.dscr.toFixed(2)}</Tag>
        </div>
      </button>
    </li>
  );
}

function Tag({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: 'good' | 'bad' | 'warn';
  title?: string;
}) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bad: 'bg-red-50 text-red-700 border-red-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
  }[tone];
  return (
    <span title={title} className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${styles}`}>
      {children}
    </span>
  );
}
