/**
 * A UUID v4 generator.
 *
 * Rows created while you are offline need an id before they reach Postgres --
 * otherwise a session saved in the gym could not hold on to its own set logs
 * until it syncs. Generating the id on the device solves that, and it also
 * makes the upload idempotent: sending the same session twice writes the same
 * primary key instead of a duplicate.
 *
 * Math.random is not a cryptographic source, and that is fine here: these ids
 * identify your own rows, they are never a secret and never a password. A v4
 * uuid has 122 random bits, so even with a weak generator a collision inside
 * one user's data is not something that happens.
 *
 * crypto.randomUUID exists on web and on newer Hermes builds, so it is used
 * when present and the manual version is the fallback.
 */
const HEX = '0123456789abcdef';

export function createId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  let out = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      out += '-';
    } else if (index === 14) {
      // Version nibble: a v4 uuid always has a 4 here.
      out += '4';
    } else if (index === 19) {
      // Variant nibble: 8, 9, a or b.
      out += HEX[8 + Math.floor(Math.random() * 4)];
    } else {
      out += HEX[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}
