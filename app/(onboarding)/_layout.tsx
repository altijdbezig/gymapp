import { Stack } from 'expo-router';

/**
 * Onboarding: reachable only when you are signed in but your profile is not
 * filled in yet. There is no way to skip it, because without a profile the
 * calorie calculation has nothing to work with.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
