import type { Rect, StructKind, Zone } from './world';
import type { Block, Point } from './navigation';

export type FacilityKind = 'checkpoint' | 'laboratory' | 'radar' | 'motorpool' | 'power' | 'armory' | 'warehouse' | 'library';
export type PostRole = 'leader' | 'screen' | 'flank' | 'support' | 'sentry' | 'patrol';
export type PropKind = 'console' | 'chamber' | 'dish' | 'transformer' | 'lift' | 'weapons' | 'table' | 'locker' | 'bed' | 'mast' | 'tank' | 'books' | 'pallet'
  | 'cable' | 'cabinet' | 'rack' | 'cooling' | 'freight';

export const FACILITY_TYPES: Record<FacilityKind, { name: string; code: string; color: string; roof: string; w: number; h: number; crew: string[] }> = {
  checkpoint: { name: 'SECURITY CHECKPOINT', code: 'CP', color: '#e3bb75', roof: '#494332', w: 760, h: 430, crew: ['commander', 'warden', 'breacher', 'gunner', 'pathfinder', 'grunt', 'grunt', 'medic', 'flamer', 'shieldman'] },
  laboratory: { name: 'BIORESEARCH LAB', code: 'BIO', color: '#91dfc0', roof: '#31484a', w: 820, h: 620, crew: ['commander', 'warden', 'specter', 'guard', 'pathfinder', 'medic', 'guard', 'sapper', 'drone', 'grunt'] },
  radar: { name: 'SIGNALS STATION', code: 'SIG', color: '#aabcea', roof: '#3a4659', w: 740, h: 520, crew: ['commander', 'sentinel', 'gunner', 'pathfinder', 'guard', 'medic', 'grunt', 'sentinel', 'sapper', 'grunt'] },
  motorpool: { name: 'ARMORED WORKSHOP', code: 'MTR', color: '#89c6dd', roof: '#344854', w: 880, h: 600, crew: ['commander', 'heavy', 'breacher', 'pathfinder', 'gunner', 'medic', 'sapper', 'guard', 'juggernaut', 'grunt'] },
  power: { name: 'POWER SUBSTATION', code: 'PWR', color: '#e3ac73', roof: '#4b4035', w: 780, h: 560, crew: ['commander', 'warden', 'sapper', 'gunner', 'pathfinder', 'medic', 'guard', 'breacher', 'flamer', 'grunt'] },
  armory: { name: 'MUNITIONS BUNKER', code: 'ARM', color: '#c6b793', roof: '#41483a', w: 760, h: 540, crew: ['commander', 'warden', 'bomber', 'heavy', 'breacher', 'medic', 'gunner', 'guard', 'flamer', 'grunt'] },
  warehouse: { name: 'STRATEGIC WAREHOUSE', code: 'GL', color: '#d8b38c', roof: '#444d54', w: 940, h: 500, crew: ['commander', 'warden', 'breacher', 'gunner', 'medic', 'guard', 'sapper', 'pathfinder', 'grunt', 'flamer'] },
  library: { name: 'MNEMOSYNE LIBRARY', code: 'SSR-0', color: '#d4bd94', roof: '#3e3938', w: 920, h: 740, crew: ['sentinel', 'pathfinder', 'guard', 'warden', 'guard', 'medic'] },
};

export interface FacilityProp extends Block { kind: PropKind; color: string; solid: boolean; destroyed?: boolean; /** Stencilled manifest text for freight crates and pallets. */ label?: string }
export interface Facility extends Block {
  id: string; kind: FacilityKind; name: string; code: string;
  props: FacilityProp[]; doors: Point[]; roofed: boolean;
  /** Power site that feeds this facility — lights and machines die with it. */
  siteId?: string;
}
export interface FacilityGuard extends Point {
  type: string; facilityId: string; role: PostRole; patrol: Point[];
}
export interface FacilityState extends Facility {
  reveal: number; discovered: boolean; secured: boolean; alarm: boolean; remaining: number;
  ruined?: boolean;
  /** True while its power site is offline: props stop glowing, floors go unlit. */
  dark?: boolean;
}

interface Context {
  sector: number; width: number; height: number;
  rects: Rect[]; zones: Zone[]; facilities: Facility[]; guards: FacilityGuard[];
  gates: Point[]; caches: Point[];
  spotlights: { x: number; y: number; speed: number; sweep: number }[];
  canPlace: (x: number, y: number, w: number, h: number, pad: number) => boolean;
}

