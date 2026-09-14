/**
 * Scheduling the reminders.
 *
 * A local notification carries fixed text, but "nog ruimte voor 600 kcal" is
 * only true at the moment it is worked out. So the evening summary is not a
 * repeating notification: it is scheduled fresh every time the app has new
 * numbers, as a one-off for tonight. Opening the app once during the day is
 * enough, and if you never open it you get no summary, which is correct -- a
 * summary of a day you did not log has nothing to say.
 *
 * The reminders that do not depend on numbers -- a training day, medication --
 * repeat weekly, so they keep working with the app closed.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { MacroTotals } from '@/features/nutrition/foodLog';
import type { Weekday } from '@/features/training/weekSchedule';
import {
  comebackReminder,
  eveningReminder,
  logReminder,
  parseTimeOfDay,
  trainingDayReminder,
  type Reminder,
} from './reminders';
import { ensureNotificationPermission, hasNotificationPermission } from './localNotifications';

const ANDROID_CHANNEL_ID = 'gymapp-reminders';

const IDS = {
  evening: 'evening-summary',
  log: 'log-reminder',
  comeback: 'comeback-reminder',
  /** One per weekday, so changing Monday does not touch Tuesday. */
  trainingDay: (weekday: Weekday) => `training-day-${weekday}`,
} as const;

const isSupported = Platform.OS !== 'web';

/** What the app knows when it goes to schedule. */
export type ReminderContext = {
  settings: {
    notifyEvening: boolean;
    eveningTime: string;
    notifyLogReminder: boolean;
    notifyTrainingDay: boolean;
    notifyComeback: boolean;
  };
  /** Today's totals and target, for the evening summary. */
  eaten: MacroTotals;
  target: { kcal: number; proteinG: number } | null;
  /** How many things were logged today; zero means the log reminder applies. */
  entriesToday: number;
  /** Weekday -> routine name, for the days you planned a workout. */
  trainingDays: { weekday: Weekday; routineName: string }[];
  /** Days since the last workout, or null if there has never been one. */
  daysSinceLastWorkout: number | null;
};

/**
 * Cancels everything this module schedules and puts back what is still wanted.
 *
 * Cancel-then-reschedule rather than diffing: the whole set is at most ten
 * notifications, and a diff would have to reason about a state the OS owns.
 */
export async function syncReminders(context: ReminderContext): Promise<void> {
  if (!isSupported) return;
  if (!(await hasNotificationPermission())) return;

  try {
    await cancelAllManagedReminders();

    const { settings } = context;
    const { hour, minute } = parseTimeOfDay(settings.eveningTime);

    if (settings.notifyEvening && context.target) {
      await scheduleAtNextTime(
        IDS.evening,
        hour,
        minute,
        eveningReminder(context.eaten, context.target),
      );
    }

    // The log reminder and the evening summary would say nearly the same thing
    // on an empty day, so only one of them is ever sent.
    if (settings.notifyLogReminder && context.entriesToday === 0 && !settings.notifyEvening) {
      await scheduleAtNextTime(IDS.log, hour, minute, logReminder());
    }

    if (settings.notifyTrainingDay) {
      for (const day of context.trainingDays) {
        await scheduleWeekly(
          IDS.trainingDay(day.weekday),
          day.weekday,
          // Mid-morning: early enough to plan your day around, late enough not
          // to be the thing that wakes you up.
          9,
          0,
          trainingDayReminder(day.routineName),
        );
      }
    }

    if (
      settings.notifyComeback &&
      context.daysSinceLastWorkout !== null &&
      context.daysSinceLastWorkout >= 7
    ) {
      // Tomorrow morning rather than right now: you are looking at the app at
      // this very moment, so a notification would be pointless.
      await scheduleAtNextTime(
        IDS.comeback,
        10,
        0,
        comebackReminder(context.daysSinceLastWorkout),
      );
    }
  } catch {
    // A scheduling failure must never break a screen. Worst case: no reminder.
  }
}

/** Turning reminders on asks for permission first, then schedules. */
export async function enableReminders(context: ReminderContext): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  await syncReminders(context);
  return true;
}

export async function cancelAllManagedReminders(): Promise<void> {
  if (!isSupported) return;

  const ids = [
    IDS.evening,
    IDS.log,
    IDS.comeback,
    ...([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map(IDS.trainingDay),
  ];

  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Nothing scheduled under that id; nothing to cancel.
    }
  }
}

/**
 * Schedules a one-off at the next occurrence of a time of day.
 *
 * A DAILY trigger would be simpler, but then tonight's summary would repeat
 * tomorrow with today's numbers in it. Working out the delay ourselves keeps
 * every summary tied to the day it describes.
 */
async function scheduleAtNextTime(
  identifier: string,
  hour: number,
  minute: number,
  reminder: Reminder,
): Promise<void> {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const seconds = Math.max(1, Math.round((target.getTime() - now.getTime()) / 1000));

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: reminder.title, body: reminder.body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

/** A repeating weekly reminder, which keeps working with the app closed. */
async function scheduleWeekly(
  identifier: string,
  weekday: Weekday,
  hour: number,
  minute: number,
  reminder: Reminder,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: reminder.title, body: reminder.body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      // expo-notifications counts Sunday as 1; the app uses ISO, where Monday
      // is 1 and Sunday is 7.
      weekday: isoToExpoWeekday(weekday),
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

/** ISO 1..7 (Mon..Sun) to the 1..7 (Sun..Sat) expo-notifications wants. */
export function isoToExpoWeekday(weekday: Weekday): number {
  return weekday === 7 ? 1 : weekday + 1;
}
