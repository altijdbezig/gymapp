import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, formatDutchDate } from '@/lib/date';
import { colors, spacing } from '@/theme/theme';
import { Text } from './Text';

type DateStepperProps = {
  /** YYYY-MM-DD. */
  value: string;
  onChange: (date: string) => void;
  /** Today, so the label can say "Vandaag". Defaults to the device's today. */
  today: string;
};

/**
 * Back and forward a day.
 *
 * There is no date picker: the native one looks completely different on iOS and
 * on the web, and "gisteren" is one tap away anyway. The forward arrow stops at
 * today, because you cannot have eaten tomorrow yet.
 */
export function DateStepper({ value, onChange, today }: DateStepperProps) {
  const isToday = value === today;
  const isFuture = value >= today;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vorige dag"
        onPress={() => onChange(addDays(value, -1))}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isToday ? 'Vandaag' : 'Terug naar vandaag'}
        onPress={() => onChange(today)}
        style={styles.label}
      >
        <Text variant="label">
          {isToday ? 'Vandaag' : value === addDays(today, -1) ? 'Gisteren' : formatDutchDate(value)}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volgende dag"
        accessibilityState={{ disabled: isFuture }}
        disabled={isFuture}
        onPress={() => onChange(addDays(value, 1))}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed, isFuture && styles.disabled]}
      >
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { padding: spacing.xs },
  label: { flex: 1, alignItems: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.3 },
});
