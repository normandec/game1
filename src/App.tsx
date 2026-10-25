import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, WEAPONS, type GameStatus, type Hud, type Perk } from './game/engine';
import { sfx } from './game/audio';
import { bestScore, loadName, loadScores, renameEntry, saveName, saveScore, type ScoreEntry } from './game/scores';
import {
  GameOverScreen, PauseScreen, UpgradeScreen, VictoryScreen,
} from './components/Screens';
import VaultRoom from './components/VaultRoom';
import OperationsMenu from './components/OperationsMenu';
import CombatHud from './components/CombatHud';
import OperationBriefing from './components/OperationBriefing';
import Prison3D, { type PrisonMode } from './components/Prison3D';
import Glacier3D, { type GlacierStats } from './components/Glacier3D';
import type { PrisonStats } from './game/prison';

const emptyHud: Hud = {
  score: 0, wave: 0, hp: 100, maxHp: 100, weapon: 'RIFLE', ammo: -1, grenades: 4,
  shieldHp: 0, shieldMax: 0,
  streak: 0, mult: 1, dashPct: 1, enemiesLeft: 0, grenadeCap: 6,
  aiTactic: 'PHALANX', aiNote: 'HQ ONLINE — PLANNING', aiLevel: 0.65,
  aiVolley: 0, aiSquads: 0, aiThreat: 0,
  serversLeft: 6, serversTotal: 6, codersLeft: 14, generalHp: 1, generalShield: true,
  satcomsLeft: 5, satcomTotal: 5, vtolsInbound: 0,
  trucksActive: 0, helisActive: 0, woundedCount: 0, barriersActive: 0, phase: 'RECON',
  piloting: false, heliHp: 0, heliMaxHp: 0, heliFuel: 0, hangarDist: 0,
  heliStation: 0, heliAmmo: [-1, 8, 6] as [number, number, number], heliLock: false,
  armyAlarm: 0, armyAwake: 0, armyTotal: 0, turretsHeld: 0, turretsTotal: 0, turretPrompt: '',
  sector: 1, basesCleared: 0, sectorName: 'THE FALLEN HUB', destination: '', transitPct: 0,
  driving: false, tank: false, flyingPlane: false, jet: false, jetBoost: 0,
  jetSpeed: 0, jetAlt: 0, jetMode: 'cannon', jetFlares: 0, jetLock: '', jetAutopilot: false, frostwing: false, airThreat: 0, jetAce: false,
  inventory: [],
  allies: 0, barricades: 0, siegeActive: false,
  lasersHeld: 0, poisCaptured: 0, poisTotal: 5, vaultFound: false, nearPrompt: '',
  coords: 'X 6000  Y 6800', gatePrompt: '', aegisCharges: 0, aegisTime: 0, mouseSens: 1,
  vehicleHp: 0, vehicleMax: 1, vehicleFuel: 100,
  blackoutHud: false, facilityLabel: '', facilityStatus: '',
  alarmActive: false, alarmExposure: 0, alarmJammed: 0, responseRemaining: 0,
  airTransports: 0, storyTitle: '', storyText: '', storyChannel: '', storyTime: 0,
  libraryProgress: 0, librarySolved: false,
  overrideProgress: 0, overrideActive: false, overrideBase: '',
  objective: 'ASSAULT THE FORTRESS', hqDist: 0,
  banner: '', bannerSub: '', bannerT: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const statusRef = useRef<GameStatus>('menu');
  const nameRef = useRef('');

  const [status, setStatusState] = useState<GameStatus>('menu');
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [best, setBest] = useState(0);
  const [name, setNameState] = useState('');
  const [muted, setMuted] = useState(false);
  const [entryDate, setEntryDate] = useState(0);
  const [isBest, setIsBest] = useState(false);
  const [touch, setTouch] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [tour, setTour] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [prisonMode, setPrisonMode] = useState<PrisonMode>('visit');
  const [choices, setChoices] = useState<Perk[]>([]);
  const [build, setBuild] = useState<{ perk: Perk; count: number }[]>([]);
  const [cls, setCls] = useState('assault');
  const clsRef = useRef('assault');
  const chooseCls = useCallback((c: string) => { clsRef.current = c; setCls(c); }, []);
  const [support, setSupport] = useState('aegis');
  const supportRef = useRef('aegis');
  const chooseSupport = useCallback((s: string) => { supportRef.current = s; setSupport(s); }, []);

  const setStatus = useCallback((s: GameStatus) => { statusRef.current = s; setStatusState(s); }, []);

  const setName = useCallback((n: string) => {
    nameRef.current = n; setNameState(n); saveName(n);
    if (entryDate) setScores(renameEntry(entryDate, n || 'OPERATIVE'));
  }, [entryDate]);

  useEffect(() => {
    setScores(loadScores());
    setBest(bestScore());
    const n = loadName();
    nameRef.current = n; setNameState(n);
    setTouch(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (statusRef.current === 'playing') {
      g.clearInput();
      g.status = 'paused'; setBuild(g.getBuild()); setStatus('paused'); sfx.click();
    } else if (statusRef.current === 'paused') {
      g.status = 'playing'; setStatus('playing'); sfx.click();
    }
  }, [setStatus]);

  const recordScore = useCallback((score: number, wave: number, won: boolean) => {
    const entry: ScoreEntry = {
      name: (nameRef.current || 'OPERATIVE').toUpperCase(), score, wave, date: Date.now(),
    };
    const list = saveScore(entry);
    setScores(list);
    setEntryDate(entry.date);
    setBest(list.length ? list[0].score : score);
    setIsBest(list.length > 0 && list[0].date === entry.date && score > 0);
    if (gameRef.current) setBuild(gameRef.current.getBuild());
    setStatus(won ? 'victory' : 'over');
  }, [setStatus]);

  const handleOver = useCallback((s: number, w: number) => recordScore(s, w, false), [recordScore]);
  const handleVictory = useCallback((s: number, w: number) => recordScore(s, w, true), [recordScore]);
  const handleTransit = useCallback((sector: number) => {
    setStatus(sector > 0 ? 'transit' : 'playing');
  }, [setStatus]);
  const handleVault = useCallback((open: boolean) => setStatus(open ? 'interior' : 'playing'), [setStatus]);
  /** The engine drives the arrest cinematic on its own canvas, then hands over to the 3D prison. */
  const handleArrestAnim = useCallback((on: boolean) => {
    setStatus(on ? 'arrest' : 'playing');
  }, [setStatus]);
  const handlePrison = useCallback((mode: PrisonMode) => {
    setPrisonMode(mode);
    setStatus('prison');
  }, [setStatus]);
  /** The hidden ice base hands the operative back to the surface with whatever he found. */
  const handleGlacier = useCallback(() => setStatus('glacier'), [setStatus]);
  const handleGlacierExit = useCallback((stats: GlacierStats, tookPlane: boolean) => {
    gameRef.current?.leaveGlacier(stats, tookPlane);
    setStatus('playing');
  }, [setStatus]);

  const handlePrisonExit = useCallback((stats: PrisonStats, escaped: boolean) => {
    const g = gameRef.current;
    g?.leavePrison(stats, escaped);
    setStatus('playing');
  }, [setStatus]);

  const handleUpgrade = useCallback((c: Perk[]) => {
    setChoices(c);
    if (gameRef.current) setBuild(gameRef.current.getBuild());
    setStatus('upgrade');
  }, [setStatus]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, {
      onHud: setHud,
      onOver: handleOver,
      onPauseToggle: () => togglePause(),
      onUpgrade: handleUpgrade,
      onVictory: handleVictory,
      onTransit: handleTransit,
      onVault: handleVault,
      onPrison: handlePrison,
      onGlacier: handleGlacier,
      onArrestAnimChange: handleArrestAnim,
    });
    gameRef.current = g;
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvasRef.current);
    return () => { ro.disconnect(); g.destroy(); gameRef.current = null; };
  }, [handleOver, togglePause, handleUpgrade, handleVictory, handleTransit, handleVault, handlePrison, handleArrestAnim]);

  const startRun = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setBriefing(false);
    saveName(nameRef.current);
    setEntryDate(0); setIsBest(false); setChoices([]); setBuild([]);
    g.startRun(clsRef.current, supportRef.current);
    setStatus('playing');
    sfx.click();
  }, [setStatus]);

  const chooseUpgrade = useCallback((id: string) => {
    const g = gameRef.current;
    if (!g) return;
    g.chooseUpgrade(id);
    setBuild(g.getBuild()); setChoices([]); setStatus('playing');
  }, [setStatus]);

  const quitToMenu = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.reset(); g.status = 'menu';
    setStatus('menu'); setScores(loadScores()); sfx.click();
  }, [setStatus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tour || statusRef.current === 'interior' || e.repeat) return;
      if (briefing) {
        if (e.key === 'Enter') startRun();
        if (e.key === 'Escape') setBriefing(false);
        return;
      }
      if (statusRef.current === 'upgrade') {
        if (['1', '2', '3'].includes(e.key)) {
          const g = gameRef.current;
          const idx = parseInt(e.key, 10) - 1;
          if (g && g.upgradeChoices[idx]) chooseUpgrade(g.upgradeChoices[idx].id);
        }
        return;
      }
      if (e.key === 'Enter' && (statusRef.current === 'menu' || statusRef.current === 'over' || statusRef.current === 'victory')) {
        if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
        if (statusRef.current === 'menu') setBriefing(true); else startRun();
      }
      if (e.key.toLowerCase() === 'r' && (statusRef.current === 'over' || statusRef.current === 'victory')) startRun();
    };
    const onHide = () => { if (statusRef.current === 'playing') { gameRef.current?.clearInput(); togglePause(); } };
    // the 3D prison owns the keyboard while it is on screen
    void 0;
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onHide);
    };
  }, [startRun, togglePause, chooseUpgrade, tour, briefing]);

  const cycleMouse = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const steps = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
    const next = steps.find((v) => v > g.aimSens + 1e-6) ?? steps[0];
    g.setAimSens(next);
    setHud((h) => ({ ...h, mouseSens: g.aimSens }));
    sfx.click();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => { sfx.setMuted(!m); return !m; });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      const exit = document.exitFullscreen?.();
      if (exit && typeof exit.catch === 'function') exit.catch(() => {});
      return;
    }
    const req = document.documentElement.requestFullscreen?.();
    if (req && typeof req.catch === 'function') req.catch(() => {}); // embedded players may refuse
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const showHud = status === 'playing' || status === 'paused' || status === 'upgrade';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05090a]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        style={{ cursor: status === 'playing' && !touch ? 'crosshair' : 'default', visibility: status === 'interior' || status === 'menu' || status === 'prison' || status === 'glacier' ? 'hidden' : 'visible' }}
      />

      {status === 'menu' && !tour && <VaultRoom backdrop onExit={() => {}} onAction={() => ''} />}
      {status === 'prison' && <Prison3D mode={prisonMode} onExit={handlePrisonExit} />}
      {status === 'glacier' && <Glacier3D onExit={handleGlacierExit} />}

      {(status === 'interior' || tour) && <VaultRoom preview={tour}
        onExit={() => tour ? setTour(false) : gameRef.current?.leaveVault()}
        onAction={action => gameRef.current?.vaultAction(action) || 'LINK OFFLINE'} />}

      {showHud && (
        <CombatHud hud={hud} best={best} muted={muted} onPause={togglePause} onMute={toggleMute}
          fullscreen={fullscreen} onFullscreen={toggleFullscreen}
          onDash={() => gameRef.current?.doDash()}
          onSecondary={() => gameRef.current?.throwGrenade()}
          onUse={() => gameRef.current?.interactHeli()}
          onGate={() => gameRef.current?.toggleGate()}
          onAegis={() => gameRef.current?.activateAegis()}
          onGuide={() => gameRef.current?.toggleVaultRoute()}
          onMouse={cycleMouse}
          onReload={() => gameRef.current?.reloadWeapon()}
          onWeapon={(short) => gameRef.current?.selectWeapon(
            Object.keys(WEAPONS).find((id) => WEAPONS[id].short === short) ?? 'rifle',
          )}
        />
      )}

      {status === 'menu' && !tour && !briefing && (
        <OperationsMenu
          onStart={() => setBriefing(true)} scores={scores} name={name} setName={setName}
          cls={cls} setCls={chooseCls} support={support} setSupport={chooseSupport}
          onTour={() => setTour(true)}
        />
      )}
      {status === 'menu' && briefing && <OperationBriefing onBegin={startRun} onBack={() => setBriefing(false)} />}
      {status === 'upgrade' && (
        <UpgradeScreen wave={hud.wave} choices={choices} onChoose={chooseUpgrade} build={build} />
      )}
      {status === 'paused' && (
        <PauseScreen hud={hud} onResume={togglePause} onRestart={startRun} onQuit={quitToMenu} build={build} />
      )}
      {status === 'over' && (
        <GameOverScreen
          hud={hud} scores={scores} name={name} setName={setName}
          onRestart={startRun} onMenu={quitToMenu} isBest={isBest} entryDate={entryDate} build={build}
        />
      )}
      {status === 'victory' && (
        <VictoryScreen
          hud={hud} scores={scores} name={name} setName={setName}
          onRestart={startRun} onMenu={quitToMenu} isBest={isBest} entryDate={entryDate} build={build}
        />
      )}
    </div>
  );
}
