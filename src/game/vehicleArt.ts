export interface GroundVehicleArt {
  x: number; y: number; ang: number; speed: number; lean: number;
  hp: number; maxHp: number; rescue?: boolean; driving?: boolean; turretAng?: number;
}

/** The visual footprint matches the collision hull: forward is always local +X. */
export function drawTransport(ctx: CanvasRenderingContext2D, v: GroundVehicleArt, time: number, door = 0, label = '') {
  ctx.save(); ctx.translate(v.x, v.y);
  ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(5, 15, 85, 34, v.ang, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(v.ang);
  const bounce = Math.sin(time * 8 + v.x) * Math.min(1.4, Math.abs(v.speed) / 150);
  ctx.translate(0, bounce); ctx.transform(1, v.lean * 0.08, 0, 1, 0, 0);
  const accent = v.rescue ? '#8fe4c0' : v.driving ? '#7fdde8' : '#bc7271';
  for (const x of [-53, -12, 51]) for (const y of [-36, 26]) {
    ctx.fillStyle = '#091012'; ctx.fillRect(x - 9, y, 19, 10);
    ctx.fillStyle = '#273236'; ctx.fillRect(x - 6, y + 3, 13, 3);
  }
  ctx.fillStyle = '#0e2129'; ctx.fillRect(-78, -30, 156, 66);
  ctx.fillStyle = v.driving ? '#315763' : '#394c4e'; ctx.fillRect(-76, -32, 110, 61);
  ctx.fillStyle = '#4c6469'; ctx.fillRect(-74, -31, 106, 8);
  ctx.fillStyle = '#152f36'; ctx.fillRect(-72, 23, 104, 5);
  for (let x = -65; x < 27; x += 20) { ctx.fillStyle = '#18303988'; ctx.fillRect(x, -22, 3, 41); ctx.fillStyle = '#759091'; ctx.fillRect(x + 6, -18, 2, 2); }
  ctx.fillStyle = '#1c3038'; ctx.fillRect(35, -31, 40, 62);
  ctx.fillStyle = '#587880'; ctx.fillRect(38, -28, 34, 9);
  ctx.fillStyle = '#081925'; ctx.fillRect(53, -22, 18, 42);
  const glass = ctx.createLinearGradient(53, -22, 71, 20); glass.addColorStop(0, '#80becb'); glass.addColorStop(1, '#1e4c62');
  ctx.fillStyle = glass; ctx.fillRect(56, -20, 12, 38); ctx.fillStyle = '#163440'; ctx.fillRect(56, -1, 12, 3);
  ctx.fillStyle = '#101a20'; ctx.fillRect(76, -33, 6, 66);
  ctx.fillStyle = Math.abs(v.speed) > 0.5 ? '#e8d19c' : '#73664e'; ctx.fillRect(74, -26, 4, 9); ctx.fillRect(74, 16, 4, 9);
  ctx.fillStyle = door > 0.02 ? '#111c25' : '#364a50'; ctx.fillRect(-80, -30, 5, 59);
  if (door > 0.02) {
    ctx.fillStyle = '#435761'; ctx.fillRect(-79 - 25 * door, -24, 25 * door, 47);
    ctx.strokeStyle = '#8d9b97'; ctx.lineWidth = 1; ctx.strokeRect(-79 - 25 * door, -24, 25 * door, 47);
    ctx.fillStyle = '#d7bd7d'; for (let y = -20; y < 21; y += 10) ctx.fillRect(-81 - 24 * door, y, 3, 4);
    ctx.fillStyle = '#0b151a'; ctx.fillRect(-76, -23, 23, 46);
  }
  if (v.rescue) { ctx.fillStyle = '#aad9bb'; ctx.fillRect(-26, -4, 22, 8); ctx.fillRect(-19, -11, 8, 22); }
  else { ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-20, 0, 10, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = accent; ctx.fillRect(-22, -7, 4, 14); }
  if (v.driving) {
    ctx.save(); ctx.translate(14, 0); ctx.rotate((v.turretAng ?? v.ang) - v.ang);
    ctx.fillStyle = '#101e25'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#638a96'; ctx.fillRect(0, -4, 35, 8); ctx.fillStyle = '#9ef2f2'; ctx.fillRect(29, -2, 8, 4); ctx.restore();
  }
  ctx.restore();
  if (v.hp < v.maxHp || v.driving) {
    ctx.fillStyle = '#091219cc'; ctx.fillRect(v.x - 43, v.y - 54, 86, 4);
    ctx.fillStyle = v.hp / v.maxHp > 0.35 ? accent : '#f69a83'; ctx.fillRect(v.x - 43, v.y - 54, Math.max(0, v.hp / v.maxHp) * 86, 4);
  }
  if (label) { ctx.font = '9px monospace'; ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.fillText(label, v.x, v.y - 65); ctx.textAlign = 'left'; }
}

export function drawParkedAircraft(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, rotor: number, accent = '#af626a') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(3, 17, 74, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#192a33'; ctx.fillRect(-93, -6, 60, 12); ctx.fillRect(-96, -20, 8, 21);
  ctx.fillStyle = '#1e333e'; ctx.fillRect(-18, -34, 27, 68);
  ctx.fillStyle = '#334e5b'; ctx.beginPath(); ctx.roundRect(-44, -22, 87, 44, 18); ctx.fill();
  ctx.fillStyle = '#587480'; ctx.beginPath(); ctx.roundRect(-41, -20, 78, 19, 13); ctx.fill();
  ctx.fillStyle = '#113247'; ctx.beginPath(); ctx.roundRect(16, -16, 29, 31, 12); ctx.fill();
  ctx.fillStyle = '#88bdc9'; ctx.beginPath(); ctx.ellipse(31, -6, 9, 7, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = accent; ctx.fillRect(-25, -8, 18, 4);
  ctx.fillStyle = '#101923'; ctx.fillRect(40, -3, 20, 6);
  ctx.strokeStyle = '#6b8588'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-33, -28); ctx.lineTo(25, -28); ctx.moveTo(-33, 28); ctx.lineTo(25, 28); ctx.stroke();
  ctx.rotate(rotor); ctx.strokeStyle = '#9dafb999'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-93, 0); ctx.lineTo(93, 0); ctx.moveTo(0, -93); ctx.lineTo(0, 93); ctx.stroke();
  ctx.fillStyle = '#10232c'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}