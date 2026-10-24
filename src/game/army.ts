/* ------------------------------------------------------------------ *
 * LEVEL 7 — VOJSKA
 *
 * A sixth sector on brand-new ground south of everything that already exists. Nothing in
 * the legacy 12 000 × 8 200 theatre and nothing on the prison island moves: the army gets
 * its own 3 400 m deep strip of land, tied to the old map by one guarded causeway road.
 *
 * The base is built as three rings, and it is meant to be the hardest place in the game:
 *
 *   OUTER  wire, minefields, checkpoints, watchtowers and the causeway gate
 *   MIDDLE apron, hangars for attack helicopters and jets, fuel depot, armour park
 *   INNER  concrete blast wall with a single powered gate, barracks, the 1000-man parade
 *          ground, and the command bunker at the back
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
  /** Live armour: these drive out and fight. */
  tankPatrols: { x: number; y: number; ang: number }[];
  helis: { x: number; y: number; ang: number }[];
  jets: { x: number; y: number; ang: number }[];
  turrets: ArmyTurretSpot[];
  generators: { x: number; y: number }[];
  gates: ArmyGate[];
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
 * the plan so the engine can animate the parade, the turrets and the alarms.
 */
export function buildArmyDistrict(ctx: ArmyContext): ArmyPlan {
  const { y0, add, zone, rnd } = ctx;
  const CX = 6000;
  const W = 17200;                       // the arena is this wide; keep the district centred

  const region = { x: 0, y: y0, w: W, h: ARMY_SOUTH };
  const base = { x: 2200, y: y0 + 620, w: 9600, h: 2600 };
  const core = { x: CX - 950, y: y0 + 2420, w: 1900, h: 760 };
  const innerTop = y0 + 1180;
  const inner = { x: 3400, y: innerTop, w: 7200, h: y0 + 3100 - innerTop };

  const gates: ArmyGate[] = [];
  const gate = (x: number, y: number, w: number, h: number, innerGate: boolean, hp: number): ArmyGate => {
    const rects: Rect[] = [];
    const leaves = innerGate ? 2 : 2;
    const leafW = innerGate ? w / 2 : w / 2;
    for (let i = 0; i < leaves; i++) {
      const rx = x + i * leafW;
      const r = add(rx, y, leafW, h, 'gate', innerGate ? 84 : 62, '#5c5644');
      r.hp = hp; r.maxHp = hp;
      // prepareStructures() copies rects, so the shutter carries its class with it.
      r.armyGate = innerGate ? 'inner' : 'outer';
      rects.push(r);
    }
    const g: ArmyGate = { rects, x, y, w, h, inner: innerGate, open: false, hp, maxHp: hp };
    gates.push(g);
    return g;
  };

  /* ---------------- ground ---------------- */
  zone(region.x, region.y, region.w, region.h, 'concrete');
  // the causeway from the legacy map and the long approach road
  zone(CX - 110, y0, 220, base.y - y0 + 20, 'road');
  zone(region.x + 80, region.y + 300, region.w - 160, 150, 'road');
  zone(base.x - 40, base.y + base.h / 2 - 70, 700, 140, 'road');            // west service
  zone(base.x + base.w - 660, base.y + base.h / 2 - 70, 700, 140, 'road');  // east service

  /* ---------------- OUTER RING ---------------- */
  const T = 70;                       // wall thickness
  const outerGateW = 420;
  // north wall, split around the main gate
  const rampart = (x: number, y: number, w: number, h: number) => {
    const r = add(x, y, w, h, 'curtain', 54);
    r.armyWall = true;
    return r;
  };
  rampart(base.x, base.y, (base.w - outerGateW) / 2, T);
  rampart(base.x + base.w / 2 + outerGateW / 2, base.y, (base.w - outerGateW) / 2, T);
  rampart(base.x, base.y + base.h - T, base.w, T);
  rampart(base.x, base.y + T, T, base.h - T * 2);
  rampart(base.x + base.w - T, base.y + T, T, base.h - T * 2);
  gate(CX - outerGateW / 2, base.y, outerGateW, T, false, 1500);

  // corner + mid towers with lights, so the wall reads as a real perimeter
  const towerAt = (x: number, y: number) => {
    add(x - 90, y - 90, 180, 180, 'tower', 92);
    add(x - 130, y - 130, 260, 260, 'sandbag', 14);
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

  /* ---------------- MIDDLE: air park, armour, fuel ---------------- */
  // rotary apron (north band, west of the runway)
  for (let i = 0; i < 4; i++) {
    const hx = base.x + 900 + i * 780, hy = y0 + 900;
    zone(hx - 190, hy - 190, 380, 380, 'helipad');
    add(hx - 210, hy - 210, 60, 60, 'crate', 26);
  }
  // jet runway along the north band
  zone(base.x + 4300, y0 + 730, 4600, 340, 'runway');
  zone(base.x + 4300, y0 + 720, 240, 360, 'concrete');

  // two hangars, side by side, big enough to read as aircraft halls
  for (let i = 0; i < 2; i++) {
    const hx = base.x + 4600 + i * 2200;
    add(hx, y0 + 800, 1500, 260, 'hangar', 96);
    add(hx, y0 + 800, 40, 260, 'hangar', 90);
    add(hx + 1460, y0 + 800, 40, 260, 'hangar', 90);
    zone(hx + 40, y0 + 1060, 1420, 120, 'concrete');
  }

  // armoured vehicle park, inside the wall on the west
  const tanks: { x: number; y: number; ang: number }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const tx = base.x + 760 + c * 260, ty = y0 + 1520 + r * 320;
      if (Math.abs(tx - CX) < 520) continue;
      add(tx, ty, 210, 150, 'tank' as StructKind, 34);
      tanks.push({ x: tx + 105, y: ty + 75, ang: 0 });
    }
  }
  zone(base.x + 700, y0 + 1460, 940, 1080, 'concrete');
  // the live patrol armour, parked by its own ramp
  const tankPatrols = [
    { x: CX - 1500, y: y0 + 1500, ang: 0.4 },
    { x: CX + 1450, y: y0 + 1650, ang: -0.6 },
    { x: CX - 1250, y: y0 + 2200, ang: 0.1 },
    { x: CX + 1300, y: y0 + 2350, ang: 2.9 },
  ];

  // fuel depot: rows of barrels behind a blast bund
  zone(base.x + 800, y0 + 2900, 900, 260, 'fuel');
  for (let i = 0; i < 22; i++) {
    const bx = base.x + 860 + (i % 11) * 74, by = y0 + 2940 + Math.floor(i / 11) * 110;
    add(bx, by, 56, 56, 'barrel' as StructKind, 30, '#7a5a2c');
  }
  add(base.x + 780, y0 + 2870, 960, 26, 'sandbag', 18);
  add(base.x + 780, y0 + 3160, 960, 26, 'sandbag', 18);

  /* ---------------- INNER: blast wall and its one powered gate ---------------- */
  const IT = 90;
  const innerGateW = 300;
  const blast = (x: number, y: number, w: number, h: number) => {
    const r = add(x, y, w, h, 'bunker', 96, '#4a4f46');
    r.armyWall = true;
    return r;
  };
  blast(inner.x, inner.y, (inner.w - innerGateW) / 2, IT);
  blast(inner.x + inner.w / 2 + innerGateW / 2, inner.y, (inner.w - innerGateW) / 2, IT);
  blast(inner.x, inner.y + inner.h - IT, inner.w, IT);
  blast(inner.x, inner.y + IT, IT, inner.h - IT * 2);
  blast(inner.x + inner.w - IT, inner.y + IT, IT, inner.h - IT * 2);
  gate(CX - innerGateW / 2, inner.y, innerGateW, IT, true, 2600);   // the only way into the parade
  // gatehouse either side of the shutter
  add(CX - innerGateW / 2 - 330, inner.y - 40, 300, 220, 'bunker', 74, '#454a42');
  add(CX + innerGateW / 2 + 30, inner.y - 40, 300, 220, 'bunker', 74, '#454a42');
  zone(CX - 260, inner.y + IT, 520, 220, 'concrete');

  /* ---------------- PARADE GROUND: 40 × 25 = 1000 men ---------------- */
  const parade: { x: number; y: number }[] = [];
  // Fifty files, twenty ranks: a thousand men, and the whole block still has room to
  // stand clear of the blast wall and the command bunker.
  const COLS = 50, ROWS = 20, SPACING = 42;
  const paradeCX = CX, paradeCY = y0 + 1780;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const px = paradeCX - ((COLS - 1) * SPACING) / 2 + c * SPACING;
      const py = paradeCY - ((ROWS - 1) * SPACING) / 2 + r * SPACING;
      parade.push({ x: px, y: py });
    }
  }
  zone(paradeCX - ((COLS - 1) * SPACING) / 2 - 150, paradeCY - ((ROWS - 1) * SPACING) / 2 - 150,
    (COLS - 1) * SPACING + 300, (ROWS - 1) * SPACING + 300, 'parade');
  // a raised reviewing dais on the west edge of the ground
  add(paradeCX - 1420, paradeCY - 220, 260, 440, 'keep', 54, '#4c4a3a');

  /* ---------------- BARRACKS flanking the parade ---------------- */
  for (let i = 0; i < 4; i++) {
    const by = paradeCY - 520 + i * 330;
    add(inner.x + 130, by, 760, 190, 'barrack', 52, '#3c463c');
    add(inner.x + inner.w - 890, by, 760, 190, 'barrack', 52, '#3c463c');
    zone(inner.x + 120, by - 40, 800, 270, 'concrete');
    zone(inner.x + inner.w - 900, by - 40, 800, 270, 'concrete');
  }

  /* ---------------- CORE: the command bunker ---------------- */
  zone(core.x - 60, core.y - 60, core.w + 120, core.h + 120, 'concrete');
  const CT = 80;
  add(core.x, core.y, core.w, CT, 'keep', 120, '#3f443c');
  add(core.x, core.y + core.h - CT, core.w, CT, 'keep', 120, '#3f443c');
  add(core.x, core.y + CT, CT, core.h - CT * 2, 'keep', 120, '#3f443c');
  add(core.x + core.w - CT, core.y + CT, CT, core.h - CT * 2, 'keep', 120, '#3f443c');
  // the bunker's own door: a heavy shutter, not a hole
  const coreGate = gate(core.x + core.w / 2 - 110, core.y - 10, 220, CT + 20, true, 3200);
  void coreGate;
  // interior: operations floor, consoles, mainframe bank
  add(core.x + 260, core.y + 240, 320, 130, 'server', 44, '#3b5560');
  add(core.x + core.w - 580, core.y + 240, 320, 130, 'server', 44, '#3b5560');
  add(core.x + core.w / 2 - 220, core.y + 470, 440, 110, 'console' as StructKind, 40, '#4a5650');

  /* ---------------- TURRETS ---------------- */
  const turrets: ArmyTurretSpot[] = [];
  const turret = (x: number, y: number, ang: number, heavy: boolean) => {
    add(x - 90, y - 90, 180, 180, 'sandbag', 22);
    add(x - 46, y - 46, 92, 92, 'bunker', heavy ? 58 : 40, heavy ? '#4b5348' : '#464f45');
    turrets.push({ x, y, ang, heavy });
  };
  // the pair watching the blast gate stand outside it, clear of the parade ground
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

  /* ---------------- GENERATORS: powering the inner shutter ---------------- */
  const generators = [
    { x: inner.x + 900, y: inner.y + inner.h - 520 },
    { x: inner.x + inner.w - 900, y: inner.y + inner.h - 520 },
  ];
  for (const g of generators) {
    add(g.x - 120, g.y - 120, 240, 240, 'power', 52, '#5b5b48');
    add(g.x - 190, g.y + 120, 380, 30, 'sandbag', 16);
  }

  /* ---------------- AIR PARK: helicopters and jets on the apron ---------------- */
  const helis = [
    { x: base.x + 900, y: y0 + 900, ang: 0 },
    { x: base.x + 1680, y: y0 + 900, ang: 0 },
    { x: base.x + 2460, y: y0 + 900, ang: Math.PI },
    { x: base.x + 3240, y: y0 + 900, ang: Math.PI },
  ];
  const jets = [
    { x: base.x + 5200, y: y0 + 900, ang: 0 },
    { x: base.x + 6800, y: y0 + 900, ang: 0 },
  ];

  // scattered military clutter that is not on the roads
  const clutter = ['crate', 'sandbag', 'barrel', 'truck'] as const;
  for (let i = 0; i < 220; i++) {
    const x = base.x + 200 + rnd(0, base.w - 500);
    const y = base.y + 200 + rnd(0, base.h - 500);
    // keep the parade ground, the core and the whole approach corridor clear
    if (Math.abs(x - paradeCX) < 1250 && Math.abs(y - paradeCY) < 640) continue;
    if (x > core.x - 80 && x < core.x + core.w + 80 && y > core.y - 80 && y < core.y + core.h + 80) continue;
    if (Math.abs(x - CX) < 340) continue;                       // the road in
    if (x > inner.x - 80 && x < inner.x + inner.w + 80 && Math.abs(y - (inner.y + 60)) < 220) continue;
    const kind = clutter[Math.floor(rnd(0, clutter.length))];
    const s = kind === 'sandbag' ? (rnd(0, 1) < 0.5 ? [180, 30] : [30, 180]) : [56, 56];
    add(x, y, s[0], s[1], kind as StructKind, kind === 'truck' ? 26 : 22);
  }

  return {
    region, base, core, parade, tanks, tankPatrols, helis, jets, turrets, generators, gates,
    alarm: { x: inner.x - 200, y: base.y, w: inner.w + 400, h: base.h },
    spawn: { x: CX, y: y0 + 260 },
    hq: { x: CX, y: core.y + core.h / 2 },
  };
}

/** A human-readable order of battle, used by the briefing and the HUD. */
export const ARMY_ORDER = {
  name: 'VOJSKA',
  codename: 'IRON RESERVE',
  brief: 'The army that was never sent. Ten thousand boots on the concrete, and they know you are coming.',
  motto: 'NOT HYDRA. NOT S.H.I.E.L.D. JUST THE ARMY.',
};
