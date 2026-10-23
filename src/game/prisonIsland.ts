import type { Rect, StructKind, Zone } from './world';

/**
 * PRISON ISLAND — THE CAGE.
 *
 * The theatre was WIDENED to the west instead of carving water out of the old map:
 * `PRISON_LAND_W` new metres of open sea and island were bolted onto the left edge, and
 * the whole legacy world (fortress, Goliath, air station, every facility) was shifted
 * east by exactly that amount. Nothing that existed before ever stands in water, and the
 * island sits in ground nobody else claimed.
 *
 * Layout, west to east:
 *   open sea → island (beach → plateau → walled compound) → causeway → mainland coast.
 * The sally port faces the mainland, so the approach is a straight road instead of a
 * pier that had to be found first.
 *
 * Coordinates here are final world coordinates (x 0 … PRISON_LAND_W is the new water).
 */

/** New ground added west of the legacy theatre. The legacy world moves east by this much. */
export const PRISON_LAND_W = 3600;

/** Open water: only inside the new strip, so it never covers a single legacy structure. */
export const SEA = { x: 0, y: 0, w: PRISON_LAND_W, h: 5000 };

/** Island footprint (beach) and the plateau the prison is built on. Read as ellipses. */
export const LAND = { x: 150, y: 390, w: 2900, h: 2600 };
export const PLATEAU = { x: 660, y: 880, w: 1900, h: 1680 };

/** Inside the sea wall: a big, airy compound with a wide yard. */
export const COMPOUND = { x: 700, y: 950, w: 1800, h: 1450 };

/** The sally port — east wall, facing the mainland. Walk in to enter the 3D prison. */
export const PRISON_DOOR = { x: 2500, y: 2000 };

/** Label anchor (the island's middle) and the surf radius around it. */
export const ISLAND = { x: 1600, y: 1900, r: 1450 };

/** Causeway across the last stretch of water, east of the island. */
export const CAUSEWAY = { x: 3050, y: 1880, w: 560, h: 240 };

export interface IslandLight { x: number; y: number; speed: number; sweep: number }

