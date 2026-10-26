# ROUND 45 — REAL BASE

**Build:** `v1.45.0 · ROUND 45 · 2026-10-26` (codename `REAL BASE`)
**Branch:** `arena/a146a682-game1` · **PR:** #33
**Scope:** the four screenshots from the report plus five standing rules that were not being
honoured in play. Nothing was removed; every change below adds a guard, a card or a piece of
ground.

Every number in this file was measured on the build in this branch, not estimated.

---

## 1. PNG 1 — a door is a hole in a wall, not a panel on it

The three base gates were drawn as flat brown rectangles with painted chevrons sitting **on**
the wall face. They are 210 px leaves split into 105 px sections by `prepareStructures()`, so a
naive per-rect draw produced four small doors per gate.

* `Rect` now carries `armyGateId`, `armyGateW`, `armyGateH` (`world.ts`); the gate builder sets
  them (`army.ts`).
* `resetWorld()` groups every leaf back into one gate: `armyGateFrames`, three entries —
  `{leaves: 4, 420×70}`, `{leaves: 2, 300×90}`, `{leaves: 2, 220×100}`.
* `drawArmyGate()` draws the whole gatehouse once per frame: threshold, jambs, lintel, two
  inset steel leaves with a centre seam, hazard band, hydraulic rams, status lamp, HP bar. The
  leaves sit **in** the frame, recessed, and the wall band runs behind them.
* `drawStructures()` clears `gateFrameDrawn` each frame and routes `o.armyGate` to it once.

**Measured:** 3 gates → 3 gatehouses, 8 leaves, 0 fragments.

## 2. PNG 2 — the emplacement no longer shoots itself

The twin mounts fired from a muzzle 64 px out while their own sandbag walls sat 40–128 px away:
the round was born inside its own parapet. Two fixes, both needed:

* **Data** — `ArmyTurretSpot.pit` / `.pitBox` record the three sandbag walls as live rects;
  the engine's `ArmyTurret` carries `pit`, every round fired by a mount carries `ownPit`, and
  the obstacle sweep skips rects that belong to the gun that fired it.
* **Art** — the pit is now drawn as a dug emplacement: shadow, concrete floor, an arc of fifteen
  sandbags that opens toward the guns' arc. The eye can see where the parapet is.

**Measured:** 6 turrets firing for 600 frames at a target 420 px away → **0.0 HP** lost by the
mount's own pit, **0.0 HP** lost by the mount itself, and the gun fires (muzzle flash non-zero).

## 3. PNG 3 — the odd arrangement

Two separate causes, both fixed:

* **Gun pits standing in the road.** 2 of 16 emplacements had been sited on the perimeter
  carriageway — sandbag walls straddling tarmac, mount in the traffic lane. `pave()` now
  refuses any candidate road that touches a `pitBox`, and a relocation pass steps any surviving
  emplacement (walls *and* mount, so it stays one object) out to the nearest clear shoulder.
  **Measured: turrets on a road 2 → 0.**
* **Clutter parked on tarmac.** The new carriageways were laid after the yards. A road-clearance
  sweep steps loose kit (crate, barrel, truck, tent, sandbag) off the kerb — first clear nudge
  wins, structures never move. **Measured: props with >35 % of their footprint on a road
  14 → 9 of 500.**
* **HUD.** The KIT chip was pinned at `bottom: 164px` and the vitals grew upward from
  `bottom: 25px` — on any viewport where the vitals block is taller than 139 px the chip landed
  on the health bar, and the armour row printed through "RIFLE / UNLIMITED". The whole
  bottom-left corner is now **one flex column** (`.combat-bottom-left`: kit, vitals, comms).
  Nothing in it is absolutely positioned, so the overlap is impossible by construction. The
  action bar also lifts to `bottom: 84px` below 1040 px wide so it cannot reach the column.
  `docs/round-45/r45-gate.png` shows the corner in flight.

## 4. Dev mode — infinite lives cover the vehicles too

`devKeep()` already held the jet, the recovered bomber, the tank, the boat, the van and the
gunship at one point of structure; `devHoldTheLine()` now also holds every manned airframe in
the sky, so a hunter's good pass cannot end a dev run by killing the aircraft out from under the
operative.

