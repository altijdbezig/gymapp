-- Phase 3: training.
--
-- Nine tables that together describe "what you plan to do" (exercises,
-- routines, folders, a week schedule) and "what you actually did" (sessions,
-- set logs, personal records).
--
-- The split matters: editing a routine tomorrow must not rewrite the workout
-- you did today, so a session keeps its own set_logs instead of pointing back
-- at the routine's target sets.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- What you hold. Drives the filter in the exercise picker and, for 'barbell',
-- whether the plate calculator is offered at all.
create type public.exercise_category as enum (
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'cardio',
  'other'
);

-- Kept finer-grained than "chest / back / legs" because phase 6 wants weekly
-- volume per muscle group, and "legs" would hide that you never train hamstrings.
create type public.muscle_group as enum (
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
  'lower_back',
  'neck',
  'full_body',
  'cardio'
);

-- A warm-up set is logged like any other set but must not count towards volume
-- or a personal record -- hence a type rather than a boolean.
create type public.set_type as enum ('normal', 'warmup', 'drop', 'failure');

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------
-- Same two-shapes trick as public.foods: the seeded library is shared and
-- read-only, a custom exercise belongs to exactly one user.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),

  -- Dutch name, because all UI copy is Dutch.
  name text not null check (char_length(name) between 1 and 120),
  -- English (or alternative Dutch) search terms: somebody typing "bench press"
  -- should still find "Bankdrukken".
  aliases text[] not null default '{}',

  primary_muscle public.muscle_group not null,
  secondary_muscles public.muscle_group[] not null default '{}',
  category public.exercise_category not null,
  instructions text check (char_length(instructions) <= 2000),

  is_custom boolean not null default false,
  created_by uuid references auth.users (id) on delete cascade,

  created_at timestamptz not null default now(),

  constraint exercises_custom_shape check (
    (not is_custom and created_by is null)
    or
    (is_custom and created_by is not null)
  )
);

comment on table public.exercises is 'Shared exercise library plus per-user custom exercises.';

-- The seeded library may not contain the same name twice. Partial, so two
-- users can each invent their own "Kabelcurl variant".
create unique index exercises_standard_name_key
  on public.exercises (lower(name)) where not is_custom;

create index exercises_created_by_idx
  on public.exercises (created_by) where created_by is not null;

create index exercises_primary_muscle_idx on public.exercises (primary_muscle);

-- ---------------------------------------------------------------------------
-- routine_folders
-- ---------------------------------------------------------------------------
create table public.routine_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now()
);

comment on table public.routine_folders is 'Optional grouping for routines, e.g. "Push/Pull/Legs".';

create index routine_folders_user_idx on public.routine_folders (user_id, order_index);

-- ---------------------------------------------------------------------------
-- workout_plans  (a "routine" in the UI)
-- ---------------------------------------------------------------------------
-- on delete set null for the folder: throwing away a folder must never throw
-- away the routines inside it.
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.routine_folders (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  notes text check (char_length(notes) <= 2000),
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workout_plans is 'A routine: one or more workout days that belong together.';

create index workout_plans_user_idx on public.workout_plans (user_id, order_index);
create index workout_plans_folder_idx on public.workout_plans (folder_id) where folder_id is not null;

create trigger workout_plans_set_updated_at
  before update on public.workout_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workout_days
-- ---------------------------------------------------------------------------
-- One trainable day inside a routine ("Push", "Pull", "Benen"). A routine with
-- a single day is perfectly normal.
create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now()
);

comment on table public.workout_days is 'One day inside a routine; what you actually start.';

create index workout_days_plan_idx on public.workout_days (plan_id, order_index);

-- ---------------------------------------------------------------------------
-- workout_day_exercises
-- ---------------------------------------------------------------------------
-- on delete restrict on exercise_id: a seeded exercise is never deleted, and a
-- custom one may not vanish from under a routine that uses it.
create table public.workout_day_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,

  order_index integer not null default 0 check (order_index >= 0),
  target_sets smallint not null default 3 check (target_sets between 1 and 20),
  -- A rep range ("8 tot 12"), both halves optional.
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  rest_seconds smallint not null default 90 check (rest_seconds between 0 and 900),
  -- Exercises sharing a number inside one day are a superset. 1-26 so the UI
  -- can label them A, B, C without running out.
  superset_group smallint check (superset_group between 1 and 26),
  note text check (char_length(note) <= 500),

  created_at timestamptz not null default now(),

  constraint workout_day_exercises_rep_range check (
    rep_min is null or rep_max is null or rep_min <= rep_max
  )
);

