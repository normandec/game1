# ROUND 50 — ON APPROACH (v1.50.0)

**Build:** v1.50.0 · 2026-10-27 · codename `ON APPROACH`
**Report:** after winning the first level, the bomber and the freed men simply *appeared*
next to the operative in the second level.

---

## 1. What was actually happening

`enterNextSector()` carries three things between levels: AEGIS cells, the freed men
(`saved.allies`) and the recovered bomber (`saved.plane`). Two of them were placed by
arithmetic on the same frame the new sector finished building:

```ts
// the plane: dropped on a clear spot
const spot = this.safeAircraftSpot();
this.plane = { ...saved.plane, x: spot.x, y: spot.y, vx: 0, vy: 0, active: false, bank: 0 };

// the men: dropped in a perfect ring around the insertion point
x: this.px + Math.cos(ang) * r, y: this.py + Math.sin(ang) * r
```

So the sector opened with a 1 200-hull strategic bomber standing in the grass and a circle of
soldiers facing outwards, at distances of 70–180 px, without one frame of them arriving. That
is the pop. Nothing else was wrong: the state was correct, the *presentation* was a teleport.

## 2. The fix — the escort lands, it does not blink

**`planeArrive` / `planeArriveTotal` / `planeArriveFrom` / `planeArriveTo`** (new fields on
`Game`) plus two methods:

* **`stagePlaneArrival(spot)`** — picks the edge of the map the escort is coming from (longest
  axis from the landing spot, never closer than 1.6 km), puts the aircraft there pointing at
  its landing spot, and starts a **5.5 s** approach. The sector banner says
  `ESCORT INBOUND · THE BOMBER FLEW ON WITH YOU — GIVE IT A MOMENT TO LAND`.
* **`updatePlaneArrival(dt)`** — eases the aircraft down the straight run (smoothstep), banks it
  slightly into the descent, throws wingtip vapour that turns to dust over the last fifth, and
  on the last frame parks it: `NIGHTJAR DOWN · [F] TO FLY`, a dust puff, rotor audio.

**Drawing (`drawPlane`)** — while the approach runs the aircraft is drawn **up to 150 px high**
(`altitude` from the remaining approach fraction), with its ground shadow offset below it, and
the caption reads `S.H.I.E.L.D. NIGHTJAR / ON APPROACH` — the same height system the aircraft
already uses in flight, so it reads as flying rather than floating.

**Boarding is refused until it is down.** `interactHeli` answers a press of `F` during the
approach with `STILL ON APPROACH — LET IT TOUCH DOWN` instead of teleporting the operative into
an aircraft that is still in the air.

**The men walk on.** The freed soldiers now come off the transport in a column behind the
operative — ranks of five, 42 px apart, 110 px back, each spot pushed clear of geometry with
`collide(spot, 14)` — with a small forward velocity, so they walk up into the formation
`updateAllies` already keeps. The caption is `${n} MEN OFF THE TRANSPORT`.

The approach is staged **at the start of the new level**, not during the 7.5 s transit
cinematic, so the operative is on the ground and watching when the aircraft comes down.

## 3. Measured (headless engine harness, jsdom + @napi-rs/canvas)

`enterNextSector()` from sector 1 with a bomber and two freed men carried:

```
t=0.0s  sector 2 | plane (260,9271)  | arriving 5.50 | allies 2 | player (1446,8371)
t=1.0s  sector 2 | plane (381,9192)  | arriving 4.50
t=2.0s  sector 2 | plane (677,9000)  | arriving 3.50
t=3.0s  sector 2 | plane (1047,8759) | arriving 2.50
t=4.0s  sector 2 | plane (1393,8535) | arriving 1.50
t=5.0s  sector 2 | plane (1614,8392) | arriving 0.50
t=6.0s  sector 2 | plane (1646,8371) | arriving 0.00   <- parked, [F] works

distance to touchdown each second: 1509 1156 714 302 38 0
ally formation offset after 7 s: 120 px (their standing formation, not the drop point)
```

Rendered frames confirm the two states: `ON APPROACH` with the airframe high over its shadow,
then `[F] BOARD` sitting on the ground.

## 4. Files touched

```
src/game/engine.ts          planeArrive / planeArriveTotal / planeArriveFrom / planeArriveTo,
                            stagePlaneArrival(), updatePlaneArrival(), update hook,
                            drawPlane() altitude + caption, interactHeli() hold-down,
                            allies disembark in a column, same-sector captions
src/game/version.ts         1.49.0 → 1.50.0
docs/round-50/ROUND-50.md   this report
```

## 5. Build

`tsc --noEmit` clean · `npm run build` clean — **1 739.57 kB / 510.94 kB gzip**, no warnings.

## 6. Not changed

What survives a sector (AEGIS cells, men, bomber, telemetry lessons), the formation the allies
hold, bombing and flight, the transit cinematic, the prison, the command core, scores and the
leaderboard. The carried gear still arrives — it just arrives visibly now.
