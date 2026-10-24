/* ------------------------------------------------------------------ *
 * IRON VEIL — sector dressing
 *
 * Every sector used to differ only by a colour palette and a weather tint. This module
 * gives each one its own ground, its own roadside clutter, its own regiment and its own
 * insertion point — and for the Arctic its own weather machinery: snow cover, drifts along
 * the roads, and snowploughs that drive their rounds and push the drifts into banks while
 * the operative watches.
 *
 * Nothing here moves or removes a single legacy structure: every call only appends.
 * ------------------------------------------------------------------ */

import type { StructKind, Zone } from './world';

export interface Drift {
  /** Centre, radius and height of a snow / dust / slurry heap. Draw-only, never solid. */
  x: number; y: number; r: number; h: number;
  /** How full it is right now; ploughs pile it up, weather slowly refills it. */
  fill: number;
}

export interface PloughRoute {
  /** Two-point lane (a road centreline). The plough ping-pongs along it. */
  ax: number; ay: number; bx: number; by: number;
  /** Metres per second while working. */
  speed: number;
  /** Side the blade throws the snow to: +1 right of travel, -1 left. */
  side: 1 | -1;
  /** How far off the centreline the shoulder is: half the road plus the verge. */
  off: number;
}

export interface SectorDressing {
  /** Surface layers the renderer draws under/over the regular zones. */
  snow: boolean;
  dust: boolean;
  marsh: boolean;
  slag: boolean;
  /** Roadside heaps. Snow for the Arctic, red dust for the mesa, slurry for the marsh. */
  drifts: Drift[];
  /** Plough lanes (only the Arctic has any). */
  ploughs: PloughRoute[];
  /** Extra unit types this territory fields. */
  regiment: string[];
  /** Where the operative is inserted in this sector. */
  start: { x: number; y: number };
  /** Faction name shown on the HUD. */
  force: string;
}

export interface DressContext {
  sector: number;
  zones: Zone[];
  add: (x: number, y: number, w: number, h: number, kind: StructKind, h3d?: number, tint?: string) => { hp?: number; maxHp?: number };
  zone: (x: number, y: number, w: number, h: number, kind: Zone['kind']) => void;
  rnd: (a: number, b: number) => number;
  /** Legacy theatre size, so dressing never spills into the prison or the army. */
  width: number;
  height: number;
}

/** Six different insertions, so the campaign never starts the same way twice. */
export const SECTOR_STARTS: { x: number; y: number }[] = [
  { x: 6000, y: 6800 },     // 1 · the hub: south approach
  { x: 1500, y: 7600 },     // 2 · red mesa: south-west dust road
  { x: 10600, y: 900 },     // 3 · arctic: north-east ice shelf
  { x: 900, y: 900 },       // 4 · marsh: north-west bog
  { x: 11200, y: 7500 },    // 5 · nexus: south-east slag yard
  { x: 6000, y: 8460 },     // 6 · army: the causeway (filled in by the world builder)
];

export const sectorStart = (sector: number) =>
  SECTOR_STARTS[Math.max(0, Math.min(SECTOR_STARTS.length - 1, sector - 1))];

/** Road centrelines, longest first: plough routes and drift lines both use them. */
function roads(zones: Zone[]) {
  return zones
    .filter((z) => z.kind === 'road' && Math.max(z.w, z.h) > 700)
    .map((z) => ({
      z,
      horizontal: z.w >= z.h,
      len: Math.max(z.w, z.h),
      cx: z.x + z.w / 2,
      cy: z.y + z.h / 2,
    }))
    .sort((a, b) => b.len - a.len);
}

/**
 * Dress a sector. `sector` is 1-based; the army district (6) is built separately by army.ts
 * and only keeps the insertion point from here.
 */
