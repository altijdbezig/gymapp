import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme/theme';

export default function TodayScreen() {
  return (
    <Screen>
      <Text variant="title">Vandaag</Text>
      <Text muted style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Je dagoverzicht met calorieën, macro's en je training.
      </Text>
      <Card>
        <Text variant="heading">Nog leeg</Text>
        <Text muted>Dit scherm wordt gevuld in fase 1 (dagdoelen) en fase 2 (eten loggen).</Text>
      </Card>
    </Screen>
  );
}
