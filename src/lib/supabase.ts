import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env } from './env';
import type { Database } from '@/types/database';

/**
 * One shared Supabase client for the whole app.
 *
 * - storage: AsyncStorage keeps the session after a restart (it uses
 *   localStorage on web and native storage on iOS), so you stay logged in.
 * - detectSessionInUrl: only web can receive tokens back in the URL after a
 *   magic link or OAuth redirect; on native that check would be pointless.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
