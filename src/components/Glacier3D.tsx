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

    /* ---------------- renderer, camera, light ---------------- */
    const W = el.clientWidth || 1280;
    const H = el.clientHeight || 720;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(W, H);
    renderer.setClearColor(0xbfe4f2, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Bright enough to read as ice, hazy enough that the far end glows instead of cutting.
    scene.fog = new THREE.FogExp2(0xcfeaf6, 0.0075);
    const camera = new THREE.PerspectiveCamera(76, W / H, 0.1, 600);

    scene.add(new THREE.AmbientLight(0xdff3ff, 0.75));
    scene.add(new THREE.HemisphereLight(0xf2fbff, 0x9dc7d8, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(-60, 140, 40);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.7);
    rim.position.set(80, 60, -160);
    scene.add(rim);

    /* ---------------- procedural ice ---------------- */
    const cv = (size: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      return { c, g: c.getContext('2d')! };
    };
    const iceTex = (repeat: number, cold = true) => {
      const { c, g } = cv(512);
      g.fillStyle = cold ? '#e8f6fc' : '#dceef6';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 260; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 8 + Math.random() * 70;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(${cold ? '172,214,238' : '190,225,242'},${0.05 + Math.random() * 0.12})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // veins and fracture lines: an ice sheet is all edges
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = `rgba(${cold ? '120,180,210' : '140,195,220'},${0.05 + Math.random() * 0.16})`;
        g.lineWidth = 0.6 + Math.random() * 1.6;
        g.beginPath();
        let x = Math.random() * 512, y = Math.random() * 512;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (Math.random() - 0.5) * 120;
          y += (Math.random() - 0.5) * 120;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };

    const wallMat = new THREE.MeshStandardMaterial({
      map: iceTex(6), color: 0xf2fbff, roughness: 0.32, metalness: 0.04,
      emissive: 0x9fd6ea, emissiveIntensity: 0.16,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: iceTex(10, false), color: 0xffffff, roughness: 0.22, metalness: 0.08,
      emissive: 0xa8dcec, emissiveIntensity: 0.10,
    });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xdff1f9, roughness: 0.6, emissive: 0x9fd2e6, emissiveIntensity: 0.2 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x8e9c9e, roughness: 0.55, metalness: 0.6 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xbdf2ff, emissive: 0x66d8ff, emissiveIntensity: 1.6, roughness: 0.25,
    });

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALF * 2, HALL_MAX_Z - HALL_MIN_Z), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (HALL_MIN_Z + HALL_MAX_Z) / 2);
    scene.add(floor);
    // ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALF * 2, HALL_MAX_Z - HALL_MIN_Z), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 32, (HALL_MIN_Z + HALL_MAX_Z) / 2);
    scene.add(ceil);
    // side walls
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 36, HALL_MAX_Z - HALL_MIN_Z), wallMat);
      wall.position.set(side * HALL_HALF, 17, (HALL_MIN_Z + HALL_MAX_Z) / 2);
      scene.add(wall);
    }
    // the far wall of the vault
    const farWall = new THREE.Mesh(new THREE.BoxGeometry(HALL_HALF * 2, 36, 4), wallMat);
    farWall.position.set(0, 17, HALL_MIN_Z);
    scene.add(farWall);
    /* THE GATE END.
     *
     * The vault has to let something bigger than a man out: the Frostwing launches down
     * the hall and out through a 30-unit opening in the gate wall, so that wall is built
     * as two shoulders and a lintel with daylight behind them.
     */
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(HALL_HALF - 15, 36, 4), wallMat);
      shoulder.position.set(side * (HALL_HALF / 2 + 7.5), 17, HALL_MAX_Z);
      scene.add(shoulder);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(30, 17, 4), wallMat);
    lintel.position.set(0, 27.5, HALL_MAX_Z);
    scene.add(lintel);
    // daylight beyond the gate: the ice shelf outside, the brightest thing in the room
    const daylight = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 19),
      new THREE.MeshBasicMaterial({ color: 0xe6f8ff }),
    );
    daylight.position.set(0, 9.5, HALL_MAX_Z - 3);
    daylight.rotation.y = Math.PI;
    scene.add(daylight);
    // the gate itself: two frozen leaves meeting on a lit seam
    const gateSeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 19, 0.6), glowMat);
    gateSeam.position.set(0, 9.5, HALL_MAX_Z - 2);
    scene.add(gateSeam);
    const gateLeaves: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(15.6, 19, 2.2), wallMat);
      leaf.position.set(side * 7.8, 9.5, HALL_MAX_Z - 1.4);
      scene.add(leaf);
      gateLeaves.push(leaf);
    }

    /* the launch rail: a lit centreline from the frost bay to the gate */
    const rail = new THREE.Mesh(
      new THREE.PlaneGeometry(9, HALL_MAX_Z - HALL_MIN_Z - 30),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ea, emissive: 0x4fb4d8, emissiveIntensity: 0.5, roughness: 0.5 }),
    );
    rail.rotation.x = -Math.PI / 2;
    rail.position.set(0, 0.06, (HALL_MAX_Z + HALL_MIN_Z) / 2 - 8);
    scene.add(rail);
    for (let z = HALL_MIN_Z + 24; z < HALL_MAX_Z - 10; z += 16) {
      for (const side of [-1, 1]) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), glowMat);
        stud.position.set(side * 5.2, 0.2, z);
        scene.add(stud);
      }
    }

    /* THE HANGAR GANTRY.
     * A worked base, not a cave: a steel walkway down the east wall with railings, two
     * lit bays and the division's banners hanging off it.
     */
    const gantryX = HALL_HALF - 9;
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 190), steelMat);
    gantry.position.set(gantryX, 11, -120);
    scene.add(gantry);
    for (let i = 0; i <= 8; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11, 0.4), steelMat);
      post.position.set(gantryX - 4, 5.5, -30 - i * 23);
      scene.add(post);
    }
    for (let i = 0; i < 36; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), steelMat);
      bar.position.set(gantryX - 4, 12, -28 - i * 5.2);
      scene.add(bar);
    }
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 190), steelMat);
    rail2.position.set(gantryX - 4, 12.7, -120);
    scene.add(rail2);
    for (const bz of [-64, -150]) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 12),
        new THREE.MeshStandardMaterial({ color: 0x5f8fa8, emissive: 0x2c6076, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
      );
      banner.position.set(gantryX - 6, 17, bz);
      banner.rotation.y = Math.PI / 2;
      scene.add(banner);
    }
    for (const lz of [-52, -120, -196]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), glowMat);
      lamp.position.set(gantryX - 5, 14.5, lz);
      scene.add(lamp);
    }

    // ice pillars down both sides, and crystal formations that catch the light
    const pillarGeo = new THREE.CylinderGeometry(2.6, 3.6, 26, 7);
    const crystalGeo = new THREE.ConeGeometry(2.2, 9, 5);
    for (let i = 0; i < 14; i++) {
      const z = -6 - i * 21;
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(pillarGeo, wallMat);
        p.position.set(side * (HALL_HALF - 12), 13, z);
        p.rotation.y = i * 0.7;
        scene.add(p);
        for (let k = 0; k < 3; k++) {
          const cr = new THREE.Mesh(crystalGeo, glowMat);
          cr.position.set(side * (HALL_HALF - 20 - k * 4), 1.6 + k * 1.4, z + 6 - k * 5);
          cr.rotation.z = (Math.random() - 0.5) * 0.5;
          cr.scale.setScalar(0.5 + Math.random() * 0.6);
          scene.add(cr);
        }
      }
    }

    // hanging icicles from the ceiling
    const icicleGeo = new THREE.ConeGeometry(0.7, 6, 5);
    for (let i = 0; i < 90; i++) {
      const ic = new THREE.Mesh(icicleGeo, glowMat);
      ic.position.set((Math.random() - 0.5) * (HALL_HALF * 1.7), 30 - Math.random() * 2,
        HALL_MAX_Z - Math.random() * (HALL_MAX_Z - HALL_MIN_Z));
      ic.rotation.z = Math.PI;
      ic.scale.setScalar(0.4 + Math.random() * 1.5);
      scene.add(ic);
    }

    /* ---------------- lights down the hall ---------------- */
    const lampGeo = new THREE.SphereGeometry(1.5, 10, 8);
    for (let i = 0; i < 9; i++) {
      const z = 4 - i * 36;
      const lamp = new THREE.Mesh(lampGeo, glowMat);
      lamp.position.set(0, 21, z);
      scene.add(lamp);
      const pl = new THREE.PointLight(0xd6f4ff, 26, 130, 2);
      pl.position.set(0, 18, z);
      scene.add(pl);
    }

    /* ---------------- snow drifting in the air ---------------- */
    const snowCount = 900;
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * HALL_HALF * 2;
      snowPos[i * 3 + 1] = Math.random() * 26;
      snowPos[i * 3 + 2] = HALL_MAX_Z - Math.random() * (HALL_MAX_Z - HALL_MIN_Z);
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.34, transparent: true, opacity: 0.75, depthWrite: false,
    }));
    scene.add(snow);

    /* ---------------- figures ---------------- */
    const makeFigure = (colours: { coat: number; helmet: number; visor: number }, hostile: boolean) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.52, 1.05, 4, 10),
        new THREE.MeshStandardMaterial({ color: colours.coat, roughness: 0.75, metalness: 0.1 }),
      );
      body.position.y = 1.15;
      g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xe8d9c4, roughness: 0.8 }),
      );
      head.position.y = 2.03;
      g.add(head);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7),
        new THREE.MeshStandardMaterial({ color: colours.helmet, roughness: 0.6, metalness: 0.25 }),
      );
      helmet.position.y = 2.09;
      g.add(helmet);
      if (hostile) {
        const visor = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.12, 0.1),
          new THREE.MeshStandardMaterial({ color: colours.visor, emissive: colours.visor, emissiveIntensity: 2 }),
        );
        visor.position.set(0, 2.02, -0.3);
        g.add(visor);
      }
      // rifle
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 1.1), steelMat);
      rifle.position.set(0.36, 1.32, -0.5);
      g.add(rifle);
      // shield for the escort platoon: a slab of pale alloy
      if (!hostile) {
        const shield = new THREE.Mesh(
          new THREE.BoxGeometry(1.05, 1.35, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xdff2ff, roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.86 }),
        );
        shield.position.set(-0.62, 1.3, -0.42);
        g.add(shield);
      }
      return g;
    };

    const colliders: { x: number; z: number; r: number }[] = [];
    for (let i = 0; i < 14; i++) for (const side of [-1, 1]) colliders.push({ x: side * (HALL_HALF - 12), z: -6 - i * 21, r: 3.6 });
    // the gantry legs are solid too
    for (let i = 0; i <= 8; i++) colliders.push({ x: HALL_HALF - 13, z: -30 - i * 23, r: 2.2 });

    /* hostiles: an ice guard battalion spread down the hall */
    const foes: Foe[] = [];
    for (let i = 0; i < 22; i++) {
      const row = Math.floor(i / 4);
      const mesh = makeFigure({ coat: 0x2b3a4d, helmet: 0x8fd8ff, visor: 0x8ff0ff }, true);
      const x = -30 + (i % 4) * 20 + (row % 2) * 6;
      const z = -46 - row * 32;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      foes.push({ mesh, x, z, hp: 90, maxHp: 90, cool: Math.random() * 2, alive: true, phase: Math.random() * 6 });
    }

    /* escorts: the twenty frozen shield troopers, in winter camouflage */
    const escorts: Escort[] = [];
    for (let i = 0; i < 20; i++) {
      const mesh = makeFigure({ coat: 0xd8e6ee, helmet: 0xe9f4f8, visor: 0x8ff0ff }, false);
      mesh.visible = false;
      scene.add(mesh);
      escorts.push({ mesh, x: 0, z: 0, hp: 120, maxHp: 120, cool: 0, alive: true, slot: i, flash: 0 });
    }

    /* ---------------- the two aircraft wells ---------------- */
    const wells: { z: number; heli: THREE.Group; rotor: THREE.Mesh[]; risen: number }[] = [];
    const wellRingMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x5fcaff, emissiveIntensity: 1.2, roughness: 0.3 });
    for (const wz of [-132, -186]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.6, 8, 28), wellRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.15, wz);
      scene.add(ring);
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(7, 24),
        new THREE.MeshStandardMaterial({ color: 0x0d2230, emissive: 0x123c52, emissiveIntensity: 0.8 }),
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(0, 0.05, wz);
      scene.add(hole);

      const heli = new THREE.Group();
      const bodyM = new THREE.MeshStandardMaterial({ color: 0xdfeef4, roughness: 0.45, metalness: 0.35 });
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 5.2, 6, 12), bodyM);
      hull.rotation.x = Math.PI / 2;
      heli.add(hull);
      const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(1.45, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x9fe6ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 }),
      );
      cockpit.position.set(0, 0.3, -3.1);
      heli.add(cockpit);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5.2), bodyM);
      tail.position.set(0, 0.6, 4.4);
      heli.add(tail);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.7, 1.3), bodyM);
      fin.position.set(0, 1.4, 6.8);
      heli.add(fin);
      const rotors: THREE.Mesh[] = [];
      for (const [ry, rl] of [[1.7, 6.4], [1.5, 2.4]] as const) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(rl, 0.1, 0.42),
          new THREE.MeshStandardMaterial({ color: 0xd8e8f0, roughness: 0.4, metalness: 0.4 }),
        );
        blade.position.set(0, ry, ry > 1.6 ? -0.4 : 6.6);
        heli.add(blade);
        rotors.push(blade);
      }
      // skids
      for (const side of [-1, 1]) {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5), steelMat);
        skid.position.set(side * 1.3, -1.7, 0);
        heli.add(skid);
      }
      heli.position.set(0, -9, wz);
      scene.add(heli);
      wells.push({ z: wz, heli, rotor: rotors, risen: 0 });
    }

    /* ---------------- the Frostwing ---------------- */
    const plane = new THREE.Group();
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xd8f6ff, roughness: 0.06, metalness: 0.5, transparent: true, opacity: 0.86,
      emissive: 0x7fe4ff, emissiveIntensity: 0.5,
    });
    const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 11, 8, 14), glassMat);
    fuselage.rotation.x = Math.PI / 2;
    plane.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.32, 4.4, 12), glassMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, -7.2);
    plane.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.34, 3.6), glassMat);
    wing.position.set(0, -0.1, 0.6);
    plane.add(wing);
    for (const side of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 3.2), new THREE.MeshStandardMaterial({
        color: 0x9fe8ff, emissive: 0x5fd4ff, emissiveIntensity: 1.4,
      }));
      tip.position.set(side * 7.4, 0.2, 0.9);
      plane.add(tip);
      const canard = new THREE.Mesh(new THREE.BoxGeometry(5, 0.24, 1.5), glassMat);
      canard.position.set(0, 0, -4.6);
      canard.rotation.y = side * 0.02;
      canard.scale.set(0.62, 1, 1);
      plane.add(canard);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 2.1), glassMat);
      fin.position.set(side * 1.1, 1.2, 4.2);
      fin.rotation.z = side * 0.28;
      plane.add(fin);
    }
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.6,
    }));
    canopy.position.set(0, 0.9, -2.6);
    plane.add(canopy);
    // Nose to the gate: the Frostwing is parked pointing at the way out, because in four
    // seconds that is exactly where it is going.
    plane.position.set(0, 3.2, -268);
    plane.rotation.y = Math.PI;
    scene.add(plane);
    // the bay it sits in: a raised cradle and a cold lamp
    const cradle = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.8, 15),
      new THREE.MeshStandardMaterial({ color: 0x86a6b4, roughness: 0.5, metalness: 0.55 }),
    );
    cradle.position.set(0, 0.4, -268);
    scene.add(cradle);
    const planeGlow = new THREE.PointLight(0x8fe8ff, 40, 90, 2);
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
        const ring = 6 + (e.slot % 5) * 1.7;
        const a = (e.slot / 20) * Math.PI * 2 + state.t * 0.25;
        const tx = state.px + Math.cos(a) * ring;
        const tz = state.pz + Math.sin(a) * ring + 2;
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
