# Round 40 — poročilo (celozaslonski gumb, tihi pobeg iz zapora, razvijalski konzol)

**Naročilo:** *»dodaj celozaslonski gumb na začetni zaslon igre, poleg različice. in ko pobegneš iz zapora naj se valovi helikopterjev NEAKTIVIRAJO, samo če pobegneš naj se ne. še posebno če pobegneš peš, ker te deset helikopterjev na mestu ubije, in dodaj gumb na začetni zaslon ki je namenjen meni kot razvijalcu ki te avtomatsko pošlje na želeni sektor in če hočeš dobiš neomejeno življenja. samo če to nastavitev izbereš«*

Verzija: **v1.40.0 · ROUND 40 · 2026-10-25**, kodno ime **QUIET WATER** (izpisana na začetnem zaslonu).

---

## 1) Celozaslonski gumb na začetnem zaslonu

V glavi začetnega zaslona, **takoj pod različico** (`v1.40.0`), sta zdaj dva majhna gumba:

- **⛶ FULLSCREEN** — vklopi celozaslonski način (v njem se napis obrne v **✕ EXIT FULLSCREEN**). Uporablja isti `requestFullscreen()` kot gumb med igro, zato se stanje obeh gumbov sinhronizira prek `fullscreenchange`.
- **⚡ DEV** — odpre razvijalski konzol (spodaj).

Oba sta majhna, obrobljena in umaknjena stran od glavnega gumba **DEPLOY**, z `aria-label`, `title` in vidnim fokusom. Na telefonu se besedilo skrajša, ikona ostane.

## 2) Pobeg iz zapora ne sproži več valov helikopterjev

Do zdaj je veljalo: *kdor je na otoku, je invazija*. Pobeg iz THE CAGE te je postavil na dvorišče **na otoku** — in `updateIslandDefence` je takoj pognal **LANDING ALARM**: 3–5 desantnih čolnov, 2–6 jurišnih helikopterjev in cela posadka otoka, nato novo valovanje vsakih 24 s do šestih valov. Mož s pištolo, peš, na dvorišču — to je bila zagotovljena smrt.

Zdaj velja:

- Ob **pobegu** (`leavePrison(..., escaped = true)`) se pokliče **`standDownIslandDefence()`**:
  - alarm se ugasne (`islandWaves = 0`, `islandLanded = false`, `islandAlarmT = 0`),
  - **vsi helikopterji**, ki so že v zraku, dobijo ukaz *egress* in **zapustijo prizorišče** — ne pristanejo na bljižnjem ploščadi in se ne vrnejo v službo (nova zastavica `retire`),
  - **desantni čolni** obrnejo in se vrnejo na morje.
- Dokler je operativec **na otoku**, je alarm mrtev (`cageEscaped`) — **nobenih novih valov, nobenih helikopterjev, nobenega zbiranja posadke**.
- Ko stopi **z otoka** (most, čoln, letalo), se "pobeg" zaključi in otok spet odgovarja kot vedno — če se vrneš, te čaka normalna obramba.
- **Aretacija brez pobega** (izhod z 1 500 točkami) tega ne sproži: takrat se ni nič spremenilo.

Izmerjeno v harnešu: pred popravkom je bilo ob pobegu v zraku **7 helikopterjev** in valovanja so se nadaljevala; po popravku jih je **0**, valovi ostanejo na **0**, in po **45 s** hoje/stanja na dvorišču je operativac **živ** (55–64 HP).

## 3) Razvijalski konzol (samo zanj, samo če ga izbere)

**⚡ DEV** na začetnem zaslonu odpre okno, ki ni del igre:

- **Izbor sektorja 1–6** (THE FALLEN HUB … IRON RESERVE) z imenom, kodnim imenom in vremenom.
- **☑ INFINITE LIVES** — *privzeto izklopljeno*. Ko je vklopljeno (preverjeno tudi na prototipu prestreznika: 20 zadetkov po 9 999 → trup na 1 HP, operativec v kokpitu):
  - operativca **ni mogoče ubiti**: vse poškodbe še vedno pridejo, HP pade, a se ustavi na **1**;
  - enako velja za vozila in letala, s katerimi leti (trup se ne sesuje, dokler je funkcija vklopljena);
  - v HUD-u se poleg sektorja izpiše **`DEV · INFINITE LIVES`**, na začetku kroga pa banner **`DEV DEPLOY · INFINITE LIVES`**.
- **DEPLOY TO SECTOR N** — takoj začne krog v izbranem sektorju (z izbrano klaso in podporo iz LOADOUT-a). Brez tega gumba in brez kljukice se **nič** ne spremeni: navaden DEPLOY gre kot vedno v sektor 1 z normalnimi pravili.

Preverjeno: `startRun('assault','aegis',{sector:4})` → sektor 4, svet zgrajen (839 sovražnikov), 120 okvirjev brez izjeme; sektorja 2 in 6 enako. Brez kljukice: 8 zadetkov po 999 poškodbe = **mrtev** (`over`), s kljukico: 40 zadetkov po 9 999 = **hp 1, status `playing`**, tudi po 10 s neprestanega ognja.

## 4) Preizkusi

- `tsc --noEmit` čist, `npm run build` **1 629,61 kB / gzip 475,74 kB**.
- 6 sektorjev × 200 okvirjev `update` + `render` — brez izjeme.
- Pobeg: 7 helikopterjev → 0; valovi 0; po 45 s še vedno živ; odhod z otoka → mir ugasne; vrnitev → alarm spet živ (val 2).
- Aretacija brez pobega: valovi nespremenjeni, `cageEscaped` false.
- HUD: `devInfinite: true`, `devSector: 3` pri razvijalskem vstopu.
- Začetni zaslon (SSR preizkus): glava vsebuje `v1.40.0`, gumba **FULLSCREEN** in **DEV** ter `aria-label`.

## Tehnično

- `src/components/OperationsMenu.tsx`: novi props `fullscreen`, `onFullscreen`, `onDevDeploy`; vrstica `operations-tools` pod različico; modalni **DEVELOPER CONSOLE** (izbor sektorja, kljukica za neomejeno življenje, gumb za vstop).
- `src/App.tsx`: `startDev(sector, infinite)` → `g.startRun(cls, support, { sector, infiniteLives })`; posredovanje `fullscreen`/`toggleFullscreen` v meni; HUD privzete vrednosti `devInfinite`, `devSector`.
- `src/game/engine.ts`: `startRun(cls, support, opts)` z `sector`/`infiniteLives`; polji `devInfiniteLives`, `devSector`; `devHoldTheLine()` (vsak okvir, varovalka za HP igralca in vozil); `damagePlayer` ustavi HP na 1; `standDownIslandDefence()` + `cageEscaped` v `updateIslandDefence`; `Heli.retire` (helikopterji po pobegu odletijo in se odstranijo, namesto da bi pristali in šli v službo); HUD polji `devInfinite`/`devSector`.
- `src/components/CombatHud.tsx`: značka `DEV · INFINITE LIVES`.
- `src/index.css`: `operations-tools`, `screen-tool`, `dev-console`, `dev-sectors`, `dev-lives`, `dev-actions`, `combat-dev` (+ mobilne različice).
- `src/game/version.ts`: **v1.40.0 / ROUND 40 / QUIET WATER**.
- Prejšnja poročila: `docs/ROUND-39.md`, `docs/ROUND-38.md`, `docs/ROUND-37.md`.
