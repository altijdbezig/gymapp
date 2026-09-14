import {
  authErrorMessage,
  GENERIC_ERROR,
  MIN_PASSWORD_LENGTH,
  OFFLINE_ERROR,
  validateEmail,
  validatePassword,
  validatePasswordRepeat,
} from '../authErrors';

/** Shaped like the errors supabase-js actually throws. */
function authError(code: string, status = 400) {
  return { name: 'AuthApiError', code, status, message: 'some english message' };
}

describe('authErrorMessage', () => {
  it('explains a wrong password without blaming a specific field', () => {
    expect(authErrorMessage(authError('invalid_credentials'))).toBe(
      'E-mailadres of wachtwoord klopt niet.',
    );
  });

  it('explains an e-mail address that is already taken', () => {
    expect(authErrorMessage(authError('user_already_exists', 422))).toContain('al in gebruik');
  });

  it('explains an unconfirmed e-mail address', () => {
    expect(authErrorMessage(authError('email_not_confirmed'))).toContain('nog niet bevestigd');
  });

  it('explains a weak password', () => {
    expect(authErrorMessage(authError('weak_password', 422))).toContain('te zwak');
  });

  it('explains the mail rate limit', () => {
    expect(authErrorMessage(authError('over_email_send_rate_limit', 429))).toContain(
      'paar minuten',
    );
  });

  describe('no internet', () => {
    it('recognises the supabase-js retryable fetch error', () => {
      expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'boom' })).toBe(
        OFFLINE_ERROR,
      );
    });

    it('recognises the native fetch failure', () => {
      expect(authErrorMessage(new TypeError('Network request failed'))).toBe(OFFLINE_ERROR);
    });

    it('recognises the web fetch failure', () => {
      expect(authErrorMessage({ message: 'Failed to fetch' })).toBe(OFFLINE_ERROR);
    });

    it('wins over a status code, because the advice is different', () => {
      expect(
        authErrorMessage({ name: 'AuthRetryableFetchError', status: 500, message: 'x' }),
      ).toBe(OFFLINE_ERROR);
    });
  });

  describe('falling back on the status code', () => {
    it.each([
      [400, 'E-mailadres of wachtwoord klopt niet.'],
      [401, 'E-mailadres of wachtwoord klopt niet.'],
      [422, 'Controleer je e-mailadres en wachtwoord.'],
      [429, 'Te veel pogingen achter elkaar. Wacht even en probeer het opnieuw.'],
    ])('maps %s to a usable sentence', (status, expected) => {
      expect(authErrorMessage({ status, message: 'unknown' })).toBe(expected);
    });

    it.each([500, 502, 503])('maps %s to a server message', (status) => {
      expect(authErrorMessage({ status, message: 'unknown' })).toContain('server');
    });
  });

  describe('the safety net', () => {
    it.each([[null], [undefined], ['just a string'], [42], [{}], [{ code: 'something_new' }]])(
      'falls back to the generic message for %p',
      (input) => {
        expect(authErrorMessage(input)).toBe(GENERIC_ERROR);
      },
    );

    it('never shows the raw Supabase message', () => {
      const raw = 'AuthApiError: invalid login credentials at /auth/v1/token';
      const shown = authErrorMessage({ code: 'totally_unknown', message: raw });
      expect(shown).not.toContain('AuthApiError');
      expect(shown).not.toContain('/auth/v1');
    });

    it('always returns a non-empty Dutch sentence', () => {
      const inputs = [
        authError('invalid_credentials'),
        { name: 'AuthRetryableFetchError', message: '' },
        { status: 503 },
        {},
        null,
      ];
      for (const input of inputs) {
        const message = authErrorMessage(input);
        expect(message.length).toBeGreaterThan(0);
        expect(message.endsWith('.')).toBe(true);
      }
    });
  });
});

describe('validateEmail', () => {
  it.each(['benjamin@example.com', 'a.b+tag@sub.domein.nl'])('accepts %s', (email) => {
    expect(validateEmail(email)).toBeUndefined();
  });

  it('ignores surrounding whitespace', () => {
    expect(validateEmail('  benjamin@example.com  ')).toBeUndefined();
  });

  it('asks for an address when the field is empty', () => {
    expect(validateEmail('   ')).toBe('Vul je e-mailadres in.');
  });

  it.each(['benjamin', 'benjamin@', '@example.com', 'benjamin@example', 'a b@c.nl'])(
    'rejects %s',
    (email) => {
      expect(validateEmail(email)).toBe('Dit lijkt geen geldig e-mailadres.');
    },
  );
});

describe('validatePassword', () => {
  it('accepts a long enough password', () => {
    expect(validatePassword('geheim123')).toBeUndefined();
  });

  it('asks for a password when the field is empty', () => {
    expect(validatePassword('')).toBe('Vul je wachtwoord in.');
  });

  it('names the minimum length so the user knows what to do', () => {
    const message = validatePassword('kort');
    expect(message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('accepts exactly the minimum length', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeUndefined();
  });
});

describe('validatePasswordRepeat', () => {
  it('accepts two identical passwords', () => {
    expect(validatePasswordRepeat('geheim123', 'geheim123')).toBeUndefined();
  });

  it('asks for a repeat when it is empty', () => {
    expect(validatePasswordRepeat('geheim123', '')).toBe('Herhaal je wachtwoord.');
  });

  it('reports a mismatch', () => {
    expect(validatePasswordRepeat('geheim123', 'geheim124')).toBe(
      'De wachtwoorden zijn niet gelijk.',
    );
  });
});
