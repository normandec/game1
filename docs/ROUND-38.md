# Round 38 — poročilo (aretacija v zraku, ledena baza, letenje bombnika)

**Naročilo:** *»popravi da te v reaktivcu ne morejo aretirati policaji, kar v zraku so me. in popravi ledeno bazo, ker ko pridem tja so neki nevidni zidovi in je vse čudno niti ne morem enostavno vstopiti notri, in ta ledeni reaktivec je zanič. in popravi letenje navadnega letala da bo se ravnalo na miško, tako kot se reaktivna. na sliki imaš kakšna naj bo baza.«*

Verzija: **v1.38.0 · ROUND 38 · 2026-10-25**, kodno ime **THIN ICE** (verzija je, kot od 37. kroga naprej, izpisana na začetnem zaslonu — glej `src/game/version.ts`).

---

## 1) V reaktivcu te ne morejo več aretirati

**Vzrok:** aretacija je preverjala le peš hoje po tleh in nekaj vozil (`!piloting && !flyingPlane && !drivingVan && !playerTank`), **pozabila pa je na prestreznik**. Ko si letel nad bazo, je bil `px/py` še vedno tvoja talna senca — policaj, ki je stal pod tabo, je bil od te »točke« oddaljen 20 px in te je vklenil s 250 m višine.

**Popravek:**

- nov en sam getter `inVehicleOrAir` — resničen, ko si v prestrezniku, v gunshipu (samo med pilotiranjem), v bombniku, v tovornjaku/oklepniku ali v čolnu. Aretacija zdaj sprašuje **samo njega**, zato je nobeno vozilo ne more več »pozabiti« izključiti;
- dodatno: tudi pri lebdečem prestrezniku (`alt > 12`) aretacija ni mogoča, tudi če senca pade točno na policaja;
- parkiran gunship ali parkiran bombnik **ne** štejeta — če stojiš na tleh ob njima, te policaji še vedno lahko vklenejo.

Preverjeno s testom (7 primerov): peš ob policaju → aretacija; v prestrezniku na 240 m in na 0 m → ni aretacije; v gunshipu, v tovornjaku, v bombniku → ni aretacije; peš z lastnim parkiranim gunshipom → aretacija (pravilno).

## 2) Ledena baza: ni več nevidnih zidov, vhod je viden

Bilo je troje:

1. **Zid je bil videti kot gmota črnih kamnov na sivi podlagi.** Ledeni bloki so se risali z isto kodo kot navadna skala (`#3b3a33`). Zdaj se vsak svetel `rock` v sektorju 3 riše kot **izrezan led**: plast plasti (bledo modro lice, snežna kapa, modrikasta senca, razpoke) in **pravokotno**, tako da se bloki sestavijo v steno — točno vidiš, kaj je trdno in kje je odprtina.
2. **Vhod je bil ozek usek.** Prej: 260 px široka reža med dvema stolpoma ledu, z vrati na dnu, brez oznake. Zdaj: **900 px širok pridvorni prostor** (betonska ploščad) s tremi odprtinami v spodnji vrsti stene, **ledenimi vrati** na koncu in **lučjo nad podbojem**. Svetlobni stožec, napis `GLACIER VAULT / ENTRY` in `[F] OPEN THE GATE` so narisani na tleh, tako da je vhod viden z razdalje.
3. **Smeti so se naložile na vhod.** Naključna oprema distrikta (šotori, tovornjaki, sodi) se je generirala tudi na ploščadi in jo zaprla. Zdaj je pridvor **izključen iz naključne opreme** (`sector === 3` območje 10100–11300 × y0+1150 … y0+1950), preverjeno v 6 generiranih svetovih: **0 ovir**.

Dodatno: vstopna cona je povečana z 200 na **280 px**, izhod iz baze pa te postavi na ploščad in te `collide()` potisne iz morebitne ovire (prej si pristal skoraj v ograji).

## 3) Ledeni reaktivec (Frostwing) ni bil več »zanič«

Prej je bil navaden siv prestreznik s 620 HP, brez posebne barve in brez svojega imena na zaslonu.

Zdaj ima **svojo vrsto letala** (`tier: 'frostwing'`):

| Lastnost | Frostwing |
|---|---|
| Trup | **900 HP** |
| Največja hitrost | **2 200** (afterburner) |
| Vabice | **20** |
| Iskalnik | **3 200 m** |
| Top | 34 škode / 0,048 s, ledeni sledilci |
| Okretnost | ×1,08 |
| Nagrada za zajem | **+4 000** + banner `FROSTWING AIRBORNE` |

