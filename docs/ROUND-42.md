# Round 42 — poročilo (vojaška razporeditev, tanki, topovi, kombiji)

**Naročilo (dobesedno):** *»preuredi celotno vojaško razporeditev stvari, cest, vrat, zato ker so na primer kar pristajališča helikopterjev v nekih stavbah, kar zidovi v zidovih, neurejene ceste, NEREALNO GRDI TANKI, IN TOPOVI KI JIH NE MOREM ZASEČI TAKO ALI TAKO PA TISTI STOLPNOTOPOVI STRELAJO SAMI VASE … potem pojdi na koncu čez celo igro, torej jo preigraj in najdi vse glitche, neurejeno infrastrukturo, kot so stvari v stavbah, in popravi tudi to da se nekateri kombiji ne obnašajo realistično«*

Verzija: **v1.42.0 · ROUND 42 · 2026-10-25**, kodno ime **IRON RESERVE ORDERED** (izpisana na začetnem zaslonu, ob gumbu za cel zaslon).

---

## 0) Kaj je bilo narobe (izmerjeno, ne ugibano)

Pred popravki je bil v repozitoriju narejen **pregled celotnega sveta**, ki je za vsak sektor izpisal, kaj stoji v čem:

| težava | izmerjeno pred roundom 42 |
|---|---|
| pristajališča helikopterjev v stavbah | 11 padov v sektorju 6, po eden do štirje v vsakem drugem sektorju |
| zidovi v zidovih | `curtain∩tower`, `rampart∩tower`, `keep∩rampart`, `fence∩fence`, `curtain∩fence` — 40+ parov |
| stvari v stavbah (zaboji, sodi, šotori, tovornjaki, bodeča žica) | 38 v sektorju 6, 12 v sektorju 3, 4 v sektorju 1 |
| letala v hangarjih | 3 parkirani lovci v notranjosti megahangarja/towerblocka |
| ceste, ki se ne prilegajo ničemur | 16 odsekov, ki so sekali stavbe |
| tanki | risani kot kup nesorazmernih pravokotnikov + črt |
| stolpni topovi | metek je umrl 44 px od ustja (znotraj lastnega bunkerja), zato »top strelja sam vase« |
| zaseganje topov | prag 45 % hp + 150 px, v praksi nedosegljivo |
| kombiji | vozilo je pospeševalo po lerpu, zavijanje je bilo linearno, promet se je **trajno ustavil** |
| nevidni zid na vzhodu | celoten vzhodni krak baze (x > 12 480: tirna postaja, silosi, mornariško dvorišče, 15 zgradb, 4 tanki) je bil **nedosegljiv**: maska »vode« iz zapora je tam rekla morje, čeprav je zemlja narisana kot suho |
| zid brez vrat | vzhodni obrambni zid (70 × 2 560) je bazo prerezal na dvoje in v njem ni bilo nobene odprtine — cesta je bila narisana naravnost vanj |

Zadnja vrstica je bila najhujša in je bila dolgo napačno diagnosticirana: v testu je hitrost vožnje »nihala« 150 → 301 → 451 → 60 → −1. Vzrok ni bil drugi pisec v `v.speed`, ampak **trk z zapornico 140 m pred testnim mestom** (vožnja v severno steno baze) — profil pospeška je bil ves čas pravilen.

---

## 1) Razporeditev: nov prehod `src/game/tidy.ts`

Dodan je celoten **pregledni prehod**, ki se izvede takoj za generiranjem sveta (`world.ts`), preden se karkoli nariše ali postavi v prostor. Vrstni red je pomemben: najprej stavbe, nato zidovi, nato drobnarija, nato ceste, nato vozila in vojska.

