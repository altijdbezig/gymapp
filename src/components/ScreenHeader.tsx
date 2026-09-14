import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';
import { Text } from './Text';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back chevron. Defaults to true on any screen that can go back. */
  onBack?: () => void;
  /** Anything on the right: a save button, a menu. */
  right?: React.ReactNode;
};

/**
 * The title row of a stacked screen.
 *
 * The native header is switched off throughout the app (headerShown: false) so
 * that a screen can scroll its own title away, and so the styling comes from
 * the theme instead of from the navigator's defaults.
 */
export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : undefined));

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Terug"
          onPress={goBack}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Ionicons name="chevron-back" size={24} color={palette.primary} />
        </Pressable>

        <Text variant="heading" style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.right}>{right}</View>
      </View>

      {subtitle ? (
        <Text variant="caption" muted>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrapper: { gap: spacing.xs, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { marginLeft: -spacing.xs },
  backPressed: { opacity: 0.5 },
  title: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
