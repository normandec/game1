# ROUND 47 — ONE TARGET (v1.47.0)

**Build:** v1.47.0 · 2026-10-27 · codename `ONE TARGET`
**Theme:** the game finally says, out loud and up front, what "winning" means — and the last
level stops being "walk out of the prison" and becomes "destroy one named machine".

---

## 1. What the round was about

Two complaints, one cause: nothing anywhere in the build ever stated the win condition, and the
final level's victory was a stealth escape that a player could complete without ever knowing
they had finished the campaign.

Round 47 therefore does exactly two things:

* **A briefing on first entry.** The first time the game is opened on a machine, a full-screen
  card states the goal in two panels: sectors 1–6 end with the HYDRA general, level 7 ends with
  the CAGE command core. It is shown once (`solar-eclipse.briefed.v1`), it does not touch the
  existing intro/`OperationBriefing` flow, and it can be dismissed with one button.
* **A destructible target as the finale's win condition.** The last level now contains one
  specific, named, shootable object. Destroying it ends the campaign.

Everything else in the build is untouched. Additive only.

---

## 2. The target of record — CAGE COMMAND CORE

| Property | Value |
| --- | --- |
| Name | **CAGE COMMAND CORE** |
| Location | CONTROL A, back wall — prison world `(-56, 91.2)`, at eye height `1.15` |
| Size | 4.4 × 1.7 × 2.25 m, solid (you cannot walk through it) |
| Health | **750** (`spec.damage × 1.4` per round) |
| Pistol | 12 rounds — exactly one M9 magazine |
| Carbine | 10 rounds |
| On death | every cell lock opens, the sally port opens, the alarm spikes to 1, debris burst |
| 1.6 s later | `phase = 'escaped'` → the existing `leavePrison(stats, escaped)` victory path |

The victory path was deliberately **not duplicated**: `destroyCore()` does not call victory
itself. It opens the prison and stages the ending through the same `escaped` phase that the
engine already scores, sanitises and rewards. One exit, one place that can grant a win.

### The self-blocking-reticle bug

Making the core solid made it unshootable for a moment: the hitscan wall march in `fireOne()`
stopped on the machine's own front face, so every round aimed at the middle of the target
reported `wall` a metre short. The march now steps *through* the core's footprint and lets the
candidate test decide, so the core is a target and not scenery. Verified: 12 aimed pistol rounds
from `(-56, 89.2)` → 12 core hits → `hp 0` → `dead` → `phase 'escaped'` after **1.62 s**.

---

## 3. How the game says it

* **First-run briefing** — `src/components/CampaignDirective.tsx`, mounted from `App.tsx` over the
  start screen while `status === 'menu'`, gated by `loadBriefed()` / `saveBriefed()` in
  `src/game/scores.ts`. Two columns: `SECTORS 1–6 · DESTROY THE GENERAL` and
  `LEVEL 7 · THE CAGE · DESTROY THE COMMAND CORE`, a footer that says the same rules live on the
  deploy card and the HUD, and a single `UNDERSTOOD — TO THE MAP` button.
* **Deploy card** — the milestone card before the campaign now states the win condition in four
  lines instead of describing the sector.
* **HUD** — `Hud.targetName` / `Hud.targetHp`, a `TARGET` block under PRIMARY OBJECTIVE in
  `CombatHud.tsx` (`.combat-target`), reading `SUPREME GENERAL n/6` or `CAGE COMMAND CORE`. When
  the target is the core there is no surface-side health number, so the block prints
  `ONE TARGET · DESTROY IT TO WIN` rather than an empty bar.
* **Prison HUD** — `Prison3D.tsx` draws the real thing: `CAGE COMMAND CORE`, its health bar,
  `hp / max`, live distance, and `CONTROL A · DESTROY IT TO END THE WAR`; the compass leads with
  `CORE`; within 7 m the prompt `PRIMARY TARGET · SHOOT THE COMMAND CORE` appears.
* **On the way in** — entering THE CAGE on the finale shows a dedicated four-line tutorial card
  (`prison-finale`) instead of the old "find the sally port" card. A visit to the prison in any
  other state still gets the ordinary card.
* **Story card** — the FINAL DIRECTIVE text now names the core and says there is no general left.
* **Objectives and banners** — level 7 objective is `LEVEL 7 · THE CAGE — DESTROY THE COMMAND
  CORE`; killing a sector general prints `SECTOR SECURED · GENERAL DESTROYED`; the campaign
  finale prints `CAMPAIGN COMPLETE — COMMAND CORE DESTROYED · n INMATES RELEASED`.

---

## 4. Files touched

```
src/game/prison.ts            PrisonCore, core field, 'core' prop, fireOne() hit kind,
                              damageCore() / destroyCore(), core-death staging, summary fields
src/components/Prison3D.tsx   core geometry, compass, snapshot, prompt, target panel
src/game/engine.ts            Hud.targetName/targetHp, finale tutorial card, story card,
                              objective + banner text, general-death banner
src/App.tsx                   emptyHud.targetName/targetHp, CampaignDirective mount
src/components/CampaignDirective.tsx   NEW first-run briefing
src/components/CombatHud.tsx  .combat-target block
src/index.css                 .combat-target styles (+ mobile)
src/game/scores.ts            loadBriefed() / saveBriefed()
src/game/version.ts           1.46.0 → 1.47.0
```

## 5. Verification

* `tsc --noEmit` clean.
* `npm run build` clean, **1,727.69 kB / 507.50 kB gzip**, zero warnings.
* Sim harness: pistol, 12 rounds, aimed fire from inside CONTROL A → core destroyed → sally open →
  `phase 'escaped'` at +1.62 s → `summary.coreDead === true`, `coreHp 0`.
* `CampaignDirective` server-rendered to static markup: both panels, both rules, one button.

## 6. Not changed

The general-per-sector loop, the prison layout, the escape hatch and sally-port routes, the
armour, aircraft, glacier, stockade, vault, parade, scores and leaderboard. Level 7 is still
escaped-through in code; what changed is *why* it opens — one machine, named, 750 hp, in
CONTROL A.
