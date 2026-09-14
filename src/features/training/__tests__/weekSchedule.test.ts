import { buildWeek, type WeekScheduleRow } from '../useWeekSchedule';
import {
  isoWeekday,
  relativeWeekdayLabel,
  weekFrom,
  WEEKDAYS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  type Weekday,
} from '../weekSchedule';

describe('isoWeekday', () => {
  it('makes Monday 1 and Sunday 7', () => {
    // 2026-09-14 is a Monday.
    expect(isoWeekday(new Date(2026, 8, 14))).toBe(1);
    expect(isoWeekday(new Date(2026, 8, 19))).toBe(6);
    expect(isoWeekday(new Date(2026, 8, 20))).toBe(7);
  });
});

describe('weekFrom', () => {
  it('starts on the given day and wraps around', () => {
    expect(weekFrom(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekFrom(5)).toEqual([5, 6, 7, 1, 2, 3, 4]);
    expect(weekFrom(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });

  it('always returns all seven days exactly once', () => {
    for (const start of WEEKDAYS) {
      expect(new Set(weekFrom(start)).size).toBe(7);
    }
  });
});

describe('relativeWeekdayLabel', () => {
  it('says vandaag and morgen instead of a day name', () => {
    expect(relativeWeekdayLabel(3, 3)).toBe('Vandaag');
    expect(relativeWeekdayLabel(4, 3)).toBe('Morgen');
    expect(relativeWeekdayLabel(5, 3)).toBe('Vrijdag');
  });

  it('wraps from Sunday to Monday', () => {
    expect(relativeWeekdayLabel(1, 7)).toBe('Morgen');
  });
});

describe('labels', () => {
  it('has a Dutch name and a short name for every day', () => {
    for (const weekday of WEEKDAYS) {
      expect(WEEKDAY_LABELS[weekday]).toBeTruthy();
      expect(WEEKDAY_SHORT[weekday]).toHaveLength(2);
    }
  });
});

describe('buildWeek', () => {
  function row(weekday: Weekday, workoutDayId: string | null): WeekScheduleRow {
    return {
      id: `row-${weekday}`,
      user_id: 'user-1',
      weekday,
      workout_day_id: workoutDayId,
      created_at: '2026-09-14T10:00:00Z',
    };
  }

  it('returns all seven days in the order it was given', () => {
    const week = buildWeek([], weekFrom(3));
    expect(week.map((day) => day.weekday)).toEqual([3, 4, 5, 6, 7, 1, 2]);
  });

  it('tells a planned workout, an explicit rest day and nothing apart', () => {
    const week = buildWeek([row(1, 'day-a'), row(2, null)], weekFrom(1));

    expect(week[0]).toEqual({
      weekday: 1,
      workoutDayId: 'day-a',
      isRestDay: false,
      isPlanned: true,
    });
    expect(week[1]).toEqual({
      weekday: 2,
      workoutDayId: null,
      isRestDay: true,
      isPlanned: true,
    });
    expect(week[2]).toEqual({
      weekday: 3,
      workoutDayId: null,
      isRestDay: false,
      isPlanned: false,
    });
  });
});
