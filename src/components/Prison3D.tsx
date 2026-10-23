import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PrisonSim, CELL_D, CELL_W, CELL_H, type PrisonStats } from '../game/prison';

export type PrisonMode = 'arrest' | 'visit';
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
}

const EMPTY: Screen = {
  hp: 100, armor: 0, mag: 12, magSize: 12, reserve: 48, reloading: false, alarm: 0,
  prompt: '', message: '', messageT: 0, cells: 0, free: 0, guards: 0, sally: false,
  lights: false, compass: [], stats: { freed: 0, guardsDown: 0, inmatesDown: 0, shots: 0, hits: 0, looted: 0 },
  flashlight: false,
};

/** Concrete texture generated on a canvas — no external assets in a single-file build. */
function concreteTexture(size = 512, base = '#2e3335'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const v = 16 + Math.random() * 42;
    g.fillStyle = `rgba(${v},${v + 4},${v + 5},${0.05 + Math.random() * 0.16})`;
    g.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  // expansion joints
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(0, (size / 4) * i); g.lineTo(size, (size / 4) * i); g.stroke();
    g.beginPath(); g.moveTo((size / 4) * i, 0); g.lineTo((size / 4) * i, size); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

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

    const W = hostEl.clientWidth || 1280;
    const H = hostEl.clientHeight || 720;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    renderer.setClearColor(0x05070a, 1);
    hostEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05080b, 0.018);
    const camera = new THREE.PerspectiveCamera(74, W / H, 0.08, 420);

    scene.add(new THREE.HemisphereLight(0x4a6070, 0x080a0c, 0.75));
    const moon = new THREE.DirectionalLight(0x8fb4d6, 0.5);
    moon.position.set(-60, 120, -40);
    scene.add(moon);

    /* ---------------- materials ---------------- */
    const concreteMap = concreteTexture(512, '#31383a');
    concreteMap.repeat.set(30, 30);
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0x565f62, map: concreteMap, roughness: 0.94, metalness: 0.04 });
    const matFloor = new THREE.MeshStandardMaterial({ color: 0x3b4144, map: concreteMap, roughness: 0.88, metalness: 0.06 });
    const matBars = new THREE.MeshStandardMaterial({ color: 0x8a969d, roughness: 0.42, metalness: 0.82 });
    const matGate = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.55, metalness: 0.6 });
    const matBed = new THREE.MeshStandardMaterial({ color: 0x4a5d70, roughness: 0.9 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x707c84, roughness: 0.5, metalness: 0.7 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x6b5440, roughness: 0.85 });
    const matLamp = new THREE.MeshBasicMaterial({ color: 0xd8ecff });
    const matGuard = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.7, metalness: 0.2 });
    const matGuardHead = new THREE.MeshStandardMaterial({ color: 0xc9a58b, roughness: 0.8 });
    const matInmate = new THREE.MeshStandardMaterial({ color: 0x9c6b2f, roughness: 0.9 });
    const matInmateHead = new THREE.MeshStandardMaterial({ color: 0xb08f74, roughness: 0.85 });

    /* ---------------- floor ---------------- */
    const floorGeo = new THREE.PlaneGeometry(240, 240);
    const floor = new THREE.Mesh(floorGeo, matFloor);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    // painted yard markings and a drain grid, so the floor is not a flat slab
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x9fb4b8, transparent: true, opacity: 0.16 });
    for (let i = -5; i <= 5; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(220, 0.14), lineMat);
      line.rotation.x = -Math.PI / 2; line.position.set(0, 0.02, i * 20);
      scene.add(line);
    }
    // ceiling for the cell hall
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(224, 224), new THREE.MeshStandardMaterial({ color: 0x1a2023, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 9.2;
    scene.add(ceiling);

    /* ---------------- merged static geometry ---------------- */
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (rotY) g.rotateY(rotY);
      g.translate(x, y, z);
      return g;
    };

    // walls (bars are drawn separately as instanced strips)
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

    // props grouped by material
    const groups: Record<string, THREE.BufferGeometry[]> = { bed: [], metal: [], wood: [], lamp: [] };
    for (const p of sim.props) {
      const key = p.kind === 'bed' ? 'bed' : p.kind === 'lamp' ? 'lamp' : (p.kind === 'bench' || p.kind === 'table' || p.kind === 'desk' || p.kind === 'crate') ? 'wood' : 'metal';
      groups[key].push(box(p.w, p.h, p.d, p.x, p.y + p.h / 2, p.z));
    }
    const propMats: Record<string, THREE.Material> = { bed: matBed, metal: matMetal, wood: matWood, lamp: matLamp };
    for (const key of Object.keys(groups)) {
      if (!groups[key].length) continue;
      scene.add(new THREE.Mesh(mergeGeometries(groups[key])!, propMats[key]));
    }

    // cell interiors: a painted floor patch + a bunk frame edge, one instanced mesh each
    const patchGeo = new THREE.PlaneGeometry(CELL_W - 0.3, CELL_D - 0.3);
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x2a2f31, roughness: 0.95 });
    const patches = new THREE.InstancedMesh(patchGeo, patchMat, sim.cells.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s3 = new THREE.Vector3(1, 1, 1);
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    sim.cells.forEach((c, i) => {
      m4.compose(new THREE.Vector3(c.x, 0.015, c.z), flat, s3);
      patches.setMatrixAt(i, m4);
    });
    scene.add(patches);

    // bars: 11 vertical rods + 2 rails per cell front
    const BARS = 11;
    const barGeo = new THREE.BoxGeometry(0.055, CELL_H - 0.35, 0.055);
    const bars = new THREE.InstancedMesh(barGeo, matBars, sim.cells.length * BARS);
    const railGeo = new THREE.BoxGeometry(CELL_W, 0.09, 0.09);
    const rails = new THREE.InstancedMesh(railGeo, matBars, sim.cells.length * 3);
    let bi = 0, ri = 0;
    for (const c of sim.cells) {
      const zf = c.z + c.face * (CELL_D / 2);
      for (let k = 0; k < BARS; k++) {
        const x = c.x - CELL_W / 2 + (CELL_W / (BARS - 1)) * k;
        m4.compose(new THREE.Vector3(x, CELL_H / 2 - 0.1, zf), q.identity(), s3);
        bars.setMatrixAt(bi++, m4);
      }
      for (const y of [0.55, CELL_H / 2, CELL_H - 0.3]) {
        m4.compose(new THREE.Vector3(c.x, y, zf), q.identity(), s3);
        rails.setMatrixAt(ri++, m4);
      }
    }
    scene.add(bars, rails);

    // lock plates: one per cell, hidden when broken
    const lockGeo = new THREE.BoxGeometry(0.34, 0.42, 0.12);
    const lockMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, metalness: 0.8, emissive: 0x2a1f00 });
    const locks = new THREE.InstancedMesh(lockGeo, lockMat, sim.cells.length);
    for (const c of sim.cells) {
      m4.compose(new THREE.Vector3(c.x, 1.15, c.z + c.face * (CELL_D / 2) + c.face * 0.12), q.identity(), s3);
      locks.setMatrixAt(c.id, m4);
    }
    scene.add(locks);

    // lamps (emissive strips) + a moving pool of point lights around the player
    const lampGeo = new THREE.BoxGeometry(2.2, 0.16, 0.5);
    const lamps = new THREE.InstancedMesh(lampGeo, matLamp, sim.props.filter((p) => p.kind === 'lamp').length);
    let li = 0;
    for (const p of sim.props) if (p.kind === 'lamp') {
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q.identity(), s3);
      lamps.setMatrixAt(li++, m4);
    }
    scene.add(lamps);

    const lights: THREE.PointLight[] = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xcfe4ff, 0, 26, 2);
      scene.add(l); lights.push(l);
    }
    const lampSpots = sim.props.filter((p) => p.kind === 'lamp').map((p) => new THREE.Vector3(p.x, p.y - 0.4, p.z));

    /* ---------------- bodies ---------------- */
    const guardBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 1.15, 0.34), matGuard, sim.guards.length);
    const guardHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), matGuardHead, sim.guards.length);
    const guardGun = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), matMetal, sim.guards.length);
    scene.add(guardBody, guardHead, guardGun);

    const inmateBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 1.1, 0.32), matInmate, sim.inmates.length);
    const inmateHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), matInmateHead, sim.inmates.length);
    scene.add(inmateBody, inmateHead);

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

    /* ---------------- input ---------------- */
    const keys: Record<string, boolean> = {};
    let firing = false;
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
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
      if (document.pointerLockElement !== renderer.domElement) {
        dragging = true;
        try { void renderer.domElement.requestPointerLock(); } catch { /* ignore */ }
      }
      firing = true;
      shoot();
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

    const compose = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rot: number, scaleY = 1) => {
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -rot, 0));
      m4.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(1, scaleY, 1));
      mesh.setMatrixAt(i, m4);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (intro > 0) setIntro((v) => Math.max(0, v - dt * 0.42));

      // input → sim
      const fwd = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
      const strafe = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
      sim.update(dt, { fwd, strafe, sprint: !!keys['shift'] });

      // automatic fire while the trigger is held (pistol cadence)
      if (firing) {
        autoFireT -= dt;
        if (autoFireT <= 0) { autoFireT = 0.16; if (sim.cool <= 0) shoot(); }
      }

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
        l.intensity = sim.lightsOut ? 1.5 : 11;
      });
      flashLight.intensity = sim.flashlight ? 34 : 0;
      muzzle.intensity = sim.flash > 0 ? 26 : 0;

      // bodies
      sim.guards.forEach((g, i) => {
        const down = g.state === 'down';
        compose(guardBody, i, g.x, g.y + (down ? 0.28 : 0.62), g.z, g.ang, down ? 0.5 : 1);
        compose(guardHead, i, g.x, g.y + (down ? 0.42 : 1.32), g.z, g.ang);
        compose(guardGun, i, g.x + Math.cos(g.ang) * 0.42, g.y + (down ? 0.3 : 0.95), g.z + Math.sin(g.ang) * 0.42, g.ang);
      });
      guardBody.instanceMatrix.needsUpdate = true;
      guardHead.instanceMatrix.needsUpdate = true;
      guardGun.instanceMatrix.needsUpdate = true;

      sim.inmates.forEach((n, i) => {
        const down = n.state === 'down';
        compose(inmateBody, i, n.x, n.y + (down ? 0.26 : 0.6), n.z, n.ang, down ? 0.5 : 1);
        compose(inmateHead, i, n.x, n.y + (down ? 0.4 : 1.28), n.z, n.ang);
      });
      inmateBody.instanceMatrix.needsUpdate = true;
      inmateHead.instanceMatrix.needsUpdate = true;

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
          ...sim.buttons.filter((b) => !b.used).map((b) => ({ label: b.kind === 'open-all' ? 'MASTER' : b.kind.toUpperCase(), ang: Math.atan2(b.z - sim.pz, b.x - sim.px) })),
          { label: 'SALLY', ang: Math.atan2(108 - sim.pz, 0 - sim.px) },
        ].map((m) => ({ label: m.label, angle: m.ang - sim.yaw, dist: 0 }));
        setScreen({
          hp: Math.max(0, Math.round(sim.hp)), armor: Math.round(sim.armor),
          mag: sim.mag, magSize: sim.magSize, reserve: sim.reserve, reloading: sim.reloading > 0,
          alarm: sim.alarm, prompt: sim.buttonNear ? `E · ${sim.buttonNear.label}` : sim.lockNear ? 'SHOOT THE LOCK' : '',
          message: sim.message, messageT: sim.messageT,
          cells: sum.opened, free: sum.free, guards: sum.guards, sally: sum.sallyOpen,
          lights: sim.lightsOut, compass, stats: { ...sim.stats }, flashlight: sim.flashlight,
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
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 70px rgba(0,0,0,0.85)' }} />

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
              <p className="mt-4 text-[11px] tracking-[0.3em] text-[#d8b45a]">SHOOT THE LOCK · FIND THE CONTROL ROOM · OPEN EVERY DOOR</p>
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
            ALARM {Math.round(screen.alarm * 100)}%
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
          <p className="text-[10px] tracking-[0.25em] text-[#8fa8ab]">RESERVE {screen.reserve} · M9 SIDEARM</p>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-[#6f8f93]">
            {screen.flashlight ? 'FLASHLIGHT ON' : 'F · FLASHLIGHT'} · R · RELOAD
          </p>
        </div>

        {/* objective */}
        <div className="absolute bottom-6 left-7 max-w-[380px] text-[10px] leading-relaxed tracking-[0.18em] text-[#93aeb0]">
          <p className="text-[#d8b45a]">OBJECTIVE</p>
          {screen.cells === 0 && <p>1 · SHOOT THE LOCK ON YOUR BARS (3 HITS)</p>}
          {!screen.sally && <p>2 · REACH CONTROL B · OPEN THE SALLY PORT</p>}
          <p>3 · {screen.cells < 360 ? 'CONTROL A · MASTER RELEASE (OPTIONAL MAYHEM)' : 'GET OUT THROUGH THE SOUTH GATE'}</p>
          {screen.sally && <p className="text-[#8fffc4]">SALLY PORT OPEN — RUN SOUTH</p>}
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
