import { FACILITY_TYPES, type FacilityProp, type FacilityState } from './facilities';
import type { Block } from './navigation';

const TAU = Math.PI * 2;
const MARGIN = 70;

function visible(f: Block, v: Block, pad = 0) {
  return f.x + f.w + pad > v.x && f.x - pad < v.x + v.w && f.y + f.h + pad > v.y && f.y - pad < v.y + v.h;
}

function plate(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, lift = 9) {
  c.fillStyle = '#0006'; c.fillRect(x + 5, y + 9, w, h);
  c.fillStyle = '#142029'; c.fillRect(x, y + h - 3, w, lift + 3);
  c.fillStyle = color; c.fillRect(x, y - 3, w, h);
  c.strokeStyle = '#b6d1cf33'; c.lineWidth = 1; c.strokeRect(x + 1, y - 2, w - 2, h - 2);
}

function bolts(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#bed4cf77';
  for (const [dx, dy] of [[6, 5], [w - 8, 5], [6, h - 8], [w - 8, h - 8]]) c.fillRect(x + dx, y + dy, 2, 2);
}

function hatch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = '#bea76b') {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#131d24'; c.fillRect(x, y, w, h);
  c.strokeStyle = color; c.lineWidth = 7;
  c.beginPath();
  for (let i = -h; i < w + h; i += 18) { c.moveTo(x + i, y + h); c.lineTo(x + i + h, y); }
  c.stroke(); c.restore();
}

function consoleArt(c: CanvasRenderingContext2D, p: FacilityProp) {
  const { x, y, w, h } = p;
  plate(c, x, y, w, h, '#38535d');
  c.fillStyle = '#081a23'; c.fillRect(x + 6, y + 2, w - 12, h - 16);
  const screen = c.createLinearGradient(x, y, x, y + h);
  screen.addColorStop(0, '#317b8344'); screen.addColorStop(1, '#65e2cc11'); c.fillStyle = screen; c.fillRect(x + 7, y + 3, w - 14, h - 18);
  c.strokeStyle = p.color; c.lineWidth = 1; c.beginPath();
  for (let i = 0; i < 5; i++) { const yy = y + 8 + i * 4; c.moveTo(x + 12, yy); c.lineTo(x + 12 + (w - 30) * (0.35 + i % 3 * 0.18), yy); }
  c.stroke();
  c.fillStyle = '#a4bec066';
  for (let i = 10; i < w - 12; i += 6) { c.fillRect(x + i, y + h - 11, 3.5, 2); c.fillRect(x + i, y + h - 6, 3.5, 2); }
}

