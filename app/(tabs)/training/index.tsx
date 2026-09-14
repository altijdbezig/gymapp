import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDutchDate } from '@/lib/date';
import { useActiveSession } from '@/features/training/useActiveSession';
import {
  groupRoutines,
  useCreateFolder,
  useDeleteFolder,
  useDeleteRoutine,
  useDuplicateRoutine,
  useRoutineFolders,
  useRoutines,
  type Routine,
} from '@/features/training/useRoutines';
import { usePendingSessionCount, useSessionHistory } from '@/features/training/useSessions';
import { buildWeek, useWeekSchedule } from '@/features/training/useWeekSchedule';
import { isoWeekday, WEEKDAY_LABELS, weekFrom } from '@/features/training/weekSchedule';
import { formatDurationLong } from '@/features/training/restTimer';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

export default function TrainingScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session: authSession } = useAuth();
  const userId = authSession?.user.id ?? null;

  const routinesQuery = useRoutines(userId);
  const foldersQuery = useRoutineFolders(userId);
  const scheduleQuery = useWeekSchedule(userId);
  const historyQuery = useSessionHistory(userId, 5);
  const pendingQuery = usePendingSessionCount(userId);
  const { session: activeSession, isRestoring } = useActiveSession();

  const createFolder = useCreateFolder(userId);
  const deleteFolder = useDeleteFolder(userId);
  const deleteRoutine = useDeleteRoutine(userId);
  const duplicateRoutine = useDuplicateRoutine(userId);

  const [isFolderSheetOpen, setFolderSheetOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [menuRoutine, setMenuRoutine] = useState<Routine | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: 'routine' | 'folder'; id: string; name: string } | null
  >(null);

  const routines = routinesQuery.data ?? [];
  const folders = foldersQuery.data ?? [];
  const groups = groupRoutines(routines, folders);

  const today = isoWeekday(new Date());
  const week = buildWeek(scheduleQuery.data ?? [], weekFrom(today));
  const todaysPlan = week[0];
  const todaysDay = routines
    .flatMap((routine) => routine.days.map((day) => ({ routine, day })))
    .find((entry) => entry.day.id === todaysPlan?.workoutDayId);

  const isLoading = routinesQuery.isLoading || scheduleQuery.isLoading;

  function startEmptyWorkout() {
    router.push('/(tabs)/training/session?mode=empty');
  }

  function startRoutine(dayId: string) {
    router.push(`/(tabs)/training/session?dayId=${dayId}`);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Training</Text>
        <Text muted>Je routines, je weekplanning en je sessies.</Text>
      </View>

      {!isRestoring && activeSession ? (
        <Card style={styles.cardHighlight}>
          <Text variant="heading">Je traint nu</Text>
          <Text muted>
            {activeSession.name} loopt nog. Ga verder waar je gebleven was.
          </Text>
          <Button
            title="Verder met je training"
            onPress={() => router.push('/(tabs)/training/session')}
          />
        </Card>
      ) : null}

      {pendingQuery.data ? (
        <Card style={styles.card}>
          <Text variant="heading">Nog niet opgeslagen</Text>
          <Text muted>
            {pendingQuery.data === 1
              ? 'Er staat 1 sessie klaar om te versturen zodra je weer verbinding hebt.'
              : `Er staan ${pendingQuery.data} sessies klaar om te versturen zodra je weer verbinding hebt.`}
          </Text>
          <Button
            title="Nu opnieuw proberen"
            variant="secondary"
            loading={pendingQuery.isFetching}
            onPress={() => pendingQuery.refetch()}
          />
        </Card>
      ) : null}

      {/* Vandaag */}
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text variant="heading">Vandaag</Text>
          <Text variant="caption" muted>
            {WEEKDAY_LABELS[today]}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={palette.primary} />
        ) : todaysDay ? (
          <>
            <Text muted>{todaysDay.routine.name} staat vandaag gepland.</Text>
            <Button
              title={`${todaysDay.routine.name} starten`}
              onPress={() => startRoutine(todaysDay.day.id)}
            />
          </>
        ) : todaysPlan?.isRestDay ? (
          <Text muted>Rustdag. Rust is waar je sterker van wordt.</Text>
        ) : (
          <Text muted>Niets gepland voor vandaag. Je kan altijd los trainen.</Text>
        )}

        <View style={styles.buttonRow}>
          <View style={styles.flex}>
            <Button title="Lege workout" variant="secondary" onPress={startEmptyWorkout} />
          </View>
          <View style={styles.flex}>
            <Button
              title="Weekplanning"
              variant="secondary"
              onPress={() => router.push('/(tabs)/training/week')}
            />
          </View>
        </View>
      </Card>

      {/* Routines */}
      <View style={styles.sectionHeader}>
        <Text variant="heading">Routines</Text>
        <View style={styles.sectionActions}>
          <IconAction
            icon="folder-outline"
            label="Map maken"
            onPress={() => setFolderSheetOpen(true)}
          />
          <IconAction
            icon="add"
            label="Routine maken"
            onPress={() => router.push('/(tabs)/training/routine/new')}
          />
        </View>
      </View>

      {routinesQuery.isError ? (
        <Card style={styles.card}>
          <Text variant="heading">Routines niet geladen</Text>
          <Text muted>
            We konden je routines niet ophalen. Controleer je internetverbinding.
          </Text>
          <Button
            title="Opnieuw proberen"
            variant="secondary"
            onPress={() => routinesQuery.refetch()}
          />
        </Card>
      ) : isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : routines.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="Nog geen routines"
          description="Maak een routine met de oefeningen die je vast doet, dan staat je training de volgende keer klaar."
          actionLabel="Eerste routine maken"
          onAction={() => router.push('/(tabs)/training/routine/new')}
        />
      ) : (
        groups.map((group) => (
          <View key={group.folder?.id ?? 'loose'} style={styles.group}>
            <View style={styles.rowBetween}>
              <Text variant="label" muted>
                {group.folder?.name ?? 'Zonder map'}
              </Text>
              {group.folder ? (
                <IconAction
                  icon="trash-outline"
                  label={`Map ${group.folder.name} verwijderen`}
                  onPress={() =>
                    setConfirmDelete({
                      kind: 'folder',
                      id: group.folder!.id,
                      name: group.folder!.name,
                    })
                  }
                />
              ) : null}
            </View>

            {group.routines.length === 0 ? (
              <Text variant="caption" muted style={styles.emptyFolder}>
                Deze map is nog leeg.
              </Text>
            ) : (
              group.routines.map((routine) => (
                <RoutineRow
                  key={routine.id}
                  routine={routine}
                  onOpen={() => router.push(`/(tabs)/training/routine/${routine.id}`)}
                  onStart={() => {
                    const dayId = routine.days[0]?.id;
                    if (dayId) startRoutine(dayId);
                  }}
                  onMenu={() => setMenuRoutine(routine)}
                />
              ))
            )}
          </View>
        ))
      )}

      {/* Geschiedenis */}
      <View style={styles.sectionHeader}>
        <Text variant="heading">Laatste sessies</Text>
        <IconAction
          icon="time-outline"
          label="Alle sessies"
          onPress={() => router.push('/(tabs)/training/history')}
        />
      </View>

      {historyQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : (historyQuery.data ?? []).length === 0 ? (
        <Card style={styles.card}>
          <Text muted>Je eerste sessie verschijnt hier zodra je er een hebt afgerond.</Text>
        </Card>
      ) : (
        (historyQuery.data ?? []).map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatDutchDate(item.performed_on)}`}
            onPress={() => router.push(`/(tabs)/training/history/${item.id}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.historyCard}>
              <View style={styles.flex}>
                <Text variant="label">{item.name}</Text>
                <Text variant="caption" muted>
                  {formatDutchDate(item.performed_on)} · {item.scoringSets} sets ·{' '}
                  {item.volumeKg.toLocaleString('nl-NL')} kg
                </Text>
              </View>
              <Text variant="caption" muted>
                {formatDurationLong(item.duration_seconds ?? 0)}
              </Text>
            </Card>
          </Pressable>
        ))
      )}

      <View style={styles.footerLinks}>
        <Button
          title="Statistieken"
          variant="secondary"
          onPress={() => router.push('/(tabs)/training/stats')}
        />
        <Button
          title="Je records"
          variant="secondary"
          onPress={() => router.push('/(tabs)/training/records')}
        />
      </View>

      {/* Nieuwe map */}
      <Sheet
        visible={isFolderSheetOpen}
        title="Nieuwe map"
        onClose={() => setFolderSheetOpen(false)}
      >
        <Input
          label="Naam"
          value={folderName}
          onChangeText={setFolderName}
          placeholder="Bijvoorbeeld: Push/Pull/Legs"
          autoFocus
        />
        <Button
          title="Map maken"
          loading={createFolder.isPending}
          onPress={async () => {
            if (!folderName.trim()) return;
            await createFolder.mutateAsync(folderName);
            setFolderName('');
            setFolderSheetOpen(false);
          }}
        />
      </Sheet>

      {/* Routine-menu */}
      <Sheet
        visible={!!menuRoutine}
        title={menuRoutine?.name ?? ''}
        onClose={() => setMenuRoutine(null)}
      >
        <Button
          title="Bewerken"
          variant="secondary"
          onPress={() => {
            const routine = menuRoutine;
            setMenuRoutine(null);
            if (routine) router.push(`/(tabs)/training/routine/${routine.id}`);
          }}
        />
        <Button
          title="Dupliceren"
          variant="secondary"
          loading={duplicateRoutine.isPending}
          onPress={async () => {
            if (!menuRoutine) return;
            await duplicateRoutine.mutateAsync(menuRoutine);
            setMenuRoutine(null);
          }}
        />
        <Button
          title="In een map zetten"
          variant="secondary"
          onPress={() => {
            const routine = menuRoutine;
            setMenuRoutine(null);
            if (routine) router.push(`/(tabs)/training/routine/${routine.id}`);
          }}
        />
        <Button
          title="Verwijderen"
          variant="secondary"
          onPress={() => {
            if (!menuRoutine) return;
            setConfirmDelete({ kind: 'routine', id: menuRoutine.id, name: menuRoutine.name });
            setMenuRoutine(null);
          }}
        />
      </Sheet>

      <ConfirmDialog
        visible={!!confirmDelete}
        title={confirmDelete?.kind === 'folder' ? 'Map verwijderen?' : 'Routine verwijderen?'}
        message={
          confirmDelete?.kind === 'folder'
            ? `"${confirmDelete?.name}" wordt verwijderd. De routines erin blijven bestaan en komen onder "Zonder map" te staan.`
            : `"${confirmDelete?.name}" wordt verwijderd. Je afgeronde sessies blijven in je geschiedenis staan.`
        }
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          if (confirmDelete.kind === 'folder') {
            await deleteFolder.mutateAsync(confirmDelete.id);
          } else {
            await deleteRoutine.mutateAsync(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
      />
    </Screen>
  );
}

