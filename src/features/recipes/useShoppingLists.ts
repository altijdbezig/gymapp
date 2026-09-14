/**
 * Shopping lists: reading them, filling them from recipes, ticking them off.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createId } from '@/lib/id';
import { supabase } from '@/lib/supabase';
import type { Recipe } from './recipeMatching';
import { buildDraftItems, type DraftItem, type ShoppingItem, type ShoppingList } from './shoppingList';

export type ListWithItems = ShoppingList & { items: ShoppingItem[] };

export const shoppingListsQueryKey = (userId: string) => ['shopping-lists', userId] as const;
export const shoppingListQueryKey = (listId: string) => ['shopping-list', listId] as const;

export function useShoppingLists(userId: string | null) {
  return useQuery({
    queryKey: shoppingListsQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<ListWithItems[]> => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*, shopping_list_items(*)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const { shopping_list_items: items, ...list } = row;
        return { ...list, items: items ?? [] };
      });
    },
  });
}

export function useShoppingList(listId: string | null) {
  return useQuery({
    queryKey: shoppingListQueryKey(listId ?? 'none'),
    enabled: !!listId,
    queryFn: async (): Promise<ListWithItems | null> => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*, shopping_list_items(*)')
        .eq('id', listId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const { shopping_list_items: items, ...list } = data;
      return { ...list, items: items ?? [] };
    },
  });
}

export type CreateListInput = {
  userId: string;
  name: string;
  /** Recipes to fill the list from. Optional: an empty list is fine too. */
  recipes?: readonly Recipe[];
};

/**
 * Makes a list, optionally filled from the recipes you picked.
 *
 * The list and its items are written together, so a list never exists in a
 * half-built state: either you get the list with everything on it, or the
 * whole thing fails and nothing was created.
 */
export function useCreateShoppingList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, name, recipes = [] }: CreateListInput): Promise<string> => {
      const listId = createId();

      const { error } = await supabase
        .from('shopping_lists')
        .insert({ id: listId, user_id: userId, name: name.trim().slice(0, 80) || 'Boodschappen' });

      if (error) throw error;

      const drafts = buildDraftItems(recipes);
      if (drafts.length > 0) {
        const { error: itemsError } = await supabase
          .from('shopping_list_items')
          .insert(toRows(listId, drafts));

        if (itemsError) throw itemsError;
      }

      return listId;
    },
    onSuccess: (_listId, { userId }) => {
      queryClient.invalidateQueries({ queryKey: shoppingListsQueryKey(userId) });
    },
  });
}

function toRows(listId: string, drafts: readonly DraftItem[], offset = 0) {
  return drafts.map((draft, index) => ({
    list_id: listId,
    recipe_id: draft.recipeId,
    name: draft.name.slice(0, 120),
    quantity: draft.quantity ? draft.quantity.slice(0, 40) : null,
    aisle: draft.aisle,
    order_index: offset + index,
  }));
}

export function useAddListItems(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      drafts,
      offset = 0,
    }: {
      listId: string;
      drafts: DraftItem[];
      offset?: number;
    }) => {
      if (drafts.length === 0) return;

      const { error } = await supabase
        .from('shopping_list_items')
        .insert(toRows(listId, drafts, offset));

      if (error) throw error;
    },
    onSuccess: (_result, { listId }) => {
      queryClient.invalidateQueries({ queryKey: shoppingListQueryKey(listId) });
      if (userId) queryClient.invalidateQueries({ queryKey: shoppingListsQueryKey(userId) });
    },
  });
}

export function useUpdateListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      item,
      patch,
    }: {
      item: ShoppingItem;
      patch: Partial<Pick<ShoppingItem, 'is_checked' | 'price_cents' | 'name' | 'quantity' | 'aisle'>>;
    }) => {
      const { error } = await supabase
        .from('shopping_list_items')
        .update(patch)
        .eq('id', item.id);

      if (error) throw error;
    },
    onSuccess: (_result, { item }) => {
      queryClient.invalidateQueries({ queryKey: shoppingListQueryKey(item.list_id) });
    },
  });
}

export function useDeleteListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: ShoppingItem) => {
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', item.id);
      if (error) throw error;
      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: shoppingListQueryKey(item.list_id) });
    },
  });
}

export function useDeleteShoppingList(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      // The items go with it through ON DELETE CASCADE.
      const { error } = await supabase.from('shopping_lists').delete().eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: shoppingListsQueryKey(userId) });
    },
  });
}

/** Clearing the ticks, so the same list can be used again next week. */
export function useUncheckAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ is_checked: false })
        .eq('list_id', listId);

      if (error) throw error;
      return listId;
    },
    onSuccess: (listId) => {
      queryClient.invalidateQueries({ queryKey: shoppingListQueryKey(listId) });
    },
  });
}
