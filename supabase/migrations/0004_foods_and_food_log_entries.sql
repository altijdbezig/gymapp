-- Phase 2: the food cache and the food diary.
--
-- Two tables with deliberately different sharing rules:
--   foods            a cache. Open Food Facts rows are shared by everyone,
--                    your own products are yours alone.
--   food_log_entries strictly private, and it copies the macros it needs so an
--                    entry from March still reads correctly in December.

create type public.food_source as enum ('off', 'custom');

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- ---------------------------------------------------------------------------
-- foods
-- ---------------------------------------------------------------------------
-- Macros are always per 100 g. That is how Open Food Facts publishes them and
-- it is the only way to compare two products, so nothing in the app ever
-- stores "per serving" as the base unit.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source public.food_source not null,

  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),

  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g >= 0 and kcal_per_100g <= 1000),
  protein_per_100g numeric(6, 2) not null check (protein_per_100g >= 0 and protein_per_100g <= 100),
  fat_per_100g numeric(6, 2) not null check (fat_per_100g >= 0 and fat_per_100g <= 100),
  carbs_per_100g numeric(6, 2) not null check (carbs_per_100g >= 0 and carbs_per_100g <= 100),

  -- Optional: "1 portie = 30 g", so the user can log a portion without weighing.
  serving_size_g numeric(6, 2) check (serving_size_g > 0 and serving_size_g <= 2000),

  -- true for the shared Open Food Facts cache, false for a personal product.
  is_public boolean not null default false,
  -- Set for your own products, null for cached Open Food Facts rows.
  created_by uuid references auth.users (id) on delete cascade,

  created_at timestamptz not null default now(),

  -- The two kinds of row have exactly one shape each. Without this a client
  -- could insert a "custom" row marked public and pollute the shared cache.
  constraint foods_source_shape check (
    (source = 'off' and barcode is not null and is_public and created_by is null)
    or
    (source = 'custom' and not is_public and created_by is not null)
  ),

  -- 100 g of anything cannot contain more than 100 g of macros.
  constraint foods_macros_fit_in_100g check (protein_per_100g + fat_per_100g + carbs_per_100g <= 100)
);

comment on table public.foods is 'Product cache: shared Open Food Facts rows plus private custom products.';

-- One cached row per barcode, which is what makes "cache it once" work: the
-- app upserts on this and a second scan of the same product hits the cache.
-- Partial, so two people can still each have a custom product without a barcode.
create unique index foods_off_barcode_key on public.foods (barcode) where source = 'off';

create index foods_created_by_idx on public.foods (created_by) where created_by is not null;

-- Searching your own products by name, case-insensitively.
create index foods_custom_name_idx on public.foods (lower(name)) where source = 'custom';

-- ---------------------------------------------------------------------------
-- food_log_entries
-- ---------------------------------------------------------------------------
-- The macros are copied in at log time instead of joined from foods. Three
-- reasons: Open Food Facts corrects its data (your history should not silently
-- change), you can edit your own product without rewriting the past, and
-- deleting a product must not delete what you ate.
create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Kept for "log this again", but nullable and ON DELETE SET NULL: the entry
  -- survives the product being removed, because it carries its own copy.
  food_id uuid references public.foods (id) on delete set null,

  logged_on date not null default current_date,
  meal_type public.meal_type not null,
  amount_g numeric(7, 2) not null check (amount_g > 0 and amount_g <= 10000),

  -- The snapshot. Name and brand too, otherwise a deleted product leaves an
  -- entry the user cannot recognise.
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g >= 0),
  protein_per_100g numeric(6, 2) not null check (protein_per_100g >= 0),
  fat_per_100g numeric(6, 2) not null check (fat_per_100g >= 0),
  carbs_per_100g numeric(6, 2) not null check (carbs_per_100g >= 0),

  -- Generated columns: Postgres computes and stores these on every write, so
  -- the totals can never drift out of step with the amount. They are read-only
  -- to the client, which is exactly what we want.
  kcal numeric(9, 2) generated always as (kcal_per_100g * amount_g / 100) stored,
  protein_g numeric(8, 2) generated always as (protein_per_100g * amount_g / 100) stored,
  fat_g numeric(8, 2) generated always as (fat_per_100g * amount_g / 100) stored,
  carbs_g numeric(8, 2) generated always as (carbs_per_100g * amount_g / 100) stored,

  created_at timestamptz not null default now()
);

comment on table public.food_log_entries is 'What you ate. Macros are copied in at log time, never joined.';

-- The one query the day overview makes: everything I ate on this date.
create index food_log_entries_user_date_idx
  on public.food_log_entries (user_id, logged_on desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.foods enable row level security;
alter table public.food_log_entries enable row level security;

-- foods: read the shared cache plus your own products.
create policy "Users can read public foods and their own"
  on public.foods for select to authenticated
  using (is_public or created_by = (select auth.uid()));

-- Inserting is how the cache gets filled, so any signed-in user may add an
-- Open Food Facts row -- but only in the exact shape foods_source_shape allows,
-- and only attributed to nobody. A custom product must carry your own id.
create policy "Users can cache OFF foods and create their own"
  on public.foods for insert to authenticated
  with check (
    (source = 'off' and is_public and created_by is null)
    or
    (source = 'custom' and created_by = (select auth.uid()))
  );

-- No update or delete policy for source = 'off': a cached row is written once
-- and never touched again, so one user cannot rewrite a product for everyone.
create policy "Users can update their own foods"
  on public.foods for update to authenticated
  using (source = 'custom' and created_by = (select auth.uid()))
  with check (source = 'custom' and created_by = (select auth.uid()));

create policy "Users can delete their own foods"
  on public.foods for delete to authenticated
  using (source = 'custom' and created_by = (select auth.uid()));

-- food_log_entries: yours and nobody else's, all four actions.
create policy "Users can read their own log entries"
  on public.food_log_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own log entries"
  on public.food_log_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own log entries"
  on public.food_log_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own log entries"
  on public.food_log_entries for delete to authenticated
  using ((select auth.uid()) = user_id);
