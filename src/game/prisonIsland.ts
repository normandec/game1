import type { Rect, StructKind, Zone } from './world';

/**
 * PRISON ISLAND — THE CAGE (eastern expansion).
 *
 * The legacy theatre is 12000 × 8200 and is NEVER modified: every base, road, wall and
 * POI keeps the exact coordinate it always had. `PRISON_EAST` metres of brand-new ground
 * were added east of it, and the prison lives in that new space only:
 *
 *   legacy mainland (x ≤ 12000) → coastal shelf → open water → causeway bridge →
 *   island → forecourt → the prison's gate → 3D prison
 *
 * Everything here is expressed in final world coordinates, east of `LEGACY_W`.
 */

/** New ground added east of the legacy theatre (used by world.ts to widen the arena). */
export const PRISON_EAST = 5200;

/** East edge of the legacy map — the coastal shelf starts here. */
export const LEGACY_W = 12000;

/** Open water filling the new ground, so the island is genuinely surrounded by sea. */
export const SEA = { x: 12500, y: 0, w: 4700, h: 8200 };

/** Coastal shelf: dry land bridging the legacy map and the bridge head. */
export const COAST = { x: LEGACY_W - 80, y: 3820, w: 600, h: 510 };
/** Apron at the bridge head, so the crossing starts on solid ground. */
export const BRIDGEHEAD = { x: LEGACY_W - 40, y: 3760, w: 480, h: 630 };

/** Island footprint (beach) and its plateau. Both are read as ellipses. */
export const LAND = { x: 13980, y: 2320, w: 2420, h: 3580 };
export const PLATEAU = { x: 14240, y: 2600, w: 1900, h: 3020 };

/** The prison compound: a big walled complex with the gate facing the bridge. */
export const COMPOUND = { x: 14550, y: 3400, w: 1600, h: 1350 };

/** The gate itself — walk into it and the 3D prison opens. */
export const PRISON_DOOR = { x: 14550, y: 4075 };

/** Label anchor (island middle) and surf radius. */
export const ISLAND = { x: 15190, y: 4100, r: 1800 };

/** Causeway bridge from the mainland shelf over the water to the island. */
export const BRIDGE = { x: 12440, y: 3940, w: 1700, h: 290 };

export interface IslandLight { x: number; y: number; speed: number; sweep: number }

