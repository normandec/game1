/* ------------------------------------------------------------------ *
 * IRON VEIL — World generation & spatial index
 * 10x larger theatre with a colossal fortress HQ.
 * ------------------------------------------------------------------ */

import { populateFacilities, type Facility, type FacilityGuard } from './facilities';
import { addCampaignSites, GOLIATH, MNEMOSYNE, HQ_YARD, KRAKEN_YARD, type CampaignSites, type PatrolRoute } from './campaignSites';
import { buildPowerYard, type PowerCell, type PowerSite } from './powerGrid';

export const ARENA_W = 12000;
export const ARENA_H = 8200;

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
];

export type StructKind =
  | 'wall' | 'bunker' | 'crate' | 'sandbag'
  | 'curtain' | 'tower' | 'keep' | 'barrack' | 'gate' | 'pillar' | 'server'
  | 'truck' | 'antenna' | 'hangar' | 'fence' | 'vault'
  | 'laboratory' | 'radar' | 'motorpool' | 'power' | 'armory' | 'checkpoint' | 'warehouse' | 'library'
  | 'plane';

export interface Rect {
  x: number; y: number; w: number; h: number;
  kind: StructKind;
  h3d: number;      // extrusion height for the 2.5D look
  tint?: string;
  hp?: number; dead?: boolean;
  facilityDetail?: boolean;
  maxHp?: number; structuralGroup?: number;
}

export interface Zone {
  x: number; y: number; w: number; h: number;
  kind: 'road' | 'concrete' | 'sand' | 'grass' | 'blood' | 'plaza' | 'helipad' | 'fuel' | 'runway' | 'parade';
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
}

/* Fortress layout (center-north of the map) */
export const HQ = {
  cx: ARENA_W / 2,
  cy: 2150,
  w: 3900,
  h: 2950,
};

