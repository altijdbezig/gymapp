/**
 * The exercise library, as React Query sees it.
 *
 * The whole library is fetched in one go and filtered on the device. It is
 * about two hundred small rows, it changes roughly never, and doing it this
 * way means the picker keeps working in a gym with no signal.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Exercise } from './exerciseLibrary';
import type { ExerciseCategory, MuscleGroup } from './volume';

export const exercisesQueryKey = (userId: string) => ['exercises', userId] as const;

/** The shared library plus your own exercises. RLS decides which rows arrive. */
export function useExercises(userId: string | null) {
  return useQuery({
    queryKey: exercisesQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    // The library only changes when you add an exercise yourself, and that
    // invalidates the query explicitly.
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** A map from id to exercise, for screens that resolve ids (history, records). */
export function useExerciseMap(userId: string | null) {
  const query = useExercises(userId);
  const map = new Map((query.data ?? []).map((exercise) => [exercise.id, exercise]));
  return { ...query, map };
}

export type CreateExerciseInput = {
  userId: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  category: ExerciseCategory;
  instructions: string | null;
};

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExerciseInput): Promise<Exercise> => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          // The shape exercises_custom_shape demands for a personal exercise.
          is_custom: true,
          created_by: input.userId,
          name: input.name,
          // Your own exercise has no English alias unless you type one, but the
          // column is not nullable, so an empty list it is.
          aliases: [],
          primary_muscle: input.primaryMuscle,
          secondary_muscles: input.secondaryMuscles,
          category: input.category,
          instructions: input.instructions,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (exercise) => {
      queryClient.invalidateQueries({ queryKey: exercisesQueryKey(exercise.created_by!) });
    },
  });
}

export function useDeleteExercise(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exerciseId: string) => {
      // RLS only allows deleting your own custom rows, and the foreign key on
      // workout_day_exercises is ON DELETE RESTRICT, so an exercise still used
      // by a routine refuses to go. That refusal is the correct behaviour: the
      // routine would otherwise silently lose an exercise.
      const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
      if (error) throw error;
      return exerciseId;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: exercisesQueryKey(userId) });
      }
    },
  });
}
