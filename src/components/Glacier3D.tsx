import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * THE GLACIER VAULT — sector 3's hidden base, in three dimensions
 *
 * A fissure in the arctic glacier wall opens into a cathedral of blue ice: an entrance
 * chamber, a great hall, a hangar bay cut into the ice with two aircraft wells, and a
 * frost bay where something with wings is waiting.
 *
 * Inside:
 *   · 20 shield troopers in winter camouflage, who fall in behind you and fight
 *   · two gunships that rise out of the ice wells and cover you from above
 *   · an ice guard battalion that very much wants you gone
 *   · the FROSTWING — a crystal interceptor
 *
 * Everything is procedural: no models, no textures, no assets. The build is one file.
 * ------------------------------------------------------------------ */

export interface GlacierStats {
  /** Ice guards killed inside. */
  kills: number;
  /** Shield troopers still standing when the operative left. */
  escorts: number;
  /** The Frostwing was taken. */
  plane: boolean;
  /** Seconds spent inside. */
  time: number;
}

interface Props {
  onExit: (stats: GlacierStats, tookPlane: boolean) => void;
}

type Phase = 'gate' | 'hall' | 'hangar' | 'frost';

interface Dialogue { channel: string; title: string; text: string }

const LINES: Record<string, Dialogue> = {
  gate: {
    channel: 'S.H.I.E.L.D. / GLACIER WATCH',
    title: 'The ice is hollow.',
    text: 'Thermal says there is a hangar inside this mountain. Somebody built a whole base where nobody could ever walk to it.',
  },
  escort: {
    channel: 'S.H.I.E.L.D. / 1ST WINTER SHIELD',
    title: 'Twenty rifles, and they are ours.',
    text: 'A shield platoon was frozen into this shelf two winters ago and left to wait. They have been waiting for someone to open the door.',
  },
  hangar: {
    channel: 'BASE INTERCOM',
    title: 'Launch the aircraft.',
    text: 'Two gunships come up out of the ice wells. They do not fire on you. They form up above you and open fire on the guards instead.',
  },
  frost: {
    channel: 'FROSTWING / AIRFRAME ONLINE',
    title: 'It is not a museum piece.',
    text: 'A crystal interceptor, cold as the wall around it, and still fuelled. Whatever this thing was built to chase, it never caught it.',
  },
  leave: {
    channel: 'S.H.I.E.L.D. / FROSTWING',
    title: 'Out through the roof of the world.',
    text: 'The Frostwing comes out of the glacier over the ice shelf, and the army below has nothing that can follow it.',
  },
};

const PLAYER_R = 22;
const HALL_MIN_Z = -300, HALL_MAX_Z = 14;
// Wide enough for two aircraft wells and a gantry, the way the brief sketches it: a cave
// with a base built inside it, not a corridor.
const HALL_HALF = 60;

interface Foe {
  mesh: THREE.Group; x: number; z: number; hp: number; maxHp: number;
  cool: number; alive: boolean; phase: number;
}
interface Escort {
  mesh: THREE.Group; x: number; z: number; hp: number; maxHp: number;
  cool: number; alive: boolean; slot: number; flash: number;
}

