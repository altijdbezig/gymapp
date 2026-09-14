import {
  elapsedSeconds,
  formatDuration,
  formatDurationLong,
  formatRest,
  isFinished,
  remainingSeconds,
  restProgress,
  type RestTimer,
} from '../restTimer';

const START = 1_700_000_000_000;

function timer(durationSeconds = 90): RestTimer {
  return { startedAtMs: START, durationSeconds, exerciseKey: 'bench' };
}

describe('remainingSeconds', () => {
  it('counts down from the full duration', () => {
    expect(remainingSeconds(timer(90), START)).toBe(90);
    expect(remainingSeconds(timer(90), START + 30_000)).toBe(60);
    expect(remainingSeconds(timer(90), START + 89_000)).toBe(1);
  });

  it('stops at zero instead of going negative', () => {
    expect(remainingSeconds(timer(90), START + 90_000)).toBe(0);
    // The app was in the background for ten minutes: still zero, not -510.
    expect(remainingSeconds(timer(90), START + 600_000)).toBe(0);
  });

  it('rounds up, so "1" is shown for the whole last second', () => {
    expect(remainingSeconds(timer(90), START + 89_500)).toBe(1);
  });

  it('survives a clock that jumped backwards', () => {
    expect(remainingSeconds(timer(90), START - 5_000)).toBe(95);
  });
});

describe('isFinished', () => {
  it('is true exactly when nothing is left', () => {
    expect(isFinished(timer(60), START + 59_000)).toBe(false);
    expect(isFinished(timer(60), START + 60_000)).toBe(true);
  });

  it('is immediately true for a zero-second rest', () => {
    expect(isFinished(timer(0), START)).toBe(true);
  });
});

describe('restProgress', () => {
  it('runs from 0 to 1', () => {
    expect(restProgress(timer(100), START)).toBe(0);
    expect(restProgress(timer(100), START + 50_000)).toBe(0.5);
    expect(restProgress(timer(100), START + 100_000)).toBe(1);
  });

  it('never leaves the 0 to 1 range', () => {
    expect(restProgress(timer(100), START + 500_000)).toBe(1);
    expect(restProgress(timer(100), START - 500_000)).toBe(0);
  });

  it('is complete straight away when there is no rest', () => {
    expect(restProgress(timer(0), START)).toBe(1);
  });
});

describe('elapsedSeconds', () => {
  it('counts up from the start', () => {
    expect(elapsedSeconds(START, START)).toBe(0);
    expect(elapsedSeconds(START, START + 65_000)).toBe(65);
  });

  it('never goes negative', () => {
    expect(elapsedSeconds(START, START - 10_000)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('uses minutes and seconds below an hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(750)).toBe('12:30');
  });

  it('adds hours once a session passes sixty minutes', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3920)).toBe('1:05:20');
  });

  it('does not break on nonsense', () => {
    expect(formatDuration(-10)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('formatDurationLong', () => {
  it('reads as Dutch instead of as a clock', () => {
    expect(formatDurationLong(40)).toBe('40 sec');
    expect(formatDurationLong(2700)).toBe('45 min');
    expect(formatDurationLong(3600)).toBe('1 uur');
    expect(formatDurationLong(4320)).toBe('1 uur 12 min');
  });
});

describe('formatRest', () => {
  it('describes a rest length', () => {
    expect(formatRest(0)).toBe('Geen rust');
    expect(formatRest(45)).toBe('45 sec');
    expect(formatRest(120)).toBe('2 min');
    expect(formatRest(90)).toBe('1 min 30');
  });
});
