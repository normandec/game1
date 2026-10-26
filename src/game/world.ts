/* ------------------------------------------------------------------ *
 * IRON VEIL — World generation & spatial index
 * 10x larger theatre with a colossal fortress HQ.
 * ------------------------------------------------------------------ */

import { PRISON_EAST } from './prisonIsland';
import { ARMY_SOUTH, buildArmyDistrict, type ArmyPlan } from './army';
import { dressSector, type SectorDressing } from './sectorKits';
import { buildSectorAnnex } from './annex';
import { populateFacilities, type Facility, type FacilityGuard } from './facilities';
import {
  addCampaignSites, GOLIATH, MNEMOSYNE, HQ_YARD, KRAKEN_YARD, type CampaignSites, type PatrolRoute,
} from './campaignSites';
import { buildPowerYard, type PowerCell, type PowerSite } from './powerGrid';
import { tidyWorld } from './tidy';

/**
 * The legacy theatre is 12000 × 8200, and it is NEVER moved: not a single existing
 * structure changes coordinates when the prison is added. Instead the world is extended
 * eastward by PRISON_EAST metres of brand-new ground (open water, the island and its
 * causeway bridge). Generation below still runs in the legacy frame; the expansion is
 * laid on top of the untouched map.
 */
const GEN_W = 12000;
export const GEN_H = 8200;
export const ARENA_W = GEN_W + PRISON_EAST;
/** The army district is new ground SOUTH of the legacy frame: nothing above it moves. */
export const ARENA_H = GEN_H + ARMY_SOUTH;
/** South edge of the legacy theatre: the army ground begins here. */
export const LEGACY_H = GEN_H;
export { ARMY_SOUTH };
/** East edge of the legacy theatre: the new ground begins here. */
export const LEGACY_W = GEN_W;

export interface SectorTheme {
  id: number; name: string; codename: string; brief: string;
  ground: string; grid: string; haze: string; accent: string;
  weather: 'rain' | 'dust' | 'snow' | 'toxic' | 'ash';
}

export const SECTORS: SectorTheme[] = [
  { id: 1, name: 'THE FALLEN HUB', codename: 'BLACK BADGE', brief: 'Retake the first occupied S.H.I.E.L.D. command hub.', ground: '#0e1512', grid: '90,150,135', haze: '18,42,36', accent: '#66e5c4', weather: 'rain' },
  { id: 2, name: 'RED MESA ARSENAL', codename: 'SCORCHED SPEAR', brief: 'Hydra armor production beneath a red desert fortress.', ground: '#1b130e', grid: '180,125,82', haze: '80,42,20', accent: '#ffad66', weather: 'dust' },
  { id: 3, name: 'ARCTIC RELAY', codename: 'WHITE STATIC', brief: 'A frozen satellite citadel protected by shield regiments.', ground: '#111a1d', grid: '135,185,205', haze: '72,115,135', accent: '#9fe8ff', weather: 'snow' },
  { id: 4, name: 'VENOM MARSH', codename: 'GREEN CROWN', brief: 'A toxic research base fielding experimental Hydra units.', ground: '#10170d', grid: '115,170,82', haze: '48,82,26', accent: '#a6ff70', weather: 'toxic' },
  { id: 5, name: 'HYDRA NEXUS', codename: 'TRIPLE SERPENT', brief: 'The final underground-overground supreme command fortress.', ground: '#150d10', grid: '190,70,90', haze: '75,16,28', accent: '#ff526f', weather: 'ash' },
  { id: 6, name: 'IRON RESERVE', codename: 'VOJSKA', brief: 'The army that was never sent: a thousand boots in ranks, and everything they own aimed at you.', ground: '#121512', grid: '160,175,140', haze: '34,42,30', accent: '#cfd8a8', weather: 'dust' },
];

export type StructKind =
  | 'wall' | 'bunker' | 'crate' | 'sandbag'
  | 'curtain' | 'tower' | 'keep' | 'barrack' | 'gate' | 'pillar' | 'server'
  | 'truck' | 'antenna' | 'hangar' | 'fence' | 'vault'
  | 'laboratory' | 'radar' | 'motorpool' | 'power' | 'armory' | 'checkpoint' | 'warehouse' | 'library'
  | 'plane'
  // ISLAND PRISON (eastern ground): its own materials, so nothing on the island is drawn
  // with the labels and textures of a legacy Hydra base.
  | 'pine' | 'rock' | 'boat' | 'bastion' | 'cellblock' | 'lighthouse' | 'barrier'
  // ARMY DISTRICT: its own vocabulary, so the base never reads like a Hydra outpost.
  | 'tank' | 'barrel' | 'console'
  // ARMY STRONGPOINTS: a national army group builds very differently from Hydra.
  | 'rampart' | 'silo' | 'dronebay' | 'railcar' | 'crane' | 'gantry'
  | 'launcher' | 'howitzer' | 'tent' | 'bladder' | 'target'
  // ARMY MEGASTRUCTURES: the base is a national installation, not a camp.
  | 'megahangar' | 'towerblock' | 'watertower' | 'radome' | 'stockade' | 'kazemat'
  // ARCTIC: the frozen gate that opens into the hidden ice base.
  | 'icegate'
  // Motor pool and the roads: civilian and military vehicles, parked and solid.
  | 'car' | 'humvee' | 'bus' | 'tanker'
  // ROADSIDE INFRASTRUCTURE: the things that make a road read as a road from above —
  // street lighting, signage, propaganda hoardings, the power line that feeds the district.
  | 'lamp' | 'sign' | 'billboard' | 'pylon' | 'busstop';

export interface Rect {
  x: number; y: number; w: number; h: number;
  kind: StructKind;
  h3d: number;      // extrusion height for the 2.5D look
  tint?: string;
  hp?: number; dead?: boolean;
  facilityDetail?: boolean;
  maxHp?: number; structuralGroup?: number;
  /** Army shutter: the outer causeway gate or the powered inner blast gate. */
  armyGate?: 'outer' | 'inner';
  /** Which gatehouse this leaf belongs to, and the size of the whole gate. The renderer
   *  needs all three to draw one frame around two leaves split into four sections. */
  armyGateId?: string;
  armyGateW?: number;
  armyGateH?: number;
  /** Army rampart: reinforced concrete, far tougher than a Hydra curtain wall. */
  armyWall?: boolean;
}

export interface Zone {
  x: number; y: number; w: number; h: number;
  kind: 'road' | 'concrete' | 'sand' | 'grass' | 'blood' | 'plaza' | 'helipad' | 'fuel' | 'runway' | 'parade'
  /** Poured hardstanding: darker than the ground, with expansion joints. */
  | 'apron'
  /** Flooded north-west lagoon that carries the prison island. Additive: drawn under everything. */
  | 'lagoon'
  /** Prison-island lawn: the same ground as grass, only greener so the island reads as land. */
  | 'lawn'
  /* Sector dressing: each of these is painted in its own pass, additively. */
  | 'snow' | 'ice' | 'marsh' | 'slag' | 'puddle';
}

/** A hangar looks sealed from outside; its roof splits open once you step inside. */
export interface HangarDef {
  x: number; y: number; w: number; h: number;
  doorX: number; doorY: number;
}

export type PoiKind = 'airfield' | 'peggy' | 'vault' | 'laser' | 'depot' | 'library';
export interface PoiDef {
  id: string; kind: PoiKind;
  x: number; y: number; r: number;
  name: string; sub: string;
  secret: boolean;
  gates: { x: number; y: number }[];
  /**
   * A soft target: not an objective and not capturable, but marked on the map from the
   * first frame, because the whole point of a thinly held barracks or a dispersal strip
   * is that an operative can find it and take it before the alarm goes up.
   */
  soft?: boolean;
}

/* Fortress layout (center-north of the map). These are final world coordinates. */
const CORE_HQ = { cx: GEN_W / 2, cy: 2150, w: 3900, h: 2950 };
export const HQ = { ...CORE_HQ };

const CORE_PLAYER_START = { x: GEN_W / 2, y: GEN_H - 1400 };
export const PLAYER_START = { ...CORE_PLAYER_START };
const CORE_VAULT_ENTRY = { x: 980, y: 7040 };
export const VAULT_ENTRY = { ...CORE_VAULT_ENTRY };
const CORE_AIRFIELD = { x: 9650, y: 4400, w: 3300, h: 2500 };
export const AIRFIELD = { ...CORE_AIRFIELD };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* Spatial hash — essential at this map size                           */
/* ------------------------------------------------------------------ */

export class SpatialGrid {
  cell = 420;
  cols = 0;
  rows = 0;
  buckets: number[][] = [];

  build(rects: Rect[]) {
    this.cols = Math.ceil(ARENA_W / this.cell);
    this.rows = Math.ceil(ARENA_H / this.cell);
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
    rects.forEach((r, idx) => {
      const x0 = Math.max(0, Math.floor(r.x / this.cell));
      const x1 = Math.min(this.cols - 1, Math.floor((r.x + r.w) / this.cell));
      const y0 = Math.max(0, Math.floor(r.y / this.cell));
      const y1 = Math.min(this.rows - 1, Math.floor((r.y + r.h) / this.cell));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) this.buckets[y * this.cols + x].push(idx);
      }
    });
  }

  /** Unique obstacle indices overlapping an AABB. */
  query(x: number, y: number, w: number, h: number, out: Set<number>) {
    out.clear();
    const x0 = Math.max(0, Math.floor(x / this.cell));
    const x1 = Math.min(this.cols - 1, Math.floor((x + w) / this.cell));
    const y0 = Math.max(0, Math.floor(y / this.cell));
    const y1 = Math.min(this.rows - 1, Math.floor((y + h) / this.cell));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const b = this.buckets[gy * this.cols + gx];
        for (let i = 0; i < b.length; i++) out.add(b[i]);
      }
    }
    return out;
  }

  /** Fast point test bucket. */
  at(x: number, y: number): number[] {
    const gx = Math.floor(x / this.cell), gy = Math.floor(y / this.cell);
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return EMPTY;
    return this.buckets[gy * this.cols + gx];
  }
}
const EMPTY: number[] = [];

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export interface WorldData {
  /** What the survey pass had to move or cut (report / tests only). */
  tidy: import('./tidy').TidyReport;
  rects: Rect[];
  zones: Zone[];
  serverSpots: { x: number; y: number }[];
  generalSpot: { x: number; y: number };
  coderSpots: { x: number; y: number }[];
  garrisonSpots: { x: number; y: number }[];
  cacheSpots: { x: number; y: number }[];
  gateSpots: { x: number; y: number }[];
  helipads: { x: number; y: number }[];
  hangarSpot: { x: number; y: number };
  beaconSpots: { x: number; y: number }[];
  satcomSpots: { x: number; y: number }[];
  barrelSpots: { x: number; y: number }[];
  spotlightSpots: { x: number; y: number; speed: number; sweep: number; site?: string }[];
  hangars: HangarDef[];
  vanSpots: { x: number; y: number; ang: number }[];
  paradeSpots: { x: number; y: number; type: string }[];
  parkedHelis: { x: number; y: number; ang: number }[];
  laserSpots: { x: number; y: number }[];
  pois: PoiDef[];
  vaultSpot: { x: number; y: number };
  planeSpot: { x: number; y: number };
  facilities: Facility[];
  facilityGuards: FacilityGuard[];
  campaignSites: CampaignSites;
  /** Surface dressing for this sector: snow, drifts, plough lanes, regiment, insertion. */
  dressing: SectorDressing;
  /** The IRON RESERVE ground, present only in sector 6. */
  army: ArmyPlan | null;
  /** Drivable traffic circuits, sampled from the painted road network. */
  trafficRoutes: { x: number; y: number }[][];
  /** Massed ranks (the army parade): position plus unit type. */
  ranks: { x: number; y: number; type: string }[];
  /** Soldiers holding named strongpoints, seeded as garrison enemies. */
  armyGuards: { x: number; y: number; type: string }[];
  /** Sector 3: the glacier gate that leads into the hidden ice base, if present. */
  glacier: { x: number; y: number } | null;
  /** Every defended generator/server yard on the map, biggest first. */
  powerSites: PowerSite[];
  powerCells: PowerCell[];
}

