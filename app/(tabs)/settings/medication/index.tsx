import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/auth/useProfile';
import {
  describeDay,
  describeSchedule,
  dosesForDay,
  normaliseTime,
  stockRemaining,
  MEDICAL_DISCLAIMER,
  MEDICATION_PRIVACY_NOTE,
} from '@/features/medication/medicationSchedule';
import { useIntakes, useMedications, useToggleIntake } from '@/features/medication/useMedication';
import { syncMedicationReminders } from '@/features/notifications/schedule';
import { isoWeekday } from '@/features/training/weekSchedule';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { colors, spacing } from '@/theme/theme';

/**
 * Medication and supplements.
 *
 * Today's doses at the top to tick off, your list underneath. The disclaimer is
 * on the screen itself rather than hidden in a menu, because it is the most
 * important thing here: these are reminders you set, not advice.
 */
export default function MedicationScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const medicationsQuery = useMedications(userId);
  const intakesQuery = useIntakes(userId);
  const toggleIntake = useToggleIntake();

  const today = todayIsoDate();
  const weekday = isoWeekday(new Date());

  const medications = medicationsQuery.data ?? [];
  const intakes = intakesQuery.data ?? [];
  const doses = dosesForDay(medications, intakes, weekday, today);

  const notifyMedication = profileQuery.data?.notify_medication ?? false;

  // Keeps the scheduled reminders in step with the list.
  useEffect(() => {
    if (!userId) return;

    void syncMedicationReminders(
      medications
        .filter((medication) => medication.is_active)
        .flatMap((medication) =>
          medication.times.map((time) => ({
            medicationId: medication.id,
            name: medication.name,
            dose: medication.dose,
            time: normaliseTime(time),
            weekdays: medication.weekdays,
          })),
        ),
      notifyMedication,
    );
  }, [userId, medications, notifyMedication]);

  if (medicationsQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Medicatie" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Medicatie en supplementen"
        subtitle="Alleen herinneringen die je zelf instelt."
      />

      <Card style={styles.disclaimerCard}>
        <View style={styles.iconRow}>
          <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
          <Text variant="label" style={styles.flex}>
            Geen medisch advies
          </Text>
        </View>
        <Text variant="caption" muted>
          {MEDICAL_DISCLAIMER}
        </Text>
      </Card>

      {medications.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="Nog niets toegevoegd"
          description="Voeg een middel toe met de tijden waarop je eraan herinnerd wil worden."
          actionLabel="Middel toevoegen"
          onAction={() => router.push('/(tabs)/settings/medication/new')}
        />
      ) : (
        <>
          <Card style={styles.card}>
            <Text variant="heading">Vandaag</Text>
            <Text variant="caption" muted>
              {describeDay(doses)}
            </Text>

            {doses.map((dose) => (
              <Pressable
                key={dose.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dose.isTaken }}
                accessibilityLabel={`${dose.medication.name} om ${dose.time} afvinken`}
                onPress={() =>
                  userId &&
                  toggleIntake.mutate({
                    userId,
                    medicationId: dose.medication.id,
                    scheduledTime: dose.time,
                    isTaken: dose.isTaken,
                  })
                }
                style={({ pressed }) => [styles.doseRow, pressed && styles.pressed]}
              >
                <Ionicons
                  name={dose.isTaken ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={dose.isTaken ? colors.success : colors.border}
                />
                <View style={styles.flex}>
                  <Text variant="label" style={dose.isTaken ? styles.taken : undefined}>
                    {dose.medication.name}
                  </Text>
                  <Text variant="caption" muted>
                    {dose.time}
                    {dose.medication.dose ? ` · ${dose.medication.dose}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>

          <View style={styles.sectionHeader}>
            <Text variant="heading">Je middelen</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Middel toevoegen"
              onPress={() => router.push('/(tabs)/settings/medication/new')}
              hitSlop={spacing.sm}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          </View>

          {medications.map((medication) => {
            const stock = stockRemaining(medication, intakes);

            return (
              <Pressable
                key={medication.id}
                accessibilityRole="button"
                accessibilityLabel={`${medication.name} bewerken`}
                onPress={() => router.push(`/(tabs)/settings/medication/${medication.id}`)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={styles.medicationCard}>
                  <View style={styles.flex}>
                    <Text variant="label" style={!medication.is_active ? styles.inactive : undefined}>
                      {medication.name}
                      {medication.is_active ? '' : ' · uit'}
                    </Text>
                    <Text variant="caption" muted>
                      {medication.dose ? `${medication.dose} · ` : ''}
                      {describeSchedule(medication)}
                    </Text>
                    {stock !== null ? (
                      <Text variant="caption" muted>
                        Nog ongeveer {stock} {medication.stock_unit ?? 'stuks'} op voorraad
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Card>
              </Pressable>
            );
          })}

          <View style={styles.actions}>
            <Button
              title="Middel toevoegen"
              onPress={() => router.push('/(tabs)/settings/medication/new')}
            />
            <Button
              title="Geschiedenis"
              variant="secondary"
              onPress={() => router.push('/(tabs)/settings/medication/history')}
            />
          </View>
        </>
      )}

      {!notifyMedication ? (
        <Card style={styles.card}>
          <Text variant="heading">Meldingen staan uit</Text>
          <Text muted>
            Zet meldingen voor medicatie aan als je op de ingestelde tijden een berichtje wil.
          </Text>
          <Button
            title="Naar meldingen"
            variant="secondary"
            onPress={() => router.push('/(tabs)/settings/notifications')}
          />
        </Card>
      ) : null}

      <Text variant="caption" muted style={styles.note}>
        {MEDICATION_PRIVACY_NOTE}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  disclaimerCard: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderColor: colors.warning,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  taken: { textDecorationLine: 'line-through', color: colors.textMuted },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  medicationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  inactive: { color: colors.textMuted },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  note: { marginTop: spacing.md, marginBottom: spacing.xl },
});