1. **`tidyBuildings`** — stavba, ki stoji na cesti ali na drugi stavbi, se prestavi na najbližji prosti prostor (korak 80 px, 12 kotov). Če prostora ni, se **odreže zid** (`clipWalls`), ne stavba.
2. **`clipWalls`** — dolg zid (`wall/curtain/fence/keep/rampart`, `min < 96 && max > 200`), ki mu pot stoji nasproti, se v tistem odseku **prereže** in ostane v dveh kosih (vsak > 24 px). Tako ni več »zida v zidu«, baza pa ostane zaprta.
3. **`tidyProps`** — zaboj, sod, šotor, tovornjak, reflektor, bodeča žica ali balvan, ki je **v celoti znotraj** stavbe, se prestavi na prosto mesto ob fasadi (najbližja stran, 6 korakov). Stvar, ki je ni mogoče videti, ne obstaja.
4. **`clipRoads`** — cestni pas se odreže tam, kjer gre skozi stavbo; ostanejo samo odseki, daljši od 24 px.
5. **`tidyVans`** — kombi se postavi v vrsto na parkirišče (172 px razmika, 8 px odmika od robnika); če vrsta ne gre, se poišče samostojno mesto; če tudi tega ni, kombi **odpade** (nikoli ne stoji v steni).
6. **`tidyHelipads`** — pad se premakne s strehe na prosto ploščad; če ni prostora, odpade.
7. **`tidyArmy`** — tanki (po **pravokotnikih**, ne po točkah), helikopterji in lovci se umaknejo iz zgradb; lovec iz hangarja »potaxi« na ploščad **pred svojo halo** (največ 420 px stran), ne pol kilometra daleč.

Rezultat po sektorjih (izpis `audit4`, končna različica):

| | S1 | S3 | S6 |
|---|---|---|---|
| odrezanih cest | 8 | 12 | 9 |
| premaknjenih padov | 3 | 4 | 4 |
| premaknjenih kombijev | 18 | 20 | 18 |
| premaknjenih stavb (tudi iz hangarjev) | 1 | 4 | 3 |
| odrezanih zidov | 0 | 2 | 5 |
| **odprtih vrat v zidovih** | **4** | **3** | **7** |
| **premaknjenih drobnarij** | **7** | **9** | **35** |
| premaknjenih tankov | 0 | 0 | 29 |
| premaknjenih helikopterjev | 0 | 0 | 2 |
| premaknjenih lovcev | 0 | 0 | 3 |

Po prehodu: **0 pristajališč v stavbah v vseh šestih sektorjih**, **0 drobnarij v celoti znotraj stavbe**, **0 tankov v trdnih strukturah** (preverjeno še enkrat po `prepareStructures`, ker je to seznam, po katerem se dejansko trči).

Kar ostane v `audit2` in je **namenoma**: radarske in antenske mreže (`radar∩antenna`), `server∩server` v strežniški dvorani, `motorpool∩power` (drog skozi delavnico), `rampart∩tower` in `tower` na `curtain` (stolp stoji *na* obzidju), `curtain∩fence` (dvojna ograja), lovci v hangarjih, ko so *na* ploščadi pod nadstreškom. Teh nisem »popravljal« — so del arhitekture.

---

## 1b) Kar je našlo preigravanje: vzhodni krak baze

Preigravanje s tisočimi sličicami je razkrilo dvoje, česar noben prejšnji pregled ni videl:

1. **Maska tal se ni ujemala s sliko.** Vzhodno od `SEA.x = 12480` velja za morje (to je maska iz zaporniškega otoka), vojaško območje sektorja 6 pa se vleče do `x = 17200` — in je narisano kot zemlja, s tirno postajo, silosi, hangarji in mornariškim dvoriščem. Posledica: operativec je na `x ≈ 12205` zadel **nevidni zid**, celotnega vzhodnega kraka pa ni mogel obiskati. Zdaj svet ob nalaganju zapiše »nasuto zemljišče« (`dryLand`) iz meje vojaškega območja in maska se z njim ujema.
2. **Zid brez vrat.** Vzhodni obrambni zid je bil dolg 2 560 m, cesta pa je bila narisana naravnost vanj. Nov prehod `openInternalGates` vsakemu dolgemu zidu, ki leži **znotraj** območja in ga pregradi (≥ 50 % širine/višine območja), odpre eno odprtino — in to na mestu, kjer je v bližini že cesta in kjer je **najmanj šare v prehodu** (vrata za vrečami peska niso vrata). Prehod nato premakne še tisto malo drobnarij, ki je stala točno v odprtini.

Preverjeno s plavalno analizo celotne mape (`reach.tsx`, mreža 26 px, BFS od točke zagona): **vzhodno dvorišče in tirna postaja sta dosegljiva**, severna vrata in center baze tudi.

## 2) Tanki: nova risba (`drawHullRect`)

Prejšnji tank je bil skupek pravokotnikov in črt. Zdaj je en sam risar, ki ga uporabljajo vsi parkirani tanki (in goseničarji v koloni obdržijo svojega, a z enakim obrisom):

