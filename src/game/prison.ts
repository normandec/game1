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

export const CELL_W = 3.2;
export const CELL_D = 4.6;
export const CELL_H = 3.8;
export const WING_ROWS = 45;
export const WINGS = 4;
export const CORRIDOR_HALF = 3.4;

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
}

export interface PrisonInmate {
  id: number; cell: number; x: number; z: number; y: number; ang: number;
  hp: number; maxHp: number; state: InmateState; cool: number; target: number; flash: number;
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
  kind: 'bed' | 'toilet' | 'sink' | 'table' | 'bench' | 'locker' | 'desk' | 'crate' | 'console' | 'pipe' | 'medkit' | 'lamp' | 'camera';
  solid: boolean;
}

export interface PrisonPickup { x: number; z: number; y: number; kind: 'ammo' | 'medkit' | 'armor' | 'keys'; taken: boolean }

export interface PrisonEvent { kind: 'shot' | 'hit' | 'break' | 'open-all' | 'sally' | 'shout' | 'down' | 'pickup' | 'exit' | 'alarm'; x: number; z: number; y: number }

export interface PrisonStats { freed: number; guardsDown: number; inmatesDown: number; shots: number; hits: number; looted: number }

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Wing origins: four parallel galleried cell houses. */
export const wingZ = (wing: number) => (wing - 1.5) * 30;
export const WING_X0 = -(WING_ROWS * CELL_W) / 2;

export class PrisonSim {
  cells: PrisonCell[] = [];
  guards: PrisonGuard[] = [];
  inmates: PrisonInmate[] = [];
  walls: PrisonWall[] = [];
  buttons: PrisonButton[] = [];
  props: PrisonProp[] = [];
  pickups: PrisonPickup[] = [];
  events: PrisonEvent[] = [];

