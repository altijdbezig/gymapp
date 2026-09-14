/**
 * Keeping the scheduled reminders in step with the app.
 *
 * Runs wherever it is mounted (the Vandaag tab) and re-schedules whenever the
 * numbers behind a reminder change: you logged something, your target moved,
 * you changed the week planner. That is what makes the evening summary carry
 * tonight's numbers instead of this morning's.
 */
import { useEffect } from 'react';

import { sumEntries } from '@/features/nutrition/foodLog';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { useProfile } from '@/features/auth/useProfile';
import { useRoutines } from '@/features/training/useRoutines';
import { useSessionHistory } from '@/features/training/useSessions';
import { useWeekSchedule } from '@/features/training/useWeekSchedule';
import { daysSinceLastWorkout } from '@/features/training/streak';
import type { Weekday } from '@/features/training/weekSchedule';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { syncReminders } from './schedule';

export function useReminders(userId: string | null) {
  const profileQuery = useProfile(userId);
  const logQuery = useFoodLog(userId);
  const targetsQuery = useTodaysTargets(userId);
  const scheduleQuery = useWeekSchedule(userId);
  const routinesQuery = useRoutines(userId);
  const historyQuery = useSessionHistory(userId);

  const profile = profileQuery.data;
  const entries = logQuery.data;
  const target = targetsQuery.data;
  const weekSchedule = scheduleQuery.data;
  const routines = routinesQuery.data;
  const history = historyQuery.data;

  useEffect(() => {
    if (!userId || !profile) return;

    const dayNames = new Map<string, string>();
    for (const routine of routines ?? []) {
      for (const day of routine.days) {
        dayNames.set(day.id, routine.name);
      }
    }

    const trainingDays = (weekSchedule ?? [])
      .filter((row) => row.workout_day_id !== null)
      .map((row) => ({
        weekday: row.weekday as Weekday,
        routineName: dayNames.get(row.workout_day_id!) ?? 'Je training',
      }));

    void syncReminders({
      settings: {
        notifyEvening: profile.notify_evening,
        eveningTime: profile.evening_time,
        notifyLogReminder: profile.notify_log_reminder,
        notifyTrainingDay: profile.notify_training_day,
        notifyComeback: profile.notify_comeback,
      },
      eaten: sumEntries(entries ?? []),
      target: target ? { kcal: target.kcal, proteinG: target.protein_g } : null,
      entriesToday: (entries ?? []).length,
      trainingDays,
      daysSinceLastWorkout: daysSinceLastWorkout(
        (history ?? []).map((session) => session.performed_on),
        todayIsoDate(),
      ),
    });
  }, [userId, profile, entries, target, weekSchedule, routines, history]);
}