function drawProp(c: CanvasRenderingContext2D, p: FacilityProp) {
  const { x, y, w, h } = p;
  const cx = x + w / 2, cy = y + h / 2;
  c.save();
  if (p.kind === 'console') { consoleArt(c, p); c.restore(); return; }
  if (p.kind === 'books') {
    plate(c, x, y, w, h, '#493f35', 17);
    c.fillStyle = '#161f24'; c.fillRect(x + 7, y + 4, w - 14, h - 12);
    const colors = ['#937b52', '#52665e', '#886451', '#657885', '#b39863', '#445956'];
    for (let yy = 7; yy < h - 16; yy += 24) {
      for (let xx = 10; xx < w - 14; xx += 10) {
        c.fillStyle = colors[(Math.floor(xx / 10) + Math.floor(yy / 24)) % colors.length];
        c.fillRect(x + xx, y + yy, 7, 18); c.fillStyle = '#d2ba7777'; c.fillRect(x + xx + 1, y + yy + 5, 5, 1);
      }
      c.fillStyle = '#988162'; c.fillRect(x + 5, y + yy + 20, w - 10, 3);
    }
    bolts(c, x, y, w, h);
  } else if (p.kind === 'pallet') {
    plate(c, x, y, w, h, '#574d3d', 11);
    for (let i = 0; i < 3; i++) {
      const xx = x + 8 + i * (w - 16) / 3;
      plate(c, xx, y + 6, (w - 24) / 3, h - 18, i % 2 ? '#475e58' : p.color, 6);
      c.strokeStyle = '#11283088'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(xx + 8, y + 8); c.lineTo(xx + 8, y + h - 14); c.stroke();
      c.fillStyle = '#c0c8b288'; c.fillRect(xx + 15, y + h * 0.5, 15, 8);
    }
    if (p.label) {
      c.fillStyle = '#e6eeda99'; c.font = '700 8px monospace'; c.textAlign = 'center';
      c.fillText(p.label.slice(0, 26), cx, y + h - 20); c.textAlign = 'left';
    }
  } else if (p.kind === 'freight') {
    // Oversized ordnance freight: timber hull, slats, steel brackets, banding straps,
    // a hazard strip along the base and a stencilled manifest.
    const vertical = h > w;
    plate(c, x, y, w, h, p.color, 12);
    c.fillStyle = '#00000026';
    const slats = Math.max(2, Math.floor((vertical ? h : w) / 46));
    for (let i = 1; i < slats; i++) {
      if (vertical) c.fillRect(x + 3, y + 4 + (i * (h - 16)) / slats, w - 6, 3);
      else c.fillRect(x + 4 + (i * (w - 16)) / slats, y + 3, 3, h - 12);
    }
    c.fillStyle = '#8b9894';
    for (const [bx, by] of [[x + 2, y + 1], [x + w - 10, y + 1], [x + 2, y + h - 9], [x + w - 10, y + h - 9]]) c.fillRect(bx, by, 8, 8);
    c.fillStyle = '#2b383d';
    if (vertical) { c.fillRect(x, y + h * 0.3, w, 5); c.fillRect(x, y + h * 0.68, w, 5); }
    else { c.fillRect(x + w * 0.3, y - 2, 5, h); c.fillRect(x + w * 0.68, y - 2, 5, h); }
    hatch(c, x + 3, y + h - 13, w - 6, 9, '#c8a24a');
    if (p.label) {
      c.fillStyle = '#e8f0dcb0'; c.font = '700 8px monospace';
      const text = p.label.length > 24 ? p.label.slice(0, 23) + '.' : p.label;
      if (vertical) {
        c.save(); c.translate(x + w / 2, y + h * 0.47); c.rotate(-Math.PI / 2);
        c.textAlign = 'center'; c.fillText(text, 0, 3); c.restore();
      } else { c.textAlign = 'center'; c.fillText(text, cx, y + h * 0.42); }
      c.textAlign = 'left';
    }
    bolts(c, x, y, w, h);
  } else if (p.kind === 'chamber') {
    plate(c, x, y, w, h, '#314b53', 16);
    c.fillStyle = '#0a2630'; c.beginPath(); c.roundRect(x + 9, y + 12, w - 18, h - 30, 23); c.fill();
    const glass = c.createLinearGradient(x, 0, x + w, 0);
    glass.addColorStop(0, '#75edc844'); glass.addColorStop(0.35, '#48a78955'); glass.addColorStop(1, '#102c3566');
    c.fillStyle = glass; c.beginPath(); c.roundRect(x + 11, y + 14, w - 22, h - 34, 22); c.fill();
    c.fillStyle = '#94d6bf44'; c.beginPath(); c.ellipse(cx, cy - 12, 11, 30, 0, 0, TAU); c.fill();
    c.fillStyle = '#7bb99e'; c.beginPath(); c.arc(cx, cy - 43, 9, 0, TAU); c.fill();
    c.strokeStyle = '#bdfff077'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 19, y + 30); c.lineTo(x + 19, y + h - 40); c.stroke();
    hatch(c, x + 3, y + h - 14, w - 6, 9, '#9cae75');
    c.fillStyle = '#b0e2d2'; c.font = '7px monospace'; c.fillText('CONTAINMENT', x + 9, y + h - 20); bolts(c, x, y, w, h);
  } else if (p.kind === 'dish') {
    plate(c, x, y, w, h, '#293748', 10);
    c.strokeStyle = '#7186aa55'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, w * 0.41, 0, TAU); c.stroke();
    c.fillStyle = '#101e28'; c.beginPath(); c.arc(cx, cy, w * 0.28, 0, TAU); c.fill();
    c.fillStyle = '#4b5c74'; c.fillRect(cx - 15, cy - 12, 30, 32);
    hatch(c, x + 3, y + h - 12, w - 6, 8); bolts(c, x, y, w, h);
  } else if (p.kind === 'transformer') {
    plate(c, x, y, w, h, '#3b4141', 13);
    for (const xx of [x + 17, x + w - 42]) {
      c.fillStyle = '#1b2830'; c.fillRect(xx, y + 21, 27, h - 43);
      c.fillStyle = '#6a7771'; for (let yy = y + 25; yy < y + h - 23; yy += 8) c.fillRect(xx - 3, yy, 33, 3);
    }
    c.fillStyle = '#bd9656'; c.fillRect(cx - 9, y + 13, 18, h - 28);
    c.fillStyle = '#152a30'; for (let yy = y + 17; yy < y + h - 17; yy += 24) { c.beginPath(); c.arc(cx, yy, 12, 0, TAU); c.fill(); }
    hatch(c, x + 3, y + h - 9, w - 6, 9); bolts(c, x, y, w, h);
  } else if (p.kind === 'lift') {
    hatch(c, x - 7, y - 4, w + 14, 8, '#b69360'); hatch(c, x - 7, y + h - 4, w + 14, 8, '#b69360');
    for (const xx of [x + 11, x + w - 26]) {
      plate(c, xx, y + 9, 15, h - 21, '#555f5e', 2);
      c.strokeStyle = '#24353d'; c.lineWidth = 1; c.beginPath(); c.moveTo(xx + 7, y + 12); c.lineTo(xx + 7, y + h - 15); c.stroke();
    }
    c.fillStyle = '#142530'; c.fillRect(cx - 31, y + 45, 62, h - 98);
    c.fillStyle = '#43616a'; c.fillRect(cx - 27, y + 40, 54, 49);
    c.fillStyle = '#6d9da955'; c.fillRect(cx - 22, y + 47, 44, 17);
    c.strokeStyle = '#75929c'; c.lineWidth = 2; c.strokeRect(cx - 23, y + 99, 46, h - 165);
    c.fillStyle = '#0b141d'; for (const yy of [y + 65, y + h - 67]) { c.fillRect(cx - 37, yy, 8, 23); c.fillRect(cx + 29, yy, 8, 23); }
    c.fillStyle = '#bfcfc1'; c.font = '9px monospace'; c.textAlign = 'center'; c.fillText('SERVICE LIFT', cx, y + h - 18);
  } else if (p.kind === 'weapons') {
    plate(c, x, y, w, h, '#3a4547', 7);
    c.fillStyle = '#111f28'; c.fillRect(x + 6, y + 3, w - 12, h - 10);
    for (let yy = y + 12; yy < y + h - 8; yy += 19) {
      c.fillStyle = '#829398'; c.fillRect(x + 14, yy, w - 34, 4);
      c.fillStyle = '#2d494e'; c.fillRect(x + 20, yy - 3, w * 0.4, 9);
      c.fillStyle = '#839a9c'; c.fillRect(x + 30, yy + 4, 6, 8); c.fillRect(x + 53, yy + 4, 9, 6);
    }
    bolts(c, x, y, w, h);
  } else if (p.kind === 'table') {
    plate(c, x, y, w, h, '#3c5056'); c.fillStyle = '#0b242d'; c.fillRect(x + 8, y + 4, w - 16, h - 13);
    c.strokeStyle = '#6ab5ac44'; c.lineWidth = 1; c.beginPath();
    for (let xx = x + 16; xx < x + w - 8; xx += 12) { c.moveTo(xx, y + 6); c.lineTo(xx, y + h - 11); }
    for (let yy = y + 10; yy < y + h - 10; yy += 10) { c.moveTo(x + 10, yy); c.lineTo(x + w - 10, yy); }
    c.stroke(); c.fillStyle = '#ddbf85'; c.fillRect(x + w * 0.65, cy, 4, 4); c.fillStyle = '#88d8be'; c.fillRect(x + w * 0.2, cy - 8, 4, 4);
  } else if (p.kind === 'tank') {
    c.fillStyle = '#0006'; c.beginPath(); c.ellipse(cx + 7, cy + 15, w / 2, h / 2, 0, 0, TAU); c.fill();
    const gradient = c.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, '#8a9383'); gradient.addColorStop(0.45, '#566555'); gradient.addColorStop(1, '#263d38');
    c.fillStyle = '#1c302d'; c.beginPath(); c.ellipse(cx, cy + 10, w / 2, h / 2, 0, 0, TAU); c.fill();
    c.fillStyle = gradient; c.beginPath(); c.ellipse(cx, cy - 3, w / 2, h / 2, 0, 0, TAU); c.fill();
    c.strokeStyle = '#afba9266'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy - 3, w / 2 - 5, h / 2 - 5, 0, 0, TAU); c.stroke();
    c.fillStyle = '#2c4140'; c.beginPath(); c.arc(cx, cy - 9, 9, 0, TAU); c.fill();
    c.strokeStyle = '#a8b499'; c.beginPath(); c.moveTo(cx - 7, cy - 9); c.lineTo(cx + 7, cy - 9); c.stroke();
  } else if (p.kind === 'bed') {
    plate(c, x, y, w, h, '#415958'); c.fillStyle = '#b4c4b1'; c.fillRect(x + 5, y + 2, w - 10, h - 14);
    c.fillStyle = '#e0e2ca'; c.fillRect(x + 8, y + 8, w - 16, 22); c.fillStyle = '#386b61'; c.fillRect(x + 6, y + 48, w - 12, h - 61);
  } else if (p.kind === 'rack') {
    // Server rack: dark cabinet, LED columns and cooling vents.
    plate(c, x, y, w, h, '#2b3d47', 10);
    c.fillStyle = '#08131a'; c.fillRect(x + 5, y + 2, w - 10, h - 12);
    for (let yy = y + 7; yy < y + h - 14; yy += 13) {
      c.fillStyle = '#16262f'; c.fillRect(x + 8, yy, w - 16, 10);
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#2f7f6d' : '#3d6f88'; c.fillRect(x + 12 + i * 7, yy + 3, 4, 3); }
      c.fillStyle = '#0f1c24'; c.fillRect(x + w - 28, yy + 2, 16, 6);
    }
    hatch(c, x + 6, y + h - 16, w - 12, 5, '#7e8f88');
    bolts(c, x, y, w, h);
  } else if (p.kind === 'cabinet') {
    // Electrical switchgear cabinet.
    plate(c, x, y, w, h, '#4a5a4e', 7);
    c.fillStyle = '#101c1a'; c.fillRect(x + 4, y + 3, w - 8, h - 12);
    hatch(c, x + 5, y + 4, w - 10, 7, '#d3b06a');
    c.strokeStyle = '#8ea79a'; c.lineWidth = 1; c.strokeRect(x + 5.5, y + 13.5, w - 11, h - 25);
    c.fillStyle = '#c8d6c0';
    for (let i = 0; i < 3; i++) c.fillRect(x + 9 + i * Math.max(8, (w - 24) / 3), y + h - 20, 5, 5);
    c.fillStyle = '#25382f'; c.fillRect(x + w / 2 - 7, y + 16, 14, Math.max(6, h - 40));
  } else if (p.kind === 'cable') {
    // Cable trench / busbar run — walkable, purely visual.
    c.fillStyle = '#121a1d'; c.fillRect(x, y, w, h);
    const horizontal = w >= h;
    const runs = Math.max(2, Math.round((horizontal ? h : w) / 9));
    c.strokeStyle = p.color; c.lineWidth = Math.max(1.5, Math.min(5, (horizontal ? h : w) / (runs * 2.2)));
    c.beginPath();
    for (let i = 0; i < runs; i++) {
      const t = 3 + i * ((horizontal ? h : w) - 6) / Math.max(1, runs - 1);
      if (horizontal) { c.moveTo(x + 2, y + t); c.lineTo(x + w - 2, y + t); }
      else { c.moveTo(x + t, y + 2); c.lineTo(x + t, y + h - 2); }
    }
    c.stroke();
    c.fillStyle = '#0008';
    if (horizontal) { c.fillRect(x, y, w, 2); c.fillRect(x, y + h - 2, w, 2); }
    else { c.fillRect(x, y, 2, h); c.fillRect(x + w - 2, y, 2, h); }
  } else if (p.kind === 'cooling') {
    // Cooling plant: radiator fins under a fan housing.
    plate(c, x, y, w, h, '#41585f', 9);
    c.fillStyle = '#15272c'; c.fillRect(x + 6, y + 4, w - 12, h - 14);
    for (let xx = x + 10; xx < x + w - 12; xx += 9) { c.fillStyle = '#5d7a80'; c.fillRect(xx, y + 8, 4, h - 22); }
    c.strokeStyle = '#9fb4b3'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.26, 0, TAU); c.stroke();
    c.strokeStyle = '#7d9496'; c.beginPath();
    c.moveTo(cx - Math.min(w, h) * 0.24, cy); c.lineTo(cx + Math.min(w, h) * 0.24, cy);
    c.moveTo(cx, cy - Math.min(w, h) * 0.24); c.lineTo(cx, cy + Math.min(w, h) * 0.24); c.stroke();
  } else if (p.kind === 'mast') {
    plate(c, x, y, w, h, '#546571', 10); c.strokeStyle = '#aeb7b8'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx, cy + 6); c.lineTo(cx, cy - 43); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 20, cy - 34); c.lineTo(cx + 20, cy - 34); c.moveTo(cx - 12, cy - 25); c.lineTo(cx + 12, cy - 25); c.stroke();
  } else {
    plate(c, x, y, w, h, '#3d5360');
    for (let yy = y + 6; yy < y + h - 10; yy += 25) {
      c.fillStyle = '#182c36'; c.fillRect(x + 5, yy, w - 10, 20); c.fillStyle = '#9caeac'; c.fillRect(x + w - 14, yy + 7, 6, 2);
      c.fillStyle = '#5a8d98'; c.fillRect(x + 9, yy + 6, 13, 2);
    }
  }
  c.restore();
}

