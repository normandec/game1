# Round 39 — poročilo (bombnik na WASD, epski boji z reaktivci)

**Naročilo:** *»ne, naj bo bombnik normalno s wasd krmiljen. naredi da bodo boji z reaktivci epski. dodaj kontrole, vrste, šerspektive, orožje, sisteme, in polepšaj podobo. reaktivci«*

Verzija: **v1.39.0 · ROUND 39 · 2026-10-25**, kodno ime **IRON SKY** (izpisana na začetnem zaslonu).

---

## 1) Bombnik je spet na WASD

Vrnjeno na staro shemo: **WASD vozi letalo** (W naprej, S nazaj, A/D vstran), **miš pa meri nos** — tako kot piči orožje. Trup se mehko prevesi v novo smer (640 enot/s), zato letalo leti, kamor ga pelješ, ne pa vedno tja, kamor kaže nos. Hitrost je strateška, ne lovska — bombnik ni prestreznik in to se mora čutiti.

## 2) Boji z reaktivci so zdaj prava stvar

### Orožje (novo)

| Sistem | Tipka | Kaj naredi |
|---|---|---|
| **Top** | LMB | dvojni top, **segreva se** — merilnik na levi strani stekla; pri 100 % se **zablokira** za 1,5–2,2 s |
| **Raketa AAM** | G | zrak-zrak ali zrak-tla na zaklenjeno tarčo; **omejene zaloge** (6 / 8 / 10) in **svinčeni kazalec** (lead pipper), kjer bo tarča, ko raketa prispe |
| **Salva raket** | H | 6 nevođenih raket iz krilnih podov — orožje proti tlom (12–16 zalog) |
| **Kopje (lance)** | R | drži za polnjenje kondenzatorja; ko je poln, izstreli **prebojni snop** 2 600 m po nosu — zadene vse na liniji (samo prototip in Frostwing, 4 naboja) |
| **Vabice** | SPACE | zavajajo **vse** prihajajoče rakete in za čas gorenja zmanjšajo prejeto škodo na tretjino |

### Sistemi

- **PreGrevanje in blokada topa** — zvočni in vizualni odziv (`GUN OVERHEAT · BARRELS COOKED`).
- **RWR (radar warning receiver)** — ko hunter izstreli raketo, se prižge **rdeč okvir okoli zaslona** in `MISSILE INBOUND · SPACE FOR FLARES`.
- **Nalaganje ob zajemu** — vsako letalo dobi svojo zalogo ob prevzemu; ponoven vstop **ne** napolni zalog (dolga sortija je odločitev).
- **Poškodbe letala** — pod 45 % trupa vleče dim, pod 20 % črn dim, trup dobi temne lise.
- **Splash** — vsak sestreljen lovec je najavljen (`SPLASH ONE` / `ACE DOWN`), s hitstopom, eksplozijo in točkami (1 400 / 1 800 / 4 200).

### Vrste

- **Linijski prestreznik** — 420 HP, 1 750 m/s, 6 AAM, 12 salvi.
- **Prototip** — 1 100 HP, 2 400 m/s, zlati sledilci, 8 AAM, 16 salvi, **kopje** ×4.
- **Frostwing** — 900 HP, 2 200 m/s, ledeni top, 10 AAM, 16 salvi, **kopje** ×4.
- **Squadron ace (nov sovražnik)** — vsaka tretja valovanja pošlje **asa**: večji trup z zlatimi črtami, **900 HP**, natančnejši rafali (0,85 s), 4 rakete, ostri zavoj.
- Hunterji zdaj **vodijo ogenj** (streljajo tja, kjer boš) in **trdo zavijejo**, ko jim nos uperi v njih. Rakete izstrelijo na 420–2 200 m, ne več v prazno.

### Štiri perspektive

| Tipka | Pogled |
|---|---|
| privzeto | **Chase** — kamera 130 enot pred letalom, da tarča ni pod nosom |
| V | **Tactical** — 0,72× zoom, celotna cona boja |
| V | **Gun camera** — 1,32× zoom, 220 enot naprej |
| V | nazaj na chase |

