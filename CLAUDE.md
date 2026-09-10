@AGENTS.md

# GymApp

Free gym + nutrition app. One Expo codebase for iOS (tested with Expo Go on an
iPhone 16e) and web (deployed to Vercel).

Owner: Benjamin, first-year Software Developer student (JS, React, some Supabase).
Explain choices briefly so they teach something.

## Conventions

- **UI copy is Dutch. Code, variable names, comments and commit messages are English.**
- Styling with `StyleSheet` only — no UI library. All colours/spacing/type come
  from `src/theme/theme.ts`; components never hardcode values.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
- Every table has RLS enabled. Run the Supabase security advisor after every migration.
- Never put the service role key in the app. Only `EXPO_PUBLIC_*` in `.env`.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Routing | Expo Router (file based, typed routes on) |
| Language | TypeScript, `strict: true` |
| Backend | Supabase (Auth + Postgres, RLS everywhere) |
| Server state | @tanstack/react-query |
| Tests | jest-expo + @testing-library/react-native |
| Native extras | expo-notifications (local), expo-camera (barcode, native only) |

Barcode scanning is native-only. On web, use search + manual entry behind a
`Platform.OS` check.

## Project layout

```
app/                      Expo Router routes
  _layout.tsx             QueryClientProvider + SafeAreaProvider + Stack
  (tabs)/                 index (Vandaag), food, training, settings
src/config/app.ts         app name, version, Open Food Facts contact URL
src/lib/env.ts            reads + validates EXPO_PUBLIC_* variables
src/lib/supabase.ts       the one shared Supabase client
src/lib/openFoodFacts.ts  (phase 2) OFF API wrapper with throttling
src/features/             nutrition | training | notifications
src/components/           Screen, Text, Card, Button (Input, ProgressRing later)
src/theme/theme.ts        design tokens
src/types/database.ts     generated from Supabase — do not edit by hand
supabase/migrations/      SQL migrations, applied via the Supabase MCP tools
```

Renaming the app touches three files: `src/config/app.ts`, `app.json`, `package.json`.

## Supabase

- Project **gymapp** — ref `qvwiwpqtrqhzovkzjjpw`, region eu-central-1.
- Org `Alt` is on the free plan (max 2 active projects). `Vault` was backed up
  (`backups/vault-2026-09-10/`, git-ignored) and paused to free a slot.
  **Do not touch the `Bundel` project.**
- Regenerate `src/types/database.ts` after every migration.

## Data model (phases 1-4)

`profiles`, `body_weights`, `daily_targets` (snapshot per day, unique user_id+date),
`foods` (cache; `source` 'off' | 'custom', macros per 100 g, `is_public` for OFF,
`created_by` for own products), `food_log_entries` (macros copied at log time,
`meal_type`), `exercises`, `workout_plans`, `workout_days`,
`workout_day_exercises`, `week_schedule` (unique user_id+weekday, null = rest day),
`workout_sessions` (`is_comeback`), `set_logs`.

Rules: uuid primary keys, `created_at`, RLS via `auth.uid() = user_id`, child
tables via an `exists` check on the parent. **Streaks are never stored** — they
are computed from the last `performed_on`.

## Nutrition maths (pure function + tests, phase 1)

Mifflin-St Jeor x activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
Bulk +400 kcal, cut -400 kcal, maintenance 0.
Protein 1.6 (bulk) / 1.8 (maintenance) / 2.0 (cut) g per kg. Fat = 25% of kcal,
carbs = the rest.

Hard safety rules — these are non-negotiable and must stay covered by tests:
1. Deficit never larger than 500 kcal.
2. Never below BMR — clamp to BMR and return a warning.
3. Carbs can never go negative.
4. **Never** reduce calories as a punishment for missed workouts.

## Phases

0. **done** — setup: Expo + TS + Router, git, folders, Supabase client, .env, empty tab bar
1. Auth + onboarding + daily targets (with tests)
2. Food logging: barcode, search, manual, cache, day overview
3. Training: plans, week schedule, sessions with previous performance
4. Notifications (evening reminder with remaining kcal/protein, 7-day comeback),
   comeback workout at ~60% volume, streak
5. Polish + deploy the web build to Vercel

Out of scope for v1 (but the data model leaves room): AI recipes, shopping
list/budget, medication reminders.

After each phase: explain, say how to test, commit, update this file, then stop.

## Commands

```bash
npm start          # Expo dev server (scan the QR code with Expo Go)
npm run web        # web build in the browser
npm test           # jest
npm run typecheck  # tsc --noEmit
```
