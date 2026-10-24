/**
 * HYDRA PRISON — "THE CAGE"
 *
 * A complete first-person prison simulation, kept deliberately free of three.js so it
 * can be tested headlessly. `Prison3D.tsx` only draws whatever this file reports.
 *
 * Scale, for reference: 4 cell wings, 45 cells per side, 360 cells, 360 inmates,
 * 60 guards, 8 towers, 2 control rooms, a yard, a medical bay, an armory and a
 * sally port. Everything is generated, so nothing had to be deleted from the map.
 */

export const CELL_W = 3.6;
export const CELL_D = 5.6;          // a real cell: bunk, locker, shelf, toilet, sink
export const CELL_H = 3.8;
export const WING_ROWS = 40;        // 40 x 3.6 = 144 m, the block is as long as before
export const WINGS = 4;
export const CORRIDOR_HALF = 1.95;

export type LockState = 'intact' | 'broken';
export type GuardState = 'patrol' | 'alert' | 'engage' | 'down';
export type InmateState = 'cell' | 'free' | 'fight' | 'down';

export interface PrisonCell {
  id: number; wing: number; row: 0 | 1; index: number;
  /** centre of the cell */
  x: number; z: number;
  /** corridor side the bars face: +1 means bars are on the +z side */
  face: 1 | -1;
  lockHp: number; lockMax: number; lock: LockState; opened: boolean; openedAt: number;
  occupant: number; tint: number;
}

export interface PrisonGuard {
  id: number; x: number; z: number; ang: number; y: number;
  hp: number; maxHp: number; state: GuardState;
  patrol: { x: number; z: number }[]; node: number;
  cool: number; alertT: number; tower: boolean; flash: number;
  /** ragdoll state: velocity, tilt and the limb phase used by the renderer */
  vx: number; vz: number; vy: number; tilt: number; spin: number; limb: number;
  /** true for the two control-room detachments: they hold the room, not the corridor */
  elite: boolean; room: string;
  /** cached line-of-sight: recomputed every ~0.2 s instead of every frame */
  losT?: number; losSeen?: boolean;
  /** metres per second right now, so the renderer can pick walk or run */
  gait: number;
  /** where the chase last saw the operative */
  lastX: number; lastZ: number;
  /** cooldown after a capture, so the same officer cannot cuff twice in a second */
  cuffCool: number;
}

export interface PrisonInmate {
  id: number; cell: number; x: number; z: number; y: number; ang: number;
  hp: number; maxHp: number; state: InmateState; cool: number; target: number; flash: number;
  vx: number; vz: number; vy: number; tilt: number; spin: number; limb: number;
  gait: number;
}

export interface PrisonWall {
  x: number; z: number; w: number; d: number;
  /** vertical extent: bottom and top, so galleries, walls and lintels can share one list */
  y0: number; y1: number;
  kind: 'wall' | 'bar' | 'gate' | 'prop';
  /** cell that owns this bar wall (bars can be opened) */
  cell?: number;
}

export interface PrisonButton {
  id: string; label: string; sub: string;
  x: number; z: number; y: number;
  kind: 'open-all' | 'sally' | 'lights' | 'armory' | 'alarm';
  used: boolean; room: string;
}

export interface PrisonProp {
  x: number; z: number; y: number; w: number; d: number; h: number;
  kind: 'bed' | 'toilet' | 'sink' | 'table' | 'bench' | 'locker' | 'desk' | 'crate' | 'console' | 'pipe' | 'medkit' | 'lamp' | 'camera'
    | 'monitor' | 'chair' | 'tray' | 'pot' | 'rack' | 'shelf' | 'cabinet' | 'workbench' | 'laundry' | 'stretcher'
    | 'siren' | 'vent' | 'fridge' | 'tank' | 'weaponrack'
    | 'mattress' | 'celllamp' | 'stove' | 'cooker' | 'bin' | 'board' | 'extinguisher';
  solid: boolean;
}

/**
 * A physical lever inside a control room. The master release can only be thrown by
 * hand, with the mouse, from inside the room it lives in.
 */
export interface PrisonLever {
  id: string; label: string; sub: string; room: string;
  /** handle position — what the crosshair has to be on */
  x: number; z: number; y: number;
  /** console the handle sits on */
  baseX: number; baseZ: number;
  pulled: boolean;
  /** 0..1, filled while the handle is held */
  progress: number;
  /** only the master lever needs a long, loud hold */
  holdTime: number;
}

export type WeaponId = 'pistol' | 'carbine' | 'shotgun' | 'smg';

export interface WeaponSpec {
  name: string; mag: number; reserve: number; cool: number; damage: number;
  spread: number; pellets: number; reload: number; auto: boolean;
}

/** Four guns, all lootable from the armory and the guard house. */
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: { name: 'M9 SIDEARM', mag: 12, reserve: 36, cool: 0.16, damage: 46, spread: 0.012, pellets: 1, reload: 1.25, auto: false },
  carbine: { name: 'AR-4 CARBINE', mag: 30, reserve: 90, cool: 0.1, damage: 54, spread: 0.009, pellets: 1, reload: 1.7, auto: true },
  shotgun: { name: 'M870 BREACHER', mag: 6, reserve: 24, cool: 0.72, damage: 30, spread: 0.055, pellets: 8, reload: 2.3, auto: false },
  smg: { name: 'MP-9 COMPACT', mag: 32, reserve: 128, cool: 0.075, damage: 32, spread: 0.02, pellets: 1, reload: 1.5, auto: true },
};

export interface PrisonPickup {
  x: number; z: number; y: number;
  kind: 'ammo' | 'medkit' | 'armor' | 'keys' | 'weapon';
  /** which gun is lying on the rack, for kind 'weapon' */
  weapon?: WeaponId;
  /** rounds handed over, for kind 'ammo' */
  amount?: number;
  taken: boolean;
}

/** The workshop floor grate: pry it open and the prison is behind you. */
export interface PrisonHatch {
  x: number; z: number; y: number;
  hp: number; max: number; open: boolean; progress: number;
}

/**
 * Loose junk with its own physics: paper, cups, cans, shell casings and splinters.
 * Kicked by boots, thrown by gunfire, and settling on the floor.
 */
export interface PrisonDebris {
  x: number; z: number; y: number;
  vx: number; vz: number; vy: number;
  rot: number; tilt: number; spin: number;
  size: number;
  /** 0 paper · 1 cup · 2 can · 3 casing · 4 splinter · 5 shard */
  kind: number;
  rest: boolean;
}

export interface PrisonEvent {
  kind: 'shot' | 'hit' | 'break' | 'open-all' | 'sally' | 'shout' | 'down' | 'pickup' | 'exit'
    | 'alarm' | 'armory' | 'cuff' | 'hatch' | 'reload';
  x: number; z: number; y: number;
}

export interface PrisonStats { freed: number; guardsDown: number; inmatesDown: number; shots: number; hits: number; looted: number }

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerpTo = (v: number, target: number, k: number) => v + (target - v) * clamp(k, 0, 1);

/** Wing origins: four parallel galleried cell houses. */
export const wingZ = (wing: number) => (wing - 1.5) * 30;
export const WING_X0 = -(WING_ROWS * CELL_W) / 2;

export class PrisonSim {
  cells: PrisonCell[] = [];
  guards: PrisonGuard[] = [];
  inmates: PrisonInmate[] = [];
  walls: PrisonWall[] = [];
  buttons: PrisonButton[] = [];
  levers: PrisonLever[] = [];
  /** Rooms by name, so the HUD and the compass can say where things are. */
  rooms: { name: string; x: number; z: number; w: number; d: number }[] = [];
  /** 0..1 how loud the sirens are right now (rises when the alarm is tripped). */
  siren = 0;
  props: PrisonProp[] = [];
  /** Loose, physical junk covering every floor in the prison. */
  debris: PrisonDebris[] = [];
  pickups: PrisonPickup[] = [];
  events: PrisonEvent[] = [];

  // player
  px = 0; pz = 0; py = 1.62;
  yaw = Math.PI; pitch = 0;
  hp = 100; maxHp = 100; armor = 0;
  /** the gun in hand, and its state */
  weapon: WeaponId = 'pistol';
  mag = 12; magSize = 12; reserve = 48; reloading = 0; cool = 0;
  /** seconds left of the cuffing cinematic: hands behind the back, no input */
  cuffed = 0;
  /** the floor grate in the workshop */
  hatch: PrisonHatch = { x: 99, z: -19, y: 0, hp: 100, max: 100, open: false, progress: 0 };
  flash = 0; flashlight = false;
  alive = true;
  /** 0 while nobody suspects anything, 1 once the alarm is screaming */
  alarm = 0; alarmOn = false;
  /** Seconds of immunity right after waking up: nobody shoots a man on his bunk. */
  spawnGrace = 0;
  lightsOut = false;
  time = 0; started = false;
  /** 'cell' → locked in, 'active' → out, 'escaped' → back in the world */
  phase: 'cell' | 'active' | 'escaped' = 'cell';
  stats: PrisonStats = { freed: 0, guardsDown: 0, inmatesDown: 0, shots: 0, hits: 0, looted: 0 };
  sallyOpen = false;
  allOpen = false;
  /** cell the player wakes up in */
  homeCell = 0;
  message = '';
  messageT = 0;

  private grid = new Map<number, number[]>();
  private staticGrid = new Map<number, number[]>();
  private cellIndex = new Map<string, number>();
  private cellSize = 8;

  constructor(public seed = 7) {
    this.build();
    this.spawnInCell();
  }

  /* ------------------------------------------------------------------ */
  /* construction                                                        */
  /* ------------------------------------------------------------------ */

