/**
 * A token bucket, used to keep our Open Food Facts search calls inside their
 * published rate limit.
 *
 * Why not a plain "wait N ms between calls"? That would make the very first
 * search wait too, and correcting a typo would feel broken. A bucket lets a
 * small burst through immediately and only slows things down once you keep
 * going, which matches how the limit is actually measured: per minute.
 *
 * The clock is injected so the tests do not have to wait in real time.
 */
export type TokenBucketOptions = {
  /** How many calls may go out back to back. */
  capacity: number;
  /** How long it takes for one token to come back. */
  refillIntervalMs: number;
  now?: () => number;
};

export type TokenBucket = {
  /** Milliseconds to wait before a call may go out. 0 means "go now". */
  msUntilAllowed: () => number;
  /** Records a call. Returns how long the caller should have waited. */
  take: () => number;
  /** Tokens available right now, for tests and debugging. */
  available: () => number;
};

export function createTokenBucket({
  capacity,
  refillIntervalMs,
  now = Date.now,
}: TokenBucketOptions): TokenBucket {
  if (capacity < 1) throw new RangeError('capacity must be at least 1');
  if (refillIntervalMs <= 0) throw new RangeError('refillIntervalMs must be positive');

  // Rather than tracking a token count and a timer, we track the moment the
  // bucket would next be completely full. Everything else follows from that,
  // and there is no interval running in the background.
  let fullAt = now();

  function currentTokens(at: number): number {
    const msUntilFull = Math.max(0, fullAt - at);
    const missing = msUntilFull / refillIntervalMs;
    return Math.min(capacity, capacity - missing);
  }

  // A standalone function rather than a method, so take() does not depend on
  // `this` and the bucket survives being destructured.
  function msUntilAllowed(at: number): number {
    if (currentTokens(at) >= 1) return 0;
    // One token is back refillIntervalMs after the bucket started refilling
    // towards the level that is one token short of full.
    return Math.max(0, Math.ceil(fullAt - (capacity - 1) * refillIntervalMs - at));
  }

  return {
    msUntilAllowed: () => msUntilAllowed(now()),

    take() {
      const at = now();
      const wait = msUntilAllowed(at);
      // Spending a token pushes the "full again" moment one interval further
      // out, measured from now if the bucket had already refilled completely.
      fullAt = Math.max(fullAt, at + wait) + refillIntervalMs;
      return wait;
    },

    available: () => Math.max(0, Math.floor(currentTokens(now()))),
  };
}

/** Resolves after `ms`, or immediately when there is nothing to wait for. */
export function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
