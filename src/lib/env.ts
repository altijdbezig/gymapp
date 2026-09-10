/**
 * Reads the public environment variables and fails loudly when one is missing.
 *
 * Only EXPO_PUBLIC_* variables are bundled into the app, and everything in the
 * bundle is readable by anyone who installs it. So: never put a secret here.
 * The Supabase publishable key is safe because Row Level Security decides what
 * a request may actually read or write.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in, then restart Expo.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
