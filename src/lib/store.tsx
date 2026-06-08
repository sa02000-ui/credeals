'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from './supabase/config';
import { createClient } from './supabase/client';
import {
  DEFAULT_BUY_BOX,
  SEED_DEALS,
  treasuryBalance,
  type BuyBox,
  type CashEvent,
  type DealComment,
  type DealFile,
  type DealState,
  type DealStatus,
  type MarketDeal,
  type NapkinOverrides,
  type SimMode,
  type TreasuryState,
} from './sim';

const STARTING_CASH = 250_000;
const PURSUIT_COST = 7_500;

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
  treasury: TreasuryState;
  day: number;
}

const INITIAL: AppState = {
  mode: 'game',
  isAdmin: false,
  buyBox: DEFAULT_BUY_BOX,
  buyBoxApproved: false,
  dealStates: {},
  customDeals: [],
  comments: {},
  files: {},
  treasury: { startingBalance: STARTING_CASH, events: [] },
  day: 1,
};

interface AppContextValue extends AppState {
  deals: MarketDeal[];
  cashBalance: number;
  setMode: (m: SimMode) => void;
  setAdmin: (v: boolean) => void;
  updateBuyBox: (patch: Partial<BuyBox>) => void;
  approveBuyBox: () => void;
  editBuyBox: () => void;
  statusOf: (dealId: string) => DealStatus;
  setStatus: (dealId: string, status: DealStatus) => void;
  overridesOf: (dealId: string) => Partial<NapkinOverrides>;
  setOverride: (dealId: string, patch: Partial<NapkinOverrides>) => void;
  resetOverrides: (dealId: string) => void;
  addDeal: (deal: MarketDeal) => void;
  commentsOf: (dealId: string) => DealComment[];
  addComment: (dealId: string, text: string, opts?: { author?: string; parentId?: string }) => void;
  filesOf: (dealId: string) => DealFile[];
  addFiles: (dealId: string, files: DealFile[]) => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const LS_KEY = 'cre-sim-state-v3';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);

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

  // When Supabase is configured, the signed-in user's profile.is_admin drives admin tools.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let active = true;
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setState((s) => ({ ...s, isAdmin: false }));
        return;
      }
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (active && data) setState((s) => ({ ...s, isAdmin: !!data.is_admin }));
    }
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const deals = [...state.customDeals, ...SEED_DEALS];
    const statusOf = (id: string) => state.dealStates[id]?.status ?? 'new';

    function setStatus(dealId: string, status: DealStatus) {
      setState((s) => {
        const prev = s.dealStates[dealId]?.status ?? 'new';
        const events = [...s.treasury.events];
        // Passing napkin → detailed UW commits real third-party/diligence spend (game mode).
        if (status === 'detailed' && prev !== 'detailed' && s.mode === 'game') {
          const ev: CashEvent = {
            id: `${dealId}-pursuit-${Date.now()}`,
            day: s.day,
            label: `Pursuit costs — ${dealId} (reports, legal)`,
            amount: -PURSUIT_COST,
          };
          events.push(ev);
        }
        return {
          ...s,
          dealStates: { ...s.dealStates, [dealId]: { ...s.dealStates[dealId], dealId, status } },
          treasury: { ...s.treasury, events },
        };
      });
    }

    return {
      ...state,
      deals,
      cashBalance: treasuryBalance(state.treasury),
      setMode: (mode) => setState((s) => ({ ...s, mode })),
      setAdmin: (v) => setState((s) => ({ ...s, isAdmin: v })),
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
      addDeal: (deal) =>
        setState((s) => ({
          ...s,
          customDeals: [deal, ...s.customDeals],
          dealStates: { ...s.dealStates, [deal.id]: { dealId: deal.id, status: 'new' } },
        })),
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
      filesOf: (id) => state.files[id] ?? [],
      addFiles: (dealId, newFiles) =>
        setState((s) => ({
          ...s,
          files: { ...s.files, [dealId]: [...(s.files[dealId] ?? []), ...newFiles] },
        })),
      resetAll: () => setState(INITIAL),
    };
  }, [state, hydrated]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
