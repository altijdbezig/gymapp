import { OFF_SEARCH_RATE_LIMIT } from '../openFoodFacts';
import { createTokenBucket, delay } from '../tokenBucket';

/** A clock we control, so nothing in these tests waits in real time. */
function fakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('createTokenBucket', () => {
  it('starts full', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });
    expect(bucket.available()).toBe(3);
    expect(bucket.msUntilAllowed()).toBe(0);
  });

  it('lets a burst through without waiting', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });

    expect(bucket.take()).toBe(0);
    expect(bucket.take()).toBe(0);
    expect(bucket.take()).toBe(0);
    expect(bucket.available()).toBe(0);
  });

  it('makes the call after the burst wait for a refill', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });

    bucket.take();
    bucket.take();
    bucket.take();

    expect(bucket.msUntilAllowed()).toBe(6000);
  });

  it('hands out a token again once the interval has passed', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });

    bucket.take();
    bucket.take();
    bucket.take();

    clock.advance(6000);
    expect(bucket.msUntilAllowed()).toBe(0);
    expect(bucket.take()).toBe(0);
  });

  it('refills only part way through the interval', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });

    bucket.take();
    bucket.take();
    bucket.take();

    clock.advance(2000);
    expect(bucket.msUntilAllowed()).toBe(4000);
  });

  it('never holds more than its capacity, however long it sits idle', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });

    bucket.take();
    clock.advance(10 * 60 * 1000);

    expect(bucket.available()).toBe(3);
    expect(bucket.take()).toBe(0);
    expect(bucket.take()).toBe(0);
    expect(bucket.take()).toBe(0);
    expect(bucket.msUntilAllowed()).toBe(6000);
  });

  it('holds the long-run rate to one call per interval', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 3, refillIntervalMs: 6000, now: clock.now });

    // Hammer it for ten minutes of simulated time, always waiting as told.
    let calls = 0;
    const startedAt = clock.now();
    while (clock.now() - startedAt < 10 * 60 * 1000) {
      const wait = bucket.take();
      clock.advance(wait);
      calls += 1;
    }

    // 10 minutes at one per 6 seconds is 100, plus the initial burst of 3.
    expect(calls).toBeLessThanOrEqual(104);
    expect(calls).toBeGreaterThanOrEqual(100);
  });

  it('keeps the real search settings inside 10 calls per minute', () => {
    // Imported from the wrapper rather than repeated here, so this test guards
    // the configuration the app actually ships with. Open Food Facts allows 10
    // searches per minute and blocks callers who go over.
    const clock = fakeClock();
    const bucket = createTokenBucket({ ...OFF_SEARCH_RATE_LIMIT, now: clock.now });

    // A caller that hammers the bucket as hard as it is allowed to.
    const callTimes: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      clock.advance(bucket.take());
      callTimes.push(clock.now());
    }

    for (const start of callTimes) {
      const inWindow = callTimes.filter((at) => at >= start && at < start + 60_000).length;
      expect(inWindow).toBeLessThanOrEqual(10);
    }
  });

  it('guards the arithmetic behind those settings', () => {
    // capacity + 60000/refill is the worst case a bucket can emit in a minute.
    const worstCasePerMinute =
      OFF_SEARCH_RATE_LIMIT.capacity + 60_000 / OFF_SEARCH_RATE_LIMIT.refillIntervalMs;
    expect(worstCasePerMinute).toBeLessThanOrEqual(10);
  });

  it('keeps working when destructured', () => {
    const clock = fakeClock();
    const { take, msUntilAllowed } = createTokenBucket({
      capacity: 2,
      refillIntervalMs: 1000,
      now: clock.now,
    });

    expect(take()).toBe(0);
    expect(take()).toBe(0);
    expect(msUntilAllowed()).toBe(1000);
  });

  it.each([
    [0, 1000],
    [-1, 1000],
  ])('refuses a capacity of %p', (capacity, refillIntervalMs) => {
    expect(() => createTokenBucket({ capacity, refillIntervalMs })).toThrow(RangeError);
  });

  it.each([0, -5])('refuses a refill interval of %p', (refillIntervalMs) => {
    expect(() => createTokenBucket({ capacity: 1, refillIntervalMs })).toThrow(RangeError);
  });
});

describe('delay', () => {
  it('resolves immediately for zero or less', async () => {
    await expect(delay(0)).resolves.toBeUndefined();
    await expect(delay(-100)).resolves.toBeUndefined();
  });

  it('resolves after the given time', async () => {
    jest.useFakeTimers();
    const promise = delay(500);
    jest.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
