import { createSession, sessionReducer, type ActiveSession } from '../activeSession';
import {
  ACTIVE_SESSION_KEY,
  PENDING_SESSIONS_KEY,
  clearActiveSession,
  enqueuePendingSession,
  isActiveSession,
  loadActiveSession,
  loadPendingSessions,
  markAttempt,
  removePendingSession,
  saveActiveSession,
  type KeyValueStore,
} from '../sessionStorage';

/** An in-memory stand-in for AsyncStorage. */
function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));

  const store: KeyValueStore = {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };

  return { store, data };
}

function newSession(): ActiveSession {
  return createSession({
    userId: 'user-1',
    name: 'Push',
    exercises: [
      {
        exerciseId: 'bench',
        name: 'Bankdrukken',
        category: 'barbell',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
        targetSets: 2,
      },
    ],
    now: new Date('2026-09-14T18:00:00.000Z'),
  });
}

describe('the running session', () => {
  it('survives a round trip unchanged', async () => {
    const { store } = fakeStore();
    const session = newSession();

    await saveActiveSession(store, session);
    expect(await loadActiveSession(store)).toEqual(session);
  });

  it('keeps the typed numbers after a restart', async () => {
    const { store } = fakeStore();
    let session = newSession();
    const exercise = session.exercises[0];

    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey: exercise.key,
      setKey: exercise.sets[0].key,
      patch: { reps: '10', weightKg: '62,5', isCompleted: true },
    });

    await saveActiveSession(store, session);
    const restored = await loadActiveSession(store);

    expect(restored?.exercises[0].sets[0]).toMatchObject({
      reps: '10',
      weightKg: '62,5',
      isCompleted: true,
    });
  });

  it('returns null when nothing is stored', async () => {
    const { store } = fakeStore();
    expect(await loadActiveSession(store)).toBeNull();
  });

  it('throws away a blob that is not a session instead of crashing', async () => {
    const broken = fakeStore({ [ACTIVE_SESSION_KEY]: '{ not json' });
    expect(await loadActiveSession(broken.store)).toBeNull();

    const wrongShape = fakeStore({ [ACTIVE_SESSION_KEY]: JSON.stringify({ id: 1 }) });
    expect(await loadActiveSession(wrongShape.store)).toBeNull();

    const missingSets = fakeStore({
      [ACTIVE_SESSION_KEY]: JSON.stringify({ ...newSession(), exercises: [{ key: 'a' }] }),
    });
    expect(await loadActiveSession(missingSets.store)).toBeNull();
  });

  it('clears the session when it is done', async () => {
    const { store, data } = fakeStore();

    await saveActiveSession(store, newSession());
    await clearActiveSession(store);

    expect(data.has(ACTIVE_SESSION_KEY)).toBe(false);
  });
});

describe('the upload queue', () => {
  it('starts empty', async () => {
    const { store } = fakeStore();
    expect(await loadPendingSessions(store)).toEqual([]);
  });

  it('queues a finished session', async () => {
    const { store } = fakeStore();
    const session = newSession();

    await enqueuePendingSession(store, { session, endedAtMs: 1, attempts: 0 });
    const queue = await loadPendingSessions(store);

    expect(queue).toHaveLength(1);
    expect(queue[0].session.id).toBe(session.id);
  });

  it('replaces an earlier attempt instead of queueing the same workout twice', async () => {
    const { store } = fakeStore();
    const session = newSession();

    await enqueuePendingSession(store, { session, endedAtMs: 1, attempts: 0 });
    await enqueuePendingSession(store, { session, endedAtMs: 2, attempts: 1 });

    const queue = await loadPendingSessions(store);
    expect(queue).toHaveLength(1);
    expect(queue[0].endedAtMs).toBe(2);
  });

  it('removes a session once it is uploaded', async () => {
    const { store } = fakeStore();
    const first = newSession();
    const second = newSession();

    await enqueuePendingSession(store, { session: first, endedAtMs: 1, attempts: 0 });
    await enqueuePendingSession(store, { session: second, endedAtMs: 2, attempts: 0 });
    await removePendingSession(store, first.id);

    const queue = await loadPendingSessions(store);
    expect(queue.map((entry) => entry.session.id)).toEqual([second.id]);
  });

  it('counts failed attempts', async () => {
    const { store } = fakeStore();
    const session = newSession();

    await enqueuePendingSession(store, { session, endedAtMs: 1, attempts: 0 });
    await markAttempt(store, session.id);
    await markAttempt(store, session.id);

    const [queued] = await loadPendingSessions(store);
    expect(queued.attempts).toBe(2);
  });

  it('drops entries that are not usable rather than failing the whole queue', async () => {
    const session = newSession();
    const { store } = fakeStore({
      [PENDING_SESSIONS_KEY]: JSON.stringify([
        { session, endedAtMs: 1, attempts: 0 },
        { nonsense: true },
      ]),
    });

    expect(await loadPendingSessions(store)).toHaveLength(1);
  });

  it('copes with a corrupt queue', async () => {
    const { store } = fakeStore({ [PENDING_SESSIONS_KEY]: 'not json at all' });
    expect(await loadPendingSessions(store)).toEqual([]);
  });
});

describe('isActiveSession', () => {
  it('accepts a real session and rejects everything else', () => {
    expect(isActiveSession(newSession())).toBe(true);
    expect(isActiveSession(null)).toBe(false);
    expect(isActiveSession('a string')).toBe(false);
    expect(isActiveSession({ ...newSession(), startedAtMs: 'soon' })).toBe(false);
  });
});
