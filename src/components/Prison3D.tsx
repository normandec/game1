import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  PrisonSim, CELL_D, CELL_W, CELL_H, CORRIDOR_HALF, WING_ROWS, wingZ, type PrisonStats,
} from '../game/prison';
import { PrisonAudio } from '../game/prisonAudio';

export type PrisonMode = 'arrest' | 'visit';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
interface Props {
  mode: PrisonMode;
  onExit: (stats: PrisonStats, escaped: boolean) => void;
}

interface Screen {
  hp: number; armor: number; mag: number; magSize: number; reserve: number;
  reloading: boolean; alarm: number; prompt: string; message: string; messageT: number;
  cells: number; free: number; guards: number; sally: boolean; lights: boolean;
  compass: { label: string; angle: number; dist: number }[];
  stats: PrisonStats; flashlight: boolean;
  weapon: string;
  cuffed: number;
  hatchNear: boolean;
  hatchProgress: number;
  muted: boolean;
}

const EMPTY: Screen = {
  hp: 100, armor: 0, mag: 12, magSize: 12, reserve: 48, reloading: false, alarm: 0,
  prompt: '', message: '', messageT: 0, cells: 0, free: 0, guards: 0, sally: false,
  lights: false, compass: [], stats: { freed: 0, guardsDown: 0, inmatesDown: 0, shots: 0, hits: 0, looted: 0 },
  flashlight: false, weapon: 'M9 SIDEARM', cuffed: 0, hatchNear: false, hatchProgress: 0, muted: false,
};

