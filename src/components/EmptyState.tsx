import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/theme';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  /** One or two sentences. Neutral and helpful, never disappointed in you. */
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * The "there is nothing here yet" block.
 *
 * One component so every empty screen in the app reads the same way and always
 * offers the next step instead of leaving you on a blank page.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="heading" style={styles.centered}>
        {title}
      </Text>
      <Text muted style={styles.centered}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  centered: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
});
