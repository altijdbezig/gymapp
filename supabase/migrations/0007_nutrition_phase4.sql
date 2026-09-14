-- Phase 4: the rest of food logging.
--
-- Favourites, portions in something other than grams, your own meals and
-- recipes, water, and the micronutrients Open Food Facts already gives us.
--
-- Two things deliberately need no schema at all:
--   - "snelle invoer" (only kcal and protein, no product) is an ordinary
--     food_log_entries row with food_id null, amount_g 100 and the typed
--     numbers as the per-100 g values;
--   - "kopieer van gisteren" is a handful of inserts, not a table.

-- ---------------------------------------------------------------------------
-- Micronutrients
-- ---------------------------------------------------------------------------
-- Open Food Facts publishes these for most products. They are nullable because
-- plenty of products are missing them, and a zero would be a lie: "no fibre
-- recorded" is not the same as "no fibre".
alter table public.foods
  add column fiber_per_100g numeric(6, 2) check (fiber_per_100g >= 0 and fiber_per_100g <= 100),
  add column sugars_per_100g numeric(6, 2) check (sugars_per_100g >= 0 and sugars_per_100g <= 100),
  add column saturated_fat_per_100g numeric(6, 2)
    check (saturated_fat_per_100g >= 0 and saturated_fat_per_100g <= 100),
  -- Salt in grams, which is how a Dutch label prints it. Sodium x 2.5 = salt.
  add column salt_per_100g numeric(6, 3) check (salt_per_100g >= 0 and salt_per_100g <= 100);

alter table public.food_log_entries
  add column fiber_per_100g numeric(6, 2) check (fiber_per_100g >= 0),
  add column sugars_per_100g numeric(6, 2) check (sugars_per_100g >= 0),
  add column saturated_fat_per_100g numeric(6, 2) check (saturated_fat_per_100g >= 0),
  add column salt_per_100g numeric(6, 3) check (salt_per_100g >= 0);

-- Same trick as the macros: Postgres works the totals out, so they can never
-- drift out of step with amount_g.
alter table public.food_log_entries
  add column fiber_g numeric(8, 2) generated always as (fiber_per_100g * amount_g / 100) stored,
  add column sugars_g numeric(8, 2) generated always as (sugars_per_100g * amount_g / 100) stored,
  add column saturated_fat_g numeric(8, 2)
    generated always as (saturated_fat_per_100g * amount_g / 100) stored,
  add column salt_g numeric(8, 3) generated always as (salt_per_100g * amount_g / 100) stored;

-- The portion this entry was logged in ("2 plakjes"), purely so the diary can
-- show it back the way you typed it. The grams stay the source of truth.
alter table public.food_log_entries
  add column portion_label text check (char_length(portion_label) <= 40),
  add column portion_count numeric(7, 2) check (portion_count > 0 and portion_count <= 1000);

-- ---------------------------------------------------------------------------
-- profiles: the water goal
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column water_goal_ml integer not null default 2000
    check (water_goal_ml >= 0 and water_goal_ml <= 10000);

-- ---------------------------------------------------------------------------
-- food_favorites
-- ---------------------------------------------------------------------------
-- A separate table rather than a flag on foods, because foods holds the shared
-- Open Food Facts cache: a flag there would be everyone's favourite at once.
create table public.food_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, food_id)
);

comment on table public.food_favorites is 'The products you starred, per user.';

create index food_favorites_user_idx on public.food_favorites (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- food_portions
-- ---------------------------------------------------------------------------
-- "1 plakje = 20 g". Per user, not shared: one person's slice of bread is
-- another person's half slice, and a shared row would let anyone rewrite the
-- portion size for everybody.
create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  grams numeric(7, 2) not null check (grams > 0 and grams <= 5000),
  -- The portion the amount screen opens on for this product.
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, food_id, label)
);

comment on table public.food_portions is 'Per-user units for a product: stuks, plakjes, ml, eetlepel.';

create index food_portions_user_food_idx on public.food_portions (user_id, food_id);

