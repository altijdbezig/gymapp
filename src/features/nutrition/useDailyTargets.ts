import { useQuery } from '@tanstack/react-query';

import {
  asCompleteProfile,
  buildDailyTargetRow,
  type DailyTargetInsert,
} from './dailyTargets';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type DailyTarget = Tables<'daily_targets'>;

export const dailyTargetsQueryKey = (userId: string, date: string) =>
  ['daily-targets', userId, date] as const;

/** The most recent weigh-in, which is what today's targets are based on. */
async function fetchLatestWeight(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('body_weights')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('measured_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.weight_kg ?? null;
}

export async function upsertDailyTargets(row: DailyTargetInsert): Promise<DailyTarget> {
  // onConflict on (user_id, date): recalculating on a day that already has a
  // row replaces it instead of failing on the unique constraint. That is what
  // you want after changing your goal halfway through the day.
  const { data, error } = await supabase
    .from('daily_targets')
    .upsert(row, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Today's targets, created on first use.
 *
 * The row is a snapshot, so it is only computed once per day: opening the app
 * again later reads back the same numbers even if you weighed yourself in
 * between. Changing your goal in onboarding recalculates it explicitly.
 */
export function useTodaysTargets(userId: string | null) {
  const date = todayIsoDate();

  return useQuery({
    queryKey: dailyTargetsQueryKey(userId ?? 'anonymous', date),
    enabled: !!userId,
    queryFn: async (): Promise<DailyTarget | null> => {
      const existing = await supabase
        .from('daily_targets')
        .select('*')
        .eq('user_id', userId!)
        .eq('date', date)
        .maybeSingle();

      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;

      // Nothing stored yet for today, so build it from the profile and the
      // latest weigh-in.
      const profileResult = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;

      const profile = asCompleteProfile(profileResult.data);
      const weightKg = await fetchLatestWeight(userId!);
      if (!profile || weightKg === null) {
        // Onboarding has not finished. The router sends the user there anyway;
        // returning null keeps this from throwing in the meantime.
        return null;
      }

      return upsertDailyTargets(
        buildDailyTargetRow({
          userId: userId!,
          profile,
          weightKg,
          date,
          today: new Date(),
        }),
      );
    },
  });
}
