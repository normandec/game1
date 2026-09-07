# FAZA 0 — ANALIZA OBSTOJEČE IGRE (IRON VEIL: Black Vault)

Datum analize: 2026-09-06 · veja: `arena/01a0773f-game1` · osnovni commit: `5d234ccb`

 Namen tega dokumenta: popisati, kaj v igri **že obstaja in deluje**, kaj je **pokvarjeno**,
katere sisteme bo treba **izboljšati** in katere **dodati**, ter kje so **tveganja**.
Velika nadgradnja se začne šele po potrditvi te analize.

---

## 1. Kaj je v repozitoriju

| Datoteka | Vrste | Vloga |
|---|---|---|
| `game1 (1).zip` | – | izvorni arhiv (bil je edina vsebina commit-a; razpakiran v drevo) |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` | – | React 19 + Vite 7 + Tailwind 4 + Three.js, build v **eno samo HTML datoteko** (`vite-plugin-singlefile`) |
| `src/main.tsx`, `src/App.tsx` | 10 / 248 | zagon, stanja (menu/playing/paused/upgrade/transit/victory/interior), HUD wiring |
| `src/game/engine.ts` | **7586** | celotna simulacija + 2.5D canvas renderer (razred `Game`) |
| `src/game/world.ts` | 725 | generacija zemljevida 12000 × 8200, trdnjava HQ, letališče, laserji, SSR postaje, vault, ceste, skladišča, prostorski indeks `SpatialGrid` |
| `src/game/campaignSites.ts` | 171 | GOLIATH (logistična trdnjava), HELIOS (elektrarna), MNEMOSYNE (knjižnica), mega zaboji, **patrolje** |
| `src/game/facilities.ts` | 162 | 8 tipov objektov (checkpoint, lab, radar, motorpool, power, armory, warehouse, library), njihova oprema in stražarji |
| `src/game/facilityArt.ts` | 291 | predpomnjena umetnija objektov in strešni prerezi |
| `src/game/installations.ts` | 151 | hidravlična vrata, sobni detajli, risanje |
| `src/game/navigation.ts` | 152 | `RoutePlanner` = A* z očiščenjem (clearance), segment/box testi |
| `src/game/security.ts` | 61 | reflektorji, izpostavljenost, alarm, sledenje |
| `src/game/destruction.ts` | 48 | uničljive strukture, razbitine |
| `src/game/airlift.ts` | 125 | ATLAS (letalo s padalci), MANTIS (dvorotorski transport z vrvjo), risanje |
| `src/game/vehicleArt.ts` | 66 | risanje kombija/transporterja in parkiranega helikopterja |
| `src/game/audio.ts` | 170 | proceduralni WebAudio (brez sredstev/assetov) |
| `src/game/campaign.ts`, `scores.ts` | 28 / 73 | zgodba po fazah, lokalni highscore |
| `src/components/*` | 1452 | HUD, meni, zasloni, 3D trezor (Three.js) |

Arhitektura: **en velik razred `Game`** (canvas 2D, brez fizikalnega pogona — vsa "fizika"
je lastna kinematika), svet se generira v `generateWorld(sector)` in vrne `WorldData`
(seznami točk/pozicij), `Game.reset()` pa iz teh seznamov ustvari entitete.

---

## 2. Kaj že obstaja in **deluje** (preverjeno)

Preverjeno s produkcijskim buildom (`npm run build` ✅), `tsc --noEmit` ✅ in **headless
testnim okoljem** (pravi `Game` zagnan v Node z nadomeščenim DOM/canvasom, merjenje stanja
po N okvirjih):

**Zemljevid in baze**
- 5 sektorjev (teme, vreme), arena 12000 × 8200; trdnjava HQ 3900 × 2950 z obzidjem, 4 stolpi,
  notranjim obročem, keep-om, 6 "mainframe" strežniki, generalom, programerji.
- Letališče KRAKEN 2700 × 2050: 5 hangarjev, kontrolni stolp, 36 parkiranih kombijev,
  parado (72 vojakov v 6 vrstah), 2 pristajališči, ograja z vrati.
- GOLIATH 2360 × 2060: 4 skladišča (1150 × 430), mega zaboji, 16 kombijev, gantri.
- HELIOS 880 × 780: **6 generatorjev + 4 strežniške omare**, stražarji, reflektorji.
- MNEMOSYNE knjižnica (3 knjige, uganka III-I-II), 2 laserski bateriji, 3 SSR postaje,
  skriti vault (vhod X 980 / Y 7040), 11 gorivnih dvorišč, 5 satkomov, ~1750 struktur.
- 17 naključno razporejenih objektov (facilities) s 146 stražarji; 22–42 utrjenih postojank.

**Enote in AI**
- 24 tipov enot (grunt, rusher, gunner, shieldman, heavy, sniper, bomber, commander, guard,
  sentinel, breacher, warden, pathfinder, medic, sapper, raider, warhound, drone, specter,
  juggernaut, turret, boss, coder, general).
- Formacije (`formationSlot`: phalanx/turtle/blitz/bombers/column/pincer/encircle/ambush),
  vodniki (leader), morala, panika, voljni ogenj (volley), metanje granat, iskanje zavetje,
  medic (zdravi), sapper (mine), raider/warhound (napad), prilagodljiv AI direktor
  (profilira igralca: mobilnost, kampiranje, razdalja, uporaba zavetja).
- Garnizon spi, dokler ni zaznan; radijski alarm zbudi sosednje enote.
- **16 patrolj** (`patrolTeams`) v dvovrstni formaciji okoli letališča, Goliatha, HELIOS-a in cest.

**Vozila / letala**
- Kombiji (vans): parkirani, rezervirani za odziv, vodljivi s strani igralca (W/S plin, A/D
  volan, Shift boost, top), A* poti, zaznavanje prometa, obvoz (`bypass`), vzvratna vožnja ob
  zataknitvi, **vidno vkrcavanje** vojakov (staged boarding: vojaki hodijo v koloni do vozila
  in izstopajo eden za drugim), medicinski kamion (pobira ranjence).
- Helikopterji (gunship/medevac): `startup → taxi-out → takeoff → ingress → strafe → orbit →
  egress → landing → taxi-in → service`, rakete, top, bankanje.
- VTOL dostavniki, ATLAS (padalci), MANTIS (hitra vrv), zračne enote postanejo kopenske šele
  po spustu; bomber NIGHTJAR (gorivo, bombe, topovi).

**Sistemi ciljev in dogajanja**
- Faze valov: recon → convoy → bombard → assault → siege, zgodba po fazah, banner/HUD.
- Reflektorji z resničnim LOS in izpostavljenostjo → 30 vojakov v 5 kombijih; 75 s cooldown.
- Vdor v HQ / hangarje → 8 kombijev × 8 vojakov (latched enkrat na sektor).
- **Blackout**: uniči vse celice HELIOS → reflektorji ugasnejo, nočni overlay, vojaki prižgejo
  čelne lučke (vidni snopi), iskalne skupine, 4 odzivne naročila, HUD "NIGHT / HEADLAMPS INBOUND".
  Preverjeno v testu: `active=true, 10/10 celic mrtvih, 0 reflektorjev, 14 kombijev v odzivu`.
- Uničevanje: zidovi razdeljeni na neodvisne sekcije, razbitine, sodi (verižne eksplozije),
  zaboji, cache-i, mega zaboji (6 tipov plena: tesseract, thumper, DMR, AEGIS, nano-stim, rockets).
- Prevzem baz (`baseOverride`) + obleganje (`beginSiege`) z valovi proti igralcu.
- Hidravlična vrata (zaklep/odklep, preboj), barikade, AEGIS ščit, mine, ranjenci, supply drop.

---

## 3. Kaj je bilo **pokvarjeno** (že popravljeno — nujni popravki, ne nadgradnja)

1. **Usoden zagon: igra se sploh ni zagnala.**
   `campaignSites.ts` (posadke Goliath, HELIOS, patrol `helios-wire`, `kraken-column-b`) in
   `engine.ts` (sestevek valov, prevzem baze) uporabljajo tip enote **`flamer`**, ki ga v
   `ENEMIES` **ni bilo**. `makeEnemy()` je dobil `undefined` → `TypeError` v `reset()` →
   `new Game()` vrže napako → prazen zaslon.
   *Popravek:* dodan `flamer` (metalec ognja: 145 HP, kratek domet, 3 pellete, vidni ognjeni
   stožec, gorivni nahrbtnik in šoba v risanju) ter varnostna rezerva `ENEMIES[type] || grunt`,
   da neznano ime nikoli več ne podre simulacije. **Nobena obstoječa funkcija ni odstranjena.**

2. **Zmogljivost: 8,6 ms/okvir samo za simulacijo** (brez risanja), od tega **5,8 ms (67 %)
   `updateGates`**, ker je za *vsaka vrata* (112) pregledal *vse* sovražnike (389) s `Math.hypot`
   (3× na vrata ≈ 131.000 klicev/okvir).
   *Popravek (brez spremembe pravil):* prostorski razredi sovražnikov na okvir, kvadrirane
   razdalje, predizračunani listi vrat za strele, swept-AABB izločanje pri centriranih zadetkih,
   `collide()` brez `Set`-ov (žigovno razduplikacijo), lokalna poizvedba premičnih blokov,
   indeks članov oddelkov namesto O(n²) filtrov, en sam uporabljen `Set` za LOS.
   **Rezultat: 8,6 → 2,5 ms/okvir (3,4× hitreje)** — nujno, ker bo nadgradnja dodala še več entitet.

3. Manjše ugotovljeno (še **ni** popravljeno, bo del nadgradnje):
   - Helikopter brez `home` hangarja ob egresu **izgine** (`this.helis.splice`) — to je točno
     pritožba iz navodil ("ne sme izginiti brez razloga").
   - `h.home` je indeks **parkiranega helikopterja**, uporablja pa se kot indeks **hangarja**
     (`this.hangars[h.home]`) — deluje le, ker je trenutno razmerje 5 : 5. Če dodam več
     helikopterjev kot hangarjev, se sistem zmede → treba pravilno povezati "zaliv" (hangar **ali**
     pristajališče) za vsak helikopter.
   - VTOL ob odhodu leti proti HQ in se pobriše pri `y < -400` (brez pristanka).
   - Blackout zahteva **vseh 10** celic (generatorji *in* strežniki) — ni vmesnih stopenj temnenja.
   - Konvoji so vezani na igralca (cilj se vsakič preračuna), ni "čistega" cestnega konvoja, ki
     bi se odpeljal čez zemljevid in izginil **na robu**.
   - `groundFactor()` pregleda vse cone (177+) na klic — ob večjih bazah postane opazen strošek.

---

## 4. Kaj obstaja in kaj manjka glede na zahteve (preslikava 22 točk)

| Zahteva | Stanje danes | Kaj je treba narediti |
|---|---|---|
| 2. Večje, podrobnejše baze | HQ 3900×2950, 5 hangarjev, 36 kombijev | povečati HQ/letališče, več parkiranih vozil, več objektov, več prostora med njimi |
| 3. Kompleks generatorjev/strežnikov | HELIOS 880×780, 6 gen + 4 srv, 12 stražarjev, 2 patrolji | močno povečati (12+ gen, 8+ srv, omare, kabli, hladilni stolpi, več vrat/poti, več stražarjev in patrolj, lokalna zatemnitev) |
| 4. Izpad elektrike | deluje, a šele ko umrejo **vse** celice | dodati **stopnjevan** izpad (obratna moč omrežja), lokalne izpade po bazah, ugasnejo hangarji/skladišča, več odziva |
| 5. Patrolje in vrste enot | 16 patrolj, 2-vrstna formacija | več patrolj (okoli skladišč, hangarjev, cest, kompleksa), **vrste** (4 in več), različne hitrosti/velikosti, odziv na izpad |
| 6. Vidno vkrcavanje | obstaja za kombije (staged) in helikopterje z vrvjo | razširiti na helikopterje na tleh (vojaki tečejo do bird-a, vkrcanje, vzlet), letala, več animacij |
| 7. Transportni helikopterji | ATLAS (letalo) + MANTIS (rotorcraft) + VTOL | več tipov, boljše pristajanje/vzlet, **vsak ima svoje pristajališče**, vračanje namesto izginotja |
| 8./9. Več helikopterjev, boljša fizika | 5 hangarjev/5 parkiranih, gunship+medevac | več helikopterjev in tipov, boljše obračanje/pristanek/egress, brez nenadnih obratov |
| 10. Fizika vozil, manj zatikanja | A* + bypass + reverse | boljše krmiljenje (hitrostno odvisno), zdrsi, vzmetenje, rob zemljevida, manj zataknitev |
| 11. Letalo | bomber z `lerp` hitrostjo, bankanje | vzlet/pristanek, vztrajnost, povezava banke in obrata, brez zatikanja kril |
| 12. Več fizike za vsa vozila | delno | enoten model (pospešek/zaviranje/zdrs/trki) za vse |
| 13. Konvoj po cestah | kombiji vozijo k igralcu | **pravi cestni konvoj** z voznim redom po cestah, izgine **na robu zemljevida**, napadljiv |
| 14. Močno orožje v konvoju | konvoji vozijo vojake | oboroženi spremljevalni kamioni (topovi), raznovrsten plen, več tipov streliva |
| 15. Skladišča z ogromnimi škatlami | 4 zalivi Goliath, 6 mega zabojcev, `pallet` props | večja skladišča, veliko več **ogromnih** zabojev (različne velikosti/barve/oznake), polni hodniki |
| 16. Raketomet v skladišču | obstaja mega zaboj `arsenal` → `rocket` (10 raket) | razširiti: raketomet z več raketami, menjava orožja, dodatno strelivo, jasen prikaz |
| 17. Težji prevzem baz | `baseOverride` zahteva 0 branilcev, nato obleganje | več branilcev/stolpov/vozil, več korakov prevzema |
| 18. Več parkiranih vozil | 36 kombijev + 15 kamionov + 5 helikopterjev | več parkirišč po vseh bazah, hangarjih, cestah |
| 19. Večji hangarji | 460 × 330, vrata 230 | večji hangarji (težki hangarji), več letal, prostor za vkrcavanje, živahno dogajanje |
| 20. Dodatne stvari | – | po izbiri: nove enote, objekti, konvoji, obramba |

---

## 5. Katere datoteke bom spreminjal

**Obstoječe (izboljšave, brez odstranjevanja):**
- `src/game/world.ts` — večji HQ/letališče, več hangarjev, pristajališč, parkiranih vozil,
  skladišč, obrambe, generatorjev po bazah, nove cone/patrolje.
- `src/game/campaignSites.ts` — HELIOS (velik kompleks), GOLIATH (skladišča z ogromnimi
  zaboji, raketomet), nove patrolje, cestne poti za konvoj.
- `src/game/facilities.ts` — večje dimenzije objektov, več stražarjev/vrst, več opreme.
- `src/game/facilityArt.ts` — umetnija za nove prop-e/objekte (ob obstoječem predpomnjenju).
- `src/game/security.ts` — lokalni izpadi po bazah, odziv na temo (če bo potrebno).
- `src/game/navigation.ts` — le če bo potrebno za konvoje (npr. poti po cestah).
- `src/game/airlift.ts` — nov tip transportnega helikopterja (risanje).
- `src/game/vehicleArt.ts` — več tipov vozil/letal (risanje).
- `src/game/engine.ts` — fizika vozil/helikopterjev/letala, patrolje, vkrcavanje, blackout,
  konvoji, raketomet, prevzem baz, HUD podatki.
- `src/components/CombatHud.tsx`, `src/App.tsx` — samo če novi sistemi potrebujejo prikaz.
- `README.md` — posodobitev dokumentacije.

**Nove datoteke (samo če res pomagajo, pravilno povezane):**
- `src/game/convoy.ts` — cestni konvoj (vozila, oborožitev, poti, plen),
- `src/game/formation.ts` — formacije patrolj (vrste, razmiki, hitrosti),
- `src/game/powerGrid.ts` — omrežje: generatorji → osvetlitev baz → stopnjevan izpad.

---

## 6. Tveganja in kako jih bom obvladal

1. **Zrušitev ob zagonu (največje tveganje, že izkuseno).** En nedefiniran tip enote je podrl
   celotno igro. → varnostne rezerve (`|| grunt`), headless test po vsaki spremembi, `tsc --noEmit`.
2. **Zmogljivost.** Že zdaj je 389 vojakov in ~1750 struktur; če dodam 2–3× več entitet brez
   prostorskega indeksiranja, igra postane neigrabilna. → vse nove poizvedbe gredo skozi
   obstoječe razrede (`SpatialGrid`, `RoutePlanner`, razredi entitet na okvir); oddaljene
   enote ostanejo "speče"; število A* poti na okvir je že omejeno (`pathBudget`, `infantryBudget`)
   in to ohranim.
3. **Indeksi hangar/parkirani helikopter** (glej 3.3): če dodam helikopterje, obstoječa logika
   `hangars[h.home]` postane napačna. → najprej uvedem pravilno povezavo "zaliv za vsak
   helikopter", šele nato dodajam helikopterje.
4. **Navigacija in vrata.** A* uporablja clearance 82 (vozila) in 22 (pešci); če postavim preveč
   struktur ali preozke prehode, se konvoji ustavijo. → ohranim obstoječa pravila
   `noOverlap(...)` z rezervo, prehode ≥ 240 (vozila) / ≥ 120 (pešci), test "konvoj prevozi pot".
5. **Prožnosti igre (balance).** Več branilcev = lahko pretežko; obstoječi `sector`/`wave`
   faktorji ostanejo, nove enote dodam z zmernimi vrednostmi in preverim, da se da sektor
   še vedno dokončati.
6. **Velikost zbirke (build).** Build je ena HTML datoteka (~1,2 MB). Dodajanje umetnija jo
   poveča; pazim, da ne presežem smiselnih meja (trenutno gzip 337 kB).
7. **Vizualna prekrivanja.** Večje baze lahko prekrijejo vault (X 980 / Y 7040), letališče ali
   ceste. → vse nove postavitve preverim proti obstoječim rezervacijam v `noOverlap`.
8. **Ne združuj vsega naenkrat.** → delo po fazah, po vsaki fazi: `tsc`, `npm run build`,
   headless scenariji (boot / 12 s boja / blackout / konvoj / zrak) in ročni pregled v brskalniku.

---

## 7. Stanje verifikacije na koncu Faze 0

- `npx tsc --noEmit` ✅ brez napak
- `npm run build` ✅ (dist/index.html 1,20 MB, gzip 338 kB)
- Headless zagon pravega `Game`: ✅ menu → startRun → 12 s boja → 4 polni render okvirji
- Scenarij blackout: ✅ (10/10 celic, 0 reflektorjev, 4 odzivna naročila, 14 kombijev)
- Scenarij zrak: ✅ (ATLAS/MANTIS stanja launch→approach→drop→return→land, helikopterji
  startup→ingress)
- Dev server: ✅ `http://0.0.0.0:5173` (live preview), odziva tudi na posredovanem gostitelju
- Commit-i na veji `arena/01a0773f-game1`: `5b60ec8` (nujni popravki + zmogljivost)

**Velika nadgradnja (faze 1+) se začne šele po tvoji potrditvi.**
