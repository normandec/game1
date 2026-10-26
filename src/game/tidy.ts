/* ------------------------------------------------------------------ *
 * TIDY: the pass that makes the battlefield look surveyed.
 *
 * The world is built by a dozen generators that each paint their own layer:
 * walls, wards, barracks, apron zones, roads, helipads, vehicle parks, the
 * army district. They were all authored in isolation, so the layers cross:
 * a barracks with a perimeter wall through its middle, a helipad whose apron
 * is half covered by a hangar, road markings running under a warehouse, and
 * vehicle parks whose spacing (120–130 m) is shorter than the vehicle itself
 * (150 m), which put two kombis inside each other.
 *
 * Nothing here moves the map. Roads, walls and buildings stay exactly where
 * they were authored; what changes is the loose kit that is allowed to sit on
 * them:
 *   • painted roads are cut around buildings instead of running underneath,
 *   • helipads whose apron is blocked are moved to clear ground (or dropped),
 *   • vehicle parks are re-spaced to a pitch that fits the vehicle and pushed
 *     off the carriageway,
 *   • army armour, helicopters and airframes are moved out of buildings.
 *
 * It is all plain data in, plain data out, so the same pass runs for every
 * sector and the result can be asserted in a headless test.
 * ------------------------------------------------------------------ */

import type { ArmyPlan } from './army';
import type { Rect, StructKind, Zone } from './world';

/** Loose kit: never a reason to cut a road, never a place a vehicle parks. */
const DECOR = new Set<StructKind>([
  'crate', 'barrel', 'sandbag', 'tent', 'bladder', 'target', 'rock', 'pine',
  'lamp', 'sign', 'busstop', 'billboard',
]);

/**
 * Ground cover that is worn while walking or driven over: paint, not masonry.
 * A road may not be cut for any of these, and a vehicle may park on them.
 */
const OPEN_GROUND = new Set<StructKind>(['gate', 'barrier', 'fence', 'checkpoint']);

/** True when the rect is a building: something a road should not run under. */
const isBuilding = (r: Rect) => !DECOR.has(r.kind) && !OPEN_GROUND.has(r.kind) && r.w >= 40 && r.h >= 40;

const overlapArea = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const inside = (x: number, y: number, r: { x: number; y: number; w: number; h: number }, pad = 0) =>
  x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

/** The box a vehicle actually occupies, given its parked heading. */
const vehicleBox = (x: number, y: number, ang: number, length = 150, width = 74) => {
  const along = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang));
  return along
    ? { x: x - length / 2, y: y - width / 2, w: length, h: width }
    : { x: x - width / 2, y: y - length / 2, w: width, h: length };
};

export interface TidyReport {
  roadsCut: number;
  padsMoved: number;
  padsDropped: number;
  vansMoved: number;
  vansDropped: number;
  buildingsMoved: number;
  wallsCut: number;
  gatesCut: number;
  propsMoved: number;
  tanksMoved: number;
  helisMoved: number;
  jetsMoved: number;
}

export interface TidyInput {
  rects: Rect[];
  zones: Zone[];
  vanSpots: { x: number; y: number; ang: number }[];
  helipads: { x: number; y: number }[];
  parkedHelis: { x: number; y: number; ang: number }[];
  army: ArmyPlan | null;
}

const emptyReport = (): TidyReport => ({
  roadsCut: 0, padsMoved: 0, padsDropped: 0, vansMoved: 0, vansDropped: 0, buildingsMoved: 0, wallsCut: 0, gatesCut: 0, propsMoved: 0,
  tanksMoved: 0, helisMoved: 0, jetsMoved: 0,
});

/**
 * Cut every road zone around the buildings it used to run under.
 *
 * A road is a big painted rect; a building standing on it is a small one. The road is
 * split into the pieces that are left, one building at a time, so the remaining paint
 * hugs the lots and the street network still joins at the junctions.
 */
