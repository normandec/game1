import type { Rect, WorldData } from './world';
import { VAULT_ENTRY } from './world';
import { segmentBox, type Block, type Point } from './navigation';

export interface HydraulicGate {
  id: number; x: number; y: number; ang: number; span: number; open: number;
  locked: boolean; hp: number; maxHp: number; secret: boolean; label: string;
}
export interface RoomDetail extends Block {
  kind: 'console' | 'table' | 'rack' | 'bed' | 'bench' | 'reactor'; label: string; color: string;
}

export function makeGates(world: WorldData): HydraulicGate[] {
  const points = [
    ...world.facilities.flatMap(f => f.doors.map(p => ({ ...p, label: f.code, secret: false }))),
    ...world.gateSpots.map(p => ({ ...p, label: 'PERIMETER', secret: false })),
    ...world.pois.flatMap(p => p.gates.map(g => ({ ...g, label: p.kind === 'peggy' ? 'SSR ARCHIVE' : p.kind.toUpperCase(), secret: p.secret }))),
    ...world.hangars.map((h, i) => ({ x: h.doorX, y: h.doorY, label: `HANGAR ${String(i + 1).padStart(2, '0')}`, secret: false })),
  ];
  const gates: HydraulicGate[] = [];
  for (const p of points) {
    if (gates.some(g => Math.hypot(g.x - p.x, g.y - p.y) < 45)) continue;
    let left = 400, right = 400, above = 400, below = 400;
    for (const r of world.rects) {
      if (p.y >= r.y - 8 && p.y <= r.y + r.h + 8) {
        if (r.x + r.w <= p.x) left = Math.min(left, p.x - r.x - r.w);
        if (r.x >= p.x) right = Math.min(right, r.x - p.x);
      }
      if (p.x >= r.x - 8 && p.x <= r.x + r.w + 8) {
        if (r.y + r.h <= p.y) above = Math.min(above, p.y - r.y - r.h);
        if (r.y >= p.y) below = Math.min(below, r.y - p.y);
      }
    }
    const horizontal = left + right <= above + below;
    const span = Math.max(110, Math.min(300, horizontal ? left + right : above + below));
    gates.push({ id: gates.length, x: p.x, y: p.y, ang: horizontal ? 0 : Math.PI / 2, span,
      open: 0, locked: false, hp: 1200, maxHp: 1200, secret: p.secret, label: p.label });
  }
  return gates;
}

export function gateBlocks(g: HydraulicGate): Block[] {
  if (g.hp <= 0 || g.open > 0.985) return [];
  const leaf = g.span * 0.5 * (1 - g.open);
  if (g.ang === 0) return [
    { x: g.x - g.span / 2, y: g.y - 15, w: leaf, h: 30 },
    { x: g.x + g.span / 2 - leaf, y: g.y - 15, w: leaf, h: 30 },
  ];
  return [
    { x: g.x - 15, y: g.y - g.span / 2, w: 30, h: leaf },
    { x: g.x - 15, y: g.y + g.span / 2 - leaf, w: 30, h: leaf },
  ];
}

export function makeDetails(world: WorldData): RoomDetail[] {
  const result: RoomDetail[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: RoomDetail['kind'], label = '', color = '#68dbeb') => result.push({ x, y, w, h, kind, label, color });
  world.hangars.forEach((h, i) => {
    add(h.x + 45, h.y + 45, 70, 32, 'console', ['FLIGHT CONTROL', 'ARMAMENT', 'REPAIR BAY', 'MEDEVAC', 'STEALTH LAB'][i % 5]);
    add(h.x + 45, h.y + 110, 38, 90, 'rack');
    add(h.x + h.w - 110, h.y + 60, 65, 38, i % 2 ? 'bench' : 'table');
    add(h.x + h.w - 95, h.y + 170, 45, 65, i === 3 ? 'bed' : 'reactor', '', i === 3 ? '#7ef5c1' : '#eabc73');
  });
  for (const poi of world.pois) {
    if (poi.kind === 'vault' || poi.kind === 'airfield' || poi.kind === 'library' || poi.kind === 'depot') continue;
    add(poi.x - 205, poi.y - 165, 100, 32, 'console', poi.kind === 'peggy' ? 'CARTER / SSR 1946' : 'TARGETING ARRAY');
    add(poi.x + 125, poi.y - 130, 52, 110, 'rack');
    add(poi.x - 190, poi.y + 25, 45, 80, 'bed', 'MEDICAL');
    add(poi.x + 90, poi.y + 90, 78, 50, 'table', 'TACTICAL');
  }
  world.serverSpots.forEach(p => add(p.x - 48, p.y + 55, 96, 30, 'console', 'HYDRA NETWORK'));
  const general = world.generalSpot;
  add(general.x - 70, general.y + 70, 140, 80, 'table', 'STRATEGIC COMMAND');
  return result;
}