function RoutineRow({
  routine,
  onOpen,
  onStart,
  onMenu,
}: {
  routine: Routine;
  onOpen: () => void;
  onStart: () => void;
  onMenu: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const exercises = routine.days[0]?.exercises ?? [];
  const preview = exercises
    .slice(0, 3)
    .map((entry) => entry.exercise?.name ?? 'Onbekende oefening')
    .join(', ');

  return (
    <Card style={styles.routineCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${routine.name} bewerken`}
        onPress={onOpen}
        style={styles.flex}
      >
        <Text variant="label">{routine.name}</Text>
        <Text variant="caption" muted numberOfLines={2}>
          {exercises.length === 0
            ? 'Nog geen oefeningen'
            : `${exercises.length} ${exercises.length === 1 ? 'oefening' : 'oefeningen'} · ${preview}${
                exercises.length > 3 ? '…' : ''
              }`}
        </Text>
      </Pressable>

      <View style={styles.routineActions}>
        <IconAction icon="ellipsis-horizontal" label="Meer opties" onPress={onMenu} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${routine.name} starten`}
          onPress={onStart}
          disabled={exercises.length === 0}
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.pressed,
            exercises.length === 0 && styles.disabled,
          ]}
        >
          <Ionicons name="play" size={18} color={palette.textInverse} />
        </Pressable>
      </View>
    </Card>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={palette.primary} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  card: { gap: spacing.md, marginBottom: spacing.md },
  cardHighlight: {
    gap: spacing.md,
    marginBottom: spacing.md,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionActions: { flexDirection: 'row', gap: spacing.md },
  group: { gap: spacing.sm, marginBottom: spacing.md },
  emptyFolder: { marginLeft: spacing.xs },
  routineCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  routineActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  startButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconAction: { padding: spacing.xs },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  footerLinks: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
});
