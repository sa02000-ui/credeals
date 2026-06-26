# CRE Simulator Technical Spec (MVP)

## Architecture
- UI: Next.js + React components.
- Core simulation: pure TypeScript modules in `src/lib/sim`.
- Content: scenario/card JSON + TypeScript builders.
- Persistence: local + Supabase-backed app state.
- Replay/debrief: derived from deterministic state + decision history.

## Engine principles
1. Deterministic reducer-like transitions.
2. Hidden utility-based counterparties (not random dialogue trees).
3. Stateful consequences (reputation, flags, relationship memory).
4. Pure functions for all math/outcome logic.

## Core state domains
- Run context: day/phase/seed/difficulty.
- Deal state: stage, assumptions, financing, lifecycle artifacts.
- Counterparty state: utility weights + memory (broker, lender, LP, seller, exit_buyer).
- Player state: reputation, tendency model, weak spots, lessons.
- Outcome state: projected vs realized returns, close quality, debrief artifacts.

## Determinism requirements
- Seeded RNG only; no `Math.random()` in simulation path.
- Any weighted branch must be seeded by run/deal/phase identifiers.
- Replay with same seed + decisions must produce identical outputs.

## Variability requirements
- Add a runtime flag: `variabilityMode = deterministic | stochastic`.
- Deterministic mode obeys strict replay parity.
- Stochastic mode permits macro/external divergence in AM_Exit while preserving bounded outputs and explainable shock attribution.

## AM_Exit requirements
- Introduce explicit terminal classifier:
  - `won | pyrrhic | lost | blown-up`
- Introduce explicit `Exit_Buyer` counterparty model for sale path.
- Financial baseline must include loan terms and debt-service context for outcome attribution.

## Scoring requirements
- Dual score at debrief:
  - Investment outcome score (returns/risk/downside/capital efficiency)
  - Execution quality score (process/relationships/ethics/time discipline)
- Persist score components for explainability.
- Persist and surface:
  - Property score (0..100)
  - Area score (0..100)
  - External shock metadata (type, direction, impact)

## Debrief requirements
- Baseline modeled vs realized output.
- One-click alternate-path probes:
  - Rates +100bps
  - Rents -5%
  - CapEx +15%
  - Exit cap +50bps
- Show score deltas under each probe.
- Show terminal outcome badge and top causal factors.
- Shock taxonomy in debrief:
  - market-move
  - weather-event
  - geopolitical-shock
  - interest-rate-shock

## Testing requirements
1. Deterministic replay test.
2. Utility threshold boundary tests (accept/counter/reject).
3. Financial sanity tests (bounded/finite outputs).
4. Debrief score/sensitivity tests.
5. Content reference integrity tests (no broken next-step links).
6. Exit classifier tests for won/pyrrhic/lost/blown-up edges.
7. Exit-shock reproducibility in deterministic mode.
8. Property/area score bounds tests.

## Delivery checkpoints
1. Deterministic branching parity across all phases.
2. Dual score integrated into debrief.
3. Alternate-path simulation integrated into debrief.
4. Content pack expanded phase-by-phase.
5. AM_Exit engine with terminal outcomes + shock attribution.
