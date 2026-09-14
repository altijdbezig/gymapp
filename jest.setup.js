/**
 * Runs before every test file.
 *
 * Two things the tests need that the app gets from elsewhere:
 *
 *   1. The EXPO_PUBLIC_* variables. In the app Metro inlines them from .env;
 *      Jest does not, and src/lib/env.ts throws when one is missing. These are
 *      obvious placeholders -- no test may ever reach the network.
 *   2. A fake AsyncStorage, so importing a module that touches storage does not
 *      blow up outside a React Native runtime.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
