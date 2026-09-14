/**
 * Handing an exercise back from the picker to whoever asked for it.
 *
 * Expo Router pushes a screen, it does not return a value, so the two screens
 * need somewhere to meet. A context at the level of the training stack is that
 * place: the routine editor and the running workout both sit inside it, so a
 * callback stored here is still alive when the picker resolves.
 *
 * The callback lives in a ref rather than in state on purpose -- storing it in
 * state would re-render the whole stack every time a screen opens the picker.
 */
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { Exercise } from './exerciseLibrary';

type PickerRequest = {
  /** Shown as the picker's subtitle, e.g. "Kies een oefening voor Push". */
  subtitle?: string;
  onPick: (exercises: Exercise[]) => void;
};

type ExercisePickerValue = {
  /** Opens the picker and calls back with everything that was selected. */
  open: (request: PickerRequest) => void;
  /** Called by the picker screen when the user is done. */
  resolve: (exercises: Exercise[]) => void;
  /** The subtitle of the open request, for the picker screen to display. */
  subtitle: () => string | undefined;
};

const ExercisePickerContext = createContext<ExercisePickerValue | null>(null);

export function ExercisePickerProvider({ children }: { children: ReactNode }) {
  const request = useRef<PickerRequest | null>(null);

  const open = useCallback((next: PickerRequest) => {
    request.current = next;
    router.push('/(tabs)/training/exercises');
  }, []);

  const resolve = useCallback((exercises: Exercise[]) => {
    const pending = request.current;
    request.current = null;

    if (router.canGoBack()) router.back();
    // After the navigation, so the screen that asked is the one on top again.
    if (exercises.length > 0) pending?.onPick(exercises);
  }, []);

  const subtitle = useCallback(() => request.current?.subtitle, []);

  const value = useMemo(() => ({ open, resolve, subtitle }), [open, resolve, subtitle]);

  return (
    <ExercisePickerContext.Provider value={value}>{children}</ExercisePickerContext.Provider>
  );
}

export function useExercisePicker(): ExercisePickerValue {
  const value = useContext(ExercisePickerContext);
  if (!value) {
    throw new Error('useExercisePicker must be used inside the training stack');
  }
  return value;
}
