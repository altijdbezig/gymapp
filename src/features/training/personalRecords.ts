/**
 * Personal records: working out what you just beat.
 *
 * Three records per exercise, the same three Hevy shows:
 *   - heaviest set      the biggest number you got for at least one rep
 *   - best 1RM          estimated, so a heavy triple can beat a heavy single
 *   - best volume       the most reps x weight for that exercise in one session
 *
 * All three are derived from set_logs, so the personal_records table is only a
 * cache. Recomputing it from scratch is always allowed.
 *
 * Nothing here ever compares one user to another, and nothing here produces a
 * message about food. A record is a nice thing to notice, not a target to hit.
 */
import { estimateOneRepMax } from './oneRepMax';
import { isScoringSet, setVolume, type ScorableSet } from './volume';

/** What one exercise achieved inside a single session. */
export type ExerciseBests = {
  exerciseId: string;
  /** Heaviest scoring set, with the reps that went with it. */
  heaviestKg: number;
  heaviestReps: number;
  /** Best Epley estimate over the scoring sets. */
  best1rmKg: number;
  /** Volume for this exercise in this session. */
  volumeKg: number;
};

export type SessionSet = ScorableSet & { exerciseId: string };

/**
 * Reduces a session's sets to one bests-row per exercise.
 *
 * "Heaviest" breaks a tie on reps: 100 kg x 5 beats 100 kg x 3, because it is
 * the same weight for more work.
 */
export function bestsPerExercise(sets: readonly SessionSet[]): ExerciseBests[] {
  const byExercise = new Map<string, ExerciseBests>();

  for (const set of sets) {
    if (!isScoringSet(set)) continue;

    const weightKg = set.weightKg ?? 0;
    const reps = set.reps ?? 0;
    const oneRm = estimateOneRepMax(weightKg, reps);

    const current = byExercise.get(set.exerciseId) ?? {
      exerciseId: set.exerciseId,
      heaviestKg: 0,
      heaviestReps: 0,
      best1rmKg: 0,
      volumeKg: 0,
    };

    const beatsHeaviest =
      weightKg > current.heaviestKg ||
      (weightKg === current.heaviestKg && reps > current.heaviestReps);

    byExercise.set(set.exerciseId, {
      exerciseId: set.exerciseId,
      heaviestKg: beatsHeaviest ? weightKg : current.heaviestKg,
      heaviestReps: beatsHeaviest ? reps : current.heaviestReps,
      best1rmKg: Math.max(current.best1rmKg, oneRm),
      volumeKg: current.volumeKg + setVolume(set),
    });
  }

  return [...byExercise.values()].map((bests) => ({
    ...bests,
    volumeKg: Math.round(bests.volumeKg),
  }));
}

/** The stored record for one exercise, as it comes out of personal_records. */
export type StoredRecord = {
  exercise_id: string;
  best_weight_kg: number | null;
  best_weight_reps: number | null;
  best_weight_on: string | null;
  best_1rm_kg: number | null;
  best_1rm_on: string | null;
  best_volume_kg: number | null;
  best_volume_on: string | null;
};

export type RecordKind = 'weight' | 'one_rm' | 'volume';

export type BrokenRecord = {
  exerciseId: string;
  kind: RecordKind;
  /** The new value. */
  value: number;
  /** Reps that went with it; only meaningful for kind 'weight'. */
  reps?: number;
  /** What it beat, or null when this is the first time you did the exercise. */
  previous: number | null;
};

/**
 * Dutch copy per record kind. Kept here so the wording is identical everywhere
 * it appears (the summary screen, the history detail, a future notification).
 */
export const RECORD_LABELS: Record<RecordKind, string> = {
  weight: 'Zwaarste set',
  one_rm: 'Beste geschatte 1RM',
  volume: 'Meeste volume in één sessie',
};

/**
 * Compares this session's bests against what was already stored.
 *
 * A first-ever attempt counts as a record with `previous: null`, which the UI
 * words differently ("eerste keer") so it does not pretend you beat something.
 */
export function detectBrokenRecords(
  bests: readonly ExerciseBests[],
  stored: readonly StoredRecord[],
): BrokenRecord[] {
  const storedByExercise = new Map(stored.map((record) => [record.exercise_id, record]));
  const broken: BrokenRecord[] = [];

  for (const best of bests) {
    const previous = storedByExercise.get(best.exerciseId);

    if (best.heaviestKg > 0 && isHigher(best.heaviestKg, previous?.best_weight_kg)) {
      broken.push({
        exerciseId: best.exerciseId,
        kind: 'weight',
        value: best.heaviestKg,
        reps: best.heaviestReps,
        previous: previous?.best_weight_kg ?? null,
      });
    }

    if (best.best1rmKg > 0 && isHigher(best.best1rmKg, previous?.best_1rm_kg)) {
      broken.push({
        exerciseId: best.exerciseId,
        kind: 'one_rm',
        value: best.best1rmKg,
        previous: previous?.best_1rm_kg ?? null,
      });
    }

    if (best.volumeKg > 0 && isHigher(best.volumeKg, previous?.best_volume_kg)) {
      broken.push({
        exerciseId: best.exerciseId,
        kind: 'volume',
        value: best.volumeKg,
        previous: previous?.best_volume_kg ?? null,
      });
    }
  }

  return broken;
}

/** The row to write back, merging this session's bests into what was stored. */
export type RecordUpsert = {
  exercise_id: string;
  best_weight_kg: number | null;
  best_weight_reps: number | null;
  best_weight_on: string | null;
  best_1rm_kg: number | null;
  best_1rm_on: string | null;
  best_volume_kg: number | null;
  best_volume_on: string | null;
};

/**
 * Builds the personal_records rows for the exercises that improved.
 *
 * Only improved fields get a new date, so "zwaarste set op 3 maart" stays
 * correct even if you beat your volume record today.
 */
export function buildRecordUpserts(
  bests: readonly ExerciseBests[],
  stored: readonly StoredRecord[],
  performedOn: string,
): RecordUpsert[] {
  const storedByExercise = new Map(stored.map((record) => [record.exercise_id, record]));
  const upserts: RecordUpsert[] = [];

  for (const best of bests) {
    const previous = storedByExercise.get(best.exerciseId);

    const beatsWeight = best.heaviestKg > 0 && isHigher(best.heaviestKg, previous?.best_weight_kg);
    const beats1rm = best.best1rmKg > 0 && isHigher(best.best1rmKg, previous?.best_1rm_kg);
    const beatsVolume = best.volumeKg > 0 && isHigher(best.volumeKg, previous?.best_volume_kg);

    if (!beatsWeight && !beats1rm && !beatsVolume) continue;

    upserts.push({
      exercise_id: best.exerciseId,
      best_weight_kg: beatsWeight ? best.heaviestKg : (previous?.best_weight_kg ?? null),
      best_weight_reps: beatsWeight ? best.heaviestReps : (previous?.best_weight_reps ?? null),
      best_weight_on: beatsWeight ? performedOn : (previous?.best_weight_on ?? null),
      best_1rm_kg: beats1rm ? best.best1rmKg : (previous?.best_1rm_kg ?? null),
      best_1rm_on: beats1rm ? performedOn : (previous?.best_1rm_on ?? null),
      best_volume_kg: beatsVolume ? best.volumeKg : (previous?.best_volume_kg ?? null),
      best_volume_on: beatsVolume ? performedOn : (previous?.best_volume_on ?? null),
    });
  }

  return upserts;
}

/** A missing stored value means "never done", which anything beats. */
function isHigher(value: number, previous: number | null | undefined): boolean {
  if (previous === null || previous === undefined) return true;
  return value > previous;
}
