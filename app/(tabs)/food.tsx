import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme/theme';

export default function FoodScreen() {
  return (
    <Screen>
      <Text variant="title">Eten</Text>
      <Text muted style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Log je maaltijden via barcode, zoeken of handmatig.
      </Text>
      <Card>
        <Text variant="heading">Nog leeg</Text>
        <Text muted>Komt in fase 2.</Text>
      </Card>
    </Screen>
  );
}