/** Static facility artwork is cached on demand; only radar, beacons and cutaway roofs animate. */
export class FacilityPainter {
  /** Backing-store budget (~96 MB). Big yards evict small facilities instead of blowing memory. */
  private static readonly BUDGET = 24_000_000;
  private cache = new Map<string, { floor: HTMLCanvasElement; roof?: HTMLCanvasElement }>();
  private cachePixels = 0;
  reset() { this.cache.clear(); this.cachePixels = 0; }
  private pixels(img: { floor: HTMLCanvasElement; roof?: HTMLCanvasElement }) {
    return img.floor.width * img.floor.height + (img.roof ? img.roof.width * img.roof.height : 0);
  }

  private image(f: FacilityState) {
    const existing = this.cache.get(f.id);
    if (existing) return existing;
    const canvas = () => { const cv = document.createElement('canvas'); cv.width = f.w + MARGIN * 2; cv.height = f.h + MARGIN * 2; return cv; };
    const spec = FACILITY_TYPES[f.kind], floor = canvas(), c = floor.getContext('2d')!;
    c.translate(MARGIN, MARGIN);
    c.fillStyle = '#0005'; c.fillRect(-20, -17, f.w + 45, f.h + 69);
    c.fillStyle = f.kind === 'library' ? '#332e2a' : f.kind === 'laboratory' ? '#203536' : '#263139'; c.fillRect(-20, -25, f.w + 40, f.h + 65);
    c.fillStyle = f.kind === 'library' ? '#262b2c' : '#182a33'; c.fillRect(25, 24, f.w - 50, f.h - 48);
    c.strokeStyle = '#9db4b210'; c.lineWidth = 1; c.beginPath();
    for (let x = 29; x < f.w - 25; x += 40) { c.moveTo(x, 25); c.lineTo(x, f.h - 25); }
    for (let y = 28; y < f.h - 25; y += 40) { c.moveTo(25, y); c.lineTo(f.w - 25, y); } c.stroke();
    c.fillStyle = '#788d8930'; for (let i = 0; i < 170; i++) {
      const x = 28 + (i * 113 + f.x) % (f.w - 56), y = 28 + (i * 157 + f.y) % (f.h - 56);
      c.fillRect(x, y, i % 5 === 0 ? 12 : 2, 1);
    }
    // The unbroken center lane is both a navigation cue and a traversable vehicle route.
    c.fillStyle = '#0d1c2566'; c.fillRect(f.w / 2 - 105, 16, 210, f.h - 30);
    c.strokeStyle = '#d0bb814c'; c.lineWidth = 2; c.setLineDash([24, 20]); c.beginPath();
    for (const x of [f.w / 2 - 108, f.w / 2 + 108]) { c.moveTo(x, 20); c.lineTo(x, f.h - 20); }
    c.stroke(); c.setLineDash([]);
    c.fillStyle = '#c8c2a760'; c.textAlign = 'center'; c.font = 'bold 38px monospace'; c.fillText(f.kind === 'library' ? 'SSR / 1946' : spec.code, f.w / 2, f.h * 0.5 + 14);
    c.font = '8px monospace'; c.fillStyle = '#809797'; c.fillText('SERVICE LANE / KEEP CLEAR', f.w / 2, f.h * 0.5 + 31);
    for (const y of [65, f.h - 65]) {
      c.strokeStyle = '#d9c78a77'; c.lineWidth = 3; c.beginPath(); c.moveTo(f.w / 2 - 12, y + 8); c.lineTo(f.w / 2, y - 5); c.lineTo(f.w / 2 + 12, y + 8); c.stroke();
    }
    if (f.kind === 'power') {
      c.strokeStyle = '#97785e'; c.lineWidth = 6; c.beginPath(); c.moveTo(190, 45); c.lineTo(190, 275); c.lineTo(460, 275); c.lineTo(460, 45); c.stroke();
      c.strokeStyle = '#d1b38266'; c.lineWidth = 2; c.stroke();
    }
    if (f.kind === 'laboratory') {
      c.strokeStyle = '#6ac3b470'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 250); c.lineTo(f.w / 2 - 125, 250); c.moveTo(f.w / 2 + 125, 250); c.lineTo(f.w - 40, 250); c.stroke();
      c.fillStyle = '#97bcad'; c.font = '9px monospace'; c.textAlign = 'left'; c.fillText('SPECIMEN WING', 55, 234); c.fillText('ANALYSIS / LEVEL 4', f.w - 223, 234);
    }
    if (f.kind === 'checkpoint') {
      hatch(c, f.w / 2 - 130, f.h - 50, 260, 11); hatch(c, f.w / 2 - 130, 37, 260, 11);
      c.fillStyle = '#93aea0'; c.font = '9px monospace'; c.fillText('SECURITY', 92, f.h - 34);
    }
    c.save(); c.translate(-f.x, -f.y);
    for (const prop of f.props) if (!prop.destroyed) drawProp(c, prop);
    c.restore();
    c.fillStyle = '#0c1d26'; c.fillRect(27, f.h + 9, f.w - 54, 28);
    c.fillStyle = spec.color; c.textAlign = 'left'; c.font = 'bold 11px monospace'; c.fillText(`${f.code} / ${spec.name}`, 43, f.h + 28);
    c.textAlign = 'right'; c.fillStyle = '#7c9296'; c.font = '8px monospace'; c.fillText('HYDRA / RESTRICTED', f.w - 39, f.h + 27);

