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

Important parallel-work note:
- Another agent may be changing distribution/waterfall model logic.
- Avoid editing distribution math areas unless absolutely required for integration.
- Prefer game/simulation progression, state machine, deterministic events, scoring/debrief, and content pipeline.

Next implementation priorities:
1) Add explicit phase-transition guard module for the 6-phase loop with terminal states.
2) Ensure deterministic branching for all weighted choices in game/simulation paths.
3) Expand scenario/content packs with template-driven structure per phase.
4) Add replay/decision-log hooks needed for debrief timeline.
5) Add tests:
   - transition validity
   - deterministic replay parity
   - branch threshold/utility sanity

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
- prefer deterministic seeded behavior over non-deterministic randomness
