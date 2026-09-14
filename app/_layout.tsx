import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { isProfileComplete, useProfile } from '@/features/auth/useProfile';
import { ThemeProvider, useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Root layout — wraps every screen in the app.
 *
 * The QueryClient is created once, outside the component, so a re-render never
 * throws away the cache. Defaults: data stays "fresh" for a minute, and we do
 * not refetch on window focus because that mostly matters on the web.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* The theme wraps everything, including the login screens: somebody
            who prefers dark mode should not get a white flash before they are
            signed in. */}
        <ThemeProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/** Light icons on a dark background and the other way around. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Decides which of the three parts of the app you are allowed into.
 *
 * Stack.Protected is the Expo Router way of doing this: every route stays
 * declared, but a route whose guard is false cannot be reached, and anyone
 * standing on it gets moved to the first route that is reachable. That beats
 * redirecting by hand from inside screens, which flickers and races.
 *
 *   no session            -> (auth)
 *   session, no profile   -> (onboarding)
 *   session + profile     -> (tabs)
 */
function RootNavigator() {
  const { session, isRestoring } = useAuth();
  const userId = session?.user.id ?? null;
  const profileQuery = useProfile(userId);

  // While the stored session is being read, or the profile is on its way, we
  // do not know where this user belongs yet. Showing the wrong screen for a
  // frame and then jumping is worse than a spinner.
  if (isRestoring || (userId && profileQuery.isLoading)) {
    return <BootScreen />;
  }

  // Signed in but the profile could not be loaded (usually no connection).
  // Guessing here would drop someone with a finished profile back into
  // onboarding, so we ask instead.
  if (userId && profileQuery.isError) {
    return <BootErrorScreen onRetry={() => profileQuery.refetch()} />;
  }

  const isSignedIn = !!session;
  const hasProfile = isProfileComplete(profileQuery.data);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && !hasProfile}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && hasProfile}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

function BootScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={palette.primary} />
    </View>
  );
}

function BootErrorScreen({ onRetry }: { onRetry: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <Text variant="heading">Verbinding mislukt</Text>
      <Text muted style={styles.centeredText}>
        We konden je gegevens niet ophalen. Controleer je internetverbinding.
      </Text>
      <View style={styles.retryButton}>
        <Button title="Opnieuw proberen" onPress={onRetry} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  centeredText: { textAlign: 'center' },
  retryButton: { marginTop: spacing.md, alignSelf: 'stretch' },
});