    let roof: HTMLCanvasElement | undefined;
    if (f.roofed && !f.ruined) {
      roof = canvas(); const r = roof.getContext('2d')!; r.translate(MARGIN, MARGIN);
      r.fillStyle = '#030c1466'; r.fillRect(18, 8, f.w, f.h + 17);
      const roofGradient = r.createLinearGradient(0, 0, f.w, f.h);
      roofGradient.addColorStop(0, spec.roof); roofGradient.addColorStop(1, '#1b2c35');
      r.fillStyle = roofGradient; r.fillRect(2, -12, f.w - 4, f.h + 6);
      r.strokeStyle = '#a0bec13c'; r.lineWidth = 2; r.strokeRect(8, -6, f.w - 16, f.h - 6);
      r.fillStyle = '#c7dcce19';
      if (f.kind === 'motorpool' || f.kind === 'warehouse') {
        for (let x = 18; x < f.w - 18; x += 22) r.fillRect(x, -4, 4, f.h - 15);
        plate(r, 50, 49, 125, 80, '#273f48', 8);
        plate(r, f.w - 175, 49, 125, 80, '#273f48', 8);
      } else if (f.kind === 'laboratory') {
        for (let y = 15; y < f.h - 20; y += 65) { r.fillStyle = '#c4e2d210'; r.fillRect(16, y, f.w - 32, 2); }
        for (const x of [56, f.w - 205]) {
          plate(r, x, 61, 150, 185, '#33565c'); r.fillStyle = '#72bbbc27'; r.fillRect(x + 9, 68, 132, 165);
          r.strokeStyle = '#accbca55'; r.lineWidth = 2; r.beginPath();
          for (let y = 83; y < 232; y += 31) { r.moveTo(x + 8, y); r.lineTo(x + 142, y); } r.stroke();
        }
      } else {
        for (let y = 18; y < f.h - 15; y += 62) {
          r.fillStyle = '#62706444'; r.fillRect(16, y, f.w - 32, 9);
          for (let x = 23; x < f.w - 30; x += 76) bolts(r, x, y, 56, 24);
        }
        hatch(r, 25, f.h - 38, f.w - 50, 8, '#a6926a');
      }
      r.textAlign = 'center'; r.fillStyle = '#aec4c37a'; r.font = 'bold 58px monospace'; r.fillText(f.code, f.w / 2, f.h * 0.46);
      r.font = '12px monospace'; r.fillStyle = spec.color; r.fillText(f.name, f.w / 2, f.h * 0.46 + 26);
      // Rooftop HVAC units and cable housings.
      for (const x of [62, f.w - 134]) {
        plate(r, x, f.h - 139, 75, 70, '#364750', 11);
        r.fillStyle = '#122731'; r.beginPath(); r.arc(x + 37, f.h - 105, 24, 0, TAU); r.fill();
        r.strokeStyle = '#74898d'; r.lineWidth = 4; r.beginPath(); r.moveTo(x + 16, f.h - 105); r.lineTo(x + 58, f.h - 105); r.moveTo(x + 37, f.h - 126); r.lineTo(x + 37, f.h - 84); r.stroke();
      }
      r.fillStyle = '#657d8577'; r.fillRect(f.w / 2 - 90, 28, 180, 4);
      r.fillStyle = '#b9787480'; r.fillRect(f.w / 2 - 14, 38, 28, 6);
    }
    const images = { floor, roof };
    const cost = this.pixels(images);
    while (this.cache.size && this.cachePixels + cost > FacilityPainter.BUDGET) {
      const oldest = this.cache.keys().next().value!;
      this.cachePixels -= this.pixels(this.cache.get(oldest)!);
      this.cache.delete(oldest);
    }
    if (this.cachePixels + cost <= FacilityPainter.BUDGET) { this.cachePixels += cost; this.cache.set(f.id, images); }
    return images;
  }

  drawGround(ctx: CanvasRenderingContext2D, facilities: FacilityState[], view: Block, time: number) {
    for (const f of facilities) {
      if (!visible(f, view, MARGIN)) continue;
      ctx.drawImage(this.image(f).floor, f.x - MARGIN, f.y - MARGIN);
      for (const p of f.props) {
        if (p.destroyed) continue;
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        if (p.kind === 'dish') {
          ctx.save(); ctx.translate(cx, cy - 24); ctx.rotate(time * 0.21 + f.x * 0.001);
          ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(8, 20, 71, 37, 0, 0, TAU); ctx.fill();
          const dish = ctx.createLinearGradient(-70, -30, 65, 30); dish.addColorStop(0, '#b0bcb6'); dish.addColorStop(0.45, '#637986'); dish.addColorStop(1, '#314c5d');
          ctx.fillStyle = dish; ctx.beginPath(); ctx.ellipse(0, 0, 73, 38, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#b9c7c866'; ctx.lineWidth = 1;
          for (let r = 10; r <= 70; r += 12) { ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.51, 0, 0, TAU); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(-72, 0); ctx.lineTo(72, 0); ctx.moveTo(0, -37); ctx.lineTo(0, 37); ctx.stroke();
          ctx.strokeStyle = '#d2d5c5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-49, -25); ctx.lineTo(20, 0); ctx.lineTo(-49, 25); ctx.stroke();
          ctx.fillStyle = '#ced5c3'; ctx.fillRect(16, -5, 13, 10);
          ctx.restore();
          ctx.save(); ctx.strokeStyle = '#95b9d633'; ctx.lineWidth = 1; ctx.setLineDash([4, 9]); ctx.beginPath(); ctx.arc(cx, cy, 118, time * 0.6, time * 0.6 + 1); ctx.stroke(); ctx.restore();
        } else if (p.kind === 'chamber') {
          const yy = p.y + 23 + (time * 13 + p.x) % (p.h - 51);
          ctx.fillStyle = '#aeffcf80'; ctx.fillRect(p.x + 15, yy, p.w - 30, 1);
        } else if (p.kind === 'transformer') {
          ctx.fillStyle = f.dark ? '#2b2f2c' : Math.sin(time * 2 + p.x) > 0 ? '#f0bc77' : '#8e734d';
          ctx.fillRect(p.x + 6, p.y + 10, 6, 5);
        } else if (p.kind === 'console') {
          ctx.fillStyle = f.dark ? '#1d2a2e' : Math.sin(time * 1.8 + p.x) > 0 ? p.color : '#34565c';
          ctx.fillRect(p.x + p.w - 16, p.y + 6, 4, 3);
        } else if (p.kind === 'rack') {
          if (f.dark) { ctx.fillStyle = '#0a1216'; ctx.fillRect(p.x + 5, p.y + 2, p.w - 10, p.h - 12); }
          else for (let i = 0; i < 5; i++) {
            const on = Math.sin(time * 3.1 + i * 1.7 + p.x * 0.05) > -0.2;
            ctx.fillStyle = on ? (i % 2 ? '#57e6c8' : '#7fd4ff') : '#1b2b33';
            ctx.fillRect(p.x + 12 + i * 7, p.y + 10, 4, 3);
          }
        } else if (p.kind === 'cabinet') {
          ctx.fillStyle = f.dark ? '#20302a' : Math.sin(time * 2.4 + p.y) > 0.4 ? '#e2c46a' : '#6d6a45';
          ctx.fillRect(p.x + 9, p.y + p.h - 20, 5, 5);
        }
      }
    }
  }

  drawRoofs(ctx: CanvasRenderingContext2D, facilities: FacilityState[], view: Block, time: number) {
    for (const f of facilities) {
      if (!visible(f, view, MARGIN)) continue;
      const spec = FACILITY_TYPES[f.kind], roof = this.image(f).roof;
      if (roof && !f.ruined && f.reveal < 0.997) {
        ctx.save(); ctx.globalAlpha = 1 - f.reveal;
        ctx.drawImage(roof, f.x - MARGIN, f.y - MARGIN - f.reveal * 22); ctx.restore();
      }
      const status = f.secured ? '#80d9b1' : f.alarm ? '#f29380' : spec.color;
      const pulse = f.alarm ? 0.65 + Math.sin(time * 5) * 0.3 : 0.85;
      for (const x of [f.x + 34, f.x + f.w - 34]) {
        ctx.fillStyle = '#15262e'; ctx.fillRect(x - 5, f.y + f.h - 33, 10, 22);
        ctx.save(); ctx.globalAlpha = pulse; ctx.fillStyle = status; ctx.fillRect(x - 4, f.y + f.h - 34, 8, 4); ctx.restore();
      }
      ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = status;
      ctx.fillText(f.secured ? 'SECURED' : f.alarm ? 'CONTACT / ALARM' : 'GARRISON ACTIVE', f.x + f.w - 28, f.y + f.h + 53);
      ctx.textAlign = 'left';
    }
  }
}