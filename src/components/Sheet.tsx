import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';
import { Text } from './Text';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * A panel that slides up from the bottom.
 *
 * React Native's own Modal is used rather than a library: it works on iOS and
 * on the web, it traps focus, and it is one import instead of a dependency.
 * Everything that needs a small decision -- rest time, set type, the plate
 * calculator -- uses this instead of a full screen.
 */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // The web build needs this to render into the page rather than a portal
      // it cannot style.
      presentationStyle="overFullScreen"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sluiten"
        style={styles.backdrop}
        onPress={onClose}
      />

      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            onPress={onClose}
            hitSlop={spacing.sm}
          >
            <Ionicons name="close" size={24} color={palette.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.md },
});
