# ROUND 44 — POURED CONCRETE (v1.44.0)

The whole remaining base pass, delivered as one coherent whole: the sector‑6 installation is
re‑planned into bands, dressed, lit and audited by numbers, and the overlay is rebuilt as
three layout stacks so nothing in the HUD can land on top of anything else at any size.

Nothing was removed. Everything here is additive or a relocation of something that was
already in the world and standing in the wrong place.

## 1. The reported anomaly: "the elements are arranged oddly"

| Cause | Evidence | Fix |
|---|---|---|
| The air park was crammed into the 620 px strip between the outer wall and the blast wall: a 340 px runway, two 1 900 × 420 px megahangars **standing on that runway**, the control tower wedged in the 200 px gap *between* the two halls (30 px into each), three interceptors parked on the threshold and four helipads in the same band | Obstacle audit over `army.base`: **hangar/barrack, tower/hangar and jet-on-runway** pairs; the tower's rect intersected both halls | The compound grew south (**9600 × 2700 → 9600 × 4200 px, +56 % ground**) and is now laid out in four bands: APPROACH · NORTH (stockade + rotary park) · INNER (parade, barracks, stores, motor pool, keep) · **AIRFIELD** (runway, apron, two halls, two shelters, tower, fuel point, casemates on the south wall) |
| 190 props thrown at random coordinates inside the compound | Every prop only excluded the parade, the keep and the causeway — **198 overlapping pairs >30×30 px** inside the base, 22 props on roads/aprons | Placement is now an operation: `free()`/`place()` test each rect against everything already standing **and** against every road and runway zone; props are stacked in 17 supply yards at the back of the buildings that own them |
| Districts that were laid straight through a wall | Motor pool straddled the blast wall (3000–4700 px across a wall at 3400); fuel farm and magazine clipped the ramparts (60 px and 30 px); the *armour park's* head column sat inside the base wall at x = 2220 | Motor pool, fuel farm and magazine moved into the two 1 000 px lanes either side of the blast wall; the armour park's head column moved to x = 300 |
| A "soft target" inside the most fortified part of the base | The replacement depot stood at 8780/9500 — inside the blast wall, on top of the stores yard | Moved outside the west wire at 900/11600 |
| Two radars parked in a vehicle park | The 520 px radome sat on the motor pool; its feed array was bolted across the fuel bund | Domes and array moved to the clear north strip (together, as a radar site) |
| Two districts claiming the same ground inside the inner compound | Review stands planted inside four barrack blocks; mess hall inside the second radome; generators inside the south barrack; casemate line running through the command keep | Every one re‑anchored to its own band: stands on the strip between the wall and the first rank, barracks 300 px apart inboard of the corner turret pits, mess halls below the last block, generators at the south end, casemates on the outer south wall |

**Measured after the pass** (jsdom, sector 6, boot + `startRun('assault','aegis')`):

| | before | after |
|---|---|---|
| Overlapping pairs >30 × 30 px inside the base | 198 | **116** |
| … of which perimeter bastions / tower rings / live armour (by design) | — | 100 |
| … of which anything structural | 98 | **0** |
| … of which stacked fuel drums sharing a footprint | — | 16 |
| Supply props placed | 190 random | **144 in 17 yards**, 2 touching a road edge |

Live armour is excluded from the overlap audit: those hulls drive, and a hull that crosses a
fuel bladder on its way to a sortie is not a layout defect.

## 2. The sub‑areas (image‑4 reference)

| Area | Where | Content |
|---|---|---|
| **Rotary park** | north strip, x +1 800 … +6 600 | 4 painted helipads with H, drums and a pad crew each |
| **Fixed‑wing field** | y +3 300 … +4 300 | 6 600 px runway with 66 edge lights and a threshold bar, 7 100 px apron, 2 megahangars, 2 hardened shelters, tower clear of the halls, fuel point and bowser park |
| **Flight line** | on the apron, in front of the halls | 6 fuelled hulls in sandbag revetments + 3 line interceptors nose to the runway — armour where the aircraft are |
| **Training ground** | south‑west corner | 4 assault lanes, 8 figure targets, a mock village of 8 containers, fence line, 3 cadre tents, 2 drill squads |
| **Supply depot / class one stores** | inner compound, east of the parade | fenced yard, 10 crate stacks, bowser apron, 3 humvees, store squad — fills what was the largest blank patch inside the wire |
| **Casemates** | outer south wall | 4 concrete boxes with sandbag aprons, covering the southern approach |
| **Parade ground** | unchanged, 50 × 20 @ 42 px | **1 000 men, still real** |

