import type { Rect, StructKind, Zone } from './world';

/**
 * PRISON ISLAND — THE CAGE.
 *
 * The theatre was WIDENED to the west instead of carving water out of the old map:
 * `PRISON_LAND_W` new metres of open sea and island were bolted onto the left edge, and
 * the whole legacy world (fortress, Goliath, air station, every facility) was shifted
 * east by exactly that amount. Nothing that existed before ever stands in water, and the
 * island sits in land nobody else claimed.
 *
 * Coordinates here are final world coordinates (x 0 … PRISON_LAND_W is the new coast).
 */

/** New ground added west of the legacy theatre. The legacy world moves east by this much. */
export const PRISON_LAND_W = 3600;

/** Open water: only inside the new strip, so it never covers a single legacy structure. */
export const SEA = { x: 0, y: 0, w: PRISON_LAND_W, h: 5000 };

/** Beach shelf that carries the island, and the plateau the prison is built on. */
export const LAND = { x: 180, y: 560, w: 2960, h: 3480 };
export const PLATEAU = { x: 420, y: 800, w: 2480, h: 3000 };

/** Inside the sea wall: a big, airy compound with a wide apron. */
export const COMPOUND = { x: 700, y: 950, w: 1800, h: 1450 };

/** The sally port — where the operative walks into the 3D prison. */
export const PRISON_DOOR = { x: 1600, y: 2432 };

/** Label / bearing anchor and surf ring centre. */
export const ISLAND = { x: 1640, y: 2100, r: 1400 };

/** Causeway from the mainland: the road reaches the island's south-east shoulder. */
export const CAUSEWAY = { x: 3140, y: 3180, w: 560, h: 240 };

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
  // Beach strip that hides the seam at the south end of the water.
  zones.push({ x: 0, y: SEA.h - 120, w: PRISON_LAND_W, h: 420, kind: 'sand' });

  /* ---------------- the approach: gate → south apron → causeway ---------------- */
  zones.push({ x: 1480, y: 2400, w: 240, h: 900, kind: 'road' });            // gate to the apron
  zones.push({ x: 1480, y: 3180, w: 3400, h: 240, kind: 'road' });            // apron east into the mainland
  zones.push({ x: CAUSEWAY.x, y: CAUSEWAY.y, w: CAUSEWAY.w, h: CAUSEWAY.h, kind: 'concrete' });
  // Causeway rails, only across the water gap.
  add(CAUSEWAY.x, CAUSEWAY.y - 12, CAUSEWAY.w, 12, 'fence');
  add(CAUSEWAY.x, CAUSEWAY.y + CAUSEWAY.h, CAUSEWAY.w, 12, 'fence');

  /* ---------------- sea wall with one wide gate on the south ---------------- */
  const T = 36;
  const { x: cx0, y: cy0, w: cw, h: ch } = COMPOUND;
  const gateX = PRISON_DOOR.x;
  const gateHalf = 110;
  const southY = cy0 + ch - T;
  add(cx0, cy0, cw, T, 'wall');                                          // north
  add(cx0, cy0, T, ch, 'wall');                                          // west
  add(cx0 + cw - T, cy0, T, ch, 'wall');                                 // east
  add(cx0, southY, gateX - gateHalf - cx0, T, 'wall');                   // south, west of the gate
  add(gateX + gateHalf, southY, cx0 + cw - (gateX + gateHalf), T, 'wall'); // south, east of the gate

  // Gate house: two lit bastions flanking the sally port.
  add(gateX - gateHalf - 70, southY - 60, 70, 130, 'tower');
  add(gateX + gateHalf, southY - 60, 70, 130, 'tower');
  lights.push({ x: gateX - gateHalf - 35, y: southY - 60, speed: 0.9, sweep: 0.8 });
  lights.push({ x: gateX + gateHalf + 35, y: southY - 60, speed: 0.9, sweep: 0.8 });

  /* ---------------- eight watchtowers along the wall ---------------- */
  const towers: [number, number][] = [
    [cx0 - 12, cy0 - 12], [cx0 + cw - 100, cy0 - 12],
    [cx0 - 12, cy0 + ch - 124], [cx0 + cw - 100, cy0 + ch - 124],
    [cx0 + cw / 2 - 44, cy0 - 14], [cx0 + cw / 2 - 44, cy0 + ch - 126],
    [cx0 - 14, cy0 + ch / 2 - 44], [cx0 + cw - 102, cy0 + ch / 2 - 44],
  ];
  for (const [tx, ty] of towers) {
    add(tx, ty, 88, 88, 'tower');
    lights.push({ x: tx + 44, y: ty + 44, speed: 0.55, sweep: 1.25 });
  }

  /* ---------------- the cell house and its outbuildings ---------------- */
  add(cx0 + 240, cy0 + 250, cw - 480, 620, 'keep');                      // main cell house
  add(cx0 + 180, cy0 + 930, 320, 190, 'bunker');                         // west administration wing
  add(cx0 + cw - 500, cy0 + 930, 320, 190, 'bunker');                    // east administration wing
  add(cx0 + cw / 2 - 150, cy0 + 930, 300, 120, 'warehouse');             // intake / processing hall
  add(cx0 + 210, cy0 + 1180, 120, 90, 'armory');                         // armoury
  add(cx0 + cw - 330, cy0 + 1180, 120, 90, 'armory');                    // second armoury

  // Inner fence that splits the yard from the vehicle apron, with a gap on the gate axis.
  add(cx0 + 60, cy0 + 830, 620, 20, 'fence');
  add(gateX + 130, cy0 + 830, cx0 + cw - (gateX + 130) - 60, 20, 'fence');

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

  // Parade ground in front of the cell house.
  zones.push({ x: cx0 + 340, y: cy0 + 900, w: cw - 680, h: 220, kind: 'parade' });
  // Vehicle apron outside the gate.
  zones.push({ x: gateX - 300, y: southY + T, w: 600, h: 240, kind: 'concrete' });
  // Approach road leading north from the causeway to the gate.
  zones.push({ x: gateX - 120, y: southY - 260, w: 240, h: 260, kind: 'road' });

  /* ---------------- shore rocks and a couple of supply crates on the beach ---------------- */
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.35;
    const rx = LAND.x + LAND.w / 2 + Math.cos(a) * (LAND.w / 2 - 40);
    const ry = LAND.y + LAND.h / 2 + Math.sin(a) * (LAND.h / 2 - 40);
    add(rx - 24, ry - 20, 48 + (i % 3) * 14, 40 + (i % 4) * 10, 'crate');
  }

  return { rects, zones, lights };
}
