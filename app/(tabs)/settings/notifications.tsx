import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
import {
  ensureNotificationPermission,
  cancelAllNotifications,
} from '@/features/notifications/localNotifications';
import { REMINDER_DESCRIPTIONS, REMINDER_LABELS } from '@/features/notifications/reminders';
import { colors, spacing } from '@/theme/theme';

/** The times offered for the evening summary. */
const EVENING_TIMES = ['18:00', '19:00', '20:00', '21:00', '22:00'] as const;

/**
 * Which reminders you want, and when.
 *
 * Everything is off by default except the rest timer. Turning the first one on
 * is what asks for permission, so the prompt arrives at the moment the reason
 * for it is obvious.
 */
export default function NotificationSettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const [permissionError, setPermissionError] = useState<string>();

  const profile = profileQuery.data;

  /** Every switch goes through here, so permission is asked exactly once. */
  async function setFlag(patch: Record<string, boolean | string>, turningOn: boolean) {
    if (turningOn) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setPermissionError(
          'Meldingen staan uit voor deze app. Zet ze aan in de instellingen van je telefoon.',
        );
        return;
      }
    }

    setPermissionError(undefined);
    await updateProfile.mutateAsync(patch);
  }

  if (profileQuery.isLoading || !profile) {
    return (
      <Screen>
        <ScreenHeader title="Meldingen" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const anyOn =
    profile.notify_evening ||
    profile.notify_log_reminder ||
    profile.notify_training_day ||
    profile.notify_comeback ||
    profile.notify_medication;

  return (
    <Screen>
      <ScreenHeader
        title="Meldingen"
        subtitle="Je kiest per soort of je hem wil. Alles staat standaard uit."
      />

      <Card style={styles.card}>
        <Toggle
          label={REMINDER_LABELS.evening}
          description={REMINDER_DESCRIPTIONS.evening}
          value={profile.notify_evening}
          onChange={(value) => setFlag({ notify_evening: value }, value)}
        />

        {profile.notify_evening ? (
          <View style={styles.field}>
            <Text variant="label">Hoe laat?</Text>
            <ChipRow>
              {EVENING_TIMES.map((time) => (
                <Chip
                  key={time}
                  label={time}
                  selected={profile.evening_time.startsWith(time)}
                  onPress={() => setFlag({ evening_time: time }, false)}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Toggle
          label={REMINDER_LABELS.log}
          description={REMINDER_DESCRIPTIONS.log}
          value={profile.notify_log_reminder}
          onChange={(value) => setFlag({ notify_log_reminder: value }, value)}
        />
        <Text variant="caption" muted>
          Als het avondoverzicht aanstaat, krijg je deze niet apart: die twee zouden op een lege
          dag hetzelfde zeggen.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Toggle
          label={REMINDER_LABELS.trainingDay}
          description={REMINDER_DESCRIPTIONS.trainingDay}
          value={profile.notify_training_day}
          onChange={(value) => setFlag({ notify_training_day: value }, value)}
        />
        <Toggle
          label={REMINDER_LABELS.comeback}
          description={REMINDER_DESCRIPTIONS.comeback}
          value={profile.notify_comeback}
          onChange={(value) => setFlag({ notify_comeback: value }, value)}
        />
        <Toggle
          label={REMINDER_LABELS.rest}
          description={REMINDER_DESCRIPTIONS.rest}
          value={profile.notify_rest_timer}
          onChange={(value) => setFlag({ notify_rest_timer: value }, value)}
        />
      </Card>

      <Card style={styles.card}>
        <Toggle
          label={REMINDER_LABELS.medication}
          description={REMINDER_DESCRIPTIONS.medication}
          value={profile.notify_medication}
          onChange={(value) => setFlag({ notify_medication: value }, value)}
        />
      </Card>

      {permissionError ? (
        <Text variant="caption" style={styles.error}>
          {permissionError}
        </Text>
      ) : null}

      {anyOn ? (
        <View style={styles.footer}>
          <Button
            title="Alle meldingen uitzetten"
            variant="secondary"
            onPress={async () => {
              await updateProfile.mutateAsync({
                notify_evening: false,
                notify_log_reminder: false,
                notify_training_day: false,
                notify_comeback: false,
                notify_medication: false,
              });
              await cancelAllNotifications();
            }}
          />
        </View>
      ) : null}

      <Text variant="caption" muted style={styles.note}>
        Meldingen worden op je telefoon zelf ingepland. Er gaat niets naar een server, en op de
        webversie werken ze niet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  field: { gap: spacing.xs, paddingTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.md },
  footer: { marginTop: spacing.sm },
  note: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
