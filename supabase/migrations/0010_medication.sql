-- Phase 8: medication and supplements.
--
-- Reminders only. This app does not give medical advice, does not check for
-- interactions and does not know what anything is for. It knows a name, a dose
-- you typed yourself, and the times you asked to be reminded.
--
-- Health data is special-category personal data under the GDPR, so these two
-- tables are treated more strictly than the rest of the schema:
--
--   - both carry user_id directly and every policy is a plain
--     auth.uid() = user_id, rather than reaching through a parent. One less
--     join is one less way to get a policy wrong;
--   - nothing here is ever public, shared or aggregated. There is no is_public
--     column and no cross-user read anywhere;
--   - the app never shows this data outside its own screens -- not on the
--     dashboard, not in the statistics.

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null check (char_length(name) between 1 and 120),
  -- Free text on purpose. "1 tablet", "2 pufjes", "5 ml", "halve dosis" -- a
  -- structured amount-and-unit would force people to translate what is on
  -- their own box, and get it wrong.
  dose text check (char_length(dose) <= 80),

  -- The times of day you want reminding, as local times.
  times time[] not null default '{}' check (array_length(times, 1) is null or array_length(times, 1) <= 12),
  -- ISO weekdays, 1 = Monday. Empty means every day.
  weekdays smallint[] not null default '{}',

  -- Optional stock, so "nog 4 over" can be shown. Not a prescription count and
  -- not checked against anything.
  stock_count numeric(7, 2) check (stock_count is null or stock_count >= 0),
  stock_unit text check (char_length(stock_unit) <= 20),

  notes text check (char_length(notes) <= 1000),
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.medications is 'Reminders the user set for themselves. Not advice, not a prescription.';

create index medications_user_idx on public.medications (user_id, is_active);

create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- medication_intakes
-- ---------------------------------------------------------------------------
-- One row per dose actually ticked off. A dose you did not tick has no row --
-- absence is not evidence of anything, and the app never asks why.
create table public.medication_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,

  taken_on date not null default current_date,
  -- Which scheduled time this was, so two doses on one day stay apart.
  scheduled_time time not null,
  taken_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  -- Ticking the same dose twice corrects it rather than stacking up.
  unique (medication_id, taken_on, scheduled_time)
);

comment on table public.medication_intakes is 'Ticked-off doses. Only ever read by the user themselves.';

create index medication_intakes_user_date_idx
  on public.medication_intakes (user_id, taken_on desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.medications enable row level security;
alter table public.medication_intakes enable row level security;

create policy "Users can read their own medications"
  on public.medications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own medications"
  on public.medications for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own medications"
  on public.medications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own medications"
  on public.medications for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own intakes"
  on public.medication_intakes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own intakes"
  on public.medication_intakes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own intakes"
  on public.medication_intakes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own intakes"
  on public.medication_intakes for delete to authenticated
  using ((select auth.uid()) = user_id);
