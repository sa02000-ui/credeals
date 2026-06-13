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
  PROFILE_CONFIGS,
  INITIAL_PLAYER_MODEL,
  updatePlayerModel,
  generateSessionSeed,
  newRelationship,
  recordInteraction,
  type Difficulty,
  type ExperienceProfile,
  type CoachingMode,
  type SessionSeed,
  type PlayerModel,
  type DealDNA,
  type AMRunState,
  type AMEffect,
  type CoachMessage,
  type CounterpartyRelationship,
  type InteractionType,
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

/** Experience profile → the existing difficulty knob that gates scenario/closing harshness. */
const PROFILE_TO_DIFFICULTY: Record<ExperienceProfile, Difficulty> = {
  'brand-new': 'guided', studied: 'guided', 'some-experience': 'standard', mixed: 'standard', expert: 'expert',
};

// Single source of truth for the default starting cash: the Standard difficulty (game start
// overrides it per chosen difficulty). Keeps store + DIFFICULTY_INFO aligned.
const STARTING_CASH = DIFFICULTY_INFO.standard.startingCash;
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
  /** admin-only features (persona tuning, admin console). Set EXCLUSIVELY from the signed-in user's
   * Supabase profiles.is_admin (loaded server-side via the cookie session) — never from a URL param,
   * env flag, or client toggle, so the security posture is identical on every platform. Every
   * privileged action is independently re-verified on the server (requireAdmin). */
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

  // --- Game-design layer (Replit doc) ---
  experienceProfile: ExperienceProfile | null;
  onboardingComplete: boolean;
  coachingMode: CoachingMode;
  carryPerDay: number;
  sessionSeed: SessionSeed | null;
  playerModel: PlayerModel;
  dealDNA: Record<string, DealDNA>;
  amStates: Record<string, AMRunState>;
  relationships: Record<string, CounterpartyRelationship>;
  coachMessages: CoachMessage[];
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
  experienceProfile: null,
  onboardingComplete: false,
  coachingMode: 'full',
  carryPerDay: CARRY_PER_DAY,
  sessionSeed: null,
  playerModel: INITIAL_PLAYER_MODEL,
  dealDNA: {},
  amStates: {},
  relationships: {},
  coachMessages: [],
};