  // player
  px = 0; pz = 0; py = 1.62;
  yaw = Math.PI; pitch = 0;
  hp = 100; maxHp = 100; armor = 0;
  mag = 12; magSize = 12; reserve = 48; reloading = 0; cool = 0;
  flash = 0; flashlight = false;
  alive = true;
  /** 0 while nobody suspects anything, 1 once the alarm is screaming */
  alarm = 0; alarmOn = false;
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
      };
      c.occupant = n.id;
      this.inmates.push(n);
    }

    // ---------- structure walls ----------
    this.addShell();
    this.addBarsAndCellWalls();
    this.addBlocks();

    // ---------- guards ----------
    this.spawnGuards();

    // ---------- buttons, props, loot ----------
    this.addControlRooms();
    this.addCellProps();
    this.addPickups();

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
    W(0, -H + 34, hallX * 2, 3, 0, 14);          // north hall wall
    W(-hallX, 0, 3, H * 2 - 68, 0, 14);          // west hall wall
    W(hallX, 0, 3, H * 2 - 68, 0, 14);           // east hall wall
    W(0, H - 34, hallX * 2, 3, 0, 14);           // south hall wall

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

  private addBlocks() {
    const B = (x: number, z: number, w: number, d: number, y1 = 7) =>
      this.walls.push({ x, z, w, d, y0: 0, y1, kind: 'wall' });
    // medical bay, north-west corner inside the perimeter
    B(-78, -80, 48, 30, 6); B(-102, -65, 30, 26, 6);
    // armory, south-east corner
    B(80, 82, 40, 26, 6); B(104, 66, 24, 30, 6);
    // mess hall, north-east
    B(84, -82, 44, 28, 6);
    // control rooms: small fortresses with one door each
    B(-56, 76, 26, 20, 6);
    B(56, -76, 26, 20, 6);
    // yard bleachers / workshop stubs
    B(-20, -100, 34, 8, 3); B(20, -100, 34, 8, 3);
  }

  private spawnGuards() {
    let id = 0;
    const push = (x: number, z: number, patrol: { x: number; z: number }[], tower = false) => {
      this.guards.push({
        id: id++, x, z, ang: rnd(0, TAU), y: tower ? 9.5 : 0,
        hp: 150, maxHp: 150, state: 'patrol', patrol, node: 0,
        cool: rnd(0.4, 1.6), alertT: 0, tower, flash: 0,
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
    // eight tower marksmen
    for (const [x, z] of [[-106, -106], [106, -106], [-106, 106], [106, 106], [0, -106], [0, 106], [-106, 0], [106, 0]] as [number, number][]) {
      push(x, z, [{ x, z }], true);
    }
  }

  private addControlRooms() {
    this.buttons.push(
      { id: 'open-all', label: 'CELL BLOCK MASTER', sub: 'RELEASE EVERY CELL IN THE COMPOUND', x: -56, z: 80, y: 1.1, kind: 'open-all', used: false, room: 'CONTROL A' },
      { id: 'lights', label: 'LIGHTING GRID', sub: 'CUT THE HALL LIGHTS', x: -62, z: 80, y: 1.1, kind: 'lights', used: false, room: 'CONTROL A' },
      { id: 'sally', label: 'SALLY PORT', sub: 'OPEN THE SOUTH GATE', x: 56, z: -80, y: 1.1, kind: 'sally', used: false, room: 'CONTROL B' },
      { id: 'armory', label: 'ARMORY RACK', sub: 'RELEASE THE WEAPONS LOCKERS', x: 52, z: -80, y: 1.1, kind: 'armory', used: false, room: 'CONTROL B' },
      { id: 'alarm', label: 'ALARM LOOP', sub: 'LOOP THE SIRENS AND SLOW RESPONSE', x: 60, z: -76, y: 1.1, kind: 'alarm', used: false, room: 'CONTROL B' },
    );
  }

  private addCellProps() {
    for (const c of this.cells) {
      const bx = c.x - c.face * 0.2;
      this.props.push({ x: bx, z: c.z - CELL_D * 0.28, y: 0, w: 2.1, d: 0.9, h: 0.5, kind: 'bed', solid: true });
      this.props.push({ x: c.x + CELL_W * 0.32, z: c.z + c.face * 0.9, y: 0, w: 0.5, d: 0.6, h: 0.75, kind: 'toilet', solid: true });
      if (c.index % 3 === 0) this.props.push({ x: c.x - CELL_W * 0.3, z: c.z - c.face * 1.1, y: 0, w: 0.9, d: 0.5, h: 0.85, kind: 'sink', solid: true });
      if (c.index % 5 === 0) this.props.push({ x: c.x, z: c.z - c.face * 1.6, y: 0, w: 0.7, d: 0.5, h: 0.45, kind: 'crate', solid: true });
    }
    // corridor furniture + control room consoles
    for (let wing = 0; wing < WINGS; wing++) {
      const z = wingZ(wing);
      for (let k = -4; k <= 4; k++) {
        this.props.push({ x: k * 16, z: z, y: 0, w: 2.4, d: 0.8, h: 0.75, kind: 'bench', solid: true });
      }
    }
    for (const b of this.buttons) {
      this.props.push({ x: b.x, z: b.z - 1.6, y: 0, w: 3.2, d: 1.1, h: 1.05, kind: 'console', solid: true });
    }
    // towering pipe runs that make the hall read as machinery, not a box
    for (let wing = 0; wing < WINGS; wing++) {
      for (let k = -6; k <= 6; k++) {
        this.props.push({ x: k * 11, z: wingZ(wing) - CORRIDOR_HALF - CELL_D - 1.2, y: 3.9, w: 0.4, d: 0.4, h: 0.4, kind: 'pipe', solid: false });
      }
    }
    for (let i = 0; i < 60; i++) {
      this.props.push({ x: rnd(-100, 100), z: rnd(-100, 100), y: 6.2, w: 2.2, d: 0.5, h: 0.24, kind: 'lamp', solid: false });
    }
    for (const [x, z] of [[-56, 88], [56, -88], [0, 60], [0, -60], [-80, 0], [80, 0]] as [number, number][]) {
      this.props.push({ x, z, y: 4.6, w: 0.5, d: 0.5, h: 0.5, kind: 'camera', solid: false });
    }
    this.props.push({ x: 84, z: -82, y: 0, w: 6, d: 1.2, h: 0.9, kind: 'table', solid: true });
    this.props.push({ x: 80, z: 84, y: 0, w: 4, d: 1.0, h: 1.8, kind: 'locker', solid: true });
    this.props.push({ x: -78, z: -80, y: 0, w: 3, d: 0.9, h: 1.2, kind: 'desk', solid: true });
    this.props.push({ x: -78, z: -76, y: 0, w: 0.6, d: 0.6, h: 1.1, kind: 'medkit', solid: false });
  }

  private addPickups() {
    this.pickups.push({ x: -78, z: -76, y: 0.9, kind: 'medkit', taken: false });
    this.pickups.push({ x: 80, z: 84, y: 0.9, kind: 'ammo', taken: false });
    this.pickups.push({ x: 56, z: -80, y: 0.9, kind: 'armor', taken: false });
    this.pickups.push({ x: -56, z: 80, y: 0.9, kind: 'keys', taken: false });
    this.pickups.push({ x: 0, z: 0, y: 0.9, kind: 'ammo', taken: false });
    this.pickups.push({ x: 0, z: -96, y: 0.9, kind: 'medkit', taken: false });
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
    // Step out of the bunk instead of waking up inside its collision box.
    this.px = cell.x - CELL_W * 0.24;   // beside the bunk, clear of the toilet
    this.pz = cell.z + cell.face * 0.35;
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

  reload() {
    if (this.reloading > 0 || this.mag >= this.magSize || this.reserve <= 0) return;
    this.reloading = 1.25;
  }

  get lockNear(): PrisonCell | null {
    for (const c of this.cells) {
      if (c.lock !== 'intact') continue;
      const lx = c.x, lz = c.z + c.face * (CELL_D / 2);
      if (Math.hypot(lx - this.px, lz - this.pz) < 2.4) return c;
    }
    return null;
  }

  get buttonNear(): PrisonButton | null {
    for (const b of this.buttons) if (Math.hypot(b.x - this.px, b.z - this.pz) < 3.2) return b;
    return null;
  }

  /** Hitscan pistol round. Returns what it hit, for the renderer's tracers. */
  fire(): { hit: 'wall' | 'guard' | 'inmate' | 'lock' | 'nothing'; x: number; z: number; y: number } {
    if (this.phase === 'escaped' || this.reloading > 0 || this.cool > 0) return { hit: 'nothing', x: 0, z: 0, y: 0 };
    if (this.mag <= 0) { this.reload(); return { hit: 'nothing', x: 0, z: 0, y: 0 }; }
    this.mag--; this.cool = 0.16; this.flash = 0.055; this.stats.shots++;
    this.alarm = Math.min(1, this.alarm + 0.45);
    const spread = 0.012;
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
        g.hp -= 46; g.flash = 0.12; g.state = 'engage'; g.alertT = 12;
        this.stats.hits++;
        if (g.hp <= 0) { g.state = 'down'; this.stats.guardsDown++; this.events.push({ kind: 'down', x: g.x, z: g.z, y: 1 }); }
      }
    } else if (target?.kind === 'inmate') {
      const n = this.inmates[target.ref];
      if (n) {
        n.hp -= 34; n.flash = 0.12;
        if (n.hp <= 0) { n.state = 'down'; this.stats.inmatesDown++; }
      }
    } else if (target?.kind === 'lock') {
      const c = this.cells[target.ref];
      if (c) this.damageLock(c, 34);
    }
    this.events.push({ kind: 'shot', x: this.px, z: this.pz, y: this.py });
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
    this.events.push({ kind: 'break', x: cell.x, z: cell.z + cell.face * CELL_D / 2, y: 1.2 });
  }

  /** Open every cell in the compound — the prison breaks. */
  openAll() {
    this.allOpen = true;
    for (const c of this.cells) this.openCell(c);
    this.events.push({ kind: 'open-all', x: this.px, z: this.pz, y: 2 });
    this.alarm = 1;
  }

  useButton() {
    const b = this.buttonNear;
    if (!b) return null;
    b.used = true;
    if (b.kind === 'open-all') { this.openAll(); this.message = 'CELL BLOCK MASTER ENGAGED — EVERY DOOR IS OPEN'; }
    else if (b.kind === 'sally') { this.sallyOpen = true; for (const l of this.gateLeaf) l.open = true; this.events.push({ kind: 'sally', x: b.x, z: b.z, y: 1 }); this.message = 'SALLY PORT OPEN — GET TO THE SOUTH GATE'; }
    else if (b.kind === 'lights') { this.lightsOut = !this.lightsOut; this.message = this.lightsOut ? 'LIGHTING GRID DOWN' : 'LIGHTING GRID RESTORED'; }
    else if (b.kind === 'armory') {
      this.reserve += 60; this.armor = Math.max(this.armor, 60);
      for (const n of this.inmates) if (n.state === 'free' || n.state === 'fight') n.hp = Math.min(n.maxHp, n.hp + 20);
      this.message = 'ARMORY RACK OPEN — AMMUNITION AND PLATES FOR EVERYONE';
    } else if (b.kind === 'alarm') { this.alarmOn = !this.alarmOn; this.message = this.alarmOn ? 'ALARM LOOPED — RESPONSE IS STUCK IN THE SALLY' : 'ALARM LOOP RESTORED'; }
    this.messageT = 4.5;
    return b;
  }

  /* ------------------------------------------------------------------ */
  /* simulation                                                          */
  /* ------------------------------------------------------------------ */

  update(dt: number, input: { fwd: number; strafe: number; sprint: boolean }) {
    this.time += dt;
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
    const speed = (input.sprint ? 5.4 : 3.3) * (this.lightsOut ? 0.9 : 1);
    const len = Math.hypot(input.fwd, input.strafe);
    if (len > 0.01) {
      const f = input.fwd / Math.max(1, len), s = input.strafe / Math.max(1, len);
      const dx = (Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed * dt;
      const dz = (Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed * dt;
      this.move(dx, dz);
    }

    // ---- guards ----
    for (const g of this.guards) {
      if (g.state === 'down') continue;
      g.flash = Math.max(0, g.flash - dt);
      g.cool = Math.max(0, g.cool - dt);
      const dToP = Math.hypot(this.px - g.x, this.pz - g.z);
      const sees = dToP < (g.tower ? 95 : 46) && this.lineOfSight(g.x, g.z, this.px, this.pz);
      if (sees && this.alarmOn) { g.state = 'alert'; g.alertT = Math.max(g.alertT, 6); }
      if (sees && dToP < 34) { g.state = 'engage'; g.alertT = Math.max(g.alertT, 10); }

      // a freed inmate next to a guard is a fight, and guards shoot them too
      let foe: PrisonInmate | null = null; let fd = 30;
      for (const n of this.inmates) {
        if (n.state !== 'free' && n.state !== 'fight') continue;
        const d = Math.hypot(n.x - g.x, n.z - g.z);
        if (d < fd) { fd = d; foe = n; }
      }

      if (g.state === 'engage' && (sees || foe)) {
        g.alertT -= dt;
        const tx = foe && !sees ? foe.x : this.px;
        const tz = foe && !sees ? foe.z : this.pz;
        g.ang = Math.atan2(tz - g.z, tx - g.x);
        const engageFoe = !!foe && (fd < 9 || !sees);
        if (g.cool <= 0) {
          g.cool = g.tower ? 1.5 : 0.95;
          if (engageFoe && foe) { foe.hp -= 18; foe.flash = 0.1; if (foe.hp <= 0) { foe.state = 'down'; this.stats.inmatesDown++; } }
          else {
            this.events.push({ kind: 'shot', x: g.x, z: g.z, y: g.y + 1.1 });
            if (Math.random() < (g.tower ? 0.55 : 0.42)) this.damagePlayer(g.tower ? 13 : 8);
          }
        }
        if (g.alertT <= 0) g.state = 'patrol';
      } else {
        // patrol
        const node = g.patrol[g.node % g.patrol.length];
        const dx = node.x - g.x, dz = node.z - g.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) g.node++;
        else {
          const sp = (this.alarm > 0.5 ? 2.6 : 1.5) * dt;
          g.x += (dx / d) * sp; g.z += (dz / d) * sp;
          g.ang = Math.atan2(dz, dx);
        }
      }
    }

    // ---- inmates ----
    for (const n of this.inmates) {
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
        if (d > 1.3) { n.x += (dx / d) * 3.1 * dt; n.z += (dz / d) * 3.1 * dt; }
        else {
          g.hp -= 26 * dt;
          if (g.hp <= 0) {
            g.state = 'down'; this.stats.guardsDown++;
            this.events.push({ kind: 'down', x: g.x, z: g.z, y: 1 });
          }
        }
      }
      if (n.state === 'down' && Math.random() < dt * 0.02) n.hp = Math.min(n.maxHp, n.hp + 1);
    }

    // ---- pickups ----
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (Math.hypot(p.x - this.px, p.z - this.pz) < 1.6) {
        p.taken = true; this.stats.looted++;
        if (p.kind === 'ammo') this.reserve += 36;
        else if (p.kind === 'medkit') this.hp = Math.min(this.maxHp, this.hp + 45);
        else if (p.kind === 'armor') this.armor = Math.min(100, this.armor + 50);
        else if (p.kind === 'keys') { this.reserve += 12; this.message = 'A RING OF KEYS — SOMEONE ELSE\'S BAD DAY'; this.messageT = 3; }
        this.events.push({ kind: 'pickup', x: p.x, z: p.z, y: p.y });
      }
    }

    // ---- escape ----
    if (this.sallyOpen && this.pz > 104 && Math.abs(this.px) < 9) {
      this.phase = 'escaped';
      this.events.push({ kind: 'exit', x: this.px, z: this.pz, y: 1 });
    }
    this.alarm = clamp(this.alarm - dt * 0.06, 0, 1);
  }

  damagePlayer(dmg: number) {
    if (this.phase === 'escaped') return;
    const toArmor = Math.min(this.armor, dmg * 0.6);
    this.armor -= toArmor;
    this.hp -= dmg - toArmor;
    if (this.hp <= 0) this.captured();
  }

  /** Beaten unconscious: the guards drag the operative back to the cell. */
  captured() {
    this.hp = this.maxHp; this.armor = 0; this.mag = this.magSize;
    this.px = this.cells[this.homeCell].x;
    this.pz = this.cells[this.homeCell].z;
    this.alarm = 0;
    this.message = 'THEY DRAG YOU BACK TO THE CELL — THE LOCK IS STILL INTACT';
    this.messageT = 5;
  }

  lineOfSight(x0: number, z0: number, x1: number, z1: number) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(d / 1.4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.staticBlocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.01)) return false;
    }
    return true;
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
