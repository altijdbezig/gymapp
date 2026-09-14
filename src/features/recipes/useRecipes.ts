/**
 * Recipes: reading the shared cache, generating a new one, and logging it.
 *
 * The order matters and is the whole cost strategy: the cache is a normal
 * Postgres query, so it is searched first and costs nothing. Only when nothing
 * is close enough does the app call the edge function, which is the only thing
 * in this project that spends money.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import type { MealType } from '@/features/nutrition/foodLog';
import { foodLogQueryKey } from '@/features/nutrition/useFoodLog';
import { historyQueryKey } from '@/features/nutrition/useFoodExtras';
import type { Recipe } from './recipeMatching';

export const recipesQueryKey = (userId: string) => ['ai-recipes', userId] as const;
export const generationsTodayQueryKey = (userId: string) =>
  ['ai-recipes-today', userId] as const;

/** How many cached recipes are held on the device to search through. */
const CACHE_SIZE = 300;

/**
 * The shared recipe cache.
 *
 * Fetched once and filtered on the device, like the exercise library: it is a
 * few hundred small rows, and doing the matching locally means changing the
 * target does not cost a round trip.
 */
export function useRecipes(userId: string | null) {
  return useQuery({
    queryKey: recipesQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from('ai_recipes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(CACHE_SIZE);

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Just yours, for the "mijn recepten" list. */
export function useMyRecipes(userId: string | null) {
  const query = useRecipes(userId);
  return {
    ...query,
    mine: (query.data ?? []).filter((recipe) => recipe.created_by === userId),
  };
}

/** How many generations you have used today, for the limit. */
export function useGenerationsToday(userId: string | null) {
  return useQuery({
    queryKey: generationsTodayQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('ai_recipes')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId!)
        .gte('created_at', since.toISOString());

      if (error) throw error;
      return count ?? 0;
    },
  });
}

export type GenerateRecipeInput = {
  kcal: number;
  proteinG: number;
  fatG?: number;
  carbsG?: number;
  mealType?: string;
  extraWishes?: string;
};

export type GenerateRecipeResult = {
  recipe: Recipe;
  remainingToday: number;
};

/** What went wrong, in Dutch, ready to show. */
export class RecipeGenerationError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RecipeGenerationError';
  }
}

/**
 * Asks the edge function for a new recipe.
 *
 * `functions.invoke` sends the user's own Supabase session along, which is how
 * the function knows who is asking and whose limit to check. No key of any kind
 * leaves the app.
 */
export function useGenerateRecipe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateRecipeInput): Promise<GenerateRecipeResult> => {
      const { data, error } = await supabase.functions.invoke('generate-recipe', {
        body: input,
      });

      if (error) {
        // The function answers with a Dutch sentence in `error`; the wrapper
        // only knows that the status was not 2xx, so the body is read for it.
        let message = 'Het recept kon niet worden gemaakt. Probeer het later opnieuw.';
        let code: string | undefined;

        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (typeof body?.error === 'string') message = body.error;
            if (typeof body?.code === 'string') code = body.code;
          } catch {
            // Keep the generic message.
          }
        }

        throw new RecipeGenerationError(message, code);
      }

      if (!data?.recipe) {
        throw new RecipeGenerationError('Er kwam geen recept terug. Probeer het opnieuw.');
      }

      return { recipe: data.recipe as Recipe, remainingToday: data.remainingToday ?? 0 };
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: recipesQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: generationsTodayQueryKey(userId) });
    },
  });
}

export function useDeleteRecipe(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipeId: string) => {
      const { error } = await supabase.from('ai_recipes').delete().eq('id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: recipesQueryKey(userId) });
    },
  });
}

export type LogRecipeInput = {
  userId: string;
  recipe: Recipe;
  mealType: MealType;
  servings?: number;
  date?: string;
};

/**
 * Logs one serving of a recipe into the diary.
 *
 * Stored as a single entry with the recipe's own macros, the same shape a saved
 * recipe from "mijn maaltijden" produces: amount_g is 100 times the number of
 * servings, so the per-100 g values are exactly the per-serving values and the
 * generated columns come out right.
 */
export function useLogRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, recipe, mealType, servings = 1, date }: LogRecipeInput) => {
      const loggedOn = date ?? todayIsoDate();

      const { error } = await supabase.from('food_log_entries').insert({
        user_id: userId,
        food_id: null,
        logged_on: loggedOn,
        meal_type: mealType,
        // 100 g stands for one serving, so the per-100 g values below are the
        // per-serving values and no conversion is needed anywhere.
        amount_g: 100 * servings,
        name: recipe.title,
        brand: null,
        kcal_per_100g: recipe.kcal_per_serving,
        protein_per_100g: Number(recipe.protein_per_serving),
        fat_per_100g: Number(recipe.fat_per_serving),
        carbs_per_100g: Number(recipe.carbs_per_serving),
        portion_label: 'portie',
        portion_count: servings,
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