function clipRoads(rects: Rect[], zones: Zone[], report: TidyReport) {
  const buildings = rects.filter(isBuilding);
  const out: Zone[] = [];
  for (const z of zones) {
    if (z.kind !== 'road') { out.push(z); continue; }
    let pieces: Zone[] = [z];
    for (const b of buildings) {
      const next: Zone[] = [];
      for (const p of pieces) {
        if (overlapArea(p, b) <= 0) { next.push(p); continue; }
        // Slice the remaining paint into up to four bands around the building.
        const left = { ...p, w: b.x - p.x };
        const right = { ...p, x: b.x + b.w, w: p.x + p.w - (b.x + b.w) };
        const top = { ...p, x: Math.max(p.x, b.x), w: Math.min(p.x + p.w, b.x + b.w) - Math.max(p.x, b.x), h: b.y - p.y };
        const bottom = {
          ...p, x: Math.max(p.x, b.x), w: Math.min(p.x + p.w, b.x + b.w) - Math.max(p.x, b.x),
          y: b.y + b.h, h: p.y + p.h - (b.y + b.h),
        };
        for (const piece of [left, right, top, bottom]) {
          if (piece.w > 24 && piece.h > 24) next.push(piece);
        }
      }
      pieces = next;
      if (!pieces.length) break;
    }
    if (pieces.length !== 1 || pieces[0].w !== z.w || pieces[0].h !== z.h) report.roadsCut++;
    out.push(...pieces);
  }
  zones.length = 0;
  zones.push(...out);
}

/**
 * Vehicle parks.
 *
 * The parks are authored as ranks: a heading and a line of slots a fixed pitch apart.
 * That pitch was 120–130 m while the van is 150 m long, so every second van sat inside
 * the one beside it. Ranks are re-spaced to a pitch that fits, pushed clear of the
 * carriageway and of buildings, and a rank that cannot be rescued is dropped — three
 * neat rows read better than four rows with a pile in the middle.
 */
