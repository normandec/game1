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
export const ARMY_SOUTH = 4800;

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
  /**
   * The footprint of the emplacement's own sandbag walls, plus the box they enclose.
   * The crew needs it to know what it must never shoot: a twin mount that fires into its
   * own pit is a gun that appears to be shooting itself.
   */
  pit?: { x: number; y: number; w: number; h: number }[];
  pitBox?: { x: number; y: number; w: number; h: number };
}

/** A painted marking on the hardstanding: parking bays, lane lines, a marshalling box. */
export interface ArmyMarking {
  x: number; y: number; w: number; h: number;
  kind: 'bay' | 'lane' | 'box' | 'arrow';
  ang?: number;
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
  /** Painted hardstanding markings — bays, lane lines, marshalling boxes. */
  markings: ArmyMarking[];
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
  const { y0, rnd } = ctx;
  /** Zones painted by this district, tracked so nothing is ever parked on the pavement. */
  const pavements: { x: number; y: number; w: number; h: number; kind: string }[] = [];
  const zoneRaw = ctx.zone;
  const zone = (x: number, y: number, w: number, h: number, kind: Parameters<typeof zoneRaw>[4]) => {
    zoneRaw(x, y, w, h, kind);
    pavements.push({ x, y, w, h, kind });
  };
  /* Every structure that goes down is recorded, so anything placed later can be tested
   * against it. The base used to be dressed by scattering 190 random crates and tents
   * across the whole compound: they landed in the roads, on the runway, inside barracks
   * and on top of parked armour, which is exactly what "the elements are arranged oddly"
   * looked like. Placement is now a first-class operation. */
  const placed: Rect[] = [];
  const addRaw = ctx.add;
  const add = (x: number, y: number, w: number, h: number, kind: string, hp: number, color?: string): Rect => {
    const r = addRaw(x, y, w, h, kind as never, hp, color);
    placed.push(r);
    return r;
  };
  /** Would a rect at these coordinates collide with anything already standing? */
  const free = (x: number, y: number, w: number, h: number, pad = 10) => {
    for (const r of placed) {
      if (x + w + pad <= r.x || x - pad >= r.x + r.w) continue;
      if (y + h + pad <= r.y || y - pad >= r.y + r.h) continue;
      return false;
    }
    for (const z of pavements) {
      if (z.kind !== 'road' && z.kind !== 'runway') continue;
      if (x + w <= z.x || x >= z.x + z.w) continue;
      if (y + h <= z.y || y >= z.y + z.h) continue;
      return false;
    }
    return true;
  };
  /** Place a structure only where it fits; returns null when there is no room. */
  const place = (x: number, y: number, w: number, h: number, kind: string, hp: number, color?: string) =>
    free(x, y, w, h) ? add(x, y, w, h, kind, hp, color) : null;
  const CX = 6000;
  const W = 17200;                       // the arena is this wide; keep the district centred

  const region = { x: 0, y: y0, w: W, h: ARMY_SOUTH };
  /* The walled compound is laid out south of the old border in four bands:
   *   APPROACH  y0 .. +560      causeway, checkpoint, the outlying batteries
   *   NORTH     +560 .. +1180   stockade and the rotary-wing park (helipads)
   *   INNER     +1180 .. +3160  blast wall: parade, barracks, motor pool, command keep
   *   AIRFIELD  +3160 .. +4760  runway, apron, two megahangars, casemates on the south wall
   * The airfield used to be crammed into the north strip together with the halls, the
   * tower and the parked jets: the runway was 340 px of tarmac with two 190 m hangars
   * standing on top of it and interceptor hulls parked on the threshold. That is why the
   * base read as a pile of buildings instead of an installation. */
  const base = { x: 2200, y: y0 + 560, w: 9600, h: 4200 };
  const core = { x: CX - 950, y: y0 + 2240, w: 1900, h: 760 };
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
  const markings: ArmyMarking[] = [];

