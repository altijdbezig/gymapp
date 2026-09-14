import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDurationLong } from '@/features/training/restTimer';
import { useSessionHistory } from '@/features/training/useSessions';
import { formatDutchDate } from '@/lib/date';
import { colors, spacing } from '@/theme/theme';

/** Every finished session, newest first. */
export default function HistoryScreen() {
  const { session } = useAuth();
  const historyQuery = useSessionHistory(session?.user.id ?? null);
  const sessions = historyQuery.data ?? [];

  return (
    <Screen>
      <ScreenHeader
        title="Geschiedenis"
        subtitle={
          sessions.length === 0
            ? undefined
            : `${sessions.length} ${sessions.length === 1 ? 'sessie' : 'sessies'}`
        }
      />

      {historyQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : historyQuery.isError ? (
        <Card style={styles.card}>
          <Text variant="heading">Geschiedenis niet geladen</Text>
          <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          <Button
            title="Opnieuw proberen"
            variant="secondary"
            onPress={() => historyQuery.refetch()}
          />
        </Card>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Nog geen sessies"
          description="Zodra je een training afrondt, komt hij hier te staan met je volume, je sets en je records."
          actionLabel="Naar training"
          onAction={() => router.replace('/(tabs)/training')}
        />
      ) : (
        sessions.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatDutchDate(item.performed_on)}`}
            onPress={() => router.push(`/(tabs)/training/history/${item.id}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.sessionCard}>
              <View style={styles.row}>
                <Text variant="label" style={styles.flex}>
                  {item.name}
                </Text>
                {item.is_comeback ? (
                  <Text variant="caption" style={styles.comeback}>
                    Comeback
                  </Text>
                ) : null}
              </View>

              <Text variant="caption" muted>
                {formatDutchDate(item.performed_on)} ·{' '}
                {formatDurationLong(item.duration_seconds ?? 0)}
              </Text>
              <Text variant="caption" muted>
                {item.scoringSets} {item.scoringSets === 1 ? 'set' : 'sets'} ·{' '}
                {item.volumeKg.toLocaleString('nl-NL')} kg volume
              </Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  sessionCard: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  comeback: { color: colors.primary },
  pressed: { opacity: 0.7 },
});