-- ---------------------------------------------------------------------------
-- meals  (your own meals and your own recipes)
-- ---------------------------------------------------------------------------
-- One table for both, because they are the same thing with one difference:
--   'meal'   logs its items as separate diary entries, so you can still edit
--            or remove one of them afterwards;
--   'recipe' has a number of servings and logs as a single entry of one
--            serving, with the macros divided.
create type public.meal_kind as enum ('meal', 'recipe');

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.meal_kind not null default 'meal',
  name text not null check (char_length(name) between 1 and 80),
  notes text check (char_length(notes) <= 2000),
  -- Always 1 for a meal; a recipe divides its total by this.
  servings numeric(5, 2) not null default 1 check (servings > 0 and servings <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meals is 'Saved combinations of products: a meal or a recipe.';

create index meals_user_idx on public.meals (user_id, kind, created_at desc);

create trigger meals_set_updated_at
  before update on public.meals
  for each row execute function public.set_updated_at();

-- The items carry their own copy of the macros, exactly like food_log_entries:
-- Open Food Facts corrects its data, and your saved recipe should not change
-- underneath you when it does.
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,

  order_index integer not null default 0 check (order_index >= 0),
  amount_g numeric(7, 2) not null check (amount_g > 0 and amount_g <= 10000),

  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g >= 0),
  protein_per_100g numeric(6, 2) not null check (protein_per_100g >= 0),
  fat_per_100g numeric(6, 2) not null check (fat_per_100g >= 0),
  carbs_per_100g numeric(6, 2) not null check (carbs_per_100g >= 0),
  fiber_per_100g numeric(6, 2) check (fiber_per_100g >= 0),
  sugars_per_100g numeric(6, 2) check (sugars_per_100g >= 0),
  saturated_fat_per_100g numeric(6, 2) check (saturated_fat_per_100g >= 0),
  salt_per_100g numeric(6, 3) check (salt_per_100g >= 0),

  created_at timestamptz not null default now()
);

comment on table public.meal_items is 'The products inside a meal or recipe, with their macros copied in.';

create index meal_items_meal_idx on public.meal_items (meal_id, order_index);

-- ---------------------------------------------------------------------------
-- water_entries
-- ---------------------------------------------------------------------------
-- One row per glass rather than a running total per day, so tapping the wrong
-- button once is undone by removing that row instead of doing sums by hand.
create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  ml integer not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now()
);

comment on table public.water_entries is 'Water, one entry per glass or bottle.';

create index water_entries_user_date_idx on public.water_entries (user_id, logged_on desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.food_favorites enable row level security;
alter table public.food_portions enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.water_entries enable row level security;

create policy "Users can read their own favorites"
  on public.food_favorites for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own favorites"
  on public.food_favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own favorites"
  on public.food_favorites for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own favorites"
  on public.food_favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own portions"
  on public.food_portions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own portions"
  on public.food_portions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own portions"
  on public.food_portions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own portions"
  on public.food_portions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own meals"
  on public.meals for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own meals"
  on public.meals for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own meals"
  on public.meals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own meals"
  on public.meals for delete to authenticated
  using ((select auth.uid()) = user_id);

-- meal_items has no user_id of its own, so it asks the parent meal.
create policy "Users can read items of their own meals"
  on public.meal_items for select to authenticated
  using (exists (
    select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
  ));

create policy "Users can add items to their own meals"
  on public.meal_items for insert to authenticated
  with check (exists (
    select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
  ));

create policy "Users can update items of their own meals"
  on public.meal_items for update to authenticated
  using (exists (
    select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
  ));

create policy "Users can delete items of their own meals"
  on public.meal_items for delete to authenticated
  using (exists (
    select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())
  ));

create policy "Users can read their own water entries"
  on public.water_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own water entries"
  on public.water_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own water entries"
  on public.water_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own water entries"
  on public.water_entries for delete to authenticated
  using ((select auth.uid()) = user_id);
