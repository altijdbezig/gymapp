import { Stack } from 'expo-router';

/**
 * The screens you can reach without being signed in. The root layout only lets
 * you in here when there is no session.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
