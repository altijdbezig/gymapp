/**
 * Turns an Open Food Facts product into a row our foods table will accept.
 *
 * Open Food Facts is crowd-sourced: fields are missing, numbers arrive as
 * strings, energy is sometimes only in kilojoules, and now and then a product
 * claims 250 g of fat per 100 g. Every one of those has to be caught here,
 * because the check constraints in migration 0004 would otherwise reject the
 * insert and the user would see a failure they cannot do anything about.
 *
 * Pure on purpose: input in, row or refusal out, no network and no database.
 */
import type { OffProduct } from '@/lib/openFoodFacts';
import type { TablesInsert } from '@/types/database';

export type FoodInsert = TablesInsert<'foods'>;

/** Why a product could not be used, in Dutch, ready to show. */
export type MappingRefusal =
  | 'Dit product heeft geen naam in Open Food Facts.'
  | 'Van dit product zijn geen voedingswaarden bekend.'
  | 'De voedingswaarden van dit product kloppen niet.'
  | 'Dit product heeft geen geldige barcode.';

export type MappingResult =
  | { food: FoodInsert; refusal?: undefined }
  | { food?: undefined; refusal: MappingRefusal };

/** 1 kcal = 4.184 kJ. Used when a product only lists energy in kilojoules. */
const KJ_PER_KCAL = 4.184;

/** Mirrors the barcode check constraint on foods. */
const BARCODE_PATTERN = /^[0-9]{6,14}$/;

/**
 * Open Food Facts mixes numbers and numeric strings in the same field, and a
 * comma decimal shows up occasionally too.
 */
function readNumber(value: number | string | undefined | null): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;

  const normalised = value.trim().replace(',', '.');
  if (normalised.length === 0) return undefined;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Rounds to the two decimals the numeric(x, 2) columns store. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Prefers the Dutch product name, falls back to the generic one. Trims to the
 * 200 characters the column allows rather than letting the insert fail.
 */
function readName(product: OffProduct): string | undefined {
  const candidates = [product.product_name_nl, product.product_name];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed.slice(0, 200);
  }
  return undefined;
}

/**
 * The first brand, whichever shape the endpoint used.
 *
 * The product endpoint returns "Mars, Mars Wrigley" as one string; the search
 * endpoint returns ["Melkan"]. Calling .split() on the array form would throw,
 * so both are handled here.
 */
function readBrand(product: OffProduct): string | null {
  const { brands } = product;

  const first = Array.isArray(brands)
    ? brands.find((brand) => typeof brand === 'string' && brand.trim().length > 0)?.trim()
    : typeof brands === 'string'
      ? brands.split(',')[0]?.trim()
      : undefined;

  if (!first) return null;
  return first.slice(0, 120);
}

function readKcalPer100g(nutriments: Record<string, number | string | undefined>) {
  const kcal = readNumber(nutriments['energy-kcal_100g']);
  if (kcal !== undefined) return kcal;

  // Some products only carry kilojoules.
  const kj = readNumber(nutriments['energy-kj_100g']) ?? readNumber(nutriments['energy_100g']);
  if (kj !== undefined) return kj / KJ_PER_KCAL;

  return undefined;
}

export function offProductToFoodInsert(product: OffProduct): MappingResult {
  const barcode = product.code?.trim();
  if (!barcode || !BARCODE_PATTERN.test(barcode)) {
    return { refusal: 'Dit product heeft geen geldige barcode.' };
  }

  const name = readName(product);
  if (!name) {
    return { refusal: 'Dit product heeft geen naam in Open Food Facts.' };
  }

  const nutriments = product.nutriments ?? {};
  const kcal = readKcalPer100g(nutriments);
  const protein = readNumber(nutriments['proteins_100g']);
  const fat = readNumber(nutriments['fat_100g']);
  const carbs = readNumber(nutriments['carbohydrates_100g']);

  // All four have to be there. A product with calories but no macros would
  // quietly ruin the protein target, which is the number that matters most.
  if (kcal === undefined || protein === undefined || fat === undefined || carbs === undefined) {
    return { refusal: 'Van dit product zijn geen voedingswaarden bekend.' };
  }

  const kcalPer100g = round2(kcal);
  const proteinPer100g = round2(protein);
  const fatPer100g = round2(fat);
  const carbsPer100g = round2(carbs);

  // The same limits as the check constraints, so anything this function
  // returns is guaranteed to insert.
  const withinRange =
    kcalPer100g >= 0 &&
    kcalPer100g <= 1000 &&
    [proteinPer100g, fatPer100g, carbsPer100g].every((value) => value >= 0 && value <= 100) &&
    proteinPer100g + fatPer100g + carbsPer100g <= 100;

  if (!withinRange) {
    return { refusal: 'De voedingswaarden van dit product kloppen niet.' };
  }

  const servingQuantity = readNumber(product.serving_quantity);
  const servingSizeG =
    servingQuantity !== undefined && servingQuantity > 0 && servingQuantity <= 2000
      ? round2(servingQuantity)
      : null;

  return {
    food: {
      source: 'off',
      barcode,
      name,
      brand: readBrand(product),
      kcal_per_100g: kcalPer100g,
      protein_per_100g: proteinPer100g,
      fat_per_100g: fatPer100g,
      carbs_per_100g: carbsPer100g,
      serving_size_g: servingSizeG,
      // The shape migration 0004 requires for a cached row: public, ownerless.
      is_public: true,
      created_by: null,
    },
  };
}

/** Maps a list, dropping the products we cannot use. */
export function offProductsToFoodInserts(products: OffProduct[]): FoodInsert[] {
  const usable: FoodInsert[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const result = offProductToFoodInsert(product);
    if (!result.food) continue;
    // Search results can repeat a barcode; the unique index would reject the
    // second one, so drop it here instead.
    if (seen.has(result.food.barcode!)) continue;
    seen.add(result.food.barcode!);
    usable.push(result.food);
  }

  return usable;
}
