import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  normaliseTime,
  MEDICATION_PRIVACY_NOTE,
} from '@/features/medication/medicationSchedule';
import {
  useIntakes,
  useMedications,
  INTAKE_HISTORY_DAYS,
} from '@/features/medication/useMedication';
import { formatDutchDate } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * What you ticked off, per day.
 *
 * A record of what happened, not a score. There is deliberately no percentage
 * and no streak here: a dose you did not tick may have been skipped on a
 * doctor's say-so, and the app has no business having an opinion about it.
 */
export default function MedicationHistoryScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const medicationsQuery = useMedications(userId);
  const intakesQuery = useIntakes(userId);

  const names = new Map(
    (medicationsQuery.data ?? []).map((medication) => [medication.id, medication.name]),
  );

  const byDate = new Map<string, { time: string; name: string }[]>();
  for (const intake of intakesQuery.data ?? []) {
    const entries = byDate.get(intake.taken_on) ?? [];
    entries.push({
      time: normaliseTime(intake.scheduled_time),
      name: names.get(intake.medication_id) ?? 'Verwijderd middel',
    });
    byDate.set(intake.taken_on, entries);
  }

  const days = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <Screen>
      <ScreenHeader
        title="Geschiedenis"
        subtitle={`De afgelopen ${INTAKE_HISTORY_DAYS} dagen.`}
      />

      {intakesQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : days.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Nog niets afgevinkt"
          description="Zodra je een dosis afvinkt, komt die hier te staan."
        />
      ) : (
        days.map(([date, entries]) => (
          <Card key={date} style={styles.card}>
            <Text variant="label">{formatDutchDate(date)}</Text>
            {entries
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((entry, index) => (
                <View key={`${entry.time}-${entry.name}-${index}`} style={styles.row}>
                  <Text variant="caption" muted style={styles.time}>
                    {entry.time}
                  </Text>
                  <Text style={styles.flex}>{entry.name}</Text>
                </View>
              ))}
          </Card>
        ))
      )}

      <Text variant="caption" muted style={styles.note}>
        {MEDICATION_PRIVACY_NOTE}
      </Text>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  time: { width: 48 },
  flex: { flex: 1 },
  note: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
