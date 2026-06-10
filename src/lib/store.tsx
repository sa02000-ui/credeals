'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from './supabase/config';
import { dataClient } from './supabase/dataClient';
import { readCookieSession } from './supabase/token';
import { listDeals, insertDeal, updateDealStage } from './data/deals';
import {
  DEFAULT_BUY_BOX,
  INITIAL_GAME,
  SEED_DEALS,
  applyRep,
  treasuryBalance,
  DIFFICULTY_INFO,
  type Difficulty,
  type GameState,
  type MarketCondition,
  type Reputation,
  type BuyBox,
  type CashEvent,
  type DealComment,
  type DealFile,
  type DealPerson,
  type DealState,
  type DealStatus,
  type MarketDeal,
  type NapkinOverrides,
  type SimMode,
  type TreasuryState,
} from './sim';

const STARTING_CASH = 250_000;
const PURSUIT_COST = 7_500;

/** A bundle of effects applied to the game state (cash, reputation, log, counters). */
export interface GameOutcome {
  repDelta?: Partial<Reputation>;
  cashDelta?: number;
  cashLabel?: string;
  dealId?: string;
  event?: { title: string; detail: string; lesson?: string };
  closed?: boolean;
  pursued?: boolean;
}

interface AppState {
  mode: SimMode;
  /** admin-only features (e.g. persona tuning). Comes from Supabase profile.is_admin later;
   * for now toggled via ?admin=1 / ?admin=0 in the URL so end users never see admin tools. */
  isAdmin: boolean;
  buyBox: BuyBox;
  buyBoxApproved: boolean;
  dealStates: Record<string, DealState>;
  customDeals: MarketDeal[];
  comments: Record<string, DealComment[]>;
  files: Record<string, DealFile[]>;
  people: Record<string, DealPerson[]>;
  treasury: TreasuryState;
  day: number;
  game: GameState;
  /** game-run controls (DESIGN §22): difficulty chosen at start (null = not started), clock, resume cursor */
  difficulty: Difficulty | null;
  clockPaused: boolean;
  /** real minutes per simulated day (player-chosen pace; 1 sim day = N real minutes) */
  clockMinutesPerDay: number;
  selectedDealId: string | null;
}

const CARRY_PER_DAY = 250; // light daily carrying cost so time costs money

const INITIAL: AppState = {
  mode: 'game',
  isAdmin: false,
  buyBox: DEFAULT_BUY_BOX,
  buyBoxApproved: false,
  dealStates: {},
  customDeals: [],
  comments: {},
  files: {},
  people: {},
  treasury: { startingBalance: STARTING_CASH, events: [] },
  day: 1,
  game: INITIAL_GAME,
  difficulty: null,
  clockPaused: true,
  clockMinutesPerDay: 2,
  selectedDealId: null,
};

interface AppContextValue extends AppState {
  deals: MarketDeal[];
  cashBalance: number;
  setMode: (m: SimMode) => void;
  setAdmin: (v: boolean) => void;
  setMarket: (m: MarketCondition) => void;
  startGame: (d: Difficulty, minutesPerDay?: number) => void;
  setClockPaused: (v: boolean) => void;
  setClockSpeed: (minutesPerDay: number) => void;
  setSelectedDeal: (id: string | null) => void;
  applyGameOutcome: (o: GameOutcome) => void;
  updateBuyBox: (patch: Partial<BuyBox>) => void;
  approveBuyBox: () => void;
  editBuyBox: () => void;
  statusOf: (dealId: string) => DealStatus;
  setStatus: (dealId: string, status: DealStatus) => void;
  overridesOf: (dealId: string) => Partial<NapkinOverrides>;
  setOverride: (dealId: string, patch: Partial<NapkinOverrides>) => void;
  resetOverrides: (dealId: string) => void;
  addDeal: (deal: MarketDeal) => Promise<string>;
  commentsOf: (dealId: string) => DealComment[];
  addComment: (dealId: string, text: string, opts?: { author?: string; parentId?: string }) => void;
  toggleLike: (dealId: string, commentId: string, who?: string) => void;
  filesOf: (dealId: string) => DealFile[];
  addFiles: (dealId: string, files: DealFile[]) => void;
  peopleOf: (dealId: string) => DealPerson[];
  addPerson: (dealId: string, person: DealPerson) => void;
  updatePerson: (dealId: string, id: string, patch: Partial<DealPerson>) => void;
  removePerson: (dealId: string, id: string) => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const LS_KEY = 'cre-sim-state-v4';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  // DB-backed deals (kept out of localStorage). null = not loaded / local mode.
  const [dbDeals, setDbDeals] = useState<MarketDeal[] | null>(null);
  const [dbStages, setDbStages] = useState<Record<string, DealStatus>>({});

