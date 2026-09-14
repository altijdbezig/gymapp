import {
  COMEBACK_AFTER_DAYS,
  daysSinceLastWorkout,
  describeLogStreak,
  describeTrainingStreak,
  logStreak,
  needsComeback,
  trainingStreak,
} from '../streak';
import { addDays } from '@/lib/date';

/** 2026-09-16 is a Wednesday. */
const TODAY = '2026-09-16';

function daysBack(count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => addDays(TODAY, -index));
}

describe('logStreak', () => {
  it('counts consecutive days back from today', () => {
    expect(logStreak(daysBack(5), TODAY)).toBe(5);
  });

  it('does not break just because today is not logged yet', () => {
    // Logged yesterday and the day before, nothing yet today.
    const dates = [addDays(TODAY, -1), addDays(TODAY, -2)];
    expect(logStreak(dates, TODAY)).toBe(2);
  });

  it('stops at the first gap', () => {
    const dates = [TODAY, addDays(TODAY, -1), addDays(TODAY, -3)];
    expect(logStreak(dates, TODAY)).toBe(2);
  });

  it('is zero when nothing was logged recently', () => {
    expect(logStreak([addDays(TODAY, -5)], TODAY)).toBe(0);
    expect(logStreak([], TODAY)).toBe(0);
  });

  it('ignores duplicate days', () => {
    expect(logStreak([TODAY, TODAY, addDays(TODAY, -1)], TODAY)).toBe(2);
  });

  it('ignores days in the future', () => {
    expect(logStreak([addDays(TODAY, 1), TODAY], TODAY)).toBe(1);
  });
});

describe('trainingStreak', () => {
  it('counts weeks, so rest days never break it', () => {
    // One workout a week for four weeks.
    const dates = [TODAY, addDays(TODAY, -7), addDays(TODAY, -14), addDays(TODAY, -21)];
    expect(trainingStreak(dates, TODAY)).toBe(4);
  });

  it('counts a week once however often you trained in it', () => {
    const dates = [TODAY, addDays(TODAY, -1), addDays(TODAY, -2)];
    expect(trainingStreak(dates, TODAY)).toBe(1);
  });

  it('does not break just because this week has no workout yet', () => {
    // Trained last week and the week before; nothing yet this week.
    const dates = [addDays(TODAY, -7), addDays(TODAY, -14)];
    expect(trainingStreak(dates, TODAY)).toBe(2);
  });

  it('breaks after a whole empty week', () => {
    const dates = [addDays(TODAY, -14), addDays(TODAY, -21)];
    expect(trainingStreak(dates, TODAY)).toBe(0);
  });

  it('is zero without any workouts', () => {
    expect(trainingStreak([], TODAY)).toBe(0);
  });
});

describe('daysSinceLastWorkout', () => {
  it('counts from the newest workout', () => {
    expect(daysSinceLastWorkout([addDays(TODAY, -3), addDays(TODAY, -10)], TODAY)).toBe(3);
  });

  it('is zero when you trained today', () => {
    expect(daysSinceLastWorkout([TODAY], TODAY)).toBe(0);
  });

  it('is null when you have never trained', () => {
    expect(daysSinceLastWorkout([], TODAY)).toBeNull();
  });
});

describe('needsComeback', () => {
  it('triggers after a week without training', () => {
    expect(needsComeback([addDays(TODAY, -(COMEBACK_AFTER_DAYS - 1))], TODAY)).toBe(false);
    expect(needsComeback([addDays(TODAY, -COMEBACK_AFTER_DAYS)], TODAY)).toBe(true);
    expect(needsComeback([addDays(TODAY, -30)], TODAY)).toBe(true);
  });

  it('does not offer a comeback to somebody who never started', () => {
    expect(needsComeback([], TODAY)).toBe(false);
  });
});

describe('the Dutch copy', () => {
  it('turns a streak of zero into an invitation, not a failure', () => {
    expect(describeLogStreak(0)).toBe('Log vandaag iets en je streak begint.');
    expect(describeTrainingStreak(0)).toBe('Train deze week en je streak begint.');

    for (const text of [describeLogStreak(0), describeTrainingStreak(0)]) {
      expect(text).not.toMatch(/kwijt|verloren|helaas|jammer|gefaald/i);
    }
  });

  it('uses the singular for one', () => {
    expect(describeLogStreak(1)).toBe('1 dag op rij gelogd.');
    expect(describeTrainingStreak(1)).toBe('1 week op rij getraind.');
  });

  it('uses the plural beyond that', () => {
    expect(describeLogStreak(12)).toBe('12 dagen op rij gelogd.');
    expect(describeTrainingStreak(5)).toBe('5 weken op rij getraind.');
  });
});
