import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme/theme';

export default function TrainingScreen() {
  return (
    <Screen>
      <Text variant="title">Training</Text>
      <Text muted style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Je schema's, weekplanning en trainingssessies.
      </Text>
      <Card>
        <Text variant="heading">Nog leeg</Text>
        <Text muted>Komt in fase 3.</Text>
      </Card>
    </Screen>
  );
}
