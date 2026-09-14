/**
 * Routines: the plans you save and start again next week.
 *
 * A note on the shape. The database can hold a routine with several workout
 * days (a full Push/Pull/Legs programme as one row). The UI deliberately only
 * makes one day per routine, exactly like Hevy: "Push" and "Pull" are two
 * routines, and a folder groups them. The extra level stays in the schema so a
 * later phase can add programmes without another migration, and everything
 * here reads days as a list so nothing breaks when that day comes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createId } from '@/lib/id';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { Exercise } from './exerciseLibrary';

export type RoutineFolder = Tables<'routine_folders'>;

export type RoutineExercise = Tables<'workout_day_exercises'> & {
  exercise: Exercise | null;
};

export type RoutineDay = Tables<'workout_days'> & {
  exercises: RoutineExercise[];
};

export type Routine = Tables<'workout_plans'> & {
  days: RoutineDay[];
};

export const routinesQueryKey = (userId: string) => ['routines', userId] as const;
export const foldersQueryKey = (userId: string) => ['routine-folders', userId] as const;

/**
 * Everything about every routine in one request.
 *
 * PostgREST embeds the related rows when you ask for them by table name, so
 * this is a single round trip instead of one query per level. On a phone with
 * a bad connection that difference is the whole screen.
 */
export function useRoutines(userId: string | null) {
  return useQuery({
    queryKey: routinesQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<Routine[]> => {
      const { data, error } = await supabase
        .from('workout_plans')
        // One literal string: the Supabase types are derived from it, and a
        // concatenated string would come back as a generic error type.
        .select(
          'id, user_id, folder_id, name, notes, order_index, created_at, updated_at, workout_days(id, plan_id, name, order_index, created_at, workout_day_exercises(*, exercises(*)))',
        )
        .eq('user_id', userId!)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((plan) => ({
        id: plan.id,
        user_id: plan.user_id,
        folder_id: plan.folder_id,
        name: plan.name,
        notes: plan.notes,
        order_index: plan.order_index,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        days: [...(plan.workout_days ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((day) => ({
            id: day.id,
            plan_id: day.plan_id,
            name: day.name,
            order_index: day.order_index,
            created_at: day.created_at,
            exercises: [...(day.workout_day_exercises ?? [])]
              .sort((a, b) => a.order_index - b.order_index)
              .map((row) => ({ ...row, exercise: row.exercises ?? null })),
          })),
      }));
    },
  });
}

export function useRoutineFolders(userId: string | null) {
  return useQuery({
    queryKey: foldersQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<RoutineFolder[]> => {
      const { data, error } = await supabase
        .from('routine_folders')
        .select('*')
        .eq('user_id', userId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export function useCreateFolder(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<RoutineFolder> => {
      const { data, error } = await supabase
        .from('routine_folders')
        .insert({ user_id: userId!, name: name.trim() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateRoutines(queryClient, userId),
  });
}

export function useRenameFolder(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('routine_folders')
        .update({ name: name.trim() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => invalidateRoutines(queryClient, userId),
  });
}

/**
 * Deleting a folder keeps the routines inside it: the foreign key is
 * ON DELETE SET NULL, so they reappear under "Zonder map".
 */
export function useDeleteFolder(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routine_folders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRoutines(queryClient, userId),
  });
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

/** One planned exercise, as the routine editor holds it before saving. */
export type RoutineExerciseDraft = {
  /** Existing row id, or a fresh one for a newly added exercise. */
  id: string;
  exerciseId: string;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  restSeconds: number;
  supersetGroup: number | null;
  note: string;
};

export type SaveRoutineInput = {
  userId: string;
  /** Existing routine, or null to create one. */
  planId: string | null;
  dayId: string | null;
  name: string;
  folderId: string | null;
  notes: string;
  exercises: RoutineExerciseDraft[];
};

/**
 * Saves a routine in one mutation: the plan, its single day, and the exercises.
 *
 * Exercises are reconciled rather than wiped and rewritten -- rows that are
 * still there keep their id, rows you removed are deleted, new ones are
 * inserted. Wiping would work too, but it would churn the table on every save
 * and lose the created_at of an exercise that never moved.
 */
export function useSaveRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveRoutineInput): Promise<string> => {
      const planId = input.planId ?? createId();
      const dayId = input.dayId ?? createId();
      const name = input.name.trim().slice(0, 80) || 'Naamloze routine';

      const plan = await supabase
        .from('workout_plans')
        .upsert({
          id: planId,
          user_id: input.userId,
          folder_id: input.folderId,
          name,
          notes: input.notes.trim() ? input.notes.trim().slice(0, 2000) : null,
        })
        .select('id')
        .single();

      if (plan.error) throw plan.error;

      const day = await supabase
        .from('workout_days')
        .upsert({ id: dayId, plan_id: planId, name, order_index: 0 })
        .select('id')
        .single();

      if (day.error) throw day.error;

      // Anything the editor no longer holds was removed by the user.
      const keepIds = input.exercises.map((exercise) => exercise.id);
      const remove = supabase.from('workout_day_exercises').delete().eq('workout_day_id', dayId);
      const { error: deleteError } = await (keepIds.length > 0
        ? remove.not('id', 'in', `(${keepIds.join(',')})`)
        : remove);

      if (deleteError) throw deleteError;

      if (input.exercises.length > 0) {
        const { error: upsertError } = await supabase.from('workout_day_exercises').upsert(
          input.exercises.map((exercise, index) => ({
            id: exercise.id,
            workout_day_id: dayId,
            exercise_id: exercise.exerciseId,
            order_index: index,
            target_sets: exercise.targetSets,
            rep_min: exercise.repMin,
            rep_max: exercise.repMax,
            rest_seconds: exercise.restSeconds,
            superset_group: exercise.supersetGroup,
            note: exercise.note.trim() ? exercise.note.trim().slice(0, 500) : null,
          })),
        );

        if (upsertError) throw upsertError;
      }

      return planId;
    },
    onSuccess: (_planId, input) => invalidateRoutines(queryClient, input.userId),
  });
}

export function useDeleteRoutine(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      // The days and their exercises go with it (ON DELETE CASCADE). Sessions
      // do not: workout_sessions.workout_day_id is ON DELETE SET NULL, so your
      // history survives deleting the routine it came from.
      const { error } = await supabase.from('workout_plans').delete().eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => invalidateRoutines(queryClient, userId),
  });
}

/** Duplicating: a copy called "... (kopie)", so tweaking it is safe. */
export function useDuplicateRoutine(userId: string | null) {
  const saveRoutine = useSaveRoutine();

  return useMutation({
    mutationFn: async (routine: Routine): Promise<string> => {
      const day = routine.days[0];

      return saveRoutine.mutateAsync({
        userId: userId!,
        planId: null,
        dayId: null,
        name: `${routine.name} (kopie)`.slice(0, 80),
        folderId: routine.folder_id,
        notes: routine.notes ?? '',
        exercises: (day?.exercises ?? []).map((exercise) => ({
          id: createId(),
          exerciseId: exercise.exercise_id,
          targetSets: exercise.target_sets,
          repMin: exercise.rep_min,
          repMax: exercise.rep_max,
          restSeconds: exercise.rest_seconds,
          supersetGroup: exercise.superset_group,
          note: exercise.note ?? '',
        })),
      });
    },
  });
}

/** Moving a routine into a folder, or out of one with null. */
export function useMoveRoutineToFolder(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, folderId }: { planId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from('workout_plans')
        .update({ folder_id: folderId })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => invalidateRoutines(queryClient, userId),
  });
}

