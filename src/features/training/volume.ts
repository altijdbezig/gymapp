/**
 * Volume: how much work a session actually contained.
 *
 * Volume is reps x weight, added up. It is the number that tells you whether
 * this week was harder than last week, and it is what the comeback workout in
 * phase 5 scales down to roughly 60%.
 *
 * Two rules decide what counts, and both live here so nothing else has to
 * remember them:
 *   1. A warm-up never counts. You did it to get ready, not to get stronger.
 *   2. An unfinished set never counts. A row you typed but did not tick off is
 *      a plan, not a result.
 */
import type { Database } from '@/types/database';

export type SetType = Database['public']['Enums']['set_type'];
export type MuscleGroup = Database['public']['Enums']['muscle_group'];
export type ExerciseCategory = Database['public']['Enums']['exercise_category'];

/** The bit of a set that the maths here cares about. */
export type ScorableSet = {
  setType: SetType;
  reps: number | null;
  weightKg: number | null;
  isCompleted: boolean;
};

/**
 * A secondary muscle does real work but not as much as the primary one.
 * Counting it fully would make every chest day look like a triceps day;
 * ignoring it would hide that your triceps get plenty of work already.
 * Half is the compromise, and it is one constant so it is easy to change.
 */
export const SECONDARY_MUSCLE_SHARE = 0.5;

/** Warm-ups and unticked rows do not score. Drop sets and failure sets do. */
export function isScoringSet(set: ScorableSet): boolean {
  if (!set.isCompleted) return false;
  if (set.setType === 'warmup') return false;
  return (set.reps ?? 0) > 0;
}

/** reps x weight for one set, or 0 when the set does not score. */
export function setVolume(set: ScorableSet): number {
  if (!isScoringSet(set)) return 0;
  return (set.reps ?? 0) * (set.weightKg ?? 0);
}

/** Total volume in kilograms. Rounded, because half a kilo of volume is noise. */
export function totalVolume(sets: readonly ScorableSet[]): number {
  return Math.round(sets.reduce((running, set) => running + setVolume(set), 0));
}

/** How many sets actually counted. The other headline number of a session. */
export function countScoringSets(sets: readonly ScorableSet[]): number {
  return sets.filter(isScoringSet).length;
}

/** Total reps across the scoring sets. */
export function totalReps(sets: readonly ScorableSet[]): number {
  return sets.reduce((running, set) => running + (isScoringSet(set) ? (set.reps ?? 0) : 0), 0);
}

export type MuscleVolume = { muscle: MuscleGroup; volumeKg: number; sets: number };

/**
 * Volume split over muscle groups, for the "which muscle am I neglecting?"
 * chart in phase 6.
 *
 * The primary muscle gets the whole set, every secondary muscle gets
 * SECONDARY_MUSCLE_SHARE of it. Sorted heaviest first so the screen can render
 * the list straight out of this function.
 */
export function volumeByMuscle(
  sets: readonly (ScorableSet & {
    primaryMuscle: MuscleGroup;
    secondaryMuscles: readonly MuscleGroup[];
  })[],
): MuscleVolume[] {
  const totals = new Map<MuscleGroup, { volumeKg: number; sets: number }>();

  const add = (muscle: MuscleGroup, volumeKg: number, setShare: number) => {
    const current = totals.get(muscle) ?? { volumeKg: 0, sets: 0 };
    totals.set(muscle, {
      volumeKg: current.volumeKg + volumeKg,
      sets: current.sets + setShare,
    });
  };

  for (const set of sets) {
    if (!isScoringSet(set)) continue;

    const volume = setVolume(set);
    add(set.primaryMuscle, volume, 1);

    for (const muscle of set.secondaryMuscles) {
      // A muscle listed both as primary and secondary (which the seed avoids,
      // but a custom exercise could do) must not be counted twice.
      if (muscle === set.primaryMuscle) continue;
      add(muscle, volume * SECONDARY_MUSCLE_SHARE, SECONDARY_MUSCLE_SHARE);
    }
  }

  return [...totals.entries()]
    .map(([muscle, value]) => ({
      muscle,
      volumeKg: Math.round(value.volumeKg),
      sets: Math.round(value.sets * 2) / 2,
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg || a.muscle.localeCompare(b.muscle));
}

export type SessionSummary = {
  volumeKg: number;
  sets: number;
  reps: number;
  exercises: number;
};

/** The four numbers on the "sessie afgerond" screen. */
export function summariseSession(
  exercises: readonly { sets: readonly ScorableSet[] }[],
): SessionSummary {
  const allSets = exercises.flatMap((exercise) => [...exercise.sets]);

  return {
    volumeKg: totalVolume(allSets),
    sets: countScoringSets(allSets),
    reps: totalReps(allSets),
    // An exercise you added but never ticked a set on does not count as done.
    exercises: exercises.filter((exercise) => exercise.sets.some(isScoringSet)).length,
  };
}
