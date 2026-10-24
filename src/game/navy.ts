/**
 * NAVY — the sea around THE CAGE.
 *
 * Up to now the water was scenery. This module gives it traffic:
 *   · landing craft that run troops onto the island and pull back out to sea,
 *   · patrol boats that hunt an operative who takes to the water,
 *   · moored skiffs the operative can board and drive,
 *   · and a hard rule: ram an enemy hull at speed and both boats go up.
 */

export type BoatKind = 'landing' | 'patrol' | 'skiff';

export type BoatState =
  | 'transit'   // running in from the open sea toward its landing point
  | 'beach'     // nose on the sand, ramp coming down
  | 'unload'    // troops walking out of the hold
  | 'retreat'   // backing off the beach, turning for the sea
  | 'cruise'    // patrolling the water
  | 'chase'     // running down a swimmer / an enemy hull
  | 'sunk';

export interface Boat {
  id: number;
  x: number; y: number; ang: number; speed: number;
  hp: number; maxHp: number;
  kind: BoatKind;
  faction: 'enemy' | 'player';
  state: BoatState;
  /** state clock */
  t: number;
  /** ramp position, 0 shut · 1 fully down */
  ramp: number;
  /** troops still on board */
  troops: number;
  /** troops the hull started with */
  manifest: number;
  /** how many walked out so far */
  landed: number;
  /** home water point the boat returns to */
  homeX: number; homeY: number;
  /** current destination for transit / cruise */
  tx: number; ty: number;
  /** bow wake strength 0..1 */
  wake: number;
  dead?: boolean;
  /** hulls that the operative can walk up to and drive */
  crewed?: boolean;
  /** enemy-fire cooldown (patrol boats) */
  fireCd?: number;
  /** damage already taken this frame, for the ram check */
  hitT?: number;
}

export const BOAT = {
  landing: { len: 190, width: 74, hp: 620, speed: 132, troops: 6 },
  patrol: { len: 152, width: 56, hp: 420, speed: 196, troops: 0 },
  skiff: { len: 132, width: 48, hp: 300, speed: 172, troops: 0 },
} as const;

/** Beach heads: approach point in open water → the sand the ramp drops on. */
export const LANDING_BEACHES = [
  { ax: 14860, ay: 7020, bx: 15090, by: 5380, name: 'SOUTH BEACH' },
  { ax: 15180, ay: 1180, bx: 15190, by: 2720, name: 'NORTH BEACH' },
  { ax: 17640, ay: 4180, bx: 16320, by: 4110, name: 'EAST SHINGLE' },
] as const;

/** Moored skiffs, so the operative always has a boat to take. */
export const MOORINGS = [
  { x: 12566, y: 4560, ang: -0.4 },   // off the harbour pier — reachable from the quay
  { x: 12662, y: 4306, ang: -0.2 },   // south of the causeway head
  { x: 15180, y: 2506, ang: 1.4 },    // off the island's north beach
] as const;

let seq = 1;

export function makeBoat(
  kind: BoatKind,
  faction: 'enemy' | 'player',
  x: number, y: number, ang: number,
  opts: Partial<Boat> = {},
): Boat {
  const spec = BOAT[kind];
  return {
    id: seq++,
    x, y, ang, speed: 0,
    hp: spec.hp, maxHp: spec.hp,
    kind, faction,
    state: faction === 'enemy' ? 'transit' : 'cruise',
    t: 0, ramp: 0,
    troops: 0, manifest: 0, landed: 0,
    homeX: x, homeY: y,
    tx: x, ty: y,
    wake: 0,
    ...opts,
  };
}

