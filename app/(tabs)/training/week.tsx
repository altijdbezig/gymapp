import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRoutines } from '@/features/training/useRoutines';
import {
  buildWeek,
  useClearWeekday,
  useSetWeekday,
  useWeekSchedule,
} from '@/features/training/useWeekSchedule';
import {
  isoWeekday,
  relativeWeekdayLabel,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type Weekday,
} from '@/features/training/weekSchedule';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Which routine belongs to which weekday.
 *
 * Always Monday to Sunday, not "starting today": a week planner you can compare
 * with a paper one is easier to read than one that shifts every day.
 */
export default function WeekScheduleScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const scheduleQuery = useWeekSchedule(userId);
  const routinesQuery = useRoutines(userId);
  const setWeekday = useSetWeekday(userId);
  const clearWeekday = useClearWeekday(userId);

  const [editing, setEditing] = useState<Weekday | null>(null);

  const today = isoWeekday(new Date());
  const week = buildWeek(scheduleQuery.data ?? [], WEEKDAYS);

  const days = (routinesQuery.data ?? []).flatMap((routine) =>
    routine.days.map((day) => ({ routine, day })),
  );

  const isLoading = scheduleQuery.isLoading || routinesQuery.isLoading;

  return (
    <Screen>
      <ScreenHeader
        title="Weekplanning"
        subtitle="Kies per dag een routine of een rustdag."
      />

      {isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : days.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Nog geen routines"
          description="Maak eerst een routine, dan kan je die hier op een dag zetten."
          actionLabel="Routine maken"
          onAction={() => router.push('/(tabs)/training/routine/new')}
        />
      ) : (
        week.map((planned) => {
          const match = days.find((entry) => entry.day.id === planned.workoutDayId);

          return (
            <Pressable
              key={planned.weekday}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_LABELS[planned.weekday]} aanpassen`}
              onPress={() => setEditing(planned.weekday)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card
                style={[
                  styles.dayCard,
                  planned.weekday === today && styles.dayCardToday,
                ]}
              >
                <View style={styles.flex}>
                  <Text variant="label">
                    {WEEKDAY_LABELS[planned.weekday]}
                    {planned.weekday === today ? ' · vandaag' : ''}
                  </Text>
                  <Text variant="caption" muted>
                    {match
                      ? match.routine.name
                      : planned.isRestDay
                        ? 'Rustdag'
                        : 'Niets gepland'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })
      )}

      <Sheet
        visible={editing !== null}
        title={editing ? relativeWeekdayLabel(editing, today) : ''}
        onClose={() => setEditing(null)}
      >
        {days.map((entry) => (
          <Button
            key={entry.day.id}
            title={entry.routine.name}
            variant="secondary"
            onPress={async () => {
              if (editing === null) return;
              await setWeekday.mutateAsync({ weekday: editing, workoutDayId: entry.day.id });
              setEditing(null);
            }}
          />
        ))}

        <Button
          title="Rustdag"
          variant="secondary"
          onPress={async () => {
            if (editing === null) return;
            await setWeekday.mutateAsync({ weekday: editing, workoutDayId: null });
            setEditing(null);
          }}
        />

        <Button
          title="Niets plannen"
          variant="secondary"
          onPress={async () => {
            if (editing === null) return;
            await clearWeekday.mutateAsync(editing);
            setEditing(null);
          }}
        />
      </Sheet>

      <Text variant="caption" muted style={styles.footnote}>
        Een rustdag is geen gemiste dag. Rust is waar je sterker van wordt.
      </Text>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  dayCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  dayCardToday: { borderColor: colors.primary },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  footnote: { marginTop: spacing.md, marginBottom: spacing.xl },
});
