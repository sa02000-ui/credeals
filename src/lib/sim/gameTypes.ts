/**
 * Game-design types (Replit design doc, June 2026) — the data model for the expanded simulation:
 * experience profiles, per-session randomization seed, the cross-deal player model, per-deal "DNA",
 * asset-management cards, the coach, and the counterparty relationship ledger.
 *
 * Kept separate from types.ts to avoid circular imports (it references MarketCondition/Reputation
 * from gameEngine and CounterpartyKind from personas, type-only).
 */

import type { MarketCondition, Reputation } from './gameEngine';
import type { CounterpartyKind } from './personas';
import type { AssetClass, DealStage } from './types';

// ── Player experience profile (chosen on Day 0) ──
export type ExperienceProfile = 'brand-new' | 'studied' | 'some-experience' | 'mixed' | 'expert';
export type CoachingMode = 'full' | 'on-demand' | 'after-mistakes' | 'silent';
export type DealQuality = 'forgiving' | 'realistic' | 'competitive' | 'adversarial';

export interface ProfileConfig {
  label: string;
  blurb: string;
  startingCash: number;
  carryPerDay: number;
  coachingMode: CoachingMode;
  dealQuality: DealQuality;
  maxSimultaneousDeals: number;
}

export const PROFILE_CONFIGS: Record<ExperienceProfile, ProfileConfig> = {
  'brand-new':       { label: 'Brand new',       blurb: 'Never done a deal. Generous capital, full coaching, forgiving counterparties.',       startingCash: 400_000, carryPerDay: 200, coachingMode: 'full',           dealQuality: 'forgiving',   maxSimultaneousDeals: 2 },
  'studied':         { label: 'Studied up',      blurb: 'Read the books, no reps yet. Coaching on demand, realistic counterparties.',          startingCash: 350_000, carryPerDay: 225, coachingMode: 'on-demand',      dealQuality: 'realistic',   maxSimultaneousDeals: 2 },
  'some-experience': { label: 'Some experience', blurb: 'A few deals under your belt. Coaching only after mistakes.',                            startingCash: 275_000, carryPerDay: 250, coachingMode: 'after-mistakes', dealQuality: 'realistic',   maxSimultaneousDeals: 3 },
  'mixed':           { label: 'Mixed results',   blurb: 'Some wins, some scars. Tighter capital, competitive market.',                          startingCash: 250_000, carryPerDay: 275, coachingMode: 'after-mistakes', dealQuality: 'competitive', maxSimultaneousDeals: 3 },
  'expert':          { label: 'Expert',          blurb: 'Seasoned operator. Lean capital, silent coach, adversarial counterparties.',           startingCash: 150_000, carryPerDay: 300, coachingMode: 'silent',         dealQuality: 'adversarial', maxSimultaneousDeals: 4 },
};

// ── Session seed (per-playthrough randomization) ──
export interface SessionSeed {
  value: number;
  dealPoolIndices: number[];
  curveballDeck: string[];
  curveballQuarters: number[];
  marketShiftDay: number;
  marketShiftTo: MarketCondition;
}

// ── Player model (accumulated across deals) ──
export interface PlayerModel {
  uwTendencyScores: number[];
  ddDiscipline: ('full' | 'moderate' | 'light')[];
  psaCatchScores: number[];
  negotiationStyles: string[];
  raiseStrategies: string[];
  modelVsActual: { uwedIRR: number; actualIRR: number }[];
  weakSpots: string[];
  lessonsDelivered: Record<string, number>;
}

// ── Deal DNA (accumulated within one deal lifecycle) ──
export interface AMDecisionLog {
  quarter: number;
  cardId: string;
  optionId: string;
  effects: AMEffect;
  day: number;
}

export interface DealDNA {
  dealId: string;
  uwScore: number;
  brokerRelAtLOI: number;
  sellerPersonaId: string;
  brokerPersonaId: string;
  psaCatchScore: number;
  ddDepth: 'full' | 'moderate' | 'light';
  lenderChosen: string;
  raiseStructure: 'solo' | 'partners' | 'co-gp';
  businessPlan: 'light-touch' | 'value-add' | 'heavy-value-add';
  closingScore: number;
  amDecisions: AMDecisionLog[];
  exitDay?: number;
  projectedIRR?: number;
  actualIRR?: number;
}

// ── Asset management ──
export type AMCardDeck = 'operations' | 'market' | 'capital' | 'relationship' | 'disposition';

export interface AMEffect {
  cash?: number;
  days?: number;
  rep?: Partial<Reputation>;
  setFlag?: string;
  clearFlag?: string;
  occupancyDelta?: number;
  noiDelta?: number;
  performanceFactor?: number;
}

export interface AMOption {
  id: string;
  label: string;
  detail?: string;
  tone: 'good' | 'warn' | 'bad';
  /** direct effects/result, OR omit and use weighted `branches` for an uncertain outcome */
  effects?: AMEffect;
  result?: string;
  lesson?: string;
  next?: string;
  branches?: { weight: number; result: string; effects: AMEffect; next?: string }[];
}

export interface AMCard {
  id: string;
  deck: AMCardDeck;
  title: string;
  prompt: string;
  speaker?: string;
  options: AMOption[];
  requires?: Partial<{ ddDepth: string; businessPlan: string; lenderChosen: string; uwScore: number }>;
  weightBoost?: { condition: Partial<DealDNA>; factor: number };
}

/** Per-deal asset-management run state (distinct from the AM reminders panel state). */
export interface AMRunState {
  dealId: string;
  quarter: number;
  occupancy: number;
  noiCurrent: number;
  activeFlags: string[];
  decisions: AMDecisionLog[];
  cashFlowHistory: { quarter: number; amount: number }[];
}

// ── Coach chat ──
export interface CoachMessage {
  id: string;
  from: 'player' | 'coach';
  text: string;
  ts: number;
  dealId?: string;
  phase?: DealStage;
  trigger?: string;
}

// ── Counterparty relationship ledger ──
export type InteractionType = 'closed-clean' | 'retraded' | 'lowballed' | 'slow-response' | 'full-dd' | 'ghosted' | 'referral-sent';

export interface CounterpartyRelationship {
  personaId: string;
  kind: CounterpartyKind;
  name: string;
  personalScore: number;
  interactionLog: { dealId: string; type: InteractionType; day: number; note: string }[];
  memoryFlags: string[];
  unlockedBehaviors: string[];
}

// ── UW aggressiveness ──
export interface UWAssumptions {
  rentVsMarket: number;
  expenseRatio: number;
  exitCapRate: number;
  capexPerUnit: number;
  vacancyStabilized: number;
}

export interface UWAggressivenessResult {
  score: number;
  dimensions: { rent: 1 | 2 | 3 | 4; expense: 1 | 2 | 3 | 4; exitCap: 1 | 2 | 3 | 4; capex: 1 | 2 | 3 | 4; vacancy: 1 | 2 | 3 | 4 };
  label: 'Very Conservative' | 'Conservative' | 'Market' | 'Aggressive' | 'Very Aggressive';
}

export type { AssetClass };
