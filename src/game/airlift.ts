import type { Point, Block } from './navigation';

export interface AirTransport extends Point {
  kind: 'atlas' | 'mantis'; state: 'launch' | 'approach' | 'drop' | 'return' | 'land';
  home: Point; target: Point; ang: number; rotor: number; bank: number; altitude: number;
  hp: number; maxHp: number; comp: string[]; squadId: number; slot: number;
  clock: number; deployCd: number; announced: boolean;
}
export interface AirborneTrooper extends Point {
  type: string; squadId: number; slot: number; progress: number; duration: number;
  kind: 'rope' | 'parachute'; topX: number; topY: number; altitude: number; hp: number;
}
export interface AircraftPose extends Point { ang: number; bank: number; altitude: number; friendly: boolean; bomber: boolean; bombOpen?: boolean; active?: boolean }

const TAU = Math.PI * 2;
function path(c: CanvasRenderingContext2D, points: [number, number][], color: string | CanvasGradient) {
  c.fillStyle = color; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
}

/** Layered metal surfaces, panel seams and matching forward-axis silhouettes. */
export function drawFixedWing(c: CanvasRenderingContext2D, p: AircraftPose, time: number) {
  const size = p.bomber ? 1.22 : 1;
  const color = p.friendly ? '#8ae4e2' : '#d3a181';
  c.save(); c.translate(p.x, p.y);
  c.save(); c.rotate(p.ang); c.fillStyle = '#0005';
  c.beginPath(); c.ellipse(-14, 35 + p.altitude * 0.42, 147 * size, 73 * size, 0, 0, TAU); c.fill(); c.restore();
  c.translate(0, -p.altitude * 0.55); c.rotate(p.ang); c.scale(size, size * (1 - Math.abs(p.bank) * 0.15));

  path(c, [[-18,-24],[-85,-167],[-62,-175],[51,-35],[54,35],[-62,175],[-85,167],[-18,24]], '#0e2531');
  const wing = c.createLinearGradient(-85, -160, 48, 80);
  wing.addColorStop(0, '#53636e'); wing.addColorStop(0.48, p.friendly ? '#365564' : '#4a5055'); wing.addColorStop(1, '#213947');
  c.fillStyle = wing; c.beginPath(); c.moveTo(-16,-22); c.lineTo(-81,-163); c.lineTo(-61,-169); c.lineTo(46,-33); c.lineTo(46,33); c.lineTo(-61,169); c.lineTo(-81,163); c.lineTo(-16,22); c.closePath(); c.fill();
  c.strokeStyle = '#afcad044'; c.lineWidth = 1;
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(28,side * 29); c.lineTo(-58,side * 162); c.moveTo(-15,side * 32); c.lineTo(-72,side * 155); c.stroke();
    path(c, [[-114,side * 13],[-159,side * 76],[-129,side * 73],[-79,side * 15]], '#40535f');
    c.strokeStyle = '#99b2bc55'; c.beginPath(); c.moveTo(-108,side * 27); c.lineTo(-143,side * 70); c.stroke();
    // Four turbofan nacelles with concentric intake fans and hot exhausts.
    for (const off of [64, 105]) {
      const x = off === 64 ? -3 : -28, y = side * off;
      c.fillStyle = '#081b25'; c.beginPath(); c.roundRect(x - 38, y - 12, 71, 24, 11); c.fill();
      c.fillStyle = '#536c74'; c.beginPath(); c.roundRect(x - 35, y - 11, 63, 11, 7); c.fill();
      c.fillStyle = '#0b202b'; c.beginPath(); c.ellipse(x + 31, y, 7, 11, 0, 0, TAU); c.fill();
      c.strokeStyle = '#9bb5bd'; c.lineWidth = 1; c.beginPath(); c.ellipse(x + 32, y, 4.5, 8, 0, 0, TAU); c.stroke();
      c.fillStyle = p.active ? '#9acfd680' : '#547181'; c.fillRect(x - 40, y - 5, 7, 10);
    }
    c.fillStyle = side < 0 ? '#e77769' : '#82dcae'; c.beginPath(); c.arc(-67, side * 169, 2.5, 0, TAU); c.fill();
  }
  // Streamlined fuselage with an armored dorsal spine.
  const body = c.createLinearGradient(0,-27,0,28); body.addColorStop(0,'#81949a'); body.addColorStop(0.25,'#516d78'); body.addColorStop(0.6, p.friendly ? '#254855' : '#3b4a50'); body.addColorStop(1,'#152d39');
  c.fillStyle = body; c.beginPath(); c.moveTo(-149, -8); c.bezierCurveTo(-75,-27,67,-34,122,-15); c.quadraticCurveTo(168,0,122,15); c.bezierCurveTo(67,34,-75,27,-149,8); c.closePath(); c.fill();
  c.strokeStyle = '#b6d6da44'; c.lineWidth = 1; c.beginPath(); c.moveTo(-112,-10); c.bezierCurveTo(-28,-25,92,-23,135,-9); c.stroke();
  path(c, [[70,-18],[105,-15],[124,-6],[116,0],[71,-2]], '#081c2b');
  const glass = c.createLinearGradient(76,-18,121,0); glass.addColorStop(0,'#9fd7df'); glass.addColorStop(1,'#234e6b');
  path(c, [[76,-15],[103,-12],[117,-6],[111,-3],[77,-4]], glass);
  c.strokeStyle = '#91b9c5'; c.lineWidth = 1; c.beginPath(); c.moveTo(94,-14); c.lineTo(94,-3); c.stroke();
  for (let x = -83; x < 56; x += 24) {
    c.strokeStyle = '#97b3bb33'; c.beginPath(); c.moveTo(x,-20); c.lineTo(x,20); c.stroke();
    c.fillStyle = '#abc7c84a'; c.fillRect(x + 7, -20, 2, 2); c.fillRect(x + 7, 18, 2, 2);
  }
  c.fillStyle = '#102735'; c.fillRect(-40,-8,55,16);
  c.fillStyle = p.bombOpen ? '#bda573' : '#2e4b58'; c.fillRect(-36,-6,47,12);
  c.strokeStyle = '#708d97'; c.lineWidth = 1; c.beginPath(); c.moveTo(-35,0); c.lineTo(10,0); c.stroke();
  path(c, [[-144,-4],[-158,-28],[-108,-19],[-93,-4]], '#78919c');
  path(c, [[-142,0],[-152,-17],[-113,-12],[-95,0]], '#28434f');
  c.fillStyle = color;
  if (p.friendly) {
    c.beginPath(); c.moveTo(20,-13); c.lineTo(42,-13); c.lineTo(42,1); c.quadraticCurveTo(32,15,31,16); c.quadraticCurveTo(20,8,20,1); c.closePath(); c.fill();
    c.fillStyle = '#17343f'; c.fillRect(29,-8,4,16);
  } else { c.beginPath(); c.arc(30,0,10,0,TAU); c.fill(); c.fillStyle = '#27343c'; c.fillRect(27,-8,6,16); }
  c.fillStyle = '#c5d2d477'; c.font = '7px monospace'; c.fillText(p.friendly ? 'SHIELD / NJ-07' : 'HYDRA / ATLAS', -80,-28);
  if (!p.active) {
    c.strokeStyle = '#131d24'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-41,-30); c.lineTo(-11,-30); c.moveTo(-41,30); c.lineTo(-11,30); c.stroke();
  } else if (Math.sin(time * 7) > 0.5) { c.fillStyle = '#edf2dd'; c.fillRect(118,-16,4,3); }
  c.restore();
}

