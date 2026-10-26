# ROUND 43 — CHAIN OF CAUSE (v1.43.0)

Every action in this round has a physical origin and a logical consequence. Nothing appears
out of nothing, nothing leaves the map, and nothing that is destroyed comes back.

## 1. The three reported glitches (done first, as ordered)

| Report | Cause | Fix |
|---|---|---|
| Boarding the interceptor paints the screen white | 0.35 s full-screen cyan flash + a pale `#a9bdb4` airframe that filled the viewport at close camera zoom + 12 px bright contrails | Flash removed (a local apron light replaces it, 0.10–0.12 on the two experimental hulls only); airframes re-finished in low-contrast grey-green `#77897f` / steel blue `#8fb9c8`; glass, ribbon and pool-of-light alphas cut. Mean frame brightness on boarding: **69.7 → 33.4** (640×360, same test). |
| "There are no tanks anywhere" while flying | (a) the alarm only fired for a man on foot inside the base rect, (b) armour spawned in the western park 4 km from the airfield, (c) live hulls spawned inside the 112 parked ones and could not drive out, (d) ground art was drawn *over* the aircraft | Alarm now also raised by an aircraft inside the district region; the wing has its own six fuelled hulls on the flight line and waves come out of the **nearest** line; a hull that lands in a blocked bay is moved to the nearest clear lane; tanks never chase an aircraft (they hold air-defence posts and shoot up); the aircraft got its own draw pass **above** the ground war. Measured: flying over IRON RESERVE, armour **16 → 34 hulls**, hulls within 1 500 m of the aircraft **0 → 25**, tanks inside the camera window **0 → 3**. |
| A shot-down interceptor can be re-boarded at full health | `downJet` set `state='parked'` and `seizeJet` ran `j.hp = Math.max(j.hp, j.maxHp * 0.8)` on every boarding | New terminal **`wreck`** state (`wreck`, `wreckT`): a wreck is not parked, cannot be boarded, never launches, never restocks and is drawn burnt and canted over with a `WRECK · SERIAL` tag. The 0.8 restore is gone: a hull comes back with the holes it took. Verified: re-boarding a wreck starts no chain, sets no aircraft, `hp` unchanged. |

## 2. Take-off chain of causality

`F` on a parked airframe is an **order**, not a teleport:

1. **crew** — a pilot and two fitters walk out of the hangar door (or the dispersal tent) to
   the aircraft; the operative walks to the cockpit at 250 m/s of screen time;
2. **board** — canopy, straps, 1.2 s;
3. **taxi** — the aircraft rolls at ≤110 px/s from its bay to the nearest runway threshold;
4. **roll** — 0 → 330 px/s along the runway;
5. **airborne** — only now does `playerJet` exist.

A HUD checklist shows which link is running (`F · ABORT THE ORDER` cancels). If the hangar
behind the airframe is destroyed at any point, or the airframe is, or the operative is, the
chain is void: `TAKE-OFF ABORTED`. Measured: forward dispersal LN-101, links at
**walk 0.1 s → board 1.5 s → taxi 2.7 s → roll 4.6 s → airborne 5.3 s**; hangar destroyed on
the apron → **aborted at 0.1 s, no flight**.

Aircraft inventory is finite: the wing is the aircraft parked in the world. Hunters launch
from the apron they are standing on; the off-map squadron flies in only while its reserve
(finite, 10) lasts, then reports `AIR DEFENCE SPENT`.

## 3. The world edge is a wall

Player and AI airframes are stopped at a 260 px margin and turned back toward the arena
(`AIRSPACE BOUNDARY · TURNING BACK`). The old mirror (`ang = PI − ang`) is gone. Measured:
hull forced to x=40 → held at **x=260**; hostile hull forced to x=200 → back to **x=853**
inside the wall.

## 4. Water is a wall

The sea is painted into both route planners as permanent no-go ground
(`RoutePlanner.setTerrain`, infinite move cost) and the shoreline is a hard collision for
every infantryman (`holdOnLand`: the step is refused, the axis that is still dry is kept so
a man slides along the beach). Measured: 4 soldiers pushed at open water for 6 s →
**0 in the water**; 40 line-of-sight probes across the bay → **0**; a real route across the
bay → **0 wet nodes**.

## 5. Ditching

A hull that comes down in open water puts the pilot in a **survival skiff** on the spot
(`makeBoat('skiff','player')`, the operative is at the helm) and **every aircraft in the
district is recalled** — air response, heat, waves and inbound rockets zeroed, hunters
ordered home, gunships waved off, `AIR OPERATIONS SUSPENDED` on the HUD. Measured: boat
`skiff`, on water, `airResponse 0`, active hunters **0**, serving gunships **0**, airframe
`wreck`.

## 6. This round's second batch (reported from the live build)

* **Capture blockers** — the defender count included sleeping parade ranks, men still
  materialising (`spawnT`), civilians and anyone already in a transport. A cleared objective
  therefore kept claiming defenders. Only awake, present, living men count now.
* **Tanks shooting tanks** — a main-gun shell is flagged `shell` and no longer damages
  friendly armour; only the operative's captured hull can be hit by one.
* **Turret shooting itself** — a twin mount now has a 150 m dead zone: a target inside the
  pit is inside the mount, so the crew holds fire instead of swinging the barrels onto the
  apron they are standing on.
* **Doors in the wall** — `drawGate` cuts the opening first: recessed threshold, shadowed
  reveal, jambs with a concrete cap and a lintel behind the leaves. Every hydraulic gate in
  the game draws through it.
* **The flight line** — six revetments, a fuel point and bowser park, and two hardened
  aircraft shelters added to the wing, so the airfield reads as a dispersal.
* **First-time cards** — the first time the operative takes an aircraft, a tank, a boat, a
  gunship or the brig, the simulation **stops** and a field-manual card explains the
  controls. Any key or click continues; each card appears once per run.
* **Dev mode** — infinite lives now cover aircraft **and vessels** (`drivingBoat`,
  `drivingVan`), not just the man and his airframe.

## Verification

jsdom + `@napi-rs/canvas` harness, 1280×720, sector 6, real `Game` instance, `npm run build`
clean, `tsc --noEmit` clean.
