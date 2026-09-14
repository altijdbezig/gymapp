/**
 * The phase 4 half of the food tab: favourites, portions, recent history,
 * copying a day, water, and the day totals the week overview is built from.
 *
 * Saved meals and recipes live in useMeals.ts; weight lives in useWeight.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileQueryKey } from '@/features/auth/useProfile';
import { supabase } from '@/lib/supabase';
import { addDays } from '@/lib/date';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import type { Tables, TablesInsert } from '@/types/database';
import type { FoodLogEntry, MealType } from './foodLog';
import type { Suggestion } from './foodSuggestions';
import { buildQuickEntry, type QuickEntryInput } from './quickEntry';
import { foodLogQueryKey, type Food } from './useFoodLog';
import type { StoredPortion } from './portions';
import type { WaterEntry } from './water';
import type { DayTotals } from './weekSummary';

export const favoritesQueryKey = (userId: string) => ['food-favorites', userId] as const;
export const portionsQueryKey = (userId: string, foodId: string) =>
  ['food-portions', userId, foodId] as const;
export const historyQueryKey = (userId: string) => ['food-history', userId] as const;
export const waterQueryKey = (userId: string, date: string) => ['water', userId, date] as const;
export const dayTotalsQueryKey = (userId: string) => ['day-totals', userId] as const;

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export type Favorite = Tables<'food_favorites'> & { food: Food | null };

export function useFavorites(userId: string | null) {
  return useQuery({
    queryKey: favoritesQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<Favorite[]> => {
      const { data, error } = await supabase
        .from('food_favorites')
        .select('*, foods(*)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => {
        const { foods, ...rest } = row;
        return { ...rest, food: foods ?? null };
      });
    },
  });
}

/**
 * Starring and unstarring in one mutation.
 *
 * The unique index on (user_id, food_id) is what makes this safe: tapping the
 * star twice quickly cannot create two rows.
 */