Videz: **bledo ledeno-modro ogrodje z belo hrbtenico** (ne več olivno), na tleh piše `FROSTWING`, ob njem pa `F · FLY THE FROSTWING`.

## 4) Baza je zdaj *baza v ledu*, ne koridor (po sliki)

- Dvorana je **širša in višja**: polširina 46 → **60**, višina stropa 26 → **32**.
- **Vrata na koncu dvorane** so zdaj res odprtina: dve rami + preklada, za njimi **dnevna svetloba** (ledena polica zunaj), dve ledeni krili, ki se med vzletom **pogrezneta v led**.
- **Vzletna steza** po sredini dvorane: svetla črta z vložki od ledenega zaliva do vrat.
- **Hangarska galerija** ob vzhodni steni: jeklena pot s stebri, ograjo, dvema zastavama divizije in tremi lučmi.
- **Frostwing** stoji v svojem zalivu na podstavku, **z nosom proti vratom** (prej je bil obrnjen stran od izhoda).
- **Vzlet je zdaj vzlet:** vrata se pogreznejo (0–1,1 s), letalo pospeši po celi dvorani (1,1–3,6 s, 300 enot), kamera ga lovi od repa, na koncu belina ledene police prevzame zaslon in igra se vrne na površino.

## 5) Navadno letalo (bombnik) leti kot reaktivec

Prej: nos je sicer gledal v miško, **trup pa je drsel po vektorju WASD** — letalo je letelo bočno, kot voziček. Zdaj:

- **nos sledi miški**, trup pa **vedno leti tja, kamor kaže nos** (hitrost = smer nosu);
- **W** dodaja plin, **S** zmanjša na pristajalno hitrost (**120**), **SHIFT** je afterburner (**1 180**);
- zavijanje je počasnejše in se zaostri pri majhni hitrosti (bombnik je težji od lovca);
- robovi arene: nos se obrne nazaj v areno, namesto da bi se letalo odbilo;
- na dotik: leva palica vodi nos (prej je premikala samo hitrost);
- brez goriva letalo jadra s 330, ne 95.

Preverjeno: po 4 s leta je **odmik hitrosti od smeri nosu 0,00** (prej je bil poljuben), s tipko S hitrost pade na 120 (pristanek je mogoč), s SHIFTOM na 1 180, nos pa sledi miški (vzhod 0°, jug 90°).

## 6) Preizkusi

- `npx tsc --noEmit` — čist.
- `npm run build` — **1 601,54 kB / gzip 468,14 kB**.
- Vseh 6 sektorjev: svet se zgradi, 400 okvirjev simulacije brez izjeme.
- Ledena vrata: 39/44 sond prostih na ploščadi, na sprožilcu se da stati, 0 naključnih ovir v 6 svetovih.
- Frostwing: zajem da 900 HP in 20 vabic, po 5 s afterburnerja **2 200**; izhod iz baze te postavi na ploščad (ne v ograjo).
- Aretacija: 7 scenarijev (glej točko 1).

## Tehnično

- `src/game/engine.ts`: `inVehicleOrAir` getter; aretacijski pogoj uporablja njega + `alt > 12`; `updatePlane()` prepisan na model nosu; bannerji/pristanki; `JetTier` v `drawFighter` (grafit/zlato = prototip, led = Frostwing); `seizeJet()` veja za Frostwing (900 HP, 20 vabic, +4 000); `jetSeeker()` 3 200 m; ovojnica leta 2 200 / 2,1 / ×1,08; top 34 @ 0,048 s; nov `drawGlacierGateBeacon()`; `drawIceBlock()` + razpoznava svetlih `rock`; izhod iz baze s `collide()`.
- `src/game/annex.ts`: nov pridvor ledenih vrat (ploščad, 900 px odprtina, vrata, luč), izključena naključna oprema, sprožilec na ploščadi.
- `src/game/army.ts`: `JetTier` dobil `frostwing`.
- `src/components/Glacier3D.tsx`: širša dvorana, vrata z dnevno svetlobo, vzletna steza, galerija, podstavek, nov vzlet.
- `src/components/OperationsMenu.tsx`: odstavek **THE GLACIER VAULT / ARCTIC RELAY** in popravljen opis miške.
- `src/game/version.ts`: **v1.38.0 / ROUND 38 / THIN ICE**.
- Prejšnja poročila: `docs/ROUND-36.md`, `docs/ROUND-37.md`.
