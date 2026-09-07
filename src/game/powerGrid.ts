/* ------------------------------------------------------------------ *
 * IRON VEIL — Power grid & defended generator/server complexes
 *
 * One parametric builder used by every important base: HQ, the air
 * station, Goliath logistics and the HELIOS sector plant. A yard is a
 * real facility (walls, gates, roofed server hall, generator rows,
 * switchgear, cable trenches, cooling plant, floodlights, motor pool,
 * guard posts and perimeter patrols) plus the PowerCells the engine
 * already knows how to shoot, explode and black out.
 * ------------------------------------------------------------------ */

import type { Rect, Zone, PoiDef, StructKind } from './world';
import type { Facility, FacilityGuard, PostRole } from './facilities';
import type { PatrolRoute } from './campaignSites';
import type { Point } from './navigation';

/** A generating site. `major` sites are the sector grid; the rest are local yards. */
export interface PowerSite {
  id: string; name: string; code: string;
  x: number; y: number; w: number; h: number;
  major: boolean;
}

/** Destructible generator / server block. `site` links it to its yard. */
export interface PowerCell extends Point {
  id: string; kind: 'generator' | 'server';
  hp: number; maxHp: number; dead: boolean;
  site: string;
}

export interface SpotlightSpot { x: number; y: number; speed: number; sweep: number; site?: string }
export interface VanSpot { x: number; y: number; ang: number }

export interface PowerYardContext {
  sector: number;
  rects: Rect[];
  zones: Zone[];
  facilities: Facility[];
  guards: FacilityGuard[];
  gates: Point[];
  caches: Point[];
  lights: SpotlightSpot[];
  barrels: Point[];
  vans: VanSpot[];
  patrols: PatrolRoute[];
  pois: PoiDef[];
  garrison: Point[];
}

export interface PowerYardOptions {
  id: string; name: string; code: string;
  cx: number; cy: number;
  generators: number;
  servers: number;
  /** Extra defenders beyond the standard post roster. */
  defenders?: number;
  /** Perimeter patrol teams generated around the yard. */
  patrolTeams?: number;
  major?: boolean;
  /** Register a map POI (shows on the HUD/minimap and can be overridden). */
  poi?: boolean;
}

const T = 34;          // perimeter wall thickness
const GATE = 280;      // vehicle-capable gate gap (matches HQ / airfield gates)
const GEN_W = 144;     // generator block footprint
const GEN_H = 200;
const GEN_PITCH = 234; // block + service gap (infantry lane)
const AISLE = 250;     // central vehicle corridor
const CROSS = 240;     // vehicle-capable cross aisle between generator rows

export interface PowerYard extends PowerSite {
  cells: PowerCell[];
  doors: Point[];
  facilityId: string;
  padSpots: Point[];
}

/ Footprint a yard needs for a given machine count — lets callers reserve the ground up front. */
export function yardSize(generators: number, servers: number): { w: number; h: number } {
  const gens = Math.max(1, Math.round(generators));
  const srvs = Math.max(1, Math.round(servers));
  const rows = gens > 6 ? (gens > 12 ? 3 : 2) : 1;
  const perRow = Math.ceil(gens / rows);
  const split = perRow > 3;
  const halfCols = split ? Math.ceil(perRow / 2) : perRow;
  const rowW = halfCols * GEN_W + (halfCols - 1) * (GEN_PITCH - GEN_W);
  const innerW = (split ? rowW * 2 + AISLE : rowW) + 150;
  const hallH = Math.max(210, 62 + Math.ceil(srvs / 4) * 118 + 40);
  const innerH = 60 + hallH + 150 + rows * GEN_H + (rows - 1) * CROSS + 150 + 150 + 60;
  return { w: Math.round(innerW + T * 2), h: Math.round(innerH + T * 2) };
}

