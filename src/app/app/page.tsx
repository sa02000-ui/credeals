'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { BuyBoxPanel } from '@/components/BuyBoxPanel';
import { DealFeed } from '@/components/DealFeed';
import { DealPhases } from '@/components/DealPhases';
import { AddDealModal } from '@/components/AddDealModal';
import { ConversationPanel } from '@/components/ConversationPanel';
import { CareerHud } from '@/components/CareerHud';
import { GameStartModal } from '@/components/GameStartModal';
import { ObjectiveHud } from '@/components/ObjectiveHud';
import { useApp } from '@/lib/store';
import { stageDef } from '@/lib/sim';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Home() {
  const { deals, buyBoxApproved, statusOf, setStatus, mode, difficulty, selectedDealId, setSelectedDeal, syncError, clearSyncError } = useApp();
  const selectedId = selectedDealId;
  const [showAdd, setShowAdd] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const selected = deals.find((d) => d.id === selectedId) ?? null;
  const convoDeal = deals.find((d) => d.id === convoId) ?? null;
  const gameNotStarted = mode === 'game' && difficulty === null;

  // Detailed UW needs every pixel: auto-hide the sidebar (buy box + feed) on that tab.
  const [wsPhase, setWsPhase] = useState('napkin');
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const hideSidebar = !!selected && wsPhase === 'detailed' && !sidebarPinned;
  useEffect(() => {
    if (wsPhase !== 'detailed') setSidebarPinned(false); // re-auto-hide next time
  }, [wsPhase]);

  function selectDeal(id: string) {
    setSelectedDeal(id);
    if (statusOf(id) === 'new') setStatus(id, 'napkin');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setTimeout(() => scrollTo('nav-napkin'), 50);
  }

  const currentStep = !buyBoxApproved ? 0 : !selected ? 1 : 2;
  const dealPhaseLabel = selected ? stageDef(statusOf(selected.id)).label : null;

  return (
    <>
      <TopBar />
      <LifecycleNav
        current={currentStep}
        dealName={selected?.name ?? null}
        dealPhase={dealPhaseLabel}
        onNav={(i) => scrollTo(i === 0 ? 'nav-buybox' : i === 1 ? 'nav-feed' : 'nav-napkin')}
      />

      {mode === 'game' && difficulty && (
        <ObjectiveHud onNav={(t) => scrollTo(t === 'buybox' ? 'nav-buybox' : t === 'feed' ? 'nav-feed' : 'nav-napkin')} />
      )}

      {mode === 'game' && buyBoxApproved && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4">
          <CareerHud />
        </div>
      )}

      <main className={`mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 ${hideSidebar ? 'lg:grid-cols-[44px_minmax(0,1fr)]' : 'lg:grid-cols-[340px_minmax(0,1fr)]'}`}>
        {hideSidebar ? (
          /* Minimized rail — Detailed UW gets the room, one click expands the sidebar back */
          <button
            onClick={() => setSidebarPinned(true)}
            title="Expand buy box & deal feed"
            className="sticky top-32 flex items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-2 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:flex-col lg:py-4"
          >
            <span className="text-sm">▸</span>
            <span className="text-[10px] font-bold uppercase tracking-wide lg:hidden">📋 Buy Box &amp; Deals</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-wide lg:block" style={{ writingMode: 'vertical-rl' }}>
              Buy Box &amp; Deals
            </span>
          </button>
        ) : (
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
        )}

        <div id="nav-napkin" className="scroll-mt-32">
          {!buyBoxApproved ? (
            <Empty>Step 1 — define and approve your buy box on the left.</Empty>
          ) : selected ? (
            <DealPhases key={selected.id} deal={selected} onOpenConversation={() => setConvoId(selected.id)} onPhaseChange={setWsPhase} />
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
      {gameNotStarted && <GameStartModal />}

      {syncError && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-xl">
          <span>⚠️ {syncError}</span>
          <button onClick={clearSyncError} className="ml-auto shrink-0 text-red-400 hover:text-red-700">✕</button>
        </div>
      )}
    </>
  );
}

const LIFECYCLE: { label: string; info: string }[] = [
  { label: 'Buy Box', info: 'step.buybox' },
  { label: 'Pick a Deal', info: 'step.pick' },
  { label: 'Work the Deal', info: 'step.napkin' },
];

function LifecycleNav({
  current,
  dealName,
  dealPhase,
  onNav,
}: {
  current: number;
  dealName: string | null;
  dealPhase: string | null;
  onNav: (i: number) => void;
}) {
  return (
    <nav className="border-b border-indigo-800 bg-gradient-to-r from-indigo-700 to-indigo-600">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-3 text-base text-white">
        {LIFECYCLE.map((step, i) => {
          const active = i === current;
          const done = i < current;
          const showDeal = i === 2 && dealName;
          return (
            <div key={step.label} className="flex shrink-0 items-center">
              <span
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition ${
                  active ? 'bg-white font-semibold text-indigo-700 shadow-sm' : 'text-indigo-100 hover:bg-white/10'
                }`}
              >
                <button onClick={() => onNav(i)} className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                      done ? 'bg-emerald-400 text-white' : active ? 'bg-indigo-700 text-white' : 'bg-white/20 text-white'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {showDeal ? (
                    <span className="flex items-center gap-1.5">
                      {dealName}
                      {dealPhase && <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-white/15 text-white'}`}>{dealPhase}</span>}
                    </span>
                  ) : (
                    step.label
                  )}
                </button>
              </span>
              {i < LIFECYCLE.length - 1 && <span className="mx-0.5 text-indigo-300">›</span>}
            </div>
          );
        })}
        <span className="ml-auto hidden text-xs text-indigo-200 sm:block">Pick a deal → its lifecycle (Napkin → Asset Mgmt) shows in the workspace below.</span>
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
