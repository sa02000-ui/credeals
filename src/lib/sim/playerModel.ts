/**
 * Cross-deal player model (design doc Part 4): accumulates the player's tendencies (UW aggressiveness,
 * DD discipline, PSA catch rate, model-vs-actual gaps) and derives weak spots used to (a) target
 * future scenarios at their weaknesses and (b) gate how often a given coaching lesson repeats. Pure.
 */

import type { PlayerModel, DealDNA } from './gameTypes';

export const INITIAL_PLAYER_MODEL: PlayerModel = {
  uwTendencyScores: [], ddDiscipline: [], psaCatchScores: [], negotiationStyles: [],
  raiseStrategies: [], modelVsActual: [], weakSpots: [], lessonsDelivered: {},
};

export function updatePlayerModel(model: PlayerModel, dna: DealDNA): PlayerModel {
  const updated: PlayerModel = {
    ...model,
    uwTendencyScores: [...model.uwTendencyScores, dna.uwScore],
    ddDiscipline: [...model.ddDiscipline, dna.ddDepth],
    psaCatchScores: [...model.psaCatchScores, dna.psaCatchScore],
    raiseStrategies: [...model.raiseStrategies, dna.raiseStructure],
    modelVsActual:
      dna.projectedIRR !== undefined && dna.actualIRR !== undefined
        ? [...model.modelVsActual, { uwedIRR: dna.projectedIRR, actualIRR: dna.actualIRR }]
        : model.modelVsActual,
  };

  const weak = new Set(model.weakSpots);
  const avgUW = updated.uwTendencyScores.reduce((a, b) => a + b, 0) / Math.max(1, updated.uwTendencyScores.length);
  const avgMiss = updated.modelVsActual.length
    ? updated.modelVsActual.reduce((a, b) => a + (b.actualIRR - b.uwedIRR), 0) / updated.modelVsActual.length
    : 0;
  if (avgUW > 3.0 && avgMiss < -0.05) weak.add('aggressive-uw');
  if (updated.ddDiscipline.filter((d) => d === 'light').length >= 2) weak.add('light-dd');
  if (updated.psaCatchScores.filter((s) => s < 0.5).length >= 2) weak.add('poor-psa-catch');
  if (updated.raiseStrategies.filter((r) => r === 'solo').length >= 3) weak.add('over-reliant-solo-raise');
  updated.weakSpots = Array.from(weak);
  return updated;
}

/** Whether to surface a lesson now: always first time, suppress 2nd, then only if it's a weak spot. */
export function shouldDeliverLesson(model: PlayerModel, lessonId: string): boolean {
  const count = model.lessonsDelivered[lessonId] ?? 0;
  if (count === 0) return true;
  if (count === 1) return false;
  if (count >= 3) return false;
  return model.weakSpots.some((ws) => lessonId.startsWith(ws));
}

export function recordLesson(model: PlayerModel, lessonId: string): PlayerModel {
  return { ...model, lessonsDelivered: { ...model.lessonsDelivered, [lessonId]: (model.lessonsDelivered[lessonId] ?? 0) + 1 } };
}

export function calibrationInsight(model: PlayerModel): string {
  if (model.modelVsActual.length === 0) return '';
  const avg = model.modelVsActual.reduce((a, b) => a + (b.actualIRR - b.uwedIRR), 0) / model.modelVsActual.length;
  const avgUW = model.uwTendencyScores.reduce((a, b) => a + b, 0) / Math.max(1, model.uwTendencyScores.length);
  const lightDD = model.ddDiscipline.filter((d) => d === 'light').length;
  if (avg < -0.08 && avgUW > 3.0) return 'Your last deals came in well below projection — your underwriting has been running aggressive, especially on rent growth. Try underwriting to in-place rents and modeling upside separately.';
  if (lightDD >= 2) return "You've done light due diligence on multiple deals. The savings at diligence tend to show up as surprises post-close.";
  if (avg > 0.03) return "You're consistently beating your projections. Conservative underwriting is paying off — LPs are happy and raises get easier.";
  return 'Your projections are within normal variance. Keep tracking where your assumptions land vs. reality.';
}
