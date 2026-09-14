# GymApp

Een gratis app voor krachttraining en voeding. Eén Expo-codebase voor iOS
(getest met Expo Go op een iPhone 16e) en voor het web (Vercel).

Alle teksten in de app zijn Nederlands. De code, de variabelen, de commentaren
en de commits zijn Engels.

## Wat het doet

**Training** — routines met mappen, een oefeningenbibliotheek van 169
oefeningen (Nederlandse naam, Engelse zoekterm), een weekplanning, en een
trainingsscherm met sessietimer, vorige prestatie als placeholder, set-types,
rusttimer met melding, supersets en een schijvencalculator. Een lopende sessie
staat op je telefoon en gaat niet verloren als je geen bereik hebt.

**Voeding** — barcode scannen (alleen native), zoeken in Open Food Facts, eigen
producten, favorieten, recent en vaak gegeten, porties in stuks of plakjes,
eigen maaltijden en recepten, snelle invoer, water, en een dagdetail met de
verdeling van je macro's.

**Statistieken** — geschatte 1RM, zwaarste set en volume per oefening over
tijd, volume per spiergroep per week, hoe vaak je traint, en je calorieën en
gewicht op dezelfde tijdlijn.

**Meldingen** — een avondoverzicht met wat je nog mag eten, een herinnering op
een trainingsdag, en een vriendelijk comeback-scherm na een week zonder
training. Alles staat standaard uit.

**Recepten** — een AI maakt een recept dat binnen je resterende macro's past.
Recepten worden bewaard en gedeeld, zodat het volgende verzoek meestal gratis
uit de cache komt. Er is een limiet per dag die je zelf instelt.

**Medicatie** — herinneringen die je zelf instelt, met de nadruk op wat de app
níet doet: geen medisch advies en geen controle op wisselwerkingen.

## De regels waar de app zich aan houdt

Deze staan niet voor de sier; ze zijn afgedekt met tests en met check-constraints
in de database.

1. Een calorietekort is nooit groter dan 500 kcal onder je onderhoudsniveau.
2. Je doel komt nooit onder je ruststofwisseling (BMR). Ook niet als je het zelf
   handmatig lager invult.
3. Koolhydraten kunnen nooit negatief worden.
4. Minder eten is nooit een straf voor een gemiste training. Nergens in de app
   hangt een calorie-doel af van wat je wel of niet hebt getraind.
5. Geen medisch advies. Medicatie is alleen een herinnering die je zelf instelt.
6. Geen enkele melding, streak of grafiek spreekt je aan op je eetgedrag. De
   toon is feitelijk en behulpzaam.

## Stack

| Onderwerp | Keuze |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Routing | Expo Router (op bestanden, typed routes aan) |
| Taal | TypeScript, `strict: true` |
| Backend | Supabase (Auth + Postgres, RLS op elke tabel) |
| Serverstate | @tanstack/react-query |
| Grafieken | react-native-svg, met eigen componenten in `src/components/charts` |
| Meldingen | expo-notifications (alleen lokaal) |
| Tests | jest-expo + @testing-library/react-native |

## Lokaal draaien

Je hebt Node 20 of nieuwer nodig en een Supabase-project.

```bash
git clone https://github.com/altijdbezig/gymapp.git
cd gymapp
npm install

cp .env.example .env
# Vul EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in.
# Die vind je in het Supabase-dashboard onder Project Settings -> API.

npm start        # QR-code scannen met Expo Go
npm run web      # in de browser
```

Alleen variabelen met `EXPO_PUBLIC_` ervoor komen in de app terecht, en alles
wat in de app zit is leesbaar voor wie hem installeert. De service role key
hoort daar dus nooit in; Row Level Security doet het werk.

### Database

De migraties staan in `supabase/migrations/` en worden op volgorde toegepast:

```bash
npx supabase link --project-ref <je-project-ref>
npx supabase db push
```

Draai daarna de security advisor in het dashboard en genereer de types opnieuw:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

### Edge functions

Twee functies, allebei omdat ze een sleutel nodig hebben die niet in de app mag:

```bash
npx supabase functions deploy generate-recipe
npx supabase functions deploy delete-account

# De API-sleutel voor de recepten:
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`delete-account` heeft geen secret nodig: de service role key wordt door
Supabase zelf aan de functie doorgegeven.

## Commando's

```bash
npm start          # Expo dev server
npm run web        # webversie in de browser
npm test           # jest
npm run typecheck  # tsc --noEmit
npx expo export --platform web   # productiebuild van de webversie
```

## Deployen naar Vercel

`vercel.json` staat klaar: het bouwt met `npx expo export --platform web` naar
`dist/` en stuurt alle routes naar `index.html`, wat Expo Router nodig heeft.

1. Importeer de repository in Vercel.
2. Zet `EXPO_PUBLIC_SUPABASE_URL` en `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` als
   environment variables (voor Production én Preview).
3. Deploy. Het framework-preset mag op "Other" blijven staan.

Zet daarna de URL van de webversie bij de Redirect URLs in Supabase
(Authentication -> URL Configuration), anders komen de bevestigingsmail en de
wachtwoord-reset op de verkeerde plek uit.

## Indeling

```
app/                      Expo Router routes
  _layout.tsx             providers + AuthProvider + Stack.Protected routing
  (auth)/                 inloggen, registreren, wachtwoord vergeten
  (onboarding)/           profiel, gewicht, doel
  (tabs)/                 Vandaag, Eten, Training, Instellingen
src/components/           Screen, Text, Card, Button, Input, charts, ...
src/features/             auth | nutrition | training | recipes | medication |
                          notifications | account | settings | onboarding
src/lib/                  supabase-client, env, Open Food Facts, datums, ids
src/theme/                design tokens + de licht/donker provider
src/types/database.ts     gegenereerd uit Supabase — niet met de hand aanpassen
supabase/migrations/      SQL-migraties, op volgorde
supabase/functions/       Deno edge functions (recepten, account verwijderen)
```

## Privacy

Alles staat in je eigen Supabase-project. Er gaat niets naar derden, er draait
geen analytics, en op je gezondheidsgegevens (gewicht, medicatie) draait
helemaal niets. Je kunt je gegevens exporteren als JSON en je account met alles
erin verwijderen, allebei vanuit Instellingen → Je gegevens.

## Licentie

Zie [LICENSE](LICENSE).
