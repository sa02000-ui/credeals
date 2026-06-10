'use client';

import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { BuyBoxPanel } from '@/components/BuyBoxPanel';
import { DealFeed } from '@/components/DealFeed';
import { DealPhases } from '@/components/DealPhases';
import { AddDealModal } from '@/components/AddDealModal';
import { ConversationPanel } from '@/components/ConversationPanel';
import { CareerHud } from '@/components/CareerHud';
import { useApp } from '@/lib/store';
import type { DealStage } from '@/lib/sim';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Home() {
  const { deals, buyBoxApproved, statusOf, setStatus, mode } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const selected = deals.find((d) => d.id === selectedId) ?? null;
  const convoDeal = deals.find((d) => d.id === convoId) ?? null;

  function selectDeal(id: string) {
    setSelectedId(id);
    if (statusOf(id) === 'new') setStatus(id, 'napkin');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setTimeout(() => scrollTo('nav-napkin'), 50);
  }

  const stageToIdx: Record<DealStage, number> = { new: 2, napkin: 2, detailed: 3, loi: 4, c2c: 5, am: 6, archived: 2 };
  const currentStep = !buyBoxApproved ? 0 : !selected ? 1 : stageToIdx[statusOf(selected.id)];

  return (
    <>
      <TopBar />
      <LifecycleNav
        current={currentStep}
        onNav={(i) => scrollTo(i === 0 ? 'nav-buybox' : i === 1 ? 'nav-feed' : 'nav-napkin')}
      />

      {mode === 'game' && buyBoxApproved && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4">
          <CareerHud />
        </div>
      )}

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div id="nav-buybox" className="scroll-mt-32">
            <BuyBoxPanel />
          </div>
          <div id="nav-feed" className="relative scroll-mt-32">
            <DealFeed
              selectedId={selectedId}
              onSelect={selectDeal}
              onAddDeal={() => setShowAdd(true)}
              onOpenConversation={(id) => setConvoId(id)}
            />
            {!buyBoxApproved && <Lock>Approve your buy box to start sourcing.</Lock>}
          </div>
        </div>

        <div id="nav-napkin" className="scroll-mt-32">
          {!buyBoxApproved ? (
            <Empty>Step 1 — define and approve your buy box on the left.</Empty>
          ) : selected ? (
            <DealPhases key={selected.id} deal={selected} onOpenConversation={() => setConvoId(selected.id)} />
          ) : (
            <Empty>Step 2 — pick a deal from the feed to underwrite it.</Empty>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-[11px] text-slate-400">
        Massive Deal Sim · Slice 1 · napkin math ported from Synthesis · seeded demo deals
      </footer>

      {showAdd && <AddDealModal onClose={() => setShowAdd(false)} onAdded={(id) => selectDeal(id)} />}
      {convoDeal && <ConversationPanel dealId={convoDeal.id} dealName={convoDeal.name} onClose={() => setConvoId(null)} />}
    </>
  );
}

const LIFECYCLE = ['Buy Box', 'Pick a Deal', 'Napkin UW', 'Detailed UW', 'LOI', 'Contract to Close', 'Asset Mgmt'];

function LifecycleNav({ current, onNav }: { current: number; onNav: (i: number) => void }) {
  return (
    <nav className="border-b border-indigo-800 bg-gradient-to-r from-indigo-700 to-indigo-600">
      <div className="mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-4 py-3 text-base text-white">
        {LIFECYCLE.map((label, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <div key={label} className="flex shrink-0 items-center">
              <button
                onClick={() => onNav(i)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition ${
                  active ? 'bg-white font-semibold text-indigo-700 shadow-sm' : 'text-indigo-100 hover:bg-white/10'
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    done ? 'bg-emerald-400 text-white' : active ? 'bg-indigo-700 text-white' : 'bg-white/20 text-white'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                {label}
              </button>
              {i < LIFECYCLE.length - 1 && <span className="mx-0.5 text-indigo-300">›</span>}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function Lock({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/60 backdrop-blur-[1px]">
      <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
        🔒 {children}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 px-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
