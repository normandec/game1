# ROUND 46 — FAIR PLAY

**Build:** `v1.46.0 · ROUND 46 · 2026-10-26` (codename `FAIR PLAY`)
**Branch:** `arena/469e156e-game1` · **PR:** #34
**Input:** the QA report from round 45 — one reachable section 🔴, nine 🟠, the whole 🟡 table of
wrong in-game instructions, and the smaller findings.

Everything below is fixed in this build, and every claim has a measured check behind it. The
report itself was not in the repository (`docs/AUDIT-2026-10-26.md` and
`scripts/audit-game.mjs` do not exist on `main`), so the work was done from the report text.

---

## 🔴 Critical

### 1. The transit to the finale announced "SECTOR 7/6"
`renderTransit()` built its destination from `this.sector + 1` and ignored `prisonFinale`, so
after the sixth general the screen read **"DEPLOYING TO SECTOR 7/6 · IRON RESERVE"** while the
operative was flying to THE CAGE.

The header, the destination line and the brief now follow the flag:
**"FINAL APPROACH · THE CAGE" / "PRISON ISLAND · LEVEL 7" / "THE LAST DIRECTIVE // FORCE THE
SALLY PORT"**. See `docs/round-46/r46-transit.png`.

### 2. Level 7 could start inside an invisible vehicle (softlock)
`startPrisonLevel()` only cleared `piloting` and `playerHeli`. A general killed from a tank, a
jet, the bomber, a van or a boat left the operative "driving" a hull that no longer existed —
camera on the causeway, controls bound to nothing.

