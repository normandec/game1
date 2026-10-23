import type { Rect, StructKind, Zone } from './world';

/**
 * ISLAND PRISON — THE CAGE (eastern expansion).
 *
 * The legacy theatre is 12000 × 8200 and is NEVER modified: every base, road, wall and
 * POI keeps the exact coordinate it always had. `PRISON_EAST` metres of brand-new ground
 * were added east of it, and the prison lives in that new space only:
 *
 *   legacy mainland (x ≤ 12000) → harbour + checkpoint → causeway bridge over the sea →
 *   forested island → walled compound with the sally port → 3D prison
 *
 * Everything here is expressed in final world coordinates, east of `LEGACY_W`.
 */

/** New ground added east of the legacy theatre (used by world.ts to widen the arena). */
export const PRISON_EAST = 5200;

/** East edge of the legacy map — the new ground starts here. */
export const LEGACY_W = 12000;

/** Open water filling the new ground, so the island is genuinely surrounded by sea. */
export const SEA = { x: 12480, y: 0, w: 4720, h: 8200 };

/** Mainland shelf: the beach and harbour on this side of the crossing. */
export const COAST = { x: 12000, y: 3450, w: 520, h: 1420 };
/** Concrete apron at the bridge head, so the crossing starts on solid ground. */
export const BRIDGEHEAD = { x: 12160, y: 3830, w: 420, h: 520 };

/** Island footprint (beach ring) and the grass plateau inside it. Read as ellipses. */
export const LAND = { x: 13840, y: 2520, w: 2680, h: 3160 };
export const PLATEAU = { x: 14180, y: 2860, w: 2060, h: 2500 };

/** The walled prison compound. The sally port faces the bridge. */
export const COMPOUND = { x: 14440, y: 3380, w: 1480, h: 1420 };

/** The gate itself — walk into it and the 3D prison opens. */
export const PRISON_DOOR = { x: 14440, y: 4075 };

/** Label anchor (island middle) and surf radius. */
export const ISLAND = { x: 15180, y: 4100, r: 1900 };

/** Causeway bridge from the mainland headland over the water to the island. */
export const BRIDGE = { x: 12460, y: 3930, w: 1520, h: 290 };

export interface IslandLight { x: number; y: number; speed: number; sweep: number }

