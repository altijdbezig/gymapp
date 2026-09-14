import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/features/auth/AuthProvider';
import { MEDICAL_DISCLAIMER, normaliseTime } from '@/features/medication/medicationSchedule';
import {
  useDeleteMedication,
  useMedications,
  useSaveMedication,
} from '@/features/medication/useMedication';
import { WEEKDAYS, WEEKDAY_SHORT, type Weekday } from '@/features/training/weekSchedule';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/** The times offered as chips; anything else is typed in. */
const COMMON_TIMES = ['07:00', '08:00', '12:00', '13:00', '18:00', '20:00', '22:00'] as const;

/**
 * Adding or editing a medication.
 *
 * `id` is "new" for one that does not exist yet. The dose is a free text field
 * on purpose: "1 tablet", "2 pufjes" and "halve dosis" all have to fit, and a
 * structured amount-and-unit would make people translate what is on their own
 * box and get it wrong.
 */
export default function MedicationEditorScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const medicationsQuery = useMedications(userId);
  const saveMedication = useSaveMedication();
  const deleteMedication = useDeleteMedication(userId);

  const existing = isNew
    ? null
    : (medicationsQuery.data ?? []).find((medication) => medication.id === id) ?? null;

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [customTime, setCustomTime] = useState('');
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [stock, setStock] = useState('');
  const [stockUnit, setStockUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoaded, setIsLoaded] = useState(isNew);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isLoaded || !existing) return;

    setName(existing.name);
    setDose(existing.dose ?? '');
    setTimes(existing.times.map(normaliseTime));
    setWeekdays(existing.weekdays as Weekday[]);
    setStock(existing.stock_count === null ? '' : String(Number(existing.stock_count)));
    setStockUnit(existing.stock_unit ?? '');
    setNotes(existing.notes ?? '');
    setIsActive(existing.is_active);
    setIsLoaded(true);
  }, [existing, isLoaded]);

  function toggleTime(time: string) {
    setTimes((current) =>
      current.includes(time) ? current.filter((entry) => entry !== time) : [...current, time].sort(),
    );
  }

  function toggleWeekday(weekday: Weekday) {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((entry) => entry !== weekday)
        : [...current, weekday].sort((a, b) => a - b),
    );
  }

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) {
      setError('Vul een naam in.');
      return;
    }
    if (times.length === 0) {
      setError('Kies minstens één tijdstip.');
      return;
    }

    setError(undefined);

    try {
      await saveMedication.mutateAsync({
        userId,
        id: existing?.id ?? null,
        name,
        dose,
        times,
        weekdays,
        stockCount: stock.trim() ? Number(stock.replace(',', '.')) || null : null,
        stockUnit: stockUnit || null,
        notes,
        isActive,
      });

      if (router.canGoBack()) router.back();
    } catch {
      setError('Opslaan is niet gelukt. Controleer je internetverbinding.');
    }
  }

  if (!isNew && medicationsQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Middel" />
        <ActivityIndicator color={palette.primary} />
      </Screen>
    );
  }

  if (!isNew && !existing) {
    return (
      <Screen>
        <ScreenHeader title="Middel" />
        <EmptyState
          icon="alert-circle-outline"
          title="Niet gevonden"
          description="Dit middel staat niet meer in je lijst."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={isNew ? 'Middel toevoegen' : name || 'Middel'}
        subtitle="Naam, dosering en de tijden waarop je een seintje wil."
      />

      <Card style={styles.card}>
        <Input
          label="Naam"
          value={name}
          onChangeText={setName}
          placeholder="Bijvoorbeeld: Vitamine D"
          autoFocus={isNew}
        />

        <Input
          label="Dosering"
          value={dose}
          onChangeText={setDose}
          placeholder="1 tablet"
          hint="Schrijf het over van de verpakking."
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Tijdstippen</Text>
        <ChipRow>
          {COMMON_TIMES.map((time) => (
            <Chip
              key={time}
              label={time}
              selected={times.includes(time)}
              onPress={() => toggleTime(time)}
            />
          ))}
        </ChipRow>

        {times.filter((time) => !(COMMON_TIMES as readonly string[]).includes(time)).length > 0 ? (
          <ChipRow>
            {times
              .filter((time) => !(COMMON_TIMES as readonly string[]).includes(time))
              .map((time) => (
                <Chip key={time} label={`${time} ✕`} selected onPress={() => toggleTime(time)} />
              ))}
          </ChipRow>
        ) : null}

        <Input
          label="Andere tijd"
          value={customTime}
          onChangeText={setCustomTime}
          placeholder="09:30"
        />
        <Button
          title="Tijd toevoegen"
          variant="secondary"
          onPress={() => {
            const match = /^(\d{1,2}):(\d{2})$/.exec(customTime.trim());
            if (!match) return;

            const hour = Number(match[1]);
            const minute = Number(match[2]);
            if (hour > 23 || minute > 59) return;

            toggleTime(normaliseTime(customTime.trim()));
            setCustomTime('');
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Dagen</Text>
        <Text variant="caption" muted>
          Kies niets als het elke dag is.
        </Text>
        <ChipRow>
          {WEEKDAYS.map((weekday) => (
            <Chip
              key={weekday}
              label={WEEKDAY_SHORT[weekday]}
              selected={weekdays.includes(weekday)}
              onPress={() => toggleWeekday(weekday)}
            />
          ))}
        </ChipRow>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Voorraad</Text>
        <Text variant="caption" muted>
          Optioneel. De app trekt er één af per afgevinkte dosis, zodat je ziet wanneer je bijna
          door je voorraad heen bent.
        </Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Aantal"
              value={stock}
              onChangeText={setStock}
              placeholder="30"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.flex}>
            <Input
              label="Eenheid"
              value={stockUnit}
              onChangeText={setStockUnit}
              placeholder="tabletten"
            />
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Input
          label="Notitie"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optioneel, bijvoorbeeld: bij het eten innemen"
          multiline
        />
        <Toggle
          label="Herinneringen aan"
          description="Uit zetten stopt de meldingen; je geschiedenis blijft staan."
          value={isActive}
          onChange={setIsActive}
        />
      </Card>

      <Text variant="caption" muted style={styles.disclaimer}>
        {MEDICAL_DISCLAIMER}
      </Text>

      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Opslaan" loading={saveMedication.isPending} onPress={handleSave} />
        {!isNew ? (
          <Button title="Verwijderen" variant="secondary" onPress={() => setConfirmDelete(true)} />
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="Middel verwijderen?"
        message={`"${name}" wordt verwijderd, samen met de geschiedenis van wat je ervan hebt afgevinkt. Dit kan niet ongedaan worden gemaakt.`}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (existing) await deleteMedication.mutateAsync(existing.id);
          router.dismissTo('/(tabs)/settings/medication');
        }}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  disclaimer: { marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginBottom: spacing.xl },
});
