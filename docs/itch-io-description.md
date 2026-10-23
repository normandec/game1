# itch.io page copy — PROTOCOL SOLAR ECLIPSE: Black Vault

Paste-ready text for the itch.io project page. English only, no `S.H.I.E.L.D.`
and no *shield* wording anywhere.

1. [Tagline](#1-tagline)
2. [Full description](#2-full-description)
3. [Tags](#3-tags)
4. [Cover / thumbnail caption](#4-cover-caption)

---

## 1. Tagline

For the *Short description or tagline* field (239 characters):

```text
One operator. Five enemy sectors. An army that studies how you fight — and a hidden black vault they buried behind the north wall. Drop in at X 6000 / Y 6800.
```

---

## 2. Full description

Paste into the *Description* field:

```markdown
## PROTOCOL SOLAR ECLIPSE: Black Vault

**One operator. Five enemy sectors. An army that studies how you fight. And a black vault buried behind the north wall that they really, really did not want you to find.**

You are inserted alone behind enemy lines at **X 6000 / Y 6800**. No backup. No
extraction. One rifle and a very bad plan.

HYDRA holds the continent. Five sectors, five kinds of weather, five fortresses that
get meaner every time you break one open. Clear them all and the protocol ends.
Most runs end long before that.

Hit play. See how far you get.

### The enemy actually thinks

An AI command watches how you fight — how fast you move, how long you hide behind
cover, how close you like to get — and then picks a counter: phalanx, turtle, blitz,
pincer, encircle, ambush. Camp a corner and they flank it. Run circles around them
and they spread out to cut you off. It keeps a profile on you all run long.

### Nothing teleports

Reinforcements are not spawned on top of you. Crews run to the motor pool, board
transports, drive real routes, slow down, and dismount near your last known position.
Planes start up, taxi, take off, strafe, orbit, run dry and limp home to their own
hangar. Chase a convoy and it reacts. Block a road and it reroutes.

### You are never safe in the light

Searchlights do real line-of-sight and exposure tests. Step into a cone and the whole
network lights up: **five vans, thirty troops, rolling now**. Break contact for twelve
seconds and you disappear again. Or cut the power first and watch an entire base fight
you in the dark with headlamps.

### Break the world, not just the enemy

Explosions chew through walls, hangars, crates, gates and power equipment. Long walls
split into independently destructible sections — blow a wide enough hole and you just
built yourself a new road. Crates hide supplies, heavy weapons and single-use AEGIS
cells that make you untouchable from the front for three seconds. Use them facing the
right way.

### Take their toys

Seize vans, armed transports, gunships and the NIGHTJAR bomber. Fuel, hull damage
and emergency ejection are all live. Fly too long and you walk home.

### Five sectors, one war

Rain-soaked **The Fallen Hub**, the desert armour works of **Red Mesa Arsenal**, the
frozen **Arctic Relay**, the toxic **Venom Marsh**, and finally **Hydra Nexus** — the
supreme command fortress. Each sector adds installations to raid: checkpoints,
bioresearch labs, radar stations, armoured workshops, power substations and munitions
bunkers. Every one has its own commander, sentries, patrols, medics and a one-time
payday for clearing it.

### Two secrets worth the detour

Somewhere behind the north wall is a **hidden 3D black vault** — full hangar, aircraft
requisitions, supplies, medical bay and a classified archive. The *Black Vault* tab in
the main menu has the exact entrance coordinates. Farther north, the **Mnemosyne
Library** hides three volumes and a puzzle that shuts the searchlight network up for
sixty seconds. Both are optional. Both are worth it.

### Build your run

Four operative classes — **Assault, Gunner, Demolition, Marksman** — plus one support
package: an **AEGIS barrier** that soaks damage, a **Hunter drone** that fires on its
own, or a **Sky uplink** that speeds up airdrops and EMP strikes. After every cleared
wave you pick a perk: more damage, faster fire rate, piercing rounds, crits, lifesteal,
incendiary rounds, EMP rounds, extra plating and more. No two runs come out the same.

### Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move, drive or fly |
| Mouse | Aim — hold left click to fire |
| F | Interact, enter the vault, seize or leave a vehicle |
| L | Lock or unlock the nearest hydraulic gate |
| C | Burn an AEGIS cell — three seconds of frontal invulnerability |
| G / right click | Frag, gunship rockets or bomber payload |
| Space / Shift | Combat dash (Shift boosts a driven van) |
| V | Toggle the guide to the vault |
| Esc / P | Pause |

Touch controls work on phones and tablets. Keyboard and mouse recommended.

### Good to know

- Runs in the browser. No download, no install, one self-contained HTML file.
- No camera shake. No cutscenes you cannot skip. No waiting for anything to load.
- Every pixel and every sound is generated in code — zero external assets.
- Best score and local leaderboard are saved in your browser. Beat yourself.

**Made with React, TypeScript, Canvas 2D and Three.js. Made to be played one more
run at a time.**
```

---

## 3. Tags

For the *Tags* field:

```text
action, shooter, top-down, tactical, military, singleplayer, browser, html5, survival, 3d
```

Genre dropdown on the project page: pick **Action** (or keep **Adventure** — the tags
above cover both).

---

## 4. Cover caption

Short line for the thumbnail, if the page asks for one:

```text
Five sectors. One hidden vault. Drop in alone.
```

---

## Notes

- Source of facts: `README.md`, `docs/FAZA-0-ANALIZA.md`, `src/game/world.ts`,
  `src/game/engine.ts`, `src/components/OperationsMenu.tsx`.
- Exact vault coordinates are deliberately **not** printed in the description — the
  copy only says the in-game *Black Vault* tab has them, so the secret stays a secret.
- All `S.H.I.E.L.D.` and *shield* wording was removed on purpose (trademark and naming
  cleanup). If you want the same rename applied inside the game UI and code, say so —
  that is a separate change.