/** Non-colliding detail: the gate arch, lamp posts, the harbour pier. */
export interface IslandDecor {
  kind: 'gatearch' | 'lamp' | 'pier' | 'flag';
  x: number; y: number; w: number; h: number;
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export function prisonIslandStructures(): {
  rects: Rect[]; zones: Zone[]; lights: IslandLight[];
  /** Garrison posts for the prison detail (custody officers). */
  policePosts: { x: number; y: number }[];
  /** Drawn but not collided: arch, lamps, pier, flagpole. */
  decor: IslandDecor[];
} {
  const rects: Rect[] = [];
  const zones: Zone[] = [];
  const lights: IslandLight[] = [];
  const policePosts: { x: number; y: number }[] = [];
  const decor: IslandDecor[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: StructKind, tint?: string) =>
    rects.push({ x, y, w, h, kind, h3d: kind === 'wall' ? 92 : kind === 'cellblock' ? 130 : kind === 'tower' || kind === 'bastion' ? 150 : kind === 'lighthouse' ? 210 : 54, tint });

  /* ---------------- water, coast and island ---------------- */
  zones.push({ x: SEA.x, y: SEA.y, w: SEA.w, h: SEA.h, kind: 'lagoon' });
  zones.push({ x: COAST.x, y: COAST.y, w: COAST.w, h: COAST.h, kind: 'sand' });
  zones.push({ x: BRIDGEHEAD.x, y: BRIDGEHEAD.y, w: BRIDGEHEAD.w, h: BRIDGEHEAD.h, kind: 'concrete' });
  zones.push({ x: LAND.x, y: LAND.y, w: LAND.w, h: LAND.h, kind: 'sand' });
  zones.push({ x: PLATEAU.x, y: PLATEAU.y, w: PLATEAU.w, h: PLATEAU.h, kind: 'lawn' });

  /* ---------------- the causeway: a lit crossing you actually walk ---------------- */
  const bx0 = BRIDGE.x, bx1 = BRIDGE.x + BRIDGE.w, byC = BRIDGE.y + BRIDGE.h / 2;
  add(bx0, BRIDGE.y - 16, BRIDGE.w, 16, 'fence');           // north parapet
  add(bx0, BRIDGE.y + BRIDGE.h, BRIDGE.w, 16, 'fence');      // south parapet
  for (let x = bx0 + 150; x < bx1 - 80; x += 320) {          // piers standing in the water
    add(x, BRIDGE.y - 110, 54, 92, 'pillar');
    add(x, BRIDGE.y + BRIDGE.h + 18, 54, 92, 'pillar');
  }
  // Lamp posts down both parapets — the bridge reads as a lit road at night.
  for (let x = bx0 + 90; x < bx1 - 40; x += 190) {
    decor.push({ kind: 'lamp', x, y: BRIDGE.y - 34, w: 16, h: 16 });
    decor.push({ kind: 'lamp', x, y: BRIDGE.y + BRIDGE.h + 18, w: 16, h: 16 });
  }
  // Checkpoint at the mainland head: a boom gate and two huts.
  add(bx0 - 120, BRIDGE.y - 96, 120, 110, 'checkpoint');
  add(bx0 - 120, BRIDGE.y + BRIDGE.h - 14, 120, 110, 'checkpoint');
  add(bx0 + 6, byC - 92, 12, 184, 'barrier');
  lights.push({ x: bx0 - 60, y: BRIDGE.y - 40, speed: 0.6, sweep: 0.9 });
  lights.push({ x: bx0 - 60, y: BRIDGE.y + BRIDGE.h + 40, speed: 0.6, sweep: 0.9 });
  // And one at the island end, so the gate is lit from the water side too.
  add(bx1 - 40, BRIDGE.y - 104, 120, 110, 'checkpoint');
  add(bx1 - 40, BRIDGE.y + BRIDGE.h - 6, 120, 110, 'checkpoint');

  /* ---------------- harbour on the mainland beach ---------------- */
  const marinaX = 12160, marinaY = 4380;
  add(marinaX - 40, marinaY - 40, 250, 90, 'checkpoint');      // harbour office
  decor.push({ kind: 'pier', x: marinaX + 120, y: marinaY + 40, w: 300, h: 34 });
  decor.push({ kind: 'pier', x: marinaX + 120, y: marinaY + 150, w: 300, h: 34 });
  // Boats moored alongside: dark hulls with a lit cabin.
  const boats: [number, number, number][] = [
    [12540, 4360, 0.2], [12540, 4478, -0.14], [12690, 4330, 0.05],
    [12690, 4482, 0.22], [12820, 4388, -0.1], [12730, 4630, 0.3],
  ];
  for (const [bx, by, rot] of boats) add(bx, by, 74, 26, 'boat', rot.toFixed(2));

  /* ---------------- the island: rocks, forest, lighthouse ---------------- */
  const icx = LAND.x + LAND.w / 2, icy = LAND.y + LAND.h / 2;
  const rx = LAND.w / 2, ry = LAND.h / 2;
  // Rocky shoreline: a broken ring of boulders just on the waterline.
  for (let i = 0; i < 74; i++) {
    const a = (i / 74) * Math.PI * 2 + 0.17;
    const wob = 1 + Math.sin(a * 3 + 0.7) * 0.035 + Math.sin(a * 7 + 2.1) * 0.022;
    const x = icx + Math.cos(a) * rx * wob;
    const y = icy + Math.sin(a) * ry * wob;
    if (Math.abs(y - byC) < 190 && x < icx) continue;         // keep the bridge landing clear
    const s = 34 + hash(i) * 30;
    add(x - s / 2, y - s / 2, s, s * 0.8, 'rock');
  }
  // Forest belt: pines between the compound and the shore, plus clusters on the slopes.
  const treeOk = (x: number, y: number) => {
    const ex = (x - icx) / rx, ey = (y - icy) / ry;
    if (ex * ex + ey * ey > 0.94) return false;               // stay off the rocks
    if (Math.abs(y - byC) < 150 && x < icx - 200) return false; // the road up from the bridge
    if (x > COMPOUND.x - 74 && x < COMPOUND.x + COMPOUND.w + 74
        && y > COMPOUND.y - 74 && y < COMPOUND.y + COMPOUND.h + 74) return false;
    return true;
  };
  for (let i = 0; i < 280; i++) {
    const a = hash(i * 3.1) * Math.PI * 2;
    const r = 0.62 + hash(i * 7.7) * 0.34;
    const x = icx + Math.cos(a) * rx * r;
    const y = icy + Math.sin(a) * ry * r;
    if (!treeOk(x, y)) continue;
    const s = 54 + hash(i * 5.3) * 46;
    add(x - s / 2, y - s / 2, s, s, 'pine');
  }
  // A second, denser ring right behind the beach.
  for (let i = 0; i < 170; i++) {
    const a = hash(i * 11.3) * Math.PI * 2;
    const r = 0.84 + hash(i * 2.9) * 0.1;
    const x = icx + Math.cos(a) * rx * r;
    const y = icy + Math.sin(a) * ry * r;
    if (!treeOk(x, y)) continue;
    const s = 46 + hash(i * 4.1) * 40;
    add(x - s / 2, y - s / 2, s, s, 'pine');
  }

  // Lighthouse on the north shoulder, on its own rock shelf.
  const lh = { x: 15640, y: 2820 };
  add(lh.x - 120, lh.y - 70, 250, 190, 'rock');
  add(lh.x - 40, lh.y - 40, 84, 84, 'lighthouse');
  lights.push({ x: lh.x, y: lh.y, speed: 1.7, sweep: 2.1 });
  decor.push({ kind: 'flag', x: 14720, y: 3620, w: 10, h: 10 });

  /* ---------------- the compound: walls, bastions, gate ---------------- */
  const T = 46;
  const { x: cx0, y: cy0, w: cw, h: ch } = COMPOUND;
  const gateY = PRISON_DOOR.y;
  const gateHalf = 120;
  const westX = cx0;
  const WALL_TINT = '#59635a';
  add(cx0, cy0, cw, T, 'wall', WALL_TINT);                                         // north
  add(cx0, cy0 + ch - T, cw, T, 'wall', WALL_TINT);                                // south
  add(cx0 + cw - T, cy0, T, ch, 'wall', WALL_TINT);                                // east
  add(westX, cy0, T, gateY - gateHalf - cy0, 'wall', WALL_TINT);                   // west, north of the gate
  add(westX, gateY + gateHalf, T, cy0 + ch - (gateY + gateHalf), 'wall', WALL_TINT); // west, south of the gate

  // Round bastions on the four corners, like the reference plan.
  const corners: [number, number][] = [
    [cx0, cy0], [cx0 + cw, cy0], [cx0, cy0 + ch], [cx0 + cw, cy0 + ch],
  ];
  for (const [x, y] of corners) {
    add(x - 62, y - 62, 124, 124, 'bastion');
    lights.push({ x, y, speed: 0.5, sweep: 1.15 });
  }
  // Two towers per long wall, evenly spaced.
  for (const x of [cx0 + cw * 0.34, cx0 + cw * 0.68]) {
    add(x - 38, cy0 - 26, 76, 76, 'tower');
    add(x - 38, cy0 + ch - 50, 76, 76, 'tower');
    lights.push({ x, y: cy0 + 8, speed: 0.7, sweep: 1.05 });
    lights.push({ x, y: cy0 + ch - 8, speed: 0.7, sweep: 1.05 });
  }
  // Gate house: two bastions flanking the sally port, and a lantern over it.
  add(westX - 110, gateY - gateHalf - 104, 110, 104, 'tower', '#5d675d');
  add(westX - 110, gateY + gateHalf, 110, 104, 'tower', '#5d675d');
  decor.push({ kind: 'gatearch', x: westX - 150, y: gateY - gateHalf, w: 190, h: gateHalf * 2 });
  lights.push({ x: westX - 40, y: gateY - gateHalf - 50, speed: 0.9, sweep: 0.85 });
  lights.push({ x: westX - 40, y: gateY + gateHalf + 50, speed: 0.9, sweep: 0.85 });

  /* ---------------- inside the walls ---------------- */
  // Two long cell blocks, the way a real prison is laid out.
  add(14620, 3500, 1140, 200, 'cellblock');
  add(14620, 4460, 1140, 200, 'cellblock');
  // Administration block and the guard house, either side of the entrance corridor.
  add(14520, 3760, 300, 190, 'warehouse');
  add(14520, 4200, 300, 190, 'checkpoint');
  // Chapel and workshop on the yard's east side.
  add(15360, 3800, 240, 170, 'warehouse');
  add(15360, 4200, 240, 170, 'armory');
  // Exercise cages along the south wall.
  add(14980, 4700, 300, 16, 'fence');
  add(15280, 4700, 300, 16, 'fence');
  add(14980, 4700, 16, 120, 'fence');
  add(15264, 4700, 16, 120, 'fence');

  // Ground inside: the yard, the corridor from the gate, the service lane.
  zones.push({ x: cx0 + T, y: cy0 + T, w: cw - T * 2, h: ch - T * 2, kind: 'concrete' });
  zones.push({ x: 14860, y: 3770, w: 960, h: 620, kind: 'lawn' });
  zones.push({ x: 15060, y: 3990, w: 220, h: 220, kind: 'helipad' });
  zones.push({ x: 15480, y: cy0 + T, w: 300, h: ch - T * 2, kind: 'concrete' });

  // Yard furniture: a handful of transports and crates, kept off the walking lines.
  const yardBits: [number, number, StructKind][] = [
    [14700, 4310, 'truck'], [14810, 4310, 'truck'], [14700, 4310 + 130, 'truck'],
    [15760, 3980, 'truck'], [15760, 4110, 'truck'],
    [14680, 3720, 'crate'], [14740, 3720, 'crate'],
    [15660, 4380, 'crate'], [15730, 4380, 'crate'],
  ];
  for (const [bx, by, kind] of yardBits) add(bx, by, kind === 'truck' ? 96 : 52, kind === 'truck' ? 190 : 52, kind);
  // Lamps along the yard so the compound is lit at night.
  for (const [lx, ly] of [[14880, 3800], [15660, 3800], [14880, 4350], [15660, 4350], [15280, 4075]] as const) {
    decor.push({ kind: 'lamp', x: lx, y: ly, w: 18, h: 18 });
  }

  /* ---------------- the detail: custody officers, visible from the bridge ---------------- */
  policePosts.push(
    // mainland checkpoint
    { x: 12420, y: 3980 }, { x: 12420, y: 4170 },
    // bridge, in pairs down both sides
    { x: 13000, y: 4000 }, { x: 13000, y: 4150 },
    { x: 13600, y: 4000 }, { x: 13600, y: 4150 },
    // island head and forecourt
    { x: 14160, y: 3990 }, { x: 14160, y: 4160 },
    { x: 14300, y: 3960 }, { x: 14300, y: 4190 },
    // at the sally port
    { x: 14410, y: 4010 }, { x: 14410, y: 4140 },
    // inside the walls
    { x: 14700, y: 4075 }, { x: 15020, y: 3820 },
    { x: 15400, y: 4320 }, { x: 14900, y: 4340 },
  );

  /* ---------------- roads last, so beach and grass cannot paint over them ---------------- */
  // Bridge deck.
  zones.push({ x: BRIDGE.x, y: BRIDGE.y, w: BRIDGE.w, h: BRIDGE.h, kind: 'road' });
  // Island approach: bridge head → forecourt → sally port.
  zones.push({ x: 13880, y: byC - 100, w: (westX - 110) - 13880, h: 200, kind: 'road' });
  // Through the gate and into the compound.
  zones.push({ x: westX - 100, y: byC - 74, w: 520, h: 148, kind: 'road' });
  // Compound spine, north to south.
  zones.push({ x: 15240, y: cy0 + T, w: 96, h: ch - T * 2, kind: 'road' });
  // Mainland approach road along the beach.
  zones.push({ x: 11700, y: byC - 100, w: 640, h: 200, kind: 'road' });
  // Harbour lane.
  zones.push({ x: 12060, y: byC + 90, w: 260, h: 620, kind: 'road' });

  return { rects, zones, lights, policePosts, decor };
}
