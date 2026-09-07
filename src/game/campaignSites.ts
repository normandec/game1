import type { WorldData, Rect, Zone, PoiDef, StructKind } from './world';
import type { Facility, FacilityGuard } from './facilities';
import type { Block, Point } from './navigation';
import { buildPowerYard, yardSize, type PowerCell, type PowerSite } from './powerGrid';

export type { PowerCell, PowerSite } from './powerGrid';
export { yardSize };

/* Goliath logistics fortress: six enormous warehouses around a drive-through cargo lane. */
export const GOLIATH = { x: 2600, y: 4520, w: 2600, h: 2400 };
export const MNEMOSYNE = { x: 2100, y: 2700, w: 920, h: 740 };
/** HELIOS: the sector grid, standing clear of the fortress so it reads as its own stronghold. */
export const HELIOS = { x: 7000, y: 4950, ...yardSize(12, 8) };
/** Feeder yards attached to the other big bases (built in world.ts). */
export const HQ_YARD = { cx: 8425, cy: 1300, ...yardSize(3, 2) };
// South of the highway, across from Goliath's south gate: keeps the yard's service apron
// (helipad, van park, supply crates) clear of SSR RELAY "ROSE" and the depot's east wall.
export const GOLIATH_YARD = { cx: 4620, cy: 6600, ...yardSize(4, 3) };
export const KRAKEN_YARD = { cx: 8700, cy: 6560, ...yardSize(3, 2) };

export interface PatrolRoute {
  id: string; points: Point[]; members: string[];
  /** Formation marching: files abreast, spacing along the column, march speed. */
  columns?: number; spacing?: number; speed?: number;
  kind?: 'foot' | 'road' | 'apron';
  site?: string;
}
export interface LibraryVolume extends Point { number: number; read: boolean }
export interface MegaCrate extends Point {
  id: string; label: string; loot: string; hp: number; maxHp: number; dead: boolean;
  w: number; h: number; color: string;
}
export interface CampaignSites {
  warehouse: Block; library: Block; volumes: LibraryVolume[];
  patrols: PatrolRoute[]; librarySolved: boolean; libraryProgress: number;
  helios: Block; powerCells: PowerCell[]; powerSites: PowerSite[]; megaCrates: MegaCrate[];
}

interface Context {
  sector: number;
  rects: Rect[]; zones: Zone[]; pois: PoiDef[]; facilities: Facility[]; guards: FacilityGuard[];
  gates: Point[]; vans: WorldData['vanSpots']; caches: Point[];
  lights: WorldData['spotlightSpots']; barrels: Point[]; garrison: Point[]; pads: Point[];
}