export default function Prison3D({ mode, onExit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>(EMPTY);
  const [intro, setIntro] = useState(mode === 'arrest' ? 1 : 0.55);
  const [locked, setLocked] = useState(false);
  const [flashTap, setFlashTap] = useState(false);
  const simRef = useRef<PrisonSim | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const finished = useRef(false);

  useEffect(() => {
    const hostEl = host.current;
    if (!hostEl) return;
    const sim = new PrisonSim(11);
    simRef.current = sim;
    sim.wake();
    // Sound is synthesised, not loaded: no assets in a single-file build.
    const audio = new PrisonAudio();

    const W = hostEl.clientWidth || 1280;
    const H = hostEl.clientHeight || 720;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    renderer.setClearColor(0x05080a, 1);
    // Filmic response, a touch of bloom-feel through exposure. Bright enough to read.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    hostEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Tight, damp air: the gallery fades out well before its far end.
    scene.fog = new THREE.FogExp2(0x0a1014, 0.019);
    const camera = new THREE.PerspectiveCamera(72, W / H, 0.06, 320);
    // 1.66 m eye height, slightly wide: the corridor has to feel narrow and long.

    /* ---------------- environment ---------------- */
    // Reflections matter here: wet concrete and black steel both read as real only if
    // something is reflected. RoomEnvironment gives a pre-filtered map in one shot.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.06);
    scene.environment = envRT.texture;

    scene.add(new THREE.AmbientLight(0x7d95a8, 0.4));
    scene.add(new THREE.HemisphereLight(0x54748c, 0x0b1013, 0.55));
    const moon = new THREE.DirectionalLight(0x9dc0dc, 0.28);
    moon.position.set(-60, 120, -40);
    moon.castShadow = false;
    scene.add(moon);

    /* ---------------- procedural textures ----------------
     * Everything is painted on canvases: the build stays a single file, and the grime
     * is tuned per surface instead of being one grey map everywhere.
     */
    const tex = (c: HTMLCanvasElement, srgb = true, repeat = 1) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = 4;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const cv = (size: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      return { c, g: c.getContext('2d')! };
    };

    /** Painted, filthy concrete: mottling, form-tie holes, drips, chipped paint. */
    function wallTexture(): THREE.CanvasTexture {
      const { c, g } = cv(512);
      g.fillStyle = '#3a444b'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 4200; i++) {
        const v = 24 + Math.random() * 46;
        g.fillStyle = `rgba(${v},${v + 4},${v + 6},${0.05 + Math.random() * 0.14})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 8, 2 + Math.random() * 8);
      }
      // pale patches where the paint has been scrubbed / chipped away
      for (let i = 0; i < 42; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 6 + Math.random() * 34;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(120,134,140,0.20)');
        grd.addColorStop(1, 'rgba(120,134,140,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // vertical water drips from the ceiling line
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 512;
        const h = 20 + Math.random() * 190, y = Math.random() * 200;
        const grd = g.createLinearGradient(0, y, 0, y + h);
        grd.addColorStop(0, 'rgba(10,14,16,0.34)');
        grd.addColorStop(1, 'rgba(10,14,16,0)');
        g.fillStyle = grd;
        g.fillRect(x, y, 1 + Math.random() * 5, h);
      }
      // form-tie holes in a loose grid
      g.fillStyle = 'rgba(8,11,12,0.55)';
      for (let y = 40; y < 512; y += 92) for (let x = 46; x < 512; x += 96) {
        g.beginPath(); g.arc(x + Math.random() * 4, y + Math.random() * 4, 2.4, 0, Math.PI * 2); g.fill();
      }
      // expansion joints
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
      return tex(c, true, 1);
    }

    /** Wet, polished institution floor: aggregate, dark scuffs, pale wear tracks. */
    function floorTexture(): THREE.CanvasTexture {
      const { c, g } = cv(512);
      g.fillStyle = '#2b3236'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) {
        const v = 18 + Math.random() * 70;
        g.fillStyle = `rgba(${v},${v + 3},${v + 4},${0.06 + Math.random() * 0.16})`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      // worn traffic lane down the middle of the gallery
      const lane = g.createLinearGradient(150, 0, 362, 0);
      lane.addColorStop(0, 'rgba(150,163,168,0)');
      lane.addColorStop(0.5, 'rgba(150,163,168,0.14)');
      lane.addColorStop(1, 'rgba(150,163,168,0)');
      g.fillStyle = lane; g.fillRect(150, 0, 212, 512);
      // dark wet patches
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 12 + Math.random() * 60;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(8,12,14,0.45)');
        grd.addColorStop(1, 'rgba(8,12,14,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // saw-cut slab joints
      g.strokeStyle = 'rgba(6,9,10,0.55)'; g.lineWidth = 2;
      for (const p of [128, 256, 384]) {
        g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
      }
      return tex(c, true, 1);
    }

    /** Roughness map for the floor: black = mirror-wet puddle, white = dry concrete. */
    function floorRoughness(): THREE.CanvasTexture {
      const { c, g } = cv(512);
      g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 7000; i++) {
        const v = 150 + Math.random() * 90;
        g.fillStyle = `rgba(${v},${v},${v},0.25)`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      // puddles and a permanently wet lane down the middle
      const wet = (x: number, y: number, r: number, dark: number) => {
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(10,10,10,${dark})`);
        grd.addColorStop(0.7, `rgba(30,30,30,${dark * 0.6})`);
        grd.addColorStop(1, 'rgba(120,120,120,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      };
      for (let i = 0; i < 34; i++) wet(Math.random() * 512, Math.random() * 512, 14 + Math.random() * 70, 0.85);
      g.fillStyle = 'rgba(20,20,20,0.5)'; g.fillRect(196, 0, 120, 512);
      return tex(c, false, 1);
    }

    /** Soft vertical light smear, used for the reflection on the wet floor. */
    function streakTexture(): THREE.CanvasTexture {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 256;
      const g = c.getContext('2d')!;
      const along = g.createLinearGradient(0, 0, 64, 0);
      along.addColorStop(0, 'rgba(255,255,255,0)');
      along.addColorStop(0.42, 'rgba(255,255,255,0.55)');
      along.addColorStop(0.5, 'rgba(255,255,255,1)');
      along.addColorStop(0.58, 'rgba(255,255,255,0.55)');
      along.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = along; g.fillRect(0, 0, 64, 256);
      const across = g.createLinearGradient(0, 0, 0, 256);
      across.addColorStop(0, 'rgba(0,0,0,0)');
      across.addColorStop(0.5, 'rgba(0,0,0,1)');
      across.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = across; g.fillRect(0, 0, 64, 256);
      return tex(c, false, 1);
    }

    /** Grime running down a wall, as an alpha decal. */
    function grimeTexture(): THREE.CanvasTexture {
      const { c, g } = cv(256);
      g.clearRect(0, 0, 256, 256);
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * 256, w = 2 + Math.random() * 16;
        const h = 30 + Math.random() * 210;
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, `rgba(9,13,15,${0.28 + Math.random() * 0.35})`);
        grd.addColorStop(1, 'rgba(9,13,15,0)');
        g.fillStyle = grd; g.fillRect(x, 0, w, h);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(14,18,20,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * 256, 120 + Math.random() * 136, 3, 3);
      }
      return tex(c, false, 1);
    }

    /** Sign plate: dark steel with a lit legend. */
    function signTexture(text: string, color: string): THREE.CanvasTexture {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 96;
      const g = c.getContext('2d')!;
      g.fillStyle = '#0b1012'; g.fillRect(0, 0, 256, 96);
      g.strokeStyle = 'rgba(180,200,200,0.35)'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 92);
      g.fillStyle = color; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 128, 52);
      return tex(c, true, 1);
    }

    /* ---------------- materials ---------------- */
    const wallMap = wallTexture(); wallMap.repeat.set(6, 3);
    const floorMap = floorTexture(); floorMap.repeat.set(14, 14);
    const roughMap = floorRoughness(); roughMap.repeat.set(9, 9);

    const matConcrete = new THREE.MeshStandardMaterial({
      color: 0x4a565d, map: wallMap, roughness: 0.93, metalness: 0.05, envMapIntensity: 0.25,
    });
    // The floor is the star: dark, wet, and only partly rough, so the env map and the
    // light smears below draw long reflections into it.
    const matFloor = new THREE.MeshStandardMaterial({
      color: 0x39434a, map: floorMap, roughnessMap: roughMap,
      roughness: 1.0, metalness: 0.25, envMapIntensity: 0.22,
    });
    const matBars = new THREE.MeshStandardMaterial({
      color: 0x1a2127, roughness: 0.34, metalness: 0.9, envMapIntensity: 0.75,
    });
    const matFrame = new THREE.MeshStandardMaterial({ color: 0x14191d, roughness: 0.55, metalness: 0.6 });
    const matCeiling = new THREE.MeshStandardMaterial({ color: 0x232a2f, map: wallMap, roughness: 0.96 });
    const matDado = new THREE.MeshStandardMaterial({ color: 0x1f272c, roughness: 0.7, metalness: 0.15 });
    const matGate = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.55, metalness: 0.6 });
    const matBed = new THREE.MeshStandardMaterial({ color: 0x2e3a44, roughness: 0.92 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x59646c, roughness: 0.48, metalness: 0.72 });
    const matPipe = new THREE.MeshStandardMaterial({ color: 0x2b3339, roughness: 0.45, metalness: 0.7 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x4a3b2d, roughness: 0.88 });
    const matBench = new THREE.MeshStandardMaterial({ color: 0x2a3237, roughness: 0.82, metalness: 0.1 });
    const matLamp = new THREE.MeshBasicMaterial({ color: 0xe4f2ff });
    const matGuard = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.7, metalness: 0.2 });
    const matGuardHead = new THREE.MeshStandardMaterial({ color: 0xc9a58b, roughness: 0.8 });
    const matInmate = new THREE.MeshStandardMaterial({ color: 0x9c6b2f, roughness: 0.9 });
    const matInmateHead = new THREE.MeshStandardMaterial({ color: 0xb08f74, roughness: 0.85 });

    /* ---------------- floor, ceiling, rafters ---------------- */
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), matFloor);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x9fb4b8, transparent: true, opacity: 0.1 });
    for (let i = -5; i <= 5; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(220, 0.12), lineMat);
      line.rotation.x = -Math.PI / 2; line.position.set(0, 0.02, i * 20);
      scene.add(line);
    }
    const CEIL = 4.05;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), matCeiling);
    ceiling.rotation.x = Math.PI / 2; ceiling.position.y = CEIL;
    scene.add(ceiling);

    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (rotY) g.rotateY(rotY);
      g.translate(x, y, z);
      return g;
    };

    // concrete beams across every gallery: they break the ceiling into bays and give
    // the eye a rhythm to measure the corridor with.
    const beamGeos: THREE.BufferGeometry[] = [];
    const pipeGeos: THREE.BufferGeometry[] = [];
    const trayGeos: THREE.BufferGeometry[] = [];
    const galleryLen = WING_ROWS * CELL_W;               // 144 m, the length of a wing
    for (let w = 0; w < 4; w++) {
      const z0 = wingZ(w);
      for (let x = -galleryLen / 2; x <= galleryLen / 2; x += 5.5) {
        beamGeos.push(box(0.3, 0.42, CORRIDOR_HALF * 2 + 0.8, x, CEIL - 0.21, z0));
      }
      // two service pipes and a cable tray hugging the ceiling, like the reference
      const cyl = (r: number, len: number, y: number, z: number, mat: THREE.Material) => {
        const geo = new THREE.CylinderGeometry(r, r, len, 8, 1, true);
        geo.rotateZ(Math.PI / 2);
        geo.translate(0, y, z);
        pipeGeos.push(geo);
        void mat;
      };
      cyl(0.15, galleryLen, CEIL - 0.62, z0 - CORRIDOR_HALF + 0.3, matPipe);
      cyl(0.1, galleryLen, CEIL - 0.5, z0 - CORRIDOR_HALF + 0.62, matPipe);
      cyl(0.13, galleryLen, CEIL - 0.55, z0 + CORRIDOR_HALF - 0.34, matPipe);
      for (const sgn of [-1, 1]) {
        trayGeos.push(box(galleryLen, 0.1, 0.62, 0, CEIL - 0.72, z0 + sgn * (CORRIDOR_HALF - 0.5)));
        // brackets
        for (let x = -galleryLen / 2; x <= galleryLen / 2; x += 6.5) {
          trayGeos.push(box(0.1, 0.28, 0.1, x, CEIL - 0.86, z0 + sgn * (CORRIDOR_HALF - 0.5)));
        }
      }
    }
    // conduits run in front of the fascia, junction boxes are bolted to the posts
    for (let w = 0; w < 4; w++) {
      const z0 = wingZ(w);
      for (const sgn of [-1, 1]) {
        const z = z0 + sgn * (CORRIDOR_HALF - 0.28);
        trayGeos.push(box(galleryLen, 0.085, 0.085, 0, 3.72, z));
        trayGeos.push(box(galleryLen, 0.05, 0.05, 0, 3.58, z + 0.05));
        for (let k = 1; k < WING_ROWS; k += 3) {
          const x = -galleryLen / 2 + CELL_W * (k + 0.5) + CELL_W / 2;
          trayGeos.push(box(0.34, 0.46, 0.15, x, 2.5, z0 + sgn * (CORRIDOR_HALF - 0.18)));
        }
      }
    }
    if (beamGeos.length) scene.add(new THREE.Mesh(mergeGeometries(beamGeos)!, matConcrete));
    if (pipeGeos.length) scene.add(new THREE.Mesh(mergeGeometries(pipeGeos)!, matPipe));
    if (trayGeos.length) scene.add(new THREE.Mesh(mergeGeometries(trayGeos)!, matPipe));

    /* ---------------- walls and props ---------------- */
    const wallGeos: THREE.BufferGeometry[] = [];
    const gateGeos: THREE.BufferGeometry[] = [];
    for (const w of sim.walls) {
      if (w.kind === 'bar') continue;
      const geo = box(w.w, w.y1 - w.y0, w.d, w.x, (w.y0 + w.y1) / 2, w.z);
      (w.kind === 'gate' ? gateGeos : wallGeos).push(geo);
    }
    if (wallGeos.length) scene.add(new THREE.Mesh(mergeGeometries(wallGeos)!, matConcrete));
    const gateMesh = gateGeos.length ? new THREE.Mesh(mergeGeometries(gateGeos)!, matGate) : null;
    if (gateMesh) scene.add(gateMesh);

    const groups: Record<string, THREE.BufferGeometry[]> = {
      bed: [], metal: [], wood: [], screen: [], siren: [], cloth: [], stone: [], bench: [], camera: [],
      mattress: [], celllamp: [], steel: [], red: [], board: [],
    };
    for (const p of sim.props) {
      const key =
        p.kind === 'bed' ? 'bed'
        : p.kind === 'mattress' ? 'mattress'
        : p.kind === 'celllamp' ? 'celllamp'
        : p.kind === 'monitor' ? 'screen'
        : p.kind === 'siren' ? 'siren'
        : p.kind === 'bench' ? 'bench'
        : p.kind === 'camera' ? 'camera'
        : (p.kind === 'stove' || p.kind === 'cooker' || p.kind === 'sink' || p.kind === 'toilet' || p.kind === 'fridge' || p.kind === 'locker' || p.kind === 'bin') ? 'steel'
        : p.kind === 'board' ? 'board'
        : p.kind === 'extinguisher' ? 'red'
        : (p.kind === 'table' || p.kind === 'desk' || p.kind === 'crate' || p.kind === 'workbench' || p.kind === 'shelf') ? 'wood'
        : (p.kind === 'stretcher' || p.kind === 'laundry' || p.kind === 'chair') ? 'cloth'
        : p.kind === 'pot' || p.kind === 'tank' ? 'stone'
        : 'metal';
      if (key === 'camera') continue;                        // built with their own fixtures
      groups[key].push(box(p.w, p.h, p.d, p.x, p.y + p.h / 2, p.z));
    }
    const propMats: Record<string, THREE.Material> = {
      bed: matBed, metal: matMetal, wood: matWood, bench: matBench,
      mattress: new THREE.MeshStandardMaterial({ color: 0xa8a89a, roughness: 0.97 }),
      // the cell lamp: a warm bulb behind a wire guard, the only light after lock-up
      celllamp: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x7d868c, roughness: 0.42, metalness: 0.7 }),
      red: new THREE.MeshStandardMaterial({ color: 0x9c1f1a, roughness: 0.55, metalness: 0.3 }),
      board: new THREE.MeshStandardMaterial({ color: 0x6a5740, roughness: 0.92 }),
      screen: new THREE.MeshBasicMaterial({ color: 0x3fd9b0 }),
      siren: new THREE.MeshBasicMaterial({ color: 0xd8323a }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x46545e, roughness: 0.95 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x5a6368, roughness: 0.8, metalness: 0.25 }),
    };
    for (const key of Object.keys(groups)) {
      if (!groups[key].length) continue;
      scene.add(new THREE.Mesh(mergeGeometries(groups[key])!, propMats[key]));
    }

    /* ---------------- cell fronts: frames, bars, locks ---------------- */
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s3 = new THREE.Vector3(1, 1, 1);

    const patchGeo = new THREE.PlaneGeometry(CELL_W - 0.3, CELL_D - 0.3);
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x22282b, roughness: 0.95 });
    const patches = new THREE.InstancedMesh(patchGeo, patchMat, sim.cells.length);
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    sim.cells.forEach((c, i) => {
      m4.compose(new THREE.Vector3(c.x, 0.015, c.z), flat, s3);
      patches.setMatrixAt(i, m4);
    });
    scene.add(patches);

    // door frame: two jambs and a head, in near-black steel
    const jambGeo = new THREE.BoxGeometry(0.16, CELL_H, 0.24);
    const jambs = new THREE.InstancedMesh(jambGeo, matFrame, sim.cells.length * 2);
    const headGeo = new THREE.BoxGeometry(CELL_W, 0.26, 0.24);
    const heads = new THREE.InstancedMesh(headGeo, matFrame, sim.cells.length);
    let ji = 0;
    sim.cells.forEach((c, i) => {
      const zf = c.z + c.face * (CELL_D / 2);
      for (const sgn of [-1, 1]) {
        m4.compose(new THREE.Vector3(c.x + sgn * CELL_W / 2, CELL_H / 2, zf), q.identity(), s3);
        jambs.setMatrixAt(ji++, m4);
      }
      m4.compose(new THREE.Vector3(c.x, CELL_H - 0.13, zf), q.identity(), s3);
      heads.setMatrixAt(i, m4);
    });
    scene.add(jambs, heads);
    const fasciaGeos: THREE.BufferGeometry[] = [];
    for (let w = 0; w < 4; w++) {
      const z0 = wingZ(w);
      for (const sgn of [-1, 1]) {
        fasciaGeos.push(box(galleryLen, CEIL - CELL_H + 0.1, 0.22, 0, CELL_H - 0.03, z0 + sgn * (CORRIDOR_HALF - 0.11)));
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(fasciaGeos)!, matConcrete));

    // bars: 19 rods per front, plus four rails — dense, like a real cell block
    const BARS = 19;
    const barGeo = new THREE.BoxGeometry(0.05, CELL_H - 0.38, 0.05);
    const bars = new THREE.InstancedMesh(barGeo, matBars, sim.cells.length * BARS);
    const railGeo = new THREE.BoxGeometry(CELL_W - 0.1, 0.075, 0.075);
    const rails = new THREE.InstancedMesh(railGeo, matBars, sim.cells.length * 4);
    let bi = 0, ri = 0;
    const barTint = new THREE.Color();
    const barRnd = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    for (const c of sim.cells) {
      const zf = c.z + c.face * (CELL_D / 2);
      for (let k = 0; k < BARS; k++) {
        const x = c.x - CELL_W / 2 + 0.12 + ((CELL_W - 0.24) / (BARS - 1)) * k;
        m4.compose(new THREE.Vector3(x, CELL_H / 2 - 0.12, zf), q.identity(), s3);
        const t = barRnd(bi);
        // damp steel: darker where it is wet, warmer where it has started to rust
        barTint.setRGB(0.62 + t * 0.6, 0.66 + t * 0.5, 0.7 + t * 0.45);
        if (t > 0.93) barTint.setRGB(0.75, 0.5, 0.36);
        bars.setColorAt(bi, barTint);
        bars.setMatrixAt(bi++, m4);
      }
      for (const y of [0.18, 1.02, 2.16, CELL_H - 0.28]) {
        m4.compose(new THREE.Vector3(c.x, y, zf), q.identity(), s3);
        rails.setMatrixAt(ri++, m4);
      }
    }
    if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
    scene.add(bars, rails);

    // yellow lock boxes over a dark steel back plate — the single most recognisable
    // piece of colour in the reference, so it is chunky and it catches the light.
    const lockPlateGeo = new THREE.BoxGeometry(0.74, 0.86, 0.06);
    const lockPlates = new THREE.InstancedMesh(lockPlateGeo, matFrame, sim.cells.length);
    const lockGeo = new THREE.BoxGeometry(0.44, 0.54, 0.2);
    const lockMat = new THREE.MeshStandardMaterial({ color: 0xd0a92b, roughness: 0.42, metalness: 0.55, emissive: 0x140f00 });
    const locks = new THREE.InstancedMesh(lockGeo, lockMat, sim.cells.length);
    const tagGeo = new THREE.BoxGeometry(0.26, 0.15, 0.02);
    const tagMat = new THREE.MeshStandardMaterial({ color: 0x0d1114, roughness: 0.7 });
    const tags = new THREE.InstancedMesh(tagGeo, tagMat, sim.cells.length);
    for (const c of sim.cells) {
      const zf = c.z + c.face * (CELL_D / 2);
      m4.compose(new THREE.Vector3(c.x + CELL_W / 2 - 0.34, 1.2, zf + c.face * 0.05), q.identity(), s3);
      lockPlates.setMatrixAt(c.id, m4);
      m4.compose(new THREE.Vector3(c.x + CELL_W / 2 - 0.34, 1.2, zf + c.face * 0.16), q.identity(), s3);
      locks.setMatrixAt(c.id, m4);
      m4.compose(new THREE.Vector3(c.x + CELL_W / 2 - 0.34, 1.42, zf + c.face * 0.28), q.identity(), s3);
      tags.setMatrixAt(c.id, m4);
    }
    scene.add(lockPlates, locks, tags);

    /* ---------------- lights on the ceiling ---------------- */
    const lampProps = sim.props.filter((p) => p.kind === 'lamp');
    const lampHousing: THREE.BufferGeometry[] = [];
    const lampTubes: THREE.BufferGeometry[] = [];
    const lampSpots: THREE.Vector3[] = [];
    for (const p of sim.props) if (p.kind === 'celllamp') lampSpots.push(new THREE.Vector3(p.x, p.y - 0.1, p.z));
    for (const p of lampProps) {
      lampHousing.push(box(1.72, 0.14, 0.46, p.x, p.y + 0.16, p.z));
      for (const sgn of [-1, 1]) {
        lampTubes.push(box(1.5, 0.055, 0.085, p.x, p.y + 0.055, p.z + sgn * 0.1));
      }
      lampHousing.push(box(0.06, 0.34, 0.06, p.x - 0.7, p.y + 0.34, p.z));
      lampHousing.push(box(0.06, 0.34, 0.06, p.x + 0.7, p.y + 0.34, p.z));
      lampSpots.push(new THREE.Vector3(p.x, p.y - 0.2, p.z));
    }
    if (lampHousing.length) scene.add(new THREE.Mesh(mergeGeometries(lampHousing)!, matPipe));
    if (lampTubes.length) scene.add(new THREE.Mesh(mergeGeometries(lampTubes)!, matLamp));

    /* ---------------- red strobes above the cells ---------------- */
    // One caged red lamp over the gallery every ~22 m, alternating sides, all pulsing
    // with the siren. Four real point lights carry the pools under them.
    const strobeSpots: { x: number; z: number; y: number; side: number }[] = [];
    for (let w = 0; w < 4; w++) {
      const z0 = wingZ(w);
      for (let x = -galleryLen / 2 + 6, k = 0; x <= galleryLen / 2 - 6; x += 22, k++) {
        const side = k % 2 === 0 ? -1 : 1;
        strobeSpots.push({ x, z: z0 + side * (CORRIDOR_HALF - 0.08), y: CELL_H - 0.55, side });
      }
    }
    const bulbGeo = new THREE.SphereGeometry(0.13, 10, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff3a2e });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, strobeSpots.length);
    const shadeGeos: THREE.BufferGeometry[] = [];
    strobeSpots.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, s.y, s.z), q.identity(), s3);
      bulbs.setMatrixAt(i, m4);
      // caged shade: a small dark cone and two guard rods
      shadeGeos.push(box(0.34, 0.1, 0.34, s.x, s.y + 0.16, s.z));
      shadeGeos.push(box(0.03, 0.34, 0.03, s.x - 0.14, s.y + 0.04, s.z - 0.14));
      shadeGeos.push(box(0.03, 0.34, 0.03, s.x + 0.14, s.y + 0.04, s.z + 0.14));
    });
    scene.add(bulbs);
    scene.add(new THREE.Mesh(mergeGeometries(shadeGeos)!, matPipe));

    /* ---------------- wet-floor reflections ---------------- */
    // Cheap and very effective: a soft additive smear lying on the floor under every
    // light, long along the corridor. It reads exactly like gloss on wet concrete.
    const streakMap = streakTexture();
    const streakGeo = new THREE.PlaneGeometry(1, 1);
    const streakMatWhite = new THREE.MeshBasicMaterial({
      map: streakMap, color: 0xbcd8f0, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const streakMatRed = new THREE.MeshBasicMaterial({
      map: streakMap, color: 0xff2f22, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const layStreaks = (entries: { x: number; z: number; w: number; l: number }[], mat: THREE.Material) => {
      if (!entries.length) return;
      const geos = entries.map((e) => {
        const geo = streakGeo.clone();
        geo.scale(e.l, e.w, 1);
        geo.rotateX(-Math.PI / 2);
        geo.translate(e.x, 0.018, e.z);
        return geo;
      });
      const m = new THREE.Mesh(mergeGeometries(geos)!, mat);
      m.frustumCulled = false;
      m.renderOrder = 2;
      scene.add(m);
      for (const g2 of geos) g2.dispose();
    };
    layStreaks(lampProps.map((p) => ({ x: p.x, z: p.z, w: 1.35, l: 4.8 })), streakMatWhite);
    layStreaks(strobeSpots.map((s) => ({ x: s.x, z: s.z + s.side * -1.0, w: 0.85, l: 3.2 })), streakMatRed);

    /* ---------------- grime and skirting ---------------- */
    const grimeMap = grimeTexture();
    const grimeMat = new THREE.MeshBasicMaterial({
      map: grimeMap, transparent: true, opacity: 0.62, depthWrite: false, color: 0x0a0e10,
    });
    const grimeGeo = new THREE.PlaneGeometry(1, 1);
    type Decal = { x: number; y: number; z: number; rotY: number; w: number; h: number };
    const decals: Decal[] = [];
    for (let w = 0; w < 4; w++) {
      const z0 = wingZ(w);
      for (const sgn of [-1, 1]) {
        const rotY = sgn > 0 ? Math.PI : 0;
        // streaks down the steel door posts, every second cell
        for (let k = 0; k < WING_ROWS; k += 2) {
          const x = -galleryLen / 2 + CELL_W * (k + 0.5) + CELL_W / 2;
          decals.push({ x, y: 1.92, z: z0 + sgn * (CORRIDOR_HALF - 0.145), rotY, w: 0.22, h: 3.36 });
        }
        // and inside the cells, where water runs down the back wall
        for (let k = 1; k < WING_ROWS; k += 3) {
          const c = -galleryLen / 2 + CELL_W * (k + 0.5);
          decals.push({
            x: c + (k % 2 ? 0.5 : -0.5), y: 1.7, z: z0 + sgn * (CORRIDOR_HALF + CELL_D - 0.24),
            rotY, w: 1.1, h: 2.8,
          });
        }
      }
    }
    const grimeInst = new THREE.InstancedMesh(grimeGeo, grimeMat, decals.length);
    grimeInst.renderOrder = 1;
    decals.forEach((d, i) => {
      m4.compose(
        new THREE.Vector3(d.x, d.y, d.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, d.rotY, 0)),
        new THREE.Vector3(d.w, d.h, 1),
      );
      grimeInst.setMatrixAt(i, m4);
    });
    scene.add(grimeInst);

    // worn concrete kerb under the cell doors: the floor edge takes the worst of it
    const kerbGeos: THREE.BufferGeometry[] = [];
    for (let w = 0; w < 4; w++) {
      const z0 = wingZ(w);
      for (const sgn of [-1, 1]) {
        kerbGeos.push(box(galleryLen, 0.14, 0.16, 0, 0.07, z0 + sgn * (CORRIDOR_HALF - 0.06)));
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(kerbGeos)!, matDado));

    // every cell gets a low concrete ceiling, so the interior reads as a box
    const cellCeilGeo = new THREE.PlaneGeometry(CELL_W - 0.1, CELL_D - 0.1);
    const cellCeils = new THREE.InstancedMesh(cellCeilGeo, matCeiling, sim.cells.length);
    const down = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    sim.cells.forEach((c, i) => {
      m4.compose(new THREE.Vector3(c.x, CELL_H - 0.02, c.z), down, s3);
      cellCeils.setMatrixAt(i, m4);
    });
    scene.add(cellCeils);

    /* ---------------- CCTV ---------------- */
    const camProps = sim.props.filter((p) => p.kind === 'camera');
    if (camProps.length) {
      const camBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.18, 0.34), matFrame, camProps.length);
      const camLens = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10), matBars, camProps.length);
      const camLed = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), camProps.length);
      const lensQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, 0));
      camProps.forEach((p, i) => {
        m4.compose(new THREE.Vector3(p.x, p.y, p.z), tilt, s3);
        camBody.setMatrixAt(i, m4);
        m4.compose(new THREE.Vector3(p.x, p.y - 0.1, p.z + 0.26), lensQ, s3);
        camLens.setMatrixAt(i, m4);
        m4.compose(new THREE.Vector3(p.x + 0.09, p.y + 0.07, p.z - 0.1), q.identity(), s3);
        camLed.setMatrixAt(i, m4);
      });
      scene.add(camBody, camLens, camLed);
    }

    /* ---------------- signage ---------------- */
    const exitMat = new THREE.MeshBasicMaterial({ map: signTexture('EXIT', '#5ef08a'), transparent: true });
    const makeSign = (x: number, y: number, z: number, rotY: number, w = 1.5, h = 0.56) => {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), exitMat);
      face.position.set(x, y, z); face.rotation.y = rotY; scene.add(face);
      const boxM = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.1, 0.1), matFrame);
      boxM.position.set(x - Math.sin(rotY) * 0.06, y, z - Math.cos(rotY) * 0.06);
      boxM.rotation.y = rotY; scene.add(boxM);
    };
    makeSign(0, 3.15, 104.4, 0, 2.0, 0.75);
    for (let w = 0; w < 4; w++) {
      makeSign(-galleryLen / 2 - 0.6, 2.9, wingZ(w), Math.PI / 2, 1.3, 0.5);
      makeSign(galleryLen / 2 + 0.6, 2.9, wingZ(w), -Math.PI / 2, 1.3, 0.5);
    }

    /* ---------------- dynamic lights ---------------- */
    const lights: THREE.PointLight[] = [];
    for (let i = 0; i < 16; i++) {
      const l = new THREE.PointLight(0xd8ecff, 0, 19, 2);
      scene.add(l); lights.push(l);
    }
    const redLights: THREE.PointLight[] = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xff3a24, 0, 13, 2);
      scene.add(l); redLights.push(l);
    }
    const beacons: THREE.PointLight[] = [];
    for (let w = 0; w < 4; w++) {
      const b = new THREE.PointLight(0xff2b2b, 0, 26, 2);
      b.position.set(0, CELL_H - 0.2, wingZ(w));
      scene.add(b); beacons.push(b);
    }
    void matGuard; void matGuardHead; void matInmate; void matInmateHead;

    /* ---------------- loose junk on every floor: paper, cups, cans, casings ---------------- */
    const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
    const debrisMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.05 });
    const debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, sim.debris.length);
    debrisMesh.frustumCulled = false;
    const debrisColor = [
      0xd8d2c0, // paper
      0x9fb3a8, // plastic cup
      0x8f9aa2, // can
      0xc9a227, // brass casing
      0x7a5a3a, // splinter
      0xa9cfd6, // glass shard
    ];
    const debrisTint = new THREE.Color();
    sim.debris.forEach((d, i) => {
      debrisTint.setHex(debrisColor[d.kind] ?? 0xcccccc);
      debrisMesh.setColorAt(i, debrisTint);
    });
    if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
    scene.add(debrisMesh);
    const debrisQ = new THREE.Quaternion();
    const debrisE = new THREE.Euler();
    const debrisP = new THREE.Vector3();
    const debrisS = new THREE.Vector3();
    const hideM = new THREE.Matrix4().makeScale(0, 0, 0);
    const debrisPose = new Float32Array(sim.debris.length * 4).fill(Number.NaN);
    const debrisShown = new Uint8Array(sim.debris.length);
    let debrisDirty = true;

    /* ---------------- levers: physical handles, pulled with the mouse ---------------- */
    const leverHandles: { id: string; handle: THREE.Object3D; lamp: THREE.Mesh }[] = [];
    const matLeverBase = new THREE.MeshStandardMaterial({ color: 0x39424a, roughness: 0.55, metalness: 0.7 });
    const matLeverHandle = new THREE.MeshStandardMaterial({ color: 0xb8452f, roughness: 0.42, metalness: 0.4 });
    for (const l of sim.levers) {
      const group = new THREE.Group();
      group.position.set(l.x, l.y - 0.42, l.z);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.16), matLeverBase);
      plate.position.set(0, 0, -0.1);
      group.add(plate);
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.34, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.72), matLeverHandle);
      arm.position.set(0, 0, 0.3);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), matLeverHandle);
      knob.position.set(0, 0, 0.66);
      pivot.add(arm, knob);
      pivot.rotation.x = -0.55;
      group.add(pivot);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.14, 0.05),
        new THREE.MeshBasicMaterial({ color: l.id === 'master' ? 0xffb347 : 0x62e0ff }),
      );
      lamp.position.set(0, 0.44, 0.02);
      group.add(lamp);
      scene.add(group);
      leverHandles.push({ id: l.id, handle: pivot, lamp });
    }

    /* ---------------- loot on the floor: guns, crates, kit ---------------- */
    type LootView = { take: () => boolean; group: THREE.Group };
    const matCrateOlive = new THREE.MeshStandardMaterial({ color: 0x4d5238, roughness: 0.85 });
    const matCrateSteel = new THREE.MeshStandardMaterial({ color: 0x3c4448, roughness: 0.5, metalness: 0.6 });
    const matGunBody = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.45, metalness: 0.7 });
    const matGunWood = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.8 });
    const matMed = new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.7 });
    const matArmor = new THREE.MeshStandardMaterial({ color: 0x3f4a55, roughness: 0.5, metalness: 0.45 });
    const matKey = new THREE.MeshStandardMaterial({ color: 0xc8a93a, roughness: 0.35, metalness: 0.85, emissive: 0x1e1700 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xb8241d, roughness: 0.6 });

    /** A gun on a rack: the profile of the weapon says which one it is. */
    const buildGun = (kind: string, y: number) => {
      const grp = new THREE.Group();
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, yy: number, z: number, rz = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y + yy, z);
        m.rotation.z = rz;
        grp.add(m);
      };
      if (kind === 'carbine') {
        add(new THREE.BoxGeometry(0.86, 0.07, 0.06), matGunBody, 0, 0.02, 0);
        add(new THREE.BoxGeometry(0.2, 0.1, 0.05), matGunWood, -0.42, 0, 0);
        add(new THREE.BoxGeometry(0.06, 0.2, 0.05), matGunBody, 0.05, -0.12, 0);
        add(new THREE.BoxGeometry(0.24, 0.09, 0.05), matGunBody, -0.02, -0.02, 0);
        add(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), matGunBody, 0.62, 0.02, 0, Math.PI / 2);
      } else if (kind === 'shotgun') {
        add(new THREE.BoxGeometry(0.94, 0.07, 0.06), matGunBody, 0, 0.02, 0);
        add(new THREE.BoxGeometry(0.24, 0.08, 0.06), matGunWood, -0.44, -0.01, 0);
        add(new THREE.BoxGeometry(0.3, 0.07, 0.06), matGunWood, 0.1, -0.05, 0);
        add(new THREE.CylinderGeometry(0.024, 0.024, 0.5, 8), matGunBody, 0.5, 0.05, 0, Math.PI / 2);
      } else {
        add(new THREE.BoxGeometry(0.5, 0.08, 0.06), matGunBody, 0, 0.02, 0);
        add(new THREE.BoxGeometry(0.06, 0.22, 0.05), matGunBody, -0.08, -0.13, 0);
        add(new THREE.BoxGeometry(0.2, 0.06, 0.05), matGunBody, 0.2, 0.05, 0);
      }
      return grp;
    };

    const loot: LootView[] = [];
    for (const p of sim.pickups) {
      const grp = new THREE.Group();
      grp.position.set(p.x, 0, p.z);
      if (p.kind === 'weapon' && p.weapon) {
        // a slab of rack with the gun standing on it
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.3), matCrateSteel);
        shelf.position.y = 0.95;
        grp.add(shelf);
        const gun = buildGun(p.weapon, 1.02);
        gun.rotation.y = -0.35;
        grp.add(gun);
      } else if (p.kind === 'ammo') {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.42), matCrateOlive);
        crate.position.y = 0.18;
        grp.add(crate);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.44), matCrateOlive);
        lid.position.y = 0.38;
        grp.add(lid);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.02), matKey);
        stripe.position.set(0, 0.24, 0.215);
        grp.add(stripe);
      } else if (p.kind === 'medkit') {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.34), matMed);
        b.position.y = 0.15; grp.add(b);
        const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.02), matRed);
        crossA.position.set(0, 0.16, 0.18); grp.add(crossA);
        const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.02), matRed);
        crossB.position.set(0, 0.16, 0.18); grp.add(crossB);
      } else if (p.kind === 'armor') {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.2), matArmor);
        v.position.y = 0.5; v.rotation.x = 0.16; grp.add(v);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.34), matCrateSteel);
        stand.position.y = 0.15; grp.add(stand);
      } else {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 12), matKey);
        ring.position.y = 0.94; ring.rotation.x = Math.PI / 2; grp.add(ring);
        for (let k = 0; k < 4; k++) {
          const key = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02), matKey);
          key.position.set(Math.cos(k * 1.6) * 0.09, 0.86, Math.sin(k * 1.6) * 0.09);
          grp.add(key);
        }
      }
      // a cold glow so loot can be found in a dark wing
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: p.kind === 'weapon' ? 0xffd27a : 0x9fe6d0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.02;
      grp.add(halo);
      scene.add(grp);
      loot.push({ take: () => p.taken, group: grp });
    }

    /* ---------------- the workshop grate: the way out ---------------- */
    const hatchGroup = new THREE.Group();
    hatchGroup.position.set(sim.hatch.x, 0, sim.hatch.z);
    const hatchRim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 1.5), matCrateSteel);
    hatchRim.position.y = 0.06;
    hatchGroup.add(hatchRim);
    const hatchHole = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0x04070a }));
    hatchHole.rotation.x = -Math.PI / 2;
    hatchHole.position.y = 0.08;
    hatchGroup.add(hatchHole);
    // the lid: a grid of bars that lifts and slides aside once it is pried
    const hatchLid = new THREE.Group();
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x2b3438, roughness: 0.5, metalness: 0.75 });
    for (let k = -3; k <= 3; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.06, 0.07), lidMat);
      bar.position.set(0, 0.14, k * 0.18);
      hatchLid.add(bar);
    }
    for (let k = -3; k <= 3; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 1.24), lidMat);
      bar.position.set(k * 0.24, 0.15, 0);
      hatchLid.add(bar);
    }
    hatchGroup.add(hatchLid);
    // a ladder into the dark
    const ladder = new THREE.Group();
    for (const sx of [-0.26, 0.26]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), lidMat);
      rail.position.set(sx, 0.0, -0.5);
      ladder.add(rail);
    }
    for (let k = 0; k < 5; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.05), lidMat);
      rung.position.set(0, 0.2 - k * 0.22, -0.5);
      ladder.add(rung);
    }
    ladder.visible = false;
    hatchGroup.add(ladder);
    scene.add(hatchGroup);


    /* ---------------- bodies ----------------
     * A prison officer, not a box with a head: navy tunic with yellow shoulder patches,
     * a badge, a duty belt with pouches and cuffs, black boots, bare hands (nobody in
     * this prison carries a firearm), and a gait that reads as walking or running.
     * Every part is an instanced mesh, so three hundred figures stay cheap.
     */
    const matGuardArmor = new THREE.MeshStandardMaterial({ color: 0x2c3a52, roughness: 0.62, metalness: 0.12 });
    const matGuardLeg = new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.86 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xc39a7c, roughness: 0.86 });
    const matHair = new THREE.MeshStandardMaterial({ color: 0x2a2119, roughness: 0.95 });
    const matBoot = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.7, metalness: 0.15 });
    const matBelt = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.8 });
    const matBrass = new THREE.MeshStandardMaterial({ color: 0xd8c04a, roughness: 0.35, metalness: 0.7, emissive: 0x241d00 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x9aa6ad, roughness: 0.3, metalness: 0.9 });
    const matInmateCloth = new THREE.MeshStandardMaterial({ color: 0xa8702c, roughness: 0.96 });
    const matInmateLeg = new THREE.MeshStandardMaterial({ color: 0x84561f, roughness: 0.96 });

    const mkInst = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };

    const mkParts = (count: number, body: THREE.Material, legs: THREE.Material, head: THREE.Material) => ({
      torso: mkInst(new THREE.BoxGeometry(0.46, 0.62, 0.28), body, count),
      hips: mkInst(new THREE.BoxGeometry(0.4, 0.22, 0.26), legs, count),
      neck: mkInst(new THREE.CylinderGeometry(0.062, 0.07, 0.1, 8), head, count),
      head: mkInst(new THREE.SphereGeometry(0.145, 12, 10), head, count),
      hair: mkInst(new THREE.SphereGeometry(0.152, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), matHair, count),
      armL: mkInst(new THREE.BoxGeometry(0.115, 0.56, 0.13), body, count),
      armR: mkInst(new THREE.BoxGeometry(0.115, 0.56, 0.13), body, count),
      legL: mkInst(new THREE.BoxGeometry(0.16, 0.62, 0.17), legs, count),
      legR: mkInst(new THREE.BoxGeometry(0.16, 0.62, 0.17), legs, count),
      handL: mkInst(new THREE.SphereGeometry(0.062, 8, 6), head, count),
      handR: mkInst(new THREE.SphereGeometry(0.062, 8, 6), head, count),
      bootL: mkInst(new THREE.BoxGeometry(0.17, 0.16, 0.3), matBoot, count),
      bootR: mkInst(new THREE.BoxGeometry(0.17, 0.16, 0.3), matBoot, count),
    });

    const gBody = mkParts(sim.guards.length, matGuardArmor, matGuardLeg, matSkin);
    // the uniform details that make him read as a prison officer at a glance
    const gBelt = mkInst(new THREE.BoxGeometry(0.46, 0.11, 0.31), matBelt, sim.guards.length);
    const gBuckle = mkInst(new THREE.BoxGeometry(0.09, 0.07, 0.03), matBrass, sim.guards.length);
    const gPouchL = mkInst(new THREE.BoxGeometry(0.1, 0.13, 0.08), matBelt, sim.guards.length);
    const gPouchR = mkInst(new THREE.BoxGeometry(0.1, 0.13, 0.08), matBelt, sim.guards.length);
    const gCuffA = mkInst(new THREE.TorusGeometry(0.045, 0.014, 6, 10), matSteel, sim.guards.length);
    const gCuffB = mkInst(new THREE.TorusGeometry(0.045, 0.014, 6, 10), matSteel, sim.guards.length);
    const gPatchL = mkInst(new THREE.BoxGeometry(0.1, 0.075, 0.03), matBrass, sim.guards.length);
    const gPatchR = mkInst(new THREE.BoxGeometry(0.1, 0.075, 0.03), matBrass, sim.guards.length);
    const gBadge = mkInst(new THREE.BoxGeometry(0.055, 0.07, 0.02), matBrass, sim.guards.length);
    const gBaton = mkInst(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), matBelt, sim.guards.length);
    sim.guards.forEach((g, i) => {
      if (!g.elite) return;
      // the control-room detachments wear a darker tunic
      gBody.torso.setColorAt(i, new THREE.Color(0x20283c));
      gBody.armL.setColorAt(i, new THREE.Color(0x20283c));
      gBody.armR.setColorAt(i, new THREE.Color(0x20283c));
    });

    const iBody = mkParts(sim.inmates.length, matInmateCloth, matInmateLeg, matSkin);

    // pose one point of one figure, honouring yaw, ragdoll tilt, lean and limb swing
    const qYaw = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    const qSwing = new THREE.Quaternion();
    const qOut = new THREE.Quaternion();
    const axisRight = new THREE.Vector3(1, 0, 0);
    const vTmp = new THREE.Vector3();
    const pose = (
      mesh: THREE.InstancedMesh, i: number,
      ax: number, az: number, baseY: number, ang: number, tilt: number,
      lx: number, ly: number, lz: number, swing: number, lean = 0,
    ) => {
      const rX = -Math.sin(ang), rZ = Math.cos(ang);   // actor right
      const fX = Math.cos(ang), fZ = Math.sin(ang);    // actor forward
      const ct = Math.cos(tilt + lean), st = Math.sin(tilt + lean);
      const ly2 = ly * ct - lz * st;
      const lz2 = ly * st + lz * ct;
      qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang);
      qTilt.setFromAxisAngle(axisRight, tilt + lean);
      qSwing.setFromAxisAngle(axisRight, swing);
      qOut.copy(qYaw).multiply(qTilt).multiply(qSwing);
      vTmp.set(ax + rX * lx + fX * lz2, baseY + ly2, az + rZ * lx + fZ * lz2);
      m4.compose(vTmp, qOut, s3);
      mesh.setMatrixAt(i, m4);
    };

    /**
     * A limb hangs from a pivot (shoulder or hip) and swings around it. Doing the maths
     * about the pivot instead of the body centre is what stops the arms detaching.
     */
    const limb = (
      mesh: THREE.InstancedMesh | null, i: number,
      ax: number, az: number, baseY: number, ang: number, tilt: number,
      sideX: number, pivotY: number, pivotZ: number,
      drop: number, swing: number, lean = 0, forward = 0,
    ) => {
      if (!mesh) return;
      const ct = Math.cos(swing), st = Math.sin(swing);
      const ly = pivotY - drop * ct - forward * st;
      const lz = pivotZ + forward * ct - drop * st;
      pose(mesh, i, ax, az, baseY, ang, tilt, sideX, ly, lz, swing, lean);
    };

    /**
     * The gait. Walk and run are the same cycle at different amplitudes; a man standing
     * still shifts his weight and breathes. Used for officers and inmates alike.
     */
    const animate = (
      parts: ReturnType<typeof mkParts>,
      i: number, x: number, z: number, y: number, ang: number, tilt: number,
      limbPhase: number, gait: number, time: number, down: boolean,
    ) => {
      const run = clamp01((gait - 2.2) / 2.0);              // 0 walk → 1 sprint
      const amp = down ? 0 : clamp01(gait / 3.6) * (0.42 + run * 0.5);
      const idle = gait < 0.25 && !down;
      const phase = limbPhase;
      const sw = Math.sin(phase) * amp;
      const bob = down || idle ? 0 : Math.abs(Math.sin(phase)) * (0.012 + run * 0.035);
      const breathe = idle ? Math.sin(time * 1.5 + i * 0.7) * 0.008 : 0;
      const lean = down ? 0 : -(0.02 + run * 0.17 + (amp > 0 ? 0.03 : 0));
      const baseY = y - bob + breathe;

      pose(parts.torso, i, x, z, baseY, ang, tilt, 0, 1.16, 0, 0, lean);
      pose(parts.hips, i, x, z, baseY, ang, tilt, 0, 0.82, 0, 0, lean);
      pose(parts.neck, i, x, z, baseY, ang, tilt, 0, 1.5, 0, 0, lean);
      pose(parts.head, i, x, z, baseY, ang, tilt, 0, 1.63, 0.01, 0, lean);
      pose(parts.hair, i, x, z, baseY, ang, tilt, 0, 1.665, 0.005, 0, lean);

      const hipY = 0.72, shoulderY = 1.44;
      const legSwing = 0.62 * sw;
      const armSwing = 0.55 * sw;
      limb(parts.legL, i, x, z, baseY, ang, tilt, -0.12, hipY, 0, 0.34, legSwing, lean);
      limb(parts.legR, i, x, z, baseY, ang, tilt, 0.12, hipY, 0, 0.34, -legSwing, lean);
      limb(parts.bootL, i, x, z, baseY, ang, tilt, -0.12, hipY, 0, 0.68, legSwing, lean, 0.06);
      limb(parts.bootR, i, x, z, baseY, ang, tilt, 0.12, hipY, 0, 0.68, -legSwing, lean, 0.06);
      limb(parts.armL, i, x, z, baseY, ang, tilt, -0.29, shoulderY, 0, 0.29, -armSwing, lean);
      limb(parts.armR, i, x, z, baseY, ang, tilt, 0.29, shoulderY, 0, 0.29, armSwing, lean);
      limb(parts.handL, i, x, z, baseY, ang, tilt, -0.29, shoulderY, 0, 0.6, -armSwing, lean);
      limb(parts.handR, i, x, z, baseY, ang, tilt, 0.29, shoulderY, 0, 0.6, armSwing, lean);
    };

    const poseGuard = (i: number, g: (typeof sim.guards)[number]) => {
      const down = g.state === 'down';
      const tilt = down ? (g.tilt || 1.4) : 0;
      const gait = down ? 0 : g.gait || 0;
      animate(gBody, i, g.x, g.z, g.y, g.ang, tilt, g.limb || 0, gait, sim.time, down);
      const lean = down ? 0 : -(0.02 + clamp01((gait - 2.2) / 2) * 0.17);
      // belt, buckle, pouches, cuffs, patches, badge and baton ride on the tunic
      pose(gBelt, i, g.x, g.z, g.y, g.ang, tilt, 0, 0.95, 0, 0, lean);
      pose(gBuckle, i, g.x, g.z, g.y, g.ang, tilt, 0, 0.95, 0.16, 0, lean);
      pose(gPouchL, i, g.x, g.z, g.y, g.ang, tilt, -0.19, 0.95, 0.13, 0, lean);
      pose(gPouchR, i, g.x, g.z, g.y, g.ang, tilt, 0.19, 0.95, 0.13, 0, lean);
      pose(gCuffA, i, g.x, g.z, g.y, g.ang, tilt, 0.16, 0.9, 0.17, 0, lean);
      pose(gCuffB, i, g.x, g.z, g.y, g.ang, tilt, 0.22, 0.88, 0.17, 0, lean);
      pose(gPatchL, i, g.x, g.z, g.y, g.ang, tilt, -0.2, 1.41, 0.02, 0, lean);
      pose(gPatchR, i, g.x, g.z, g.y, g.ang, tilt, 0.2, 1.41, 0.02, 0, lean);
      pose(gBadge, i, g.x, g.z, g.y, g.ang, tilt, -0.13, 1.32, 0.15, 0, lean);
      pose(gBaton, i, g.x, g.z, g.y, g.ang, tilt, -0.26, 0.82, 0.1, 0, lean);
    };

    const poseInmate = (i: number, n: (typeof sim.inmates)[number]) => {
      const down = n.state === 'down';
      const tilt = down ? (n.tilt || 1.4) : 0;
      animate(iBody, i, n.x, n.z, n.y, n.ang, tilt, n.limb || 0, down ? 0 : n.gait || 0, sim.time, down);
    };

    /* ---------------- player weapon ---------------- */
    const weapon = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.42), matMetal);
    gunBody.position.set(0, 0, -0.1);
    const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.9 }));
    gunGrip.position.set(0, -0.14, 0.06); gunGrip.rotation.x = 0.35;
    weapon.add(gunBody, gunGrip);
    weapon.position.set(0.28, -0.24, -0.5);
    camera.add(weapon);
    scene.add(camera);

    const muzzle = new THREE.PointLight(0xffcf8a, 0, 12, 2);
    camera.add(muzzle);
    muzzle.position.set(0.28, -0.16, -0.9);

    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0.9 });
    const tracers: { line: THREE.Line; life: number }[] = [];

    const flashLight = new THREE.SpotLight(0xfff2cc, 0, 46, 0.44, 0.5, 1.6);
    flashLight.position.set(0, 0.2, 0);
    camera.add(flashLight);
    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, 0.05, -12);
    camera.add(flashTarget);
    flashLight.target = flashTarget;

    const addTracer = (x: number, z: number, y: number) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(camera.position.x, camera.position.y - 0.12, camera.position.z),
        new THREE.Vector3(x, y, z),
      ]);
      const line = new THREE.Line(geo, tracerMat);
      scene.add(line);
      tracers.push({ line, life: 0.09 });
    };

    /* ---------------- reaching for a lever ---------------- */
    const aimV = new THREE.Vector3();
    const aimDir = new THREE.Vector3();
    const aimedLever = () => {
      camera.getWorldDirection(aimDir);
      let best: (typeof sim.levers)[number] | null = null;
      let bestDot = 0.972;
      for (const l of sim.levers) {
        if (l.pulled) continue;
        aimV.set(l.x - camera.position.x, l.y - camera.position.y, l.z - camera.position.z);
        const d = aimV.length();
        if (d > 4.2) continue;
        aimV.multiplyScalar(1 / d);
        const dot = aimV.dot(aimDir);
        if (dot > bestDot) { bestDot = dot; best = l; }
      }
      return best;
    };

    /* ---------------- input ---------------- */
    const keys: Record<string, boolean> = {};
    let firing = false;
    const onKeyDown = (e: KeyboardEvent) => {
      audio.ensure();
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'm' || e.key === 'M') audio.setMuted(!audio.muted);
      if (e.key === 'e' || e.key === 'E') {
        const b = sim.useButton();
        if (!b) {
          const c = sim.lockNear;
          if (c) sim.damageLock(c, 60);
        }
      }
      if (e.key === 'r' || e.key === 'R') sim.reload();
      if (e.key === 'f' || e.key === 'F') sim.flashlight = !sim.flashlight;
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    // Pointer lock is the good path. Sandboxed iframes (the preview pane) block it,
    // so dragging with the button held also aims — the prison is still playable there.
    let dragging = false;
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === renderer.domElement) { sim.look(e.movementX, e.movementY); return; }
      if (dragging) sim.look(e.movementX, e.movementY);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      audio.ensure();
      if (document.pointerLockElement !== renderer.domElement) {
        dragging = true;
        try { void renderer.domElement.requestPointerLock(); } catch { /* ignore */ }
      }
      firing = true;
      // Clicking a lever throws it; clicking anything else is a shot. The lever wins,
      // so the master release cannot be triggered by accident while shooting at guards.
      if (!aimedLever()) shoot();
    };
    const onMouseUp = () => { firing = false; dragging = false; };
    const shoot = () => {
      const shot = sim.fire();
      if (shot.hit !== 'nothing') addTracer(shot.x, shot.z, shot.y);
    };
    const onLockChange = () => setLocked(document.pointerLockElement === renderer.domElement);
    const onResize = () => {
      const w = hostEl.clientWidth || 1280, h = hostEl.clientHeight || 720;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerlockchange', onLockChange);

    /* ---------------- loop ---------------- */
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let autoFireT = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (intro > 0) setIntro((v) => Math.max(0, v - dt * 0.42));

      // input → sim
      const fwd = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
      const strafe = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
      sim.update(dt, { fwd, strafe, sprint: !!keys['shift'] });

      // levers first: holding the button on a handle throws it, and nothing is fired
      const aimed = aimedLever();
      const nearHatch = !sim.hatch.open && Math.hypot(sim.hatch.x - sim.px, sim.hatch.z - sim.pz) < 2.6;
      if (aimed) {
        sim.pullLever(aimed.id, dt, firing);
      } else if (nearHatch) {
        // the only way out of the workshop: hold the button and haul on the grate
        sim.pryHatch(dt, firing || !!keys['e']);
      } else if (firing) {
        autoFireT -= dt;
        const rate = sim.spec.cool;
        if (autoFireT <= 0) {
          autoFireT = rate;
          if (sim.cool <= 0) {
            if (sim.mag <= 0 && sim.reserve <= 0) audio.dryFire();
            shoot();
          }
        }
      }

      // ---- sound: the simulation's events, drained once per frame ----
      for (const ev of sim.events) {
        const d = Math.hypot(ev.x - sim.px, ev.z - sim.pz);
        const near = Math.max(0, 1 - d / 70);
        switch (ev.kind) {
          case 'shot': audio.shot(sim.weapon); break;
          case 'reload': audio.reload(); break;
          case 'break': audio.steel('lock'); break;
          case 'hit': audio.scrape(); break;
          case 'sally': audio.steel('gate'); break;
          case 'hatch': audio.steel('gate'); break;
          case 'pickup': audio.pickup(); break;
          case 'cuff': audio.cuff(); break;
          case 'down': audio.thud(); break;
          case 'shout': if (near > 0.05) audio.shout(d); break;
          case 'alarm': audio.steel('lever'); break;
          case 'open-all': audio.steel('gate'); break;
          case 'armory': audio.steel('lever'); break;
          case 'exit': audio.pickup(); break;
          default: break;
        }
      }
      sim.events.length = 0;

      // boots, siren and room tone
      const onFoot = (!!keys['w'] || !!keys['a'] || !!keys['s'] || !!keys['d']
        || !!keys['arrowup'] || !!keys['arrowdown'] || !!keys['arrowleft'] || !!keys['arrowright']) && sim.cuffed <= 0;
      audio.update(dt, {
        moving: onFoot, sprint: !!keys['shift'], siren: sim.siren,
        lightsOut: sim.lightsOut, volume: 1,
      });

      // loot you picked up stops being drawn; the grate lid lifts when it gives way
      for (const l of loot) l.group.visible = !l.take();
      hatchLid.position.y = sim.hatch.progress * 0.45;
      hatchLid.position.x = sim.hatch.progress * 1.5;
      hatchLid.rotation.z = sim.hatch.progress * 0.5;
      ladder.visible = sim.hatch.open;
      // the gun in your hands grows when you pick a rifle up
      const wscale = sim.weapon === 'carbine' ? 1.75 : sim.weapon === 'shotgun' ? 1.5 : sim.weapon === 'smg' ? 1.25 : 1;
      gunBody.scale.set(1, 1, wscale);
      // handles swing with their progress, lamps go green when thrown
      for (const lv of leverHandles) {
        const st = sim.levers.find((q) => q.id === lv.id);
        if (!st) continue;
        const target = st.pulled ? -1.35 : -0.55 - st.progress * 0.8;
        lv.handle.rotation.x += (target - lv.handle.rotation.x) * Math.min(1, dt * 8);
        const lampMat = lv.lamp.material as THREE.MeshBasicMaterial;
        lampMat.color.setHex(st.pulled ? 0x53f08a : st.id === 'master' ? 0xffb347 : 0x62e0ff);
      }
      // sirens: red beacons breathe with the alarm level, and the bulbs answer them
      const pulse = 0.55 + 0.45 * Math.sin(sim.time * 7);
      beacons.forEach((b) => { b.intensity = sim.siren * 26 * pulse; });
      const hot = 0.5 + 0.5 * Math.sin(sim.time * 7);
      const glow = 0.28 + 0.72 * hot;
      bulbMat.color.setRGB(0.42 + 0.58 * glow, 0.05 + 0.16 * glow, 0.04 + 0.12 * glow);
      // the wet floor carries the red light too, and the tubes go cold in a blackout
      streakMatRed.opacity = (sim.siren > 0.05 ? 0.16 + 0.34 * sim.siren * hot : 0.05);
      streakMatWhite.opacity = sim.lightsOut ? 0.05 : 0.5;
      matLamp.color.setHex(sim.lightsOut ? 0x2b3136 : 0xe4f2ff);

      if (sim.phase === 'escaped' && !finished.current) {
        finished.current = true;
        exitRef.current(sim.stats, true);
      }

      // camera
      camera.position.set(sim.px, sim.py, sim.pz);
      const cp = Math.cos(sim.pitch);
      camera.lookAt(
        sim.px + Math.cos(sim.yaw) * cp * 12,
        sim.py + Math.sin(sim.pitch) * 12,
        sim.pz + Math.sin(sim.yaw) * cp * 12,
      );
      // head bob
      camera.position.y = sim.py + Math.sin(sim.time * 8) * 0.012 * (fwd || strafe ? 1 : 0.2);
      weapon.position.z = -0.5 + Math.sin(sim.time * 7) * 0.006;
      weapon.rotation.x = sim.flash > 0 ? -0.22 : 0;

      // lamps: nearest pool to the player
      const near = lampSpots
        .map((p) => ({ p, d: p.distanceToSquared(camera.position) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, lights.length);
      lights.forEach((l, i) => {
        const s = near[i];
        if (!s) { l.intensity = 0; return; }
        l.position.copy(s.p);
        l.intensity = sim.lightsOut ? 1.6 : 16;
      });
      // red fixtures: the nearest ones get real light, so the bars catch the glow
      const nearStrobe = strobeSpots
        .map((s) => ({ s, d: (s.x - sim.px) ** 2 + (s.z - sim.pz) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, redLights.length);
      redLights.forEach((l, i) => {
        const n2 = nearStrobe[i];
        if (!n2) { l.intensity = 0; return; }
        l.position.set(n2.s.x, n2.s.y, n2.s.z);
        l.intensity = (0.9 + 7.5 * sim.siren) * (0.6 + 0.4 * hot);
      });
      flashLight.intensity = sim.flashlight ? 34 : 0;
      muzzle.intensity = sim.flash > 0 ? 26 : 0;

      // bodies: full figures, walk cycles, ragdolls
      sim.guards.forEach((g, i) => poseGuard(i, g));
      sim.inmates.forEach((n, i) => {
        // only pose bodies near the camera: three hundred cells are not worth the matrices
        if (Math.abs(n.x - sim.px) > 62 || Math.abs(n.z - sim.pz) > 62) {
          m4.makeScale(0, 0, 0);
          for (const part of Object.values(iBody)) part.setMatrixAt(i, m4);
          return;
        }
        poseInmate(i, n);
      });
      for (const m of Object.values(gBody)) m.instanceMatrix.needsUpdate = true;
      for (const m of [gBelt, gBuckle, gPouchL, gPouchR, gCuffA, gCuffB, gPatchL, gPatchR, gBadge, gBaton]) {
        m.instanceMatrix.needsUpdate = true;
      }
      for (const m of Object.values(iBody)) m.instanceMatrix.needsUpdate = true;

      // loose junk: only pieces that moved are re-posed, and only near ones are drawn
      sim.debris.forEach((d, i) => {
        const key = i * 4;
        const near = Math.abs(d.x - sim.px) <= 46 && Math.abs(d.z - sim.pz) <= 46;
        if (debrisPose[key] === d.x && debrisPose[key + 1] === d.z && debrisPose[key + 2] === d.y
          && debrisPose[key + 3] === d.rot && debrisShown[i] === (near ? 1 : 0)) return;
        debrisPose[key] = d.x; debrisPose[key + 1] = d.z; debrisPose[key + 2] = d.y; debrisPose[key + 3] = d.rot;
        debrisShown[i] = near ? 1 : 0;
        if (!near) { debrisMesh.setMatrixAt(i, hideM); return; }
        debrisE.set(d.tilt, d.rot, d.tilt * 0.6);
        debrisQ.setFromEuler(debrisE);
        const sc = d.size;
        debrisS.set(sc, d.kind === 3 ? sc * 0.45 : d.kind === 0 ? sc * 0.12 : sc * 0.6, sc);
        debrisP.set(d.x, d.y + sc * 0.5, d.z);
        m4.compose(debrisP, debrisQ, debrisS);
        debrisMesh.setMatrixAt(i, m4);
        debrisDirty = true;
      });
      if (debrisDirty) { debrisMesh.instanceMatrix.needsUpdate = true; debrisDirty = false; }

      // locks vanish when their cell opens; bars stay but the doorway is passable
      sim.cells.forEach((c) => {
        const open = c.opened ? 0 : 1;
        m4.compose(new THREE.Vector3(c.x, 1.15 * 1, c.z + c.face * (CELL_D / 2) + c.face * 0.12), q.identity(), new THREE.Vector3(open, open, open));
        locks.setMatrixAt(c.id, m4);
      });
      locks.instanceMatrix.needsUpdate = true;
      if (gateMesh) gateMesh.visible = !sim.sallyOpen;

      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers[i].line.geometry.dispose(); tracers.splice(i, 1); }
      }

      renderer.render(scene, camera);

      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.18;
        const sum = sim.summary;
        const compass = [
          ...(sum.opened === 0 ? [{ label: 'BARS', ang: Math.atan2(sim.cells[sim.homeCell].z - sim.pz, sim.cells[sim.homeCell].x - sim.px) }] : []),
          ...sim.levers.filter((l) => !l.pulled).map((l) => ({ label: l.id === 'master' ? 'MASTER' : l.id.toUpperCase(), ang: Math.atan2(l.z - sim.pz, l.x - sim.px) })),
          { label: 'SALLY', ang: Math.atan2(108 - sim.pz, 0 - sim.px) },
        ].map((m) => ({ label: m.label, angle: m.ang - sim.yaw, dist: 0 }));
        setScreen({
          hp: Math.max(0, Math.round(sim.hp)), armor: Math.round(sim.armor),
          mag: sim.mag, magSize: sim.magSize, reserve: sim.reserve, reloading: sim.reloading > 0,
          alarm: Math.max(sim.alarm, sim.siren),
          prompt: (() => {
            const l = sim.leverNear;
            if (l) return l.pulled ? '' : `HOLD LEFT MOUSE · ${l.label}${l.progress > 0.01 ? `  ${Math.round(l.progress * 100)}%` : ''}`;
            if (sim.inControlRoom) return 'CONTROL ROOM · FIND THE MASTER HANDLE';
            if (!sim.hatch.open && Math.hypot(sim.hatch.x - sim.px, sim.hatch.z - sim.pz) < 2.6) {
              return `HOLD LEFT MOUSE · PRY THE SERVICE GRATE${sim.hatch.progress > 0.01 ? `  ${Math.round(sim.hatch.progress * 100)}%` : ''}`;
            }
            return sim.lockNear ? 'SHOOT THE LOCK' : '';
          })(),
          message: sim.message, messageT: sim.messageT,
          cells: sum.opened, free: sum.free, guards: sum.guards, sally: sum.sallyOpen,
          lights: sim.lightsOut, compass, stats: { ...sim.stats }, flashlight: sim.flashlight,
          weapon: sim.spec.name, cuffed: sim.cuffed, muted: audio.muted,
          hatchNear: !sim.hatch.open && Math.hypot(sim.hatch.x - sim.px, sim.hatch.z - sim.pz) < 2.6,
          hatchProgress: sim.hatch.progress,
        });
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      scene.traverse((o) => {
        const any = o as THREE.Mesh;
        if (any.geometry) any.geometry.dispose();
        const mat = (any as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
      audio.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      hostEl.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- HUD ---------------- */
  return (
    <div className="absolute inset-0 z-30 bg-black">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 select-none font-mono text-[#d6e6e6]">
        {/* vignette */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 70px rgba(0,0,0,0.72)' }} />
        {/* siren wash: the whole frame reddens with the alarm */}
        {screen.alarm > 0.15 && (
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(255,40,40,0) 35%, rgba(255,30,30,0.30) 100%)',
              opacity: 0.35 + screen.alarm * 0.5,
            }}
          />
        )}

        {/* wake-up cinematic */}
        {intro > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-black transition-opacity" style={{ opacity: Math.min(1, intro) }}>
            <div className="text-center">
              <p className="text-[11px] tracking-[0.4em] text-[#7fb6c4]">HYDRA CORRECTIONAL FACILITY · NORTH ATLANTIC</p>
              <h1 className="mt-3 text-4xl font-black tracking-[0.2em] text-[#e7f6f6]">THE CAGE</h1>
              <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-[#9fb6b8]">
                {mode === 'arrest'
                  ? 'You wake on a steel bunk with a split lip. Somewhere in the processing they missed the sidearm — it is still in your waistband.'
                  : 'You came in through the sally port with a stolen pass and a smuggled pistol. Nobody has noticed yet.'}
              </p>
              <p className="mt-4 text-[11px] tracking-[0.3em] text-[#d8b45a]">SHOOT THE LOCK · FIGHT INTO CONTROL A · HOLD THE MASTER HANDLE</p>
              <p className="mt-1 text-[10px] tracking-[0.2em] text-[#7f9aa0]">THE MASTER RELEASE IS A LEVER, NOT A BUTTON — AIM AT IT AND HOLD LEFT MOUSE</p>
            </div>
          </div>
        )}

        {/* crosshair */}
        <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-0 h-full w-[1px] -translate-x-1/2 bg-[#b8f6ff88]" />
          <div className="absolute top-1/2 left-0 h-[1px] w-full -translate-y-1/2 bg-[#b8f6ff88]" />
        </div>

        {/* top status */}
        <div className="absolute left-6 top-5 space-y-1">
          <p className="text-[10px] tracking-[0.35em] text-[#79b3c1]">HYDRA PRISON · CELL BLOCK 8</p>
          <div className="flex items-center gap-3">
            <span className="text-[22px] font-black text-[#ff7f7f]">{screen.hp}</span>
            <span className="text-[10px] text-[#8fa8ab]">HP</span>
            {screen.armor > 0 && <span className="text-[12px] text-[#8fd8ff]">+{screen.armor} ARMOR</span>}
          </div>
          <div className="h-1.5 w-56 bg-[#0d1a1e]">
            <div className="h-full bg-[#ff6b6b]" style={{ width: `${screen.hp}%` }} />
          </div>
          <p className="text-[10px] tracking-[0.25em] text-[#9fb6b8]">
            CELLS OPEN {screen.cells}/360 · INMATES OUT {screen.free} · GUARDS UP {screen.guards}
          </p>
        </div>

        {/* alarm */}
        {screen.alarm > 0.2 && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-[#ff6b6b55] bg-[#2a0b0bbb] px-4 py-1 text-[11px] tracking-[0.3em] text-[#ff9a9a]">
            SIRENS · ALARM {Math.round(screen.alarm * 100)}%
          </div>
        )}

        {/* compass strip */}
        <div className="absolute left-1/2 top-16 flex -translate-x-1/2 gap-4 text-[10px] tracking-[0.2em]">
          {screen.compass.slice(0, 4).map((c, i) => {
            const a = Math.atan2(Math.sin(c.angle), Math.cos(c.angle));
            const x = Math.max(-70, Math.min(70, (a / Math.PI) * 90));
            return (
              <span key={i} className="text-[#8fd8c4]" style={{ transform: `translateX(${x}px)` }}>
                {a < -2.6 || a > 2.6 ? '▲' : a < -0.5 ? '◀' : a > 0.5 ? '▶' : '▼'} {c.label}
              </span>
            );
          })}
        </div>

        {/* cuffed: hands behind the back, the block recedes */}
        {screen.cuffed > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#12070acc]">
            <div className="text-center">
              <p className="text-[34px] font-black tracking-[0.35em] text-[#e8b3a0]">CUFFED</p>
              <p className="mt-2 text-[11px] tracking-[0.3em] text-[#c09484]">
                WALKED BACK TO YOUR CELL · THE LOCK IS NEW
              </p>
            </div>
          </div>
        )}

        {/* centre prompt / message */}
        {screen.messageT > 0 && (
          <div className="absolute left-1/2 top-[26%] w-[560px] -translate-x-1/2 border-l-2 border-[#d8b45a] bg-[#0b1417dd] px-4 py-2 text-[12px] leading-relaxed text-[#e8e0c6]">
            {screen.message}
          </div>
        )}
        {screen.prompt && (
          <div className="absolute left-1/2 top-[62%] -translate-x-1/2 rounded border border-[#8fd8c455] bg-[#08161add] px-4 py-1.5 text-[12px] tracking-[0.2em] text-[#b8f6ff]">
            {screen.prompt}
          </div>
        )}

        {/* ammo */}
        <div className="absolute bottom-6 right-7 text-right">
          <p className="text-[26px] font-black text-[#e7f6f6]">
            {screen.reloading ? 'RELOAD' : `${screen.mag}`}
            <span className="ml-1 text-[12px] text-[#8fa8ab]">/ {screen.magSize}</span>
          </p>
          <p className="text-[10px] tracking-[0.25em] text-[#8fa8ab]">RESERVE {screen.reserve} · {screen.weapon}</p>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-[#6f8f93]">
            {screen.flashlight ? 'FLASHLIGHT ON' : 'F · FLASHLIGHT'} · R · RELOAD · {screen.muted ? 'M · SOUND OFF' : 'M · SOUND ON'}
          </p>
        </div>

        {/* objective */}
        <div className="absolute bottom-6 left-7 max-w-[380px] text-[10px] leading-relaxed tracking-[0.18em] text-[#93aeb0]">
          <p className="text-[#d8b45a]">OBJECTIVE</p>
          {screen.cells === 0 && <p>1 · SHOOT THE LOCK ON YOUR BARS (3 HITS)</p>}
          {!screen.sally && <p>2 · TWO WAYS OUT: CONTROL B → SALLY PORT, OR THE WORKSHOP FLOOR GRATE</p>}
          <p>3 · {screen.cells < 320 ? 'CONTROL A · MASTER RELEASE (OPTIONAL MAYHEM)' : 'GET OUT THROUGH THE SOUTH GATE'}</p>
          <p>4 · ARMORY · CARBINE, SHOTGUN, SMG + AMMUNITION</p>
          {screen.sally && <p className="text-[#8fffc4]">SALLY PORT OPEN — RUN SOUTH</p>}
          {screen.cuffed > 0 && <p className="text-[#e8b3a0]">CUFFED — WAIT FOR THE CELL DOOR</p>}
        </div>

        {!locked && (
          <div className="absolute left-1/2 top-[46%] -translate-x-1/2 rounded border border-[#8fd8c455] bg-[#08161add] px-4 py-2 text-[11px] tracking-[0.25em] text-[#b8f6ff]">
            CLICK TO AIM · WASD MOVE · E INTERACT · ESC RELEASES MOUSE
            <span className="mt-1 block text-[9px] tracking-[0.18em] text-[#7fb6c4]">IF THE MOUSE WILL NOT LOCK: HOLD THE LEFT BUTTON AND DRAG TO LOOK</span>
          </div>
        )}
      </div>

      <button
        onClick={() => { setFlashTap(true); setTimeout(() => setFlashTap(false), 400); }}
        className={`absolute right-4 top-4 z-40 rounded border border-[#8fd8c455] bg-[#08161add] px-3 py-1 text-[10px] tracking-[0.2em] text-[#b8f6ff] ${flashTap ? 'opacity-40' : ''}`}
      >
        HELP
      </button>
      {flashTap && (
        <div className="pointer-events-none absolute right-4 top-14 z-40 w-64 border border-[#8fd8c455] bg-[#041013ee] p-3 text-[10px] leading-relaxed text-[#c9dcdc]">
          Shoot the gold lock on any cell door to free the inmate behind it. Control A holds the master release:
          it opens all 360 cells. Control B opens the sally port — that is your way back to the surface.
          E uses buttons, R reloads, F toggles the flashlight.
        </div>
      )}
    </div>
  );
}
