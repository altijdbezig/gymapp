-- Phase 7: AI recipes and the shopping list.
--
-- Generating a recipe costs money per request, so the schema is built around
-- not generating one:
--
--   - every recipe is kept, and readable by everyone. A recipe is not personal
--     data -- it is a list of ingredients -- so one user's "kipfilet met rijst,
--     620 kcal, 55 g eiwit" can answer somebody else's identical question for
--     free. The app searches this table before it calls the model.
--   - a per-user daily limit lives on the profile, so one bad afternoon cannot
--     run up a bill.
--
-- The model itself is never called from the app: an edge function holds the API
-- key. Nothing with EXPO_PUBLIC_ in front of it is ever a secret.

create type public.diet_preference as enum ('none', 'vegetarian', 'vegan', 'pescatarian');

create type public.recipe_difficulty as enum ('easy', 'medium', 'hard');

-- The order a Dutch supermarket is laid out in, roughly. Grouping the shopping
-- list by aisle is the difference between one lap and four.
create type public.grocery_aisle as enum (
  'groente_fruit',
  'brood',
  'zuivel',
  'vlees_vis',
  'diepvries',
  'conserven',
  'droogwaren',
  'kruiden_sauzen',
  'dranken',
  'overig'
);

-- ---------------------------------------------------------------------------
-- profiles: recipe preferences and the daily limit
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column diet public.diet_preference not null default 'none',
  -- Free text, because an allergy list cannot be an enum: people are allergic
  -- to things nobody thought of.
  add column allergies text[] not null default '{}',
  add column cuisines text[] not null default '{}',
  add column max_prep_minutes smallint not null default 30
    check (max_prep_minutes between 5 and 240),
  add column max_difficulty public.recipe_difficulty not null default 'medium',
  -- How many recipes may actually be generated per day. A cache hit does not
  -- count, because it costs nothing.
  add column ai_recipe_limit_per_day smallint not null default 5
    check (ai_recipe_limit_per_day between 0 and 50);

comment on column public.profiles.ai_recipe_limit_per_day is 'Generations per day; cache hits are free and do not count.';

-- ---------------------------------------------------------------------------
-- ai_recipes
-- ---------------------------------------------------------------------------
create table public.ai_recipes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,

  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),

  servings numeric(4, 1) not null default 1 check (servings > 0 and servings <= 20),

  -- Per serving, which is the number the user actually eats.
  kcal_per_serving integer not null check (kcal_per_serving between 0 and 5000),
  protein_per_serving numeric(6, 1) not null check (protein_per_serving >= 0),
  fat_per_serving numeric(6, 1) not null check (fat_per_serving >= 0),
  carbs_per_serving numeric(6, 1) not null check (carbs_per_serving >= 0),

  prep_minutes smallint not null check (prep_minutes between 1 and 480),
  difficulty public.recipe_difficulty not null default 'easy',
  cuisine text check (char_length(cuisine) <= 40),
  diet public.diet_preference not null default 'none',
  -- What this recipe contains, so somebody with an allergy can filter it out
  -- of the cache before it is ever shown.
  allergens text[] not null default '{}',

  -- [{ name, quantity, unit, aisle }]. Kept as jsonb rather than as a child
  -- table: an ingredient is only ever read as part of its recipe, it is never
  -- queried on its own, and a recipe is written once and never edited.
  ingredients jsonb not null,
  steps text[] not null,

  -- Which model wrote it, so a later change of model is traceable.
  model text not null check (char_length(model) <= 60),

  -- Recipes are shared so the cache works across users. There is nothing
  -- personal in a recipe; the remaining macros that prompted it are not stored.
  is_public boolean not null default true,

  created_at timestamptz not null default now()
);

comment on table public.ai_recipes is 'Generated recipes, kept and shared so the cache saves requests.';

-- The cache lookup: "a recipe near these macros that fits my restrictions".
create index ai_recipes_macros_idx
  on public.ai_recipes (kcal_per_serving, protein_per_serving) where is_public;

create index ai_recipes_created_by_idx on public.ai_recipes (created_by, created_at desc);

-- ---------------------------------------------------------------------------
-- shopping_lists
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shopping_lists is 'A shopping list, built from recipes or typed by hand.';

create index shopping_lists_user_idx on public.shopping_lists (user_id, created_at desc);

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  -- Where the item came from, so removing a recipe can remove its ingredients.
  recipe_id uuid references public.ai_recipes (id) on delete set null,

  name text not null check (char_length(name) between 1 and 120),
  quantity text check (char_length(quantity) <= 40),
  aisle public.grocery_aisle not null default 'overig',
  is_checked boolean not null default false,
  order_index integer not null default 0 check (order_index >= 0),

  -- Prices are typed in by the user. There is no open price API for Dutch
  -- supermarkets, so the app never invents a price and never scrapes one.
  price_cents integer check (price_cents is null or price_cents between 0 and 1000000),

  created_at timestamptz not null default now()
);

comment on column public.shopping_list_items.price_cents is 'Typed in by the user; the app never guesses a price.';

create index shopping_list_items_list_idx
  on public.shopping_list_items (list_id, aisle, order_index);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.ai_recipes enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- Everyone signed in may read the shared cache; your own private ones are
-- yours alone.
create policy "Users can read public recipes and their own"
  on public.ai_recipes for select to authenticated
  using (is_public or created_by = (select auth.uid()));

create policy "Users can create their own recipes"
  on public.ai_recipes for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Users can update their own recipes"
  on public.ai_recipes for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Users can delete their own recipes"
  on public.ai_recipes for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "Users can read their own lists"
  on public.shopping_lists for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own lists"
  on public.shopping_lists for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own lists"
  on public.shopping_lists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own lists"
  on public.shopping_lists for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Items ask the parent list, the same way set_logs asks its session.
create policy "Users can read items of their own lists"
  on public.shopping_list_items for select to authenticated
  using (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ));

create policy "Users can add items to their own lists"
  on public.shopping_list_items for insert to authenticated
  with check (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ));

create policy "Users can update items of their own lists"
  on public.shopping_list_items for update to authenticated
  using (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ));

create policy "Users can delete items of their own lists"
  on public.shopping_list_items for delete to authenticated
  using (exists (
    select 1 from public.shopping_lists l
    where l.id = list_id and l.user_id = (select auth.uid())
  ));