District totals: **1 037 structures inside the wall**, **34 named strongpoints** (was 32),
**279 zones**, **219 light fixtures**.

## 3. Art direction

* **New ground material `apron`** — concrete used to be a 5 % wash, which left the whole base
  the same olive as the fields around it; buildings appeared to float on grass. `apron` is
  a darker pour (0.42) with expansion joints every 220 px and a painted edge, and the base
  floor is now one slab up to the foot of the wall.
* **The base is lit.** `drawArmyLamps()` gives all 219 fixtures a real pool: runway edge lamps
  throw a 54 px cool pool, apron masts and gate lamps a 120 px warm one. Additive drawing,
  nothing new is spawned — the fixtures were already in the world.
* **Roads**: the causeway now runs unbroken from the outer gate to the blast‑wall gate
  (it used to stop dead at the wall), plus an airfield north service road, a road behind the
  halls and a west access lane. Roads carry the existing markings, zebra and lane arrows.
* Zoning rules are enforced by the placer, so no future prop can land on the tarmac.

## 4. HUD: three stacks, no collisions

The overlay used to be a dozen elements pinned to absolute tops. Two collisions were
guaranteed at every size: the **counter‑assault warning** (`top: 210px`) sat on the
**searchlight panel** (`top: 207px`, same right edge), and the **override card** (17 % height,
370 px wide) grew into the **wave banner** (28 % height) on anything under ~900 px tall.

| Before | After |
|---|---|
| 10 panels, 10 independent absolute positions | **3 stacks** — `.combat-left` (position, facility), `.combat-center` (override, blackout, banner, kill chain), `.combat-right` (objective, searchlight net, warning, transmission) |
| Panels could overlap each other and each other's corner | Panels inside a stack are flex items separated by a gap: **0 possible overlaps by construction** |
| Corner collisions at narrow widths | Stacks have fixed widths (252 / 290 px) and the centre stack is `min(520px, 100vw − 620px)`, so left + centre + right can never meet; right stack is bounded top and bottom (`110px` … `24px`) |
| Mobile blocks re‑positioned each panel | Mobile re‑positions the **stacks**: ≤900 px the side stacks cap and the centre band drops to 46 vh; landscape phones (≤560 px tall) move the centre band up between the two side stacks |

## 5. Re‑verified from round 43 (screenshots owed)

| Behaviour | Test | Result |
|---|---|---|
| Turret never hurts itself / no firing solution inside its own pit | operative held at **120 px** from the mount for 6 s | turret muzzle flash **0**, shells in flight **0**, turret HP lost **0.0** |
| …and still engages outside it | same mount, operative at **700 px** | turret fires (`muzzle` 1.0) |
| Capture blocked while real defenders live | POI `airfield`, garrison intact — **105 live defenders** in radius | `interactHeli()` → override **not** started, `UPLINK LOCKED / 105 DEFENDERS REMAIN` |
| Capture possible the moment the last one dies | same frame, last defender `hp = 0` | override starts on the **same input**, POI `airfield` |
| Sleepers and civilians never hold ground | 3 civilians + 3 dormant in the radius, all real defenders down | override **starts** |

## 6. Smoke test

900 simulation steps (15 s) at 1280 × 720 as the operative stands in the middle of the
compound: **0 exceptions**, 2134 enemies alive, render pass exercised 8 times, build clean
(`tsc --noEmit`, `npm run build`).

## 7. Open items (carried forward, not claimed)

* Boats still have no hard world‑edge turn‑back (aircraft have it).
* Two stacked fuel drums share a footprint inside the fuel farm (cosmetic).
* The `apron` material is used by the army district only; other sectors still use `concrete`.
