import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

type ScreenProps = {
  children: ReactNode;
  /** Set to false for screens that manage their own scrolling (e.g. a FlatList). */
  scrollable?: boolean;
};

/**
 * Page shell: background colour, padding and safe-area handling in one place,
 * so no screen has to think about the notch or the home indicator.
 */
export function Screen({ children, scrollable = true }: ScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  };

  if (!scrollable) {
    return <View style={[styles.container, padding]}>{children}</View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
