'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { InfoTip } from '@/components/InfoTip';
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
  archived: 'step.pick',
};

export function DealPhases({ deal, onOpenConversation }: { deal: MarketDeal; onOpenConversation: () => void }) {
  const { statusOf } = useApp();
  const status = statusOf(deal.id);
  const unlockedThrough = status === 'archived' ? 0 : Math.max(0, stageIndex(status));
  const [phase, setPhase] = useState<Tab>(status === 'new' || status === 'archived' ? 'napkin' : status);

  return (
    <div className="space-y-3">
      <DealPeoplePanel deal={deal} />

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
      {phase !== 'docs' && (
        <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600">{stageDef(phase).label}</span>
          <InfoTip k={PHASE_INFO[phase]} />
          <span className="text-slate-400">— hover the ⓘ on any field to learn the concept.</span>
        </div>
      )}

      {phase === 'napkin' && <NapkinPanel deal={deal} onOpenConversation={onOpenConversation} />}
      {phase === 'detailed' && <DetailedUWPanel deal={deal} />}
      {phase === 'loi' && <LOIPanel deal={deal} />}
      {phase === 'c2c' && <C2CPanel deal={deal} />}
      {phase === 'am' && <AMPanel deal={deal} />}
      {phase === 'docs' && <DocumentsPanel deal={deal} />}
    </div>
  );
}
