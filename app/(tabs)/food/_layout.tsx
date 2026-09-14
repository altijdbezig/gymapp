import { Stack } from 'expo-router';

/**
 * The Eten tab is a stack, not a single screen: logging food means walking
 * from the day overview into search, the scanner or a manual entry and back.
 * Expo Router turns this folder into one tab whose content is this stack.
 */
export default function FoodLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