  const gate = (x: number, y: number, w: number, h: number, innerGate: boolean, hp: number): ArmyGate => {
    const rects: Rect[] = [];
    const leafW = w / 2;
    const gateId = `g${gates.length}`;
    for (let i = 0; i < 2; i++) {
      const r = add(x + i * leafW, y, leafW, h, 'gate', innerGate ? 84 : 62, '#5c5644');
      r.hp = hp; r.maxHp = hp;
      // prepareStructures() copies rects, so the shutter carries its class with it.
      r.armyGate = innerGate ? 'inner' : 'outer';
      /* The renderer needs the gate as a whole, not the two leaves and not the four
       * 144 px sections prepareStructures() splits each leaf into. These three fields are
       * what let it draw one gatehouse instead of four doors. */
      r.armyGateId = gateId;
      r.armyGateW = w;
      r.armyGateH = h;
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
  zone(CX - 110, y0, 220, innerTop - y0, 'road');                 // causeway to the inner gate
  zone(base.x + 120, y0 + 3210, base.w - 240, 70, 'road');          // airfield north service road
  zone(base.x + 120, y0 + 4370, base.w - 240, 50, 'road');          // behind the halls
  zone(base.x + 120, y0 + 3210, 70, 1180, 'road');                  // field west access
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
  /* The causeway checkpoints stand on the shoulder of the perimeter road, not across it:
   * a sandbag wall in the traffic lane is a wall, not a checkpoint. */
  add(CX - 700, y0 + 470, 380, 26, 'sandbag', 20);
  add(CX + 320, y0 + 470, 380, 26, 'sandbag', 20);
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
  add(8300, y0 + 470, 1700, 22, 'sandbag', 16);
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
  add(7160, y0 + 470, 800, 24, 'sandbag', 18);
  for (let i = 0; i < 5; i++) add(7180 + i * 150, y0 + 500, 90, 60, 'target', 30, '#7a7460');
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
    add(300, y0 + 880 + row * 182, 142, 220, 'tank', 38);
    tanks.push({ x: 371, y: y0 + 951 + row * 182, ang: Math.PI / 2 });
  }
  /* THE WING'S OWN DEFENCE TROOP.
   * Six fuelled hulls on the flight line between the megahangars and the runway. They are
   * parked here in the world and they are live sortie positions too, so an alarm over the
   * airfield puts armour on the field where the aircraft are — not four kilometres away in
   * the park. The user's report was "there are no tanks anywhere" while flying: this is
   * the ground the battalion was missing. */
  for (let i = 0; i < 6; i++) {
    const tx = base.x + 4300 + i * 360, ty = y0 + 3750;
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
  // the compound floor: poured hardstanding up to the foot of the wall, not a lawn
  zone(base.x + T, base.y + T, base.w - T * 2, base.h - T * 2, 'apron');

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
  /* ROTARY PARK — four pads on the north strip, in front of the stockade.
   * Nothing else is stored here: a pad is a pad, with its H painted on the concrete. */
  for (let i = 0; i < 4; i++) {
    const hx = base.x + 1800 + i * 800, hy = y0 + 760;
    zone(hx, hy, 340, 340, 'helipad');
    add(hx + 20, hy + 20, 56, 56, 'crate', 26);
    add(hx + 250, hy + 20, 56, 56, 'barrel', 24, '#6e6234');
    man(hx + 170, hy + 300, 'armyengineer');
  }

  /* ================================================================== *
   * FIXED-WING FIELD — south of the blast wall
   *
   * Runway, apron, two cathedral-size halls, two hardened shelters, the tower and the
   * fuel point, all in one band, nothing standing on the tarmac. The interceptor hulls
   * are parked on the apron in front of the doors and the wing's defence troop parks on
   * the same concrete, so an alarm over the field puts armour where the aircraft are.
   * ================================================================== */
  const fieldY = y0 + 3300;
  zone(base.x + 2400, fieldY + 340, 7100, 280, 'apron');               // apron
  for (let i = 0; i < 2; i++) {
    const hx = base.x + 2500 + i * 2100;
    const hall = add(hx, fieldY + 640, 1900, 420, 'megahangar', 170);
    void hall;
    zone(hx - 60, fieldY + 600, 2020, 40, 'concrete');                 // apron edge stripes
    man(hx + 180, fieldY + 1080, 'armyengineer');
    man(hx + 1660, fieldY + 1080, 'armyguard');
  }
  for (let i = 0; i < 2; i++) {
    add(base.x + 6900 + i * 600, fieldY + 660, 380, 300, 'hangar', 120, '#3b4136');
  }
  // the tower stands clear of the halls, east end of the apron
  add(base.x + 8400, fieldY + 640, 260, 260, 'tower', 140);
  squad(base.x + 8530, fieldY + 780, 3, ['armyguard', 'armyengineer'], 60);
  // the wing's fuel point, on the service strip behind the halls
  add(base.x + 8700, fieldY + 940, 190, 90, 'bladder', 40, '#5c5c44');
  for (let i = 0; i < 5; i++) add(base.x + 8920 + i * 58, fieldY + 946, 46, 46, 'barrel', 24, '#6e6234');
  add(base.x + 8660, fieldY + 890, 260, 16, 'sandbag', 16);
  post('airpark', 'AIR PARK / 9TH AIR WING', base.x + 2400, fieldY + 320, 7100, 1100, 26);
  // runway edge lighting: a lamp every 200 px down both sides, and the threshold bar
  for (let i = 0; i <= 32; i++) {
    const lx = base.x + 2540 + i * 205;
    add(lx, fieldY - 8, 14, 14, 'lamp', 10, '#9fb08e');
    add(lx, fieldY + 344, 14, 14, 'lamp', 10, '#9fb08e');
  }
  for (let i = 0; i < 6; i++) add(base.x + 2600 + i * 44, fieldY + 120, 14, 14, 'lamp', 10, '#d8c46a');
  // apron floodlight masts, one per hall bay and two on the tower side
  for (let i = 0; i < 5; i++) add(base.x + 3100 + i * 1450, fieldY + 590, 22, 22, 'lamp', 14, '#c9c39a');
  // the runway is cut last so the apron and the halls never end up painted on it
  zone(base.x + 2500, fieldY, 6600, 340, 'runway');
  zone(base.x + 2500, fieldY - 10, 240, 360, 'concrete');
  squad(base.x + 5300, fieldY + 500, 5, ['armyengineer', 'armyguard'], 120);
  squad(base.x + 7500, fieldY + 500, 5, ['armyengineer', 'armyguard'], 120);

  /* ---------------- MEGASTRUCTURES ---------------- */
  // Eight-storey accommodation blocks, the kind that house a battalion each.
  post('towerblock-w', 'ACCOMMODATION BLOCK A · 8 FLOORS', base.x + 100, y0 + 1260, 700, 520, 24);
  add(base.x + 120, y0 + 1300, 660, 450, 'towerblock', 300, '#6a7258');
  post('towerblock-e', 'ACCOMMODATION BLOCK B · 8 FLOORS', base.x + 8800, y0 + 1260, 700, 520, 24);
  add(base.x + 8820, y0 + 1300, 660, 450, 'towerblock', 300, '#6a7258');
  squad(base.x + 450, y0 + 1830, 5, ['armytrooper', 'armytrooper', 'armyguard', 'armymedic'], 90);
  squad(base.x + 9150, y0 + 1830, 5, ['armytrooper', 'armytrooper', 'armyguard', 'armyengineer'], 90);

  // Radar domes: a 40 m golf ball on a plinth, and the array that feeds it.
  /* The domes stand together on the clear ground between the helipads and the east wall.
   * The big one used to sit in the west lane on top of the motor pool, and its feed array
   * was bolted across the fuel bund: a radar site parked in a vehicle park. */
  add(base.x + 7600, y0 + 620, 520, 520, 'radome', 190, '#c9d4c0');
  add(base.x + 5450, y0 + 2700, 300, 300, 'radome', 190, '#c9d4c0');
  add(base.x + 8300, y0 + 660, 260, 200, 'radar', 90, '#5a6656');

  // A water tower tall enough to gravity-feed the whole base.
  add(base.x + 8920, y0 + 2000, 380, 380, 'watertower', 260, '#8b967e');
  add(base.x + 8840, y0 + 2420, 540, 24, 'sandbag', 16);

  // Artillery casemates along the south wall: concrete boxes with a gun in the mouth.
  for (let i = 0; i < 4; i++) {
    const kx = base.x + 700 + i * 2200;
    add(kx, y0 + 4420, 520, 200, 'kazemat', 120, '#7d8670');
    add(kx - 40, y0 + 4370, 600, 30, 'sandbag', 22);
    man(kx + 250, y0 + 4370, 'armyengineer');
    man(kx + 300, y0 + 4380, 'armyguard');
  }
  post('casemates', 'ARTILLERY CASEMATES', base.x + 600, y0 + 4370, 8700, 260, 16);

  /* ================================================================== *
   * TRAINING GROUND — the west end of the field, between the wall and the runway
   *
   * A base that holds a thousand men has to teach them something: an assault course of
   * low walls and wire, a lane of figure targets, and a mock village of stacked
   * containers that a company can clear twenty times a week. It fills the corner the
   * airfield leaves, and it is loud, lit and busy — the opposite of an empty lawn.
   * ================================================================== */
  post('training', 'TRAINING GROUND / ASSAULT COURSE', base.x + 120, y0 + 3320, 2150, 1250, 10);
  zone(base.x + 120, y0 + 3320, 2150, 1250, 'sand');
  for (let lane = 0; lane < 4; lane++) {
    const ly = y0 + 3400 + lane * 170;
    for (let w = 0; w < 3; w++) add(base.x + 220 + w * 260, ly, 170, 26, 'sandbag', 18);
    man(base.x + 250 + lane * 40, ly + 90, 'armytrooper');
  }
  for (let i = 0; i < 8; i++) add(base.x + 1250, y0 + 3420 + i * 96, 90, 60, 'target', 30, '#7a7460');
  // mock village: two ranks of containers with a cleared alley between them
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      add(base.x + 240 + col * 240, y0 + 3980 + row * 170, 200, 150, 'crate', 34, '#6b6444');
    }
  }
  add(base.x + 220, y0 + 3950, 960, 20, 'fence', 24, '#7d8670');
  add(base.x + 1400, y0 + 3950, 700, 20, 'fence', 24, '#7d8670');
  for (let i = 0; i < 3; i++) add(base.x + 1500 + i * 210, y0 + 4180, 180, 120, 'tent', 30, '#6a725e');
  man(base.x + 260, y0 + 3900, 'armymajor');
  squad(base.x + 700, y0 + 3880, 6, ['armytrooper', 'armytrooper', 'armyguard'], 120);
  squad(base.x + 1700, y0 + 4050, 5, ['armytrooper', 'armymedic'], 100);

