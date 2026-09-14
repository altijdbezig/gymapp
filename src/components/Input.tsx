import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, typography, type Palette } from '@/theme/theme';
import { Text } from './Text';

type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Dutch error text shown under the field. Also turns the border red. */
  error?: string;
  /** Small grey hint under the field when there is no error. */
  hint?: string;
  /** Renders a "toon/verberg" toggle and hides the text by default. */
  secure?: boolean;
};

/**
 * A labelled text field. Every screen uses this instead of a bare TextInput so
 * labels, errors and focus styling stay identical everywhere.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, secure = false, ...rest },
  ref,
) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [isFocused, setIsFocused] = useState(false);
  const [isHidden, setIsHidden] = useState(secure);

  return (
    <View style={styles.wrapper}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>

      <View
        style={[styles.field, isFocused && styles.fieldFocused, !!error && styles.fieldError]}
      >
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={palette.textMuted}
          secureTextEntry={isHidden}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          // The error is announced with the field instead of only being visible.
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          {...rest}
        />

        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isHidden ? 'Wachtwoord tonen' : 'Wachtwoord verbergen'}
            onPress={() => setIsHidden((hidden) => !hidden)}
            hitSlop={spacing.sm}
          >
            <Text variant="label" style={styles.toggle}>
              {isHidden ? 'Toon' : 'Verberg'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colors.text },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  toggle: { color: colors.primary },
  error: { color: colors.danger },
});
