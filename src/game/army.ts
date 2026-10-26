/* ------------------------------------------------------------------ *
 * LEVEL 7 — VOJSKA
 *
 * A sixth sector on brand-new ground south of everything that already exists. Nothing in
 * the legacy 12 000 × 8 200 theatre and nothing on the prison island moves: the army gets
 * its own 3 400 m deep strip of land, tied to the old map by one guarded causeway road.
 *
 * This is not a Hydra outpost with different paint. It is a national army group: thirty
 * separate strongpoints, each built differently, each held by its own garrison.
 *
 *   APPROACH   checkpoint, mine belt, artillery line, air-defence battery, signals array
 *   WEST       the armour park (a hundred and thirty hulls), boneyard, engineers, motor pool
 *   EAST       training range, railhead, drone hangar, missile silos, test rig
 *   OUTER RING concrete ramparts, watchtowers, wire, the causeway shutter
 *   MIDDLE     air park (helicopters + interceptors), fuel farm, ammunition depot, hospital
 *   INNER      blast wall with one powered gate, barracks, the 1000-man parade, command bunker
 *
 * The gate is powered: kill both generators and the inner shutter drops. Until then the
 * only ways in are the gatehouse itself (blast it open) or the air.
 * ------------------------------------------------------------------ */

import type { Rect, StructKind, Zone } from './world';

/** How much new ground this level adds south of the legacy theatre. */
export const ARMY_SOUTH = 3400;

export interface ArmyGate {
  /** The shutters that physically block the road. */
  rects: Rect[];
  x: number; y: number; w: number; h: number;
  inner: boolean;
  open: boolean;
  /** Blast health of the shutter: only explosives will ever get through it. */
  hp: number; maxHp: number;
}

export interface ArmyTurretSpot {
  x: number; y: number;
  /** Facing of the twin barrels at rest. */
  ang: number;
  /** True for the tall command-ring emplacements, which cover the air as well. */
  heavy: boolean;
}

/** One named position inside the district: drawn on the map, held by its own garrison. */
export interface ArmyStrongpoint {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number;
  /** Roughly how many soldiers hold it, for the briefing and the HUD. */
  garrison: number;
}

/**
 * A forward airfield holds more than one kind of airframe. The wing's line jets are
 * `standard`; a `prototype` is one of the two experimental machines the proving flight
 * keeps out east — heavier, faster, and worth stealing.
 */
/**
 * What kind of airframe a parked jet is.
 *
 *  standard  — the army's line interceptor
 *  prototype — the proving-flight experimental machine (much stronger, and a prize)
 *  frostwing — the one-off ice interceptor kept in the glacier vault
 */
export type JetTier = 'standard' | 'prototype' | 'frostwing';

/** One of the army's soft spots: a company barracks you can walk into and clear. */
export interface ArmySoftTarget {
  id: string;
  name: string;
  sub: string;
  x: number; y: number; w: number; h: number;
}

export interface ArmyPlan {
  /** Bounds of the whole district on the arena. */
  region: { x: number; y: number; w: number; h: number };
  /** Bounds of the walled base inside it. */
  base: { x: number; y: number; w: number; h: number };
  /** Rear command complex, where the general and the mainframes sit. */
  core: { x: number; y: number; w: number; h: number };
  /** 1000 parade positions, in ranks. */
  parade: { x: number; y: number }[];
  /** Vehicles parked in the armour park (static, permanent). */
  tanks: { x: number; y: number; ang: number }[];
  /** Live armour: these drive out and fight, wave after wave. */
  tankPatrols: { x: number; y: number; ang: number }[];
  helis: { x: number; y: number; ang: number }[];
  jets: { x: number; y: number; ang: number; tier?: JetTier }[];
  turrets: ArmyTurretSpot[];
  generators: { x: number; y: number }[];
  gates: ArmyGate[];
  /** Every named position, for the map and the HUD. */
  strongpoints: ArmyStrongpoint[];
  /** Extra soldiers holding the strongpoints (world seeds them as enemies). */
  guards: { x: number; y: number; type: string }[];
  /** Traffic circuits: convoys and staff cars drive these loops all day. */
  routes: { x: number; y: number }[][];
  /** The brig: break it open and the inmates fight for whoever freed them. */
  stockade: { x: number; y: number; w: number; h: number };
  /**
   * The soft side of the district: thinly held company barracks and the two forward
   * strips, marked on the map so an operative can find them before the alarm goes up.
   */
  softTargets: ArmySoftTarget[];
  /** Supply caches left in the open beside the soft targets. */
  loot: { x: number; y: number }[];
  /** Where the base alarm is tripped: crossing into the walled compound. */
  alarm: { x: number; y: number; w: number; h: number };
  spawn: { x: number; y: number };
  hq: { x: number; y: number };
}

export interface ArmyContext {
  /** Top edge of the new ground (y of the legacy south border). */
  y0: number;
  /** Push a structure. Returns the rect so callers can raise its hp. */
  add: (x: number, y: number, w: number, h: number, kind: StructKind, h3d?: number, tint?: string) => Rect;
  zone: (x: number, y: number, w: number, h: number, kind: Zone['kind']) => void;
  rnd: (a: number, b: number) => number;
}

/**
 * Build the district. The caller owns the arrays; this only places things and hands back
 * the plan so the engine can animate the parade, the turrets, the armour and the alarm.
 */
