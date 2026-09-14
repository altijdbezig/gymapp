/**
 * Local notifications.
 *
 * "Local" means the phone schedules them itself -- no server, no push tokens,
 * no account with a third party. Everything this app sends is a reminder you
 * asked for, so local is all it needs, and it keeps working in Expo Go.
 *
 * On the web the whole module quietly does nothing: the browser's notification
 * API needs a permission prompt and a service worker, which is not worth it for
 * a page you have open anyway.
 *
 * Tone rule for every message in the app: a reminder is neutral and helpful. No
 * message ever says you failed, and no notification ever ties eating to
 * training.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Identifiers, so a reminder can be replaced or cancelled by name. */
export const NOTIFICATION_IDS = {
  rest: 'rest-timer',
  evening: 'evening-reminder',
  logReminder: 'log-reminder',
  trainingDay: 'training-day-reminder',
  comeback: 'comeback-reminder',
} as const;

/** Android needs a channel before anything is allowed to make a sound. */
const ANDROID_CHANNEL_ID = 'gymapp-reminders';

const isSupported = Platform.OS !== 'web';

let handlerConfigured = false;

/**
 * Shows the notification even while the app is open. Without this a rest timer
 * that finishes in the foreground would fire silently, which is exactly when
 * you need it.
 */
function configureHandler() {
  if (handlerConfigured || !isSupported) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Asks for permission, once. Returns false on the web and whenever the user
 * said no -- callers treat that as "just do not send anything".
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isSupported) return false;

  configureHandler();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await ensureAndroidChannel();
    return true;
  }
  // Asking again after a refusal only annoys people; iOS ignores it anyway.
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) await ensureAndroidChannel();
  return requested.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Herinneringen',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

/** True when notifications were already allowed, without prompting. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!isSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

// ---------------------------------------------------------------------------
// The rest timer
// ---------------------------------------------------------------------------

/**
 * Fires when the rest between two sets is over.
 *
 * Scheduled rather than counted down in JavaScript, so it still arrives when
 * the app is in your pocket. Any previous rest notification is cancelled first:
 * finishing a set early must not leave an old one to go off later.
 */
export async function scheduleRestFinished(seconds: number, exerciseName: string): Promise<void> {
  if (!isSupported || seconds <= 0) return;

  try {
    configureHandler();
    if (!(await hasNotificationPermission())) return;

    await cancelRestNotification();
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.rest,
      content: {
        title: 'Rust voorbij',
        body: `Klaar voor je volgende set ${exerciseName.toLowerCase()}.`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  } catch {
    // A notification that cannot be scheduled must never break the workout.
  }
}

export async function cancelRestNotification(): Promise<void> {
  if (!isSupported) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS.rest);
  } catch {
    // Nothing scheduled; nothing to do.
  }
}

/** Throws away every reminder this app scheduled. Used when you turn them off. */
export async function cancelAllNotifications(): Promise<void> {
  if (!isSupported) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore.
  }
}