  useEffect(() => {
    let next: AppState = INITIAL;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) next = { ...INITIAL, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    // admin backdoor for the pre-auth prototype: ?admin=1 enables admin tools, ?admin=0 disables.
    try {
      const a = new URLSearchParams(window.location.search).get('admin');
      if (a === '1') next = { ...next, isAdmin: true };
      if (a === '0') next = { ...next, isAdmin: false };
      // mode chosen on the public landing (Play Simulation / Live Deal)
      const pm = localStorage.getItem('credeals-pending-mode');
      if (pm === 'game' || pm === 'real') {
        next = { ...next, mode: pm };
        localStorage.removeItem('credeals-pending-mode');
      }
    } catch {
      /* ignore */
    }
    setState(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  // Continuous, pausable game clock (DESIGN §22 F): advances one simulated day every DAY_MS while
  // in game mode, a difficulty is chosen, and the clock isn't paused. Pausing freezes it; the day
  // persists so you resume where you left.
  useEffect(() => {
    if (!hydrated) return;
    if (state.mode !== 'game' || !state.difficulty || state.clockPaused) return;
    const ms = Math.max(0.25, state.clockMinutesPerDay) * 60_000;
    const t = setInterval(() => setState((s) => ({ ...s, day: s.day + 1 })), ms);
    return () => clearInterval(t);
  }, [hydrated, state.mode, state.difficulty, state.clockPaused, state.clockMinutesPerDay]);

  // When Supabase is configured: load the signed-in user's profile (is_admin) + their deals.
  // Session/user identity comes from the cookie (see token.ts) to avoid the supabase-js
  // getSession() init hang; queries go through the data client (RLS via the cookie JWT).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    (async () => {
      const sess = readCookieSession();
      if (!sess) {
        if (active) {
          setState((s) => ({ ...s, isAdmin: false }));
          setDbDeals(null);
        }
        return;
      }
      try {
        const { data: prof } = await dataClient().from('profiles').select('is_admin').eq('id', sess.userId).single();
        if (active && prof) setState((s) => ({ ...s, isAdmin: !!(prof as { is_admin?: boolean }).is_admin }));
      } catch {
        /* ignore */
      }
      try {
        const { deals, stages } = await listDeals();
        if (active) {
          setDbDeals(deals);
          setDbStages(stages);
        }
      } catch {
        if (active) setDbDeals([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const configured = isSupabaseConfigured();
    const deals = configured ? (dbDeals ?? []) : [...state.customDeals, ...SEED_DEALS];
    const statusOf = (id: string): DealStatus =>
      configured ? (dbStages[id] ?? 'new') : (state.dealStates[id]?.status ?? 'new');

    function chargePursuit(dealId: string, status: DealStatus, prev: DealStatus) {
      // Passing napkin → detailed UW commits real third-party/diligence spend (game mode).
      if (status === 'detailed' && prev !== 'detailed' && state.mode === 'game') {
        setState((s) => ({
          ...s,
          treasury: {
            ...s.treasury,
            events: [
              ...s.treasury.events,
              { id: `${dealId}-pursuit-${Date.now()}`, day: s.day, label: `Pursuit costs — ${dealId} (reports, legal)`, amount: -PURSUIT_COST },
            ],
          },
        }));
      }
    }

    function setStatus(dealId: string, status: DealStatus) {
      const prev = statusOf(dealId);
      if (prev === status) return;
      chargePursuit(dealId, status, prev);
      if (configured) {
        setDbStages((m) => ({ ...m, [dealId]: status })); // optimistic
        updateDealStage(dealId, status).catch(() => {}); // RLS blocks non-editors — refined with user-assignment
      } else {
        setState((s) => ({
          ...s,
          dealStates: { ...s.dealStates, [dealId]: { ...s.dealStates[dealId], dealId, status } },
        }));
      }
    }

    return {
      ...state,
      deals,
      cashBalance: treasuryBalance(state.treasury) - CARRY_PER_DAY * Math.max(0, state.day - 1),
      setMode: (mode) => setState((s) => ({ ...s, mode })),
      setAdmin: (v) => setState((s) => ({ ...s, isAdmin: v })),
      setMarket: (m) => setState((s) => ({ ...s, game: { ...s.game, market: m } })),
      startGame: (d, minutesPerDay) =>
        setState((s) => ({
          ...s,
          difficulty: d,
          clockPaused: false,
          clockMinutesPerDay: minutesPerDay ?? s.clockMinutesPerDay,
          treasury: { ...s.treasury, startingBalance: DIFFICULTY_INFO[d].startingCash },
        })),
      setClockPaused: (v) => setState((s) => ({ ...s, clockPaused: v })),
      setClockSpeed: (minutesPerDay) => setState((s) => ({ ...s, clockMinutesPerDay: minutesPerDay })),
      setSelectedDeal: (id) => setState((s) => ({ ...s, selectedDealId: id })),
      applyGameOutcome: (o) =>
        setState((s) => {
          const treasuryEvents = [...s.treasury.events];
          if (o.cashDelta) {
            treasuryEvents.push({
              id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              day: s.day,
              label: o.cashLabel ?? o.event?.title ?? 'Game event',
              amount: o.cashDelta,
            });
          }
          const log = o.event
            ? [
                { id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), dealId: o.dealId, ...o.event },
                ...s.game.log,
              ].slice(0, 50)
            : s.game.log;
          return {
            ...s,
            treasury: { ...s.treasury, events: treasuryEvents },
            game: {
              ...s.game,
              reputation: o.repDelta ? applyRep(s.game.reputation, o.repDelta) : s.game.reputation,
              dealsClosed: s.game.dealsClosed + (o.closed ? 1 : 0),
              dealsPursued: s.game.dealsPursued + (o.pursued ? 1 : 0),
              log,
            },
          };
        }),
      updateBuyBox: (patch) => setState((s) => ({ ...s, buyBox: { ...s.buyBox, ...patch } })),
      approveBuyBox: () => setState((s) => ({ ...s, buyBoxApproved: true })),
      editBuyBox: () => setState((s) => ({ ...s, buyBoxApproved: false })),
      statusOf,
      setStatus,
      overridesOf: (id) => state.dealStates[id]?.napkinOverrides ?? {},
      setOverride: (dealId, patch) =>
        setState((s) => ({
          ...s,
          dealStates: {
            ...s.dealStates,
            [dealId]: {
              ...s.dealStates[dealId],
              dealId,
              status: s.dealStates[dealId]?.status ?? 'new',
              napkinOverrides: { ...s.dealStates[dealId]?.napkinOverrides, ...patch },
            },
          },
        })),
      resetOverrides: (dealId) =>
        setState((s) => ({
          ...s,
          dealStates: {
            ...s.dealStates,
            [dealId]: {
              ...s.dealStates[dealId],
              dealId,
              status: s.dealStates[dealId]?.status ?? 'new',
              napkinOverrides: {},
            },
          },
        })),
      addDeal: async (deal) => {
        if (configured) {
          const created = await insertDeal(deal);
          setDbDeals((prev) => [created, ...(prev ?? [])]);
          setDbStages((m) => ({ ...m, [created.id]: 'new' }));
          return created.id;
        }
        setState((s) => ({
          ...s,
          customDeals: [deal, ...s.customDeals],
          dealStates: { ...s.dealStates, [deal.id]: { dealId: deal.id, status: 'new' } },
        }));
        return deal.id;
      },
      commentsOf: (id) => state.comments[id] ?? [],
      addComment: (dealId, text, opts) =>
        setState((s) => ({
          ...s,
          comments: {
            ...s.comments,
            [dealId]: [
              ...(s.comments[dealId] ?? []),
              {
                id: `${dealId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                author: opts?.author ?? 'You',
                text,
                ts: Date.now(),
                parentId: opts?.parentId,
              },
            ],
          },
        })),
      toggleLike: (dealId, commentId, who = 'You') =>
        setState((s) => ({
          ...s,
          comments: {
            ...s.comments,
            [dealId]: (s.comments[dealId] ?? []).map((c) => {
              if (c.id !== commentId) return c;
              const likes = c.likes ?? [];
              return { ...c, likes: likes.includes(who) ? likes.filter((x) => x !== who) : [...likes, who] };
            }),
          },
        })),
      filesOf: (id) => state.files[id] ?? [],
      addFiles: (dealId, newFiles) =>
        setState((s) => ({
          ...s,
          files: { ...s.files, [dealId]: [...(s.files[dealId] ?? []), ...newFiles] },
        })),
      peopleOf: (id) => state.people[id] ?? [],
      addPerson: (dealId, person) =>
        setState((s) => ({ ...s, people: { ...s.people, [dealId]: [...(s.people[dealId] ?? []), person] } })),
      updatePerson: (dealId, id, patch) =>
        setState((s) => ({
          ...s,
          people: { ...s.people, [dealId]: (s.people[dealId] ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) },
        })),
      removePerson: (dealId, id) =>
        setState((s) => ({ ...s, people: { ...s.people, [dealId]: (s.people[dealId] ?? []).filter((p) => p.id !== id) } })),
      resetAll: () => setState(INITIAL),
    };
  }, [state, hydrated, dbDeals, dbStages]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