export function useToggleFavorite(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ foodId, isFavorite }: { foodId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        const { error } = await supabase
          .from('food_favorites')
          .delete()
          .eq('user_id', userId!)
          .eq('food_id', foodId);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('food_favorites')
        .upsert({ user_id: userId!, food_id: foodId }, { onConflict: 'user_id,food_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: favoritesQueryKey(userId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Portions
// ---------------------------------------------------------------------------

export function useFoodPortions(userId: string | null, foodId: string | null) {
  return useQuery({
    queryKey: portionsQueryKey(userId ?? 'anonymous', foodId ?? 'none'),
    enabled: !!userId && !!foodId,
    queryFn: async (): Promise<StoredPortion[]> => {
      const { data, error } = await supabase
        .from('food_portions')
        .select('*')
        .eq('user_id', userId!)
        .eq('food_id', foodId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export type SavePortionInput = {
  userId: string;
  foodId: string;
  label: string;
  grams: number;
  isDefault: boolean;
};

export function useSavePortion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SavePortionInput): Promise<StoredPortion> => {
      // Only one portion per product may be the default, so the others are
      // cleared first. Two defaults would make "welke opent het scherm?"
      // depend on row order, which is not a decision to leave to chance.
      if (input.isDefault) {
        const { error } = await supabase
          .from('food_portions')
          .update({ is_default: false })
          .eq('user_id', input.userId)
          .eq('food_id', input.foodId);

        if (error) throw error;
      }

      const { data, error } = await supabase
        .from('food_portions')
        .upsert(
          {
            user_id: input.userId,
            food_id: input.foodId,
            label: input.label.trim().slice(0, 40),
            grams: input.grams,
            is_default: input.isDefault,
          },
          { onConflict: 'user_id,food_id,label' },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (portion) => {
      queryClient.invalidateQueries({
        queryKey: portionsQueryKey(portion.user_id, portion.food_id),
      });
    },
  });
}

export function useDeletePortion(userId: string | null, foodId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (portionId: string) => {
      const { error } = await supabase.from('food_portions').delete().eq('id', portionId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId && foodId) {
        queryClient.invalidateQueries({ queryKey: portionsQueryKey(userId, foodId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// History: recent, frequent, and the week overview
// ---------------------------------------------------------------------------

/** How far back "recent" and "vaak gegeten" look. */
export const HISTORY_DAYS = 90;

/**
 * The last three months of diary entries.
 *
 * One query feeds the recent tab, the frequent tab and the week overview, so
 * opening the search screen does not fire three requests that all read the
 * same table.
 */
export function useFoodHistory(userId: string | null, days = HISTORY_DAYS) {
  const since = addDays(todayIsoDate(), -days);

  return useQuery({
    queryKey: [...historyQueryKey(userId ?? 'anonymous'), days] as const,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FoodLogEntry[]> => {
      const { data, error } = await supabase
        .from('food_log_entries')
        .select('*')
        .eq('user_id', userId!)
        .gte('logged_on', since)
        .order('logged_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Rolls the history up into one row per day, for the week overview. */
export function toDayTotals(entries: readonly FoodLogEntry[]): DayTotals[] {
  const byDate = new Map<string, DayTotals>();

  for (const entry of entries) {
    const current = byDate.get(entry.logged_on) ?? {
      date: entry.logged_on,
      kcal: 0,
      proteinG: 0,
      entries: 0,
    };

    byDate.set(entry.logged_on, {
      date: entry.logged_on,
      kcal: current.kcal + Number(entry.kcal ?? 0),
      proteinG: current.proteinG + Number(entry.protein_g ?? 0),
      entries: current.entries + 1,
    });
  }

  return [...byDate.values()].map((day) => ({
    ...day,
    kcal: Math.round(day.kcal),
    proteinG: Math.round(day.proteinG),
  }));
}

// ---------------------------------------------------------------------------
// Copying a day
// ---------------------------------------------------------------------------

export type CopyEntriesInput = {
  userId: string;
  entries: readonly FoodLogEntry[];
  toDate: string;
  /** Keep the meal each entry had, or move them all to one meal. */
  mealType?: MealType;
};

/**
 * Copies diary entries onto another day.
 *
 * A copy, never a move: the day you copied from keeps everything. New ids are
 * generated by the database, so copying the same day twice gives you two sets
 * of entries rather than silently doing nothing -- which is what you want if
 * you really did eat the same thing twice.
 */
export function useCopyEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, entries, toDate, mealType }: CopyEntriesInput) => {
      if (entries.length === 0) return 0;

      const rows: TablesInsert<'food_log_entries'>[] = entries.map((entry) => ({
        user_id: userId,
        food_id: entry.food_id,
        logged_on: toDate,
        meal_type: mealType ?? entry.meal_type,
        amount_g: Number(entry.amount_g),
        name: entry.name,
        brand: entry.brand,
        kcal_per_100g: Number(entry.kcal_per_100g),
        protein_per_100g: Number(entry.protein_per_100g),
        fat_per_100g: Number(entry.fat_per_100g),
        carbs_per_100g: Number(entry.carbs_per_100g),
        fiber_per_100g: entry.fiber_per_100g,
        sugars_per_100g: entry.sugars_per_100g,
        saturated_fat_per_100g: entry.saturated_fat_per_100g,
        salt_per_100g: entry.salt_per_100g,
        portion_label: entry.portion_label,
        portion_count: entry.portion_count,
      }));

      const { error } = await supabase.from('food_log_entries').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (_count, { userId, toDate }) => {
      queryClient.invalidateQueries({ queryKey: foodLogQueryKey(userId, toDate) });
      queryClient.invalidateQueries({ queryKey: historyQueryKey(userId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export function useWater(userId: string | null, date: string = todayIsoDate()) {
  return useQuery({
    queryKey: waterQueryKey(userId ?? 'anonymous', date),
    enabled: !!userId,
    queryFn: async (): Promise<WaterEntry[]> => {
      const { data, error } = await supabase
        .from('water_entries')
        .select('*')
        .eq('user_id', userId!)
        .eq('logged_on', date)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddWater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      ml,
      date,
    }: {
      userId: string;
      ml: number;
      date?: string;
    }) => {
      const loggedOn = date ?? todayIsoDate();
      const { error } = await supabase
        .from('water_entries')
        .insert({ user_id: userId, ml, logged_on: loggedOn });

      if (error) throw error;
      return { userId, loggedOn };
    },
    onSuccess: ({ userId, loggedOn }) => {
      queryClient.invalidateQueries({ queryKey: waterQueryKey(userId, loggedOn) });
    },
  });
}

/** Undo: removes the most recent glass. */
export function useRemoveLastWater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entries }: { userId: string; date: string; entries: WaterEntry[] }) => {
      const last = entries[entries.length - 1];
      if (!last) return;

      const { error } = await supabase.from('water_entries').delete().eq('id', last.id);
      if (error) throw error;
    },
    onSuccess: (_result, { userId, date }) => {
      queryClient.invalidateQueries({ queryKey: waterQueryKey(userId, date) });
    },
  });
}

/** The water goal, which lives on the profile so it travels with the account. */
export function useSetWaterGoal(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalMl: number) => {
      const { error } = await supabase
        .from('profiles')
        .update({ water_goal_ml: Math.round(goalMl) })
        .eq('user_id', userId!);

      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Logging without a product row
// ---------------------------------------------------------------------------

export type LogSuggestionInput = {
  userId: string;
  suggestion: Suggestion;
  amountG: number;
  mealType: MealType;
  date?: string;
  portionLabel?: string | null;
  portionCount?: number | null;
};

/**
 * Logs something straight from the recent or frequent list.
 *
 * It goes in from the suggestion's own numbers rather than by looking the
 * product up again: a quick entry has no product to look up, and for a real
 * product the two are the same thing anyway.
 */
export function useLogSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogSuggestionInput) => {
      const loggedOn = input.date ?? todayIsoDate();
      const { suggestion } = input;

      const { error } = await supabase.from('food_log_entries').insert({
        user_id: input.userId,
        food_id: suggestion.foodId,
        logged_on: loggedOn,
        meal_type: input.mealType,
        amount_g: input.amountG,
        name: suggestion.name,
        brand: suggestion.brand,
        kcal_per_100g: suggestion.kcalPer100g,
        protein_per_100g: suggestion.proteinPer100g,
        fat_per_100g: suggestion.fatPer100g,
        carbs_per_100g: suggestion.carbsPer100g,
        fiber_per_100g: suggestion.fiberPer100g,
        sugars_per_100g: suggestion.sugarsPer100g,
        saturated_fat_per_100g: suggestion.saturatedFatPer100g,
        salt_per_100g: suggestion.saltPer100g,
        portion_label: input.portionLabel ?? null,
        portion_count: input.portionCount ?? null,
      });

      if (error) throw error;
      return loggedOn;
    },
    onSuccess: (loggedOn, { userId }) => {
      queryClient.invalidateQueries({ queryKey: foodLogQueryKey(userId, loggedOn) });
      queryClient.invalidateQueries({ queryKey: historyQueryKey(userId) });
    },
  });
}

/** Snelle invoer: only calories and protein, no product behind it. */
export function useLogQuickEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: QuickEntryInput) => {
      const { error } = await supabase.from('food_log_entries').insert(buildQuickEntry(input));
      if (error) throw error;
      return input.loggedOn;
    },
    onSuccess: (loggedOn, { userId }) => {
      queryClient.invalidateQueries({ queryKey: foodLogQueryKey(userId, loggedOn) });
      queryClient.invalidateQueries({ queryKey: historyQueryKey(userId) });
    },
  });
}
