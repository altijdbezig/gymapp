/**
 * Overriding the calculated targets by hand.
 *
 * People have reasons: a dietitian gave them numbers, they are following a
 * programme, or the Mifflin-St Jeor estimate simply does not match what they
 * see on the scale. Refusing to let them type their own numbers would push
 * them to another app.
 *
 * What does NOT change is the safety floor. The two hard rules apply to a
 * manual target exactly as they do to a calculated one:
 *
 *   1. the deficit is never more than 500 kcal below maintenance;
 *   2. the target is never below the basal metabolic rate.
 *
 * A manual number below either is raised to the limit and the screen says so.
 * That is not the app second-guessing you -- those are the numbers the check
 * constraints in migration 0001 enforce anyway, so anything lower would simply
 * be rejected by the database.
 */
import {
  KCAL_PER_GRAM,
  MAX_DEFICIT_KCAL,
  type DailyTargets,
  type TargetWarning,
} from './calculateDailyTargets';

export type ManualOverride = {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
};

/** True when at least one field is filled in. */
export function hasOverride(override: ManualOverride): boolean {
  return (
    override.kcal !== null ||
    override.proteinG !== null ||
    override.fatG !== null ||
    override.carbsG !== null
  );
}

/**
 * Applies the override on top of a calculated set of targets.
 *
 * Fields left empty keep the calculated value, so you can override only the
 * calories and let the macros follow. When the calories are overridden and the
 * macros are not, the macros are rebuilt from the new calorie figure -- leaving
 * the old ones would produce a set of numbers that do not add up.
 */
export function applyManualTargets(
  calculated: DailyTargets,
  override: ManualOverride,
): DailyTargets {
  if (!hasOverride(override)) return calculated;

  const warnings = new Set<TargetWarning>(calculated.warnings);

  // --- Rule 1 and 2: the floor, applied to whatever was typed. -------------
  let kcal = override.kcal ?? calculated.kcal;

  const deficitFloor = calculated.tdeeKcal - MAX_DEFICIT_KCAL;
  if (kcal < deficitFloor) {
    kcal = deficitFloor;
    warnings.add('deficit_capped');
  }

  if (kcal < calculated.bmrKcal) {
    kcal = calculated.bmrKcal;
    warnings.add('clamped_to_bmr');
  }

  kcal = Math.round(kcal);

  // --- The macros ---------------------------------------------------------
  const proteinG = Math.round(
    override.proteinG ?? scale(calculated.proteinG, calculated.kcal, kcal),
  );
  const fatG = Math.round(override.fatG ?? scale(calculated.fatG, calculated.kcal, kcal));

  // Carbohydrates are whatever is left. If protein and fat alone already
  // exceed the calorie target, this would go negative -- rule 3 says it never
  // may, so it is clamped and the screen explains why.
  const carbsFromKcal =
    (kcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat) / KCAL_PER_GRAM.carbs;

  let carbsG = Math.round(override.carbsG ?? carbsFromKcal);
  if (carbsG < 0) {
    carbsG = 0;
    warnings.add('carbs_clamped_to_zero');
  }

  return {
    ...calculated,
    kcal,
    proteinG: Math.max(0, proteinG),
    fatG: Math.max(0, fatG),
    carbsG,
    clampedToBmr: warnings.has('clamped_to_bmr'),
    warnings: [...warnings],
  };
}

/**
 * Keeps a macro in proportion when only the calories were overridden.
 * A calculated target of zero calories cannot happen, but dividing by it would
 * be a crash rather than a wrong number, so it is guarded.
 */
function scale(value: number, fromKcal: number, toKcal: number): number {
  if (fromKcal <= 0) return value;
  return (value * toKcal) / fromKcal;
}

/** The sentence under the fields, explaining what was adjusted and why. */
export const MANUAL_TARGET_NOTE =
  'Je eigen getallen worden gebruikt, behalve als ze onder je rustverbruik (BMR) liggen of ' +
  'meer dan 500 kcal onder je onderhoudsniveau. Dan wordt er naar die grens afgerond. Die twee ' +
  'grenzen staan er omdat te weinig eten je juist tegenwerkt.';