**Measured (damage applied through `damagePlayer` while driving):** interceptor 1 HP, gunship
1 HP, boat 1 HP, van 1 HP, tank 1 HP, operative 100/100. The dev checkbox now says exactly this
in the console.

## 5. The base reads as a real installation (PNG 4 reference)

Built on the round-44 layout rework:

| | count |
|---|---|
| road zones inside the wire | **112** |
| district fence runs | **311 rects**, 9 planned runs |
| painted markings (bays, lanes, marshalling boxes, arrow) | **34** |
| gun pits | **16**, all off the carriageway |
| gates as gatehouses | **3** of 3 |

`docs/round-45/plan45.png` is the whole installation to scale: ring road inside the wire, a spur
to every district, runway and flight line south of the halls, motor pool with its own apron,
magazine and fuel farm wired off, training ground with its ranges. `r45-compound.png` and
`r45-turret.png` are the same ground from the operative's height.

## 6. No tank can shoot a tank

`explode()` no longer applies main-gun (`shell`) damage to **any** hull — not the battalion's,
not a captured one, not the hull that fired it. `hurtTank()` also refuses the operative's own
driven hull, so its splash cannot chew through itself while it sits there firing.

**Measured:** two friendly hulls inside one 175 px / 240 dmg blast → **1900 → 1900** and
**1900 → 1900**. The same blast as a rocket → **1900 → 1780**. Captured hull firing beside
itself → unchanged. Armour is still killed by rockets, frags, bombs, the air wing — and by
being taken.

## 7. Capture no longer lies about defenders

The count was taken over `max(420, 0.8 × r)` — 1 200 px on the IRON RESERVE, 1 440 px on the
airfield — so a trooper three blocks away, a man still materialising or one asleep in a room
held the objective down from off screen. Now:

* the radius is `min(560, max(300, 0.32 × r))` — the ground the operative is standing on;
* the count excludes civilians, the dormant, men with `spawnT > 0`, and anyone in a transport;
* **six seconds** on the point with no defender able to draw a line to the operative opens the
  uplink anyway ("GARRISON UNREACHABLE — UPLINK OPEN"), so a stuck defender can never lock a
  cleared base again;
* the HUD says **where** the hold-outs are: `NEAREST HOLD-OUT 118 m NNE`.

**Measured:** 27 live defenders inside the circle → uplink locked. All 27 killed → the *same key
press* opens the override. Previously the same 27 men counted from 1 200 px away while standing
outside the compound.

## 8. Every new thing stops the game and explains itself

Ten milestone cards, each a hard stop with a "press any key to resume" line:

`deploy` (first deploy — the how-to-play card the report asked for), `capture` (first base
secured), `stockade` (first brig broken), `turret` (first twin gun seized), `vault` (first entry),
and the five that already existed: `jet`, `prison`, `heli`, `tank`, `boat`.

## 9. Regression

* `tsc --noEmit` clean.
* 3 sectors × 1 800 frames of scripted play (movement, interaction, aiming, capture attempts,
  rolling armour): **0 exceptions**.
* Build: **1 706.34 kB / 502.11 kB gzip**.

## Files

* `src/game/army.ts` — pit rects, pit relocation, road/pit exclusion, road-clearance sweep,
  markings, fences, gate ids.
* `src/game/world.ts` — `Rect.armyGateId/armyGateW/armyGateH`.
* `src/game/engine.ts` — gatehouses, turret pit art, `ownPit`, no tank-versus-tank, capture
  radius + standoff, dev airframe hold, milestone cards, compass helper.
* `src/components/CombatHud.tsx`, `src/index.css` — one bottom-left column.
* `src/components/OperationsMenu.tsx` — what infinite lives actually covers.
* `src/game/version.ts` — `1.45.0 / ROUND 45 / REAL BASE`.

## Screenshots

`docs/round-45/`: `r45-gate.png` (gatehouse + HUD corner), `r45-turret.png` (pit and parapet),
`r45-compound.png` (motor pool, halls, barracks), `r45-card.png` (the deploy card),
`plan45.png` (whole base to scale).
