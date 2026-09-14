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
| Charts | react-native-svg, with our own components in `src/components/charts` |
| Native extras | expo-notifications (local), expo-camera (barcode, native only), expo-file-system + expo-sharing (the GDPR export) |

Barcode scanning is native-only. On web, use search + manual entry behind a
`Platform.OS` check.

## Open Food Facts

- Product by barcode: `world.openfoodfacts.org/api/v2/product/<code>.json` —
  `brands` is a comma-separated **string** here.
- Full-text search: `search.openfoodfacts.org/search?q=` — the list is called
  `hits`, and `brands` is an **array**. The old `/cgi/search.pl` is switched off
  and answers with HTML. `offMapping.ts` handles both shapes.
- Limits: 100 product lookups/min, 10 searches/min. Only search is throttled,
  by the token bucket in `openFoodFacts.ts`; the arithmetic behind those
  numbers is guarded by a test.
- The User-Agent carries `APP_CONTACT_URL`. Browsers forbid setting it, so it
  is only sent on native.

## Project layout

```
app/                      Expo Router routes
  _layout.tsx             providers + AuthProvider + Stack.Protected routing
  (auth)/                 index (inloggen), sign-up, forgot-password, check-email
  (onboarding)/           index (3-step form: profile, weight, goal)
  (tabs)/                 index (Vandaag), food/, training/, settings/
  (tabs)/food/            dagboek, scan, search, amount, manual, quick, copy,
                          day, week, trends, weight, meals/, recipes/, shopping/
  (tabs)/training/        routines, exercises, session, summary, history/,
                          week, records, stats, exercise/, comeback
  (tabs)/settings/        index, notifications, appearance, targets, recipes,
                          account, medication/
src/config/app.ts         app name, version, Open Food Facts contact URL
src/lib/env.ts            reads + validates EXPO_PUBLIC_* variables
src/lib/supabase.ts       the one shared Supabase client
src/lib/openFoodFacts.ts  OFF API wrapper: User-Agent + rate limiting
src/lib/tokenBucket.ts    the rate limiter behind it (injectable clock)
src/features/             auth | nutrition | training | recipes | medication |
                          notifications | account | settings | onboarding
src/components/           Screen, Text, Card, Button, Input, Chip, Sheet, charts
src/theme/theme.ts        design tokens (light and dark palettes)
src/theme/ThemeProvider   the runtime theme: useTheme() and useThemedStyles()
src/types/database.ts     generated from Supabase — do not edit by hand
supabase/migrations/      SQL migrations, applied in order
supabase/functions/       Deno edge functions (generate-recipe, delete-account)
```

A component never reads `colors` at module level for anything that differs
between light and dark. It writes `const makeStyles = (colors: Palette) => ...`
and calls `useThemedStyles(makeStyles)`.

Renaming the app touches three files: `src/config/app.ts`, `app.json`, `package.json`.

## Supabase

- Project **gymapp** — ref `qvwiwpqtrqhzovkzjjpw`, region eu-central-1.
- Auth is e-mail + password. **E-mail confirmation is ON** (`mailer_autoconfirm: false`),
  so `signUp` returns no session and the account only works after the link in the
  mail is opened. Check the current setting with
  `GET $EXPO_PUBLIC_SUPABASE_URL/auth/v1/settings`.
- Redirect URLs are not configured yet, so the confirmation and password-reset
  links land on the Site URL instead of deep-linking back into the app. The
  account is still confirmed by opening the link.
- Org `Alt` is on the free plan (max 2 active projects). `Vault` was backed up
  (`backups/vault-2026-09-10/`, git-ignored) and paused to free a slot.
  **Do not touch the `Bundel` project.**
- Regenerate `src/types/database.ts` after every migration.

## Data model

### Phases 1-4

`profiles`, `body_weights`, `daily_targets` (snapshot per day, unique user_id+date),
`foods` (cache; `source` 'off' | 'custom', macros per 100 g, `is_public` for OFF,
`created_by` for own products), `food_log_entries` (macros copied at log time,
`meal_type`), `exercises`, `workout_plans`, `workout_days`,
`workout_day_exercises`, `week_schedule` (unique user_id+weekday, null = rest day),
`workout_sessions` (`is_comeback`), `set_logs`.

Phase 4 adds micronutrients to `foods` and `food_log_entries`, plus
`food_favorites`, `food_portions`, `meals` + `meal_items` (one table for both a
saved meal and a recipe, told apart by `kind`) and `water_entries`.

### Phases 5-8

`profiles` grew every user preference: which reminders, the evening time, units,
theme, and the manually overridden targets. Then `ai_recipes` (shared between
users, which is what makes the cache work), `shopping_lists` +
`shopping_list_items`, and `medications` + `medication_intakes`.

Rules: uuid primary keys, `created_at`, RLS via `auth.uid() = user_id`, child
tables via an `exists` check on the parent. **Streaks are never stored** — they
are computed from the last `performed_on`. Medication carries `user_id` directly
on both tables rather than reaching through a parent: it is health data, so
there is one less way to get a policy wrong.

## Nutrition maths (pure function + tests, phase 1)

Mifflin-St Jeor x activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
Bulk +400 kcal, cut -400 kcal, maintenance 0.
Protein 1.6 (bulk) / 1.8 (maintenance) / 2.0 (cut) g per kg. Fat = 25% of kcal,
carbs = the rest.

Manually set targets (Instellingen -> Doelen) replace the calculation but not
the safety rules: `applyManualTargets` holds the same two floors.

Hard safety rules — these are non-negotiable and are covered by
`src/__tests__/hardRules.test.ts`:
1. Deficit never larger than 500 kcal.
2. Never below BMR — clamp to BMR and return a warning.
3. Carbs can never go negative.
4. **Never** reduce calories as a punishment for missed workouts.
5. No medical advice; medication is reminders only.
6. No notification, streak or chart shames the reader.

## Phases

All nine are done; 697 tests pass. `PROGRESS.md` has the per-phase commits, the
decisions taken along the way, and what still needs doing by hand.

0. **done** — setup: Expo + TS + Router, git, folders, Supabase client, .env, empty tab bar
1. **done** — auth (e-mail + password), onboarding, daily targets
2. **done** — food logging: barcode (native), search, manual, cache, day overview
3. **done** — training: routines and folders, a 169-exercise library, the week
   schedule, and the workout runner with previous performance, rest timer,
   supersets, a plate calculator and an offline-safe session
4. **done** — favourites/recent/frequent, portions, own meals and recipes, quick
   entry, copying a day, water, micronutrients, the day detail, weight with a
   7-day trend, and the week overview
5. **done** — local reminders per kind, computed streaks, the comeback session
6. **done** — statistics per exercise, per muscle group and over time
7. **done** — AI recipes through an edge function, with a shared cache and a
   daily limit, plus shopping lists by aisle
8. **done** — medication and supplement reminders
9. **done** — dark mode, units, manual targets, GDPR export and account
   deletion, accessibility, splash screen, Vercel config, README

The six hard rules are enforced by `src/__tests__/hardRules.test.ts`, which
checks the arithmetic over every profile the app accepts and reads the source
files to make sure no Dutch copy shames the reader or ties eating to training.

Not built (the data model leaves room): exercise images, Apple Health /
Google Fit, a rest-timer widget, sharing a routine by link.

## Commands

```bash
npm start          # Expo dev server (scan the QR code with Expo Go)
npm run web        # web build in the browser
npm test           # jest
npm run typecheck  # tsc --noEmit
npx expo export --platform web   # production web build
```
