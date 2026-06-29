'use client';

import { useState } from 'react';
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
  const { difficulty, buyBoxApproved, selectedDealId, statusOf, deals, clockPaused } = useApp();
  const [showWhy, setShowWhy] = useState(false);
  if (!difficulty) return null;

  const selected = deals.find((d) => d.id === selectedDealId) ?? null;
  const beat = nextBeat(buyBoxApproved, selected ? statusOf(selected.id) : null, !!selected);

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Objective</span>
        <span className="text-sm font-semibold text-slate-800">{beat.title}</span>
        <button onClick={() => setShowWhy((v) => !v)} className="text-xs text-amber-700 underline hover:text-amber-900">{showWhy ? 'hide' : 'why?'}</button>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{DIFFICULTY_INFO[difficulty].label}{clockPaused && ' · ⏸ paused'}</span>
          <button onClick={() => onNav(beat.target)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">{beat.cta} →</button>
        </span>
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
      return { title: 'Run the Napkin — is there meat on the bone?', cta: 'Open the workspace', target: 'workspace', why: 'A 5-minute valuation: income − expenses = NOI, ÷ cap rate = value vs. the ask. It tells you fast whether to dig deeper.' };
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