comment on table public.workout_day_exercises is 'The planned exercises of one workout day, in order.';

create index workout_day_exercises_day_idx
  on public.workout_day_exercises (workout_day_id, order_index);

-- ---------------------------------------------------------------------------
-- week_schedule
-- ---------------------------------------------------------------------------
-- One row per weekday you have decided about. A row with workout_day_id null
-- is an explicit rest day; no row at all means "not planned".
-- weekday follows ISO 8601: 1 = Monday ... 7 = Sunday, which is what
-- Postgres's isodow gives and what a Dutch week looks like.
create table public.week_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  workout_day_id uuid references public.workout_days (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, weekday)
);

comment on table public.week_schedule is 'Which workout day belongs to which weekday; null = rest day.';

-- ---------------------------------------------------------------------------
-- workout_sessions
-- ---------------------------------------------------------------------------
-- workout_day_id is nullable and ON DELETE SET NULL, so an empty workout is
-- just a session without a plan, and deleting a routine keeps your history.
-- The name is copied in for the same reason the food log copies its macros.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_day_id uuid references public.workout_days (id) on delete set null,

  name text not null check (char_length(name) between 1 and 80),
  -- The calendar day the session belongs to, in the user's own timezone. All
  -- streak and "days since last workout" maths reads this, never started_at.
  performed_on date not null default current_date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Stored rather than derived: the timer keeps running while the app sleeps,
  -- and a session finished offline gets its duration from the device.
  duration_seconds integer check (duration_seconds >= 0 and duration_seconds <= 86400),
  notes text check (char_length(notes) <= 2000),
  is_comeback boolean not null default false,

  created_at timestamptz not null default now(),

  constraint workout_sessions_ends_after_start check (ended_at is null or ended_at >= started_at)
);

comment on table public.workout_sessions is 'One training session, finished or still running.';

create index workout_sessions_user_performed_idx
  on public.workout_sessions (user_id, performed_on desc);

-- ---------------------------------------------------------------------------
-- set_logs
-- ---------------------------------------------------------------------------
-- reps and weight are nullable because a cardio set has neither, and an
-- unfinished set has nothing yet.
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,

  -- Position of the exercise within the session. Part of the unique key, so
  -- the same exercise can legitimately appear twice in one workout.
  exercise_order smallint not null default 0 check (exercise_order >= 0),
  set_index smallint not null check (set_index between 1 and 50),

  set_type public.set_type not null default 'normal',
  reps smallint check (reps between 0 and 1000),
  weight_kg numeric(6, 2) check (weight_kg >= 0 and weight_kg <= 1000),
  rpe numeric(3, 1) check (rpe >= 1 and rpe <= 10),
  is_completed boolean not null default false,

  -- Cardio.
  duration_seconds integer check (duration_seconds >= 0 and duration_seconds <= 86400),
  distance_m numeric(8, 2) check (distance_m >= 0 and distance_m <= 1000000),

  superset_group smallint check (superset_group between 1 and 26),

  created_at timestamptz not null default now(),

  unique (session_id, exercise_order, set_index)
);

comment on table public.set_logs is 'Every set of every session. Warm-ups included, but they never score.';

create index set_logs_session_idx on public.set_logs (session_id, exercise_order, set_index);
-- "Show me this exercise over time", the query behind previous performance and
-- the phase 6 charts.
create index set_logs_exercise_idx on public.set_logs (exercise_id);

-- ---------------------------------------------------------------------------
-- personal_records
-- ---------------------------------------------------------------------------
-- One row per user per exercise, holding the three records Hevy shows. It is a
-- cache of what set_logs already proves, kept because recomputing every record
-- on every screen would mean reading a user's whole history.
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,

  -- Heaviest completed set, with the reps that went with it.
  best_weight_kg numeric(6, 2) check (best_weight_kg >= 0),
  best_weight_reps smallint check (best_weight_reps >= 1),
  best_weight_on date,

  -- Best estimated one-rep max (Epley).
  best_1rm_kg numeric(7, 2) check (best_1rm_kg >= 0),
  best_1rm_on date,

  -- Most volume (sum of reps x weight) for this exercise in a single session.
  best_volume_kg numeric(9, 2) check (best_volume_kg >= 0),
  best_volume_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, exercise_id)
);

comment on table public.personal_records is 'Cached bests per exercise; recomputable from set_logs.';

create index personal_records_user_idx on public.personal_records (user_id);

create trigger personal_records_set_updated_at
  before update on public.personal_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.routine_folders enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_day_exercises enable row level security;
alter table public.week_schedule enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.personal_records enable row level security;

