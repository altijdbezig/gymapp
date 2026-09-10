import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme/theme';

export default function SettingsScreen() {
  return (
    <Screen>
      <Text variant="title">Instellingen</Text>
      <Text muted style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Je profiel, doelen en meldingen.
      </Text>
      <Card>
        <Text variant="heading">Nog leeg</Text>
        <Text muted>Komt in fase 1 (profiel) en fase 4 (meldingen).</Text>
      </Card>
    </Screen>
  );
}
