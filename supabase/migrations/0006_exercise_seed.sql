-- Phase 3: the standard exercise library.
--
-- 170 exercises, shared by every user (is_custom = false, created_by = null),
-- so nobody has to type "Bankdrukken" before their first workout.
--
-- Names are Dutch because all UI copy is Dutch; `aliases` carries the English
-- term (and the occasional second Dutch spelling) so the search box finds
-- "Bankdrukken" when you type "bench press". The search in the app matches
-- name and aliases together.
--
-- `on conflict do nothing` targets the partial unique index on lower(name),
-- which makes this file safe to run twice -- handy while the schema is still
-- moving, and it means a later migration can add exercises by re-running it.

insert into public.exercises (name, aliases, primary_muscle, secondary_muscles, category, instructions)
values
  -- -------------------------------------------------------------------------
  -- Borst
  -- -------------------------------------------------------------------------
  ('Bankdrukken', array['bench press','barbell bench press','flat bench'], 'chest', array['triceps','shoulders']::public.muscle_group[], 'barbell', 'Houd je schouderbladen ingetrokken en laat de stang gecontroleerd tot je onderborst zakken.'),
  ('Schuin bankdrukken', array['incline bench press','incline barbell press'], 'chest', array['shoulders','triceps']::public.muscle_group[], 'barbell', 'Zet de bank op ongeveer 30 graden; steiler maakt er een schouderoefening van.'),
  ('Aflopend bankdrukken', array['decline bench press'], 'chest', array['triceps']::public.muscle_group[], 'barbell', 'Laat de stang naar je onderborst zakken en houd je voeten stevig vast.'),
  ('Dumbbell bankdrukken', array['dumbbell bench press','db bench press'], 'chest', array['triceps','shoulders']::public.muscle_group[], 'dumbbell', 'Meer bewegingsbereik dan met een stang; laat de dumbbells net iets voorbij je borst komen.'),
  ('Schuin dumbbell bankdrukken', array['incline dumbbell press'], 'chest', array['shoulders','triceps']::public.muscle_group[], 'dumbbell', 'Druk de dumbbells naar elkaar toe bovenin zonder ze tegen elkaar te tikken.'),
  ('Dumbbell vlieger', array['dumbbell fly','chest fly','flyes'], 'chest', array['shoulders']::public.muscle_group[], 'dumbbell', 'Houd je ellebogen licht gebogen en beweeg alleen in je schoudergewricht.'),
  ('Schuine dumbbell vlieger', array['incline dumbbell fly'], 'chest', array['shoulders']::public.muscle_group[], 'dumbbell', 'Zelfde beweging als de vlakke vlieger, maar dan op een schuine bank.'),
  ('Kabel crossover', array['cable crossover'], 'chest', array['shoulders']::public.muscle_group[], 'cable', 'Stap een halve pas naar voren zodat de kabels spanning houden aan het begin.'),
  ('Lage kabel vlieger', array['low cable fly','low to high cable fly'], 'chest', array['shoulders']::public.muscle_group[], 'cable', 'Van laag naar hoog; richt op je bovenborst.'),
  ('Hoge kabel vlieger', array['high cable fly','high to low cable fly'], 'chest', array['shoulders']::public.muscle_group[], 'cable', 'Van hoog naar laag; richt op je onderborst.'),
  ('Pec deck', array['machine fly','butterfly','peck deck'], 'chest', '{}'::public.muscle_group[], 'machine', 'Zet de handgrepen zo dat je borst aan het begin op rek staat, niet je schouder.'),
  ('Machine bankdrukken', array['chest press machine','machine chest press'], 'chest', array['triceps','shoulders']::public.muscle_group[], 'machine', 'Goede keuze als je zonder spotter zwaar wil gaan.'),
  ('Schuine machine press', array['incline chest press machine'], 'chest', array['shoulders','triceps']::public.muscle_group[], 'machine', 'Machineversie van schuin bankdrukken.'),
  ('Push-up', array['push up','opdrukken','press up'], 'chest', array['triceps','shoulders','abs']::public.muscle_group[], 'bodyweight', 'Houd je lichaam één rechte lijn; je heupen zakken niet door.'),
  ('Brede push-up', array['wide push up'], 'chest', array['shoulders']::public.muscle_group[], 'bodyweight', 'Handen breder dan schouderbreedte, iets meer nadruk op je borst.'),
  ('Verhoogde push-up', array['decline push up','feet elevated push up'], 'chest', array['shoulders','triceps']::public.muscle_group[], 'bodyweight', 'Voeten op een bankje maakt de oefening zwaarder en raakt je bovenborst.'),
  ('Dips (borst)', array['chest dips','borst dips'], 'chest', array['triceps','shoulders']::public.muscle_group[], 'bodyweight', 'Leun naar voren en laat je ellebogen iets naar buiten; dat verschuift het werk naar je borst.'),
  ('Smith machine bankdrukken', array['smith machine bench press'], 'chest', array['triceps','shoulders']::public.muscle_group[], 'machine', 'Vast baanpad, dus je hoeft niet te balanceren.'),
  ('Halter pullover', array['dumbbell pullover','pullover'], 'chest', array['lats','triceps']::public.muscle_group[], 'dumbbell', 'Houd je ellebogen bijna gestrekt en ga alleen zo diep als comfortabel is.'),
  ('Landmine press', array['landmine press'], 'shoulders', array['chest','triceps']::public.muscle_group[], 'barbell', 'Schoudervriendelijk drukken omdat je in een schuine lijn duwt.'),

  -- -------------------------------------------------------------------------
  -- Rug en lats
  -- -------------------------------------------------------------------------
  ('Optrekken', array['pull up','pull-up','pullup'], 'lats', array['biceps','back']::public.muscle_group[], 'bodyweight', 'Begin met gestrekte armen en trek je borst richting de stang.'),
  ('Chin-up', array['chin up','underhand pull up'], 'lats', array['biceps']::public.muscle_group[], 'bodyweight', 'Onderhandse greep; je biceps helpt hier duidelijk meer mee.'),
  ('Neutrale grip optrekken', array['neutral grip pull up','hammer grip pull up'], 'lats', array['biceps','back']::public.muscle_group[], 'bodyweight', 'Handpalmen naar elkaar toe, vaak het prettigst voor je schouders.'),
  ('Lat pulldown', array['lat pulldown','pulldown'], 'lats', array['biceps','back']::public.muscle_group[], 'cable', 'Trek de stang naar je sleutelbeenderen, niet in je nek.'),
  ('Lat pulldown nauwe grip', array['close grip lat pulldown'], 'lats', array['biceps']::public.muscle_group[], 'cable', 'Nauwe greep geeft meer bewegingsbereik onderin.'),
  ('Lat pulldown onderhands', array['reverse grip lat pulldown','underhand pulldown'], 'lats', array['biceps']::public.muscle_group[], 'cable', 'Onderhandse greep, meer biceps en onderste lats.'),
  ('Barbell roeien', array['barbell row','bent over row'], 'back', array['lats','biceps','lower_back']::public.muscle_group[], 'barbell', 'Buig vanuit je heupen tot ongeveer 45 graden en houd je rug recht.'),
  ('Pendlay row', array['pendlay row'], 'back', array['lats','biceps']::public.muscle_group[], 'barbell', 'Elke herhaling begint vanaf de grond, met een bijna horizontale romp.'),
  ('T-bar roeien', array['t bar row','t-bar row'], 'back', array['lats','biceps']::public.muscle_group[], 'barbell', 'Houd je borst tegen het steunkussen als de machine dat heeft.'),
  ('Dumbbell roeien', array['one arm dumbbell row','db row','single arm row'], 'back', array['lats','biceps']::public.muscle_group[], 'dumbbell', 'Steun met één hand op de bank en trek de dumbbell richting je heup.'),
  ('Zittend kabelroeien', array['seated cable row','cable row'], 'back', array['lats','biceps']::public.muscle_group[], 'cable', 'Houd je romp stil; schommelen maakt de oefening makkelijker, niet beter.'),
  ('Kabelroeien één arm', array['single arm cable row','one arm cable row'], 'back', array['lats','biceps']::public.muscle_group[], 'cable', 'Eén arm tegelijk, zodat je zwakkere kant niet kan meeliften.'),
  ('Machine roeien', array['machine row','hammer strength row'], 'back', array['lats','biceps']::public.muscle_group[], 'machine', 'Vaste baan, dus je kan je op knijpen achterin richten.'),
  ('Borstondersteund roeien', array['chest supported row','incline dumbbell row'], 'back', array['lats','biceps']::public.muscle_group[], 'dumbbell', 'Je borst ligt op de bank, dus je onderrug doet niets.'),
  ('Seal row', array['seal row'], 'back', array['lats','biceps']::public.muscle_group[], 'barbell', 'Liggend op een hoge bank; volledig gecontroleerd, geen zwaai mogelijk.'),
  ('Inverted row', array['inverted row','australian pull up','bodyweight row'], 'back', array['biceps','lats']::public.muscle_group[], 'bodyweight', 'Hoe horizontaler je ligt, hoe zwaarder het wordt.'),
  ('Meadows row', array['meadows row'], 'back', array['lats','biceps']::public.muscle_group[], 'barbell', 'Eén arm aan het uiteinde van een landmine-stang.'),
  ('Straight arm pulldown', array['straight arm pulldown','lat pushdown'], 'lats', array['triceps']::public.muscle_group[], 'cable', 'Armen bijna gestrekt houden; de beweging komt uit je lats.'),
  ('Deadlift', array['deadlift','conventional deadlift'], 'back', array['hamstrings','glutes','lower_back','traps']::public.muscle_group[], 'barbell', 'Stang tegen je scheenbeen, rug recht, en duw de grond weg met je benen.'),
  ('Sumo deadlift', array['sumo deadlift'], 'glutes', array['quads','back','hamstrings']::public.muscle_group[], 'barbell', 'Brede voetstand, handen binnen je knieën; meer been, minder onderrug.'),
  ('Roemeense deadlift', array['romanian deadlift','rdl'], 'hamstrings', array['glutes','lower_back']::public.muscle_group[], 'barbell', 'Duw je heupen naar achteren met bijna gestrekte knieën tot je rek voelt.'),
  ('Rack pull', array['rack pull'], 'back', array['traps','glutes','lower_back']::public.muscle_group[], 'barbell', 'Deadlift vanaf kniehoogte, zodat je zwaarder kan dan vanaf de grond.'),
  ('Shrug met halter', array['barbell shrug'], 'traps', array['forearms']::public.muscle_group[], 'barbell', 'Recht omhoog halen, niet rollen met je schouders.'),
  ('Shrug met dumbbells', array['dumbbell shrug'], 'traps', array['forearms']::public.muscle_group[], 'dumbbell', 'Even bovenin vasthouden voordat je laat zakken.'),
  ('Kabel shrug', array['cable shrug'], 'traps', array['forearms']::public.muscle_group[], 'cable', 'Constante spanning over het hele bereik.'),
  ('Hyperextensie', array['back extension','hyperextension'], 'lower_back', array['glutes','hamstrings']::public.muscle_group[], 'bodyweight', 'Stop als je romp in lijn is met je benen; verder doorbuigen hoeft niet.'),
  ('Good morning', array['good morning'], 'hamstrings', array['lower_back','glutes']::public.muscle_group[], 'barbell', 'Begin licht: dit is een scharnierbeweging, geen squat.'),
  ('Face pull', array['face pull'], 'shoulders', array['traps','back']::public.muscle_group[], 'cable', 'Trek het touw naar je voorhoofd en draai je handen naar buiten.'),

  -- -------------------------------------------------------------------------
  -- Schouders
  -- -------------------------------------------------------------------------
  ('Militair drukken', array['overhead press','military press','ohp','shoulder press'], 'shoulders', array['triceps','abs']::public.muscle_group[], 'barbell', 'Span je buik aan en duw je hoofd door onder de stang zodra die voorbij je voorhoofd is.'),
  ('Zittend dumbbell drukken', array['seated dumbbell shoulder press','db shoulder press'], 'shoulders', array['triceps']::public.muscle_group[], 'dumbbell', 'Rug tegen de steun; zo blijft je onderrug er buiten.'),
  ('Arnold press', array['arnold press'], 'shoulders', array['triceps']::public.muscle_group[], 'dumbbell', 'Draai je handen tijdens het drukken van binnen naar buiten.'),
  ('Push press', array['push press'], 'shoulders', array['triceps','quads']::public.muscle_group[], 'barbell', 'Korte kniebuiging om de stang op gang te helpen; daarna alleen armen.'),
  ('Machine schouderdrukken', array['machine shoulder press'], 'shoulders', array['triceps']::public.muscle_group[], 'machine', 'Stel de stoel zo in dat de handgrepen op schouderhoogte zitten.'),
  ('Laterale raise', array['lateral raise','side raise','side lateral raise'], 'shoulders', '{}'::public.muscle_group[], 'dumbbell', 'Licht gewicht werkt hier beter; tot schouderhoogte is genoeg.'),
  ('Kabel laterale raise', array['cable lateral raise'], 'shoulders', '{}'::public.muscle_group[], 'cable', 'De kabel houdt spanning onderin, waar dumbbells dat niet doen.'),
  ('Machine laterale raise', array['machine lateral raise'], 'shoulders', '{}'::public.muscle_group[], 'machine', 'Zelfde beweging, maar je hoeft niet te stabiliseren.'),
  ('Voorwaartse raise', array['front raise'], 'shoulders', '{}'::public.muscle_group[], 'dumbbell', 'Je voorste schouder werkt al hard bij elke drukoefening; hou het volume laag.'),
  ('Omgekeerde vlieger', array['reverse fly','rear delt fly','bent over lateral raise'], 'shoulders', array['back','traps']::public.muscle_group[], 'dumbbell', 'Buig voorover en breng de dumbbells zijwaarts omhoog.'),
  ('Reverse pec deck', array['reverse pec deck','rear delt machine'], 'shoulders', array['back']::public.muscle_group[], 'machine', 'Achterste schouders, de kant die bij de meeste mensen achterloopt.'),
  ('Upright row', array['upright row'], 'shoulders', array['traps','biceps']::public.muscle_group[], 'barbell', 'Niet hoger dan borsthoogte trekken en met een iets bredere greep, dat is prettiger voor je schouder.'),
  ('Handstand push-up', array['handstand push up','hspu'], 'shoulders', array['triceps']::public.muscle_group[], 'bodyweight', 'Bouw op met je voeten tegen de muur voordat je vrij staat.'),

  -- -------------------------------------------------------------------------
  -- Biceps en onderarmen
  -- -------------------------------------------------------------------------
  ('Halter curl', array['barbell curl','bb curl'], 'biceps', array['forearms']::public.muscle_group[], 'barbell', 'Ellebogen blijven naast je romp; je rug zwaait niet mee.'),
  ('EZ-bar curl', array['ez bar curl','ez curl'], 'biceps', array['forearms']::public.muscle_group[], 'barbell', 'De gebogen stang is vriendelijker voor je polsen dan een rechte.'),
  ('Dumbbell curl', array['dumbbell curl','db curl'], 'biceps', array['forearms']::public.muscle_group[], 'dumbbell', 'Draai je hand tijdens het buigen naar buiten voor iets meer bereik.'),
  ('Hamercurl', array['hammer curl'], 'biceps', array['forearms']::public.muscle_group[], 'dumbbell', 'Neutrale greep; raakt vooral de spier onder je biceps.'),
  ('Schuine bank curl', array['incline dumbbell curl','incline curl'], 'biceps', '{}'::public.muscle_group[], 'dumbbell', 'Achteroverliggend, zodat je biceps op rek begint.'),
  ('Concentratiecurl', array['concentration curl'], 'biceps', '{}'::public.muscle_group[], 'dumbbell', 'Elleboog tegen je binnenbeen, één arm tegelijk.'),
  ('Preacher curl', array['preacher curl','scott curl'], 'biceps', '{}'::public.muscle_group[], 'barbell', 'Het kussen houdt je elleboog vast, dus vals bewegen kan niet.'),
  ('Kabelcurl', array['cable curl'], 'biceps', array['forearms']::public.muscle_group[], 'cable', 'Constante spanning van onder tot boven.'),
  ('Kabel hamercurl', array['rope hammer curl','cable hammer curl'], 'biceps', array['forearms']::public.muscle_group[], 'cable', 'Met het touw, handen naar elkaar toe.'),
  ('Machine curl', array['machine biceps curl'], 'biceps', '{}'::public.muscle_group[], 'machine', 'Makkelijk om tot falen te gaan zonder je rug te belasten.'),
  ('Spider curl', array['spider curl'], 'biceps', '{}'::public.muscle_group[], 'dumbbell', 'Borst op een schuine bank, armen recht naar beneden.'),
  ('Omgekeerde curl', array['reverse curl'], 'forearms', array['biceps']::public.muscle_group[], 'barbell', 'Bovenhandse greep; vooral je onderarmen.'),
  ('Drag curl', array['drag curl'], 'biceps', '{}'::public.muscle_group[], 'barbell', 'Sleep de stang langs je lichaam omhoog en breng je ellebogen naar achteren.'),
  ('Polscurl', array['wrist curl'], 'forearms', '{}'::public.muscle_group[], 'barbell', 'Onderarmen op je bovenbenen, alleen je polsen bewegen.'),
  ('Omgekeerde polscurl', array['reverse wrist curl'], 'forearms', '{}'::public.muscle_group[], 'barbell', 'Andersom dan de polscurl, voor de bovenkant van je onderarm.'),
  ('Farmer''s walk', array['farmers walk','farmers carry'], 'forearms', array['traps','abs','full_body']::public.muscle_group[], 'other', 'Zwaar oppakken en rechtop een stuk lopen. Log de afstand of de tijd.'),
  ('Dead hang', array['dead hang'], 'forearms', array['lats']::public.muscle_group[], 'bodyweight', 'Gewoon hangen. Log de tijd in plaats van herhalingen.'),
  ('Knijphalter', array['grip trainer','hand gripper'], 'forearms', '{}'::public.muscle_group[], 'other', 'Knijpkracht; vaak de zwakke schakel bij zwaar deadliften.'),

  -- -------------------------------------------------------------------------
  -- Triceps
  -- -------------------------------------------------------------------------
  ('Triceps pushdown', array['triceps pushdown','pushdown','tricep pushdown'], 'triceps', '{}'::public.muscle_group[], 'cable', 'Ellebogen blijven op hun plek; alleen je onderarm beweegt.'),
  ('Touw pushdown', array['rope pushdown','rope triceps pushdown'], 'triceps', '{}'::public.muscle_group[], 'cable', 'Trek de uiteinden van het touw onderin uit elkaar.'),
  ('Overhead triceps extensie', array['overhead triceps extension','overhead extension'], 'triceps', '{}'::public.muscle_group[], 'dumbbell', 'Boven je hoofd, zodat de lange kop van je triceps op rek komt.'),
  ('Kabel overhead extensie', array['cable overhead triceps extension'], 'triceps', '{}'::public.muscle_group[], 'cable', 'Zelfde beweging als met een dumbbell, maar met spanning over het hele bereik.'),
  ('Skull crusher', array['skull crusher','lying triceps extension'], 'triceps', '{}'::public.muscle_group[], 'barbell', 'Laat de stang naar je voorhoofd of net erachter zakken.'),
  ('Nauwe bankdrukken', array['close grip bench press'], 'triceps', array['chest','shoulders']::public.muscle_group[], 'barbell', 'Handen op schouderbreedte en ellebogen dicht bij je lichaam.'),
  ('Dips (triceps)', array['triceps dips','tricep dips'], 'triceps', array['chest','shoulders']::public.muscle_group[], 'bodyweight', 'Romp rechtop houden; dat verschuift het werk naar je triceps.'),
  ('Bench dips', array['bench dips'], 'triceps', array['shoulders']::public.muscle_group[], 'bodyweight', 'Handen achter je op een bank; ga niet dieper dan comfortabel.'),
  ('Kickback', array['triceps kickback'], 'triceps', '{}'::public.muscle_group[], 'dumbbell', 'Bovenarm horizontaal en stil, strek alleen je elleboog.'),
  ('Machine triceps extensie', array['machine triceps extension'], 'triceps', '{}'::public.muscle_group[], 'machine', 'Makkelijk te doseren, ook als je moe bent.'),
  ('Diamant push-up', array['diamond push up','close grip push up'], 'triceps', array['chest']::public.muscle_group[], 'bodyweight', 'Handen vormen een driehoek onder je borst.'),
  ('JM press', array['jm press'], 'triceps', array['chest']::public.muscle_group[], 'barbell', 'Kruising tussen nauw bankdrukken en een skull crusher.'),

  -- -------------------------------------------------------------------------
  -- Bovenbenen (quadriceps)
  -- -------------------------------------------------------------------------
  ('Squat', array['back squat','barbell squat','kniebuiging'], 'quads', array['glutes','lower_back','hamstrings']::public.muscle_group[], 'barbell', 'Knieën volgen de richting van je tenen en je zakt tot minstens parallel.'),
  ('Front squat', array['front squat'], 'quads', array['glutes','abs']::public.muscle_group[], 'barbell', 'Stang op je voorste schouders, ellebogen hoog, romp rechtop.'),
  ('Goblet squat', array['goblet squat'], 'quads', array['glutes','abs']::public.muscle_group[], 'dumbbell', 'Dumbbell of kettlebell tegen je borst; goede manier om de beweging te leren.'),
  ('Hack squat', array['hack squat','machine hack squat'], 'quads', array['glutes']::public.muscle_group[], 'machine', 'Vaste baan; je kan diep gaan zonder te balanceren.'),
  ('Beenpers', array['leg press'], 'quads', array['glutes','hamstrings']::public.muscle_group[], 'machine', 'Duw niet je onderrug van het kussen door té diep te gaan.'),
  ('Beenextensie', array['leg extension'], 'quads', '{}'::public.muscle_group[], 'machine', 'Even bovenin vasthouden; dat is waar je quadriceps het hardst werkt.'),
  ('Bulgaarse split squat', array['bulgarian split squat','rear foot elevated split squat'], 'quads', array['glutes','hamstrings']::public.muscle_group[], 'dumbbell', 'Achterste voet op een bank; verder naar voren stappen raakt meer bilspier.'),
  ('Uitvalspas', array['lunge','stationary lunge'], 'quads', array['glutes','hamstrings']::public.muscle_group[], 'dumbbell', 'Stap ver genoeg zodat je voorste knie boven je enkel blijft.'),
  ('Wandelende lunge', array['walking lunge'], 'quads', array['glutes','hamstrings']::public.muscle_group[], 'dumbbell', 'Lopend uitvallen; tel één herhaling per been.'),
  ('Step-up', array['step up'], 'quads', array['glutes']::public.muscle_group[], 'dumbbell', 'Duw je omhoog met je bovenste been, niet met je onderste.'),
  ('Smith machine squat', array['smith machine squat'], 'quads', array['glutes']::public.muscle_group[], 'machine', 'Vaste baan, dus je kan je voeten verder naar voren zetten.'),
  ('Zercher squat', array['zercher squat'], 'quads', array['glutes','abs','lower_back']::public.muscle_group[], 'barbell', 'Stang in je elleboogholtes; vraagt veel van je romp.'),
  ('Sissy squat', array['sissy squat'], 'quads', '{}'::public.muscle_group[], 'bodyweight', 'Knieën naar voren, heupen gestrekt; zwaar op je quadriceps.'),
  ('Box squat', array['box squat'], 'quads', array['glutes','hamstrings']::public.muscle_group[], 'barbell', 'Zit kort op de box zonder te ontspannen, en kom dan omhoog.'),
  ('Pauze squat', array['pause squat'], 'quads', array['glutes']::public.muscle_group[], 'barbell', 'Twee tellen stilstaan onderin voordat je omhoog komt.'),
  ('Pistol squat', array['pistol squat','single leg squat'], 'quads', array['glutes','abs']::public.muscle_group[], 'bodyweight', 'Eén been; houd het andere been gestrekt voor je uit.'),
  ('Belt squat', array['belt squat'], 'quads', array['glutes']::public.muscle_group[], 'machine', 'Gewicht hangt aan je heupen, dus je rug blijft onbelast.'),
  ('Adductie machine', array['hip adduction machine','adductor machine'], 'quads', '{}'::public.muscle_group[], 'machine', 'Voor je binnenste dijbeenspieren; knijp je benen naar elkaar toe.'),

  -- -------------------------------------------------------------------------
  -- Hamstrings en bilspieren
  -- -------------------------------------------------------------------------
  ('Liggende leg curl', array['lying leg curl'], 'hamstrings', array['calves']::public.muscle_group[], 'machine', 'Houd je heupen op het kussen tijdens het buigen.'),
  ('Zittende leg curl', array['seated leg curl'], 'hamstrings', array['calves']::public.muscle_group[], 'machine', 'Zittend staan je hamstrings meer op rek dan liggend.'),
  ('Staande leg curl', array['standing leg curl'], 'hamstrings', '{}'::public.muscle_group[], 'machine', 'Eén been tegelijk.'),
  ('Nordic curl', array['nordic hamstring curl','nordic curl'], 'hamstrings', array['glutes']::public.muscle_group[], 'bodyweight', 'Zak zo langzaam mogelijk naar voren; gebruik je handen om op te vangen.'),
  ('Roemeense deadlift met dumbbells', array['dumbbell romanian deadlift','db rdl'], 'hamstrings', array['glutes','lower_back']::public.muscle_group[], 'dumbbell', 'Zelfde scharnierbeweging als met een stang, dichter bij je lichaam.'),
  ('Stiff-leg deadlift', array['stiff legged deadlift','sldl'], 'hamstrings', array['glutes','lower_back']::public.muscle_group[], 'barbell', 'Knieën vrijwel gestrekt; ga alleen zo diep als je rug recht blijft.'),
  ('Één been Roemeense deadlift', array['single leg romanian deadlift','single leg rdl'], 'hamstrings', array['glutes']::public.muscle_group[], 'dumbbell', 'Eén been; goede test van je balans en heupstabiliteit.'),
  ('Hip thrust', array['barbell hip thrust','hip thrust'], 'glutes', array['hamstrings']::public.muscle_group[], 'barbell', 'Schouderbladen op de bank, kin naar je borst, en knijp bovenin.'),
  ('Glute bridge', array['glute bridge'], 'glutes', array['hamstrings']::public.muscle_group[], 'bodyweight', 'Vanaf de grond; de lichtere versie van de hip thrust.'),
  ('Kabel kickback', array['cable glute kickback'], 'glutes', array['hamstrings']::public.muscle_group[], 'cable', 'Eén been naar achteren strekken, romp stil.'),
  ('Machine hip thrust', array['machine hip thrust','glute drive'], 'glutes', array['hamstrings']::public.muscle_group[], 'machine', 'Sneller op te zetten dan de variant met een stang.'),
  ('Abductie machine', array['hip abduction machine','abductor machine'], 'glutes', '{}'::public.muscle_group[], 'machine', 'Voor je buitenste bilspieren; duw je knieën naar buiten.'),
  ('Reverse hyper', array['reverse hyperextension'], 'glutes', array['lower_back','hamstrings']::public.muscle_group[], 'machine', 'Benen zwaaien naar achteren; rustig aan, niet slingeren.'),
  ('Kettlebell swing', array['kettlebell swing','kb swing'], 'glutes', array['hamstrings','back','cardio']::public.muscle_group[], 'other', 'De kettlebell komt omhoog door je heupen, niet door je armen.'),
  ('Frog pump', array['frog pump'], 'glutes', '{}'::public.muscle_group[], 'bodyweight', 'Voetzolen tegen elkaar, knieën naar buiten, korte stoten omhoog.'),

  -- -------------------------------------------------------------------------
  -- Kuiten
  -- -------------------------------------------------------------------------
  ('Staande kuitheffing', array['standing calf raise'], 'calves', '{}'::public.muscle_group[], 'machine', 'Volledig door tot op je tenen en helemaal terug naar beneden.'),
  ('Zittende kuitheffing', array['seated calf raise'], 'calves', '{}'::public.muscle_group[], 'machine', 'Gebogen knie raakt de diepere kuitspier.'),
  ('Kuitheffing in beenpers', array['leg press calf raise'], 'calves', '{}'::public.muscle_group[], 'machine', 'Alleen je voeten bewegen; knieën blijven bijna gestrekt.'),
  ('Dumbbell kuitheffing', array['dumbbell calf raise'], 'calves', '{}'::public.muscle_group[], 'dumbbell', 'Op een verhoging voor meer bereik.'),
  ('Smith machine kuitheffing', array['smith machine calf raise'], 'calves', '{}'::public.muscle_group[], 'machine', 'Stabiel, dus je kan zwaar gaan.'),
  ('Donkey calf raise', array['donkey calf raise'], 'calves', '{}'::public.muscle_group[], 'machine', 'Voorovergebogen; veel rek op je kuiten.'),

  -- -------------------------------------------------------------------------
  -- Buik en romp
  -- -------------------------------------------------------------------------
  ('Crunch', array['crunch'], 'abs', '{}'::public.muscle_group[], 'bodyweight', 'Rol je bovenrug op; je onderrug blijft op de grond.'),
  ('Kabel crunch', array['cable crunch'], 'abs', '{}'::public.muscle_group[], 'cable', 'Knielend, met het touw achter je hoofd; buig vanuit je buik.'),
  ('Hangend beenheffen', array['hanging leg raise'], 'abs', array['forearms','lats']::public.muscle_group[], 'bodyweight', 'Til met je bekken mee in plaats van alleen je benen te zwaaien.'),
  ('Hangend knieheffen', array['hanging knee raise'], 'abs', array['forearms']::public.muscle_group[], 'bodyweight', 'De makkelijkere versie van hangend beenheffen.'),
  ('Plank', array['plank'], 'abs', array['lower_back','shoulders']::public.muscle_group[], 'bodyweight', 'Span je billen en buik aan. Log de tijd in plaats van herhalingen.'),
  ('Zijplank', array['side plank'], 'obliques', array['abs']::public.muscle_group[], 'bodyweight', 'Heupen hoog houden. Log de tijd per kant.'),
  ('Russian twist', array['russian twist'], 'obliques', array['abs']::public.muscle_group[], 'bodyweight', 'Draai vanuit je romp, niet alleen met je armen.'),
  ('Ab wheel', array['ab wheel rollout','ab roller'], 'abs', array['lower_back','lats']::public.muscle_group[], 'other', 'Rol zo ver als je je onderrug recht kan houden.'),
  ('Sit-up', array['sit up'], 'abs', array['quads']::public.muscle_group[], 'bodyweight', 'Volledig omhoog; rustig terug.'),
  ('Bicycle crunch', array['bicycle crunch'], 'obliques', array['abs']::public.muscle_group[], 'bodyweight', 'Elleboog naar de tegenoverliggende knie.'),
  ('Mountain climber', array['mountain climber'], 'abs', array['cardio','shoulders']::public.muscle_group[], 'bodyweight', 'Heupen laag houden en het tempo opvoeren.'),
  ('Dead bug', array['dead bug'], 'abs', '{}'::public.muscle_group[], 'bodyweight', 'Onderrug tegen de grond gedrukt houden tijdens de hele beweging.'),
  ('Pallof press', array['pallof press','anti rotation press'], 'obliques', array['abs']::public.muscle_group[], 'cable', 'Weersta de draai; je romp blijft recht naar voren wijzen.'),
  ('Woodchopper', array['cable woodchopper','woodchop'], 'obliques', array['abs','shoulders']::public.muscle_group[], 'cable', 'Diagonale beweging van hoog naar laag of andersom.'),
  ('Hollow hold', array['hollow body hold'], 'abs', '{}'::public.muscle_group[], 'bodyweight', 'Onderrug tegen de grond. Log de tijd.'),
  ('Toes to bar', array['toes to bar','t2b'], 'abs', array['lats','forearms']::public.muscle_group[], 'bodyweight', 'Tenen tot aan de stang; vraagt ook grepkracht.'),
  ('Machine crunch', array['machine ab crunch','ab machine'], 'abs', '{}'::public.muscle_group[], 'machine', 'Makkelijk om progressief zwaarder te maken.'),

  -- -------------------------------------------------------------------------
  -- Nek
  -- -------------------------------------------------------------------------
  ('Nekextensie', array['neck extension'], 'neck', '{}'::public.muscle_group[], 'other', 'Heel licht beginnen en langzaam bewegen.'),
  ('Nekflexie', array['neck flexion','neck curl'], 'neck', '{}'::public.muscle_group[], 'other', 'Heel licht beginnen en langzaam bewegen.'),

  -- -------------------------------------------------------------------------
  -- Cardio  (log tijd en/of afstand in plaats van herhalingen)
  -- -------------------------------------------------------------------------
  ('Hardlopen', array['running','run','jogging'], 'cardio', array['quads','calves']::public.muscle_group[], 'cardio', 'Log je tijd en afstand.'),
  ('Loopband', array['treadmill'], 'cardio', array['quads','calves']::public.muscle_group[], 'cardio', 'Log je tijd en afstand.'),
  ('Fietsen', array['cycling','bike','bicycle'], 'cardio', array['quads']::public.muscle_group[], 'cardio', 'Log je tijd en afstand.'),
  ('Hometrainer', array['stationary bike','spinning'], 'cardio', array['quads']::public.muscle_group[], 'cardio', 'Log je tijd en afstand.'),
  ('Roeimachine', array['rowing machine','erg','rower'], 'cardio', array['back','lats','quads']::public.muscle_group[], 'cardio', 'Volgorde: benen, romp, armen. Log je tijd en afstand.'),
  ('Crosstrainer', array['elliptical','cross trainer'], 'cardio', array['quads','glutes']::public.muscle_group[], 'cardio', 'Log je tijd.'),
  ('Stairmaster', array['stair climber','stairmaster'], 'cardio', array['glutes','quads','calves']::public.muscle_group[], 'cardio', 'Niet op de leuningen hangen. Log je tijd.'),
  ('Springtouw', array['jump rope','skipping'], 'cardio', array['calves']::public.muscle_group[], 'cardio', 'Log je tijd of het aantal sprongen.'),
  ('Zwemmen', array['swimming'], 'cardio', array['full_body','lats']::public.muscle_group[], 'cardio', 'Log je tijd en afstand.'),
  ('Wandelen', array['walking','walk'], 'cardio', array['quads','calves']::public.muscle_group[], 'cardio', 'Log je tijd en afstand.'),
  ('Assault bike', array['air bike','assault bike','echo bike'], 'cardio', array['full_body']::public.muscle_group[], 'cardio', 'Armen en benen tegelijk. Log je tijd.'),
  ('Sled push', array['sled push','prowler push'], 'quads', array['glutes','cardio','calves']::public.muscle_group[], 'other', 'Lage romp, korte passen. Log je afstand.'),
  ('Burpee', array['burpee'], 'full_body', array['cardio','chest','quads']::public.muscle_group[], 'bodyweight', 'Tempo boven perfectie, maar hou je rug neutraal bij het opstaan.'),

  -- -------------------------------------------------------------------------
  -- Hele lichaam en olympisch
  -- -------------------------------------------------------------------------
  ('Power clean', array['power clean'], 'full_body', array['traps','quads','back']::public.muscle_group[], 'barbell', 'Techniek voor gewicht: laat dit desnoods een keer nakijken.'),
  ('Hang clean', array['hang clean'], 'full_body', array['traps','quads','back']::public.muscle_group[], 'barbell', 'Begint vanaf je knieën in plaats van vanaf de grond.'),
  ('Clean and jerk', array['clean and jerk'], 'full_body', array['shoulders','quads','traps']::public.muscle_group[], 'barbell', 'Twee bewegingen achter elkaar; oefen ze eerst apart.'),
  ('Snatch', array['snatch'], 'full_body', array['shoulders','traps','quads']::public.muscle_group[], 'barbell', 'Brede greep, in één beweging van de grond naar boven je hoofd.'),
  ('Clean pull', array['clean pull'], 'traps', array['back','quads','hamstrings']::public.muscle_group[], 'barbell', 'De eerste helft van een clean, zonder hem te vangen.'),
  ('Thruster', array['thruster'], 'full_body', array['shoulders','quads','triceps']::public.muscle_group[], 'barbell', 'Front squat die direct overgaat in een druk boven je hoofd.'),
  ('Turkish get-up', array['turkish get up','tgu'], 'full_body', array['shoulders','abs','obliques']::public.muscle_group[], 'other', 'Langzaam en stap voor stap; begin licht.')
on conflict (lower(name)) where not is_custom do nothing;