/**
 * TRAFFIC FROM THE TARMAC.
 *
 * The circuits used to be authored by hand and then the district was built on top of
 * them, so cars drove through hangars, ramparts and the parade. Instead the road network
 * is sampled: every painted road is walked in 50 m steps, a step counts as drivable only
 * when the whole width of the carriageway is clear of structures, and each clear run
 * becomes a two-lane circuit (out on one lane, back on the other). Whatever the base
 * grows afterwards, the traffic can only ever use road that is actually open.
 */
function trafficFromRoads(
  roads: { x: number; y: number; w: number; h: number }[],
  blocks: Rect[],
): { x: number; y: number }[][] {
  const circuits: { x: number; y: number }[][] = [];
  const solid = (x: number, y: number, pad: number) => blocks.some((r) =>
    x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
  for (const road of roads) {
    const horizontal = road.w >= road.h;
    const long = horizontal ? road.w : road.h;
    const wide = horizontal ? road.h : road.w;
    if (long < 520 || wide < 96) continue;
    const cx = road.x + road.w / 2, cy = road.y + road.h / 2;
    const lane = Math.max(22, Math.min(34, wide / 2 - 22));
    const step = 50;
    const steps = Math.floor((long - 120) / step);
    let runStart = -1;
    const flush = (from: number, to: number) => {
      if (from < 0 || (to - from) * step < 620) return;
      const a = -long / 2 + 60 + from * step;
      const b = -long / 2 + 60 + to * step;
      // Two lanes: down one side of the carriageway, back up the other. The first point
      // is where the cars enter, so a circuit never starts inside a junction box.
      circuits.push(horizontal
        ? [{ x: cx + a, y: cy - lane }, { x: cx + b, y: cy - lane },
          { x: cx + b, y: cy + lane }, { x: cx + a, y: cy + lane }]
        : [{ x: cx - lane, y: cy + a }, { x: cx - lane, y: cy + b },
          { x: cx + lane, y: cy + b }, { x: cx + lane, y: cy + a }]);
    };
    for (let i = 0; i <= steps; i++) {
      const along = -long / 2 + 60 + i * step;
      const px = horizontal ? cx + along : cx;
      const py = horizontal ? cy : cy + along;
      // The full carriageway has to be clear, not just the centre line: a car is wide.
      const clear = !solid(px, py - lane, 14) && !solid(px, py + lane, 14) && !solid(px, py, 14);
      if (clear) { if (runStart < 0) runStart = i; }
      else { flush(runStart, i); runStart = -1; }
    }
    flush(runStart, steps);
  }
  /* Every candidate circuit is then walked as a real polyline: a car is longer than a
   * sample, so a lap is only kept when the whole loop, corners included, is open. Short
   * blocked ends are trimmed back; a lap that cannot be cleaned is dropped. */
  const polylineClear = (route: { x: number; y: number }[], pad: number) => {
    for (let i = 0; i < route.length; i++) {
      const a = route[i], b = route[(i + 1) % route.length];
      const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 35));
      for (let k = 0; k < steps; k++) {
        if (solid(a.x + (b.x - a.x) * k / steps, a.y + (b.y - a.y) * k / steps, pad)) return false;
      }
    }
    return true;
  };
  const cleaned: { x: number; y: number }[][] = [];
  for (const route of circuits) {
    let ok: { x: number; y: number }[] | null = null;
    for (let trim = 0; trim <= 8 && !ok; trim++) {
      const shrink = trim * 60;
      const horizontal = Math.abs(route[1].x - route[0].x) > Math.abs(route[1].y - route[0].y);
      const a = { ...route[0] }, b = { ...route[1] };
      const a2 = { ...route[3] }, b2 = { ...route[2] };
      if (horizontal) {
        const dir = Math.sign(b.x - a.x) || 1;
        if (Math.abs(b.x - a.x) - shrink * 2 < 500) break;
        a.x += dir * shrink; a2.x += dir * shrink;
        b.x -= dir * shrink; b2.x -= dir * shrink;
      } else {
        const dir = Math.sign(b.y - a.y) || 1;
        if (Math.abs(b.y - a.y) - shrink * 2 < 500) break;
        a.y += dir * shrink; a2.y += dir * shrink;
        b.y -= dir * shrink; b2.y -= dir * shrink;
      }
      const candidate = [a, b, b2, a2];
      if (polylineClear(candidate, 22)) ok = candidate;
    }
    if (ok) cleaned.push(ok);
  }
  // Longest and most useful first, and never more circuits than the base can fill.
  cleaned.sort((a, b) => {
    const len = (c: { x: number; y: number }[]) =>
      Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) + Math.hypot(c[3].x - c[2].x, c[3].y - c[2].y);
    return len(b) - len(a);
  });
  return cleaned.slice(0, 9);
}

