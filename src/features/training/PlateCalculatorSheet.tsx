import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, ChipRow } from '@/components/Chip';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { colors, radius, spacing } from '@/theme/theme';
import {
  calculatePlates,
  formatKg,
  DEFAULT_BAR_KG,
  type PlateResult,
} from './plateCalculator';

/** The bars you actually find in a gym. */
const BAR_OPTIONS = [20, 15, 10, 25] as const;

type PlateCalculatorSheetProps = {
  visible: boolean;
  /** The weight typed into the set, or null when nothing has been typed yet. */
  targetKg: number | null;
  exerciseName: string;
  onClose: () => void;
};

/**
 * "Welke schijven moet ik erop leggen?"
 *
 * Shows one side of the bar, because both sides are the same and saying "per
 * kant" once is clearer than drawing it twice.
 */
export function PlateCalculatorSheet({
  visible,
  targetKg,
  exerciseName,
  onClose,
}: PlateCalculatorSheetProps) {
  const [barKg, setBarKg] = useState<number>(DEFAULT_BAR_KG);
  const result = targetKg === null ? null : calculatePlates(targetKg, barKg);

  return (
    <Sheet visible={visible} title="Schijven" onClose={onClose}>
      <Text muted>{exerciseName}</Text>

      <View style={styles.field}>
        <Text variant="label">Stanggewicht</Text>
        <ChipRow>
          {BAR_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={`${formatKg(option)} kg`}
              selected={barKg === option}
              onPress={() => setBarKg(option)}
            />
          ))}
        </ChipRow>
      </View>

      {targetKg === null ? (
        <Text muted>Vul eerst een gewicht in bij je set.</Text>
      ) : (
        <PlateResultView result={result!} targetKg={targetKg} barKg={barKg} />
      )}
    </Sheet>
  );
}

function PlateResultView({
  result,
  targetKg,
  barKg,
}: {
  result: PlateResult;
  targetKg: number;
  barKg: number;
}) {
  return (
    <View style={styles.result}>
      <Text variant="title">{formatKg(targetKg)} kg</Text>

      {result.barOnly && result.leftoverKg === 0 ? (
        <Text muted>Alleen de stang, geen schijven nodig.</Text>
      ) : result.perSide.length === 0 ? (
        <Text muted>
          Met een stang van {formatKg(barKg)} kg kan je dit gewicht niet precies maken.
        </Text>
      ) : (
        <>
          <Text variant="label">Per kant</Text>
          <View style={styles.plates}>
            {result.perSide.flatMap((entry) =>
              Array.from({ length: entry.count }, (_unused, index) => (
                <View key={`${entry.plateKg}-${index}`} style={styles.plate}>
                  <Text style={styles.plateLabel}>{formatKg(entry.plateKg)}</Text>
                </View>
              )),
            )}
          </View>
          <Text variant="caption" muted>
            Stang {formatKg(barKg)} kg + 2 × {formatKg((result.achievedKg - barKg) / 2)} kg
          </Text>
        </>
      )}

      {result.leftoverKg > 0 ? (
        <Text variant="caption" style={styles.warning}>
          Hiermee kom je op {formatKg(result.achievedKg)} kg, {formatKg(result.leftoverKg)} kg
          onder wat je invulde.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  result: { gap: spacing.sm },
  plates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  plate: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  plateLabel: { color: colors.primary, fontWeight: '700' },
  warning: { color: colors.warning },
});
