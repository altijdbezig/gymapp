/**
 * Working out which doses are due today, and which of them you ticked off.
 *
 * The one thing this file must never become is a judgement. It reports what you
 * asked to be reminded of and what you marked as taken, and nothing else. A
 * missed dose produces no row, no warning and no colour -- the app has no idea
 * whether that was a mistake, a deliberate skip or a doctor's instruction, and
 * it is not its place to guess.
 *
 * There is no interaction checking anywhere in this codebase, and there never
 * should be: that is a pharmacist's job and getting it subtly wrong would be
 * worse than not doing it at all.
 */
import type { Tables } from '@/types/database';
import type { Weekday } from '@/features/training/weekSchedule';
import { parseTimeOfDay } from '@/features/notifications/reminders';

export type Medication = Tables<'medications'>;
export type MedicationIntake = Tables<'medication_intakes'>;

/** Shown on every screen that touches this data. Not optional. */
export const MEDICAL_DISCLAIMER =
  'Deze app geeft geen medisch advies en controleert niet op wisselwerkingen tussen middelen. ' +
  'Het zijn alleen herinneringen die je zelf instelt. Heb je vragen over je medicatie of over ' +
  'een supplement, vraag het dan aan je arts of apotheker.';

export const MEDICATION_PRIVACY_NOTE =
  'Wat je hier invult is gezondheidsinformatie. Het staat alleen in jouw account, wordt nergens ' +
  'anders in de app getoond en gaat niet naar derden.';

/** A time as stored: Postgres hands back "08:00:00". */
export function normaliseTime(value: string): string {
  const { hour, minute } = parseTimeOfDay(value);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Minutes since midnight, for sorting and for "what is next". */
export function minutesOfDay(value: string): number {
  const { hour, minute } = parseTimeOfDay(value);
  return hour * 60 + minute;
}

/** An empty weekday list means every day. */
export function runsOnWeekday(medication: Medication, weekday: Weekday): boolean {
  if (medication.weekdays.length === 0) return true;
  return medication.weekdays.includes(weekday);
}

export type Dose = {
  /** medicationId + time, unique within a day. */
  key: string;
  medication: Medication;
  /** "08:00". */
  time: string;
  minutes: number;
  isTaken: boolean;
  takenAt: string | null;
};

/**
 * Every dose due on one day, earliest first.
 *
 * Only active medications count: switching one off stops the reminders without
 * throwing away the history of when you did take it.
 */
export function dosesForDay(
  medications: readonly Medication[],
  intakes: readonly MedicationIntake[],
  weekday: Weekday,
  date: string,
): Dose[] {
  const taken = new Map<string, MedicationIntake>();
  for (const intake of intakes) {
    if (intake.taken_on !== date) continue;
    taken.set(`${intake.medication_id}|${normaliseTime(intake.scheduled_time)}`, intake);
  }

  return medications
    .filter((medication) => medication.is_active)
    .filter((medication) => runsOnWeekday(medication, weekday))
    .flatMap((medication) =>
      medication.times.map((rawTime) => {
        const time = normaliseTime(rawTime);
        const intake = taken.get(`${medication.id}|${time}`);

        return {
          key: `${medication.id}|${time}`,
          medication,
          time,
          minutes: minutesOfDay(time),
          isTaken: !!intake,
          takenAt: intake?.taken_at ?? null,
        };
      }),
    )
    .sort((a, b) => a.minutes - b.minutes || a.medication.name.localeCompare(b.medication.name, 'nl'));
}

/** The next dose still to come today, or null when they are all done or past. */
export function nextDose(doses: readonly Dose[], nowMinutes: number): Dose | null {
  return doses.find((dose) => !dose.isTaken && dose.minutes >= nowMinutes) ?? null;
}

/** How many of today's doses are ticked off. Plain counting, no verdict. */
export function countTaken(doses: readonly Dose[]): { taken: number; total: number } {
  return {
    taken: doses.filter((dose) => dose.isTaken).length,
    total: doses.length,
  };
}

/**
 * What is left of the stock, if you filled one in.
 *
 * A rough count: one tick is one unit. It is there so you notice you are nearly
 * out, not so the app can tell you anything about your treatment.
 */
export function stockRemaining(
  medication: Medication,
  intakes: readonly MedicationIntake[],
): number | null {
  if (medication.stock_count === null) return null;

  const used = intakes.filter((intake) => intake.medication_id === medication.id).length;
  return Math.max(0, Number(medication.stock_count) - used);
}

/** "3 van de 4 vandaag" -- and "Niets gepland voor vandaag." when there is nothing. */
export function describeDay(doses: readonly Dose[]): string {
  const { taken, total } = countTaken(doses);
  if (total === 0) return 'Niets gepland voor vandaag.';
  return `${taken} van de ${total} afgevinkt vandaag.`;
}

/** "Elke dag" or "ma, wo, vr" -- how a medication's schedule reads. */
export function describeSchedule(medication: Medication): string {
  const times = medication.times.map(normaliseTime).sort().join(', ');
  const days =
    medication.weekdays.length === 0
      ? 'elke dag'
      : [...medication.weekdays]
          .sort((a, b) => a - b)
          .map((weekday) => WEEKDAY_SHORT_LABELS[weekday as Weekday])
          .join(', ');

  if (times.length === 0) return `${capitalise(days)}, nog geen tijd ingesteld`;
  return `${times} · ${days}`;
}

const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  1: 'ma',
  2: 'di',
  3: 'wo',
  4: 'do',
  5: 'vr',
  6: 'za',
  7: 'zo',
};

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