function tidyVans(rects: Rect[], zones: Zone[], spots: { x: number; y: number; ang: number }[], report: TidyReport) {
  if (!spots.length) return;
  const PITCH = 172;
  interface Row { ang: number; line: number; items: { x: number; y: number; ang: number }[] }
  const rows: Row[] = [];
  for (const s of spots) {
    const along = Math.abs(Math.cos(s.ang)) > Math.abs(Math.sin(s.ang));
    const line = along ? s.y : s.x;
    const row = rows.find((r) => Math.abs(Math.cos(r.ang) - Math.cos(s.ang)) < 0.2
      && Math.abs(Math.sin(r.ang) - Math.sin(s.ang)) < 0.2 && Math.abs(r.line - line) < 90);
    if (row) row.items.push(s);
    else rows.push({ ang: s.ang, line, items: [s] });
  }
  const buildings = rects.filter((r) => !DECOR.has(r.kind));
  // Parking is allowed right up to the kerb: the carriageway is the painted rect, and a
  // van may stand with its nose over the shoulder line, but not in the traffic lane.
  const roads = zones.filter((z) => z.kind === 'road')
    .map((z) => ({ x: z.x + 8, y: z.y + 8, w: Math.max(0, z.w - 16), h: Math.max(0, z.h - 16) }));
  const clearAt = (box: { x: number; y: number; w: number; h: number }) => {
    for (const b of buildings) if (overlapArea(box, b) > 0) return false;
    for (const r of roads) if (overlapArea(box, r) > 0) return false;
    return true;
  };
  const placed: { x: number; y: number; ang: number }[] = [];
  const kept: { x: number; y: number; ang: number }[] = [];
  let dropped = 0;
  for (const row of rows) {
    const along = Math.abs(Math.cos(row.ang)) > Math.abs(Math.sin(row.ang));
    // Sort the rank along its own axis and re-space it about its centre.
    const items = [...row.items].sort((a, b) => (along ? a.x - b.x : a.y - b.y));
    const centre = items.reduce((acc, s) => acc + (along ? s.x : s.y), 0) / items.length;
    const offsets = items.map((_, i) => (i - (items.length - 1) / 2) * PITCH);
    let rowDone = false;
    for (let attempt = 0; attempt < 13 && !rowDone; attempt++) {
      // 0, then out to either flank, then further out: a row slides off the tarmac.
      const shift = attempt === 0 ? 0 : (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * 96;
      const candidate = items.map((s, i) => along
        ? { x: centre + offsets[i], y: row.line + shift, ang: s.ang }
        : { x: row.line + shift, y: centre + offsets[i], ang: s.ang });
      const ok = candidate.every((c) => clearAt(vehicleBox(c.x, c.y, c.ang))
        && !placed.some((p) => overlapArea(vehicleBox(c.x, c.y, c.ang), vehicleBox(p.x, p.y, p.ang)) > 0));
      if (ok) {
        for (const c of candidate) { kept.push(c); placed.push(c); }
        if (shift !== 0) report.vansMoved += candidate.length;
        rowDone = true;
      }
    }
    if (!rowDone) {
      // The rank as a whole will not fit — keep the individual vehicles that do, so a
      // crowded corner loses two vans instead of the whole row.
      for (const s of items) {
        const spot = freeSpot(s.x, s.y, (x, y) => vehicleBox(x, y, s.ang), buildings, 4);
        if (!spot) { dropped++; continue; }
        const box = vehicleBox(spot.x, spot.y, s.ang);
        if (roads.some((r) => overlapArea(box, r) > 0)) { dropped++; continue; }
        if (placed.some((p) => overlapArea(box, vehicleBox(p.x, p.y, p.ang)) > 0)) { dropped++; continue; }
        const moved: { x: number; y: number; ang: number } = { x: spot.x, y: spot.y, ang: s.ang };
        kept.push(moved); placed.push(moved);
      }
    }
  }
  report.vansDropped += dropped;
  spots.length = 0;
  spots.push(...kept);
}

/**
 * Helipads.
 *
 * A pad is a 280 m painted apron with an H on it. When a hangar or a barrack stands on
 * that apron the pad has to go somewhere it can actually be used: the pass looks for the
 * nearest clear 300 m square, and if the district is too crowded the pad is dropped
 * rather than left half inside a wall.
 */
function tidyHelipads(rects: Rect[], zones: Zone[], pads: { x: number; y: number }[], report: TidyReport) {
  const buildings = rects.filter((r) => !DECOR.has(r.kind));
  const apronClear = (x: number, y: number) => {
    const box = { x: x - 150, y: y - 150, w: 300, h: 300 };
    for (const b of buildings) if (overlapArea(box, b) > 60 * 60) return false;
    return true;
  };
  const kept: { x: number; y: number }[] = [];
  for (const p of pads) {
    if (apronClear(p.x, p.y)) { kept.push(p); continue; }
    let moved: { x: number; y: number } | null = null;
    for (let ring = 1; ring <= 6 && !moved; ring++) {
      for (let k = 0; k < 8 && !moved; k++) {
        const a = (k / 8) * Math.PI * 2 + ring * 0.3;
        const x = p.x + Math.cos(a) * ring * 170;
        const y = p.y + Math.sin(a) * ring * 170;
        if (apronClear(x, y)) moved = { x, y };
      }
    }
    if (moved) { kept.push(moved); report.padsMoved++; }
    else report.padsDropped++;
  }
  pads.length = 0;
  pads.push(...kept);
  // Rebuild the painted aprons so exactly the surviving pads have one.
  for (let i = zones.length - 1; i >= 0; i--) if (zones[i].kind === 'helipad') zones.splice(i, 1);
  for (const p of pads) zones.push({ x: p.x - 140, y: p.y - 140, w: 280, h: 280, kind: 'helipad' });
}

/** Push a point out of whatever building it is standing in, nearest edge first. */
function freeSpot(
  x: number, y: number, box: (x: number, y: number) => { x: number; y: number; w: number; h: number },
  buildings: Rect[], maxRing = 6,
  alsoClear?: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  const clear = (cx: number, cy: number) => {
    if (alsoClear && !alsoClear(cx, cy)) return false;
    const b = box(cx, cy);
    return !buildings.some((r) => overlapArea(b, r) > 0);
  };
  if (clear(x, y)) return { x, y };
  for (let ring = 1; ring <= maxRing; ring++) {
    const step = ring * 80;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const cx = x + Math.cos(a) * step;
      const cy = y + Math.sin(a) * step;
      if (clear(cx, cy)) return { x: cx, y: cy };
    }
  }
  return null;
}

/**
 * Buildings that a perimeter wall should never run through.
 *
 * The legacy base was authored as a curtain wall with ward blocks inside it, and a few
 * blocks were placed a wall-thickness too far: a barrack with 40 m of concrete through
 * its middle. Those blocks are shifted clear of the wall they were built into; the wall,
 * which is the structure, stays exactly where it is.
 */
