# ROUND 49 — TWO DOORS (v1.49.0)

**Build:** v1.49.0 · 2026-10-27 · codename `TWO DOORS`

Two small things, both about a player not having to guess.

---

## 1. The developer button is off

The DEV button sat in the header of the operations menu — the only screen every player sees —
next to `FULLSCREEN`, and offered **a jump to any sector** and **infinite lives** to anyone who
pressed it. That is not a menu control, it is a cheat with a friendly label.

`src/components/OperationsMenu.tsx` now renders it only when the game is opened with `#dev`
in the address:

```ts
function devConsoleUnlocked() {
  if (typeof window === 'undefined') return false;
  return /(?:^|[#?&/=])dev\b/i.test(`${window.location.hash}${window.location.search}`);
}
```

* Normal load — `https://normandec.github.io/game1/` — the button does not exist, and neither
  does the console behind it (both the button **and** the panel are gated, so the panel can
  never be left open from a previous state).
* Opt-in — `…/game1/#dev` — the button and the console return exactly as they were.
* A console run still never reaches the leaderboard; that rule is untouched.

Nothing else changed: same sector picker, same infinite-lives option and its explanation.

## 2. The prison now says where you can escape

The old card said "the sally port is the way out", which is no help to a man standing in a cell
in the middle of a 216-metre building, and it never mentioned the second exit at all.

**On entry (`engine.enterPrison`)** the card is now `THE CAGE · TWO WAYS OUT`:

* your cell — shoot the gold lock, three hits;
* **way out 1 — SALLY PORT**, the south wall, dead ahead; opened by the lever in **CONTROL B**,
  the south-east control room, held with the mouse;
* **way out 2 — SERVICE GRATE**, the **workshop on the east side**, north of the armoury; no
  lever and no key, stand on the floor grate and hold left mouse for about four seconds;
* and the optional master handle in **CONTROL A** (south-west) that opens all 360 cells.

The last level's card keeps the command core, and gains the line that the exits are unchanged
and that killing the core opens both.

**On the HUD (`Prison3D.tsx`)** the objective box is now a live escape board:

```
OBJECTIVE · GET OUT OF THE CAGE
1 · SHOOT THE GOLD LOCK ON YOUR BARS (3 HITS)
TWO WAYS OUT
· SALLY PORT — SOUTH WALL, 84 m · LOCKED: HOLD THE SALLY LEVER IN CONTROL B (SE)
· SERVICE GRATE — WORKSHOP, EAST SIDE, 39 m · NO LEVER: HOLD LMB ON THE FLOOR GRATE
OPTIONAL MAYHEM · CONTROL A (SW) MASTER HANDLE OPENS ALL 360 CELLS
```

Distances and states are live (`hatchOpen`, `sallyDist`, `hatchDist` in the HUD snapshot), so
the board answers "which door is closer, and what do I have to do to it".

**The compass leads with the doors.** It used to list the core, then the bars, then all five
levers — so the exits fell off the four-slot strip exactly when they were needed. Order is now
`CORE` (last level only) → `SALLY S` → `GRATE E` → `BARS` → levers.

**Also said twice more:** the wake-up cinematic names both routes under
`WAY OUT 1 · THE SALLY PORT` / `WAY OUT 2 · THE SERVICE GRATE`, and the HELP popover, which
only ever mentioned the south gate, now describes the grate as well.

## 3. Files touched

```
src/components/OperationsMenu.tsx   #dev gate on the button and the console
src/components/Prison3D.tsx         escape board, compass order, cinematic, help text,
                                    Screen.hatchOpen / sallyDist / hatchDist, EMPTY coreHp 750
src/game/engine.ts                  THE CAGE · TWO WAYS OUT card, finale card line
src/game/version.ts                 1.48.0 → 1.49.0
docs/round-49/ROUND-49.md           this report
```

## 4. Verification

* `tsc --noEmit` clean.
* `npm run build` clean — **1,737.09 kB / 510.15 kB gzip**, zero warnings.
* Menu rendered twice through `react-dom/server`: normal load → no DEV button, no console;
  `#dev` load → both present. Campaign-directive button present on both.
* Prison distances checked against the geometry they describe: sally port at `z 108` in the
  south wall, service grate at `(99, −19)` in the workshop, both matching the escape tests
  (`sallyOpen && pz > 104 && |px| < 9`, and the open-grate walk-out).

## 5. Not changed

The prison layout, the levers, the guards, the command core, capture, scores and the
leaderboard. Nothing was removed from the menu — only one button is no longer drawn unless it
is asked for.
