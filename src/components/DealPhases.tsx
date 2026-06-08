'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { NapkinPanel } from '@/components/NapkinPanel';
import { DetailedUWPanel } from '@/components/DetailedUWPanel';
import { LOIPanel } from '@/components/LOIPanel';
import { C2CPanel, AMPanel } from '@/components/PhasePanels';
import { PHASES, stageDef, stageIndex, type DealStage, type MarketDeal } from '@/lib/sim';

export function DealPhases({ deal, onOpenConversation }: { deal: MarketDeal; onOpenConversation: () => void }) {
  const { statusOf } = useApp();
  const status = statusOf(deal.id);
  const unlockedThrough = status === 'archived' ? 0 : Math.max(0, stageIndex(status));
  const [phase, setPhase] = useState<DealStage>(status === 'new' || status === 'archived' ? 'napkin' : status);

  return (
    <div className="space-y-3">
      {/* Phase tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
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
                  ? 'bg-slate-900 text-white'
                  : locked
                    ? 'cursor-not-allowed text-slate-300'
                    : 'text-slate-600 hover:bg-slate-100'
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
      </div>

      {phase === 'napkin' && <NapkinPanel deal={deal} onOpenConversation={onOpenConversation} />}
      {phase === 'detailed' && <DetailedUWPanel deal={deal} />}
      {phase === 'loi' && <LOIPanel deal={deal} />}
      {phase === 'c2c' && <C2CPanel />}
      {phase === 'am' && <AMPanel />}
    </div>
  );
}
