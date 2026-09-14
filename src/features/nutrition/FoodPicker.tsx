/**
 * Picking a product for something other than the diary.
 *
 * The meal and recipe editors need the same "find a product" screen the diary
 * uses, but they want the product back instead of logging it. Same trick as the
 * exercise picker in the training tab: a context at the level of the food stack
 * holds the callback, and the search screen resolves it.
 *
 * The callback lives in a ref so opening the picker does not re-render the
 * whole stack.
 */
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

/** Everything a meal item needs, whatever the product came from. */
export type PickedFood = {
  foodId: string | null;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
  saturatedFatPer100g: number | null;
  saltPer100g: number | null;
  /** The serving size, so the editor can suggest an amount. */
  servingSizeG: number | null;
};

type PickerRequest = {
  subtitle?: string;
  onPick: (food: PickedFood) => void;
};

type FoodPickerValue = {
  open: (request: PickerRequest) => void;
  resolve: (food: PickedFood) => void;
  subtitle: () => string | undefined;
};

const FoodPickerContext = createContext<FoodPickerValue | null>(null);

export function FoodPickerProvider({ children }: { children: ReactNode }) {
  const request = useRef<PickerRequest | null>(null);

  const open = useCallback((next: PickerRequest) => {
    request.current = next;
    router.push('/(tabs)/food/search?mode=pick');
  }, []);

  const resolve = useCallback((food: PickedFood) => {
    const pending = request.current;
    request.current = null;

    if (router.canGoBack()) router.back();
    pending?.onPick(food);
  }, []);

  const subtitle = useCallback(() => request.current?.subtitle, []);

  const value = useMemo(() => ({ open, resolve, subtitle }), [open, resolve, subtitle]);

  return <FoodPickerContext.Provider value={value}>{children}</FoodPickerContext.Provider>;
}

export function useFoodPicker(): FoodPickerValue {
  const value = useContext(FoodPickerContext);
  if (!value) {
    throw new Error('useFoodPicker must be used inside the food stack');
  }
  return value;
}

/** Turns a foods row into the shape the picker hands back. */
export function pickedFromFood(food: {
  id: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  fiber_per_100g: number | null;
  sugars_per_100g: number | null;
  saturated_fat_per_100g: number | null;
  salt_per_100g: number | null;
  serving_size_g: number | null;
}): PickedFood {
  return {
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    kcalPer100g: Number(food.kcal_per_100g),
    proteinPer100g: Number(food.protein_per_100g),
    fatPer100g: Number(food.fat_per_100g),
    carbsPer100g: Number(food.carbs_per_100g),
    fiberPer100g: food.fiber_per_100g === null ? null : Number(food.fiber_per_100g),
    sugarsPer100g: food.sugars_per_100g === null ? null : Number(food.sugars_per_100g),
    saturatedFatPer100g:
      food.saturated_fat_per_100g === null ? null : Number(food.saturated_fat_per_100g),
    saltPer100g: food.salt_per_100g === null ? null : Number(food.salt_per_100g),
    servingSizeG: food.serving_size_g === null ? null : Number(food.serving_size_g),
  };
}
