/**
 * generate-recipe — the only place in this project that talks to Claude.
 *
 * It runs on Supabase Edge Functions (Deno), which is the whole point: the
 * Anthropic API key is a secret, and everything in the app bundle is readable
 * by anyone who installs it. So the app never holds a key; it calls this
 * function with its own Supabase session, and the function does three things:
 *
 *   1. checks who you are, from the Authorization header the app already has;
 *   2. checks you have not used up your generations for today;
 *   3. asks Claude for one recipe that fits your remaining macros, and writes
 *      it into ai_recipes.
 *
 * The cache lookup deliberately does NOT happen here. The app searches
 * ai_recipes first and only calls this function when it finds nothing close
 * enough, which means a cache hit costs one ordinary Postgres query and no
 * function invocation at all.
 *
 * Deploy:  supabase functions deploy generate-recipe
 * Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * The model. One constant, so switching is one line.
 *
 * Effort is set to "low" on purpose: writing a recipe inside a macro budget is
 * a routine task, and this is the one feature in the app that costs money per
 * use. Raise it here if the recipes turn out thin.
 */
const MODEL = 'claude-opus-5';
const EFFORT = 'low';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * The shape the model has to return.
 *
 * `strict: true` plus a forced tool choice is what makes this a guarantee
 * rather than a hope: the arguments are validated against this schema before
 * they ever reach us, so there is no "sometimes it returns prose" branch.
 */
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Korte Nederlandse naam van het gerecht' },
    description: { type: 'string', description: 'Eén of twee zinnen over het gerecht' },
    servings: { type: 'integer', description: 'Aantal porties dat dit recept oplevert' },
    kcal_per_serving: { type: 'integer' },
    protein_per_serving: { type: 'number' },
    fat_per_serving: { type: 'number' },
    carbs_per_serving: { type: 'number' },
    prep_minutes: { type: 'integer' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    cuisine: { type: 'string', description: 'Bijvoorbeeld: Italiaans, Hollands, Aziatisch' },
    allergens: {
      type: 'array',
      items: { type: 'string' },
      description: 'Allergenen die in dit gerecht zitten, in het Nederlands',
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string', description: 'Bijvoorbeeld: 150 g, 1 stuk, 2 el' },
          aisle: {
            type: 'string',
            enum: [
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
            ],
          },
        },
        required: ['name', 'quantity', 'aisle'],
        additionalProperties: false,
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title',
    'description',
    'servings',
    'kcal_per_serving',
    'protein_per_serving',
    'fat_per_serving',
    'carbs_per_serving',
    'prep_minutes',
    'difficulty',
    'cuisine',
    'allergens',
    'ingredients',
    'steps',
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = [
  'Je bent een kookhulp in een Nederlandse fitness-app.',
  '',
  'Je schrijft één recept dat past binnen de opgegeven macro\'s. Regels:',
  '- Alles in het Nederlands: naam, ingrediënten, stappen.',
  '- Gebruik ingrediënten die in een gewone Nederlandse supermarkt liggen.',
  '- Hoeveelheden in gram, milliliter, stuks, eetlepels of theelepels.',
  '- De macro\'s per portie moeten zo dicht mogelijk bij het doel liggen. Schat ze',
  '  eerlijk in op basis van de ingrediënten; verzin geen getallen die niet kloppen.',
  '- Houd je strikt aan het dieet en de allergieën. Bij twijfel laat je een',
  '  ingrediënt weg.',
  '- Geef geen voedingsadvies en geen medisch advies. Geen oordeel over wat de',
  '  gebruiker al heeft gegeten.',
  '- Schrijf de stappen kort en in de gebiedende wijs.',
].join('\n');

type RequestBody = {
  kcal: number;
  proteinG: number;
  fatG?: number;
  carbsG?: number;
  mealType?: string;
  extraWishes?: string;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Niet ingelogd.' }, 401);
    }

    // The client is built with the caller's own token, so every query below
    // runs under their RLS policies. The service role key is never used here:
    // this function has no reason to see anybody else's rows.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Niet ingelogd.' }, 401);
    }
    const userId = userData.user.id;

    const body = (await request.json()) as RequestBody;
    if (!Number.isFinite(body.kcal) || body.kcal <= 0) {
      return json({ error: 'Geef aan hoeveel kcal het recept mag zijn.' }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('diet, allergies, cuisines, max_prep_minutes, max_difficulty, ai_recipe_limit_per_day')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      return json({ error: 'Je profiel kon niet worden gelezen.' }, 500);
    }

    const limit = profile?.ai_recipe_limit_per_day ?? 5;

    // The limit counts rows written today. A cache hit never reaches this
    // function, so it never counts against you.
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('ai_recipes')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .gte('created_at', since.toISOString());

    if (countError) {
      return json({ error: 'Je limiet kon niet worden gecontroleerd.' }, 500);
    }

    if ((count ?? 0) >= limit) {
      return json(
        {
          error: `Je hebt vandaag al ${limit} recepten laten maken. Morgen kan het weer, of je zoekt in de recepten die er al staan.`,
          code: 'limit_reached',
        },
        429,
      );
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({ error: 'De receptenfunctie is nog niet ingesteld.' }, 503);
    }

    const anthropic = new Anthropic({ apiKey });

    const wishes: string[] = [];
    if (profile?.diet && profile.diet !== 'none') {
      wishes.push(`Dieet: ${dietLabel(profile.diet)}.`);
    }
    if (profile?.allergies?.length) {
      wishes.push(`Allergieën, absoluut vermijden: ${profile.allergies.join(', ')}.`);
    }
    if (profile?.cuisines?.length) {
      wishes.push(`Voorkeur voor deze keukens: ${profile.cuisines.join(', ')}.`);
    }
    if (profile?.max_prep_minutes) {
      wishes.push(`Maximaal ${profile.max_prep_minutes} minuten werk.`);
    }
    if (profile?.max_difficulty) {
      wishes.push(`Moeilijkheid maximaal: ${profile.max_difficulty}.`);
    }
    if (body.mealType) {
      wishes.push(`Dit is voor: ${body.mealType}.`);
    }
    if (body.extraWishes?.trim()) {
      wishes.push(`Extra wens van de gebruiker: ${body.extraWishes.trim()}`);
    }

    const target = [
      `Doel per portie: ongeveer ${Math.round(body.kcal)} kcal en ${Math.round(body.proteinG)} g eiwit.`,
      body.fatG ? `Richtlijn vet: ${Math.round(body.fatG)} g.` : null,
      body.carbsG ? `Richtlijn koolhydraten: ${Math.round(body.carbsG)} g.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: EFFORT },
      system: SYSTEM_PROMPT,
      // strict + a forced tool call: the arguments are schema-valid or the
      // request fails, so there is no parsing branch to get wrong.
      tools: [
        {
          name: 'recept',
          description: 'Geef het recept terug in gestructureerde vorm.',
          strict: true,
          input_schema: RECIPE_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'recept' },
      messages: [
        {
          role: 'user',
          content: `${target}\n\n${wishes.join('\n')}`.trim(),
        },
      ],
    });

    // A safety decline stops the turn before any tool call. It should not
    // happen for a recipe, but reading content without checking would crash.
    if (response.stop_reason === 'refusal') {
      return json({ error: 'Dit verzoek kon niet worden verwerkt.' }, 422);
    }

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return json({ error: 'Er kwam geen recept terug. Probeer het opnieuw.' }, 502);
    }

    const recipe = toolUse.input as Record<string, unknown>;

    const { data: saved, error: insertError } = await supabase
      .from('ai_recipes')
      .insert({
        created_by: userId,
        title: String(recipe.title).slice(0, 120),
        description: String(recipe.description ?? '').slice(0, 1000),
        servings: Number(recipe.servings) || 1,
        kcal_per_serving: Math.round(Number(recipe.kcal_per_serving) || 0),
        protein_per_serving: Number(recipe.protein_per_serving) || 0,
        fat_per_serving: Number(recipe.fat_per_serving) || 0,
        carbs_per_serving: Number(recipe.carbs_per_serving) || 0,
        prep_minutes: Math.round(Number(recipe.prep_minutes) || 15),
        difficulty: recipe.difficulty ?? 'easy',
        cuisine: recipe.cuisine ?? null,
        diet: profile?.diet ?? 'none',
        allergens: recipe.allergens ?? [],
        ingredients: recipe.ingredients ?? [],
        steps: recipe.steps ?? [],
        model: MODEL,
        is_public: true,
      })
      .select()
      .single();

    if (insertError) {
      return json({ error: 'Het recept kon niet worden opgeslagen.' }, 500);
    }

    return json({
      recipe: saved,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      remainingToday: Math.max(0, limit - (count ?? 0) - 1),
    });
  } catch (error) {
    console.error('generate-recipe failed', error);
    return json({ error: 'Er ging iets mis bij het maken van het recept.' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function dietLabel(diet: string): string {
  switch (diet) {
    case 'vegetarian':
      return 'vegetarisch';
    case 'vegan':
      return 'veganistisch';
    case 'pescatarian':
      return 'pescotarisch (wel vis, geen vlees)';
    default:
      return 'geen beperking';
  }
}
