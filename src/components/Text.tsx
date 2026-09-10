import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme/theme';

type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  muted?: boolean;
};

/**
 * Wrapper around React Native's Text so every piece of copy picks its size and
 * weight from the theme instead of inventing its own.
 */
export function Text({ variant = 'body', muted = false, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[styles.base, typography[variant], muted && styles.muted, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  muted: { color: colors.textMuted },
});
