/**
 * Turns whatever Supabase (or the network) throws into one Dutch sentence the
 * user can act on. Raw Supabase messages are English, often technical, and
 * sometimes leak internals — none of them ever reach the screen.
 *
 * Pure on purpose: it takes an error and returns a string, so every branch is
 * covered by a test.
 */

/** Falls back to this whenever we do not recognise the error. */
export const GENERIC_ERROR = 'Er ging iets mis. Probeer het opnieuw.';

export const OFFLINE_ERROR =
  'Geen internetverbinding. Controleer je verbinding en probeer het opnieuw.';

/**
 * Supabase error codes we handle by name. Anything not listed here falls
 * through to the status check and then to the generic message.
 */
const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: 'E-mailadres of wachtwoord klopt niet.',
  email_not_confirmed:
    'Je e-mailadres is nog niet bevestigd. Klik op de link in de mail die we je stuurden.',
  user_already_exists: 'Dit e-mailadres is al in gebruik. Log in of gebruik "Wachtwoord vergeten".',
  email_exists: 'Dit e-mailadres is al in gebruik. Log in of gebruik "Wachtwoord vergeten".',
  weak_password: 'Dit wachtwoord is te zwak. Kies er een van minstens 8 tekens.',
  same_password: 'Kies een ander wachtwoord dan je huidige.',
  over_email_send_rate_limit:
    'We hebben net al een mail gestuurd. Wacht een paar minuten voor je het opnieuw probeert.',
  over_request_rate_limit: 'Te veel pogingen achter elkaar. Wacht even en probeer het opnieuw.',
  validation_failed: 'Controleer je e-mailadres en wachtwoord.',
  signup_disabled: 'Registreren staat op dit moment uit.',
  user_banned: 'Dit account is geblokkeerd.',
  session_expired: 'Je sessie is verlopen. Log opnieuw in.',
  otp_expired: 'Deze link is verlopen. Vraag een nieuwe aan.',
};

/** The shapes an error can arrive in, without depending on Supabase's classes. */
type ErrorLike = {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  message?: unknown;
};

function isOffline(error: ErrorLike): boolean {
  // supabase-js wraps connection failures in AuthRetryableFetchError. On native
  // fetch itself throws "Network request failed"; on web it is "Failed to fetch".
  if (error.name === 'AuthRetryableFetchError' || error.name === 'TypeError') {
    return true;
  }
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error')
  );
}

export function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return GENERIC_ERROR;
  }

  const candidate = error as ErrorLike;

  // Offline is checked first: a connection failure can carry a status of 0 or
  // no code at all, and "controleer je verbinding" is the only useful advice.
  if (isOffline(candidate)) {
    return OFFLINE_ERROR;
  }

  if (typeof candidate.code === 'string' && candidate.code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[candidate.code];
  }

  if (typeof candidate.status === 'number') {
    // Older supabase-js versions report bad credentials as a bare 400 without a
    // code, so treat that as the most likely cause on a sign-in form.
    if (candidate.status === 400 || candidate.status === 401) {
      return 'E-mailadres of wachtwoord klopt niet.';
    }
    if (candidate.status === 422) {
      return 'Controleer je e-mailadres en wachtwoord.';
    }
    if (candidate.status === 429) {
      return 'Te veel pogingen achter elkaar. Wacht even en probeer het opnieuw.';
    }
    if (candidate.status >= 500) {
      return 'De server reageert niet. Probeer het over een paar minuten opnieuw.';
    }
  }

  return GENERIC_ERROR;
}

// ---------------------------------------------------------------------------
// Client-side validation, so an obvious mistake never costs a network round trip.
// ---------------------------------------------------------------------------

/** Deliberately loose: the real check is the confirmation mail. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return 'Vul je e-mailadres in.';
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Dit lijkt geen geldig e-mailadres.';
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (password.length === 0) {
    return 'Vul je wachtwoord in.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Je wachtwoord moet minstens ${MIN_PASSWORD_LENGTH} tekens hebben.`;
  }
  return undefined;
}

export function validatePasswordRepeat(password: string, repeat: string): string | undefined {
  if (repeat.length === 0) {
    return 'Herhaal je wachtwoord.';
  }
  if (password !== repeat) {
    return 'De wachtwoorden zijn niet gelijk.';
  }
  return undefined;
}
