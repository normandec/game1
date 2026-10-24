/* ------------------------------------------------------------------ *
 * SECTOR ANNEXES — the new ground south of the legacy theatre
 *
 * The arena was widened for the army district, which left every other sector with a
 * 3 400 m strip of empty concrete below the old south rampart. This module fills that
 * strip, one district per sector, and nothing here is shared:
 *
 *   1  the flooded substation    pump halls, sluices, a drowned archive
 *   2  the sand fortress         cliff fort, derricks, refinery, rail tank cars
 *   3  the glacier gate          ice station, frozen airstrip, mountain wall
 *   4  the spore labs            stilt laboratories, vats, a drowned temple
 *   5  the serpent forge         reactor ring, obelisk line, foundry, slag pits
 *
 * Every position is held by the sector's own regiment, and every one is entered from the
 * legacy map through a single road cut in the old south rampart at x = 6000.
 * ------------------------------------------------------------------ */

import type { Rect, StructKind, Zone } from './world';

export interface AnnexContext {
  sector: number;
  /** Top edge of the new ground (y of the legacy south border). */
  y0: number;
  add: (x: number, y: number, w: number, h: number, kind: StructKind, h3d?: number, tint?: string) => Rect;
  zone: (x: number, y: number, w: number, h: number, kind: Zone['kind']) => void;
  rnd: (a: number, b: number) => number;
}

export interface AnnexStrongpoint {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number;
}

export interface AnnexPlan {
  name: string;
  sub: string;
  /** The road head inside the new ground, where the operative steps off the legacy map. */
  entry: { x: number; y: number };
  strongpoints: AnnexStrongpoint[];
  guards: { x: number; y: number; type: string }[];
  /** Sector 3 only: the glacier gate that opens into the hidden ice base. */
  glacier: { x: number; y: number } | null;
}

/**
 * Build the sector's southern annex. `y0` is the legacy south border (8 200); the strip is
 * `ARMY_SOUTH` deep, but each district only claims the part it needs.
 */