export function prisonIslandStructures(): {
  rects: Rect[]; zones: Zone[]; lights: IslandLight[];
  /** Garrison posts for the prison detail (custody officers). */
  policePosts: { x: number; y: number }[];
} {
  const rects: Rect[] = [];
  const zones: Zone[] = [];
  const lights: IslandLight[] = [];
  const policePosts: { x: number; y: number }[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: StructKind, tint?: string) =>
    rects.push({ x, y, w, h, kind, h3d: kind === 'wall' ? 96 : kind === 'tower' ? 150 : kind === 'keep' ? 128 : 52, tint });

  /* ---------------- water, coast and island ---------------- */
  zones.push({ x: SEA.x, y: SEA.y, w: SEA.w, h: SEA.h, kind: 'lagoon' });
  zones.push({ x: COAST.x, y: COAST.y, w: COAST.w, h: COAST.h, kind: 'sand' });
  zones.push({ x: BRIDGEHEAD.x, y: BRIDGEHEAD.y, w: BRIDGEHEAD.w, h: BRIDGEHEAD.h, kind: 'concrete' });
  zones.push({ x: LAND.x, y: LAND.y, w: LAND.w, h: LAND.h, kind: 'sand' });
  zones.push({ x: PLATEAU.x, y: PLATEAU.y, w: PLATEAU.w, h: PLATEAU.h, kind: 'grass' });

  /* ---------------- the bridge: a real crossing you walk over ---------------- */
  const bx0 = BRIDGE.x, bx1 = BRIDGE.x + BRIDGE.w, byC = BRIDGE.y + BRIDGE.h / 2;
  add(bx0, BRIDGE.y - 14, BRIDGE.w, 14, 'fence');            // north railing
  add(bx0, BRIDGE.y + BRIDGE.h, BRIDGE.w, 14, 'fence');       // south railing
  for (let x = bx0 + 120; x < bx1 - 60; x += 400) {           // piers, outside the deck
    add(x, BRIDGE.y - 96, 60, 82, 'pillar');
    add(x, BRIDGE.y + BRIDGE.h + 14, 60, 82, 'pillar');
    lights.push({ x, y: BRIDGE.y - 60, speed: 0.5, sweep: 0.9 });
  }
  // Bridge heads: guard houses at both ends, so the crossing reads as a checkpoint.
  add(bx0 - 70, BRIDGE.y - 90, 70, 120, 'checkpoint');
  add(bx0 - 70, BRIDGE.y + BRIDGE.h - 30, 70, 120, 'checkpoint');
  add(bx1 - 10, BRIDGE.y - 90, 70, 120, 'checkpoint');
  add(bx1 - 10, BRIDGE.y + BRIDGE.h - 30, 70, 120, 'checkpoint');
  // Bridge checkpoints: the detail stands on the walkway shoulders, not in the lane.
  policePosts.push(
    { x: bx0 + 60, y: byC - 210 }, { x: bx0 + 60, y: byC + 210 },
    { x: bx1 - 120, y: byC - 220 }, { x: bx1 - 120, y: byC + 220 },
  );

  /* ---------------- the compound walls, with the gate facing the bridge ---------------- */
  const T = 42;
  const { x: cx0, y: cy0, w: cw, h: ch } = COMPOUND;
  const gateY = PRISON_DOOR.y;
  const gateHalf = 115;
  const westX = cx0;
  add(cx0, cy0, cw, T, 'wall');                                     // north
  add(cx0, cy0 + ch - T, cw, T, 'wall');                            // south
  add(cx0 + cw - T, cy0, T, ch, 'wall');                            // east
  add(westX, cy0, T, gateY - gateHalf - cy0, 'wall');               // west, north of the gate
  add(westX, gateY + gateHalf, T, cy0 + ch - (gateY + gateHalf), 'wall'); // west, south of the gate

  // Gate house: two tall bastions flanking the sally port.
  add(westX - 90, gateY - gateHalf - 90, 130, 90, 'tower');
  add(westX - 90, gateY + gateHalf, 130, 90, 'tower');
  lights.push({ x: westX - 30, y: gateY - gateHalf - 45, speed: 0.9, sweep: 0.85 });
  lights.push({ x: westX - 30, y: gateY + gateHalf + 45, speed: 0.9, sweep: 0.85 });

  /* ---------------- eight watchtowers ---------------- */
  const towers: [number, number][] = [
    [cx0 - 14, cy0 - 14], [cx0 + cw - 100, cy0 - 14],
    [cx0 - 14, cy0 + ch - 126], [cx0 + cw - 100, cy0 + ch - 126],
    [cx0 + cw / 2 - 44, cy0 - 16], [cx0 + cw / 2 - 44, cy0 + ch - 128],
    [cx0 + cw / 2 - 44, cy0 + ch / 3 - 44], [cx0 + cw / 2 - 44, cy0 + (ch * 2) / 3 - 44],
  ];
  for (const [tx, ty] of towers) {
    add(tx, ty, 88, 88, 'tower');
    lights.push({ x: tx + 44, y: ty + 44, speed: 0.55, sweep: 1.25 });
  }

  /* ---------------- the prison itself: one big, readable building ---------------- */
  // Main cell house: the mass you see from the bridge.
  add(cx0 + 250, cy0 + 210, cw - 500, 620, 'keep');
  // Service wings that make the facade read as a government complex.
  add(cx0 + 150, cy0 + 900, 380, 230, 'bunker');
  add(cx0 + cw - 530, cy0 + 900, 380, 230, 'bunker');
  add(cx0 + cw / 2 - 170, cy0 + 900, 340, 150, 'warehouse');      // intake / processing
  // Inner yard, fence with a gate on the axis, and the workshops behind it.
  add(cx0 + 60, cy0 + 830, 560, 20, 'fence');
  add(cx0 + cw - 60 - 560, cy0 + 830, 560, 20, 'fence');
  add(cx0 + 90, cy0 + 180, 200, 120, 'barrack');
  add(cx0 + cw - 290, cy0 + 180, 200, 120, 'barrack');
  add(cx0 + 80, cy0 + 1180, 120, 90, 'armory');
  add(cx0 + cw - 200, cy0 + 1180, 120, 90, 'armory');

  // Forecourt in front of the gate: where the detail musters.
  zones.push({ x: westX - 420, y: gateY - 330, w: 420, h: 660, kind: 'concrete' });
  zones.push({ x: cx0 + 300, y: cy0 + 880, w: cw - 600, h: 200, kind: 'parade' });
  zones.push({ x: cx0 + cw / 2 - 150, y: cy0 + 1150, w: 300, h: 300, kind: 'helipad' });

  // Yard clutter: crates, transports, drums.
  const yardBits: [number, number, StructKind][] = [
    [cx0 + 120, cy0 + 1000, 'crate'], [cx0 + 190, cy0 + 1000, 'crate'], [cx0 + 155, cy0 + 1065, 'crate'],
    [cx0 + cw - 220, cy0 + 1000, 'crate'], [cx0 + cw - 150, cy0 + 1000, 'crate'],
    [cx0 + 330, cy0 + 1230, 'truck'], [cx0 + 540, cy0 + 1230, 'truck'], [cx0 + 330, cy0 + 1300, 'truck'],
    [cx0 + cw - 420, cy0 + 1230, 'truck'], [cx0 + cw - 420, cy0 + 1300, 'truck'],
    [cx0 + 100, cy0 + 380, 'crate'], [cx0 + cw - 160, cy0 + 400, 'crate'],
  ];
  for (const [bx, by, kind] of yardBits) add(bx, by, kind === 'truck' ? 96 : 62, kind === 'truck' ? 190 : 62, kind);

  /* ---------------- the prison detail ---------------- */
  policePosts.push(
    { x: westX - 200, y: gateY - 180 }, { x: westX - 200, y: gateY + 180 },
    { x: westX - 330, y: gateY }, { x: westX - 120, y: gateY },
    { x: cx0 + cw / 2, y: gateY + 120 }, { x: cx0 + cw / 2 + 180, y: gateY - 140 },
  );

  /* ---------------- shore rocks ---------------- */
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.3;
    const rx = LAND.x + LAND.w / 2 + Math.cos(a) * (LAND.w / 2 - 36);
    const ry = LAND.y + LAND.h / 2 + Math.sin(a) * (LAND.h / 2 - 36);
    add(rx - 26, ry - 22, 52 + (i % 3) * 14, 44 + (i % 4) * 10, 'crate');
  }

  /* ---------------- roads last, so beach and grass cannot paint over them ---------------- */
  // Mainland approach along the coast.
  zones.push({ x: LEGACY_W - 520, y: byC - 150, w: (COAST.x + COAST.w) - (LEGACY_W - 520), h: 300, kind: 'road' });
  // Bridge deck.
  zones.push({ x: BRIDGE.x, y: BRIDGE.y, w: BRIDGE.w, h: BRIDGE.h, kind: 'road' });
  // Island road from the bridge head to the forecourt.
  zones.push({ x: bx1 - 20, y: byC - 150, w: (westX - 420) - (bx1 - 20), h: 300, kind: 'road' });

  return { rects, zones, lights, policePosts };
}
