import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  /** True while we are still restoring the stored session on startup. */
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the Supabase session and exposes the four things the screens need.
 *
 * The session itself is persisted by the Supabase client (AsyncStorage on
 * native, localStorage on web), so a restart restores it without a new login.
 * This provider only mirrors it into React state.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Read the stored session once on startup...
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsRestoring(false);
    });

    // ...and from then on let Supabase tell us about every change: signing in,
    // signing out, and the token refresh that happens in the background.
    //
    // This callback must stay synchronous. Calling another supabase.auth method
    // from inside it can deadlock the client, so it only touches React state.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsRestoring(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Each of these throws the raw Supabase error on purpose. The screen catches
  // it and runs it through authErrorMessage() to get Dutch copy.
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw error;

    // Supabase does not error on a duplicate address — it returns a user with
    // an empty identities array instead, to avoid telling strangers which
    // addresses are registered. For our own signup form that is confusing, so
    // we turn it into the same message a real duplicate would give.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw { name: 'AuthApiError', code: 'user_already_exists', status: 422 };
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      session,
      isRestoring,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      resendConfirmation,
    }),
    [session, isRestoring, signIn, signUp, signOut, sendPasswordReset, resendConfirmation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