const SOFT_BUILDINGS = new Set<StructKind>([
  'barrack', 'warehouse', 'laboratory', 'library', 'motorpool', 'armory', 'hangar',
  'megahangar', 'towerblock', 'stockade', 'kazemat', 'power', 'bunker',
]);
const WALL_KINDS = new Set<StructKind>(['wall', 'curtain', 'fence', 'keep', 'rampart']);
const isLongWall = (r: Rect) => WALL_KINDS.has(r.kind) && Math.min(r.w, r.h) < 96 && Math.max(r.w, r.h) > 200;

function tidyBuildings(rects: Rect[], report: TidyReport) {
  const walls = rects.filter(isLongWall);
  const buildings = rects.filter((r) => SOFT_BUILDINGS.has(r.kind) && r.w >= 120 && r.h >= 120);
  for (const b of buildings) {
    const buried = (w: Rect) => {
      const o = overlapArea(b, w);
      // The block has a wall through it — not just touching the corner of one.
      return o > 2400 && o > b.w * b.h * 0.02 && o > w.w * w.h * 0.12;
    };
    if (!walls.some(buried)) continue;
    const others = rects.filter((r) => r !== b && !DECOR.has(r.kind));
    const clear = (x: number, y: number) => {
      const box = { x, y, w: b.w, h: b.h };
      if (others.some((o) => overlapArea(box, o) > 0)) return false;
      return !walls.some((w) => overlapArea(box, w) > 0);
    };
    let done = false;
    for (let ring = 1; ring <= 6 && !done; ring++) {
      const step = ring * 90;
      const tries = [
        { x: b.x + step, y: b.y }, { x: b.x - step, y: b.y },
        { x: b.x, y: b.y + step }, { x: b.x, y: b.y - step },
        { x: b.x + step, y: b.y + step }, { x: b.x - step, y: b.y + step },
        { x: b.x + step, y: b.y - step }, { x: b.x - step, y: b.y - step },
      ];
      for (const t of tries) {
        if (!clear(t.x, t.y)) continue;
        b.x = t.x; b.y = t.y;
        report.buildingsMoved++;
        done = true;
        break;
      }
    }
  }
}

/**
 * Halls with something built inside them.
 *
 * A hangar bay is authored as four thin walls around an open floor. Anything the plan then
 * dropped in the middle of that floor — a barrack, a library, half a ward — cannot be seen
 * and cannot be reached: it is a building inside a building, which is exactly what the site
 * plan is supposed to prevent. Thin walls that touch each other are grouped into a shell,
 * and anything standing inside the shell's floor is lifted out onto open ground beside it.
 */
