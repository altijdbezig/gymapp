import { Stack } from 'expo-router';

/**
 * Instellingen is a stack: the overview plus one screen per group of settings.
 * Keeping them apart means the overview stays readable instead of becoming one
 * very long list of switches.
 */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
