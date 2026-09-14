/**
 * Exporting everything the app knows about you, and deleting it.
 *
 * Both are GDPR requirements, not features: article 20 gives you the right to
 * take your data with you in a machine-readable format, and article 17 the
 * right to have it erased. Neither may be behind a support e-mail.
 *
 * The export is assembled on the device from ordinary queries, so RLS decides
 * what goes in it: it is exactly the rows that are yours, and it cannot
 * accidentally contain anybody else's.
 *
 * Medication is included, with a warning on the screen. It is health data and
 * the file is not encrypted, but it is your health data and leaving it out of
 * your own export would be the app deciding what you may have.
 */
import { supabase } from '@/lib/supabase';
import { APP_NAME, APP_VERSION } from '@/config/app';

/** Every table that holds something of yours, and how to fetch it. */
const USER_TABLES = [
  'profiles',
  'body_weights',
  'daily_targets',
  'food_log_entries',
  'food_favorites',
  'food_portions',
  'water_entries',
  'meals',
  'workout_plans',
  'routine_folders',
  'week_schedule',
  'workout_sessions',
  'personal_records',
  'shopping_lists',
] as const;

/** The tables that are only reachable through a parent of yours. */
const CHILD_TABLES = [
  'set_logs',
  'workout_days',
  'workout_day_exercises',
  'meal_items',
  'shopping_list_items',
] as const;

/** Health data, kept apart in the file so it is obvious what it is. */
const HEALTH_TABLES = ['medications', 'medication_intakes'] as const;

export type ExportOptions = {
  /** Whether to include medication. Defaults to true: it is your data. */
  includeMedication: boolean;
};

export type ExportFile = {
  /** The JSON, ready to write to a file. */
  json: string;
  /** A filename with the date in it. */
  filename: string;
  /** How many rows are in it, for the confirmation on screen. */
  rowCount: number;
};

/**
 * Builds the export.
 *
 * Everything is fetched with plain selects rather than a single clever query:
 * a readable file is worth more than a fast one, and this runs once.
 */
export async function buildExport(
  userId: string,
  options: ExportOptions = { includeMedication: true },
): Promise<ExportFile> {
  const data: Record<string, unknown[]> = {};
  let rowCount = 0;

  for (const table of USER_TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*').eq('user_id', userId);
    // A table that fails is reported as empty rather than failing the whole
    // export: a partial export is worth more than none.
    data[table] = error ? [] : (rows ?? []);
    rowCount += data[table].length;
  }

  // ai_recipes and exercises are keyed on created_by rather than user_id, so
  // they are fetched separately instead of in the loop above.
  const recipes = await supabase.from('ai_recipes').select('*').eq('created_by', userId);
  data.ai_recipes = recipes.error ? [] : (recipes.data ?? []);
  rowCount += data.ai_recipes.length;

  // The children come along via their parents, so they are fetched without a
  // user filter -- RLS already limits them to rows you can see.
  for (const table of CHILD_TABLES) {
    const { data: rows, error } = await supabase.from(table).select('*');
    data[table] = error ? [] : (rows ?? []);
    rowCount += data[table].length;
  }

  // Your own exercises only; the shared library is not personal data.
  const exercises = await supabase
    .from('exercises')
    .select('*')
    .eq('is_custom', true)
    .eq('created_by', userId);
  data.exercises = exercises.error ? [] : (exercises.data ?? []);
  rowCount += data.exercises.length;

  const health: Record<string, unknown[]> = {};
  if (options.includeMedication) {
    for (const table of HEALTH_TABLES) {
      const { data: rows, error } = await supabase.from(table).select('*').eq('user_id', userId);
      health[table] = error ? [] : (rows ?? []);
      rowCount += health[table].length;
    }
  }

  const exported = {
    export: {
      app: APP_NAME,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      userId,
      note:
        'Dit bestand bevat alles wat deze app van je bewaart. Bewaar het veilig: ' +
        'het is niet versleuteld.',
      includesHealthData: options.includeMedication,
    },
    data,
    ...(options.includeMedication ? { healthData: health } : {}),
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    json: JSON.stringify(exported, null, 2),
    filename: `gymapp-export-${stamp}.json`,
    rowCount,
  };
}

/**
 * Deletes the account.
 *
 * Handled by an edge function, because removing a row from auth.users needs
 * the service role key and that key may never be in the app. Every table
 * cascades from auth.users, so one delete takes everything with it.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) {
    throw new Error('Je account kon niet worden verwijderd. Probeer het later opnieuw.');
  }
}