  /* ---------------- STOCKADE / MILITARY PRISON ----------------
   * A base this size has its own brig: wire, four guard towers, two cell blocks and an
   * exercise cage. The inmates are the army's own — deserters, and the ones who asked
   * questions. Break the stockade open and they will fight for whoever freed them.
   */
  const stock = { x: base.x + 60, y: y0 + 640, w: 1500, h: 460 };
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
  /* The pool is the lane between the west rampart and the blast wall — 1000 px of
   * hardstanding, and the only place a depot can sit without a wall through it. */
  post('motorpool', 'MOTOR POOL / VEHICLE DEPOT', base.x + 270, y0 + 2300, 870, 780, 18);
  for (let i = 0; i < 8; i++) {
    const vx = base.x + 320, vy = y0 + 2360 + i * 88;
    const kind = (['humvee', 'car', 'tanker', 'bus'] as const)[i % 4];
    const w = kind === 'bus' ? 260 : kind === 'tanker' ? 220 : 150;
    const h = kind === 'bus' ? 100 : kind === 'tanker' ? 90 : 74;
    add(vx + (i % 2) * 380, vy, w, h, kind, kind === 'bus' ? 96 : 62);
  }
  add(base.x + 270, y0 + 2280, 870, 22, 'sandbag', 16);
  add(base.x + 270, y0 + 3040, 870, 22, 'sandbag', 16);
  squad(base.x + 700, y0 + 2660, 6, ['armyengineer', 'armytrooper', 'armyguard'], 100);