Kamera se pri vsakem pogledu pravilno omeji na robove arene, miška pa se preslika v svet **točno** (testirano: napaka < 1 px pri vseh treh zoomih).

### Podoba

- **Lastno letalo** je bledo-sivo s **cyan pasovi** in hladno svetlobo okoli trupa; **sovražniki** so temno-olivni z **rdečimi HYDRA pasovi** — v tropu se takoj ve, kdo je kdo.
- **Panelne linije**, steklen kanop z odsevom, **pozicijske luči** (rdeča levo, zelena desno, bela na repu), **oborožitev na krilnih nosilcih** (vidne rakete), **zlate črte** pri asu, **zlati sledilci** pri prototipu.
- **Motor**: plasti plamena, **šok diamanti** pri afterburnerju, svetlobna koprena.
- **Contrail** je zdaj tančica (ne vrsta pik), ob veliki hitrosti pa **kondenzacijske pahljače** s konic kril.
- **Kopje** je bel snop s svetlim jedrom in razcvetom na ustju; **salve raket** imajo motor in dim; **sovražne rakete** dobijo utripajoč rdeč obroč.
- **Kokpit**: merilnik segrevanja, zaloge (AAM / RKT / FLR / LANCE), način, pogled, hitrost in višina, polnilec kopja, opozorilo RWR in **pipper** namesto križa.

## 3) Preizkusi

- `npx tsc --noEmit` — čist. `npm run build` — **1 620,56 kB / gzip 473,57 kB**.
- Vseh 6 sektorjev: 300 okvirjev `update` + `render` brez izjeme.
- Bombnik: D premakne letalo na vzhod, stranska hitrost 624 (< 640), ne leti kot lovec.
- Prestreznik: zaloge ob zajemu (AAM 8 / RKT 16 / LANCE 4), top se pregreje in zablokira po **6,2 s** neprekinjenega ognja, blokada poteče, H izstreli 6 raket, R napolni in izstreli kopje, V obrne poglede (1 → 2 → 0).
- Preslikava miške pri vseh treh zoomih: napaka < 1 px.
- **90 s soak** z vsemi sistemi hkrati (top, salve, rakete, kopje, menjava pogledov) — brez izjem, 70 450 točk.
- Balans: z uporabo vabic in raket pilot preživi **60 s** troboja s 700–900 HP; brez vabic in z nenehnim provociranjem zračne obrambe je sestreljen v ~50–100 s — boj je nevaren, a dobljiv.

## Tehnično

- `src/game/engine.ts`: `updatePlane()` nazaj na WASD; `JetRocket`/`LanceBeam`; polja `heat/jam/missiles/rocketsPlayer/lance/charge/view/rwr/ace` na `ArmyJet`; `fireJetRockets()`, `fireLanceCharge()`/`releaseLance()`, `cycleJetView()`, `jetViewConfig()`/`jetCamera()`, `worldMouse()`; `updateJetRockets()`, `updateLanceBeams()`, `downJet()`; pregrevanje v `updatePlayerJet()`; `drawJetOverlay()`; `drawFighter(..., loadout, aceTrim, damage)`; prenovljen izris trails/raket/kopja; as v `scrambleWave()` + vodenje ognja in obrambni zavoj v `updateArmyJets()`; `damagePlayer()` z 0,5× (0,34× med vabicami).
- `src/components/Screens.tsx`: HUD kokpita (zaloge, segrevanje, pogled, RWR).
- `src/components/OperationsMenu.tsx`: razdelek **INTERCEPTOR / COCKPIT SYSTEMS** in **THE OPPOSITION**.
- `src/game/version.ts`: **v1.39.0 / ROUND 39 / IRON SKY**.
- Prejšnja poročila: `docs/ROUND-37.md`, `docs/ROUND-38.md`.
