/**
 * Finding a recipe you already have before paying for a new one.
 *
 * Generating a recipe costs money per request, so the cheapest recipe is the
 * one somebody already generated. Every recipe is kept and shared, and this is
 * the function that decides whether one of them is close enough to what you
 * need right now.
 *
 * "Close enough" is deliberately generous on calories and strict on protein.
 * Fifty calories either way is noise; fifteen grams of protein is a third of a
 * meal's worth and is usually the whole reason you were looking.
 */
import type { Tables } from '@/types/database';

export type Recipe = Tables<'ai_recipes'>;
export type Diet = Recipe['diet'];
export type Difficulty = Recipe['difficulty'];

export const DIET_LABELS: Record<Diet, string> = {
  none: 'Geen beperking',
  vegetarian: 'Vegetarisch',
  vegan: 'Veganistisch',
  pescatarian: 'Pescotarisch',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Makkelijk',
  medium: 'Gemiddeld',
  hard: 'Uitdagend',
};

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** How far a cached recipe may be from the target before it is not worth it. */
export const MATCH_TOLERANCE = {
  kcal: 150,
  proteinG: 15,
} as const;

export type RecipeTarget = {
  kcal: number;
  proteinG: number;
};

export type RecipeFilters = {
  diet: Diet;
  /** Lowercase substrings; a recipe listing any of them is skipped. */
  allergies: readonly string[];
  maxPrepMinutes: number;
  maxDifficulty: Difficulty;
};

/**
 * A diet is a hierarchy, not a set of tags: a vegan recipe is fine for a
 * vegetarian, and a vegetarian one is fine for a pescatarian. Anything with
 * 'none' is only fine for somebody with no restriction.
 */
export function fitsDiet(recipeDiet: Diet, wanted: Diet): boolean {
  if (wanted === 'none') return true;
  if (recipeDiet === 'vegan') return true;
  if (wanted === 'vegan') return false;
  if (recipeDiet === 'vegetarian') return true;
  if (wanted === 'vegetarian') return false;
  // Pescatarian: vegan and vegetarian already returned true above; a
  // pescatarian recipe is the only other one that fits.
  return recipeDiet === 'pescatarian';
}

/** True when the recipe lists nothing the user is allergic to. */
export function isAllergySafe(recipe: Recipe, allergies: readonly string[]): boolean {
  if (allergies.length === 0) return true;

  const listed = recipe.allergens.map((allergen) => allergen.toLowerCase());
  return !allergies.some((allergy) => {
    const needle = allergy.trim().toLowerCase();
    if (needle.length === 0) return false;
    return listed.some((allergen) => allergen.includes(needle) || needle.includes(allergen));
  });
}

export function matchesFilters(recipe: Recipe, filters: RecipeFilters): boolean {
  if (!fitsDiet(recipe.diet, filters.diet)) return false;
  if (!isAllergySafe(recipe, filters.allergies)) return false;
  if (recipe.prep_minutes > filters.maxPrepMinutes) return false;
  if (DIFFICULTY_RANK[recipe.difficulty] > DIFFICULTY_RANK[filters.maxDifficulty]) return false;
  return true;
}

/**
 * How far a recipe is from the target. Lower is better; 0 is exact.
 *
 * Protein weighs four times as much as calories per unit, which is roughly how
 * much harder protein is to hit: being 100 kcal off is a slice of bread, being
 * 25 g of protein off is a chicken breast.
 */
export function distanceFromTarget(recipe: Recipe, target: RecipeTarget): number {
  const kcalOff = Math.abs(recipe.kcal_per_serving - target.kcal);
  const proteinOff = Math.abs(Number(recipe.protein_per_serving) - target.proteinG);
  return kcalOff + proteinOff * 4;
}

export function isCloseEnough(recipe: Recipe, target: RecipeTarget): boolean {
  return (
    Math.abs(recipe.kcal_per_serving - target.kcal) <= MATCH_TOLERANCE.kcal &&
    Math.abs(Number(recipe.protein_per_serving) - target.proteinG) <= MATCH_TOLERANCE.proteinG
  );
}

/**
 * The cached recipes that fit, best match first.
 *
 * Returns a list rather than a single winner so the screen can offer a few and
 * let you pick -- "here are three that fit" is a better answer than one recipe
 * you happen not to fancy, and all three are free.
 */
export function findMatches(
  recipes: readonly Recipe[],
  target: RecipeTarget,
  filters: RecipeFilters,
  limit = 5,
): Recipe[] {
  return recipes
    .filter((recipe) => matchesFilters(recipe, filters))
    .filter((recipe) => isCloseEnough(recipe, target))
    .sort((a, b) => distanceFromTarget(a, target) - distanceFromTarget(b, target))
    .slice(0, limit);
}

/** "620 kcal · 48 g eiwit · 25 min" -- the line under a recipe title. */
export function describeRecipe(recipe: Recipe): string {
  const protein = Math.round(Number(recipe.protein_per_serving));
  return `${recipe.kcal_per_serving} kcal · ${protein} g eiwit · ${recipe.prep_minutes} min`;
}

/** "60 kcal en 4 g eiwit boven je doel" -- honest about the gap. */
export function describeGap(recipe: Recipe, target: RecipeTarget): string {
  const kcalOff = recipe.kcal_per_serving - target.kcal;
  const proteinOff = Math.round(Number(recipe.protein_per_serving) - target.proteinG);

  if (Math.abs(kcalOff) <= 25 && Math.abs(proteinOff) <= 3) {
    return 'Past vrijwel precies.';
  }

  const parts: string[] = [];
  if (Math.abs(kcalOff) > 25) {
    parts.push(`${Math.abs(kcalOff)} kcal ${kcalOff > 0 ? 'meer' : 'minder'}`);
  }
  if (Math.abs(proteinOff) > 3) {
    parts.push(`${Math.abs(proteinOff)} g eiwit ${proteinOff > 0 ? 'meer' : 'minder'}`);
  }

  return `${parts.join(' en ')} dan je doel.`;
}

/** One ingredient, as the model returns it inside the jsonb column. */
export type Ingredient = {
  name: string;
  quantity: string;
  aisle: string;
};

/**
 * Reads the ingredients out of the jsonb column.
 *
 * The column is typed as Json, and it comes from a model, so it is validated
 * rather than cast: a malformed recipe should show fewer ingredients, not crash
 * the screen.
 */
export function readIngredients(recipe: Pick<Recipe, 'ingredients'>): Ingredient[] {
  if (!Array.isArray(recipe.ingredients)) return [];

  return recipe.ingredients.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
    const candidate = raw as Record<string, unknown>;

    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (name.length === 0) return [];

    return [
      {
        name,
        quantity: typeof candidate.quantity === 'string' ? candidate.quantity : '',
        aisle: typeof candidate.aisle === 'string' ? candidate.aisle : 'overig',
      },
    ];
  });
}
