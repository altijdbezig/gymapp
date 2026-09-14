# Voortgang

Laatst bijgewerkt: 2026-09-14

## Af

- **Fase 3 — datamodel** — `94a996e` — migraties `0005_training.sql` (9 tabellen, RLS met
  vier policies per tabel) en `0006_exercise_seed.sql` (169 oefeningen, Nederlandse naam +
  Engelse zoekterm). **Nog niet toegepast**, zie "Vastgelopen".
- **Fase 3 — pure logica** — `d8142cc` — Epley 1RM, volume (warming-ups tellen nooit mee),
  PR-detectie, schijvencalculator, rust- en sessietimer, oefening zoeken/filteren, en de
  offline sessie-reducer. 112 tests.
- **Fase 3 — datalaag** — `45a92a5` — React Query hooks voor oefeningen, routines, mappen,
  weekplanning, geschiedenis en records + de AsyncStorage-wachtrij die een afgeronde sessie
  vasthoudt tot hij verstuurd kan worden. Alle id's worden op het toestel gemaakt, dus een
  mislukte upload opnieuw proberen doet een upsert in plaats van een duplicaat.
- **Fase 3 — schermen** — `cdefbb6` — routines (maken, bewerken, dupliceren, in mappen),
  oefening kiezen met filters, de lopende workout (sessietimer, vorige prestatie als
  placeholder, set-types, rusttimer met melding, supersets, schijvencalculator),
  samenvatting met verbroken records, geschiedenis met "nog een keer doen", weekplanning en
  een recordoverzicht.

## Vastgelopen

- **Supabase MCP heeft geen toegang tot het gymapp-project.** `list_projects` geeft alleen
  projecten uit een andere organisatie terug; `qvwiwpqtrqhzovkzjjpw` staat er niet bij en
  elke call erop antwoordt met "You do not have permission to perform this action". Er is
  ook geen Docker op deze machine, dus een lokale Supabase-stack kan ook niet. Gevolg: de
  migraties zijn **wel geschreven** in `supabase/migrations/`, maar **niet toegepast**, en
  de security advisor is niet gedraaid. Advies: toepassen via het Supabase-dashboard
  (SQL editor) of `supabase db push`, daarna advisor draaien en types regenereren.

## Beslissingen die ik zelf heb genomen

- **Types met de hand bijgewerkt in `src/types/database.ts`.** Normaal gegenereerd, maar
  zonder projecttoegang kan dat niet. Toegevoegd in exact het formaat van de generator,
  zodat de eerstvolgende echte regeneratie een schone diff geeft.
- **Lokale `.env` met placeholderwaarden** zodat `npx expo export` en de bundler draaien.
  Staat in `.gitignore`, dus niet gecommit.
- **Eén routine = één workout_day.** Het schema kan meerdere dagen per routine aan (een
  heel programma als één rij), maar de UI maakt er één, net als Hevy: "Push" en "Pull" zijn
  twee routines en een map groepeert ze. De extra laag blijft staan zodat een later
  programma-scherm geen migratie nodig heeft.
- **Secundaire spiergroepen tellen voor de helft mee** in volume per spiergroep. Helemaal
  meetellen zou van elke borstdag een tricepsdag maken; negeren zou verbergen dat je triceps
  al veel werk krijgt. Eén constante (`SECONDARY_MUSCLE_SHARE`), dus makkelijk te wijzigen.
- **`expo-notifications` toegevoegd** (de enige nieuwe dependency). Fase 3 vraagt om een
  melding als de rusttimer afloopt terwijl de app op de achtergrond staat; dat kan niet
  zonder. Fase 5 gebruikt dezelfde wrapper (`src/features/notifications/localNotifications.ts`),
  die op web stilletjes niets doet.
- **`jest.setup.js` toegevoegd** die de `EXPO_PUBLIC_*` variabelen zet en AsyncStorage mockt,
  zodat tests ook modules mogen importeren die de Supabase-client aanraken.
- **Een set_log krijgt de lokale key van de set als id.** Die is al een uuid, en zo kan een
  opnieuw verstuurde sessie nooit dubbele rijen schrijven.

## Wat Benjamin zelf moet doen

1. `.env` vullen met de echte `EXPO_PUBLIC_SUPABASE_URL` en
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nu staan er placeholders in).
2. De migraties `0005_training.sql` en `0006_exercise_seed.sql` toepassen op project
   `qvwiwpqtrqhzovkzjjpw`.
3. Daarna de security advisor draaien en `src/types/database.ts` opnieuw genereren.
4. Meldingen toestaan op de telefoon wanneer de app erom vraagt (bij de eerste workout),
   anders komt de rusttimer-melding niet binnen.

## Volgende stap

- Fase 4: voeding uitbouwen (favorieten, porties, eigen maaltijden en recepten, water,
  micronutriënten, gewichtsgrafiek, weekoverzicht).
