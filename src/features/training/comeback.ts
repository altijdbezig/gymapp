/**
 * The comeback workout.
 *
 * You have not trained for a week or more. Walking back in and doing exactly
 * what you did last time is how people end up with a strained something and
 * another three weeks off, so the app offers a lighter version of your own last
 * session first.
 *
 * How it is made lighter: the number of sets is scaled to about 60%, and the
 * weights stay exactly as they were. Two reasons for choosing sets rather than
 * weight. Your strength has barely changed in a week or two -- what has dropped
 * is your tolerance for volume, which is what causes the soreness. And a
 * familiar weight on the bar makes the session feel like your own training
 * instead of like starting over.
 *
 * Two rules this file exists to keep:
 *   - nothing here mentions eating. A missed week of training never changes a
 *     calorie target, in either direction;
 *   - nothing here blames anyone. Life happens; the copy says so.
 */
import type { ExercisePick } from './activeSession';
import type { MuscleGroup, ExerciseCategory } from './volume';

/** The share of your normal volume a comeback session aims for. */
export const COMEBACK_VOLUME_RATIO = 0.6;

export const COMEBACK_TITLE = 'Welkom terug';

export const COMEBACK_EXPLANATION =
  'Je hebt even niet getraind, en dat is prima. Deze sessie is ongeveer 60% van je normale ' +
  'volume: dezelfde oefeningen en dezelfde gewichten, maar minder sets. Zo bouw je in een paar ' +
  'sessies weer op zonder jezelf te blesseren.';

export const COMEBACK_STREAK_NOTE =
  'Je trainingsstreak begint opnieuw. Dat zegt niets over de weken die je al hebt gedaan.';

/** One exercise from the session you are coming back from. */
export type PreviousExercise = {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  /** How many working sets you did of it last time. */
  sets: number;
  restSeconds?: number;
};

/**
 * Scales a session down.
 *
 * Rounding is deliberate: 3 sets becomes 2, not 1.8 and not 2 flat by floor --
 * `Math.round(3 * 0.6)` is 2, which is the sensible answer. Every exercise
 * keeps at least one set, because dropping an exercise entirely is a bigger
 * change than the user asked for.
 */
export function buildComebackExercises(
  previous: readonly PreviousExercise[],
  ratio = COMEBACK_VOLUME_RATIO,
): ExercisePick[] {
  return previous.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    category: exercise.category,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles,
    restSeconds: exercise.restSeconds,
    targetSets: Math.max(1, Math.round(exercise.sets * ratio)),
  }));
}

/** What the screen says the session comes to, so the offer is not a surprise. */
export function describeComeback(
  previous: readonly PreviousExercise[],
  ratio = COMEBACK_VOLUME_RATIO,
): string {
  const before = previous.reduce((running, exercise) => running + exercise.sets, 0);
  const after = buildComebackExercises(previous, ratio).reduce(
    (running, exercise) => running + (exercise.targetSets ?? 0),
    0,
  );

  if (before === 0) return 'Een rustige sessie om weer op gang te komen.';

  return `${after} sets in plaats van ${before}, met dezelfde oefeningen en gewichten.`;
}

/** "Je hebt 12 dagen niet getraind." -- factual, no judgement attached. */
export function describeBreak(days: number): string {
  if (days < 7) return 'Je hebt onlangs nog getraind.';
  if (days < 14) return `Je laatste training was ${days} dagen geleden.`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `Je laatste training was ongeveer ${weeks} weken geleden.`;
  }

  const months = Math.round(days / 30);
  return `Je laatste training was ongeveer ${months} maanden geleden.`;
}