export function addCampaignSites(c: Context): CampaignSites {
  const depot = { x: GOLIATH.x - GOLIATH.w / 2, y: GOLIATH.y - GOLIATH.h / 2, w: GOLIATH.w, h: GOLIATH.h };
  const archive = { x: MNEMOSYNE.x - MNEMOSYNE.w / 2, y: MNEMOSYNE.y - MNEMOSYNE.h / 2, w: MNEMOSYNE.w, h: MNEMOSYNE.h };
  const patrols: PatrolRoute[] = [];
  const powerCells: PowerCell[] = [];
  const powerSites: PowerSite[] = [];
  const yardCtx = {
    sector: c.sector, rects: c.rects, zones: c.zones, facilities: c.facilities, guards: c.guards,
    gates: c.gates, caches: c.caches, lights: c.lights, barrels: c.barrels, vans: c.vans,
    patrols, pois: c.pois, garrison: c.garrison,
  };
  const add = (x: number, y: number, w: number, h: number, kind: StructKind, height = 34, detail = false) => {
    if (w <= 0 || h <= 0) return;
    c.rects.push({ x, y, w, h, kind, h3d: height, facilityDetail: detail });
  };
  const enclose = (b: Block, kind: StructKind, gap: number, thickness = 32, sideGates = false) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (const y of [b.y, b.y + b.h - thickness]) {
      add(b.x, y, (b.w - gap) / 2, thickness, kind);
      add(cx + gap / 2, y, (b.w - gap) / 2, thickness, kind);
    }
    if (sideGates) {
      const sg = Math.min(300, b.h - thickness * 2 - 80);
      add(b.x, b.y + thickness, thickness, b.h / 2 - thickness - sg / 2, kind);
      add(b.x, cy + sg / 2, thickness, b.h / 2 - thickness - sg / 2, kind);
      add(b.x + b.w - thickness, b.y + thickness, thickness, b.h / 2 - thickness - sg / 2, kind);
      add(b.x + b.w - thickness, cy + sg / 2, thickness, b.h / 2 - thickness - sg / 2, kind);
    } else {
      add(b.x, b.y + thickness, thickness, b.h - thickness * 2, kind);
      add(b.x + b.w - thickness, b.y + thickness, thickness, b.h - thickness * 2, kind);
    }
    const doors = [{ x: cx, y: b.y + thickness / 2 }, { x: cx, y: b.y + b.h - thickness / 2 }];
    if (sideGates) doors.push({ x: b.x + thickness / 2, y: cy }, { x: b.x + b.w - thickness / 2, y: cy });
    c.gates.push(...doors); return doors;
  };

  /* ================================================================== *
   * GOLIATH LOGISTICS FORTRESS — six warehouses of enormous crates
   * ================================================================== */
  c.zones.push({ x: depot.x - 70, y: depot.y - 70, w: depot.w + 140, h: depot.h + 140, kind: 'concrete' });
  const entrances = enclose(depot, 'curtain', 360, 40, true);
  c.pois.push({
    id: 'goliath', kind: 'depot', x: GOLIATH.x, y: GOLIATH.y, r: 1500,
    name: 'GOLIATH LOGISTICS FORTRESS', sub: 'SIX WAREHOUSES / MOTOR COLUMN / FLIGHT CARGO',
    secret: false, gates: entrances,
  });

  const LANE = 300;                                   // central drive-through cargo lane
  const bayW = (depot.w - 200 - LANE) / 2;            // 1000
  const bayH = (depot.h - 200 - 600) / 3;             // 533
  const bayNames = [
    'ORDNANCE RECEIVING', 'VEHICLE PARTS STORE', 'QUANTUM FREIGHT HALL',
    'STRATEGIC RESERVES', 'HEAVY ARMOUR STORE', 'FIELD RATION DEPOT',
  ];
  const bays: Block[] = [];
  const aisleY: number[] = [];
  let bayNumber = 0;
  for (let row = 0; row < 3; row++) {
    const by = depot.y + 100 + row * (bayH + 300);
    if (row) aisleY.push(by - 150);
    for (let col = 0; col < 2; col++) {
      const b = { x: depot.x + 100 + col * (bayW + LANE), y: by, w: bayW, h: bayH };
      bays.push(b); bayNumber++;
      const doors = enclose(b, 'warehouse', Math.min(300, bayW * 0.3), 30, true);
      const f: Facility = {
        ...b, id: `goliath-bay-${bayNumber}`, kind: 'warehouse', name: bayNames[bayNumber - 1],
        code: `GL-${bayNumber}`, props: [], roofed: true, doors, siteId: 'goliath-power',
      };
      c.facilities.push(f);
      // Enormous freight: two ranks of oversized pallets hugging the north/south walls,
      // a clear central band so the crates can actually be reached and looted.
      const palletColors = ['#8b5e3c', '#4b6e63', '#5c4a73', '#bd7a6a', '#3d6276', '#6e5240', '#545e44', '#7a3b48'];
      // Two ranks of oversized pallets, each standing clear of the walls: the infantry
      // planner needs a 44px corridor, so the bays keep a 55px walkway all the way round
      // and a 155px central aisle the mega crates sit in.
      const PALLET_D = 104, WALK = 55;
      // Manifest stencils: every crate in the fortress says what is inside it.
      const cargo = ['7.62x51 LINKED', 'RPG-7 WARHEADS', 'AT-4 TUBES', 'C4 SATCHES', '40MM GRENADES',
        '.50 BMG CANS', 'FLAK SHELLS', 'MEDICAL PLASMA', 'FIELD RATIONS', 'NIGHT SIGHTS',
        'THERMITE CANISTERS', 'ROCKET MOTORS', 'ARMOUR PLATES', 'COMM CIPHERS', 'MINE CANS',
        '9x19 PALLETS', 'RAKETA M92', 'DRUM MAGAZINES'];
      // 7 is coprime with the list length, so the nine crates of a bay never repeat a stencil.
      const manifest = (n: number) => cargo[(n * 7 + bayNumber * 5) % cargo.length];
      let crateIndex = 0;
      for (let rank = 0; rank < 2; rank++) {
        for (let stack = 0; stack < 3; stack++) {
          const sx = b.x + 58 + stack * 316;
          const sy = rank ? b.y + b.h - 30 - WALK - PALLET_D : b.y + 30 + WALK;
          const color = palletColors[(stack + rank + bayNumber) % palletColors.length];
          add(sx, sy, 286, PALLET_D, 'crate', 40);
          f.props.push({ kind: 'pallet', x: sx, y: sy, w: 286, h: PALLET_D, solid: true, color, label: manifest(crateIndex++) });
          add(sx + 34, sy + 16, 96, 74, 'crate', 52);
          add(sx + 168, sy + 22, 84, 62, 'crate', 46);
        }
      }
      // Nothing but enormous crates in here: freight stacks against the east wall and a low
      // manifest crate by the door. Collision footprints are byte-identical to the old rack
      // and console dressing, so every walkway, cache and crew post stays exactly as reachable.
      add(b.x + b.w - 92, b.y + 62, 54, 190, 'warehouse', 30, true);
      f.props.push({
        kind: 'freight', x: b.x + b.w - 92, y: b.y + 62, w: 54, h: 190, solid: true,
        color: palletColors[(bayNumber + 1) % palletColors.length], label: manifest(crateIndex++),
      });
      add(b.x + b.w - 92, b.y + b.h - 252, 54, 190, 'warehouse', 30, true);
      f.props.push({
        kind: 'freight', x: b.x + b.w - 92, y: b.y + b.h - 252, w: 54, h: 190, solid: true,
        color: palletColors[(bayNumber + 3) % palletColors.length], label: manifest(crateIndex++),
      });
      f.props.push({
        kind: 'freight', x: b.x + 44, y: b.y + b.h / 2 - 20, w: 128, h: 40, solid: false,
        color: palletColors[(bayNumber + 5) % palletColors.length], label: manifest(crateIndex++),
      });
      c.caches.push({ x: b.x + b.w - 200, y: b.y + b.h / 2 });   // central aisle, east of the mega crate
      const crew = ['commander', 'warden', 'breacher', 'gunner', 'medic', 'guard', 'sapper', 'pathfinder', 'grunt', 'flamer', 'shieldman', 'grunt'];
      crew.forEach((type, i) => c.guards.push({
        x: b.x + b.w / 2 + (i % 2 ? 168 : -168), y: b.y + b.h / 2 - 62 + Math.floor(i / 2) * 25,
        type, facilityId: f.id, role: i === 0 ? 'leader' : i === 4 ? 'support' : i % 3 === 0 ? 'flank' : 'screen', patrol: [],
      }));
    }
  }

  // Central cargo lane: the depot's vehicle spine, running out through the south gate.
  c.zones.push({ x: GOLIATH.x - LANE / 2, y: depot.y, w: LANE, h: depot.h, kind: 'road' });
  c.zones.push({ x: GOLIATH.x - 110, y: depot.y + depot.h, w: 220, h: 700, kind: 'road' });
  // Cross aisles double as the motor pool: ranks of transports between the warehouses.
  aisleY.forEach((ay, i) => {
    c.zones.push({ x: depot.x + 60, y: ay - 150, w: depot.w - 120, h: 300, kind: 'concrete' });
    c.zones.push({ x: depot.x + 60, y: ay - 60, w: depot.w - 120, h: 120, kind: 'road' });
    for (let col = 0; col < 8; col++) {
      c.vans.push({ x: depot.x + 210 + col * 292, y: ay - 55 + (col % 2) * 4, ang: col % 2 ? Math.PI : 0 });   // parked clear of the bay walls, north of the march line
      if (i === 0 && col % 3 === 0) c.barrels.push({ x: depot.x + 250 + col * 292, y: ay + 96 });
    }
    patrols.push({
      id: `goliath-aisle-${i}`, columns: 4, spacing: 42, speed: 46 + i * 4, kind: 'apron', site: 'goliath-power',
      points: [{ x: depot.x + 200, y: ay }, { x: depot.x + depot.w - 200, y: ay }],
      members: i
        ? ['guard', 'guard', 'grunt', 'grunt', 'grunt', 'grunt', 'gunner', 'medic', 'grunt', 'grunt']
        : ['warden', 'breacher', 'grunt', 'grunt', 'gunner', 'grunt', 'grunt', 'medic', 'grunt', 'flamer'],
    });
  });
  for (const x of [depot.x + 46, depot.x + depot.w - 46]) {
    for (const y of [depot.y + 46, depot.y + depot.h - 46]) c.lights.push({ x, y, speed: 0.53, sweep: 1.05, site: 'goliath-power' });
  }
  c.lights.push({ x: GOLIATH.x - 200, y: depot.y + 24, speed: 0.66, sweep: 0.9, site: 'goliath-power' });
  c.lights.push({ x: GOLIATH.x + 200, y: depot.y + depot.h - 24, speed: 0.72, sweep: 0.9, site: 'goliath-power' });
  c.garrison.push({ x: depot.x + 150, y: depot.y + 150 }, { x: depot.x + depot.w - 150, y: depot.y + 150 },
    { x: depot.x + 150, y: depot.y + depot.h - 150 }, { x: depot.x + depot.w - 150, y: depot.y + depot.h - 150 });
  // Service strip between the depot's north wall and the bay headers, and the matching
  // strip at the south end: both stay clear of the 30px header courses.
  c.caches.push({ x: GOLIATH.x - 210, y: depot.y + 65 }, { x: GOLIATH.x + 210, y: depot.y + depot.h - 65 });

  /* --- Giant experimental crates stocked in Goliath's bays --- */
  const mid = (n: number) => ({ x: bays[n - 1].x + bays[n - 1].w / 2, y: bays[n - 1].y + bays[n - 1].h / 2 });
  const megaCrates: MegaCrate[] = [
    { id: 'tesseract', label: 'TESSERACT ENERGY CORE', loot: 'tesseract', hp: 95, maxHp: 95, dead: false, w: 104, h: 82, color: '#68e7d7', ...mid(1) },
    { id: 'thumper', label: 'M79 HEAVY THUMPER & CLUSTERS', loot: 'gl', hp: 85, maxHp: 85, dead: false, w: 100, h: 78, color: '#f5c978', ...mid(2) },
    { id: 'sniper', label: 'MK-14 DMR & AP ROUNDS', loot: 'dmr', hp: 85, maxHp: 85, dead: false, w: 100, h: 78, color: '#b8a4ff', ...mid(3) },
    { id: 'aegis', label: 'AEGIS MATRIX POD (x3 CELLS)', loot: 'aegis_matrix', hp: 85, maxHp: 85, dead: false, w: 104, h: 82, color: '#80d9ff', ...mid(4) },
    { id: 'nano', label: 'S.H.I.E.L.D. NANO-STIM (+100 HP)', loot: 'nanomed', hp: 75, maxHp: 75, dead: false, w: 96, h: 74, color: '#7dffa1', ...mid(5) },
    { id: 'arsenal', label: 'HYDRA WEAPONS CACHE (ROCKETS)', loot: 'rocket', hp: 90, maxHp: 90, dead: false, w: 106, h: 84, color: '#ff8a5c', ...mid(6) },
    // The rack launcher crate: a full RPG tube with reload pallets beside it.
    { id: 'rpg-rack', label: 'RPG-7 RACK / 12 ROCKETS', loot: 'rocket_rack', hp: 120, maxHp: 120, dead: false, w: 132, h: 96, color: '#ff6b3d', x: mid(2).x + 240, y: mid(2).y },
    { id: 'rpg-ammo', label: 'OG-7V WARHEAD PALLETS (+8)', loot: 'rocket_ammo', hp: 90, maxHp: 90, dead: false, w: 112, h: 84, color: '#ffa06b', x: mid(5).x + 240, y: mid(5).y },
    { id: 'mg-nest', label: 'KPVT HEAVY MG & BELTS', loot: 'heavy_mg', hp: 100, maxHp: 100, dead: false, w: 118, h: 88, color: '#ffd166', x: mid(3).x + 240, y: mid(3).y },
    { id: 'shotgun', label: 'BREACHER-12 CRATE (24 SHELLS)', loot: 'shotgun', hp: 80, maxHp: 80, dead: false, w: 98, h: 76, color: '#ffd27d', x: mid(1).x - 250, y: mid(1).y },
    { id: 'smg', label: 'VECTOR SMG CRATE (190 RDS)', loot: 'smg', hp: 80, maxHp: 80, dead: false, w: 98, h: 76, color: '#c4ff8c', x: mid(4).x - 250, y: mid(4).y },
    { id: 'demo', label: 'DEMOLITION SATCHELS (+6 FRAGS)', loot: 'demo', hp: 85, maxHp: 85, dead: false, w: 104, h: 80, color: '#f2a65a', x: mid(6).x - 250, y: mid(6).y },
  ];
  megaCrates.forEach(mc => add(mc.x - mc.w / 2, mc.y - mc.h / 2, mc.w, mc.h, 'crate', 44));

  /* ================================================================== *
   * HELIOS ERCOT — the sector grid: 12 generators, 8 server racks
   * ================================================================== */
  const helios = buildPowerYard({
    id: 'helios', name: 'HELIOS POWER COMPLEX', code: 'PWR-X',
    cx: HELIOS.x, cy: HELIOS.y, generators: 12, servers: 8,
    defenders: 10, patrolTeams: 4, major: true, poi: true,
  }, yardCtx);
  powerCells.push(...helios.cells);
  powerSites.push(helios);
  c.pads.push(...helios.padSpots);
  const grid: Block = { x: helios.x, y: helios.y, w: helios.w, h: helios.h };
  // Service roads: highway spur from the north, ring-road spur from the south.
  c.zones.push({ x: HELIOS.x - 110, y: HELIOS.y - HELIOS.h / 2 - 1000, w: 220, h: 1000, kind: 'road' });
  c.zones.push({ x: HELIOS.x - 110, y: HELIOS.y + HELIOS.h / 2, w: 220, h: 900, kind: 'road' });
  c.zones.push({ x: HELIOS.x - HELIOS.w / 2 - 700, y: HELIOS.y - 100, w: 700, h: 200, kind: 'road' });
  patrols.push(
    {
      id: 'helios-column', columns: 4, spacing: 40, speed: 52, kind: 'foot', site: 'helios',
      points: [{ x: HELIOS.x - HELIOS.w / 2 - 260, y: grid.y - 260 }, { x: HELIOS.x + HELIOS.w / 2 + 260, y: grid.y - 260 },
        { x: HELIOS.x + HELIOS.w / 2 + 260, y: grid.y + grid.h + 260 }, { x: HELIOS.x - HELIOS.w / 2 - 260, y: grid.y + grid.h + 260 }],
      members: ['warden', 'grunt', 'grunt', 'grunt', 'gunner', 'grunt', 'grunt', 'medic', 'grunt', 'grunt', 'grunt', 'flamer'],
    },
    {
      id: 'helios-road-north', columns: 2, spacing: 50, speed: 62, kind: 'road', site: 'helios',
      points: [{ x: HELIOS.x, y: HELIOS.y - HELIOS.h / 2 - 940 }, { x: HELIOS.x, y: HELIOS.y - HELIOS.h / 2 - 120 }],
      members: ['sentinel', 'pathfinder', 'grunt', 'grunt', 'grunt', 'grunt', 'pathfinder', 'medic'],
    },
    {
      id: 'helios-road-south', columns: 2, spacing: 50, speed: 60, kind: 'road', site: 'helios',
      points: [{ x: HELIOS.x, y: HELIOS.y + HELIOS.h / 2 + 840 }, { x: HELIOS.x, y: HELIOS.y + HELIOS.h / 2 + 120 }],
      members: ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'grunt', 'breacher', 'guard'],
    },
  );

  /* --- Goliath's own feeder yard keeps the warehouses lit --- */
  const goliathYard = buildPowerYard({
    id: 'goliath-power', name: 'GOLIATH FEEDER YARD', code: 'PWR-G',
    cx: GOLIATH_YARD.cx, cy: GOLIATH_YARD.cy, generators: 4, servers: 3, defenders: 4, patrolTeams: 2,
  }, yardCtx);
  powerCells.push(...goliathYard.cells);
  powerSites.push(goliathYard);
  c.pads.push(...goliathYard.padSpots);
  // Highway spur: depot's south face -> feeder yard's north gate.
  c.zones.push({
    x: GOLIATH_YARD.cx - 110, y: depot.y + depot.h, w: 220,
    h: GOLIATH_YARD.cy - GOLIATH_YARD.h / 2 - depot.y - depot.h, kind: 'road',
  });
  patrols.push({
    id: 'goliath-yard-ring', columns: 2, spacing: 48, speed: 58, kind: 'road', site: 'goliath-power',
    points: [
      { x: goliathYard.x - 200, y: goliathYard.y - 200 }, { x: goliathYard.x + goliathYard.w + 200, y: goliathYard.y - 200 },
      { x: goliathYard.x + goliathYard.w + 200, y: goliathYard.y + goliathYard.h + 200 }, { x: goliathYard.x - 200, y: goliathYard.y + goliathYard.h + 200 },
    ],
    members: ['sapper', 'grunt', 'gunner', 'grunt', 'guard', 'grunt', 'flamer', 'grunt'],
  });

  /* ================================================================== *
   * MNEMOSYNE — a deliberately quiet, pre-digital archive
   * ================================================================== */
  c.zones.push({ x: archive.x - 35, y: archive.y - 35, w: archive.w + 70, h: archive.h + 95, kind: 'plaza' });
  const libraryDoors = enclose(archive, 'library', 210, 32);
  const library: Facility = { ...archive, id: 'mnemosyne', code: 'SSR-0', kind: 'library', name: 'MNEMOSYNE LIBRARY', props: [], roofed: true, doors: libraryDoors };
  c.facilities.push(library);
  c.pois.push({
    id: 'mnemosyne', kind: 'library', x: MNEMOSYNE.x, y: MNEMOSYNE.y, r: 550,
    name: 'MNEMOSYNE LIBRARY', sub: 'THE LAST WATCH / THE FIRST OATH / THE SECOND DAWN',
    secret: true, gates: libraryDoors,
  });
  const shelf = (sx: number, sy: number) => {
    add(sx, sy, 224, 67, 'library', 30, true);
    library.props.push({ kind: 'books', x: sx, y: sy, w: 224, h: 67, solid: true, color: '#bba079' });
  };
  for (const side of [0, 1]) for (let i = 0; i < 4; i++) {
    shelf(archive.x + (side ? archive.w - 300 : 70), archive.y + 70 + i * 147);
  }
  add(MNEMOSYNE.x - 74, MNEMOSYNE.y - 70, 148, 110, 'library', 26, true);
  library.props.push({ kind: 'table', x: MNEMOSYNE.x - 74, y: MNEMOSYNE.y - 70, w: 148, h: 110, solid: true, color: '#d6b982' });
  library.props.push({ kind: 'cable', x: archive.x + 40, y: archive.y + archive.h - 40, w: archive.w - 80, h: 16, solid: false, color: '#8a7a5c' });
  const volumes: LibraryVolume[] = [
    { x: MNEMOSYNE.x - 143, y: MNEMOSYNE.y - 206, number: 1, read: false },
    { x: MNEMOSYNE.x + 143, y: MNEMOSYNE.y + 202, number: 2, read: false },
    { x: MNEMOSYNE.x + 143, y: MNEMOSYNE.y - 206, number: 3, read: false },
  ];
  ['sentinel', 'pathfinder', 'guard', 'warden', 'guard', 'medic', 'sentinel', 'guard'].forEach((type, i) => c.guards.push({
    x: MNEMOSYNE.x + (i % 2 ? 94 : -94), y: archive.y + 140 + Math.floor(i / 2) * 165,
    type, facilityId: 'mnemosyne', role: i === 0 ? 'leader' : i === 5 ? 'support' : 'sentry', patrol: [],
  }));
  c.caches.push({ x: MNEMOSYNE.x - 80, y: archive.y + archive.h - 92 });

  /* ================================================================== *
   * ROAD & APRON PATROLS — ranks and columns on the highway network
   * ================================================================== */
  patrols.push(
    {
      id: 'goliath-patrol', columns: 2, spacing: 46, speed: 54, kind: 'apron', site: 'goliath-power',
      points: [{ x: depot.x + 150, y: depot.y + 150 }, { x: depot.x + depot.w - 150, y: depot.y + 150 },
        { x: depot.x + depot.w - 150, y: depot.y + depot.h - 150 }, { x: depot.x + 150, y: depot.y + depot.h - 150 }],
      members: ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'pathfinder', 'grunt', 'medic', 'grunt', 'flamer'],
    },
    {
      id: 'goliath-lane', columns: 2, spacing: 52, speed: 50, kind: 'road', site: 'goliath-power',
      points: [{ x: GOLIATH.x, y: depot.y + 140 }, { x: GOLIATH.x, y: depot.y + depot.h - 140 }],
      members: ['grunt', 'grunt', 'gunner', 'grunt', 'grunt', 'gunner', 'grunt', 'grunt', 'medic', 'grunt'],
    },
    {
      id: 'road-watch-a', columns: 2, spacing: 54, speed: 64, kind: 'road',
      points: [{ x: 5200, y: 6120 }, { x: 6800, y: 6120 }, { x: 6800, y: 7000 }],
      members: ['sentinel', 'pathfinder', 'grunt', 'grunt', 'grunt', 'grunt', 'pathfinder', 'medic'],
    },
    {
      id: 'road-watch-b', columns: 4, spacing: 38, speed: 50, kind: 'road',
      points: [{ x: 4200, y: 2150 }, { x: 3000, y: 2150 }, { x: 1400, y: 2150 }],
      members: ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'grunt', 'breacher', 'guard'],
    },
    {
      id: 'road-watch-c', columns: 2, spacing: 48, speed: 58, kind: 'road',
      points: [{ x: 8400, y: 2150 }, { x: 9800, y: 2150 }, { x: 11200, y: 2150 }],
      members: ['warden', 'gunner', 'grunt', 'grunt', 'grunt', 'medic', 'grunt', 'grunt'],
    },
    {
      id: 'kraken-column-a', columns: 4, spacing: 40, speed: 52, kind: 'apron', site: 'airfield',
      points: [{ x: 8300, y: 4720 }, { x: 9300, y: 4720 }, { x: 9300, y: 4200 }, { x: 8300, y: 4200 }],
      members: ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'gunner', 'grunt', 'medic', 'grunt', 'flamer'],
    },
    {
      id: 'kraken-column-b', columns: 2, spacing: 46, speed: 56, kind: 'apron', site: 'airfield',
      points: [{ x: 9600, y: 4900 }, { x: 11100, y: 4900 }, { x: 11100, y: 5500 }, { x: 9600, y: 5500 }],
      members: ['warden', 'breacher', 'grunt', 'grunt', 'flamer', 'flamer', 'grunt', 'medic', 'grunt', 'grunt'],
    },
    {
      id: 'ring-road-east', columns: 2, spacing: 58, speed: 66, kind: 'road',
      points: [{ x: 11495, y: 1400 }, { x: 11495, y: 4200 }, { x: 11495, y: 6900 }],
      members: ['pathfinder', 'grunt', 'grunt', 'gunner', 'grunt', 'grunt', 'medic', 'grunt'],
    },
    {
      id: 'ring-road-south', columns: 4, spacing: 44, speed: 60, kind: 'road',
      points: [{ x: 1200, y: 5895 }, { x: 5200, y: 5895 }, { x: 9200, y: 5895 }, { x: 11000, y: 5895 }],
      members: ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'grunt', 'grunt', 'medic', 'grunt', 'shieldman', 'grunt', 'grunt'],
    },
    {
      id: 'ring-road-west', columns: 2, spacing: 50, speed: 62, kind: 'road',
      points: [{ x: 995, y: 1400 }, { x: 995, y: 4200 }, { x: 995, y: 6900 }],
      members: ['sentinel', 'grunt', 'grunt', 'gunner', 'grunt', 'pathfinder', 'medic', 'grunt'],
    },
    {
      id: 'highway-column', columns: 4, spacing: 42, speed: 68, kind: 'road',
      points: [{ x: 6000, y: 4000 }, { x: 6000, y: 5600 }, { x: 6000, y: 7400 }],
      members: ['commander', 'gunner', 'grunt', 'grunt', 'grunt', 'grunt', 'breacher', 'medic', 'grunt', 'grunt', 'flamer', 'grunt'],
    },
  );

  return {
    warehouse: depot, library: archive, volumes, librarySolved: false, libraryProgress: 0,
    helios: grid, powerCells, powerSites, megaCrates, patrols,
  };
}