export function drawDetails(ctx: CanvasRenderingContext2D, details: RoomDetail[], view: Block, time: number) {
  for (const d of details) {
    if (d.x + d.w < view.x || d.y + d.h < view.y || d.x > view.x + view.w || d.y > view.y + view.h) continue;
    ctx.save(); ctx.translate(d.x, d.y);
    ctx.fillStyle = '#0007'; ctx.fillRect(5, 9, d.w, d.h);
    ctx.fillStyle = '#14252d'; ctx.fillRect(0, 3, d.w, d.h);
    ctx.fillStyle = d.kind === 'bed' ? '#678c87' : '#29424a'; ctx.fillRect(0, -4, d.w, d.h);
    ctx.strokeStyle = '#638b9366'; ctx.lineWidth = 1; ctx.strokeRect(1, -3, d.w - 2, d.h - 2);
    if (d.kind === 'console') {
      ctx.fillStyle = '#051923'; ctx.fillRect(5, -2, d.w - 10, d.h - 9);
      ctx.fillStyle = d.color;
      for (let i = 0; i < 4; i++) ctx.fillRect(10, i * 4 + 2, (d.w - 25) * (0.35 + ((i * 19 + d.x) % 50) / 100), 1.5);
      ctx.fillStyle = '#a9d0cc'; for (let x = 7; x < d.w - 7; x += 7) ctx.fillRect(x, d.h - 10, 4, 2);
    } else if (d.kind === 'rack') {
      for (let y = 3; y < d.h - 12; y += 12) {
        ctx.fillStyle = '#0a1b24'; ctx.fillRect(5, y, d.w - 10, 9);
        ctx.fillStyle = Math.sin(time * 2 + y) > 0 ? '#64e4be' : '#39696d'; ctx.fillRect(8, y + 3, 4, 2);
        ctx.fillStyle = '#719598'; ctx.fillRect(18, y + 3, d.w - 30, 1);
      }
    } else if (d.kind === 'table') {
      ctx.fillStyle = '#081e24'; ctx.fillRect(7, 3, d.w - 14, d.h - 14);
      ctx.strokeStyle = '#66ecbf66'; ctx.beginPath();
      for (let x = 12; x < d.w - 7; x += 12) { ctx.moveTo(x, 5); ctx.lineTo(x, d.h - 14); }
      ctx.stroke(); ctx.fillStyle = '#e4bb6b'; ctx.fillRect(d.w * 0.4, d.h * 0.3, 5, 5);
      ctx.fillStyle = '#6cddd1'; ctx.fillRect(d.w * 0.7, d.h * 0.6, 4, 4);
    } else if (d.kind === 'reactor') {
      ctx.fillStyle = '#14252c'; ctx.beginPath(); ctx.ellipse(d.w / 2, d.h / 2, d.w * 0.35, d.h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = d.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(d.w / 2, d.h / 2, d.w * 0.25, time, time + 5); ctx.stroke();
    } else if (d.kind === 'bed') {
      ctx.fillStyle = '#b0c8ba'; ctx.fillRect(5, 1, d.w - 10, 16); ctx.fillStyle = '#294b49'; ctx.fillRect(5, 26, d.w - 10, d.h - 36);
    } else { ctx.fillStyle = '#d6ba73'; ctx.fillRect(9, 8, 20, 6); ctx.fillStyle = '#82a5aa'; ctx.fillRect(34, 8, 15, 3); }
    if (d.label) { ctx.font = '8px monospace'; ctx.fillStyle = '#96bab5'; ctx.fillText(d.label, 0, -11); }
    ctx.restore();
  }
}

export function drawGate(ctx: CanvasRenderingContext2D, g: HydraulicGate, time: number, near: boolean) {
  if (g.hp <= 0) return;
  ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.ang);
  const color = g.locked ? '#ff777c' : '#64edc9', s = g.span / 2;
  ctx.fillStyle = '#0008'; ctx.fillRect(-s - 18, -10, g.span + 36, 48);
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#17252b'; ctx.fillRect(side * s - 15, -28, 30, 66);
    ctx.fillStyle = '#48636b'; ctx.fillRect(side * s - 11, -29, 22, 13);
    ctx.fillStyle = color; ctx.fillRect(side * s - 7, -21, 14, 4);
    const length = s * (1 - g.open);
    const x = side < 0 ? -s : s - length;
    ctx.fillStyle = '#172b35'; ctx.fillRect(x, -11, length, 36);
    ctx.fillStyle = '#41575e'; ctx.fillRect(x, -22, length, 30);
    ctx.strokeStyle = '#72878b'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, -21, Math.max(0, length - 2), 28);
    ctx.fillStyle = '#0e222c'; for (let i = 8; i < length - 5; i += 24) ctx.fillRect(x + i, -15, 10, 18);
    ctx.fillStyle = '#d5b66b'; for (let i = 3; i < length - 6; i += 19) ctx.fillRect(x + i, 5, 9, 3);
    // Extending hydraulic cylinder above each gate leaf.
    ctx.fillStyle = '#192b32'; ctx.fillRect(side < 0 ? -s - 4 : s - 52, -40, 56, 9);
    ctx.fillStyle = '#a7bac0'; ctx.fillRect(side < 0 ? -s + 10 : s - 10 - (s - 24) * (1 - g.open), -37, Math.max(0, (s - 24) * (1 - g.open)), 3);
  }
  if (near) {
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color;
    ctx.fillText(g.locked ? '[L] UNLOCK / HYDRA LOCKOUT' : '[L] SEAL HYDRAULIC GATE', 0, 56);
    ctx.fillStyle = '#a3b9b9'; ctx.font = '8px monospace'; ctx.fillText(g.label, 0, -54);
  }
  ctx.globalAlpha = 0.35 + Math.sin(time * 2) * 0.1;
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(-s - 21, -43, g.span + 42, 84);
  ctx.restore();
}

export function firstBlock(a: Point, b: Point, blocks: Rect[]): { rect: Rect; t: number } | null {
  let hit: { rect: Rect; t: number } | null = null;
  for (const rect of blocks) {
    const t = segmentBox(a, b, rect);
    if (t !== null && (!hit || t < hit.t)) hit = { rect, t };
  }
  return hit;
}

export function isVaultRegion(p: Point) { return p.x > 540 && p.x < 2040 && p.y > VAULT_ENTRY.y - 80 && p.y < 7860; }