  // fuel farm behind a blast bund on the west of the middle ring
  zone(base.x + 270, y0 + 1500, 900, 620, 'fuel');
  for (let i = 0; i < 26; i++) {
    const bx = base.x + 330 + (i % 13) * 66, by = y0 + 1490 + Math.floor(i / 13) * 70;
    add(bx, by, 52, 52, 'barrel', 30, '#7a5a2c');
  }
  for (let i = 0; i < 3; i++) add(base.x + 310 + i * 280, y0 + 1780, 250, 160, 'bladder', 40, '#5c5c44');
  add(base.x + 270, y0 + 1460, 900, 26, 'sandbag', 18);
  add(base.x + 270, y0 + 2100, 900, 26, 'sandbag', 18);
  post('fuel-farm', 'FUEL FARM', base.x + 270, y0 + 1460, 900, 660, 14);
  squad(base.x + 700, y0 + 1920, 5, ['armyengineer', 'armytrooper'], 90);

  // ammunition bunkers on the east side of the middle ring
  post('magazine', 'FORWARD MAGAZINE', base.x + base.w - 1110, y0 + 2280, 840, 660, 12);
  for (let i = 0; i < 3; i++) add(base.x + base.w - 1080 + i * 250, y0 + 2440, 210, 160, 'bunker', 62, '#4a4f46');
  for (let i = 0; i < 12; i++) add(base.x + base.w - 1060 + (i % 6) * 80, y0 + 2680 + Math.floor(i / 6) * 90, 50, 50, 'barrel', 26, '#6e6234');
  squad(base.x + base.w - 700, y0 + 2380, 5, ['armyguard', 'armytrooper'], 80);

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
  /* Review stands: one row each flank, on the strip between the blast wall and the first
   * rank. They used to stand in the same band as the barracks, so four tents were planted
   * inside four barrack blocks — the stand was sleeping in the billet. */
  for (let i = 0; i < 4; i++) {
    add(inner.x + 150 + i * 300, paradeCY - 508, 260, 100, 'tent', 34, '#68705c');
    add(inner.x + inner.w - 1350 + i * 300, paradeCY - 508, 260, 100, 'tent', 34, '#68705c');
  }

