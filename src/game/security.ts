import type { Point } from './navigation';

export interface Searchlight extends Point {
  speed: number; sweep: number; bearing: number; angle: number;
  range: number; halfAngle: number; exposure: number; online: boolean;
  /** Power site feeding this lamp — it dies with its own yard, not only with the sector grid. */
  site?: string;
}
export interface SecurityState {
  active: boolean; target: Point; lostFor: number; cooldown: number; jammed: number; exposure: number;
}
export const newSecurityState = (): SecurityState => ({ active: false, target: { x: 0, y: 0 }, lostFor: 0, cooldown: 0, jammed: 0, exposure: 0 });

export function updateSearchlights(
  lights: Searchlight[], security: SecurityState, player: Point, time: number, dt: number,
  hasSight: (light: Searchlight, player: Point) => boolean,
): boolean {
  security.cooldown = Math.max(0, security.cooldown - dt);
  security.jammed = Math.max(0, security.jammed - dt);
  let seen = false, exposure = 0;
  for (const light of lights) {
    if (!light.online) continue;
    const goal = security.active && security.jammed <= 0
      ? Math.atan2(security.target.y - light.y, security.target.x - light.x)
      : light.bearing + Math.sin(time * light.speed * 0.46 + light.x * 0.002) * light.sweep;
    const turn = Math.atan2(Math.sin(goal - light.angle), Math.cos(goal - light.angle));
    light.angle += turn * (1 - Math.exp(-(security.active ? 6 : 2) * dt));
    const dx = player.x - light.x, dy = player.y - light.y;
    const d = Math.hypot(dx, dy);
    const angle = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - light.angle), Math.cos(Math.atan2(dy, dx) - light.angle)));
    const visible = security.jammed <= 0 && d < light.range && d > 28 && angle < light.halfAngle && hasSight(light, player);
    light.exposure = Math.max(0, Math.min(1, light.exposure + dt * (visible ? 2.8 : -2)));
    if (visible) seen = true;
    exposure = Math.max(exposure, light.exposure);
  }
  security.exposure = exposure;
  if (security.jammed > 0) { security.active = false; security.lostFor = 0; return false; }
  if (!security.active && exposure >= 1) {
    security.active = true; security.target = { ...player }; security.lostFor = 0;
    if (security.cooldown <= 0) { security.cooldown = 75; return true; }
  }
  if (security.active) {
    if (seen) { security.target = { ...player }; security.lostFor = 0; }
    else security.lostFor += dt;
    if (security.lostFor > 12) { security.active = false; security.exposure = 0; }
  }
  return false;
}

/** Rendering uses the exact same angle and range as detection. */
export function drawSearchlight(ctx: CanvasRenderingContext2D, l: Searchlight, alarm: boolean, jammed: boolean, length: number) {
  if (!l.online) return;
  const color = jammed ? '111,225,195' : alarm ? '255,121,91' : '255,225,168';
  ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.angle); ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createLinearGradient(0, 0, length, 0);
  gradient.addColorStop(0, `rgba(${color},${alarm ? 0.23 : 0.16})`);
  gradient.addColorStop(0.8, `rgba(${color},0.035)`); gradient.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.arc(0, 0, length, -l.halfAngle, l.halfAngle); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(${color},0.16)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(l.halfAngle) * length, Math.sin(l.halfAngle) * length); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#33424a'; ctx.fillRect(-9, -6, 19, 12);
  ctx.fillStyle = `rgb(${color})`; ctx.fillRect(8, -5, 3, 10); ctx.restore();
}