export function buildSectorAnnex(ctx: AnnexContext): AnnexPlan {
  const { sector, y0, add, zone, rnd } = ctx;
  const guards: { x: number; y: number; type: string }[] = [];
  const strongpoints: AnnexStrongpoint[] = [];
  const CX = 6000;

  const post = (id: string, name: string, x: number, y: number, w: number, h: number) => {
    strongpoints.push({ id, name, x, y, w, h });
  };
  const man = (x: number, y: number, type: string) => guards.push({ x, y, type });
  const squad = (x: number, y: number, n: number, types: string[], spread = 70) => {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.35;
      const r = Math.min(spread, 26 + i * (spread / Math.max(1, n)));
      man(x + Math.cos(a) * r, y + Math.sin(a) * r, types[i % types.length]);
    }
  };

  // the approach: one road down from the old map, and a service ring around the district
  zone(CX - 100, y0, 200, 700, 'road');
  zone(500, y0 + 1500, 11200, 140, 'road');
  zone(700, y0 + 700, 150, 2400, 'road');
  zone(11300, y0 + 700, 150, 2400, 'road');
  zone(CX - 380, y0 + 620, 760, 120, 'concrete');

  const entry = { x: CX, y: y0 + 260 };
  /** The glacier gate, in the middle of the north wall of the arctic annex. */
  const glacierDoor = { x: 9700 + 3 * 290 + 140, y: y0 + 1620 };

  /* ================================================================== *
   * 1 · THE FALLEN HUB — rain, standing water, a district that drowned
   * ================================================================== */
  if (sector === 1) {
    const T = ['guard', 'breacher', 'sentinel'];
    zone(700, y0 + 700, 10800, 2400, 'concrete');
    // standing water everywhere, because the pumps failed years ago
    for (let i = 0; i < 46; i++) zone(rnd(800, 11400), rnd(y0 + 800, y0 + 3000), rnd(140, 420), rnd(100, 300), 'puddle');

    post('pumps', 'DROWNED PUMP STATION', 900, y0 + 800, 2200, 700);
    for (let i = 0; i < 4; i++) {
      add(1050 + i * 480, y0 + 900, 360, 240, 'power', 88, '#43585c');
      add(1060 + i * 480, y0 + 1180, 340, 26, 'sandbag', 18);
      add(1060 + i * 480, y0 + 1160, 90, 80, 'barrel', 26, '#3d4a44');
      man(1180 + i * 430, y0 + 1240, T[i % 3]);
    }
    // the sluice: a long barrier with a control house at each end
    post('sluice', 'FLOOD CONTROL SLUICE', 900, y0 + 1700, 2600, 320);
    add(950, y0 + 1800, 2200, 60, 'barrier', 30, '#4a5a5e');
    add(950, y0 + 1780, 220, 110, 'bunker', 54, '#3d4f52');
    add(2930, y0 + 1780, 220, 110, 'bunker', 54, '#3d4f52');
    squad(2000, y0 + 1900, 6, T, 90);

    post('archive', 'DROWNED ARCHIVE', 3800, y0 + 900, 1800, 1100);
    add(3950, y0 + 1000, 700, 420, 'library', 74, '#4d5a52');
    add(3990, y0 + 1480, 620, 320, 'warehouse', 66, '#43524d');
    add(3900, y0 + 1860, 1600, 26, 'sandbag', 18);
    squad(4600, y0 + 1700, 6, T, 110);
    for (let i = 0; i < 12; i++) add(3900 + i * 130, y0 + 880, 90, 70, 'crate', 22, '#3f4c46');

    post('relay', 'RELAY MAST 14', 6600, y0 + 800, 1600, 800);
    add(6850, y0 + 950, 300, 300, 'radar', 120, '#4f5f66');
    add(6750, y0 + 1300, 500, 190, 'power', 62, '#44545a');
    add(6900, y0 + 1520, 200, 26, 'fence', 30, '#6a6a5a');
    squad(7300, y0 + 1200, 5, T, 80);

    post('sanctum', 'SUNKEN SANCTUM', 8800, y0 + 1700, 2400, 1300);
    add(9250, y0 + 1850, 620, 520, 'vault', 88, '#2e4a44');
    add(9050, y0 + 2400, 1000, 30, 'sandbag', 20);
    add(8950, y0 + 2350, 240, 130, 'bunker', 60, '#3c4c48');
    add(10250, y0 + 2350, 240, 130, 'bunker', 60, '#3c4c48');
    squad(9600, y0 + 2280, 8, T, 120);
  }

  /* ================================================================== *
   * 2 · RED MESA — a cliff fort, derricks and a refinery rail yard
   * ================================================================== */
  if (sector === 2) {
    const T = ['warhound', 'bomber', 'breacher'];
    zone(700, y0 + 700, 10800, 2400, 'sand');
    for (let i = 0; i < 60; i++) zone(rnd(800, 11400), rnd(y0 + 800, y0 + 3000), rnd(180, 520), rnd(120, 380), 'sand');

    post('mesa-fort', 'MESA CLIFF FORT', 900, y0 + 800, 2400, 1400);
    // the fort is cut into the mesas themselves
    for (let i = 0; i < 9; i++) {
      const bx = 950 + i * 250;
      add(bx, y0 + 880, 220, 420, 'rock', 130 + (i % 3) * 40, '#6b3d24');
      add(bx, y0 + 1560, 220, 360, 'rock', 110 + (i % 2) * 50, '#7a4526');
    }
    add(1500, y0 + 1380, 900, 150, 'curtain', 58, '#7a4a2c');
    add(1500, y0 + 1300, 160, 120, 'tower', 96, '#6b3d24');
    add(2240, y0 + 1300, 160, 120, 'tower', 96, '#6b3d24');
    squad(1900, y0 + 1320, 7, T, 120);

    post('derricks', 'DERRICK LINE', 3600, y0 + 800, 2200, 900);
    for (let i = 0; i < 5; i++) {
      add(3750 + i * 420, y0 + 900, 260, 260, 'power', 130, '#5a3a26');
      add(3790 + i * 420, y0 + 1200, 180, 110, 'motorpool', 60, '#4a3226');
      man(3860 + i * 420, y0 + 1320, T[i % 3]);
    }

    post('railyard', 'REFINERY RAIL YARD', 6400, y0 + 800, 2400, 1100);
    for (let i = 0; i < 10; i++) add(6550 + i * 210, y0 + 1000, 190, 100, 'railcar', 44, '#5d4a36');
    add(6500, y0 + 1160, 2200, 24, 'sandbag', 18);
    for (let i = 0; i < 3; i++) add(6600 + i * 700, y0 + 1400, 420, 260, 'warehouse', 84, '#4c3a2a');
    for (let i = 0; i < 10; i++) add(6600 + i * 200, y0 + 1300, 52, 52, 'barrel', 26, '#7a4020');
    squad(7600, y0 + 1300, 6, T, 110);

    post('refinery', 'ASH REFINERY', 9100, y0 + 800, 2400, 1300);
    for (let i = 0; i < 6; i++) add(9300 + i * 340, y0 + 900, 240, 240, 'power', 120, '#4a3226');
    add(9200, y0 + 1250, 2000, 60, 'barrier', 30, '#6b3d24');
    for (let i = 0; i < 3; i++) add(9400 + i * 620, y0 + 1450, 480, 300, 'warehouse', 90, '#432e22');
    squad(10200, y0 + 1500, 7, T, 120);
    for (let i = 0; i < 16; i++) add(9400 + (i % 8) * 220, y0 + 1900 + Math.floor(i / 8) * 120, 90, 90, 'barrel', 30, '#7a4020');

    post('spires', 'SANDSTONE SPIRES', 700, y0 + 2500, 10800, 500);
    for (let i = 0; i < 22; i++) {
      add(900 + i * 480, y0 + 2550 + (i % 3) * 80, rnd(90, 200), rnd(80, 170), 'rock', rnd(50, 150), '#6b3d24');
    }
    for (let i = 0; i < 5; i++) squad(1500 + i * 2000, y0 + 2700, 3, T, 70);
  }

  /* ================================================================== *
   * 3 · ARCTIC — an ice station, a frozen airstrip and the mountain wall
   * ================================================================== */
  if (sector === 3) {
    const T = ['sentinel', 'drone', 'shieldman'];
    zone(700, y0 + 700, 10800, 2400, 'snow');
    for (let i = 0; i < 40; i++) zone(rnd(800, 11400), rnd(y0 + 800, y0 + 3000), rnd(160, 460), rnd(120, 340), 'ice');

    post('ice-station', 'WHITE STATIC ICE STATION', 900, y0 + 800, 2400, 1000);
    for (let i = 0; i < 4; i++) {
      add(1050 + i * 520, y0 + 900, 420, 260, 'barrack', 62, '#8fa6ae');
      add(1080 + i * 520, y0 + 1220, 360, 26, 'sandbag', 18);
      man(1240 + i * 500, y0 + 1300, T[i % 3]);
    }
    add(1000, y0 + 1620, 2100, 30, 'fence', 46, '#c8d8de');
    squad(2000, y0 + 1520, 6, T, 110);

    post('airstrip', 'FROZEN AIRSTRIP', 3800, y0 + 850, 3000, 900);
    zone(3900, y0 + 1000, 2800, 300, 'runway');
    for (let i = 0; i < 2; i++) {
      add(4200 + i * 1500, y0 + 980, 1100, 240, 'hangar', 92, '#7f969e');
      zone(4260 + i * 1500, y0 + 1240, 1000, 120, 'concrete');
    }
    for (let i = 0; i < 4; i++) add(4000 + i * 240, y0 + 1450, 96, 190, 'truck', 26, '#3c4a52');
    squad(5200, y0 + 1350, 6, T, 120);

    post('ice-lab', 'CRYOGENICS LAB', 7300, y0 + 800, 2000, 1200);
    add(7500, y0 + 900, 760, 400, 'laboratory', 80, '#9fb2b8');
    add(8380, y0 + 900, 620, 300, 'laboratory', 70, '#8fa6ae');
    add(7460, y0 + 1360, 1560, 28, 'sandbag', 18);
    for (let i = 0; i < 5; i++) add(7560 + i * 300, y0 + 1420, 130, 130, 'bladder', 44, '#a8bcc2');
    squad(8300, y0 + 1300, 7, T, 110);

    post('glacier-face', 'GLACIER WALL', 9600, y0 + 780, 2100, 1500);
    // The mountain wall: the glacier itself rises here, pale and enormous — and there is
    // a way into it. The middle column of ice is a gate, not rock.
    for (let i = 0; i < 7; i++) {
      if (i === 3) continue;
      add(9700 + i * 290, y0 + 850, 260, 520, 'rock', 150 + (i % 3) * 40, '#c9dde4');
      add(9700 + i * 290, y0 + 1420, 260, 400, 'rock', 120 + (i % 2) * 50, '#b6ccd4');
    }
    // the gate: two frozen leaves and a lit seam between them
    add(9700 + 3 * 290 + 10, y0 + 1360, 280, 120, 'icegate', 110, '#cfecf6');
    add(9800, y0 + 1900, 1800, 26, 'fence', 44, '#c8d8de');
    man(10500, y0 + 1850, 'shieldman');
    man(11000, y0 + 1880, 'sentinel');

    post('snow-camp', 'SNOW CAMP', 900, y0 + 2600, 4000, 400);
    for (let i = 0; i < 8; i++) add(1000 + i * 300, y0 + 2650, 260, 150, 'tent', 44, '#c2d2d8');
    for (let i = 0; i < 4; i++) add(1100 + i * 700, y0 + 2900, 60, 60, 'crate', 26, '#9fb2b8');
    squad(2600, y0 + 2760, 5, T, 120);
  }

  /* ================================================================== *
   * 4 · VENOM MARSH — stilt labs over a bog, and a temple that sank
   * ================================================================== */
  if (sector === 4) {
    const T = ['specter', 'sapper', 'drone'];
    zone(700, y0 + 700, 10800, 2400, 'marsh');
    for (let i = 0; i < 60; i++) zone(rnd(800, 11400), rnd(y0 + 800, y0 + 3000), rnd(180, 560), rnd(140, 420), 'marsh');

    post('stilt-labs', 'STILT LABORATORY', 900, y0 + 800, 2600, 1200);
    for (let i = 0; i < 4; i++) {
      add(1050 + i * 560, y0 + 900, 420, 320, 'laboratory', 78, '#46583f');
      for (const dx of [30, 380]) add(1050 + i * 560 + dx, y0 + 1200, 40, 60, 'pillar', 46, '#3a4a32');
      man(1240 + i * 540, y0 + 1320, T[i % 3]);
    }
    for (let i = 0; i < 6; i++) add(1100 + i * 380, y0 + 1420, 140, 140, 'bladder', 46, '#4a5a36');
    squad(2100, y0 + 1600, 6, T, 120);

    post('vats', 'SPORE VAT LINE', 3900, y0 + 800, 2000, 1000);
    for (let i = 0; i < 8; i++) add(4050 + (i % 4) * 440, y0 + 900 + Math.floor(i / 4) * 380, 200, 200, 'bladder', 60, '#54703c');
    add(3950, y0 + 1780, 1800, 26, 'fence', 34, '#4a5a36');
    squad(4800, y0 + 1600, 5, T, 100);

    post('temple', 'DROWNED TEMPLE', 6500, y0 + 800, 2200, 1300);
    for (let i = 0; i < 8; i++) add(6700 + i * 240, y0 + 900, 120, 120, 'pillar', 110, '#3f5236');
    add(6650, y0 + 1500, 1900, 400, 'vault', 84, '#31452e');
    add(6600, y0 + 1420, 2000, 30, 'sandbag', 20);
    squad(7600, y0 + 1650, 8, T, 120);

    post('hatchery', 'HATCHERY PENS', 9200, y0 + 800, 2200, 1200);
    for (let i = 0; i < 3; i++) {
      add(9400 + i * 640, y0 + 900, 480, 320, 'barrack', 58, '#3d4f33');
      add(9400 + i * 640, y0 + 1260, 480, 24, 'fence', 30, '#4a5a36');
    }
    for (let i = 0; i < 10; i++) add(9500 + (i % 5) * 380, y0 + 1400 + Math.floor(i / 5) * 220, 150, 150, 'bladder', 48, '#5e7a44');
    squad(10400, y0 + 1700, 6, T, 110);

    post('bogline', 'BOG LINE', 700, y0 + 2600, 10800, 400);
    for (let i = 0; i < 30; i++) add(900 + i * 340, y0 + 2650 + (i % 4) * 60, rnd(30, 70), rnd(30, 70), 'pine', rnd(20, 60), '#3a4a2a');
    for (let i = 0; i < 4; i++) squad(1800 + i * 2600, y0 + 2750, 3, T, 80);
  }

  /* ================================================================== *
   * 5 · HYDRA NEXUS — the forge below the fortress
   * ================================================================== */
  if (sector === 5) {
    const T = ['juggernaut', 'warden', 'specter'];
    zone(700, y0 + 700, 10800, 2400, 'slag');
    for (let i = 0; i < 50; i++) zone(rnd(800, 11400), rnd(y0 + 800, y0 + 3000), rnd(180, 520), rnd(140, 400), 'slag');

    post('reactor', 'SERPENT REACTOR', 900, y0 + 800, 2400, 1200);
    for (let i = 0; i < 3; i++) add(1100 + i * 700, y0 + 900, 420, 420, 'power', 140, '#3a2430');
    add(1000, y0 + 1400, 2200, 60, 'barrier', 34, '#4a2836');
    for (let i = 0; i < 6; i++) add(1100 + i * 340, y0 + 1500, 120, 120, 'pillar', 100, '#3a2028');
    squad(2000, y0 + 1600, 7, T, 120);

    post('obelisks', 'OBELISK LINE', 3800, y0 + 800, 2200, 900);
    for (let i = 0; i < 10; i++) add(3950 + i * 200, y0 + 900, 110, 110, 'pillar', 140, '#3a2028');
    add(3850, y0 + 1500, 2100, 30, 'sandbag', 20);
    squad(4800, y0 + 1400, 6, T, 110);

    post('foundry', 'SERPENT FOUNDRY', 6600, y0 + 800, 2400, 1200);
    add(6800, y0 + 900, 1900, 380, 'warehouse', 104, '#3a2630');
    for (let i = 0; i < 3; i++) add(6900 + i * 620, y0 + 1350, 480, 260, 'power', 90, '#4a2836');
    for (let i = 0; i < 12; i++) add(6900 + (i % 6) * 320, y0 + 1700 + Math.floor(i / 6) * 140, 90, 90, 'barrel', 30, '#5a2a34');
    squad(7800, y0 + 1500, 7, T, 120);

    post('reliquary', 'RELIQUARY', 9500, y0 + 800, 2000, 1200);
    add(9750, y0 + 900, 900, 600, 'vault', 96, '#33202a');
    add(9650, y0 + 1600, 1600, 32, 'sandbag', 20);
    for (let i = 0; i < 4; i++) add(9700 + i * 380, y0 + 1700, 200, 120, 'bunker', 62, '#3a2430');
    squad(10400, y0 + 1500, 8, T, 120);

    post('slag-pits', 'SLAG PITS', 700, y0 + 2500, 10800, 500);
    for (let i = 0; i < 18; i++) add(1000 + i * 560, y0 + 2550 + (i % 3) * 90, rnd(90, 180), rnd(80, 160), 'rock', rnd(40, 110), '#2a2226');
    for (let i = 0; i < 5; i++) squad(1600 + i * 2100, y0 + 2700, 3, T, 80);
  }

  /* ---------------- district clutter ----------------
   * Every annex is a working place, not a display: stores, wrecks, drums, fencing. It is
   * also what makes the new ground read as inhabited from the moment you walk into it.
   */
  const clutter: Partial<Record<number, StructKind[]>> = {
    1: ['crate', 'barrel', 'truck', 'fence', 'sandbag'],
    2: ['barrel', 'rock', 'crate', 'railcar', 'sandbag'],
    3: ['crate', 'truck', 'barrel', 'fence', 'tent'],
    4: ['crate', 'barrel', 'pillar', 'pine', 'sandbag'],
    5: ['pillar', 'barrel', 'crate', 'rock', 'sandbag'],
  };
  const kinds = clutter[sector] || ['crate', 'barrel'];
  for (let i = 0; i < 150; i++) {
    const x = rnd(760, 11500), y = rnd(y0 + 760, y0 + 3050);
    if (Math.abs(x - CX) < 280) continue;                       // the road in stays clear
    if (y > y0 + 1460 && y < y0 + 1640) continue;               // and so does the ring road
    const kind = kinds[Math.floor(rnd(0, kinds.length))];
    const big = kind === 'railcar' || kind === 'truck' || kind === 'pillar';
    const w = kind === 'sandbag' ? (rnd(0, 1) < 0.5 ? 170 : 26) : big ? rnd(90, 180) : 52;
    const h = kind === 'sandbag' ? (w === 26 ? 170 : 26) : big ? rnd(60, 120) : 52;
    add(x, y, w, h, kind, kind === 'pillar' ? 80 : 22);
  }

  // A road guard at the head of the cut, whoever owns the district.
  const head = sector === 1 ? ['guard', 'sentinel'] : sector === 2 ? ['warhound', 'breacher']
    : sector === 3 ? ['sentinel', 'shieldman'] : sector === 4 ? ['specter', 'sapper'] : ['warden', 'juggernaut'];
  squad(CX - 420, y0 + 560, 4, head, 70);
  squad(CX + 420, y0 + 560, 4, head, 70);
  man(CX - 260, y0 + 900, head[0]);
  man(CX + 260, y0 + 900, head[1]);

  const meta = [
    { name: 'THE FALLEN HUB / SOUTH WORKS', sub: 'FLOOD CONTROL AND A DEAD ARCHIVE' },
    { name: 'RED MESA / CLIFF FORT', sub: 'DERRICKS, REFINERY AND SANDSTONE' },
    { name: 'ARCTIC / GLACIER WALL', sub: 'ICE STATION, AIRSTRIP, THE WALL ITSELF' },
    { name: 'VENOM MARSH / SPORE DISTRICT', sub: 'STILT LABS OVER A DROWNED TEMPLE' },
    { name: 'HYDRA NEXUS / SERPENT FORGE', sub: 'REACTOR, OBELISKS, RELIQUARY' },
  ][Math.max(0, Math.min(4, sector - 1))];

  return {
    name: meta.name, sub: meta.sub, entry, strongpoints, guards,
    glacier: sector === 3 ? glacierDoor : null,
  };
}

/** How many new metres of ground the annexes use south of the legacy border. */
export const ANNEX_DEPTH = 3100;