export function generateWorld(sector = 1): WorldData {
  const rects: Rect[] = [];
  const zones: Zone[] = [];
  const serverSpots: { x: number; y: number }[] = [];
  const coderSpots: { x: number; y: number }[] = [];
  const garrisonSpots: { x: number; y: number }[] = [];
  const cacheSpots: { x: number; y: number }[] = [];
  const gateSpots: { x: number; y: number }[] = [];
  const helipads: { x: number; y: number }[] = [];
  const beaconSpots: { x: number; y: number }[] = [];
  const satcomSpots: { x: number; y: number }[] = [];
  const barrelSpots: { x: number; y: number }[] = [];
  const spotlightSpots: { x: number; y: number; speed: number; sweep: number; site?: string }[] = [];
  const hangars: HangarDef[] = [];
  const vanSpots: { x: number; y: number; ang: number }[] = [];
  const paradeSpots: { x: number; y: number; type: string }[] = [];
  const parkedHelis: { x: number; y: number; ang: number }[] = [];
  const laserSpots: { x: number; y: number }[] = [];
  /** Ground owned by named installations: never scatter clutter or outposts on it. */
  const reservedSites: { x: number; y: number; w: number; h: number }[] = [];
  // THE CAGE: the whole eastern extension is new ground — nothing random may be built
  // there, and the eastern rampart is opened so the two halves join into one map.
  reservedSites.push({ x: GEN_W - 400, y: 0, w: PRISON_EAST + 400, h: GEN_H });
  const pois: PoiDef[] = [];
  const facilities: Facility[] = [];
  const facilityGuards: FacilityGuard[] = [];

  const add = (x: number, y: number, w: number, h: number, kind: StructKind, h3d = 14, tint?: string) => {
    const r: Rect = { x, y, w, h, kind, h3d, tint };
    if (w > 0 && h > 0) rects.push(r);
    return r;
  };
  /** A soldier may not stand inside a wall. Nudge the post to the nearest clear spot. */
  const freeGuardPost = (g: { x: number; y: number; type: string }) => {
    const clear = (x: number, y: number) => !rects.some((r) =>
      x > r.x - 18 && x < r.x + r.w + 18 && y > r.y - 18 && y < r.y + r.h + 18);
    if (clear(g.x, g.y)) return g;
    for (const r of [60, 110, 170, 240, 320]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = g.x + Math.cos(a) * r, y = g.y + Math.sin(a) * r;
        if (clear(x, y)) return { x, y, type: g.type };
      }
    }
    return null;
  };
  /* Map border ramparts are added after the westward expansion (see the tail of this
   * function): they have to enclose the widened arena, not the legacy frame. */

  /* ---------------- THE FORTRESS ---------------- */
  const { cx, cy, w: FW, h: FH } = CORE_HQ;
  const L = cx - FW / 2, T = cy - FH / 2, R = cx + FW / 2, Bo = cy + FH / 2;
  // South-central aircraft bay: clear runway access through the main gate.
  const hangarSpot = { x: cx, y: Bo - 300 };

  zones.push({ x: L - 180, y: T - 180, w: FW + 360, h: FH + 360, kind: 'concrete' });

  const CT = 56;   // curtain thickness
  const GAP = 280; // Wide enough for an armored transport and hydraulic gate.

  // South curtain (main gate)
  add(L, Bo - CT, FW / 2 - GAP / 2, CT, 'curtain', 46);
  add(cx + GAP / 2, Bo - CT, FW / 2 - GAP / 2, CT, 'curtain', 46);
  gateSpots.push({ x: cx, y: Bo - CT / 2 });
  // North curtain (sally port)
  add(L, T, FW / 2 - GAP / 2, CT, 'curtain', 46);
  add(cx + GAP / 2, T, FW / 2 - GAP / 2, CT, 'curtain', 46);
  gateSpots.push({ x: cx, y: T + CT / 2 });
  // East / West curtains with side gates
  add(L, T + CT, CT, FH / 2 - CT - GAP / 2, 'curtain', 46);
  add(L, cy + GAP / 2, CT, FH / 2 - CT - GAP / 2, 'curtain', 46);
  add(R - CT, T + CT, CT, FH / 2 - CT - GAP / 2, 'curtain', 46);
  add(R - CT, cy + GAP / 2, CT, FH / 2 - CT - GAP / 2, 'curtain', 46);
  gateSpots.push({ x: L + CT / 2, y: cy }, { x: R - CT / 2, y: cy });

  // Corner towers
  const TW = 190;
  const towers: [number, number][] = [
    [L - 40, T - 40], [R - TW + 40, T - 40],
    [L - 40, Bo - TW + 40], [R - TW + 40, Bo - TW + 40],
  ];
  for (const [tx, ty] of towers) {
    add(tx, ty, TW, TW, 'tower', 74);
    garrisonSpots.push({ x: tx + TW / 2, y: ty + TW / 2 + 130 });
  }

  // Gatehouse bastions flanking the south gate
  add(cx - GAP / 2 - 130, Bo - CT - 90, 130, 150, 'tower', 62);
  add(cx + GAP / 2, Bo - CT - 90, 130, 150, 'tower', 62);
  garrisonSpots.push({ x: cx - 210, y: Bo - 220 }, { x: cx + 210, y: Bo - 220 });

  /* ---- Outer bailey: barracks blocks + defensive lanes ---- */
  const bail = (bx: number, by: number, bw: number, bh: number) => {
    add(bx, by, bw, bh, 'barrack', 40);
    garrisonSpots.push({ x: bx + bw / 2, y: by + bh + 70 });
  };
  bail(L + 190, T + 200, 420, 210);
  bail(R - 610, T + 200, 420, 210);
  bail(L + 190, Bo - 410, 420, 210);
  bail(R - 610, Bo - 410, 420, 210);

  // Second defensive ring. Four breaches preserve routes while making the enlarged fortress feel layered.
  const RW = 2380, RH = 1640, RT = 38, RG = 240;
  add(cx - RW / 2, cy - RH / 2, RW / 2 - RG / 2, RT, 'curtain', 36);
  add(cx + RG / 2, cy - RH / 2, RW / 2 - RG / 2, RT, 'curtain', 36);
  add(cx - RW / 2, cy + RH / 2 - RT, RW / 2 - RG / 2, RT, 'curtain', 36);
  add(cx + RG / 2, cy + RH / 2 - RT, RW / 2 - RG / 2, RT, 'curtain', 36);
  add(cx - RW / 2, cy - RH / 2 + RT, RT, RH / 2 - RT - RG / 2, 'curtain', 36);
  add(cx - RW / 2, cy + RG / 2, RT, RH / 2 - RT - RG / 2, 'curtain', 36);
  add(cx + RW / 2 - RT, cy - RH / 2 + RT, RT, RH / 2 - RT - RG / 2, 'curtain', 36);
  add(cx + RW / 2 - RT, cy + RG / 2, RT, RH / 2 - RT - RG / 2, 'curtain', 36);
  gateSpots.push(
    { x: cx, y: cy + RH / 2 - RT / 2 }, { x: cx, y: cy - RH / 2 + RT / 2 },
    { x: cx - RW / 2 + RT / 2, y: cy }, { x: cx + RW / 2 - RT / 2, y: cy },
  );

  // Hydra advanced-tech wings around the inner keep.
  bail(cx - 1080, cy - 300, 340, 520);
  bail(cx + 740, cy - 300, 340, 520);
  bail(cx - 540, cy - 760, 360, 190);
  bail(cx + 180, cy - 760, 360, 190);

  // Interior blast walls creating a maze-y approach
  add(cx - 760, cy - 430, 40, 320, 'wall', 30);
  add(cx + 720, cy - 430, 40, 320, 'wall', 30);
  add(cx - 760, cy + 110, 40, 320, 'wall', 30);
  add(cx + 720, cy + 110, 40, 320, 'wall', 30);
  add(cx - 470, Bo - 620, 320, 40, 'wall', 30);
  add(cx + 150, Bo - 620, 320, 40, 'wall', 30);

  // Sandbag nests in the bailey
  const nest = (nx: number, ny: number) => {
    add(nx - 70, ny - 14, 140, 28, 'sandbag', 16);
    garrisonSpots.push({ x: nx, y: ny + 60 });
  };
  nest(cx - 420, Bo - 300);
  nest(cx + 420, Bo - 300);
  nest(cx - 420, T + 480);
  nest(cx + 420, T + 480);

  /* ---- INNER KEEP: Supreme Command ---- */
  const KW = 1080, KH = 720;
  const kL = cx - KW / 2, kT = cy - KH / 2 - 40;
  const KT = 46;
  const KGAP = 220;
  zones.push({ x: kL - 60, y: kT - 60, w: KW + 120, h: KH + 120, kind: 'plaza' });

  // Keep walls with a single south entrance — a real chokepoint
  add(kL, kT, KW, KT, 'keep', 66);                                   // north
  add(kL, kT, KT, KH, 'keep', 66);                                   // west
  add(kL + KW - KT, kT, KT, KH, 'keep', 66);                         // east
  add(kL, kT + KH - KT, KW / 2 - KGAP / 2, KT, 'keep', 66);          // south-left
  add(cx + KGAP / 2, kT + KH - KT, KW / 2 - KGAP / 2, KT, 'keep', 66); // south-right
  gateSpots.push({ x: cx, y: kT + KH - KT / 2 });

  // Interior pillars
  add(kL + 210, kT + 190, 54, 54, 'pillar', 58);
  add(kL + KW - 264, kT + 190, 54, 54, 'pillar', 58);
  add(kL + 210, kT + KH - 244, 54, 54, 'pillar', 58);
  add(kL + KW - 264, kT + KH - 244, 54, 54, 'pillar', 58);

  // 6 server banks (the AI mainframes) along the keep interior
  const sy1 = kT + 150, sy2 = kT + KH - 210;
  const sxs = [kL + 330, cx, kL + KW - 330];
  for (const sx of sxs) {
    serverSpots.push({ x: sx, y: sy1 });
    serverSpots.push({ x: sx, y: sy2 });
  }

  // The General's command dais (dead center of the keep)
  let generalSpot = { x: cx, y: kT + KH / 2 };

  // Programmers work the terminals — clustered around the servers
  for (const s of serverSpots) {
    coderSpots.push({ x: s.x + rnd(-60, 60), y: s.y + (s.y < cy ? 74 : -74) });
  }
  coderSpots.push({ x: cx - 190, y: generalSpot.y + 40 });
  coderSpots.push({ x: cx + 190, y: generalSpot.y + 40 });

  // Keep garrison
  garrisonSpots.push(
    { x: cx - 300, y: kT + 300 }, { x: cx + 300, y: kT + 300 },
    { x: cx - 300, y: kT + KH - 300 }, { x: cx + 300, y: kT + KH - 300 },
    { x: cx, y: kT + KH - 150 },
  );

  /* ---- Fortress interior: hangars, motor pools, workshops, defences ---- */
  const bailW = L + CT, bailE = R - CT;
  const ringL = cx - RW / 2, ringR = cx + RW / 2, ringT = cy - RH / 2, ringB = cy + RH / 2;
  const zone = (x: number, y: number, w: number, h: number, kind: Zone['kind']) => zones.push({ x, y, w, h, kind });

  // West bailey: two covered aircraft bays feeding the ring gate.
  for (const [hx, hy] of [[bailW + 26, T + 480], [bailW + 26, T + 1400]] as [number, number][]) {
    const HW = 500, HH = 700, HT = 30, HDOOR = 250;
    add(hx, hy, HW, HT, 'hangar', 62);
    add(hx, hy, HT, HH, 'hangar', 62);
    add(hx, hy + HH - HT, HW, HT, 'hangar', 62);
    add(hx + HW - HT, hy + HT, HT, HH / 2 - HT - HDOOR / 2, 'hangar', 62);
    add(hx + HW - HT, hy + HH / 2 + HDOOR / 2, HT, HH / 2 - HT - HDOOR / 2, 'hangar', 62);
    hangars.push({ x: hx, y: hy, w: HW, h: HH, doorX: hx + HW - HT / 2, doorY: hy + HH / 2 });
    parkedHelis.push({ x: hx + HW / 2 - 60, y: hy + HH / 2, ang: 0 });
    zone(hx - 40, hy - 40, HW + 120, HH + 80, 'concrete');
    garrisonSpots.push({ x: hx + HW + 90, y: hy + 120 }, { x: hx + HW + 90, y: hy + HH - 120 });
    barrelSpots.push({ x: hx + 70, y: hy + HH - 90 });
  }
  // East bailey: signals annex, comms mast, armour workshop and a van park.
  add(bailE - 660, T + 470, 620, 480, 'server', 44);
  for (let i = 0; i < 3; i++) add(bailE - 620 + i * 40, T + 520 + i * 130, 540, 36, 'server', 26);
  add(cx + 200, T + 155, 80, 250, 'antenna', 54);
  add(bailE - 660, T + 1780, 620, 440, 'motorpool', 40);
  add(bailE - 600, T + 1840, 180, 300, 'motorpool', 24);
  add(bailE - 300, T + 1840, 180, 300, 'motorpool', 24);
  for (let i = 0; i < 5; i++) vanSpots.push({ x: bailE - 620 + i * 130, y: T + 1075, ang: 0 });   // open band: annex above, motorpool below
  zone(bailE - 700, T + 430, 700, 560, 'concrete');
  zone(bailE - 700, T + 1740, 700, 820, 'concrete');
  garrisonSpots.push({ x: bailE - 350, y: T + 1000 }, { x: bailE - 350, y: T + 2300 });
  cacheSpots.push({ x: bailE - 120, y: T + 980 }, { x: bailE - 560, y: T + 1050 });

  // North bailey: drill yard plus two ranks of parked transports.
  zone(cx - 1250, T + CT + 60, 2500, 560, 'parade');
  for (let i = 0; i < 4; i++) {
    vanSpots.push({ x: cx - 1180 + i * 250, y: T + 160, ang: Math.PI / 2 });
    vanSpots.push({ x: cx - 1180 + i * 250, y: T + 380, ang: Math.PI / 2 });
    vanSpots.push({ x: cx + 420 + i * 250, y: T + 160, ang: Math.PI / 2 });
    vanSpots.push({ x: cx + 420 + i * 250, y: T + 380, ang: Math.PI / 2 });
  }
  for (let i = 0; i < 10; i++) paradeSpots.push({ x: cx - 1080 + i * 240, y: T + 600, type: i % 3 === 0 ? 'shieldman' : 'grunt' });
  // Cover in the gap between the two van parks: clear of the keep wall, the parade
  // ground and the north-bailey helipad.
  for (const sx of [cx - 260, cx + 190]) add(sx, T + 175, 100, 300, 'sandbag', 18);

  // South bailey: fuel farm, ready platoon, extra emplacements and van ranks.
  for (let i = 0; i < 3; i++) {
    add(cx + 950 + i * 210, Bo - 620, 170, 170, 'pillar', 40);
    barrelSpots.push({ x: cx + 1010 + i * 210, y: Bo - 810 });
  }
  zone(cx + 910, Bo - 660, 740, 260, 'fuel');
  for (let i = 0; i < 4; i++) vanSpots.push({ x: L + 760 + i * 120, y: Bo - 250, ang: 0 });
  for (let i = 0; i < 4; i++) vanSpots.push({ x: R - 1240 + i * 120, y: Bo - 250, ang: 0 });
  zone(R - 1300, Bo - 300, 560, 260, 'concrete');
  for (const sx of [cx - 1500, cx + 1500]) {
    add(sx - 130, Bo - 190, 260, 40, 'sandbag', 26);
    garrisonSpots.push({ x: sx, y: Bo - 250 });
  }
  for (let i = 0; i < 5; i++) add(L + 200 + i * 160, Bo - 780, 120, 120, 'crate', 34);
  garrisonSpots.push({ x: cx - 1400, y: Bo - 480 }, { x: cx + 1780, y: Bo - 480 });
  cacheSpots.push({ x: cx - 1400, y: Bo - 640 }, { x: L + 900, y: Bo - 480 });

  // Abandoned warehouse, south-west corner of the bailey: a low, weathered shed
  // with a caved-in south wall, an east door and old debris still inside.
  {
    const abW = 380, abH = 200, abT = 30;
    const abX = L + 96, abY = Bo - 630;
    const tint = '#4c5250';
    zone(abX - 34, abY - 30, abW + 68, abH + 66, 'concrete');
    // Standing shell: north and west walls, a split east wall with a door.
    add(abX, abY, abW, abT, 'warehouse', 34, tint);
    add(abX, abY, abT, abH, 'warehouse', 34, tint);
    add(abX + abW - abT, abY, abT, 70, 'warehouse', 34, tint);
    add(abX + abW - abT, abY + 130, abT, abH - 130, 'warehouse', 34, tint);
    // The south wall has caved in: two stubs and rubble in the breach.
    add(abX, abY + abH - abT, 140, abT, 'warehouse', 30, tint);
    add(abX + abW - abT - 120, abY + abH - abT, 120, abT, 'warehouse', 30, tint);
    add(abX + 150, abY + abH - 26, 40, 26, 'crate', 14, tint);
    add(abX + abW + 20, abY + 30, 30, 24, 'crate', 8, tint);
    // Forgotten stock left to rot under the leaking roof.
    add(abX + 60, abY + 54, 50, 42, 'crate', 22);
    add(abX + 130, abY + 112, 40, 32, 'crate', 16);
    add(abX + 220, abY + 50, 56, 40, 'crate', 26);
    add(abX + 290, abY + 118, 44, 32, 'crate', 20);
    barrelSpots.push({ x: abX + 40, y: abY + 46 }, { x: abX + 300, y: abY + 42 }, { x: abX + 250, y: abY + 130 });
  }

  // Inside the second ring: barracks, armoury cages, an inner motor pool and a pad.
  add(ringL + 60, ringB - 470, 520, 320, 'barrack', 40);
  add(ringR - 580, ringT + 60, 520, 300, 'bunker', 40);
  for (let i = 0; i < 4; i++) add(ringR - 560 + i * 140, ringB - 420, 110, 250, 'crate', 32);
  zone(ringL + 40, ringB - 500, 600, 400, 'concrete');
  zone(ringR - 620, ringB - 460, 600, 340, 'concrete');
  for (let i = 0; i < 3; i++) vanSpots.push({ x: ringL + 100 + i * 170, y: ringT + 90, ang: Math.PI / 2 });
  zone(ringL + 60, ringT + 40, 620, 320, 'concrete');
  for (let i = 0; i < 8; i++) paradeSpots.push({ x: cx - 100 + (i % 2) * 160, y: ringT + 70 + Math.floor(i / 2) * 80, type: i < 4 ? 'gunner' : 'grunt' });
  garrisonSpots.push({ x: ringL + 320, y: ringB - 520 }, { x: ringR - 320, y: ringT + 400 },
    { x: ringL + 320, y: ringT + 400 }, { x: ringR - 320, y: ringB - 520 });

  // Keep interior furnishing: lockers and an ammo crate (servers/dais stay put).
  add(kL + KW - 116, kT + 90, 46, 120, 'keep', 26);
  add(kL + KW - 116, kT + KH - 210, 46, 120, 'keep', 26);
  add(kL + 160, kT + KH - 140, 110, 90, 'crate', 30);
  cacheSpots.push({ x: kL + 150, y: kT + KH / 2 + 90 }, { x: kL + KW - 160, y: kT + KH / 2 });

  /* ---------------- OUTER WORLD: districts ---------------- */
  const noOverlap = (x: number, y: number, w: number, h: number, pad: number) => {
    // never build inside the fortress footprint
    if (x < R + 260 && x + w > L - 260 && y < Bo + 260 && y + h > T - 260) return false;
    // keep the player's landing zone clear
    if (Math.hypot(x + w / 2 - CORE_PLAYER_START.x, y + h / 2 - CORE_PLAYER_START.y) < 620) return false;
    // Reserve installations and road corridors before random cover is placed.
    if (x < CORE_AIRFIELD.x + CORE_AIRFIELD.w / 2 + 120 && x + w > CORE_AIRFIELD.x - CORE_AIRFIELD.w / 2 - 120
      && y < CORE_AIRFIELD.y + CORE_AIRFIELD.h / 2 + 120 && y + h > CORE_AIRFIELD.y - CORE_AIRFIELD.h / 2 - 120) return false;
    if (x < 2160 && x + w > 490 && y < 8020 && y + h > 6960) return false;
    if (x < cx + 170 && x + w > cx - 170 && y > Bo - 20) return false;
    if (y < 5990 && y + h > 5650) return false;
    if (x < GEN_W - 520 && x + w > GEN_W - 780 && y > 3300) return false;
    // Named installations (power yards, depots) own their ground plus a service apron.
    for (const rs of reservedSites) {
      if (x < rs.x + rs.w + 150 && x + w > rs.x - 150 && y < rs.y + rs.h + 150 && y + h > rs.y - 150) return false;
    }
    for (const site of [GOLIATH, MNEMOSYNE]) {
      if (x < site.x + site.w / 2 + 110 && x + w > site.x - site.w / 2 - 110
        && y < site.y + site.h / 2 + 110 && y + h > site.y - site.h / 2 - 110) return false;
    }
    for (const f of facilities) {
      if (x < f.x + f.w + 100 && x + w > f.x - 100 && y < f.y + f.h + 100 && y + h > f.y - 100) return false;
    }
    for (const p of pois) {
      if (p.kind === 'vault' || p.kind === 'airfield') continue;
      if (x < p.x + 350 && x + w > p.x - 350 && y < p.y + 320 && y + h > p.y - 320) return false;
    }
    for (const o of rects) {
      if (o.kind === 'curtain' && o.w > 2000) continue;
      if (x < o.x + o.w + pad && x + w + pad > o.x && y < o.y + o.h + pad && y + h + pad > o.y) return false;
    }
    return true;
  };

  /* ================================================================= *
   * SPECIAL INSTALLATIONS — claimed before random clutter so they own
   * their ground and stay readable landmarks.
   * ================================================================= */

  /* ---- HYDRA AIR STATION KRAKEN: seven hangars, taxiway, motor pool, parade ---- */
  const afx = CORE_AIRFIELD.x, afy = CORE_AIRFIELD.y;
  const AFW = CORE_AIRFIELD.w, AFH = CORE_AIRFIELD.h;
  const afL = afx - AFW / 2, afT = afy - AFH / 2;
  const afR = afx + AFW / 2, afB = afy + AFH / 2;
  zones.push({ x: afL - 120, y: afT - 120, w: AFW + 240, h: AFH + 240, kind: 'concrete' });
  reservedSites.push({ x: afL, y: afT, w: AFW, h: AFH });

  // Perimeter fence with four vehicle gates (north, south, east, west).
  const FT = 26, FG = 340, FGS = 300;
  add(afL, afT, AFW / 2 - FG / 2, FT, 'fence', 30);
  add(afx + FG / 2, afT, AFW / 2 - FG / 2, FT, 'fence', 30);
  add(afL, afB - FT, AFW / 2 - FG / 2, FT, 'fence', 30);
  add(afx + FG / 2, afB - FT, AFW / 2 - FG / 2, FT, 'fence', 30);
  add(afL, afT + FT, FT, AFH / 2 - FT - FGS / 2, 'fence', 30);
  add(afL, afy + FGS / 2, FT, AFH / 2 - FT - FGS / 2, 'fence', 30);
  add(afR - FT, afT + FT, FT, AFH / 2 - FT - FGS / 2, 'fence', 30);
  add(afR - FT, afy + FGS / 2, FT, AFH / 2 - FT - FGS / 2, 'fence', 30);
  const airfieldGates = [
    { x: afx, y: afT + FT / 2 }, { x: afx, y: afB - FT / 2 },
    { x: afL + FT / 2, y: afy }, { x: afR - FT / 2, y: afy },
  ];
  gateSpots.push(...airfieldGates);

  /** Sealed hangar: roof splits when you enter, aircraft parked inside, door facing the apron.
   *  doorNorth flips the opening to the north wall so the south row also faces the middle apron. */
  const hangarAt = (hx: number, hy: number, HW: number, HH: number, withPlane: boolean, doorNorth = false) => {
    const HT = 30, HDOOR = Math.min(280, HW * 0.4);
    const half = HW / 2 - HDOOR / 2;
    if (doorNorth) {
      add(hx, hy, half, HT, 'hangar', 62);
      add(hx + HW / 2 + HDOOR / 2, hy, half, HT, 'hangar', 62);
      add(hx, hy + HH - HT, HW, HT, 'hangar', 62);
    } else {
      add(hx, hy, HW, HT, 'hangar', 62);
      add(hx, hy + HH - HT, half, HT, 'hangar', 62);
      add(hx + HW / 2 + HDOOR / 2, hy + HH - HT, half, HT, 'hangar', 62);
    }
    add(hx, hy, HT, HH, 'hangar', 62);
    add(hx + HW - HT, hy, HT, HH, 'hangar', 62);
    hangars.push({ x: hx, y: hy, w: HW, h: HH, doorX: hx + HW / 2, doorY: doorNorth ? hy + HT / 2 : hy + HH - HT / 2 });
    parkedHelis.push({ x: hx + HW / 2, y: doorNorth ? hy + 200 : hy + HH - 200, ang: doorNorth ? -Math.PI / 2 : Math.PI / 2 });
    if (withPlane) {
      const py = doorNorth ? hy + HH - 200 : hy + 80;
      add(hx + HW / 2 - 200, py, 400, 120, 'plane', 24);
      zone(hx + HW / 2 - 240, py - 30, 480, 190, 'concrete');
    }
    garrisonSpots.push({ x: hx + HW / 2, y: doorNorth ? hy - 80 : hy + HH + 80 },
      { x: hx + 60, y: doorNorth ? hy + HH + 70 : hy - 70 });
    barrelSpots.push({ x: hx + HW - 70, y: doorNorth ? hy + 90 : hy + HH - 90 });
    cacheSpots.push({ x: hx + 90, y: doorNorth ? hy + 100 : hy + HH - 100 });
  };
  // Rows are set in from the perimeter fence so vehicles can circulate all the way round:
  // the route planner needs a 164px corridor, and these taxiways give it ~170-215px.
  // Both rows stand clear of the perimeter fence: the vehicle planner needs a 164px
  // corridor, and these taxiways give it 174px (north), 169px (east/west) and 264px (south),
  // so trucks and vans can circulate all the way round the airfield instead of dead-ending.
  for (let i = 0; i < 4; i++) hangarAt(afL + 195 + i * 740, afT + 200, 690, 700, true);
  for (let i = 0; i < 3; i++) hangarAt(afL + 240 + i * 960, afB - 990, 900, 700, true, true);

  // Middle apron: parade ground west, motor pool east, two jets parked between them.
  zone(afL + 120, afT + 940, 1400, 500, 'parade');
  for (let rank = 0; rank < 6; rank++) {
    for (let file = 0; file < 12; file++) {
      paradeSpots.push({
        x: afL + 180 + file * 105, y: afT + 970 + rank * 70,
        type: rank === 0 ? 'commander' : rank < 2 ? 'shieldman' : rank < 4 ? 'grunt' : 'gunner',
      });
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      vanSpots.push({ x: afL + 1600 + col * 270, y: afT + 960 + row * 180, ang: row % 2 ? Math.PI : 0 });
    }
  }
  zone(afL + 1530, afT + 910, 1460, 520, 'concrete');
  // The middle apron stays open: every hangar now holds its own aircraft, and a jet parked
  // out here would pinch the east-west convoy lane to 236px (the vehicle planner needs 164px
  // of clearance either side of a hull). Open apron = 446px of circulating room.
  for (let i = 0; i < 6; i++) add(afL + 200 + i * 150, afT + 1400, 110, 90, 'crate', 30);

  // South apron behind the hangar row: perimeter taxiway, two helipads, freight line.
  zone(afL + 100, afB - 300, 3100, 240, 'runway');
  helipads.push({ x: afx - 650, y: afB - 170 }, { x: afx + 350, y: afB - 170 });
  zone(afx - 790, afB - 310, 280, 280, 'helipad');
  zone(afx + 210, afB - 310, 280, 280, 'helipad');

  // Control tower, beacons and reflectors sweeping the apron.
  add(afR - 500, afT + 1100, 160, 160, 'tower', 96);
  beaconSpots.push({ x: afR - 420, y: afT + 1060 }, { x: afL + 90, y: afT + 90 }, { x: afR - 90, y: afB - 90 });
  spotlightSpots.push(
    { x: afR - 420, y: afT + 1180, speed: 0.5, sweep: 1.5, site: 'kraken-power' },
    { x: afL + 120, y: afT + 120, speed: 0.72, sweep: 1.25, site: 'kraken-power' },
    { x: afL + 120, y: afB - 140, speed: 0.61, sweep: 1.35, site: 'kraken-power' },
    { x: afR - 140, y: afB - 140, speed: 0.83, sweep: 1.1, site: 'kraken-power' },
    { x: afx - 220, y: afT + 40, speed: 0.66, sweep: 1.0, site: 'kraken-power' },
    { x: afx + 220, y: afB - 40, speed: 0.58, sweep: 1.0, site: 'kraken-power' },
  );
  cacheSpots.push({ x: afL + 1300, y: afT + 1450 }, { x: afR - 320, y: afB - 140 }, { x: afL + 320, y: afB - 140 });
  barrelSpots.push(
    { x: afL + 130, y: afy + 220 }, { x: afL + 190, y: afy + 300 },
    { x: afL + 120, y: afy + 380 }, { x: afR - 150, y: afy - 300 },
  );
  garrisonSpots.push({ x: afL + 1450, y: afT + 1150 }, { x: afx + 700, y: afB - 60 },
    { x: afL + 60, y: afy - 420 }, { x: afR - 60, y: afy + 420 });
  pois.push({
    id: 'airfield', kind: 'airfield', x: afx, y: afy, r: 1800,
    name: 'HYDRA AIR STATION KRAKEN', sub: 'SEVEN HANGARS · MOTOR POOL · PARADE GROUND · TAXIWAY',
    secret: false, gates: airfieldGates,
  });

  /* ---- Defended feeder yards: the fortress and the air station keep their own grid ---- */
  const yardPatrols: PatrolRoute[] = [];
  const yardCtx = {
    sector: Math.max(1, Math.min(5, sector)), rects, zones, facilities, guards: facilityGuards,
    gates: gateSpots, caches: cacheSpots, lights: spotlightSpots, barrels: barrelSpots, vans: vanSpots,
    patrols: yardPatrols, pois, garrison: garrisonSpots,
  };
  const buildYard = (o: Parameters<typeof buildPowerYard>[0]) => {
    const built = buildPowerYard(o, yardCtx);
    reservedSites.push({ x: built.x, y: built.y, w: built.w, h: built.h });
    for (const pd of built.padSpots) {
      helipads.push({ x: pd.x, y: pd.y });
      zones.push({ x: pd.x - 140, y: pd.y - 140, w: 280, h: 280, kind: 'helipad' });
    }
    return built;
  };
  const hqYard = buildYard({
    id: 'fortress-power', name: 'FORTRESS FEEDER YARD', code: 'PWR-H',
    cx: HQ_YARD.cx, cy: HQ_YARD.cy, generators: 3, servers: 2, defenders: 4, patrolTeams: 2,
  });
  const krakenYard = buildYard({
    id: 'kraken-power', name: 'KRAKEN FEEDER YARD', code: 'PWR-K',
    cx: KRAKEN_YARD.cx, cy: KRAKEN_YARD.cy, generators: 3, servers: 2, defenders: 4, patrolTeams: 2,
  });
  // Service roads tying each yard to the highway network.
  zones.push({ x: HQ_YARD.cx - 110, y: hqYard.y + hqYard.h, w: 220, h: cy - (hqYard.y + hqYard.h) + 120, kind: 'road' });
  zones.push({ x: HQ_YARD.cx - HQ_YARD.w / 2 - 500, y: HQ_YARD.cy - 100, w: 500, h: 200, kind: 'road' });
  zones.push({ x: krakenYard.x + krakenYard.w / 2 - 110, y: krakenYard.y - 320, w: 220, h: 320, kind: 'road' });
  zones.push({ x: krakenYard.x + krakenYard.w, y: KRAKEN_YARD.cy - 100, w: CORE_AIRFIELD.x - 120 - (krakenYard.x + krakenYard.w), h: 200, kind: 'road' });

  /* ---- HYDRA LASER BATTERIES: two-shot annihilation, capturable ---- */
  const laserAt = (lx: number, ly: number, id: string, label: string) => {
    zones.push({ x: lx - 300, y: ly - 300, w: 600, h: 600, kind: 'concrete' });
    const t = 34, g = 220;
    add(lx - 260, ly - 260, 520 / 2 - g / 2, t, 'bunker', 44);
    add(lx + g / 2, ly - 260, 520 / 2 - g / 2, t, 'bunker', 44);
    add(lx - 260, ly + 226, 520 / 2 - g / 2, t, 'bunker', 44);
    add(lx + g / 2, ly + 226, 520 / 2 - g / 2, t, 'bunker', 44);
    add(lx - 260, ly - 226, t, 452, 'bunker', 44);
    add(lx + 226, ly - 226, t, 452, 'bunker', 44);
    laserSpots.push({ x: lx, y: ly });
    garrisonSpots.push(
      { x: lx - 150, y: ly + 150 }, { x: lx + 150, y: ly + 150 },
      { x: lx - 150, y: ly - 150 }, { x: lx + 150, y: ly - 150 },
    );
    beaconSpots.push({ x: lx, y: ly - 70 });
    cacheSpots.push({ x: lx + 190, y: ly + 190 });
    pois.push({
      id, kind: 'laser', x: lx, y: ly, r: 460,
      name: label, sub: 'ORBITAL-GRADE BEAM — LETHAL IN TWO HITS',
      secret: false,
      gates: [{ x: lx, y: ly + 243 }, { x: lx, y: ly - 243 }],
    });
  };
  laserAt(1500, 1500, 'laser-a', 'HYDRA BEAM SITE ALPHA');
  laserAt(GEN_W - 1500, GEN_H - 1500, 'laser-b', 'HYDRA BEAM SITE OMEGA');

  /* ---- PEGGY CARTER SSR STATIONS: old S.H.I.E.L.D. roots, Hydra-held ---- */
  const peggyAt = (px: number, py: number, id: string, label: string, sub: string) => {
    zones.push({ x: px - 340, y: py - 260, w: 680, h: 520, kind: 'concrete' });
    const t = 30, g = 220;
    add(px - 300, py - 220, 600 / 2 - g / 2, t, 'barrack', 48);
    add(px + g / 2, py - 220, 600 / 2 - g / 2, t, 'barrack', 48);
    add(px - 300, py + 190, 600, t, 'barrack', 48);
    add(px - 300, py - 190, t, 380, 'barrack', 48);
    add(px + 270, py - 190, t, 380, 'barrack', 48);
    add(px - 90, py - 40, 80, 80, 'crate', 24);
    add(px + 20, py - 40, 80, 80, 'crate', 24);
    garrisonSpots.push({ x: px - 180, y: py + 90 }, { x: px + 180, y: py + 90 }, { x: px, y: py - 110 });
    cacheSpots.push({ x: px - 210, y: py + 130 }, { x: px + 210, y: py + 130 });
    pois.push({
      id, kind: 'peggy', x: px, y: py, r: 420, name: label, sub,
      secret: false, gates: [{ x: px, y: py - 205 }],
    });
  };
  peggyAt(1650, GEN_H - 1500, 'peggy-a', 'SSR STATION “CARTER”', 'FOUNDED 1946 — HYDRA OCCUPIED');
  peggyAt(9300, 1400, 'peggy-b', 'SSR VAULT “MARGARET”', 'ORIGINAL S.H.I.E.L.D. ARCHIVE');
  peggyAt(4620, 5450, 'peggy-c', 'SSR RELAY “ROSE”', 'PRE-HYDRA COMMS OUTPOST');

  /* ---- THE HIDDEN S.H.I.E.L.D. VAULT: never marked, never captured ---- */
  const vaultSpot = { x: 980, y: GEN_H - 780 };
  const planeSpot = { x: vaultSpot.x + 470, y: vaultSpot.y - 60 };
  zones.push({ x: vaultSpot.x - 420, y: vaultSpot.y - 420, w: 1500, h: 840, kind: 'plaza' });
  {
    const vx = vaultSpot.x, vy = vaultSpot.y, t = 40;
    // A buried bunker: only a narrow hatch corridor betrays it from the surface.
    add(vx - 380, vy - 380, 310, t, 'vault', 70);
    add(vx + 70, vy - 380, 970, t, 'vault', 70);
    add(vx - 380, vy + 340, 1420, t, 'vault', 70);
    add(vx - 380, vy - 340, t, 680, 'vault', 70);
    add(vx + 1000, vy - 340, t, 680, 'vault', 70);
    // The north hatch is physically open, not a label drawn on a solid wall.
    pois.push({
      id: 'vault', kind: 'vault', x: vx + 300, y: vy, r: 700,
      name: 'S.H.I.E.L.D. BLACK VAULT “ATTIC”', sub: 'NEVER FELL — AIR WING STANDING BY',
      secret: true, gates: [{ x: CORE_VAULT_ENTRY.x, y: CORE_VAULT_ENTRY.y + 20 }],
    });
  }

  // Highways radiating from the fortress
  const roadW = 190;
  zones.push({ x: cx - roadW / 2, y: Bo, w: roadW, h: GEN_H - Bo - 80, kind: 'road' });
  zones.push({ x: 80, y: cy - roadW / 2, w: L - 80, h: roadW, kind: 'road' });
  zones.push({ x: R, y: cy - roadW / 2, w: GEN_W - R - 80, h: roadW, kind: 'road' });
  zones.push({ x: cx - roadW / 2, y: 80, w: roadW, h: T - 80, kind: 'road' });
  // Ring road
  zones.push({ x: 900, y: GEN_H - 2400, w: GEN_W - 1800, h: roadW, kind: 'road' });
  zones.push({ x: 900, y: 1200, w: roadW, h: GEN_H - 3600, kind: 'road' });
  zones.push({ x: GEN_W - 600, y: 1200, w: roadW, h: GEN_H - 3600, kind: 'road' });
  zones.push({ x: CORE_AIRFIELD.x - 120, y: CORE_AIRFIELD.y + AFH / 2, w: 240, h: 600, kind: 'road' });

  const campaignSites = addCampaignSites({ sector: Math.max(1, Math.min(6, sector)),
    rects, zones, pois, facilities, guards: facilityGuards,
    gates: gateSpots, vans: vanSpots, caches: cacheSpots, lights: spotlightSpots, barrels: barrelSpots,
    garrison: garrisonSpots, pads: helipads });
  // The yards built here join the campaign grid so every cell/site/patrol is in one place.
  campaignSites.powerCells.push(...hqYard.cells, ...krakenYard.cells);
  campaignSites.powerSites.push(hqYard, krakenYard);
  campaignSites.patrols.push(...yardPatrols);
  // Reserve each feeder yard *and* its south apron (helipad, fuel drums, van park) from random clutter.
  for (const site of campaignSites.powerSites) reservedSites.push({ x: site.x - 150, y: site.y - 150, w: site.w + 300, h: site.h + 520 });

  populateFacilities({
    sector: Math.max(1, Math.min(6, sector)), width: GEN_W, height: GEN_H,
    rects, zones, facilities, guards: facilityGuards,
    gates: gateSpots, caches: cacheSpots, spotlights: spotlightSpots,
    canPlace: noOverlap,
  });

  // Fortified outposts (compounds) scattered across the map
  const compound = (fx: number, fy: number, fw: number, fh: number) => {
    const t = 40, g = 220;
    if (!noOverlap(fx - fw / 2 - 60, fy - fh / 2 - 60, fw + 120, fh + 120, 160)) return false;
    add(fx - fw / 2, fy - fh / 2, fw / 2 - g / 2, t, 'bunker', 34);
    add(fx + g / 2, fy - fh / 2, fw / 2 - g / 2, t, 'bunker', 34);
    add(fx - fw / 2, fy + fh / 2 - t, fw / 2 - g / 2, t, 'bunker', 34);
    add(fx + g / 2, fy + fh / 2 - t, fw / 2 - g / 2, t, 'bunker', 34);
    add(fx - fw / 2, fy - fh / 2 + t, t, fh / 2 - t - g / 2, 'bunker', 34);
    add(fx - fw / 2, fy + g / 2, t, fh / 2 - t - g / 2, 'bunker', 34);
    add(fx + fw / 2 - t, fy - fh / 2 + t, t, fh / 2 - t - g / 2, 'bunker', 34);
    add(fx + fw / 2 - t, fy + g / 2, t, fh / 2 - t - g / 2, 'bunker', 34);
    add(fx - 80, fy - 34, 62, 62, 'crate', 22);
    add(fx + 22, fy - 34, 62, 62, 'crate', 22);
    zones.push({ x: fx - fw / 2, y: fy - fh / 2, w: fw, h: fh, kind: 'concrete' });
    cacheSpots.push({ x: fx, y: fy + fh / 2 - 90 });
    gateSpots.push({ x: fx, y: fy - fh / 2 + t / 2 }, { x: fx, y: fy + fh / 2 - t / 2 },
      { x: fx - fw / 2 + t / 2, y: fy }, { x: fx + fw / 2 - t / 2, y: fy });
    return true;
  };

  const sectorPressure = Math.max(1, Math.min(6, sector));
  let wtries = 0, built = 0;
  while (built < 30 + sectorPressure * 5 && wtries++ < 900) {
    const fw = rnd(420, 760), fh = rnd(360, 620);
    const fx = rnd(700, GEN_W - 700), fy = rnd(700, GEN_H - 700);
    if (compound(fx, fy, fw, fh)) built++;
  }

  // Industrial blocks / warehouses
  wtries = 0; built = 0;
  while (built < 60 + sectorPressure * 12 && wtries++ < 1600) {
    const w = rnd(180, 460), h = rnd(160, 380);
    const x = rnd(300, GEN_W - 300 - w), y = rnd(300, GEN_H - 300 - h);
    if (!noOverlap(x, y, w, h, 190)) continue;
    add(x, y, w, h, 'barrack', rnd(30, 52));
    zones.push({ x: x - 40, y: y - 40, w: w + 80, h: h + 80, kind: 'concrete' });
    if (Math.random() < 0.4) {
      // Supply crate beside the block. Try all four sides so the crate never ends up
      // clipped by neighbouring works (depot bay headers, yard aprons, ...).
      const clear = (px: number, py: number) => !rects.some(b =>
        px > b.x - 36 && px < b.x + b.w + 36 && py > b.y - 36 && py < b.y + b.h + 36);
      const spot = [{ x: x + w / 2, y: y + h + 74 }, { x: x + w / 2, y: y - 74 },
        { x: x + w + 74, y: y + h / 2 }, { x: x - 74, y: y + h / 2 }].find(p => clear(p.x, p.y));
      if (spot) cacheSpots.push(spot);
    }
    built++;
  }

  // Cover clutter: crates, sandbag lines, low walls
  wtries = 0; built = 0;
  while (built < 320 + sectorPressure * 40 && wtries++ < 4600) {
    const r = Math.random();
    let w: number, h: number, kind: StructKind, h3: number;
    if (r < 0.5) { w = h = rnd(48, 76); kind = 'crate'; h3 = 22; }
    else if (r < 0.8) {
      const horiz = Math.random() < 0.5;
      w = horiz ? rnd(110, 190) : 28; h = horiz ? 28 : rnd(110, 190);
      kind = 'sandbag'; h3 = 16;
    } else {
      const horiz = Math.random() < 0.5;
      w = horiz ? rnd(200, 420) : 38; h = horiz ? 38 : rnd(200, 420);
      kind = 'wall'; h3 = 30;
    }
    const x = rnd(200, GEN_W - 200 - w), y = rnd(200, GEN_H - 200 - h);
    if (!noOverlap(x, y, w, h, 96)) continue;
    add(x, y, w, h, kind, h3);
    built++;
  }

  // Terrain patches were removed on request: the random brown/green rectangles that
  // carpeted the whole theatre read as unfinished ground plates rather than terrain.

  /* Loot on the shoulders.
   *
   * These used to be thrown at pure random coordinates, which is how a supply cache ends up
   * welded into a hangar wall or sealed in a courtyard nobody can walk into. They are now
   * placed on purpose: pick a road, pick a point along it, step off the tarmac onto the
   * shoulder, and refuse the spot unless it is clear of every structure, clear of every
   * reserved site and not sitting on top of another cache.
   */
  {
    const shoulders = zones.filter((z) => z.kind === 'road');
    let tries = 0, placed = 0;
    while (placed < 24 && tries++ < 1400 && shoulders.length) {
      const road = shoulders[Math.floor(Math.random() * shoulders.length)];
      const horizontal = road.w >= road.h;
      const along = horizontal ? road.x + rnd(140, Math.max(150, road.w - 140)) : road.y + rnd(140, Math.max(150, road.h - 140));
      const across = horizontal ? road.y + road.h / 2 : road.x + road.w / 2;
      const side = Math.random() < 0.5 ? -1 : 1;
      const off = (horizontal ? road.h : road.w) / 2 + rnd(54, 130);
      const x = horizontal ? along : across + side * off;
      const y = horizontal ? across + side * off : along;
      if (x < 360 || y < 360 || x > GEN_W - 360 || y > GEN_H - 360) continue;
      if (reservedSites.some((r) => x > r.x - 70 && x < r.x + r.w + 70 && y > r.y - 70 && y < r.y + r.h + 70)) continue;
      if (rects.some((r) => x > r.x - 74 && x < r.x + r.w + 74 && y > r.y - 74 && y < r.y + r.h + 74)) continue;
      if (cacheSpots.some((c) => Math.hypot(c.x - x, c.y - y) < 240)) continue;
      if (barrelSpots.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
      cacheSpots.push({ x, y });
      placed++;
    }
  }

  /* --------- S.H.I.E.L.D.-GRADE INFRASTRUCTURE --------- */

  // HELIPADS — VTOLs launch from here; two inside the fortress bailey
  const pad = (x: number, y: number) => {
    helipads.push({ x, y });
    zones.push({ x: x - 140, y: y - 140, w: 280, h: 280, kind: 'helipad' });
  };
  pad(cx - 760, Bo - 440);   // inside bailey, west service pad (clear of the south curtain)
  pad(cx + 760, Bo - 440);   // inside bailey, east service pad
  pad(cx, T + CT + 500);     // command apron pad inside the bailey

  // HYDRA occupied a former S.H.I.E.L.D. hangar. A captured gunship waits here.
  add(hangarSpot.x - 250, hangarSpot.y - 180, 500, 170, 'barrack', 54, '#304b54');
  zones.push({ x: hangarSpot.x - 320, y: hangarSpot.y - 280, w: 640, h: 470, kind: 'concrete' });
  pad(hangarSpot.x, hangarSpot.y + 100);
  garrisonSpots.push(
    { x: hangarSpot.x - 260, y: hangarSpot.y + 30 },
    { x: hangarSpot.x + 260, y: hangarSpot.y + 30 },
    { x: hangarSpot.x - 140, y: hangarSpot.y + 210 },
    { x: hangarSpot.x + 140, y: hangarSpot.y + 210 },
  );
  // outer pads scattered near roads
  let padsPlaced = helipads.length, ptries = 0;
  while (padsPlaced < helipads.length + 5 && ptries++ < 2000) {
    const x = rnd(700, GEN_W - 700), y = rnd(700, GEN_H - 700);
    if (Math.hypot(x - cx, y - cy) < CORE_HQ.w * 0.62) continue;
    if (Math.hypot(x - CORE_PLAYER_START.x, y - CORE_PLAYER_START.y) < 800) continue;
    if (!noOverlap(x - 140, y - 140, 280, 280, 100)) continue;
    pad(x, y);
    padsPlaced++;
  }

  // Aircraft parked on the open pads: every one of them is a bay a gunship can return to.
  for (let i = 0; i < helipads.length && i < 14; i++) {
    const pd = helipads[(i * 5 + 3) % helipads.length];
    if (parkedHelis.some(ph => Math.hypot(ph.x - pd.x, ph.y - pd.y) < 150)) continue;
    if (hangars.some(hg => pd.x > hg.x - 60 && pd.x < hg.x + hg.w + 60 && pd.y > hg.y - 60 && pd.y < hg.y + hg.h + 60)) continue;
    parkedHelis.push({ x: pd.x, y: pd.y, ang: Math.random() * Math.PI * 2 });
  }

  // WATCHTOWERS with blinking beacons — ring road corners + midpoints
  const towerAt = (x: number, y: number) => {
    if (!noOverlap(x - 50, y - 50, 100, 100, 90)) return;
    add(x - 50, y - 50, 100, 100, 'tower', 60);
    beaconSpots.push({ x, y: y - 74 });
  };
  towerAt(900, 1200); towerAt(GEN_W - 600, 1200);
  towerAt(900, GEN_H - 2210); towerAt(GEN_W - 600, GEN_H - 2210);
  towerAt(cx, GEN_H - 2210); towerAt(cx, 1200);

  // SATCOM arrays — secondary command-net infrastructure (destructible)
  const satAt = (x: number, y: number) => {
    if (!noOverlap(x - 60, y - 60, 120, 120, 110)) return;
    satcomSpots.push({ x, y });
    zones.push({ x: x - 160, y: y - 160, w: 320, h: 320, kind: 'concrete' });
  };
  satAt(cx, 760);
  satAt(1100, GEN_H * 0.5);
  satAt(GEN_W - 1100, GEN_H * 0.55);
  satAt(GEN_W * 0.25, GEN_H - 1500);
  satAt(GEN_W * 0.75, GEN_H - 1900);

  // FUEL YARDS — chain-reaction explosive barrels
  let yards = 0, ytries = 0;
  while (yards < 11 && ytries++ < 500) {
    const yx = rnd(600, GEN_W - 600), yy = rnd(600, GEN_H - 600);
    if (Math.hypot(yx - cx, yy - cy) < CORE_HQ.w * 0.6) continue;
    if (Math.hypot(yx - CORE_PLAYER_START.x, yy - CORE_PLAYER_START.y) < 700) continue;
    if (!noOverlap(yx - 110, yy - 90, 220, 180, 80)) continue;
    zones.push({ x: yx - 120, y: yy - 100, w: 240, h: 200, kind: 'fuel' });
    const n = 5 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      barrelSpots.push({
        x: yx + rnd(-80, 80),
        y: yy + rnd(-60, 60),
      });
    }
    yards++;
  }

  // MOTOR POOL — parked armored trucks along the fortress apron
  const truckRow = (x: number, y: number, n: number, dxv: number, dyv: number) => {
    for (let i = 0; i < n; i++) {
      const tx = x + dxv * i, ty = y + dyv * i;
      if (!noOverlap(tx, ty, 96, 190, 60)) continue;
      add(tx, ty, 96, 190, 'truck', 26);
      zones.push({ x: tx - 20, y: ty - 20, w: 136, h: 230, kind: 'concrete' });
    }
  };
  truckRow(R + 200, cy + 240, 5, 0, 230);
  truckRow(L - 296, cy - 420, 5, 0, 230);
  truckRow(cx - 1600, GEN_H - 2600, 5, 240, 0);

  // SPOTLIGHTS sweeping from towers and gatehouse tops
  for (const [tx, ty] of towers) spotlightSpots.push({ x: tx + TW / 2, y: ty + TW / 2 - 40, speed: rnd(0.5, 0.9), sweep: rnd(0.9, 1.5), site: 'fortress-power' });
  spotlightSpots.push({ x: cx - GAP / 2 - 65, y: Bo - CT - 80, speed: 0.8, sweep: 1.2, site: 'fortress-power' });
  spotlightSpots.push({ x: cx + GAP / 2 + 65, y: Bo - CT - 80, speed: 0.65, sweep: 1.0, site: 'fortress-power' });
  // Enlarged base perimeter has overlapping reflector coverage.
  spotlightSpots.push(
    { x: L + 520, y: T + 30, speed: 0.55, sweep: 1.35, site: 'fortress-power' },
    { x: R - 520, y: T + 30, speed: 0.7, sweep: 1.15, site: 'fortress-power' },
    { x: L + 30, y: cy - 420, speed: 0.62, sweep: 1.2, site: 'fortress-power' },
    { x: L + 30, y: cy + 420, speed: 0.76, sweep: 1.0, site: 'fortress-power' },
    { x: R - 30, y: cy - 420, speed: 0.58, sweep: 1.3, site: 'fortress-power' },
    { x: R - 30, y: cy + 420, speed: 0.72, sweep: 1.1, site: 'fortress-power' },
    { x: bailW + 400, y: T + 460, speed: 0.64, sweep: 1.15, site: 'fortress-power' },
    { x: bailE - 400, y: Bo - 460, speed: 0.58, sweep: 1.25, site: 'fortress-power' },
  );

  /* ================================================================== *
   * EASTWARD EXPANSION
   *
   * Nothing above moved: the legacy 12000 × 8200 theatre keeps every coordinate it had.
   * The prison gets genuinely new ground east of it, enclosed by its own ramparts so the
   * two halves read as one continuous map.
   * ================================================================== */
  const B2 = 60;
  add(0, 0, GEN_W, B2, 'curtain', 26);                     // north, legacy
  // The southern strip is reached by one road cut through the legacy south rampart, in
  // every sector: the army uses it for its district, the other five for their annexes.
  add(0, GEN_H - B2, 6000 - 220, B2, 'curtain', 26);       // south, legacy (west of the cut)
  add(6000 + 220, GEN_H - B2, GEN_W - 6000 - 220, B2, 'curtain', 26);   // south, east of it
  add(0, 0, B2, GEN_H, 'curtain', 26);                     // west
  add(GEN_W, 0, PRISON_EAST, B2, 'curtain', 26);           // north, new ground
  add(GEN_W, GEN_H - B2, PRISON_EAST, B2, 'curtain', 26);   // south, new ground
  add(ARENA_W - B2, 0, B2, GEN_H, 'curtain', 26);          // east edge of the extension

  // Service road along the new coast, tying the bridge head into the legacy ring road.
  zones.push({ x: GEN_W - 300, y: 3900, w: 700, h: 420, kind: 'road' });

  /* ================================================================== *
   * SECTOR DRESSING
   *
   * Palettes were never enough: a winter sector needs snow on the ground, heaps along
   * the roads and ploughs working them. Everything here only appends to the map.
   * ================================================================== */
  const dressing = dressSector({
    sector: Math.max(1, Math.min(6, sector)),
    zones, add, zone, rnd: rnd, width: GEN_W, height: GEN_H,
  });

  /* ================================================================== *
   * ARMY GROUND (sector 6)
   *
   * A brand-new 3 400 m deep strip south of the legacy frame. The legacy map keeps every
   * coordinate; the prison island keeps every pier. This block is new land, reached by a
   * single causeway road through the old south rampart.
   * ================================================================== */
  let army: ArmyPlan | null = null;
  const ranks: { x: number; y: number; type: string }[] = [];
  const armyGuards: { x: number; y: number; type: string }[] = [];
  let glacier: { x: number; y: number } | null = null;

  /* ---------------- SOUTHERN ANNEX (sectors 1–5) ----------------
   * The new strip used to be empty concrete everywhere but the army district. Each
   * sector now owns a district of its own down here, built differently from every other.
   * Sectors 1-5 keep the outer border of the strip; sector 6 builds its own below.
   */
  if (sector < 6) {
    add(0, GEN_H, B2, ARMY_SOUTH, 'curtain', 30);
    add(ARENA_W - B2, GEN_H, B2, ARMY_SOUTH, 'curtain', 30);
    add(0, ARENA_H - B2, ARENA_W, B2, 'curtain', 30);
    const annex = buildSectorAnnex({ sector, y0: GEN_H, add, zone, rnd });
    for (const g of annex.guards) {
      const free = freeGuardPost(g);
      if (free) armyGuards.push(free);
    }
    glacier = annex.glacier;
    for (const sp of annex.strongpoints) {
      pois.push({
        id: `annex-${sp.id}`, kind: 'depot', x: sp.x + sp.w / 2, y: sp.y + sp.h / 2, r: 380,
        name: sp.name, sub: annex.sub, secret: true, gates: [],
      });
    }
  }
  if (sector >= 6) {
    army = buildArmyDistrict({ y0: GEN_H, add, zone, rnd });
    dressing.start = { x: army.spawn.x, y: army.spawn.y - 340 };

    // New border for the new ground: its own rampart on the west, east and south.
    add(0, GEN_H, B2, ARMY_SOUTH, 'curtain', 30);
    add(ARENA_W - B2, GEN_H, B2, ARMY_SOUTH, 'curtain', 30);
    add(0, ARENA_H - B2, ARENA_W, B2, 'curtain', 30);

    // The parade: one thousand men and women in ranks, plus a small cadre of officers.
    const roster = ['armytrooper', 'armytrooper', 'armytrooper', 'armytrooper',
      'armyguard', 'armytrooper', 'armyengineer', 'armytrooper', 'armymedic'];
    for (let i = 0; i < army.parade.length; i++) {
      ranks.push({ ...army.parade[i], type: roster[i % roster.length] });
    }
    // The strongpoints are held by their own people — a few hundred men who never sleep,
    // because they are not on parade: they are on duty. Anyone whose post would end up
    // inside a wall, a silo or a parked hull is dropped: a garrison stuck in scenery is
    // worse than no garrison at all.
    for (const g of army.guards) {
      const free = freeGuardPost(g);
      if (free) armyGuards.push(free);
    }

    // Army gates are physical shutters; keep them in the world so collision and the
    // renderer both see them.
    for (const g of army.gates) {
      for (const r of g.rects) if (!rects.includes(r)) rects.push(r);
    }
    // The parked hulls are scenery (and added by army.ts); the live patrol armour is a
    // unit, so it must never also be a solid rect at the same coordinates.
    // Generators join the campaign power grid so they can be shot and blacked out.
    for (const [i, g] of army.generators.entries()) {
      campaignSites.powerCells.push({
        id: `army-gen-${i}`, kind: 'generator', x: g.x, y: g.y,
        hp: 420, maxHp: 420, dead: false, site: 'army-core',
      });
    }
    campaignSites.powerSites.push({
      id: 'army-core', name: 'IRON RESERVE / COMMAND', code: 'ARM',
      x: army.core.x, y: army.core.y, w: army.core.w, h: army.core.h, major: true,
    });

    // The command bunker hosts the sector mainframes, exactly like the Hydra keeps do.
    serverSpots.push(
      { x: army.core.x + 420, y: army.core.y + 300 },
      { x: army.core.x + army.core.w - 420, y: army.core.y + 300 },
    );
    generalSpot = { x: army.hq.x, y: army.hq.y };

    // THE SOFT SIDE: thinly held company barracks and the two forward strips. They are
    // marked as secret sites, which means they show on the map but never become an uplink
    // objective — they are loot and aircraft, not a base to capture. Their supply caches
    // are seeded as ordinary cache spots, so breaking them yields the usual haul.
    for (const sp of army.softTargets) {
      pois.push({
        id: sp.id, kind: 'depot', secret: true, soft: true,
        x: sp.x + sp.w / 2, y: sp.y + sp.h / 2, r: Math.max(300, sp.w * 0.4),
        name: sp.name, sub: sp.sub, gates: [],
      });
    }
    for (const l of army.loot) cacheSpots.push(l);

    // A searched-then-seized S.H.I.E.L.D. outpost beside the approach, so the level opens
    // with a fight on your own side of the wire. It stands clear of the causeway: the road
    // in has to stay open, or the whole level is a shooting gallery you cannot enter.
    const ox = army.spawn.x - 1450, oy = army.spawn.y + 40;
    zone(ox - 60, oy - 300, 1250, 900, 'concrete');
    add(ox - 40, oy - 240, 320, 240, 'vault', 56, '#2c4a44');
    add(ox + 420, oy - 220, 280, 210, 'laboratory', 44, '#33474a');
    add(ox - 40, oy + 40, 960, 40, 'sandbag', 20);
    add(ox - 40, oy - 60, 40, 140, 'sandbag', 20);
    helipads.push({ x: ox + 760, y: oy + 140 });
    zone(ox + 620, oy + 10, 300, 300, 'helipad');
    cacheSpots.push({ x: ox + 620, y: oy + 320 });
    pois.push({
      id: 'army', kind: 'depot', x: army.hq.x, y: army.hq.y, r: 1500,
      name: 'IRON RESERVE', sub: 'ARMY GROUP SOUTH / NO HYDRA INSIGNIA',
      secret: false, gates: army.gates.map((g) => ({ x: g.x + g.w / 2, y: g.y + g.h / 2 })),
    });
  }

  /* ---------------------------------------------------------------- *
   * MONUMENTS
   *
   * A HYDRA district built out of identically sized sheds reads like a level editor
   * screenshot. The big civic and industrial buildings are therefore grown around their
   * own centres — never by more than a third of their own span on a side, never into a
   * road, never within 18 px of another building (decor is allowed to be overlapped) —
   * and every building is raised so the skyline has depth. Nothing that is part of a wall run or an authored strongpoint is touched,
   * so gates stay gates and corridors stay open.
   * ---------------------------------------------------------------- */
  {
    const GROW: Partial<Record<StructKind, number>> = {
      megahangar: 78, hangar: 58, warehouse: 50, motorpool: 44, laboratory: 40, library: 36,
      power: 38, armory: 38, radar: 32, keep: 40, towerblock: 58, kazemat: 42, silo: 34,
      cellblock: 42, bastion: 32, dronebay: 34, watertower: 28,
      barrack: 30, bunker: 24, checkpoint: 18, tower: 24, vault: 28, stockade: 26, plane: 18,
    };
    const BUILDING: StructKind[] = ['megahangar', 'hangar', 'warehouse', 'motorpool', 'laboratory',
      'library', 'power', 'armory', 'radar', 'keep', 'towerblock', 'kazemat', 'silo', 'cellblock',
      'bastion', 'dronebay', 'watertower', 'barrack', 'bunker', 'checkpoint', 'tower', 'vault',
      'stockade', 'curtain', 'rampart', 'pillar', 'gate'];
    const roads = zones.filter((z) => z.kind === 'road');
    const hitsRoad = (x: number, y: number, w: number, h: number) => roads.some((z) =>
      x < z.x + z.w + 10 && x + w > z.x - 10 && y < z.y + z.h + 10 && y + h > z.y - 10);
    // Decor is not a neighbour: sandbag lines, crates and fences sit right against a
    // building and must never stop it from being rebuilt larger. Only other buildings and
    // the authored compounds count.
    const DECOR = new Set<StructKind>(['crate', 'sandbag', 'fence', 'barrel', 'pine', 'rock',
      'target', 'tent', 'bladder', 'lamp', 'sign', 'billboard', 'pylon', 'busstop', 'barrier',
      'car', 'humvee', 'bus', 'tanker', 'truck', 'plane']);
    const clearOf = (r: Rect, nx: number, ny: number, nw: number, nh: number) => {
      for (const o of rects) {
        if (o === r || o.dead) continue;
        if (r.structuralGroup !== undefined && o.structuralGroup === r.structuralGroup) continue;
        const pad = DECOR.has(o.kind) ? 6 : 18;
        if (nx < o.x + o.w + pad && nx + nw > o.x - pad && ny < o.y + o.h + pad && ny + nh > o.y - pad) return false;
      }
      return true;
    };
    let grown = 0;
    for (const r of rects) {
      if (r.dead || r.structuralGroup !== undefined || r.armyWall || r.armyGate) continue;
      const grow = GROW[r.kind];
      if (grow) {
        for (const f of [1, 0.6, 0.35]) {
          const gx = Math.min(grow * f, r.w * 0.3), gy = Math.min(grow * f, r.h * 0.3);
          const nx = r.x - gx, ny = r.y - gy, nw = r.w + gx * 2, nh = r.h + gy * 2;
          if (nx < 120 || ny < 120 || nx + nw > GEN_W - 120 || ny + nh > ARENA_H - 120) continue;
          if (hitsRoad(nx, ny, nw, nh)) continue;
          if (!clearOf(r, nx, ny, nw, nh)) continue;
          r.x = nx; r.y = ny; r.w = nw; r.h = nh;
          grown++;
          break;
        }
      }
      // Height: extruded faces only, so this changes the skyline and nothing else.
      if (r.kind !== 'crate' && r.kind !== 'barrel' && r.kind !== 'pine' && r.kind !== 'sandbag'
        && r.kind !== 'fence' && r.kind !== 'target' && r.kind !== 'bladder' && r.kind !== 'tent') {
        const lift = BUILDING.includes(r.kind) ? 1.5 : 1.2;
        r.h3d = Math.min(320, Math.round(r.h3d * lift));
      }
    }
    void grown;
  }

  /* ---------------------------------------------------------------- *
   * ROADSIDE INFRASTRUCTURE
   *
   * Lighting, signage, hoardings and the power line. Every piece is placed on the shoulder
   * of a real road zone and only where the ground is already free, so nothing here can
   * ever block a carriageway or seal a gate.
   * ---------------------------------------------------------------- */
  {
    const free = (x: number, y: number, w: number, h: number) => !rects.some((r) =>
      !r.dead && x < r.x + r.w + 26 && x + w > r.x - 26 && y < r.y + r.h + 26 && y + h > r.y - 26);
    const mainRoads = zones.filter((z) => z.kind === 'road' && Math.max(z.w, z.h) > 620);
    const roadAll = zones.filter((z) => z.kind === 'road');
    let placed = 0;
    for (const [ri, z] of mainRoads.entries()) {
      const horizontal = z.w >= z.h;
      const len = horizontal ? z.w : z.h;
      const thick = horizontal ? z.h : z.w;
      const step = 330;
      let k = 0;
      for (let d = 140; d < len - 140; d += step, k++) {
        for (const side of [-1, 1]) {
          const roll = (ri * 7 + k * 3 + (side > 0 ? 1 : 0)) % 9;
          const kind: StructKind = roll === 0 ? 'billboard' : roll === 3 ? 'pylon'
            : roll === 5 ? 'busstop' : roll === 7 ? 'sign' : 'lamp';
          const w = kind === 'billboard' ? 132 : kind === 'pylon' ? 74 : kind === 'busstop' ? 96 : kind === 'sign' ? 44 : 22;
          const h = kind === 'billboard' ? 26 : kind === 'pylon' ? 74 : kind === 'busstop' ? 54 : kind === 'sign' ? 18 : 22;
          // The whole footprint stands clear of the tarmac: half the carriageway, half its
          // own width across the road, and a shoulder's worth of gravel.
          const off = thick / 2 + (horizontal ? h : w) / 2 + 16;
          const x = horizontal ? z.x + d : z.x + z.w / 2 + side * off;
          const y = horizontal ? z.y + z.h / 2 + side * off : z.y + d;
          if (x < 200 || y < 200 || x > GEN_W - 200 || y > ARENA_H - 200) continue;
          if (!free(x - w / 2, y - h / 2, w, h)) continue;
          // Junctions: a shoulder beside one road can be the middle of another.
          if (roadAll.some((rz: { x: number; y: number; w: number; h: number }) => x - w / 2 < rz.x + rz.w && x + w / 2 > rz.x
            && y - h / 2 < rz.y + rz.h && y + h / 2 > rz.y)) continue;
          // The tower and the board stand behind the pole line, not in the lane.
          const h3d = kind === 'pylon' ? 190 : kind === 'billboard' ? 120 : kind === 'lamp' ? 96
            : kind === 'busstop' ? 62 : 70;
          add(x - w / 2, y - h / 2, w, h, kind, h3d);
          placed++;
        }
      }
    }
    void placed;
  }

  /* ---------------------------------------------------------------- *
   * THE INSERTION
   *
   * The six start coordinates are fixed, but the district around them is scattered at
   * random: a compound or a warehouse can land on the insertion and leave the operative
   * sealed in a courtyard whose only door faces away. Validate the ground under the
   * insertion, and if it is not open ground with real space around it, walk out to the
   * nearest clear point on a road instead. A start is never allowed to be a trap.
   * ---------------------------------------------------------------- */
  {
    const clearAt = (x: number, y: number, pad: number) => !rects.some((r) =>
      x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
    const raysClear = (x: number, y: number, len: number) => {
      let open = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        let free = 0;
        for (let d = 40; d <= len; d += 40) {
          if (!clearAt(x + dx * d, y + dy * d, 26)) break;
          free = d;
        }
        if (free >= len * 0.6) open++;
      }
      return open;
    };
    const good = (x: number, y: number) => clearAt(x, y, 56) && raysClear(x, y, 360) >= 2;
    const start = dressing.start;
    if (!good(start.x, start.y)) {
      let best: { x: number; y: number } | null = null, bestD = Infinity;
      const consider = (x: number, y: number) => {
        if (x < 260 || y < 260 || x > GEN_W - 260 || y > ARENA_H - 260) return;
        if (!good(x, y)) return;
        const d = Math.hypot(x - start.x, y - start.y);
        if (d < bestD) { bestD = d; best = { x, y }; }
      };
      // roads first: an insertion on tarmac reads correctly and is always reachable
      for (const road of zones) {
        if (road.kind !== 'road') continue;
        const horizontal = road.w >= road.h;
        for (let t = 0.02; t <= 0.98; t += 0.03) {
          consider(horizontal ? road.x + (road.w - 60) * t + 30 : road.x + road.w / 2,
            horizontal ? road.y + road.h / 2 : road.y + (road.h - 60) * t + 30);
        }
      }
      for (const rad of [140, 260, 420, 620, 900, 1300]) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          consider(start.x + Math.cos(a) * rad, start.y + Math.sin(a) * rad);
        }
      }
      if (best) dressing.start = best;
    }
  }

  /* THE SURVEY PASS. World generation paints several layers in isolation — roads, aprons,
   * helipads, vehicle parks, the army district — so they cross: paint under buildings,
   * pads under hangars, vans inside each other. `tidyWorld` moves the loose kit and cuts
   * the paint, and nothing else: the map itself is untouched. */
  const tidy = tidyWorld({ rects, zones, vanSpots, helipads, parkedHelis, army });

  return {
    tidy,
    rects, zones, serverSpots, generalSpot, coderSpots, garrisonSpots,
    cacheSpots, gateSpots, helipads, hangarSpot, beaconSpots, satcomSpots, barrelSpots, spotlightSpots,
    hangars, vanSpots, paradeSpots, parkedHelis, laserSpots, pois, vaultSpot, planeSpot,
    facilities, facilityGuards, campaignSites,
    powerSites: campaignSites.powerSites, powerCells: campaignSites.powerCells,
    dressing, army, ranks, armyGuards, glacier,
    // Circuits are built last: every structure that could ever block a road already
    // exists, so the traffic network can only contain road that is genuinely open.
    trafficRoutes: trafficFromRoads(
      zones.filter((z) => z.kind === 'road').map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h })),
      rects,
    ),
  };
}
