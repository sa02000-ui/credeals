# CRE Deals Simulator PRD (MVP)

## Objective
Ship a deterministic, replayable CRE lifecycle simulator that trains both investment judgment and execution discipline across one complete deal run.

## Core loop
1. Source
2. Underwrite
3. LOI negotiation
4. DD + IC
5. Close + finance
6. Asset-manage + AM_Exit (refi / sale / forced exit)

## User outcomes
- Learn which decisions moved returns.
- Learn which decisions protected (or damaged) process/relationships.
- Re-run alternate paths quickly from debrief.

## Terminal outcomes (required)
- **Won:** Closed at least one deal, operated, and exited at/above projected return.
- **Pyrrhic:** Closed and exited, but materially under projection (positive but disappointing).
- **Lost:** Failed to close; still incurred deal friction losses (DD, appraisal, escrow, loan app fees).
- **Blown-up:** Closed but destroyed investor value from a combination of operations + external shocks.

## MVP scope
- Single active deal per run.
- 3-6 consequential decisions per phase.
- Terminal outcomes: Won, Pyrrhic, Lost, BlownUp.
- Debrief includes:
  - decision replay
  - dual score (investment + execution)
  - one-click sensitivity/alternate-path probes

## Functional requirements

### Sourcing
- Present multiple opportunities with fit and hidden risk variance.
- Time passes with pass/no-action.

### Underwrite
- Editable assumptions drive valuation/returns.
- Gate to LOI requires go/no-go.

### LOI
- Counterparty utility model controls accept/counter/reject.
- Price + certainty + speed + reputation all matter.

### DD + IC
- Task and risk discovery system.
- IC gate required before close.

### Close + Finance
- Debt/equity dependencies can block close.
- Timing and certainty affect outcome quality.
- Financial baseline includes explicit loan assumptions (terms, refinance path, debt-service burden).

### AM + Exit
- Quarterly operating decisions mutate NOI/risk.
- Exit timing determines realized result.
- Introduce explicit **Exit_Buyer** counterparty in AM_Exit.
- Exit choices include sale, refinance hold, and forced-loss paths.

### Debrief
- Show modeled vs realized.
- Show dual score and component signals.
- Offer quick alternate-path simulations.
- Show outcome class (Won/Pyrrhic/Lost/Blown-up) with top causal factors.

## Non-goals (MVP)
- Multiplayer collaboration.
- Real CRM integrations.
- Full legal document automation.

## Success criteria
1. Deterministic mode: same seed + same choices => same outcome.
2. Optional variability mode: same seed + same choices can diverge due to stochastic external shocks.
3. Every phase has at least 3 meaningful decisions (higher density in LOI + AM).
4. Non-win outcomes occur often enough to teach (target >=30%).
5. Debrief is available for every terminal outcome.

## Required score dimensions (MVP+)
- Investment and execution dual score remains primary.
- Add **Property Score** (asset quality/age/capex profile proxy) and **Area Score** (crime/income/weather exposure proxy) as explicit debrief inputs.

## External risk/shock model (required)
- Hidden truth layer includes market, weather, and geopolitical exposure.
- Supported shock families:
  - market move (positive or negative),
  - weather events (negative by default, can become positive if managed well),
  - geopolitical shocks (tail-risk macro events).
