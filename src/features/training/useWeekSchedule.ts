/**
 * Reading and writing the week planner.
 *
 * A row with workout_day_id null is an explicit rest day. No row at all means
 * "niets gepland", which is a different thing: the reminder in phase 5 only
 * fires on a day you actually planned a workout.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { Weekday } from './weekSchedule';

export type WeekScheduleRow = Tables<'week_schedule'>;

export const weekScheduleQueryKey = (userId: string) => ['week-schedule', userId] as const;

export function useWeekSchedule(userId: string | null) {
  return useQuery({
    queryKey: weekScheduleQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<WeekScheduleRow[]> => {
      const { data, error } = await supabase
        .from('week_schedule')
        .select('*')
        .eq('user_id', userId!)
        .order('weekday', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export type SetWeekdayInput = {
  weekday: Weekday;
  /** A workout day id, or null for a rest day. */
  workoutDayId: string | null;
};

export function useSetWeekday(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ weekday, workoutDayId }: SetWeekdayInput) => {
      // onConflict on (user_id, weekday): picking another routine for Monday
      // replaces Monday instead of failing on the unique constraint.
      const { error } = await supabase
        .from('week_schedule')
        .upsert(
          { user_id: userId!, weekday, workout_day_id: workoutDayId },
          { onConflict: 'user_id,weekday' },
        );

      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: weekScheduleQueryKey(userId) });
      }
    },
  });
}

/** Clearing a day entirely: back to "niets gepland". */
export function useClearWeekday(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weekday: Weekday) => {
      const { error } = await supabase
        .from('week_schedule')
        .delete()
        .eq('user_id', userId!)
        .eq('weekday', weekday);

      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: weekScheduleQueryKey(userId) });
      }
    },
  });
}

export type PlannedDay = {
  weekday: Weekday;
  /** null when it is a rest day or nothing is planned. */
  workoutDayId: string | null;
  /** True for an explicit rest day, false when nothing was planned at all. */
  isRestDay: boolean;
  isPlanned: boolean;
};

/** Turns the sparse rows into all seven days, so a screen can just map over it. */
export function buildWeek(rows: readonly WeekScheduleRow[], order: readonly Weekday[]): PlannedDay[] {
  const byWeekday = new Map(rows.map((row) => [row.weekday as Weekday, row]));

  return order.map((weekday) => {
    const row = byWeekday.get(weekday);
    return {
      weekday,
      workoutDayId: row?.workout_day_id ?? null,
      isRestDay: !!row && row.workout_day_id === null,
      isPlanned: !!row,
    };
  });
}
