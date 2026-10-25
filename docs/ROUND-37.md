# Round 37 — poročilo (verzija na začetnem zaslonu, slabo zastražene vojašnice, reaktivci, ki jih lahko zajameš)

**Naročilo:** *»vedno od zdaj naprej piši verzije na začetni zaslon igre. verzijo igre. in dodaj da je v vojaškem sektorju nekaj slabo zastraženih vojašnic, letališč z reaktivci, zelo hudimi reaktivci ki jih lahko zajameš«*

Aktualna verzija: **v1.37.0 · ROUND 37 · 2026-10-25**, kodno ime **SOLAR ECLIPSE**.

---

## 1) Verzija je zdaj na začetnem zaslonu — in ostane tam vsak krog

Verzija ni več zapisana ročno po zaslonu, ampak je **en sam vir resnice**: `src/game/version.ts`.

```ts
export const GAME_VERSION = { major: 1, minor: 37, patch: 0, round: 37,
  codename: 'SOLAR ECLIPSE', date: '2026-10-25' };
export const VERSION_LABEL = 'v1.37.0';                       // kratka oznaka
export const BUILD_STAMP  = 'v1.37.0 · ROUND 37 · 2026-10-25'; // polni žig
```

Na začetnem (operations) zaslonu je verzija vidna **na treh mestih**, tako da je ni mogoče zgrešiti:

1. **glava zaslona** — pod značko `CLASSIFIED / LEVEL 07` zlata monospace oznaka `v1.37.0`,
2. **naslov operacije** — v vrstici `OPERATION BLACK VAULT` je vrinjena oznaka `BUILD v1.37.0`,
3. **noga zaslona** — `PROTOCOL SOLAR ECLIPSE / v1.37.0 · ROUND 37 · 2026-10-25`.

Pravilo za naprej: **vsak krog se verzija dvigne v `src/game/version.ts`** (minor +1, `round` +1, nov datum in kodno ime). Zaslon se potem posodobi sam, ker vse tri izpise bere iz tega modula — ni več mogoče pozabiti enega od njih.

## 2) Sektor 6: tri slabo zastražene vojašnice

Vojaški sektor je bil doslej en sam velik, do zob oborožen kompleks. Zdaj ima tudi **mehko stran** — tri kantone, ki jih zaseda komaj nekaj ljudi:

| Ime | Položaj (svet) | Posadka | Vsebina |
|---|---|---|---|
| CANTONMENT · 4TH COMPANY | `X 16580 / Y 8740` (560 × 400) | 2 stražarja | vojašnica, šotor, skrinja, sod, ograja, 2 skladišči |
| CANTONMENT · TRANSIT BARRACKS | `X 16580 / Y 9940` | 2 stražarja | isto, druga postava |
| REPLACEMENT DEPOT | `X 8780 / Y 9500` | 3 stražarji | vojašnica, šotor, 2 soda, skrinja, ograja |

- Noben od njih **nima težkega orožja, topov, protiletalskih položajev ali utrjenih vrat** — dobili so le 3–7 statičnih stražarjev (namesto 82–1000 v glavnem kompleksu).
- Vsak ima **skladišče** (`loot`): dve do tri oskrbovalni točki, ki jih pobereš spotoma.
- Vsi trije so **označeni na zemljevidu od prve sekunde** in niso cilji misije — to so mehke tarče, ne objekti, ki bi jih morala uničiti kampanja (glej točko 5).

## 3) Dve neograjeni vzletno-pristajalni stezi

Na vzhodnem boku sektorja sta dve **disperzijski stezi** — beton, ena vzletna proga, kontrolni šotor, rezervoar za gorivo, sodovi in pesek, **brez ograje in brez protiletalske obrambe**:

| Steza | Položaj | Posadka | Reaktivci |
|---|---|---|---|
| FORWARD STRIP ALPHA | `X 11950 / Y 8700` (1950 × 290) | 3 stražarji | 2 × standard + **1 × prototip** |
| FORWARD STRIP BRAVO · PROVING FLIGHT | `X 13950 / Y 8700` | 2 stražarja | 2 × standard + **1 × prototip** |

Stezi sta namerno postavljeni na **prosto zemljo** — preverjeno s testom prostora (nobena stavba sektorja se ne seka z njima; vsi objekti na njiju so tisti, ki jih steza sama postavi).

## 4) Prototip prestreznik — najhujši reaktivec v igri

Dva od šestih novih letal sta **prototipa**. Vsak je drugje barvan (grafit + zlata črta po hrbtu, zlati nos), na zemljevidu in ob trupu piše **PROTOTYPE**, ob njem pa `F · SEIZE PROTOTYPE INTERCEPTOR`.