function tidyShells(rects: Rect[], report: TidyReport) {
  const thin = rects.filter((r) => !DECOR.has(r.kind) && Math.min(r.w, r.h) <= 40
    && Math.max(r.w, r.h) >= 120 && !OPEN_GROUND.has(r.kind));
  if (thin.length < 2) return;
  const used = new Set<Rect>();
  const shells: Rect[] = [];
  for (const seed of thin) {
    if (used.has(seed)) continue;
    const group = [seed];
    used.add(seed);
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      for (const b of thin) {
        if (used.has(b) || b.kind !== a.kind) continue;
        const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
        const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
        if (gapX > 8 || gapY > 8) continue;
        used.add(b);
        group.push(b);
      }
    }
    if (group.length < 3) continue;
    const x0 = Math.min(...group.map((r) => r.x)), y0 = Math.min(...group.map((r) => r.y));
    const x1 = Math.max(...group.map((r) => r.x + r.w)), y1 = Math.max(...group.map((r) => r.y + r.h));
    if (x1 - x0 < 200 || y1 - y0 < 200) continue;
    shells.push({ ...seed, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  if (!shells.length) return;
  const keepOut = rects.filter((r) => !DECOR.has(r.kind));
  for (const b of rects.filter((r) => SOFT_BUILDINGS.has(r.kind) && r.w >= 120 && r.h >= 120)) {
    const host = shells.find((sh) => b.x >= sh.x - 20 && b.y >= sh.y - 20
      && b.x + b.w <= sh.x + sh.w + 20 && b.y + b.h <= sh.y + sh.h + 20);
    if (!host) continue;
    const spot = freeSpot(b.x, b.y, (x, y) => ({ x, y, w: b.w, h: b.h }), keepOut, 12,
      (x, y) => !shells.some((sh) => x < sh.x + sh.w && x + b.w > sh.x && y < sh.y + sh.h && y + b.h > sh.y));
    if (!spot) continue;
    b.x = spot.x; b.y = spot.y;
    report.buildingsMoved++;
  }
}

/**
 * A wall stops at a building.
 *
 * Where a ward block cannot be moved off a perimeter wall (it is hemmed in by the rest of
 * the ward), the wall is cut instead: two lengths that stop at the block's corners, which
 * is what a site plan of the place would show. Nothing is deleted — the wall simply runs
 * around the building rather than through it.
 */
function clipWalls(rects: Rect[], report: TidyReport) {
  const targets = rects.filter((r) => SOFT_BUILDINGS.has(r.kind) && r.w >= 120 && r.h >= 120);
  if (!targets.length) return;
  const preserved: Rect[] = [];
  for (const r of rects) {
    if (!isLongWall(r)) { preserved.push(r); continue; }
    let pieces: Rect[] = [r];
    for (const b of targets) {
      const next: Rect[] = [];
      for (const p of pieces) {
        if (overlapArea(p, b) <= 0) { next.push(p); continue; }
        const vertical = p.h >= p.w;
        if (vertical) {
          const top = { ...p, h: b.y - p.y };
          const bottom = { ...p, y: b.y + b.h, h: p.y + p.h - (b.y + b.h) };
          for (const piece of [top, bottom]) if (piece.h > 24) next.push(piece);
        } else {
          const left = { ...p, w: b.x - p.x };
          const right = { ...p, x: b.x + b.w, w: p.x + p.w - (b.x + b.w) };
          for (const piece of [left, right]) if (piece.w > 24) next.push(piece);
        }
      }
      pieces = next;
      if (!pieces.length) break;
    }
    if (pieces.length !== 1) report.wallsCut++;
    preserved.push(...pieces);
  }
  rects.length = 0;
  rects.push(...preserved);
}

/**
 * The army district: armour, helicopters and airframes.
 *
 * The parks were laid out on their own grid and the buildings were laid out on another,
 * so a dozen hulls ended up inside the ramparts, four helicopters inside a stockade and
 * the wing's airframes inside a hangar that has a roof. Each of those is moved to the
 * nearest ground it can actually occupy. Armour is moved as the hull *rect* it is built
 * from, because that is the thing that is drawn and the thing that blocks.
 */
function tidyArmy(army: ArmyPlan, rects: Rect[], zones: Zone[], report: TidyReport) {
  const buildings = rects.filter((r) => !DECOR.has(r.kind));
  const roads = zones.filter((z) => z.kind === 'road');

  // Parked armour: a hull keeps its slot but must not stand inside a wall.
  const hullRects = rects.filter((r) => r.kind === 'tank' && !r.dead);
  for (const hull of hullRects) {
    const box = (x: number, y: number) => ({ x, y, w: hull.w, h: hull.h });
    if (!buildings.some((b) => b !== hull && overlapArea(box(hull.x, hull.y), b) > 0)) continue;
    let moved = false;
    for (let ring = 1; ring <= 14 && !moved; ring++) {
      for (let k = 0; k < 8 && !moved; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = hull.x + Math.cos(a) * ring * 90;
        const y = hull.y + Math.sin(a) * ring * 90;
        const b2 = box(x, y);
        if (buildings.some((b) => b !== hull && overlapArea(b2, b) > 0)) continue;
        if (roads.some((r) => overlapArea(b2, r) > 0)) continue;
        hull.x = x; hull.y = y;
        moved = true;
        report.tanksMoved++;
      }
    }
    if (!moved) {
      // Nowhere to put it: a hull welded into a rampart is worse than one hull fewer.
      hull.dead = true;
      hull.hp = 0;
      report.tanksMoved++;
    }
  }
  // The plan's hull list is what the briefing counts, so keep it truthful.
  army.tanks = hullRects.map((r) => ({
    x: r.x + r.w / 2, y: r.y + r.h / 2, ang: r.w >= r.h ? 0 : Math.PI / 2,
  }));

  // Helicopters: out of the buildings, and standing on a pad when one is near.
  const keptHelis: { x: number; y: number; ang: number }[] = [];
  for (const h of army.helis) {
    const spot = freeSpot(h.x, h.y, (x, y) => ({ x: x - 78, y: y - 78, w: 156, h: 156 }), buildings, 8);
    if (!spot) { report.helisMoved++; continue; }
    if (spot.x !== h.x || spot.y !== h.y) { report.helisMoved++; h.x = spot.x; h.y = spot.y; }
    keptHelis.push(h);
  }
  army.helis.length = 0;
  army.helis.push(...keptHelis);

  /* Airframes: an aircraft parked inside a roofed hall taxies out onto the apron in front
   * of it. The apron is south of the halls and only about 120 m deep, so the search is a
   * fine grid that starts with the nearest open ground and never wanders further than the
   * air park itself — a jet moved half a kilometre from its own hangar reads as broken. */
  for (const j of army.jets) {
    const box = (x: number, y: number) => ({ x: x - 120, y: y - 70, w: 240, h: 140 });
    const clear = (x: number, y: number) => {
      const b = box(x, y);
      if (x < army.region.x + 140 || x > army.region.x + army.region.w - 140) return false;
      if (y < army.region.y + 120 || y > army.region.y + army.region.h - 120) return false;
      return !buildings.some((r) => overlapArea(b, r) > 0) && !roads.some((r) => overlapArea(b, r) > 60 * 60);
    };
    if (clear(j.x, j.y)) continue;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let dy = 0; dy <= 420 && !best; dy += 30) {
      for (const sx of [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180, -180, 220, -220]) {
        for (const sign of dy === 0 ? [1] : [1, -1]) {
          const x = j.x + sx, y = j.y + dy * sign;
          if (!clear(x, y)) continue;
          const d = Math.hypot(x - j.x, y - j.y);
          if (d < bestD) { bestD = d; best = { x, y }; }
        }
      }
    }
    if (best) { report.jetsMoved++; j.x = best.x; j.y = best.y; }
  }

  // Every helicopter in the district stands on a painted pad.
  for (const h of army.helis) {
    const hasPad = zones.some((z) => z.kind === 'helipad' && inside(h.x, h.y, z, 40));
    if (hasPad) continue;
    const clear = { x: h.x - 140, y: h.y - 140, w: 280, h: 280 };
    if (buildings.some((b) => overlapArea(clear, b) > 40 * 40)) continue;
    zones.push({ ...clear, kind: 'helipad' });
  }
}

/**
 * A road through a wall is a gate.
 *
 * The army district's eastern rampart ran the full height of the base with a road painted
 * straight through it and no opening in the masonry: the whole eastern arm — railhead,
 * silos, naval yard, a dozen buildings and four parked hulls — was cut off behind a solid
 * wall, and the drawn road ran into it. Any long wall that a road actually crosses gets an
 * opening cut where the road crosses it, which is what a sally port is.
 */
function openRoadGates(rects: Rect[], zones: Zone[], report: TidyReport) {
  const walls = rects.filter(isLongWall);
  for (const wall of walls) {
    if (wall.dead) continue;
    const vertical = wall.w <= wall.h;
    for (const road of zones) {
      if (road.kind !== 'road' || wall.dead) continue;
      if (overlapArea(wall, road) <= 0) continue;
      /* The opening is as wide as the carriageway where it meets the masonry. A road that
       * runs *alongside* a long wall touches it for hundreds of metres; that is a shoulder,
       * not a gate, so a contact longer than 320 m is left alone. */
      const a = vertical ? Math.max(wall.y, road.y) : Math.max(wall.x, road.x);
      const b = vertical ? Math.min(wall.y + wall.h, road.y + road.h) : Math.min(wall.x + wall.w, road.x + road.w);
      if (b - a < 60 || b - a > 320) continue;
      cutWall(rects, wall, a, b, vertical, report);
    }
  }
}

/**
 * A wall down the middle of the base needs a way through it.
 *
 * Sector 6's eastern rampart runs the full height of the district with the railhead, the
 * silos and the naval yard on its far side: a fortress wall with no sally port, so that
 * whole arm of the base was sealed off and the operative walked into it looking for a way
 * round. Any long wall that lies wholly inside the district — it is a partition, not the
 * outer perimeter — gets one opening, cut at the nearest place a road runs up to it.
 */
function openInternalGates(rects: Rect[], zones: Zone[], army: ArmyPlan, report: TidyReport) {
  const reg = army.region;
  if (!reg || reg.w < 1200) return;
  const walls = rects.filter(isLongWall);
  for (const wall of walls) {
    if (wall.dead) continue;
    const vertical = wall.w <= wall.h;
    /* Only a real partition counts: a wall that runs most of the way across the district
     * and seals one arm of it off. The stockade around the HQ is a compound wall, not a
     * partition, and cutting gates in every compound would leave the base as a sieve. */
    const span = vertical ? wall.h : wall.w;
    if (span < 600 || span < (vertical ? reg.h : reg.w) * 0.5) continue;
    const inset = 120;
    const inside = wall.x > reg.x + inset && wall.y > reg.y + inset
      && wall.x + wall.w < reg.x + reg.w - inset && wall.y + wall.h < reg.y + reg.h - inset;
    if (!inside) continue;
    /* Pick the doorway, not just any gap: walk the length of the wall and score each spot
     * by how much clutter stands in the approach (a gate behind a wall of sandbags is not a
     * gate), with a bonus for landing where a road already runs up to the masonry. */
    const lo = (vertical ? wall.y : wall.x) + 140;
    const hi = (vertical ? wall.y + wall.h : wall.x + wall.w) - 140;
    if (hi <= lo) continue;
    const corridor = (at: number) => vertical
      ? { x: wall.x - 150, y: at - 120, w: wall.w + 300, h: 240 }
      : { x: at - 120, y: wall.y - 150, w: 240, h: wall.h + 300 };
    let bestAt = (lo + hi) / 2, bestCost = Infinity;
    for (let at = lo; at <= hi; at += 50) {
      const box = corridor(at);
      let cost = 0;
      for (const r of rects) {
        if (r === wall || r.dead) continue;
        const a = overlapArea(box, r);
        if (a > 0) cost += a;
      }
      for (const z of zones) {
        if (overlapArea(box, z) <= 0) continue;
        cost -= 4000;                              // tarmac in front of the gate is good
      }
      if (cost < bestCost) { bestCost = cost; bestAt = at; }
    }
    cutWall(rects, wall, bestAt - 100, bestAt + 100, vertical, report);
    // anything solid still standing in the doorway moves out of the way, along the wall
    const box = corridor(bestAt);
    const keepOut = rects.filter((r) => r !== wall);
    for (const r of rects) {
      if (r === wall || r.dead || overlapArea(box, r) <= 0) continue;
      if (SOFT_BUILDINGS.has(r.kind) || isLongWall(r)) continue;
      if (!SOLID_PROP.has(r.kind)) continue;
      const spot = freeSpot(r.x, r.y, (x, y) => ({ x, y, w: r.w, h: r.h }), keepOut, 10,
        (x, y) => !(x < box.x + box.w && x + r.w > box.x && y < box.y + box.h && y + r.h > box.y));
      if (!spot) continue;
      r.x = spot.x; r.y = spot.y;
      report.propsMoved++;
    }
  }
}

/**
 * Split a wall around an opening, keeping both halves.
 *
 * The far half used to be dropped, which quietly erased a whole rampart to make one gate.
 * Both pieces go back into the world: the base stays enclosed, the road stays open.
 */
function cutWall(rects: Rect[], wall: Rect, a: number, b: number, vertical: boolean, report: TidyReport) {
  const lo = vertical ? wall.y : wall.x;
  const hi = vertical ? wall.y + wall.h : wall.x + wall.w;
  const pad = 10;
  const openA = Math.max(lo, a - pad), openB = Math.min(hi, b + pad);
  if (openA <= lo + 30 && openB >= hi - 30) return;      // already open at this end
  report.gatesCut++;
  const pieces: [number, number][] = [];
  if (openA - lo > 30) pieces.push([lo, openA]);
  if (hi - openB > 30) pieces.push([openB, hi]);
  if (!pieces.length) { wall.dead = true; return; }
  const [first, second] = pieces;
  if (vertical) { wall.y = first[0]; wall.h = first[1] - first[0]; }
  else { wall.x = first[0]; wall.w = first[1] - first[0]; }
  if (!second) return;
  const ghost: Rect = { ...wall };
  if (vertical) { ghost.y = second[0]; ghost.h = second[1] - second[0]; }
  else { ghost.x = second[0]; ghost.w = second[1] - second[0]; }
  rects.push(ghost);
}

/**
 * Clutter that ended up inside a building.
 *
 * A crate, a barrel, a truck, a tent, a searchlight mast or a boulder standing *inside*
 * a warehouse is not decoration, it is a bug: it cannot be seen, cannot be shot and
 * cannot be reached. Anything entirely enclosed by a building is lifted out and set down
 * on the nearest clear ground beside it, which is where a site foreman would have put it
 * in the first place.
 */
function tidyProps(rects: Rect[], report: TidyReport) {
  const buildings = rects.filter((r) => !DECOR.has(r.kind) && !OPEN_GROUND.has(r.kind) && r.w >= 40 && r.h >= 40);
  if (!buildings.length) return;
  const enclosedBy = (r: Rect) => buildings.find((b) => b !== r
    && r.x >= b.x - 2 && r.x + r.w <= b.x + b.w + 2
    && r.y >= b.y - 2 && r.y + r.h <= b.y + b.h + 2);
  const occupied = rects.filter((r) => !DECOR.has(r.kind));
  for (const r of rects) {
    if (!DECOR.has(r.kind) && !SOLID_PROP.has(r.kind)) continue;
    const host = enclosedBy(r);
    if (!host) continue;
    // Step out through the nearest side and look for open ground along that facade.
    const gaps = [
      { x: host.x - r.w - 12, y: r.y }, { x: host.x + host.w + 12, y: r.y },
      { x: r.x, y: host.y - r.h - 12 }, { x: r.x, y: host.y + host.h + 12 },
    ].sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y));
    let moved = false;
    for (const g of gaps) {
      for (let k = 0; k < 6 && !moved; k++) {
        const box = { x: g.x, y: g.y + (g.x !== r.x ? k * (r.h + 26) * (k % 2 ? 1 : -1) : 0), w: r.w, h: r.h };
        box.y = g.y + (k === 0 ? 0 : Math.ceil(k / 2) * (r.h + 26) * (k % 2 ? 1 : -1));
        if (box.x < 40 || box.y < 40) continue;
        if (occupied.some((o) => o !== r && overlapArea(box, o) > 0)) continue;
        r.x = box.x; r.y = box.y;
        moved = true;
        report.propsMoved++;
      }
      if (moved) break;
    }
  }
}