export function prisonIslandStructures(): { rects: Rect[]; zones: Zone[]; lights: IslandLight[] } {
  const rects: Rect[] = [];
  const zones: Zone[] = [];
  const lights: IslandLight[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: StructKind, tint?: string) =>
    rects.push({ x, y, w, h, kind, h3d: kind === 'wall' ? 96 : kind === 'tower' ? 150 : kind === 'keep' ? 128 : 52, tint });

  /* ---------------- water and land, drawn in that order ---------------- */
  zones.push({ x: SEA.x, y: SEA.y, w: SEA.w, h: SEA.h, kind: 'lagoon' });
  zones.push({ x: LAND.x, y: LAND.y, w: LAND.w, h: LAND.h, kind: 'sand' });
  zones.push({ x: PLATEAU.x, y: PLATEAU.y, w: PLATEAU.w, h: PLATEAU.h, kind: 'grass' });
  // Mainland shore: a sand band along the eastern edge of the water so the new coast
  // does not end in a ruler-straight line against the legacy ground.
  zones.push({ x: SEA.w - 40, y: 0, w: 250, h: SEA.h, kind: 'sand' });

  /* ---------------- the sea wall, with one wide gate facing the mainland ---------------- */
  const T = 36;
  const { x: cx0, y: cy0, w: cw, h: ch } = COMPOUND;
  const gateY = PRISON_DOOR.y;
  const gateHalf = 110;
  const eastX = cx0 + cw - T;
  add(cx0, cy0, cw, T, 'wall');                                            // north
  add(cx0, cy0 + ch - T, cw, T, 'wall');                                   // south
  add(cx0, cy0, T, ch, 'wall');                                            // west
  add(eastX, cy0, T, gateY - gateHalf - cy0, 'wall');                      // east, north of the gate
  add(eastX, gateY + gateHalf, T, cy0 + ch - (gateY + gateHalf), 'wall');   // east, south of the gate

  // Gate house: two lit bastions flanking the sally port.
  add(eastX - 30, gateY - gateHalf - 78, 120, 78, 'tower');
  add(eastX - 30, gateY + gateHalf, 120, 78, 'tower');
  lights.push({ x: eastX + 10, y: gateY - gateHalf - 39, speed: 0.9, sweep: 0.8 });
  lights.push({ x: eastX + 10, y: gateY + gateHalf + 39, speed: 0.9, sweep: 0.8 });

  /* ---------------- eight watchtowers along the wall ---------------- */
  const towers: [number, number][] = [
    [cx0 - 12, cy0 - 12], [cx0 + cw - 100, cy0 - 12],
    [cx0 - 12, cy0 + ch - 124], [cx0 + cw - 100, cy0 + ch - 124],
    [cx0 + cw / 2 - 44, cy0 - 14], [cx0 + cw / 2 - 44, cy0 + ch - 126],
    [cx0 - 14, cy0 + ch / 2 - 44], [cx0 + cw / 2 - 44, cy0 + ch / 2 - 44],
  ];
  for (const [tx, ty] of towers) {
    add(tx, ty, 88, 88, 'tower');
    lights.push({ x: tx + 44, y: ty + 44, speed: 0.55, sweep: 1.25 });
  }

  /* ---------------- the cell house and its outbuildings ---------------- */
  add(cx0 + 300, cy0 + 250, cw - 640, 620, 'keep');                      // main cell house
  add(cx0 + 180, cy0 + 930, 320, 190, 'bunker');                         // west administration wing
  add(cx0 + cw - 500, cy0 + 930, 320, 190, 'bunker');                    // east administration wing
  add(cx0 + cw / 2 - 150, cy0 + 930, 300, 120, 'warehouse');             // intake / processing hall
  add(cx0 + 150, cy0 + 180, 240, 150, 'barrack');                        // workshop A
  add(cx0 + 150, cy0 + 380, 240, 150, 'barrack');                        // workshop B
  add(cx0 + cw - 390, cy0 + 180, 240, 150, 'barrack');                   // laundry
  add(cx0 + cw - 390, cy0 + 380, 240, 150, 'barrack');                   // chapel
  add(cx0 + 70, cy0 + 620, 90, 90, 'checkpoint');                        // west gate post
  add(cx0 + cw - 160, cy0 + 620, 90, 90, 'checkpoint');                  // east gate post
  add(cx0 + 210, cy0 + 1180, 120, 90, 'armory');                         // armoury
  add(cx0 + cw - 330, cy0 + 1180, 120, 90, 'armory');                    // second armoury

  // Inner fence that splits the yard from the vehicle apron, with a gap on the gate axis.
  add(cx0 + 60, cy0 + 830, 620, 20, 'fence');
  add(cx0 + cw - 60 - 640, cy0 + 830, 640, 20, 'fence');

  /* ---------------- yard clutter: crates, drums, parked transports ---------------- */
  const yardBits: [number, number, StructKind][] = [
    [cx0 + 120, cy0 + 1040, 'crate'], [cx0 + 190, cy0 + 1040, 'crate'], [cx0 + 155, cy0 + 1105, 'crate'],
    [cx0 + cw - 220, cy0 + 1040, 'crate'], [cx0 + cw - 150, cy0 + 1040, 'crate'],
    [cx0 + 300, cy0 + 1290, 'truck'], [cx0 + 520, cy0 + 1290, 'truck'], [cx0 + 300, cy0 + 1420, 'truck'],
    [cx0 + cw - 400, cy0 + 1290, 'truck'], [cx0 + cw - 400, cy0 + 1420, 'truck'],
    [cx0 + 90, cy0 + 300, 'crate'], [cx0 + cw - 150, cy0 + 320, 'crate'],
    [cx0 + 90, cy0 + 520, 'crate'], [cx0 + cw - 150, cy0 + 540, 'crate'],
  ];
  for (const [bx, by, kind] of yardBits) add(bx, by, kind === 'truck' ? 96 : 62, kind === 'truck' ? 190 : 62, kind);

  // Parade ground in front of the cell house, and a helipad inside the walls.
  zones.push({ x: cx0 + 340, y: cy0 + 900, w: cw - 680, h: 220, kind: 'parade' });
  zones.push({ x: cx0 + cw / 2 - 150, y: cy0 + 1150, w: 300, h: 300, kind: 'helipad' });
  // Vehicle apron inside the gate.
  zones.push({ x: eastX - 340, y: gateY - 130, w: 340, h: 260, kind: 'concrete' });

  /* ---------------- shore rocks on the beach ---------------- */
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.35;
    const rx = LAND.x + LAND.w / 2 + Math.cos(a) * (LAND.w / 2 - 40);
    const ry = LAND.y + LAND.h / 2 + Math.sin(a) * (LAND.h / 2 - 40);
    add(rx - 24, ry - 20, 48 + (i % 3) * 14, 40 + (i % 4) * 10, 'crate');
  }

  /* ---------------- the approach, last so beach and grass cannot paint over it ---------------- */
  // Causeway rails across the water gap.
  add(CAUSEWAY.x, CAUSEWAY.y - 12, CAUSEWAY.w, 12, 'fence');
  add(CAUSEWAY.x, CAUSEWAY.y + CAUSEWAY.h, CAUSEWAY.w, 12, 'fence');
  zones.push({ x: CAUSEWAY.x, y: CAUSEWAY.y, w: CAUSEWAY.w, h: CAUSEWAY.h, kind: 'concrete' });
  // Road from the sally port across the island's east shoulder to the causeway.
  zones.push({ x: eastX, y: gateY - 120, w: CAUSEWAY.x + 20 - eastX, h: 240, kind: 'road' });

  return { rects, zones, lights };
}
