/**
 * Thin wrapper around the Open Food Facts API.
 *
 * Two rules we have to play by, both from their documented policy:
 *
 *  1. Identify yourself with a User-Agent that carries a contact URL. Ours
 *     comes from src/config/app.ts. Browsers refuse to let a page set that
 *     header, so on web we leave it off -- there the browser's own User-Agent
 *     and Origin identify the caller instead.
 *  2. Stay inside the rate limits. Product lookups by barcode are allowed at a
 *     much higher rate than search, so only search goes through the bucket.
 *
 * Everything here returns plain data. Turning it into a foods row is
 * offFoodToFoodInsert() in src/features/nutrition/offMapping.ts, which is pure
 * and tested, because Open Food Facts data is crowd-sourced and messy.
 */
import { Platform } from 'react-native';

import { OPEN_FOOD_FACTS_USER_AGENT } from '@/config/app';
import { createTokenBucket, delay } from './tokenBucket';

const BASE_URL = 'https://world.openfoodfacts.org';

/**
 * Full-text search lives on its own host. The old /cgi/search.pl endpoint has
 * been switched off -- it answers with an HTML "page temporarily unavailable"
 * instead of JSON -- and this is its documented replacement.
 */
const SEARCH_URL = 'https://search.openfoodfacts.org/search';

/** Only the fields we actually use, so the responses stay small. */
const FIELDS = 'code,product_name,product_name_nl,brands,nutriments,serving_quantity';

/**
 * Open Food Facts allows 10 searches per minute.
 *
 * The numbers are not arbitrary: the worst case a token bucket can produce in
 * a window is its capacity plus one call per refill interval, so
 * capacity + 60000/refill must stay at or below 10. 2 + 60000/7500 = 10 exactly.
 * A capacity of 2 still lets you search and immediately correct a typo without
 * waiting, which is what the burst is for.
 */
export const OFF_SEARCH_RATE_LIMIT = { capacity: 2, refillIntervalMs: 7_500 } as const;

const SEARCH_BUCKET = createTokenBucket(OFF_SEARCH_RATE_LIMIT);

/** Requests that hang forever are worse than requests that fail. */
const TIMEOUT_MS = 10_000;

export type OffProduct = {
  code: string;
  product_name?: string;
  product_name_nl?: string;
  /**
   * The two endpoints disagree: the product endpoint returns a comma-separated
   * string ("Mars, Mars Wrigley"), the search endpoint an array (["Melkan"]).
   * Both shapes are handled in offMapping.
   */
  brands?: string | string[];
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

/** Thrown for anything the caller should show as "kon niet ophalen". */
export class OpenFoodFactsError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'timeout' | 'server' | 'unexpected',
  ) {
    super(message);
    this.name = 'OpenFoodFactsError';
  }
}

function headers(): Record<string, string> {
  // A browser rejects an attempt to set User-Agent, so only send it natively.
  if (Platform.OS === 'web') return { Accept: 'application/json' };
  return { Accept: 'application/json', 'User-Agent': OPEN_FOOD_FACTS_USER_AGENT };
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { headers: headers(), signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenFoodFactsError('De zoekopdracht duurde te lang.', 'timeout');
    }
    throw new OpenFoodFactsError('Geen verbinding met Open Food Facts.', 'offline');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new OpenFoodFactsError(
      `Open Food Facts antwoordde met ${response.status}.`,
      response.status >= 500 ? 'server' : 'unexpected',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new OpenFoodFactsError('Onleesbaar antwoord van Open Food Facts.', 'unexpected');
  }
}

/**
 * Looks up one product by barcode. Returns null when Open Food Facts does not
 * know the code, which is a normal outcome, not an error.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const json = (await getJson(url)) as { status?: number; product?: OffProduct };

  if (!json || json.status !== 1 || !json.product) return null;
  return { ...json.product, code: json.product.code ?? barcode };
}

/**
 * Full-text search. Waits for the rate limiter first, so a burst of typing can
 * never turn into a burst of requests.
 */
export async function searchProducts(query: string, pageSize = 20): Promise<OffProduct[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  await delay(SEARCH_BUCKET.take());

  const params = new URLSearchParams({
    q: trimmed,
    page_size: String(pageSize),
    fields: FIELDS,
  });

  // This endpoint calls the list "hits", not "products".
  const json = (await getJson(`${SEARCH_URL}?${params.toString()}`)) as {
    hits?: OffProduct[];
  };

  return Array.isArray(json?.hits) ? json.hits : [];
}

/** Exposed so the search screen can tell the user it is waiting on the limiter. */
export function msUntilSearchAllowed(): number {
  return SEARCH_BUCKET.msUntilAllowed();
}
