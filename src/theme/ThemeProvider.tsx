/**
 * Light, dark, or whatever the phone is doing.
 *
 * The preference is kept in two places on purpose. AsyncStorage is read
 * synchronously on start, so the app opens in the right theme before anything
 * is fetched -- a white flash before switching to dark is exactly the thing
 * dark mode is supposed to prevent. The profile column is the copy that
 * travels with the account to a second device.
 *
 * Components get the palette from useTheme() and build their styles from it,
 * which is what makes a switch take effect without a reload.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { palettes, type ColorScheme, type Palette } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'gymapp.theme.v1';

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Systeem volgen',
  light: 'Licht',
  dark: 'Donker',
};

type ThemeValue = {
  palette: Palette;
  /** What is actually being shown, after "system" has been resolved. */
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /**
   * False until the stored preference has been read. A screen that syncs the
   * preference with the account uses this to avoid overwriting a local choice
   * with the profile's before the local one has even loaded.
   */
  isRestored: boolean;
  /** True when this device has a choice of its own stored. */
  hasStoredPreference: boolean;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isRestored, setIsRestored] = useState(false);
  const [hasStoredPreference, setHasStoredPreference] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
          setHasStoredPreference(true);
        }
      })
      .catch(() => {
        // No stored preference; "system" is a fine default.
      })
      .finally(() => {
        if (!cancelled) setIsRestored(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setHasStoredPreference(true);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, next);
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeValue>(
    () => ({
      palette: palettes[scheme],
      scheme,
      preference,
      setPreference,
      isRestored,
      hasStoredPreference,
    }),
    [scheme, preference, setPreference, isRestored, hasStoredPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The light theme, for anything rendered outside the provider.
 *
 * Throwing here would be stricter, but Text and Button are used on literally
 * every screen: one forgotten provider would take the whole app down rather
 * than showing the wrong colours. A sensible default is the safer failure.
 */
const FALLBACK: ThemeValue = {
  palette: palettes.light,
  scheme: 'light',
  preference: 'system',
  setPreference: () => {},
  isRestored: false,
  hasStoredPreference: false,
};

export function useTheme(): ThemeValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

/**
 * Builds a StyleSheet from the current palette.
 *
 * The factory has to be defined at module level so its identity is stable and
 * the styles are only rebuilt when the palette actually changes:
 *
 *   const makeStyles = (c: Palette) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}

/**
 * Adopts the theme stored on the account, but only on a device that has no
 * choice of its own yet.
 *
 * That ordering is deliberate: a phone where you picked dark keeps dark, and a
 * new device you sign in on inherits what you picked on the first one.
 */
export function useSyncThemeWithProfile(profileTheme: ThemePreference | undefined) {
  const { isRestored, hasStoredPreference, setPreference } = useTheme();

  useEffect(() => {
    if (!isRestored || hasStoredPreference || !profileTheme) return;
    if (profileTheme === 'system') return;

    setPreference(profileTheme);
  }, [isRestored, hasStoredPreference, profileTheme, setPreference]);
}