  /* ---------------- BARRACKS flanking the parade ---------------- */
  const barracksW = inner.x + 400, barracksE = inner.x + inner.w - 1160;
  for (let i = 0; i < 4; i++) {
    const by = paradeCY - 260 + i * 300;
    add(barracksW, by, 760, 190, 'barrack', 52, '#3c463c');
    add(barracksE, by, 760, 190, 'barrack', 52, '#3c463c');
    zone(barracksW - 10, by - 40, 800, 270, 'concrete');
    zone(barracksE - 10, by - 40, 800, 270, 'concrete');
    man(barracksW + 380, by + 240, 'armytrooper');
    man(barracksE + 340, by + 240, 'armyguard');
  }
  post('barracks-west', 'BARRACKS · 1ST BATTALION', barracksW - 10, paradeCY - 300, 800, 1420, 82);
  post('barracks-east', 'BARRACKS · 2ND BATTALION', barracksE - 10, paradeCY - 300, 800, 1420, 82);
  /* SUPPLY DEPOT — the stores yard east of the parade. This was the largest blank patch
   * inside the wire: 2 500 px of empty concrete between the parade and the east barracks.
   * An installation of this size would keep its class-one stores there, under wire, with
   * a forklift lane down the middle and a bund round the fuel. */
  post('stores', 'SUPPLY DEPOT / CLASS ONE STORES', base.x + 4900, y0 + 1300, 1900, 880, 14);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      add(base.x + 5000 + col * 210, y0 + 1360 + row * 230, 180, 150, 'crate', 30, '#6b6444');
    }
  }
  add(base.x + 4900, y0 + 1310, 1900, 22, 'fence', 30, '#7d8670');
  add(base.x + 4900, y0 + 2160, 1900, 22, 'fence', 30, '#7d8670');
  add(base.x + 4900, y0 + 1310, 22, 880, 'fence', 30, '#7d8670');
  add(base.x + 6778, y0 + 1310, 22, 880, 'fence', 30, '#7d8670');
  // the bowser apron along the south edge of the yard
  add(base.x + 5900, y0 + 2040, 240, 80, 'bladder', 40, '#5c5c44');
  for (let i = 0; i < 6; i++) add(base.x + 5500 + (i % 3) * 70, y0 + 2010 + Math.floor(i / 3) * 70, 52, 52, 'barrel', 24, '#6e6234');
  for (let i = 0; i < 3; i++) add(base.x + 6100 + i * 220, y0 + 1860, 150, 74, 'humvee', 62);
  squad(base.x + 5900, y0 + 1640, 4, ['armyengineer', 'armyguard'], 90);

  // a mess hall, a chapel tent and a gym square between the blocks
  add(inner.x + 1100, paradeCY + 980, 420, 170, 'barrack', 44, '#46503f');
  add(inner.x + inner.w - 1520, paradeCY + 980, 420, 170, 'barrack', 44, '#46503f');
  for (let i = 0; i < 3; i++) add(inner.x + 1100 + i * 160, paradeCY + 1170, 120, 90, 'tent', 30, '#6a725e');

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
    const pit: { x: number; y: number; w: number; h: number }[] = [];
    /* The walls are kept as the live rects the world is built from, not as copies: the
     * road clearance pass below can then step a whole emplacement off a carriageway. */
    const wallAt = (wx: number, wy: number, ww: number, wh: number) => {
      pit.push(add(wx, wy, ww, wh, 'sandbag', heavy ? 26 : 22));
    };
    if (alongX) {
      // back wall behind the crew, two sidewalls, the muzzle side left open
      wallAt(x - sx * 150 - (sx > 0 ? 0 : wall), y - 110, wall, 220);
      wallAt(x - 90, y - 128, 200, wall);
      wallAt(x - 90, y + 128 - wall, 200, wall);
    } else {
      wallAt(x - 110, y - sy * 150 - (sy > 0 ? 0 : wall), 220, wall);
      wallAt(x - 128, y - 90, wall, 200);
      wallAt(x + 128 - wall, y - 90, wall, 200);
    }
    const xs = pit.map((r) => r.x), ys = pit.map((r) => r.y);
    const pitBox = {
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...pit.map((r) => r.x + r.w)) - Math.min(...xs),
      h: Math.max(...pit.map((r) => r.y + r.h)) - Math.min(...ys),
    };
    turrets.push({ x, y, ang, heavy, pit, pitBox });
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
    { x: inner.x + 900, y: inner.y + inner.h - 300 },
    { x: inner.x + inner.w - 900, y: inner.y + inner.h - 300 },
  ];
  for (const g of generators) {
    add(g.x - 120, g.y - 120, 240, 240, 'power', 52, '#5b5b48');
    add(g.x - 190, g.y + 120, 380, 30, 'sandbag', 16);
    man(g.x + 40, g.y + 190, 'armyengineer');
  }

  /* ---------------- AIR PARK: helicopters and interceptors ---------------- */
  const helis = [
    { x: base.x + 1970, y: y0 + 930, ang: 0 },
    { x: base.x + 2770, y: y0 + 930, ang: 0 },
    { x: base.x + 3570, y: y0 + 930, ang: Math.PI },
    { x: base.x + 4370, y: y0 + 930, ang: Math.PI },
  ];
  /* Three line interceptors, nose to the runway, on the apron in front of the halls. */
  const jets: { x: number; y: number; ang: number; tier?: JetTier }[] = [
    { x: base.x + 2900, y: y0 + 3800, ang: -Math.PI / 2, tier: 'standard' },
    { x: base.x + 3300, y: y0 + 3800, ang: -Math.PI / 2, tier: 'standard' },
    { x: base.x + 3700, y: y0 + 3800, ang: -Math.PI / 2, tier: 'standard' },
  ];

  /* ---------------- the daily clutter, army issue only ----------------
   * This block used to throw 190 props at random coordinates inside the compound. They
   * landed in the middle of the parade, inside barracks, across the runway and on top of
   * parked armour: 198 overlapping pairs in the last audit, and the reason the base read
   * as debris rather than as a garrison. Supplies are now stacked in yards at the back of
   * the buildings that own them, and every single prop goes through the same placer that
   * refuses occupied ground, roads and aprons.
   */
  const yards: { x: number; y: number; cols: number; rows: number; kind: string; dw: number; dh: number }[] = [
    // behind the stockade, along the west rampart
    { x: base.x + 140, y: y0 + 1150, cols: 4, rows: 1, kind: 'crate', dw: 90, dh: 90 },
    { x: base.x + 140, y: y0 + 1170, cols: 2, rows: 2, kind: 'barrel', dw: 80, dh: 90 },
    // the west lane, outside the blast wall
    { x: base.x + 150, y: y0 + 2180, cols: 3, rows: 2, kind: 'crate', dw: 100, dh: 90 },
    { x: base.x + 150, y: y0 + 3120, cols: 3, rows: 1, kind: 'barrel', dw: 90, dh: 80 },
    { x: base.x + 700, y: y0 + 3130, cols: 2, rows: 1, kind: 'tent', dw: 230, dh: 150 },
    // the east lane, outside the blast wall
    { x: base.x + 8760, y: y0 + 1180, cols: 3, rows: 1, kind: 'crate', dw: 100, dh: 90 },
    { x: base.x + 8760, y: y0 + 1340, cols: 2, rows: 1, kind: 'truck', dw: 130, dh: 90 },
    { x: base.x + 8760, y: y0 + 3130, cols: 3, rows: 1, kind: 'barrel', dw: 90, dh: 80 },
    // between the parade and the east barracks
    { x: base.x + 7300, y: y0 + 2300, cols: 3, rows: 1, kind: 'crate', dw: 100, dh: 90 },
    // behind the halls, on the airfield service strip
    { x: base.x + 2500, y: y0 + 4300, cols: 5, rows: 1, kind: 'barrel', dw: 90, dh: 70 },
    { x: base.x + 4700, y: y0 + 4300, cols: 5, rows: 1, kind: 'crate', dw: 100, dh: 70 },
    { x: base.x + 6950, y: y0 + 3900, cols: 2, rows: 1, kind: 'crate', dw: 100, dh: 80 },
    { x: base.x + 4620, y: y0 + 3660, cols: 2, rows: 1, kind: 'truck', dw: 130, dh: 90 },
    // north strip, either side of the pads
    { x: base.x + 120, y: y0 + 620, cols: 3, rows: 1, kind: 'crate', dw: 100, dh: 90 },
    { x: base.x + 6900, y: y0 + 640, cols: 3, rows: 2, kind: 'crate', dw: 100, dh: 90 },
    { x: base.x + 6900, y: y0 + 900, cols: 2, rows: 1, kind: 'tent', dw: 230, dh: 150 },
    // the training ground's own store
    { x: base.x + 1300, y: y0 + 4180, cols: 3, rows: 1, kind: 'barrel', dw: 90, dh: 80 },
  ];
  let props = 0;
  for (const yard of yards) {
    for (let r = 0; r < yard.rows; r++) {
      for (let c = 0; c < yard.cols; c++) {
        const px = yard.x + c * yard.dw + (r % 2) * 14;
        const py = yard.y + r * yard.dh;
        const w = yard.kind === 'tent' ? 200 : yard.kind === 'truck' ? 110 : 56;
        const h = yard.kind === 'tent' ? 130 : yard.kind === 'truck' ? 80 : 56;
        if (place(px, py, w, h, yard.kind, yard.kind === 'truck' ? 26 : 22)) props++;
      }
    }
  }
  // a last light scatter of loose kit against the walls: still placed, never thrown
  for (let i = 0; i < 60 && props < 190; i++) {
    const px = base.x + 140 + ((i * 733) % (base.w - 400));
    const py = base.y + 90 + ((i * 541) % (base.h - 220));
    const kind = (['crate', 'sandbag', 'barrel', 'crate'] as const)[i % 4];
    const s2 = kind === 'sandbag' ? (i % 2 ? [180, 26] : [26, 180]) : [56, 56];
    if (place(px, py, s2[0], s2[1], kind, 22)) props++;
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

  /* ================================================================== *
   * INTERNAL ROAD NETWORK — the bones of a real installation
   *
   * Up to now the compound was one poured slab with a causeway down the middle: from the
   * air it read as a car park with buildings on it. A base this size is organised by its
   * roads — a ring road inside the wire, a spur to every district and a perimeter track
   * behind the wall — and the roads are what make the layout legible from any zoom. They
   * are laid from the gates outward, so nothing crosses a wall.
   * ================================================================== */
  const roadW = 96;
  const paved: { x: number; y: number; w: number; h: number }[] = [];
  /**
   * Paint a road only where the ground is genuinely free. Roads here are laid *after* the
   * districts, so this is what keeps a carriageway out of a barrack block: the candidate
   * run is tested against every structure already standing, and rejected if it touches
   * one. A road that cannot be built is simply not drawn, rather than drawn through a wall.
   */
  const pave = (x: number, y: number, w: number, h: number): boolean => {
    for (const r of placed) {
      if (x + w + 6 <= r.x || x - 6 >= r.x + r.w) continue;
      if (y + h + 6 <= r.y || y - 6 >= r.y + r.h) continue;
      return false;
    }
    for (const z of pavements) {
      if (z.kind !== 'road') continue;
      if (x + w <= z.x || x >= z.x + z.w) continue;
      if (y + h <= z.y || y >= z.y + z.h) continue;
      return false;
    }
    /* Nor through a gun pit. The pit is three sandbag walls with the guns' side left open,
     * so a candidate carriageway could thread the gap and leave a twin mount standing in
     * the middle of a road — which is precisely the odd arrangement in the report. */
    for (const t of turrets) {
      const pb = t.pitBox;
      if (!pb) continue;
      if (x + w <= pb.x || x >= pb.x + pb.w) continue;
      if (y + h <= pb.y || y >= pb.y + pb.h) continue;
      return false;
    }
    zone(x, y, w, h, 'road');
    paved.push({ x, y, w, h });
    return true;
  };
  /**
   * A long run is cut into 220 px sections and every section is tested on its own: the
   * road that gets built threads between the buildings instead of being dropped whole the
   * first time it meets a magazine. This is how a real base ends up with a road network
   * that bends — the roads went where there was room, not where the drawing said.
   */
  const paveRun = (x: number, y: number, w: number, h: number): number => {
    const horizontal = w >= h;
    const len = horizontal ? w : h;
    const step = 220;
    let made = 0;
    for (let d = 0; d < len; d += step) {
      const seg = Math.min(step, len - d) + (d + step < len ? 2 : 0);
      if (pave(horizontal ? x + d : x, horizontal ? y : y + d, horizontal ? seg : w, horizontal ? h : seg)) made++;
    }
    return made;
  };
  let roads = 0;
  roads += paveRun(base.x + 190, base.y + 120, roadW, base.h - 240);                // west lane
  roads += paveRun(base.x + base.w - 286, base.y + 120, roadW, base.h - 240);       // east lane
  roads += paveRun(base.x + T + 10, y0 + 2150, base.w - T * 2 - 20, 76);            // east-west service road
  roads += paveRun(base.x + T + 10, y0 + 3230, base.w - T * 2 - 20, 70);            // airfield north road
  // spurs from the service road into the districts that front onto it
  for (const spur of [
    { x: base.x + 300, y: y0 + 2220, w: 70, h: 340 },        // motor pool
    { x: base.x + 1450, y: y0 + 2220, w: 70, h: 300 },       // fuel farm gate
    { x: base.x + base.w - 900, y: y0 + 2220, w: 70, h: 300 }, // magazine
    { x: base.x + 3700, y: y0 + 2950, w: 70, h: 460 },       // down to the flight line
    { x: base.x + 1500, y: y0 + 2950, w: 70, h: 700 },       // training ground link
  ]) roads += paveRun(spur.x, spur.y, spur.w, spur.h);
  void roads;

  /* Painted markings. Purely visual, but this is most of what separates a car park from a
   * depot: bays with their noses on a line, a lane down the middle of the pool, a
   * marshalling box in front of each hall, and arrows where the traffic runs. */
  for (let i = 0; i < 9; i++) {
    markings.push({ x: base.x + 330, y: y0 + 2370 + i * 100, w: 150, h: 60, kind: 'bay' });
    markings.push({ x: base.x + 700, y: y0 + 2370 + i * 100, w: 150, h: 60, kind: 'bay' });
  }
  for (let i = 0; i < 6; i++) {
    markings.push({ x: base.x + 4500 + i * 330, y: y0 + 3660, w: 300, h: 150, kind: 'box' });   // flight line bays
    markings.push({ x: base.x + 2500 + i * 300, y: fieldY + 380, w: 260, h: 120, kind: 'box' }); // apron hardstands
  }
  markings.push({ x: base.x + 330, y: y0 + 2350, w: 520, h: 20, kind: 'lane' });
  markings.push({ x: CX - 40, y: base.y + 200, w: 80, h: 900, kind: 'arrow' });
  markings.push({ x: base.x + 2550, y: fieldY + 220, w: 6400, h: 12, kind: 'lane' });
  markings.push({ x: base.x + 2550, y: fieldY + 236, w: 6400, h: 12, kind: 'lane' });

  /* District fences: wire around everything that is worth stealing, exactly as the
   * reference photograph of a real base shows. Offset lines, gates left open toward the
   * road, and every run placed rather than stamped — a wire that lands in a building is
   * worse than no wire at all. */
  const fenceRun = (x: number, y: number, w: number, h: number) => place(x, y, w, h, 'fence', 30, '#7d8670');
  let wire = 0;
  for (const line of [
    { x: base.x + T + 16, y: y0 + 1420, w: 1120, h: 14 },      // fuel farm north
    { x: base.x + T + 16, y: y0 + 2120, w: 1120, h: 14 },      // fuel farm south
    { x: base.x + T + 16, y: y0 + 1420, w: 14, h: 714 },       // fuel farm west
    { x: base.x + base.w - 1180, y: y0 + 2240, w: 1140, h: 14 },  // magazine north
    { x: base.x + base.w - 1180, y: y0 + 2986, w: 1140, h: 14 },  // magazine south
    { x: base.x + 240, y: y0 + 3300, w: 1900, h: 14 },         // training ground north
    { x: base.x + 240, y: y0 + 4512, w: 1900, h: 14 },         // training ground south
    { x: base.x + 3000, y: fieldY + 316, w: 7000, h: 14 },     // airfield north edge
    { x: base.x + 150, y: y0 + 620, w: 1740, h: 14 },          // rotary park north
  ]) if (fenceRun(line.x, line.y, line.w, line.h)) wire++;

  /* ROAD CLEARANCE SWEEP.
   *
   * The carriageways are laid after the yards, so a crate stack or a truck that was standing
   * on ground which later became a road ended up parked in the middle of the lane. Anything
   * that is loose kit and now sits on tarmac is stepped off the kerb: the first nudge left,
   * right, up or down that is clear of both the road and everything else wins. Structures
   * are never moved — only the clutter that a real unit would have shifted anyway. */
  const overlapArea = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const roadZones = pavements.filter((z) => z.kind === 'road');
  const onRoad = (r: { x: number; y: number; w: number; h: number }) =>
    roadZones.some((z) => overlapArea(r, z) > r.w * r.h * 0.28);
  const clearOf = (me: Rect, x: number, y: number, w: number, h: number) => {
    for (const r of placed) {
      if (r === me || r.dead) continue;
      if (x + w + 8 <= r.x || x - 8 >= r.x + r.w) continue;
      if (y + h + 8 <= r.y || y - 8 >= r.y + r.h) continue;
      return false;
    }
    for (const z of roadZones) {
      if (x + w + 4 <= z.x || x - 4 >= z.x + z.w) continue;
      if (y + h + 4 <= z.y || y - 4 >= z.y + z.h) continue;
      return false;
    }
    return true;
  };
  /* GUN PITS STAND BESIDE THE ROAD, NOT IN IT.
   *
   * Two of the approach batteries were sited on the perimeter carriageway: their sandbag
   * walls straddled the tarmac and the mount sat in the traffic lane, which is exactly what
   * "the elements are arranged oddly" meant. Every emplacement whose footprint touches a
   * road is now stepped out to the nearest clear shoulder — walls and mount together, so it
   * stays one object — and whatever cannot be moved stays where it was rather than being
   * dropped into a building. */
  const pitBoxOf = (t: ArmyTurretSpot) => {
    const walls = t.pit || [];
    if (!walls.length) return t.pitBox;
    const xs = walls.map((r) => r.x), ys = walls.map((r) => r.y);
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      w: Math.max(...walls.map((r) => r.x + r.w)) - Math.min(...xs),
      h: Math.max(...walls.map((r) => r.y + r.h)) - Math.min(...ys),
    };
  };
  let repositioned = 0;
  for (const t of turrets) {
    const box = pitBoxOf(t);
    if (!box) continue;
    const onCarriageway = roadZones.some((z) => overlapArea(box, z) > 0);
    if (!onCarriageway) continue;
    const walls = t.pit || [];
    const mine = new Set<unknown>(walls);
    const fits = (dx: number, dy: number) => {
      const b = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
      // The approach outside the wire is fair ground for a battery: 800 px of it.
      if (b.x < base.x || b.y < base.y - 800 || b.x + b.w > base.x + base.w || b.y + b.h > base.y + base.h) return false;
      for (const z of roadZones) if (overlapArea(b, z) > 0) return false;
      for (const r of placed) {
        if (mine.has(r) || r.dead || r.kind === 'sandbag') continue;
        if (overlapArea(b, r) > 0) return false;
      }
      return true;
    };
    for (const [dx, dy] of [[0, -260], [0, 260], [-260, 0], [260, 0], [0, -420], [0, 420]]) {
      if (!fits(dx, dy)) continue;
      for (const r of walls) { r.x += dx; r.y += dy; }
      t.x += dx; t.y += dy;
      t.pitBox = pitBoxOf(t);
      repositioned++;
      break;
    }
  }

  let kerbed = 0;
  for (const r of placed) {
    if (!['crate', 'barrel', 'truck', 'tent', 'sandbag'].includes(r.kind)) continue;
    if (!onRoad(r)) continue;
    const step = Math.max(r.w, r.h) + 26;
    let done = false;
    const moves: [number, number][] = [];
    for (let k = 1; k <= 4; k++) {
      moves.push([0, -step * k], [0, step * k], [-step * k, 0], [step * k, 0]);
      if (k <= 2) moves.push([-step * k, -step], [step * k, -step], [-step * k, step], [step * k, step]);
    }
    for (const [dx, dy] of moves) {
      const nx = r.x + dx, ny = r.y + dy;
      if (nx < base.x + 40 || ny < base.y + 40 || nx + r.w > base.x + base.w - 40 || ny + r.h > base.y + base.h - 40) continue;
      if (!clearOf(r, nx, ny, r.w, r.h)) continue;
      r.x = nx; r.y = ny; done = true; break;
    }
    if (done) kerbed++;
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
  /* West cantonment: outside the west wire, on the training ground's side of the wall.
   * It used to stand at 8780 / 9500 — inside the blast wall, on the stores yard, in the
   * most heavily held part of the base. A soft target belongs outside the wire. */
  cantonment('cantonment-west', 'REPLACEMENT DEPOT',
    'A STORE HUT AND A GUARD WHO IS NOT PAYING ATTENTION', 900, 11600);

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
    strongpoints, guards, routes, stockade: stock, softTargets, loot, markings,
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
