import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

export type Profile = Tables<'profiles'>;

export const profileQueryKey = (userId: string) => ['profile', userId] as const;

/**
 * Fetches the signed-in user's profile row.
 *
 * The row is created automatically by the on_auth_user_created trigger, so it
 * exists from the moment the account does — but every field is still null
 * until onboarding fills them in. `onboarding_completed` is the flag the router
 * uses to decide between onboarding and the app.
 *
 * maybeSingle() returns null instead of throwing when there is no row, which
 * is what we want if the trigger ever did not run.
 */
export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: profileQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

/** A profile can only drive the calculation once every field is filled in. */
export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.onboarding_completed &&
    profile.birth_date !== null &&
    profile.sex !== null &&
    profile.height_cm !== null &&
    profile.activity_level !== null &&
    profile.goal !== null
  );
}

/**
 * Updating any part of the profile.
 *
 * One mutation for every setting, because they all live on the same row and
 * they all invalidate the same query. Callers pass just the fields they change.
 */
export function useUpdateProfile(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: TablesUpdate<'profiles'>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId!)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // The screen reads the profile straight back out of the cache, so the new
    // value is written in rather than refetched -- a toggle that flips back for
    // half a second while a request is in flight feels broken.
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(profile.user_id), profile);
    },
  });
}
