/**
 * Saved meals and recipes: reading, writing and logging them.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createId } from '@/lib/id';
import { supabase } from '@/lib/supabase';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import type { MealType } from './foodLog';
import { buildLogRowsForMeal, type Meal, type MealItem, type MealKind } from './meals';
import { foodLogQueryKey } from './useFoodLog';
import { historyQueryKey } from './useFoodExtras';

export type MealWithItems = Meal & { items: MealItem[] };

export const mealsQueryKey = (userId: string) => ['meals', userId] as const;

export function useMeals(userId: string | null) {
  return useQuery({
    queryKey: mealsQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<MealWithItems[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('*, meal_items(*)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const { meal_items: items, ...meal } = row;
        return {
          ...meal,
          items: [...(items ?? [])].sort((a, b) => a.order_index - b.order_index),
        };
      });
    },
  });
}

/** One item as the editor holds it, before it is saved. */
export type MealItemDraft = {
  /** Existing row id, or a fresh one for a newly added product. */
  id: string;
  foodId: string | null;
  name: string;
  brand: string | null;
  amountG: number;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
  saturatedFatPer100g: number | null;
  saltPer100g: number | null;
};

export type SaveMealInput = {
  userId: string;
  mealId: string | null;
  kind: MealKind;
  name: string;
  notes: string;
  servings: number;
  items: MealItemDraft[];
};

/**
 * Saves a meal and its items in one go.
 *
 * Same reconciliation as the routine editor: rows that are still there keep
 * their id, rows you removed are deleted, new ones are inserted.
 */
export function useSaveMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveMealInput): Promise<string> => {
      const mealId = input.mealId ?? createId();

      const meal = await supabase
        .from('meals')
        .upsert({
          id: mealId,
          user_id: input.userId,
          kind: input.kind,
          name: input.name.trim().slice(0, 80) || 'Naamloos',
          notes: input.notes.trim() ? input.notes.trim().slice(0, 2000) : null,
          // A meal is always one serving; only a recipe divides.
          servings: input.kind === 'recipe' ? Math.max(1, input.servings) : 1,
        })
        .select('id')
        .single();

      if (meal.error) throw meal.error;

      const keepIds = input.items.map((item) => item.id);
      const remove = supabase.from('meal_items').delete().eq('meal_id', mealId);
      const { error: deleteError } = await (keepIds.length > 0
        ? remove.not('id', 'in', `(${keepIds.join(',')})`)
        : remove);

      if (deleteError) throw deleteError;

      if (input.items.length > 0) {
        const { error } = await supabase.from('meal_items').upsert(
          input.items.map((item, index) => ({
            id: item.id,
            meal_id: mealId,
            food_id: item.foodId,
            order_index: index,
            amount_g: item.amountG,
            name: item.name,
            brand: item.brand,
            kcal_per_100g: item.kcalPer100g,
            protein_per_100g: item.proteinPer100g,
            fat_per_100g: item.fatPer100g,
            carbs_per_100g: item.carbsPer100g,
            fiber_per_100g: item.fiberPer100g,
            sugars_per_100g: item.sugarsPer100g,
            saturated_fat_per_100g: item.saturatedFatPer100g,
            salt_per_100g: item.saltPer100g,
          })),
        );

        if (error) throw error;
      }

      return mealId;
    },
    onSuccess: (_mealId, input) => {
      queryClient.invalidateQueries({ queryKey: mealsQueryKey(input.userId) });
    },
  });
}

export function useDeleteMeal(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealId: string) => {
      // The items go with it through ON DELETE CASCADE. Diary entries do not:
      // they carry their own copy of the macros, so your history is untouched.
      const { error } = await supabase.from('meals').delete().eq('id', mealId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: mealsQueryKey(userId) });
    },
  });
}

export type LogMealInput = {
  userId: string;
  meal: MealWithItems;
  mealType: MealType;
  date?: string;
  servingsEaten?: number;
};

/** Logs a saved meal or recipe into the diary. */
export function useLogMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, meal, mealType, date, servingsEaten }: LogMealInput) => {
      const loggedOn = date ?? todayIsoDate();

      const rows = buildLogRowsForMeal({
        userId,
        meal,
        items: meal.items,
        mealType,
        loggedOn,
        servingsEaten,
      });

      if (rows.length === 0) return { loggedOn, count: 0 };

      const { error } = await supabase.from('food_log_entries').insert(rows);
      if (error) throw error;

      return { loggedOn, count: rows.length };
    },
    onSuccess: ({ loggedOn }, { userId }) => {
      queryClient.invalidateQueries({ queryKey: foodLogQueryKey(userId, loggedOn) });
      queryClient.invalidateQueries({ queryKey: historyQueryKey(userId) });
    },
  });
}
