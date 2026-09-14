import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/authErrors';
import { useProfile } from '@/features/auth/useProfile';
import { ACTIVITY_LABELS, GOAL_LABELS, SEX_LABELS } from '@/features/nutrition/dailyTargets';
import { APP_NAME, APP_VERSION } from '@/config/app';
import { colors, spacing } from '@/theme/theme';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const profileQuery = useProfile(session?.user.id ?? null);
  const profile = profileQuery.data;

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setError(undefined);
    try {
      await signOut();
      // The session disappears, the root layout notices and shows the login
      // screen. Nothing to navigate to by hand.
    } catch (caught) {
      setError(authErrorMessage(caught));
      setIsSigningOut(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Instellingen</Text>
        <Text muted>Je profiel en je account.</Text>
      </View>

      <Card style={styles.card}>
        <Text variant="heading">Je profiel</Text>
        <Row label="Naam" value={profile?.display_name ?? '—'} />
        <Row label="E-mailadres" value={session?.user.email ?? '—'} />
        <Row label="Geslacht" value={profile?.sex ? SEX_LABELS[profile.sex] : '—'} />
        <Row
          label="Lengte"
          value={profile?.height_cm ? `${formatNumber(profile.height_cm)} cm` : '—'}
        />
        <Row label="Doel" value={profile?.goal ? GOAL_LABELS[profile.goal] : '—'} />
        <Row
          label="Activiteit"
          value={profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—'}
        />
        <Text variant="caption" muted>
          Je profiel aanpassen komt in fase 5.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Meldingen</Text>
        <Text muted>De avondherinnering en de comeback-melding komen in fase 4.</Text>
      </Card>

      <View style={styles.signOut}>
        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          title="Uitloggen"
          variant="secondary"
          onPress={handleSignOut}
          loading={isSigningOut}
        />
      </View>

      <Text variant="caption" muted style={styles.version}>
        {APP_NAME} {APP_VERSION}
      </Text>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text muted style={styles.rowLabel}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/** 180.0 reads better as 180, and a decimal uses a Dutch comma. */
function formatNumber(value: number): string {
  return String(Number(value)).replace('.', ',');
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowLabel: { flex: 1 },
  rowValue: { flex: 2, textAlign: 'right' },
  signOut: { gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.danger },
  version: { textAlign: 'center', marginTop: spacing.lg },
});
