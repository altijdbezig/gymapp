import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { describeTotals, listTotals } from '@/features/recipes/shoppingList';
import { useCreateShoppingList, useShoppingLists } from '@/features/recipes/useShoppingLists';
import { formatDutchDate } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/** Your shopping lists. */
export default function ShoppingListsScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const listsQuery = useShoppingLists(userId);
  const createList = useCreateShoppingList();

  const [isSheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');

  const lists = listsQuery.data ?? [];

  async function handleCreate() {
    if (!userId) return;

    const listId = await createList.mutateAsync({ userId, name: name || 'Boodschappen' });
    setName('');
    setSheetOpen(false);
    router.push(`/(tabs)/food/shopping/${listId}`);
  }

  return (
    <Screen>
      <ScreenHeader
        title="Boodschappen"
        subtitle="Lijstjes uit je recepten, gesorteerd op schap."
      />

      {listsQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : lists.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Nog geen lijstjes"
          description="Maak een lijstje, of zet de ingrediënten van een recept er in één tik op."
          actionLabel="Lijstje maken"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <>
          {lists.map((list) => {
            const totals = listTotals(list.items);

            return (
              <Pressable
                key={list.id}
                accessibilityRole="button"
                accessibilityLabel={`${list.name} openen`}
                onPress={() => router.push(`/(tabs)/food/shopping/${list.id}`)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={styles.listCard}>
                  <Text variant="label">{list.name}</Text>
                  <Text variant="caption" muted>
                    {describeTotals(totals)}
                  </Text>
                  <Text variant="caption" muted>
                    Gemaakt op {formatDutchDate(list.created_at.slice(0, 10))}
                  </Text>
                </Card>
              </Pressable>
            );
          })}

          <Button title="Nieuw lijstje" onPress={() => setSheetOpen(true)} />
        </>
      )}

      <Text variant="caption" muted style={styles.note}>
        Prijzen vul je zelf in. Er is geen officiële prijs-API van Albert Heijn of Jumbo, dus de
        app verzint geen prijzen.
      </Text>

      <Sheet visible={isSheetOpen} title="Nieuw lijstje" onClose={() => setSheetOpen(false)}>
        <Input
          label="Naam"
          value={name}
          onChangeText={setName}
          placeholder="Boodschappen deze week"
          autoFocus
        />
        <Button title="Lijstje maken" loading={createList.isPending} onPress={handleCreate} />
      </Sheet>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  listCard: { gap: spacing.xs, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  note: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
