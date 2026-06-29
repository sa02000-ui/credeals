# Claude continuation prompt (simulator/game track)

Use this when handing off work to Claude so it can continue implementation directly in code (no Jira/Notion required).

---

## Copy/paste prompt

```text
You are continuing implementation of the CRE simulator/game in the `sa02000-ui/credeals` repository.

Hard requirements:
1) Work only in this repo.
2) Commit + push to GitHub at the end of EVERY iteration.
3) Keep pull request updated each iteration.
4) Do not require Jira/Notion; all planning/tracking stays in-repo.

First, verify context:
- Remote must include: sa02000-ui/credeals
- Read these docs before coding:
  - docs/product/simulator-prd-mvp.md
  - docs/engineering/simulator-technical-spec-mvp.md
  - docs/content/simulator-card-authoring-template.md
  - docs/handoffs/claude-continuation-prompt.md

Current simulator baseline already added:
- Deterministic seed helpers in `src/lib/sim/sessionSeed.ts`
- Deterministic AM branch selection in `src/components/AMPhase.tsx`
- Debrief module in `src/lib/sim/debrief.ts`
- Debrief UI upgrades in `src/components/CalibrationReview.tsx`
- Tests in `src/lib/sim/__tests__/debrief.test.ts`
- AM_Exit terminal outcome + shock engine in `src/lib/sim/exitEngine.ts`
- Exit-buyer persona additions in `src/lib/sim/personas.ts`
- Explicit stage transition guard in `src/lib/sim/phaseTransitions.ts` (wired in store `setStatus`)
- Expanded LOI storylets in `buildLOIScenarios` (competition + certainty proof + EMD pressure)
- Expanded AM shock content (market/weather/geopolitical) in `src/lib/sim/amCards.ts`
- Added tests for phase transitions and content (`phaseTransitions.test.ts`, updates in `gameDesign.test.ts`)
- Dynamic broker-call ad-lib engine (`evaluateBrokerAdlib`) with typed + microphone input in `BrokerCallModal`
- LOI storylets now seller-persona-sensitive (`loi-seller-style-read`) and LOI modal includes approach + custom note
- PSA flow now includes post-redline negotiation recovery (`resolvePSANegotiation`) before signing
- AM UI now includes risk radar + next-quarter uncertainty signal + variable card volume
- Added tests for broker ad-lib + PSA negotiation (`brokerAndPsa.test.ts`)
- Game-feel sprint pass:
  - Objective HUD now includes progress bar + outcome board + pressure meter
  - TopBar includes momentum/quest indicators
  - Deal feed urgency badge now pulses at near-expiry
  - Notification toasts now use event-specific tone and urgency pulse

Important parallel-work note:
- Another agent may be changing distribution/waterfall model logic.
- Avoid editing distribution math areas unless absolutely required for integration.
- Prefer game/simulation progression, state machine, deterministic events, scoring/debrief, and content pipeline.

Next implementation priorities:
1) Expand AM_Exit:
   - include loan baseline in attribution,
   - include market/weather/geopolitical shock tags,
   - include Exit_Buyer utility model.
2) Increase visual game feel:
   - stronger encounter visuals/animation,
   - richer feedback loops for wins/losses,
   - improve transitions/motion and phase completion celebration.
3) Ensure deterministic branching for all weighted choices in game/simulation paths.
4) Implement optional variability mode (`deterministic|stochastic`) for external-factor divergence.
5) Expand scenario/content packs with template-driven structure per phase (denser LOI + AM decisions + broker variety).
6) Add replay/decision-log hooks needed for debrief timeline.
7) Add tests:
   - transition validity
   - deterministic replay parity
   - branch threshold/utility sanity
   - exit classifier and shock attribution
   - property/area score bounds

Git process per iteration:
- Keep branch focused.
- Run tests/build for touched areas.
- `git add`, `git commit`, `git push`.
- Update PR before reporting.
- Include commit hash in summary.

Deliverable format each iteration:
- What was implemented
- Files changed
- Validation run results
- Risks/conflicts to watch next
```

---

If needed, also tell Claude:
- keep all handoff artifacts in `/docs`
- add/update tests whenever behavior changes
- deterministic mode must remain replay-stable; stochastic mode is optional and explicitly flagged
