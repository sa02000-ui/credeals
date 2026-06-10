# Scenario authoring guide

This is the structure you fill in to add **deep, branching scenarios** anywhere in the game. The engine
(`src/lib/sim/scenarios.ts` + `ScenarioRunner.tsx`) plays them. You write a small decision tree; the player
walks it; choices apply effects (cash / time / reputation / flags) and branch to the next step — including
**uncertain** outcomes (e.g. "seller accepts 60% / refuses 40%"). Chaining steps = many layers of depth.

You don't need to code. Fill in scenarios in the **table form** below (or hand them to me as prose) and I'll
translate them into the schema. The C2C deck (`buildC2CScenarios`) is a worked, live example — copy its shape.

---

## The pieces

- **Scenario** — one encounter. Has a `title`, an `entry` step, and a set of `steps`.
- **Step** — one prompt the player sees. Has a `speaker` (who's talking: Broker / Seller / Lender / your
  analyst…), a `prompt` (the situation/question), and a list of **options**.
- **Option** — a choice button. Has a `label`, optional `detail`, a `tone` (good / warn / bad), optional
  **effects**, a **result** narration, and where it goes **next** (another step id, or nothing = ends).
- **Effects** — what a choice does: `cash` (signed $; negative = cost), `days` (time used), `rep` (broker /
  lender / lp points), and `set` (raise named **flags** like `ddDone` that later logic reads).
- **Branch (uncertainty)** — instead of a fixed `next`, an option can have weighted **branches**; the engine
  rolls one. Each branch has its own `result`, `effects`, and `next`. This is how a retrade can be accepted
  or refused, an inspection can find a problem or not, a raise can come up short, etc.
- **requires** — show an option only if a flag is set (gate later choices on earlier ones).

---

## Authoring table (fill one block per step)

```
SCENARIO: <id>  —  <title>
  ENTRY STEP: <step id>

  STEP <id>  (speaker: <who>)
    PROMPT: <the situation / question>
    OPTION <id>  [tone: good|warn|bad]
      LABEL:   <button text>
      DETAIL:  <one-line helper, optional>
      EFFECTS: cash <$>, days <n>, rep <broker/lender/lp +/-n>, set <flagName>
      RESULT:  <narration after choosing>
      NEXT:    <step id>  | END
      -- OR, for an uncertain outcome, list branches instead of NEXT:
      BRANCH 60%: result "<...>"  effects <...>  next <step id|END>
      BRANCH 40%: result "<...>"  effects <...>  next <step id|END>
    OPTION ...
  STEP ...
```

---

## Worked example — appraisal retrade (already live, shows depth)

```
SCENARIO: appraisal — "The appraisal came in low"
  ENTRY: a1

  STEP a1 (Lender)
    PROMPT: The appraisal is ~4% under your contract price, opening a financing gap.
    OPTION retrade [warn]
      LABEL: Retrade the seller
      EFFECTS: rep broker -3, days 5
      BRANCH 60%: next a_accept  result "Seller agrees to lower the price to the appraised value."
      BRANCH 40%: next a_refuse  result "Seller refuses to retrade and calls your bluff."
    OPTION addequity [warn]
      LABEL: Add equity to cover the gap
      EFFECTS: cash -60000, set appraisalResolved
      RESULT: You keep the deal clean — but it costs more equity.  NEXT: END
    OPTION walk [bad]
      LABEL: Walk away
      EFFECTS: set walk
      RESULT: You walk to protect your capital.  NEXT: END

  STEP a_refuse (Seller)
    PROMPT: The seller held firm. Cover the gap or walk.
    OPTION cover [warn] → cash -65000, set appraisalResolved, END
    OPTION walk2 [bad]  → set walk, END
```

Flags this scenario raises (`appraisalResolved`, `walk`) are read by the closing logic: `walk` archives the
deal; `appraisalResolved` + `lenderCleared` = contingencies cleared.

---

## Where I need scenarios from you (each step of the lifecycle)

Author these in the table form and I'll wire them in. Aim for 3–8 steps each; more branches = more replay value.

1. **Onboarding / Buy box** — the pop-up that helps a new player set the buy box (asset class, market, size,
   price, return) with a sentence of "why" per question.
2. **Sourcing** — the "your AI agent found N deals" intro, and time-pressure events while underwriting
   (e.g. *"This deal just went under contract — archived; it may return to market"* if the player is slow).
3. **Napkin → LOI nudge** — broker pressure ("multiple LOIs in", "seller may go off-market") that escalates
   the longer the player takes.
4. **LOI negotiation** — the deep back-and-forth (3–11+ rounds). Author seller personalities + which terms
   they push (price, EMD, DD, close, contingencies), when they accept, when they reject outright (lowball),
   and the counters at each round. (This will extend the live negotiation, not just a scenario tree.)
5. **PSA redline** — clause-by-clause negotiation: which clauses the seller insists on, which they'll concede,
   and the counter-redline ladder. (Builds on the existing PSA clause library.)
6. **Contract-to-Close events** — more cards beyond the current 5 (title defects, environmental, tenant
   estoppel problems, rate-lock timing, partner drama…). Copy the C2C deck shape.
7. **Asset management** — operating surprises over the hold (big move-out, roof failure, tax reassessment,
   refi-vs-hold decision, the eventual sale).

The more of these you write in the table form above, the deeper and more educational the game gets — and the
engine already supports all of it.
