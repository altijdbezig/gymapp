/**
 * The shopping list.
 *
 * Two jobs: put the ingredients of the recipes you picked into one list without
 * duplicates, and group that list the way a supermarket is laid out so you walk
 * one lap instead of four.
 *
 * On prices: the user types them in. There is no open price API for Albert
 * Heijn or Jumbo, and scraping one is not something this app does, so the app
 * never invents a price and never pretends to know a total it does not.
 */
import type { Tables } from '@/types/database';
import { readIngredients, type Recipe } from './recipeMatching';

export type ShoppingList = Tables<'shopping_lists'>;
export type ShoppingItem = Tables<'shopping_list_items'>;
export type Aisle = ShoppingItem['aisle'];

/** Roughly the order you walk a Dutch supermarket. */
export const AISLE_ORDER: readonly Aisle[] = [
  'groente_fruit',
  'brood',
  'zuivel',
  'vlees_vis',
  'diepvries',
  'conserven',
  'droogwaren',
  'kruiden_sauzen',
  'dranken',
  'overig',
];

export const AISLE_LABELS: Record<Aisle, string> = {
  groente_fruit: 'Groente en fruit',
  brood: 'Brood',
  zuivel: 'Zuivel',
  vlees_vis: 'Vlees en vis',
  diepvries: 'Diepvries',
  conserven: 'Conserven',
  droogwaren: 'Droogwaren',
  kruiden_sauzen: 'Kruiden en sauzen',
  dranken: 'Dranken',
  overig: 'Overig',
};

/** Anything the model invented that is not a real aisle lands under "overig". */
export function toAisle(value: string): Aisle {
  return (AISLE_ORDER as readonly string[]).includes(value) ? (value as Aisle) : 'overig';
}

export type AisleGroup = {
  aisle: Aisle;
  label: string;
  items: ShoppingItem[];
};

/**
 * Groups the list by aisle, in walking order.
 *
 * Empty aisles are left out -- a heading with nothing under it is just noise on
 * a list you are holding in one hand.
 */
export function groupByAisle(items: readonly ShoppingItem[]): AisleGroup[] {
  return AISLE_ORDER.map((aisle) => ({
    aisle,
    label: AISLE_LABELS[aisle],
    items: items
      .filter((item) => item.aisle === aisle)
      .sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'nl')),
  })).filter((group) => group.items.length > 0);
}

export type DraftItem = {
  name: string;
  quantity: string;
  aisle: Aisle;
  recipeId: string | null;
};

/**
 * Turns a set of recipes into one list.
 *
 * Two recipes that both want onions become one line with both quantities
 * behind it ("1 stuk + 2 stuks") rather than two lines. The quantities are not
 * added up: "150 g" and "2 el" cannot be added, and a wrong total is worse than
 * two honest ones.
 */
export function buildDraftItems(recipes: readonly Recipe[]): DraftItem[] {
  const byName = new Map<string, DraftItem & { quantities: string[] }>();

  for (const recipe of recipes) {
    for (const ingredient of readIngredients(recipe)) {
      const key = ingredient.name.trim().toLowerCase();
      const current = byName.get(key);

      if (current) {
        if (ingredient.quantity) current.quantities.push(ingredient.quantity);
        continue;
      }

      byName.set(key, {
        name: ingredient.name.trim(),
        quantity: '',
        quantities: ingredient.quantity ? [ingredient.quantity] : [],
        aisle: toAisle(ingredient.aisle),
        recipeId: recipe.id,
      });
    }
  }

  return [...byName.values()].map((draft) => ({
    name: draft.name,
    quantity: draft.quantities.join(' + '),
    aisle: draft.aisle,
    recipeId: draft.recipeId,
  }));
}

export type ListTotals = {
  items: number;
  checked: number;
  /** The total of the prices that were filled in, in cents. */
  knownPriceCents: number;
  /** How many items have no price yet. */
  withoutPrice: number;
};

/**
 * What the list comes to.
 *
 * The total only counts what you typed in. The screen says how many items are
 * still without a price, so "€ 12,40" is never mistaken for the whole bill.
 */
export function listTotals(items: readonly ShoppingItem[]): ListTotals {
  return items.reduce<ListTotals>(
    (running, item) => ({
      items: running.items + 1,
      checked: running.checked + (item.is_checked ? 1 : 0),
      knownPriceCents: running.knownPriceCents + (item.price_cents ?? 0),
      withoutPrice: running.withoutPrice + (item.price_cents === null ? 1 : 0),
    }),
    { items: 0, checked: 0, knownPriceCents: 0, withoutPrice: 0 },
  );
}

/** "€ 12,40" -- cents in, Dutch money out. */
export function formatEuro(cents: number): string {
  const euros = Math.round(cents) / 100;
  return `€ ${euros.toFixed(2).replace('.', ',')}`;
}

/**
 * Parses a typed price. Accepts "3", "3,50", "€ 3,50" and "3.50".
 * Anything else comes back as null rather than as a wrong number.
 */
export function parsePrice(input: string): number | null {
  const cleaned = input.trim().replace(/^€\s*/, '').replace(',', '.');
  if (cleaned.length === 0) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const euros = Number(cleaned);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

/** The sentence under the total, which never pretends to know more than it does. */
export function describeTotals(totals: ListTotals): string {
  if (totals.items === 0) return 'Deze lijst is nog leeg.';

  const progress = `${totals.checked} van de ${totals.items} afgevinkt`;
  if (totals.withoutPrice === totals.items) {
    return `${progress}. Vul prijzen in als je wil weten wat het kost.`;
  }
  if (totals.withoutPrice > 0) {
    return `${progress} · ${formatEuro(totals.knownPriceCents)} ingevuld, ${totals.withoutPrice} ${
      totals.withoutPrice === 1 ? 'product' : 'producten'
    } nog zonder prijs.`;
  }
  return `${progress} · ${formatEuro(totals.knownPriceCents)} in totaal.`;
}
