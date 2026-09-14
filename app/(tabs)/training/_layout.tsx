import { Stack } from 'expo-router';

import { ExercisePickerProvider } from '@/features/training/ExercisePicker';

/**
 * The Training tab is a stack: routines, the exercise picker, the running
 * workout and your history are all screens inside one tab.
 *
 * The picker provider sits here so any screen in the stack can open the
 * exercise picker and get the choice back.
 */
export default function TrainingLayout() {
  return (
    <ExercisePickerProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ExercisePickerProvider>
  );
}
