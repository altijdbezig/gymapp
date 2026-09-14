import { Pressable, StyleSheet, View } from 'react-native';

import { useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';
import { Text } from './Text';

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** Optional second line, for options that need a bit of explanation. */
  description?: string;
};

type ChoiceGroupProps<T extends string> = {
  label: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * A vertical list of tappable options — one selected at a time.
 *
 * Used instead of a picker because a picker looks and behaves differently on
 * iOS and on the web, and this is one component that behaves the same on both.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  disabled = false,
}: ChoiceGroupProps<T>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrapper}>
      <Text variant="label">{label}</Text>

      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && !isSelected && styles.optionPressed,
                disabled && styles.optionDisabled,
              ]}
            >
              <View style={styles.optionText}>
                <Text variant="label" style={isSelected ? styles.labelSelected : undefined}>
                  {option.label}
                </Text>
                {option.description ? (
                  <Text variant="caption" muted>
                    {option.description}
                  </Text>
                ) : null}
              </View>

              {/* A dot instead of a checkmark glyph: no icon font needed. */}
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrapper: { gap: spacing.xs },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  optionPressed: { backgroundColor: colors.background },
  optionDisabled: { opacity: 0.5 },
  optionText: { flex: 1, gap: 2 },
  labelSelected: { color: colors.primary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  error: { color: colors.danger },
});
