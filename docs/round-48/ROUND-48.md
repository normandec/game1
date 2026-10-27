# ROUND 48 — FIELD GUIDE (v1.48.0)

**Build:** v1.48.0 · 2026-10-27 · codename `FIELD GUIDE`

## 1. What was missing

Round 47 told the player *what* ends a level. It did not tell them what is worth finding on
the way — and the two best places in the game announce nothing: a S.H.I.E.L.D. compound that
can be taken back, the Black Vault (the one base that never fell), and the glacier vault in
sector 3. A player could finish the campaign without ever learning what an OVERRIDE does or
that the ice wall is a door.

## 2. The briefing is now two pages

`src/components/CampaignDirective.tsx` — still a once-per-machine card on first entry, now
with a page indicator and a `NEXT — WHAT YOU WILL FIND` button.

**Page 1 — WHAT WINNING MEANS** (unchanged from round 47): sectors 1–6 destroy the general,
level 7 destroys the CAGE command core.

**Page 2 — WHAT YOU WILL FIND.** Three entries, each in the same shape: *how you know it*
(the silhouette you can recognise from the ground) and *what you get*.

| Place | How you know it | What you get |
| --- | --- | --- |
| **S.H.I.E.L.D. outpost** — every sector | walled bunker yard, four gates, a mast; in the middle a lit uplink console on a plinth with a teal ring on the concrete | stand on it ~30 s → +35 000, garrison stands down, gates open, four allies (medic, heavy, 2 rifle), six health/shield/AEGIS drops, every crate and hull in the yard |
| **The Black Vault** — all sectors, hatch ≈ X 980 / Y 7040 | low concrete lip in a plaza, open north hatch, lit stair down; white lights, eagle still on the wall, no HYDRA red | a full S.H.I.E.L.D. hangar below: aircraft requisitions, supplies, medical bay, Carter archive; the surface is unchanged when you come back up |
| **The glacier vault** — sector 3 only, ≈ X 10690 / Y 9800 | the ice wall is a door: lamp over a steel bulkhead, `GLACIER VAULT / ENTRY` stencil, pulsing blue apron, marked `ICE` on the map from the first frame | cavern base in 3D, two aircraft wells, hangar gantry, ice guard battalion; 20 frozen 1ST WINTER SHIELD troopers who fight for you and drag you out if you fall; the **FROSTWING** (900 hull, 2.2 km/s, 20 flares, 3 200 m seeker, +22 000) and permanent ice-plated interceptors |

Footer names the stockade (fourteen soldiers for whoever breaks the door) and points at
FIELD INTEL for the rest.

## 3. Re-readable, and shown again once

* The start screen now carries `CAMPAIGN DIRECTIVE — WHAT WINNING MEANS & WHAT YOU WILL FIND`
  under the deploy button (`.operation-directive` in `index.css`, in the menu's own type), so
  the briefing is never lost.
* The seen-flag moves `solar-eclipse.briefed.v1` → **`.v2`**: the field guide is new, so every
  returning player is told once more. Nothing else in storage moved.

## 4. Files touched

```
src/components/CampaignDirective.tsx   two pages, page dots, Place blocks, optional initialPage
src/components/OperationsMenu.tsx      onDirective prop + re-read button on the operation hero
src/App.tsx                            passes onDirective (opens the card over the menu)
src/game/scores.ts                     briefed key v1 → v2
src/index.css                          .operation-directive styles
src/game/version.ts                    1.47.0 → 1.48.0
docs/round-48/ROUND-48.md              this report
```

## 5. Verification

* `tsc --noEmit` clean.
* `npm run build` clean — **1,735.26 kB / 509.44 kB gzip**, zero warnings.
* Both pages server-rendered to static markup and read back: page 1 carries both win conditions,
  page 2 carries all three places with both halves (recognition + reward).

## 6. Not changed

Win conditions, the general-per-sector loop, the prison, the CAGE command core, the army
district, scores and the leaderboard. The briefing is additive: nothing was removed from the
menu, and the map opens exactly where it did.
