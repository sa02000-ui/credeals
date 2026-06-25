# CRE Deals Simulator PRD (MVP)

## Objective
Ship a deterministic, replayable CRE lifecycle simulator that trains both investment judgment and execution discipline across one complete deal run.

## Core loop
1. Source
2. Underwrite
3. LOI negotiation
4. DD + IC
5. Close + finance
6. Asset-manage + exit

## User outcomes
- Learn which decisions moved returns.
- Learn which decisions protected (or damaged) process/relationships.
- Re-run alternate paths quickly from debrief.

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

### AM + Exit
- Quarterly operating decisions mutate NOI/risk.
- Exit timing determines realized result.

### Debrief
- Show modeled vs realized.
- Show dual score and component signals.
- Offer quick alternate-path simulations.

## Non-goals (MVP)
- Multiplayer collaboration.
- Real CRM integrations.
- Full legal document automation.

## Success criteria
1. Same seed + same choices => same outcome.
2. Every phase has at least 3 meaningful decisions.
3. Non-win outcomes occur often enough to teach (target >=30%).
4. Debrief is available for every terminal outcome.
