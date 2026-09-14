import { Stack } from 'expo-router';

import { FoodPickerProvider } from '@/features/nutrition/FoodPicker';

/**
 * The Eten tab is a stack, not a single screen: logging food means walking
 * from the day overview into search, the scanner or a manual entry and back.
 * Expo Router turns this folder into one tab whose content is this stack.
 *
 * The picker provider sits here so the meal and recipe editors can borrow the
 * search screen and get the product back.
 */
export default function FoodLayout() {
  return (
    <FoodPickerProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </FoodPickerProvider>
  );
}