  private build() {
    // ---------- cell wings ----------
    let id = 0;
    for (let wing = 0; wing < WINGS; wing++) {
      const z0 = wingZ(wing);
      for (let row = 0 as 0 | 1; row < 2; row = (row + 1) as 0 | 1) {
        for (let i = 0; i < WING_ROWS; i++) {
          const x = WING_X0 + CELL_W * (i + 0.5);
          const z = row === 0 ? z0 - CORRIDOR_HALF - CELL_D / 2 : z0 + CORRIDOR_HALF + CELL_D / 2;
          const face: 1 | -1 = row === 0 ? 1 : -1;
          this.cells.push({
            id, wing, row, index: i, x, z, face,
            lockHp: 100, lockMax: 100, lock: 'intact', opened: false, openedAt: 0,
            occupant: -1, tint: (i * 37 + wing * 11 + row * 5) % 7,
          });
          this.cellIndex.set(`${wing}:${row}:${i}`, id);
          id++;
        }
      }
    }
    // the operative wakes up in a mid-block cell
    this.homeCell = this.cellIndex.get('1:0:22') ?? 0;

    // ---------- one inmate per cell ----------
    for (const c of this.cells) {
      const n: PrisonInmate = {
        id: this.inmates.length, cell: c.id, x: c.x, z: c.z - c.face * 0.6, y: 0,
        ang: c.face > 0 ? Math.PI / 2 : -Math.PI / 2,
        hp: 60, maxHp: 60, state: 'cell', cool: 0, target: -1, flash: 0,
        vx: 0, vz: 0, vy: 0, tilt: 0, spin: 0, limb: 0, gait: 0,
      };
      c.occupant = n.id;
      this.inmates.push(n);
    }

    // ---------- structure walls ----------
    this.addShell();
    this.addBarsAndCellWalls();
    this.addBlocks();
    this.addRooms();

    // ---------- guards ----------
    this.spawnGuards();

    // ---------- levers, buttons, props, loot ----------
    this.addControlRooms();
    this.addCellProps();
    this.addRoomDetails();
    this.addPickups();
    this.addDebris();

    this.reindex();
  }

  private addShell() {
    const W = (x: number, z: number, w: number, d: number, y0 = 0, y1 = 9, kind: PrisonWall['kind'] = 'wall') =>
      this.walls.push({ x, z, w, d, y0, y1, kind });

    // perimeter: 40 x 40 m short of the outer compound, high concrete
    const P = 108;
    W(0, -P, P * 2 + 8, 4, 0, 12);
    // South wall is split around the sally-port gap, otherwise the gate could never open.
    W(-(18 + (P - 18) / 2), P, P - 18 + 8, 4, 0, 12);
    W(18 + (P - 18) / 2, P, P - 18 + 8, 4, 0, 12);
    W(-P, 0, 4, P * 2, 0, 12);
    W(P, 0, 4, P * 2, 0, 12);

    // sally port gate on the south wall: two heavy leaves, opened by the control room
    this.walls.push({ x: -9, z: P, w: 18, d: 4, y0: 0, y1: 12, kind: 'gate' });
    this.walls.push({ x: 9, z: P, w: 18, d: 4, y0: 0, y1: 12, kind: 'gate' });

    // free-standing gate leaves (kept in a separate lookup so they can swing open)
    this.gateLeaf = [
      { x: -9, z: P, w: 18, d: 4, y0: 0, y1: 12, kind: 'gate' as const, open: false },
      { x: 9, z: P, w: 18, d: 4, y0: 0, y1: 12, kind: 'gate' as const, open: false },
    ];

    // the cell house shell: one enormous hall around all four wings
    const H = 104;
    const hallX = WING_ROWS * CELL_W / 2 + 10;
    /* The hall walls are cut wherever an outer room has its door, otherwise the rooms
     * in the service ring would be sealed off from the cell house. */
    const along = (fixedZ: number | null, fixedX: number | null, from: number, to: number, gaps: [number, number][], t = 3) => {
      let cur = from;
      for (const [g0, g1] of [...gaps].sort((a, b) => a[0] - b[0])) {
        if (g0 > cur + 0.5) {
          const c = (cur + g0) / 2, len = g0 - cur;
          if (fixedZ !== null) W(c, fixedZ, len, t, 0, 14); else W(fixedX!, c, t, len, 0, 14);
        }
        cur = Math.max(cur, g1);
      }
      if (to > cur + 0.5) {
        const c = (cur + to) / 2, len = to - cur;
        if (fixedZ !== null) W(c, fixedZ, len, t, 0, 14); else W(fixedX!, c, t, len, 0, 14);
      }
    };
    along(-H + 34, null, -hallX, hallX, [[-77, -67], [67, 77]]);        // north hall wall
    along(H - 34, null, -hallX, hallX, [[-61, -51], [51, 61]]);         // south hall wall
    along(null, -hallX, -70, 70, [[-15, -5], [25, 35]]);                // west hall wall
    along(null, hallX, -70, 70, [[-15, -5], [35, 45]]);                 // east hall wall

    // cross corridors between wings, every 15 cells
    for (let wing = 0; wing < WINGS - 1; wing++) {
      const za = wingZ(wing) + CORRIDOR_HALF + CELL_D;
      const zb = wingZ(wing + 1) - CORRIDOR_HALF - CELL_D;
      const z = (za + zb) / 2;
      const len = WING_ROWS * CELL_W + 12;
      W(-len / 2, z, len, 2.2, 0, 6);            // spine wall with gangway gaps
      for (let k = -3; k <= 3; k++) {
        // gangway openings: cut the wall into segments so the player can pass
        const gapX = k * 22;
        this.walls.pop();
        W(-len / 2, z, gapX - 3 + len / 2, 2.2, 0, 6);
        W(gapX + 3, z, len / 2 - gapX - 3, 2.2, 0, 6);
      }
    }
  }

  /** kept so the gate can be honoured by collision and by the renderer */
  gateLeaf: { x: number; z: number; w: number; d: number; y0: number; y1: number; kind: 'gate'; open: boolean }[] = [];

  private addBarsAndCellWalls() {
    for (const c of this.cells) {
      // back wall + two side walls
      this.walls.push({ x: c.x, z: c.z - c.face * (CELL_D / 2 + 0.15), w: CELL_W, d: 0.3, y0: 0, y1: CELL_H, kind: 'wall' });
      this.walls.push({ x: c.x - CELL_W / 2, z: c.z, w: 0.3, d: CELL_D, y0: 0, y1: CELL_H, kind: 'wall' });
      // the bar front: solid until the lock is broken
      this.walls.push({ x: c.x, z: c.z + c.face * (CELL_D / 2), w: CELL_W, d: 0.22, y0: 0, y1: CELL_H, kind: 'bar', cell: c.id });
    }
  }

  /**
   * Walled rooms in the outer ring. Each one is four walls with a single doorway —
   * previously these were solid blocks, which is why the control rooms could not be
   * entered and the master button could never be pressed.
   */
  private addBlocks() {
    this.room(-56, 84, 30, 22, 6, 'n', 'CONTROL A');
    this.room(56, 84, 30, 22, 6, 'n', 'CONTROL B');
    this.room(-72, -92, 40, 24, 6, 's', 'MEDICAL');
    this.room(72, -92, 44, 24, 7, 's', 'CANTEEN');
    this.room(95, 40, 22, 26, 6, 'w', 'ARMORY');
    this.room(95, -10, 22, 26, 6, 'w', 'WORKSHOP');
    this.room(-95, 30, 22, 24, 6, 'e', 'LAUNDRY');
    this.room(-95, -10, 22, 24, 6, 'e', 'GUARD HOUSE');
    // low bleachers along the north yard wall
    const B = (x: number, z: number, w: number, d: number, y1 = 3) =>
      this.walls.push({ x, z, w, d, y0: 0, y1, kind: 'wall' });
    B(-20, -100, 34, 8); B(20, -100, 34, 8);
  }

  /** Four walls, a doorway, and a name the HUD can point at. */
  private room(cx: number, cz: number, w: number, d: number, h: number, door: 'n' | 's' | 'e' | 'w', name: string) {
    const t = 1.1, hw = w / 2, hd = d / 2, gap = 6.4;
    const W = (x: number, z: number, ww: number, dd: number) =>
      this.walls.push({ x, z, w: ww, d: dd, y0: 0, y1: h, kind: 'wall' });
    const horiz = (z: number, open: boolean) => {
      if (!open) { W(cx, z, w + t, t); return; }
      W(cx - (hw + gap / 2) / 2, z, hw - gap / 2, t);
      W(cx + (hw + gap / 2) / 2, z, hw - gap / 2, t);
    };
    const vert = (x: number, open: boolean) => {
      if (!open) { W(x, cz, t, d + t); return; }
      W(x, cz - (hd + gap / 2) / 2, t, hd - gap / 2);
      W(x, cz + (hd + gap / 2) / 2, t, hd - gap / 2);
    };
    horiz(cz - hd, door === 'n');
    horiz(cz + hd, door === 's');
    vert(cx - hw, door === 'w');
    vert(cx + hw, door === 'e');
    this.rooms.push({ name, x: cx, z: cz, w, d });
  }

