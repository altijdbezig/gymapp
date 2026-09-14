import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/theme';
import { Text } from './Text';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Colours the confirm button red. For anything that throws data away. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * "Weet je het zeker?" as a component instead of React Native's Alert.
 *
 * Alert.alert does nothing at all on react-native-web, and this app ships a web
 * build, so every confirmation would silently do nothing there. A Modal works
 * identically on both.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Annuleren',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="heading">{title}</Text>
          <Text muted>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirm,
                destructive && styles.confirmDestructive,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  cancelLabel: { ...typography.label, color: colors.textMuted },
  confirm: { backgroundColor: colors.primary },
  confirmDestructive: { backgroundColor: colors.danger },
  confirmLabel: { ...typography.label, color: colors.textInverse },
});