/** Build a defended generator/server yard centred on (cx, cy). Size is derived from the machine count. */
export function buildPowerYard(o: PowerYardOptions, c: PowerYardContext): PowerYard {
  const gens = Math.max(1, Math.round(o.generators));
  const srvs = Math.max(1, Math.round(o.servers));
  const rows = gens > 6 ? (gens > 12 ? 3 : 2) : 1;
  const perRow = Math.ceil(gens / rows);
  const split = perRow > 3;                       // keep a drive-through corridor in wide rows
  const halfCols = split ? Math.ceil(perRow / 2) : perRow;
  const rowW = halfCols * GEN_W + (halfCols - 1) * (GEN_PITCH - GEN_W);
  const innerW = (split ? rowW * 2 + AISLE : rowW) + 150;
  const hallH = Math.max(210, 62 + Math.ceil(srvs / 4) * 118 + 40);
  const innerH = 60 + hallH + 150 + rows * GEN_H + (rows - 1) * CROSS + 150 + 150 + 60;
  const w = Math.round(innerW + T * 2);
  const h = Math.round(innerH + T * 2);
  const x = Math.round(o.cx - w / 2), y = Math.round(o.cy - h / 2);
  const ix = x + T, iy = y + T, iw = w - T * 2, ih = h - T * 2;

  const site: PowerSite = { id: o.id, name: o.name, code: o.code, x, y, w, h, major: !!o.major };
  const cells: PowerCell[] = [];
  const add = (rx: number, ry: number, rw: number, rh: number, kind: StructKind = 'power', h3d = 40, detail = false) => {
    if (rw <= 0 || rh <= 0) return;
    c.rects.push({ x: Math.round(rx), y: Math.round(ry), w: Math.round(rw), h: Math.round(rh), kind, h3d, facilityDetail: detail });
  };

  /* ---------------- apron, perimeter and gates ---------------- */
  c.zones.push({ x: x - 90, y: y - 90, w: w + 180, h: h + 180, kind: 'concrete' });
  const doors: Point[] = [];
  const wall = (wx: number, wy: number, ww: number, wh: number) => add(wx, wy, ww, wh, 'power', 52);
  // north / south walls, each split by a vehicle gate
  wall(x, y, iw / 2 - GATE / 2, T); wall(x + iw / 2 + GATE / 2, y, iw / 2 - GATE / 2, T);
  wall(x, y + ih - T, iw / 2 - GATE / 2, T); wall(x + iw / 2 + GATE / 2, y + ih - T, iw / 2 - GATE / 2, T);
  doors.push({ x: x + iw / 2, y: y + T / 2 }, { x: x + iw / 2, y: y + ih - T / 2 });
  // east / west service gates — four separate approaches to the same machines
  wall(x, y + T, T, ih / 2 - T - GATE / 2); wall(x, y + ih / 2 + GATE / 2, T, ih / 2 - T - GATE / 2);
  wall(x + iw - T, y + T, T, ih / 2 - T - GATE / 2); wall(x + iw - T, y + ih / 2 + GATE / 2, T, ih / 2 - T - GATE / 2);
  doors.push({ x: x + T / 2, y: y + ih / 2 }, { x: x + iw - T / 2, y: y + ih / 2 });
  c.gates.push(...doors);

  // Corner bastions with crew positions (they also become turret emplacements via populateHQ).
  const bastion = 108;
  for (const [bx, by] of [[x - 26, y - 26], [x + w - bastion + 26, y - 26], [x - 26, y + h - bastion + 26], [x + w - bastion + 26, y + h - bastion + 26]]) {
    add(bx, by, bastion, bastion, 'bunker', 46);
    c.garrison.push({ x: bx + bastion / 2, y: by + bastion / 2 });
  }

  /* ---------------- the yard as a facility (art, roof, HUD, guards) ---------------- */
  const facility: Facility = {
    x, y, w, h, id: `power-${o.id}`, kind: 'power', code: o.code, name: o.name,
    props: [], doors, roofed: false, siteId: o.id,
  };
  c.facilities.push(facility);

  /* ---------------- roofed server hall (north band) ---------------- */
  const hallX = ix + 75, hallY = iy + 60, hallW = iw - 150, hallD = hallH;
  const hall: Facility = {
    x: hallX, y: hallY, w: hallW, h: hallD, id: `${o.id}-hall`, kind: 'power', siteId: o.id,
    code: `${o.code}-SRV`, name: `${o.name} / SERVER HALL`, props: [], doors: [
      { x: hallX + hallW / 2 - 150, y: hallY + hallD - 14 },
      { x: hallX + hallW / 2 + 150, y: hallY + hallD - 14 },
    ], roofed: true,
  };
  c.facilities.push(hall);
  c.gates.push(...hall.doors);
  // hall shell
  const ht = 26, hgap = 190;
  add(hallX, hallY, hallW, ht, 'radar', 44);                                   // north wall
  add(hallX, hallY + ht, ht, hallD - ht * 2, 'radar', 44);                     // west
  add(hallX + hallW - ht, hallY + ht, ht, hallD - ht * 2, 'radar', 44);        // east
  add(hallX, hallY + hallD - ht, hallW / 2 - 150 - hgap / 2 + 60, ht, 'radar', 44);
  add(hallX + hallW / 2 + 150 + hgap / 2 - 60, hallY + hallD - ht,
    hallW - (hallW / 2 + 150 + hgap / 2 - 60), ht, 'radar', 44);
  c.zones.push({ x: hallX + ht, y: hallY + ht, w: hallW - ht * 2, h: hallD - ht * 2, kind: 'concrete' });
  hall.props.push({ kind: 'console', x: hallX + 46, y: hallY + 40, w: 148, h: 34, solid: false, color: '#9fd0ff' });
  hall.props.push({ kind: 'console', x: hallX + hallW - 194, y: hallY + 40, w: 148, h: 34, solid: false, color: '#9fd0ff' });
  add(hallX + 46, hallY + 40, 148, 34, 'radar', 22, true);
  add(hallX + hallW - 194, hallY + 40, 148, 34, 'radar', 22, true);

  // server racks in two ranks with a cold aisle between them
  const rackW = 176, rackD = 74;
  const rackRowY = [hallY + 92, hallY + hallD - 92 - rackD];
  let rackIndex = 0;
  for (let rank = 0; rank < 2 && rackIndex < srvs; rank++) {
    const usable = hallW - 150;
    const per = Math.ceil((srvs - rackIndex) / (2 - rank));
    const pitch = usable / Math.max(1, per);
    for (let i = 0; i < per && rackIndex < srvs; i++, rackIndex++) {
      const rx = hallX + 75 + i * pitch, ry = rackRowY[rank];
      add(rx, ry, rackW, rackD, 'radar', 40);
      hall.props.push({ kind: 'rack', x: Math.round(rx), y: Math.round(ry), w: rackW, h: rackD, solid: true, color: '#9fd0ff' });
      cells.push({
        x: Math.round(rx + rackW / 2), y: Math.round(ry + rackD / 2),
        id: `${o.id}-srv-${rackIndex}`, kind: 'server', hp: 210, maxHp: 210, dead: false, site: o.id,
      });
    }
  }
  // cable trench from the hall down the central corridor (walkable, purely visual)
  hall.props.push({ kind: 'cable', x: x + iw / 2 - 34, y: hallY + hallD, w: 68, h: 150, solid: false, color: '#c8a76a' });

  /* ---------------- generator rows ---------------- */
  const genTop = hallY + hallD + 150;
  let genIndex = 0;
  for (let row = 0; row < rows; row++) {
    const gy = genTop + row * (GEN_H + CROSS);
    const inRow = Math.min(perRow, gens - genIndex);
    const cols = split ? Math.ceil(inRow / 2) : inRow;
    for (let i = 0; i < inRow; i++, genIndex++) {
      const leftSide = !split || i < cols;
      const slot = split ? (leftSide ? i : i - cols) : i;
      const groupW = cols * GEN_W + (cols - 1) * (GEN_PITCH - GEN_W);
      const baseX = split
        ? (leftSide ? x + iw / 2 - AISLE / 2 - groupW : x + iw / 2 + AISLE / 2)
        : x + (iw - groupW) / 2;
      const gx = baseX + slot * GEN_PITCH;
      add(gx, gy, GEN_W, GEN_H, 'power', 58);
      facility.props.push({ kind: 'transformer', x: Math.round(gx), y: Math.round(gy), w: GEN_W, h: GEN_H, solid: true, color: '#e3ac73' });
      cells.push({
        x: Math.round(gx + GEN_W / 2), y: Math.round(gy + GEN_H / 2),
        id: `${o.id}-gen-${genIndex}`, kind: 'generator', hp: 300, maxHp: 300, dead: false, site: o.id,
      });
      // fuel drums and a fuel-trap beside each machine: shooting them hurts the yard
      c.barrels.push({ x: Math.round(gx - 34), y: Math.round(gy + GEN_H - 34) }, { x: Math.round(gx + GEN_W + 26), y: Math.round(gy + 30) });
      // feeder cables running to the corridor
      facility.props.push({
        kind: 'cable', solid: false, color: '#c8a76a',
        x: Math.round(leftSide || !split ? gx + GEN_W : gx - 60), y: Math.round(gy + GEN_H / 2 - 22), w: 60, h: 44,
      });
    }
    // walkway grating between rows
    c.zones.push({ x: ix + 40, y: gy + GEN_H + 40, w: iw - 80, h: CROSS - 80, kind: 'concrete' });
  }

  /* ---------------- switchgear / cooling / industrial band (south) ---------------- */
  const gearY = genTop + (rows - 1) * (GEN_H + CROSS) + GEN_H + 150;
  const cabinets = Math.max(4, Math.round(gens * 0.7));
  const cabPitch = (iw - 160) / cabinets;
  for (let i = 0; i < cabinets; i++) {
    const cxp = ix + 80 + i * cabPitch;
    add(cxp, gearY, 62, 46, 'power', 30);
    facility.props.push({ kind: 'cabinet', x: Math.round(cxp), y: Math.round(gearY), w: 62, h: 46, solid: true, color: '#d8c48a' });
  }
  // cooling plant + water tanks
  const tanks = Math.max(2, Math.round(gens / 3));
  for (let i = 0; i < tanks; i++) {
    const tx = ix + 90 + i * ((iw - 260) / Math.max(1, tanks)), ty = gearY + 96;
    add(tx, ty, 116, 116, 'motorpool', 40);
    facility.props.push({ kind: 'tank', x: Math.round(tx), y: Math.round(ty), w: 116, h: 116, solid: true, color: '#8fc0cf' });
  }
  // busbar trench crossing the yard (visual, walkable)
  facility.props.push({ kind: 'cable', x: ix + 60, y: gearY + 62, w: iw - 120, h: 26, solid: false, color: '#b99a63' });
  // lighting masts + floodlights
  const mastXs = [ix + 70, x + iw / 2 - AISLE / 2 - 40, x + iw / 2 + AISLE / 2 + 22, ix + iw - 92];
  for (const mx of mastXs) {
    add(mx, iy + 70, 20, 40, 'antenna', 44);
    facility.props.push({ kind: 'mast', x: Math.round(mx), y: Math.round(iy + 70), w: 20, h: 40, solid: true, color: '#d8c48a' });
  }
  const lampCorners: [number, number][] = [
    [x + 46, y + 46], [x + w - 46, y + 46], [x + 46, y + h - 46], [x + w - 46, y + h - 46],
    [x + iw / 2, y + 40], [x + iw / 2, y + h - 40],
  ];
  lampCorners.forEach(([lx, ly], i) => c.lights.push({ x: lx, y: ly, speed: 0.45 + i * 0.07, sweep: 1.05 + (i % 3) * 0.12, site: o.id }));

  // supply crates + a maintenance motor pool outside the south gate
  c.caches.push({ x: x + iw / 2 - 190, y: y + h + 90 }, { x: x + iw / 2 + 190, y: y + h + 90 });
  for (let i = 0; i < (o.major ? 6 : 4); i++) {
    c.vans.push({ x: x + iw / 2 - 380 + i * 150, y: y + h + 210, ang: -Math.PI / 2 });
  }
  c.zones.push({ x: x + iw / 2 - 460, y: y + h, w: 920, h: 320, kind: 'concrete' });

  /* ---------------- garrison ---------------- */
  const roster = o.major
    ? ['commander', 'warden', 'warden', 'sapper', 'gunner', 'gunner', 'guard', 'guard', 'medic', 'sentinel',
      'breacher', 'flamer', 'pathfinder', 'grunt', 'grunt', 'shieldman']
    : ['commander', 'warden', 'sapper', 'gunner', 'guard', 'medic', 'breacher', 'grunt'];
  const extra = Math.max(0, (o.defenders ?? 0));
  const posts: { p: Point; role: PostRole; patrol?: Point[] }[] = [];
  // gate wardens (one per approach) and a yard commander
  doors.forEach((d, i) => posts.push({ p: { x: d.x + (i % 2 ? -70 : 70), y: d.y + (i < 2 ? (i === 0 ? 96 : -96) : 0) }, role: i === 0 ? 'leader' : 'sentry' }));
  // machine-gun nests covering the generator rows
  for (let row = 0; row < rows; row++) {
    const gy = genTop + row * (GEN_H + CROSS) + GEN_H / 2;
    posts.push({ p: { x: ix + 96, y: gy }, role: 'screen' }, { p: { x: ix + iw - 96, y: gy }, role: 'screen' });
  }
  // server hall guardians and technicians
  posts.push({ p: { x: hallX + 150, y: hallY + hallD / 2 }, role: 'support' });
  posts.push({ p: { x: hallX + hallW - 150, y: hallY + hallD / 2 }, role: 'support' });
  posts.push({ p: { x: x + iw / 2, y: hallY + hallD + 70 }, role: 'flank' });
  posts.push({ p: { x: x + iw / 2, y: gearY - 60 }, role: 'flank' });
  // outer ring posts
  posts.push({ p: { x: x - 130, y: y + h / 2 }, role: 'patrol', patrol: [{ x: x - 130, y: y - 130 }, { x: x - 130, y: y + h + 130 }] });
  posts.push({ p: { x: x + w + 130, y: y + h / 2 }, role: 'patrol', patrol: [{ x: x + w + 130, y: y + h + 130 }, { x: x + w + 130, y: y - 130 }] });

  const count = Math.min(posts.length, roster.length + extra);
  for (let i = 0; i < count; i++) {
    const post = posts[i];
    const type = i < roster.length ? roster[i] : (c.sector > 3 ? 'sentinel' : 'gunner');
    c.guards.push({ x: post.p.x, y: post.p.y, type, facilityId: facility.id, role: post.role, patrol: post.patrol || [] });
  }
  // fixed heavy emplacements on the two south corners of the wall
  c.garrison.push({ x: x + 150, y: y + h - 150 }, { x: x + w - 150, y: y + h - 150 });

  /* ---------------- perimeter patrols (formation columns) ---------------- */
  const teams = o.patrolTeams ?? (o.major ? 4 : 2);
  const ring = (inset: number): Point[] => ([
    { x: x - inset, y: y - inset }, { x: x + w + inset, y: y - inset },
    { x: x + w + inset, y: y + h + inset }, { x: x - inset, y: y + h + inset },
  ]);
  for (let i = 0; i < teams; i++) {
    const inset = 150 + i * 150;
    const members = o.major
      ? ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'grunt', 'flamer', 'grunt', 'pathfinder', 'medic', 'grunt', 'grunt']
      : ['warden', 'grunt', 'grunt', 'gunner', 'grunt', 'medic', 'grunt', 'grunt'];
    c.patrols.push({
      id: `${o.id}-ring-${i}`, points: ring(inset), members,
      columns: i % 2 ? 2 : 4, spacing: i % 2 ? 46 : 40, speed: 52 + i * 7, kind: 'foot', site: o.id,
    });
  }
  // an inner machine-aisle patrol walking the central corridor
  c.patrols.push({
    id: `${o.id}-aisle`, points: [
      { x: x + iw / 2, y: hallY + hallD + 60 }, { x: x + iw / 2, y: gearY - 40 },
    ],
    members: o.major ? ['sapper', 'grunt', 'grunt', 'guard', 'grunt', 'grunt'] : ['sapper', 'grunt', 'grunt', 'guard'],
    columns: 2, spacing: 44, speed: 46, kind: 'foot', site: o.id,
  });

  /* ---------------- POI ---------------- */
  if (o.poi) {
    c.pois.push({
      id: o.id, kind: 'depot', x: o.cx, y: o.cy, r: Math.max(760, Math.max(w, h) * 0.62),
      name: o.name,
      sub: `${gens} GENERATORS / ${srvs} SERVER RACKS / SHUT DOWN THE GRID`,
      secret: false, gates: doors,
    });
  }

  return { ...site, cells, doors, facilityId: facility.id, padSpots: [{ x: x + iw / 2, y: y + h + 330 }] };
}

/** Fraction of a site's generators still turning (1 = full output). */
export function siteLoad(cells: PowerCell[], siteId: string): number {
  let live = 0, total = 0;
  for (const cell of cells) {
    if (cell.kind !== 'generator' || cell.site !== siteId) continue;
    total++; if (!cell.dead) live++;
  }
  return total ? live / total : 1;
}

/** Sector-wide output: HELIOS is the grid, every other yard is a local feeder. */
export function gridLoad(cells: PowerCell[], majorId: string): number {
  return siteLoad(cells, majorId);
}

export function siteDead(cells: PowerCell[], siteId: string): boolean {
  return cells.filter(c => c.site === siteId && c.kind === 'generator').every(c => c.dead);
}

export function generatorsDead(cells: PowerCell[]): boolean {
  const gens = cells.filter(c => c.kind === 'generator');
  return gens.length > 0 && gens.every(c => c.dead);
}