export const PLAYER_START = { x: ARENA_W / 2, y: ARENA_H - 1400 };
export const VAULT_ENTRY = { x: 980, y: 7040 };
export const AIRFIELD = { x: 9650, y: 4400, w: 3300, h: 2500 };

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
  /** Every defended generator/server yard on the map, biggest first. */
  powerSites: PowerSite[];
  powerCells: PowerCell[];
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
  const pois: PoiDef[] = [];
  const facilities: Facility[] = [];
  const facilityGuards: FacilityGuard[] = [];

  const add = (x: number, y: number, w: number, h: number, kind: StructKind, h3d = 14, tint?: string) => {
    if (w <= 0 || h <= 0) return;
    rects.push({ x, y, w, h, kind, h3d, tint });
  };

  /* ---------------- Map border ramparts ---------------- */
  const B = 60;
  add(0, 0, ARENA_W, B, 'curtain', 26);
  add(0, ARENA_H - B, ARENA_W, B, 'curtain', 26);
  add(0, 0, B, ARENA_H, 'curtain', 26);
  add(ARENA_W - B, 0, B, ARENA_H, 'curtain', 26);

  /* ---------------- THE FORTRESS ---------------- */
  const { cx, cy, w: FW, h: FH } = HQ;
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

  // Second defensive ring. Four breaches preserve routes while making the enlarged HQ feel layered.
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
  const generalSpot = { x: cx, y: kT + KH / 2 };

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
    if (Math.hypot(x + w / 2 - PLAYER_START.x, y + h / 2 - PLAYER_START.y) < 620) return false;
    // Reserve installations and road corridors before random cover is placed.
    if (x < AIRFIELD.x + AIRFIELD.w / 2 + 120 && x + w > AIRFIELD.x - AIRFIELD.w / 2 - 120
      && y < AIRFIELD.y + AIRFIELD.h / 2 + 120 && y + h > AIRFIELD.y - AIRFIELD.h / 2 - 120) return false;
    if (x < 2160 && x + w > 490 && y < 8020 && y + h > 6960) return false;
    if (x < cx + 170 && x + w > cx - 170 && y > Bo - 20) return false;
    if (y < 5990 && y + h > 5650) return false;
    if (x < ARENA_W - 520 && x + w > ARENA_W - 780 && y > 3300) return false;
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
  const afx = AIRFIELD.x, afy = AIRFIELD.y;
  const AFW = AIRFIELD.w, AFH = AIRFIELD.h;
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
  zones.push({ x: krakenYard.x + krakenYard.w, y: KRAKEN_YARD.cy - 100, w: AIRFIELD.x - 120 - (krakenYard.x + krakenYard.w), h: 200, kind: 'road' });

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
  laserAt(ARENA_W - 1500, ARENA_H - 1500, 'laser-b', 'HYDRA BEAM SITE OMEGA');

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
  peggyAt(1650, ARENA_H - 1500, 'peggy-a', 'SSR STATION “CARTER”', 'FOUNDED 1946 — HYDRA OCCUPIED');
  peggyAt(9300, 1400, 'peggy-b', 'SSR VAULT “MARGARET”', 'ORIGINAL S.H.I.E.L.D. ARCHIVE');
  peggyAt(4620, 5450, 'peggy-c', 'SSR RELAY “ROSE”', 'PRE-HYDRA COMMS OUTPOST');

  /* ---- THE HIDDEN S.H.I.E.L.D. VAULT: never marked, never captured ---- */
  const vaultSpot = { x: 980, y: ARENA_H - 780 };
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
      secret: true, gates: [{ x: VAULT_ENTRY.x, y: VAULT_ENTRY.y + 20 }],
    });
  }

  // Highways radiating from the fortress
  const roadW = 190;
  zones.push({ x: cx - roadW / 2, y: Bo, w: roadW, h: ARENA_H - Bo - 80, kind: 'road' });
  zones.push({ x: 80, y: cy - roadW / 2, w: L - 80, h: roadW, kind: 'road' });
  zones.push({ x: R, y: cy - roadW / 2, w: ARENA_W - R - 80, h: roadW, kind: 'road' });
  zones.push({ x: cx - roadW / 2, y: 80, w: roadW, h: T - 80, kind: 'road' });
  // Ring road
  zones.push({ x: 900, y: ARENA_H - 2400, w: ARENA_W - 1800, h: roadW, kind: 'road' });
  zones.push({ x: 900, y: 1200, w: roadW, h: ARENA_H - 3600, kind: 'road' });
  zones.push({ x: ARENA_W - 600, y: 1200, w: roadW, h: ARENA_H - 3600, kind: 'road' });
  zones.push({ x: AIRFIELD.x - 120, y: AIRFIELD.y + AFH / 2, w: 240, h: 600, kind: 'road' });

  const campaignSites = addCampaignSites({ sector: Math.max(1, Math.min(5, sector)),
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
    sector: Math.max(1, Math.min(5, sector)), width: ARENA_W, height: ARENA_H,
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

  const sectorPressure = Math.max(1, Math.min(5, sector));
  let wtries = 0, built = 0;
  while (built < 30 + sectorPressure * 5 && wtries++ < 900) {
    const fw = rnd(420, 760), fh = rnd(360, 620);
    const fx = rnd(700, ARENA_W - 700), fy = rnd(700, ARENA_H - 700);
    if (compound(fx, fy, fw, fh)) built++;
  }

  // Industrial blocks / warehouses
  wtries = 0; built = 0;
  while (built < 60 + sectorPressure * 12 && wtries++ < 1600) {
    const w = rnd(180, 460), h = rnd(160, 380);
    const x = rnd(300, ARENA_W - 300 - w), y = rnd(300, ARENA_H - 300 - h);
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
    const x = rnd(200, ARENA_W - 200 - w), y = rnd(200, ARENA_H - 200 - h);
    if (!noOverlap(x, y, w, h, 96)) continue;
    add(x, y, w, h, kind, h3);
    built++;
  }

  // Terrain patches for visual variety
  for (let i = 0; i < 70 + sectorPressure * 8; i++) {
    const w = rnd(400, 1400), h = rnd(350, 1200);
    zones.push({
      x: rnd(100, ARENA_W - 100 - w), y: rnd(100, ARENA_H - 100 - h),
      w, h, kind: sectorPressure === 2 ? 'sand' : sectorPressure === 3 ? 'concrete' : Math.random() < 0.55 ? 'sand' : 'grass',
    });
  }

  // Extra caches along the approach corridors
  for (let i = 0; i < 22; i++) {
    cacheSpots.push({
      x: rnd(500, ARENA_W - 500),
      y: rnd(500, ARENA_H - 500),
    });
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
    const x = rnd(700, ARENA_W - 700), y = rnd(700, ARENA_H - 700);
    if (Math.hypot(x - cx, y - cy) < HQ.w * 0.62) continue;
    if (Math.hypot(x - PLAYER_START.x, y - PLAYER_START.y) < 800) continue;
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
  towerAt(900, 1200); towerAt(ARENA_W - 600, 1200);
  towerAt(900, ARENA_H - 2210); towerAt(ARENA_W - 600, ARENA_H - 2210);
  towerAt(cx, ARENA_H - 2210); towerAt(cx, 1200);

  // SATCOM arrays — secondary command-net infrastructure (destructible)
  const satAt = (x: number, y: number) => {
    if (!noOverlap(x - 60, y - 60, 120, 120, 110)) return;
    satcomSpots.push({ x, y });
    zones.push({ x: x - 160, y: y - 160, w: 320, h: 320, kind: 'concrete' });
  };
  satAt(cx, 760);
  satAt(1100, ARENA_H * 0.5);
  satAt(ARENA_W - 1100, ARENA_H * 0.55);
  satAt(ARENA_W * 0.25, ARENA_H - 1500);
  satAt(ARENA_W * 0.75, ARENA_H - 1900);

  // FUEL YARDS — chain-reaction explosive barrels
  let yards = 0, ytries = 0;
  while (yards < 11 && ytries++ < 500) {
    const yx = rnd(600, ARENA_W - 600), yy = rnd(600, ARENA_H - 600);
    if (Math.hypot(yx - cx, yy - cy) < HQ.w * 0.6) continue;
    if (Math.hypot(yx - PLAYER_START.x, yy - PLAYER_START.y) < 700) continue;
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
  truckRow(cx - 1600, ARENA_H - 2600, 5, 240, 0);

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

  return {
    rects, zones, serverSpots, generalSpot, coderSpots, garrisonSpots,
    cacheSpots, gateSpots, helipads, hangarSpot, beaconSpots, satcomSpots, barrelSpots, spotlightSpots,
    hangars, vanSpots, paradeSpots, parkedHelis, laserSpots, pois, vaultSpot, planeSpot,
    facilities, facilityGuards, campaignSites,
    powerSites: campaignSites.powerSites, powerCells: campaignSites.powerCells,
  };
}
