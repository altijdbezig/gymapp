# Voortgang

Laatst bijgewerkt: 2026-09-14

## Af

- (nog niets in deze sessie)

## Vastgelopen

- **Supabase MCP heeft geen toegang tot het gymapp-project.** `list_projects` geeft
  alleen projecten uit een andere organisatie terug; `qvwiwpqtrqhzovkzjjpw` staat er
  niet bij en elke call erop antwoordt met "You do not have permission to perform
  this action". Er is ook geen Docker op deze machine, dus een lokale Supabase-stack
  kan ook niet. Gevolg: migraties worden **wel geschreven** als SQL-bestand in
  `supabase/migrations/`, maar zijn **niet toegepast** en de security advisor is niet
  gedraaid. Zie "Wat Benjamin zelf moet doen".

## Beslissingen die ik zelf heb genomen

- **Types met de hand bijgewerkt in `src/types/database.ts`.** Normaal wordt dat
  bestand gegenereerd, maar zonder toegang tot het project kan dat niet. De nieuwe
  tabellen zijn in exact hetzelfde formaat toegevoegd als de generator gebruikt, zodat
  de eerstvolgende echte regeneratie een schone diff geeft.
- **Lokale `.env` met placeholderwaarden aangemaakt** zodat `npx expo export` en de
  bundler kunnen draaien. Het bestand staat in `.gitignore` en is dus niet gecommit.

## Wat Benjamin zelf moet doen

1. `.env` vullen met de echte `EXPO_PUBLIC_SUPABASE_URL` en
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nu staan er placeholders in).
2. De nieuwe migraties in `supabase/migrations/` toepassen op het project
   `qvwiwpqtrqhzovkzjjpw` (Supabase dashboard -> SQL editor, of `supabase db push`).
3. Daarna de security advisor draaien en `src/types/database.ts` opnieuw genereren.

## Volgende stap

- Fase 3: training.
