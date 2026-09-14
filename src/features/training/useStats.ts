/**
 * The statistics, assembled from what is already cached.
 *
 * No new query: the session history already carries every set, and the exercise
 * library is fetched once and kept for a day. Everything the charts need is a
 * transformation of those two, so opening the statistics screen costs nothing.
 */
import { useMemo } from 'react';

import { useExercises } from './useExercises';
import { useSessionHistory } from './useSessions';
import type { StatSet } from './stats';
import type { MuscleGroup } from './volume';

export type MuscleStatSet = StatSet & {
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
};

/** How much history the statistics look at. */
export const STATS_SESSION_LIMIT = 200;

export function useStats(userId: string | null) {
  const historyQuery = useSessionHistory(userId, STATS_SESSION_LIMIT);
  const exercisesQuery = useExercises(userId);

  const exerciseMap = useMemo(
    () => new Map((exercisesQuery.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercisesQuery.data],
  );

  const sets = useMemo<MuscleStatSet[]>(() => {
    return (historyQuery.data ?? []).flatMap((session) =>
      session.sets.map((set) => {
        const exercise = exerciseMap.get(set.exercise_id);

        return {
          exerciseId: set.exercise_id,
          sessionId: session.id,
          performedOn: session.performed_on,
          setType: set.set_type,
          reps: set.reps,
          weightKg: set.weight_kg,
          isCompleted: set.is_completed,
          // An exercise that somehow is not in the library still counts towards
          // the totals; it just lands under "hele lichaam".
          primaryMuscle: exercise?.primary_muscle ?? 'full_body',
          secondaryMuscles: exercise?.secondary_muscles ?? [],
        };
      }),
    );
  }, [historyQuery.data, exerciseMap]);

  const sessions = useMemo(
    () =>
      (historyQuery.data ?? []).map((session) => ({
        performedOn: session.performed_on,
        durationSeconds: session.duration_seconds,
      })),
    [historyQuery.data],
  );

  return {
    sets,
    sessions,
    exerciseMap,
    isLoading: historyQuery.isLoading || exercisesQuery.isLoading,
    isError: historyQuery.isError,
    refetch: historyQuery.refetch,
  };
}