export function dressSector(ctx: DressContext): SectorDressing {
  const { sector, zones, add, zone, rnd, width, height } = ctx;
  const drifts: Drift[] = [];
  const ploughs: PloughRoute[] = [];
  const out: SectorDressing = {
    snow: false, dust: false, marsh: false, slag: false,
    drifts, ploughs,
    regiment: [],
    start: sectorStart(sector),
    force: 'HYDRA',
  };
  const lanes = roads(zones);

  /* ---------------- 1 · THE FALLEN HUB ---------------- */
  if (sector === 1) {
    out.force = 'HYDRA / FIRST HUB';
    // standing water on the concrete aprons, and drifting rain haze is drawn elsewhere
    for (let i = 0; i < 40; i++) {
      const x = rnd(600, width - 600), y = rnd(600, height - 600);
      zone(x, y, rnd(90, 240), rnd(70, 180), 'puddle');
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd(700, width - 700), y = rnd(700, height - 700);
      add(x, y, 46, 46, 'crate', 22);
    }
  }

  /* ---------------- 2 · RED MESA ARSENAL ---------------- */
  if (sector === 2) {
    out.force = 'HYDRA / ASH LEGION';
    out.regiment = ['warhound', 'bomber', 'breacher'];
    out.dust = true;
    // dust banks blown against the lee side of every road
    for (const l of lanes.slice(0, 14)) {
      const step = 220;
      for (let d = 120; d < l.len; d += step) {
        const t = d / l.len;
        for (const side of [-1, 1]) {
          const off = side * (l.horizontal ? l.z.h / 2 + 46 : l.z.w / 2 + 46);
          const x = l.horizontal ? l.z.x + d : l.cx + off;
          const y = l.horizontal ? l.cy + off : l.z.y + d;
          if (rnd(0, 1) < 0.55 && x > 200 && x < width - 200 && y > 200 && y < height - 200) {
            drifts.push({ x, y, r: rnd(34, 90), h: rnd(6, 20), fill: 1 - t * 0.3 });
          }
        }
      }
    }
    // red sandstone spires and refinery stacks
    for (let i = 0; i < 90; i++) {
      const x = rnd(500, width - 500), y = rnd(500, height - 500);
      add(x, y, rnd(60, 150), rnd(60, 150), 'rock', rnd(40, 120), '#6b3d24');
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd(900, width - 900), y = rnd(900, height - 900);
      add(x, y, 200, 200, 'power', 120, '#4a3226');
    }
    for (let i = 0; i < 30; i++) {
      const x = rnd(700, width - 700), y = rnd(700, height - 700);
      add(x, y, 60, 60, 'barrel' as StructKind, 30, '#7a4020');
    }
  }

  /* ---------------- 3 · ARCTIC RELAY ---------------- */
  if (sector === 3) {
    out.force = 'ARMY / WINTER RELAY';
    out.snow = true;
    out.regiment = ['sentinel', 'drone', 'shieldman'];
    // ploughs work the six longest roads, throwing snow to the outside of the bend
    for (let i = 0; i < Math.min(6, lanes.length); i++) {
      const l = lanes[i];
      ploughs.push({
        ax: l.horizontal ? l.z.x + 60 : l.cx,
        ay: l.horizontal ? l.cy : l.z.y + 60,
        bx: l.horizontal ? l.z.x + l.z.w - 60 : l.cx,
        by: l.horizontal ? l.cy : l.z.y + l.z.h - 60,
        speed: 74 + i * 6,
        side: i % 2 === 0 ? 1 : -1,
        off: (l.horizontal ? l.z.h : l.z.w) / 2 + 46,
      });
    }
    // initial drifts along every road edge: the ploughs will pile these higher
    for (const l of lanes.slice(0, 18)) {
      const step = 150;
      for (let d = 80; d < l.len; d += step) {
        for (const side of [-1, 1]) {
          const off = side * (l.horizontal ? l.z.h / 2 + 38 : l.z.w / 2 + 38);
          const x = l.horizontal ? l.z.x + d : l.cx + off;
          const y = l.horizontal ? l.cy + off : l.z.y + d;
          if (x < 220 || x > width - 220 || y < 220 || y > height - 220) continue;
          if (rnd(0, 1) < 0.7) drifts.push({ x, y, r: rnd(40, 95), h: rnd(10, 34), fill: rnd(0.55, 1) });
        }
      }
    }
    // open field drifts, away from the roads
    for (let i = 0; i < 260; i++) {
      const x = rnd(400, width - 400), y = rnd(400, height - 400);
      if (lanes.some((l) => l.horizontal
        ? Math.abs(y - l.cy) < l.z.h / 2 + 30
        : Math.abs(x - l.cx) < l.z.w / 2 + 30)) continue;
      drifts.push({ x, y, r: rnd(30, 120), h: rnd(4, 18), fill: rnd(0.4, 1) });
    }
    // ice sheets, frozen convoys, and heated shelters with steam
    for (let i = 0; i < 46; i++) {
      const x = rnd(500, width - 500), y = rnd(500, height - 500);
      zone(x, y, rnd(140, 420), rnd(110, 320), 'ice');
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd(700, width - 700), y = rnd(700, height - 700);
      add(x, y, 96, 190, 'truck', 26, '#3c4a52');
    }
    for (let i = 0; i < 16; i++) {
      const x = rnd(800, width - 800), y = rnd(800, height - 800);
      add(x, y, 300, 220, 'barrack', 44, '#4a5a60');
      add(x + 90, y + 40, 120, 120, 'power', 32, '#5a6a70');
    }
    for (let i = 0; i < 12; i++) {
      const x = rnd(900, width - 900), y = rnd(900, height - 900);
      add(x, y, 240, 240, 'radar', 90, '#5c6c78');
    }
    // snow poles with reflective bands along the roads: cheap, and they sell "winter road"
    for (const l of lanes.slice(0, 10)) {
      const step = 260;
      for (let d = 100; d < l.len; d += step) {
        const side = (Math.floor(d / step) % 2 === 0 ? -1 : 1);
        const off = side * (l.horizontal ? l.z.h / 2 + 22 : l.z.w / 2 + 22);
        const x = l.horizontal ? l.z.x + d : l.cx + off;
        const y = l.horizontal ? l.cy + off : l.z.y + d;
        if (x < 220 || x > width - 220 || y < 220 || y > height - 220) continue;
        add(x, y, 14, 14, 'fence', 46, '#c8d8de');
      }
    }
  }

  /* ---------------- 4 · VENOM MARSH ---------------- */
  if (sector === 4) {
    out.force = 'HYDRA / VENOM DIVISION';
    out.marsh = true;
    out.regiment = ['specter', 'sapper', 'drone'];
    for (let i = 0; i < 70; i++) {
      const x = rnd(500, width - 500), y = rnd(500, height - 500);
      zone(x, y, rnd(160, 520), rnd(120, 420), 'marsh');
    }
    for (let i = 0; i < 240; i++) {
      const x = rnd(400, width - 400), y = rnd(400, height - 400);
      add(x, y, 26, 26, 'pine', rnd(30, 70), '#3a4a2a');
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd(900, width - 900), y = rnd(900, height - 900);
      add(x, y, 220, 220, 'power', 96, '#3d4a32');
    }
    for (let i = 0; i < 70; i++) {
      const x = rnd(700, width - 700), y = rnd(700, height - 700);
      drifts.push({ x, y, r: rnd(40, 130), h: rnd(3, 9), fill: rnd(0.5, 1) });
    }
  }

  /* ---------------- 5 · HYDRA NEXUS ---------------- */
  if (sector === 5) {
    out.force = 'HYDRA / TRIPLE SERPENT';
    out.slag = true;
    out.regiment = ['juggernaut', 'warden', 'specter'];
    for (let i = 0; i < 60; i++) {
      const x = rnd(500, width - 500), y = rnd(500, height - 500);
      zone(x, y, rnd(140, 460), rnd(120, 380), 'slag');
    }
    for (let i = 0; i < 120; i++) {
      const x = rnd(400, width - 400), y = rnd(400, height - 400);
      add(x, y, rnd(70, 160), rnd(70, 160), 'rock', rnd(30, 90), '#2a2226');
    }
    for (let i = 0; i < 40; i++) {
      const x = rnd(700, width - 700), y = rnd(700, height - 700);
      add(x, y, 54, 54, 'pillar', rnd(80, 160), '#3a2028');
    }
    for (let i = 0; i < 80; i++) {
      const x = rnd(700, width - 700), y = rnd(700, height - 700);
      drifts.push({ x, y, r: rnd(40, 110), h: rnd(3, 10), fill: rnd(0.4, 1) });
    }
  }

  /* ---------------- 6 · VOJSKA (built by army.ts) ---------------- */
  if (sector >= 6) {
    out.force = 'S.H.I.E.L.D. / IRON RESERVE';
    out.regiment = ['armytrooper', 'armyguard', 'armyengineer'];
  }

  return out;
}