export default function Glacier3D({ onExit }: Props) {
  /* Escape is a real pause in here: this level runs its own simulation and the surface
   * pause screen cannot reach it. */
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const host = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState({
    hp: 100, kills: 0, foes: 0, escorts: 0, phase: 'gate' as Phase,
    prompt: '', intro: 1,
  });
  const [line, setLine] = useState<Dialogue | null>(LINES.gate);
  const [locked, setLocked] = useState(false);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const [fade, setFade] = useState(1);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    /* ---------------- renderer, camera, light ---------------- *
     * THE REFERENCE.
     *
     * This is not a lit corridor with ice-coloured walls: it is a cave that somebody built
     * a base inside. Dark blue ice, one great mouth of daylight at the far end, floodlights
     * on the catwalks, a floor of wet ice that mirrors every one of them, snow on every
     * ledge, and machinery that reads as machinery. Everything below is built to that brief
     * — and it is all procedural, one file, no assets.
     */
    const W = el.clientWidth || 1280;
    const H = el.clientHeight || 720;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(W, H);
    renderer.setClearColor(0x04090e, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Depth haze in the colour of the ice itself: the far end of the hall dissolves into it
    // the way the back of a real cave does.
    scene.fog = new THREE.FogExp2(0x12354b, 0.005);
    const camera = new THREE.PerspectiveCamera(74, W / H, 0.1, 700);

    /* ---------------- light ---------------- *
     * A cave is lit by what comes in through the hole and by what people hung on the walls.
     * Nothing here is flat: cold ambient, one strong daylight from the far mouth, and warm-
     * white floodlights doing the actual work.
     */
    scene.add(new THREE.AmbientLight(0x3d7196, 1.15));
    scene.add(new THREE.HemisphereLight(0x9fd6f2, 0x12222c, 1.05));
    const dayLight = new THREE.DirectionalLight(0xd8f1ff, 2.1);
    dayLight.position.set(-70, 120, -420);
    scene.add(dayLight);
    const gateLight = new THREE.DirectionalLight(0xa8d8ee, 0.8);
    gateLight.position.set(20, 60, 220);
    scene.add(gateLight);

    /* ---------------- textures (all drawn here) ---------------- */
    const canvasOf = (w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return { c, g: c.getContext('2d')! };
    };
    const asTex = (c: HTMLCanvasElement, repeat = 1, srgb = true) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };

    /** Wet ice on the floor: dark slab with pale fracture lines and puddles of meltwater. */
    const floorTexture = () => {
      const { c, g } = canvasOf(512, 512);
      g.fillStyle = '#1d4053';
      g.fillRect(0, 0, 512, 512);
      // broad slabs, so the floor is a paved surface and not a void
      g.strokeStyle = 'rgba(150,200,225,0.16)';
      g.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        g.beginPath(); g.moveTo(0, (i * 512) / 4); g.lineTo(512, (i * 512) / 4); g.stroke();
        g.beginPath(); g.moveTo((i * 512) / 4, 0); g.lineTo((i * 512) / 4, 512); g.stroke();
      }
      for (let i = 0; i < 420; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 6 + Math.random() * 60;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        const pale = Math.random() > 0.55;
        grd.addColorStop(0, pale ? 'rgba(176,222,244,0.16)' : 'rgba(6,18,26,0.30)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `rgba(160,214,240,${0.04 + Math.random() * 0.10})`;
        g.lineWidth = 0.7 + Math.random();
        g.beginPath();
        let x = Math.random() * 512, y = Math.random() * 512;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (Math.random() - 0.5) * 150; y += (Math.random() - 0.5) * 150;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      return asTex(c, 14);
    };

    /** Roughness mask: meltwater is glass, frozen slab is not. Wet ice needs both. */
    const puddleMask = () => {
      const { c, g } = canvasOf(256, 256);
      g.fillStyle = '#9a9a9a';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 54;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(12,12,12,0.9)');
        grd.addColorStop(1, 'rgba(12,12,12,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      return asTex(c, 9, false);
    };

    /** A soft round glow, used for every lamp bloom and every pool of light. */
    const glowTexture = () => {
      const { c, g } = canvasOf(128, 128);
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, 'rgba(210,244,255,0.75)');
      grd.addColorStop(0.55, 'rgba(130,205,240,0.24)');
      grd.addColorStop(1, 'rgba(90,170,220,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      return asTex(c, 1);
    };

    /** The mouth of the cave: white at the centre, blue as it bleeds into the ice. */
    const daylightTexture = () => {
      const { c, g } = canvasOf(256, 256);
      const grd = g.createRadialGradient(128, 120, 8, 128, 128, 150);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.35, '#e2f6ff');
      grd.addColorStop(0.7, '#9fd2e8');
      grd.addColorStop(1, 'rgba(60,120,150,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
      return asTex(c, 1);
    };

    /** Vertical falloff for the shafts of light coming down through the roof. */
    const shaftTexture = () => {
      const { c, g } = canvasOf(64, 256);
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, 'rgba(220,246,255,0.85)');
      grd.addColorStop(0.45, 'rgba(170,220,245,0.30)');
      grd.addColorStop(1, 'rgba(120,190,225,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 256);
      return asTex(c, 1);
    };

    /** Shipping crates and equipment cases: panels, rivets, stencilled serials. */
    const crateTexture = (label: string, body: string, ink: string) => {
      const { c, g } = canvasOf(256, 256);
      g.fillStyle = body;
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(0,0,0,0.42)';
      g.lineWidth = 3;
      for (let i = 1; i < 5; i++) {
        g.beginPath(); g.moveTo(0, i * 51); g.lineTo(256, i * 51); g.stroke();
      }
      g.strokeRect(7, 7, 242, 242);
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = 1.5;
      g.strokeRect(15, 15, 226, 226);
      g.fillStyle = ink;
      g.font = 'bold 20px ui-monospace, monospace';
      g.fillText(label, 20, 44);
      g.font = '13px ui-monospace, monospace';
      g.fillText('CRYO DIV / 07', 20, 66);
      g.globalAlpha = 0.5;
      for (let i = 0; i < 40; i++) {
        g.fillStyle = i % 2 ? '#0a151c' : '#8fb4c4';
        g.fillRect(18 + Math.random() * 220, 90 + Math.random() * 150, 5 + Math.random() * 10, 3);
      }
      g.globalAlpha = 1;
      // frost creeping up from the bottom edge
      const frost = g.createLinearGradient(0, 256, 0, 150);
      frost.addColorStop(0, 'rgba(226,244,252,0.42)');
      frost.addColorStop(1, 'rgba(226,244,252,0)');
      g.fillStyle = frost;
      g.fillRect(0, 0, 256, 256);
      return asTex(c, 1);
    };

    /** A hanging banner: S.H.I.E.L.D. shield on the vault walls, HYDRA on the guard side. */
    const bannerTexture = (kind: 'shield' | 'hydra') => {
      const { c, g } = canvasOf(256, 384);
      g.fillStyle = kind === 'shield' ? '#0d2330' : '#1a0d12';
      g.fillRect(0, 0, 256, 384);
      const wash = g.createLinearGradient(0, 0, 0, 384);
      wash.addColorStop(0, 'rgba(255,255,255,0.06)');
      wash.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = wash;
      g.fillRect(0, 0, 256, 384);
      g.strokeStyle = kind === 'shield' ? 'rgba(150,220,245,0.55)' : 'rgba(220,80,90,0.55)';
      g.lineWidth = 4;
      g.strokeRect(14, 14, 228, 356);
      g.save();
      g.translate(128, 150);
      if (kind === 'shield') {
        g.fillStyle = 'rgba(206,240,255,0.92)';
        g.beginPath();
        g.moveTo(0, -78);
        g.lineTo(64, -56);
        g.lineTo(64, 18);
        g.quadraticCurveTo(64, 62, 0, 84);
        g.quadraticCurveTo(-64, 62, -64, 18);
        g.lineTo(-64, -56);
        g.closePath();
        g.fill();
        g.fillStyle = '#0d2330';
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
          const r = i % 2 ? 30 : 46;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
      } else {
        g.strokeStyle = 'rgba(226,90,96,0.95)';
        g.lineWidth = 7;
        g.beginPath(); g.arc(0, -26, 34, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 6; i++) {
          const a = -0.6 + (i / 5) * 1.2;
          g.beginPath();
          g.moveTo(Math.sin(a) * 18, 4);
          g.quadraticCurveTo(Math.sin(a) * 40, 40, Math.sin(a) * 26, 74);
          g.stroke();
        }
        g.fillStyle = 'rgba(226,90,96,0.95)';
        g.beginPath(); g.arc(-10, -30, 6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(10, -30, 6, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      g.fillStyle = kind === 'shield' ? 'rgba(200,232,248,0.8)' : 'rgba(230,110,116,0.8)';
      g.font = 'bold 26px ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText(kind === 'shield' ? 'S.H.I.E.L.D.' : 'HYDRA', 128, 300);
      g.font = '15px ui-monospace, monospace';
      g.fillText('CRYO VAULT', 128, 326);
      g.textAlign = 'left';
      const t = asTex(c, 1);
      return t;
    };

    /** Yellow-and-black hazard paint for the aircraft aprons. */
    const hazardTexture = () => {
      const { c, g } = canvasOf(256, 256);
      g.fillStyle = '#11181d';
      g.fillRect(0, 0, 256, 256);
      g.save();
      g.translate(128, 128);
      g.rotate(-Math.PI / 4);
      for (let i = -12; i < 12; i++) {
        g.fillStyle = i % 2 ? '#d8b23c' : '#181c1f';
        g.fillRect(i * 26, -220, 13, 440);
      }
      g.restore();
      return asTex(c, 3);
    };

    /** Winter camouflage for the airframes: pale grey-blue blotches over dark steel. */
    const camoTexture = () => {
      const { c, g } = canvasOf(256, 256);
      g.fillStyle = '#2b3944';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 40;
        g.fillStyle = Math.random() > 0.5 ? 'rgba(120,142,156,0.55)' : 'rgba(190,210,222,0.35)';
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          g.lineTo(x + Math.cos(a) * r * (0.6 + Math.random() * 0.7), y + Math.sin(a) * r * (0.6 + Math.random() * 0.7));
        }
        g.closePath();
        g.fill();
      }
      const grime = g.createLinearGradient(0, 0, 0, 256);
      grime.addColorStop(0, 'rgba(228,242,250,0.22)');
      grime.addColorStop(0.5, 'rgba(0,0,0,0)');
      grime.addColorStop(1, 'rgba(0,0,0,0.4)');
      g.fillStyle = grime;
      g.fillRect(0, 0, 256, 256);
      return asTex(c, 1);
    };

    /** Winter camouflage cloth: white ground, pale grey-blue blotches, frost speckle. */
    const snowCamoTexture = () => {
      const { c, g } = canvasOf(256, 256);
      g.fillStyle = '#dbe7ee';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 8 + Math.random() * 30;
        g.fillStyle = Math.random() > 0.45 ? 'rgba(150,176,192,0.55)' : 'rgba(96,124,142,0.42)';
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          g.lineTo(x + Math.cos(a) * r * (0.5 + Math.random() * 0.8), y + Math.sin(a) * r * (0.5 + Math.random() * 0.8));
        }
        g.closePath();
        g.fill();
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(74,98,114,0.35)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      return asTex(c, 2);
    };

    const floorTex = floorTexture();
    const snowCamoTex = snowCamoTexture();
    const puddleTex = puddleMask();
    const glowTex = glowTexture();
    const dayTex = daylightTexture();
    const shaftTex = shaftTexture();
    const hazardTex = hazardTexture();
    const camoTex = camoTexture();
    const crateTexH = crateTexture('HYDRA', '#22303a', 'rgba(220,120,110,0.75)');
    const crateTexS = crateTexture('S.H.I.E.L.D.', '#20323c', 'rgba(170,225,245,0.75)');

    /* ---------------- materials ---------------- */
    const rockMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.78, metalness: 0.05, flatShading: true,
      emissive: 0x0a2233, emissiveIntensity: 0.55,
    });
    const iceGlassMat = new THREE.MeshStandardMaterial({
      color: 0x9fd6ea, roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.7,
      emissive: 0x2f6f8c, emissiveIntensity: 0.5, flatShading: true, side: THREE.DoubleSide,
    });
    /* Wet ice. Metalness has to stay low: there is no environment map in here, so a metallic
     * floor would go black — the wet look comes from the low roughness plus the light pools. */
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex, roughnessMap: puddleTex, color: 0xe9f4fa, roughness: 0.38, metalness: 0.18,
      emissive: 0x1b4358, emissiveIntensity: 0.5,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x39434b, roughness: 0.62, metalness: 0.78 });
    const steelDark = new THREE.MeshStandardMaterial({ color: 0x161d23, roughness: 0.7, metalness: 0.62 });
    const steelPale = new THREE.MeshStandardMaterial({ color: 0x6f7f8a, roughness: 0.48, metalness: 0.72 });
    const paintMat = new THREE.MeshStandardMaterial({ color: 0x1d3a48, roughness: 0.55, metalness: 0.35 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xe8fbff, emissive: 0x8fe8ff, emissiveIntensity: 2.6, roughness: 0.22,
    });
    const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.7, metalness: 0.15 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xe6f4fb, roughness: 0.85, emissive: 0x0e2634, emissiveIntensity: 0.4 });
    const hullMat = new THREE.MeshStandardMaterial({ map: camoTex, color: 0x71858f, roughness: 0.55, metalness: 0.4 });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0f2b38, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.82,
      emissive: 0x1d5d75, emissiveIntensity: 0.35,
    });

    /* ---------------- geometry helpers ---------------- */
    const smoothstep = (t: number) => t * t * (3 - 2 * t);
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const noise2 = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
    };

    /**
     * Turn a flat panel into ice.
     *
     * Displaces every vertex along its normal with two octaves of value noise and paints it
     * by height and depth — snow on the ledges, deep blue in the cracks. Flat shading does
     * the rest: it is the faceted, broken look a real glacier wall has.
     */
    const rockify = (geo: THREE.BufferGeometry, amp: number, freq: number, seed = 0, tint = 0x3a7593) => {
      geo.computeVertexNormals();
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const base = new THREE.Color(tint);
      const deep = new THREE.Color(0x0b1f2c);
      const snowy = new THREE.Color(0xd6ecf7);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const n1 = noise2(x * freq + seed, y * freq * 1.3 + seed * 0.7) - 0.5;
        const n2 = noise2(x * freq * 2.9 + 11 + seed, z * freq * 2.4) - 0.5;
        const off = (n1 * 1.6 + n2 * 0.7) * amp;
        pos.setXYZ(
          i,
          x + nrm.getX(i) * off,
          y + nrm.getY(i) * off,
          z + nrm.getZ(i) * off,
        );
        const ledge = Math.max(0, nrm.getY(i));
        const c = base.clone()
          .lerp(deep, Math.min(1, Math.max(0, 0.5 - n1)))
          .lerp(snowy, Math.min(0.9, ledge * 0.9 + Math.max(0, n1) * 0.55));
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    };

    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    /** One shared unit cube, scaled per plate: dozens of parts, one geometry. */
    const plate = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(unitBox, mat);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    const glowSprite = (x: number, y: number, z: number, size: number, colour: number, opacity = 0.9) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: colour, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.position.set(x, y, z);
      s.scale.set(size, size, 1);
      scene.add(s);
      return s;
    };

    /* ---------------- the cave shell ---------------- */
    const HALL_LEN = HALL_MAX_Z - HALL_MIN_Z;
    const HALL_MID_Z = (HALL_MAX_Z + HALL_MIN_Z) / 2;

    // floor: wet ice, dark, mirror-bright where the puddles are
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALF * 2, HALL_LEN, 24, 48), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, HALL_MID_Z);
    floor.name = 'floor';
    scene.add(floor);

    // the two side walls: 40 units of broken blue ice each
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        rockify(new THREE.PlaneGeometry(HALL_LEN, 46, 72, 18), 4.2, 0.055, side * 13),
        rockMat,
      );
      wall.position.set(side * HALL_HALF, 21, HALL_MID_Z);
      wall.rotation.y = side * -Math.PI / 2;
      wall.name = side < 0 ? 'wall-west' : 'wall-east';
      scene.add(wall);
    }

    /* the roof: a vault, sprung from the wall tops to a broken ridge.
     *
     * A cylinder sliced in half is the honest shape for a cave roof — the arch is baked
     * into the geometry, then displaced, so it reads as ice and not as a pipe. */
    const vaultGeo = new THREE.CylinderGeometry(1, 1, HALL_LEN, 46, 32, true, -Math.PI / 2, Math.PI);
    vaultGeo.rotateX(-Math.PI / 2);
    vaultGeo.scale(HALL_HALF * 1.02, 23, 1);
    // The inside of the arch is what the operative sees, so the faces are turned inwards:
    // otherwise every surface reads as an outer ledge and the whole roof snows over.
    const vaultIndex = vaultGeo.getIndex();
    if (vaultIndex) {
      const arr = vaultIndex.array as Uint16Array | Uint32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = t;
      }
      vaultIndex.needsUpdate = true;
    }
    rockify(vaultGeo, 2.2, 0.05, 17);
    // and darker towards the apex: the arch above the lamps is in shadow, which is what
    // keeps the roof from reading as one pale shell
    {
      const pos = vaultGeo.getAttribute('position');
      const colAttr = vaultGeo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const fade = 1 - Math.min(0.52, Math.max(0, (y - 7) / 20) * 0.62);
        colAttr.setXYZ(i, colAttr.getX(i) * fade, colAttr.getY(i) * fade, colAttr.getZ(i) * fade);
      }
      colAttr.needsUpdate = true;
    }
    const vaultMat = rockMat.clone();
    vaultMat.side = THREE.DoubleSide;
    const vault = new THREE.Mesh(vaultGeo, vaultMat);
    vault.position.set(0, 11, HALL_MID_Z);
    vault.name = 'vault';
    scene.add(vault);

    /* ---------------- the mouth of the cave ----------------
     * Read from the hall it has to look like an opening in rock with weather behind it, so the
     * daylight sits at the end of a short tunnel of ice, ringed with broken boulders. A flat
     * bright plane hung on the end wall reads as a lit doorway, and that is not the picture. */
    const MOUTH_Z = HALL_MIN_Z - 30;
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(76, 48),
      new THREE.MeshBasicMaterial({ map: dayTex, transparent: true, opacity: 0.98, depthWrite: false, fog: false }),
    );
    mouth.position.set(0, 18, MOUTH_Z);
    mouth.name = 'cave-mouth';
    scene.add(mouth);
    const mouthCore = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 30),
      new THREE.MeshBasicMaterial({ map: dayTex, transparent: true, opacity: 0.95, depthWrite: false, fog: false }),
    );
    mouthCore.position.set(0, 16, MOUTH_Z + 1);
    mouthCore.name = 'cave-mouth-core';
    scene.add(mouthCore);
    glowSprite(0, 17, MOUTH_Z + 4, 150, 0xdcf4ff, 0.55);
    glowSprite(0, 10, MOUTH_Z + 6, 80, 0xffffff, 0.3);
    // the tunnel: dark ice either side of the light, and a ramp coming down to the hall
    const tunnelMat = rockMat.clone();
    tunnelMat.emissive = new THREE.Color(0x071c28);
    tunnelMat.emissiveIntensity = 0.35;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        rockify(new THREE.PlaneGeometry(38, 34, 14, 12), 3.2, 0.12, side * 91, 0x2a5f7c),
        tunnelMat,
      );
      wall.position.set(side * 22, 15, HALL_MIN_Z - 14);
      wall.rotation.y = side * -Math.PI / 2;
      scene.add(wall);
      // ice shoulders flanking the approach, pushed back so the silhouette reads
      const shoulder = new THREE.Mesh(
        rockify(new THREE.PlaneGeometry(44, 42, 16, 14), 5, 0.09, side * 41),
        rockMat,
      );
      shoulder.position.set(side * (HALL_HALF - 6), 20, HALL_MIN_Z + 3);
      scene.add(shoulder);
    }
    const roofOver = new THREE.Mesh(
      rockify(new THREE.PlaneGeometry(HALL_HALF * 1.5, 26, 22, 10), 4.5, 0.1, 63),
      tunnelMat,
    );
    roofOver.rotation.x = Math.PI / 2;
    roofOver.position.set(0, 22, HALL_MIN_Z - 12);
    scene.add(roofOver);
    const brow = new THREE.Mesh(
      rockify(new THREE.PlaneGeometry(HALL_HALF * 1.3, 16, 24, 8), 4, 0.1, 63),
      rockMat,
    );
    brow.position.set(0, 33, HALL_MIN_Z + 1);
    scene.add(brow);
    // broken ice ringing the opening, so nothing ends on a straight edge
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const rx = Math.cos(a) * (34 + Math.random() * 9);
      const ry = 15 + Math.sin(a) * (17 + Math.random() * 6);
      if (Math.sin(a) < -0.6) continue;
      const chunk = new THREE.Mesh(
        rockify(new THREE.IcosahedronGeometry(3.4 + Math.random() * 2.6, 0), 1.4, 0.3, i * 7),
        rockMat,
      );
      chunk.position.set(rx, Math.max(2, ry), HALL_MIN_Z - 6 - Math.random() * 8);
      chunk.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      scene.add(chunk);
    }
    // the light it spills down the last stretch of floor
    const mouthSpill = new THREE.Mesh(
      new THREE.PlaneGeometry(66, 130),
      new THREE.MeshBasicMaterial({
        map: glowTex, color: 0xc9ecff, transparent: true, opacity: 0.20,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }),
    );
    mouthSpill.rotation.x = -Math.PI / 2;
    mouthSpill.position.set(0, 0.07, HALL_MIN_Z + 58);
    scene.add(mouthSpill);

    // the gate end: the way in, and the way the Frostwing goes out
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        rockify(new THREE.PlaneGeometry(HALL_HALF - 15, 40, 18, 14), 3.4, 0.08, side * 51),
        rockMat,
      );
      shoulder.position.set(side * (HALL_HALF / 2 + 7.5), 20, HALL_MAX_Z);
      shoulder.rotation.y = Math.PI;
      scene.add(shoulder);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(30, 17, 4), rockMat);
    rockify(lintel.geometry as THREE.BufferGeometry, 1.4, 0.16, 71);
    lintel.position.set(0, 27.5, HALL_MAX_Z);
    scene.add(lintel);
    // daylight beyond the gate: the ice shelf outside, the brightest thing in the room
    const daylight = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 19),
      new THREE.MeshBasicMaterial({ color: 0xe6f8ff, fog: false }),
    );
    daylight.position.set(0, 9.5, HALL_MAX_Z - 3);
    daylight.rotation.y = Math.PI;
    scene.add(daylight);
    const gateSeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 19, 0.6), glowMat);
    gateSeam.position.set(0, 9.5, HALL_MAX_Z - 2);
    scene.add(gateSeam);
    const gateLeaves: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(15.6, 19, 2.2), paintMat);
      leaf.position.set(side * 7.8, 9.5, HALL_MAX_Z - 1.4);
      scene.add(leaf);
      gateLeaves.push(leaf);
    }

    /* ---------------- shafts of daylight through the roof ---------------- */
    const shafts: THREE.Mesh[] = [];
    for (const [sx, sz, rad] of [[-18, -84, 7], [22, -158, 9], [-6, -232, 11]] as const) {
      const geo = new THREE.CylinderGeometry(rad * 0.42, rad, 30, 14, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        map: shaftTex, color: 0xbfe9ff, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const shaft = new THREE.Mesh(geo, mat);
      shaft.position.set(sx, 15, sz);
      shaft.rotation.z = 0.14;
      scene.add(shaft);
      shafts.push(shaft);
      glowSprite(sx, 30, sz, 26, 0xd8f2ff, 0.35);
      // the pool it throws on the ice
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(rad * 1.5, 26),
        new THREE.MeshBasicMaterial({
          map: glowTex, color: 0xa8e2ff, transparent: true, opacity: 0.20,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(sx, 0.05, sz);
      scene.add(pool);
    }

    /* ---------------- hanging ice ---------------- */
    const icicleGeo = new THREE.ConeGeometry(0.62, 6, 6);
    const icicles = new THREE.InstancedMesh(icicleGeo, iceGlassMat, 190);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 190; i++) {
      const x = (Math.random() - 0.5) * HALL_HALF * 1.9;
      const z = HALL_MAX_Z - Math.random() * HALL_LEN;
      const roof = 11 + 23 * Math.sqrt(Math.max(0.04, 1 - (x / (HALL_HALF * 1.02)) ** 2));
      dummy.position.set(x, roof - 1.2, z);
      dummy.rotation.set(Math.PI + (Math.random() - 0.5) * 0.2, Math.random() * 3, (Math.random() - 0.5) * 0.2);
      dummy.scale.set(0.5 + Math.random() * 1.4, 0.4 + Math.random() * 1.7, 0.5 + Math.random() * 1.4);
      dummy.updateMatrix();
      icicles.setMatrixAt(i, dummy.matrix);
    }
    icicles.instanceMatrix.needsUpdate = true;
    scene.add(icicles);

    // ice columns down both sides of the hall, with crystal growth at their feet
    const pillarGeo = new THREE.CylinderGeometry(2.2, 3.4, 30, 7, 3);
    rockify(pillarGeo, 1.5, 0.3, 5, 0x3d7693);
    const crystalGeo = new THREE.ConeGeometry(1.9, 8, 5);
    const crystals = new THREE.InstancedMesh(crystalGeo, iceGlassMat, 84);
    let crystalIndex = 0;
    const pillars: { x: number; z: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const z = -8 - i * 21;
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(pillarGeo, rockMat);
        p.position.set(side * (HALL_HALF - 13), 14, z);
        p.rotation.y = i * 0.7;
        p.scale.set(1, 0.8 + (i % 3) * 0.11, 1);
        scene.add(p);
        pillars.push({ x: side * (HALL_HALF - 13), z });
        for (let k = 0; k < 3; k++) {
          dummy.position.set(side * (HALL_HALF - 19 - k * 3.5), 1.8 + k * 1.2, z + 6 - k * 5);
          dummy.rotation.set(0, Math.random() * 3, (Math.random() - 0.5) * 0.6);
          dummy.scale.setScalar(0.45 + Math.random() * 0.75);
          dummy.updateMatrix();
          crystals.setMatrixAt(crystalIndex++, dummy.matrix);
        }
      }
    }

    crystals.count = crystalIndex;
    crystals.instanceMatrix.needsUpdate = true;
    scene.add(crystals);

    // rubble and snow banks along the walls
    const rubbleGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const rubble = new THREE.InstancedMesh(rubbleGeo, rockMat, 120);
    for (let i = 0; i < 120; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      dummy.position.set(
        side * (HALL_HALF - 3 - Math.random() * 10),
        0.2 + Math.random() * 0.6,
        HALL_MAX_Z - Math.random() * HALL_LEN,
      );
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      dummy.scale.setScalar(0.5 + Math.random() * 2.4);
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.instanceMatrix.needsUpdate = true;
    scene.add(rubble);

    // drifts piled against the walls, snow-white, catching the floodlights
    for (let i = 0; i < 14; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), snowMat);
      drift.position.set(side * (HALL_HALF - 4 - Math.random() * 5), -0.55, HALL_MAX_Z - Math.random() * HALL_LEN);
      drift.scale.set(6 + Math.random() * 9, 0.34 + Math.random() * 0.3, 8 + Math.random() * 12);
      scene.add(drift);
    }

    /* ---------------- the hangar built into the cave ---------------- */
    const gantryX = HALL_HALF - 11;
    // catwalk decks
    for (const side of [-1, 1]) {
      plate(9, 0.5, HALL_LEN * 0.78, steelMat, side * gantryX, 11.4, HALL_MID_Z - 18);
      plate(9.6, 0.18, HALL_LEN * 0.78, steelDark, side * gantryX, 11.1, HALL_MID_Z - 18);
      // toe board, two rails and the posts between them
      plate(0.3, 0.7, HALL_LEN * 0.78, hazardMat, side * (gantryX - 5.2), 11.9, HALL_MID_Z - 18);
      for (let i = 0; i <= 13; i++) {
        const z = HALL_MAX_Z - 20 - i * 21;
        plate(0.28, 1.9, 0.28, steelPale, side * (gantryX - 5.1), 12.4, z);
        plate(0.5, 1.1, 0.5, steelMat, side * gantryX, 5.6, z);
        if (i % 2 === 0) plate(0.22, 0.22, 21, steelPale, side * (gantryX - 5.1), 13.3, z - 10.5);
      }
      plate(0.26, 0.26, HALL_LEN * 0.78, steelPale, side * (gantryX - 5.1), 12.2, HALL_MID_Z - 18);
      // stairs down to the floor
      for (let s = 0; s < 14; s++) {
        plate(7, 0.22, 1.1, steelMat, side * (gantryX - 3), 0.5 + s * 0.78, -34 + s * 1.15);
      }
    }

    for (const side of [-1, 1]) {
      plate(1.4, 0.7, HALL_LEN * 0.74, steelDark, side * (gantryX - 5.6), 10.2, HALL_MID_Z - 18);
      for (let i = 0; i < 9; i++) {
        plate(0.9, 0.5, 0.9, steelMat, side * (gantryX - 5.6), 9.4, HALL_MAX_Z - 40 - i * 34);
      }
    }

    // floodlights on the catwalks: housing, lens bloom, a cone of light and the smear it
    // leaves on wet ice
    const lampPosts: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const z = HALL_MAX_Z - 30 - i * 48;
      for (const side of [-1, 1]) {
        const x = side * (gantryX - 4.6);
        plate(1.5, 0.9, 1.1, steelDark, x, 14.6, z);
        plate(1.1, 0.16, 0.8, glowMat, x, 14.15, z);
        const bloom = glowSprite(x, 14.1, z, 9, 0xbfeaff, 0.85);
        bloom.userData.base = 0.85;
        glowSprite(x, 14.2, z, 3.4, 0xffffff, 0.95);
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 7.2, 13, 14, 1, true),
          new THREE.MeshBasicMaterial({
            map: shaftTex, color: 0xa8ddf5, transparent: true, opacity: 0.085,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
          }),
        );
        cone.position.set(x - side * 1.6, 8, z);
        cone.rotation.z = side * 0.12;
        scene.add(cone);
        // pool + vertical smear: what a floodlight does to a wet floor
        const pool = new THREE.Mesh(
          new THREE.CircleGeometry(6.5, 22),
          new THREE.MeshBasicMaterial({
            map: glowTex, color: 0x9ddcf5, transparent: true, opacity: 0.20,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(x - side * 2.2, 0.04, z);
        scene.add(pool);
        const smear = new THREE.Mesh(
          new THREE.PlaneGeometry(3.2, 13),
          new THREE.MeshBasicMaterial({
            map: shaftTex, color: 0x9bdcf7, transparent: true, opacity: 0.13,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        smear.rotation.x = -Math.PI / 2;
        smear.rotation.z = Math.PI / 2;
        smear.position.set(x - side * 3.4, 0.06, z - 5);
        scene.add(smear);
        // Only every other fixture carries a real light; the rest carry bloom and a pool.
        // Forward rendering has a light budget and the room reads the same with nine.
        if (i % 3 === 1) {
          const pl = new THREE.PointLight(0xa8e0ff, 170, 74, 2);
          pl.position.set(x - side * 3, 13.4, z);
          scene.add(pl);
          lampPosts.push(new THREE.Vector3(x - side * 3, 13.4, z));
        }
      }
    }
    // two more floods over the gate approach, so the entry reads as lit as the rest
    for (const side of [-1, 1]) {
      plate(1.4, 0.8, 1, steelDark, side * 19, 13.8, 4);
      plate(1, 0.14, 0.7, glowMat, side * 19, 13.4, 4);
      glowSprite(side * 19, 13.4, 4, 8, 0xbfeaff, 0.8);
      if (side > 0) {
        // one lamp over the approach is enough: two more would put us over the light budget
        const pl = new THREE.PointLight(0xa8e0ff, 330, 90, 2);
        pl.position.set(0, 13, 4);
        scene.add(pl);
      }
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(7.5, 22),
        new THREE.MeshBasicMaterial({
          map: glowTex, color: 0x9ddcf5, transparent: true, opacity: 0.22,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(side * 17, 0.04, 3);
      scene.add(pool);
    }

    // a few lights up under the ridge, so the roof is not a black ceiling
    for (let i = 0; i < 2; i++) {
      const z = HALL_MAX_Z - 70 - i * 120;
      const lamp = plate(3.4, 0.5, 1.2, steelDark, 0, 31.6, z);
      plate(3, 0.2, 0.9, glowMat, 0, 31.3, z);
      glowSprite(0, 31.2, z, 16, 0xbfeaff, 0.5);
      const pl = new THREE.PointLight(0xbfeaff, 230, 130, 2);
      pl.position.set(0, 29, z);
      scene.add(pl);
      // the cable it hangs from
      plate(0.1, 6, 0.1, steelDark, lamp.position.x, 34, z);
    }

    // banners: the division's colours, stiff with frost, hanging off the catwalk
    const banners: THREE.Mesh[] = [];
    for (const [side, zone, kind] of [[1, -70, 'shield'], [-1, -120, 'hydra'], [1, -186, 'shield'], [-1, -232, 'hydra']] as const) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 9.6),
        new THREE.MeshStandardMaterial({
          map: bannerTexture(kind), roughness: 0.85, metalness: 0.05,
          side: THREE.DoubleSide, emissive: 0x0a1c26, emissiveIntensity: 0.5,
        }),
      );
      banner.position.set(side * (gantryX - 6.4), 17.4, zone);
      banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      banner.userData.base = banner.position.x;
      scene.add(banner);
      banners.push(banner);
      // the rod it hangs from
      plate(0.16, 0.16, 7.4, steelPale, side * (gantryX - 6.4), 22.3, zone);
    }

    // equipment crates and containers, stacked under the catwalks
    const crateMats = [
      new THREE.MeshStandardMaterial({ map: crateTexH, roughness: 0.7, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: crateTexS, roughness: 0.7, metalness: 0.3 }),
    ];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const z = HALL_MAX_Z - 34 - Math.random() * (HALL_LEN - 80);
      const w = 5 + Math.random() * 7, d = 4 + Math.random() * 6, h = 2.4 + Math.random() * 1.6;
      const mat = crateMats[i % 3 === 0 ? 1 : 0];
      const crate = new THREE.Mesh(unitBox, mat);
      crate.scale.set(w, h, d);
      crate.position.set(side * (HALL_HALF - 16 - Math.random() * 6), h / 2, z);
      crate.rotation.y = (Math.random() - 0.5) * 0.25;
      scene.add(crate);
      if (Math.random() > 0.55) {
        const second = new THREE.Mesh(unitBox, mat);
        second.scale.set(w * 0.72, h * 0.8, d * 0.78);
        second.position.set(crate.position.x + (Math.random() - 0.5) * 1.4, h + h * 0.4, z + (Math.random() - 0.5) * 1.2);
        second.rotation.y = crate.rotation.y + (Math.random() - 0.5) * 0.3;
        scene.add(second);
      }
    }

    /* kit stacks and light strips down the gate end: the clutter the camera walks past */
    for (const [sx, sz, rot] of [[-19, 2, 0.2], [-21, -7, -0.15], [20, 1, 0.1], [22, -9, 0.25], [-24, -18, 0.05], [17, -20, -0.2]] as const) {
      const w = 4.2 + Math.random() * 2.6, h = 2 + Math.random() * 0.9, d = 3 + Math.random() * 1.6;
      const box = new THREE.Mesh(unitBox, crateMats[Math.random() > 0.5 ? 1 : 0]);
      box.scale.set(w, h, d);
      box.position.set(sx, h / 2, sz);
      box.rotation.y = rot;
      scene.add(box);
      // a light strip along the front edge, the way the reference crates are marked
      plate(w * 0.78, 0.16, 0.12, glowMat, sx + Math.sin(rot) * -(d / 2), h * 0.72, sz - d / 2 - 0.06);
      const cap = new THREE.Mesh(unitBox, snowMat);
      cap.scale.set(w * 1.02, 0.14, d * 1.02);
      cap.position.set(sx, h + 0.06, sz);
      cap.rotation.y = rot;
      scene.add(cap);
      // and a case on top of some of them
      if (Math.random() > 0.45) {
        const top = new THREE.Mesh(unitBox, crateMats[0]);
        top.scale.set(w * 0.6, h * 0.62, d * 0.66);
        top.position.set(sx + 0.4, h + 0.2 + h * 0.31, sz - 0.3);
        top.rotation.y = rot - 0.12;
        scene.add(top);
      }
    }

    /* the launch rail: a lit centreline from the frost bay to the gate — pale steel, because a
     * dark strip down the middle of the floor reads as a hole in it */
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8fa6b4, roughness: 0.42, metalness: 0.3 });
    /* painted markings, not lamps: bright enough to read, dim enough not to bloom into blobs */
    const markMat = new THREE.MeshStandardMaterial({ color: 0xdff2fb, roughness: 0.55, metalness: 0.1, emissive: 0x5fb2cf, emissiveIntensity: 0.8 });
    plate(7, 0.08, HALL_LEN - 26, railMat, 0, 0.07, HALL_MID_Z - 6);
    plate(0.3, 0.1, HALL_LEN - 30, markMat, -3.2, 0.11, HALL_MID_Z - 6);
    plate(0.3, 0.1, HALL_LEN - 30, markMat, 3.2, 0.11, HALL_MID_Z - 6);
    for (let z = HALL_MIN_Z + 24; z < HALL_MAX_Z - 10; z += 9) {
      for (const side of [-1, 1]) {
        plate(0.5, 0.16, 0.5, markMat, side * 5.2, 0.14, z);
      }
    }
    /* lane markings: the dashed line a hangar floor always has down the taxi line */
    for (let z = HALL_MIN_Z + 30; z < HALL_MAX_Z - 26; z += 12) {
      plate(0.45, 0.02, 5, markMat, -14, 0.05, z);
      plate(0.45, 0.02, 5, markMat, 14, 0.05, z);
    }
    /* aprons over the wells, painted with hazard stripes */
    for (const wz of [-132, -186]) {
      const apron = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), hazardMat);
      apron.rotation.x = -Math.PI / 2;
      apron.position.set(0, 0.03, wz);
      scene.add(apron);
    }

    /* ---------------- snow drifting in the air ---------------- */
    const snowCount = 1100;
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * HALL_HALF * 2;
      snowPos[i * 3 + 1] = Math.random() * 26;
      snowPos[i * 3 + 2] = HALL_MAX_Z - Math.random() * HALL_LEN;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      map: glowTex, color: 0xe6f6ff, size: 0.44, transparent: true, opacity: 0.62,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(snow);

    /* cold mist rolling along the floor: the haze in the reference is half the picture */
    const mist: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(46 + Math.random() * 40, 26 + Math.random() * 18),
        new THREE.MeshBasicMaterial({
          map: glowTex, color: 0x9fd2e8, transparent: true, opacity: 0.05 + Math.random() * 0.05,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set((Math.random() - 0.5) * HALL_HALF * 1.3, 0.9 + Math.random() * 1.6,
        HALL_MAX_Z - Math.random() * HALL_LEN);
      m.userData.drift = 0.4 + Math.random() * 0.8;
      scene.add(m);
      mist.push(m);
    }

    /* ---------------- figures ---------------- */
    /* The platoon has to read as people at ten paces, so the body is built from blocks with
     * hard shoulders and a helmeted head — rounded capsules read as blobs at close range. */
    const torsoGeo = new THREE.BoxGeometry(0.86, 0.8, 0.54);
    const hipGeo = new THREE.BoxGeometry(0.7, 0.36, 0.46);
    const thighGeo = new THREE.BoxGeometry(0.29, 0.56, 0.33);
    const shinGeo = new THREE.BoxGeometry(0.26, 0.52, 0.3);
    const armGeo = new THREE.BoxGeometry(0.24, 0.58, 0.26);
    const padGeo = new THREE.SphereGeometry(0.21, 8, 6);
    const kneeGeo = new THREE.BoxGeometry(0.27, 0.19, 0.11);
    const headGeo = new THREE.SphereGeometry(0.23, 10, 8);
    const helmetGeo = new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7);
    const packGeo = new THREE.BoxGeometry(0.6, 0.78, 0.34);
    const bootGeo = new THREE.BoxGeometry(0.3, 0.22, 0.54);

    const makeFigure = (colours: { coat: number; helmet: number; visor: number }, hostile: boolean) => {
      const g = new THREE.Group();
      // snow camouflage over the coat: the blotches are what tells the platoon from the guards
      const cloth = new THREE.MeshStandardMaterial({
        map: snowCamoTex, color: hostile ? colours.coat : 0xffffff,
        roughness: 0.86, metalness: 0.05,
      });
      const plate2 = new THREE.MeshStandardMaterial(
        hostile
          ? { color: colours.helmet, roughness: 0.6, metalness: 0.22 }
          : { map: snowCamoTex, color: colours.helmet, roughness: 0.6, metalness: 0.22 },
      );
      const skin = new THREE.MeshStandardMaterial({ color: hostile ? 0x8e9aa2 : 0xd9c3ab, roughness: 0.85 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x11181d, roughness: 0.75, metalness: 0.3 });

      // legs: thigh, shin, knee pad and a boot, with a stance so they do not read as one column
      for (const side of [-1, 1]) {
        const thigh = new THREE.Mesh(thighGeo, cloth);
        thigh.position.set(side * 0.19, 0.86, side * 0.03);
        thigh.rotation.x = side > 0 ? 0.06 : -0.04;
        g.add(thigh);
        const shin = new THREE.Mesh(shinGeo, cloth);
        shin.position.set(side * 0.19, 0.4, -0.02);
        g.add(shin);
        const knee = new THREE.Mesh(kneeGeo, dark);
        knee.position.set(side * 0.19, 0.62, -0.17);
        g.add(knee);
        const boot = new THREE.Mesh(bootGeo, dark);
        boot.position.set(side * 0.19, 0.11, -0.06);
        g.add(boot);
      }
      // hips, torso and the hard shoulders a plate carrier gives you
      const hips = new THREE.Mesh(hipGeo, cloth);
      hips.position.y = 1.12;
      g.add(hips);
      const torso = new THREE.Mesh(torsoGeo, cloth);
      torso.position.y = 1.5;
      g.add(torso);
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.62), plate2);
      vest.position.set(0, 1.5, 0.01);
      g.add(vest);
      for (const side of [-1, 1]) {
        const pad = new THREE.Mesh(padGeo, plate2);
        pad.position.set(side * 0.46, 1.78, 0);
        pad.scale.set(1.05, 0.72, 1.05);
        g.add(pad);
      }
      // arms, one hand forward on the rifle
      const armL = new THREE.Mesh(armGeo, cloth);
      armL.position.set(-0.52, 1.44, -0.02);
      armL.rotation.z = 0.16;
      g.add(armL);
      const armR = new THREE.Mesh(armGeo, cloth);
      armR.position.set(0.5, 1.38, -0.26);
      armR.rotation.set(-0.62, 0, -0.2);
      g.add(armR);
      // head, helmet, and the glow of a visor on the hostiles
      const head = new THREE.Mesh(headGeo, skin);
      head.position.y = 2.0;
      g.add(head);
      const helmet = new THREE.Mesh(helmetGeo, plate2);
      helmet.position.y = 2.02;
      helmet.scale.set(1.08, 1.02, 1.08);
      g.add(helmet);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.5), plate2);
      brim.position.set(0, 1.93, -0.06);
      g.add(brim);
      if (hostile) {
        const visor = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.09, 0.07),
          new THREE.MeshStandardMaterial({ color: colours.visor, emissive: colours.visor, emissiveIntensity: 2.4 }),
        );
        visor.position.set(0, 1.98, -0.24);
        g.add(visor);
      }
      // webbing, pack, and the antenna that makes the silhouette read at a glance
      const pack = new THREE.Mesh(packGeo, dark);
      pack.position.set(0, 1.56, 0.44);
      g.add(pack);
      const roll = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.24), cloth);
      roll.position.set(0, 1.9, 0.4);
      g.add(roll);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.78, 4), dark);
      antenna.position.set(-0.26, 2.2, 0.5);
      antenna.rotation.z = 0.14;
      g.add(antenna);
      // rifle held across the body
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 1.16), dark);
      rifle.position.set(0.3, 1.3, -0.5);
      rifle.rotation.x = -0.12;
      g.add(rifle);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), steelPale);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0.3, 1.32, -1.15);
      g.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.16), dark);
      mag.position.set(0.3, 1.12, -0.34);
      g.add(mag);
      // the shield troopers carry a slab of pale alloy
      if (!hostile) {
        // a riot slab, not a white board: smaller, translucent, with a lit rim so it reads
        const shield = new THREE.Mesh(
          new THREE.BoxGeometry(0.66, 0.92, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x8fadbc, roughness: 0.22, metalness: 0.4, transparent: true, opacity: 0.62 }),
        );
        shield.position.set(-0.58, 1.36, -0.42);
        shield.rotation.y = 0.16;
        g.add(shield);
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.06, 0.08),
          new THREE.MeshStandardMaterial({ color: 0xd7f4ff, emissive: 0x6fd8ff, emissiveIntensity: 1.3 }),
        );
        rim.position.set(-0.58, 1.8, -0.42);
        rim.rotation.y = 0.16;
        g.add(rim);
      }
      // snow settled on the shoulders
      const snowCap = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 0.5), snowMat);
      snowCap.position.set(0, 1.83, 0);
      g.add(snowCap);
      return g;
    };

    const colliders: { x: number; z: number; r: number }[] = [];
    for (const p of pillars) colliders.push({ x: p.x, z: p.z, r: 3.6 });
    for (let i = 0; i <= 13; i++) {
      for (const side of [-1, 1]) colliders.push({ x: side * gantryX, z: HALL_MAX_Z - 20 - i * 21, r: 2.2 });
    }

    /* hostiles: an ice guard battalion spread down the hall */
    const foes: Foe[] = [];
    for (let i = 0; i < 22; i++) {
      const row = Math.floor(i / 4);
      const mesh = makeFigure({ coat: 0x3a5065, helmet: 0x2b3a46, visor: 0x8ff0ff }, true);
      const x = -30 + (i % 4) * 20 + (row % 2) * 6;
      const z = -46 - row * 32;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      foes.push({ mesh, x, z, hp: 90, maxHp: 90, cool: Math.random() * 2, alive: true, phase: Math.random() * 6 });
    }

    /* escorts: the twenty frozen shield troopers, in winter camouflage */
    const escorts: Escort[] = [];
    for (let i = 0; i < 20; i++) {
      const mesh = makeFigure({ coat: 0x9fb2bd, helmet: 0xc3d3dc, visor: 0x8ff0ff }, false);
      mesh.visible = false;
      scene.add(mesh);
      escorts.push({ mesh, x: 0, z: 0, hp: 120, maxHp: 120, cool: 0, alive: true, slot: i, flash: 0 });
    }

    /* sentries at the gate end: static figures that give the room a sense of scale */
    for (const [sx, sz, rot] of [[-13, 1.5, 0.5], [13.5, -2.5, -0.6], [-16, -13, 0.35], [18, -16, -0.3]] as const) {
      const sentry = makeFigure({ coat: 0x8ba2b0, helmet: 0xb9ccd7, visor: 0x8ff0ff }, false);
      sentry.position.set(sx, 0, sz);
      sentry.rotation.y = Math.PI + rot;
      sentry.userData.sentry = true;
      scene.add(sentry);
    }

    /* ---------------- the two aircraft wells ---------------- */
    const wells: { z: number; heli: THREE.Group; rotor: THREE.Mesh[]; risen: number }[] = [];
    const wellRingMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x5fcaff, emissiveIntensity: 1.6, roughness: 0.25 });

    /** A gunship that reads as a gunship: boom, mast, four blades, stub wings, rocket pods. */
    const makeGunship = () => {
      const heli = new THREE.Group();
      // fuselage: a lathe profile tapering nose to tail
      const profile: THREE.Vector2[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const r = 1.05 + Math.sin(t * Math.PI) * 1.15 - (t > 0.7 ? (t - 0.7) * 2.2 : 0);
        profile.push(new THREE.Vector2(Math.max(0.24, r), (t - 0.5) * 9.2));
      }
      const hull = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), hullMat);
      hull.rotation.x = -Math.PI / 2;
      hull.scale.set(1, 0.86, 1);
      heli.add(hull);
      // cockpit: a dark glass blister with a frame
      const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.12, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), canopyMat);
      cockpit.position.set(0, 0.3, -3.5);
      cockpit.rotation.x = -0.28;
      heli.add(cockpit);
      plate0(0.1, 1.4, 0.1, steelDark, 0, 0.6, -4.1);
      function plate0(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
        const m = new THREE.Mesh(unitBox, mat);
        m.scale.set(w, h, d);
        m.position.set(x, y, z);
        heli.add(m);
        return m;
      }
      // engine deck and exhausts
      plate0(1.7, 0.9, 3.4, steelDark, 0, 1.15, 0.4);
      for (const side of [-1, 1]) plate0(0.5, 0.42, 0.9, steelPale, side * 0.85, 1.15, 1.9);
      // mast, hub and four blades
      plate0(0.36, 0.9, 0.36, steelPale, 0, 1.9, -0.2);
      plate0(1.1, 0.22, 1.1, steelDark, 0, 2.3, -0.2);
      const rotor: THREE.Mesh[] = [];
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x25313a, roughness: 0.6, metalness: 0.45 });
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.11, 0.52), bladeMat);
        blade.position.set(0, 2.36, -0.2);
        blade.rotation.y = (b / 4) * Math.PI * 2;
        blade.rotation.z = 0.02;
        heli.add(blade);
        rotor.push(blade);
      }
      // rotor blur: a faint disc is what makes a turning rotor read at a distance
      const blur = new THREE.Mesh(
        new THREE.CircleGeometry(5.7, 24),
        new THREE.MeshBasicMaterial({
          color: 0x0d151b, transparent: true, opacity: 0.16,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      blur.rotation.x = -Math.PI / 2;
      blur.position.set(0, 2.3, -0.2);
      heli.add(blur);
      rotor.push(blur);
      // chin gun
      plate0(0.22, 0.22, 1.1, steelDark, 0, -0.72, -3.1);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), steelPale);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, -0.72, -3.9);
      heli.add(muzzle);
      // tail boom, fin, tail rotor
      plate0(0.52, 0.52, 5.2, hullMat, 0, 0.5, 5.2);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 1.2), hullMat);
      fin.position.set(0, 1.35, 7.6);
      fin.rotation.z = 0.1;
      heli.add(fin);
      const tailHub = plate0(0.16, 0.16, 0.5, steelDark, 0.3, 1.5, 7.9);
      tailHub.rotation.z = Math.PI / 2;
      for (let b = 0; b < 3; b++) {
        const tb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.1, 0.3), bladeMat);
        tb.position.set(0.36, 1.5, 7.9);
        tb.rotation.x = (b / 3) * Math.PI * 2;
        heli.add(tb);
        rotor.push(tb);
      }
      plate0(2.4, 0.14, 0.8, hullMat, 0, 0.4, 7.1);
      // stub wings and rocket pods
      for (const side of [-1, 1]) {
        plate0(3.2, 0.22, 1.3, hullMat, side * 2.1, 0.1, -0.3);
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.7, 10), steelDark);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(side * 3.2, -0.2, -0.3);
        heli.add(pod);
        for (let k = 0; k < 7; k++) {
          const tube = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), glowMat);
          const a = (k / 7) * Math.PI * 2;
          tube.position.set(side * 3.2 + Math.cos(a) * 0.22, -0.2 + Math.sin(a) * 0.22, -1.16);
          tube.rotation.y = Math.PI;
          heli.add(tube);
        }
        // skids
        const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.4, 6), steelPale);
        skid.rotation.x = Math.PI / 2;
        skid.position.set(side * 1.25, -1.5, 0.1);
        heli.add(skid);
        for (const zz of [-1.4, 1.4]) plate0(0.1, 1.1, 0.1, steelPale, side * 1.25, -0.95, zz);
      }
      // navigation lights
      const navR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({
        color: 0xff5a5a, emissive: 0xff3a3a, emissiveIntensity: 3,
      }));
      navR.position.set(-1.35, -0.1, -0.5);
      heli.add(navR);
      const navG = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({
        color: 0x6aff9a, emissive: 0x2aff77, emissiveIntensity: 3,
      }));
      navG.position.set(1.35, -0.1, -0.5);
      heli.add(navG);
      // snow on the rotor deck and the boom
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 3.2), snowMat);
      cap.position.set(0, 1.66, 0.4);
      heli.add(cap);
      heli.scale.setScalar(1.14);
      return { heli, rotor };
    };

    for (const wz of [-132, -186]) {
      // the well: a steel collar sunk into the ice, lit from inside
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.8, 1.2, 30, 1, true), steelMat);
      collar.position.set(0, 0.2, wz);
      scene.add(collar);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.34, 8, 34), wellRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.16, wz);
      scene.add(ring);
      const shaftWall = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.2, 12, 26, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x08161f, emissive: 0x0d3346, emissiveIntensity: 0.9, side: THREE.BackSide }),
      );
      shaftWall.position.set(0, -6, wz);
      scene.add(shaftWall);
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(7.2, 28),
        new THREE.MeshStandardMaterial({ color: 0x050d13, emissive: 0x0a2c3e, emissiveIntensity: 1 }),
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(0, -11.6, wz);
      scene.add(hole);
      glowSprite(0, 0.6, wz, 22, 0x8fe6ff, 0.28);

      const { heli, rotor } = makeGunship();
      heli.position.set(0, -9, wz);
      scene.add(heli);
      wells.push({ z: wz, heli, rotor, risen: 0 });
    }

    /* ---------------- the Frostwing ---------------- */
    const plane = new THREE.Group();
    const frostHull = new THREE.MeshStandardMaterial({
      color: 0xa9d8ea, roughness: 0.18, metalness: 0.72,
      emissive: 0x1d5468, emissiveIntensity: 0.5, transparent: true, opacity: 0.94,
    });
    const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.32, 11, 8, 14), frostHull);
    fuselage.rotation.x = Math.PI / 2;
    plane.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 4.4, 12), frostHull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, -7.2);
    plane.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.32, 3.4), frostHull);
    wing.position.set(0, -0.1, 0.6);
    plane.add(wing);
    for (const side of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.46, 3.1), new THREE.MeshStandardMaterial({
        color: 0x9fe8ff, emissive: 0x5fd4ff, emissiveIntensity: 1.6,
      }));
      tip.position.set(side * 7.4, 0.2, 0.9);
      plane.add(tip);
      const canard = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, 1.4), frostHull);
      canard.position.set(0, 0, -4.6);
      canard.rotation.y = side * 0.02;
      canard.scale.set(0.62, 1, 1);
      plane.add(canard);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 2.1), frostHull);
      fin.position.set(side * 1.1, 1.2, 4.2);
      fin.rotation.z = side * 0.28;
      plane.add(fin);
      // engine nacelles under the wings
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 3.4, 12), steelPale);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(side * 3.6, -0.5, 0.4);
      plane.add(nacelle);
      const exhaust = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), glowMat);
      exhaust.position.set(side * 3.6, -0.5, 2.12);
      plane.add(exhaust);
    }
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8fbff, roughness: 0.03, metalness: 0.5, transparent: true, opacity: 0.5 }),
    );
    canopy.position.set(0, 0.9, -2.6);
    plane.add(canopy);
    // Nose to the gate: the Frostwing is parked pointing at the way out, because in four
    // seconds that is exactly where it is going.
    plane.position.set(0, 3.2, -268);
    plane.rotation.y = Math.PI;
    scene.add(plane);
    // the bay it sits in: a raised cradle, clamps, and a cold lamp rig
    const cradle = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.8, 15),
      new THREE.MeshStandardMaterial({ color: 0x2a3942, roughness: 0.5, metalness: 0.7 }),
    );
    cradle.position.set(0, 0.4, -268);
    scene.add(cradle);
    for (const side of [-1, 1]) {
      plate(0.8, 3, 1.2, steelPale, side * 5.4, 1.9, -268);
      plate(0.7, 0.7, 6, steelDark, side * 5.4, 3.3, -266);
      plate(0.3, 8, 0.3, steelDark, side * 9, 4, -262);
      glowSprite(side * 9, 8, -262, 7, 0x9fe8ff, 0.6);
    }
    const planeGlow = new THREE.PointLight(0x8fe8ff, 280, 95, 2);
    planeGlow.position.set(0, 5, -268);
    scene.add(planeGlow);

    /* ---------------- player state ---------------- */
    const state = {
      px: 0, pz: 8, vx: 0, vz: 0, yaw: 0, pitch: 0,
      hp: 100, maxHp: 100, kills: 0, t: 0,
      phase: 'gate' as Phase, fired: 0, cool: 0,
      takeoff: 0, escaped: false, planeTaken: false,
      gateOpen: 0, wellT: 0, dialogue: 0,
    };
    const keys: Record<string, boolean> = {};
    const shown = new Set<string>();
    let firing = false;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let dragging = false;
    let finished = false;

    const say = (key: keyof typeof LINES) => {
      if (shown.has(key as string)) return;
      shown.add(key as string);
      setLine(LINES[key]);
      state.dialogue = 1;
    };

    /* ---------------- input ---------------- */
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (e.key === 'Escape') {
        e.preventDefault();
        const next = !pausedRef.current;
        pausedRef.current = next;
        setPaused(next);
        if (next) {
          for (const key of Object.keys(keys)) keys[key] = false;
          if (document.pointerLockElement) document.exitPointerLock?.();
        }
        return;
      }
      if (pausedRef.current) return;
      keys[k] = true;
      if (k === 'f' || k === 'e') interact();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement || dragging) {
        state.yaw -= e.movementX * 0.0022;
        state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch - e.movementY * 0.0022));
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement !== renderer.domElement) {
        dragging = true;
        try { void renderer.domElement.requestPointerLock(); } catch { /* embedded */ }
      }
      firing = true;
    };
    const onMouseUp = () => { firing = false; dragging = false; };
    const onLock = () => setLocked(document.pointerLockElement === renderer.domElement);
    const onResize = () => {
      const w = el.clientWidth || 1280, h = el.clientHeight || 720;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerlockchange', onLock);

    /* ---------------- helpers ---------------- */
    const tracer = (from: THREE.Vector3, to: THREE.Vector3, colour: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.95 }));
      scene.add(line);
      setTimeout(() => { scene.remove(line); g.dispose(); }, 70);
    };
    const boom = (x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), new THREE.MeshBasicMaterial({
        color: 0xffc46a, transparent: true, opacity: 0.9,
      }));
      m.position.set(x, y, z);
      scene.add(m);
      const t0 = performance.now();
      const grow = () => {
        const k = (performance.now() - t0) / 320;
        if (k >= 1) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); return; }
        m.scale.setScalar(1 + k * 2.4);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
        requestAnimationFrame(grow);
      };
      grow();
    };

    const nearestFoe = (x: number, z: number, maxD: number) => {
      let best: Foe | null = null, bd = maxD;
      for (const f of foes) {
        if (!f.alive) continue;
        const d = Math.hypot(f.x - x, f.z - z);
        if (d < bd) { bd = d; best = f; }
      }
      return best;
    };

    // the operative's rifle: a tight cone, so the aim is the mouse
    const shoot = () => {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const origin = new THREE.Vector3(state.px, 1.6, state.pz);
      let best: Foe | null = null, bestT = 90;
      for (const f of foes) {
        if (!f.alive) continue;
        const to = new THREE.Vector3(f.x, 1.4, f.z).sub(origin);
        const t = to.dot(dir);
        if (t < 0.5 || t > 90) continue;
        const lateral = to.clone().sub(dir.clone().multiplyScalar(t)).length();
        if (lateral < 1.5 && t < bestT) { bestT = t; best = f; }
      }
      tracer(origin.clone(), origin.clone().add(dir.clone().multiplyScalar(best ? bestT : 60)), 0xaef4ff);
      if (best) {
        best.hp -= 34;
        if (best.hp <= 0) {
          best.alive = false;
          best.mesh.visible = false;
          state.kills++;
          boom(best.x, 1.4, best.z);
        }
      }
      // a shot alerts everyone in front of you
      for (const f of foes) if (f.alive && Math.hypot(f.x - state.px, f.z - state.pz) < 60) f.cool = Math.min(f.cool, 0.5);
    };

    const interact = () => {
      if (state.escaped) return;
      const dPlane = Math.hypot(state.px - 0, state.pz + 268);
      if (dPlane < 9 && !state.planeTaken) {
        state.planeTaken = true;
        state.takeoff = 0.001;
        say('leave');
      }
    };

    /* ---------------- loop ---------------- */
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Paused in the ice: the guard battalion holds position until the operative resumes.
      if (pausedRef.current) { last = now; renderer.render(scene, camera); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      state.t += dt;

      // ---- movement
      const fwd = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
      const strafe = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
      const sprint = keys['shift'] ? 1.7 : 1;
      const speed = 7.4 * sprint;
      const sinY = Math.sin(state.yaw), cosY = Math.cos(state.yaw);
      const wishX = (-sinY * fwd + cosY * strafe) * speed;
      const wishZ = (-cosY * fwd - sinY * strafe) * speed;
      state.vx += (wishX - state.vx) * Math.min(1, dt * 12);
      state.vz += (wishZ - state.vz) * Math.min(1, dt * 12);
      state.px += state.vx * dt;
      state.pz += state.vz * dt;
      // walls and pillars
      state.px = Math.max(-HALL_HALF + 4, Math.min(HALL_HALF - 4, state.px));
      state.pz = Math.max(HALL_MIN_Z + 5, Math.min(HALL_MAX_Z - 4, state.pz));
      for (const c of colliders) {
        const dx = state.px - c.x, dz = state.pz - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + PLAYER_R * 0.06;
        if (d < min && d > 0.0001) {
          state.px = c.x + (dx / d) * min;
          state.pz = c.z + (dz / d) * min;
        }
      }

      // ---- phases
      const phase: Phase = state.pz < -232 ? 'frost' : state.pz < -104 ? 'hangar' : state.pz < -30 ? 'hall' : 'gate';
      if (phase !== state.phase) {
        state.phase = phase;
        if (phase === 'hall') say('escort');
        if (phase === 'hangar') say('hangar');
        if (phase === 'frost') say('frost');
      }
      // the escort platoon falls in the first time the hall is entered
      if (state.phase !== 'gate' && state.gateOpen === 0) {
        state.gateOpen = 0.001;
      }
      if (state.gateOpen > 0 && state.gateOpen < 1) {
        state.gateOpen = Math.min(1, state.gateOpen + dt * 0.8);
        escorts.forEach((e, i) => {
          if (state.gateOpen >= (i + 1) / 20) e.mesh.visible = true;
        });
      }
      // the wells open when the operative is deep enough
      if (state.pz < -112 && state.wellT < 1) state.wellT = Math.min(1, state.wellT + dt * 0.5);

      // ---- gunships: rise out of the ice, then follow and cover
      for (const [i, w] of wells.entries()) {
        const target = state.wellT > (i === 0 ? 0 : 0.35) ? 8.4 : -9;
        w.heli.position.y += (target - w.heli.position.y) * Math.min(1, dt * 1.4);
        for (const r of w.rotor) r.rotation.y += dt * (18 + i * 3);
        const tx = Math.max(-22, Math.min(22, state.px * 0.5 + (i === 0 ? -9 : 9)));
        const tz = Math.max(HALL_MIN_Z + 20, Math.min(HALL_MAX_Z - 20, state.pz - 18 - i * 10));
        w.heli.position.x += (tx - w.heli.position.x) * Math.min(1, dt * 0.9);
        w.heli.position.z += (tz - w.heli.position.z) * Math.min(1, dt * 0.8);
        w.heli.rotation.y = lerpAngle(w.heli.rotation.y, Math.atan2(state.px - w.heli.position.x, state.pz - w.heli.position.z) + Math.PI, Math.min(1, dt * 2));
        if (w.heli.position.y > 2 && Math.random() < dt * 3) {
          const foe = nearestFoe(w.heli.position.x, w.heli.position.z, 70);
          if (foe) {
            const from = new THREE.Vector3(w.heli.position.x, w.heli.position.y, w.heli.position.z);
            const to = new THREE.Vector3(foe.x, 1.4, foe.z);
            tracer(from, to, 0xffd28a);
            setTimeout(() => {
              if (!foe.alive) return;
              foe.hp -= 46;
              boom(foe.x, 1.4, foe.z);
              if (foe.hp <= 0) { foe.alive = false; foe.mesh.visible = false; state.kills++; }
            }, 120);
          }
        }
      }

      // ---- escorts: follow, shoot what is in front
      for (const e of escorts) {
        if (!e.alive) continue;
        // A wide ring, weighted behind the operative: twenty riflemen who stand in the
        // camera are twenty riflemen nobody can see past.
        const ring = 9 + (e.slot % 5) * 2.1;
        const a = (e.slot / 20) * Math.PI * 2 + state.t * 0.18;
        const tx = state.px + Math.cos(a) * ring;
        const tz = state.pz + Math.sin(a) * ring * 0.7 + 4.5;
        e.x += (tx - e.x) * Math.min(1, dt * 2.2);
        e.z += (tz - e.z) * Math.min(1, dt * 2.2);
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = Math.atan2(state.px - e.x, state.pz - e.z) + Math.PI;
        e.cool -= dt;
        if (e.cool <= 0) {
          const foe = nearestFoe(e.x, e.z, 46);
          if (foe) {
            e.cool = 0.85;
            tracer(new THREE.Vector3(e.x, 1.5, e.z), new THREE.Vector3(foe.x, 1.4, foe.z), 0xcdf6ff);
            foe.hp -= 16;
            if (foe.hp <= 0) {
              foe.alive = false; foe.mesh.visible = false; state.kills++;
              boom(foe.x, 1.4, foe.z);
            }
          }
        }
      }

      // ---- ice guards: close in and shoot
      for (const f of foes) {
        if (!f.alive) continue;
        const d = Math.hypot(f.x - state.px, f.z - state.pz);
        f.cool -= dt;
        const dx = state.px - f.x, dz = state.pz - f.z;
        // stay at range, but come looking if you are close
        if (d > 26 && d < 90) {
          f.x += (dx / (d || 1)) * dt * 5.2;
          f.z += (dz / (d || 1)) * dt * 5.2;
        }
        f.mesh.position.set(f.x, 0, f.z);
        f.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
        if (d < 55 && f.cool <= 0) {
          f.cool = 1.5 + Math.random() * 0.9;
          tracer(new THREE.Vector3(f.x, 1.5, f.z), new THREE.Vector3(state.px, 1.5, state.pz), 0xff9a8a);
          state.hp -= 5.5;
          // escorts absorb some of it
          const shield = escorts.find((s) => s.alive && Math.hypot(s.x - state.px, s.z - state.pz) < 9);
          if (shield && Math.random() < 0.45) {
            shield.hp -= 22;
            state.hp += 5.5;
            if (shield.hp <= 0) { shield.alive = false; shield.mesh.visible = false; }
          }
        }
      }
      if (state.hp <= 0 && !state.escaped) {
        // The platoon drags the operative back out through the gate: no death screen here.
        state.escaped = true;
        setLine({
          channel: 'S.H.I.E.L.D. / 1ST WINTER SHIELD',
          title: 'They carried you out.',
          text: 'The platoon held the corridor long enough to get you back through the gate. The vault is still there. So are you.',
        });
        setTimeout(() => { if (!finished) { finished = true; exitRef.current({ kills: state.kills, escorts: escorts.filter((e) => e.alive).length, plane: false, time: state.t }, false); } }, 3200);
      }

      /* ---- THE LAUNCH.
       *
       * It used to be a model sliding forward for three seconds and a fade. Now it is a
       * launch: the gate leaves sink into the ice, the bay lights come up, the Frostwing
       * runs the length of the hall on the rail with the camera chasing it, and the white
       * of the ice shelf takes the screen as it clears the mountain.
       */
      if (state.takeoff > 0) {
        state.takeoff += dt;
        const t = state.takeoff;
        // 1) the gate opens (0 - 1.1 s)
        const open = Math.min(1, t / 1.1);
        gateLeaves.forEach((leaf, i) => {
          const side = i === 0 ? -1 : 1;
          leaf.position.x = side * (7.8 + open * 3.4);
          leaf.position.y = 9.5 - open * 9.3;
          leaf.scale.y = Math.max(0.04, 1 - open * 0.98);
        });
        (gateSeam.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + open * 2.4;
        (daylight.material as THREE.MeshBasicMaterial).color.setScalar(0.82 + open * 0.18);
        // 2) the run (1.1 - 3.6 s): 300 units of hall, accelerating all the way
        const run = Math.max(0, Math.min(1, (t - 1.1) / 2.5));
        const dist = 300 * run * run;
        plane.position.z = -268 + dist;
        plane.position.y = 3.2 + run * 5.5;
        plane.rotation.x = -run * 0.16;
        const flicker = 0.85 + Math.sin(state.t * 40) * 0.15;
        planeGlow.intensity = 40 + run * 260 * flicker;
        planeGlow.position.set(0, 5.4 + run * 3, plane.position.z + 2);
        // the operative watches it go: camera behind and above the tail
        camera.position.set(plane.position.x * 0.4, Math.max(2.4, plane.position.y + 2.2), plane.position.z - 17);
        camera.lookAt(plane.position.x, plane.position.y, plane.position.z + 6);
        if (run >= 1 && !finished) {
          finished = true;
          // hold the white for half a second, so the launch ends on the glare of the ice
          // shelf instead of on a hard cut to the surface
          setFade(1);
          const stats = { kills: state.kills, escorts: escorts.filter((e) => e.alive).length, plane: true, time: state.t };
          setTimeout(() => exitRef.current(stats, true), 520);
        }
      } else {
        // first person camera
        camera.position.set(state.px, 1.62 + Math.sin(state.t * 7) * 0.02 * Math.min(1, Math.hypot(state.vx, state.vz) / 4), state.pz);
        camera.rotation.set(state.pitch, state.yaw, 0);
      }

      // ---- shooting
      state.cool -= dt;
      if (firing && state.cool <= 0 && !state.escaped && state.takeoff <= 0) {
        state.cool = 0.1;
        shoot();
      }

      // ---- environment animation
      snow.position.y -= dt * 0.5;
      if (snow.position.y < -26) snow.position.y = 0;
      const pos = snowGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < snowCount; i += 3) {
        const y = pos.getY(i);
        pos.setY(i, y > 0 ? y - dt * 0.7 : 26);
        pos.setX(i, pos.getX(i) + Math.sin(state.t + i) * dt * 0.15);
      }
      pos.needsUpdate = true;
      // the gate seam breathes
      (gateSeam.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(state.t * 2) * 0.5;
      // banners stir in the draught coming in through the mouth
      banners.forEach((b, i) => {
        b.rotation.z = Math.sin(state.t * 0.7 + i * 1.3) * 0.035;
        b.position.y = 17.4 + Math.sin(state.t * 0.9 + i) * 0.06;
      });
      // cold mist rolls along the floor
      mist.forEach((m, i) => {
        m.position.z += m.userData.drift * dt * 0.6;
        m.position.x += Math.sin(state.t * 0.3 + i) * dt * 0.25;
        if (m.position.z > HALL_MAX_Z + 20) m.position.z = HALL_MIN_Z - 20;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.05 + (Math.sin(state.t * 0.5 + i) * 0.5 + 0.5) * 0.05;
      });
      // the daylight shafts breathe with the weather outside
      shafts.forEach((sh, i) => {
        const k = 0.14 + Math.sin(state.t * 0.6 + i * 1.7) * 0.03;
        (sh.material as THREE.MeshBasicMaterial).opacity = k;
      });
      // the wells glow harder while the aircraft are climbing out of them
      wellRingMat.emissiveIntensity = 1.1 + state.wellT * 1.6 + Math.sin(state.t * 3) * 0.25;

      // floating HUD camera shake when hit
      if (state.hp < 100 && state.hp > 0) {
        camera.position.x += (Math.random() - 0.5) * 0.04;
      }

      // ---- hud at 8 Hz
      hudT += dt;
      if (hudT > 0.12) {
        hudT = 0;
        setHud({
          hp: Math.max(0, Math.round(state.hp)),
          kills: state.kills,
          foes: foes.filter((f) => f.alive).length,
          escorts: escorts.filter((e) => e.alive).length,
          phase: state.phase,
          prompt: !state.planeTaken && Math.hypot(state.px, state.pz + 268) < 9 ? 'F · TAKE THE FROSTWING' : '',
          intro: 0,
        });
      }

      // intro fade
      setFade((v) => Math.max(0, v - dt * 0.6));

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    /* ---------------- teardown ---------------- */
    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onLock);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phaseLabel = hud.phase === 'gate' ? 'GATE CHAMBER' : hud.phase === 'hall'
    ? 'THE GREAT HALL' : hud.phase === 'hangar' ? 'AIRCRAFT WELLS' : 'FROST BAY';

  return (
    <div className="absolute inset-0 z-40 bg-[#0a1620]">
      <div ref={host} className="absolute inset-0" />
      {paused && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[#040a0fee] font-mono">
          <div className="border border-cyan-200/40 bg-[#071820f2] px-10 py-7 text-center">
            <p className="text-[10px] tracking-[0.5em] text-cyan-300/70">GLACIER VAULT · SIMULATION HALTED</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[0.3em] text-cyan-50">PAUSED</h2>
            <p className="mt-3 text-[11px] tracking-[0.25em] text-cyan-200/70">ESC TO RESUME</p>
            <p className="mt-1 text-[10px] tracking-[0.2em] text-cyan-200/40">THE ICE GUARD IS STANDING STILL</p>
          </div>
        </div>
      )}
      {/* cold vignette */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 45%, rgba(210,244,255,0) 35%, rgba(60,120,150,0.35) 100%)',
      }} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 font-mono text-[11px] tracking-widest text-cyan-50">
        <div className="rounded-sm border border-cyan-200/40 bg-[#0b2430]/70 px-3 py-2 backdrop-blur">
          <div className="text-[10px] text-cyan-200/70">GLACIER VAULT / SECTOR 3</div>
          <div className="mt-1 text-sm font-bold tracking-[0.2em]">{phaseLabel}</div>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded bg-black/50">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-white" style={{ width: `${hud.hp}%` }} />
          </div>
          <div className="mt-1 text-[9px] text-cyan-100/60">OPERATIVE {hud.hp}%</div>
        </div>
        <div className="rounded-sm border border-cyan-200/40 bg-[#0b2430]/70 px-3 py-2 text-right backdrop-blur">
          <div>ICE GUARDS <span className="text-white">{hud.foes}</span></div>
          <div className="mt-1">SHIELD PLATOON <span className="text-white">{hud.escorts}</span>/20</div>
          <div className="mt-1">DOWNED <span className="text-white">{hud.kills}</span></div>
        </div>
      </div>

      {/* crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-4 w-4 rounded-full border border-cyan-100/70" />
        <div className="absolute left-1/2 top-1/2 h-0.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-cyan-100" />
      </div>

      {/* dialogue */}
      {line && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto max-w-2xl px-6">
          <div className="animate-[fadeIn_.4s_ease-out] rounded-sm border-l-2 border-cyan-300/70 bg-[#04141c]/80 px-4 py-3 backdrop-blur">
            <div className="font-mono text-[9px] tracking-[0.3em] text-cyan-300/70">{line.channel}</div>
            <div className="mt-1 font-mono text-sm text-cyan-50">{line.title}</div>
            <div className="mt-1 font-mono text-[11px] leading-relaxed text-cyan-100/70">{line.text}</div>
          </div>
        </div>
      )}

      {/* prompts & controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 font-mono text-[10px] tracking-widest text-cyan-100/70">
        {hud.prompt && (
          <div className="rounded-sm border border-cyan-300/60 bg-cyan-400/15 px-3 py-1 font-bold text-cyan-50">{hud.prompt}</div>
        )}
        <div>WASD MOVE · SHIFT SPRINT · LMB FIRE · F USE {locked ? '' : '· CLICK TO LOCK MOUSE'}</div>
      </div>

      {/* gate intro */}
      {fade > 0.01 && (
        <div className="pointer-events-none absolute inset-0 bg-white transition-none" style={{ opacity: fade }} />
      )}
    </div>
  );
}

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
