'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { useDealLocal } from '@/lib/hooks/useDealLocal';
import { getCoachMessage } from '@/lib/sim';
import { InfoTip } from '@/components/InfoTip';
import { DealDNAPanel } from '@/components/DealDNAPanel';
import { NapkinPanel } from '@/components/NapkinPanel';
import { DetailedUWPanel } from '@/components/DetailedUWPanel';
import { LOIPanel } from '@/components/LOIPanel';
import { C2CPanel, AMPanel } from '@/components/PhasePanels';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { DealPeoplePanel } from '@/components/DealPeoplePanel';
import { PHASES, stageDef, stageIndex, type DealStage, type MarketDeal } from '@/lib/sim';

type Tab = DealStage | 'docs';

const PHASE_INFO: Record<DealStage, string> = {
  new: 'step.pick',
  napkin: 'step.napkin',
  detailed: 'step.detailed',
  loi: 'step.loi',
  c2c: 'step.c2c',
  am: 'step.am',
  lost: 'step.pick',
  archived: 'step.pick',
};

// Ray (coach) chimes in once when a deal first reaches each stage — game mode, non-silent profiles.
const STAGE_COACH: Partial<Record<DealStage, string>> = {
  napkin: 'first-deal',
  detailed: 'detailed-enter',
  loi: 'loi-submit',
  c2c: 'c2c-enter',
  am: 'am-enter',
};

export function DealPhases({ deal, onOpenConversation, onPhaseChange }: { deal: MarketDeal; onOpenConversation: () => void; onPhaseChange?: (phase: string) => void }) {
  const { statusOf, mode, difficulty, coachingMode, addCoachMessage } = useApp();
  const status = statusOf(deal.id);
  const terminal = status === 'archived' || status === 'lost';
  const unlockedThrough = terminal ? 0 : Math.max(0, stageIndex(status));
  const [phase, setPhase] = useState<Tab>(status === 'new' || terminal ? 'napkin' : status);

  // Ray narrates each stage the first time this deal reaches it (game mode, non-silent profiles).
  const [coached, setCoached] = useDealLocal<string[]>('coached-stages', deal.id, []);
  useEffect(() => {
    if (mode !== 'game' || !difficulty || coachingMode === 'silent') return;
    const trigger = STAGE_COACH[status];
    if (!trigger || coached.includes(status)) return;
    const text = getCoachMessage(trigger);
    if (!text) return;
    addCoachMessage({ from: 'coach', text, dealId: deal.id, phase: status, trigger });
    setCoached((c) => (c.includes(status) ? c : [...c, status]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mode, difficulty, coachingMode]);

  // Guided flow: when the deal advances a stage (e.g. "Pass napkin → Detailed UW"), follow it to that tab.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (status !== prevStatus.current && status !== 'new' && status !== 'archived' && status !== 'lost') setPhase(status);
    prevStatus.current = status;
  }, [status]);

  // Let the page react to the active tab (e.g. hide the sidebar on Detailed UW for working room).
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  return (
    <div className="space-y-3">
      {status === 'lost' && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
          <div className="text-base font-bold text-rose-800">💔 Deal lost</div>
          <p className="mt-1 text-sm text-rose-700">This one didn’t come together — the seller went another way or it fell through in diligence. It’s filed under <b>Lost</b> in your feed. Pick another deal and apply what you learned (open Ray if you want to talk through what to do differently).</p>
        </div>
      )}
      <DealPeoplePanel deal={deal} />
      <DealDNAPanel deal={deal} />

      {/* Per-deal lifecycle nav — the authoritative stage tracker for this deal */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-1.5">
        <div className="flex flex-wrap gap-1">
          {PHASES.map((p, i) => {
            const def = stageDef(p);
            const locked = i > unlockedThrough;
            const active = phase === p;
            return (
              <button
                key={p}
                onClick={() => !locked && setPhase(p)}
                disabled={locked}
                title={locked ? 'Complete the prior phase to unlock' : ''}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : locked
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-600 hover:bg-indigo-100'
                }`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${active ? 'bg-white/20' : i < unlockedThrough ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {i < unlockedThrough ? '✓' : i + 1}
                </span>
                {def.short}
                {locked && <span className="text-[11px]">🔒</span>}
              </button>
            );
          })}
          {/* Always-available Documents tab (the deal's central drive) */}
          <button
            onClick={() => setPhase('docs')}
            className={`ml-1 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              phase === 'docs' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📁 Documents
          </button>
        </div>
      </div>

      {/* Contextual "what is this step" helper (learn-as-you-go) */}
      {phase !== 'docs' && !terminal && (
        <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{stageDef(phase).label}</span>
          <InfoTip k={PHASE_INFO[phase]} />
          <span className="text-slate-400">— hover the ⓘ on any field to learn the concept.</span>
        </div>
      )}

      {/* A lost/archived deal can't proceed — only its Documents stay viewable */}
      {!terminal && phase === 'napkin' && <NapkinPanel deal={deal} onOpenConversation={onOpenConversation} />}
      {!terminal && phase === 'detailed' && <DetailedUWPanel deal={deal} />}
      {!terminal && phase === 'loi' && <LOIPanel deal={deal} />}
      {!terminal && phase === 'c2c' && <C2CPanel deal={deal} />}
      {!terminal && phase === 'am' && <AMPanel deal={deal} />}
      {phase === 'docs' && <DocumentsPanel deal={deal} />}
    </div>
  );
}
