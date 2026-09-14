import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  describeTotals,
  formatEuro,
  groupByAisle,
  listTotals,
  parsePrice,
  AISLE_LABELS,
  AISLE_ORDER,
  type Aisle,
  type ShoppingItem,
} from '@/features/recipes/shoppingList';
import {
  useAddListItems,
  useDeleteListItem,
  useDeleteShoppingList,
  useShoppingList,
  useUncheckAll,
  useUpdateListItem,
} from '@/features/recipes/useShoppingLists';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';

/**
 * One shopping list, grouped by aisle.
 *
 * Ticking something off is one tap on the row. The price is typed in per item;
 * the total underneath only counts what you filled in and says so.
 */
export default function ShoppingListScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const listQuery = useShoppingList(id ?? null);
  const updateItem = useUpdateListItem();
  const deleteItem = useDeleteListItem();
  const addItems = useAddListItems(userId);
  const deleteList = useDeleteShoppingList(userId);
  const uncheckAll = useUncheckAll();

  const [priceTarget, setPriceTarget] = useState<ShoppingItem | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [isAddOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newAisle, setNewAisle] = useState<Aisle>('overig');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (listQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Lijstje" />
        <ActivityIndicator color={palette.primary} />
      </Screen>
    );
  }

  const list = listQuery.data;

  if (!list) {
    return (
      <Screen>
        <ScreenHeader title="Lijstje" />
        <EmptyState
          icon="alert-circle-outline"
          title="Lijstje niet gevonden"
          description="Dit lijstje bestaat niet meer."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const totals = listTotals(list.items);
  const groups = groupByAisle(list.items);

  return (
    <Screen>
      <ScreenHeader title={list.name} subtitle={describeTotals(totals)} />

      {groups.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Nog niets op de lijst"
          description="Voeg zelf iets toe, of zet de ingrediënten van een recept erop."
          actionLabel="Product toevoegen"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        groups.map((group) => (
          <Card key={group.aisle} style={styles.card}>
            <Text variant="heading">{group.label}</Text>

            {group.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.is_checked }}
                  accessibilityLabel={`${item.name} afvinken`}
                  onPress={() =>
                    updateItem.mutate({ item, patch: { is_checked: !item.is_checked } })
                  }
                  style={styles.checkbox}
                >
                  <Ionicons
                    name={item.is_checked ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={item.is_checked ? palette.success : palette.border}
                  />
                </Pressable>

                <View style={styles.flex}>
                  <Text style={item.is_checked ? styles.checked : undefined}>{item.name}</Text>
                  {item.quantity ? (
                    <Text variant="caption" muted>
                      {item.quantity}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Prijs van ${item.name} invullen`}
                  onPress={() => {
                    setPriceTarget(item);
                    setPriceInput(
                      item.price_cents === null ? '' : (item.price_cents / 100).toFixed(2).replace('.', ','),
                    );
                  }}
                  style={({ pressed }) => [styles.price, pressed && styles.pressed]}
                >
                  <Text variant="caption" muted={item.price_cents === null}>
                    {item.price_cents === null ? 'prijs' : formatEuro(item.price_cents)}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} verwijderen`}
                  onPress={() => deleteItem.mutate(item)}
                  hitSlop={spacing.xs}
                >
                  <Ionicons name="close" size={18} color={palette.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        ))
      )}

      <View style={styles.actions}>
        <Button title="Product toevoegen" variant="secondary" onPress={() => setAddOpen(true)} />
        {totals.checked > 0 ? (
          <Button
            title="Vinkjes wissen"
            variant="secondary"
            onPress={() => uncheckAll.mutate(list.id)}
          />
        ) : null}
        <Button title="Lijstje verwijderen" variant="secondary" onPress={() => setConfirmDelete(true)} />
      </View>

      <Text variant="caption" muted style={styles.note}>
        Prijzen vul je zelf in, want er is geen open prijs-API van de Nederlandse supermarkten. Het
        totaal telt alleen op wat je hebt ingevuld.
      </Text>

      <Sheet
        visible={!!priceTarget}
        title={priceTarget?.name ?? ''}
        onClose={() => setPriceTarget(null)}
      >
        <Input
          label="Prijs in euro"
          value={priceInput}
          onChangeText={setPriceInput}
          placeholder="3,50"
          keyboardType="decimal-pad"
          autoFocus
        />
        <Button
          title="Opslaan"
          onPress={() => {
            if (!priceTarget) return;
            updateItem.mutate({ item: priceTarget, patch: { price_cents: parsePrice(priceInput) } });
            setPriceTarget(null);
          }}
        />
        <Button
          title="Prijs wissen"
          variant="secondary"
          onPress={() => {
            if (!priceTarget) return;
            updateItem.mutate({ item: priceTarget, patch: { price_cents: null } });
            setPriceTarget(null);
          }}
        />
      </Sheet>

      <Sheet visible={isAddOpen} title="Product toevoegen" onClose={() => setAddOpen(false)}>
        <Input label="Wat" value={newName} onChangeText={setNewName} placeholder="Melk" autoFocus />
        <Input
          label="Hoeveel"
          value={newQuantity}
          onChangeText={setNewQuantity}
          placeholder="1 pak"
        />

        <View style={styles.field}>
          <Text variant="label">Schap</Text>
          <ChipRow>
            {AISLE_ORDER.map((aisle) => (
              <Chip
                key={aisle}
                label={AISLE_LABELS[aisle]}
                selected={newAisle === aisle}
                onPress={() => setNewAisle(aisle)}
              />
            ))}
          </ChipRow>
        </View>

        <Button
          title="Toevoegen"
          loading={addItems.isPending}
          onPress={async () => {
            if (!newName.trim()) return;

            await addItems.mutateAsync({
              listId: list.id,
              drafts: [
                {
                  name: newName.trim(),
                  quantity: newQuantity.trim(),
                  aisle: newAisle,
                  recipeId: null,
                },
              ],
              offset: list.items.length,
            });

            setNewName('');
            setNewQuantity('');
            setAddOpen(false);
          }}
        />
      </Sheet>

      <ConfirmDialog
        visible={confirmDelete}
        title="Lijstje verwijderen?"
        message={`"${list.name}" en alles wat erop staat wordt verwijderd.`}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteList.mutateAsync(list.id);
          router.dismissTo('/(tabs)/food/shopping');
        }}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { paddingVertical: spacing.xs },
  checked: { textDecorationLine: 'line-through', color: colors.textMuted },
  price: {
    minWidth: 56,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1 },
  field: { gap: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  note: { marginTop: spacing.md, marginBottom: spacing.xl },
});
