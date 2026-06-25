# Simulator Card Authoring Template (MVP)

Use this template for any new scenario card so content remains implementable, balanced, and testable.

---

## Card metadata
- `card_id`:
- `phase`: `sourcing | underwrite | loi | dd_ic | close_finance | am_exit`
- `title`:
- `archetype`: `info_reveal | tradeoff | shock | relationship | process`
- `difficulty_tags`: `guided | standard | expert`
- `trigger_conditions`:
- `status`: `draft | review | approved`

## Prompt
- Context:
- Player-facing decision prompt:
- Teaching objective:

## Options (2-4)
For each option:
- `option_id`:
- `label`:
- `detail` (optional):
- Immediate effects:
  - `cashDelta`:
  - `dayDelta`:
  - `repDelta` (`broker|lender|lp|seller`):
  - `setFlags`:
- Deferred consequences:
  - relationship memory change:
  - future-flow impact:
  - risk impact:
- `next_step` or weighted `branches`:

## Weighted branch format (if uncertain outcome)
- Branch A: weight, result, effects, next
- Branch B: weight, result, effects, next
- (weights should sum to a meaningful total; normalization happens in engine)

## Balance checks (required)
- [ ] No dominant always-correct option.
- [ ] At least one conservative and one aggressive path.
- [ ] Cost/time tradeoff is explicit.
- [ ] At least one consequence carries into a later phase.
- [ ] Narrative remains plausible for role and market context.

## QA checks (required)
- [ ] Valid ids and next-step references.
- [ ] Effects are numerically bounded and realistic.
- [ ] Works under all tagged difficulties.
- [ ] Teaching objective is clear in debrief language.

---

## Example skeleton
```yaml
card_id: loi-certainty-push-001
phase: loi
title: Seller pushes for certainty
archetype: relationship
difficulty_tags: [standard, expert]
trigger_conditions:
  - active_deal=true
  - stage=loi
prompt: Seller likes your price but questions certainty of close.
options:
  - option_id: harden-emd
    label: Increase EMD and harden after DD
    effect:
      cashDelta: -50000
      repDelta: { seller: 6, broker: 3 }
      setFlags: { emd_hardened: true }
    next_step: loi-response
  - option_id: hold-line
    label: Hold terms and push timeline
    effect:
      dayDelta: -1
      repDelta: { seller: -3, broker: -1 }
    next_step: loi-response
```
