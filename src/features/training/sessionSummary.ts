/**
 * The hand-off between "ik ben klaar" and the summary screen.
 *
 * Expo Router can only carry strings in the URL, and a finished session plus
 * its broken records is a lot more than a string. Rather than serialising it
 * all into query parameters, the session screen parks the result here and the
 * summary screen picks it up on mount.
 *
 * A module-level variable is enough because there is only ever one summary in
 * flight, and it is cleared the moment the summary screen has read it.
 */
import type { ActiveSession } from './activeSession';
import type { BrokenRecord } from './personalRecords';

export type FinishedSession = {
  session: ActiveSession;
  endedAtMs: number;
  brokenRecords: BrokenRecord[];
  /** False when the workout is queued because the upload failed. */
  uploaded: boolean;
};

let finished: FinishedSession | null = null;

export function setFinishedSession(value: FinishedSession): void {
  finished = value;
}

export function getFinishedSession(): FinishedSession | null {
  return finished;
}

export function clearFinishedSession(): void {
  finished = null;
}
