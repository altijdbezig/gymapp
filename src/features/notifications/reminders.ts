/**
 * What the reminders say, and when.
 *
 * The wording lives here, away from the scheduling, so it can be read and
 * tested as copy. Three rules it has to keep, and they are not style
 * preferences:
 *
 *   1. A reminder never mentions a missed workout in the same breath as food.
 *      Nothing in this app makes you eat less because you did not train.
 *   2. A reminder never says you failed. "Nog niets gelogd vandaag" is a fact;
 *      "je bent weer vergeten te loggen" is a telling-off.
 *   3. Remaining calories are phrased as room to eat, not as a budget you are
 *      about to blow. Going over the target is not an emergency.
 */
import type { MacroTotals } from '@/features/nutrition/foodLog';

export type ReminderKind =
  | 'evening'
  | 'log'
  | 'trainingDay'
  | 'comeback'
  | 'rest'
  | 'medication';

export const REMINDER_LABELS: Record<ReminderKind, string> = {
  evening: 'Avondoverzicht',
  log: 'Herinnering om te loggen',
  trainingDay: 'Herinnering op een trainingsdag',
  comeback: 'Comeback na een pauze',
  rest: 'Rusttimer',
  medication: 'Medicatie en supplementen',
};

export const REMINDER_DESCRIPTIONS: Record<ReminderKind, string> = {
  evening: "'s Avonds een berichtje met hoeveel kcal en eiwit je nog hebt.",
  log: "'s Avonds een seintje als je die dag nog niets hebt gelogd.",
  trainingDay: 'Een seintje op een dag waarop je een routine hebt ingepland.',
  comeback: 'Een vriendelijk bericht als je een week of langer niet hebt getraind.',
  rest: 'Een melding zodra je rust tussen twee sets voorbij is.',
  medication: 'Een melding op de tijden die je zelf hebt ingesteld.',
};

export type Reminder = { title: string; body: string };

/**
 * The evening summary.
 *
 * Reads as "you have this much room left", and when you are over the target it
 * says so neutrally and stops there. No advice, no suggestion to skip anything.
 */
export function eveningReminder(
  eaten: MacroTotals,
  target: { kcal: number; proteinG: number },
): Reminder {
  const kcalLeft = target.kcal - eaten.kcal;
  const proteinLeft = target.proteinG - eaten.proteinG;

  if (eaten.kcal === 0) {
    return {
      title: 'Nog niets gelogd vandaag',
      body: `Je doel voor vandaag is ${target.kcal} kcal en ${target.proteinG} g eiwit.`,
    };
  }

  const kcalText =
    kcalLeft > 0
      ? `Nog ruimte voor ${kcalLeft} kcal`
      : kcalLeft === 0
        ? 'Je zit precies op je doel'
        : `Je zit ${Math.abs(kcalLeft)} kcal over je doel`;

  const proteinText =
    proteinLeft > 0
      ? `nog ${proteinLeft} g eiwit te gaan`
      : 'je eiwit is binnen';

  return {
    title: 'Je dag tot nu toe',
    body: `${kcalText}, ${proteinText}.`,
  };
}

/** Only sent when nothing at all was logged that day. */
export function logReminder(): Reminder {
  return {
    title: 'Nog niets gelogd vandaag',
    body: 'Even bijwerken kost een halve minuut. Een schatting telt ook.',
  };
}

/** On a day the week planner has a routine on. */
export function trainingDayReminder(routineName: string): Reminder {
  return {
    title: 'Vandaag staat er een training',
    body: `${routineName} staat ingepland. Ook een kortere sessie telt.`,
  };
}

/** After a week or more without training. */
export function comebackReminder(days: number): Reminder {
  return {
    title: 'Zin om weer te beginnen?',
    body: `Je laatste training was ${days} dagen geleden. De app heeft een lichtere sessie voor je klaarstaan.`,
  };
}

/** The rest timer, which is the only reminder that is on by default. */
export function restReminder(exerciseName: string): Reminder {
  return {
    title: 'Rust voorbij',
    body: `Klaar voor je volgende set ${exerciseName.toLowerCase()}.`,
  };
}

/** Medication and supplements (phase 8). A reminder, never advice. */
export function medicationReminder(name: string, dose: string | null): Reminder {
  return {
    title: name,
    body: dose ? `${dose} — tijd voor je herinnering.` : 'Tijd voor je herinnering.',
  };
}

/**
 * "20:00" parsed into hours and minutes.
 *
 * Postgres hands a `time` column back as "20:00:00"; a user picking a time in
 * the app produces "20:00". Both parse, and anything else falls back to eight
 * in the evening rather than throwing inside a notification scheduler.
 */
export function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(value.trim());
  if (!match) return { hour: 20, minute: 0 };

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return { hour: 20, minute: 0 };
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return { hour: 20, minute: 0 };

  return { hour, minute };
}

/** The other direction, for storing what a picker produced. */
export function formatTimeOfDay(hour: number, minute: number): string {
  const safeHour = Math.min(23, Math.max(0, Math.round(hour)));
  const safeMinute = Math.min(59, Math.max(0, Math.round(minute)));
  return `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
}
