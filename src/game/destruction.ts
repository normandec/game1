import type { Rect, StructKind } from './world';
import type { Block } from './navigation';

export const distanceToBlock = (x: number, y: number, b: Block) => Math.hypot(
  x - Math.max(b.x, Math.min(b.x + b.w, x)), y - Math.max(b.y, Math.min(b.y + b.h, y)),
);

export function structuralHealth(kind: StructKind) {
  if (kind === 'crate') return 52;
  if (kind === 'sandbag' || kind === 'fence') return 100;
  if (kind === 'keep' || kind === 'tower' || kind === 'vault') return 380;
  if (kind === 'curtain' || kind === 'bunker') return 250;
  if (kind === 'hangar' || kind === 'wall') return 180;
  return 220;
}

/** Long walls break in sections, not as an entire perimeter in one explosion. */
export function prepareStructures(rects: Rect[]): Rect[] {
  return rects.flatMap((r, i) => {
    const horizontal = r.w >= r.h;
    const long = horizontal ? r.w : r.h;
    const thin = horizontal ? r.h : r.w;
    const count = !r.facilityDetail && thin < 100 && long > 200 ? Math.ceil(long / 144) : 1;
    return Array.from({ length: count }, (_, k) => {
      const hp = structuralHealth(r.kind);
      return { ...r, x: r.x + (horizontal ? k * r.w / count : 0), y: r.y + (!horizontal ? k * r.h / count : 0),
        w: horizontal ? r.w / count : r.w, h: horizontal ? r.h : r.h / count,
        hp, maxHp: hp, dead: false, structuralGroup: i };
    });
  });
}

export interface Ruin extends Block { seed: number; color: string }
export function drawRuins(ctx: CanvasRenderingContext2D, ruins: Ruin[], view: Block) {
  for (const r of ruins) {
    if (r.x + r.w < view.x - 35 || r.x > view.x + view.w + 35 || r.y + r.h < view.y - 35 || r.y > view.y + view.h + 35) continue;
    ctx.save(); ctx.translate(r.x, r.y);
    ctx.fillStyle = '#07121d80'; ctx.fillRect(-9, -5, r.w + 18, r.h + 20);
    for (let i = 0; i < 17; i++) {
      const x = ((i * 41 + r.seed * 17) % Math.max(1, r.w + 22)) - 11;
      const y = ((i * 61 + r.seed * 29) % Math.max(1, r.h + 18)) - 9;
      const w = 5 + (i * 13 + r.seed) % 17, h = 4 + (i * 7) % 11;
      ctx.fillStyle = '#0005'; ctx.fillRect(x + 3, y + 5, w, h);
      ctx.fillStyle = i % 3 ? r.color : '#647172'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#aab9ae35'; ctx.fillRect(x, y, w, 1);
    }
    ctx.restore();
  }
}