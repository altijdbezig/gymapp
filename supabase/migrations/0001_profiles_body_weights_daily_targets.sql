-- Phase 1: the three tables behind auth, onboarding and daily targets.
--
-- Every table has RLS enabled and every policy is scoped to auth.uid(), so a
-- user can only ever touch their own rows. The publishable key in the app is
-- safe precisely because these policies do the gatekeeping.

-- Enums instead of free text: the database rejects a typo, and the generated
-- TypeScript types become real unions ('cut' | 'maintenance' | 'bulk') instead
-- of a plain string.
create type public.sex as enum ('male', 'female');

-- The five Mifflin-St Jeor activity factors: 1.2 / 1.375 / 1.55 / 1.725 / 1.9.
create type public.activity_level as enum (
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active'
);

create type public.goal as enum ('cut', 'maintenance', 'bulk');

-- ---------------------------------------------------------------------------
-- profiles: one row per user, holding everything the calorie maths needs.
-- ---------------------------------------------------------------------------
-- user_id is both the primary key and the foreign key to auth.users. That
-- guarantees exactly one profile per account without a second unique index,
-- and "on delete cascade" cleans up if the account is ever removed.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  birth_date date check (birth_date > '1900-01-01' and birth_date < current_date),
  sex public.sex,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  activity_level public.activity_level,
  goal public.goal,
  -- Flipped once onboarding is finished, so the app knows where to route.
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Per-user settings that feed the daily target calculation.';

-- ---------------------------------------------------------------------------
-- body_weights: a weight history, one entry per day at most.
-- ---------------------------------------------------------------------------
create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  -- Weighing yourself twice on one day overwrites, it does not stack up.
  unique (user_id, measured_on)
);

comment on table public.body_weights is 'Weight log; the newest entry drives the targets.';

-- Fetching "my latest weight" is the most common query, so index for it.
create index body_weights_user_measured_on_idx
  on public.body_weights (user_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- daily_targets: a frozen snapshot of the targets for one calendar day.
-- ---------------------------------------------------------------------------
-- Targets are stored, not recomputed, because your weight and goal change over
-- time. Looking back at a day in March should show the targets that applied in
-- March. The inputs are copied along so an old row still explains itself.
create table public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,

  -- The result of the calculation.
  kcal integer not null check (kcal > 0),
  protein_g integer not null check (protein_g >= 0),
  fat_g integer not null check (fat_g >= 0),
  -- Safety rule 3: carbohydrates can never go negative.
  carbs_g integer not null check (carbs_g >= 0),

  -- The inputs, snapshotted.
  bmr_kcal integer not null check (bmr_kcal > 0),
  tdee_kcal integer not null check (tdee_kcal > 0),
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  goal public.goal not null,
  activity_level public.activity_level not null,
  -- Safety rule 2: true when the target was raised back up to the BMR.
  clamped_to_bmr boolean not null default false,

  created_at timestamptz not null default now(),
  unique (user_id, date),

  -- Safety rules 1 and 2 enforced by the database as well as by the code:
  -- never more than 500 kcal below maintenance, and never below the BMR.
  constraint daily_targets_deficit_max_500 check (kcal >= tdee_kcal - 500),
  constraint daily_targets_never_below_bmr check (kcal >= bmr_kcal)
);

comment on table public.daily_targets is 'Immutable-ish snapshot of the targets for one day.';

create index daily_targets_user_date_idx on public.daily_targets (user_id, date desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
-- search_path is pinned so the function cannot be hijacked by a rogue schema.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Without policies, RLS denies everything. One policy per action keeps it
-- readable and makes it obvious that nothing is writable by someone else.
alter table public.profiles enable row level security;
alter table public.body_weights enable row level security;
alter table public.daily_targets enable row level security;

-- (select auth.uid()) is wrapped in a subselect so Postgres evaluates it once
-- per query instead of once per row.
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own weights"
  on public.body_weights for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own weights"
  on public.body_weights for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own weights"
  on public.body_weights for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own weights"
  on public.body_weights for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own targets"
  on public.daily_targets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own targets"
  on public.daily_targets for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own targets"
  on public.daily_targets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own targets"
  on public.daily_targets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- New signups get an empty profile row automatically.
-- ---------------------------------------------------------------------------
-- security definer is required here: the trigger runs as the auth system,
-- before the new user can authenticate, so it must bypass RLS to insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
