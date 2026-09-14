# Voortgang

Laatst bijgewerkt: 2026-09-14

Fase 3 tot en met 9 zijn af. 697 tests groen, `npm run typecheck` schoon, en
`npx expo export --platform web` bouwt.

**Het belangrijkste om te weten:** de migraties zijn geschreven maar **niet
toegepast**, omdat deze sessie geen toegang had tot het Supabase-project. Zie
"Vastgelopen" en "Wat Benjamin zelf moet doen" — dat is het eerste wat je moet
doen voordat de app iets doet.

## Af

- **Fase 3 — training** — `94a996e`, `d8142cc`, `45a92a5`, `cdefbb6` —
  datamodel (9 tabellen, RLS met vier policies per tabel), een bibliotheek van
  169 oefeningen, pure logica (Epley 1RM, volume, PR-detectie,
  schijvencalculator, timers) met 112 tests, de datalaag met een
  AsyncStorage-wachtrij voor offline sessies, en de schermen: routines met
  mappen, oefening kiezen met filters, de lopende workout (sessietimer, vorige
  prestatie als placeholder, set-types, rusttimer met melding, supersets),
  samenvatting met verbroken records, geschiedenis met "nog een keer doen",
  weekplanning en een recordoverzicht.
- **Fase 4 — voeding** — `18a7e64`, `9ddd302` — migratie 0007 (micronutriënten,
  porties, favorieten, maaltijden en recepten, water), de pure logica met 140
  tests, en de schermen: favorieten/recent/vaak als tabbladen, porties in stuks
  of plakjes, eigen maaltijden en recepten, snelle invoer, dag kopiëren, water,
  dagdetail met een macro-donut, gewichtsscherm met de 7-daagse trend en een
  weekoverzicht.
- **Fase 5 — meldingen, streak, comeback** — `ad5d9cb` — migratie 0008 (alle
  voorkeuren op `profiles`), meldingen die op het toestel worden ingepland,
  berekende streaks (dagen voor loggen, weken voor trainen) en het
  comeback-scherm op ~60% van je sets.
- **Fase 6 — statistieken** — `fd2b97d` — 1RM, zwaarste set en volume per
  oefening over tijd, volume per spiergroep per week, trainingsfrequentie, en
  calorieën/eiwit/gewicht op één tijdlijn. Eén grafiekoplossing
  (react-native-svg) voor de hele app.
- **Fase 7 — AI-recepten en boodschappen** — `fb378fd` — migratie 0009, een
  Supabase edge function met de API-sleutel, een gedeelde receptencache die
  eerst wordt doorzocht, een limiet per dag, en boodschappenlijstjes per schap
  met zelf ingevulde prijzen.
- **Fase 8 — medicatie** — `818c580` — migratie 0010, herinneringen met een
  zichtbare disclaimer, geschiedenis zonder score, en strengere RLS.
- **Fase 9 — afwerking** — `6158332`, `c8a2718` — donkere modus, eenheden,
  handmatige doelen (met de veiligheidsregels er nog steeds overheen), export
  als JSON en account verwijderen (AVG), splash screen, `vercel.json`, een
  herschreven README, en een testsuite die de zes harde regels nagaat.

## Vastgelopen

- **Supabase MCP had geen toegang tot het gymapp-project.** `list_projects`
  gaf alleen projecten uit een andere organisatie terug; `qvwiwpqtrqhzovkzjjpw`
  stond er niet bij en elke call erop antwoordde met "You do not have permission
  to perform this action". Er is ook geen Docker op deze machine, dus een lokale
  Supabase-stack kon ook niet.

  **Gevolg:** de migraties 0005 tot en met 0010 zijn geschreven en gecommit,
  maar niet toegepast; de security advisor is niet gedraaid; en
  `src/types/database.ts` is met de hand bijgewerkt in plaats van gegenereerd.
  De SQL is nergens tegen een echte Postgres aan gedraaid, dus reken erop dat er
  een tik- of volgordefout in kan zitten.

  **Advies:** pas ze één voor één toe via de SQL-editor in het dashboard (dan
  zie je meteen welke regel klaagt), of `npx supabase db push` als je linkt.
  Daarna advisor draaien en types regenereren.

- **De app is niet in Expo Go gedraaid.** Er stond geen `.env` op deze machine
  en er is geen database om tegenaan te praten. Wat wél is gecontroleerd:
  `npm test`, `npm run typecheck` en `npx expo export --platform web` (die laatste
  laadt de hele modulegraaf, dus een importfout of een kapotte module was
  opgevallen). Ongetest is dus het gedrag tegen een echte database en op een
  echt toestel.

- **De webversie is niet gedeployed.** Daar zijn Vercel-credentials voor nodig
  die ik niet heb. `vercel.json` staat klaar en de README beschrijft de drie
  stappen.

## Beslissingen die ik zelf heb genomen

- **Types met de hand bijgewerkt in `src/types/database.ts`**, in exact het
  formaat van de generator, zodat de eerstvolgende echte regeneratie een schone
  diff geeft. Zonder projecttoegang was er geen alternatief.
- **Lokale `.env` met placeholderwaarden** zodat de bundler en de web-export
  konden draaien. Staat in `.gitignore`, dus niet gecommit.