Every mount is released on arrival: `playerJet`, `playerTank`, `drivingVan`, `drivingBoat`,
`flyingPlane` (and the bomber's `active` flag), the gun is lowered.

**Measured:** arrive with all six set → after `startPrisonLevel()` all six are `null/false`,
plane inactive.

### 3. A sector transition silently deleted AEGIS cells, allies and the bomber
`reset()` clears `aegisCharges`, `allies` and `plane`; `enterNextSector()` saved only score,
wave, perks, weapon and HP.

They are carried now:

| carried | how |
|---|---|
| AEGIS cells | the count itself |
| freed allies (stockade 14, glacier platoon, vault escort) | re-muster round the insertion point, same kind, same proportion of damage |
| the recovered bomber | set down on clear ground by `safeAircraftSpot()` (collision-tested), fuel and damage kept |

**Measured:** 3 cells + 2 allies (rifle at 50 % wounds, heavy) + bomber (900/1200, 55 % fuel)
through a transition → `aegis 3`, `allies 2` (`['rifle','heavy']`, 110 HP), plane present with
55 % fuel and 900 HP, sector 4.

### 4. Gunship and bomber had no refuel — dead after about two minutes
Land (F dismounts, the hull stays where it is) and walk up to it: a bowser and a fitter come
out. Fuel refills at 12 %/s, structure at 2 %/s, and the crew announce themselves while they
work. Called from `update()` every frame.

**Measured:** gunship at 10 % fuel / 400 HP and the bomber at 5 % / 600 HP, 5 s beside them →
**70 % and 490 HP**, **65 % and 720 HP**.

### 5. E on foot threw a grenade
`g`, `q` and `e` all threw the frag, and nothing in the game said so — E is the interact key in
most shooters, so walking up to a gate blew the operative up at 22 % a time.

**E does nothing on foot now.** G and Q still throw. In the cockpit E keeps its job (autopilot),
and in the prison it is still the use key. The control list says so:
*"G / Q / RMB — Frag on foot… E is never a grenade."*

**Measured:** E → **0** grenades thrown, G → **1**.

---

## 🟠 Behaviour that was wrong or misleading

6. **Best Combo lied on the end screens.** `hud.bestMult` is now in the HUD; Game Over and
   Victory show `x{bestMult}` instead of the current (usually 1) multiplier, and the HUD carries
   a live `KILL CHAIN xN · BEST xM` panel.
7. **Dev runs no longer reach the leaderboard.** `startRun()` sets `devRun` for a console deploy
   (any sector but 1, or infinite lives). `recordScore()` saves nothing for those runs and the
   end screen prints **DEV RUN · NOT RANKED**.
   *Measured:* normal deploy `false`, sector 6 `true`, infinite lives `true`.*
8. **Gunship panel restored.** The flight deck is back in the live HUD: fuel, hull, and the
   three stations with their magazines and the selected one lit.
   *Measured:* rendered HUD markup contains `FLIGHT DECK`, `FUEL`, and three station rows.*
9. **Battalion panel restored.** `IRON RESERVE · GENERAL QUARTERS — N/M FALLEN IN`, with a bar
   and the twin-gun count, turning red when the army is awake.
   *Measured:* `0 / 1000 FALLEN IN` present in a sector-6 HUD.*
10. **The vault airlock was decoration.** L sealed it, F refused to open it, Escape walked out
    anyway. Escape is now the same door as F: sealed means sealed.
11. **Escape with the kit open closed the kit *and* paused.** The kit listener now runs in the
    capture phase and stops the event, so one press does one thing.
12. **The 3D levels could not be paused.** Escape in the prison and in the glacier is now a real
    pause: the clock is reset, the simulation does not advance, the pointer is released and a
    card says the guards are not moving.
13. **Muting the game did not survive arrest.** `Prison3D` takes the surface mute switch and
    reports its own M key back, so the two stay in step.
14. **Duplicate `case 'column'` in `Prison3D`** — the unreachable branch (the only build warning)
    is gone.
15. **An old card could survive into a new run.** A fresh campaign now clears `this.tutorial`
    and the seen-set.
16. **"GENERAL EXPOSED" during Level 7.** The chip is hidden when there is no general left and
    no shield up, instead of telling the operative to finish a dead man.
17. **The 7.5 s transit and arrest cinematics can be skipped** — space, enter, X, Escape or a
    click; the screen says so under the progress bar.

---

## 🟡 The in-game instructions that sent players to the wrong place

| FIELD INTEL said | the world has | now |
|---|---|---|
| HELIOS at X 7300 / Y 3400 | X 7000 / Y 4950 (`campaignSites.ts`) | **X 7000 / Y 4950** |
| "six generators + four servers, destroy all ten" | 12 generators + 8 servers; only generators feed the grid | **"twelve generators and eight armoured server blocks … destroy all twelve generators — the racks pay well but do not feed the grid"** |
| third cantonment at X 9060 / Y 9700, "inside the outer rampart" | X 900 / Y 11600, outside the west wire | **X 900 / Y 11600** |
| GOLIATH centre X 2800 / Y 4520 | X 2600 / Y 4520 | **X 2600 / Y 4520** (README too) |
| Glacier door X 10710 / Y 9820 (README) | X 10690 / Y 9800 | intel was right; **README corrected** |
| E / Q grenades undocumented | — | **documented, E removed** |

Also updated: `<meta description>` still said **IRON VEIL** (that is what search engines show);
`version.ts` comments still said v1.40.0 / ROUND 40; `IRON VEIL` headers in `world.ts`,
`powerGrid.ts`, `sectorKits.ts`.

**Storage keys:** renamed `ironveil.*` → `solar-eclipse.*`, and both directions are handled —
the old key is still read as a fallback and still written alongside the new one, so **no saved
score or callsign is lost by the update** (a plain rename would have wiped every table).

---

## 🔵 Smaller

* A captured hull is no longer called a Hydra one: `CAPTURED TANK`, `REQUISITIONED TRANSPORT`,
  `KESTREL (CAPTURED)`, `NIGHTJAR (S.H.I.E.L.D.)`. The armour row reads `HULL ARMOUR / MAIN GUN`
  while driving instead of showing the operative's personal shield.
* The interception/bomber/naming fixes above are the whole list from that section that was
  actionable without inventing new mechanics; dead-code removal (`HudLayer`, `MenuScreen`,
  `TouchButtons`) and bundle splitting are queued for a round of their own.

---

## Regression

* `tsc --noEmit` clean · `npm run build` clean, **no warnings** (the duplicate case was the last
  one): **1 716.71 kB / 504.81 kB gzip**.
* 3 sectors × 1 200 scripted frames (movement, interaction, aiming): **0 exceptions**.
* Every fix above was checked by a scripted reproduction on the real engine; the numbers quoted
  are from those runs.

## Files

* `src/game/engine.ts` — finale transit, Level 7 dismount, sector carry-over, ground-crew
  service, E key, cinematic skip, dev-run flag, `bestMult`/`devRun` in the HUD,
  `safeAircraftSpot`, tutorial reset.
* `src/App.tsx` — dev runs unranked, prison mute wiring.
* `src/components/CombatHud.tsx` — flight deck, battalion panel, kill-chain panel, vehicle
  naming, armour row, capture-phase Escape, objective chip.
* `src/components/Screens.tsx` — Best Combo, DEV RUN badge.
* `src/components/Prison3D.tsx` — pause, mute sync, duplicate case removed.
* `src/components/Glacier3D.tsx` — pause.
* `src/components/VaultRoom.tsx` — the airlock is real.
* `src/components/OperationsMenu.tsx` — corrected intel, corrected dev note, corrected controls.
* `src/game/scores.ts` — new keys with the old ones still honoured.
* `src/game/version.ts`, `index.html`, `README.md`, module headers.

## Screenshots

`docs/round-46/`: `r46-transit.png` (the finale transit), `r46-gate.png` (gatehouse, unchanged
from round 45), `r46-turret.png` (emplacement pit, unchanged).