export function buildArmyDistrict(ctx: ArmyContext): ArmyPlan {
  const { y0, add, zone, rnd } = ctx;
  const CX = 6000;
  const W = 17200;                       // the arena is this wide; keep the district centred

  const region = { x: 0, y: y0, w: W, h: ARMY_SOUTH };
  const base = { x: 2200, y: y0 + 560, w: 9600, h: 2700 };
  const core = { x: CX - 950, y: y0 + 2440, w: 1900, h: 760 };
  const innerTop = y0 + 1180;
  const inner = { x: 3400, y: innerTop, w: 7200, h: y0 + 3160 - innerTop };

  const gates: ArmyGate[] = [];
  const tanks: { x: number; y: number; ang: number }[] = [];
  const tankPatrols: { x: number; y: number; ang: number }[] = [];
  const turrets: ArmyTurretSpot[] = [];
  const strongpoints: ArmyStrongpoint[] = [];
  const guards: { x: number; y: number; type: string }[] = [];
  const routes: { x: number; y: number }[][] = [];
  const softTargets: ArmySoftTarget[] = [];
  const loot: { x: number; y: number }[] = [];

  const gate = (x: number, y: number, w: number, h: number, innerGate: boolean, hp: number): ArmyGate => {
    const rects: Rect[] = [];
    const leafW = w / 2;
    for (let i = 0; i < 2; i++) {
      const r = add(x + i * leafW, y, leafW, h, 'gate', innerGate ? 84 : 62, '#5c5644');
      r.hp = hp; r.maxHp = hp;
      // prepareStructures() copies rects, so the shutter carries its class with it.
      r.armyGate = innerGate ? 'inner' : 'outer';
      rects.push(r);
    }
    const g: ArmyGate = { rects, x, y, w, h, inner: innerGate, open: false, hp, maxHp: hp };
    gates.push(g);
    return g;
  };

  /** A named position: records the ground it owns and how many people hold it. */
  const post = (id: string, name: string, x: number, y: number, w: number, h: number, garrison: number) => {
    strongpoints.push({ id, name, x, y, w, h, garrison });
    zone(x, y, w, h, 'concrete');
  };
  const man = (x: number, y: number, type: string) => guards.push({ x, y, type });
  const squad = (x: number, y: number, n: number, types: string[], spread = 54) => {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.4;
      const r = Math.min(spread, 30 + i * (spread / Math.max(1, n)));
      man(x + Math.cos(a) * r, y + Math.sin(a) * r, types[i % types.length]);
    }
  };

  /* ---------------- ground ---------------- */
  zone(region.x, region.y, region.w, region.h, 'concrete');
  zone(CX - 110, y0, 220, base.y - y0 + 20, 'road');
  zone(region.x + 80, region.y + 300, region.w - 160, 150, 'road');
  zone(base.x - 40, base.y + base.h / 2 - 70, 700, 140, 'road');            // west service
  zone(base.x + base.w - 660, base.y + base.h / 2 - 70, 700, 140, 'road');  // east service
  zone(region.x + 120, y0 + 760, 1900, 2300, 'concrete');                   // west yards
  zone(12000, y0 + 760, 4600, 2300, 'concrete');                            // east ranges

  /* ================================================================== *
   * APPROACH — everything between the old border and the outer wire
   * ================================================================== */

  post('checkpoint', 'CAUSEWAY CHECKPOINT', CX - 700, y0 + 40, 1400, 300, 12);
  add(CX - 330, y0 + 120, 200, 150, 'checkpoint', 44, '#5b6055');
  add(CX + 130, y0 + 120, 200, 150, 'checkpoint', 44, '#5b6055');
  // the line itself is open: the barriers sit on the flanks, never across the causeway
  add(CX - 700, y0 + 300, 380, 26, 'sandbag', 20);
  add(CX + 320, y0 + 300, 380, 26, 'sandbag', 20);
  add(CX - 380, y0 + 96, 200, 26, 'sandbag', 20);
  add(CX + 180, y0 + 96, 200, 26, 'sandbag', 20);
  add(CX - 470, y0 + 210, 150, 40, 'barrier', 22, '#8a8266');
  add(CX + 320, y0 + 210, 150, 40, 'barrier', 22, '#8a8266');
  for (const sx of [-520, -260, 260, 520]) squad(CX + sx, y0 + 200, 2, ['armyguard', 'armytrooper'], 26);
  squad(CX, y0 + 160, 2, ['armymajor', 'armyengineer'], 40);

  post('artillery', '1ST FIELD ARTILLERY', 900, y0 + 40, 3200, 380, 26);
  for (let i = 0; i < 6; i++) {
    const hx = 1050 + i * 480, hy = y0 + 200;
    add(hx, hy, 210, 180, 'howitzer', 46, '#4f5443');
    add(hx - 70, hy + 190, 350, 24, 'sandbag', 18);
    man(hx + 260, hy + 60, 'armyengineer');
    man(hx + 300, hy + 120, 'armytrooper');
    add(hx + 240, hy - 30, 90, 70, 'crate', 22);
  }

  post('sam', 'AIR DEFENCE BATTERY', 12200, y0 + 40, 2400, 400, 20);
  for (let i = 0; i < 4; i++) {
    const sx = 12420 + i * 540, sy = y0 + 190;
    add(sx, sy, 240, 190, 'launcher', 54, '#4a5246');
    add(sx - 40, sy + 200, 320, 24, 'sandbag', 18);
    man(sx + 280, sy + 40, 'armyengineer');
    man(sx + 300, sy + 110, 'armytrooper');
  }
  add(14700, y0 + 150, 240, 240, 'radar', 110, '#4e5a52');

  post('signals', 'SIGNALS ARRAY', 15000, y0 + 40, 1900, 400, 12);
  for (let i = 0; i < 3; i++) add(15120 + i * 520, y0 + 200, 230, 230, 'radar', 96, '#55604f');
  add(15080, y0 + 120, 1240, 24, 'fence', 30, '#6a6a5a');
  squad(15700, y0 + 170, 4, ['armyengineer', 'armyguard'], 90);

  post('hospital', 'FIELD HOSPITAL', 8300, y0 + 40, 1700, 400, 14);
  for (let i = 0; i < 4; i++) {
    add(8420 + (i % 2) * 420, y0 + 90 + Math.floor(i / 2) * 170, 360, 140, 'tent', 40, '#7d8474');
  }
  add(8300, y0 + 380, 1700, 22, 'sandbag', 16);
  for (const t of ['armymedic', 'armymedic', 'armyengineer', 'armyguard'])
    man(8600 + rnd(0, 1000), y0 + 240 + rnd(0, 100), t);

  post('ammo', 'AMMUNITION DEPOT', 10200, y0 + 40, 1800, 400, 16);
  for (let i = 0; i < 3; i++) {
    add(10300 + i * 520, y0 + 240, 420, 150, 'bunker', 58, '#4a4f46');
    add(10310 + i * 520, y0 + 200, 400, 26, 'sandbag', 20);
    for (let b = 0; b < 6; b++) add(10320 + i * 520 + b * 62, y0 + 110, 48, 48, 'barrel', 26, '#6e6234');
  }
  squad(11000, y0 + 220, 5, ['armyguard', 'armytrooper'], 80);

  post('provost', 'PROVOST / MILITARY POLICE', 7100, y0 + 40, 1100, 380, 12);
  add(7220, y0 + 120, 420, 180, 'checkpoint', 52, '#59604f');
  add(7160, y0 + 320, 800, 24, 'sandbag', 18);
  for (let i = 0; i < 5; i++) add(7180 + i * 150, y0 + 350, 90, 60, 'target', 30, '#7a7460');
  squad(7650, y0 + 240, 4, ['armyguard', 'armymajor'], 60);

  /* ================================================================== *
   * WEST — the armour. A hundred and thirty hulls in eight ranks.
   * ================================================================== */

  post('armour-park', '1ST ARMOURED BATTALION', 400, y0 + 760, 2060, 2280, 34);
  for (let i = 0; i < 6; i++) zone(440, y0 + 1000 + i * 380, 1980, 80, 'concrete');
  // Seven ranks of twelve: a hundred and eight hulls nose-to-tail on the concrete,
  // plus the eight across the head of each rank and a wire guard troop.
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 7; col++) {
      const tx = 480 + col * 250, ty = y0 + 880 + row * 182;
      add(tx, ty, 220, 142, 'tank', 38);
      tanks.push({ x: tx + 110, y: ty + 71, ang: 0 });
    }
    add(2220, y0 + 880 + row * 182, 142, 220, 'tank', 38);
    tanks.push({ x: 2291, y: y0 + 951 + row * 182, ang: Math.PI / 2 });
  }
  /* THE WING'S OWN DEFENCE TROOP.
   * Six fuelled hulls on the flight line between the megahangars and the runway. They are
   * parked here in the world and they are live sortie positions too, so an alarm over the
   * airfield puts armour on the field where the aircraft are — not four kilometres away in
   * the park. The user's report was "there are no tanks anywhere" while flying: this is
   * the ground the battalion was missing. */
  for (let i = 0; i < 6; i++) {
    const tx = base.x + 4480 + i * 330, ty = y0 + 1090;
    tanks.push({ x: tx, y: ty, ang: 0 });
    tankPatrols.push({ x: tx, y: ty, ang: 0 });
    /* Earth-and-sandbag revetments, open toward the runway: the flight line now reads as a
     * dispersal with protected parking rather than six hulls on open concrete. */
    add(tx - 120, ty + 78, 240, 24, 'sandbag', 22);
    add(tx - 120, ty - 24, 22, 102, 'sandbag', 22);
    add(tx + 98, ty - 24, 22, 102, 'sandbag', 22);
    // a hardstand light and a grounding point at every bay
    add(tx + 118, ty + 96, 16, 16, 'lamp', 12, '#6d7360');
  }
  /* The wing's fuel point and bowser park, on the apron between the bays and the hall. */
  add(base.x + 6600, y0 + 1010, 190, 90, 'bladder', 40, '#5c5c44');
  for (let i = 0; i < 5; i++) add(base.x + 6820 + i * 58, y0 + 1016, 46, 46, 'barrel', 24, '#6e6234');
  add(base.x + 6560, y0 + 960, 260, 16, 'sandbag', 16);
  /* Two aircraft shelters on the south side of the runway, so the wing has hardened
   * parking as well as the two megahangars. */
  for (let i = 0; i < 2; i++) {
    const sx = base.x + 7400 + i * 900;
    add(sx, y0 + 1180, 380, 300, 'hangar', 120, '#3b4136');
  }
  // every second hull here is a live sortie position as well
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 4; col++) {
      tankPatrols.push({ x: 560 + col * 480, y: y0 + 940 + row * 182, ang: rnd(-0.2, 0.2) });
    }
  }

  post('boneyard', 'VEHICLE BONEYARD', 420, y0 + 3100, 1800, 240, 6);
  for (let i = 0; i < 7; i++) {
    add(500 + i * 240, y0 + 3140, 170, 120, 'tank', 26, '#4a4a3c');
    man(560 + i * 220, y0 + 3080, i % 2 ? 'armyengineer' : 'armytrooper');
  }

  post('engineers', 'ENGINEER YARD', 2320, y0 + 3060, 1000, 300, 10);
  add(2400, y0 + 3120, 200, 150, 'crane', 120, '#5a5f50');
  add(2700, y0 + 3120, 130, 130, 'bladder', 44, '#5c5c44');
  add(2900, y0 + 3120, 130, 130, 'bladder', 44, '#5c5c44');
  add(2400, y0 + 3300, 700, 24, 'sandbag', 16);
  squad(2820, y0 + 3160, 4, ['armyengineer', 'armytrooper'], 60);

  /* ================================================================== *
   * EAST — ranges, rail, drones, silos, the test rig
   * ================================================================== */

  post('range', 'COMBINED ARMS RANGE', 12100, y0 + 820, 2100, 900, 14);
  for (let i = 0; i < 5; i++) add(12180 + i * 400, y0 + 900, 300, 60, 'sandbag', 20);
  for (let i = 0; i < 18; i++) add(12220 + (i % 6) * 330, y0 + 1260 + Math.floor(i / 6) * 130, 70, 46, 'target', 34, '#7d7460');
  add(13800, y0 + 880, 240, 240, 'tower', 92);
  for (let i = 0; i < 2; i++) add(13200 + i * 320, y0 + 1500, 190, 120, 'tank', 32);

  post('railhead', 'RAILHEAD / SUPPLY', 14400, y0 + 820, 2100, 900, 16);
  for (let i = 0; i < 9; i++) add(14460 + i * 220, y0 + 1040, 200, 110, 'railcar', 42, i % 3 ? '#4e5348' : '#5d5643');
  zone(14420, y0 + 1180, 2060, 26, 'concrete');
  add(15200, y0 + 1260, 210, 190, 'warehouse', 84, '#5a5f52');
  add(15700, y0 + 1240, 200, 150, 'crane', 130, '#555c4e');
  for (let i = 0; i < 8; i++) add(14640 + i * 200, y0 + 1420, 52, 52, 'barrel', 26, '#6e6234');
  squad(15600, y0 + 1100, 5, ['armyengineer', 'armytrooper', 'armyguard'], 100);

  post('drones', 'DRONE HANGAR', 12100, y0 + 1820, 1900, 820, 16);
  add(12300, y0 + 1900, 1300, 320, 'dronebay', 102, '#46504a');
  zone(12300, y0 + 2260, 1300, 40, 'concrete');
  for (let i = 0; i < 6; i++) add(12360 + i * 190, y0 + 2320, 130, 130, 'target', 26, '#6a7364');
  add(13700, y0 + 1880, 200, 200, 'radar', 88, '#4f5b55');
  squad(13100, y0 + 2420, 6, ['armyengineer', 'armyguard'], 110);

  post('silos', 'IRON SILO FIELD', 14400, y0 + 1820, 2100, 820, 20);
  for (let i = 0; i < 3; i++) {
    const sx = 14640 + i * 640;
    add(sx, y0 + 1960, 320, 320, 'silo', 70, '#4b4f48');
    add(sx - 60, y0 + 2320, 440, 24, 'sandbag', 18);
    man(sx + 380, y0 + 2020, 'armyguard');
    man(sx + 380, y0 + 2160, 'armyengineer');
  }
  add(14420, y0 + 2540, 2060, 26, 'fence', 40, '#6a6a5a');

  post('testrig', 'EXPERIMENTAL TEST RIG', 12100, y0 + 2760, 2200, 560, 18);
  add(12300, y0 + 2820, 1500, 120, 'gantry', 150, '#57604f');
  add(12300, y0 + 3000, 380, 190, 'tank', 42, '#5a6350');
  add(12900, y0 + 3000, 380, 190, 'tank', 42, '#5a6350');
  add(13500, y0 + 3000, 260, 190, 'console', 60, '#4a5952');
  squad(13000, y0 + 2900, 6, ['armyengineer', 'armymajor', 'armyguard'], 120);

  post('cooling', 'COOLING PLANT', 14500, y0 + 2760, 2000, 560, 12);
  for (let i = 0; i < 4; i++) add(14600 + i * 420, y0 + 2860, 300, 220, 'power', 96, '#525b4c');
  for (let i = 0; i < 10; i++) add(14620 + i * 170, y0 + 3140, 54, 54, 'barrel', 28, '#5c6242');
  squad(15400, y0 + 3000, 4, ['armyengineer', 'armytrooper'], 80);

  /* ================================================================== *
   * OUTER RING
   * ================================================================== */
  const T = 70;
  const outerGateW = 420;
  const rampart = (x: number, y: number, w: number, h: number) => {
    const r = add(x, y, w, h, 'rampart', 62);
    r.armyWall = true;
    return r;
  };
  // The wall is cut around the gate itself. The old arithmetic centred the opening on the
  // base, while the gate was drawn on the core axis, which buried the gate under 420 px of
  // rampart and left an unguarded hole 800 px to the east. The perimeter now has exactly
  // one opening: the gate.
  const gx = CX - outerGateW / 2;
  rampart(base.x, base.y, gx - base.x, T);
  rampart(gx + outerGateW, base.y, base.x + base.w - (gx + outerGateW), T);
  rampart(base.x, base.y + base.h - T, base.w, T);
  rampart(base.x, base.y + T, T, base.h - T * 2);
  rampart(base.x + base.w - T, base.y + T, T, base.h - T * 2);
  gate(CX - outerGateW / 2, base.y, outerGateW, T, false, 1500);

  // corner + mid towers with lights, so the wall reads as a real perimeter
  const towerAt = (x: number, y: number) => {
    add(x - 90, y - 90, 180, 180, 'tower', 92);
    add(x - 130, y - 130, 260, 260, 'sandbag', 14);
    man(x + rnd(-120, 120), y + rnd(-120, 120), 'armyguard');
  };
  for (const tx of [base.x + 240, CX - 900, CX + 900, base.x + base.w - 240]) {
    towerAt(tx, base.y + 30);
    towerAt(tx, base.y + base.h - 30);
  }
  for (const ty of [base.y + 600, base.y + 1300, base.y + 2000]) {
    towerAt(base.x + 120, ty);
    towerAt(base.x + base.w - 120, ty);
  }

  // wire and mine strips: cheap, ugly, and they channel an attacker into the road
  for (let x = base.x + 300; x < base.x + base.w - 300; x += 260) {
    if (Math.abs(x - CX) < 460) continue;
    add(x, base.y - 150, 190, 44, 'fence', 12, '#6a6a5a');
    add(x + 40, base.y + base.h + 96, 190, 44, 'fence', 12, '#6a6a5a');
  }
  for (let y = base.y + 400; y < base.y + base.h - 300; y += 300) {
    add(base.x - 150, y, 44, 190, 'fence', 12, '#6a6a5a');
    add(base.x + base.w + 104, y, 44, 190, 'fence', 12, '#6a6a5a');
  }
  // a few hulls dug in along the wire, engines cold
  for (let i = 0; i < 6; i++) {
    const tx = base.x + 600 + i * 1500;
    if (Math.abs(tx - CX) < 700) continue;
    add(tx, base.y - 260, 210, 140, 'tank', 30, '#4e5644');
    tanks.push({ x: tx + 105, y: base.y - 190, ang: Math.PI });
  }

  /* ================================================================== *
   * MIDDLE: air park, fuel, ammunition
   * ================================================================== */
  for (let i = 0; i < 4; i++) {
    const hx = base.x + 900 + i * 780, hy = y0 + 840;
    zone(hx - 190, hy - 190, 380, 380, 'helipad');
    add(hx - 210, hy - 210, 60, 60, 'crate', 26);
  }
  zone(base.x + 4300, y0 + 690, 4600, 340, 'runway');
  zone(base.x + 4300, y0 + 680, 240, 360, 'concrete');

  // Two aircraft halls the size of a cathedral: a megahangar is 190 m of clear span, and
  // the whole wing taxies out of one end.
  for (let i = 0; i < 2; i++) {
    const hx = base.x + 4300 + i * 2100;
    add(hx, y0 + 620, 1900, 420, 'megahangar', 170);
    zone(hx + 60, y0 + 1036, 1780, 22, 'concrete');
    zone(hx - 60, y0 + 1040, 2020, 110, 'concrete');
    man(hx + 180, y0 + 1080, 'armyengineer');
    man(hx + 1660, y0 + 1080, 'armyguard');
  }
  // control tower over the apron
  add(base.x + 6300, y0 + 1150, 260, 260, 'tower', 140);
  squad(base.x + 6430, y0 + 1290, 3, ['armyguard', 'armyengineer'], 60);

  /* ---------------- MEGASTRUCTURES ---------------- */
  // Eight-storey accommodation blocks, the kind that house a battalion each.
  post('towerblock-w', 'ACCOMMODATION BLOCK A · 8 FLOORS', base.x + 100, y0 + 1260, 700, 520, 24);
  add(base.x + 120, y0 + 1300, 660, 450, 'towerblock', 300, '#6a7258');
  post('towerblock-e', 'ACCOMMODATION BLOCK B · 8 FLOORS', base.x + 8800, y0 + 1260, 700, 520, 24);
  add(base.x + 8820, y0 + 1300, 660, 450, 'towerblock', 300, '#6a7258');
  squad(base.x + 450, y0 + 1830, 5, ['armytrooper', 'armytrooper', 'armyguard', 'armymedic'], 90);
  squad(base.x + 9150, y0 + 1830, 5, ['armytrooper', 'armytrooper', 'armyguard', 'armyengineer'], 90);

  // Radar domes: a 40 m golf ball on a plinth, and the array that feeds it.
  add(base.x + 180, y0 + 1960, 520, 520, 'radome', 190, '#c9d4c0');
  add(base.x + 1900, y0 + 2820, 420, 420, 'radome', 190, '#c9d4c0');
  add(base.x + 780, y0 + 2020, 260, 200, 'radar', 90, '#5a6656');

  // A water tower tall enough to gravity-feed the whole base.
  add(base.x + 8920, y0 + 2000, 380, 380, 'watertower', 260, '#8b967e');
  add(base.x + 8840, y0 + 2420, 540, 24, 'sandbag', 16);

  // Artillery casemates along the south wall: concrete boxes with a gun in the mouth.
  for (let i = 0; i < 4; i++) {
    const kx = base.x + 1200 + i * 1900;
    add(kx, y0 + 3040, 520, 200, 'kazemat', 120, '#7d8670');
    man(kx + 250, y0 + 2990, 'armyengineer');
    man(kx + 300, y0 + 3000, 'armyguard');
  }
  post('casemates', 'ARTILLERY CASEMATES', base.x + 1100, y0 + 3000, 8000, 260, 16);

  /* ---------------- STOCKADE / MILITARY PRISON ----------------
   * A base this size has its own brig: wire, four guard towers, two cell blocks and an
   * exercise cage. The inmates are the army's own — deserters, and the ones who asked
   * questions. Break the stockade open and they will fight for whoever freed them.
   */
  const stock = { x: base.x + 2100, y: y0 + 640, w: 1500, h: 460 };
  post('stockade', 'STOCKADE / MILITARY PRISON', stock.x, stock.y, stock.w, stock.h, 22);
  add(stock.x + 120, stock.y + 70, 520, 300, 'stockade', 74, '#7a7f6a');
  add(stock.x + 760, stock.y + 70, 520, 300, 'stockade', 74, '#7a7f6a');
  add(stock.x + 40, stock.y + 390, 1420, 24, 'fence', 54, '#9aa08a');
  add(stock.x + 40, stock.y + 34, 1420, 18, 'fence', 54, '#9aa08a');
  add(stock.x - 10, stock.y + 34, 20, 380, 'fence', 54, '#9aa08a');
  add(stock.x + 1480, stock.y + 34, 20, 380, 'fence', 54, '#9aa08a');
  for (const [tx, ty] of [[stock.x + 60, stock.y + 60], [stock.x + 1380, stock.y + 60],
    [stock.x + 60, stock.y + 380], [stock.x + 1380, stock.y + 380]] as const) {
    add(tx, ty, 90, 90, 'tower', 96, '#7d8670');
    man(tx + 45, ty + 120, 'armymajor');
  }
  // the exercise cage in the middle
  add(stock.x + 660, stock.y + 390, 330, 60, 'fence', 40, '#9aa08a');
  for (let i = 0; i < 6; i++) man(stock.x + 200 + i * 190, stock.y + 440, 'armyengineer');

  /* ---------------- MOTOR POOL: vehicles, parked and working ---------------- */
  post('motorpool', 'MOTOR POOL / VEHICLE DEPOT', base.x + 800, y0 + 2360, 1700, 700, 18);
  for (let i = 0; i < 8; i++) {
    const vx = base.x + 860 + (i % 4) * 400, vy = y0 + 2420 + Math.floor(i / 4) * 300;
    const kind = (['humvee', 'car', 'tanker', 'bus'] as const)[i % 4];
    const w = kind === 'bus' ? 260 : kind === 'tanker' ? 220 : 150;
    const h = kind === 'bus' ? 100 : kind === 'tanker' ? 90 : 74;
    add(vx, vy, w, h, kind, kind === 'bus' ? 96 : 62);
  }
  add(base.x + 800, y0 + 2340, 1700, 22, 'sandbag', 16);
  add(base.x + 800, y0 + 3020, 1700, 22, 'sandbag', 16);
  squad(base.x + 1650, y0 + 2700, 6, ['armyengineer', 'armytrooper', 'armyguard'], 100);

  // A fuel point and a wash rack on the east side of the pool.
  add(base.x + 2580, y0 + 2500, 320, 240, 'bladder', 60, '#5c5c44');
  add(base.x + 2560, y0 + 2760, 380, 24, 'sandbag', 16);
  for (let i = 0; i < 6; i++) add(base.x + 2620 + (i % 3) * 110, y0 + 2840 + Math.floor(i / 3) * 110, 52, 52, 'barrel', 26, '#6e6234');
  man(base.x + 2700, y0 + 2960, 'armyengineer');
  post('airpark', 'AIR PARK / 9TH AIR WING', base.x + 4300, y0 + 660, 4600, 520, 26);
  squad(base.x + 5400, y0 + 980, 5, ['armyengineer', 'armyguard'], 120);
  squad(base.x + 7600, y0 + 980, 5, ['armyengineer', 'armyguard'], 120);

  // fuel farm behind a blast bund on the west of the middle ring
  zone(base.x + 300, y0 + 2540, 900, 620, 'fuel');
  for (let i = 0; i < 26; i++) {
    const bx = base.x + 360 + (i % 13) * 66, by = y0 + 2600 + Math.floor(i / 13) * 200;
    add(bx, by, 52, 52, 'barrel', 30, '#7a5a2c');
  }
  for (let i = 0; i < 3; i++) add(base.x + 340 + i * 300, y0 + 2820, 250, 160, 'bladder', 40, '#5c5c44');
  add(base.x + 280, y0 + 2500, 960, 26, 'sandbag', 18);
  add(base.x + 280, y0 + 3160, 960, 26, 'sandbag', 18);
  post('fuel-farm', 'FUEL FARM', base.x + 280, y0 + 2500, 960, 700, 14);
  squad(base.x + 700, y0 + 2960, 5, ['armyengineer', 'armytrooper'], 90);

  // ammunition bunkers on the east side of the middle ring
  post('magazine', 'FORWARD MAGAZINE', base.x + base.w - 1240, y0 + 2540, 1000, 620, 12);
  for (let i = 0; i < 3; i++) add(base.x + base.w - 1200 + i * 300, y0 + 2700, 250, 160, 'bunker', 62, '#4a4f46');
  for (let i = 0; i < 12; i++) add(base.x + base.w - 1180 + (i % 6) * 90, y0 + 2960 + Math.floor(i / 6) * 90, 50, 50, 'barrel', 26, '#6e6234');
  squad(base.x + base.w - 800, y0 + 2640, 5, ['armyguard', 'armytrooper'], 80);

  /* ================================================================== *
   * INNER: blast wall and its one powered gate
   * ================================================================== */
  const IT = 90;
  const innerGateW = 300;
  const blast = (x: number, y: number, w: number, h: number) => {
    const r = add(x, y, w, h, 'rampart', 104, '#4a4f46');
    r.armyWall = true;
    return r;
  };
  const gix = CX - innerGateW / 2;
  blast(inner.x, inner.y, gix - inner.x, IT);
  blast(gix + innerGateW, inner.y, inner.x + inner.w - (gix + innerGateW), IT);
  blast(inner.x, inner.y + inner.h - IT, inner.w, IT);
  blast(inner.x, inner.y + IT, IT, inner.h - IT * 2);
  blast(inner.x + inner.w - IT, inner.y + IT, IT, inner.h - IT * 2);
  gate(CX - innerGateW / 2, inner.y, innerGateW, IT, true, 2600);
  add(CX - innerGateW / 2 - 330, inner.y - 40, 300, 220, 'bunker', 74, '#454a42');
  add(CX + innerGateW / 2 + 30, inner.y - 40, 300, 220, 'bunker', 74, '#454a42');
  zone(CX - 260, inner.y + IT, 520, 220, 'concrete');

  /* ---------------- PARADE GROUND: 50 × 20 = 1000 men ---------------- */
  const parade: { x: number; y: number }[] = [];
  const COLS = 50, ROWS = 20, SPACING = 42;
  const paradeCX = CX, paradeCY = y0 + 1780;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      parade.push({
        x: paradeCX - ((COLS - 1) * SPACING) / 2 + c * SPACING,
        y: paradeCY - ((ROWS - 1) * SPACING) / 2 + r * SPACING,
      });
    }
  }
  zone(paradeCX - ((COLS - 1) * SPACING) / 2 - 150, paradeCY - ((ROWS - 1) * SPACING) / 2 - 150,
    (COLS - 1) * SPACING + 300, (ROWS - 1) * SPACING + 300, 'parade');
  post('parade', 'PARADE GROUND · 1000 RANKS', paradeCX - 1150, paradeCY - 570, 2300, 1140, 1000);
  strongpoints.pop();                          // recorded separately from the concrete slab
  add(paradeCX - 1420, paradeCY - 220, 260, 440, 'keep', 54, '#4c4a3a');
  // review stands down both flanks of the ground
  for (let i = 0; i < 4; i++) {
    add(inner.x + 150, paradeCY - 480 + i * 300, 260, 120, 'tent', 34, '#68705c');
    add(inner.x + inner.w - 410, paradeCY - 480 + i * 300, 260, 120, 'tent', 34, '#68705c');
  }

  /* ---------------- BARRACKS flanking the parade ---------------- */
  for (let i = 0; i < 4; i++) {
    const by = paradeCY - 520 + i * 330;
    add(inner.x + 130, by, 760, 190, 'barrack', 52, '#3c463c');
    add(inner.x + inner.w - 890, by, 760, 190, 'barrack', 52, '#3c463c');
    zone(inner.x + 120, by - 40, 800, 270, 'concrete');
    zone(inner.x + inner.w - 900, by - 40, 800, 270, 'concrete');
    man(inner.x + 500, by + 240, 'armytrooper');
    man(inner.x + inner.w - 560, by + 240, 'armyguard');
  }
  post('barracks-west', 'BARRACKS · 1ST BATTALION', inner.x + 120, paradeCY - 560, 800, 1240, 82);
  post('barracks-east', 'BARRACKS · 2ND BATTALION', inner.x + inner.w - 900, paradeCY - 560, 800, 1240, 82);
  // a mess hall, a chapel tent and a gym square between the blocks
  add(inner.x + 300, paradeCY + 780, 420, 170, 'barrack', 44, '#46503f');
  add(inner.x + inner.w - 720, paradeCY + 780, 420, 170, 'barrack', 44, '#46503f');
  for (let i = 0; i < 3; i++) add(inner.x + 300 + i * 160, paradeCY + 1000, 120, 90, 'tent', 30, '#6a725e');

  /* ---------------- CORE: the command bunker ---------------- */
  zone(core.x - 60, core.y - 60, core.w + 120, core.h + 120, 'concrete');
  const CT = 80;
  // The north wall is cut for the command gate: a gate painted on top of an unbroken wall
  // is a lie, and it left the core reachable only from the air even after the shutter fell.
  const coreGateW = 220;
  add(core.x, core.y, (core.w - coreGateW) / 2, CT, 'keep', 120, '#3f443c');
  add(core.x + core.w / 2 + coreGateW / 2, core.y, (core.w - coreGateW) / 2, CT, 'keep', 120, '#3f443c');
  add(core.x, core.y + core.h - CT, core.w, CT, 'keep', 120, '#3f443c');
  add(core.x, core.y + CT, CT, core.h - CT * 2, 'keep', 120, '#3f443c');
  add(core.x + core.w - CT, core.y + CT, CT, core.h - CT * 2, 'keep', 120, '#3f443c');
  gate(core.x + core.w / 2 - coreGateW / 2, core.y - 10, coreGateW, CT + 20, true, 3200);
  add(core.x + 260, core.y + 240, 320, 130, 'server', 44, '#3b5560');
  add(core.x + core.w - 580, core.y + 240, 320, 130, 'server', 44, '#3b5560');
  add(core.x + core.w / 2 - 220, core.y + 470, 440, 110, 'console', 40, '#4a5650');
  post('command', 'COMMAND BUNKER / GENERAL STAFF', core.x - 60, core.y - 60, core.w + 120, core.h + 120, 18);
  squad(core.x + core.w / 2, core.y + core.h / 2, 8, ['armyguard', 'armymajor', 'armyguard', 'armymedic'], 160);

  /* ---------------- TURRETS ---------------- */
  /**
   * A twin mount in a sandbagged pit.
   *
   * The emplacement used to be a 180 × 180 sandbag block with a 92 × 92 bunker inside it,
   * and both were solid. That is a wall inside a wall: the crew stood in a box, the
   * operative could not reach the mount to seize it, and — because the barrels only
   * reached 44 m — every burst was born inside the bunker and died there. The pit is now
   * a U of three low sandbag walls set well behind the muzzles, with the front open to
   * the guns' arc. Nothing solid is ever drawn where a round is born.
   */
  const turret = (x: number, y: number, ang: number, heavy: boolean) => {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const alongX = Math.abs(dx) >= Math.abs(dy);
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    const wall = heavy ? 30 : 26;
    if (alongX) {
      // back wall behind the crew, two sidewalls, the muzzle side left open
      add(x - sx * 150 - (sx > 0 ? 0 : wall), y - 110, wall, 220, 'sandbag', heavy ? 26 : 22);
      add(x - 90, y - 128 + (sy > 0 ? 0 : 0), 200, wall, 'sandbag', heavy ? 26 : 22);
      add(x - 90, y + 128 - wall, 200, wall, 'sandbag', heavy ? 26 : 22);
    } else {
      add(x - 110, y - sy * 150 - (sy > 0 ? 0 : wall), 220, wall, 'sandbag', heavy ? 26 : 22);
      add(x - 128, y - 90, wall, 200, 'sandbag', heavy ? 26 : 22);
      add(x + 128 - wall, y - 90, wall, 200, 'sandbag', heavy ? 26 : 22);
    }
    turrets.push({ x, y, ang, heavy });
  };
  turret(CX - 520, inner.y - 120, Math.PI / 2, true);
  turret(CX + 520, inner.y - 120, Math.PI / 2, true);
  turret(inner.x + 260, inner.y + 320, -0.4, false);
  turret(inner.x + inner.w - 260, inner.y + 320, Math.PI + 0.4, false);
  turret(inner.x + 260, inner.y + inner.h - 320, 0.4, false);
  turret(inner.x + inner.w - 260, inner.y + inner.h - 320, Math.PI - 0.4, false);
  turret(base.x + 420, base.y + 240, 0.9, true);
  turret(base.x + base.w - 420, base.y + 240, Math.PI - 0.9, true);
  turret(base.x + 420, base.y + base.h - 300, -0.9, false);
  turret(base.x + base.w - 420, base.y + base.h - 300, Math.PI + 0.9, false);
  turret(CX - 620, base.y + 60, Math.PI / 2, true);
  turret(CX + 620, base.y + 60, Math.PI / 2, true);
  // the outer approach, so the causeway is not a free run
  turret(CX - 900, y0 + 420, 0.2, true);
  turret(CX + 900, y0 + 420, Math.PI - 0.2, true);
  turret(1200, y0 + 470, -0.5, false);
  turret(11800, y0 + 470, Math.PI + 0.5, false);

  /* ---------------- GENERATORS: powering the inner shutter ---------------- */
  const generators = [
    { x: inner.x + 900, y: inner.y + inner.h - 520 },
    { x: inner.x + inner.w - 900, y: inner.y + inner.h - 520 },
  ];
  for (const g of generators) {
    add(g.x - 120, g.y - 120, 240, 240, 'power', 52, '#5b5b48');
    add(g.x - 190, g.y + 120, 380, 30, 'sandbag', 16);
    man(g.x + 40, g.y + 190, 'armyengineer');
  }

  /* ---------------- AIR PARK: helicopters and interceptors ---------------- */
  const helis = [
    { x: base.x + 900, y: y0 + 840, ang: 0 },
    { x: base.x + 1680, y: y0 + 840, ang: 0 },
    { x: base.x + 2460, y: y0 + 840, ang: Math.PI },
    { x: base.x + 3240, y: y0 + 840, ang: Math.PI },
  ];
  const jets: { x: number; y: number; ang: number; tier?: JetTier }[] = [
    { x: base.x + 5050, y: y0 + 860, ang: 0, tier: 'standard' },
    { x: base.x + 6450, y: y0 + 860, ang: 0, tier: 'standard' },
    { x: base.x + 7850, y: y0 + 860, ang: 0, tier: 'standard' },
  ];

  /* ---------------- the daily clutter, army issue only ---------------- */
  const clutter = ['crate', 'sandbag', 'barrel', 'truck', 'tent'] as const;
  for (let i = 0; i < 190; i++) {
    const x = base.x + 200 + rnd(0, base.w - 500);
    const y = base.y + 200 + rnd(0, base.h - 500);
    if (Math.abs(x - paradeCX) < 1250 && Math.abs(y - paradeCY) < 640) continue;
    if (x > core.x - 80 && x < core.x + core.w + 80 && y > core.y - 80 && y < core.y + core.h + 80) continue;
    if (Math.abs(x - CX) < 340) continue;
    if (x > inner.x - 80 && x < inner.x + inner.w + 80 && Math.abs(y - (inner.y + 60)) < 220) continue;
    const kind = clutter[Math.floor(rnd(0, clutter.length))];
    const s = kind === 'sandbag' ? (rnd(0, 1) < 0.5 ? [180, 30] : [30, 180]) : kind === 'tent' ? [200, 130] : [56, 56];
    add(x, y, s[0], s[1], kind as StructKind, kind === 'truck' ? 26 : 22);
  }

  // patrols of the guard, walking posts outside the walls
  const patrolTypes = ['armytrooper', 'armyguard', 'armytrooper', 'armyengineer', 'armytrooper', 'armymedic'];
  for (let i = 0; i < 26; i++) {
    const along = i % 2 === 0;
    const t = 260 + Math.floor(i / 2) * 300;
    const x = along ? 700 + (i * 613) % 15800 : 900 + (i * 977) % 15400;
    const y = along ? y0 + 500 + (i % 3) * 60 : y0 + 700 + (i * 641) % 2400;
    squad(x, y, 4, patrolTypes, 90);
    void t;
  }

  /* ---------------- TRAFFIC CIRCUITS ----------------
   * Four loops: the perimeter road inside the wall, the causeway approach, the air-park
   * access and the east service road. Convoys, staff cars and fuel bowsers work them.
   */
  const midY = y0 + 1120;
  routes.push([
    { x: base.x + 200, y: midY }, { x: CX - 700, y: midY }, { x: CX - 700, y: base.y + 500 },
    { x: base.x + 200, y: base.y + 500 },
  ]);
  routes.push([
    { x: CX + 700, y: midY }, { x: base.x + base.w - 200, y: midY },
    { x: base.x + base.w - 200, y: y0 + 2400 }, { x: CX + 700, y: y0 + 2400 },
  ]);
  routes.push([
    { x: CX, y: y0 + 300 }, { x: CX, y: base.y + 240 }, { x: CX - 1000, y: base.y + 240 },
    { x: CX - 1000, y: y0 + 300 },
  ]);
  routes.push([
    { x: CX - 300, y: y0 + 1900 }, { x: CX + 300, y: y0 + 1900 },
    { x: CX + 300, y: y0 + 2900 }, { x: CX - 300, y: y0 + 2900 },
  ]);

  /* ================================================================== *
   * FORWARD CANTONMENT — THE SOFT SIDE OF THE ARMY
   *
   * An army group this size is not uniformly dug in. Three company barracks sit out
   * east of the wire with a stove, a stack of crates and two men awake between them,
   * and the wing keeps two forward strips out there for dispersal — each with spare
   * airframes on the apron, including one of the two experimental machines from the
   * proving flight. They are the first thing an operative can actually take: light
   * resistance, real loot, and an aircraft that does not have to be earned through
   * the main gate.
   * ================================================================== */
  const cantonment = (id: string, name: string, sub: string, x: number, y: number) => {
    const w = 560, h = 400;
    post(id, name, x, y, w, h, 3);
    softTargets.push({ id, name, sub, x, y, w, h });
    // A barracks hut, a tent for the overspill, and the company's own store.
    add(x + 40, y + 40, 460, 180, 'barrack', 46, '#3f4a40');
    add(x + 60, y + 260, 170, 120, 'tent', 30, '#6a725e');
    add(x + 420, y + 290, 70, 70, 'crate', 22);
    add(x + 340, y + 300, 60, 60, 'barrel', 24, '#6e6234');
    add(x + 30, y + 226, 500, 18, 'fence', 20, '#7d8670');
    // Two men on duty, not a garrison: this is a place you can walk into.
    man(x + 220, y + 240, 'armytrooper');
    man(x + 400, y + 250, 'armyengineer');
    loot.push({ x: x + 120, y: y + 250 }, { x: x + 470, y: y + 240 });
  };
  // North cantonment: on the east approach, just outside the outer rampart.
  cantonment('cantonment-north', 'CANTONMENT · 4TH COMPANY',
    'THINLY HELD · TWO MEN AWAKE · SUPPLY CACHES IN THE OPEN', 16580, 8740);
  // South cantonment: the transit block, where replacements wait for a posting.
  cantonment('cantonment-south', 'CANTONMENT · TRANSIT BARRACKS',
    'REPLACEMENTS IN TRANSIT · NO HEAVY WEAPONS', 16580, 9940);
  // West cantonment: inside the wire, between the parade and the east barracks.
  cantonment('cantonment-west', 'REPLACEMENT DEPOT',
    'A STORE HUT AND A GUARD WHO IS NOT PAYING ATTENTION', 8780, 9500);

  /**
   * A forward strip: dispersal apron, a length of runway, a control tent, fuel, and
   * airframes parked in the open. Nothing here is fenced, and nothing here is held by
   * more than a fireteam.
   */
  const forwardStrip = (id: string, name: string, sub: string, x: number, y: number,
    airframes: { dx: number; tier: JetTier }[], guards: number) => {
    post(id, name, x, y, 1950, 290, guards + 4);
    softTargets.push({ id, name, sub, x, y, w: 1950, h: 290 });
    zone(x, y, 1950, 290, 'concrete');
    zone(x + 40, y + 40, 1870, 120, 'runway');
    // North edge: the control tent, a revetment line and the fuel point, all behind the
    // parked airframes so nothing sits on top of an aircraft.
    add(x + 40, y + 180, 240, 70, 'tent', 34, '#6b7360');
    add(x + 320, y + 182, 640, 16, 'sandbag', 16);
    add(x + 1560, y + 170, 120, 120, 'bladder', 44, '#5c5c44');
    for (let i = 0; i < 6; i++) add(x + 1700 + (i % 3) * 62, y + 160 + Math.floor(i / 3) * 66, 50, 50, 'barrel', 24, '#6e6234');
    // South edge: the airframes, nose to the runway, and the crew that is supposed to be
    // watching them.
    for (const a of airframes) jets.push({ x: x + a.dx, y: y + 248, ang: 0, tier: a.tier });
    for (let i = 0; i < guards; i++) man(x + 420 + i * 260, y + 258, i % 2 ? 'armyengineer' : 'armytrooper');
    loot.push({ x: x + 400, y: y + 252 }, { x: x + 1440, y: y + 252 });
  };
  // DISPERSAL ALPHA — two line jets and the first prototype, held by a single fireteam.
  forwardStrip('strip-alpha', 'FORWARD STRIP ALPHA',
    'DISPERSAL APRON · TWO LINE INTERCEPTORS · ONE PROTOTYPE', 11950, 8700,
    [{ dx: 640, tier: 'standard' }, { dx: 900, tier: 'prototype' }, { dx: 1180, tier: 'standard' }], 3);
  // DISPERSAL BRAVO — the proving flight's second machine, no fence, two men.
  forwardStrip('strip-bravo', 'FORWARD STRIP BRAVO · PROVING FLIGHT',
    'EXPERIMENTAL AIRFRAME ON THE APRON · GUARDED BY TWO', 13950, 8700,
    [{ dx: 560, tier: 'standard' }, { dx: 860, tier: 'prototype' }, { dx: 1120, tier: 'standard' }], 2);

  return {
    region, base, core, parade, tanks, tankPatrols, helis, jets, turrets, generators, gates,
    strongpoints, guards, routes, stockade: stock, softTargets, loot,
    alarm: { x: inner.x - 200, y: base.y, w: inner.w + 400, h: base.h },
    spawn: { x: CX, y: y0 + 260 },
    hq: { x: CX, y: core.y + core.h / 2 },
  };
}

/** A human-readable order of battle, used by the briefing and the HUD. */
export const ARMY_ORDER = {
  name: 'VOJSKA',
  codename: 'IRON RESERVE',
  brief: 'The army that was never sent. A thousand boots on the concrete, a hundred and thirty hulls in the park, and they know you are coming.',
  motto: 'NOT HYDRA. NOT S.H.I.E.L.D. JUST THE ARMY.',
};