export function drawMantis(c: CanvasRenderingContext2D, v: AirTransport, time: number) {
  c.save(); c.translate(v.x, v.y);
  c.fillStyle = '#0005'; c.beginPath(); c.ellipse(0, v.altitude * 0.4 + 24, 112, 37, v.ang, 0, TAU); c.fill();
  c.translate(0, -v.altitude * 0.55); c.rotate(v.ang);
  c.fillStyle = '#182732'; c.fillRect(-52,-34,15,69); c.fillRect(39,-34,15,69);
  c.fillStyle = '#455b63'; c.beginPath(); c.roundRect(-98,-27,189,54,22); c.fill();
  c.fillStyle = '#647b80'; c.beginPath(); c.roundRect(-91,-25,171,22,15); c.fill();
  c.fillStyle = '#122b3a'; c.beginPath(); c.roundRect(49,-19,38,38,12); c.fill();
  c.fillStyle = '#a0c9d3'; c.fillRect(61,-13,14,10); c.fillRect(61,4,14,10);
  for (let x=-52;x<37;x+=21) { c.fillStyle='#0c202b'; c.fillRect(x,-23,13,8); c.fillRect(x,16,13,8); }
  c.fillStyle = '#101e27'; c.fillRect(-96,-16,14,32);
  if (v.state === 'drop') { c.fillStyle='#d9bd8a'; c.fillRect(-46,-29,29,3); c.fillRect(-46,26,29,3); }
  c.fillStyle='#af7168'; c.fillRect(-8,-6,23,12); c.fillStyle='#344b53'; c.fillRect(0,-6,7,12);
  for (const x of [-66,61]) {
    c.fillStyle='#24343c'; c.beginPath(); c.ellipse(x,0,18,22,0,0,TAU); c.fill();
    c.save(); c.translate(x,-4); c.rotate(v.rotor * (x<0?1:-1));
    c.strokeStyle='rgba(189,211,218,0.48)'; c.lineWidth=4;
    c.beginPath(); for(let i=0;i<3;i++){const a=i/3*TAU;c.moveTo(0,0);c.lineTo(Math.cos(a)*85,Math.sin(a)*85);} c.stroke();
    c.strokeStyle='#b5d3dc22';c.lineWidth=1;c.beginPath();c.arc(0,0,85,0,TAU);c.stroke();c.restore();
    c.fillStyle='#142830';c.beginPath();c.arc(x,-4,6,0,TAU);c.fill();
  }
  c.fillStyle=Math.sin(time*5)>0?'#e1866e':'#5e433a';c.fillRect(-94,-3,4,6);
  c.restore();
}

