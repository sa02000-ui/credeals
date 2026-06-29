'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { DIFFICULTY_INFO, type DealStatus } from '@/lib/sim';

interface Beat {
  title: string;
  cta: string;
  why: string;
  target: 'buybox' | 'feed' | 'workspace';
}

/**
 * The Objective / Coach bar (DESIGN §22 C): always shows the single next thing to do + why, and a
 * primary action that scrolls there. This is the spine that teaches the game one prompt at a time.
 */
export function ObjectiveHud({ onNav }: { onNav: (target: 'buybox' | 'feed' | 'workspace') => void }) {
  const {
    difficulty,
    buyBoxApproved,
    selectedDealId,
    statusOf,
    deals,
    dealDNA,
    clockPaused,
    day,
    dealsIncoming,
    lastActionDay,
  } = useApp();
  const [showWhy, setShowWhy] = useState(false);
  if (!difficulty) return null;

  const selected = deals.find((d) => d.id === selectedDealId) ?? null;
  const beat = nextBeat(buyBoxApproved, selected ? statusOf(selected.id) : null, !!selected);
  const selectedStatus = selected ? statusOf(selected.id) : null;
  const exited = Object.values(dealDNA).filter((d) => d.exitDay != null).length;
  const won = Object.values(dealDNA).filter((d) => d.terminalOutcome === 'won').length;
  const pyrrhic = Object.values(dealDNA).filter((d) => d.terminalOutcome === 'pyrrhic').length;
  const lost = Object.values(dealDNA).filter((d) => d.terminalOutcome === 'lost').length;
  const blownUp = Object.values(dealDNA).filter((d) => d.terminalOutcome === 'blown-up').length;
  const progress = stageProgressPct(selectedStatus);
  const idleDays = Math.max(0, day - lastActionDay);
  const minDaysToTradeAway = useMemo(() => {
    const clocked = deals
      .filter((d) => statusOf(d.id) === 'new' && d.expiresOnDay != null)
      .map((d) => (d.expiresOnDay ?? day + 99) - day)
      .filter((v) => v >= 0);
    if (clocked.length === 0) return null;
    return Math.min(...clocked);
  }, [deals, statusOf, day]);
  const pressure = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (minDaysToTradeAway == null ? 25 : Math.max(0, 80 - minDaysToTradeAway * 10)) +
          Math.min(20, idleDays * 3) +
          (dealsIncoming > 0 ? 8 : 0),
      ),
    ),
  );
  const pressureTone =
    pressure >= 70 ? 'bg-red-100 text-red-700 border-red-200' : pressure >= 45 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
  const ctaPulse = pressure >= 70 || idleDays >= 6;

  return (
    <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-white to-indigo-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Objective</span>
        <span className="text-sm font-semibold text-slate-800">{beat.title}</span>
        <button onClick={() => setShowWhy((v) => !v)} className="text-xs text-amber-700 underline hover:text-amber-900">{showWhy ? 'hide' : 'why?'}</button>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{DIFFICULTY_INFO[difficulty].label}{clockPaused && ' · ⏸ paused'}</span>
          <button
            onClick={() => onNav(beat.target)}
            className={`rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 ${ctaPulse ? 'animate-pulse' : ''}`}
          >
            {beat.cta} →
          </button>
        </span>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-2 px-4 pb-2 sm:grid-cols-3">
        <div className="rounded-md border border-indigo-200 bg-white/80 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
            <span>Current deal progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Milestones: {selectedStatus ? selectedStatus.toUpperCase() : 'NO DEAL SELECTED'}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white/80 px-3 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Run outcomes</div>
          <div className="flex flex-wrap gap-1 text-[11px]">
            <Badge label={`Won ${won}`} tone="good" />
            <Badge label={`Pyrrhic ${pyrrhic}`} tone="warn" />
            <Badge label={`Lost ${lost}`} tone="bad" />
            <Badge label={`Blown-up ${blownUp}`} tone="bad" />
            <Badge label={`Exited ${exited}`} tone="neutral" />
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white/80 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
            <span>Deal pressure</span>
            <span>{pressure}/100</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${pressure >= 70 ? 'bg-red-500' : pressure >= 45 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${pressure}%` }}
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
            <span className={`rounded border px-1.5 py-0.5 ${pressureTone}`}>
              {minDaysToTradeAway == null ? 'No ticking new-deal fuse' : `${minDaysToTradeAway}d to nearest trade-away`}
            </span>
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">
              {idleDays}d idle
            </span>
            {dealsIncoming > 0 && (
              <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                {dealsIncoming} incoming
              </span>
            )}
          </div>
        </div>
      </div>
      {showWhy && (
        <div className="mx-auto max-w-7xl px-4 pb-2">
          <p className="rounded-md bg-white/70 px-3 py-2 text-xs text-slate-600">{beat.why}</p>
        </div>
      )}
    </div>
  );
}

function nextBeat(buyBoxApproved: boolean, status: DealStatus | null, hasSelected: boolean): Beat {
  if (!buyBoxApproved)
    return { title: 'Set your buy box', cta: 'Go to Buy Box', target: 'buybox', why: 'Your buy box is a living filter (not a cage) — it focuses the deals you see. You can change it anytime and still pursue off-box deals.' };
  if (!hasSelected || status == null)
    return { title: 'Pick a deal to underwrite', cta: 'Open the deal feed', target: 'feed', why: 'Sourcing is a numbers game — review the feed and choose one worth a closer look. Most deals, you pass on.' };
  switch (status) {
    case 'new':
    case 'napkin':
      return { title: 'Run the napkin — is there meat on the bone?', cta: 'Open the workspace', target: 'workspace', why: 'A 5-minute valuation: income − expenses = NOI, ÷ cap rate = value vs. the ask. It tells you fast whether to dig deeper.' };
    case 'detailed':
      return { title: 'Finish the detailed underwriting before you offer', cta: 'Open Detailed UW', target: 'workspace', why: 'Build the multi-year proforma, debt and equity stack, and investor returns. Know your numbers cold before you commit.' };
    case 'loi':
      return { title: 'Submit your Letter of Intent', cta: 'Open LOI', target: 'workspace', why: 'The LOI sets the business terms (price, EMD, DD, financing). In game mode the seller negotiates back — terms are your levers.' };
    case 'c2c':
      return { title: 'Work the contract to close', cta: 'Open Contract-to-Close', target: 'workspace', why: 'Drive every workstream — title, debt, DD, insurance, capital raise — to the critical dates. Slips cost you the deal or your deposit.' };
    case 'am':
      return { title: 'Operate the asset', cta: 'Open Asset Management', target: 'workspace', why: 'Run the hold: occupancy and NOI vs. the proforma you promised, distributions, and recurring obligations — toward the eventual refi or sale.' };
    case 'archived':
      return { title: 'Deal archived — pick another', cta: 'Open the deal feed', target: 'feed', why: 'Discipline is part of the game. Move on and find a better fit for your buy box.' };
    default:
      return { title: 'Continue the deal', cta: 'Open the workspace', target: 'workspace', why: 'Keep moving through the lifecycle.' };
  }
}

function stageProgressPct(status: DealStatus | null): number {
  if (!status) return 0;
  if (status === 'archived' || status === 'lost') return 100;
  switch (status) {
    case 'new':
      return 10;
    case 'napkin':
      return 20;
    case 'detailed':
      return 40;
    case 'loi':
      return 60;
    case 'c2c':
      return 78;
    case 'am':
      return 90;
    default:
      return 0;
  }
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const cls =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'bad'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`rounded border px-1.5 py-0.5 ${cls}`}>{label}</span>;
}