/** Props heavy enough to be worth lifting out of a building (trees and rocks are scenery). */
const SOLID_PROP = new Set<StructKind>([
  'truck', 'car', 'humvee', 'bus', 'tanker', 'crate', 'barrel', 'tent', 'bladder', 'lamp', 'sign',
  'busstop', 'billboard', 'antenna', 'radar', 'target', 'checkpoint', 'barrier',
]);

/**
 * Run the whole pass. Returns what was changed, so the report and the headless tests
 * can assert that the map really was tidied.
 */
export function tidyWorld(input: TidyInput): TidyReport {
  const report = emptyReport();
  // Order matters: roads are cut around the buildings first, then the kit is placed on
  // the clean ground that is left, and the pads are the last word on the aprons.
  tidyBuildings(input.rects, report);
  clipWalls(input.rects, report);
  tidyShells(input.rects, report);
  tidyProps(input.rects, report);
  clipRoads(input.rects, input.zones, report);
  // Roads are final by now, so a wall can be opened exactly where the tarmac meets it.
  openRoadGates(input.rects, input.zones, report);
  if (input.army) openInternalGates(input.rects, input.zones, input.army, report);
  tidyVans(input.rects, input.zones, input.vanSpots, report);
  tidyHelipads(input.rects, input.zones, input.helipads, report);
  if (input.army) tidyArmy(input.army, input.rects, input.zones, report);
  // Parked Hydra-side helicopters obey the same rule as the army's.
  const buildings = input.rects.filter((r) => !DECOR.has(r.kind));
  for (const p of input.parkedHelis) {
    const spot = freeSpot(p.x, p.y, (x, y) => ({ x: x - 78, y: y - 78, w: 156, h: 156 }), buildings, 6);
    if (spot) { p.x = spot.x; p.y = spot.y; }
  }
  return report;
}