-- exercises: the shared library is readable by everyone signed in; your own
-- custom exercises only by you. There is deliberately no update or delete
-- policy for the library, so nobody can rewrite it for everyone else.
create policy "Users can read the library and their own exercises"
  on public.exercises for select to authenticated
  using (not is_custom or created_by = (select auth.uid()));

create policy "Users can create their own exercises"
  on public.exercises for insert to authenticated
  with check (is_custom and created_by = (select auth.uid()));

create policy "Users can update their own exercises"
  on public.exercises for update to authenticated
  using (is_custom and created_by = (select auth.uid()))
  with check (is_custom and created_by = (select auth.uid()));

create policy "Users can delete their own exercises"
  on public.exercises for delete to authenticated
  using (is_custom and created_by = (select auth.uid()));

-- routine_folders
create policy "Users can read their own folders"
  on public.routine_folders for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own folders"
  on public.routine_folders for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own folders"
  on public.routine_folders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own folders"
  on public.routine_folders for delete to authenticated
  using ((select auth.uid()) = user_id);

-- workout_plans
create policy "Users can read their own plans"
  on public.workout_plans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own plans"
  on public.workout_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own plans"
  on public.workout_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own plans"
  on public.workout_plans for delete to authenticated
  using ((select auth.uid()) = user_id);

-- workout_days: no user_id of its own, so every policy asks the parent plan.
create policy "Users can read days of their own plans"
  on public.workout_days for select to authenticated
  using (exists (
    select 1 from public.workout_plans p
    where p.id = plan_id and p.user_id = (select auth.uid())
  ));

create policy "Users can create days in their own plans"
  on public.workout_days for insert to authenticated
  with check (exists (
    select 1 from public.workout_plans p
    where p.id = plan_id and p.user_id = (select auth.uid())
  ));

create policy "Users can update days of their own plans"
  on public.workout_days for update to authenticated
  using (exists (
    select 1 from public.workout_plans p
    where p.id = plan_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_plans p
    where p.id = plan_id and p.user_id = (select auth.uid())
  ));

create policy "Users can delete days of their own plans"
  on public.workout_days for delete to authenticated
  using (exists (
    select 1 from public.workout_plans p
    where p.id = plan_id and p.user_id = (select auth.uid())
  ));

-- workout_day_exercises: two levels up to the plan.
create policy "Users can read exercises of their own days"
  on public.workout_day_exercises for select to authenticated
  using (exists (
    select 1 from public.workout_days d
    join public.workout_plans p on p.id = d.plan_id
    where d.id = workout_day_id and p.user_id = (select auth.uid())
  ));

create policy "Users can add exercises to their own days"
  on public.workout_day_exercises for insert to authenticated
  with check (exists (
    select 1 from public.workout_days d
    join public.workout_plans p on p.id = d.plan_id
    where d.id = workout_day_id and p.user_id = (select auth.uid())
  ));

create policy "Users can update exercises of their own days"
  on public.workout_day_exercises for update to authenticated
  using (exists (
    select 1 from public.workout_days d
    join public.workout_plans p on p.id = d.plan_id
    where d.id = workout_day_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_days d
    join public.workout_plans p on p.id = d.plan_id
    where d.id = workout_day_id and p.user_id = (select auth.uid())
  ));

create policy "Users can delete exercises of their own days"
  on public.workout_day_exercises for delete to authenticated
  using (exists (
    select 1 from public.workout_days d
    join public.workout_plans p on p.id = d.plan_id
    where d.id = workout_day_id and p.user_id = (select auth.uid())
  ));

-- week_schedule
create policy "Users can read their own week schedule"
  on public.week_schedule for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own week schedule"
  on public.week_schedule for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own week schedule"
  on public.week_schedule for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own week schedule"
  on public.week_schedule for delete to authenticated
  using ((select auth.uid()) = user_id);

-- workout_sessions
create policy "Users can read their own sessions"
  on public.workout_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own sessions"
  on public.workout_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own sessions"
  on public.workout_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own sessions"
  on public.workout_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- set_logs: via the session.
create policy "Users can read sets of their own sessions"
  on public.set_logs for select to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

create policy "Users can create sets in their own sessions"
  on public.set_logs for insert to authenticated
  with check (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

create policy "Users can update sets of their own sessions"
  on public.set_logs for update to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

create policy "Users can delete sets of their own sessions"
  on public.set_logs for delete to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

-- personal_records
create policy "Users can read their own records"
  on public.personal_records for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own records"
  on public.personal_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own records"
  on public.personal_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own records"
  on public.personal_records for delete to authenticated
  using ((select auth.uid()) = user_id);