| Lastnost | Standardni prestreznik | **Prototip** |
|---|---|---|
| Trup (HP) | 420 | **1 100** |
| Največja hitrost | 1 750 | **2 400** (z afterburnerjem) |
| Zagon motorja | — | 2,3 |
| Okretnost | ×1 | **×1,12** |
| Top | 26 škode / 0,07 s | **38 škode / 0,045 s**, zlati sledilci |
| Iskalnik (seeker) | 2 600 m | **3 400 m** |
| Vabice (flares) | 8 | **12** (16 s Frostwingom) |
| Nagrada za zajem | +1 500 | **+6 500** |

Zajem je isti kot doslej: **stopi do parkiranega letala in pritisni `F`** — igralec ga leti, dokler ne pristane in izstopi. Ko sediš v prototipu, HUD namesto `🛩 INTERCEPTOR` izpiše **`⚡ PROTOTYPE`**. Prototip ima **svojo, ločeno statistiko** (ne množi standardne): ponoven vstop v isto letalo ne podvaja bonusa Frostwinga — zato nov zastavica `tuned`.

## 5) Zakaj so te tarče »mehke« in ne cilji

Nove točke so v svetu označene kot `secret: true` (niso cilji kampanje, ne dobijo vrat, ne štejejo v `poisTotal`, ne dobijo nadzorne plošče »UPLINK«) **in** `soft: true`, kar pomeni: *niso cilj, a so od začetka narisane na zemljevidu in na mini zemljevidu*. Brez tega bi bila »slabo zastražena vojašnica« nevidna in naročilo ne bi imelo smisla.

Zato so vse prejšnje mehanike ostale nedotaknjene: **1000 mož v paradi, park oklepnikov, 16 topov, glavni kompleks** so še vedno tam (preverjeno s testom: 1000 dormantnih vojakov v sektorju 6, 16 topov, 9 letal, 5 mehkih tarč).

## 6) Preizkusi tega kroga

- `npx tsc --noEmit` — čist.
- `npm run build` — **1 594,29 kB / gzip 465,68 kB**.
- Regresija po vseh 6 sektorjih: vsak sektor se zgradi, 400 okvirjev simulacije brez izjeme; sektor 6 → **4385 ovir, 30 objektov, 1000 paradi­stov, 16 topov, 9 letal, 5 mehkih tarč**.
- Soak: **7 200 okvirjev (120 s)** letenja s prototipom (afterburner + streljanje) → **0 izjem**, hitrost 2 400, trup ostane nad 700 HP.
- Zajem: `F` ob prototipu → prompt `F · SEIZE PROTOTYPE INTERCEPTOR`, letalo prevzeto (HP 1 100, 12 vabic), ponoven vstop ne podvoji bonusa.
- Prekrivanje: noben nov objekt ne seka obstoječih zgradb; reaktivci na stezah ne ležijo na pesku/šotorih.
- Začetni zaslon (SSR izpis): `v1.37.0` se pojavi trikrat — v glavi, pri `BUILD` in v nogi (`PROTOCOL SOLAR ECLIPSE / v1.37.0 · ROUND 37 · 2026-10-25`).

## Tehnično

- **Novo:** `src/game/version.ts` (`GAME_VERSION`, `VERSION_LABEL`, `BUILD_STAMP`).
- `src/components/OperationsMenu.tsx` — glava/eyebrow/noga berejo iz `version.ts`; v zavihku DOSSIER dodan odstavek **THE SOFT SIDE / TWO PROTOTYPES** z imeni in koordinatami.
- `src/index.css` — `.operations-version`, `.operation-version`.
- `src/game/army.ts` — `JetTier`, `ArmySoftTarget`; `ArmyPlan.softTargets` + `ArmyPlan.loot`; `cantonment()` ×3, `forwardStrip()` ×2; obstoječi `jets` zdaj nosijo `tier`.
- `src/game/world.ts` — `PoiDef.soft?`; mehke tarče → skrite točke z `soft: true`, `loot` → skladišča.
- `src/game/engine.ts` — `PoiState.soft?`; `discovered = !secret || soft`; nadzorne plošče UPLINK se za mehke tarče ne rišejo; `ArmyJet.tier/tuned`; HP prototipa 1 100; `seizeJet()` bonus +6 500 in banner; `jetSeeker()` 3 400; letalna ovojnica (2 400 / 2,3 / ×1,12); top 38 @ 0,045 s; `drawFighter(..., ace)` z grafitno-zlato shemo, canardi in oznako `PROTOTYPE`; `nearPrompt()` loči prototip; HUD `jetAce`.
- Prejšnji poročili: `docs/ROUND-35.md`, `docs/ROUND-36.md`.