  /** The furniture that makes each room read as the room it is. */
  private addRooms() {
    const P = (x: number, z: number, w: number, d: number, h: number, kind: PrisonProp['kind'], solid = true, y = 0) =>
      this.props.push({ x, z, w, d, h, kind, solid, y });

    /* ---- CANTEEN: eight tables, trays, a serving line and a kitchen ---- */
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const tx = 72 - 14 + i * 9.2, tz = -92 - 6 + j * 12;
        P(tx, tz, 4.6, 1.3, 0.78, 'table');
        P(tx, tz - 1.1, 3.6, 0.5, 0.46, 'bench');
        P(tx, tz + 1.1, 3.6, 0.5, 0.46, 'bench');
        P(tx + 1.6, tz + 0.2, 0.5, 0.36, 0.08, 'tray', false, 0.8);
      }
    }
    P(72, -101, 1.1, 1.1, 1.9, 'pot');           // serving urns
    P(75, -101, 1.1, 1.1, 1.9, 'pot');
    P(66, -101, 3.4, 1.0, 0.95, 'shelf');        // servery counter
    P(89, -99, 1.0, 1.0, 2.1, 'fridge');
    P(56, -86, 0.9, 0.9, 0.9, 'crate');
    P(88, -85, 1.4, 0.9, 1.1, 'sink');

    /* ---- ARMORY: weapon racks, lockers, a bolted cage ---- */
    for (let i = 0; i < 5; i++) P(88 + i * 3.2, 30, 2.2, 0.7, 1.9, 'weaponrack');
    P(98, 36, 0.9, 0.7, 1.9, 'rack');
    P(103, 44, 1.2, 0.9, 2.0, 'cabinet');
    P(99, 44, 1.2, 0.9, 2.0, 'cabinet');
    P(90, 46, 2.6, 1.0, 1.0, 'crate');

    /* ---- MEDICAL: beds, cabinets, a trolley ---- */
    for (let i = 0; i < 3; i++) P(-84 + i * 7, -98, 2.2, 1.0, 0.62, 'stretcher');
    P(-90, -84, 1.1, 0.8, 1.9, 'cabinet');
    P(-82, -84, 1.1, 0.8, 1.9, 'cabinet');
    P(-60, -96, 1.4, 0.9, 0.9, 'desk');

    /* ---- WORKSHOP: benches, tool cabinets, a press ---- */
    for (let i = 0; i < 3; i++) P(88 + i * 4, -18, 3.4, 1.1, 0.92, 'workbench');
    P(103, -2, 1.2, 1.0, 2.0, 'cabinet');
    P(88, -2, 1.6, 1.6, 1.6, 'tank');

    /* ---- LAUNDRY: machine bank ---- */
    for (let i = 0; i < 5; i++) P(-104 + i * 4.4, 24, 2.0, 1.1, 1.3, 'laundry');
    P(-104, 38, 1.4, 1.0, 1.9, 'shelf');

    /* ---- GUARD HOUSE: lockers, a ready bench, a coffee urn ---- */
    for (let i = 0; i < 5; i++) P(-104 + i * 4.4, -18, 1.4, 0.9, 2.0, 'locker');
    P(-95, -4, 4.0, 1.0, 0.5, 'bench');
    P(-86, -16, 0.9, 0.9, 1.0, 'pot');

    /* ---- CONTROL A / B: console banks, monitors, chairs ---- */
    for (const b of [[-66, 88], [-56, 88], [-46, 88], [46, 88], [56, 88], [66, 88]]) {
      P(b[0], b[1], 3.0, 1.2, 1.05, 'console');
      for (let k = -1; k <= 1; k++) P(b[0] + k * 0.9, b[1] - 0.35, 0.8, 0.14, 0.62, 'monitor', false, 1.1);
      P(b[0], b[1] - 1.9, 0.9, 0.9, 0.95, 'chair');
    }
    // wall monitor banks, the thing you look at while the handle is thrown
    for (const [x, z] of [[-66, 94.2], [-56, 94.2], [-46, 94.2], [46, 94.2], [56, 94.2], [66, 94.2]] as [number, number][]) {
      for (let k = 0; k < 3; k++) P(x - 1.2 + k * 1.2, z, 1.05, 0.16, 0.72, 'monitor', false, 2.2);
    }

    /* ---- ALARM HARDWARE: sirens on the walls, beacons over every door ---- */
    for (const [x, z] of [[-72, -70], [72, -70], [-72, 70], [72, 70], [0, -70], [0, 70], [-108, 0], [108, 0], [0, -108], [0, 108]] as [number, number][]) {
      P(x, z, 0.7, 0.4, 0.5, 'siren', false, 3.5);
    }
    // ventilation trunks along the hall ceiling: the prison breathes
    for (let z = -60; z <= 60; z += 20) {
      P(-80, z, 1.0, 3.0, 0.7, 'vent', false, 3.1);
      P(80, z, 1.0, 3.0, 0.7, 'vent', false, 3.1);
    }
  }

  private spawnGuards() {
    let id = 0;
    const push = (x: number, z: number, patrol: { x: number; z: number }[], tower = false) => {
      this.guards.push({
        id: id++, x, z, ang: rnd(0, TAU), y: tower ? 9.5 : 0,
        hp: 150, maxHp: 150, state: 'patrol', patrol, node: 0,
        cool: rnd(0.4, 1.6), alertT: 0, tower, flash: 0,
        vx: 0, vz: 0, vy: 0, tilt: 0, spin: 0, limb: 0, elite: false, room: '',
        gait: 0, lastX: x, lastZ: z, cuffCool: 0,
      });
    };
    // 4 per wing corridor, walking the length of the block
    for (let wing = 0; wing < WINGS; wing++) {
      const z = wingZ(wing);
      const half = (WING_ROWS * CELL_W) / 2 - 6;
      for (let k = 0; k < 4; k++) {
        const x0 = -half + (k * half) / 2;
        push(x0, z + (k % 2 ? 1.6 : -1.6), [
          { x: -half, z }, { x: 0, z: z + 2 }, { x: half, z }, { x: 0, z: z - 2 },
        ]);
      }
    }
    // patrols in the free corridors between the wings
    for (let i = 0; i < 10; i++) {
      const z = (wingZ(i % 3) + wingZ(i % 3 + 1)) / 2;
      push(-54 + i * 12, z, [{ x: -60, z }, { x: 60, z }]);
    }
    // yard and block patrols
    for (const [x, z] of [[-40, -96], [0, -96], [40, -96], [-70, -40], [70, -40], [-70, 40], [70, 40], [0, 96],
      [-30, 96], [30, 96], [-88, -10], [88, 10]] as [number, number][]) {
      push(x, z, [{ x, z }, { x: x + 20, z: z + 8 }, { x: x - 12, z: z - 6 }]);
    }
    // control room sentries, mess hall, medical bay, armory and the sally port
    for (const [x, z] of [[-56, 82], [56, -70], [-78, -74], [-96, -60], [84, -78], [80, 78], [0, 100], [0, 92],
      [-40, -60], [40, 60], [56, -88], [-56, 88], [10, -100], [-10, 100]] as [number, number][]) {
      push(x, z, [{ x, z }, { x: x + 12, z: z + 6 }]);
    }
    // control-room detachments: the rooms are held, not patrolled
    const held: [string, number, number][] = [
      ['CONTROL A', -62, 82], ['CONTROL A', -56, 86], ['CONTROL A', -50, 82], ['CONTROL A', -56, 78],
      ['CONTROL B', 50, 82], ['CONTROL B', 56, 86], ['CONTROL B', 62, 78],
    ];
    for (const [room, x, z] of held) {
      this.guards.push({
        id: id++, x, z, ang: rnd(0, TAU), y: 0,
        hp: 260, maxHp: 260, state: 'patrol',
        patrol: [{ x: x - 3, z }, { x: x + 3, z }, { x, z: z + 3 }, { x, z: z - 3 }], node: 0,
        cool: rnd(0.3, 0.9), alertT: 0, tower: false, flash: 0,
        vx: 0, vz: 0, vy: 0, tilt: 0, spin: 0, limb: 0, elite: true, room,
        gait: 0, lastX: x, lastZ: z, cuffCool: 0,
      });
    }
    // eight tower marksmen
    for (const [x, z] of [[-106, -106], [106, -106], [-106, 106], [106, 106], [0, -106], [0, 106], [-106, 0], [106, 0]] as [number, number][]) {
      push(x, z, [{ x, z }], true);
    }
  }

  /**
   * Control rooms. The master release is not a button any more: it is a physical
   * handle on a console, inside a guarded room full of monitors, and it is thrown
   * with the mouse while you stand in front of it.
   */
  private addControlRooms() {
    const L = (
      id: string, label: string, sub: string, room: string,
      x: number, z: number, holdTime: number,
    ) => this.levers.push({
      id, label, sub, room, x, z, y: 1.22, baseX: x, baseZ: z + 1.1,
      pulled: false, progress: 0, holdTime,
    });
    L('master', 'CELL BLOCK MASTER', 'THROW THE HANDLE TO OPEN EVERY CELL', 'CONTROL A', -56, 79.4, 3.6);
    L('lights', 'LIGHTING GRID', 'CUT THE HALL LIGHTS', 'CONTROL A', -46, 79.4, 1.2);
    L('sally', 'SALLY PORT', 'OPEN THE SOUTH GATE', 'CONTROL B', 56, 79.4, 2.0);
    L('armory', 'ARMORY RACK', 'RELEASE THE WEAPONS LOCKERS', 'CONTROL B', 66, 79.4, 1.6);
    L('alarm', 'ALARM LOOP', 'LOOP THE SIRENS AND SLOW RESPONSE', 'CONTROL B', 46, 79.4, 1.6);
    // the consoles the handles are bolted to
    for (const l of this.levers) {
      this.props.push({ x: l.baseX, z: l.baseZ, y: 0, w: 2.6, d: 1.2, h: 1.05, kind: 'console', solid: true });
    }
  }

  /**
   * What is actually inside a cell: a bunk with a mattress, a steel locker, a shelf,
   * a wall lamp, a toilet and (in some) a sink. Cells are 3.6 x 5.6 m, so all of it fits
   * without the operative getting stuck on the way out.
   */
  private addCellProps() {
    for (const c of this.cells) {
      const back = c.z - c.face * (CELL_D / 2);
      // bunk along the back wall, head end against the side wall
      this.props.push({ x: c.x - 0.55, z: back + c.face * 1.05, y: 0, w: 2.2, d: 0.95, h: 0.45, kind: 'bed', solid: true });
      this.props.push({ x: c.x - 0.55, z: back + c.face * 1.05, y: 0.45, w: 2.05, d: 0.86, h: 0.14, kind: 'mattress', solid: false });
      // steel locker beside the bunk
      this.props.push({ x: c.x + 1.32, z: back + c.face * 0.85, y: 0, w: 0.62, d: 1.0, h: 1.9, kind: 'locker', solid: true });
      // wall lamp over the bunk: the only light a man has after lock-up
      this.props.push({ x: c.x + 0.55, z: back + c.face * 0.06, y: 2.42, w: 0.26, d: 0.16, h: 0.42, kind: 'celllamp', solid: false });
      // toilet by the bars, sink beside it in every second cell
      this.props.push({ x: c.x + 1.24, z: c.z + c.face * 0.85, y: 0, w: 0.55, d: 0.6, h: 0.75, kind: 'toilet', solid: true });
      if (c.index % 2 === 0) this.props.push({ x: c.x + 1.24, z: c.z + c.face * 1.85, y: 0, w: 0.5, d: 0.45, h: 0.85, kind: 'sink', solid: true });
      // a shelf of belongings, a chair, a box: cells are lived in
      if (c.index % 3 === 0) this.props.push({ x: c.x - 1.5, z: c.z + c.face * 1.5, y: 0, w: 0.45, d: 1.0, h: 1.5, kind: 'shelf', solid: true });
      if (c.index % 4 === 1) this.props.push({ x: c.x - 1.45, z: c.z + c.face * 1.85, y: 0, w: 0.5, d: 0.5, h: 0.9, kind: 'chair', solid: true });
      if (c.index % 5 === 2) this.props.push({ x: c.x + 1.32, z: c.z - c.face * 2.3, y: 0, w: 0.62, d: 0.5, h: 0.45, kind: 'crate', solid: true });
      if (c.index % 7 === 3) this.props.push({ x: c.x + 0.2, z: c.z + c.face * 2.1, y: 0, w: 0.36, d: 0.36, h: 0.6, kind: 'bin', solid: false });
    }
    // corridor furniture + control room consoles
    for (let wing = 0; wing < WINGS; wing++) {
      const z = wingZ(wing);
      for (let k = -4; k <= 4; k++) {
        const side = k % 2 === 0 ? 1 : -1;
        this.props.push({ x: k * 16, z: z + side * (CORRIDOR_HALF - 0.52), y: 0, w: 3.0, d: 0.74, h: 0.5, kind: 'bench', solid: true });
      }
    }
    for (const b of this.buttons) {
      this.props.push({ x: b.x, z: b.z - 1.6, y: 0, w: 3.2, d: 1.1, h: 1.05, kind: 'console', solid: true });
    }
    // towerinq pipe runs that make the hall read as machinery, not a box
    for (let wing = 0; wing < WINGS; wing++) {
      for (let k = -6; k <= 6; k++) {
        this.props.push({ x: k * 11, z: wingZ(wing) - CORRIDOR_HALF - CELL_D - 1.2, y: 3.9, w: 0.4, d: 0.4, h: 0.4, kind: 'pipe', solid: false });
      }
    }
    // ceiling fixtures in every gallery, every 7.2 m
    for (let wing = 0; wing < WINGS; wing++) {
      const z = wingZ(wing);
      const half = (WING_ROWS * CELL_W) / 2;
      for (let x = -half + 4; x <= half - 4; x += 7.2) {
        this.props.push({ x, z, y: 3.34, w: 1.72, d: 0.46, h: 0.14, kind: 'lamp', solid: false });
      }
    }
    for (const [x, z] of [[-56, 88], [56, 88], [-72, -92], [72, -92], [95, 40], [95, -10], [-95, 30], [-95, -10], [0, 96], [0, -96], [-80, 0], [80, 0], [-61, 88], [61, 88]] as [number, number][]) {
      this.props.push({ x, z, y: 3.3, w: 1.72, d: 0.46, h: 0.14, kind: 'lamp', solid: false });
    }
    // CCTV on the cell fronts, one every ~20 m, alternating sides.
    for (let wing = 0; wing < WINGS; wing++) {
      const z = wingZ(wing);
      const half = (WING_ROWS * CELL_W) / 2;
      let n = 0;
      for (let x = -half + 9; x <= half - 9; x += 19.5, n++) {
        const side = n % 2 === 0 ? 1 : -1;
        this.props.push({ x, z: z + side * (CORRIDOR_HALF - 0.32), y: 3.12, w: 0.4, d: 0.4, h: 0.3, kind: 'camera', solid: false });
      }
    }
  }

  /**
   * The service ring: a working kitchen, a real armory, a guard house with a key board,
   * a workshop with the floor grate that leads out. Every room is furnished, none of them
   * is an empty box.
   */
  private addRoomDetails() {
    const P = (x: number, z: number, w: number, d: number, h: number, kind: PrisonProp['kind'], solid = true, y = 0) =>
      this.props.push({ x, z, w, d, h, kind, solid, y });

    /* ---- CANTEEN + KITCHEN (x 50..94, z -104..-80) ---- */
    // the hot line against the south wall: stoves, pots, a hood over them
    for (let i = 0; i < 4; i++) {
      const x = 58 + i * 3.4;
      P(x, -101.4, 3.0, 1.3, 0.95, 'stove');
      P(x - 0.7, -101.4, 0.5, 0.5, 0.35, 'cooker', false, 0.95);
      P(x + 0.7, -101.4, 0.5, 0.5, 0.35, 'cooker', false, 0.95);
      P(x, -101.4, 3.2, 1.5, 0.5, 'vent', false, 2.5);
    }
    P(74, -100.6, 4.0, 1.2, 0.92, 'workbench');        // prep table
    P(74, -100.6, 0.7, 0.5, 0.2, 'tray', false, 0.92);
    P(85, -99.4, 1.4, 1.0, 0.95, 'sink');
    P(88.5, -99.4, 1.4, 1.0, 0.95, 'sink');
    P(52.5, -95, 1.2, 1.2, 1.0, 'fridge');
    P(52.5, -92.5, 1.2, 1.2, 1.0, 'fridge');
    P(52.5, -88, 1.0, 1.0, 1.6, 'shelf');
    P(56, -84, 1.0, 1.0, 0.9, 'bin', false);
    P(90, -84, 0.9, 0.9, 0.8, 'bin', false);
    for (let i = 0; i < 6; i++) P(60 + i * 5.2, -86.5, 0.8, 0.8, 0.9, 'crate', false);
    // trays and jugs on the tables, so the mess hall looks used
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const tx = 72 - 14 + i * 9.2, tz = -92 - 6 + j * 12;
      P(tx - 0.9, tz + 0.2, 0.34, 0.3, 0.22, 'pot', false, 0.78);
      P(tx + 0.9, tz - 0.2, 0.5, 0.36, 0.08, 'tray', false, 0.78);
    }

    /* ---- ARMORY (x 84..106, z 27..53) ---- */
    for (let i = 0; i < 5; i++) P(88 + i * 3.2, 30, 2.2, 0.7, 1.9, 'weaponrack');
    P(86.5, 34.5, 1.1, 0.9, 0.7, 'crate');            // ammo crates
    P(90.5, 34.5, 1.1, 0.9, 0.7, 'crate');
    P(94.5, 34.5, 1.1, 0.9, 0.7, 'crate');
    P(88, 44, 1.2, 0.9, 2.0, 'cabinet');
    P(92, 44, 1.2, 0.9, 2.0, 'cabinet');
    P(96, 44, 1.2, 0.9, 2.0, 'locker');
    P(99, 44, 1.2, 0.9, 2.0, 'locker');
    P(90, 47.5, 4.2, 1.0, 0.9, 'workbench');          // cleaning bench
    P(101, 37, 0.6, 0.6, 0.3, 'board', false, 1.8);

    /* ---- GUARD HOUSE (x -106..-84, z -22..2) ---- */
    for (let i = 0; i < 5; i++) P(-104 + i * 4.4, -18, 1.4, 0.9, 2.0, 'locker');
    P(-95, -4, 4.0, 1.0, 0.5, 'bench');
    P(-86, -16, 0.9, 0.9, 1.0, 'pot');
    P(-88, -4.5, 1.2, 0.7, 0.85, 'desk');
    P(-90.5, -4.5, 1.2, 0.7, 0.85, 'desk');
    P(-86.5, -8, 0.5, 0.5, 0.9, 'chair', false);
    P(-89.5, -8, 0.5, 0.5, 0.9, 'chair', false);
    P(-104, 0, 0.9, 0.12, 1.3, 'board');              // key board
    P(-100, 0, 0.9, 0.12, 1.3, 'board');              // duty roster
    P(-97, -1, 0.6, 0.6, 0.9, 'bin', false);

    /* ---- WORKSHOP (x 84..106, z -23..3) ---- */
    for (let i = 0; i < 3; i++) P(88 + i * 4, -18, 3.4, 1.1, 0.92, 'workbench');
    P(84.9, -21.4, 0.9, 0.6, 1.1, 'extinguisher', false);
    P(103, -2, 1.2, 1.0, 2.0, 'cabinet');
    P(88, -2, 1.6, 1.6, 1.6, 'tank');
    P(97, -6, 1.1, 1.1, 0.9, 'bin', false);
    P(92, -12, 1.4, 1.1, 0.6, 'crate', false);
    P(100, -8, 0.9, 0.9, 0.9, 'pot', false);
    // the grate: oil stains, a toolbox and a work lamp around it
    P(98.4, -19.6, 1.0, 0.7, 0.35, 'crate', false);
    P(101.2, -18.6, 0.5, 0.4, 0.3, 'pot', false);
    P(99, -21.6, 0.5, 0.12, 1.2, 'board', false, 1.2);

    /* ---- MEDICAL ---- */
    P(-88, -84.6, 1.0, 0.7, 0.95, 'desk');
    P(-70, -84.6, 1.0, 0.7, 0.95, 'desk');
    P(-64, -90, 1.1, 0.8, 0.9, 'bin', false);

    /* ---- LAUNDRY ---- */
    for (let i = 0; i < 3; i++) P(-100 + i * 4.4, 36.5, 3.6, 1.1, 0.85, 'workbench');
    P(-103, 44, 1.0, 1.0, 1.6, 'shelf');
    P(-88, 22.5, 0.9, 0.9, 0.9, 'bin', false);

    /* ---- the service ring and the yard: notices, extinguishers, bins ---- */
    for (const [x, z] of [[-70, 60], [70, 60], [-70, -60], [70, -60], [0, 84], [0, -84]] as [number, number][]) {
      P(x, z, 1.6, 0.14, 1.1, 'board', false, 1.5);
      P(x + 3.4, z, 0.6, 0.5, 1.1, 'extinguisher', false);
    }
  }

  /** Six thousand pieces of loose junk, kicked by boots and thrown by gunfire. */
  private addDebris() {
    this.debris = [];
    const drop = (x: number, z: number, y: number, kind: number, size: number) => {
      this.debris.push({
        x, z, y, vx: 0, vz: 0, vy: 0,
        rot: rnd(0, TAU), tilt: rnd(-0.2, 0.2), spin: 0,
        size, kind, rest: true,
      });
    };
    // a cell is lived in: papers, cups, casings under the bunk
    for (const c of this.cells) {
      const n = 20 + (c.index % 5);      // a cell is never swept
      for (let i = 0; i < n; i++) {
        const kind = [0, 0, 1, 3, 2, 4][i % 6];
        drop(c.x + rnd(-CELL_W * 0.42, CELL_W * 0.42), c.z + rnd(-CELL_D * 0.42, CELL_D * 0.42),
          0.01 + (kind === 3 ? 0.005 : 0), kind, kind === 0 ? rnd(0.1, 0.18) : rnd(0.05, 0.11));
      }
    }
    // galleries: papers and casings swept against the bars
    for (const wing of [0, 1, 2, 3]) {
      const z = wingZ(wing);
      for (let i = 0; i < 460; i++) {
        const kind = i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : i % 3 === 0 ? 3 : 0;
        const edge = i % 3 !== 0;
        const side = i % 2 === 0 ? 1 : -1;
        const lz = edge
          ? z + side * (CORRIDOR_HALF - rnd(0.08, 0.55))
          : z + rnd(-CORRIDOR_HALF + 0.4, CORRIDOR_HALF - 0.4);
        drop(rnd(-72, 72), lz, 0.01, kind, rnd(0.05, 0.16));
      }
    }
    // the rooms, the yard and the workshop floor
    for (const [rx, rz] of [[-56, 84], [56, 84], [-72, -92], [72, -92], [95, 40], [95, -10], [-95, 30], [-95, -10], [0, 96], [0, -96]]) {
      for (let i = 0; i < 110; i++) {
        const kind = i % 9 === 0 ? 5 : i % 4 === 0 ? 2 : i % 3 === 0 ? 3 : 0;
        drop(rx + rnd(-16, 16), rz + rnd(-16, 16), 0.01, kind, rnd(0.05, 0.15));
      }
    }
  }

  private addPickups() {
    // consumables in the same places as before
    this.pickups.push({ x: -78, z: -76, y: 0.9, kind: 'medkit', taken: false });
    this.pickups.push({ x: 80, z: 84, y: 0.9, kind: 'ammo', amount: 24, taken: false });
    this.pickups.push({ x: 56, z: -80, y: 0.9, kind: 'armor', taken: false });
    this.pickups.push({ x: -56, z: 80, y: 0.9, kind: 'keys', taken: false });
    this.pickups.push({ x: 0, z: 0, y: 0.9, kind: 'ammo', amount: 18, taken: false });
    this.pickups.push({ x: 0, z: -96, y: 0.9, kind: 'medkit', taken: false });
    this.pickups.push({ x: -72, z: -88, y: 0.9, kind: 'medkit', taken: false });
    this.pickups.push({ x: 74, z: -96, y: 0.9, kind: 'armor', taken: false });

    // ARMORY: three racks, three guns, and crates of ammunition
    this.pickups.push({ x: 88, z: 31.4, y: 1.1, kind: 'weapon', weapon: 'carbine', taken: false });
    this.pickups.push({ x: 93.0, z: 31.4, y: 1.1, kind: 'weapon', weapon: 'shotgun', taken: false });
    this.pickups.push({ x: 97.6, z: 31.4, y: 1.1, kind: 'weapon', weapon: 'smg', taken: false });
    this.pickups.push({ x: 86.5, z: 34.5, y: 0.8, kind: 'ammo', amount: 90, taken: false });
    this.pickups.push({ x: 90.5, z: 34.5, y: 0.8, kind: 'ammo', amount: 60, taken: false });
    this.pickups.push({ x: 94.5, z: 34.5, y: 0.8, kind: 'ammo', amount: 60, taken: false });
    this.pickups.push({ x: 99.5, z: 47.5, y: 1.1, kind: 'weapon', weapon: 'shotgun', taken: false });
    // GUARD HOUSE: the sergeant's shotgun behind the desk
    this.pickups.push({ x: -88, z: -3.2, y: 1.0, kind: 'weapon', weapon: 'shotgun', taken: false });
    this.pickups.push({ x: -104, z: -14, y: 0.9, kind: 'ammo', amount: 36, taken: false });
    // WORKSHOP: a stash the inmates hid under the bench
    this.pickups.push({ x: 92, z: -15.4, y: 0.9, kind: 'ammo', amount: 45, taken: false });
    this.pickups.push({ x: 84.9, z: -21.4, y: 0.9, kind: 'armor', taken: false });
  }

  /** Spatial hash for walls and props: one pass per frame is enough with 8 m buckets. */
  private reindex() {
    this.staticGrid.clear();
    const push = (x: number, z: number, w: number, d: number, idx: number, grid: Map<number, number[]>) => {
      const x0 = Math.floor((x - w / 2) / this.cellSize), x1 = Math.floor((x + w / 2) / this.cellSize);
      const z0 = Math.floor((z - d / 2) / this.cellSize), z1 = Math.floor((z + d / 2) / this.cellSize);
      for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
        const key = gx * 1000 + gz;
        const list = grid.get(key);
        if (list) list.push(idx); else grid.set(key, [idx]);
      }
    };
    this.walls.forEach((w, i) => push(w.x, w.z, w.w, w.d, i, this.staticGrid));
    this.props.forEach((p, i) => { if (p.solid && p.y === 0) push(p.x, p.z, p.w, p.d, i, this.grid); });
  }

  /* ------------------------------------------------------------------ */
  /* placement                                                           */
  /* ------------------------------------------------------------------ */

  private spawnInCell() {
    const cell = this.cells[this.homeCell];
    // Step out of the bunk instead of waking up inside its collision box. The middle
    // column of the cell is kept clear of furniture, so the door is always reachable.
    this.px = cell.x + 0.05;
    this.pz = cell.z + cell.face * 0.4;
    this.yaw = cell.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.pitch = 0;
    this.phase = 'cell';
  }

  /** Wake up on the bunk: full health, pistol ready, still locked in. */
  wake() {
    this.spawnInCell();
    this.hp = this.maxHp; this.mag = this.magSize; this.reserve = Math.max(this.reserve, 24);
    this.alive = true; this.started = true; this.time = 0;
    this.message = 'YOU WAKE UP IN CELL 8-22 · THE LOCK ON YOUR BARS IS BEATEN, NOT BROKEN';
    this.messageT = 6;
    this.spawnGrace = 5;
  }

  /* ------------------------------------------------------------------ */
  /* collisions                                                          */
  /* ------------------------------------------------------------------ */

  private staticBlocked(x: number, z: number, r: number) {
    const key = Math.floor(x / this.cellSize) * 1000 + Math.floor(z / this.cellSize);
    for (let gz = -1; gz <= 1; gz++) for (let gx = -1; gx <= 1; gx++) {
      const list = this.staticGrid.get((Math.floor(x / this.cellSize) + gx) * 1000 + Math.floor(z / this.cellSize) + gz);
      if (!list) continue;
      for (const i of list) {
        const w = this.walls[i];
        if (w.kind === 'gate') {
          const leaf = this.gateLeaf.find((g) => g.x === w.x && g.z === w.z);
          if (leaf?.open) continue;
        }
        if (w.kind === 'bar' && w.cell !== undefined && this.cells[w.cell].opened) continue;
        if (x > w.x - w.w / 2 - r && x < w.x + w.w / 2 + r && z > w.z - w.d / 2 - r && z < w.z + w.d / 2 + r) return true;
      }
    }
    const key2 = Math.floor(x / this.cellSize) * 1000 + Math.floor(z / this.cellSize);
    for (let gz = -1; gz <= 1; gz++) for (let gx = -1; gx <= 1; gx++) {
      const list = this.grid.get((Math.floor(x / this.cellSize) + gx) * 1000 + Math.floor(z / this.cellSize) + gz);
      if (!list) continue;
      for (const i of list) {
        const p = this.props[i];
        if (x > p.x - p.w / 2 - r && x < p.x + p.w / 2 + r && z > p.z - p.d / 2 - r && z < p.z + p.d / 2 + r) return true;
      }
    }
    void key; void key2;
    // drop out of the map if something went wrong
    return Math.abs(x) > 112 || Math.abs(z) > 112;
  }

  move(dx: number, dz: number) {
    const r = 0.42;
    const nx = this.px + dx;
    if (!this.staticBlocked(nx, this.pz, r)) this.px = nx;
    const nz = this.pz + dz;
    if (!this.staticBlocked(this.px, nz, r)) this.pz = nz;
  }

  /* ------------------------------------------------------------------ */
  /* shooting                                                            */
  /* ------------------------------------------------------------------ */

  get spec(): WeaponSpec { return WEAPONS[this.weapon]; }

  /** Pick a gun up off a rack: full magazine, and a real reserve. */
  equip(id: WeaponId): boolean {
    if (this.weapon === id) return false;
    const w = WEAPONS[id];
    this.weapon = id; this.magSize = w.mag; this.mag = w.mag;
    this.reserve = Math.max(this.reserve, w.reserve);
    this.reloading = 0;
    return true;
  }

  reload() {
    if (this.reloading > 0 || this.mag >= this.magSize || this.reserve <= 0) return;
    this.reloading = this.spec.reload;
    this.events.push({ kind: 'reload', x: this.px, z: this.pz, y: 1.2 });
  }

  get lockNear(): PrisonCell | null {
    for (const c of this.cells) {
      if (c.lock !== 'intact') continue;
      const lx = c.x, lz = c.z + c.face * (CELL_D / 2);
      if (Math.hypot(lx - this.px, lz - this.pz) < 2.4) return c;
    }
    return null;
  }

  /** Stand at the workshop grate and hold: the bars give way in about four seconds. */
  pryHatch(dt: number, held: boolean) {
    if (this.hatch.open) return { open: true, progress: 1 };
    const d = Math.hypot(this.hatch.x - this.px, this.hatch.z - this.pz);
    if (!held || d > 2.6 || this.cuffed > 0) {
      this.hatch.progress = Math.max(0, this.hatch.progress - dt * 0.7);
      return { open: false, progress: this.hatch.progress };
    }
    this.hatch.progress = Math.min(1, this.hatch.progress + dt / 4.2);
    this.alarm = Math.min(1, this.alarm + dt * 0.28);
    if (Math.random() < dt * 5) this.throwDebris(this.hatch.x, this.hatch.z, 1.8, 2.2);
    if (this.hatch.progress < 1) {
      this.message = `PRYING THE SERVICE GRATE … ${Math.round(this.hatch.progress * 100)}%`;
      this.messageT = 0.4;
      return { open: false, progress: this.hatch.progress };
    }
    this.hatch.open = true;
    this.message = 'THE GRATE IS OFF — DROP INTO THE SERVICE DUCT';
    this.messageT = 6;
    this.events.push({ kind: 'hatch', x: this.hatch.x, z: this.hatch.z, y: 0.4 });
    return { open: true, progress: 1 };
  }

  /** Standing over an open grate, or through an open sally port. */
  get atHatch() {
    return this.hatch.open && Math.hypot(this.hatch.x - this.px, this.hatch.z - this.pz) < 1.15;
  }

  /** The lever the operative is close enough to put a hand on. */
  get leverNear(): PrisonLever | null {
    let best: PrisonLever | null = null; let bd = 3.6;
    for (const l of this.levers) {
      if (l.pulled) continue;
      const d = Math.hypot(l.x - this.px, l.z - this.pz);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  /** True when the operative is inside one of the two control rooms. */
  get inControlRoom(): string | null {
    for (const r of this.rooms) {
      if (!r.name.startsWith('CONTROL')) continue;
      if (Math.abs(this.px - r.x) < r.w / 2 && Math.abs(this.pz - r.z) < r.d / 2) return r.name;
    }
    return null;
  }

  /**
   * Hold the handle. `held` comes from the mouse button while the crosshair is on the
   * lever; the handle only travels while the operative is standing at it.
   */
  pullLever(id: string, dt: number, held: boolean): { lever: PrisonLever | null; done: boolean } {
    const l = this.levers.find((q) => q.id === id);
    if (!l || l.pulled) return { lever: l ?? null, done: false };
    if (!held || Math.hypot(l.x - this.px, l.z - this.pz) > 3.8) {
      l.progress = Math.max(0, l.progress - dt * 0.9);
      return { lever: l, done: false };
    }
    l.progress = Math.min(1, l.progress + dt / l.holdTime);
    if (Math.random() < dt * 6) this.events.push({ kind: 'hit', x: l.x, z: l.z, y: l.y });
    if (l.progress < 1) {
      this.message = `${l.label} … ${Math.round(l.progress * 100)}%`;
      this.messageT = 0.4;
      return { lever: l, done: false };
    }
    l.pulled = true;
    this.applyLever(l);
    return { lever: l, done: true };
  }

  private applyLever(l: PrisonLever) {
    if (l.id === 'master') {
      this.openAll();
      this.message = 'CELL BLOCK MASTER THROWN — EVERY DOOR IN THE COMPOUND IS OPEN';
    } else if (l.id === 'sally') {
      this.sallyOpen = true;
      for (const leaf of this.gateLeaf) leaf.open = true;
      this.events.push({ kind: 'sally', x: l.x, z: l.z, y: 1 });
      this.message = 'SALLY PORT OPEN — GET TO THE SOUTH GATE';
    } else if (l.id === 'lights') {
      this.lightsOut = !this.lightsOut;
      this.message = this.lightsOut ? 'LIGHTING GRID DOWN' : 'LIGHTING GRID RESTORED';
    } else if (l.id === 'armory') {
      this.reserve += 60; this.armor = Math.max(this.armor, 60);
      for (const n of this.inmates) if (n.state === 'free' || n.state === 'fight') n.hp = Math.min(n.maxHp, n.hp + 20);
      this.events.push({ kind: 'armory', x: l.x, z: l.z, y: 1 });
      this.message = 'ARMORY RACK OPEN — AMMUNITION AND PLATES FOR EVERYONE';
    } else if (l.id === 'alarm') {
      this.alarmOn = !this.alarmOn;
      this.message = this.alarmOn ? 'ALARM LOOPED — RESPONSE IS STUCK IN THE SALLY' : 'ALARM LOOP RESTORED';
    }
    this.messageT = 5;
  }

  /** Hitscan pistol round. Returns what it hit, for the renderer's tracers. */
  fire(): { hit: 'wall' | 'guard' | 'inmate' | 'lock' | 'nothing'; x: number; z: number; y: number } {
    if (this.phase === 'escaped' || this.cuffed > 0 || this.reloading > 0 || this.cool > 0) return { hit: 'nothing', x: 0, z: 0, y: 0 };
    if (this.mag <= 0) { this.reload(); return { hit: 'nothing', x: 0, z: 0, y: 0 }; }
    const spec = this.spec;
    this.mag--; this.cool = spec.cool; this.flash = spec.pellets > 1 ? 0.075 : 0.055; this.stats.shots++;
    this.alarm = Math.min(1, this.alarm + 0.45);
    this.events.push({ kind: 'shot', x: this.px, z: this.pz, y: this.py });
    // a shotgun throws a cone of pellets; everything else is a single round
    let last = { hit: 'nothing' as 'wall' | 'guard' | 'inmate' | 'lock' | 'nothing', x: 0, z: 0, y: 0 };
    for (let pellet = 0; pellet < spec.pellets; pellet++) {
      last = this.fireOne(spec);
    }
    return last;
  }

  private fireOne(spec: WeaponSpec): { hit: 'wall' | 'guard' | 'inmate' | 'lock' | 'nothing'; x: number; z: number; y: number } {
    const spread = spec.spread;
    const ang = this.yaw + rnd(-spread, spread);
    const pitch = this.pitch + rnd(-spread, spread);
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const dy = Math.tan(pitch);
    const reach = 70;

    // nearest wall along the ray
    let wallT = reach;
    const step = 0.35;
    for (let t = 0.4; t < reach; t += step) {
      const x = this.px + dx * t, z = this.pz + dz * t;
      if (this.staticBlocked(x, z, 0.02)) { wallT = t; break; }
    }

    type HitKind = 'wall' | 'guard' | 'inmate' | 'lock' | 'nothing';
    type Candidate = { t: number; kind: 'guard' | 'inmate' | 'lock'; ref: number };
    const cands: Candidate[] = [];
    const consider = (tx: number, tz: number, ty: number, radius: number, kind: Candidate['kind'], ref: number) => {
      const vx = tx - this.px, vz = tz - this.pz;
      const t = vx * dx + vz * dz;
      if (t <= 0 || t > wallT) return;
      const cx = this.px + dx * t, cz = this.pz + dz * t;
      if (Math.hypot(tx - cx, tz - cz) > radius) return;
      if (Math.abs(ty - (this.py + dy * t)) > radius + 0.5) return;
      cands.push({ t, kind, ref });
    };
    for (const g of this.guards) {
      if (g.state === 'down' || g.y > 4) continue;
      consider(g.x, g.z, g.y + 1.0, 0.44, 'guard', g.id);
    }
    for (const n of this.inmates) {
      if (n.state === 'cell' || n.state === 'down') continue;
      consider(n.x, n.z, n.y + 0.95, 0.42, 'inmate', n.id);
    }
    for (const c of this.cells) {
      if (c.lock !== 'intact') continue;
      consider(c.x, c.z + c.face * (CELL_D / 2), 1.15, 0.32, 'lock', c.id);
    }
    cands.sort((a, b) => a.t - b.t);

    let bestT = wallT;
    let hit: HitKind = wallT < reach ? 'wall' : 'nothing';
    let target: Candidate | null = null;
    if (cands.length && cands[0].t < wallT) {
      bestT = cands[0].t; hit = cands[0].kind; target = cands[0];
    }
    const out = { hit, x: this.px + dx * bestT, z: this.pz + dz * bestT, y: this.py + dy * bestT };

    if (target?.kind === 'guard') {
      const g = this.guards[target.ref];
      if (g) {
        g.hp -= spec.damage; g.flash = 0.12; g.state = 'engage'; g.alertT = 12;
        this.stats.hits++;
        if (g.hp <= 0) {
          g.state = 'down'; this.stats.guardsDown++;
          g.vx = dx * 3.2; g.vz = dz * 3.2; g.vy = 2.6; g.spin = rnd(-7, 7);
          this.events.push({ kind: 'down', x: g.x, z: g.z, y: 1 });
        }
      }
    } else if (target?.kind === 'inmate') {
      const n = this.inmates[target.ref];
      if (n) {
        n.hp -= 34; n.flash = 0.12;
        if (n.hp <= 0) {
          n.state = 'down'; this.stats.inmatesDown++;
          n.vx = dx * 3.0; n.vz = dz * 3.0; n.vy = 2.4; n.spin = rnd(-6, 6);
        }
      }
    } else if (target?.kind === 'lock') {
      const c = this.cells[target.ref];
      if (c) this.damageLock(c, 34);
    }
    // the round kicks dust and junk off whatever it hits
    this.throwDebris(out.x, out.z, 2.6, 3.4);
    return out;
  }

  /** Every lock in the prison can be shot off; three hits with the pistol. */
  damageLock(cell: PrisonCell, dmg: number) {
    if (cell.lock !== 'intact') return;
    cell.lockHp -= dmg;
    if (cell.lockHp <= 0) this.openCell(cell);
  }

  openCell(cell: PrisonCell) {
    if (cell.opened) return;
    cell.opened = true; cell.lock = 'broken'; cell.lockHp = 0; cell.openedAt = this.time;
    const n = this.inmates[cell.occupant];
    if (n && n.state === 'cell') { n.state = 'free'; this.stats.freed++; }
    this.throwDebris(cell.x, cell.z + cell.face * CELL_D / 2, 4.5, 6);
    this.events.push({ kind: 'break', x: cell.x, z: cell.z + cell.face * CELL_D / 2, y: 1.2 });
  }

  /** Open every cell in the compound — the prison breaks. */
  openAll() {
    this.allOpen = true;
    for (const c of this.cells) this.openCell(c);
    this.events.push({ kind: 'open-all', x: this.px, z: this.pz, y: 2 });
    this.alarm = 1;
  }

  /** Kept for the keyboard fallback: throws the nearest non-master lever. */
  useButton(): PrisonLever | null {
    const l = this.leverNear;
    if (!l || l.id === 'master') return null;
    l.pulled = true;
    this.applyLever(l);
    return l;
  }

  /* ------------------------------------------------------------------ */
  /* simulation                                                          */
  /* ------------------------------------------------------------------ */

  update(dt: number, input: { fwd: number; strafe: number; sprint: boolean }) {
    this.time += dt;
    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    this.messageT = Math.max(0, this.messageT - dt);
    this.cool = Math.max(0, this.cool - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const take = Math.min(this.magSize - this.mag, this.reserve);
        this.mag += take; this.reserve -= take;
      }
    }
    if (this.phase === 'escaped') return;
    if (this.phase === 'cell') {
      // still behind the bars: the operative can look, talk and shoot the lock
      this.phase = 'active';
    }

    // ---- player movement (yaw relative) ----
    // Cuffed: hands behind the back while an officer walks you to the cell.
    this.cuffed = Math.max(0, this.cuffed - dt);
    const frozen = this.cuffed > 0;
    const speed = (input.sprint ? 5.4 : 3.3) * (this.lightsOut ? 0.9 : 1);
    const len = frozen ? 0 : Math.hypot(input.fwd, input.strafe);
    let kickX = 0, kickZ = 0;
    if (len > 0.01) {
      const f = input.fwd / Math.max(1, len), s = input.strafe / Math.max(1, len);
      const dx = (Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed * dt;
      const dz = (Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed * dt;
      kickX = dx / Math.max(dt, 0.001) * 0.6;
      kickZ = dz / Math.max(dt, 0.001) * 0.6;
      this.move(dx, dz);
    }
    this.updateDebris(dt, kickX, kickZ);

    // ---- guards: nobody in this prison is armed. They close in and cuff you. ----
    for (const g of this.guards) {
      if (g.state === 'down') { this.physBody(g, dt); continue; }
      g.flash = Math.max(0, g.flash - dt);
      g.cool = Math.max(0, g.cool - dt);
      g.cuffCool = Math.max(0, g.cuffCool - dt);
      const dToP = Math.hypot(this.px - g.x, this.pz - g.z);
      if (g.losT === undefined || g.losT <= 0) {
        g.losT = 0.18 + (g.id % 5) * 0.017;
        g.losSeen = dToP < (g.tower ? 95 : 42) && this.lineOfSight(g.x, g.z, this.px, this.pz);
      } else {
        g.losT -= dt;
      }
      const sees = !!g.losSeen && dToP < (g.tower ? 95 : 42);
      // Nobody chases a man behind his own bars, and nobody chases while you are cuffed.
      const caged = this.inHomeCell && !this.cells[this.homeCell].opened;
      const busy = this.cuffed > 0;

      if (sees && !caged && !busy) {
        g.alertT = Math.max(g.alertT, 7.5);
        g.lastX = this.px; g.lastZ = this.pz;
        if (g.tower) {
          // a tower officer cannot run you down; he picks up the radio instead
          if (!this.alarmOn) {
            this.alarmOn = true; this.alarm = 1;
            this.message = 'TOWER SPOTTED YOU — THE SIRENS ARE UP';
            this.messageT = 4;
            this.events.push({ kind: 'alarm', x: g.x, z: g.z, y: g.y });
          }
        } else {
          if (g.state !== 'engage') this.events.push({ kind: 'shout', x: g.x, z: g.z, y: g.y + 1.5 });
          g.state = 'engage';
        }
      }

      // a freed inmate next to an officer is a scuffle, and the officer uses his hands
      let foe: PrisonInmate | null = null; let fd = 26;
      for (const n of this.inmates) {
        if (n.state !== 'free' && n.state !== 'fight') continue;
        const d = Math.hypot(n.x - g.x, n.z - g.z);
        if (d < fd) { fd = d; foe = n; }
      }

      if (g.state === 'engage' && !g.tower) {
        // chase the operative; if he is out of sight, go to where he was last seen
        const goToPlayer = sees && !caged && !busy;
        const tx = goToPlayer ? this.px : foe && !sees ? foe.x : g.lastX;
        const tz = goToPlayer ? this.pz : foe && !sees ? foe.z : g.lastZ;
        const dx = tx - g.x, dz = tz - g.z;
        const d = Math.hypot(dx, dz) || 1;
        g.ang = Math.atan2(dz, dx);
        const sprinting = this.alarm > 0.5 || dToP < 14;
        const sp = (sprinting ? 4.15 : 3.15) * (g.elite ? 1.1 : 1);
        if (d > 1.05) {
          const sx = (dx / d) * sp * dt, sz = (dz / d) * sp * dt;
          const x0 = g.x, z0 = g.z;
          if (!this.staticBlocked(g.x + sx, g.z, 0.42)) g.x += sx;
          if (!this.staticBlocked(g.x, g.z + sz, 0.42)) g.z += sz;
          g.gait = Math.hypot(g.x - x0, g.z - z0) / Math.max(dt, 0.001);
          g.limb += dt * (3.4 + g.gait * 1.6);
        } else {
          g.gait = 0;
          // close enough to fight an inmate
          if (foe && !goToPlayer && fd < 1.4) {
            if (g.cool <= 0) {
              g.cool = 0.75;
              foe.hp -= 20; foe.flash = 0.1;
              this.events.push({ kind: 'hit', x: foe.x, z: foe.z, y: 1.2 });
              if (foe.hp <= 0) {
                foe.state = 'down'; this.stats.inmatesDown++;
                foe.vx = rnd(-2.4, 2.4); foe.vz = rnd(-2.4, 2.4); foe.vy = 2;
              }
            }
          }
        }
        // the cuff: one touch and you are on your way back to the cell
        if (goToPlayer && g.cuffCool <= 0 && dToP < 1.3) { g.cuffCool = 5; this.cuff(g); }
        // give up the hunt after a while
        g.alertT -= dt;
        if (g.alertT <= 0) g.state = 'patrol';
      } else {
        // patrol
        const node = g.patrol[g.node % g.patrol.length];
        const dx = node.x - g.x, dz = node.z - g.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) { g.node++; g.gait = 0; }
        else {
          const sp = (this.alarm > 0.5 ? 2.4 : 1.45) * (g.elite ? 1.25 : 1) * dt;
          const x0 = g.x, z0 = g.z;
          g.x += (dx / d) * sp; g.z += (dz / d) * sp;
          g.ang = Math.atan2(dz, dx);
          g.gait = Math.hypot(g.x - x0, g.z - z0) / Math.max(dt, 0.001);
          g.limb += dt * (3.2 + g.gait * 1.7);
        }
        if (g.alertT > 0) g.alertT -= dt;
      }
    }

    // ---- inmates ----
    for (const n of this.inmates) {
      if (n.state === 'down') { this.physBody(n, dt); n.flash = Math.max(0, n.flash - dt); continue; }
      n.flash = Math.max(0, n.flash - dt);
      if (n.state === 'free') {
        // look for the nearest standing guard
        let target: PrisonGuard | null = null; let best = 60;
        for (const g of this.guards) {
          if (g.state === 'down') continue;
          const d = Math.hypot(g.x - n.x, g.z - n.z);
          if (d < best) { best = d; target = g; }
        }
        if (target) { n.state = 'fight'; n.target = target.id; }
      }
      if (n.state === 'fight') {
        const g = this.guards.find((q) => q.id === n.target);
        if (!g || g.state === 'down') { n.state = 'free'; continue; }
        const dx = g.x - n.x, dz = g.z - n.z, d = Math.hypot(dx, dz) || 1;
        n.ang = Math.atan2(dz, dx);
        if (d > 1.3) { n.x += (dx / d) * 3.1 * dt; n.z += (dz / d) * 3.1 * dt; n.limb += dt * 8.4; }
        else {
          g.hp -= 26 * dt;
          if (g.hp <= 0) {
            g.state = 'down'; this.stats.guardsDown++;
            g.vx = -(dx / d) * 2.2; g.vz = -(dz / d) * 2.2; g.vy = 2.0; g.spin = rnd(-5, 5);
            this.events.push({ kind: 'down', x: g.x, z: g.z, y: 1 });
          }
        }
      }
    }

    // ---- pickups: guns off the rack, crates of ammunition, kit ----
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (Math.hypot(p.x - this.px, p.z - this.pz) < 1.7) {
        p.taken = true; this.stats.looted++;
        if (p.kind === 'weapon' && p.weapon) {
          this.equip(p.weapon);
          this.message = `${WEAPONS[p.weapon].name} IN HAND — ${WEAPONS[p.weapon].mag} IN THE MAG`;
        } else if (p.kind === 'ammo') {
          this.reserve += p.amount ?? 36;
          this.message = `AMMUNITION +${p.amount ?? 36} · ${this.spec.name}`;
        } else if (p.kind === 'medkit') this.hp = Math.min(this.maxHp, this.hp + 45);
        else if (p.kind === 'armor') this.armor = Math.min(100, this.armor + 50);
        else if (p.kind === 'keys') {
          this.reserve += 12;
          this.message = 'A RING OF KEYS — SOMEONE ELSE\'S BAD DAY';
        }
        this.messageT = 3.5;
        this.events.push({ kind: 'pickup', x: p.x, z: p.z, y: p.y });
      }
    }

    // ---- escape: the sally port, or the duct under the workshop ----
    if (this.sallyOpen && this.pz > 104 && Math.abs(this.px) < 9) {
      this.phase = 'escaped';
      this.message = 'THROUGH THE SALLY PORT — YOU ARE OUT';
      this.events.push({ kind: 'exit', x: this.px, z: this.pz, y: 1 });
    } else if (this.atHatch) {
      this.phase = 'escaped';
      this.message = 'DOWN THE SERVICE DUCT — YOU ARE OUT';
      this.events.push({ kind: 'exit', x: this.px, z: this.pz, y: 1 });
    }
    this.alarm = clamp(this.alarm - dt * 0.06, 0, 1);
    // The siren follows the alarm: it winds up when something is wrong and dies away.
    const want = this.alarmOn ? 1 : this.alarm > 0.35 ? 0.65 : 0;
    this.siren += (want - this.siren) * Math.min(1, dt * 2.2);
  }

  /**
   * A body that falls keeps falling. Downed guards and inmates are integrated here:
   * gravity, a bounce on the concrete, friction, and a tilt that ends flat on the floor.
   */
  private physBody(o: { x: number; z: number; y: number; vx: number; vz: number; vy: number; tilt: number; spin: number }, dt: number) {
    o.vy -= 19 * dt;
    o.y = Math.max(0, o.y + o.vy * dt);
    if (o.y <= 0 && o.vy < 0) {
      o.y = 0;
      o.vy = Math.abs(o.vy) > 1.6 ? -o.vy * 0.26 : 0;
      o.vx *= 0.72; o.vz *= 0.72;
    }
    const nx = o.x + o.vx * dt, nz = o.z + o.vz * dt;
    if (!this.staticBlocked(nx, nz, 0.4)) { o.x = nx; o.z = nz; }
    else { o.vx *= -0.35; o.vz *= -0.35; }
    const damp = Math.pow(0.08, dt);
    o.vx *= damp; o.vz *= damp;
    o.tilt = clamp(o.tilt + o.spin * dt, -1.62, 1.62);
    o.spin *= Math.pow(0.25, dt);
    if (o.y === 0 && Math.abs(o.spin) < 0.8) {
      const target = (o.tilt >= 0 ? 1 : -1) * 1.55;
      o.tilt += (target - o.tilt) * Math.min(1, dt * 5.5);
    }
  }

  damagePlayer(dmg: number) {
    if (this.phase === 'escaped') return;
    // Five seconds of grace after waking up, and none at all while still behind the bars.
    if (this.spawnGrace > 0) return;
    if (this.inHomeCell && !this.cells[this.homeCell].opened) return;
    const toArmor = Math.min(this.armor, dmg * 0.6);
    this.armor -= toArmor;
    this.hp -= dmg - toArmor;
    if (this.hp <= 0) this.captured();
  }

  /**
   * Cuffed. This is the whole threat model now: no officer is armed, they close in,
   * take your gun and walk you back. The cell door is re-secured with a fresh lock, so
   * every breakout has to be earned again.
   */
  cuff(g?: PrisonGuard) {
    if (this.phase === 'escaped') return;
    const c = this.cells[this.homeCell];
    this.cuffed = 2.6;
    this.alarm = 1;
    this.px = c.x + 0.05;
    this.pz = c.z + c.face * 0.4;
    this.yaw = c.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    // the door is shut and a new lock is bolted on
    c.opened = false; c.lock = 'intact'; c.lockHp = c.lockMax;
    this.allOpen = false;
    // the gun you stole is gone; the sergeant keeps it
    this.weapon = 'pistol'; this.magSize = WEAPONS.pistol.mag; this.mag = WEAPONS.pistol.mag;
    this.reserve = 12; this.reloading = 0;
    for (const o of this.guards) {
      if (o === g) continue;
      if (Math.hypot(o.x - this.px, o.z - this.pz) < 9) { o.state = 'patrol'; o.alertT = 0; o.cuffCool = 3; }
    }
    if (g) { g.state = 'patrol'; g.alertT = 0; }
    this.message = 'CUFFED — CUFFED AND WALKED BACK · YOUR GUN IS GONE, THE BARS ARE NEW';
    this.messageT = 6;
    this.events.push({ kind: 'cuff', x: this.px, z: this.pz, y: 1 });
  }

  /** Beaten unconscious: the guards drag the operative back to the cell. */
  captured() {
    this.hp = this.maxHp; this.armor = 0; this.mag = this.magSize;
    this.px = this.cells[this.homeCell].x;
    this.pz = this.cells[this.homeCell].z;
    this.alarm = 0;
    this.cuffed = 2.2;
    this.message = 'THEY DRAG YOU BACK TO THE CELL — THE LOCK IS STILL INTACT';
    this.messageT = 5;
  }

  /**
   * Exact segment/box test. The old version sampled every 1.4 m, which stepped clean over
   * the 0.22 m cell bars — guards could "see" straight through a locked cell and shoot
   * the operative on his bunk. A slab test cannot miss, however thin the wall.
   */
  /**
   * Loose junk physics. Nothing here is heavy: it is kicked, it skids, it settles.
   * Only the pieces near the operative are simulated in full, so a thousand items on
   * the floor cost nothing until you walk through them.
   */
  private updateDebris(dt: number, kickX: number, kickZ: number) {
    const far = 60;
    for (const d of this.debris) {
      const dx = d.x - this.px, dz = d.z - this.pz;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > far * far) { d.rest = true; continue; }
      // a boot through a pile of paper
      if (dist2 < 1.35 * 1.35) {
        const push = Math.hypot(kickX, kickZ);
        if (push > 0.35) {
          const a = Math.atan2(dz, dx) + rnd(-0.5, 0.5);
          d.vx += Math.cos(a) * push * rnd(0.5, 1.1) + kickX * 0.5;
          d.vz += Math.sin(a) * push * rnd(0.5, 1.1) + kickZ * 0.5;
          d.vy = Math.max(d.vy, rnd(0.6, 2.4));
          d.spin = rnd(-9, 9);
          d.rest = false;
        }
      }
      if (d.rest) continue;
      // gravity + floor
      d.vy -= 16 * dt;
      d.y += d.vy * dt;
      if (d.y <= 0.02) {
        d.y = 0.02;
        if (Math.abs(d.vy) > 0.8) { d.vy = -d.vy * 0.32; d.spin *= 0.6; }
        else { d.vy = 0; d.tilt = lerpTo(d.tilt, 0, dt * 6); }
        d.vx *= 1 - Math.min(0.9, dt * 5.5);
        d.vz *= 1 - Math.min(0.9, dt * 5.5);
      }
      // slide, bouncing off walls instead of passing through them
      const nx = d.x + d.vx * dt, nz = d.z + d.vz * dt;
      if (!this.staticBlocked(nx, d.z, 0.05)) d.x = nx; else d.vx *= -0.45;
      if (!this.staticBlocked(d.x, nz, 0.05)) d.z = nz; else d.vz *= -0.45;
      d.rot += d.spin * dt;
      d.tilt = lerpTo(d.tilt, d.spin * 0.02, dt * 3);
      if (Math.abs(d.vx) + Math.abs(d.vz) < 0.12 && d.y <= 0.03 && Math.abs(d.vy) < 0.2) {
        d.vx = 0; d.vz = 0; d.vy = 0; d.spin = 0; d.rest = true;
      }
    }
  }

  /** Shove every loose item away from a point (a gunshot, a slammed door, a breach). */
  throwDebris(x: number, z: number, radius: number, power: number) {
    for (const d of this.debris) {
      const dx = d.x - x, dz = d.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > radius || dist < 0.001) continue;
      const k = (1 - dist / radius) * power;
      d.vx += (dx / dist) * k; d.vz += (dz / dist) * k;
      d.vy = Math.max(d.vy, k * 0.45);
      d.spin = rnd(-11, 11);
      d.rest = false;
    }
  }

  private segmentHitsWall(x0: number, z0: number, x1: number, z1: number) {
    const dx = x1 - x0, dz = z1 - z0;
    for (const w of this.walls) {
      if (w.kind === 'bar' && w.cell !== undefined && this.cells[w.cell].opened) continue;
      if (w.kind === 'gate' && this.gateLeaf.some((g) => g.x === w.x && g.z === w.z && g.open)) continue;
      if (w.y0 > 1.9) continue;                       // lintels and galleries do not block an eye
      const minX = w.x - w.w / 2, maxX = w.x + w.w / 2;
      const minZ = w.z - w.d / 2, maxZ = w.z + w.d / 2;
      let near = 0, far = 1;
      let miss = false;
      for (const axis of [0, 1] as const) {
        const o = axis === 0 ? x0 : z0;
        const d = axis === 0 ? dx : dz;
        const lo = axis === 0 ? minX : minZ;
        const hi = axis === 0 ? maxX : maxZ;
        if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { miss = true; break; } continue; }
        let t0 = (lo - o) / d, t1 = (hi - o) / d;
        if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) { miss = true; break; }
      }
      if (!miss && far > 0.02 && near < 0.98) return true;
    }
    return false;
  }

  /** Guards re-test sight every few frames: 67 guards x 1 900 walls would be wasteful. */
  lineOfSight(x0: number, z0: number, x1: number, z1: number) {
    return !this.segmentHitsWall(x0, z0, x1, z1);
  }

  /** True while the operative is still inside his own cell. */
  get inHomeCell() {
    const c = this.cells[this.homeCell];
    return Math.abs(this.px - c.x) < CELL_W / 2 && Math.abs(this.pz - c.z) < CELL_D / 2;
  }

  look(dx: number, dy: number) {
    this.yaw += dx * 0.0022;
    if (this.yaw > Math.PI) this.yaw -= TAU;
    if (this.yaw < -Math.PI) this.yaw += TAU;
    this.pitch = clamp(this.pitch - dy * 0.0019, -1.35, 1.35);
  }

  /** Rough progress for the HUD. */
  get summary() {
    const opened = this.cells.filter((c) => c.opened).length;
    const free = this.inmates.filter((n) => n.state !== 'cell').length;
    return { opened, free, guards: this.guards.filter((g) => g.state !== 'down').length, sallyOpen: this.sallyOpen };
  }
}
