import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
import {
  LENGTH_UNIT_LABELS,
  WEIGHT_UNIT_LABELS,
  formatLength,
  formatWeight,
  type LengthUnit,
  type WeightUnit,
} from '@/features/settings/units';
import {
  THEME_LABELS,
  useSyncThemeWithProfile,
  useTheme,
  useThemedStyles,
  type ThemePreference,
} from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * How the app looks, and in what units it counts.
 *
 * Units are a display setting only: everything stays in kilograms and
 * centimetres in the database, so switching back and forth never changes a
 * stored number.
 */
export default function AppearanceSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const { preference, setPreference, scheme } = useTheme();

  const profile = profileQuery.data;
  useSyncThemeWithProfile(profile?.theme);

  const weightUnit: WeightUnit = profile?.unit_weight ?? 'kg';
  const lengthUnit: LengthUnit = profile?.unit_length ?? 'cm';

  function chooseTheme(next: ThemePreference) {
    // Locally first, so the screen changes immediately, then on the account so
    // a second device picks it up.
    setPreference(next);
    updateProfile.mutate({ theme: next });
  }

  return (
    <Screen>
      <ScreenHeader title="Weergave" subtitle="Thema en eenheden." />

      <Card style={styles.card}>
        <Text variant="heading">Thema</Text>
        <Text variant="caption" muted>
          Nu actief: {scheme === 'dark' ? 'donker' : 'licht'}.
        </Text>
        <ChipRow>
          {(Object.keys(THEME_LABELS) as ThemePreference[]).map((option) => (
            <Chip
              key={option}
              label={THEME_LABELS[option]}
              selected={preference === option}
              onPress={() => chooseTheme(option)}
            />
          ))}
        </ChipRow>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Gewicht</Text>
        <ChipRow>
          {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((unit) => (
            <Chip
              key={unit}
              label={WEIGHT_UNIT_LABELS[unit]}
              selected={weightUnit === unit}
              onPress={() => updateProfile.mutate({ unit_weight: unit })}
            />
          ))}
        </ChipRow>
        <Text variant="caption" muted>
          Voorbeeld: {formatWeight(82.5, weightUnit)}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Lengte</Text>
        <ChipRow>
          {(Object.keys(LENGTH_UNIT_LABELS) as LengthUnit[]).map((unit) => (
            <Chip
              key={unit}
              label={LENGTH_UNIT_LABELS[unit]}
              selected={lengthUnit === unit}
              onPress={() => updateProfile.mutate({ unit_length: unit })}
            />
          ))}
        </ChipRow>
        <Text variant="caption" muted>
          Voorbeeld: {formatLength(180, lengthUnit)}
        </Text>
      </Card>

      <View style={styles.note}>
        <Text variant="caption" muted>
          Alles wordt opgeslagen in kilogrammen en centimeters. Een andere eenheid verandert alleen
          hoe het op je scherm staat, nooit wat er in je geschiedenis staat.
        </Text>
      </View>
    </Screen>
  );
}

const makeStyles = (_colors: Palette) =>
  StyleSheet.create({
    card: { gap: spacing.sm, marginBottom: spacing.md },
    note: { marginTop: spacing.md, marginBottom: spacing.xl },
  });