/** A boat plowing water: hull, ramp, cabin, wake and a searchlight it sweeps ahead. */
export function drawBoat(ctx: CanvasRenderingContext2D, b: Boat, time: number, label = '') {
  const spec = BOAT[b.kind];
  const L = spec.len, W = spec.width;
  const sp = Math.abs(b.speed);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.ang);

  // ---- wake: two spreading lines and a churn behind the transom ----
  if (b.state !== 'sunk') {
    const churn = Math.min(1, sp / 140);
    ctx.strokeStyle = `rgba(196,232,240,${0.1 + churn * 0.22})`;
    ctx.lineWidth = 2 + churn * 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.52, side * W * 0.28);
      ctx.quadraticCurveTo(-L * 0.8, side * W * 0.62, -L * (0.95 + churn * 0.7), side * W * (0.7 + churn * 0.6));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(214,244,250,${0.05 + churn * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(-L * 0.6, 0, L * (0.2 + churn * 0.36), W * (0.2 + churn * 0.3), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- hull shadow / waterline ----
  ctx.fillStyle = 'rgba(2,10,14,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 6, L * 0.56, W * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const enemy = b.faction === 'enemy';
  const hull = enemy ? '#2a3944' : '#1d3b45';
  const deck = enemy ? '#3c4f58' : '#2f5866';
  const trim = enemy ? '#8d5b52' : '#5fbfa8';
  const bob = Math.sin(time * 1.7 + b.id) * 2.2 + Math.sin(time * 3.1 + b.id * 0.7) * 0.8;

  ctx.translate(0, bob);
  // hull: pointed bow, flat transom
  ctx.beginPath();
  ctx.moveTo(L * 0.55, 0);
  ctx.quadraticCurveTo(L * 0.3, -W * 0.5, -L * 0.42, -W * 0.48);
  ctx.lineTo(-L * 0.5, -W * 0.4);
  ctx.lineTo(-L * 0.5, W * 0.4);
  ctx.lineTo(-L * 0.42, W * 0.48);
  ctx.quadraticCurveTo(L * 0.3, W * 0.5, L * 0.55, 0);
  ctx.closePath();
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,190,200,0.35)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // deck
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.moveTo(L * 0.46, 0);
  ctx.quadraticCurveTo(L * 0.24, -W * 0.36, -L * 0.4, -W * 0.34);
  ctx.lineTo(-L * 0.4, W * 0.34);
  ctx.quadraticCurveTo(L * 0.24, W * 0.36, L * 0.46, 0);
  ctx.closePath();
  ctx.fill();

  // deck planking
  ctx.strokeStyle = 'rgba(12,24,28,0.5)';
  ctx.lineWidth = 1;
  for (let x = -L * 0.36; x < L * 0.34; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, -W * 0.33);
    ctx.lineTo(x, W * 0.33);
    ctx.stroke();
  }

  // bow gunwale highlight
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L * 0.52, 0);
  ctx.quadraticCurveTo(L * 0.28, -W * 0.46, -L * 0.42, -W * 0.44);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L * 0.52, 0);
  ctx.quadraticCurveTo(L * 0.28, W * 0.46, -L * 0.42, W * 0.44);
  ctx.stroke();

  // cabin / bridge (toward the stern)
  ctx.fillStyle = enemy ? '#46565c' : '#37606b';
  ctx.beginPath();
  ctx.roundRect(-L * 0.34, -W * 0.3, L * 0.26, W * 0.6, 6);
  ctx.fill();
  ctx.fillStyle = '#0d2129';
  ctx.fillRect(-L * 0.3, -W * 0.22, L * 0.16, W * 0.44);
  ctx.fillStyle = 'rgba(150,220,235,0.5)';
  ctx.fillRect(-L * 0.28, -W * 0.18, L * 0.12, 5);
  // mast + nav light
  ctx.fillStyle = '#26383f';
  ctx.fillRect(-L * 0.24, -2, 3, -26);
  ctx.fillStyle = enemy ? '#ff7a6a' : '#7ef0c8';
  ctx.beginPath();
  ctx.arc(-L * 0.225, -28, 3, 0, Math.PI * 2);
  ctx.fill();

  // landing ramp at the bow
  if (b.kind === 'landing') {
    const r = b.ramp;
    if (r > 0.02) {
      // the ramp swings down and forward onto the sand
      const reach = L * 0.34 * r;
      ctx.save();
      ctx.translate(L * 0.48, 0);
      ctx.fillStyle = '#54696f';
      ctx.beginPath();
      ctx.moveTo(0, -W * 0.42);
      ctx.lineTo(reach, -W * 0.34);
      ctx.lineTo(reach, W * 0.34);
      ctx.lineTo(0, W * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8fa8ad';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,32,36,0.65)';
      for (let i = 1; i < 5; i++) {
        const x = (reach * i) / 5;
        ctx.beginPath(); ctx.moveTo(x, -W * 0.4); ctx.lineTo(x, W * 0.4); ctx.stroke();
      }
      // wet sand churned where the ramp bites
      ctx.fillStyle = 'rgba(30,26,20,0.35)';
      ctx.beginPath(); ctx.ellipse(reach + 8, 0, 18, W * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#4a5f66';
      ctx.fillRect(L * 0.44, -W * 0.42, 8, W * 0.84);
    }
    // the hold: a dark well where the troops stand
    ctx.fillStyle = 'rgba(4,12,16,0.75)';
    ctx.beginPath();
    ctx.roundRect(L * 0.02, -W * 0.3, L * 0.3, W * 0.6, 5);
    ctx.fill();
    // silhouettes of the men still aboard
    for (let i = 0; i < Math.min(6, b.troops); i++) {
      const px = L * 0.06 + (i % 3) * 22;
      const py = -W * 0.16 + Math.floor(i / 3) * 22;
      ctx.fillStyle = 'rgba(150,175,180,0.55)';
      ctx.beginPath();
      ctx.ellipse(px, py, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // patrol boat: a small turret ring
    ctx.fillStyle = '#20323a';
    ctx.beginPath();
    ctx.arc(L * 0.16, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(L * 0.16, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8fa8ad';
    ctx.fillRect(L * 0.16, -3, 30, 6);
  }

  // searchlight cone sweeping ahead — the reason you see them before they see you
  if (b.state !== 'sunk' && b.faction === 'enemy') {
    const a = Math.sin(time * 0.7 + b.id) * 0.5;
    const g = ctx.createLinearGradient(L * 0.5, 0, L * 0.5 + 320, 0);
    g.addColorStop(0, 'rgba(180,230,240,0.20)');
    g.addColorStop(1, 'rgba(180,230,240,0)');
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.lineTo(L * 0.5 + 330, -80);
    ctx.lineTo(L * 0.5 + 330, 80);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // hull damage bar + label
  if (b.hp < b.maxHp || b.crewed) {
    const w = 74;
    ctx.fillStyle = 'rgba(6,14,18,0.8)';
    ctx.fillRect(b.x - w / 2, b.y - 62, w, 5);
    ctx.fillStyle = b.faction === 'enemy' ? '#e08072' : '#7fe6c4';
    ctx.fillRect(b.x - w / 2, b.y - 62, Math.max(0, b.hp / b.maxHp) * w, 5);
  }
  if (label) {
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = b.faction === 'enemy' ? '#f0a99b' : '#8ef0d0';
    ctx.fillText(label, b.x, b.y - 70);
    ctx.textAlign = 'left';
  }
  // a boat that just went up: fire on the water
  if (b.state === 'sunk') {
    for (let i = 0; i < 5; i++) {
      const k = (time * 0.6 + i * 0.37) % 1;
      ctx.fillStyle = `rgba(255,${140 + i * 12},70,${0.55 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(b.x + Math.sin(time + i) * 26, b.y - k * 44, 8 + k * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