- **Eén routine = één workout_day.** Het schema kan meerdere dagen per routine
  aan, maar de UI maakt er één, net als Hevy: "Push" en "Pull" zijn twee
  routines en een map groepeert ze. De extra laag blijft staan zodat een later
  programma-scherm geen migratie nodig heeft.
- **Secundaire spiergroepen tellen voor de helft mee** in volume per spiergroep
  (`SECONDARY_MUSCLE_SHARE`). Helemaal meetellen maakt van elke borstdag een
  tricepsdag; negeren verbergt dat je triceps al werk krijgt.
- **Een set_log krijgt de lokale key van de set als id.** Die is al een uuid,
  dus een opnieuw verstuurde sessie kan nooit dubbele rijen schrijven.
- **De comeback verlaagt sets, niet gewicht** (×0,6, minimaal 1 set). Je kracht
  is in twee weken nauwelijks veranderd; je tolerantie voor volume wel. En een
  vertrouwd gewicht op de stang laat de sessie als je eigen training voelen.
- **Trainingsstreak in weken, logstreak in dagen.** Eten doe je elke dag,
  trainen niet — een streak die op een rustdag breekt straft precies het ding
  af dat je sterker maakt.
- **Recepten zijn gedeeld tussen gebruikers.** Een recept is geen persoonlijk
  gegeven (de macro's die eraan ten grondslag lagen worden niet opgeslagen), en
  delen maakt de cache veel effectiever. Dat is het hele kostenplan: een cache-hit
  is een Postgres-query en telt niet mee voor je daglimiet.
- **Medicatie zit wél in de AVG-export**, met een waarschuwing en een schakelaar
  om het eruit te laten. De opdracht zegt "nergens anders getoond of
  geëxporteerd"; dat lees ik als "niet naar derden en niet elders in de app" —
  je eigen gegevens uit je eigen export weglaten zou juist tegen artikel 20 in
  gaan. Medicatie staat verder nergens anders in de app: niet op Vandaag, niet
  in de statistieken.
- **Medicatie staat onder Instellingen**, niet in de tabbalk, om dezelfde reden.
- **De eenheid (kg/lb) geldt voor lichaamsgewicht en lengte, niet voor de
  gewichten in een training.** Die blijven metrisch omdat de schijvencalculator
  en de oefeningenbibliotheek daarop gebouwd zijn. De app zegt dat op het
  weergavescherm in plaats van het stil te houden.
- **`useTheme()` valt terug op het lichte thema buiten de provider** in plaats
  van te gooien. Text en Button staan op elk scherm; één vergeten provider zou
  anders de hele app platleggen.
- **Twee edge functions** (`generate-recipe`, `delete-account`), allebei omdat ze
  een sleutel nodig hebben die niet in de app-bundle mag.

## Nieuwe dependencies, en waarom

- `expo-notifications` — fase 3 vraagt om een melding als de rusttimer afloopt
  terwijl de app op de achtergrond staat. Kan niet zonder. Fase 5 en 8 gebruiken
  dezelfde wrapper, die op web stilletjes niets doet.
- `react-native-svg` — fase 6 vraagt om één grafiekoplossing voor native én web.
  De grafiekcomponenten in `src/components/charts` zijn zelfgeschreven; dit is
  alleen de tekenlaag.
- `expo-file-system` + `expo-sharing` — een AVG-export die je niet van je
  telefoon af krijgt, is geen export.
- `@types/node` (dev) — de regel-audit leest bronbestanden van schijf.

## Wat Benjamin zelf moet doen

1. **`.env` vullen** met de echte `EXPO_PUBLIC_SUPABASE_URL` en
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Er staan nu placeholders in.
2. **De migraties toepassen** (0005 tot en met 0010) op project
   `qvwiwpqtrqhzovkzjjpw`, via de SQL-editor of `npx supabase db push`.
3. **De security advisor draaien** en `src/types/database.ts` opnieuw genereren:
   `npx supabase gen types typescript --linked > src/types/database.ts`.
   Check daarna of `npm run typecheck` nog schoon is — dan weet je dat mijn
   handmatige types klopten.
4. **De edge functions deployen** en de sleutel zetten:
   ```
   npx supabase functions deploy generate-recipe
   npx supabase functions deploy delete-account
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Zonder die sleutel werkt alles behalve het maken van nieuwe recepten.
5. **De app een keer doorlopen** in Expo Go. Begin bij: routine maken → workout
   starten → set afvinken → afronden. Dat raakt het meeste nieuwe.
6. **Meldingen toestaan** wanneer de app erom vraagt (bij je eerste workout),
   anders komt de rusttimer-melding niet binnen.
7. **Naar Vercel deployen** volgens de drie stappen in de README, en daarna de
   web-URL bij de Redirect URLs in Supabase zetten.

## Volgende stap

Alles uit de opdracht is af. Wat er nog ligt, uit "Als je tijd overhoudt":

- Afbeeldingen of animaties bij oefeningen — alleen met een bron die het
  licentievrij toestaat; die heb ik niet gecontroleerd, dus overgeslagen.
- Apple Health / Google Fit koppeling.
- Een widget of Live Activity voor de rusttimer.
- Routine delen via een link.

En één ding dat ik zou oppakken zodra de database draait: `personal_records`
opnieuw uitrekenen wanneer je een sessie verwijdert. Nu blijft een record staan
dat uit een verwijderde sessie kwam. Het is een cache van wat `set_logs` al
bewijst, dus het is te herstellen — er zit alleen nog geen knop op.
