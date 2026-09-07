import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type VaultAction = 'supplies' | 'plane' | 'heli' | 'intel';
type Station = 'hangar' | 'command' | 'armory' | 'archive';
const stations: { id: Station; index: string; label: string; sub: string }[] = [
  { id: 'hangar', index: '01', label: 'AIR WING', sub: 'NIGHTJAR / KESTREL' },
  { id: 'command', index: '02', label: 'OPERATIONS', sub: 'TACTICAL UPLINK' },
  { id: 'armory', index: '03', label: 'QUARTERMASTER', sub: 'ARMOR / MEDICAL' },
  { id: 'archive', index: '04', label: 'CARTER ARCHIVE', sub: 'SSR / EST. 1946' },
];

interface Props {
  backdrop?: boolean;
  preview?: boolean;
  onExit: () => void;
  onAction: (action: VaultAction) => string;
}

export default function VaultRoom({ backdrop = false, preview = false, onExit, onAction }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onExit, onAction });
  callbacks.current = { onExit, onAction };
  const navigate = useRef<(id: Station) => void>(() => {});
  const input = useRef({ x: 0, y: 0 });
  const [station, setStation] = useState<Station>('hangar');
  const [message, setMessage] = useState('Identity verified. Welcome home, operative.');
  const [locked, setLocked] = useState(false);
  const lockRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const actionRef = useRef<(action: VaultAction) => void>(() => {});
  actionRef.current = action => {
    setMessage(preview ? 'HOLOGRAPHIC TOUR / Enter the vault in the campaign to requisition this equipment.' : callbacks.current.onAction(action));
  };
  const lock = () => { lockRef.current = !lockRef.current; setLocked(lockRef.current); };

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, backdrop ? 1.25 : 1.6));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1720');
    scene.fog = new THREE.FogExp2('#0b1720', 0.007);
    const camera = new THREE.PerspectiveCamera(47, container.clientWidth / container.clientHeight, 0.1, 240);
    camera.position.set(backdrop ? 34 : 29, backdrop ? 24 : 20, 37);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.5, -3);
    controls.enableDamping = true; controls.dampingFactor = 0.065;
    controls.minDistance = 5; controls.maxDistance = 85;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enabled = !backdrop;
    controls.enablePan = true;
    controls.autoRotate = backdrop; controls.autoRotateSpeed = 0.13;

    scene.add(new THREE.HemisphereLight('#c2edff', '#304349', 2.0));
    scene.add(new THREE.AmbientLight('#a9cbd9', 0.4));
    const key = new THREE.DirectionalLight('#e2efff', 2.5);
    key.position.set(-12, 32, 15); key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    Object.assign(key.shadow.camera, { left: -45, right: 45, top: 44, bottom: -44, far: 120 });
    key.shadow.bias = -0.0003;
    scene.add(key);
    const cyan = new THREE.PointLight('#49ddec', 350, 52, 2); cyan.position.set(-21, 8, -14); scene.add(cyan);
    const warm = new THREE.PointLight('#ffd196', 280, 45, 2); warm.position.set(27, 7, 17); scene.add(warm);
    const rim = new THREE.PointLight('#78c7ff', 360, 60, 2); rim.position.set(10, 9, -28); scene.add(rim);

    const materials = new Map<string, THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    const textures = new Set<THREE.Texture>();
    const unit = new THREE.BoxGeometry(1, 1, 1); geometries.add(unit);
    const batches = new Map<THREE.Material, THREE.Matrix4[]>();
    const transform = new THREE.Object3D();
    const material = (color: string, metal = 0.45, emission = false) => {
      const id = `${color}/${metal}/${emission}`;
      if (!materials.has(id)) materials.set(id, emission
        ? new THREE.MeshBasicMaterial({ color, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.48 }));
      return materials.get(id)!;
    };
    const steel = material('#283f4c'), dark = material('#10222d'), edge = material('#586e79'), pale = material('#c1d0ce', 0.18);
    const teal = material('#76e9e6', 0, true), amber = material('#f1c57c', 0, true);
    const blue = material('#305665', 0.7), black = material('#080f17', 0.4);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, parent?: THREE.Object3D, ry = 0) => {
      if (parent) {
        const mesh = new THREE.Mesh(unit, mat); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.rotation.y = ry;
        mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
      }
      transform.position.set(x, y, z); transform.rotation.set(0, ry, 0); transform.scale.set(w, h, d); transform.updateMatrix();
      const list = batches.get(mat) || []; list.push(transform.matrix.clone()); batches.set(mat, list);
      return null;
    };
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent = scene as THREE.Object3D) => {
      geometries.add(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    const cylinder = (x: number, y: number, z: number, r: number, h: number, mat: THREE.Material, parent = scene as THREE.Object3D) => {
      const m = mesh(new THREE.CylinderGeometry(r, r, h, 20), mat, parent); m.position.set(x, y, z); return m;
    };
    const ring = (x: number, y: number, z: number, r: number, color: string, width = 0.045) => {
      const m = mesh(new THREE.TorusGeometry(r, width, 6, 72), material(color, 0, true)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); return m;
    };
    const label = (text: string, x: number, y: number, z: number, width: number, color = '#c3e2e5', floor = false) => {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
      const c = cv.getContext('2d')!;
      c.clearRect(0, 0, 1024, 128); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color;
      c.font = '600 66px monospace'; c.fillText(text, 512, 64, 1000);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; textures.add(tex);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); materials.set(`text-${materials.size}`, mat);
      const m = mesh(new THREE.PlaneGeometry(width, width / 8), mat); m.position.set(x, y, z); if (floor) m.rotation.x = -Math.PI / 2;
      return m;
    };
    const line = (points: THREE.Vector3[], color: string, parent = scene as THREE.Object3D) => {
      const g = new THREE.BufferGeometry().setFromPoints(points); geometries.add(g);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }); materials.set(`line-${materials.size}`, mat);
      const l = new THREE.Line(g, mat); parent.add(l); return l;
    };
    const glass = new THREE.MeshStandardMaterial({ color: '#69d3dc', transparent: true, opacity: 0.16, roughness: 0.13, metalness: 0.65, side: THREE.DoubleSide, depthWrite: false }); materials.set('glass', glass);

    // Architecture is batched by material: hundreds of panels cost only a few draw calls.
    box(0, -0.3, 0, 76, 0.6, 80, dark);
    for (let x = -34; x <= 34; x += 4) for (let z = -36; z <= 36; z += 4) {
      box(x, 0.025, z, 3.93, 0.05, 3.93, material((x + z) % 8 === 0 ? '#273945' : '#23343e', 0.62));
    }
    box(0, 6, -39, 76, 12, 1.5, dark);
    box(-37, 5, 0, 1.6, 10, 80, dark); box(37, 5, 0, 1.6, 10, 80, dark);
    for (let z = -33; z < 35; z += 11) {
      for (const side of [-1, 1]) {
        box(side * 34.5, 6.3, z, 1, 12.6, 1.3, steel);
        box(side * 34.5, 0.6, z, 2.3, 1.2, 2.2, edge);
        box(side * 34.5, 10.7, z, 1.4, 0.16, 1.5, teal);
        box(side * 31.5, 0.12, z, 0.13, 0.1, 8, teal);
        box(side * 30.8, 0.15, z, 0.11, 0.1, 8, material('#527987'));
      }
      box(0, 12.4, z, 70, 0.55, 0.9, steel);
      box(0, 12.18, z, 50, 0.06, 0.3, material('#c3e4ea', 0, true));
      for (let x = -30; x < 31; x += 10) box(x, 11.7, z, 0.35, 1.2, 0.6, edge);
    }
    for (let x = -32; x < 33; x += 8) {
      box(x, 4, -37.9, 7.3, 7.5, 0.2, steel);
      box(x, 8.6, -37.7, 6.9, 0.1, 0.1, teal);
      for (let y = 1; y < 7; y += 0.55) box(x, y, -37.6, 6.7, 0.15, 0.12, dark);
    }
    for (const x of [-29, 29]) {
      box(x, 0.07, -2, 0.08, 0.07, 60, amber);
      for (let z = -30; z < 27; z += 2.5) box(x + 0.38, 0.08, z, 0.32, 0.04, 1, material('#b5a16e'));
    }
    // Electrical conduits, ventilation, warning paint and suspended cable trays.
    for (let z = -34; z < 33; z += 6) {
      box(-36, 2.2, z, 0.24, 0.4, 5.4, edge); box(36, 8.5, z, 0.22, 0.3, 5.4, edge);
      box(-36, 2.7, z, 0.18, 0.12, 5.4, amber);
    }
    label('S.H.I.E.L.D.', 0, 10, -37.8, 24, '#8dd5db');
    label('BLACK VAULT / ATTIC', 0, 7.5, -37.6, 19);
    label('AIR WING 01', 0, 0.095, 24, 17, '#8ca4ac', true);
    label('SSR 1946', -24, 0.11, 32, 9, '#bea476', true);
    label('NO STEP', 17, 0.105, -19, 5, '#d9b56f', true);

    // Central Nightjar strategic aircraft on a numbered maintenance hardstand.
    const bomber = new THREE.Group(); scene.add(bomber); bomber.position.set(1, 1.65, -5);
    const prism = (points: [number, number][], thickness: number, y: number, mat: THREE.Material, parent: THREE.Object3D) => {
      const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
      const m = mesh(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.11, bevelThickness: 0.08 }), mat, parent);
      m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
    };
    prism([[0, -17], [2.2, -11], [3, -2], [17, 7], [16, 9], [3, 5], [2, 11], [7, 14], [6, 15], [0, 12], [-6, 15], [-7, 14], [-2, 11], [-3, 5], [-16, 9], [-17, 7], [-3, -2], [-2.2, -11]], 0.48, 0, blue, bomber);
    const fuselage = mesh(new THREE.SphereGeometry(1, 28, 14), steel, bomber); fuselage.scale.set(2.1, 1.3, 13); fuselage.position.set(0, 0.7, -0.5);
    const canopy = mesh(new THREE.SphereGeometry(1, 24, 12), material('#153f57', 0.86), bomber); canopy.scale.set(1.42, 0.9, 3.2); canopy.position.set(0, 1.35, -10.5);
    for (const side of [-1, 1]) {
      for (const offset of [6.5, 10.8]) {
        const engine = mesh(new THREE.CylinderGeometry(0.8, 0.92, 5.8, 18), dark, bomber); engine.rotation.x = Math.PI / 2; engine.position.set(side * offset, -0.4, 5.5);
        const exhaust = mesh(new THREE.TorusGeometry(0.62, 0.1, 6, 20), teal, bomber); exhaust.position.set(side * offset, -0.4, 8.5);
      }
      prism([[side * 1.4, 6], [side * 3.2, 11], [side * 2, 11]], 0.35, 1.7, edge, bomber);
      const gear = cylinder(side * 2.1, -1.35, 4, 0.13, 1.4, edge, bomber);
      gear.castShadow = true;
      const tire = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.48, 14), black, bomber); tire.rotation.z = Math.PI / 2; tire.position.set(side * 2.1, -1.72, 4);
      line([new THREE.Vector3(side * 3, 0.61, 0), new THREE.Vector3(side * 15.5, 0.62, 7.4)], '#85bdc5', bomber);
    }
    cylinder(0, -1.3, -10, 0.13, 1.3, edge, bomber);
    const noseWheel = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.34, 14), black, bomber); noseWheel.rotation.z = Math.PI / 2; noseWheel.position.set(0, -1.72, -10);
    const insignia = mesh(new THREE.RingGeometry(0.9, 1.06, 40), teal, bomber); insignia.rotation.x = -Math.PI / 2; insignia.position.set(0, 2.015, 1);
    box(0, 2.03, 1, 0.16, 0.035, 1.65, teal, bomber);
    ring(1, 0.14, -5, 18.5, '#426574', 0.035);
    label('NIGHTJAR // 07', 1, 0.13, 17, 11, '#a7c5cd', true);

    // Service stairs, carts and a moving maintenance arm frame the aircraft.
    for (let i = 0; i < 5; i++) box(5, (i + 1) * 0.16, -16 + i * 0.44, 1.6, 0.24, 0.5, edge);
    box(5, 0.9, -14, 2, 0.2, 1.3, steel);
    box(6, 1.9, -15, 0.07, 2, 3.5, amber);
    box(18, 0.85, 5, 2.1, 1.4, 1.6, material('#be974f', 0.4));
    box(18, 1.65, 5, 2.25, 0.15, 1.75, dark);
    for (const z of [4.4, 5.6]) for (const x of [17.1, 18.9]) cylinder(x, 0.2, z, 0.18, 0.4, black);
    const maintenanceArm = new THREE.Group(); scene.add(maintenanceArm); maintenanceArm.position.set(13, 1.1, -17);
    cylinder(0, 0, 0, 0.8, 0.3, dark, maintenanceArm);
    box(0, 1.3, 0, 0.45, 2.6, 0.45, amber, maintenanceArm);
    box(-1, 2.5, 0, 2.4, 0.34, 0.4, steel, maintenanceArm);

    // Kestrel helicopter in its own bay, with identifiable rotors, skids and missile pods.
    const helicopter = new THREE.Group(); scene.add(helicopter); helicopter.position.set(-23, 1.6, -18); helicopter.rotation.y = 0.35;
    const body = mesh(new THREE.SphereGeometry(1, 24, 16), blue, helicopter); body.scale.set(1.4, 1.3, 3.2);
    const heliGlass = mesh(new THREE.SphereGeometry(1, 20, 12), material('#245c77', 0.9), helicopter); heliGlass.scale.set(1.2, 0.93, 1.8); heliGlass.position.set(0, 0.4, -1.8);
    const tail = mesh(new THREE.ConeGeometry(0.56, 6.5, 12), steel, helicopter); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.1, 5.2);
    box(0, 1.1, 8.1, 0.18, 2.5, 1.5, blue, helicopter);
    for (const x of [-1.35, 1.35]) { box(x, -1.32, 0, 0.1, 0.12, 5, edge, helicopter); box(x, -0.7, 1, 0.08, 1.2, 0.1, steel, helicopter); }
    box(0, 0, 0.8, 5.2, 0.24, 0.75, steel, helicopter);
    for (const x of [-2.1, 2.1]) { const pod = cylinder(x, 0, 0.9, 0.3, 1.5, dark, helicopter); pod.rotation.x = Math.PI / 2; }
    cylinder(0, 1.5, 0, 0.18, 1.4, edge, helicopter);
    const rotor = new THREE.Group(); helicopter.add(rotor); rotor.position.y = 2.25;
    for (let i = 0; i < 4; i++) box(0, 0, 0, 12, 0.07, 0.2, black, rotor, i * Math.PI / 2);
    ring(-23, 0.14, -18, 7.6, '#5ea0a4'); label('KESTREL // 02', -23, 0.13, -8, 9, '#86bac0', true);

    // Holographic command room, transparent partitions and floating telemetry.
    cylinder(-23, 0.65, 9, 5.2, 1.2, dark);
    cylinder(-23, 1.4, 9, 4.9, 0.28, steel);
    ring(-23, 1.57, 9, 4.5, '#73f2dc', 0.055);
    const globe = mesh(new THREE.IcosahedronGeometry(2.65, 2), new THREE.MeshBasicMaterial({ color: '#68e7d7', wireframe: true, transparent: true, opacity: 0.36 }));
    materials.set('globe', globe.material); globe.position.set(-23, 4.8, 9);
    const orbitRings = [ring(-23, 3.4, 9, 3.7, '#477d89'), ring(-23, 4, 9, 3.4, '#69cbd2')]; orbitRings[1].rotation.z = 0.25;
    const holoCone = mesh(new THREE.CylinderGeometry(2.5, 4.1, 4, 40, 1, true), glass); holoCone.position.set(-23, 3.3, 9);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const point = mesh(new THREE.SphereGeometry(0.08, 6, 6), amber); point.position.set(-23 + Math.cos(a) * 2.7, 4.8 + Math.sin(a * 2), 9 + Math.sin(a) * 2.7);
    }
    label('TACTICAL / 02', -23, 8, 14, 11, '#83dfd8');
    // Computer terminals with drawn diagrams, not flat anonymous blocks.
    for (let i = 0; i < 5; i++) {
      const x = -32 + i * 4;
      box(x, 0.9, 20, 3.4, 1.8, 1.6, steel);
      box(x, 1.85, 20, 3.6, 0.14, 2.1, edge);
      const display = label(`NODE ${i + 1} / ONLINE`, x, 3, 19.8, 3.05, '#65e0df');
      const screen = box(x, 3, 20, 3.3, 1.6, 0.14, black, scene)!; screen.castShadow = false;
      display.position.z = 20.11;
      box(x, 2.45, 20, 0.14, 1.15, 0.15, edge);
      box(x, 0.6, 22.5, 1.2, 1.2, 1.2, black);
      box(x, 1.65, 23, 1.25, 1, 0.17, blue);
    }
    for (const z of [-29, -24, -19, -14, -9]) {
      box(28, 2.2, z, 3.5, 4.4, 2.6, black);
      box(28, 4.5, z, 3.7, 0.18, 2.8, edge);
      for (let i = 0; i < 7; i++) {
        box(28, 0.55 + i * 0.51, z + 1.34, 3.1, 0.34, 0.1, steel);
        box(26.75, 0.55 + i * 0.51, z + 1.42, 0.09, 0.11, 0.08, i % 3 ? teal : amber);
        box(28.3, 0.55 + i * 0.51, z + 1.42, 1.3, 0.045, 0.04, edge);
      }
    }
    label('QUANTUM UPLINK', 27, 7, -8, 11, '#91d7ed');

    // Armory / medbay. Weapon racks, numbered lockers, folded stretchers and supplies.
    for (let i = 0; i < 5; i++) {
      const z = 5 + i * 3;
      box(32, 1.8, z, 2.7, 3.6, 2.6, steel);
      box(30.6, 1.8, z, 0.13, 3.3, 2.4, edge);
      box(30.48, 2.5, z, 0.1, 0.14, 1.8, teal);
      // Stenciled guns mounted on the rack.
      box(30.35, 1.5, z, 0.15, 0.24, 1.7, black);
      box(30.3, 1.18, z + 0.2, 0.18, 0.62, 0.22, black);
    }
    for (const z of [8, 15]) {
      box(23, 0.8, z, 3.1, 1.5, 5.4, steel);
      box(23, 1.6, z, 3.15, 0.3, 5.5, pale);
      box(23, 1.83, z - 1.6, 2.5, 0.26, 1.1, material('#e3e5ce', 0));
      box(20.9, 2.5, z, 0.09, 5, 0.09, edge);
      box(21.2, 4.2, z, 0.55, 0.9, 0.15, teal);
    }
    label('MEDICAL / ARMORY', 27, 6.8, 21, 12, '#afddd3');
    for (let i = 0; i < 12; i++) {
      const x = 19 + i % 4 * 2.2, z = 26 + Math.floor(i / 4) * 2.2;
      box(x, 0.8, z, 1.8, 1.6, 1.7, i % 3 === 0 ? material('#786a49') : steel);
      box(x, 1.65, z, 1.8, 0.1, 1.7, edge); box(x, 0.9, z + 0.88, 0.6, 0.25, 0.04, teal);
    }
    // Carter archive: warm, older materials against the modern aircraft bay.
    box(-24, 0.8, 29.5, 11, 1.6, 3.4, material('#6d5640', 0.1));
    for (let x = -30; x < -15; x += 2) {
      box(x, 2, 35, 1.8, 4, 1.5, steel);
      for (let y = 0.8; y < 4; y += 0.65) {
        box(x, y, 35, 1.65, 0.09, 1.4, edge);
        for (let j = 0; j < 4; j++) box(x - 0.55 + j * 0.34, y + 0.26, 34.95, 0.2, 0.45, 1.05, material(j % 2 ? '#8b704a' : '#4f655e', 0.1));
      }
    }
    label('PEGGY CARTER', -23, 5.5, 34, 12, '#e1c68c');
    label('SSR / THE FOUNDING ARCHIVE / 1946', -23, 4.5, 34, 14, '#aaad96');
    // Archive glass edge, with a wide pedestrian opening.
    box(-16, 2, 29, 0.15, 4, 10, glass); box(-24, 2, 25, 8, 4, 0.15, glass);

    // Hydraulic airlock. Moving panels, exposed pistons, warning strobes.
    box(0, 4.5, 36, 16, 9, 1.2, steel); box(0, 4, 35.3, 11, 8, 0.3, black);
    const leftDoor = box(-2.65, 4, 34.9, 5.2, 7.8, 0.45, blue, scene)!;
    const rightDoor = box(2.65, 4, 34.9, 5.2, 7.8, 0.45, blue, scene)!;
    box(0, 8.4, 35.1, 9.8, 0.1, 0.1, teal);
    for (const side of [-1, 1]) {
      box(side * 6.3, 4, 35, 0.34, 7.5, 0.5, edge);
      box(side * 6.3, 6, 34.55, 0.55, 2.7, 0.8, dark);
      box(side * 6.3, 3.1, 34.5, 0.14, 3.4, 0.18, pale);
    }
    label('SURFACE ACCESS', 0, 9.5, 35.25, 13, '#9ecbcc');

    // Friendly staff make the space feel occupied, not an empty showroom.
    const people: THREE.Group[] = [];
    const agent = (x: number, z: number, coat = false) => {
      const g = new THREE.Group(); scene.add(g); g.position.set(x, 0, z);
      box(0, 0.53, 0, 0.62, 1.05, 0.38, dark, g);
      box(0, 1.27, 0, 0.75, 0.72, 0.42, coat ? pale : blue, g);
      const head = mesh(new THREE.SphereGeometry(0.22, 12, 8), material('#bcb7a8', 0), g); head.position.y = 1.88;
      for (const side of [-1, 1]) box(side * 0.5, 1.22, 0, 0.22, 0.76, 0.26, coat ? pale : steel, g);
      box(0, 1.45, 0.23, 0.17, 0.2, 0.035, teal, g); people.push(g); return g;
    };
    agent(-23, 17); agent(20, 17, true); agent(10, -17); agent(-20, -6); agent(24, -4);
    const operative = agent(5, 25); operative.visible = !backdrop;
    const selectedRing = ring(5, 0.16, 25, 0.75, '#74f2d2', 0.045);
    selectedRing.visible = !backdrop;

    // Interactive room targets use real raycast hit boxes.
    const pickables: THREE.Object3D[] = [];
    const targets: { id: Station; point: THREE.Vector3; action: VaultAction }[] = [
      { id: 'hangar', point: new THREE.Vector3(1, 2, -5), action: 'plane' },
      { id: 'command', point: new THREE.Vector3(-23, 2, 9), action: 'intel' },
      { id: 'armory', point: new THREE.Vector3(24, 2, 18), action: 'supplies' },
      { id: 'archive', point: new THREE.Vector3(-24, 2, 29), action: 'intel' },
    ];
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); materials.set('hit', hitMaterial);
    targets.forEach(t => {
      const hit = mesh(new THREE.BoxGeometry(8, 5, 8), hitMaterial); hit.position.copy(t.point); hit.userData.station = t.id;
      pickables.push(hit);
    });

    for (const [mat, matrices] of batches) {
      const batch = new THREE.InstancedMesh(unit, mat, matrices.length);
      matrices.forEach((m, i) => batch.setMatrixAt(i, m)); batch.instanceMatrix.needsUpdate = true;
      batch.castShadow = !(mat instanceof THREE.MeshBasicMaterial); batch.receiveShadow = true;
      scene.add(batch);
    }

    let goalCamera: THREE.Vector3 | null = null, goalTarget: THREE.Vector3 | null = null;
    const views: Record<Station, [THREE.Vector3, THREE.Vector3]> = {
      hangar: [new THREE.Vector3(29, 20, 37), new THREE.Vector3(0, 2.5, -3)],
      command: [new THREE.Vector3(-8, 13, 29), new THREE.Vector3(-23, 2.7, 9)],
      armory: [new THREE.Vector3(9, 11, 31), new THREE.Vector3(26, 2, 15)],
      archive: [new THREE.Vector3(-8, 10, 40), new THREE.Vector3(-23, 2, 28)],
    };
    navigate.current = id => { setStation(id); [goalCamera, goalTarget] = views[id].map(v => v.clone()) as [THREE.Vector3, THREE.Vector3]; };
    const keys = new Set<string>();
    const keydown = (e: KeyboardEvent) => {
      if (backdrop || e.target instanceof HTMLInputElement) return;
      keys.add(e.key.toLowerCase());
      if (e.key === 'Escape') { callbacks.current.onExit(); return; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const index = Number(e.key) - 1;
      if (index >= 0 && index < 4) navigate.current(stations[index].id);
      if (e.key.toLowerCase() === 'l' && !e.repeat) { lockRef.current = !lockRef.current; setLocked(lockRef.current); }
      if (e.key.toLowerCase() === 'f' && !e.repeat) {
        if (operative.position.distanceTo(new THREE.Vector3(0, 0, 33)) < 5) {
          if (lockRef.current) setMessage('Airlock is sealed. Press L to release the hydraulic lock.');
          else callbacks.current.onExit();
        }
        else {
          const closest = [...targets].sort((a, b) => a.point.distanceTo(operative.position) - b.point.distanceTo(operative.position))[0];
          if (closest.point.distanceTo(operative.position) < 10) actionRef.current(closest.action);
          else setMessage('Approach a console, or use the station controls below.');
        }
      }
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    const raycaster = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; goalCamera = goalTarget = null; };
    const pointerUp = (e: PointerEvent) => {
      if (backdrop || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) return;
      const r = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects(pickables)[0];
      if (hit) navigate.current(hit.object.userData.station as Station);
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);
    const resize = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    }); resize.observe(container);

    const blockers = [
      { x: 1, z: -5, w: 7, d: 30 }, { x: -23, z: 9, w: 10.6, d: 10.6 },
      { x: -23, z: -18, w: 5, d: 10 }, { x: 28, z: -19, w: 4, d: 25 },
      { x: 23, z: 8, w: 3.4, d: 5.7 }, { x: 23, z: 15, w: 3.4, d: 5.7 },
      { x: -24, z: 29.5, w: 11.4, d: 3.8 },
    ];
    let previous = performance.now(), raf = 0, elapsed = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - previous) / 1000); previous = now; elapsed += dt;
      if (!document.hidden) {
        globe.rotation.y += dt * 0.12; orbitRings[0].rotation.z = Math.sin(elapsed * 0.3) * 0.15;
        rotor.rotation.y += dt * 1.3; maintenanceArm.rotation.y = Math.sin(elapsed * 0.25) * 0.45;
        people.forEach((p, i) => { if (p !== operative) { p.rotation.y = Math.sin(elapsed * 0.2 + i) * 0.25; p.position.y = Math.sin(elapsed * 1.2 + i) * 0.012; } });
        const open = lockRef.current ? 0 : 1;
        leftDoor.position.x = THREE.MathUtils.damp(leftDoor.position.x, -2.65 - open * 4.9, 1.8, dt);
        rightDoor.position.x = THREE.MathUtils.damp(rightDoor.position.x, 2.65 + open * 4.9, 1.8, dt);
        if (goalCamera && goalTarget) {
          camera.position.lerp(goalCamera, 1 - Math.exp(-2.4 * dt)); controls.target.lerp(goalTarget, 1 - Math.exp(-2.4 * dt));
          if (camera.position.distanceTo(goalCamera) < 0.1) goalCamera = goalTarget = null;
        }
        const dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + input.current.x;
        const dz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + input.current.y;
        if (!backdrop && (dx || dz)) {
          goalCamera = goalTarget = null;
          const direction = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(dt * 6);
          const next = operative.position.clone().add(direction);
          next.x = THREE.MathUtils.clamp(next.x, -32, 32); next.z = THREE.MathUtils.clamp(next.z, -33, 33);
          if (!blockers.some(b => Math.abs(next.x - b.x) < b.w / 2 + 0.5 && Math.abs(next.z - b.z) < b.d / 2 + 0.5)) {
            const delta = next.clone().sub(operative.position); operative.position.copy(next);
            controls.target.add(delta); camera.position.add(delta);
          }
          operative.rotation.y = Math.atan2(dx, dz); operative.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.06;
        }
        selectedRing.position.x = operative.position.x; selectedRing.position.z = operative.position.z;
        controls.update(); renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); setReady(true);
    return () => {
      cancelAnimationFrame(raf); resize.disconnect(); controls.dispose();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      renderer.dispose(); renderer.domElement.remove();
      navigate.current = () => {};
    };
  }, [backdrop]);

  return (
    <div className={`vault-room ${backdrop ? 'vault-backdrop' : ''}`}>
      <div className="vault-scene" ref={host} />
      {!ready && !failed && <div className="vault-loading">INITIALIZING SECURE ENVIRONMENT<span /></div>}
      {failed && <div className="vault-fallback"><h2>Secure Terminal</h2><p>3D rendering is not available in this browser. The vault services still work below.</p></div>}
      {!backdrop && <>
        <header className="vault-header">
          <div className="vault-title"><span className="vault-crest">S</span><div><small>STRATEGIC HOMELAND INTERVENTION</small><h1>BLACK VAULT <b>ATTIC</b></h1><p>{preview ? 'HOLOGRAPHIC TOUR / NO CAMPAIGN REWARDS' : 'LEVEL 07 CLEARANCE / IDENTITY VERIFIED'}</p></div></div>
          <div className="vault-header-actions"><button className={locked ? 'is-locked' : ''} onClick={lock}>{locked ? 'AIRLOCK SEALED' : 'SEAL AIRLOCK'} <kbd>L</kbd></button><button onClick={onExit}>{preview ? 'BACK TO OPERATIONS' : 'RETURN TO SURFACE'} <span>↗</span></button></div>
        </header>
        <div className="vault-side-note"><span className="vault-online" /> S.H.I.E.L.D. CONTROLLED <span>/</span> OFF THE GRID</div>
        <div className="vault-room-caption"><span>{stations.find(s => s.id === station)?.index}</span><div><small>YOU ARE VIEWING</small><strong>{stations.find(s => s.id === station)?.label}</strong></div></div>
        <section className="vault-console" aria-label="Vault terminal">
          <div className="vault-terminal-text"><span>SECURE COMMS</span><p role="status">{message}</p></div>
          <div className="vault-actions">
            {station === 'hangar' ? <><button onClick={() => actionRef.current('plane')}>REQUISITION NIGHTJAR <span>Bomber + escort</span></button><button onClick={() => actionRef.current('heli')}>REQUISITION KESTREL <span>Gunship + escort</span></button></>
              : station === 'armory' ? <button onClick={() => actionRef.current('supplies')}>COLLECT SUPPLIES <span>Health / armor / 2 AEGIS cells</span></button>
              : <button onClick={() => actionRef.current('intel')}>ACCESS CLASSIFIED INTEL <span>{station === 'archive' ? 'Carter archive / founding records' : 'Hydra deployments / signal analysis'}</span></button>}
          </div>
        </section>
        <footer className="vault-footer"><nav>{stations.map(s => <button key={s.id} className={station === s.id ? 'active' : ''} onClick={() => { setStation(s.id); navigate.current(s.id); }}><span>{s.index}</span><div><strong>{s.label}</strong><small>{s.sub}</small></div></button>)}</nav><p>WASD WALK <span>/</span> DRAG TO LOOK <span>/</span> SCROLL TO ZOOM</p></footer>
        <div className="vault-mobile-move" aria-label="Walk controls">{[['↑', 0, -1], ['←', -1, 0], ['↓', 0, 1], ['→', 1, 0]].map(([s, x, y]) => <button key={String(s)} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); input.current = { x: Number(x), y: Number(y) }; }} onPointerUp={() => input.current = { x: 0, y: 0 }} onPointerCancel={() => input.current = { x: 0, y: 0 }}>{s}</button>)}</div>
      </>}
    </div>
  );
}