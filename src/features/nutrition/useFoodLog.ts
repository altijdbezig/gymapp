import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { FoodLogEntry, MealType } from './foodLog';
import {
  offProductsToFoodInserts,
  offProductToFoodInsert,
  type FoodInsert,
} from './offMapping';
import { fetchProductByBarcode, searchProducts } from '@/lib/openFoodFacts';
import { supabase } from '@/lib/supabase';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import type { Tables } from '@/types/database';

export type Food = Tables<'foods'>;

export const foodLogQueryKey = (userId: string, date: string) =>
  ['food-log', userId, date] as const;

export const myFoodsQueryKey = (userId: string) => ['my-foods', userId] as const;

export const offSearchQueryKey = (query: string) => ['off-search', query] as const;

/** Everything logged on one day, oldest first so the list reads chronologically. */
export function useFoodLog(userId: string | null, date: string = todayIsoDate()) {
  return useQuery({
    queryKey: foodLogQueryKey(userId ?? 'anonymous', date),
    enabled: !!userId,
    queryFn: async (): Promise<FoodLogEntry[]> => {
      const { data, error } = await supabase
        .from('food_log_entries')
        .select('*')
        .eq('user_id', userId!)
        .eq('logged_on', date)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Writes an Open Food Facts product into the cache, once.
 *
 * The upsert targets the partial unique index on barcode, and ignoreDuplicates
 * means a product somebody else already cached is left exactly as it was --
 * which is also all the RLS policies allow, since there is no update policy for
 * source = 'off'.
 *
 * Caching happens when a product is actually used, not when it shows up in a
 * search. Otherwise one search for "kwark" would write twenty rows nobody eats.
 */
export async function cacheOffFood(food: FoodInsert): Promise<Food> {
  const { error } = await supabase
    .from('foods')
    .upsert(food, { onConflict: 'barcode', ignoreDuplicates: true });

  if (error) throw error;

  // Read it back rather than trusting the upsert's return: with
  // ignoreDuplicates an existing row returns nothing at all.
  const { data, error: selectError } = await supabase
    .from('foods')
    .select('*')
    .eq('barcode', food.barcode!)
    .eq('source', 'off')
    .single();

  if (selectError) throw selectError;
  return data;
}

/**
 * Looks a barcode up in our own cache first and only then at Open Food Facts.
 * A product you scan twice costs one network request, not two.
 */
export function useBarcodeLookup(barcode: string | null) {
  return useQuery({
    queryKey: ['barcode', barcode] as const,
    enabled: !!barcode,
    // A product's macros do not change while you stand in the kitchen.
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<{ food: Food | null; refusal?: string }> => {
      const cached = await supabase
        .from('foods')
        .select('*')
        .eq('barcode', barcode!)
        .eq('source', 'off')
        .maybeSingle();

      if (cached.error) throw cached.error;
      if (cached.data) return { food: cached.data };

      const product = await fetchProductByBarcode(barcode!);
      if (!product) return { food: null };

      const mapped = offProductToFoodInsert(product);
      if (!mapped.food) return { food: null, refusal: mapped.refusal };

      return { food: await cacheOffFood(mapped.food) };
    },
  });
}

/** Your own products, so the manual ones stay reachable without the network. */
export function useMyFoods(userId: string | null) {
  return useQuery({
    queryKey: myFoodsQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('source', 'custom')
        .eq('created_by', userId!)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Full-text search at Open Food Facts. The rate limiting lives in the wrapper. */
export function useOffSearch(query: string, enabled: boolean) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: offSearchQueryKey(trimmed),
    enabled: enabled && trimmed.length >= 3,
    // Searching the same words twice in a row should not cost a request.
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<{ food: FoodInsert; key: string }[]> => {
      const products = await searchProducts(trimmed);
      // Drops the products we cannot use and any repeated barcode. Roughly a
      // fifth of a real search misses its macros or its name.
      return offProductsToFoodInserts(products).map((food) => ({ food, key: food.barcode! }));
    },
  });
}

export type LogFoodInput = {
  userId: string;
  food: Pick<
    Food,
    'id' | 'name' | 'brand' | 'kcal_per_100g' | 'protein_per_100g' | 'fat_per_100g' | 'carbs_per_100g'
  >;
  amountG: number;
  mealType: MealType;
  date?: string;
};

export function useLogFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, food, amountG, mealType, date }: LogFoodInput) => {
      const loggedOn = date ?? todayIsoDate();

      // The macros are copied in here. kcal, protein_g, fat_g and carbs_g are
      // generated columns, so the database works those out from amount_g.
      const { data, error } = await supabase
        .from('food_log_entries')
        .insert({
          user_id: userId,
          food_id: food.id,
          logged_on: loggedOn,
          meal_type: mealType,
          amount_g: amountG,
          name: food.name,
          brand: food.brand,
          kcal_per_100g: food.kcal_per_100g,
          protein_per_100g: food.protein_per_100g,
          fat_per_100g: food.fat_per_100g,
          carbs_per_100g: food.carbs_per_100g,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({
        queryKey: foodLogQueryKey(entry.user_id, entry.logged_on),
      });
    },
  });
}

export function useDeleteLogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: FoodLogEntry) => {
      const { error } = await supabase.from('food_log_entries').delete().eq('id', entry.id);
      if (error) throw error;
      return entry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({
        queryKey: foodLogQueryKey(entry.user_id, entry.logged_on),
      });
    },
  });
}

export type CreateCustomFoodInput = {
  userId: string;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  servingSizeG: number | null;
};

export function useCreateCustomFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCustomFoodInput): Promise<Food> => {
      const { data, error } = await supabase
        .from('foods')
        .insert({
          // The shape foods_source_shape demands for a personal product:
          // private, owned by you.
          source: 'custom',
          is_public: false,
          created_by: input.userId,
          barcode: null,
          name: input.name,
          brand: input.brand,
          kcal_per_100g: input.kcalPer100g,
          protein_per_100g: input.proteinPer100g,
          fat_per_100g: input.fatPer100g,
          carbs_per_100g: input.carbsPer100g,
          serving_size_g: input.servingSizeG,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (food) => {
      queryClient.invalidateQueries({ queryKey: myFoodsQueryKey(food.created_by!) });
    },
  });
}
