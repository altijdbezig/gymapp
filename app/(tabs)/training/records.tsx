import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { normaliseTerm } from '@/features/training/exerciseLibrary';
import { useExerciseMap } from '@/features/training/useExercises';
import { usePersonalRecords } from '@/features/training/useSessions';
import { formatDutchDate } from '@/lib/date';
import { colors, spacing } from '@/theme/theme';

/**
 * Every personal record you hold, one card per exercise.
 *
 * Deliberately plain: a list of facts about what you lifted, with the date. No
 * ranking, no comparison with anyone else.
 */
export default function RecordsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const recordsQuery = usePersonalRecords(userId);
  const { map: exerciseMap } = useExerciseMap(userId);
  const [query, setQuery] = useState('');

  const records = useMemo(() => {
    const rows = (recordsQuery.data ?? []).map((record) => ({
      record,
      name: exerciseMap.get(record.exercise_id)?.name ?? 'Onbekende oefening',
    }));

    const needle = normaliseTerm(query);
    return rows
      .filter((row) => needle.length === 0 || normaliseTerm(row.name).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }, [recordsQuery.data, exerciseMap, query]);

  return (
    <Screen>
      <ScreenHeader
        title="Je records"
        subtitle="Wat je tot nu toe het zwaarst, het beste en het meest hebt gedaan."
      />

      {recordsQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : recordsQuery.isError ? (
        <Card style={styles.card}>
          <Text variant="heading">Records niet geladen</Text>
          <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          <Button
            title="Opnieuw proberen"
            variant="secondary"
            onPress={() => recordsQuery.refetch()}
          />
        </Card>
      ) : (recordsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="Nog geen records"
          description="Je eerste set van een oefening is meteen je eerste record. Ze verschijnen hier vanzelf."
        />
      ) : (
        <>
          <Input
            label="Zoeken"
            value={query}
            onChangeText={setQuery}
            placeholder="Bijvoorbeeld bankdrukken"
            autoCorrect={false}
          />

          {records.length === 0 ? (
            <Text muted style={styles.noResults}>
              Geen oefening gevonden met die naam.
            </Text>
          ) : (
            records.map(({ record, name }) => (
              <Card key={record.id} style={styles.card}>
                <Text variant="heading">{name}</Text>

                {record.best_weight_kg !== null ? (
                  <RecordRow
                    label="Zwaarste set"
                    value={`${formatNumber(record.best_weight_kg)} kg${
                      record.best_weight_reps ? ` × ${record.best_weight_reps}` : ''
                    }`}
                    date={record.best_weight_on}
                  />
                ) : null}

                {record.best_1rm_kg !== null ? (
                  <RecordRow
                    label="Geschatte 1RM"
                    value={`${formatNumber(record.best_1rm_kg)} kg`}
                    date={record.best_1rm_on}
                  />
                ) : null}

                {record.best_volume_kg !== null ? (
                  <RecordRow
                    label="Meeste volume in één sessie"
                    value={`${Math.round(record.best_volume_kg).toLocaleString('nl-NL')} kg`}
                    date={record.best_volume_on}
                  />
                ) : null}
              </Card>
            ))
          )}
        </>
      )}

      <Text variant="caption" muted style={styles.footnote}>
        De geschatte 1RM komt uit de formule van Epley: gewicht × (1 + herhalingen / 30). Het is
        een schatting, geen meting.
      </Text>
    </Screen>
  );
}

function RecordRow({
  label,
  value,
  date,
}: {
  label: string;
  value: string;
  date: string | null;
}) {
  return (
    <View style={styles.row}>
      <Text muted style={styles.rowLabel}>
        {label}
      </Text>
      <View style={styles.rowValue}>
        <Text variant="label">{value}</Text>
        {date ? (
          <Text variant="caption" muted>
            {formatDutchDate(date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowLabel: { flex: 1 },
  rowValue: { alignItems: 'flex-end' },
  noResults: { marginTop: spacing.md },
  footnote: { marginTop: spacing.md, marginBottom: spacing.xl, color: colors.textMuted },
});
