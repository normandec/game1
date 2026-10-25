# Round 35 — poročilo

**Naročilo:** nova vozila naj se premikajo · večji zračni odziv na bombardiranje (letala, ki te streljajo) · nova vozila naj jih lahko vozim · kako sprobati reaktivno letalo in kako najti ledeno bazo.

**Stanje:** PR #23 združen v `main`, objava na GitHub Pages **uspešna** (`40192349684`). `tsc --noEmit` čist, build **1 586,78 kB / gzip 462,56 kB**.

> To poročilo je zdaj v repozitoriju (`docs/ROUND-35.md`), da ga ni treba iskati zunaj projekta.

---

## 1) Nova vozila se zdaj res premikajo

Prej je bila večina vozil iz rounda 34 **statična kulisa**: premikalo se je le 9 prometnih poti in 81 transportnih kombijev.

- **Gostejši promet:** vsaka pot nosi 2–5 vozil, skupaj **~44–45 vozil na sektor** (prej 9).
- **Tovornjaki so postali prava vozila:** nov tip `truck` (kabina + platnena cerada, 60 × 19 px), vozni park je mešanica hummerjev, avtomobilov, avtobusov, cistern, rešilcev in tovornjakov.
- **Parkirana vozila se vključijo v promet:** ob vstopu v sektor se **4–14** parkiranih vozil odpelje s parkirišča (najbližja točka na odprti cestni zanki, statična risba se umakne).
- **Zastoji rešeni:** začetne čakalne dobe so bile do 120 s; zdaj 0–2,2 s, zato **41–44 od 45** vozil dejansko vozi.

## 2) Nova vozila lahko voziš

- Ob parkiranem vozilu **F** → `F · DRIVE CARGO LORRY` / `ARMOURED HUMMER` / `FUEL TANKER` … (+120 točk, 210–300 HP).
- Ob vozečem se vozilu **F** → `F · TAKE STAFF CAR` (+150 točk, prevzamеš preostali oklep).
- Vsak tip se vozi drugače: avto 640, hummer 540, avtobus 395, tovornjak 360, cisterna 345; oklepni transport ostane 451,5 (+burner).
- Rekvizirana vozila imajo svojo karoserijo, vrstico oklepa, dim pri poškodbah in zgorelo lupino po uničenju.

## 3) Velik zračni odziv na bombardiranje

- Vsak udarec iz letala dvigne »vročino« zračne obrambe (top 0,08 · raketa v tla 1,3 · bombni tepih 2,2).
- Valovi po **2–5 lovcev** (največ 8 hkrati), z roba zemljevida, 1180 px/s na prestrezanju, topovi + **vodene rakete** (26 škode), premor med valovi se skrajša z 18 s na 5 s.
- **SPACE = vabe**: vsaka raketa v 1 400 px izgubi zaklep 3,4 s.
- Popravljena stara napaka: med letom je škoda šla na pilota namesto na letalo (zdaj trup požre 85 %).
- HUD kaže `⚠ N HUNTERS`; ko pristaneš, lovci po ~6 s odletijo.

## 4) Kako sprobati reaktivno letalo

**Ledena baza (sektor 3):** jug sektorja, **`10710,9820`** → `F · OPEN THE GLACIER GATE` → v notranjosti vzemi interceptor → po izstopu dobiš FROSTWING in **na ledu pred vrati te čaka prestreznik** (`F · SEIZE THE INTERCEPTOR`).

Krmiljenje: **LMB** top · **G** raketa · **X** postaja · **E** avtopilot · **SPACE** vabe · **SHIFT** afterburner · **W/S** plin/zavora · **F** izstop (≤ 320).

**IRON RESERVE (sektor 6)** ima tri parkirane prestreznike na ploščadi (`7250,9060`, `8650,9060`, `10050,9060`).

## Tehnično

`engine.ts`: `RoadCar['kind'] + 'truck'`; `Van.art/colour/burning`; `driveProps`, `nearDriveProp()`, `requisitionVehicle()`, `nearTrafficCar()`, `commandeerTraffic()`; vozni profili; `roadCarView()` / `drawVanWreck()`; pretvorba parkiranih vozil v promet; `enemyRockets`, `airResponse*`, `provokeAirResponse()`, `scrambleWave()`, `updateAirResponse()`, `updateEnemyRockets()`; `ArmyJet.hunter/rockets`; `updateAirCombat()`; `damagePlayer()` veja za prestreznik; `parkGlacierInterceptor()`.
`Screens.tsx` / `App.tsx`: HUD `airThreat`.
