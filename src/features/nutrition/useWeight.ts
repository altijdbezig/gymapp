/**
 * Weighing yourself, and what it does to your targets.
 *
 * The rule that matters: a new weight recalculates today and everything after
 * it, and never touches a day that has already been. A daily_targets row is a
 * snapshot of what was true that morning; rewriting March because you weigh
 * less in September would make your own history lie to you.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey } from '@/features/auth/useProfile';
import { supabase } from '@/lib/supabase';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import type { Tables } from '@/types/database';
import { asCompleteProfile, buildDailyTargetRow } from './dailyTargets';
import { dailyTargetsQueryKey, upsertDailyTargets } from './useDailyTargets';
import type { WeightPoint } from './weightTrend';

export type BodyWeight = Tables<'body_weights'>;

export const weightsQueryKey = (userId: string) => ['body-weights', userId] as const;

export function useBodyWeights(userId: string | null, limit = 400) {
  return useQuery({
    queryKey: weightsQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<BodyWeight[]> => {
      const { data, error } = await supabase
        .from('body_weights')
        .select('*')
        .eq('user_id', userId!)
        .order('measured_on', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The shape the trend maths wants. */
export function toWeightPoints(weights: readonly BodyWeight[]): WeightPoint[] {
  return weights.map((row) => ({
    date: row.measured_on,
    weightKg: Number(row.weight_kg),
  }));
}

export type LogWeightInput = {
  userId: string;
  weightKg: number;
  measuredOn?: string;
};

/**
 * Records a weigh-in and, when it is today's, rebuilds today's targets.
 *
 * The unique index on (user_id, measured_on) means weighing yourself twice on
 * one day corrects the entry instead of stacking up two.
 */
export function useLogWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, weightKg, measuredOn }: LogWeightInput) => {
      const date = measuredOn ?? todayIsoDate();

      const { error } = await supabase
        .from('body_weights')
        .upsert(
          { user_id: userId, measured_on: date, weight_kg: weightKg },
          { onConflict: 'user_id,measured_on' },
        );

      if (error) throw error;

      // Only today's targets are recalculated. A weigh-in you are back-filling
      // for last Tuesday does not get to rewrite last Tuesday's targets.
      const today = todayIsoDate();
      if (date !== today) return { date, recalculated: false };

      const profileResult = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;

      const profile = asCompleteProfile(profileResult.data);
      if (!profile) return { date, recalculated: false };

      await upsertDailyTargets(
        buildDailyTargetRow({
          userId,
          profile,
          weightKg,
          date: today,
          today: new Date(),
        }),
      );

      return { date, recalculated: true };
    },
    onSuccess: (_result, { userId }) => {
      queryClient.invalidateQueries({ queryKey: weightsQueryKey(userId) });
      queryClient.invalidateQueries({
        queryKey: dailyTargetsQueryKey(userId, todayIsoDate()),
      });
      queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    },
  });
}

export function useDeleteWeight(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('body_weights').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: weightsQueryKey(userId) });
    },
  });
}