/** Reordering within the list: order_index follows the array position. */
export function useReorderRoutines(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planIdsInOrder: string[]) => {
      for (const [index, planId] of planIdsInOrder.entries()) {
        const { error } = await supabase
          .from('workout_plans')
          .update({ order_index: index })
          .eq('id', planId);

        if (error) throw error;
      }
    },
    onSuccess: () => invalidateRoutines(queryClient, userId),
  });
}

function invalidateRoutines(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | null,
) {
  if (!userId) return;
  queryClient.invalidateQueries({ queryKey: routinesQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: foldersQueryKey(userId) });
}

// ---------------------------------------------------------------------------
// Grouping for the list screen
// ---------------------------------------------------------------------------

export type RoutineGroup = {
  folder: RoutineFolder | null;
  routines: Routine[];
};

/**
 * Groups routines under their folder, with the loose ones last. Every folder
 * appears even when it is empty, otherwise a folder you just made would seem
 * not to have been created.
 */
export function groupRoutines(
  routines: readonly Routine[],
  folders: readonly RoutineFolder[],
): RoutineGroup[] {
  const groups: RoutineGroup[] = folders.map((folder) => ({
    folder,
    routines: routines.filter((routine) => routine.folder_id === folder.id),
  }));

  const loose = routines.filter((routine) => routine.folder_id === null);
  if (loose.length > 0 || folders.length === 0) {
    groups.push({ folder: null, routines: loose });
  }

  return groups;
}