/** Allocate whole sites before scattering obstacles so interiors and service lanes stay clear. */
export function populateFacilities(c: Context) {
  const placeAt = (kind: FacilityKind, cx: number, cy: number) => {
    const spec = FACILITY_TYPES[kind], w = spec.w, h = spec.h;
    const x = cx - w / 2, y = cy - h / 2;
    const sequence = c.facilities.length + 1;
    const site: Facility = {
      x, y, w, h, id: `facility-${sequence}`, kind, code: `${spec.code}-${String(sequence).padStart(2, '0')}`,
      name: spec.name, props: [], doors: [{ x: cx, y: y + 14 }, { x: cx, y: y + h - 14 }],
      roofed: kind === 'laboratory' || kind === 'motorpool' || kind === 'armory',
    };
    c.facilities.push(site);
    c.zones.push({ x: x - 38, y: y - 42, w: w + 76, h: h + 108, kind: 'concrete' });
    const add = (rx: number, ry: number, rw: number, rh: number, material: StructKind = kind, height = 32, custom = false) => {
      c.rects.push({ x: x + rx, y: y + ry, w: rw, h: rh, kind: material, h3d: height, tint: spec.roof, facilityDetail: custom });
    };
    const prop = (type: PropKind, rx: number, ry: number, rw: number, rh: number, solid = true, color = spec.color) => {
      site.props.push({ x: x + rx, y: y + ry, w: rw, h: rh, kind: type, color, solid });
      if (solid) add(rx, ry, rw, rh, kind, 20, true);
    };
    const wing = (w - 280) / 2;
    for (const yy of [0, h - 28]) {
      add(0, yy, wing, 28); add(w - wing, yy, wing, 28);
    }
    add(0, 28, 28, h - 56); add(w - 28, 28, 28, h - 56);
    c.gates.push(...site.doors);
    if (kind === 'laboratory') {
      prop('chamber', 55, 56, 75, 144); prop('chamber', 147, 56, 75, 144);
      prop('console', w - 205, 58, 136, 43, false);
      prop('table', w - 206, 142, 130, 76);
      prop('bed', 66, h - 188, 63, 111); prop('bed', 155, h - 188, 63, 111);
      prop('locker', w - 110, h - 182, 45, 112);
      add(28, 245, wing - 15, 16, 'laboratory', 27);
      add(w - wing - 13, 245, wing - 15, 16, 'laboratory', 27);
      prop('console', w - 210, h - 173, 80, 38, false, '#e9c37a');
    } else if (kind === 'motorpool') {
      prop('lift', 60, 80, 164, 243, false);
      prop('lift', w - 224, 80, 164, 243, false);
      add(111, 125, 62, 145, 'motorpool', 22, true);
      add(w - 173, 125, 62, 145, 'motorpool', 22, true);
      prop('console', 62, 38, 147, 34, false);
      prop('weapons', w - 174, 36, 110, 36, false);
      prop('locker', 52, h - 130, 75, 58);
      prop('table', w - 192, h - 130, 130, 66);
      for (const xx of [72, 196, w - 210, w - 86]) prop('mast', xx, 125, 18, 38);
    } else if (kind === 'radar') {
      prop('dish', 53, 58, 168, 168);
      prop('console', w - 208, 63, 134, 47, false);
      prop('locker', w - 147, 138, 70, 124);
      prop('mast', w - 215, h - 149, 50, 55);
      prop('table', 53, h - 127, 151, 48);
      prop('console', w - 205, h - 120, 130, 38, false);
    } else if (kind === 'power') {
      prop('transformer', 54, 69, 146, 175); prop('transformer', w - 200, 69, 146, 175);
      prop('tank', 57, h - 158, 84, 84); prop('tank', 166, h - 150, 61, 61);
      prop('console', w - 192, h - 148, 117, 48, false);
      prop('mast', w - 200, h - 86, 55, 25);
    } else if (kind === 'armory') {
      prop('weapons', 48, 50, 148, 62); prop('weapons', 48, 163, 148, 62);
      prop('weapons', w - 190, 48, 135, 105);
      prop('locker', w - 128, 200, 69, 123);
      prop('table', 47, h - 132, 149, 50);
      prop('console', w - 219, h - 101, 154, 35, false);
      for (const [xx, yy] of [[w - 219, 215], [w - 219, 280]]) add(xx, yy, 47, 47, 'crate', 24);
    } else {
      prop('console', 48, 49, 98, 32, false);
      prop('table', w - 151, 48, 96, 65);
      prop('locker', 46, h - 136, 59, 77);
      prop('mast', w - 101, h - 125, 37, 54);
      add(30, 135, wing - 20, 20, 'sandbag', 14);
      add(w - wing - 10, 135, wing - 20, 20, 'sandbag', 14);
    }
    // Supplies are accessible from the central service corridor, not buried in furniture.
    c.caches.push({ x: cx - 77, y: y + h - 87 });
    const side = sequence % 2 ? 1 : -1;
    c.spotlights.push({ x: cx + side * (w / 2 - 36), y: y + h - 30, speed: 0.5 + sequence % 4 * 0.1, sweep: 1.1 });

    const posts: { p: Point; role: PostRole; patrol?: Point[] }[] = [
      { p: { x: cx + 60, y: y + 97 }, role: 'leader' },
      { p: { x: cx - 66, y: y + h - 57 }, role: 'screen' },
      { p: { x: cx + 64, y: y + h - 57 }, role: 'screen' },
      { p: { x: cx, y: y + h / 2 }, role: 'sentry' },
      { p: { x: x - 52, y: cy + 32 }, role: 'patrol', patrol: [{ x: x - 52, y: y - 50 }, { x: x - 52, y: y + h + 50 }, { x: cx - 165, y: y + h + 50 }] },
      { p: { x: cx + 88, y: cy - 36 }, role: 'support' },
      { p: { x: x + w + 52, y: cy - 40 }, role: 'flank' },
      { p: { x: cx + 70, y: y - 63 }, role: 'sentry' },
      { p: { x: cx - 96, y: cy - 54 }, role: 'support' },
      { p: { x: x + w + 56, y: y + h - 80 }, role: 'patrol', patrol: [{ x: x + w + 56, y: y - 50 }, { x: x + w + 56, y: y + h + 55 }] },
    ];
    const count = 8 + Math.floor((c.sector - 1) / 2);
    posts.slice(0, count).forEach((post, index) => {
      let p = post.p;
      const fits = (q: Point) => !c.rects.some(b => q.x > b.x - 25 && q.x < b.x + b.w + 25 && q.y > b.y - 25 && q.y < b.y + b.h + 25);
      if (!fits(p)) {
        p = { x: cx, y: cy };
        for (let offset = 0; offset < 10; offset++) {
          const q = { x: cx + (index % 2 ? 1 : -1) * 54, y: y + 66 + offset * 35 };
          if (fits(q) && !c.guards.some(g => Math.hypot(g.x - q.x, g.y - q.y) < 38)) { p = q; break; }
        }
      }
      if (!fits(p)) return;
      const type = index >= spec.crew.length ? (c.sector > 3 ? 'sentinel' : 'gunner') : spec.crew[index];
      c.guards.push({ ...p, type, facilityId: site.id, role: post.role, patrol: post.patrol || [] });
    });
    return true;
  };

  /** Anchor spots are preferences, not mandates: as the map grows (feeder yards, aprons,
   *  new bailey works) a preferred spot can get crowded out. Walk a widening elliptical
   *  ring around it so every sector still fields its full complement of installations. */
  const place = (kind: FacilityKind, cx: number, cy: number) => {
    const spec = FACILITY_TYPES[kind], w = spec.w, h = spec.h;
    const fits = (px: number, py: number) => px - w / 2 > 420 && py - h / 2 > 420
      && px + w / 2 < c.width - 420 && py + h / 2 < c.height - 420
      && c.canPlace(px - w / 2 - 90, py - h / 2 - 90, w + 180, h + 180, 30);
    if (fits(cx, cy)) return placeAt(kind, cx, cy);
    for (let ring = 1; ring <= 6; ring++) {
      const r = ring * 380, steps = 6 + ring * 2;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2 + ring * 0.7;
        const px = cx + Math.cos(a) * r * 1.35, py = cy + Math.sin(a) * r;
        if (fits(px, py)) return placeAt(kind, px, py);
      }
    }
    return false;
  };

  const anchors: [FacilityKind, number, number][] = [
    ['laboratory', 1000, 2300], ['radar', 3200, 800], ['warehouse', 3200, 1600], ['armory', 3230, 2600],
    ['motorpool', 9800, 2600], ['radar', 10600, 900], ['checkpoint', 11000, 1900],
    ['checkpoint', 2800, 6400], ['warehouse', 3300, 6600], ['motorpool', 2700, 7400],
    ['checkpoint', 5500, 6300], ['armory', 6900, 7500], ['power', 6800, 7400],
    ['laboratory', 7400, 6800], ['radar', 10200, 7400], ['warehouse', 10700, 2650],
    // Installations added alongside the expanded airfield and the southern feeder yards.
    ['warehouse', 5700, 4900], ['laboratory', 4500, 4200], ['checkpoint', 8900, 6200], ['motorpool', 3700, 2000],
  ];
  for (const [type, x, y] of anchors) place(type, x, y);
  const types: FacilityKind[] = ['checkpoint', 'laboratory', 'radar', 'motorpool', 'power', 'armory'];
  const count = c.facilities.length + Math.max(0, 12 + (c.sector - 1) * 2 - c.facilities.filter(f => types.includes(f.kind)).length);
  for (let attempt = 0; c.facilities.length < count && attempt < 1200; attempt++) {
    const type = [...types].sort((a, b) => c.facilities.filter(f => f.kind === a).length - c.facilities.filter(f => f.kind === b).length)[0];
    place(type, 650 + Math.random() * (c.width - 1300), 650 + Math.random() * (c.height - 1300));
  }
}