/**
 * Estimating a one-rep max.
 *
 * A 1RM is the heaviest weight you could lift once. Almost nobody actually
 * tests it -- it is risky and it wrecks the rest of your session -- so it is
 * estimated from a set you did do. That estimate is what makes "5 x 100 kg"
 * and "8 x 90 kg" comparable, which is what progress over time really means.
 *
 * Formula: Epley, 1RM = weight x (1 + reps / 30).
 * Chosen because it is the one Hevy and most lifters use, and because it is a
 * single readable line. It gets optimistic above roughly 12 reps, so that is
 * where HIGH_REP_ESTIMATE_LIMIT draws the line.
 */

/**
 * Above this many reps an Epley estimate says more about your endurance than
 * about your strength. We still return a number, but the app labels it as a
 * rough estimate rather than a record.
 */
export const HIGH_REP_ESTIMATE_LIMIT = 12;

/**
 * Epley. Returns kilograms rounded to one decimal, or 0 when there is nothing
 * to estimate from (no reps, no weight, or bodyweight work logged at 0 kg).
 *
 * A single rep returns the weight itself: 1 x (1 + 1/30) would otherwise claim
 * you can lift 3% more than what you just lifted.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return round1(weightKg);

  return round1(weightKg * (1 + reps / 30));
}

/** True when the rep count is high enough that the estimate is only a guide. */
export function isRoughEstimate(reps: number): boolean {
  return reps > HIGH_REP_ESTIMATE_LIMIT;
}

/**
 * The other direction: what weight should give you `reps` reps, given a 1RM.
 * Used to suggest a starting weight for the comeback workout in phase 5.
 */
export function weightForReps(oneRepMaxKg: number, reps: number): number {
  if (!Number.isFinite(oneRepMaxKg) || !Number.isFinite(reps)) return 0;
  if (oneRepMaxKg <= 0 || reps <= 0) return 0;

  return round1(oneRepMaxKg / (1 + reps / 30));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
