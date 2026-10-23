import type { Rect, StructKind, Zone } from './world';

/**
 * PRISON ISLAND — the flooded north-west corner of every sector.
 *
 * Everything here is additive: the lagoon is a new zone kind drawn UNDER the existing
 * world, so every structure that already stood in that corner keeps its collision,
 * its loot and its garrison. Nothing from the original map is removed or moved.
 */

export const LAGOON = { x: 0, y: 0, w: 3000, h: 2160 };

/** Rocky island that carries the prison compound, with a pier reaching into the water. */
export const ISLAND = { x: 1180, y: 980, r: 760 };

/** Where the operative lands after walking the pier: the only door into the 3D prison. */
export const PRISON_DOOR = { x: 1180, y: 1692 };

/** Compound footprint (inside the sea wall). */
export const COMPOUND = { x: 760, y: 470, w: 840, h: 900 };

export interface IslandLight { x: number; y: number; speed: number; sweep: number }

export function prisonIslandStructures(): { rects: Rect[]; zones: Zone[]; lights: IslandLight[] } {
  const rects: Rect[] = [];
  const zones: Zone[] = [];
  const lights: IslandLight[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: StructKind, tint?: string) =>
    rects.push({ x, y, w, h, kind, h3d: kind === 'wall' ? 96 : kind === 'tower' ? 150 : kind === 'keep' ? 128 : 52, tint });

  // ---- the lagoon -------------------------------------------------------
  zones.push({ x: LAGOON.x, y: LAGOON.y, w: LAGOON.w, h: LAGOON.h, kind: 'lagoon' });
  // Beach shelf and the rock the compound sits on.
  zones.push({ x: ISLAND.x - ISLAND.r - 60, y: ISLAND.y - ISLAND.r - 60, w: (ISLAND.r + 60) * 2, h: (ISLAND.r + 60) * 2, kind: 'sand' });
  zones.push({ x: COMPOUND.x - 40, y: COMPOUND.y - 40, w: COMPOUND.w + 80, h: COMPOUND.h + 120, kind: 'concrete' });

  // ---- sea wall: four sides with a gate gap facing the pier ------------
  const T = 34;                    // wall thickness
  const { x: cx0, y: cy0, w: cw, h: ch } = COMPOUND;
  const gateHalf = 70;
  const southY = cy0 + ch - T;
  const gateX = cx0 + cw / 2;
  add(cx0, cy0, cw, T, 'wall');                                   // north
  add(cx0, cy0, T, ch, 'wall');                                   // west
  add(cx0 + cw - T, cy0, T, ch, 'wall');                          // east
  add(cx0, southY, gateX - gateHalf - cx0, T, 'wall');            // south-west of the gate
  add(gateX + gateHalf, southY, cx0 + cw - (gateX + gateHalf), T, 'wall'); // south-east of the gate

  // ---- eight watchtowers ----------------------------------------------
  const towers: [number, number][] = [
    [cx0 - 10, cy0 - 10], [cx0 + cw - 92, cy0 - 10],
    [cx0 - 10, cy0 + ch - 120], [cx0 + cw - 92, cy0 + ch - 120],
    [cx0 + cw / 2 - 41, cy0 - 12], [cx0 + cw / 2 - 41, cy0 + ch - 122],
    [cx0 - 12, cy0 + ch / 2 - 41], [cx0 + cw - 104, cy0 + ch / 2 - 41],
  ];
  for (const [tx, ty] of towers) {
    add(tx, ty, 92, 92, 'tower');
    lights.push({ x: tx + 46, y: ty + 46, speed: 0.55, sweep: 1.25 });
  }

  // ---- the cell house itself (big, blind facade) ----------------------
  add(cx0 + 150, cy0 + 170, cw - 300, ch - 380, 'keep');
  // administrative wing grafted onto it
  add(cx0 + 120, cy0 + ch - 260, 210, 150, 'bunker');
  add(cx0 + cw - 330, cy0 + ch - 260, 210, 150, 'bunker');

  // ---- pier out into the lagoon ---------------------------------------
  const pierTop = cy0 + ch + T;
  add(PRISON_DOOR.x - 46, pierTop, 92, PRISON_DOOR.y - pierTop + 60, 'wall');
  add(PRISON_DOOR.x - 78, PRISON_DOOR.y + 30, 156, 40, 'bunker');
  // approach causeway from the beach
  zones.push({ x: PRISON_DOOR.x - 60, y: pierTop, w: 120, h: PRISON_DOOR.y - pierTop, kind: 'road' });

  // ---- scattered rocks and a few supply crates on the shore -----------
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    const rr = ISLAND.r - 40;
    add(ISLAND.x + Math.cos(a) * rr, ISLAND.y + Math.sin(a) * rr * 0.82, 46 + (i % 3) * 16, 38 + (i % 4) * 12, 'crate');
  }

  return { rects, zones, lights };
}