interface AppContextValue extends AppState {
  deals: MarketDeal[];
  cashBalance: number;
  /** admin feature flag: is game mode visible to users at all */
  gameEnabled: boolean;
  /** last failed background sync (e.g. RLS-blocked write); null when clear */
  syncError: string | null;
  clearSyncError: () => void;
  // --- Game-design layer ---
  setExperienceProfile: (profile: ExperienceProfile, minutesPerDay?: number) => void;
  completeOnboarding: () => void;
  updateDealDNA: (dealId: string, patch: Partial<DealDNA>) => void;
  updateRelationship: (personaId: string, type: InteractionType, dealId: string, note: string) => void;
  addCoachMessage: (message: Omit<CoachMessage, 'id' | 'ts'>) => void;
  initAMState: (dealId: string, occupancy: number, noi: number) => void;
  applyAMEffect: (dealId: string, effect: AMEffect, quarter: number, cardId: string, optionId: string) => void;
  advanceAMQuarter: (dealId: string, distribution: number) => void;
  /** finalize a deal at exit: record projected/actual returns + roll the result into the player model (once) */
  finalizeExit: (dealId: string, projectedIRR: number, actualIRR: number) => void;
  setMode: (m: SimMode) => void;
  setMarket: (m: MarketCondition) => void;
  startGame: (d: Difficulty, minutesPerDay?: number) => void;
  setClockPaused: (v: boolean) => void;
  setClockSpeed: (minutesPerDay: number) => void;
  setSelectedDeal: (id: string | null) => void;
  /** advance the simulated clock by n days (actions cost time — DESIGN §22 F) */
  advanceDays: (n: number) => void;
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
  const [gameEnabled, setGameEnabled] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Global feature flags (admin-controlled): is game mode visible at all?
  useEffect(() => {
    let on = true;
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => { if (on && j?.ok) setGameEnabled(j.settings?.gameEnabled !== false); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  // When the game is switched off and the user isn't an admin, force real mode.
  useEffect(() => {
    if (!hydrated) return;
    if (!gameEnabled && !state.isAdmin && state.mode === 'game') {
      setState((s) => ({ ...s, mode: 'real' }));
    }
  }, [hydrated, gameEnabled, state.isAdmin, state.mode]);

  useEffect(() => {
    let next: AppState = INITIAL;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) next = { ...INITIAL, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    try {
      // SECURITY: admin is never granted on the client. No URL param, no env/platform special-casing.
      // Force it false on load (so a stale persisted flag can't linger); the server-backed profile
      // load below re-grants it only if the signed-in user is genuinely an admin. Same on every platform.
      next = { ...next, isAdmin: false };
      // migrate players who started before onboarding existed: a chosen difficulty means they're past it
      if (next.difficulty && !next.onboardingComplete) next = { ...next, onboardingComplete: true };
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
    const t = setInterval(
      () =>
        setState((s) => {
          const day = s.day + 1;
          // mid-game market shift (design doc Part 4, layer 4): fires once on its seeded day
          const seed = s.sessionSeed;
          if (seed && day >= seed.marketShiftDay && s.game.market !== seed.marketShiftTo) {
            const note = { id: `mkt-${Date.now()}`, ts: Date.now(), title: `Market shifted to ${seed.marketShiftTo}`, detail: `The capital markets turned ${seed.marketShiftTo} around day ${day}. Cap rates, rents, and equity availability move with it.`, lesson: 'Markets move under you mid-hold — the same financing call can be right in one cycle and wrong in the next.' };
            return { ...s, day, game: { ...s.game, market: seed.marketShiftTo, log: [note, ...s.game.log].slice(0, 50) } };
          }
          return { ...s, day };
        }),
      ms,
    );
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
    // Game and Real are separate worlds: each mode only sees its own deals (deals.sim_mode).
    const allDeals = configured ? (dbDeals ?? []) : [...state.customDeals, ...SEED_DEALS];
    const deals = allDeals.filter((d) => (d.simMode ?? 'game') === state.mode);
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

    // Advancing a stage consumes simulated days (real work takes real time — owner 2026-06-10:
    // "I was at day 1 and reached asset management; that never happens"). The C2C decision deck
    // and scenario effects add their own days on top of these base costs.
    const STAGE_DAY_COST: Partial<Record<DealStatus, number>> = { detailed: 2, loi: 3, c2c: 2 };

    function setStatus(dealId: string, status: DealStatus) {
      const prev = statusOf(dealId);
      if (prev === status) return;
      chargePursuit(dealId, status, prev);
      const dayCost = STAGE_DAY_COST[status] ?? 0;
      if (dayCost > 0 && state.mode === 'game') {
        setState((s) => ({ ...s, day: s.day + dayCost }));
      }
      if (configured) {
        setDbStages((m) => ({ ...m, [dealId]: status })); // optimistic
        updateDealStage(dealId, status).catch(() => {
          // RLS blocked the write (e.g. not an editor on this deal) — roll back so the UI doesn't
          // lie, and surface why.
          setDbStages((m) => ({ ...m, [dealId]: prev }));
          setSyncError("Couldn't save that stage change — you may not have edit access to this deal.");
        });
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
      cashBalance: treasuryBalance(state.treasury) - state.carryPerDay * Math.max(0, state.day - 1),
      setMode: (mode) => setState((s) => ({ ...s, mode })),
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
      advanceDays: (n) => { if (n > 0) setState((s) => ({ ...s, day: s.day + Math.round(n) })); },
      gameEnabled,
      syncError,
      clearSyncError: () => setSyncError(null),
      setExperienceProfile: (profile, minutesPerDay) =>
        setState((s) => {
          const cfg = PROFILE_CONFIGS[profile];
          return {
            ...s,
            experienceProfile: profile,
            difficulty: PROFILE_TO_DIFFICULTY[profile],
            coachingMode: cfg.coachingMode,
            carryPerDay: cfg.carryPerDay,
            clockPaused: false,
            clockMinutesPerDay: minutesPerDay ?? s.clockMinutesPerDay,
            treasury: { ...s.treasury, startingBalance: cfg.startingCash },
            sessionSeed: s.sessionSeed ?? generateSessionSeed(Math.max(40, SEED_DEALS.length)),
          };
        }),
      completeOnboarding: () => setState((s) => ({ ...s, onboardingComplete: true })),
      updateDealDNA: (dealId, patch) =>
        setState((s) => {
          const prev = s.dealDNA[dealId];
          const base: DealDNA = prev ?? {
            dealId, uwScore: 2, brokerRelAtLOI: 50, sellerPersonaId: '', brokerPersonaId: '', psaCatchScore: 0,
            ddDepth: 'moderate', lenderChosen: '', raiseStructure: 'solo', businessPlan: 'value-add', closingScore: 0, amDecisions: [],
          };
          return { ...s, dealDNA: { ...s.dealDNA, [dealId]: { ...base, ...patch } } };
        }),
      updateRelationship: (personaId, type, dealId, note) =>
        setState((s) => {
          const rel = s.relationships[personaId] ?? newRelationship(personaId);
          return { ...s, relationships: { ...s.relationships, [personaId]: recordInteraction(rel, type, dealId, note, s.day) } };
        }),
      addCoachMessage: (message) =>
        setState((s) => ({
          ...s,
          coachMessages: [...s.coachMessages, { ...message, id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now() }].slice(-100),
        })),
      initAMState: (dealId, occupancy, noi) =>
        setState((s) =>
          s.amStates[dealId]
            ? s
            : { ...s, amStates: { ...s.amStates, [dealId]: { dealId, quarter: 1, occupancy, noiCurrent: noi, activeFlags: [], decisions: [], cashFlowHistory: [] } } },
        ),
      applyAMEffect: (dealId, effect, quarter, cardId, optionId) =>
        setState((s) => {
          const am = s.amStates[dealId];
          if (!am) return s;
          const treasury = effect.cash
            ? { ...s.treasury, events: [...s.treasury.events, { id: `am-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, day: s.day, label: `${cardId} — AM`, amount: effect.cash }] }
            : s.treasury;
          const flags = new Set(am.activeFlags);
          if (effect.setFlag) flags.add(effect.setFlag);
          if (effect.clearFlag) flags.delete(effect.clearFlag);
          const next: AMRunState = {
            ...am,
            occupancy: Math.max(0, Math.min(1, am.occupancy + (effect.occupancyDelta ?? 0))),
            noiCurrent: (am.noiCurrent + (effect.noiDelta ?? 0)) * (effect.performanceFactor ?? 1),
            activeFlags: Array.from(flags),
            decisions: [...am.decisions, { quarter, cardId, optionId, effects: effect, day: s.day }],
          };
          return {
            ...s,
            treasury,
            day: s.day + (effect.days ?? 0),
            game: effect.rep ? { ...s.game, reputation: applyRep(s.game.reputation, effect.rep) } : s.game,
            amStates: { ...s.amStates, [dealId]: next },
          };
        }),
      advanceAMQuarter: (dealId, distribution) =>
        setState((s) => {
          const am = s.amStates[dealId];
          if (!am) return s;
          const next: AMRunState = { ...am, quarter: am.quarter + 1, cashFlowHistory: [...am.cashFlowHistory, { quarter: am.quarter, amount: distribution }] };
          return { ...s, day: s.day + 90, amStates: { ...s.amStates, [dealId]: next } };
        }),
      finalizeExit: (dealId, projectedIRR, actualIRR) =>
        setState((s) => {
          const prev = s.dealDNA[dealId];
          if (prev?.exitDay != null) return s; // already finalized — don't double-count
          const base: DealDNA = prev ?? {
            dealId, uwScore: 2, brokerRelAtLOI: 50, sellerPersonaId: '', brokerPersonaId: '', psaCatchScore: 0,
            ddDepth: 'moderate', lenderChosen: '', raiseStructure: 'solo', businessPlan: 'value-add', closingScore: 0, amDecisions: [],
          };
          const dna: DealDNA = { ...base, projectedIRR, actualIRR, exitDay: s.day };
          return { ...s, dealDNA: { ...s.dealDNA, [dealId]: dna }, playerModel: updatePlayerModel(s.playerModel, dna) };
        }),
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
  }, [state, hydrated, dbDeals, dbStages, gameEnabled, syncError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
