import { router } from 'expo-router';
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
import { formatLength } from '@/features/settings/units';
import { APP_NAME, APP_VERSION } from '@/config/app';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
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
          value={
            profile?.height_cm
              ? formatLength(Number(profile.height_cm), profile.unit_length)
              : '—'
          }
        />
        <Row label="Doel" value={profile?.goal ? GOAL_LABELS[profile.goal] : '—'} />
        <Row
          label="Activiteit"
          value={profile?.activity_level ? ACTIVITY_LABELS[profile.activity_level] : '—'}
        />

      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Doelen</Text>
        <Text muted>
          Laat de app je dagdoelen uitrekenen, of vul ze zelf in.
        </Text>
        <Button
          title="Doelen aanpassen"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/targets')}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Weergave</Text>
        <Text muted>Donkere modus en de eenheden waarin je rekent.</Text>
        <Button
          title="Thema en eenheden"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/appearance')}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Meldingen</Text>
        <Text muted>
          Kies zelf welke herinneringen je wil en hoe laat. Alles staat standaard uit.
        </Text>
        <Button
          title="Meldingen instellen"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/notifications')}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Recepten</Text>
        <Text muted>
          Je dieet, allergieën en hoeveel recepten de app per dag mag laten maken.
        </Text>
        <Button
          title="Receptvoorkeuren"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/recipes')}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Medicatie en supplementen</Text>
        <Text muted>
          Herinneringen die je zelf instelt. De app geeft geen medisch advies.
        </Text>
        <Button
          title="Medicatie"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/medication')}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Je gegevens</Text>
        <Text muted>
          Alles wat de app van je bewaart exporteren, of je account verwijderen.
        </Text>
        <Button
          title="Exporteren of verwijderen"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/account')}
        />
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text muted style={styles.rowLabel}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowLabel: { flex: 1 },
  rowValue: { flex: 2, textAlign: 'right' },
  signOut: { gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.danger },
  version: { textAlign: 'center', marginTop: spacing.lg },
});