export function drawAirborne(c: CanvasRenderingContext2D, troops: AirborneTrooper[], view: Block) {
  for (const p of troops) {
    if (p.x < view.x-100 || p.x>view.x+view.w+100 || p.y<view.y-160 || p.y>view.y+view.h+160) continue;
    const progress = Math.min(1, p.progress / p.duration);
    const lift = p.altitude * (1 - progress);
    c.save();
    c.fillStyle='#0006';c.beginPath();c.ellipse(p.x,p.y+5,10,4,0,0,TAU);c.fill();
    c.strokeStyle='#bcbfab';c.lineWidth=1.4;
    if (p.kind==='rope') {
      c.beginPath();c.moveTo(p.topX,p.topY-p.altitude);c.lineTo(p.x,p.y+5);c.stroke();
    } else {
      const y=p.y-lift-30;
      c.fillStyle='#716d55';c.beginPath();c.arc(p.x,y,31,Math.PI,0);c.lineTo(p.x+31,y);c.closePath();c.fill();
      c.strokeStyle='#c1bea0';c.beginPath();for(const x of [-31,0,31]){c.moveTo(p.x+x,y);c.lineTo(p.x,p.y-lift-3);}c.stroke();
      c.strokeStyle='#232e2f';c.lineWidth=1;c.beginPath();c.moveTo(p.x-10,y-29);c.lineTo(p.x-7,y);c.moveTo(p.x+10,y-29);c.lineTo(p.x+7,y);c.stroke();
    }
    c.translate(p.x,p.y-lift);
    c.strokeStyle='#202e35';c.lineWidth=4;c.beginPath();c.moveTo(-3,5);c.lineTo(-7,14);c.moveTo(3,5);c.lineTo(8,12);c.moveTo(-5,-2);c.lineTo(-9,-11);c.moveTo(5,-2);c.lineTo(8,-11);c.stroke();
    c.fillStyle='#344650';c.fillRect(-6,-5,12,15);c.fillStyle='#bb8c70';c.fillRect(-4,-3,8,5);
    c.fillStyle='#677882';c.beginPath();c.arc(0,-8,5.5,0,TAU);c.fill();c.restore();
  }
}