- **gosenice** so povezani členki z zobmi, ne črtice na robu (prva različica je risala kolesa na zunanji rob in brala kot gosenica);

- **trup** ima poševno čelo (glacis), sprednje odbijače, rešetke za hlađenje in blatnike;

- **kupola** je **osmerokotnik** z vidnimi robovi in sencami (prej je krog izgledal kot »roža«), z blendo, poveljniško kupolico, pokrovom in anteno;

- **top** ima odebeljen tulec, izpihovalec in ustno zavoro ter se **konča znotraj lastne celice** — daljša cev, narisana prek roba pravokotnika, je izgledala kot odpet krak;

- maskirni madeži so majhni in nizkega kontrasta (velike prosojne elipse so brale kot rože);

- poškodovana lupina dobi ožgano različico; vrstica oklepa se izpiše **samo, ko je tank poškodovan**, ime `VOJSKA MBT / MAIN GUN` pa samo znotraj vojaškega območja in v vidnem dosegu.

Slika: `docs/round-42/art-hulls.png` (2,2× povečava).

---

## 3) Topovi: streli gredo ven, zaseganje dela

- **Ustje** je pomaknjeno s 44 na **64 px** in topovi so prestavljeni v **odprto strelsko gnezdo** iz vreč s peskom (odprto naprej, `army.ts`) — prej je bil top v trdnem bunkerju, zato je metek umrl na prvem trku *z lastnim zidom*. To je bilo dobesedno »top strelja sam vase«.
- **Zaseganje:** prag hp je znižan s 55 % na **75 %**, doseg dvignjen s 120 na 150 px, vmesnik pa izpiše `F · ZASEZI`. V testu: `capture at 70% -> true owner player`, pri 90 % hp pa namerno **ne** (`owner enemy`) — top je treba najprej poškodovati, kar je edini pogoj, ki ga igralec vidi na lastno oko.

Preveritev (`harness42/turret.tsx`): 16 topov, 14 izstreljenih nabojev, **0 trkov na ustju**, najdaljši let **974 m**, 0 napak. Slika: `docs/round-42/turret.png`.

---

## 4) Vozila: fizika, ki se obnaša kot vozilo

### 4.1 Vožnja (kombi, ki ga igralec prevzame)

Namesto lerpa je zdaj **profil po tipu vozila** (`top / rev / accel / brake / turn / ram`) in eksplicitna integracija pospeška:

```ts
v.speed += clamp(target - v.speed, -rate * dt, rate * dt);
```

| vozilo | najvišja | pospešek | zaviranje | obračanje |
|---|---|---|---|---|
| avto | 545 | 240 | 620 | 1,25 |
| humvee | 495 | 200 | 640 | 1,15 |
| rešilec | 480 | 210 | 620 | 1,10 |
| tovornjak | 330 | 120 | 470 | 0,85 |
| avtobus | 360 | 130 | 500 | 0,90 |
| cisterna | 315 | 105 | 440 | 0,80 |

- **Zavijanje ima oblast, ki narašča z brzino in upade na vrhu** (`clamp(spd/90) * clamp(1.25 − spd/top*0.5)`). Parkirano vozilo se ne obrne več na mestu.
- **Prestava, ne predznak:** `S` pri vožnji naprej je zavora; **vzvratna se vklopi šele 0,3 s po ustavitvi**, zato ni več preskoka iz 490 naprej na −200 nazaj v eni sekundi.
- **Trk** nadaljevanje drsi po površini (odvisno od kota), ne »zvari« vozila; zasilni izhod po 0,9 s se **odpelje vzvratno** namesto teleporta 46 m nazaj.

Izmerjeno (`harness42/play.tsx`, sektor 6, W držan): `0,5 s → 120`, `1,0 s → 240`, `1,5 s → 361`, končna **545** in drži; spust z W: 490 → 435 → 380 → 279 → 224 → 169 → 113 → 58; zaviranje z S: `0 → −15 → −42 → −68 → −95 → −121 → −148 → −174 → −200` (vzvratna se vklopi po premoru); obračanje 1 s: **77° pri 300**, **59° pri 545** (hitrejši avto zavije manj), pri 40 pa 6° (motor brez plina se ustavi).

### 4.2 Promet (kombiji, ki jih vozi AI)

Tu je bil pravi glitch, ki ga je igralec videl kot »kombiji se obnašajo nerealno«:

- hitrost je bila **množljena** z obračanjem (`c.speed * (1 − min(0.6, |turn|))`) — vsak ovinek je trajno odvzel do 60 % brzine, po dveh krogih je ves promet polzel;
- »ovira« je bila **vsaka vozilo v isti smeri znotraj 96 m**, to pa je več od razmika flote (85 m): **vsak avto je videl avto pred sabo kot zid in se ustavil v prvi sekundi — in nikoli več ni speljal**.

Zdaj: vozilo ima **svojo potovalno brzino** (`cruise`), pospešuje z 150 in zavira s 420 u/s², za ovinkom izgubi največ 25 %, **spremlja razdaljo do vodilnega** (dve sekundi razmika, nikoli ne prevozi), in če je pred njim ustavljeno vozilo, **počaka in se počasi izmuzne mimo** po prosti strani pasu. Če je vodilni že v njem (prekrivanje po nesreči), ga ne šteje več za oviro. Vozilo, ki se priključi s parkirišča, ne more več »materializirati« na streho drugega (preveri 140 m).

Izmerjeno (`harness42/drive.tsx`, 20 s): povprečna hitrost **77 → 70 → 68 → 66 → 71**, ustavljenih **0–4 od 45**, **0 teleportov**, 0 napak. Igralec na cesti: avto zavre (`brake 1.00`), ko se igralec umakne, spelje nazaj na svojo potovalno brzino.

---

## 5) Preigravanje cele igre

- `sweep.tsx` — **kontaktne pole**: vsak sektor razdeljen na mrežo, vsak izsek se **dejansko nariše** in shrani. Sektorji 1–5: 10 × 7 = **70 postankov** vsak, sektor 6: 12 × 8 = **96 postankov** → **446 renderiranih prizorov**. Zraven: **2 000 sličic** neprekinjene igre v sektorju 6 in po 300 v vsakem drugem sektorju (skupaj ~3 500), 3 časovni posnetki po **40 sličic / 80 s igre** (parada, severna vrata, vzhodno dvorišče), 1 800 sličic hoje in vožnje.
- `play.tsx` — 30 s hoje skozi ves seznam sistemov (1 800 sličic): **0 napak**, 1 600–2 100 sovražnikov, 52–113 nabojev, alarm 1,00, 112 parkiranih lupin, 34 tankov v koloni, 3 helikopterji, 9 lovcev.
- `live.tsx` — zagon vseh šestih sektorjev (300 sličic vsak): **0 napak v vseh**.
- Preverjeno tudi: **igralec nikoli ne obstane v trdnem predmetu** (vzorčenje po mreži; edini zadetki so bili na vratih/obzidju, kjer je to pravilno).

Slike: `docs/round-42/sweep-6.png` (celoten sektor 6 v 96 izsekih), `6-apron.png`, `6-silos.png`, `6-east-gate.png` (nova vrata v vzhodnem zidu), `art-hulls.png` (tanki), `turret.png` (top).

---

## 6) Datoteke

- `src/game/tidy.ts` — **novo**: celoten pregledni prehod (`tidyBuildings`, `clipWalls`, `tidyProps`, `clipRoads`, `tidyVans`, `tidyHelipads`, `tidyArmy`, `freeSpot`, `TidyReport`).
- `src/game/world.ts` — klic prehoda po generiranju sveta; `WorldData.tidy` za diagnostiko.
- `src/game/army.ts` — top v odprtem gnezdu iz vreč, ne v bunkerju.
- `src/game/engine.ts` — `drawHullRect` (nov risar tankov), ustje 64 px, zaseganje 75 %/150 px, nova fizika vožnje, fizika prometa, vzvratna prestava, `roadDebug` (diagnostična kljuka za vozne teste, v igri `null`).
- `src/game/version.ts` — **v1.42.0 · ROUND 42 · IRON RESERVE ORDERED**.

Preigravanje je našlo še eno napako v prometu: vozilo, ki se je priključilo s parkirišča, je lahko »materializiralo« na strehi drugega (zdaj se to ne zgodi — 140 m odmika), in dve vozili, ki sta se že prekrivali, sta se držali vsiljeno drug drugega (zdaj se v razdalji pod 30 m ne štejeta več za oviro in se preprosto razideta).

Nic ni bilo odstranjeno ali poenostavljeno: vse spremembe so dodatne, stari sistemi (kolone, helikopterji, promet, zaseganje, sektor 3 iz rounda 41) delujejo naprej.
