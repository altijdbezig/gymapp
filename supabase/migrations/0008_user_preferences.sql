-- Phases 5 and 9: everything the user can set.
--
-- All of it goes on profiles rather than into a settings table: there is
-- exactly one row per user already, the RLS policies for it already exist, and
-- a preference is nothing more than a column on that row.
--
-- Reminders are per kind, so turning the evening one off does not silence the
-- rest timer. Every one of them defaults to off: an app that starts sending
-- notifications before you asked it to is an app people turn off entirely.

create type public.unit_weight as enum ('kg', 'lb');
create type public.unit_length as enum ('cm', 'in');
create type public.theme_preference as enum ('system', 'light', 'dark');

alter table public.profiles
  -- Reminders (phase 5)
  add column notify_evening boolean not null default false,
  -- The time the evening summary is sent. Local time on the device; the
  -- scheduling happens there, so no timezone is stored.
  add column evening_time time not null default '20:00',
  add column notify_log_reminder boolean not null default false,
  add column notify_training_day boolean not null default false,
  add column notify_rest_timer boolean not null default true,
  add column notify_comeback boolean not null default false,
  add column notify_medication boolean not null default false,

  -- Units and appearance (phase 9)
  add column unit_weight public.unit_weight not null default 'kg',
  add column unit_length public.unit_length not null default 'cm',
  add column theme public.theme_preference not null default 'system',

  -- Manually overridden targets (phase 9). Null means "use the calculation".
  -- The safety rules still apply on top of these: the app clamps a manual
  -- target to the BMR and never lets the deficit exceed 500 kcal, exactly as
  -- it does for a calculated one.
  add column manual_kcal integer check (manual_kcal is null or manual_kcal between 800 and 10000),
  add column manual_protein_g integer check (manual_protein_g is null or manual_protein_g between 0 and 500),
  add column manual_fat_g integer check (manual_fat_g is null or manual_fat_g between 0 and 500),
  add column manual_carbs_g integer check (manual_carbs_g is null or manual_carbs_g between 0 and 1000);

comment on column public.profiles.evening_time is 'Local time for the evening summary; scheduled on the device.';
comment on column public.profiles.manual_kcal is 'Overrides the calculation, but never the safety rules.';
