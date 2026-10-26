import { sfx } from './audio';
import type { SectorDressing } from './sectorKits';
import type { ArmyPlan, JetTier } from './army';
import { AIRFIELD, VAULT_ENTRY, ARENA_W, ARENA_H, HQ, PLAYER_START, SECTORS, SpatialGrid, generateWorld, type Rect, type Zone } from './world';
import { RoutePlanner, segmentBox, segmentCircle, type Point, type Block } from './navigation';
import { makeGates, makeDetails, gateBlocks, drawGate, drawDetails, type HydraulicGate, type RoomDetail } from './installations';
import { drawTransport, drawParkedAircraft } from './vehicleArt';
import { makeBoat, drawBoat, LANDING_BEACHES, MOORINGS, BOAT, type Boat } from './navy';
import { FACILITY_TYPES, type FacilityGuard, type FacilityState, type PostRole } from './facilities';
import { FacilityPainter } from './facilityArt';
import { PROLOGUE, PHASE_STORY, PHASE_TACTICS, LIBRARY_VOLUMES, type StoryEntry } from './campaign';
import { newSecurityState, updateSearchlights, drawSearchlight, type Searchlight } from './security';
import { prepareStructures, structuralHealth, distanceToBlock, drawRuins, type Ruin } from './destruction';
import { prisonIslandStructures, PRISON_DOOR, ISLAND, BRIDGE, SEA, COAST, BRIDGEHEAD, LAND, type IslandDecor } from './prisonIsland';
import type { PrisonStats } from './prison';
import { drawFixedWing, drawMantis, drawAirborne, type AirTransport, type AirborneTrooper } from './airlift';
import { GOLIATH, MNEMOSYNE, type CampaignSites, type MegaCrate } from './campaignSites';
import { siteLoad, type PowerSite } from './powerGrid';

export { ARENA_W, ARENA_H };

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

export type GameStatus = 'menu' | 'playing' | 'paused' | 'over' | 'upgrade' | 'transit' | 'victory' | 'interior'
  /** Cuffed and driven away: the van ride before the prison. */
  | 'arrest'
  /** Inside the hidden glacier base, drawn by Glacier3D. */
  | 'glacier'
  /** Inside the fully 3D prison, drawn by Prison3D. */
  | 'prison';

/** Battle formations the enemy command deploys. */
export type Tactic = 'phalanx' | 'turtle' | 'blitz' | 'bombers' | 'column' | 'pincer' | 'encircle' | 'ambush';
export type SquadState = 'deploy' | 'advance' | 'engage' | 'flank' | 'regroup' | 'rout';
export type Doctrine = 'anchor' | 'hunter' | 'reserve';

export interface Mods {
  damageMul: number; fireRateMul: number; bulletSpeedMul: number; spreadMul: number;
  speedMul: number; dashCdMul: number; critChance: number; critMul: number; pierce: number;
  lifestealChance: number; regen: number; magnetMul: number; grenadeCap: number;
  thorns: number; explosive: number; maxHpBonus: number; emp: number; shieldBonus: number;
}

export interface Perk {
  id: string; name: string; desc: string; icon: string;
  rarity: 'common' | 'rare' | 'epic'; max: number; apply: (g: Game) => void;
}

export const PERKS: Perk[] = [
  { id: 'dmg', name: 'HOLLOW POINTS', desc: '+22% weapon damage', icon: '🎯', rarity: 'common', max: 6, apply: (g) => { g.mods.damageMul += 0.22; } },
  { id: 'rate', name: 'HAIR TRIGGER', desc: '+16% fire rate', icon: '⚡', rarity: 'common', max: 6, apply: (g) => { g.mods.fireRateMul *= 0.86; } },
  { id: 'hp', name: 'PLATE CARRIER', desc: '+30 max HP & full heal', icon: '🛡️', rarity: 'common', max: 6, apply: (g) => { g.mods.maxHpBonus += 30; g.maxHp = 100 + g.mods.maxHpBonus; g.hp = g.maxHp; } },
  { id: 'speed', name: 'LIGHT BOOTS', desc: '+14% move speed', icon: '🥾', rarity: 'common', max: 5, apply: (g) => { g.mods.speedMul += 0.14; } },
  { id: 'crit', name: 'MARKSMAN', desc: '+12% crit chance', icon: '✦', rarity: 'rare', max: 5, apply: (g) => { g.mods.critChance += 0.12; } },
  { id: 'critdmg', name: 'EXECUTIONER', desc: '+60% crit damage', icon: '💥', rarity: 'rare', max: 4, apply: (g) => { g.mods.critMul += 0.6; } },
  { id: 'pierce', name: 'RAILCORE', desc: 'Rounds pierce +1 enemy', icon: '➹', rarity: 'rare', max: 4, apply: (g) => { g.mods.pierce += 1; } },
  { id: 'dash', name: 'PHASE DRIVE', desc: '-25% dash cooldown', icon: '💨', rarity: 'rare', max: 3, apply: (g) => { g.mods.dashCdMul *= 0.75; } },
  { id: 'magnet', name: 'SCAVENGER', desc: '+60% pickup range & drops', icon: '🧲', rarity: 'common', max: 4, apply: (g) => { g.mods.magnetMul += 0.6; } },
  { id: 'frag', name: 'BANDOLIER', desc: '+2 max frags & refill', icon: '💣', rarity: 'common', max: 4, apply: (g) => { g.mods.grenadeCap += 2; g.grenades = g.mods.grenadeCap; } },
  { id: 'lifesteal', name: 'VAMPIRIC RDS', desc: '18% chance to heal on kill', icon: '🩸', rarity: 'epic', max: 3, apply: (g) => { g.mods.lifestealChance += 0.18; } },
  { id: 'regen', name: 'NANO WEAVE', desc: 'Regenerate +2 HP/sec', icon: '➕', rarity: 'epic', max: 4, apply: (g) => { g.mods.regen += 2; } },
  { id: 'thorns', name: 'REACTIVE ARMOR', desc: 'Reflect damage to attackers', icon: '⚔️', rarity: 'epic', max: 3, apply: (g) => { g.mods.thorns += 24; } },
  { id: 'explosive', name: 'INCENDIARY', desc: 'Rounds explode on impact', icon: '🔥', rarity: 'epic', max: 3, apply: (g) => { g.mods.explosive += 1; } },
  { id: 'emp', name: 'EMP ROUNDS', desc: '+70% damage to enemy mainframes', icon: '📡', rarity: 'rare', max: 3, apply: (g) => { g.mods.emp += 0.7; } },
  { id: 'shield', name: 'BALLISTIC PLATE', desc: '+120 riot shield, recharged each wave', icon: '🔰', rarity: 'rare', max: 4, apply: (g) => { g.mods.shieldBonus += 120; g.shieldMax = Math.max(g.shieldMax, 120 + g.mods.shieldBonus); g.shieldHp = g.shieldMax; } },
];

export interface Hud {
  score: number; wave: number; hp: number; maxHp: number; weapon: string; ammo: number;
  grenades: number; streak: number; mult: number; dashPct: number; enemiesLeft: number;
  grenadeCap: number; aiTactic: string; aiNote: string; aiLevel: number; aiVolley: number;
  aiSquads: number; aiThreat: number;
  shieldHp: number; shieldMax: number;
  serversLeft: number; serversTotal: number; codersLeft: number; generalHp: number;
  generalShield: boolean; objective: string; hqDist: number;
  satcomsLeft: number; satcomTotal: number; vtolsInbound: number;
  trucksActive: number; helisActive: number; woundedCount: number;
  barriersActive: number; phase: string;
  piloting: boolean; heliHp: number; heliMaxHp: number; heliFuel: number; hangarDist: number;
  /** Gunship ordnance: selected station, rounds left per station and whether an air target is held. */
  heliStation: number; heliAmmo: [number, number, number]; heliLock: boolean;
  sector: number; basesCleared: number; sectorName: string; destination: string; transitPct: number;
  driving: boolean; tank: boolean; flyingPlane: boolean; allies: number; barricades: number;
  /** Seized army interceptor: afterburner, airspeed, station, flares and lock. */
  jet: boolean; jetBoost: number;
  jetSpeed: number; jetAlt: number; jetMode: string; jetFlares: number;
  jetLock: string; jetAutopilot: boolean; frostwing: boolean;
  /** Hostile fighters currently hunting the operative. */
  airThreat: number;
  /** Flying one of the two experimental airframes. */
  jetAce: boolean;
  /** Cockpit systems: rounds on the rails, cannon heat, camera view, inbound warning. */
  jetMissiles: number; jetRockets: number; jetLance: number;
  jetHeat: number; jetJam: boolean; jetView: string; jetRwr: boolean; jetTier: string;
  /** Developer console: the run was started from the dev panel and cannot be lost. */
  devInfinite: boolean; devSector: number;
  /** The kit: four groups of item chips, built every HUD tick. */
  inventory: { group: string; items: { label: string; detail: string; tone: string }[] }[];
  siegeActive: boolean; lasersHeld: number; poisCaptured: number; poisTotal: number;
  vaultFound: boolean; nearPrompt: string;
  coords: string; gatePrompt: string; aegisCharges: number; aegisTime: number;
  /* ---------------- IRON RESERVE ---------------- */
  armyAlarm: number;
  armyAwake: number; armyTotal: number;
  turretsHeld: number; turretsTotal: number;
  turretPrompt: string;
  mouseSens: number;
  vehicleHp: number; vehicleMax: number; vehicleFuel: number;
  blackoutHud: boolean;
  facilityLabel: string; facilityStatus: string;
  alarmActive: boolean; alarmExposure: number; alarmJammed: number; responseRemaining: number;
  airTransports: number; storyTitle: string; storyText: string; storyChannel: string; storyTime: number;
  libraryProgress: number; librarySolved: boolean;
  overrideProgress: number; overrideActive: boolean; overrideBase: string;
  banner: string; bannerSub: string; bannerT: number;
}

interface WeaponDef {
  name: string; short: string; rate: number; dmg: number; pellets: number; spread: number;
  speed: number; ammo: number; kick: number; sound: 'rifle' | 'shotgun' | 'smg' | 'rocket';
  rocket?: boolean; color: string; len: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  rifle: { name: 'M4 CARBINE', short: 'RIFLE', rate: 0.1, dmg: 17, pellets: 1, spread: 0.038, speed: 1250, ammo: Infinity, kick: 2.2, sound: 'rifle', color: '#8ce8ff', len: 16 },
  shotgun: { name: 'BREACHER-12', short: 'SHOTGUN', rate: 0.58, dmg: 13, pellets: 9, spread: 0.3, speed: 950, ammo: 34, kick: 10, sound: 'shotgun', color: '#ffd27d', len: 12 },
  smg: { name: 'VECTOR SMG', short: 'SMG', rate: 0.053, dmg: 10, pellets: 1, spread: 0.115, speed: 1280, ammo: 190, kick: 1.5, sound: 'smg', color: '#c4ff8c', len: 13 },
  rocket: { name: 'RPG LAUNCHER', short: 'RPG', rate: 0.8, dmg: 62, pellets: 1, spread: 0.015, speed: 680, ammo: 10, kick: 16, sound: 'rocket', rocket: true, color: '#ff9d5c', len: 18 },
  dmr: { name: 'MK-14 DMR', short: 'DMR', rate: 0.26, dmg: 46, pellets: 1, spread: 0.012, speed: 1700, ammo: 48, kick: 7, sound: 'rifle', color: '#b8a4ff', len: 20 },
  hmg: { name: 'KPVT HEAVY MG', short: 'HMG', rate: 0.072, dmg: 27, pellets: 1, spread: 0.075, speed: 1480, ammo: 240, kick: 4.4, sound: 'rifle', color: '#ffd166', len: 22 },
  gl: { name: 'M79 THUMPER', short: 'GL', rate: 0.8, dmg: 105, pellets: 1, spread: 0.02, speed: 700, ammo: 14, kick: 9, sound: 'shotgun', color: '#ffca7a', len: 16 },
  // The sidearm that survives the intake search; the prison's only firearm.
  pistol: { name: 'M9 SIDEARM', short: 'PISTOL', rate: 0.19, dmg: 26, pellets: 1, spread: 0.02, speed: 1500, ammo: Infinity, kick: 2.4, sound: 'smg', color: '#dfe9ff', len: 12 },
};

/** What the operative calls each requisitioned body. */
const VAN_LABEL: Record<string, string> = {
  car: 'STAFF CAR', humvee: 'ARMOURED HUMMER', bus: 'TROOP BUS', tanker: 'FUEL TANKER',
  truck: 'CARGO LORRY', ambulance: 'FIELD AMBULANCE',
};

interface EnemyDef {
  hp: number; speed: number; r: number; dmg: number; score: number; color: string; dark: string;
  ranged?: boolean; range?: number; fireRate?: number; bulletSpeed?: number; bulletDmg?: number;
  pellets?: number; spread?: number; boss?: boolean; shield?: number; civilian?: boolean;
}

const ENEMIES: Record<string, EnemyDef> = {
  grunt:     { hp: 40, speed: 104, r: 15, dmg: 10, score: 100, color: '#ff5d5d', dark: '#7a1f28', ranged: true, range: 300, fireRate: 1.5, bulletSpeed: 430, bulletDmg: 7, pellets: 1, spread: 0.07 },
  rusher:    { hp: 30, speed: 245, r: 12, dmg: 14, score: 150, color: '#ff8a3d', dark: '#7a3a15' },
  gunner:    { hp: 58, speed: 92,  r: 15, dmg: 8,  score: 220, color: '#c96bff', dark: '#40206b', ranged: true, range: 400, fireRate: 1.2, bulletSpeed: 500, bulletDmg: 10, pellets: 1, spread: 0.045 },
  shieldman: { hp: 150, speed: 80, r: 18, dmg: 15, score: 320, color: '#7fa6ff', dark: '#1e2d5c', shield: 0.68, ranged: true, range: 250, fireRate: 1.9, bulletSpeed: 420, bulletDmg: 8, pellets: 2, spread: 0.16 },
  heavy:     { hp: 235, speed: 64, r: 24, dmg: 20, score: 400, color: '#ff3b6b', dark: '#5c1026', ranged: true, range: 300, fireRate: 1.85, bulletSpeed: 430, bulletDmg: 8, pellets: 5, spread: 0.32 },
  sniper:    { hp: 40, speed: 108, r: 13, dmg: 6,  score: 300, color: '#7dd7ff', dark: '#1d3a4a', ranged: true, range: 780, fireRate: 2.6, bulletSpeed: 1050, bulletDmg: 22, pellets: 1, spread: 0.008 },
  bomber:    { hp: 70, speed: 96,  r: 16, dmg: 12, score: 340, color: '#ffb03d', dark: '#5c3a08', ranged: true, range: 460, fireRate: 3.0, bulletSpeed: 400, bulletDmg: 6, pellets: 1, spread: 0.1 },
  commander: { hp: 300, speed: 86, r: 20, dmg: 13, score: 700, color: '#ffd166', dark: '#6b4a12', ranged: true, range: 470, fireRate: 1.5, bulletSpeed: 520, bulletDmg: 11, pellets: 3, spread: 0.1 },
  guard:     { hp: 180, speed: 88, r: 17, dmg: 16, score: 380, color: '#9be8c4', dark: '#164034', ranged: true, range: 420, fireRate: 1.15, bulletSpeed: 540, bulletDmg: 12, pellets: 2, spread: 0.07 },
  sentinel:  { hp: 160, speed: 90, r: 16, dmg: 10, score: 540, color: '#889ecc', dark: '#1b2e48', ranged: true, range: 850, fireRate: 1.35, bulletSpeed: 870, bulletDmg: 18, pellets: 1, spread: 0.018 },
  breacher:  { hp: 155, speed: 124, r: 17, dmg: 18, score: 470, color: '#d4a880', dark: '#4d3023', ranged: true, range: 270, fireRate: 1.25, bulletSpeed: 550, bulletDmg: 7, pellets: 5, spread: 0.25 },
  warden:    { hp: 205, speed: 80, r: 19, dmg: 16, score: 620, color: '#74b6c9', dark: '#193a4c', shield: 0.7, ranged: true, range: 340, fireRate: 1.55, bulletSpeed: 490, bulletDmg: 9, pellets: 2, spread: 0.09 },
  pathfinder:{ hp: 78, speed: 162, r: 14, dmg: 11, score: 360, color: '#beca89', dark: '#3b4527', ranged: true, range: 440, fireRate: 1.05, bulletSpeed: 610, bulletDmg: 9, pellets: 1, spread: 0.035 },
  medic:     { hp: 76, speed: 104, r: 15, dmg: 5, score: 450, color: '#8dffb0', dark: '#1d4a2c', ranged: true, range: 300, fireRate: 2.6, bulletSpeed: 430, bulletDmg: 4, pellets: 1, spread: 0.14 },
  sapper:    { hp: 62, speed: 98, r: 14, dmg: 10, score: 400, color: '#d8b06a', dark: '#5a4516', ranged: true, range: 260, fireRate: 2.4, bulletSpeed: 410, bulletDmg: 7, pellets: 1, spread: 0.1 },
  raider:    { hp: 58, speed: 265, r: 13, dmg: 17, score: 260, color: '#ff5f9e', dark: '#6b1530' },
  warhound:  { hp: 72, speed: 300, r: 14, dmg: 19, score: 360, color: '#ff8c62', dark: '#5e2618' },
  drone:     { hp: 82, speed: 145, r: 14, dmg: 8, score: 520, color: '#87eaff', dark: '#123e4a', ranged: true, range: 500, fireRate: 0.9, bulletSpeed: 660, bulletDmg: 10, pellets: 1, spread: 0.025 },
  specter:   { hp: 90, speed: 185, r: 14, dmg: 15, score: 600, color: '#abff78', dark: '#254b18', ranged: true, range: 360, fireRate: 1.25, bulletSpeed: 600, bulletDmg: 13, pellets: 2, spread: 0.08 },
  juggernaut:{ hp: 520, speed: 55, r: 29, dmg: 28, score: 1100, color: '#e84562', dark: '#4f101c', shield: 0.5, ranged: true, range: 360, fireRate: 1.6, bulletSpeed: 460, bulletDmg: 12, pellets: 7, spread: 0.34 },
  // Flamethrower specialist: slow burning cone, terrifies at close range, tank on the back.
  flamer:    { hp: 145, speed: 94, r: 17, dmg: 13, score: 430, color: '#ff9c4a', dark: '#5e2c07', ranged: true, range: 235, fireRate: 0.3, bulletSpeed: 340, bulletDmg: 5, pellets: 3, spread: 0.26 },
  // Riot custody officer behind a real ballistic shield: frontal fire barely scratches
  // him. He never shoots — he closes the distance and arrests the operative.
  custodian: { hp: 280, speed: 96, r: 19, dmg: 0, score: 520, color: '#3f6fd8', dark: '#122a52', shield: 0.86, ranged: false },
  turret:    { hp: 260, speed: 0, r: 19, dmg: 0, score: 650, color: '#ff3858', dark: '#4f101c', ranged: true, range: 620, fireRate: 0.72, bulletSpeed: 720, bulletDmg: 11, pellets: 1, spread: 0.018 },
  boss:      { hp: 1500, speed: 72, r: 44, dmg: 28, score: 3000, color: '#ff2d55', dark: '#450a18', ranged: true, range: 520, fireRate: 1.05, bulletSpeed: 460, bulletDmg: 12, pellets: 10, spread: 6.28, boss: true },
  // ---------------- IRON RESERVE (sector 6) ----------------
  // The army fights in a different key to Hydra: tighter volleys, longer range, no theatrics.
  armytrooper: { hp: 62, speed: 118, r: 14, dmg: 12, score: 140, color: '#c9d39a', dark: '#3d4a2a', ranged: true, range: 420, fireRate: 1.15, bulletSpeed: 640, bulletDmg: 9, pellets: 1, spread: 0.045 },
  armyguard:   { hp: 150, speed: 86, r: 17, dmg: 18, score: 340, color: '#a9b477', dark: '#333d22', shield: 0.5, ranged: true, range: 330, fireRate: 1.0, bulletSpeed: 580, bulletDmg: 12, pellets: 2, spread: 0.11 },
  armyengineer:{ hp: 82, speed: 104, r: 14, dmg: 8, score: 260, color: '#d8c07a', dark: '#4a3d18', ranged: true, range: 300, fireRate: 1.6, bulletSpeed: 470, bulletDmg: 6, pellets: 1, spread: 0.08 },
  armymedic:   { hp: 74, speed: 112, r: 14, dmg: 4, score: 300, color: '#bfe8a8', dark: '#2f4a22', ranged: true, range: 280, fireRate: 2.4, bulletSpeed: 440, bulletDmg: 4, pellets: 1, spread: 0.14 },
  armymajor:   { hp: 260, speed: 92, r: 19, dmg: 14, score: 620, color: '#e2d79a', dark: '#54491c', ranged: true, range: 480, fireRate: 1.4, bulletSpeed: 600, bulletDmg: 11, pellets: 3, spread: 0.09 },
  // unarmed HQ staff
  coder:     { hp: 55, speed: 132, r: 13, dmg: 0, score: 500, color: '#8fd8ff', dark: '#123044', civilian: true },
  general:   { hp: 900, speed: 66, r: 26, dmg: 0, score: 10000, color: '#ffe08a', dark: '#5a3f06', civilian: true },
};

const TAU = Math.PI * 2;
const NO_ENEMIES: Enemy[] = [];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/* ================================================================== */
/* Entities                                                           */
/* ================================================================== */

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; glow: boolean; }
interface Bullet { x: number; y: number; px: number; py: number; vx: number; vy: number; dmg: number; life: number; friendly: boolean; rocket?: boolean; color: string; r: number; pierce?: number; hits?: Enemy[]; explosive?: number;
  /** Which class of target this round is allowed to touch. Unset means anything. */
  arm?: 'ground' | 'air';
  /** Air-to-air missiles steer towards the nearest airborne contact. */
  homing?: boolean;
  /** The sandbag walls of the emplacement that fired this round: never a target. */
  ownPit?: { x: number; y: number; w: number; h: number }[]; }
interface Enemy {
  type: string; def: EnemyDef; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number;
  flash: number; cool: number; ang: number; wobble: number; stun: number; spawnT: number;
  squadId: number; slot: number; elite: boolean; leader: boolean; buffed: boolean;
  snipeT: number; snipeAng: number; aimLock: number; aimAng: number;
  coverX: number; coverY: number; coverT: number; grenadeCd: number;
  panic: number; garrison: boolean; homeX: number; homeY: number; morale: number;
  lunge: number; charge: number;
  boardingTruck?: number; boardingOrder?: number; alert?: boolean;
  facilityId?: string; postRole?: PostRole; patrol?: Point[]; patrolNode?: number;
  patrolTeam?: string; patrolSlot?: number;
  /** Gate detail: holds the prison approach and lets the operative walk up to the gate. */
  policePost?: boolean;
  /** IRON RESERVE parade: a man standing in ranks who does not move until the alarm. */
  dormant?: boolean;
  /** Parade index, so a sleeping rank keeps its slot when it wakes. */
  rank?: number;
}
interface Squad {
  id: number; tactic: Tactic; state: SquadState; doctrine: Doctrine;
  size: number; stateT: number; barkCd: number; angle: number; radius: number;
  volleyT: number; volleyWindow: number; grenadeT: number;
  cx: number; cy: number; fx: number; fy: number; facing: number;
  cohesion: number; morale: number; anchorX: number; anchorY: number;
}
interface Server { x: number; y: number; hp: number; maxHp: number; dead: boolean; spark: number; }
interface Satcom { x: number; y: number; hp: number; maxHp: number; dead: boolean; sweep: number; }
interface Barrel { x: number; y: number; hp: number; dead: boolean; }
interface Fuse { x: number; y: number; t: number; }
interface Truck {
  x: number; y: number; tx: number; ty: number; ang: number;
  state: 'loading' | 'drive' | 'deploy' | 'leave'; squadId: number;
  comp: string[]; slot: number; deployT: number;
  hp: number; maxHp: number; dead: boolean; announced: boolean;
  speed: number; lean: number;
  rescue: boolean; carrying: number; rescueWait: number;
  /** Blown tyre from a grenade: the rig slews, smokes and never drives again. */
  disabled?: boolean; skidT?: number; wreckT?: number;
  mission?: string; orderedTarget?: Point; launchDelay?: number; parking?: Van;
}
/** Armoured convoy escort: shrugs off almost everything, hits like a siege gun, capturable. */
interface Tank {
  x: number; y: number; goalX: number; goalY: number;
  ang: number; turret: number; lean: number;
  hp: number; maxHp: number; speed: number;
  cool: number; dead: boolean; announced: boolean; captured: boolean; driven?: boolean; ttl: number; aimT?: number; id: number;
}
interface Mine { x: number; y: number; t: number; armed: boolean; }

/** A snowplough working a lane. It never blocks the operative; it only moves snow. */
interface Plough {
  ax: number; ay: number; bx: number; by: number;
  x: number; y: number; ang: number;
  t: number; dir: 1 | -1; speed: number; side: 1 | -1;
  pushT: number; blade: number;
  /** Road-side normal the blade throws to. Fixed in world space: a shoulder is a shoulder
   *  whether the plough is running up the road or back down it. */
  nx: number; ny: number;
  /** Distance from the centreline to the shoulder the load is thrown onto. */
  off: number;
}
/** A vehicle working a base circuit: convoy truck, staff car, fuel bowser, ambulance. */
interface RoadCar {
  x: number; y: number; ang: number; speed: number;
  /** The speed this driver is trying to hold: what the throttle aims at. */
  cruise: number;
  kind: 'car' | 'humvee' | 'bus' | 'tanker' | 'ambulance' | 'truck';
  route: { x: number; y: number }[]; node: number;
  /** Metres of road held before the next one moves: convoys keep their spacing. */
  wait: number; dead: boolean; colour: string;
  /** Siren / indicator phase so lights blink instead of glowing flat. */
  light: number;
  /** 0..1 brake lamps, and the wobble of a suspension taking a corner. */
  brake: number; lean: number;
  /** Seconds spent with an obstruction ahead, so a stuck car eventually backs off. */
  jammed: number;
  /** Reversing out of a jam, in seconds, and which way the wheel is turned while doing it. */
  reversing?: number;
  steerBias?: number;
  /** Hull integrity: traffic is scenery that burns, not an indestructible decal. */
  hp: number; maxHp: number;
  /** Seconds of smoke pouring off this wreck. */
  burning: number;
  /** Seconds of panic: gunfire nearby stops the car and turns its hazards on. */
  panic: number;
}
/** A pedestrian on the shoulder: dock workers, clerks, a courier. They are not targets. */
interface Ped {
  x: number; y: number; ang: number; speed: number;
  route: { x: number; y: number }[]; node: number;
  panic: number; kind: 'worker' | 'clerk' | 'courier'; phase: number;
}
/** A routine the garrison performs on a timer: PT, shift change, refuel, alarm test. */
interface ArmyRoutine {
  kind: 'pt' | 'shift' | 'siren' | 'drill' | 'crane' | 'colors' | 'fuel' | 'muster' | 'wash' | 'k9';
  x: number; y: number; t: number; dur: number; label: string;
}
/** A heap of snow / dust / slurry beside a road. Ploughs grow it, weather slowly adds to it. */
interface SnowBank { x: number; y: number; r: number; h: number; fill: number; }
/**
 * A twin-gun emplacement inside the army base. It covers the ground and the air, and it
 * can be taken: knock the crew out of it, walk up, press F.
 */
interface ArmyTurret {
  x: number; y: number; ang: number; hp: number; maxHp: number;
  owner: 'enemy' | 'player'; cool: number; heavy: boolean;
  burst: number; flash: number; muzzle: number;
  /** Rounds left in the current burst and the gap between them. */
  rounds: number; gap: number;
  /** The emplacement's own sandbag walls: a round fired from here never touches them. */
  pit?: { x: number; y: number; w: number; h: number }[];
}
/** Military fast jet: parked until the base is breached, then it hunts. */
interface ArmyJet {
  x: number; y: number; ang: number; hp: number; maxHp: number;
  /** Line airframe or one of the two experimental machines from the proving flight. */
  tier?: JetTier;
  state: 'parked' | 'launch' | 'attack' | 'egress';
  alt: number; speed: number; cool: number; t: number;
  /** A seized interceptor: from here on the operative is the pilot. */
  manned?: boolean;
  /** 0..1 afterburner, only meaningful while manned. */
  boost?: number;
  /** Selected wing station while manned: cannon or missile. */
  mode?: 'cannon' | 'missile';
  /** Countermeasure cartridges left. */
  flares?: number;
  /** Autopilot: holds a circle over the locked target. */
  autopilot?: boolean;
  /** Missile seeker: what the nose is currently holding. */
  lock?: { x: number; y: number; label: string; air: boolean } | null;
  /** An air-defence hunter scrambled to answer a bombing run. These do not stand down
   *  just because the operative is airborne — that is the whole point of them. */
  hunter?: boolean;
  /** Rockets left in the pods of a hunter. */
  rockets?: number;
  /** The Frostwing upgrade has already been applied to this airframe once. */
  tuned?: boolean;
  /* ---- gunship-grade systems, only meaningful while the operative is flying ---- */
  /** Cannon heat, 0..1. At 1 the gun jams until it has cooled. */
  heat?: number;
  /** Seconds the cannon stays jammed. */
  jam?: number;
  /** Air-to-air missiles on the wing stations. */
  missiles?: number;
  /** Unguided rockets in the pods. */
  rocketsPlayer?: number;
  /** Charges left in the experimental lance (prototype and Frostwing only). */
  lance?: number;
  /** Lance charge, 0..1, while the trigger is held. */
  charge?: number;
  /** Camera view: 0 chase, 1 tactical, 2 close. */
  view?: number;
  /** Radar-warning receiver: seconds left on an inbound-missile warning. */
  rwr?: number;
  /** A gold-trimmed squadron ace (enemy hunters only). */
  ace?: boolean;
  /** Airframe damage flash, 0..1. */
  hitFlash?: number;
  /**
   * This hull is gone. A wreck is not a parked aircraft: it never flies again, it is never
   * re-armed, and it cannot be boarded. Losing an airframe is permanent.
   */
  wreck?: boolean;
  /** Seconds the wreck has been burning (smoke thins out after a while). */
  wreckT?: number;
  /** The aircraft has completed its take-off chain and is cleared to fly. */
  ready?: boolean;
  /** Serial of the airframe in the wing's inventory — printed on the HUD. */
  serial?: string;
  /** Take-off chain link in progress, for the apron animation. */
  crewT?: number;
  /** Where a recalled aircraft is putting down (its runway). */
  taxiX?: number; taxiY?: number;
}
/** Unguided salvo rockets and piercing lance shots fired from the interceptor. */
interface JetRocket { x: number; y: number; vx: number; vy: number; life: number; dmg: number; }
interface LanceBeam { x: number; y: number; ang: number; life: number; max: number; dmg: number; }
/** Attack gunship — strafes, hovers, rockets the player. */
interface Heli {
  x: number; y: number; tx: number; ty: number; ang: number; rotor: number;
  state: 'startup' | 'taxi-out' | 'takeoff' | 'ingress' | 'strafe' | 'orbit' | 'egress' | 'landing' | 'taxi-in' | 'service';
  hp: number; maxHp: number; cool: number; rocketCd: number; t: number;
  orbitA: number; medevac: boolean; carrying: number; announced: boolean;
  bank: number;
  home?: number; altitude?: number; serviceT?: number; sortieT?: number;
  /** Flown off the board for good: no bay, no second sortie. Used when the island stands down. */
  retire?: boolean;
}
interface VTOL {
  x: number; y: number; tx: number; ty: number;
  state: 'in' | 'hover' | 'out'; squadId: number;
  rotor: number; hoverT: number; ang: number; announced: boolean;
  bank: number;
}
interface SupplyDrop { x: number; y: number; t: number; }
/** Hangar shell: sealed roof outside, splits open once the operative is within. */
/** What the take-off chain needs from a hangar: a roof, a footprint and a door. */
type LaunchHangar = {
  x: number; y: number; w: number; h: number; doorX: number; doorY: number; ruined?: boolean;
  /** The structure itself, when the roof is a real building that can be knocked down. */
  rect?: Rect;
};
interface HangarState { x: number; y: number; w: number; h: number; doorX: number; doorY: number; open: number; ruined?: boolean; }
/** Parked / drivable Hydra transport van. */
interface Van {
  x: number; y: number; ang: number; speed: number; lean: number;
  hp: number; maxHp: number; dead: boolean; driving: boolean; boost: number;
  gunCd?: number; turretAng?: number; reserved?: boolean; blockT?: number;
  /** Grenade-hit ground vehicle: tyres blown, engine dead, it never moves again. */
  disabled?: boolean; skidT?: number;
  /**
   * Requisitioned street vehicle: an armoured Hydra transport by default, or the body of
   * the car, lorry or bus the operative actually took. Drawn from that body style.
   */
  art?: RoadCar['kind'];
  colour?: string;
  /** Seconds of smoke off a burnt-out requisitioned vehicle. */
  burning?: number;
  /** Seconds the driver has been holding the brake at a standstill, before reverse bites. */
  revHold?: number;
}
/** Capturable Hydra beam battery. Two hits will erase you. */
interface Laser {
  x: number; y: number; ang: number; hp: number; maxHp: number;
  charge: number; cool: number; beam: number; captured: boolean; targetX: number; targetY: number;
}
/** Friendly S.H.I.E.L.D. escort operative. */
interface Ally {
  x: number; y: number; vx: number; vy: number; ang: number; hp: number; maxHp: number;
  cool: number; slot: number; kind: 'rifle' | 'heavy' | 'medic'; flash: number;
}
/** Large S.H.I.E.L.D. strategic bomber recovered from the black vault. */
interface Plane {
  x: number; y: number; vx: number; vy: number; ang: number; bank: number;
  hp: number; maxHp: number; bombCd: number; gunCd: number; fuel: number; active: boolean;
}
interface PoiState {
  id: string; kind: 'airfield' | 'peggy' | 'vault' | 'laser' | 'depot' | 'library';
  x: number; y: number; r: number; name: string; sub: string;
  secret: boolean; discovered: boolean; cleared: boolean; captured: boolean; looted: boolean;
  /** Thinly held barracks or dispersal strip: marked, but never an objective. */
  soft?: boolean;
  gates: { x: number; y: number; built: boolean; hp: number }[];
}
interface Barricade { x: number; y: number; hp: number; maxHp: number; ang: number; }
/** Captured S.H.I.E.L.D. gunship the player can fly out of the Hydra hangar. */
interface PlayerHeli {
  x: number; y: number; vx: number; vy: number; ang: number; rotor: number; bank: number;
  hp: number; maxHp: number; fuel: number; fireCd: number; rocketCd: number; landed: boolean;
  /** Selected ordnance: 0 chain gun, 1 Hellfire (ground), 2 Sidewinder (air). */
  station: number;
  /** Rounds left per station; -1 is a self-feeding belt with no magazine. */
  ammo: [number, number, number];
}

/**
 * The captured gunship's three separate weapons. Target class is the whole point:
 * the chain gun answers anything, Hellfire cannot touch aircraft, and the Sidewinder
 * cannot touch the ground — so the pilot has to pick the right station for the job.
 */
const HELI_ORDNANCE = [
  { name: 'M197 CHAIN GUN', short: 'CHAIN GUN', target: 'any' as const, dmg: 19, rate: 0.08,
    speed: 1500, life: 0.9, color: '#b8f4ff', burst: 2, rocket: false, max: -1, regen: 0, note: 'GROUND + AIR' },
  { name: 'AGM-114 HELLFIRE', short: 'HELLFIRE', target: 'ground' as const, dmg: 88, rate: 0.62,
    speed: 850, life: 1.8, color: '#ffd9a0', burst: 2, rocket: true, max: 8, regen: 8, note: 'GROUND ONLY' },
  { name: 'AIM-9 SIDEWINDER', short: 'SIDEWINDER', target: 'air' as const, dmg: 130, rate: 0.95,
    speed: 1150, life: 3.4, color: '#9fe4ff', burst: 2, rocket: true, max: 6, regen: 12, note: 'AIR ONLY' },
] as const;

/** A fresh captured gunship, fully armed. */
function makeHeli(x: number, y: number, ang: number, extra: Partial<PlayerHeli> = {}): PlayerHeli {
  return {
    x, y, vx: 0, vy: 0, ang, rotor: 0, bank: 0, hp: 900, maxHp: 900, fuel: 100,
    fireCd: 0, rocketCd: 0, landed: true, station: 0, ammo: [-1, 8, 6], ...extra,
  };
}
/** S.H.I.E.L.D.-style deployable energy barrier. */
interface Barrier {
  x: number; y: number; ang: number; hp: number; maxHp: number;
  w: number; life: number; friendly: boolean;
}
/** A downed enemy awaiting medevac pickup. */
interface Wounded {
  x: number; y: number; type: string; t: number; squadId: number;
  beingCarried: boolean; carrier: number;
}
interface Pickup {
  kind: 'health' | 'grenade' | 'weapon' | 'shield' | 'aegis' | 'ammo';
  weapon?: string; x: number; y: number; t: number; life: number;
}
interface FloatText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number; }
interface Grenade { x: number; y: number; vx: number; vy: number; t: number; z: number; vz: number; dmg: number; big?: boolean; bomb?: boolean; }
interface EGrenade {
  x: number; y: number; tx: number; ty: number; t: number; total: number; z: number;
  /** Tank main-gun round: heavier blast than a thrown grenade. */
  dmg?: number; radius?: number; shell?: boolean;
}
interface Shock { x: number; y: number; r: number; max: number; life: number; t: number; color: string; width: number; }
interface Decal { x: number; y: number; r: number; a: number; color: string; }
interface SpawnMark { x: number; y: number; t: number; }
interface Cache { x: number; y: number; hp: number; maxHp: number; dead: boolean; }
interface SpawnItem { type: string; t: number; squadId: number; slot: number; x?: number; y?: number; }
interface Light { x: number; y: number; r: number; color: string; life: number; max: number; }
interface Stick { id: number; ox: number; oy: number; x: number; y: number; active: boolean; }

function defaultMods(): Mods {
  return {
    damageMul: 1, fireRateMul: 1, bulletSpeedMul: 1, spreadMul: 1, speedMul: 1, dashCdMul: 1,
    critChance: 0.05, critMul: 2, pierce: 0, lifestealChance: 0, regen: 0, magnetMul: 1,
    grenadeCap: 6, thorns: 0, explosive: 0, maxHpBonus: 0, emp: 0, shieldBonus: 0,
  };
}

/* Formation slot layout in LOCAL space (+x = forward, +y = right) */
function formationSlot(t: Tactic, i: number, n: number): { x: number; y: number } {
  const half = (n - 1) / 2;
  switch (t) {
    case 'phalanx': // broadside line — a walking wall of shields
      return { x: (i % 2) * -34, y: (i - half) * 74 };
    case 'turtle': { // tight defensive ring
      const a = (i / Math.max(1, n)) * TAU;
      return { x: Math.cos(a) * 76, y: Math.sin(a) * 76 };
    }
    case 'blitz': { // arrow wedge
      const row = Math.ceil((i + 1) / 2);
      const side = i % 2 === 0 ? -1 : 1;
      return { x: -row * 46, y: side * row * 52 };
    }
    case 'bombers': // screen forward, grenadiers tucked behind
      return i < Math.ceil(n / 2)
        ? { x: 96, y: (i - (Math.ceil(n / 2) - 1) / 2) * 84 }
        : { x: -168, y: (i - Math.ceil(n / 2) - (Math.floor(n / 2) - 1) / 2) * 76 };
    case 'column': // single file for corridor pushes
      return { x: -i * 78, y: (i % 2 ? 16 : -16) };
    case 'pincer': // two prongs
      return { x: -Math.floor(i / 2) * 50, y: (i % 2 === 0 ? -1 : 1) * (180 + Math.floor(i / 2) * 34) };
    case 'encircle': {
      const a = (i / Math.max(1, n)) * TAU;
      return { x: Math.cos(a) * 240, y: Math.sin(a) * 240 };
    }
    case 'ambush': {
      const a = (i / Math.max(1, n)) * TAU;
      return { x: Math.cos(a) * 420, y: Math.sin(a) * 420 };
    }
  }
}

const TACTIC_LABEL: Record<Tactic, string> = {
  phalanx: 'PHALANX', turtle: 'TURTLE', blitz: 'BLITZ', bombers: 'BOMBARDIERS',
  column: 'COLUMN', pincer: 'PINCER', encircle: 'ENCIRCLE', ambush: 'AMBUSH',
};

export interface OpClass { id: string; name: string; icon: string; desc: string; tag: string; }
export const CLASSES: OpClass[] = [
  { id: 'assault', name: 'ASSAULT', icon: '🎯', tag: 'Balanced frontline', desc: 'M4 carbine + riot shield + extra frag' },
  { id: 'gunner', name: 'GUNNER', icon: '⚡', tag: 'High fire rate', desc: 'Vector SMG + faster dash + frag' },
  { id: 'demolition', name: 'DEMOLITION', icon: '💥', tag: 'Area denial', desc: 'M79 thumper + 2 frags + EMP rounds' },
  { id: 'marksman', name: 'MARKSMAN', icon: '🔭', tag: 'Long range', desc: 'MK-14 DMR + riot shield' },
];

export interface OpSupport { id: string; name: string; icon: string; desc: string; }
export const SUPPORTS: OpSupport[] = [
  { id: 'aegis', name: 'AEGIS PLATE', icon: '🔰', desc: '+220 S.H.I.E.L.D. ballistic shield' },
  { id: 'drone', name: 'HUNTER DRONE', icon: '◉', desc: 'Autonomous support drone fires on nearby Hydra troops' },
  { id: 'uplink', name: 'SKY UPLINK', icon: '⌁', desc: 'Faster S.H.I.E.L.D. airdrops + stronger EMP network attacks' },
];

/* ================================================================== */
/* Game                                                               */
/* ================================================================== */

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w = 800; h = 600; dpr = 1;
  status: GameStatus = 'menu';
  onHud: (h: Hud) => void;
  onOver: (s: number, w: number) => void;
  onPauseToggle: () => void;
  onUpgrade: (c: Perk[]) => void;
  onVictory: (s: number, w: number) => void;
  onTransit: (sector: number) => void;
  onVault: (open: boolean) => void;
  onPrison: (mode: 'arrest' | 'visit') => void;
  onGlacier: () => void;
  onArrestAnimChange: (on: boolean) => void;

  mods: Mods = defaultMods();
  perkCounts: Record<string, number> = {};
  upgradeChoices: Perk[] = [];

  private raf = 0; private last = 0; private hudTimer = 0;
  private qset = new Set<number>();

  // world
  obstacles: Rect[] = [];
  zones: Zone[] = [];
  grid = new SpatialGrid();
  servers: Server[] = [];
  caches: Cache[] = [];
  garrisonSpots: { x: number; y: number }[] = [];
  coderSpots: { x: number; y: number }[] = [];
  generalSpot = { x: HQ.cx, y: HQ.cy };
  hqBreached = false;
  garrisonAlerted = false;
  // S.H.I.E.L.D. infrastructure
  helipads: { x: number; y: number }[] = [];
  hangarSpot = { x: HQ.cx, y: HQ.cy };
  beaconSpots: { x: number; y: number }[] = [];
  satcoms: Satcom[] = [];
  barrels: Barrel[] = [];
  barrelFuses: Fuse[] = [];
  spotlights: Searchlight[] = [];
  security = newSecurityState();
  airTransports: AirTransport[] = [];
  airTroops: AirborneTrooper[] = [];
  ruins: Ruin[] = [];
  /** People on the shoulders. The district is worked, not just garrisoned. */
  private peds: Ped[] = [];
  /** Pylon heads and the sagging spans between them: the district has a power line. */
  private pylons: { x: number; y: number; h: number; links: number[] }[] = [];
  /** Birds: gulls over the water, crows over the prison, whatever the district has. */
  private birds: { ax: number; ay: number; a: number; r: number; speed: number; alt: number; flap: number; kind: 'gull' | 'crow' }[] = [];

  /* ---------------- sector dressing: weather that is really there ---------------- */
  private dressing: SectorDressing | null = null;
  /** Snowploughs working their lanes (Arctic only). */
  ploughs: Plough[] = [];
  /** Moving traffic on the base roads and the annex ring road. */
  roadCars: RoadCar[] = [];
  /**
   * Made ground. The prison's sea mask runs from `SEA.x` eastwards, but the army district in
   * sector 6 carries on over that line on reclaimed ground: the railhead, the silos and the
   * naval yard are drawn as ordinary earth, so the mask has to agree with the picture. Without
   * this the operative hit an invisible wall at x 12 205 and could never reach the whole
   * eastern arm of the base. Populated when a sector's world is loaded, empty elsewhere.
   */
  dryLand: { x: number; y: number; w: number; h: number }[] = [];
  /** Temporary diagnostics hook: null in play, set by the handling harness. */
  roadDebug: ((c: RoadCar, info: Record<string, number | boolean>) => void) | null = null;
  /** Garrison routines currently playing out, drawn as little scenes. */
  routines: ArmyRoutine[] = [];
  routineT = 6;
  /** Every third routine is a big one, so the base never repeats itself twice in a row. */
  routineSeq = 0;
  /** Heaps of snow / red dust / slurry beside the roads. */
  snowBanks: SnowBank[] = [];
  /** Lanes the ploughs have already cleared, drawn over the snow. */
  private clearedLanes: { x: number; y: number; ang: number; len: number; w: number; t: number }[] = [];
  private weatherT = 0;
  /* ---------------- IRON RESERVE ---------------- */
  private army: ArmyPlan | null = null;
  /** 0..1 base alarm. The whole district answers it. */
  armyAlarm = 0;
  private armyAlerted = false;
  private armyWakeT = 0;
  private armyWaves = 0;
  private armyLaunchT = 0;
  armyTurrets: ArmyTurret[] = [];
  armyJets: ArmyJet[] = [];
  /** The army interceptor the operative is flying, if any. */
  playerJet: ArmyJet | null = null;
  /**
   * THE TAKE-OFF CHAIN. Nothing leaves the ground because a key was pressed: the order
   * starts a physical sequence, and every link has to complete before the next one opens.
   *
   *   walk  — the operative crosses the apron from the hangar to the airframe
   *   board — canopy closes, the crew hooks up the aircraft
   *   taxi  — the aircraft rolls from its parking spot to the runway threshold
   *   roll  — take-off run; the wheels leave the ground at the end of it
   *
   * If the hangar behind the airframe is destroyed at any point, the chain is broken and
   * the aircraft never flies.
   */
  private launch: {
    jet: ArmyJet;
    phase: 'walk' | 'board' | 'taxi' | 'roll';
    t: number;
    /** where the operative started walking / where the aircraft must taxi to */
    fromX: number; fromY: number;
    taxiX: number; taxiY: number;
    rollX: number; rollY: number;
    hangar: LaunchHangar | null;
    serial: string;
  } | null = null;
  /** Ground crew walking out to the airframe during the boarding link. */
  launchCrew: { x: number; y: number; tx: number; ty: number; t: number; kind: 'crew' | 'pilot' }[] = [];
  /** Aircraft ditched in the water: the operative is in a boat, and the wing stands down. */
  private ditching = false;
  /** Airframes left in the squadron reserve that can fly in from off the map. */
  private airReserve = 10;
  private airReserveSpent = false;
  private ditchT = 0;
  /** Stride clock for the walk-out to the aircraft. */
  private launchStride = 0;
  /**
   * FIRST TIME, EVERY TIME. The first time the operative does something new — takes an
   * aircraft, takes a tank, takes a boat, takes a gunship, ends up in the brig — the game
   * stops and explains the controls. Each card appears once per run.
   */
  private tutorialsSeen = new Set<string>();
  tutorial: { title: string; lines: string[]; hint: string } | null = null;
  /** Last time the boundary wall had to speak. */
  private airspaceWarnT = -99;
  /** Air-to-air / air-to-ground missiles in flight from the interceptor. */
  jetMissiles: { x: number; y: number; vx: number; vy: number; life: number; air: boolean; dmg: number }[] = [];
  /** Player salvo rockets and lance beams. */
  jetRockets: JetRocket[] = [];
  lanceBeams: LanceBeam[] = [];
  /** Air-defence rockets fired at an airborne operative. Flares spoof them. */
  enemyRockets: { x: number; y: number; vx: number; vy: number; life: number; dmg: number; spooked: number }[] = [];
  /** How angry the air force currently is, in seconds of standing hostility. */
  private airResponse = 0;
  /** Accumulated provocation: every bomb and every strafing pass adds to it. */
  private airResponseHeat = 0;

  /* ---------------- the developer console ---------------- *
   * Both of these are set only from the start screen: `devInfiniteLives` never turns
   * itself on, so a normal run can never inherit it.
   */
  devInfiniteLives = false;
  /** Sector the operative was inserted into by the dev panel (1 when it was never used). */
  devSector = 1;
  /** Set on a prison escape: THE CAGE does not answer with landing waves. */
  private cageEscaped = false;
  private airResponseWave = 0;
  private airResponseT = 0;
  /** Flare cloud still burning; hostile rockets lose lock while it lasts. */
  private jetFlareT = 0;
  /** Seconds the operative has been back on the ground with fighters still up. */
  private airResponseIdle = 0;
  /** Afterburner trail positions, drawn as a heat plume. */
  jetTrail: { x: number; y: number; t: number }[] = [];
  /** Armour sortie clock and how many hulls the park has already sent. */
  armyTankWaveT = 0;
  armyTankSent = 0;
  /** The military prison in sector 6: break the brig and its inmates fall in with you. */
  stockadeOpen = false;
  private stockadeSpot: { x: number; y: number; w: number; h: number } | null = null;
  /** The glacier gate in sector 3 and the Frostwing clearance it can grant. */
  glacierSpot: { x: number; y: number } | null = null;
  glacierVisits = 0;
  frostwing = false;
  /** The Cage crossing: an orange suspension bridge that can be severed for good. */
  bridgeHp = 2600;
  bridgeMaxHp = 2600;
  bridgeDown = false;
  bridgeWarn = 0;
  /** Ranks still asleep in the parade ground. */
  armyDormant = 0;
  /** The parade, kept from the world build so the ranks can be spawned in populateHQ(). */
  private armyRanksData: { x: number; y: number; type: string }[] = [];
  private armyGuardsData: { x: number; y: number; type: string }[] = [];
  /** Both army shutters, kept apart so the inner one can be powered down. */
  private armyShutters: Rect[] = [];
  /** Army gatehouses, one entry per gate, built from the leaves the world handed over. */
  private armyGateFrames = new Map<string, { x: number; y: number; w: number; h: number; leaves: Rect[] }>();
  private gateFrameDrawn = new Set<string>();
  private armyInnerOpen = false;
  private campaignSites: CampaignSites | null = null;
  private blackout = { active: false, t: 0, searchT: 0, lastX: 0, lastY: 0 };
  private responseOrders: { id: string; target: Point; units: number; size: number; sent: number }[] = [];
  private responseTimer = 0;
  private breachedZones = new Set<string>();
  private securityTimer = 0;
  private spotVisibility = new Map<Searchlight, boolean>();
  private patrolTeams: {
    id: string; points: Point[]; x: number; y: number; angle: number; node: number; wait: number;
    columns?: number; spacing?: number; speed?: number; site?: string; kind?: string;
    /** seconds of "they are still chasing me" before a column goes back to its beat */
    huntT?: number;
  }[] = [];
  /** Live output of every generator yard, keyed by site id. */
  private sitePower = new Map<string, { load: number; dead: boolean; t: number }>();
  /** Sector grid output (0..1) — the major HELIOS plant feeds everything else. */
  gridOutput = 1;
  /** True while any feeder yard is dark: that yard's garrison works by helmet lamp. */
  siteDark = false;
  private story: StoryEntry = PROLOGUE;
  private storyTime = 0;
  private archiveReadCooldown = 0;
  vtols: VTOL[] = [];
  trucks: Truck[] = [];
  /** Convoy tanks — the escort that makes a moving column so hard to break. */
  tanks: Tank[] = [];
  playerTank: Tank | null = null;
  private tankSeq = 1;
  /** Armed-response state: the van ride after a custody officer gets his hands on you. */
  private arrestT = 0;
  private readonly arrestDuration = 5.4;
  private arrestStage = 0;
  private prisonVisits = 0;
  private arrestCount = 0;
  /** One-time field report the first time the operative sees the island. */
  private prisonHinted = false;
  /** Custody-officer posts around the prison: a permanent detail, not a chance spawn. */
  private prisonPolicePosts: { x: number; y: number }[] = [];
  private prisonDecor: IslandDecor[] = [];
  /** Seconds before the sally port can pull the operative in again (stops instant re-entry). */
  private prisonReentry = 0;
  mines: Mine[] = [];
  helis: Heli[] = [];
  barriers: Barrier[] = [];
  wounded: Wounded[] = [];
  supply: SupplyDrop[] = [];
  supplyCd = 26;
  playerHeli: PlayerHeli | null = null;
  piloting = false;
  support = 'aegis';
  supportCd = 0;
  droneAng = 0;
  // installations
  hangars: HangarState[] = [];
  vans: Van[] = [];
  /**
   * Parked vehicles painted into the world as solid scenery (car, humvee, bus, tanker and
   * the motor-pool lorries). They are not decoration: stand next to one and press F and it
   * stops being a prop and becomes a vehicle with a hull, a throttle and a driver.
   */
  private driveProps: { rect: Rect; kind: 'car' | 'humvee' | 'bus' | 'tanker' | 'truck'; colour: string }[] = [];
  /** Everything that floats: landing craft, patrol boats and the skiffs you can take. */
  boats: Boat[] = [];
  drivingBoat: Boat | null = null;
  /** Island defence: the alarm that calls the landing waves in. */
  islandAlarmT = 0;
  /** Reefs in the approaches: hit one at speed and the hull goes up. */
  reefs: { x: number; y: number; r: number; seen: boolean }[] = [];
  islandWaves = 0;
  islandLanded = false;
  /** The campaign's last level is the prison itself: sector 5 ends at THE CAGE. */
  prisonFinale = false;
  lasers: Laser[] = [];
  allies: Ally[] = [];
  pois: PoiState[] = [];
  barricades: Barricade[] = [];
  parkedHelis: { x: number; y: number; ang: number; taken: boolean }[] = [];
  paradeSpots: { x: number; y: number; type: string }[] = [];
  vaultSpot = { x: 0, y: 0 };
  blackoutHud = false;
  planeSpot = { x: 0, y: 0 };
  plane: Plane | null = null;
  drivingVan: Van | null = null;
  flyingPlane = false;
  vaultOpen = false;
  vaultChoice: 'none' | 'offer' | 'taken' = 'none';
  siege = { active: false, t: 0, poi: '', waves: 0 };
  megaCrates: MegaCrate[] = [];
  baseOverride = { active: false, poiId: '', progress: 0, timer: 0 };
  /** Seconds the operative has stood on a held uplink without a defender able to see him. */
  private uplinkHold = 0;
  prompt = '';
  gates: HydraulicGate[] = [];
  details: RoomDetail[] = [];
  facilities: FacilityState[] = [];
  private facilityGuards: FacilityGuard[] = [];
  private facilityPainter = new FacilityPainter();
  private facilityTimer = 0;
  private nearbyFacility: FacilityState | null = null;
  private infantryRoutes = new RoutePlanner(ARENA_W, ARENA_H, 22);
  private infantryBudget = 1;
  private enemyCells = new Map<number, Enemy[]>();
  /** Cached marching routes for the police columns (a column walks roads, not walls). */
  private teamNav = new WeakMap<object, { path: Point[]; node: number; goal: Point; expires: number }>();
  /** Per-frame proximity buckets so triggers never scan the whole garrison. */
  private enemyBuckets = new Map<number, Enemy[]>();
  private lineSet = new Set<number>();
  private bulletSet = new Set<number>();
  /** Gate leaves resolved once per frame; bullets must not rebuild 100+ blocks each hit test. */
  private gateLeaves: { rect: Block; gate: HydraulicGate }[] = [];
  /** Structures that friendly fire passes through so it can reach a power cell or mega crate. */
  private pierceRects = new Map<Rect, { cells: { dead: boolean }[]; crates: { dead: boolean }[] }>();
  private readonly bucketCell = 256;
  private squadMembers = new Map<number, Enemy[]>();
  private postNavigation = new WeakMap<Enemy, { path: Point[]; node: number; expires: number; revision: number; goal: Point }>();
  private routes = new RoutePlanner(ARENA_W, ARENA_H);
  /** Terrain signature the planners were last painted with (sector + bridge state). */
  private terrainKey = '';
  private navigationDirty = false;
  private pathBudget = 1;
  private convoyMotion = new WeakMap<Truck, { path: Point[]; node: number; revision: number; replan: number; idle: number; home: Point; stage: string; door: number; loaded: number; loadTime: number; depart: boolean; trafficTime?: number; doorWait?: number; stall?: number; bypass?: Point; reversing?: number }>();
  private hangarClaims = new Map<Heli, number>();
  private simulationTime = 0;
  private dynamicRects: Block[] = [];
  private dynBuckets = new Map<number, Block[]>();
  private dynScratch: Block[] = [];
  private rectSeen: Int32Array = new Int32Array(0);
  private rectStamp = 0;
  private vaultResupplied = false;
  aegisCharges = 0;
  aegisTime = 0;
  private vaultNav = false;
  // organized battle phases
  phase: 'recon' | 'bombard' | 'convoy' | 'assault' | 'siege' = 'recon';
  phaseT = 0;
  phaseName = 'RECON';

  // player
  px = PLAYER_START.x; py = PLAYER_START.y; pvx = 0; pvy = 0; pang = -Math.PI / 2;
  hp = 100; maxHp = 100;
  shieldHp = 0; shieldMax = 0;   // riot shield — blocks frontal fire
  weapon = 'rifle'; ammo: number = Infinity;
  fireCd = 0; dashCd = 0; dashT = 0; dashAng = 0; iFrames = 0;
  grenades = 3; grenadeCd = 0; recoil = 0; walkCycle = 0;

  score = 0; wave = 0; streak = 0; streakT = 0; mult = 1; bestMult = 1;
  banner = ''; bannerSub = ''; bannerT = 0;
  objective = 'REACH THE FORTRESS';
  sector = 1;
  transitT = 0;
  transitDuration = 7.5;
  destination = '';

  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  parts: Particle[] = [];
  pickups: Pickup[] = [];
  texts: FloatText[] = [];
  nades: Grenade[] = [];
  enemyNades: EGrenade[] = [];
  shocks: Shock[] = [];
  decals: Decal[] = [];
  marks: SpawnMark[] = [];
  lights: Light[] = [];
  /** Rounds banked per weapon: swapping tubes tops you up instead of resetting the counter. */
  private weaponAmmo = new Map<string, number>();
  squads: Squad[] = [];
  spawnQueue: SpawnItem[] = [];
  nextSquadId = 1;
  waveActive = false; intermission = 0;

  // enemy supreme command
  general: Enemy | null = null;
  coders: Enemy[] = [];
  planT = 0;
  planTactic: Tactic = 'phalanx';
  commandOnline = true;

  // adaptive AI
  aiLevel = 0.65;          // starts HIGH — brutal from second one
  aiTactic = 'PHALANX';
  aiNote = 'HQ ONLINE — PLANNING';
  mobility = 0; camping = 0; stationaryT = 0;
  dashLog: number[] = []; avgRange = 340; coverUse = 0;
  profileT = 0; adaptT = 0;

  camX = 0; camY = 0; hitstop = 0; timeScale = 1; flash = 0; flashColor = '255,255,255';
  private lightCv: HTMLCanvasElement | null = null;
  private lightCtx: CanvasRenderingContext2D | null = null;
  private groundPat: CanvasPattern | null = null;

  // input
  keys: Record<string, boolean> = {};
  mouseX = 0; mouseY = 0; firing = false; isTouch = false;
  /** Mouse is captured by the canvas, so the cursor cannot escape to the browser chrome. */
  pointerLocked = false;
  /** Locked-mouse aim: the mouse drives a virtual pointer 1:1 (both axes), kept inside
   *  a ring around the operative. It feels like the normal cursor but can never escape
   *  to the browser chrome — and, unlike a canvas clamp, it can always be recovered. */
  aimSens = 1;
  private lockOffX = 0;
  private lockOffY = 0;
  /** Seconds left to show "click to capture" after an unexpected lock loss. */
  private lockGrace = 0;
  private lockFails = 0;
  private lockBlocked = false;
  private lastEscapeAt = -1e9;
  private reticlePulse = 0;
  moveStick: Stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };
  aimStick: Stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };

  constructor(canvas: HTMLCanvasElement, cb: {
    onHud: (h: Hud) => void; onOver: (s: number, w: number) => void;
    onPauseToggle: () => void; onUpgrade: (c: Perk[]) => void;
    onVictory: (s: number, w: number) => void; onTransit: (sector: number) => void;
    onVault: (open: boolean) => void;
    onPrison: (mode: 'arrest' | 'visit') => void;
  onGlacier: () => void;
    onArrestAnimChange: (on: boolean) => void;
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onHud = cb.onHud; this.onOver = cb.onOver;
    this.onPauseToggle = cb.onPauseToggle; this.onUpgrade = cb.onUpgrade;
    this.onVictory = cb.onVictory;
    this.onTransit = cb.onTransit;
    this.onVault = cb.onVault;
    this.onPrison = cb.onPrison;
    this.onGlacier = cb.onGlacier;
    this.onArrestAnimChange = cb.onArrestAnimChange;
    try {
      const saved = parseFloat(localStorage.getItem('pse.aimSens') || '');
      if (Number.isFinite(saved)) this.aimSens = clamp(saved, 0.25, 3);
    } catch { /* private mode */ }
    this.makeGroundPattern();
    this.resize();
    this.bind();
    this.reset();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------------- lifecycle ---------------- */

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerup', this.onWindowUp);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    if (this.pointerLocked && document.exitPointerLock) document.exitPointerLock();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerUp);
    c.removeEventListener('contextmenu', prevent);
  }

  private bind() {
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerup', this.onWindowUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerup', this.onPointerUp);
    c.addEventListener('pointercancel', this.onPointerUp);
    c.addEventListener('contextmenu', prevent);
  }
  private onWindowUp = () => { this.firing = false; };

  private makeGroundPattern() {
    const s = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d')!;
    const theme = SECTORS[this.sector - 1] || SECTORS[0];
    g.fillStyle = theme.ground;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const v = Math.random();
      g.fillStyle = v < 0.55 ? 'rgba(255,255,255,0.020)'
        : v < 0.85 ? 'rgba(0,0,0,0.16)' : `rgba(${theme.grid},0.030)`;
      const r = Math.random() * 2.4 + 0.4;
      g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
    for (let i = 0; i < 16; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.13)';
      g.lineWidth = Math.random() * 1.6 + 0.3;
      g.beginPath();
      const x = Math.random() * s, y = Math.random() * s;
      g.moveTo(x, y);
      g.lineTo(x + rand(-60, 60), y + rand(-60, 60));
      g.stroke();
    }
    this.groundPat = this.ctx.createPattern(cv, 'repeat');
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(320, rect.width);
    this.h = Math.max(320, rect.height);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.lightCv) {
      this.lightCv = document.createElement('canvas');
      this.lightCtx = this.lightCv.getContext('2d');
    }
    this.lightCv.width = Math.max(2, Math.floor(this.w / 2));
    this.lightCv.height = Math.max(2, Math.floor(this.h / 2));
  };

  /**
   * Where the operative actually starts a sector.
   *
   * `settle()` only guarantees "not inside a wall in the clearance grid"; it happily leaves
   * the spawn inside a facility yard, a warehouse shell or right next to the S.H.I.E.L.D.
   * vault, because those rects are drawn as floor. That produced sector starts buried in a
   * building, which reads as a bug and traps the run before it begins. This picker insists
   * on open ground: outside every facility rect, outside every structure, well clear of the
   * vault and the prison, with at least four of eight escape directions open, and preferring
   * road or plaza ground with the fewest hostiles in sight.
   */
  private pickSpawnPoint(start: Point, settle: (p: Point, r: number) => Point, stuck: (x: number, y: number, r: number) => boolean) {
    const clearance = 30;
    const insideRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }, pad: number) =>
      x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
    const shielded = (x: number, y: number) =>
      Math.hypot(x - VAULT_ENTRY.x, y - VAULT_ENTRY.y) < 1000;
    // A spot is legal when nothing is drawn on it, it is not in a facility yard or the
    // vault compound, and a walker can leave it in more than one direction.
    const legal = (x: number, y: number) => {
      if (x < 240 || y < 240 || x > ARENA_W - 240 || y > ARENA_H - 240) return false;
      if (stuck(x, y, clearance)) return false;
      if (this.pointBlocked(x, y)) return false;
      if (this.inWater(x, y)) return false;
      for (const f of this.facilities) if (insideRect(x, y, f, 46)) return false;
      if (shielded(x, y)) return false;
      const rayClear = (a: number, span: number) => {
        for (let t = 40; t <= span; t += 40) {
          const px = x + Math.cos(a) * t, py = y + Math.sin(a) * t;
          if (stuck(px, py, 18) || this.pointBlocked(px, py) || this.inWater(px, py)) return false;
        }
        return true;
      };
      let open = 0, far = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        if (rayClear(a, 160)) open++;
        if (rayClear(a, 520)) far++;
      }
      // Near cover is fine, a boxed-in corner is not: the operative has to be able to walk out.
      return open >= 4 && far >= 3;
    };
    const zoneBonus = (x: number, y: number) => {
      let bonus = 0;
      for (const z of this.zones) {
        if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
        if (z.kind === 'road' || z.kind === 'plaza' || z.kind === 'concrete') bonus -= 2;
      }
      return bonus;
    };
    const origin = start;
    const candidates: { x: number; y: number; score: number }[] = [];
    const consider = (x: number, y: number) => {
      const q = { x, y };
      for (let i = 0; i < 2; i++) this.collide(q, 26);
      if (!legal(q.x, q.y)) return;
      const hostiles = this.enemies.filter((e) => !e.def?.civilian && e.hp > 0
        && Math.hypot(e.x - q.x, e.y - q.y) < 780).length;
      const dist = Math.hypot(q.x - origin.x, q.y - origin.y);
      candidates.push({ x: q.x, y: q.y, score: hostiles * 60 + dist * 0.02 + zoneBonus(q.x, q.y) });
    };
    consider(origin.x, origin.y);
    for (const d of [80, 160, 260, 380, 520, 700, 900, 1200, 1500, 1900]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        consider(origin.x + Math.cos(a) * d, origin.y + Math.sin(a) * d);
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => a.score - b.score);
      return { x: candidates[0].x, y: candidates[0].y };
    }
    // Nothing clean anywhere near the authorised insert: fall back to the old behaviour of
    // settling the point and, failing that, the nearest open lane.
    const fallback = settle(origin, 26);
    if (legal(fallback.x, fallback.y)) return fallback;
    const lane = this.routes.nearest(origin);
    return legal(lane.x, lane.y) ? lane : fallback;
  }

  reset(newCampaign = true) {
    this.clearInput();
    this.dynamicRects = [];
    this.dynBuckets.clear();
    if (newCampaign) this.sector = 1;
    this.makeGroundPattern();
    const world = generateWorld(this.sector);
    // PRISON ISLAND: brand-new ground east of the untouched legacy map — open water, a
    // causeway bridge, the island and the prison compound. Nothing that already stood on
    // the map is moved, removed or covered.
    const island = prisonIslandStructures();
    this.prisonPolicePosts = island.policePosts;
    this.prisonDecor = island.decor;
    world.rects.push(...island.rects);
    world.zones.push(...island.zones);
    world.spotlightSpots.push(...island.lights.map((l) => ({
      x: l.x, y: l.y, speed: l.speed, sweep: l.sweep,
    })));
    this.obstacles = prepareStructures(world.rects);
    // Army shutters: prepareStructures() recomputes hp from the kind, so raise the two
    // gates that were authored to be blast-proof. Only explosives will ever move them.
    this.armyShutters = this.obstacles.filter((o) => !!o.armyGate);
    for (const o of this.armyShutters) {
      const inner = o.armyGate === 'inner';
      o.hp = o.maxHp = inner ? 5200 : 3000;
    }
    /* ONE GATEHOUSE PER GATE. prepareStructures() cuts every 210 px leaf into two 105 px
     * sections, so an outer gate arrives here as four separate rects. Drawing a frame
     * around each of them produced four little doors side by side — which is exactly the
     * "doors lying on the wall" the report is about. The leaves are grouped back into
     * their gates and the renderer is given the gate, not the pieces. */
    this.armyGateFrames.clear();
    for (const o of this.armyShutters) {
      const id = o.armyGateId;
      if (!id) continue;
      const w = o.armyGateW ?? o.w;
      const h = o.armyGateH ?? o.h;
      const f = this.armyGateFrames.get(id);
      if (f) { f.leaves.push(o); f.x = Math.min(f.x, o.x); f.y = Math.min(f.y, o.y); }
      else this.armyGateFrames.set(id, { x: o.x, y: o.y, w, h, leaves: [o] });
    }
    // The army builds to a different standard. Its ramparts shrug off anything short of
    // sustained rocket fire, which is exactly what makes the base feel like a fortress.
    for (const o of this.obstacles) {
      if (!o.armyWall) continue;
      const inner = o.kind === 'bunker';
      o.hp = o.maxHp = inner ? 5200 : 2600;
    }
    this.ruins = [];
    this.campaignSites = world.campaignSites;
    this.blackout = { active: false, t: 0, searchT: 0, lastX: 0, lastY: 0 };
    this.airTransports = []; this.airTroops = [];
    this.security = newSecurityState(); this.securityTimer = 0; this.spotVisibility.clear();
    this.responseOrders = []; this.responseTimer = 0; this.breachedZones.clear();
    this.patrolTeams = []; this.archiveReadCooldown = 0;
    this.sitePower.clear(); this.gridOutput = 1;
    this.story = PROLOGUE; this.storyTime = 0;
    this.zones = world.zones;
    this.dryLand = [];
    {
      const reg = (world as { army?: { region?: { x: number; y: number; w: number; h: number } } }).army?.region;
      if (reg && reg.x + reg.w > SEA.x - 40) {
        const x0 = Math.max(reg.x, SEA.x - 40);
        this.dryLand.push({ x: x0, y: reg.y - 60, w: reg.x + reg.w - x0, h: reg.h + 120 });
      }
    }
    /* ---------------- sector dressing ---------------- */
    this.dressing = world.dressing;
    this.ploughs = world.dressing.ploughs.map((r) => {
      const dx = r.bx - r.ax, dy = r.by - r.ay;
      const len = Math.hypot(dx, dy) || 1;
      return {
        ax: r.ax, ay: r.ay, bx: r.bx, by: r.by,
        x: r.ax, y: r.ay, ang: Math.atan2(dy, dx),
        t: Math.random(), dir: 1 as const, speed: r.speed, side: r.side, pushT: 0, blade: 0,
        nx: (dy / len) * r.side, ny: (-dx / len) * r.side, off: r.off || 128,
      };
    });
    this.snowBanks = world.dressing.drifts.map((d) => ({ x: d.x, y: d.y, r: d.r, h: d.h, fill: d.fill }));
    this.clearedLanes = [];
    this.weatherT = 0;
    /* ---------------- IRON RESERVE ---------------- */
    this.army = world.army;
    this.glacierSpot = world.glacier;
    this.stockadeSpot = world.army?.stockade ?? null;
    this.stockadeOpen = false;
    this.armyRanksData = world.ranks || [];
    this.armyGuardsData = world.armyGuards || [];
    this.armyAlarm = 0; this.armyAlerted = false; this.armyWakeT = 0; this.armyWaves = 0;
    this.playerJet = null; this.armyTankWaveT = 0; this.armyTankSent = 0;
    this.launch = null; this.launchCrew = []; this.airReserve = 10; this.airReserveSpent = false;
    this.ditching = false; this.ditchT = 0;
    this.jetMissiles = []; this.jetTrail = []; this.jetRockets = []; this.lanceBeams = [];
    this.enemyRockets = []; this.airResponse = 0; this.airResponseHeat = 0;
    this.airResponseWave = 0; this.airResponseT = 0; this.jetFlareT = 0;
    this.bridgeHp = this.bridgeMaxHp; this.bridgeDown = false; this.bridgeWarn = 0;
    this.armyLaunchT = 0;
    // Traffic. The circuits themselves are sampled from the painted road network in
    // world.ts, so a car can only ever be sent down road that is genuinely open.
    this.roadCars = [];
    const useRoutes = world.trafficRoutes.length ? world.trafficRoutes : (world.army?.routes || []);
    const carKinds: RoadCar['kind'][] = ['humvee', 'car', 'bus', 'tanker', 'ambulance', 'truck', 'car', 'humvee', 'truck'];
    const colours = ['#5a6349', '#8a8f7a', '#33474a', '#6a5f45', '#9a9f88', '#4e5743', '#7d7f6a'];
    for (let r = 0; r < useRoutes.length; r++) {
      const route = useRoutes[r];
      const n = route.length;
      if (n < 3) continue;
      // A lap length decides the fleet: a long perimeter run carries more traffic than a
      // short service road, and every car is spread out so the road never looks empty.
      let lap = 0;
      for (let i = 0; i < n; i++) {
        const a = route[i], b = route[(i + 1) % n];
        lap += Math.hypot(b.x - a.x, b.y - a.y);
      }
      const fleet = clamp(Math.round(lap / 780) + 2, 2, 5);
      for (let i = 0; i < fleet; i++) {
        const t = (i + 0.5) / fleet;
        const seg = t * n;
        const a = route[Math.floor(seg) % n], b = route[(Math.floor(seg) + 1) % n];
        const f = seg - Math.floor(seg);
        this.roadCars.push({
          x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
          ang: Math.atan2(b.y - a.y, b.x - a.x),
          speed: 58 + rand(0, 44), cruise: 58 + rand(0, 44),
          kind: carKinds[(r * 3 + i) % carKinds.length],
          route, node: (Math.floor(seg) + 1) % n,
          wait: rand(0, 2.2), dead: false,
          colour: colours[(r * 3 + i) % colours.length],
          light: rand(0, TAU), brake: 0, lean: 0, jammed: 0,
          hp: carKinds[(r * 3 + i) % carKinds.length] === 'bus' || carKinds[(r * 3 + i) % carKinds.length] === 'tanker' ? 260 : 170,
          maxHp: carKinds[(r * 3 + i) % carKinds.length] === 'bus' || carKinds[(r * 3 + i) % carKinds.length] === 'tanker' ? 260 : 170,
          burning: 0, panic: 0,
        });
      }
    }
    // Every parked vehicle in the district is requisitionable. Anything too big to be a
    // vehicle, or already dead, is left alone; the list is capped so the F prompt stays
    // cheap to evaluate.
    this.driveProps = [];
    const CAR_COLOURS: Record<string, string> = {
      car: '#8a8f7a', humvee: '#5a6349', bus: '#33474a', tanker: '#6a5f45', truck: '#4e5743',
    };
    for (const o of this.obstacles) {
      if (o.dead) continue;
      const kind = o.kind as string;
      if (kind !== 'car' && kind !== 'humvee' && kind !== 'bus' && kind !== 'tanker' && kind !== 'truck') continue;
      if (o.w > 250 || o.h > 250 || o.w < 38 || o.h < 22) continue;
      if (this.driveProps.length >= 90) break;
      this.driveProps.push({ rect: o, kind: kind as 'car' | 'humvee' | 'bus' | 'tanker' | 'truck', colour: o.tint || CAR_COLOURS[kind] });
    }
    /* Parked street vehicles pull out and join the traffic. The district should not look like
       a car park: a share of the machines painted into the streets get a driver, a route and a
       speed, and the static body is retired so nothing is left standing in two places at once.
       Quantity scales with the sector, so late sectors are noticeably busier. */
    const pullOut = clamp(4 + this.sector * 2, 4, 14);
    const lanes = useRoutes.filter((r) => r.length >= 3);
    if (lanes.length) {
      let converted = 0;
      for (let i = this.driveProps.length - 1; i >= 0 && converted < pullOut; i--) {
        if (i % 2 === 1 && this.sector < 3) continue;   // early sectors stay calmer
        const prop = this.driveProps[i];
        const route = lanes[(converted + this.sector) % lanes.length];
        // nearest point on that circuit, so the car appears on tarmac instead of in a field
        let bestD = Infinity, bx = 0, by = 0, bnode = 0, bang = 0;
        for (let k = 0; k < route.length; k++) {
          const a = route[k], b = route[(k + 1) % route.length];
          const dx = b.x - a.x, dy = b.y - a.y;
          const len2 = dx * dx + dy * dy || 1;
          const t = clamp(((prop.rect.x + prop.rect.w / 2 - a.x) * dx + (prop.rect.y + prop.rect.h / 2 - a.y) * dy) / len2, 0, 1);
          const px2 = a.x + dx * t, py2 = a.y + dy * t;
          const d = Math.hypot(px2 - (prop.rect.x + prop.rect.w / 2), py2 - (prop.rect.y + prop.rect.h / 2));
          if (d < bestD) { bestD = d; bx = px2; by = py2; bnode = (k + 1) % route.length; bang = Math.atan2(dy, dx); }
        }
        if (bestD > 900) continue;   // too far from any open road — leave it parked
        // ...and it must not materialise on the roof of a car already on that circuit
        if (this.roadCars.some((o) => Math.hypot(o.x - bx, o.y - by) < 140)) continue
        const hp = prop.kind === 'bus' || prop.kind === 'tanker' ? 260 : 170;
        this.roadCars.push({
          x: bx, y: by, ang: bang, speed: 62 + rand(0, 40), cruise: 62 + rand(0, 40), kind: prop.kind,
          route, node: bnode, wait: rand(0, 3), dead: false, colour: prop.colour,
          light: rand(0, TAU), brake: 0, lean: 0, jammed: 0, hp, maxHp: hp, burning: 0, panic: 0,
        });
        prop.rect.dead = true;
        this.driveProps.splice(i, 1);
        converted++;
      }
    }
    this.routines = []; this.routineT = 6; this.routineSeq = 0;
    /* The emplacements carry the footprint of their own pit into the fight; see the
     * ownPit field on the round and the sweep in updateBullets(). */
    this.armyTurrets = (world.army?.turrets || []).map((t) => ({
      x: t.x, y: t.y, ang: t.ang, hp: t.heavy ? 900 : 620, maxHp: t.heavy ? 900 : 620,
      owner: 'enemy' as const, cool: rand(0, 2), heavy: t.heavy, burst: 0, flash: 0, muzzle: 0,
      rounds: 0, gap: 0, aimX: t.x, aimY: t.y, pit: t.pit,
    }));
    this.armyInnerOpen = false;
    /* FIRST DEPLOY: the game stops before the operative can be shot at and says how to
     * play. This is the "ko prides v igro" card — one card, once per run. */
    this.milestone('deploy', 'OPERATIVE DEPLOYED · READ THIS ONCE', [
      'WASD to move · mouse to aim · LMB to fire · SPACE dash · C Aegis shield',
      'F interacts: gates, vehicles, uplinks, the vault guide. I opens the kit.',
      'Your objective is on the right. The CAGE, the vault and IRON RESERVE are all reachable.',
      'Everything you can fly or drive is out there, parked and real. Take it.',
    ]);
    // A prototype is a different aircraft, not a repaint: twice the structure, a hotter
    // powerplant and a seeker that reaches further. The line ships keep their old numbers.
    this.armyJets = (world.army?.jets || []).map((j) => {
      const tier: JetTier = j.tier ?? 'standard';
      const hp = tier === 'prototype' ? 1100 : tier === 'frostwing' ? 900 : 420;
      return {
        x: j.x, y: j.y, ang: j.ang, hp, maxHp: hp, tier,
        state: 'parked' as const, alt: 0, speed: 0, cool: 0, t: 0,
      };
    });
    this.gates = makeGates(world);
    this.details = makeDetails(world);
    this.facilities = world.facilities.map(f => ({ ...f, reveal: 0, discovered: false, secured: false, alarm: false, remaining: 0 }));
    this.facilityGuards = world.facilityGuards;
    this.facilityPainter.reset(); this.facilityTimer = 0; this.nearbyFacility = null;
    this.postNavigation = new WeakMap();
    this.convoyMotion = new WeakMap(); this.hangarClaims.clear();
    this.simulationTime = 0; this.vaultResupplied = false; this.aegisCharges = 0; this.aegisTime = 0;
    this.vaultNav = false; this.navigationDirty = true;
    this.grid.build(this.obstacles);
    // The power line: every pylon head, wired to its nearest neighbour once, so the spans
    // never change and nothing has to be recomputed per frame.
    this.pylons = this.obstacles.filter((o) => o.kind === 'pylon' && !o.dead)
      .map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, h: Math.min(o.h3d, 210), links: [] as number[] }));
    for (let i = 0; i < this.pylons.length; i++) {
      let best = -1, bestD = 1e9;
      for (let j = 0; j < this.pylons.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(this.pylons[i].x - this.pylons[j].x, this.pylons[i].y - this.pylons[j].y);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0 && bestD < 1500 && i < best) { this.pylons[i].links.push(best); this.pylons[best].links.push(i); }
    }
    // Birds: three flocks per district, anchored to open ground and water so they are
    // always visible from somewhere. The Arctic gets none — nothing lives up there.
    this.birds = [];
    if (this.sector !== 3) {
      const crow = this.sector === 5 || this.sector >= 6;
      for (let f = 0; f < 3; f++) {
        const ax = rand(1200, ARENA_W - 1200), ay = rand(900, ARENA_H - 900);
        const n = 5 + Math.floor(rand(0, 5));
        for (let i = 0; i < n; i++) {
          this.birds.push({
            ax, ay, a: rand(0, TAU), r: rand(120, 380), speed: rand(0.22, 0.5) * (Math.random() < 0.5 ? 1 : -1),
            alt: rand(60, 190), flap: rand(0, TAU), kind: crow ? 'crow' : 'gull',
          });
        }
      }
    }
    // Pedestrians: two shifts walking the shoulders of the longest roads. They keep to the
    // verge, they never enter a lane, and gunfire sends them running.
    this.peds = [];
    {
      const roads = this.zones.filter((z) => z.kind === 'road' && Math.max(z.w, z.h) > 700);
      const kinds: Ped['kind'][] = ['worker', 'clerk', 'courier'];
      for (const [ri, z] of roads.entries()) {
        const horiz = z.w >= z.h;
        const len = horiz ? z.w : z.h;
        const thick = horiz ? z.h : z.w;
        const count = ri < 4 ? 4 : 2;
        for (let i = 0; i < count; i++) {
          const side = (i % 2 === 0 ? -1 : 1) * (thick / 2 - 16);
          const a = side > 0 ? 0 : Math.PI;
          const offX = horiz ? 0 : side, offY = horiz ? side : 0;
          const p0 = horiz
            ? { x: z.x + 120, y: z.y + z.h / 2 + offY }
            : { x: z.x + z.w / 2 + offX, y: z.y + 120 };
          const p1 = horiz
            ? { x: z.x + len - 120, y: z.y + z.h / 2 + offY }
            : { x: z.x + z.w / 2 + offX, y: z.y + len - 120 };
          // A shoulder is only a pavement if it is clear: a building that grew out over the
          // verge turns that stretch of road into a wall, and a pedestrian walking through
          // it reads as a bug. Trim to the clear span, or skip the walker entirely.
          if (this.pointBlocked(p0.x, p0.y) || this.pointBlocked(p1.x, p1.y)) continue;
          this.peds.push({
            x: p0.x + rand(0, 60), y: p0.y + rand(-6, 6), ang: horiz ? a : Math.PI / 2,
            speed: rand(44, 68), route: [p0, p1], node: 1, panic: 0,
            kind: kinds[(ri + i) % 3], phase: rand(0, TAU),
          });
        }
      }
    }
    this.garrisonSpots = world.garrisonSpots;
    this.coderSpots = world.coderSpots;
    this.generalSpot = world.generalSpot;
    const serverHp = 240 + this.sector * 55;
    this.servers = world.serverSpots.map((s) => ({ x: s.x, y: s.y, hp: serverHp, maxHp: serverHp, dead: false, spark: 0 }));
    // Authored loot spots can end up in a squeeze between two structures: collide() pushes
    // the point out of one rect and straight into the next. Settle with a verified nudge so
    // every cache/barrel stays reachable instead of welded into a wall.
    const stuck = (x: number, y: number, r: number) => this.obstacles.some(o => !o.dead
      && x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r);
    const settle = (src: Point, r: number): Point => {
      const q = { x: src.x, y: src.y };
      for (let i = 0; i < 3; i++) this.collide(q, r);
      if (!stuck(q.x, q.y, r * 0.6)) return q;
      // Wider rings, and twelve directions on each: a cache welded into the corner of two
      // buildings used to stay there, because the first three rings were still inside the
      // same block. Nothing lootable is allowed to be unreachable.
      for (const d of [46, 92, 140, 200, 280, 380, 500, 640]) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const p = { x: src.x + Math.cos(a) * d, y: src.y + Math.sin(a) * d };
          this.collide(p, r);
          if (!stuck(p.x, p.y, r * 0.6)) return p;
        }
      }
      return q;
    };
    this.caches = world.cacheSpots.map((c) => {
      const q = settle(c, 20);
      return { x: q.x, y: q.y, hp: 45 + this.sector * 8, maxHp: 45 + this.sector * 8, dead: false };
    });
    this.helipads = world.helipads;
    this.hangarSpot = world.hangarSpot;
    this.beaconSpots = world.beaconSpots;
    this.satcoms = world.satcomSpots.map((s) => ({ x: s.x, y: s.y, hp: 140 + this.sector * 40, maxHp: 140 + this.sector * 40, dead: false, sweep: rand(0, TAU) }));
    this.barrels = world.barrelSpots.map((b) => {
      const q = settle(b, 17);
      return { x: q.x, y: q.y, hp: 1, dead: false };
    });
    this.barrelFuses = [];
    this.spotlights = world.spotlightSpots.map(s => {
      let center: Point = { x: HQ.cx, y: HQ.cy }, distance = Math.hypot(s.x - HQ.cx, s.y - HQ.cy);
      for (const p of [...world.pois.filter(p => !p.secret).map(p => ({ x: p.x, y: p.y })), ...world.facilities.map(f => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 }))]) {
        const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < distance) { distance = d; center = p; }
      }
      const bearing = Math.atan2(s.y - center.y, s.x - center.x);
      return { ...s, bearing, angle: bearing, range: 740, halfAngle: 0.15, exposure: 0, online: true };
    });
    this.vtols = [];

    // The start must never be inside a wall: the army district moved buildings onto the
    // old insert points, so settle the spawn exactly like a loot cache.
    const insert = this.pickSpawnPoint(world.dressing?.start || PLAYER_START, settle, stuck);
    this.px = insert.x; this.py = insert.y; this.pvx = 0; this.pvy = 0;
    this.pang = -Math.PI / 2;
    this.hp = this.maxHp = 100;
    this.shieldHp = 0; this.shieldMax = 0;
    // The kit is the operative's, not the sector's: swapping worlds keeps the tubes, the
    // magazines and the morale of the person carrying them.
    const carried = new Map(this.weaponAmmo);
    if (WEAPONS[this.weapon]?.ammo !== Infinity) carried.set(this.weapon, this.ammo);
    this.weapon = 'rifle'; this.ammo = Infinity;
    this.weaponAmmo = carried;
    this.fireCd = 0; this.dashCd = 0; this.dashT = 0; this.iFrames = 0;
    this.grenades = 4; this.recoil = 0;
    this.score = 0; this.wave = 0; this.streak = 0; this.streakT = 0; this.mult = 1; this.bestMult = 1;
    this.enemies = []; this.bullets = []; this.parts = []; this.pickups = [];
    this.texts = []; this.nades = []; this.enemyNades = []; this.shocks = [];
    this.decals = []; this.marks = []; this.lights = [];
    this.squads = []; this.spawnQueue = []; this.nextSquadId = 1;
    this.trucks = []; this.tanks = []; this.playerTank = null; this.mines = []; this.helis = []; this.barriers = []; this.wounded = [];
    this.supply = []; this.supplyCd = 26;
    this.piloting = false;
    this.support = 'aegis'; this.supportCd = 0; this.droneAng = 0;
    this.hangars = world.hangars.map((h) => ({ ...h, open: 0 }));
    this.vans = world.vanSpots.map((v) => ({
      x: v.x, y: v.y, ang: v.ang, speed: 0, lean: 0,
      hp: 276, maxHp: 276, dead: false, driving: false, boost: 0,
    }));
    // The sea wakes up with the world: three moored skiffs and two patrols on station.
    this.drivingBoat = null;
    this.islandAlarmT = 0; this.islandWaves = 0; this.islandLanded = false;
    this.cageEscaped = false;
    this.prisonFinale = false;
    // Reefs: the shallow approaches around the island are mined by nature, not by Hydra.
    this.reefs = [
      { x: 13240, y: 4620, r: 74 }, { x: 13560, y: 4860, r: 58 }, { x: 13880, y: 3180, r: 66 },
      { x: 12980, y: 3260, r: 62 }, { x: 14620, y: 6180, r: 88 }, { x: 15960, y: 6620, r: 76 },
      { x: 16740, y: 4620, r: 84 }, { x: 16980, y: 3140, r: 66 }, { x: 15640, y: 1720, r: 92 },
      { x: 14740, y: 1980, r: 70 }, { x: 12860, y: 5860, r: 80 }, { x: 16240, y: 5460, r: 72 },
    ].map((r) => ({ ...r, seen: false }));
    this.boats = MOORINGS.map((m) => makeBoat('skiff', 'player', m.x, m.y, m.ang, { crewed: true }));
    this.boats.push(
      makeBoat('patrol', 'enemy', 16680, 2780, 2.2, { state: 'cruise', tx: 15400, ty: 2900, homeX: 16680, homeY: 2780 }),
      makeBoat('patrol', 'enemy', 13420, 6280, -0.9, { state: 'cruise', tx: 14800, ty: 6700, homeX: 13420, homeY: 6280 }),
    );
    this.lasers = world.laserSpots.map((l) => ({
      x: l.x, y: l.y, ang: 0, hp: 420 + this.sector * 60, maxHp: 420 + this.sector * 60,
      charge: 0, cool: rand(2, 5), beam: 0, captured: false, targetX: l.x, targetY: l.y,
    }));
    this.parkedHelis = world.parkedHelis.map((p) => ({ ...p, taken: false }));
    this.pois = world.pois.map((p) => ({
      ...p, discovered: !p.secret || !!p.soft, cleared: false, captured: false, looted: false,
      gates: p.gates.map((g) => ({ x: g.x, y: g.y, built: false, hp: 600 })),
    }));
    this.vaultSpot = world.vaultSpot;
    this.planeSpot = world.planeSpot;
    this.allies = []; this.barricades = [];
    this.plane = null; this.drivingVan = null; this.flyingPlane = false;
    this.prisonHinted = false;
    this.vaultOpen = false; this.vaultChoice = 'none';
    this.siege = { active: false, t: 0, poi: '', waves: 0 };
    this.prompt = '';
    this.megaCrates = world.campaignSites?.megaCrates.map(mc => ({ ...mc, dead: false, hp: mc.maxHp })) || [];
    this.baseOverride = { active: false, poiId: '', progress: 0, timer: 0 };
    // Parade garrison standing at attention on the airfield apron.
    this.paradeSpots = world.paradeSpots;
    this.playerHeli = makeHeli(this.hangarSpot.x, this.hangarSpot.y + 108, Math.PI / 2);
    this.phase = 'recon'; this.phaseT = 0; this.phaseName = 'RECON';
    this.waveActive = false; this.intermission = 0.6;
    this.mods = defaultMods(); this.perkCounts = {}; this.upgradeChoices = [];
    this.aiLevel = 0.58 + this.sector * 0.12; this.aiTactic = 'PHALANX'; this.aiNote = 'HYDRA HQ ONLINE — PLANNING';
    this.mobility = 0; this.camping = 0; this.stationaryT = 0; this.dashLog = [];
    this.avgRange = 340; this.coverUse = 0; this.profileT = 0; this.adaptT = 0;
    this.hitstop = 0; this.timeScale = 1; this.flash = 0;
    this.camX = this.px - this.w / 2; this.camY = this.py - this.h / 2;
    this.banner = ''; this.bannerT = 0;
    this.hqBreached = false; this.garrisonAlerted = false; this.commandOnline = true;
    this.planT = 6; this.planTactic = 'phalanx';
    this.objective = `SECTOR ${this.sector}/6 · ASSAULT ${SECTORS[this.sector - 1].name}`;
    this.buildPierceRects();
    this.populateHQ();
    this.settleSpots();
    this.rebuildNavigation();
    this.validateInsertion();
  }

  /**
   * Authored props are placed against a plan, but the districts around them are scattered
   * at random, so a server bank or a parked transport can end up buried inside a wall —
   * unhackable, unenterable, or simply invisible behind a warehouse. Every interactive
   * prop is routed through the same verified nudge the caches already use: rings outward,
   * sixteen bearings, first dry and clear point wins. Nothing is ever moved into water.
   */
  private settleSpots() {
    const clear = (x: number, y: number, r: number) => !this.obstacles.some(o => !o.dead
      && x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r);
    const free = (x: number, y: number, r: number, dry: boolean) =>
      clear(x, y, r) && (!dry || !this.inWater(x, y));
    const fix = (p: { x: number; y: number }, r: number, dry = false) => {
      if (free(p.x, p.y, r, dry)) return;
      for (const d of [40, 80, 130, 190, 270, 370, 500, 660, 840, 1040]) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * TAU;
          const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
          if (free(x, y, r, dry)) { p.x = x; p.y = y; return; }
        }
      }
    };
    for (const s of this.servers) fix(s, 34);
    for (const v of this.vans) fix(v, 42, true);
    for (const s of this.satcoms) fix(s, 30, true);
    for (const p of this.parkedHelis) fix(p, 46, true);
    for (const m of this.megaCrates) fix(m, 30, true);
    for (const c of this.coderSpots) fix(c, 22, true);
    if (this.generalSpot) fix(this.generalSpot, 26, true);
  }

  /**
   * A start is only good if the operative can walk out of it. Fixed insertions plus a
   * randomly scattered district occasionally leave the spawn inside a sealed courtyard,
   * which reads as a broken level rather than a hard one. So the insertion is tested the
   * same way a soldier would: plan a route to the rest of the map, and if there is no
   * route, step to the nearest road point that does have one.
   */
  private validateInsertion() {
    const probe = { x: VAULT_ENTRY.x, y: VAULT_ENTRY.y };
    const reaches = (p: Point) => {
      const path = this.infantryRoutes.route(p, probe);
      const last = path[path.length - 1];
      return Math.hypot(last.x - probe.x, last.y - probe.y) < 520;
    };
    if (reaches({ x: this.px, y: this.py })) return;
    const candidates: Point[] = [];
    const roadZones = this.zones.filter((z) => z.kind === 'road');
    for (const z of roadZones) {
      const horizontal = z.w >= z.h;
      for (let t = 0.05; t <= 0.95; t += 0.1) {
        candidates.push(horizontal
          ? { x: z.x + z.w * t, y: z.y + z.h / 2 }
          : { x: z.x + z.w / 2, y: z.y + z.h * t });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py));
    for (const c of candidates.slice(0, 40)) {
      if (!this.infantryRoutes.clear(c)) continue;
      if (!reaches(c)) continue;
      this.px = c.x; this.py = c.y; this.camX = c.x - this.w / 2; this.camY = c.y - this.h / 2;
      this.addText(c.x, c.y - 60, 'INSERTION RE-ROUTED', '#9cdecd', 14);
      return;
    }
  }

  /** Index the housing blocks of every power cell and mega crate once per world build. */
  private buildPierceRects() {
    this.pierceRects.clear();
    const cells = this.campaignSites?.powerCells || [];
    const register = (x: number, y: number, key: 'cells' | 'crates', item: { dead: boolean }) => {
      for (const r of this.obstacles) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          const entry = this.pierceRects.get(r) || { cells: [], crates: [] };
          entry[key].push(item);
          this.pierceRects.set(r, entry);
          return;
        }
      }
    };
    for (const c of cells) register(c.x, c.y, 'cells', c);
    for (const mc of this.megaCrates) register(mc.x, mc.y, 'crates', mc);
  }

  private populateHQ() {
    this.general = null; this.coders = [];
    // General — unarmed, never leaves the keep
    const g = this.makeEnemy('general', this.generalSpot.x, this.generalSpot.y, 0, 0);
    g.spawnT = 0; g.garrison = true; g.homeX = this.generalSpot.x; g.homeY = this.generalSpot.y;
    this.general = g; this.enemies.push(g);
    // Programmers — unarmed, tethered to their terminals
    for (const c of this.coderSpots) {
      const e = this.makeEnemy('coder', c.x, c.y, 0, 0);
      e.spawnT = 0; e.garrison = true; e.homeX = c.x; e.homeY = c.y;
      this.coders.push(e); this.enemies.push(e);
    }
    // Garrison guards — static defenders, wake on breach
    // Airfield parade: ranks of Hydra troops standing at attention until disturbed.
    this.paradeSpots.forEach((p, idx) => {
      const group = Math.floor(idx / 12), slot = idx % 12;
      const types = ['commander', 'warden', 'grunt', 'grunt', 'gunner', 'pathfinder', 'grunt', 'breacher', 'gunner', 'grunt', 'guard', 'medic'];
      const rank = this.infantryRoutesReadyPoint(p.x, p.y);
      const e = this.makeEnemy(types[slot], rank.x, rank.y, -2000000 - group, slot);
      e.spawnT = 0; e.garrison = true; e.homeX = e.x; e.homeY = e.y;
      e.ang = -Math.PI / 2; e.patrolTeam = `kraken-${group}`; e.patrolSlot = slot; e.leader = slot === 0;
      this.enemies.push(e);
    });
    /* ---------------- IRON RESERVE PARADE ----------------
     * A thousand men in ranks. They are real units, but they are asleep: no pathing, no
     * fire, no separation until the base alarm wakes them in waves. That is what makes a
     * thousand of them affordable, and it is also how a parade ground actually behaves.
     */
    if (this.armyRanksData.length) {
      const types = ['armytrooper', 'armytrooper', 'armytrooper', 'armyguard', 'armytrooper', 'armyengineer', 'armymedic'];
      this.armyRanksData.forEach((r, idx) => {
        const type = r.type || types[idx % types.length];
        const e = this.makeEnemy(type, r.x, r.y, -3000000 - Math.floor(idx / 40), idx % 40);
        e.spawnT = 0; e.garrison = true; e.homeX = r.x; e.homeY = r.y;
        e.ang = -Math.PI / 2; e.dormant = true; e.rank = idx; e.alert = false;
        if (idx % 40 === 0) { e.type = 'armymajor'; e.def = ENEMIES.armymajor; e.hp = e.maxHp = 260; }
        this.enemies.push(e);
      });
      this.armyDormant = this.armyRanksData.length;
    } else {
      this.armyDormant = 0;
    }
    /* ---------------- IRON RESERVE STRONGPOINTS ----------------
     * The men on duty: artillery crews, silo watches, engineers, the provost. They are
     * awake from the start — a base this size is never empty, it is just quiet.
     */
    for (const [i, g] of (this.armyGuardsData || []).entries()) {
      const stand = this.infantryRoutesReadyPoint(g.x, g.y);
      const e = this.makeEnemy(g.type, stand.x, stand.y, -5000000 - i, i % 6);
      e.spawnT = 0; e.garrison = true; e.homeX = stand.x; e.homeY = stand.y;
      e.ang = -Math.PI / 2;
      this.enemies.push(e);
    }
    for (let i = 0; i < 6; i++) {
      const x = AIRFIELD.x - 700 + i * 265, y = AIRFIELD.y - 380;
      const pts = [{ x, y }, { x, y: AIRFIELD.y + 25 }, { x: x + 125, y: AIRFIELD.y + 25 }, { x: x + 125, y }]
        .map(q => this.infantryRoutesReadyPoint(q.x, q.y));
      this.patrolTeams.push({ id: `kraken-${i}`, x: pts[0].x, y: pts[0].y, angle: Math.PI / 2, node: 1, wait: 3 + i, points: pts });
    }
    this.campaignSites?.patrols.forEach((p, index) => {
      const route = p.points.map(q => this.infantryRoutesReadyPoint(q.x, q.y));
      const first = route[0];
      this.patrolTeams.push({
        ...first, id: p.id, points: route, node: 1, angle: 0, wait: index * 3,
        columns: p.columns, spacing: p.spacing, speed: p.speed, site: p.site, kind: p.kind,
      });
      p.members.forEach((type, slot) => {
        const pos = this.infantryRoutesReadyPoint(first.x + (slot % 2) * 36, first.y + Math.floor(slot / 2) * 43);
        const e = this.makeEnemy(type, pos.x, pos.y, -2100000 - index, slot);
        e.spawnT = 0; e.garrison = true; e.patrolTeam = p.id; e.patrolSlot = slot; e.leader = slot === 0;
        this.enemies.push(e);
      });
    });
    this.garrisonSpots.forEach((s, idx) => {
      // Later bases replace many guards with automated Hydra sentry towers.
      const type = this.sector >= 2 && idx % Math.max(2, 5 - this.sector) === 0 ? 'turret' : idx % 6 === 0 ? 'sentinel' : idx % 5 === 0 ? 'breacher' : 'guard';
      const post = this.infantryRoutesReadyPoint(s.x, s.y);
      const e = this.makeEnemy(type, post.x, post.y, 0, idx);
      e.spawnT = 0; e.garrison = true; e.homeX = e.x; e.homeY = e.y;
      this.enemies.push(e);
    });
    this.facilityGuards.forEach((post, index) => {
      const siteIndex = this.facilities.findIndex(f => f.id === post.facilityId);
      const stand = this.infantryRoutesReadyPoint(post.x, post.y);
      const e = this.makeEnemy(post.type, stand.x, stand.y, -1000000 - siteIndex, index);
      e.spawnT = 0; e.garrison = true; e.facilityId = post.facilityId;
      e.postRole = post.role; e.patrol = post.patrol.map(q => this.infantryRoutesReadyPoint(q.x, q.y)); e.patrolNode = 0;
      e.leader = post.role === 'leader';
      this.collide(e, e.def.r);
      e.homeX = e.x; e.homeY = e.y;
      e.ang = post.role === 'leader' ? Math.PI / 2 : index % 2 ? Math.PI / 2 : -Math.PI / 2;
      this.enemies.push(e);
    });
    // THE CAGE detail: a permanent squad of custody officers on the island, the forecourt
    // and both ends of the causeway bridge. They hold their posts until the operative
    // comes within reach — then they come to arrest him.
    this.prisonPolicePosts.forEach((post, index) => {
      const stand = this.infantryRoutesReadyPoint(post.x, post.y);
      const e = this.makeEnemy('custodian', stand.x, stand.y, -4000000 - index, index);
      e.spawnT = 0; e.garrison = true; e.policePost = true;
      e.homeX = stand.x; e.homeY = stand.y;
      e.ang = index % 2 ? Math.PI / 2 : -Math.PI / 2;
      // A sentry who never moves looks like scenery: each post gets a short beat of its
      // own, walked until the operative comes within reach.
      const r = 150 + (index % 3) * 60, a0 = index * 1.9;
      const ring = Array.from({ length: 3 }, (_, k) => {
        const a = a0 + (k / 3) * Math.PI * 2;
        return { x: stand.x + Math.cos(a) * r, y: stand.y + Math.sin(a) * r };
      }).filter((q) => this.onDryGround(q.x, q.y, 44));
      // Bridge and causeway posts can only walk their lane, not a full circle over the sea.
      const lane = [
        { x: stand.x - 150, y: stand.y }, { x: stand.x + 150, y: stand.y },
      ].filter((q) => this.onDryGround(q.x, q.y, 44));
      e.patrol = (ring.length >= 2 ? ring : lane).map((q) => this.infantryRoutesReadyPoint(q.x, q.y));
      e.patrolNode = 0;
      this.collide(e, e.def.r);
      this.enemies.push(e);
    });

    // CITY POLICE: custody patrols walking the streets of the theatre, not only the
    // island. They hold a beat around each installation and the fortress ring road, and
    // any one of them will put the operative in cuffs and send him to THE CAGE.
    const policeRing = (cx2: number, cy2: number, r: number): Point[] => [
      { x: cx2 + r, y: cy2 }, { x: cx2 + r * 0.6, y: cy2 + r * 0.8 },
      { x: cx2, y: cy2 + r }, { x: cx2 - r * 0.7, y: cy2 + r * 0.7 },
      { x: cx2 - r, y: cy2 }, { x: cx2 - r * 0.6, y: cy2 - r * 0.8 },
      { x: cx2, y: cy2 - r }, { x: cx2 + r * 0.7, y: cy2 - r * 0.7 },
    ];
    // The S.H.I.E.L.D. compound is the one place in the theatre the custody branch does not
    // walk: a police ring based on the black vault put handcuffs on the operative's doorstep
    // and turned the friendly base into a trap. Beats are dropped when any of their posts or
    // their ring passes near the vault, and secret sites never get one at all.
    const shieldGuard = (x: number, y: number) =>
      Math.hypot(x - VAULT_ENTRY.x, y - VAULT_ENTRY.y) < 1500;
    const beatIsClean = (ring: Point[]) => {
      for (const q of ring) {
        if (shieldGuard(q.x, q.y)) return false;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          for (let t = 0; t <= 1; t += 0.1) {
            if (shieldGuard(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
          }
        }
      }
      return true;
    };
    const beats: Point[][] = [];
    for (const poi of this.pois.slice(0, 7)) {
      if (poi.secret || shieldGuard(poi.x, poi.y)) continue;
      const ring = policeRing(poi.x, poi.y, Math.min(420, Math.max(240, poi.r * 0.8)));
      if (beatIsClean(ring)) beats.push(ring);
    }
    beats.push(policeRing(HQ.cx, HQ.cy, 1050));
    const airBeat = policeRing(AIRFIELD.x, AIRFIELD.y, 620);
    if (beatIsClean(airBeat)) beats.push(airBeat);
    beats.forEach((route, i) => {
      const pts = route.map((q) => this.infantryRoutesReadyPoint(q.x, q.y));
      const id = `police-${i}`;
      this.patrolTeams.push({
        id, x: pts[0].x, y: pts[0].y, angle: 0, node: 1, wait: 0.3 + i * 0.25,
        points: pts, kind: 'road', columns: 2, spacing: 32, speed: 64,
      });
      for (let slot = 0; slot < 2; slot++) {
        const stand = this.infantryRoutesReadyPoint(pts[0].x + slot * 32, pts[0].y + 24);
        const e = this.makeEnemy('custodian', stand.x, stand.y, -5000000 - i * 4 - slot, slot);
        e.spawnT = 0; e.garrison = true; e.patrolTeam = id; e.patrolSlot = slot; e.leader = slot === 0;
        e.homeX = stand.x; e.homeY = stand.y;
        this.enemies.push(e);
      }
    });

    // Every installation has one fixed heavy machine-gun emplacement.
    const emplacementSites: { id: string; x: number; y: number; r: number }[] = [
      ...this.pois.filter(p => !p.secret).map(p => ({ id: p.id, x: p.x, y: p.y, r: Math.min(260, p.r * 0.42) })),
      ...this.facilities.filter(f => !this.pois.some(p => Math.hypot(p.x - (f.x + f.w / 2), p.y - (f.y + f.h / 2)) < 300))
        .map(f => ({ id: f.id, x: f.x + f.w / 2, y: f.y + f.h / 2, r: Math.min(220, f.w * 0.32) })),
    ];
    emplacementSites.forEach((site, index) => {
      const p = this.infantryRoutesReadyPoint(site.x + site.r, site.y - 50);
      const e = this.makeEnemy('turret', p.x, p.y, -3000000 - index, 0);
      e.spawnT = 0; e.garrison = true; e.alert = false; e.homeX = p.x; e.homeY = p.y;
      e.facilityId = this.facilities.find(f => f.id === site.id)?.id;
      this.enemies.push(e);
    });
    for (const f of this.facilities) f.remaining = this.enemies.filter(e => e.facilityId === f.id).length;
  }

  /**
   * Begin a run.
   *
   * `opts` exists for the developer console on the start screen: it can drop the operative
   * straight into any sector, and it can switch on infinite lives. Both are off unless the
   * dev panel asked for them, so a normal deploy behaves exactly as it always did.
   */
  startRun(cls = 'assault', support = 'aegis', opts: { sector?: number; infiniteLives?: boolean } = {}) {
    const wanted = clamp(Math.round(opts.sector ?? 1), 1, SECTORS.length);
    this.devInfiniteLives = !!opts.infiniteLives;
    this.devSector = wanted;
    if (wanted === 1) {
      this.reset();
    } else {
      // `reset(false)` keeps the sector we just chose: the campaign is skipped, nothing else is.
      this.sector = wanted;
      this.reset(false);
    }
    this.mouseX = this.w / 2; this.mouseY = this.h / 2 - 100;
    // apply starting loadout
    if (cls === 'assault') {
      this.shieldMax = 120; this.shieldHp = 120;
      this.grenades += 1;
    } else if (cls === 'gunner') {
      this.weapon = 'smg'; this.ammo = WEAPONS.smg.ammo;
      this.mods.dashCdMul = 0.8;
      this.grenades += 1;
    } else if (cls === 'demolition') {
      this.weapon = 'gl'; this.ammo = WEAPONS.gl.ammo;
      this.grenades += 2;
      this.mods.emp = Math.max(this.mods.emp, 0.35);
    } else if (cls === 'marksman') {
      this.weapon = 'dmr'; this.ammo = WEAPONS.dmr.ammo;
      this.shieldMax = 120; this.shieldHp = 120;
    }
    this.support = support;
    if (support === 'aegis') {
      this.shieldMax = Math.max(this.shieldMax, 220);
      this.shieldHp = this.shieldMax;
    } else if (support === 'uplink') {
      this.supplyCd = 16;
      this.mods.emp = Math.max(this.mods.emp, 0.55);
    }
    this.status = 'playing';
    if (this.devInfiniteLives) {
      this.setBanner('DEV DEPLOY · INFINITE LIVES', `SECTOR ${this.sector} / ${SECTORS[this.sector - 1].name} · THE OPERATIVE CANNOT BE KILLED`);
      this.addText(this.px, this.py - 110, 'DEVELOPER CONSOLE ACTIVE', '#ffd166', 17);
    } else if (wanted > 1) {
      this.setBanner('DEV DEPLOY', `SECTOR ${this.sector} / ${SECTORS[this.sector - 1].name}`);
      this.addText(this.px, this.py - 110, `INSERTED INTO SECTOR ${this.sector}`, '#8be8ff', 17);
    } else {
      this.setBanner('PROTOCOL SOLAR ECLIPSE', 'ENEMY COMMAND IS ALREADY HUNTING YOU');
    }
    this.tellStory(PROLOGUE, 14);
    sfx.resume();
  }

  /* ---------------- input ---------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (this.tutorial) { this.tutorial = null; e.preventDefault(); return; }
    if (this.status === 'interior') return;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (this.keys[k]) return;
    this.keys[k] = true;
    if (k === 'escape') this.lastEscapeAt = performance.now();
    if (k === 'escape' || k === 'p') this.onPauseToggle();
    if (this.status !== 'playing') return;
    if (k === ' ' || k === 'shift') { if (!this.piloting && !this.flyingPlane && !this.drivingVan && !this.playerTank && !this.playerJet) this.doDash(); }
    if (k === 'g' || k === 'q' || k === 'e') {
      if (this.flyingPlane) this.dropBombs();
      else if (this.piloting && this.playerHeli) this.fireHeliRocket(this.playerHeli);
      else if (!this.drivingVan && !this.playerTank && !this.playerJet) this.throwGrenade();
    }
    if (k === 'f') this.interactHeli();
    if (this.playerJet) {
      const j = this.playerJet;
      if (k === 'x') j.mode = j.mode === 'missile' ? 'cannon' : 'missile';
      else if (k === 'g' || k === 'q') this.fireJetMissile();
      else if (k === 'h') this.fireJetRockets();
      else if (k === 'r') this.fireLanceCharge();
      else if (k === 'v') this.cycleJetView();
      else if (k === 'e') {
        j.autopilot = !j.autopilot;
        this.addText(j.x, j.y - 80, j.autopilot ? 'AUTOPILOT · ORBITING' : 'MANUAL CONTROL', '#a9ecff', 14);
      } else if (k === ' ') this.dropJetFlares();
    }
    if (this.piloting && this.playerHeli) {
      if (k === '1' || k === '2' || k === '3') this.selectHeliStation(this.playerHeli, Number(k) - 1);
      else if (k === 'x') this.selectHeliStation(this.playerHeli, ((this.playerHeli.station || 0) + 1) % HELI_ORDNANCE.length);
    }
    // Number keys shoulder a carried weapon; the same key twice puts it away for the carbine.
    if (!this.playerJet && !this.playerTank && !this.drivingVan && !this.flyingPlane && !this.piloting && !this.drivingBoat) {
      const slot = Number(k);
      if (slot >= 1 && slot <= 7) {
        const list = this.carriedWeapons();
        const target = list[slot - 1];
        if (target) {
          if (target.id === this.weapon && this.weapon !== 'rifle') this.selectWeapon('rifle');
          else this.selectWeapon(target.id);
        }
      }
    }
    if (k === 'l') this.toggleGate();
    if (k === 'r' && !this.playerJet) this.reloadWeapon();
    if (k === 'c') this.activateAegis();
    if (k === 'v' && !this.playerJet) this.toggleVaultRoute();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private onPointerDown = (e: PointerEvent) => {
    if (this.tutorial) { this.tutorial = null; return; }
    if (this.status !== 'playing') return;
    // Pull the trigger first: anything below that can throw must never leave the
    // weapon dead. (setPointerCapture used to abort the handler on some browsers.)
    if (e.pointerType !== 'touch' && e.button === 0) this.firing = true;
    sfx.resume();
    if (!this.pointerLocked) { try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    const p = this.local(e);
    if (e.pointerType === 'touch') {
      this.isTouch = true;
      const s = p.x < this.w * 0.5 ? this.moveStick : this.aimStick;
      if (!s.active) { s.id = e.pointerId; s.ox = p.x; s.oy = p.y; s.x = p.x; s.y = p.y; s.active = true; }
    } else {
      this.isTouch = false;
      // While the pointer is locked the browser reports a frozen clientX/clientY;
      // copying it into the virtual cursor yanked the aim to a corner on every click.
      if (!this.pointerLocked) { this.mouseX = p.x; this.mouseY = p.y; }
      if (e.button === 0) this.requestPointerLock();
      if (e.button === 2) this.throwGrenade();
    }
  };
  private requestPointerLock() {
    if (this.pointerLocked || this.isTouch || this.lockBlocked || this.status !== 'playing') return;
    try {
      const req = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (req && typeof req.catch === 'function') req.catch(() => this.onPointerLockError());
    } catch { this.onPointerLockError(); }
  }
  /** Chrome refuses a new lock for ~1.25 s after Esc and embedded viewers may refuse
   *  it outright. Previously the failure was swallowed, so the game kept running with
   *  a dead mouse. Now we retry once and, if the browser never allows it, fall back to
   *  the plain cursor — which is exactly how the game played before the lock existed. */
  private onPointerLockError = () => {
    if (this.pointerLocked || this.lockBlocked) return;
    this.lockFails++;
    if (this.lockFails >= 6) {
      this.lockBlocked = true;
      this.lockGrace = 6;
      this.addText(this.px, this.py - 70, 'MOUSE: FREE CURSOR MODE', '#9fe8ff', 14);
      return;
    }
    window.setTimeout(() => { if (!this.pointerLocked && !this.isTouch && this.status === 'playing') this.requestPointerLock(); }, 1400);
  };
  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.canvas;
    const wasLocked = this.pointerLocked;
    this.pointerLocked = locked;
    if (locked) {
      this.lockFails = 0; this.lockGrace = 0;
      // Put the virtual pointer in front of the weapon, where the crosshair would be.
      const start = Math.min(this.w, this.h) * 0.26;
      this.lockOffX = Math.cos(this.pang) * start;
      this.lockOffY = Math.sin(this.pang) * start;
      this.syncLockedAim();
      return;
    }
    this.clearInput();
    if (!wasLocked) return;
    // A deliberate Esc pauses the game. Any other drop (window focus, a notification,
    // an embedded viewer revoking the lock) must NOT freeze the game: keep playing
    // with the normal cursor and show how to recapture the mouse.
    if (performance.now() - this.lastEscapeAt < 700) {
      if (this.status === 'playing') this.onPauseToggle();
      return;
    }
    if (this.status === 'playing') this.lockGrace = 4;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      const p = this.local(e);
      for (const s of [this.moveStick, this.aimStick]) if (s.active && s.id === e.pointerId) { s.x = p.x; s.y = p.y; }
      return;
    }
    if (this.pointerLocked) {
      // 1:1 pointer motion in both axes, exactly like an unlocked cursor. The ring
      // clamp lives in syncLockedAim, so the pointer can always come back.
      this.lockOffX += e.movementX * this.aimSens;
      this.lockOffY += e.movementY * this.aimSens;
      this.syncLockedAim();
      return;
    }
    const p = this.local(e);
    this.mouseX = p.x; this.mouseY = p.y;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      for (const s of [this.moveStick, this.aimStick]) if (s.active && s.id === e.pointerId) { s.active = false; s.id = -1; }
    } else if (e.button === 0) this.firing = false;
  };

  /* ---------------- actions ---------------- */

  doDash() {
    if (this.status !== 'playing' || this.piloting || this.flyingPlane || this.drivingVan || this.drivingBoat) return;
    if (this.dashCd > 0 || this.dashT > 0) return;
    const m = this.moveVector();
    const ang = m.len > 0.15 ? Math.atan2(m.y, m.x) : this.pang;
    this.dashAng = ang; this.dashT = 0.19;
    this.dashCd = 1.1 * this.mods.dashCdMul; this.iFrames = 0.32;
    this.dashLog.push(performance.now() / 1000);
    sfx.dash();
    this.addLight(this.px, this.py, 170, '120,230,255', 0.25);
    for (let i = 0; i < 18; i++)
      this.addParticle(this.px, this.py, rand(-90, 90) - Math.cos(ang) * 170, rand(-90, 90) - Math.sin(ang) * 170, rand(0.2, 0.45), rand(2, 5), '#7fe9ff', true);
  }

  throwGrenade() {
    if (this.status !== 'playing') return;
    if (this.flyingPlane) { this.dropBombs(); return; }
    if (this.piloting && this.playerHeli) { if (this.playerHeli.rocketCd <= 0) this.fireHeliRocket(this.playerHeli); return; }
    if (this.drivingVan || this.drivingBoat) return;
    if (this.grenades <= 0 || this.grenadeCd > 0) return;
    this.grenades--; this.grenadeCd = 0.38;
    const a = this.pang;
    this.nades.push({ x: this.px + Math.cos(a) * 22, y: this.py + Math.sin(a) * 22, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, t: 1.05, z: 0, vz: 95, dmg: 84 });
    sfx.shoot('smg');
  }

  private moveVector() {
    let x = 0, y = 0;
    if (this.moveStick.active) {
      const dx = this.moveStick.x - this.moveStick.ox, dy = this.moveStick.y - this.moveStick.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) { const k = Math.min(1, d / 60) / d; x = dx * k; y = dy * k; }
    }
    const k = this.keys;
    if (k['w'] || k['arrowup']) y -= 1;
    if (k['s'] || k['arrowdown']) y += 1;
    if (k['a'] || k['arrowleft']) x -= 1;
    if (k['d'] || k['arrowright']) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(1, len) };
  }

  /* ---------------- loop ---------------- */

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    if (this.status === 'playing') {
      try {
        if (this.hitstop > 0) { this.hitstop -= dt; this.update(dt * 0.12); }
        else this.update(dt * this.timeScale);
      } catch (err) { this.survive(err, 'update'); }
      this.timeScale = lerp(this.timeScale, 1, dt * 2);
    } else if (this.status === 'transit') this.updateTransit(dt);
    else if (this.status === 'arrest') this.updateArrest(dt);
    else if (this.status === 'menu') this.idleUpdate(dt);
    else if (this.status === 'over' || this.status === 'victory') {
      const s = dt * 0.45;
      this.updateParticles(s); this.updateFx(s); this.updateCamera(s);
    }
    // Never leave the cursor captured behind a menu, upgrade card or end screen.
    if (this.pointerLocked && this.status !== 'playing' && document.exitPointerLock) {
      document.exitPointerLock();
    }
    if (this.status !== 'interior' && this.status !== 'menu' && this.status !== 'prison' && this.status !== 'glacier') {
      try { this.render(); } catch (err) { this.survive(err, 'render'); }
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.06;
      try { this.pushHud(); } catch (err) { this.survive(err, 'hud'); }
    }
  };

  /**
   * One bad frame must never end a run. Before this, a single throw inside the draw call
   * stopped the picture dead while the simulation kept running underneath it: the operative
   * died staring at a frozen screenshot and never saw the end screen. Now the failing
   * subsystem is reported to the console (once per message) and the loop carries on.
   */
  private crashLog = new Set<string>();
  crashCount = 0;
  private survive(err: unknown, where: string) {
    this.crashCount++;
    const msg = `${where}: ${String((err as Error)?.message || err)}`;
    if (!this.crashLog.has(msg)) {
      this.crashLog.add(msg);
      if (typeof console !== 'undefined') console.error('[game] recovered from a bad frame —', msg, err);
    }
  }

  private updateTransit(dt: number) {
    if (this.status !== 'transit') return;
    this.transitT -= dt;
    if (this.playerHeli) this.playerHeli.rotor += dt * 36;
    if (this.transitT <= 0) { if (this.prisonFinale) this.startPrisonLevel(); else this.enterNextSector(); }
  }

  /** Everything the operative is carrying, grouped the way a kit is actually packed. */
  private buildInventory(): Hud['inventory'] {
    const wName = WEAPONS[this.weapon]?.name || this.weapon.toUpperCase();
    const ammoText = this.ammo === Infinity ? 'UNLIMITED' : `${Math.max(0, Math.floor(this.ammo))}`;
    const carried: { label: string; detail: string; tone: string }[] = [];
    for (const [id, left] of this.weaponAmmo) {
      if (id === this.weapon) continue;
      const def = WEAPONS[id];
      if (!def) continue;
      carried.push({ label: def.short, detail: left === Infinity ? '∞' : `${Math.max(0, Math.floor(left))}`, tone: 'steel' });
    }
    const aircraft: { label: string; detail: string; tone: string }[] = [];
    if (this.playerJet) {
      aircraft.push({
        label: this.frostwing ? 'FROSTWING' : 'INTERCEPTOR',
        detail: `${this.playerJet.hp}/${this.playerJet.maxHp} · FLR ${this.playerJet.flares ?? 0}`,
        tone: 'ice',
      });
    }
    if (this.playerHeli) {
      aircraft.push({ label: 'KESTREL', detail: `${Math.round(this.playerHeli.hp)}/${this.playerHeli.maxHp}`, tone: 'sky' });
    }
    if (this.plane) {
      aircraft.push({ label: 'NIGHTJAR', detail: `${Math.round(this.plane.hp)}/${this.plane.maxHp}`, tone: 'sky' });
    }
    const systems: { label: string; detail: string; tone: string }[] = [
      { label: 'AEGIS', detail: this.aegisTime > 0 ? `${this.aegisTime.toFixed(1)}s` : `${this.aegisCharges}`, tone: 'gold' },
    ];
    if (this.frostwing) systems.push({ label: 'FROSTWING CLEARANCE', detail: 'ICE PLATING', tone: 'ice' });
    if (this.bridgeDown) systems.push({ label: 'CAGE CROSSING', detail: 'SEVERED', tone: 'danger' });
    if (this.vaultOpen) systems.push({ label: 'BLACK VAULT', detail: this.vaultChoice === 'taken' ? 'EMPTIED' : 'OPEN', tone: 'ice' });
    const keys: { label: string; detail: string; tone: string }[] = [];
    const sites = this.campaignSites;
    if (sites) {
      if (sites.libraryProgress) keys.push({ label: 'MNEMOSYNE', detail: `${sites.libraryProgress}/3`, tone: 'gold' });
      if (sites.librarySolved) keys.push({ label: 'CARTER CIPHER', detail: 'MASK ACTIVE', tone: 'gold' });
    }
    if (this.glacierVisits) keys.push({ label: 'GLACIER VAULT', detail: `${this.glacierVisits} VISIT${this.glacierVisits > 1 ? 'S' : ''}`, tone: 'ice' });
    if (this.prisonVisits) keys.push({ label: 'THE CAGE', detail: `${this.prisonVisits} ENTR${this.prisonVisits > 1 ? 'IES' : 'Y'}`, tone: 'steel' });
    if (this.stockadeOpen) keys.push({ label: 'STOCKADE', detail: 'BROKEN', tone: 'gold' });
    if (this.turretsHeld()) keys.push({ label: 'TWIN GUNS', detail: `${this.turretsHeld()} SEIZED`, tone: 'ice' });

    return [
      {
        group: 'PRIMARY',
        items: [
          { label: wName, detail: ammoText, tone: 'active' },
          ...carried,
        ],
      },
      {
        group: 'ORDNANCE',
        items: [
          { label: 'FRAG', detail: `${this.grenades}/${this.mods.grenadeCap}`, tone: 'gold' },
          ...(this.shieldMax > 0 ? [{ label: 'PLATE', detail: `${Math.round(this.shieldHp)}/${this.shieldMax}`, tone: 'steel' }] : []),
          { label: 'STREAK', detail: `${this.streak}`, tone: 'steel' },
        ],
      },
      ...(aircraft.length ? [{ group: 'AIRFRAME', items: aircraft }] : []),
      { group: 'SYSTEMS', items: systems },
      { group: 'INTEL', items: keys.length ? keys : [{ label: 'NO CIPHERS', detail: 'SEARCH THE BASES', tone: 'steel' }] },
    ];
  }

  /** Small helper: how many twin guns are held, for the inventory chip. */
  private turretsHeld() {
    return this.armyTurrets.filter((t) => t.owner === 'player').length;
  }

  /** Context prompt shown on the HUD for whatever the operative can interact with. */
  private nearPrompt(): string {
    if (this.playerJet) return 'F · EJECT FROM INTERCEPTOR';
    const jetNear = this.nearArmyJet();
    if (jetNear) return jetNear.tier === 'prototype' ? 'F · SEIZE PROTOTYPE INTERCEPTOR'
      : jetNear.tier === 'frostwing' ? 'F · TAKE THE FROSTWING' : 'F · SEIZE THE INTERCEPTOR';
    if (this.flyingPlane) return 'F · LAND BOMBER';
    if (this.playerTank) return 'F · EXIT TANK';
    if (this.drivingBoat) return 'F · EXIT BOAT';
    if (this.drivingVan) return 'F · EXIT TRANSPORT';
    if (this.piloting) return 'F · LAND GUNSHIP';
    const mcNear = this.megaCrates.find((c) => !c.dead && Math.hypot(this.px - c.x, this.py - c.y) < 100);
    if (mcNear) return `F · BREACH ${mcNear.label}`;
    for (const poi of this.pois) {
      if (poi.secret || poi.captured) continue;
      if (Math.hypot(this.px - poi.x, this.py - poi.y) < 170 && !this.baseOverride.active) {
        return `F · OVERRIDE ${poi.name}`;
      }
    }
    if (Math.hypot(this.px - VAULT_ENTRY.x, this.py - VAULT_ENTRY.y) < 130) return 'F / S.H.I.E.L.D. VAULT - ENTER 3D';
    const volume = this.campaignSites?.volumes.find(v => Math.hypot(v.x - this.px, v.y - this.py) < 88);
    if (volume && !this.campaignSites?.librarySolved) return `F / READ MNEMOSYNE VOLUME ${volume.number}`;
    if (this.vaultOpen && this.vaultChoice === 'offer' &&
        Math.hypot(this.planeSpot.x - this.px, this.planeSpot.y - this.py) < 260) return 'F · CLAIM AIR WING';
    if (this.plane && Math.hypot(this.plane.x - this.px, this.plane.y - this.py) < 170) return 'F · BOARD BOMBER';
    if (Math.hypot(PRISON_DOOR.x - this.px, PRISON_DOOR.y - this.py) < 230) return 'F · ENTER THE CAGE';
    if (this.glacierSpot && Math.hypot(this.glacierSpot.x - this.px, this.glacierSpot.y - this.py) < 280)
      return this.glacierVisits ? 'F · RETURN TO THE GLACIER VAULT' : 'F · OPEN THE GLACIER GATE';
    if (this.stockadeSpot && !this.stockadeOpen) {
      const st = this.stockadeSpot;
      if (this.px > st.x - 90 && this.px < st.x + st.w + 90 && this.py > st.y - 90 && this.py < st.y + st.h + 90)
        return this.mpNear(st) ? `F · BREAK THE STOCKADE (${this.mpNear(st)} MP INSIDE)` : 'F · BREAK THE STOCKADE';
    }
    if (this.parkedPlaneNear(210)) return 'F · SEIZE BOMBER';
    const l = this.lasers.find((q) => !q.captured && Math.hypot(q.x - this.px, q.y - this.py) < 120);
    if (l) return 'F · CAPTURE BEAM';
    for (const poi of this.pois) {
      for (const g of poi.gates) {
        if (!g.built && Math.hypot(g.x - this.px, g.y - this.py) < 150) return 'F · BARRICADE GATE';
      }
    }
    const p = this.parkedHelis.find((q, index) => !q.taken && !this.helis.some(h => h.home === index) && Math.hypot(q.x - this.px, q.y - this.py) < 120);
    if (p) return 'F · SEIZE GUNSHIP';
    const ownTank = this.tanks.find((q) => !q.dead && q.captured && !q.driven && Math.hypot(q.x - this.px, q.y - this.py) < 170);
    if (ownTank) return 'F · BOARD TANK';
    const boatNear = this.boats.find((b) => b.state !== 'sunk' && Math.hypot(b.x - this.px, b.y - this.py) < 160);
    if (boatNear) return boatNear.faction === 'enemy' ? 'F · SEIZE HYDRA BOAT' : 'F · BOARD BOAT';
    const nearTank = this.tanks.find((q) => !q.dead && !q.captured && Math.hypot(q.x - this.px, q.y - this.py) < 170);
    if (nearTank) return 'F · SEIZE TANK';
    const prop = this.nearDriveProp();
    if (prop) return `F · DRIVE ${VAN_LABEL[prop.kind]}`;
    const moving = this.nearTrafficCar();
    if (moving) return `F · TAKE ${VAN_LABEL[moving.kind]}`;
    const v = this.vans.find((q) => !q.dead && !q.reserved && !q.disabled && Math.hypot(q.x - this.px, q.y - this.py) < 110);
    if (v) return v.art ? `F · DRIVE ${VAN_LABEL[v.art]}` : 'F · DRIVE TRANSPORT';
    if (this.playerHeli && Math.hypot(this.playerHeli.x - this.px, this.playerHeli.y - this.py) < 94) return 'F · BOARD GUNSHIP';
    return '';
  }

  private idleUpdate(dt: number) {
    this.camX += Math.cos(performance.now() / 7000) * 26 * dt;
    this.camY += Math.sin(performance.now() / 9000) * 22 * dt;
    this.camX = clamp(this.camX, 0, ARENA_W - this.w);
    this.camY = clamp(this.camY, 0, ARENA_H - this.h);
    if (Math.random() < 0.35)
      this.addParticle(this.camX + rand(0, this.w), this.camY + rand(0, this.h), rand(-10, 10), rand(-16, -4), rand(1.6, 3), rand(1, 2.4), '#48685f', false);
    this.updateParticles(dt);
    this.updateFx(dt);
  }

  private pushHud() {
    const serversLeft = this.servers.filter((s) => !s.dead).length;
    const nearTurret = this.armyTurrets.find((t) => t.owner === 'enemy' && Math.hypot(t.x - this.px, t.y - this.py) < 150);
    const codersLeft = this.coders.filter((c) => c.hp > 0).length;
    const boarding = new Map<number, number>();
    for (const e of this.enemies) if (e.boardingTruck !== undefined) boarding.set(e.boardingTruck, (boarding.get(e.boardingTruck) || 0) + 1);
    const carried = this.trucks.reduce((n, t) => n + (t.dead ? 0 : Math.max(0, t.comp.filter(Boolean).length - t.slot - (boarding.get(t.squadId) || 0))), 0);
    const air = this.airTransports.reduce((n, a) => n + Math.max(0, a.comp.length - a.slot), 0) + this.airTroops.length;
    const reserved = this.responseOrders.reduce((n, o) => n + o.units, 0);
    this.onHud({
      score: Math.floor(this.score), wave: this.wave,
      hp: Math.max(0, Math.round(this.hp)), maxHp: this.maxHp,
      weapon: WEAPONS[this.weapon].short,
      ammo: this.ammo === Infinity ? -1 : Math.max(0, Math.floor(this.ammo)),
      grenades: this.grenades, streak: this.streak, mult: this.mult,
      shieldHp: Math.round(this.shieldHp), shieldMax: this.shieldMax,
      armyAlarm: this.armyAlarm,
      armyAwake: this.armyRanksData.length ? Math.max(0, this.armyRanksData.length - this.armyDormant) : 0,
      armyTotal: this.armyRanksData.length,
      turretsHeld: this.armyTurrets.filter((t) => t.owner === 'player').length,
      turretsTotal: this.armyTurrets.length,
      turretPrompt: nearTurret
        ? (nearTurret.hp > nearTurret.maxHp * 0.75
          ? `TWIN GUN · ${Math.round((nearTurret.hp / nearTurret.maxHp) * 100)}% CREW MORALE · KEEP FIRING`
          : 'F · SEIZE THE TWIN GUN')
        : '',
      dashPct: 1 - clamp(this.dashCd / (1.1 * this.mods.dashCdMul), 0, 1),
      enemiesLeft: this.enemies.filter((e) => !e.garrison).length + this.spawnQueue.length + carried + air + reserved,
      grenadeCap: this.mods.grenadeCap,
      aiTactic: this.aiTactic, aiNote: this.aiNote, aiLevel: this.aiLevel,
      aiVolley: this.squads.length ? Math.max(0, ...this.squads.map((s) => s.volleyWindow)) : 0,
      aiSquads: this.squads.length, aiThreat: this.enemyNades.length,
      blackoutHud: this.blackout.active,
      serversLeft, serversTotal: this.servers.length, codersLeft,
      generalHp: this.general ? Math.max(0, this.general.hp / this.general.maxHp) : 0,
      generalShield: serversLeft > 0,
      objective: this.objective,
      hqDist: Math.hypot(HQ.cx - this.px, HQ.cy - this.py),
      satcomsLeft: this.satcoms.filter((s) => !s.dead).length,
      satcomTotal: this.satcoms.length,
      vtolsInbound: this.vtols.filter((v) => v.state !== 'out').length,
      trucksActive: this.trucks.filter((t) => !t.dead && t.state !== 'leave').length,
      helisActive: this.helis.filter((h) => h.state !== 'egress').length,
      woundedCount: this.wounded.length,
      barriersActive: this.barriers.length,
      phase: this.phaseName,
      piloting: this.piloting,
      heliHp: this.playerHeli?.hp || 0,
      heliMaxHp: this.playerHeli?.maxHp || 0,
      heliFuel: this.playerHeli?.fuel || 0,
      heliStation: this.playerHeli?.station ?? 0,
      heliAmmo: (this.playerHeli?.ammo || [-1, 0, 0]).map((n) => (n < 0 ? -1 : Math.floor(n))) as [number, number, number],
      heliLock: !!this.playerHeli && !!this.heliAirTarget(this.playerHeli, 2600),
      hangarDist: this.playerHeli ? Math.hypot(this.playerHeli.x - this.px, this.playerHeli.y - this.py) : 0,
      sector: this.sector,
      basesCleared: Math.max(0, this.sector - 1),
      sectorName: SECTORS[this.sector - 1]?.name || 'UNKNOWN SECTOR',
      destination: this.destination,
      transitPct: this.status === 'transit' ? clamp(1 - this.transitT / this.transitDuration, 0, 1) : 0,
      driving: !!(this.drivingVan || this.playerTank || this.drivingBoat),
      tank: !!this.playerTank,
      flyingPlane: this.flyingPlane,
      allies: this.allies.length,
      barricades: this.barricades.length,
      siegeActive: this.siege.active,
      lasersHeld: this.lasers.filter((l) => l.captured).length,
      poisCaptured: this.pois.filter((p) => p.captured).length,
      poisTotal: this.pois.filter((p) => !p.secret).length,
      vaultFound: this.vaultOpen,
      nearPrompt: this.nearPrompt(),
      mouseSens: this.aimSens,
      coords: `X ${Math.round(this.px)}  Y ${Math.round(this.py)}`,
      gatePrompt: this.gates.some(g => g.hp > 0 && Math.hypot(g.x - this.px, g.y - this.py) < 165) ? 'L / LOCK OR UNLOCK GATE' : '',
      aegisCharges: this.aegisCharges, aegisTime: this.aegisTime,
      inventory: this.buildInventory(),
      jet: !!this.playerJet,
      jetBoost: this.playerJet ? (this.playerJet.boost || 0) : 0,
      jetSpeed: this.playerJet ? Math.round(this.playerJet.speed) : 0,
      jetAlt: this.playerJet ? Math.round(this.playerJet.alt) : 0,
      jetMode: this.playerJet?.mode || 'cannon',
      jetFlares: this.playerJet?.flares ?? 0,
      jetLock: this.playerJet?.lock ? `${this.playerJet.lock.label}` : '',
      airThreat: this.hunterCount(),
      jetAce: this.playerJet?.tier === 'prototype',
      jetMissiles: this.playerJet?.missiles ?? 0,
      jetRockets: this.playerJet?.rocketsPlayer ?? 0,
      jetLance: this.playerJet?.lance ?? 0,
      jetHeat: this.playerJet?.heat ?? 0,
      jetJam: (this.playerJet?.jam ?? 0) > 0,
      jetView: this.playerJet?.view === 1 ? 'TACTICAL' : this.playerJet?.view === 2 ? 'GUN CAM' : 'CHASE',
      jetRwr: (this.playerJet?.rwr ?? 0) > 0,
      devInfinite: this.devInfiniteLives, devSector: this.sector,
      jetTier: this.playerJet?.tier === 'prototype' ? 'PROTOTYPE'
        : this.playerJet?.tier === 'frostwing' ? 'FROSTWING' : 'INTERCEPTOR',
      jetAutopilot: !!this.playerJet?.autopilot,
      frostwing: this.frostwing,
      vehicleHp: this.playerJet ? this.playerJet.hp : this.flyingPlane ? this.plane?.hp || 0 : this.playerTank ? this.playerTank.hp : this.drivingVan ? this.drivingVan.hp : this.piloting ? this.playerHeli?.hp || 0 : 0,
      vehicleMax: this.playerJet ? this.playerJet.maxHp : this.flyingPlane ? this.plane?.maxHp || 1 : this.playerTank ? this.playerTank.maxHp : this.drivingVan ? this.drivingVan.maxHp : this.piloting ? this.playerHeli?.maxHp || 1 : 1,
      vehicleFuel: this.flyingPlane ? this.plane?.fuel || 0 : this.piloting ? this.playerHeli?.fuel || 0 : 100,
      facilityLabel: this.nearbyFacility ? `${this.nearbyFacility.code} / ${this.nearbyFacility.name}` : '',
      facilityStatus: this.nearbyFacility ? this.nearbyFacility.secured ? 'SECURED / SUPPLIES RELEASED'
        : `${this.nearbyFacility.remaining} DEFENDERS / ${this.nearbyFacility.alarm ? 'ALERT' : 'GARRISON'}` : '',
      alarmActive: this.security.active, alarmExposure: this.security.exposure, alarmJammed: this.security.jammed,
      responseRemaining: reserved,
      airTransports: this.airTransports.filter(a => !['return', 'land'].includes(a.state)).length,
      storyTitle: this.story.title, storyText: this.story.text, storyChannel: this.story.channel, storyTime: this.storyTime,
      libraryProgress: this.campaignSites?.libraryProgress || 0, librarySolved: this.campaignSites?.librarySolved || false,
      overrideProgress: this.baseOverride.active ? Math.round(this.baseOverride.progress) : 0,
      overrideActive: this.baseOverride.active,
      overrideBase: this.baseOverride.active ? (this.pois.find(p => p.id === this.baseOverride.poiId)?.name || 'STATION') : '',
      banner: this.banner, bannerSub: this.bannerSub, bannerT: this.bannerT,
    });
  }

  /** Screen radius the virtual pointer may wander from the operative. */
  aimRing() { return Math.min(this.w, this.h) * 0.45; }

  /** Keep the virtual pointer inside the ring, then turn it into screen coordinates. */
  private syncLockedAim() {
    if (!this.pointerLocked) return;
    const r = this.aimRing();
    const d = Math.hypot(this.lockOffX, this.lockOffY);
    if (d > r) {
      // Soft stop: the pointer rides the ring instead of flying off-screen, and keeps
      // its direction, so a small move back inward resumes normal 1:1 tracking.
      this.lockOffX *= r / d;
      this.lockOffY *= r / d;
    }
    this.mouseX = this.px - this.camX + this.lockOffX;
    this.mouseY = this.py - this.camY + this.lockOffY;
    const speed = Math.hypot(this.pvx, this.pvy);
    this.reticlePulse = lerp(this.reticlePulse, clamp(speed / 360, 0, 1), 0.12);
  }

  /** Mouse sensitivity — mouse wheel while playing, or the HUD button. Persisted locally. */
  setAimSens(v: number) {
    this.aimSens = clamp(Math.round(v * 100) / 100, 0.25, 3);
    try { localStorage.setItem('pse.aimSens', String(this.aimSens)); } catch { /* private mode */ }
    this.addText(this.px, this.py - 62, `MOUSE ${this.aimSens.toFixed(2)}x`, '#9fe8ff', 14);
  }
  private onWheel = (e: WheelEvent) => {
    if (!this.pointerLocked || this.status !== 'playing') return;
    e.preventDefault();
    this.setAimSens(this.aimSens * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  /**
   * DEV CONSOLE · INFINITE LIVES.
   *
   * One place, once a frame: whatever the frame before it did to a health pool — a reef, a
   * crashing transport, a scripted 9999 — the operative and whatever he is sitting in are
   * put back on one hit point instead of dying.
   */
  /** DEV CONSOLE: with infinite lives on, nothing's hull is allowed to reach zero. */
  private devKeep(hull: { hp: number } | null | undefined) {
    if (!this.devInfiniteLives || !hull) return;
    if (hull.hp < 1) hull.hp = 1;
  }

  private devHoldTheLine() {
    if (!this.devInfiniteLives) return;
    if (this.hp < 1) this.hp = 1;
    // Every airframe in the sky is the operative's while he is in it: a hunter that gets a
    // good pass must not end a dev run by killing the aircraft out from under him.
    for (const j of this.armyJets) if (j.manned && j.hp < 1) j.hp = 1;
    if (this.playerJet && this.playerJet.hp < 1) this.playerJet.hp = 1;
    if (this.plane && this.flyingPlane && this.plane.hp < 1) this.plane.hp = 1;
    if (this.piloting && this.playerHeli && this.playerHeli.hp < 1) this.playerHeli.hp = 1;
    if (this.playerTank && this.playerTank.hp < 1) this.playerTank.hp = 1;
    /* AIRCRAFT AND VESSELS COUNT TOO. The dev switch used to protect the man on foot and
     * the airframes he was sitting in, but a boat could still be sunk under him and end the
     * run while he was in dev mode. Everything he can drive or fly is now held alive. */
    if (this.drivingBoat && this.drivingBoat.hp < 1) this.drivingBoat.hp = 1;
    if (this.drivingVan && this.drivingVan.hp < 1) this.drivingVan.hp = 1;
  }

  /** Stop the world and teach one thing. Never shown twice for the same activity. */
  private showTutorial(id: string, title: string, lines: string[], hint = 'PRESS ANY KEY OR CLICK TO CONTINUE') {
    if (this.tutorialsSeen.has(id) || this.tutorial) return;
    this.tutorialsSeen.add(id);
    this.tutorial = { title, lines, hint };
    this.clearInput();
    sfx.click();
  }

  /**
   * A milestone card is a tutorial that also tells the operative what just changed: the
   * game stops, the world is frozen, and the card says what to do with the new thing.
   * Every first in a run gets one — the first deploy, the first base taken, the first
   * stockade broken, the first interceptor, the first tank, the first boat.
   */
  private milestone(id: string, title: string, lines: string[]) {
    this.showTutorial(id, title, lines, 'PRESS ANY KEY TO RESUME');
  }

  private update(dt: number) {
    // A tutorial card is a hard stop: nothing moves until it is dismissed.
    if (this.tutorial) return;
    if (this.devInfiniteLives) this.devHoldTheLine();
    this.lockGrace = Math.max(0, this.lockGrace - dt);
    this.syncLockedAim();
    this.pathBudget = 1;
    this.infantryBudget = 1;
    this.rebuildEnemyBuckets();
    this.simulationTime += dt;
    this.ditchT = Math.max(0, this.ditchT - dt);
    if (this.ditchT <= 0) this.ditching = false;
    this.storyTime = Math.max(0, this.storyTime - dt);
    this.archiveReadCooldown = Math.max(0, this.archiveReadCooldown - dt);
    this.aegisTime = Math.max(0, this.aegisTime - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.updateGates(dt);
    if (this.navigationDirty) this.rebuildNavigation();
    // The take-off chain owns the operative while it runs: nothing else moves them.
    if (this.launch) this.updateTakeoffChain(dt);
    else this.updatePlayer(dt);
    if (this.status !== 'playing') return;
    this.updateSecurity(dt);
    this.updateResponseOrders(dt);
    this.updatePatrolTeams(dt);
    this.updateBlackout(dt);
    this.updateProfile(dt);
    this.updateCommand(dt);
    this.updateWaves(dt);
    // Weather and the army district run after the wave logic but before the enemies, so a
    // rank woken by the alarm is already awake when the soldiers think this frame.
    this.updateDressing(dt);
    this.updateArmy(dt);
    this.updateTraffic(dt);
    this.updateRoutines(dt);
    for (const b of this.birds) { b.a += b.speed * dt; b.flap += dt * (b.kind === 'crow' ? 9 : 6); }
    for (const p of this.peds) {
      p.phase += dt * 6;
      if (p.panic > 0) p.panic = Math.max(0, p.panic - dt);
      const t = p.route[p.node];
      const dx = t.x - p.x, dy = t.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = p.speed * (p.panic > 0 ? 2.6 : 1);
      const nx = p.x + (dx / d) * sp * dt, ny = p.y + (dy / d) * sp * dt;
      p.ang = Math.atan2(dy, dx);
      if (this.pointBlocked(nx, ny)) {
        // Something is in the way — a grown building, a parked transport, a crate someone
        // dropped on the verge. Turn round and walk the other way.
        p.node = (p.node + 1) % p.route.length;
        p.x -= (dx / d) * 10; p.y -= (dy / d) * 10;
      } else {
        p.x = nx; p.y = ny;
      }
      if (d < 24) p.node = (p.node + 1) % p.route.length;
    }
    if (this.status !== 'playing') return;
    this.updateSquads(dt);
    this.updateEnemies(dt);
    this.updateBoats(dt);
    this.updateIslandDefence(dt);
    if (this.status !== 'playing') return;
    this.updateSupport(dt);
    this.updateAirCombat(dt);
    this.updateHangars(dt);
    this.updateFacilities(dt);
    this.updateLasers(dt);
    this.updateAllies(dt);
    this.updateSiege(dt);
    this.updateBaseOverride(dt);
    this.updateBullets(dt);
    if (this.status !== 'playing') return;
    this.updateGrenades(dt);
    if (this.status !== 'playing') return;
    this.updateMines(dt);
    this.updatePickups(dt);
    this.updateSupply(dt);
    this.updateParticles(dt);
    this.updateFx(dt);
    this.updateCamera(dt);
    if (this.streakT > 0) { this.streakT -= dt; if (this.streakT <= 0) { this.streak = 0; this.mult = 1; } }
    if (this.bannerT > 0) this.bannerT -= dt;
  }


  /* ================================================================== */
  /* WEATHER: SNOW ON THE GROUND, PLOUGHS WORKING THE ROADS             */
  /* ================================================================== */

  /**
   * Snow is not a filter over the screen: the ploughs really move it. Each pass scrapes a
   * lane behind the blade and throws the load onto the heaps at the roadside, which grow
   * while the operative watches and slowly refill in the weather.
   */
  private updateDressing(dt: number) {
    const d = this.dressing;
    if (!d) return;
    this.weatherT += dt;

    for (const p of this.ploughs) {
      const len = Math.hypot(p.bx - p.ax, p.by - p.ay) || 1;
      p.t += (p.speed / len) * p.dir * dt;
      if (p.t >= 1) { p.t = 1; p.dir = -1; }
      else if (p.t <= 0) { p.t = 0; p.dir = 1; }
      p.x = p.ax + (p.bx - p.ax) * p.t;
      p.y = p.ay + (p.by - p.ay) * p.t;
      p.ang = Math.atan2((p.by - p.ay) * p.dir, (p.bx - p.ax) * p.dir);
      p.blade = 0.5 + 0.5 * Math.sin(this.simulationTime * 7 + p.ax);

      p.pushT -= dt;
      if (p.pushT > 0) continue;
      p.pushT = 0.2;
      // where the blade is throwing the load: always onto the same shoulder
      const nx = p.nx, ny = p.ny;
      const bx = p.x + nx * p.off, by = p.y + ny * p.off;
      let bank: SnowBank | null = null;
      let bd = 110;
      for (const b of this.snowBanks) {
        const dd = Math.hypot(b.x - bx, b.y - by);
        if (dd < bd) { bd = dd; bank = b; }
      }
      if (bank) {
        bank.fill = Math.min(1.7, bank.fill + 0.05);
        bank.r = Math.min(165, bank.r + 0.8);
        bank.h = Math.min(62, bank.h + 0.3);
        bank.x = bank.x * 0.985 + bx * 0.015;
        bank.y = bank.y * 0.985 + by * 0.015;
      } else if (this.snowBanks.length < 1200) {
        this.snowBanks.push({ x: bx, y: by, r: 32, h: 12, fill: 0.55 });
      }
      // the cleared lane behind the blade
      this.clearedLanes.push({
        x: p.x - Math.cos(p.ang) * 26, y: p.y - Math.sin(p.ang) * 26,
        ang: p.ang, len: 120, w: 168, t: 14,
      });
      if (this.clearedLanes.length > 420) this.clearedLanes.shift();
      if (Math.random() < 0.4) {
        this.addParticle(bx, by, nx * rand(20, 70), ny * rand(20, 70), rand(0.3, 0.7), rand(2, 5),
          d.snow ? '#eaf6ff' : '#8a8070', false);
      }
    }

    // the weather slowly puts it back, and cleared lanes fade as it snows over them
    if (d.snow) {
      const refill = dt * 0.0022;
      for (const b of this.snowBanks) if (b.fill < 1.35) b.fill = Math.min(1.35, b.fill + refill);
    }
    for (let i = this.clearedLanes.length - 1; i >= 0; i--) {
      const l = this.clearedLanes[i];
      l.t -= dt;
      if (l.t <= 0) this.clearedLanes.splice(i, 1);
    }
  }

  /* ================================================================== */
  /* IRON RESERVE: THE BASE THAT ANSWERS ALL AT ONCE                    */
  /* ================================================================== */

  private updateArmy(dt: number) {
    const a = this.army;
    if (!a) return;

    const inside = (b: { x: number; y: number; w: number; h: number }) =>
      this.px > b.x && this.px < b.x + b.w && this.py > b.y && this.py < b.y + b.h;
    const inBase = inside(a.base);
    /* An approach run over the district is an attack on the district. Flying in used to
     * leave the armour asleep unless the operative happened to touch the compound on foot,
     * which is why the battlefield looked empty from the air: the alarm is now raised by an
     * aircraft overhead as well as by a man at the wire. */
    const airborneOverDistrict = !!this.playerJet && inside(a.region);

    // The alarm: crossing into the compound wakes the whole district.
    if (!this.armyAlerted && (inBase || airborneOverDistrict)) {
      this.armyAlerted = true;
      this.armyAlarm = 1;
      this.armyWakeT = 0.6;
      this.armyLaunchT = 2.5;
      this.setBanner('IRON RESERVE · GENERAL QUARTERS',
        airborneOverDistrict ? 'AIRCRAFT OVER THE DISTRICT — EVERY GUN AND HULL IS COMING UP'
          : 'A THOUSAND MEN, AND EVERY AIRCRAFT THEY OWN');
      this.addText(this.px, this.py - 70, '⚠ BASE ALARM — THE PARADE IS WAKING', '#ffd166', 20);
      sfx.rotor();
    }
    if (this.armyAlerted) {
      this.armyAlarm = Math.min(1, this.armyAlarm + dt * 0.4);
      // one wave of the parade every three seconds until the ranks are empty: the whole
      // district is on its feet inside twenty seconds of the alarm
      this.armyWakeT -= dt;
      if (this.armyWakeT <= 0 && this.armyDormant > 0) {
        this.armyWakeT = 3;
        this.armyWaves++;
        const woken = this.wakeArmyRanks(150);
        if (woken > 0) {
          this.addText(this.px, this.py - 96,
            `PARADE ${this.armyWaves} · ${woken} MEN FALL IN`, '#e6e2b4', 15);
          sfx.wave();
        }
      }
      // air: one jet and, until the apron is empty, one gunship per launch cycle
      this.armyLaunchT -= dt;
      if (this.armyLaunchT <= 0) {
        this.armyLaunchT = 24;
        this.launchArmyAir();
      }
    } else if (!inBase) {
      this.armyAlarm = Math.max(0, this.armyAlarm - dt * 0.25);
    }

    /* ---- the powered inner gate ----
     * Both generators feed the shutter in the blast wall. Kill them and it drops; until
     * then the parade ground is sealed except through the gatehouse or from the air.
     */
    if (!this.armyInnerOpen) {
      const cells = this.campaignSites?.powerCells.filter((c) => c.site === 'army-core') || [];
      if (cells.length && cells.every((c) => c.dead)) {
        this.armyInnerOpen = true;
        let n = 0;
        for (const o of this.armyShutters) {
          if (o.armyGate !== 'inner' || o.dead) continue;
          o.dead = true; n++;
        }
        this.navigationDirty = true;
        this.grid.build(this.obstacles);
        this.setBanner('BLAST GATE DOWN', 'BOTH GENERATORS ARE OUT — THE PARADE GROUND IS OPEN');
        this.addText(this.px, this.py - 80, 'INNER SHUTTER DROPS', '#ffd166', 18);
        sfx.explode();
        void n;
      }
    }

    /* ---------------- ARMOUR ---------------- *
     * This is an army base, not a checkpoint. The park holds a battalion and it keeps
     * feeding hulls onto the field for as long as the alarm is up: waves of eight to ten,
     * thirty-four alive at once, each with a main gun that will end a careless run.
     */
    if (this.armyAlerted) {
      this.armyTankWaveT -= dt;
      const live = this.tanks.filter((q) => !q.dead && !q.captured).length;
      /* From the air the battalion does not chase a jet it cannot catch: it rolls out of
       * the park and takes up the air-defence posts around the field, which is where the
       * operative flies over it. Same hulls, same park, real posts. */
      const flyingThreat = !!this.playerJet;
      if (this.armyTankWaveT <= 0 && live < 34 && a.tankPatrols.length) {
        this.armyTankWaveT = flyingThreat ? 3 : 6;
        const batch = Math.min(flyingThreat ? 8 : 10, 34 - live);
        /* The hulls come out of the park nearest the shooting, not out of the next slot on
         * a list: armour that spawns four kilometres from the fight is armour nobody ever
         * sees. Each wave spreads across its own line so no two hulls share a spot. */
        let line = a.tankPatrols[0], lineD = Infinity;
        for (const p of a.tankPatrols) {
          const d = Math.hypot(p.x - this.px, p.y - this.py);
          if (d < lineD) { lineD = d; line = p; }
        }
        for (let i = 0; i < batch; i++) {
          const spot = line;
          this.armyTankSent++;
          const ang = Math.atan2(this.py - spot.y, this.px - spot.x);
          let jx = spot.x + ((i % 4) - 1.5) * 190 + rand(-20, 20);
          let jy = spot.y + (Math.floor(i / 4) % 2 ? 150 : -150) + rand(-20, 20);
          /* The park holds a hundred and twelve hulls bumper to bumper. A live tank that
           * spawns inside a rank of parked ones digs in and never moves, which is exactly
           * why an alerted base could look empty. It starts on the nearest clear lane. */
          if (!this.routes.clear({ x: jx, y: jy })) {
            const lane = this.routes.nearest({ x: jx, y: jy });
            jx = lane.x; jy = lane.y;
          }
          const post = flyingThreat
            ? this.airDefencePost(jx, jy, a)
            : { x: clamp(this.px - Math.cos(ang) * 360, 300, ARENA_W - 300),
                y: clamp(this.py - Math.sin(ang) * 360, 300, ARENA_H - 300) };
          this.tanks.push({
            x: jx, y: jy,
            goalX: post.x, goalY: post.y,
            ang, turret: ang, lean: 0,
            hp: 1900, maxHp: 1900, speed: 0,
            cool: rand(1.4, 3.4), dead: false, announced: true, captured: false,
            ttl: 420, id: this.tankSeq++,
          });
        }
        this.addText(this.px, this.py - 120,
          `ARMOURED BATTALION · ${batch} HULLS ROLLING OUT`, '#ffb0b0', 17);
        this.shocks.push({ x: a.base.x + a.base.w / 2, y: a.base.y + 900, r: 40, max: 320, life: 0.5, t: 0.5, color: '255,190,140', width: 6 });
        sfx.rotor();
      }
    }

    this.updateArmyTurrets(dt);
  }

  /**
   * Where a hull from the park should sit to shoot at the sky: a ring of posts around the
   * airfield and the parade ground, on dry ground, spread out so the battalion reads as a
   * deployed force rather than a traffic jam.
   */
  private airDefencePost(fx: number, fy: number, a: ArmyPlan) {
    const cx = a.base.x + a.base.w / 2, cy = a.base.y + a.base.h / 2;
    for (let i = 0; i < 10; i++) {
      const ang = (this.armyTankSent * 0.7 + i * 0.63) % TAU;
      const r = 700 + ((this.armyTankSent + i) % 5) * 260;
      const x = clamp(cx + Math.cos(ang) * r * 1.5, a.base.x + 120, a.base.x + a.base.w - 120);
      const y = clamp(cy + Math.sin(ang) * r, a.base.y + 120, a.base.y + a.base.h - 120);
      if (this.onDryGround(x, y) && !this.pointBlocked(x, y)) return { x, y };
    }
    return { x: fx, y: fy };
  }

  /** Jets, missiles in flight and the air-defence response. Runs in every sector. */
  private updateAirCombat(dt: number) {
    this.updateArmyJets(dt);
    this.updateJetMissiles(dt);
    this.updateJetRockets(dt);
    this.updateLanceBeams(dt);
    this.updateAirResponse(dt);
  }

  /** Salvo rockets: fast, unguided, and they take a chunk of ground with them. */
  private updateJetRockets(dt: number) {
    for (let i = this.jetRockets.length - 1; i >= 0; i--) {
      const r = this.jetRockets[i];
      r.life -= dt;
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (Math.random() < 0.8) {
        this.addParticle(r.x, r.y, rand(-14, 14), rand(-14, 14), 0.3, rand(2, 4), '#ffd2a0', true);
      }
      let hit = false;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.spawnT > 0 || e.def.civilian) continue;
        if (Math.hypot(e.x - r.x, e.y - r.y) < 40) { this.hurtEnemy(e, r.dmg); hit = true; break; }
      }
      if (!hit) for (const t of this.tanks) {
        if (t.dead || t.captured) continue;
        if (Math.hypot(t.x - r.x, t.y - r.y) < 60) { t.hp -= r.dmg; hit = true; break; }
      }
      if (!hit) for (const t of this.armyTurrets) {
        if (t.owner === 'player') continue;
        if (Math.hypot(t.x - r.x, t.y - r.y) < 52) { t.hp -= r.dmg; hit = true; break; }
      }
      if (!hit) for (const o of this.armyJets) {
        if (o.manned || o.state === 'parked' || o.hp <= 0) continue;
        if (Math.hypot(o.x - r.x, o.y - r.y) < 80) { o.hp -= r.dmg; hit = true; if (o.hp <= 0) this.downJet(o, 'ROCKETS'); break; }
      }
      if (hit || r.life <= 0) {
        this.explode(r.x, r.y, 120, r.dmg * 0.45, true);
        this.jetRockets.splice(i, 1);
      }
    }
  }

  /** Lance beams burn for a fraction of a second — the damage is applied on the shot. */
  private updateLanceBeams(dt: number) {
    for (let i = this.lanceBeams.length - 1; i >= 0; i--) {
      this.lanceBeams[i].life -= dt;
      if (this.lanceBeams[i].life <= 0) this.lanceBeams.splice(i, 1);
    }
  }

  /**
   * An enemy fighter goes down. Losing one is worth real points, it is announced, and the
   * wreck falls out of the sky instead of simply disappearing.
   */
  private downJet(j: ArmyJet, cause: string) {
    /* A shot-down airframe is a WRECK, not a parked aircraft. It burns where it fell, it
     * cannot be boarded, it cannot be re-armed and it never flies again: the wing is one
     * airframe smaller for the rest of the run. */
    j.hp = 0; j.state = 'wreck' as ArmyJet['state']; j.alt = 0; j.speed = 0;
    j.wreck = true; j.wreckT = 0; j.manned = false; j.ready = false;
    if (this.launch?.jet === j) this.abortTakeoff('THE AIRFRAME WAS DESTROYED ON THE APRON');
    const worth = j.ace ? 4200 : j.hunter ? 1800 : 1400;
    this.score += worth;
    this.explode(j.x, j.y, 220, 90, true);
    for (let i = 0; i < 3; i++) {
      this.addParticle(j.x, j.y, rand(-120, 120), rand(-120, 120), rand(0.5, 1.1), rand(3, 7), i ? '#ffb27a' : '#fff0c0', true);
    }
    this.shocks.push({ x: j.x, y: j.y, r: 12, max: 240, life: 0.5, t: 0.5, color: '255,220,170', width: 6 });
    this.addText(j.x, j.y - 70, j.ace ? 'ACE DOWN' : 'SPLASH ONE', j.ace ? '#ffe0a0' : '#ffd8a8', j.ace ? 20 : 16);
    this.addText(j.x, j.y - 48, `${cause} · +${worth}`, '#ffd8a8', 12);
    this.flash = Math.max(this.flash, 0.22); this.flashColor = '255,220,170';
    this.hitstop = Math.max(this.hitstop, 0.05);
    sfx.wave();
  }

  /**
   * Base traffic. Vehicles hold their spacing in a convoy, brake for the operative and
   * for each other, and go round their circuit all day whether anyone is watching or not.
   */
  /**
   * A vehicle stops being a vehicle: the hull is lost, the wreck burns for a while, and the
   * blast it makes is real. Everything that can damage traffic funnels through here.
   */
  private wreckRoadCar(c: RoadCar) {
    if (c.dead) return;
    c.dead = true; c.burning = 26; c.panic = 0;
    this.score += 120;
    this.explode(c.x, c.y, 74, 0, true);
    this.addText(c.x, c.y - 60, 'VEHICLE LOST', '#ffb08a', 13);
  }

  private updateTraffic(dt: number) {
    for (const c of this.roadCars) {
      if (c.dead) {
        // A burning wreck keeps smoking for a while, then just sits there.
        if (c.burning > 0) {
          c.burning -= dt;
          if (Math.random() < 0.35) {
            this.addParticle(c.x + rand(-16, 16), c.y + rand(-10, 10),
              rand(-14, 14), rand(-46, -18), rand(1.1, 2.2), rand(3, 7), 'rgba(60,56,50,0.5)', true);
          }
          if (c.burning < 16 && Math.random() < 0.12) {
            this.addParticle(c.x + rand(-10, 10), c.y + rand(-8, 8),
              rand(-8, 8), rand(-30, -12), rand(0.4, 0.9), rand(2, 5), 'rgba(255,150,70,0.55)', true);
          }
        }
        continue;
      }
      c.light += dt;
      if (c.panic > 0) c.panic = Math.max(0, c.panic - dt);
      const node = c.route[c.node % c.route.length];
      const dx = node.x - c.x, dy = node.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      let want = Math.atan2(dy, dx);
      // Steer around whatever is standing in the carriageway: the operative, a wreck, a
      // crate someone dragged onto the tarmac. Two probes, one each side, pick the freer wing.
      const ahead = (dist: number, side: number) => {
        const a = c.ang + side;
        return { x: c.x + Math.cos(a) * dist, y: c.y + Math.sin(a) * dist };
      };
      let obstruction = 0;
      for (const dist of [64, 108]) {
        const p = ahead(dist, 0);
        if (this.pointBlocked(p.x, p.y)) obstruction = Math.max(obstruction, dist);
      }
      /* The car in front is an obstruction too, but a temporary one. Two drivers who stop
       * for each other used to lock the district solid: every car matched the stationary
       * leader's zero, and because the fleet is spread around a closed circuit *every* car
       * has a leader, so the ring never unwound. A driver now waits a beat and then squeezes
       * past down the freer side of the lane, which is what actually happens on a base road
       * when someone stops in it. */
      let leaderGap = Infinity, leaderSpeed = 0;
      for (const o of this.roadCars) {
        if (o === c || o.dead || o.route !== c.route) continue;
        const gap = Math.cos(c.ang) * (o.x - c.x) + Math.sin(c.ang) * (o.y - c.y);
        if (gap <= 0 || gap > 190) continue;
        if (Math.abs(Math.sin(c.ang) * (o.x - c.x) - Math.cos(c.ang) * (o.y - c.y)) >= 44) continue;
        if (gap < leaderGap) { leaderGap = gap; leaderSpeed = o.speed; }
      }
      /* Two bodies that already overlap (a car that pulled out into a queue, a wreck that
       * slid into one) must not hold each other still for ever: inside 30 m the leader is
       * treated as history, so both drive on and simply separate. */
      if (leaderGap < 30) { leaderGap = Infinity; leaderSpeed = 0; }
      const queue = leaderGap < 140 && leaderSpeed < 14;
      if (queue && leaderGap < 70) obstruction = Math.max(obstruction, 64);
      if (obstruction) {
        c.jammed += dt * (queue ? 1.6 : 1);
        const leftClear = !this.pointBlocked(ahead(96, -0.65).x, ahead(96, -0.65).y);
        const rightClear = !this.pointBlocked(ahead(96, 0.65).x, ahead(96, 0.65).y);
        if (leftClear && !rightClear) want = c.ang - 0.75;
        else if (rightClear && !leftClear) want = c.ang + 0.75;
        else if (leftClear) want = c.ang - 0.45;
      } else if (c.jammed > 0) c.jammed = Math.max(0, c.jammed - dt * 2);
      const turn = ((want - c.ang + Math.PI * 3) % TAU) - Math.PI;
      c.ang += clamp(turn, -1.6 * dt, 1.6 * dt);
      let blocked = c.wait > 0;
      if (leaderGap < 42) blocked = true;
      // and never drive through the operative
      const toPlayer = Math.cos(c.ang) * (this.px - c.x) + Math.sin(c.ang) * (this.py - c.y);
      if (toPlayer > 0 && toPlayer < 72 && Math.abs(Math.sin(c.ang) * (this.px - c.x) - Math.cos(c.ang) * (this.py - c.y)) < 46) blocked = true;
      /* Throttle and brakes, not a multiplier. Every corner used to multiply a car's speed by
       * up to 0.4 and every blockage set it to zero for good, so two turns into a lap the
       * district's traffic was crawling, and a car the operative once stepped in front of
       * never moved again. A driver now aims at the speed they actually want to hold, sheds
       * a little for a tight corner and winds it back on once the road is clear. */
      let desired = c.cruise * (1 - Math.min(0.25, Math.abs(turn) * 0.5));
      if (obstruction) {
        // creep around a stricken vehicle only once the wheel is actually turned aside
        desired = Math.min(desired, clamp((Math.abs(turn) - 0.12) * 240, 0, 46));
      }
      if (!queue && leaderGap < Infinity && leaderGap < 44 + c.speed * 0.85) {
        const closing = clamp((leaderGap - 42) / Math.max(1, c.speed * 0.85), 0, 1);
        desired = Math.min(desired, leaderSpeed * (0.5 + 0.5 * closing));
      }
      if (blocked || c.panic > 0) desired = 0;
      if (desired < 0) desired = 0;
      if (c.wait > 0) c.wait -= dt;
      if (this.roadDebug) this.roadDebug(c, { desired, blocked, obstruction, leaderGap, leaderSpeed, turn, wait: c.wait, panic: c.panic });
      const rate = desired < c.speed ? 420 : 150;
      c.speed += clamp(desired - c.speed, -rate * dt, rate * dt);
      if (c.speed < 0.6) c.speed = 0;
      c.brake = lerp(c.brake, desired < c.speed - 4 || c.speed === 0 ? 1 : 0, Math.min(1, dt * 6));
      c.lean = lerp(c.lean, clamp(turn * 0.9, -0.4, 0.4), Math.min(1, dt * 5));
      const speed = c.speed;
      if (speed > 0) {
        c.x += Math.cos(c.ang) * speed * dt;
        c.y += Math.sin(c.ang) * speed * dt;
        // dust off the shoulder: the district is gravel beside the tarmac
        if (Math.random() < 0.3) {
          this.addParticle(c.x - Math.cos(c.ang) * 30, c.y - Math.sin(c.ang) * 30,
            rand(-10, 10) - Math.cos(c.ang) * 14, rand(-10, 10) - Math.sin(c.ang) * 14,
            0.6, rand(2, 5), 'rgba(136,132,116,0.45)', true);
        }
      }
      /* A jammed car reverses out and takes the other lane. It used to be teleported
       * 46 m backwards in one frame, which read as a glitch rather than as driving; now it
       * rolls back over about a second, wheel by wheel. */
      if (c.jammed > 2.2) {
        c.reversing = 0.9;
        c.jammed = 0;
        c.steerBias = (Math.random() < 0.5 ? -1 : 1) * 0.55;
      }
      if ((c.reversing ?? 0) > 0) {
        c.reversing = Math.max(0, (c.reversing ?? 0) - dt);
        c.x -= Math.cos(c.ang) * 34 * dt;
        c.y -= Math.sin(c.ang) * 34 * dt;
        c.ang += (c.steerBias ?? 0) * dt;
        c.brake = 1;
      }
      if (d < 60) c.node = (c.node + 1) % c.route.length;
      // a hit base scatters the traffic
      if (this.armyAlerted && this.sector >= 6 && Math.hypot(c.x - this.px, c.y - this.py) < 320) {
        c.speed = Math.max(c.speed, 110);
      }
    }
  }

  /** The garrison's day: PT, shift changes, siren tests, convoy drills, lift operations. */
  private updateRoutines(dt: number) {
    for (let i = this.routines.length - 1; i >= 0; i--) {
      const r = this.routines[i];
      r.t += dt;
      if (r.t > r.dur) this.routines.splice(i, 1);
    }
    if (this.status !== 'playing') return;
    this.routineT -= dt;
    if (this.routineT > 0) return;
    this.routineT = rand(14, 24);
    const a = this.army;
    const kinds: ArmyRoutine['kind'][] = a
      ? ['pt', 'fuel', 'shift', 'muster', 'siren', 'drill', 'crane', 'wash', 'k9', 'colors']
      : ['pt', 'shift', 'drill', 'muster', 'wash', 'k9'];
    const kind = kinds[this.routineSeq++ % kinds.length];
    /* Routines happen in the open, not inside a building: pick a point on the nearest
     * stretch of road to the operative, so the scene is always something he can walk up to
     * and watch rather than a pantomime playing out inside a hangar wall. */
    const spot = (): { x: number; y: number } => {
      const roads = this.zones.filter((z) => z.kind === 'road' && Math.max(z.w, z.h) > 500);
      let best: { x: number; y: number } | null = null, bestD = Infinity;
      for (const z of roads) {
        const horizontal = z.w >= z.h;
        for (let t = 0.15; t <= 0.85; t += 0.14) {
          const x = horizontal ? z.x + z.w * t : z.x + z.w / 2;
          const y = horizontal ? z.y + z.h / 2 : z.y + z.h * t;
          const d = Math.hypot(x - this.px, y - this.py);
          if (d < 260 || d > 2200) continue;
          if (d < bestD) { bestD = d; best = { x, y }; }
        }
      }
      if (best) {
        // step off the carriageway so the parade/drill never blocks the traffic lane
        const jitter = rand(-80, 80);
        return { x: best.x + jitter, y: best.y + rand(-70, 70) };
      }
      if (a) {
        const sp = a.strongpoints[(this.routineSeq * 3) % a.strongpoints.length];
        return { x: sp.x + sp.w / 2, y: sp.y + sp.h / 2 };
      }
      return { x: this.px + rand(-900, 900), y: this.py + rand(-700, 700) };
    };
    const { x, y } = spot();
    const label = kind === 'pt' ? 'MORNING PT'
      : kind === 'shift' ? 'SHIFT CHANGE'
        : kind === 'siren' ? 'AIR-RAID SIREN TEST'
          : kind === 'drill' ? 'CONVOY DRILL'
            : kind === 'crane' ? 'LIFT OPERATION'
              : kind === 'fuel' ? 'REFUELLING'
                : kind === 'muster' ? 'ROLL CALL'
                  : kind === 'wash' ? 'WASH-DOWN'
                    : kind === 'k9' ? 'K9 SWEEP' : 'COLOURS';
    this.routines.push({
      kind, x, y, t: 0, dur: kind === 'siren' ? 7 : kind === 'muster' ? 16 : 22, label,
    });
    if (kind === 'siren') {
      this.addText(x, y - 120, '⚠ SIREN TEST — STAND BY', '#ffd166', 15);
      if (this.sector >= 6 && this.armyAlerted) sfx.wave();
    }
  }

  /** Wake the nearest sleeping ranks. Returns how many stood up. */
  private wakeArmyRanks(n: number) {
    const sleeping: Enemy[] = [];
    for (const e of this.enemies) if (e.dormant && e.hp > 0) sleeping.push(e);
    if (!sleeping.length) { this.armyDormant = 0; return 0; }
    sleeping.sort((p, q) =>
      (p.x - this.px) ** 2 + (p.y - this.py) ** 2 - ((q.x - this.px) ** 2 + (q.y - this.py) ** 2));
    const take = Math.min(n, sleeping.length);
    for (let i = 0; i < take; i++) {
      const e = sleeping[i];
      e.dormant = false;
      e.alert = true;
      e.garrison = false;
      e.cool = rand(0.2, 1.4);
      e.ang = Math.atan2(this.py - e.y, this.px - e.x);
    }
    this.armyDormant = sleeping.length - take;
    return take;
  }

  /** Send up the base's aircraft: a fast jet, and a gunship until the apron is empty. */
  /* ---------------- the air answers back ---------------- *
   * Bomb something from an aircraft and the sky stops being a private road. The heat keeps
   * rising for as long as the operative keeps bombing, and every wave brings more fighters,
   * closer together, until the airspace is genuinely contested. Flares are the answer to the
   * rockets: a burning flare cloud spoofs every seeker in range.
   */

  /** Called whenever the operative's aircraft puts ordnance on the ground. */
  provokeAirResponse(amount = 1) {
    if (this.status !== 'playing') return;
    if (!this.playerJet && !this.flyingPlane) return;
    this.airResponseHeat = Math.min(14, this.airResponseHeat + amount);
    this.airResponse = Math.max(this.airResponse, 55);
    if (this.airResponseT <= 0) this.airResponseT = 1.4;
    if (this.airResponseWave === 0) {
      this.setBanner('AIR RESPONSE', 'THEY SAW THE BOMBS — INTERCEPTORS SCRAMBLING');
      this.addText(this.px, this.py - 110, 'AIR DEFENCE ALERTED', '#ffb08a', 17);
      sfx.rotor();
    }
  }

  private hunterCount() {
    let n = 0;
    for (const j of this.armyJets) if (j.hunter && j.state !== 'parked' && !j.wreck && j.hp > 0) n++;
    return n;
  }

  private scrambleWave() {
    const heat = this.airResponseHeat;
    this.airResponseWave++;
    const want = clamp(1 + Math.round(heat * 0.55), 2, 5);
    let sent = 0;
    /* FIRST THE WING THAT IS ALREADY ON THE FIELD. Every parked, serviceable airframe on
     * the apron is a real aircraft with a real pilot: it launches from where it stands.
     * Nothing appears in the sky out of an empty hangar. */
    for (const j of this.armyJets) {
      if (sent >= want || this.hunterCount() >= 6) break;
      if (j.wreck || j.manned || j.hunter || j.state !== 'parked' || j.hp <= 0) continue;
      j.hunter = true;
      j.state = 'launch'; j.alt = 0; j.speed = 0; j.t = 0;
      j.ang = Math.atan2(this.py - j.y, this.px - j.x);
      j.rockets = (j.tier === 'prototype' ? 4 : 2) + Math.round(heat * 0.4);
      j.ready = true;
      this.addText(j.x, j.y - 80, `${this.airframeSerial(j)} SCRAMBLED`, '#ffb08a', 13);
      sent++;
    }
    /* THEN THE RESERVE. The squadron's own field is off the map, so reinforcements fly in
     * from the boundary — but only while there are airframes left in the reserve. When the
     * reserve is spent, the air defence is spent, and it says so. */
    for (let i = sent; i < want; i++) {
      if (this.hunterCount() >= 6) break;
      if (this.airReserve <= 0) {
        if (!this.airReserveSpent) {
          this.airReserveSpent = true;
          this.setBanner('AIR DEFENCE SPENT', 'NO AIRFRAMES LEFT IN THE SQUADRON RESERVE');
          this.addText(this.px, this.py - 110, 'THAT WAS THE LAST INTERCEPTOR THEY HAD', '#ffd166', 14);
        }
        break;
      }
      // They come from the edge of the map, not from the apron, so the fight starts in the sky.
      const a = rand(0, TAU);
      const x = clamp(this.px + Math.cos(a) * rand(1900, 2700), 400, ARENA_W - 400);
      const y = clamp(this.py + Math.sin(a) * rand(1900, 2700), 400, ARENA_H - 400);
      // Every third wave the squadron sends its ace: a heavier, gold-trimmed airframe that
      // turns harder, shoots straighter and carries two more missiles.
      const isAce = this.airResponseWave % 3 === 0 && i === 0 && !this.armyJets.some((q) => q.ace && q.hp > 0);
      this.armyJets.push({
        x, y, ang: Math.atan2(this.py - y, this.px - x),
        hp: isAce ? 900 : 480, maxHp: isAce ? 900 : 480, state: 'attack', alt: 340, speed: 580,
        cool: rand(0.5, 1.6), t: 0, hunter: true, ace: isAce,
        rockets: (isAce ? 4 : 2) + Math.round(heat * 0.4),
      });
      if (isAce) this.addText(x, y - 80, 'SQUADRON ACE AIRBORNE', '#ffe0a0', 17);
      this.airReserve--;
      sent++;
    }
    if (sent > 0) {
      this.setBanner('AIR RESPONSE', `${sent} INTERCEPTOR${sent === 1 ? '' : 'S'} ON YOUR SIX — FLARES SPOOF THEIR ROCKETS`);
      this.addText(this.px, this.py - 110, `WAVE ${this.airResponseWave} · ${sent} HUNTERS INBOUND`, '#ff9d9d', 17);
      sfx.rotor();
    }
  }

  private updateAirResponse(dt: number) {
    this.jetFlareT = Math.max(0, this.jetFlareT - dt);
    // Hunters are there to fight an aircraft. Once the operative is on the ground they
    // break off and go home rather than strafing a man in the mud.
    if (this.playerJet || this.flyingPlane) this.airResponseIdle = 0;
    else this.airResponseIdle += dt;
    if (this.airResponseIdle > 6) {
      this.airResponse = 0;
      this.airResponseHeat = 0;
      this.airResponseWave = 0;
      this.enemyRockets = [];
      const before = this.armyJets.length;
      this.armyJets = this.armyJets.filter((j) => !j.hunter);
      if (this.armyJets.length !== before) this.addText(this.px, this.py - 90, 'HUNTERS BREAKING OFF', '#a9ecff', 14);
      this.airResponseIdle = 0;
    }
    this.updateEnemyRockets(dt);
    if (this.airResponseHeat > 0) this.airResponseHeat = Math.max(0, this.airResponseHeat - dt * 0.2);
    if (this.airResponse > 0) {
      this.airResponse -= dt;
      this.airResponseT -= dt;
      if (this.airResponseT <= 0) {
        // The hotter it gets, the shorter the breather between waves.
        this.airResponseT = clamp(18 - this.airResponseHeat, 5, 18);
        this.scrambleWave();
      }
    } else if (this.airResponseHeat <= 0.01 && this.airResponseWave > 0) {
      // Heat has bled off: the standing patrol goes home and the sky is quiet again.
      this.airResponseWave = 0;
      this.armyJets = this.armyJets.filter((j) => !j.hunter);
      this.enemyRockets = [];
      if (this.playerJet || this.flyingPlane) this.addText(this.px, this.py - 100, 'AIR DEFENCE STANDS DOWN', '#a9ecff', 14);
    }
    // A hunter that has been shot down leaves the board for good.
    this.armyJets = this.armyJets.filter((j) => !(j.hunter && (j.state === 'parked' || j.hp <= 0)));
  }

  /** Hostile air-to-air rockets: they home, they hurt, and flares break their lock. */
  private updateEnemyRockets(dt: number) {
    for (let i = this.enemyRockets.length - 1; i >= 0; i--) {
      const r = this.enemyRockets[i];
      r.life -= dt;
      if (r.spooked > 0) r.spooked -= dt;
      const tx = this.px, ty = this.py;
      if (r.spooked <= 0) {
        const cur = Math.atan2(r.vy, r.vx);
        // Lead the target: aim where the aircraft will be when the rocket gets there.
        const spd = Math.min(1650, Math.hypot(r.vx, r.vy) + dt * 420);
        const flight = Math.hypot(tx - r.x, ty - r.y) / Math.max(200, spd);
        const lx = tx + this.pvx * flight * 0.7, ly = ty + this.pvy * flight * 0.7;
        let d = Math.atan2(ly - r.y, lx - r.x) - cur;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = cur + clamp(d, -2.6 * dt, 2.6 * dt);
        r.vx = Math.cos(na) * spd; r.vy = Math.sin(na) * spd;
      }
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (Math.random() < 0.85)
        this.addParticle(r.x - r.vx * 0.012, r.y - r.vy * 0.012,
          rand(-16, 16), rand(-16, 16), rand(0.3, 0.7), rand(2, 5),
          r.spooked > 0 ? '#8fa0a8' : '#ffd8a0', true);
      const reach = this.playerJet ? 96 : this.flyingPlane ? 130 : 44;
      const hit = r.spooked <= 0 && Math.hypot(r.x - tx, r.y - ty) < reach;
      if (hit) {
        this.damagePlayer(r.dmg, r.x, r.y);
        this.explode(r.x, r.y, 150, 0, true);
        this.addText(tx, ty - 70, 'MISSILE HIT', '#ff9d9d', 14);
        this.enemyRockets.splice(i, 1);
        continue;
      }
      if (r.life <= 0) {
        this.explode(r.x, r.y, 120, 0, false);
        this.enemyRockets.splice(i, 1);
      }
    }
  }

  private launchArmyAir() {
    // The sky belongs to one aircraft at a time. While the operative is flying a seized
    // interceptor, the army keeps everything else on the apron.
    if (this.playerJet && this.airResponse <= 0) return;
    /* The airframe the operative is currently walking out to, strapping into or taxiing is
     * NOT available to the wing. It used to be launched out from under the pilot. */
    const jet = this.armyJets.find((j) => j.state === 'parked' && !j.manned && !j.hunter
      && !j.wreck && j.hp > 0 && j !== this.launch?.jet && !j.ready);
    if (jet) {
      jet.state = 'launch';
      jet.alt = 40; jet.speed = 260; jet.t = 0; jet.cool = 1.2;
      this.addText(jet.x, jet.y - 60, 'JET SCRAMBLE', '#ffd8a0', 16);
      sfx.rotor();
    }
    if (this.helis.length < 7) {
      const pad = this.army?.helis[(this.armyWaves + this.helis.length) % Math.max(1, this.army.helis.length)];
      const h: Heli = {
        x: pad ? pad.x : this.px + rand(-900, 900),
        y: pad ? pad.y : this.py + rand(-900, 900),
        tx: this.px, ty: this.py, ang: rand(0, TAU), rotor: 0,
        state: 'startup', hp: 300, maxHp: 300, cool: 1.5, rocketCd: 3, t: 0,
        orbitA: rand(0, TAU), medevac: false, carrying: 0, announced: true, bank: 0,
        altitude: 0,
      };
      this.helis.push(h);
      this.addText(h.x, h.y - 70, 'ATTACK HELICOPTER INBOUND', '#ffb0b0', 15);
    }
  }

  private updateArmyTurrets(dt: number) {
    for (const t of this.armyTurrets) {
      t.cool -= dt;
      t.gap -= dt;
      t.flash = Math.max(0, t.flash - dt);
      t.muzzle = Math.max(0, t.muzzle - dt * 6);
      const hostile = t.owner === 'enemy';
      // Who is it shooting at, and where will that thing be when the rounds arrive?
      let tx = 0, ty = 0, has = false, range = 0, vx = 0, vy = 0;
      if (hostile) {
        if (!this.armyAlerted && Math.hypot(this.px - t.x, this.py - t.y) > 620) { t.rounds = 0; continue; }
        tx = this.px; ty = this.py; vx = this.pvx; vy = this.pvy; has = true;
        range = t.heavy ? 1900 : 1450;
      } else {
        let bd = 1650;
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.spawnT > 0 || e.def.civilian) continue;
          const d = Math.hypot(e.x - t.x, e.y - t.y);
          if (d < bd) { bd = d; tx = e.x; ty = e.y; vx = e.vx; vy = e.vy; has = true; }
        }
        range = 1650;
      }
      if (!has) { t.rounds = 0; continue; }
      const d = Math.hypot(tx - t.x, ty - t.y);
      if (d > range) { t.rounds = 0; continue; }
      /* DEAD ZONE. The barrels are 44 m long and the pit is 40 m across: a target standing
       * on top of the emplacement is inside the mount, not in front of it. The old code
       * happily swung the guns round and fired, which read on screen as the turret shooting
       * itself. Inside 150 m the crew holds fire. */
      if (d < 150) { t.rounds = 0; continue; }
      // Lead the target: an emplacement that fires at where you *are* can never hit a jet.
      const flight = d / 1520;
      const want = Math.atan2(ty + vy * flight - t.y, tx + vx * flight - t.x);
      const turn = Math.max(-4.6 * dt, Math.min(4.6 * dt, ((want - t.ang + Math.PI * 3) % TAU) - Math.PI));
      t.ang += turn;
      const err = ((want - t.ang + Math.PI * 3) % TAU) - Math.PI;
      // A twin mount is on target well inside seven degrees. Anything looser and the crew
      // sprays the countryside — which is exactly what made these feel broken.
      if (Math.abs(err) > 0.12) { t.rounds = 0; continue; }
      // Burst fire: five or six rounds, then a beat to settle.
      if (t.rounds <= 0) {
        if (t.cool > 0) continue;
        t.rounds = t.heavy ? 6 : 5;
        t.gap = 0;
        t.cool = t.heavy ? 1.25 : 1.55;
      }
      if (t.gap > 0) continue;
      t.rounds--;
      t.gap = t.heavy ? 0.055 : 0.07;
      t.flash = 0.09;
      t.muzzle = 1;
      /* Rounds leave the barrel tips. They used to be born 44 m from the mount, which was
       * inside the 92 m bunker the emplacement was built out of — every burst detonated on
       * the pit's own wall a centimetre out of the barrel and the crew "shot itself". The
       * muzzle is now 64 m out and nothing solid stands in the arc in front of it. */
      const mx = t.x + Math.cos(t.ang) * 64, my = t.y + Math.sin(t.ang) * 64;
      /* THE PIT IS NOT A TARGET.
       *
       * A round that leaves the barrel 64 px from the mount, aimed at a man standing just
       * past the sandbags, will hit the sandbags — and on screen that reads as the gun
       * shooting its own emplacement, which is the report. Every round carries the identity
       * of the pit that fired it, and the bullet sweep is told to ignore those walls. The
       * crew still cannot fire inside 150 px (the dead zone), so the only rounds that can
       * come back to the pit are the ones that would have grazed its own parapet. */
      for (const side of [-1, 1]) {
        const a = t.ang + rand(-0.008, 0.008);
        const ox = Math.cos(t.ang + Math.PI / 2) * side * 11;
        const oy = Math.sin(t.ang + Math.PI / 2) * side * 11;
        this.bullets.push({
          x: mx + ox, y: my + oy, px: mx + ox, py: my + oy,
          vx: Math.cos(a) * 1520, vy: Math.sin(a) * 1520,
          dmg: hostile ? (t.heavy ? 11 : 8) : 20,
          life: 1.5, friendly: !hostile,
          color: hostile ? '#ffd08a' : '#c6f0ff', r: 3,
          hits: [], ownPit: t.pit,
        });
      }
      this.addLight(mx, my, 170, '255,210,150', 0.08);
      if (hostile) sfx.shoot('smg');
    }
  }

  /**
   * THE EDGE OF THE WORLD IS A WALL. Nothing flies out into empty space: an airframe that
   * reaches the boundary is stopped at it and turned back toward the arena. Returns true
   * when the wall had to do work, so the caller can say so on the HUD.
   */
  private keepInsideAirspace(j: { x: number; y: number; ang: number }, margin = 260) {
    let hit = false;
    if (j.x < margin) { j.x = margin; hit = true; }
    else if (j.x > ARENA_W - margin) { j.x = ARENA_W - margin; hit = true; }
    if (j.y < margin) { j.y = margin; hit = true; }
    else if (j.y > ARENA_H - margin) { j.y = ARENA_H - margin; hit = true; }
    if (!hit) return false;
    // Turn-back: aim at the middle of the arena and let the airframe come round.
    const back = Math.atan2(ARENA_H / 2 - j.y, ARENA_W / 2 - j.x);
    j.ang = lerpAngle(j.ang, back, 0.16);
    return true;
  }

  private updateArmyJets(dt: number) {
    for (const j of this.armyJets) {
      if (j.manned) continue;
      // A wreck stays a wreck: it does not launch, hunt, egress or come back.
      if (j.wreck || j.hp <= 0) { j.wreckT = (j.wreckT ?? 0) + dt; continue; }
      if (this.playerJet && !j.hunter && this.airResponse <= 0 && j.state !== 'parked') {
        j.state = 'parked'; j.alt = 0; j.speed = 0; continue;
      }
      if (j.state === 'parked') continue;
      j.t += dt;
      j.cool = Math.max(0, j.cool - dt);
      const dx = this.px - j.x, dy = this.py - j.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (j.state === 'launch') {
        j.alt = Math.min(360, j.alt + dt * 190);
        j.speed = Math.min(j.hunter ? 900 : 560, j.speed + dt * 220);
        j.x += Math.cos(j.ang) * j.speed * dt;
        j.y += Math.sin(j.ang) * j.speed * dt;
        if (j.alt >= 330) { j.state = 'attack'; j.t = 0; }
        continue;
      }
      if (j.state === 'egress') {
        j.speed = Math.min(720, j.speed + dt * 120);
        j.x += Math.cos(j.ang) * j.speed * dt;
        j.y += Math.sin(j.ang) * j.speed * dt;
        j.alt = Math.min(420, j.alt + dt * 60);
        // bank around and come back
        const want = Math.atan2(dy, dx);
        const turn = ((want - j.ang + Math.PI * 3) % TAU) - Math.PI;
        j.ang += Math.max(-1.5 * dt, Math.min(1.5 * dt, turn));
        if (j.t > 7) { j.state = 'attack'; j.t = 0; }
        continue;
      }
      // ATTACK: hold an altitude, close, fire, overshoot
      const cruiseAlt = j.hunter ? 300 : 340;
      // A hunter has the legs to run down a fleeing jet: fast on the ingress, slower in the fight.
      const cruiseSpd = j.hunter ? (dist > 900 ? 1180 : 780) : 520;
      j.alt = j.alt + (cruiseAlt - j.alt) * Math.min(1, dt * 2);
      j.speed = j.speed + (cruiseSpd - j.speed) * Math.min(1, dt * 2);
      const want = Math.atan2(dy, dx);
      const turn = ((want - j.ang + Math.PI * 3) % TAU) - Math.PI;
      j.ang += Math.max(-1.6 * dt, Math.min(1.6 * dt, turn));
      j.x += Math.cos(j.ang) * j.speed * dt;
      j.y += Math.sin(j.ang) * j.speed * dt;
      const aligned = Math.abs(turn) < 0.16;
      // A hunter has missiles as well as guns, and it uses them on an airborne operative.
      if (j.hunter && aligned && dist > 420 && dist < 2200 && j.cool <= 0 && (j.rockets ?? 0) > 0) {
        j.rockets = (j.rockets ?? 0) - 1;
        j.cool = j.ace ? 2.0 : 3.0;
        this.enemyRockets.push({
          x: j.x + Math.cos(j.ang) * 46, y: j.y + Math.sin(j.ang) * 46,
          vx: Math.cos(j.ang) * 980, vy: Math.sin(j.ang) * 980,
          life: 10, dmg: j.ace ? 30 : 22, spooked: 0,
        });
        // launch smoke and a very loud warning in the operative's cockpit
        for (let k = 0; k < 10; k++) {
          this.addParticle(j.x, j.y, rand(-60, 60), rand(-60, 60), rand(0.4, 0.9), rand(3, 6), '#e8e2d4', true);
        }
        if (this.playerJet) this.playerJet.rwr = 4.2;
        this.addText(j.x, j.y - 56, j.ace ? 'ACE · FOX TWO' : 'FOX TWO · INBOUND', '#ff9a7a', 14);
        if (this.playerJet) this.addText(this.px, this.py - 118, 'MISSILE INBOUND · FLARES', '#ff8a7a', 15);
        sfx.shoot('rocket');
      }
      // Gunnery is aimed where the aircraft is going to be, not where it is now.
      if (aligned && dist < 1500 && j.cool <= 0) {
        j.cool = j.ace ? 0.85 : 1.15;
        const lead = Math.min(0.9, dist / 1150);
        const tx = this.px + this.pvx * lead * 0.45, ty = this.py + this.pvy * lead * 0.45;
        const ga = Math.atan2(ty - j.y, tx - j.x);
        const burst = j.ace ? 4 : 3;
        for (let i = 0; i < burst; i++) {
          const spread = j.ace ? 0.012 : 0.03;
          const a = ga + rand(-spread, spread);
          this.bullets.push({
            x: j.x, y: j.y, px: j.x, py: j.y,
            vx: Math.cos(a) * 1250, vy: Math.sin(a) * 1250,
            dmg: j.ace ? 13 : 9, life: 1.4, friendly: false,
            color: j.ace ? '#ffe0a0' : '#ffe2a8', r: 3, hits: [],
          });
        }
        this.addLight(j.x, j.y, 220, '255,220,150', 0.1);
        sfx.shoot('smg');
      }
      // Defensive break: if the operative's nose is on this aircraft, it does not sit still.
      if (this.playerJet) {
        const pj = this.playerJet;
        const toMe = Math.atan2(j.y - pj.y, j.x - pj.x);
        let off = Math.atan2(Math.sin(toMe - pj.ang), Math.cos(toMe - pj.ang));
        if (Math.abs(off) < 0.35 && Math.hypot(j.x - pj.x, j.y - pj.y) < 900) {
          j.ang += (j.ace ? 2.4 : 2.0) * dt * (off > 0 ? 1 : -1);
          if (Math.random() < dt * 1.6) this.addParticle(j.x, j.y, rand(-40, 40), rand(-40, 40), 0.5, rand(3, 6), '#cfd8dd', true);
        }
      }
      if (dist < (j.hunter ? 190 : 320)) { j.state = 'egress'; j.t = 0; }
      if (j.t > (j.hunter ? 30 : 22)) { j.state = 'egress'; j.t = 0; }
    }
    // Nothing leaves the map. Every airframe that reached the wall is turned back inside it.
    for (const j of this.armyJets) {
      if (j.manned || j.wreck || j.state === 'parked') continue;
      this.keepInsideAirspace(j);
    }
  }

  /* ---------------- the seized interceptor ---------------- */

  /** A parked army jet within reach of the operative, if there is one. */
  private nearArmyJet(): ArmyJet | null {
    let best: ArmyJet | null = null, bd = 240;
    for (const j of this.armyJets) {
      if (j.manned || j.state !== 'parked' || j.wreck || j.hp <= 0) continue;
      const d = Math.hypot(j.x - this.px, j.y - this.py);
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }

  /**
   * F on a parked interceptor. This is an ORDER, not a teleport: everything between the
   * order and the wheels leaving the ground happens physically on the apron first, and
   * any broken link in that chain stops the take-off dead.
   */
  private seizeJet(j: ArmyJet) {
    if (j.wreck || j.hp <= 0) {
      this.addText(this.px, this.py - 60, 'AIRFRAME WRECKED — IT NEVER FLIES AGAIN', '#ff9d9d', 14);
      sfx.click();
      return;
    }
    if (this.launch) return;
    // Crewed and cleared earlier in this run: the chain has already been walked.
    if (j.ready) { this.boardJet(j); return; }
    this.orderTakeoff(j);
  }

  /**
   * The nearest hangar that is still standing, within reach of an airframe. Both kinds
   * count: the hangars on the airfield and the two cathedral-span megahangars the wing
   * actually lives in. No roof, no airframe, no take-off.
   */
  private hangarFor(j: ArmyJet): LaunchHangar | null {
    let best: LaunchHangar | null = null, bd = 1500;
    for (const h of this.hangars) {
      if (h.ruined) continue;
      const d = Math.hypot(h.doorX - j.x, h.doorY - j.y);
      if (d < bd) { bd = d; best = { x: h.x, y: h.y, w: h.w, h: h.h, doorX: h.doorX, doorY: h.doorY, ruined: false }; }
    }
    for (const o of this.obstacles) {
      if (o.dead || (o.kind !== 'hangar' && o.kind !== 'megahangar')) continue;
      const nx = clamp(j.x, o.x, o.x + o.w), ny = clamp(j.y, o.y, o.y + o.h);
      const d = Math.hypot(nx - j.x, ny - j.y);
      if (d < bd) { bd = d; best = { x: o.x, y: o.y, w: o.w, h: o.h, doorX: nx, doorY: ny, ruined: false, rect: o }; }
    }
    if (best) return best;
    /* A dispersal strip has no hangar: the crew comes out of the control tent beside the
     * airframes. The link is still a real structure with real people in it. */
    let tent: LaunchHangar | null = null, td = 900;
    for (const o of this.obstacles) {
      if (o.dead || o.kind !== 'tent') continue;
      const d = Math.hypot(o.x + o.w / 2 - j.x, o.y + o.h / 2 - j.y);
      if (d < td) { td = d; tent = { x: o.x, y: o.y, w: o.w, h: o.h, doorX: o.x + o.w / 2, doorY: o.y + o.h / 2, rect: o }; }
    }
    return tent;
  }

  /** Has the roof over this airframe stopped existing? */
  private hangarSmashed(h: LaunchHangar) {
    if (h.ruined) return true;
    const r = h.rect;
    if (!r) return false;
    return !!r.dead || (typeof r.hp === 'number' && r.hp <= 0);
  }

  /** Where a runway centreline comes closest to this airframe (null if there is none). */
  private nearestRunwayPoint(x: number, y: number, reach = 2600): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bd = reach;
    for (const z of this.zones) {
      if (z.kind !== 'runway') continue;
      const cy = z.y + z.h / 2;
      const cx = clamp(x, z.x + 120, z.x + z.w - 120);
      const d = Math.hypot(cx - x, cy - y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    return best;
  }

  /**
   * CAUSE 1: the player orders a take-off. Everything that follows is a consequence of
   * this one order — and every link is visible on the ground.
   */
  private orderTakeoff(j: ArmyJet) {
    const hangar = this.hangarFor(j);
    // The glacier airframe is the one aircraft in the game with no hangar behind it: it was
    // buried in the ice, and it comes out of a sealed bay rather than a hall.
    const glacier = j.tier === 'frostwing';
    if (!hangar && !glacier) {
      this.setBanner('NO GROUND SUPPORT', 'NO INTACT HANGAR HOLDS THIS AIRFRAME — IT CANNOT BE CREWED');
      this.addText(j.x, j.y - 96, 'NO HANGAR · NO CREW · NO TAKE-OFF', '#ff9d9d', 14);
      sfx.click();
      return;
    }
    const runway = this.nearestRunwayPoint(j.x, j.y);
    const taxiX = runway ? runway.x : j.x + Math.cos(j.ang) * 620;
    const taxiY = runway ? runway.y : j.y + Math.sin(j.ang) * 620;
    const rollX = runway ? clamp(taxiX + Math.cos(0) * 1400, 200, ARENA_W - 200) : taxiX + Math.cos(j.ang) * 1400;
    const rollY = runway ? runway.y : taxiY + Math.sin(j.ang) * 1400;
    this.launch = {
      jet: j, phase: 'walk', t: 0,
      fromX: this.px, fromY: this.py,
      taxiX, taxiY, rollX, rollY,
      hangar, serial: this.airframeSerial(j),
    };
    // Ground crew come out of the hangar door with the pilot's helmet and the tow bar.
    this.launchCrew = [];
    const door = hangar ? { x: hangar.doorX, y: hangar.doorY } : { x: j.x - 180, y: j.y + 120 };
    for (let i = 0; i < 3; i++) {
      this.launchCrew.push({
        x: door.x + rand(-30, 30), y: door.y + rand(-30, 30),
        tx: j.x + Math.cos(j.ang + Math.PI) * 40 + rand(-40, 40),
        ty: j.y + Math.sin(j.ang + Math.PI) * 40 + rand(-40, 40),
        t: 0, kind: i === 0 ? 'pilot' : 'crew',
      });
    }
    this.setBanner('TAKE-OFF ORDER', hangar
      ? `CREW MUSTERS AT HANGAR · ${this.launch.serial}`
      : 'SEALED BAY OPEN — CREW TO THE ICE AIRFRAME');
    this.addText(j.x, j.y - 100, 'CHAIN: CREW → BOARD → TAXI → ROLL → AIRBORNE', '#a9ecff', 13);
    sfx.click();
  }

  /** Airframe serials are per run and per hull: a lost airframe's number is never reissued. */
  private airframeSerial(j: ArmyJet) {
    if (!j.serial) {
      const used = this.armyJets.filter((o) => o.serial).length + 1;
      j.serial = `${j.tier === 'prototype' ? 'XP' : j.tier === 'frostwing' ? 'FW' : 'LN'}-${String(100 + used).slice(-3)}`;
    }
    return j.serial;
  }

  /**
   * The chain, one link per frame. Each link has to finish before the next opens, and the
   * whole thing is void if the hangar behind the aircraft stops existing.
   */
  private updateTakeoffChain(dt: number) {
    const L = this.launch;
    if (!L) return;
    const j = L.jet;
    // ---- THE LINK THAT BREAKS EVERYTHING ----
    if (j.wreck || j.hp <= 0) { this.abortTakeoff('THE AIRFRAME IS DESTROYED'); return; }
    if (L.hangar && this.hangarSmashed(L.hangar)) {
      this.abortTakeoff('THE HANGAR IS GONE — NO CREW, NO CLEARANCE');
      return;
    }
    if (this.status !== 'playing' || this.hp <= 0) { this.abortTakeoff('ORDER CANCELLED'); return; }
    L.t += dt;

    // ---- crew walking out of the hangar, always, whatever the player is doing ----
    for (const c of this.launchCrew) {
      c.t += dt;
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      if (d > 8) {
        const sp = c.kind === 'pilot' ? 96 : 82;
        c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt;
      }
    }

    switch (L.phase) {
      case 'walk': {
        // CONSEQUENCE 1: the pilot crosses the apron on foot.
        const cx = j.x + Math.cos(j.ang) * 24, cy = j.y + Math.sin(j.ang) * 24;
        const dx = cx - this.px, dy = cy - this.py, d = Math.hypot(dx, dy);
        const sp = 250;
        if (d > 14) {
          this.px += (dx / d) * Math.min(sp * dt, d);
          this.py += (dy / d) * Math.min(sp * dt, d);
          this.pang = Math.atan2(dy, dx);
          this.launchStride += dt * 9;
        } else if (L.t > 1.4) {
          L.phase = 'board'; L.t = 0;
          this.addText(j.x, j.y - 84, 'PILOT IN THE COCKPIT · CANOPY DOWN', '#a9ecff', 13);
          sfx.click();
        }
        break;
      }
      case 'board': {
        // CONSEQUENCE 2: straps, canopy, crew under the wings. Then the aircraft is ours.
        if (L.t > 1.2) {
          L.phase = 'taxi'; L.t = 0;
          this.setBanner('CLEARED TO TAXI', `${this.launch?.serial ?? ''} · HOLD THE APRON — RUNWAY AHEAD`);
        }
        break;
      }
      case 'taxi': {
        // CONSEQUENCE 3: it rolls from the parking spot to the runway threshold.
        const dx = L.taxiX - j.x, dy = L.taxiY - j.y, d = Math.hypot(dx, dy);
        const want = d > 6 ? Math.atan2(dy, dx) : this.runwayHeading(L);
        j.ang = lerpAngle(j.ang, want, Math.min(1, dt * 3));
        j.speed = Math.min(110, j.speed + dt * 90);
        if (d > 6) {
          const step = Math.min(j.speed * dt, d);
          j.x += (dx / d) * step; j.y += (dy / d) * step;
        } else if (L.t > 0.9) {
          L.phase = 'roll'; L.t = 0;
          this.setBanner('TAKE-OFF ROLL', `${this.launch?.serial ?? ''} · BURNERS`);
          sfx.rotor();
        }
        break;
      }
      case 'roll': {
        // FINAL LINK: only now does it accelerate and leave the ground.
        const want = this.runwayHeading(L);
        j.ang = lerpAngle(j.ang, want, Math.min(1, dt * 2.2));
        j.speed = Math.min(420, j.speed + dt * 300);
        j.x += Math.cos(j.ang) * j.speed * dt;
        j.y += Math.sin(j.ang) * j.speed * dt;
        j.alt = Math.min(90, j.alt + dt * 40);
        if (j.speed > 330) {
          this.boardJet(j);
        }
        break;
      }
    }
    /* From the moment the canopy closes the operative IS the aircraft, so the camera and
     * the HUD follow the hull. During the walk the operative is still on their own feet. */
    if (L.phase === 'board' || L.phase === 'taxi' || L.phase === 'roll') {
      this.px = j.x; this.py = j.y;
      this.pang = j.ang;
    }
  }

  /** The direction the runway runs, so a take-off roll follows the tarmac. */
  private runwayHeading(L: NonNullable<Game['launch']>) {
    const dx = L.rollX - L.taxiX, dy = L.rollY - L.taxiY;
    if (Math.hypot(dx, dy) < 40) return L.jet.ang;
    return Math.atan2(dy, dx);
  }

  /** A broken link: the chain is void and the aircraft stays on the ground. */
  private abortTakeoff(why: string) {
    const L = this.launch;
    this.launch = null;
    this.launchCrew = [];
    if (!L) return;
    L.jet.ready = false;
    L.jet.speed = 0; L.jet.alt = 0; L.jet.state = 'parked';
    this.setBanner('TAKE-OFF ABORTED', why);
    this.addText(L.jet.x, L.jet.y - 90, `CHAIN BROKEN · ${why}`, '#ff9d9d', 14);
    sfx.hit();
  }

  /** Called when the chain is complete: from here the operative is the pilot. */
  private boardJet(j: ArmyJet) {
    this.launch = null;
    this.launchCrew = [];
    j.ready = true;
    this.playerJet = j;
    j.manned = true;
    j.alt = Math.max(j.alt, 0); j.speed = Math.max(j.speed, 120); j.boost = 0;
    j.mode = 'cannon'; j.flares = j.flares ?? 6; j.autopilot = false; j.lock = null;
    const ace = j.tier === 'prototype';
    const frost = j.tier === 'frostwing';
    /* THE LOADOUT.
     * Every airframe comes with a full war load the first time it is taken: wing
     * missiles, salvo rockets, and — on the two experimental machines — the lance.
     * Re-boarding does not restock, so a long sortie is a real decision.
     */
    if (j.missiles === undefined) j.missiles = ace ? 8 : frost ? 10 : 6;
    if (j.rocketsPlayer === undefined) j.rocketsPlayer = ace ? 16 : frost ? 16 : 12;
    if (j.lance === undefined) j.lance = ace || frost ? 4 : 0;
    j.heat = 0; j.jam = 0; j.charge = 0; j.rwr = j.rwr ?? 0;
    if (j.view === undefined) j.view = 0;
    // Frostwing clearance: the airframe comes back ice-plated and with more countermeasures.
    // Applied once per airframe — re-boarding the same jet must never stack the bonus.
    if (this.frostwing && !j.tuned) {
      j.maxHp = Math.round(j.maxHp * 1.5);
      j.hp = j.maxHp;
      j.flares = ace ? 16 : 10;
      j.tuned = true;
    } else {
      /* NO FREE AIRFRAME REPAIR. The hull that comes back from a sortie comes back with
       * the holes it took: a second sortie starts on whatever structure is left. */
      j.hp = Math.min(j.hp, j.maxHp);
      if (ace) j.flares = Math.max(j.flares, 12);
    }
    if (frost) j.flares = Math.max(j.flares, 20);
    this.px = j.x; this.py = j.y; this.pvx = 0; this.pvy = 0;
    this.showTutorial('jet', 'YOU ARE FLYING THE INTERCEPTOR', [
      'A / D or the mouse steers · W throttle · S brake · SHIFT afterburner',
      'LMB cannon · G missile · H rockets · R lance (experimental hulls)',
      'SPACE flares · X wing station · E autopilot · V camera · F eject',
      'The airframe is finite: land it or lose it, and a wreck never flies again.',
    ]);
    for (const o of this.armyJets) {
      if (o === j) continue;
      o.state = 'parked'; o.alt = 0; o.speed = 0;
    }
    for (const h of this.helis) h.state = 'egress';
    if (frost) {
      // The one airframe in the game with no squadron number: 900 hull, 2.2 km/s on the
      // burner, twenty flares and an ice seeker that reaches further than anything else.
      this.score += 4000;
      this.setBanner('FROSTWING AIRBORNE',
        'ICE INTERCEPTOR · 2.2 KM/S · 20 FLARES · ICE SEEKER 3200 M · TWIN CANNON');
      this.addText(j.x, j.y - 90, 'THE GLACIER KEPT ONE AIRFRAME. IT IS YOURS.', '#c9f4ff', 18);
      this.addText(j.x, j.y - 68, 'FROSTWING ON S.H.I.E.L.D. STRENGTH · +4000', '#a9ecff', 13);
      this.flash = 0.45; this.flashColor = '190,245,255';
    } else if (ace) {
      // The proving flight only ever built two of these, and neither was meant to leave
      // the apron. Taking one is the single biggest prize in the district.
      this.score += 6500;
      this.setBanner('PROTOTYPE INTERCEPTOR SEIZED',
        'EXPERIMENTAL AIRFRAME · 2.4 KM/S BURNER · 16 FLARES · TWIN CANNON');
      this.addText(j.x, j.y - 90, 'THE PROVING FLIGHT JUST LOST ITS ONLY PILOT', '#ffd489', 18);
      this.addText(j.x, j.y - 68, 'PROTOTYPE ON S.H.I.E.L.D. STRENGTH · +6500', '#ffe6ad', 13);
      this.flash = 0.5; this.flashColor = '255,215,140';
    } else {
      this.score += 1500;
      this.setBanner('INTERCEPTOR SEIZED', 'LMB FIRE · G MISSILE · X STATION · E AUTOPILOT · SPACE FLARES · SHIFT BURN');
      this.addText(j.x, j.y - 90, 'AIRSPACE IS YOURS — NOTHING ELSE FLIES', '#a9ecff', 17);
    }
    /* No screen flash on taking an aircraft. The old 0.35 white-cyan wash painted the
     * whole viewport the moment the operative strapped in; a light on the apron does the
     * same job without blinding the player. */
    this.addLight(j.x, j.y, 260, '150,235,255', 0.22);
    if (frost) this.flash = 0.12, this.flashColor = '150,235,255';
    else if (ace) this.flash = 0.1, this.flashColor = '255,215,140';
    sfx.rotor();
  }

  private exitJet() {
    const j = this.playerJet;
    if (!j) return;
    if (j.speed > 320) {
      this.addText(j.x, j.y - 90, 'THROTTLE DOWN TO EJECT', '#ffcf7a', 14);
      return;
    }
    j.manned = false;
    j.state = 'parked';
    j.alt = 0; j.speed = 0; j.boost = 0;
    this.playerJet = null;
    this.px = j.x + 70; this.py = j.y + 70;
    this.pvx = 0; this.pvy = 0;
    this.setBanner('INTERCEPTOR ON THE APRON', 'PRESS F AGAIN TO FLY');
    sfx.click();
  }

  /** What the nose is pointing at: nearest hostile inside the seeker cone. */
  private jetSeeker(j: ArmyJet): { x: number; y: number; label: string; air: boolean } | null {
    const nose = { x: Math.cos(j.ang), y: Math.sin(j.ang) };
    let best: { x: number; y: number; label: string; air: boolean } | null = null;
    let bestScore = -1;
    const consider = (x: number, y: number, label: string, air: boolean) => {
      const dx = x - j.x, dy = y - j.y;
      const d = Math.hypot(dx, dy);
      const reach = j.tier === 'prototype' ? 3400 : j.tier === 'frostwing' ? 3200 : 2600;
      if (d < 60 || d > reach) return;
      const dot = (dx * nose.x + dy * nose.y) / d;
      if (dot < 0.55) return;                     // roughly 57 degrees off the nose
      const score = dot * 2 - d / 2600;
      if (score > bestScore) { bestScore = score; best = { x, y, label, air }; }
    };
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.spawnT > 0 || e.def.civilian) continue;
      consider(e.x, e.y, 'INFANTRY', false);
    }
    for (const t of this.tanks) if (!t.dead && !t.captured) consider(t.x, t.y, 'ARMOUR', false);
    for (const h of this.helis) consider(h.x, h.y, 'GUNSHIP', true);
    for (const o of this.armyJets) {
      if (o === j || o.state === 'parked') continue;
      consider(o.x, o.y, 'INTERCEPTOR', true);
    }
    for (const t of this.armyTurrets) if (t.owner === 'enemy') consider(t.x, t.y, 'TWIN GUN', false);
    return best;
  }

  /** G: a missile off the wing, into whatever the seeker is holding. */
  private fireJetMissile() {
    const j = this.playerJet;
    if (!j) return;
    const lock = j.lock;
    if (!lock) {
      this.addText(j.x, j.y - 70, 'NO LOCK — POINT THE NOSE AT SOMETHING', '#ffcf7a', 13);
      return;
    }
    if ((j.missiles ?? 0) <= 0) {
      this.addText(j.x, j.y - 70, 'MISSILE RAILS EMPTY · USE THE CANNON', '#ffcf7a', 13);
      return;
    }
    j.missiles = (j.missiles ?? 0) - 1;
    const a = Math.atan2(lock.y - j.y, lock.x - j.x);
    this.jetMissiles.push({
      x: j.x + Math.cos(a) * 60, y: j.y + Math.sin(a) * 60,
      vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
      life: 6, air: lock.air, dmg: lock.air ? 320 : 420,
    });
    this.addText(j.x, j.y - 70, `FOX TWO · ${lock.label} · ${j.missiles} LEFT`, '#a9ecff', 14);
    this.addLight(j.x, j.y, 320, '180,235,255', 0.3);
    // launch smoke off the rail, and a shove that can be felt
    for (let i = 0; i < 14; i++) {
      const a = j.ang + rand(-0.5, 0.5);
      this.addParticle(j.x + Math.cos(a) * 60, j.y + Math.sin(a) * 60,
        Math.cos(a) * rand(40, 160), Math.sin(a) * rand(40, 160), rand(0.5, 1.1), rand(3, 7), '#dfeaf2', true);
    }
    this.hitstop = Math.max(this.hitstop, 0.04);
    this.flash = Math.max(this.flash, 0.12); this.flashColor = '200,235,255';
    sfx.shoot('rocket');
  }

  /**
   * H: the rocket pods. Six unguided rockets out of the wings in one press — the anti-ground
   * weapon of the aircraft, and the reason a strafing pass over the army base is a bad
   * minute for anyone standing under it.
   */
  private fireJetRockets() {
    const j = this.playerJet;
    if (!j) return;
    const left = j.rocketsPlayer ?? 0;
    if (left <= 0) { this.addText(j.x, j.y - 70, 'ROCKET PODS EMPTY', '#ffcf7a', 13); return; }
    const salvo = Math.min(6, left);
    j.rocketsPlayer = left - salvo;
    for (let i = 0; i < salvo; i++) {
      const a = j.ang + rand(-0.09, 0.09);
      const side = i % 2 ? 1 : -1;
      const ox = Math.cos(j.ang + Math.PI / 2) * side * 34;
      const oy = Math.sin(j.ang + Math.PI / 2) * side * 34;
      this.jetRockets.push({
        x: j.x + ox + Math.cos(j.ang) * 50, y: j.y + oy + Math.sin(j.ang) * 50,
        vx: Math.cos(a) * 1150 + Math.cos(j.ang) * j.speed * 0.35,
        vy: Math.sin(a) * 1150 + Math.sin(j.ang) * j.speed * 0.35,
        life: 2.4, dmg: 130,
      });
    }
    this.addText(j.x, j.y - 70, `ROCKET SALVO · ${j.rocketsPlayer} LEFT`, '#ffca86', 14);
    this.addLight(j.x, j.y, 300, '255,190,120', 0.25);
    this.timeScale = 0.82;
    sfx.shoot('rocket');
    this.provokeAirResponse(0.5);
  }

  /**
   * R: the lance. Holding the key winds the capacitor; when it is full the shot goes off
   * by itself — a piercing line of cold light that cuts through everything on the nose.
   * Only the two experimental airframes carry one.
   */
  private fireLanceCharge() {
    const j = this.playerJet;
    if (!j) return;
    if ((j.lance ?? 0) <= 0) {
      this.addText(j.x, j.y - 70, 'NO LANCE CHARGES', '#ffcf7a', 13);
      return;
    }
    if ((j.charge ?? 0) > 0.05) return;          // already winding
    j.charge = 0.001;
    sfx.click();
  }

  /** The capacitor is full: the lance fires down the nose. */
  private releaseLance() {
    const j = this.playerJet;
    if (!j) return;
    j.charge = 0;
    j.lance = Math.max(0, (j.lance ?? 0) - 1);
    const beam: LanceBeam = { x: j.x, y: j.y, ang: j.ang, life: 0.42, max: 0.42, dmg: j.tier === 'frostwing' ? 460 : 400 };
    this.lanceBeams.push(beam);
    const reach = 2600;
    const ex = j.x + Math.cos(j.ang) * reach, ey = j.y + Math.sin(j.ang) * reach;
    const near = (x: number, y: number, r: number) => {
      // distance from the point to the beam segment
      const dx = ex - j.x, dy = ey - j.y;
      const t = clamp(((x - j.x) * dx + (y - j.y) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(x - (j.x + dx * t), y - (j.y + dy * t)) < r;
    };
    let hits = 0;
    for (const o of this.armyJets) {
      if (o === j || o.state === 'parked' || o.hp <= 0) continue;
      if (!near(o.x, o.y, 90)) continue;
      o.hp -= beam.dmg; hits++;
      this.sparks(o.x, o.y, '#dff6ff', 18);
      if (o.hp <= 0) this.downJet(o, 'LANCE');
    }
    for (const h of this.helis) {
      if (!near(h.x, h.y, 80) || h.hp <= 0) continue;
      h.hp -= beam.dmg; hits++;
      if (h.hp <= 0) this.killHeli(h);
    }
    for (const t of this.tanks) {
      if (t.dead || t.captured || !near(t.x, t.y, 70)) continue;
      t.hp -= beam.dmg; hits++;
    }
    for (const t of this.armyTurrets) {
      if (t.owner === 'player' || !near(t.x, t.y, 60)) continue;
      t.hp -= beam.dmg; hits++;
    }
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.spawnT > 0 || !near(e.x, e.y, 46)) continue;
      this.hurtEnemy(e, beam.dmg); hits++;
    }
    this.addText(j.x, j.y - 84, hits ? `LANCE · ${hits} HIT${hits === 1 ? '' : 'S'}` : 'LANCE · CLEAN AIR', '#dff6ff', 16);
    this.flash = Math.max(this.flash, 0.32); this.flashColor = '210,245,255';
    this.hitstop = Math.max(this.hitstop, 0.06);
    this.shocks.push({ x: j.x, y: j.y, r: 10, max: 260, life: 0.4, t: 0.4, color: '210,245,255', width: 8 });
    sfx.shoot('rocket');
  }

  /** V: three camera perspectives for the dogfight. */
  private cycleJetView() {
    const j = this.playerJet;
    if (!j) return;
    j.view = ((j.view ?? 0) + 1) % 3;
    const name = j.view === 0 ? 'CHASE CAMERA' : j.view === 1 ? 'TACTICAL · WIDE' : 'GUN CAMERA · CLOSE';
    this.addText(j.x, j.y - 96, name, '#a9ecff', 15);
    sfx.click();
  }

  /** Screen point to world point, correct at any jet camera zoom. */
  /**
   * The three cockpit cameras.
   *
   * `lead` pushes the camera ahead of the aircraft so the target is not hidden under the
   * nose, `zoom` pulls the view out (tactical) or in (gun camera).
   */
  private jetViewConfig(): { zoom: number; lead: number } {
    const j = this.playerJet;
    if (!j) return { zoom: 1, lead: 0 };
    if (j.view === 1) return { zoom: 0.72, lead: 0 };
    if (j.view === 2) return { zoom: 1.32, lead: 220 };
    return { zoom: 1.06, lead: 130 };
  }

  /** The camera the world pass should use this frame. */
  private jetCamera(): { x: number; y: number; zoom: number; active: boolean } {
    const j = this.playerJet;
    if (!j) return { x: this.camX, y: this.camY, zoom: 1, active: false };
    const { zoom, lead } = this.jetViewConfig();
    const vw = this.w / zoom, vh = this.h / zoom;
    const fx = j.x + Math.cos(j.ang) * lead, fy = j.y + Math.sin(j.ang) * lead;
    return {
      x: clamp(fx - vw / 2, 0, Math.max(0, ARENA_W - vw)),
      y: clamp(fy - vh / 2, 0, Math.max(0, ARENA_H - vh)),
      zoom,
      active: true,
    };
  }

  private worldMouse(): { x: number; y: number } {
    const cam = this.jetCamera();
    return { x: cam.x + this.mouseX / cam.zoom, y: cam.y + this.mouseY / cam.zoom };
  }

  /** SPACE: countermeasures, and the hard break that comes with them. */
  private dropJetFlares() {
    const j = this.playerJet;
    if (!j) return;
    if ((j.flares ?? 0) <= 0) { this.addText(j.x, j.y - 60, 'NO FLARES LEFT', '#ff9d9d', 13); return; }
    j.flares = (j.flares ?? 0) - 1;
    this.jetFlareT = Math.max(this.jetFlareT, 2.8);
    // An inbound missile sees the flare as a hotter target than the aircraft.
    for (const m of this.enemyRockets) {
      if (Math.hypot(m.x - j.x, m.y - j.y) < 1600) m.spooked = Math.max(m.spooked, 3.4);
    }
    j.rwr = 0;
    this.addText(j.x, j.y - 96, 'FLARES AWAY', '#ffd8a0', 12);
    for (let i = 0; i < 8; i++) {
      const a = j.ang + Math.PI + rand(-0.9, 0.9);
      this.addParticle(j.x, j.y, Math.cos(a) * rand(120, 320), Math.sin(a) * rand(120, 320),
        rand(0.6, 1.4), rand(3, 6), i % 2 ? '#ffd166' : '#fff2c0', true);
    }
    j.x -= Math.cos(j.ang) * 220;
    j.y -= Math.sin(j.ang) * 220;
    this.iFrames = Math.max(this.iFrames, 1.4);
    this.addLight(j.x, j.y, 420, '255,220,150', 0.4);
    this.addText(j.x, j.y - 70, `FLARES ${j.flares} · BREAK`, '#ffd166', 14);
    sfx.click();
  }

  /**
   * Fast-jet flight model with the full control set: throttle, airbrake, afterburner,
   * seeker lock, cannon and missile stations, countermeasures and an orbit autopilot.
   */
  private updatePlayerJet(dt: number) {
    const j = this.playerJet;
    if (!j) return;
    const m = this.moveVector();
    if (j.hp <= 0) {
      this.explode(j.x, j.y, 260, 90, true);
      j.manned = false; j.hp = 0; j.wreck = true; j.wreckT = 0;
      j.state = 'wreck' as ArmyJet['state']; j.alt = 0; j.speed = 0; j.ready = false;
      this.playerJet = null;
      this.jetMissiles = [];
      // DITCHING: a hull that comes down in open water puts the pilot in a boat.
      if (this.inWater(j.x, j.y)) { this.ditchAircraft(j); return; }
      this.addText(j.x, j.y - 80, 'INTERCEPTOR DOWN · AIRFRAME LOST', '#ff9d9d', 18);
      this.addText(j.x, j.y - 58, 'THE WRECK WILL NOT FLY AGAIN', '#ffb0a0', 13);
      this.px = j.x; this.py = j.y; this.pvx = 0; this.pvy = 0;
      return;
    }
    const lock = this.jetSeeker(j);
    j.lock = lock;

    let aim = j.ang, firing = false;
    if (this.aimStick.active) {
      const dx = this.aimStick.x - this.aimStick.ox, dy = this.aimStick.y - this.aimStick.oy;
      if (Math.hypot(dx, dy) > 12) { aim = Math.atan2(dy, dx); firing = true; }
    } else if (!this.isTouch) {
      const mp = this.worldMouse();
      aim = Math.atan2(mp.y - j.y, mp.x - j.x);
      firing = this.firing;
    }
    // A/D: a coordinated roll into a hard turn, the way a fighter changes heading.
    const roll = m.x;
    if (roll) aim = j.ang + roll * 1.15;
    let turn = aim - j.ang;
    while (turn > Math.PI) turn -= TAU;
    while (turn < -Math.PI) turn += TAU;

    const ace = j.tier === 'prototype';
    const frost = j.tier === 'frostwing';
    /* ---- SYSTEMS ---- */
    // Cannon heat: held fire cooks the barrels, and a cooked barrel is a jam. A jammed
    // gun vents hard, so the tape falls away while the barrels are being cleared.
    const coolRate = (ace ? 0.22 : frost ? 0.21 : 0.19) * ((j.jam ?? 0) > 0 ? 3 : 1);
    j.heat = Math.max(0, (j.heat ?? 0) - coolRate * dt);
    if ((j.jam ?? 0) > 0) {
      j.jam = Math.max(0, (j.jam ?? 0) - dt);
      if (j.jam === 0) this.addText(j.x, j.y - 80, 'CANNON CLEAR', '#a9ecff', 12);
    }
    // Radar warning receiver: an inbound missile keeps the light on.
    if ((j.rwr ?? 0) > 0) j.rwr = Math.max(0, (j.rwr ?? 0) - dt);
    // The lance winds while R is held and fires itself when the capacitor is full.
    if ((j.charge ?? 0) > 0) {
      j.charge = Math.min(1, (j.charge ?? 0) + dt / 0.9);
      if (j.charge >= 1) this.releaseLance();
    }

    const brake = !!this.keys['s'] && !this.keys['w'];
    const boost = !!this.keys['shift'];   // SPACE is countermeasures in a jet, not burner
    if (j.autopilot) {
      const cx = lock ? lock.x : j.x, cy = lock ? lock.y : j.y;
      const a = Math.atan2(j.y - cy, j.x - cx);
      const tx = cx + Math.cos(a - 0.5) * 900, ty = cy + Math.sin(a - 0.5) * 900;
      aim = Math.atan2(ty - j.y, tx - j.x);
      turn = aim - j.ang;
      while (turn > Math.PI) turn -= TAU;
      while (turn < -Math.PI) turn += TAU;
    }

    const agility = (2.5 - Math.min(1, j.speed / (ace ? 2400 : 1800)) * 0.9)
      * (brake ? 1.8 : 1) * (ace ? 1.12 : frost ? 1.08 : 1);
    j.ang += clamp(turn, -agility * dt, agility * dt);

    const throttle = m.y < -0.1 ? 1 : m.y > 0.1 ? -0.55 : 0;
    // Prototype airframe: 2 400 m/s on the burner, and it gets there sooner.
    const topSpeed = ace ? 2400 : frost ? 2200 : this.frostwing ? 2050 : 1750;
    const want = brake ? 210 : boost ? topSpeed : 620 + throttle * 260;
    j.speed += (want - j.speed) * Math.min(1, dt * (boost ? (ace ? 2.3 : frost ? 2.1 : 1.9) : brake ? 4.2 : 2.6));
    j.boost = lerp(j.boost || 0, boost && !brake ? 1 : 0, Math.min(1, dt * 4));
    j.alt = clamp(j.alt + (boost ? 46 : brake ? -30 : 14) * dt, 0, 480);
    j.cool = Math.max(0, j.cool - dt);

    j.x += Math.cos(j.ang) * j.speed * dt;
    j.y += Math.sin(j.ang) * j.speed * dt;
    /* THE BOUNDARY IS A WALL, NOT A MIRROR. The old code reflected the heading off the
     * edge, which left the aircraft flying into the same wall again a second later. Now the
     * airframe is stopped at the wall and turned back inside the arena. */
    if (this.keepInsideAirspace(j)) {
      if (this.simulationTime - this.airspaceWarnT > 2) {
        this.airspaceWarnT = this.simulationTime;
        this.addText(j.x, j.y - 88, 'AIRSPACE BOUNDARY · TURNING BACK', '#ffd166', 14);
      }
    }

    // A hurt airframe trails smoke: black when it is nearly out of airframe, grey before.
    const frac = j.hp / Math.max(1, j.maxHp);
    if (frac < 0.45 && Math.random() < 0.7) {
      const a = j.ang + Math.PI + rand(-0.25, 0.25);
      this.addParticle(j.x + Math.cos(a) * 66, j.y + Math.sin(a) * 66,
        Math.cos(a) * rand(30, 90), Math.sin(a) * rand(30, 90), rand(0.5, 1.1), rand(3, 7),
        frac < 0.2 ? '#3c3c3c' : '#8d9295', true);
    }
    if (j.boost > 0.12) {
      this.jetTrail.push({ x: j.x - Math.cos(j.ang) * 90, y: j.y - Math.sin(j.ang) * 90, t: 0.55 });
      if (j.boost > 0.6) this.addLight(j.x, j.y, 280, this.frostwing ? '150,235,255' : '150,225,255', 0.2);
    }
    for (let i = this.jetTrail.length - 1; i >= 0; i--) {
      this.jetTrail[i].t -= dt;
      if (this.jetTrail[i].t <= 0) this.jetTrail.splice(i, 1);
    }
    if (this.jetTrail.length > 90) this.jetTrail.splice(0, this.jetTrail.length - 90);

    if (firing && j.cool <= 0) {
      if (j.mode === 'missile') {
        j.cool = 1.6;
        this.fireJetMissile();
      } else if ((j.jam ?? 0) > 0) {
        j.cool = 0.25;
        if (Math.random() < 0.12) this.addText(j.x, j.y - 76, 'GUN JAMMED · COOLING', '#ffb08a', 12);
      } else {
        j.cool = ace ? 0.045 : frost ? 0.048 : 0.055;
        j.heat = Math.min(1, (j.heat ?? 0) + (ace ? 0.019 : frost ? 0.02 : 0.022));
        if ((j.heat ?? 0) >= 1) {
          j.jam = ace ? 1.5 : frost ? 1.6 : 2.2;
          this.addText(j.x, j.y - 90, 'GUN OVERHEAT · BARRELS COOKED', '#ffb08a', 15);
          this.sparks(j.x + Math.cos(j.ang) * 60, j.y + Math.sin(j.ang) * 60, '#ffcf7a', 10);
          sfx.hit();
        }
        for (const side of [-1, 1]) {
          const a = j.ang + rand(-0.01, 0.01);
          const ox = Math.cos(j.ang + Math.PI / 2) * side * 14 + Math.cos(j.ang) * 74;
          const oy = Math.sin(j.ang + Math.PI / 2) * side * 14 + Math.sin(j.ang) * 74;
          this.bullets.push({
            x: j.x + ox, y: j.y + oy, px: j.x + ox, py: j.y + oy,
            vx: Math.cos(a) * 2100, vy: Math.sin(a) * 2100,
            dmg: ace ? 38 : frost ? 34 : this.frostwing ? 30 : 24, life: 0.9, friendly: true,
            color: ace ? '#ffe0a0' : frost ? '#d8fbff' : this.frostwing ? '#c8f8ff' : '#d6f6ff', r: ace ? 4.2 : frost ? 4 : 3.6, hits: [],
          });
        }
        this.addLight(j.x, j.y, 200, '190,240,255', 0.1);
        this.shocks.push({ x: j.x + Math.cos(j.ang) * 82, y: j.y + Math.sin(j.ang) * 82, r: 2, max: 22, life: 0.1, t: 0.1, color: '255,240,200', width: 2 });
        this.provokeAirResponse(0.08);   // sustained strafing heats the air defence up
        sfx.shoot('rifle');
      }
    }
    this.px = j.x; this.py = j.y;
    this.pvx = Math.cos(j.ang) * j.speed; this.pvy = Math.sin(j.ang) * j.speed;
    this.pang = j.ang;
  }

  /**
   * DITCHING. A shot-down interceptor that comes down in open water does not leave the
   * operative swimming: the wreck goes in, a survival boat is on the water, and — because
   * the wing has just lost an airframe in front of everyone — every aircraft in the
   * district is recalled and the air battle is stood down.
   */
  private ditchAircraft(j: ArmyJet) {
    this.ditching = true;
    const bx = clamp(j.x, SEA.x + 140, ARENA_W - 200), by = clamp(j.y, 160, ARENA_H - 160);
    const boat = makeBoat('skiff', 'player', bx, by, j.ang + Math.PI / 2, { state: 'cruise' });
    this.boats.push(boat);
    this.enterBoat(boat);
    this.setBanner('DITCHED', 'THE AIRFRAME IS AT THE BOTTOM — YOU ARE IN A BOAT');
    this.addText(bx, by - 90, 'INTERCEPTOR LOST AT SEA', '#ff9d9d', 18);
    this.addText(bx, by - 66, 'SURVIVAL SKIFF · W/S THROTTLE · F DISEMBARK', '#a9ecff', 13);
    for (let i = 0; i < 3; i++) {
      this.addParticle(bx, by, rand(-90, 90), rand(-90, 90), rand(0.6, 1.2), rand(3, 7), i ? '#cfd8dd' : '#fff0c0', true);
    }
    this.shocks.push({ x: bx, y: by, r: 20, max: 300, life: 0.7, t: 0.7, color: '207,232,255', width: 6 });
    this.recallAllAirForces('AIRFRAME DOWN IN THE WATER');
    this.ditchT = 9;
    sfx.wave();
  }

  /**
   * Every aircraft goes home. This is the consequence of losing an airframe over water:
   * no new sorties, no hunters, no air response — the wing stands down where it stands.
   */
  recallAllAirForces(why: string) {
    this.airResponse = 0;
    this.airResponseHeat = 0;
    this.airResponseWave = 0;
    this.airResponseIdle = 99;
    this.enemyRockets = [];
    let sent = 0;
    for (const o of this.armyJets) {
      if (o.manned || o.wreck) continue;
      if (o.state !== 'parked') {
        // Fly it to the nearest runway point and put it on the ground: no vanishing.
        const rw = this.nearestRunwayPoint(o.x, o.y, 6000);
        o.state = 'egress';
        o.t = 0;
        if (rw) { o.taxiX = rw.x; o.taxiY = rw.y; }
        sent++;
      }
    }
    for (const h of this.helis) if (h.state !== 'egress' && h.state !== 'landing' && h.state !== 'taxi-in' && h.state !== 'service') { h.state = 'egress'; sent++; }
    this.addText(this.px, this.py - 130, `ALL AIRCRAFT RECALLED · ${sent} AIRFRAMES`, '#a9ecff', 15);
    this.setBanner('AIR OPERATIONS SUSPENDED', why);
  }

  /** Missiles in flight: they fly straight at where the target was and go off on contact. */
  private updateJetMissiles(dt: number) {
    for (let i = this.jetMissiles.length - 1; i >= 0; i--) {
      const m = this.jetMissiles[i];
      m.life -= dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (Math.random() < 0.9) {
        this.addParticle(m.x, m.y, rand(-20, 20), rand(-20, 20), 0.45, rand(2, 5), '#cfe8ff', true);
      }
      let hit = false;
      if (m.air) {
        for (const h of this.helis) {
          if (Math.hypot(h.x - m.x, h.y - m.y) < 70) { h.hp -= m.dmg; hit = true; if (h.hp <= 0) this.killHeli(h); break; }
        }
        if (!hit) for (const o of this.armyJets) {
          if (o.manned || o.state === 'parked') continue;
          if (Math.hypot(o.x - m.x, o.y - m.y) < 90) {
            o.hp -= m.dmg; hit = true;
            if (o.hp <= 0) this.downJet(o, 'FOX TWO');
            break;
          }
        }
      } else {
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.spawnT > 0) continue;
          if (Math.hypot(e.x - m.x, e.y - m.y) < 46) { this.hurtEnemy(e, m.dmg); hit = true; break; }
        }
        if (!hit) for (const t of this.tanks) {
          if (t.dead || t.captured) continue;
          if (Math.hypot(t.x - m.x, t.y - m.y) < 70) { t.hp -= m.dmg; hit = true; break; }
        }
        if (!hit) for (const t of this.armyTurrets) {
          if (t.owner === 'player') continue;
          if (Math.hypot(t.x - m.x, t.y - m.y) < 56) { t.hp -= m.dmg; hit = true; break; }
        }
      }
      if (hit || m.life <= 0) {
        this.explode(m.x, m.y, 170, m.dmg * 0.5, true);
        if (!m.air) this.provokeAirResponse(1.3);   // a missile into the ground is a bombing run
        this.jetMissiles.splice(i, 1);
      }
    }
  }

  /** F on a suppressed emplacement: the crew is dead, the guns are yours. */
  private tryCaptureTurret() {
    const t = this.armyTurrets.find((q) =>
      q.owner === 'enemy' && Math.hypot(q.x - this.px, q.y - this.py) < 150);
    if (!t) return false;
    /* A twin mount is taken when its crew has had enough, not when the steel is scrap:
     * three-quarters of its armour gone and they abandon the pit. Waiting for 45% made
     * the guns feel uncapturable, because the mount usually dies before it gets there. */
    if (t.hp > t.maxHp * 0.75) {
      this.addText(t.x, t.y - 60, 'CREW STILL FIRING — SUPPRESS THE EMPLACEMENT', '#ffb08a', 14);
      return true;
    }
    t.owner = 'player';
    t.hp = Math.max(t.hp, t.maxHp * 0.55);
    t.cool = 0.4; t.rounds = 0; t.gap = 0;
    // The crew that held it is gone; the mount is ours and it tracks on its own.
    this.milestone('turret', 'The emplacement is yours', [
      'A seized twin gun fires on its own: ground targets and aircraft, for as long as it lives.',
      'Shell it down to three-quarters damage and the crew walks away — then press F at the pit.',
      'Leave it behind and it keeps shooting. It is the best thing you can leave on a road.',
    ]);
    this.setBanner('TWIN GUN SEIZED', 'IT COVERS GROUND AND AIR — LEAVE IT AND IT KEEPS FIRING');
    this.score += 900;
    this.addText(t.x, t.y - 66, 'TWIN GUN SEIZED · IT COVERS GROUND AND AIR', '#a9ecff', 16);
    sfx.click();
    return true;
  }

  /** Field support selected before deployment. */
  private updateSupport(dt: number) {
    if (this.support !== 'drone') return;
    this.droneAng += dt * 1.8;
    this.supportCd -= dt;
    if (this.supportCd > 0) return;
    const hostiles = this.enemies.filter((e) => !e.def.civilian && e.hp > 0 && e.spawnT <= 0);
    let target: Enemy | null = null;
    let bd = 760;
    for (const e of hostiles) {
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < bd && this.hasLine(this.px, this.py, e.x, e.y)) { bd = d; target = e; }
    }
    if (!target) return;
    this.supportCd = 0.48;
    const ox = Math.cos(this.droneAng) * 54, oy = Math.sin(this.droneAng) * 54;
    const a = Math.atan2(target.y - (this.py + oy), target.x - (this.px + ox));
    this.bullets.push({ x: this.px + ox, y: this.py + oy, px: this.px + ox, py: this.py + oy, vx: Math.cos(a) * 1180, vy: Math.sin(a) * 1180, dmg: 13, life: 0.7, friendly: true, color: '#8dffb0', r: 2.5, hits: [] });
    this.addLight(this.px + ox, this.py + oy, 110, '140,255,180', 0.1);
  }

  /* ---------------- player ---------------- */

  private tellStory(entry: StoryEntry, seconds = 10) {
    this.story = entry; this.storyTime = seconds;
  }

  private infantryRoutesReadyPoint(x: number, y: number): Point {
    const p = { x: clamp(x, 90, ARENA_W - 90), y: clamp(y, 90, ARENA_H - 90) };
    for (let i = 0; i < 3; i++) this.collide(p, 22);
    // Squeezed between two structures (a doorway stack, a pallet rank)? Snap to the nearest
    // cell the infantry planner calls walkable, so nobody spawns or marches inside a wall.
    if (!this.infantryRoutes.clear(p)) {
      const n = this.infantryRoutes.nearest(p);
      if (Math.hypot(n.x - p.x, n.y - p.y) < 170) { p.x = n.x; p.y = n.y; }
    }
    return p;
  }

  private lightReach(light: Searchlight, target: Point): number {
    const candidates = new Set<number>();
    this.grid.query(Math.min(light.x, target.x), Math.min(light.y, target.y), Math.abs(target.x - light.x), Math.abs(target.y - light.y), candidates);
    let t = 1;
    const owners = new Set<number>();
    for (const index of this.grid.at(light.x, light.y)) {
      const r = this.obstacles[index];
      if (!r.dead && distanceToBlock(light.x, light.y, r) < 6 && r.structuralGroup !== undefined) owners.add(r.structuralGroup);
    }
    for (const index of candidates) {
      const r = this.obstacles[index];
      if (r.dead || (r.structuralGroup !== undefined && owners.has(r.structuralGroup))) continue;
      const hit = segmentBox(light, target, r);
      if (hit !== null && hit > 0.01) t = Math.min(t, hit);
    }
    for (const g of this.dynamicNear(Math.min(light.x, target.x), Math.min(light.y, target.y), Math.max(light.x, target.x), Math.max(light.y, target.y))) {
      const hit = segmentBox(light, target, g);
      if (hit !== null && hit > 0.01) t = Math.min(t, hit);
    }
    return t;
  }

  /** Kill the generators: each yard blacks out on its own, HELIOS takes the whole sector dark. */
  private updateBlackout(dt: number) {
    const B = this.blackout, sites = this.campaignSites;
    if (!sites) return;
    // Per-site output: a feeder yard dying darkens its own base before the grid does.
    let sector = 1, anyDead = false;
    for (const site of sites.powerSites) {
      const load = siteLoad(sites.powerCells, site.id);
      const st = this.sitePower.get(site.id) || { load: 1, dead: false, t: 0 };
      const wasDead = st.dead;
      st.load = load; st.dead = load <= 0; st.t += dt;
      this.sitePower.set(site.id, st);
      if (st.dead) anyDead = true;
      if (st.dead && !wasDead) this.siteOffline(site);
      if (site.major) sector = load;
    }
    this.gridOutput = sector;
    this.siteDark = anyDead;
    // Machines, floods and rack LEDs follow their own feeder yard.
    for (const f of this.facilities) {
      f.dark = B.active || (f.siteId ? (this.sitePower.get(f.siteId)?.dead ?? false) : false);
    }
    if (!B.active && sector <= 0) {
      B.active = true; B.t = 0; B.lastX = this.px; B.lastY = this.py;
      this.flash = 0.9; this.flashColor = '20,20,30';
      for (const sp of this.spotlights) sp.online = false;
      for (const s of this.servers) s.spark = 0;
      this.setBanner('GRID DOWN', 'THE SECTOR GOES DARK — THEY ARE HUNTING BY LAMPLIGHT');
      this.tellStory({
        id: 'blackout', channel: 'EMERGENCY CHANNEL / GRID OFFLINE',
        title: 'You killed the sun in this sector.',
        text: 'HELIOS output is zero. Radar, searchlights, beacon strobes and warehouse floods are dark. HYDRA infantry has switched to helmet lamps and formed search columns out of the nearest depots. Environmental cue: the patrols are searching your last sighted position. Their lights give them away before they give you away.',
      }, 14);
      this.queueResponse('blackout-a', { x: this.px + 600, y: this.py - 300 }, 16, 8);
      this.queueResponse('blackout-b', { x: this.px - 600, y: this.py + 300 }, 16, 8);
      sfx.gameover(); // long, dire chord suits the blackout beat
    }
    if (!B.active) return;
    B.t += dt;
    // Search parties slowly tighten on your *last seen* point — headlamps patrol the area.
    B.searchT += dt;
    if (B.searchT > 9) {
      B.searchT = 0;
      for (const e of this.enemies) {
        if (e.def.civilian || e.garrison || e.hp <= 0 || e.squadId < 0) continue;
        const d = Math.hypot(e.x - B.lastX, e.y - B.lastY);
        if (d > 260) {
          const a = Math.atan2(e.wobble * 1.3, Math.cos(e.wobble));
          e.vx += (Math.cos(a) * 14 + (B.lastX - e.x) / d * 22) * dt * 60 * 0.012;
          e.vy += (Math.sin(a) * 14 + (B.lastY - e.y) / d * 22) * dt * 60 * 0.012;
        }
      }
    }
    // Get too close to a lit soldier and the dark no longer protects you.
    let lit = false;
    for (const e of this.enemies) {
      if (e.def.civilian || e.hp <= 0) continue;
      const dx = this.px - e.x, dy = this.py - e.y, d = Math.hypot(dx, dy);
      if (d > 340) continue;
      const facing = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - e.ang), Math.cos(Math.atan2(dy, dx) - e.ang)));
      if (facing < 0.42) { lit = true; break; }
    }
    if (lit) {
      this.security.exposure = Math.min(1, this.security.exposure + dt * 2.2);
      if (!this.security.active && this.security.exposure >= 1 && this.security.cooldown <= 0) {
        this.security.active = true; this.security.target = { x: this.px, y: this.py };
        this.security.cooldown = 45;
        this.queueResponse('blackout-spot', { x: this.px, y: this.py }, 14, 7);
        this.addText(this.px, this.py - 56, 'LAMPLIGHT CONTACT / THEY SEE YOU', '#eedfae', 15);
      }
    } else {
      this.security.exposure = Math.max(0, this.security.exposure - dt * 0.8);
      if (this.security.active) {
        this.security.target = { x: B.lastX, y: B.lastY };
        this.security.lostFor += dt;
        if (this.security.lostFor > 10) this.security.active = false;
      }
    }
  }

  /** Is this point inside a yard that has lost its own power? (helmet-lamp test) */
  private localDark(x: number, y: number): boolean {
    const sites = this.campaignSites;
    if (!sites) return false;
    for (const s of sites.powerSites) {
      const st = this.sitePower.get(s.id);
      if (!st || !st.dead) continue;
      if (x > s.x - 420 && x < s.x + s.w + 420 && y > s.y - 420 && y < s.y + s.h + 420) return true;
    }
    return false;
  }

  /** A yard just lost power: its lamps die, its garrison switches to lamplight and sweeps. */
  private siteOffline(site: PowerSite) {
    for (const sp of this.spotlights) if (sp.site === site.id) sp.online = false;
    for (const f of this.facilities) if (f.siteId === site.id) f.dark = true;
    for (const e of this.enemies) {
      if (e.hp <= 0 || !e.patrolTeam) continue;
      const team = this.patrolTeams.find(p => p.id === e.patrolTeam);
      if (team && team.site === site.id) e.alert = true;
    }
    const cx = site.x + site.w / 2, cy = site.y + site.h / 2;
    this.addLight(cx, cy, 760, '255,170,90', 1.1);
    this.shocks.push({ x: cx, y: cy, r: 20, max: 520, life: 0.7, t: 0.7, color: '255,190,120', width: 10 });
    this.queueResponse(`site-dark-${site.id}`, { x: cx, y: cy }, 12, 6);
    if (site.major) return;   // the sector blackout beat covers the main plant
    this.setBanner('FEEDER YARD DOWN', `${site.name} IS BLACK — LAMPLIGHT SEARCH PARTIES FORMING`);
    this.tellStory({
      id: `site-${site.id}`, channel: 'EMERGENCY CHANNEL / LOCAL GRID OFFLINE',
      title: `${site.name} has gone dark.`,
      text: `Generators at ${site.name} are offline. Floodlights, hangar lamps and server racks on that yard are dead, doors stay where they fell, and the garrison has switched to helmet lamps. They are sweeping the compound for whoever did this — their lights give them away before they give you away.`,
    }, 12);
    sfx.siren();
  }

  private updateSecurity(dt: number) {
    const player = { x: this.px, y: this.py };
    if (this.blackout.active) return; // the grid is dead; darkness rules instead
    this.securityTimer -= dt;
    if (this.securityTimer <= 0) {
      this.securityTimer = 0.12;
      for (const l of this.spotlights) {
        if (!l.online || Math.hypot(l.x - player.x, l.y - player.y) > l.range + 50) { this.spotVisibility.set(l, false); continue; }
        this.spotVisibility.set(l, this.lightReach(l, player) > 0.98);
      }
    }
    const spotted = updateSearchlights(this.spotlights, this.security, player, this.simulationTime, dt, l => this.spotVisibility.get(l) || false);
    if (spotted) {
      this.queueResponse('searchlight', player, 30, 6);
      this.tellStory({ id: 'searchlight', channel: 'HYDRA SECURITY / TRACK LOCK', title: 'All searchlights: track the operative.', text: 'Your silhouette is in the network. Five transport vans are loading six soldiers each and will converge on the detection point. Break line of sight to make the lamps lose you; the dispatched troops will still search the area.' }, 12);
      this.addText(this.px, this.py - 60, 'SPOTTED / 30 TROOPS DISPATCHED', '#ffa88b', 18);
    }
    if (!this.piloting && !this.flyingPlane) {
      const main = Math.abs(this.px - HQ.cx) < HQ.w / 2 - 35 && Math.abs(this.py - HQ.cy) < HQ.h / 2 - 35;
      if (main && !this.breachedZones.has('hq')) this.breachResponse('hq', player);
      const hangar = this.hangars.some(h => this.px > h.x + 28 && this.px < h.x + h.w - 28 && this.py > h.y + 28 && this.py < h.y + h.h - 28);
      if (hangar && !this.breachedZones.has('hangar')) this.breachResponse('hangar', player);
    }
    const sites = this.campaignSites;
    if (sites && distanceToBlock(this.px, this.py, sites.library) < 280) {
      const poi = this.pois.find(p => p.id === 'mnemosyne');
      if (poi && !poi.discovered) {
        poi.discovered = true;
        this.tellStory({ id: 'library-found', channel: 'S.H.I.E.L.D. / UNLISTED ARCHIVE', title: 'Mnemosyne is not on any current plan.', text: 'There is no network cable here. Only three reading lamps and Carter\'s original volumes. A note says: "The last watch. The first oath. The second dawn." Find the books and use F to read them.' }, 13);
      }
    }
  }

  private breachResponse(zone: string, point: Point) {
    this.breachedZones.add(zone);
    this.queueResponse(zone, point, 64, 8);
    this.tellStory({ id: `breach-${zone}`, channel: 'HYDRA QRF / EIGHT-VEHICLE RESPONSE', title: zone === 'hq' ? 'The command perimeter is breached.' : 'Unauthorized personnel in the hangars.', text: 'Eight transport vans, eight soldiers per van. HYDRA is sealing approach roads and committing a full reaction company. The crews must board and travel here; use that time to sabotage the facility or prepare a breach of your own.' }, 13);
    this.setBanner('QRF DISPATCHED', '8 TRANSPORTS / 64 TROOPS / HOLD OR EVADE');
  }

  private queueResponse(id: string, target: Point, units: number, size: number) {
    this.responseOrders.push({ id, target: { ...target }, units, size, sent: 0 });
    this.responseTimer = Math.min(this.responseTimer, 0.8);
    this.garrisonAlerted = true;
    for (const e of this.enemies) if (!e.def.civilian && Math.hypot(e.x - target.x, e.y - target.y) < 1200) e.alert = true;
    sfx.siren();
  }

  private makeSquad(id: number, comp: string[], tactic: Tactic, target: Point) {
    this.squads.push({ id, tactic, state: 'deploy', doctrine: 'hunter', size: comp.length,
      stateT: 0, barkCd: 2 + id % 3, angle: 0, radius: 250, volleyT: 2.5, volleyWindow: 0, grenadeT: 5,
      cx: target.x, cy: target.y, fx: target.x, fy: target.y, facing: 0, cohesion: 1, morale: 1, anchorX: target.x, anchorY: target.y });
  }

  private dispatchTruck(comp: string[], id: number, target: Point, mission?: string, stagger = 0) {
    const parking = this.vans.filter(v => !v.dead && !v.reserved && !v.driving && !v.art)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
    if (parking) parking.reserved = true;
    let departure = this.routes.nearest(parking || { x: GOLIATH.x + (id % 2 ? 90 : -90), y: GOLIATH.y - 620 + (id % 9) * 150 });
    for (let i = 0; i < 12 && this.trucks.some(t => !t.dead && Math.hypot(t.x - departure.x, t.y - departure.y) < 160); i++) {
      departure = this.routes.nearest({ x: departure.x + (i % 2 ? -210 : 210), y: departure.y + 190 });
    }
    const a = Math.atan2(target.y - departure.y, target.x - departure.x);
    const side = (id % 3 - 1) * 0.65;
    const stop = { x: target.x - Math.cos(a + side) * (230 + id % 3 * 55), y: target.y - Math.sin(a + side) * (230 + id % 3 * 55) };
    this.trucks.push({ x: departure.x, y: departure.y, tx: stop.x, ty: stop.y, ang: parking?.ang ?? Math.PI / 2,
      state: 'loading', squadId: id, comp: [...comp], slot: 0, deployT: 0,
      hp: 320 + this.sector * 20, maxHp: 320 + this.sector * 20, dead: false, announced: false,
      speed: 0, lean: 0, rescue: false, carrying: 0, rescueWait: 0, mission,
      orderedTarget: mission ? stop : undefined, launchDelay: stagger, parking });
  }

  /**
   * Armoured convoy escort. Tanks are the reason a moving column is so hard to
   * break: they soak enormous damage, hit like a siege gun, and can be captured.
   */
  private dispatchTank(target: Point) {
    const parking = this.vans.filter(v => !v.dead && !v.reserved && !v.driving && !v.disabled && !v.art)
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
    let departure = this.routes.nearest(parking || {
      x: GOLIATH.x + (this.tankSeq % 2 ? 260 : -260),
      y: GOLIATH.y - 520 + (this.tankSeq % 5) * 190,
    });
    for (let i = 0; i < 12 && this.tanks.some(t => !t.dead && Math.hypot(t.x - departure.x, t.y - departure.y) < 210); i++) {
      departure = this.routes.nearest({ x: departure.x + (i % 2 ? -260 : 260), y: departure.y + 220 });
    }
    const a = Math.atan2(target.y - departure.y, target.x - departure.x);
    this.tanks.push({
      x: departure.x, y: departure.y,
      goalX: target.x - Math.cos(a) * 340, goalY: target.y - Math.sin(a) * 340,
      ang: a, turret: a, lean: 0,
      hp: 2400, maxHp: 2400, speed: 0,
      cool: rand(2.5, 4.5), dead: false, announced: false, captured: false,
      ttl: 165 + rand(0, 30), id: this.tankSeq++,
    });
  }

  /** Convoy tank AI: roll with the column, stop at range, fire the main gun. */
  private updateTanks(dt: number) {
    for (let i = this.tanks.length - 1; i >= 0; i--) {
      const t = this.tanks[i];
      if (t.dead) { this.tanks.splice(i, 1); continue; }
      if (t.captured) continue;                     // the operative is driving it
      const pdx = this.px - t.x, pdy = this.py - t.y;
      const pd = Math.hypot(pdx, pdy) || 1;
      // Its escort duty ends: once the column withdraws the tank leaves the field.
      t.ttl -= dt;
      if (t.ttl <= 0 && pd > 1600) { this.tanks.splice(i, 1); continue; }
      if (!t.announced && pd < 1700) {
        t.announced = true;
        this.addText(t.x, t.y - 96, '⚠ CONVOY TANK / MAIN GUN', '#ffb0b0', 16);
        sfx.rotor();
      }

      /* ---- main gun: slow turret, long reload, enormous round ---- */
      const want = Math.atan2(pdy, pdx);
      t.turret = lerpAngle(t.turret, want, 1 - Math.exp(-1.9 * dt));
      t.cool -= dt;
      const aligned = Math.abs(Math.atan2(Math.sin(want - t.turret), Math.cos(want - t.turret)));
      if (t.cool <= 0 && pd < 1500 && aligned < 0.22 && this.hasLine(t.x, t.y, this.px, this.py)) {
        t.cool = 3.6;
        const lead = 0.34;
        const tx = this.px + this.pvx * lead, ty = this.py + this.pvy * lead;
        const travel = clamp(Math.hypot(tx - t.x, ty - t.y) / 900, 0.4, 1.5);
        this.enemyNades.push({
          x: t.x + Math.cos(t.turret) * 66, y: t.y + Math.sin(t.turret) * 66,
          tx, ty, t: travel, total: travel, z: 0, dmg: 240, radius: 175, shell: true,
        });
        this.addText(t.x, t.y - 88, 'MAIN GUN', '#ffcf7a', 15);
        this.addLight(t.x, t.y, 460, '255,190,110', 0.55);
        this.shocks.push({ x: t.x + Math.cos(t.turret) * 70, y: t.y + Math.sin(t.turret) * 70, r: 6, max: 90, life: 0.22, t: 0.22, color: '255,205,140', width: 6 });
        sfx.shoot('rocket');
      }

      /* ---- heavy, deliberate tracks ---- */
      // If the operative slips away the escort rolls after them: armour follows
      // the column, and the column is wherever the shooting is.
      t.aimT = (t.aimT ?? 0) - dt;
      /* Armour chases a man on foot. It does NOT chase an aircraft it cannot catch: while
       * the operative is airborne the hulls stay on their air-defence posts and shoot up. */
      if (!this.playerJet && pd > 1150 && t.aimT <= 0) {
        t.aimT = 2.5;
        t.goalX = clamp(this.px - Math.cos(Math.atan2(pdy, pdx)) * 360, 300, ARENA_W - 300);
        t.goalY = clamp(this.py - Math.sin(Math.atan2(pdy, pdx)) * 360, 300, ARENA_H - 300);
      }
      const gx = t.goalX - t.x, gy = t.goalY - t.y;
      const gd = Math.hypot(gx, gy) || 1;
      let targetSpeed = pd < 520 || gd < 110 ? 0 : 132;
      const desired = Math.atan2(gy, gx);
      const turn = Math.atan2(Math.sin(desired - t.ang), Math.cos(desired - t.ang));
      t.ang += clamp(turn, -dt * 0.8, dt * 0.8);
      t.lean = lerp(t.lean, clamp(turn * 0.3, -0.2, 0.2), 1 - Math.exp(-3 * dt));
      if (Math.abs(turn) > 0.9) targetSpeed = Math.min(targetSpeed, 26);
      t.speed = lerp(t.speed, targetSpeed, 1 - Math.pow(0.05, dt));
      if (t.speed > 0.5) {
        const next = { x: t.x + Math.cos(t.ang) * t.speed * dt, y: t.y + Math.sin(t.ang) * t.speed * dt };
        const probe = { ...next }; this.collide(probe, 48);
        if (Math.hypot(probe.x - next.x, probe.y - next.y) < 0.5) { t.x = next.x; t.y = next.y; }
        else {
          // Heavy hull grinds to a stop, then pivots for a fresh line.
          t.speed = 0;
          t.ang += (t.id % 2 ? 1 : -1) * dt * 0.9;
          t.goalX += Math.cos(t.ang) * 90; t.goalY += Math.sin(t.ang) * 90;
        }
      }
      // Tracks churn dust; a hurt tank bleeds smoke.
      if (t.speed > 18 && Math.random() < dt * 16)
        this.addParticle(t.x - Math.cos(t.ang) * 84 + rand(-24, 24), t.y - Math.sin(t.ang) * 84 + rand(-24, 24),
          rand(-14, 14), rand(-18, 8), rand(0.5, 1), rand(3, 6), '#6f7a72', false);
      if (t.hp < t.maxHp * 0.65 && Math.random() < dt * 22)
        this.addParticle(t.x + rand(-26, 26), t.y + rand(-26, 26), rand(-10, 10), -rand(20, 52),
          rand(0.5, 1.2), rand(3, 7), t.hp < t.maxHp * 0.3 ? '#20211f' : '#6d6257', true);
    }
  }

  /** Tanks only feel explosives, and even then they shrug most of it off. */
  private hurtTank(t: Tank, dmg: number) {
    if (t.dead) return;
    // A driven hull is the operative's own vehicle: splash from its own gun must not
    // chew through it while it sits there firing.
    if (t.captured && this.playerTank === t) return;
    t.hp -= dmg * 0.5;
    this.sparks(t.x, t.y, '#ffd166', 6);
    if (t.hp <= 0) this.killTank(t);
  }

  private killTank(t: Tank) {
    if (t.dead) return;
    const mine = t.captured;
    t.dead = true;
    if (this.playerTank === t) this.playerTank = null;
    if (mine) {
      this.explode(t.x, t.y, 250, 0, true);
      this.addText(t.x, t.y - 96, 'TANK DESTROYED', '#ff8f7a', 18);
      return;
    }
    this.score += 6000;
    this.addText(t.x, t.y - 96, 'CONVOY TANK DESTROYED +6000', '#ffd166', 18);
    this.setBanner('CONVOY TANK DESTROYED', 'THEIR ARMOUR WILL REMEMBER THIS');
    this.explode(t.x, t.y, 250, 0, true);
    for (let i = 0; i < 46; i++) {
      const a = rand(0, TAU), v = rand(90, 520);
      this.addParticle(t.x, t.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 1.1), rand(3, 9), i % 3 ? '#4a4a44' : '#ffb25c', true);
    }
  }

  /** Spark a blown tyre: skid, smoke, engine dead. Tanks ignore this entirely. */
  private disableTruck(t: Truck) {
    if (t.dead || t.disabled) return;
    t.disabled = true; t.skidT = 1.15;
    this.addText(t.x, t.y - 62, 'TYRE BLOWN / VEHICLE STOPPED', '#ffb08a', 13);
    this.sparks(t.x, t.y, '#ffd166', 10);
    this.addLight(t.x, t.y, 240, '255,180,120', 0.3);
  }

  private disableVan(v: Van) {
    if (v.dead || v.disabled) return;
    v.disabled = true; v.skidT = 1;
    v.speed = Math.min(v.speed, 80);
    this.addText(v.x, v.y - 58, 'TYRE BLOWN / TRANSPORT STOPPED', '#ffb08a', 12);
    this.sparks(v.x, v.y, '#ffd166', 8);
  }

  private updateResponseOrders(dt: number) {
    this.responseTimer -= dt;
    if (this.responseTimer > 0 || !this.responseOrders.length || this.trucks.filter(t => !t.dead && !t.disabled && t.state !== 'leave').length >= 22) return;
    const order = this.responseOrders[0];
    const roster = ['commander', 'warden', 'grunt', 'gunner', 'pathfinder', 'breacher', 'grunt', 'medic'];
    const comp = roster.slice(0, Math.min(order.size, order.units));
    const id = this.nextSquadId++;
    this.makeSquad(id, comp, order.sent % 2 ? 'pincer' : 'phalanx', order.target);
    this.dispatchTruck(comp, id, order.target, order.id, 0.4);
    order.units -= comp.length; order.sent++;
    if (order.units <= 0) this.responseOrders.shift();
    this.responseTimer = 1.4;
  }

  private updatePatrolTeams(dt: number) {
    // One bucket pass per frame: a thousand sleeping soldiers must not be re-filtered
    // once for every marching column on the map.
    const byTeam = new Map<string, Enemy[]>();
    for (const e of this.enemies) {
      if (!e.patrolTeam) continue;
      const list = byTeam.get(e.patrolTeam);
      if (list) list.push(e); else byTeam.set(e.patrolTeam, [e]);
    }
    for (const p of this.patrolTeams) {
      // Every beat marches, whether or not the operative is near: a street full of
      // frozen police officers was the whole complaint.
      const members = byTeam.get(p.id) || [];
      if (!members.length) continue;
      if (members.some(e => e.alert)) {
        for (const e of members) e.alert = true;
        // An alert holds the column only while someone can actually see the operative.
        const watching = members.some(e =>
          Math.hypot(e.x - this.px, e.y - this.py) < 520 && this.hasLine(e.x, e.y, this.px, this.py));
        p.huntT = watching ? 6 : Math.max(0, (p.huntT ?? 0) - dt);
        if (!watching && (p.huntT ?? 0) <= 0) {
          for (const e of members) { e.alert = false; e.homeX = e.x; e.homeY = e.y; }
          p.wait = 0.5;
        } else {
          continue;
        }
      }
      p.wait = Math.max(0, p.wait - dt);
      if (p.wait > 0) continue;
      const goal = p.points[p.node];
      // March along the street plan: a column that walks straight at its beat point ends
      // up grinding against the first building in the way.
      const wp = this.teamWaypoint(p, goal);
      const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1;
      p.angle = lerpAngle(p.angle, Math.atan2(dy, dx), 1 - Math.exp(-2.5 * dt));
      // Road and apron columns march faster than foot patrols inside a compound.
      const march = p.speed ?? (p.kind === 'road' ? 74 : p.kind === 'apron' ? 62 : 58);
      const step = Math.min(d, march * dt);
      const nx = p.x + (dx / d) * step, ny = p.y + (dy / d) * step;
      if (!this.pointBlocked(nx, ny)) { p.x = nx; p.y = ny; }
      else if (!this.pointBlocked(nx, p.y)) p.x = nx;          // slide along the wall
      else if (!this.pointBlocked(p.x, ny)) p.y = ny;
      else {
        // Cornered: take the next leg of the beat instead of grinding in place.
        p.node = (p.node + 1) % p.points.length; p.wait = 0.35;
      }
      if (Math.hypot(goal.x - p.x, goal.y - p.y) < 30) {
        p.node = (p.node + 1) % p.points.length; p.wait = p.kind === 'road' ? 0.6 : 1.6;
      }
    }
  }

  /** Terrain matters: tarmac is fast, sand is sluggish. */
  clearInput() {
    this.keys = {}; this.firing = false;
    this.moveStick.active = false; this.aimStick.active = false;
  }

  activateAegis() {
    if (this.status !== 'playing' || this.aegisCharges <= 0 || this.aegisTime > 0) return;
    this.aegisCharges--; this.aegisTime = 3;
    this.addText(this.px, this.py - 50, 'AEGIS / 3 SECONDS', '#99edff', 16);
    this.addLight(this.px, this.py, 200, '90,215,255', 0.4);
    sfx.pickup();
  }

  toggleVaultRoute() {
    if (this.status !== 'playing') return;
    this.vaultNav = !this.vaultNav;
    if (this.vaultNav) this.addText(this.px, this.py - 60, 'VAULT GUIDE / X 980 Y 7040', '#9cdecd', 14);
  }

  private rebuildNavigation() {
    const locked = this.gates.filter(g => g.locked && g.hp > 0).flatMap(g => gateBlocks({ ...g, open: 0 }));
    /* THE SEA IS NOT ROUTEABLE. Water is painted into both planners as permanent no-go
     * ground — infinite move cost — so a route plan can never send a soldier, a lorry or a
     * tank out over open water, however tempting the straight line looks. */
    const key = `${this.sector}:${this.dryLand.length}:${this.bridgeDown ? 1 : 0}`;
    if (key !== this.terrainKey) {
      this.terrainKey = key;
      const dry = (x: number, y: number) => !this.inWater(x, y);
      this.routes.setTerrain(dry);
      this.infantryRoutes.setTerrain(dry);
    }
    this.routes.rebuild([...this.obstacles.filter(o => !o.dead), ...locked]);
    this.infantryRoutes.rebuild([...this.obstacles.filter(o => !o.dead), ...locked]);
    this.navigationDirty = false;
  }

  toggleGate() {
    if (this.status !== 'playing' || this.piloting || this.flyingPlane) return;
    const gate = this.gates.filter(g => g.hp > 0 && Math.hypot(g.x - this.px, g.y - this.py) < 165)
      .sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py))[0];
    if (!gate) return;
    gate.locked = !gate.locked;
    this.navigationDirty = true;
    this.addText(gate.x, gate.y - 64, gate.locked ? 'HYDRAULICS LOCKED' : 'ACCESS RESTORED', gate.locked ? '#ffb19b' : '#7cf6d4', 14);
    sfx.click();
  }

  /** Rebuild the trigger buckets once per tick: O(enemies) instead of O(gates x enemies). */
  private rebuildEnemyBuckets() {
    const cell = this.bucketCell;
    this.enemyBuckets.clear();
    this.squadMembers.clear();
    for (const e of this.enemies) {
      const key = Math.floor(e.y / cell) * 512 + Math.floor(e.x / cell);
      const bucket = this.enemyBuckets.get(key);
      if (bucket) bucket.push(e); else this.enemyBuckets.set(key, [e]);
      if (e.squadId > 0 && e.spawnT <= 0 && e.boardingTruck === undefined) {
        const mates = this.squadMembers.get(e.squadId);
        if (mates) mates.push(e); else this.squadMembers.set(e.squadId, [e]);
      }
    }
  }

  /** Enemies whose centre lies within r of a point (bucket granularity matches the old scans). */
  private enemiesNear(x: number, y: number, r: number): Enemy[] {
    const cell = this.bucketCell, out: Enemy[] = [];
    const gx0 = Math.floor((x - r) / cell), gx1 = Math.floor((x + r) / cell);
    const gy0 = Math.floor((y - r) / cell), gy1 = Math.floor((y + r) / cell);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const bucket = this.enemyBuckets.get(gy * 512 + gx);
        if (!bucket) continue;
        for (const e of bucket) out.push(e);
      }
    }
    return out;
  }

  private updateGates(dt: number) {
    for (const g of this.gates) {
      if (g.hp <= 0) { g.open = 1; continue; }
      const pdx = this.px - g.x, pdy = this.py - g.y;
      const playerD2 = pdx * pdx + pdy * pdy;
      // Only troops inside the gate's own neighbourhood can trigger it.
      const locals = this.enemiesNear(g.x, g.y, 200);
      let occupied = playerD2 < 55 * 55;
      let near = playerD2 < 200 * 200;
      let breachRate = 0;
      const reach = g.span * 0.65, reach2 = reach * reach;
      for (const e of locals) {
        const dx = e.x - g.x, dy = e.y - g.y, d2 = dx * dx + dy * dy;
        if (d2 < 43 * 43) occupied = true;
        if (!e.def.civilian && d2 < 135 * 135) near = true;
        if (g.locked && g.open < 0.7 && !e.def.civilian && d2 < reach2) {
          breachRate += e.type === 'breacher' ? 19 : 7;
        }
      }
      if (!near && (this.helis.length || this.trucks.length)) {
        near = this.helis.some(h => (h.altitude ?? 65) < 10 && Math.hypot(h.x - g.x, h.y - g.y) < 240)
          || this.trucks.some(t => !t.dead && Math.hypot(t.x - g.x, t.y - g.y) < 270);
      }
      const target = (!g.locked && near) || (occupied && g.open > 0.75) ? 1 : 0;
      const change = dt * 0.65;
      g.open = target > g.open ? Math.min(1, g.open + change) : Math.max(0, g.open - change);
      if (g.locked && g.open < 0.7) {
        g.hp -= breachRate * dt;
        if (g.hp <= 0) {
          this.navigationDirty = true;
          this.addText(g.x, g.y - 65, 'HYDRAULIC GATE BREACHED', '#ffa58d', 15);
          this.sparks(g.x, g.y, '#ffc48f', 20); sfx.explode();
        }
      }
    }
    this.gateLeaves.length = 0;
    for (const g of this.gates) for (const rect of gateBlocks(g)) this.gateLeaves.push({ rect, gate: g });
    this.dynamicRects = this.gateLeaves.map(l => l.rect).concat(this.barricades.filter(b => b.hp > 0).map(b =>
      Math.abs(Math.cos(b.ang)) > 0.7 ? { x: b.x - 80, y: b.y - 15, w: 160, h: 30 } : { x: b.x - 15, y: b.y - 80, w: 30, h: 160 }));
    this.rebuildDynamicBuckets();
  }

  /** Moving gate leaves / barricades are hashed per tick so local queries stay cheap. */
  private rebuildDynamicBuckets() {
    const cell = 256;
    this.dynBuckets.clear();
    for (const b of this.dynamicRects) {
      const x0 = Math.floor(b.x / cell), x1 = Math.floor((b.x + b.w) / cell);
      const y0 = Math.floor(b.y / cell), y1 = Math.floor((b.y + b.h) / cell);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const key = y * 512 + x;
          const bucket = this.dynBuckets.get(key);
          if (bucket) bucket.push(b); else this.dynBuckets.set(key, [b]);
        }
      }
    }
  }

  /** Unique dynamic blocks overlapping an AABB (shared scratch, never nested). */
  private dynamicNear(x0: number, y0: number, x1: number, y1: number): Block[] {
    const cell = 256, out = this.dynScratch;
    out.length = 0;
    if (!this.dynBuckets.size) return out;
    const gx0 = Math.floor(x0 / cell), gx1 = Math.floor(x1 / cell);
    const gy0 = Math.floor(y0 / cell), gy1 = Math.floor(y1 / cell);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const bucket = this.dynBuckets.get(gy * 512 + gx);
        if (!bucket) continue;
        for (const b of bucket) if (!out.includes(b)) out.push(b);
      }
    }
    return out;
  }

  groundFactor(x: number, y: number) {
    // Zones are painted in list order, so the LAST match is the one the operative actually
    // stands on (the bridge deck over the sea, a road over the beach, …).
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
      switch (z.kind) {
        case 'road': return 1.14;
        case 'plaza': return 1.08;
        case 'concrete': return 1.06;
        case 'helipad': return 1.1;
        case 'fuel': return 0.96;
        case 'sand': return 0.88;
        case 'grass': return 1.0;
        case 'lawn': return 1.03;
        case 'lagoon': return 0.72;   // shallow water: slow, loud, exposed
        default: return 1;
      }
    }
    return 1;
  }

  private updatePlayer(dt: number) {
    this.updateVault(dt);
    this.updatePrisonHint();
    this.updatePrisonDoor(dt);
    if (this.status !== 'playing') return;
    if (this.playerJet) { this.updatePlayerJet(dt); return; }
    if (this.flyingPlane) { this.updatePlane(dt); return; }
    if (this.drivingBoat) { this.updateDrivenBoat(dt); return; }
    if (this.drivingVan) { this.updateDrivenVan(dt); return; }
    if (this.playerTank) { this.updateDrivenTank(dt); return; }
    if (this.piloting) {
      this.updatePlayerHeli(dt);
      return;
    }
    const speed = 282 * this.mods.speedMul * this.groundFactor(this.px, this.py);
    const m = this.moveVector();
    if (this.mods.regen > 0 && this.hp > 0 && this.hp < this.maxHp)
      this.hp = Math.min(this.maxHp, this.hp + this.mods.regen * dt);

    if (this.dashT > 0) {
      this.dashT -= dt;
      const ds = 950 * (this.dashT / 0.19) + 250;
      this.pvx = Math.cos(this.dashAng) * ds; this.pvy = Math.sin(this.dashAng) * ds;
      if (Math.random() < 0.75) this.addParticle(this.px, this.py, rand(-30, 30), rand(-30, 30), 0.28, rand(3, 7), '#5ad7ff', true);
    } else {
      this.pvx = lerp(this.pvx, m.x * speed, 1 - Math.pow(0.0009, dt));
      this.pvy = lerp(this.pvy, m.y * speed, 1 - Math.pow(0.0009, dt));
    }
    const wasX = this.px, wasY = this.py;
    this.px = clamp(this.px + this.pvx * dt, 80, ARENA_W - 80);
    this.py = clamp(this.py + this.pvy * dt, 80, ARENA_H - 80);
    // The operative does not swim. Step along the shoreline instead of into the sea.
    if (this.inWater(this.px, this.py)) {
      if (!this.inWater(this.px, wasY)) { this.py = wasY; this.pvy = 0; }
      else if (!this.inWater(wasX, this.py)) { this.px = wasX; this.pvx = 0; }
      else { this.px = wasX; this.py = wasY; this.pvx = 0; this.pvy = 0; }
    }
    const body = { x: this.px, y: this.py };
    this.collide(body, 15);
    this.collideBarriers(body, 15);
    this.px = body.x; this.py = body.y;
    this.walkCycle += Math.hypot(this.pvx, this.pvy) * dt * 0.04;

    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.grenadeCd > 0) this.grenadeCd -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    this.recoil = lerp(this.recoil, 0, 1 - Math.pow(0.0001, dt));

    let wantFire = false;
    if (this.aimStick.active) {
      const dx = this.aimStick.x - this.aimStick.ox, dy = this.aimStick.y - this.aimStick.oy;
      if (Math.hypot(dx, dy) > 12) { this.pang = Math.atan2(dy, dx); wantFire = true; }
    } else if (!this.isTouch) {
      this.pang = Math.atan2(this.mouseY + this.camY - this.py, this.mouseX + this.camX - this.px);
      wantFire = this.firing;
    }
    if (this.isTouch && !this.aimStick.active && m.len > 0.2)
      this.pang = lerpAngle(this.pang, Math.atan2(m.y, m.x), 1 - Math.pow(0.0001, dt));

    if (wantFire && this.fireCd <= 0) this.shoot();

    const moving = Math.abs(this.pvx) + Math.abs(this.pvy);
    const gf = this.groundFactor(this.px, this.py);
    if (moving > 90 && Math.random() < (gf < 0.95 ? 0.5 : 0.3))
      this.addParticle(this.px, this.py + 10, rand(-18, 18) - this.pvx * 0.06, rand(-16, 4) - this.pvy * 0.06,
        rand(0.3, 0.6), rand(1.5, 3.4), gf < 0.95 ? '#a08a5c' : '#6c7a73', false);

    // breach detection
    const inHQ = Math.abs(this.px - HQ.cx) < HQ.w / 2 && Math.abs(this.py - HQ.cy) < HQ.h / 2;
    if (inHQ && !this.hqBreached) {
      this.hqBreached = true; this.garrisonAlerted = true;
      this.setBanner('⚠ FORTRESS BREACHED', 'GARRISON RESPONDING — DESTROY THE MAINFRAMES');
      this.objective = 'DESTROY 6 MAINFRAMES';
      sfx.wave();
    }
  }

  /** Hydra hangars park real bombers: the nearest one you could seize with F. */
  private parkedPlaneNear(range = 210): Rect | null {
    let best: Rect | null = null, bd = range;
    for (const o of this.obstacles) {
      if (o.kind !== 'plane' || o.dead) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const d = Math.hypot(cx - this.px, cy - this.py);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /**
   * Seize a bomber parked inside a Hydra hangar. It uses exactly the same
   * NIGHTJAR systems as the vault aircraft (flight, cannons, carpet bombing),
   * so nothing new has to be learned to fly it.
   */
  private seizeParkedPlane(o: Rect) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (this.plane) {
      this.addText(cx, cy - 80, 'BOMBER ALREADY IN SERVICE', '#ffcf7a', 13);
      return;
    }
    o.dead = true;
    this.navigationDirty = true;
    this.plane = {
      x: cx, y: cy, vx: 0, vy: 0, ang: -Math.PI / 2, bank: 0,
      hp: 1200, maxHp: 1200, bombCd: 0, gunCd: 0, fuel: 100, active: false,
    };
    this.score += 2500;
    this.addText(cx, cy - 80, 'HYDRA BOMBER SEIZED +2500', '#8be8ff', 18);
    this.setBanner('HYDRA BOMBER SEIZED', 'IT FLIES UNDER S.H.I.E.L.D. COLORS NOW');
    sfx.wave();
    this.enterPlane();
  }

  /** Master interact: aircraft, vans, beam batteries, barricades, the black vault. */
  interactHeli() {
    // Mid-chain, F is the abort: the order is the operative's, and so is cancelling it.
    if (this.launch) { this.abortTakeoff('CHAIN CANCELLED BY THE PILOT'); return; }
    // Taking a suppressed emplacement comes first: it is the same key, and it only
    // ever fires when the operative is standing inside one.
    if (this.tryCaptureTurret()) return;
    if (this.status !== 'playing') return;
    // exit whatever we are piloting first
    if (this.playerJet) { this.exitJet(); return; }
    const jet = this.nearArmyJet();
    if (jet) { this.seizeJet(jet); return; }
    if (this.flyingPlane && this.plane) { this.exitPlane(); return; }
    if (this.playerTank) { this.exitTank(); return; }
    if (this.drivingBoat) { this.exitBoat(); return; }
    if (this.drivingVan) { this.exitVan(); return; }
    if (this.piloting) { this.boardGunship(); return; }
    const mc = this.megaCrates.find((c) => !c.dead && Math.hypot(this.px - c.x, this.py - c.y) < 100);
    if (mc) {
      this.breakMegaCrate(mc);
      return;
    }
    const poiCore = this.pois.find((p) => !p.secret && !p.captured && Math.hypot(this.px - p.x, this.py - p.y) < 170);
    if (poiCore && !this.baseOverride.active) {
      /* WHO IS ACTUALLY DEFENDING?
       *
       * The reported bug: every defender is dead and the uplink still says "N DEFENDERS
       * REMAIN", so the point can never be taken. The count was taken over 0.8 x the
       * poi radius — 1 200 px on the IRON RESERVE, 1 440 px on the airfield — so a single
       * trooper dozing three blocks away, or a man in a truck on the far side of the
       * compound, held the objective down from off screen.
       *
       * The count is now the ground the operative is actually standing on: his own
       * capture circle, capped so it can never reach across a compound. Men who are
       * asleep, still materialising, in a transport, civilian, or simply not in the fight
       * are not defenders. If the count is zero the uplink opens — on the same key press. */
      const capR = Math.min(560, Math.max(300, poiCore.r * 0.32));
      const defenders = this.enemies.filter((e) =>
        !e.def.civilian && e.hp > 0 && e.spawnT <= 0 && !e.dormant
        && e.boardingTruck === undefined
        && Math.hypot(e.x - poiCore.x, e.y - poiCore.y) < capR);
      /* A GARRISON THAT CANNOT REACH YOU IS NOT HOLDING THE POINT.
       *
       * The last version of this bug: the count said "defenders remain" forever because one
       * of them was asleep in a room, wedged behind a wall, or simply never given a path.
       * Standing on the point for six seconds with no defender able to draw a line to you
       * opens the uplink — the ground is yours because nobody is contesting it. */
      const seen = defenders.some((e) => this.hasLine(e.x, e.y, this.px, this.py));
      this.uplinkHold = seen ? 0 : this.uplinkHold + 1;
      if (defenders.length > 0 && this.uplinkHold < 6) {
        // Say where the hold-outs are: "3 remain" with no direction is what makes a
        // cleared objective feel broken.
        let nearest = defenders[0], nd = Infinity;
        for (const e of defenders) {
          const d = Math.hypot(e.x - this.px, e.y - this.py);
          if (d < nd) { nd = d; nearest = e; }
        }
        void nearest;
        this.addText(this.px, this.py - 48, `UPLINK LOCKED / ${defenders.length} DEFENDERS WITHIN ${Math.round(capR)} m`, '#ff9d9d', 13);
        this.addText(this.px, this.py - 28, `NEAREST HOLD-OUT ${Math.round(nd)} m ${this.compassTo(nearest.x, nearest.y)}`, '#ffc9a0', 11);
        // and F is not swallowed: the operative learns to walk over and finish it
      } else {
        if (defenders.length > 0) this.addText(this.px, this.py - 48, 'GARRISON UNREACHABLE — UPLINK OPEN', '#a9ecff', 14);
        this.startBaseOverride(poiCore);
      }
      return;
    }
    if (Math.hypot(PRISON_DOOR.x - this.px, PRISON_DOOR.y - this.py) < 230) { this.enterPrison('visit'); return; }
    if (this.glacierSpot && Math.hypot(this.glacierSpot.x - this.px, this.glacierSpot.y - this.py) < 280) { this.enterGlacier(); return; }
    if (this.stockadeSpot && !this.stockadeOpen) {
      const st = this.stockadeSpot;
      if (this.px > st.x - 90 && this.px < st.x + st.w + 90 && this.py > st.y - 90 && this.py < st.y + st.h + 90) {
        this.breakStockade(st);
        return;
      }
    }
    if (Math.hypot(this.px - VAULT_ENTRY.x, this.py - VAULT_ENTRY.y) < 130) { this.enterVault(); return; }
    const sites = this.campaignSites;
    const volume = sites?.volumes.find(v => Math.hypot(v.x - this.px, v.y - this.py) < 88);
    if (sites && volume && !sites.librarySolved) {
      if (this.archiveReadCooldown > 0) return;
      this.archiveReadCooldown = 0.5;
      this.tellStory(LIBRARY_VOLUMES[volume.number - 1], 14);
      const order = [3, 1, 2];
      if (volume.number === order[sites.libraryProgress]) { volume.read = true; sites.libraryProgress++; }
      else { sites.libraryProgress = volume.number === 3 ? 1 : 0; sites.volumes.forEach(v => v.read = v.number === 3 && sites.libraryProgress === 1); }
      if (sites.libraryProgress === 3) {
        sites.librarySolved = true; this.security.jammed = 60; this.security.active = false;
        this.score += 6500; this.mods.emp += 0.3;
        this.tellStory({ id: 'library-unlocked', channel: 'CARTER CIPHER / IDENTITY MASK ACTIVE', title: 'The network remembers its first oath.', text: 'The three volumes unlock an original S.H.I.E.L.D. identity. Searchlights will ignore you for sixty seconds. Existing reaction teams are still on the road. EMP damage is permanently increased for this campaign. Carter left you a way through.' }, 15);
        this.dropPickup(MNEMOSYNE.x, MNEMOSYNE.y + 185, 'aegis'); sfx.wave();
      } else sfx.click();
      return;
    }

    // 1) the hidden S.H.I.E.L.D. vault always wins — it is the rarest thing on the map
    if (this.vaultOpen && this.vaultChoice === 'offer' &&
        Math.hypot(this.planeSpot.x - this.px, this.planeSpot.y - this.py) < 260) {
      this.claimVaultAircraft('plane');
      return;
    }
    // 2) recovered bomber / gunship parked in the vault
    if (this.plane && !this.flyingPlane && Math.hypot(this.plane.x - this.px, this.plane.y - this.py) < 170) {
      this.enterPlane(); return;
    }
    // 2b) a bomber parked inside a Hydra hangar — seize it
    const parkedPlane = this.parkedPlaneNear(210);
    if (parkedPlane) { this.seizeParkedPlane(parkedPlane); return; }
    // 3) capture a beam battery
    const laser = this.lasers.find((l) => !l.captured && Math.hypot(l.x - this.px, l.y - this.py) < 120);
    if (laser) {
      const guards = this.enemies.filter((e) => !e.def.civilian && Math.hypot(e.x - laser.x, e.y - laser.y) < 420).length;
      if (guards > 0) {
        this.addText(this.px, this.py - 44, `CLEAR ${guards} GUARDS FIRST`, '#ff9d9d', 13);
      } else {
        laser.captured = true;
        laser.cool = 1.2;
        this.score += 6000;
        this.flash = 0.5; this.flashColor = '120,235,255';
        this.addLight(laser.x, laser.y, 620, '120,235,255', 0.8);
        this.setBanner('BEAM BATTERY CAPTURED', 'S.H.I.E.L.D. NOW CONTROLS THE CANNON');
        this.addText(laser.x, laser.y - 70, '+6000 CAPTURED', '#8be8ff', 22);
        sfx.wave();
      }
      return;
    }
    // 4) barricade a cleared base gate
    if (this.tryBarricade()) return;
    // 5) nearest parked gunship inside an airfield hangar
    const parked = this.parkedHelis.find((p, index) => !p.taken && !this.helis.some(h => h.home === index) && Math.hypot(p.x - this.px, p.y - this.py) < 120);
    if (parked) {
      parked.taken = true;
      if (!this.playerHeli) this.playerHeli = makeHeli(parked.x, parked.y, parked.ang);
      this.playerHeli.x = parked.x; this.playerHeli.y = parked.y;
      this.playerHeli.hp = this.playerHeli.maxHp; this.playerHeli.fuel = 100;
      this.score += 2500;
      this.addText(parked.x, parked.y - 80, 'AIRCRAFT SEIZED +2500', '#8be8ff', 18);
      this.boardGunship();
      return;
    }
    // 5b) seize a convoy tank — the hardest and best prize on the road
    const ownTank = this.tanks.find((q) => !q.dead && q.captured && !q.driven && Math.hypot(q.x - this.px, q.y - this.py) < 170);
    if (ownTank) { this.boardTank(ownTank, true); return; }
    const tank = this.tanks.find((q) => !q.dead && !q.captured && Math.hypot(q.x - this.px, q.y - this.py) < 170);
    if (tank) { this.boardTank(tank); return; }
    // 5c) take a boat — Hydra's or one of the moored skiffs
    const boat = this.boats
      .filter((b) => b.state !== 'sunk')
      .sort((a, b) => Math.hypot(a.x - this.px, a.y - this.py) - Math.hypot(b.x - this.px, b.y - this.py))[0];
    if (boat && Math.hypot(boat.x - this.px, boat.y - this.py) < 160) { this.enterBoat(boat); return; }
    // 6) requisition a parked vehicle, or stop and take one already on the road
    const prop = this.nearDriveProp();
    if (prop) { this.requisitionVehicle(prop); return; }
    const moving = this.nearTrafficCar();
    if (moving) { this.commandeerTraffic(moving); return; }
    // 7) drive a van
    const van = this.vans.find((v) => !v.dead && !v.reserved && !v.disabled && Math.hypot(v.x - this.px, v.y - this.py) < 110);
    if (van) { this.enterVan(van); return; }
    // 7) fall back to the personal gunship
    this.boardGunship();
  }

  /** Seal a captured base: once every gate is welded shut Hydra throws everything at you. */
  private tryBarricade(): boolean {
    for (const poi of this.pois) {
      if (poi.secret || poi.gates.length === 0) continue;
      for (const g of poi.gates) {
        if (g.built) continue;
        if (Math.hypot(g.x - this.px, g.y - this.py) > 150) continue;
        const hostiles = this.enemies.filter(
          (e) => !e.def.civilian && Math.hypot(e.x - poi.x, e.y - poi.y) < poi.r,
        ).length;
        if (hostiles > 0) {
          this.addText(this.px, this.py - 44, `${hostiles} HOSTILES STILL INSIDE`, '#ff9d9d', 13);
          return true;
        }
        g.built = true;
        const ang = Math.atan2(g.y - poi.y, g.x - poi.x) + Math.PI / 2;
        this.barricades.push({ x: g.x, y: g.y, hp: 1700, maxHp: 1700, ang });
        this.score += 1500;
        this.addText(g.x, g.y - 40, 'GATE WELDED +1500', '#8dffb0', 17);
        this.addLight(g.x, g.y, 260, '140,255,190', 0.4);
        sfx.pickup();
        const left = poi.gates.filter((q) => !q.built).length;
        if (left > 0) {
          this.setBanner('BARRICADE RAISED', `${left} GATE${left > 1 ? 'S' : ''} REMAINING`);
        } else {
          poi.captured = true;
          this.beginSiege(poi);
        }
        return true;
      }
    }
    return false;
  }

  /** Hydra will not accept losing a base: dozens of trucks and a horde converge. */
  private beginSiege(poi: PoiState) {
    this.siege = { active: true, t: 0, poi: poi.id, waves: 0 };
    this.score += 8000;
    this.flash = 0.6; this.flashColor = '255,120,110';
    this.setBanner(`${poi.name} CAPTURED`, 'HYDRA COUNTER-ASSAULT INBOUND — HOLD THE WALLS');
    this.objective = `HOLD ${poi.name}`;
    sfx.siren();

    const gates = poi.gates.length ? poi.gates : [{ x: poi.x, y: poi.y + poi.r, built: true, hp: 0 }];
    const truckCount = 18 + this.sector * 4 + this.siege.waves * 4;
    for (let i = 0; i < truckCount; i++) {
      const g = gates[i % gates.length];
      const a = Math.atan2(g.y - poi.y, g.x - poi.x);
      const dist = 1500 + (i % 7) * 240;
      const lane = ((i % 5) - 2) * 130;
      const id = this.nextSquadId++;
      const comp = this.squadComp(i % 2 === 0 ? 'phalanx' : 'blitz', this.wave + 3);
      this.squads.push({
        id, tactic: i % 2 === 0 ? 'phalanx' : 'blitz', state: 'advance', doctrine: 'hunter',
        size: comp.length, stateT: 0, barkCd: rand(1, 3), angle: rand(0, TAU), radius: rand(230, 300),
        volleyT: rand(1.2, 2.6), volleyWindow: 0, grenadeT: rand(2, 5),
        cx: g.x, cy: g.y, fx: this.px, fy: this.py, facing: 0,
        cohesion: 1, morale: 1, anchorX: g.x, anchorY: g.y,
      });
      this.trucks.push({
        x: clamp(poi.x + Math.cos(a) * dist - Math.sin(a) * lane, 120, ARENA_W - 120),
        y: clamp(poi.y + Math.sin(a) * dist + Math.cos(a) * lane, 120, ARENA_H - 120),
        tx: g.x, ty: g.y, ang: a + Math.PI,
        state: 'drive', squadId: id, comp, slot: 0, deployT: 0,
        hp: 330 + this.sector * 20, maxHp: 330 + this.sector * 20,
        dead: false, announced: false, speed: 0, lean: 0,
        rescue: false, carrying: 0, rescueWait: 0,
      });
    }
    // Massed infantry pouring in on foot behind the armor.
    for (let i = 0; i < 56 + this.sector * 10 + this.siege.waves * 12; i++) {
      const g = gates[i % gates.length];
      const a = Math.atan2(g.y - poi.y, g.x - poi.x) + rand(-0.55, 0.55);
      const dist = 1250 + rand(0, 900);
      const id = this.nextSquadId++;
      this.squads.push({
        id, tactic: 'column', state: 'advance', doctrine: 'hunter',
        size: 1, stateT: 0, barkCd: rand(2, 6), angle: rand(0, TAU), radius: 240,
        volleyT: rand(1, 3), volleyWindow: 0, grenadeT: rand(3, 8),
        cx: poi.x, cy: poi.y, fx: this.px, fy: this.py, facing: 0,
        cohesion: 1, morale: 1, anchorX: poi.x, anchorY: poi.y,
      });
      const pool = ['grunt', 'rusher', 'gunner', 'raider', 'shieldman', 'warhound'];
      this.spawnQueue.push({
        type: pool[Math.floor(Math.random() * pool.length)],
        t: 1.5 + i * 0.16, squadId: id, slot: 0,
        x: clamp(poi.x + Math.cos(a) * dist, 120, ARENA_W - 120),
        y: clamp(poi.y + Math.sin(a) * dist, 120, ARENA_H - 120),
      });
    }
    const siegeHelis = 2 + this.sector + this.siege.waves;
    for (let i = 0; i < siegeHelis; i++) {
      this.helis.push({
        x: HQ.cx, y: HQ.cy, tx: poi.x + rand(-300, 300), ty: poi.y + rand(-300, 300),
        ang: 0, rotor: 0, state: 'ingress',
        hp: 460 + this.sector * 30, maxHp: 460 + this.sector * 30,
        cool: rand(0.5, 2), rocketCd: rand(2, 5), t: 0,
        orbitA: rand(0, TAU), medevac: false, carrying: 0, announced: false, bank: 0,
      });
    }
    // MANTIS transports deliver part of the infantry by rope, over the walls.
    const mantisRuns = 1 + this.siege.waves;
    for (let m = 0; m < mantisRuns; m++) {
      const comp = ['grunt', 'gunner', 'grunt', 'rusher', 'flamer', 'grunt', 'gunner', 'grunt'];
      const id = this.nextSquadId++;
      this.makeSquad(id, comp, m % 2 ? 'blitz' : 'column', { x: poi.x, y: poi.y });
      this.launchAirlift('mantis', comp, id, { x: poi.x + rand(-220, 220), y: poi.y + rand(-220, 220) });
    }
  }

  /**
   * Walking into the sally port IS the entry: the operative does not need to find F.
   * The F prompt still works, this simply removes the chance of standing in the doorway
   * and nothing happening.
   */
  private updatePrisonDoor(dt: number) {
    if (this.prisonReentry > 0) this.prisonReentry = Math.max(0, this.prisonReentry - dt);
    if (this.status !== 'playing' || this.prisonReentry > 0) return;
    if (this.piloting || this.flyingPlane || this.drivingVan || this.playerTank) return;
    // The sally port is a gateway: any step inside its mouth takes you through.
    // You have to be in the mouth of the gate, not merely walking past the forecourt.
    const inGate = this.px > PRISON_DOOR.x - 60 && this.px < PRISON_DOOR.x + 90
      && Math.abs(this.py - PRISON_DOOR.y) < 125;
    if (inGate) this.enterPrison('visit');
  }

  /** The Cage is optional content, so the island announces itself once you get close. */
  private updatePrisonHint() {
    if (this.prisonHinted) return;
    if (Math.hypot(ISLAND.x - this.px, ISLAND.y - this.py) > 2600) return;
    this.prisonHinted = true;
    this.tellStory({
      id: 'the-cage',
      channel: 'HYDRA CORRECTIONAL / THE CAGE',
      title: 'THE CAGE — a prison island east of the theatre.',
      text: 'Concrete walls, eight watchtowers and one gate: THE CAGE. Cross the causeway bridge from the eastern coast, walk up the forecourt and step into the sally port. The 3D prison opens the moment you do — shoot the lock on your cell bars, reach the control rooms, or let every inmate out and come back out with a pistol you were never supposed to have.',
    }, 16);
  }

  /** Reveal the vault when the operative stumbles onto the buried hatch. */
  private updateVault(dt: number) {
    void dt;
    if (this.piloting || this.flyingPlane || this.drivingVan || this.playerTank) return;
    if (Math.hypot(this.px - VAULT_ENTRY.x, this.py - VAULT_ENTRY.y) < 48) this.enterVault();
  }

  /* ================================================================== */
  /* THE CAGE — arrest, the van ride, the 3D prison                      */
  /* ================================================================== */

  /**
   * Is the operative inside a vehicle, an aircraft or a boat?
   *
   * Custody officers arrest a man on foot. They cannot reach through a hull, a canopy, a
   * rotor disc or forty metres of air, and every one of these states means the operative
   * is not standing on the ground next to them. One helper, used by every arrest test, so
   * a new vehicle can never quietly forget to exclude itself again.
   */
  get inVehicleOrAir(): boolean {
    // `playerHeli` and `plane` survive after the operative steps out, so they only count
    // while he is actually flying them.
    return !!(this.playerJet || (this.piloting && this.playerHeli) || this.flyingPlane
      || this.drivingVan || this.drivingBoat || this.playerTank);
  }

  /** A custody officer got his hands on the operative. */
  private beginArrest(e: Enemy) {
    if (this.status !== 'playing') return;
    this.status = 'arrest';
    this.arrestT = this.arrestDuration;
    this.arrestStage = 0;
    this.arrestCount++;
    this.clearInput();
    this.firing = false;
    this.onArrestAnimChange(true);
    this.addText(this.px, this.py - 60, 'CUFFED', '#9fc2ff', 20);
    this.shocks.push({ x: e.x, y: e.y, r: 6, max: 90, life: 0.4, t: 0.4, color: '160,200,255', width: 6 });
    sfx.siren();
  }

  private updateArrest(dt: number) {
    this.arrestT -= dt;
    // stages: 0 cuffed, 1 shoved into the van, 2 the drive, 3 intake
    this.arrestStage = this.arrestT > this.arrestDuration * 0.78 ? 0
      : this.arrestT > this.arrestDuration * 0.5 ? 1
      : this.arrestT > this.arrestDuration * 0.16 ? 2 : 3;
    if (this.arrestT <= 0) {
      this.status = 'prison';
      this.onArrestAnimChange(false);
      this.onPrison('arrest');
    }
  }

  /** The back of a Hydra transport van: bars, road, two silent guards. */
  private renderArrest(ctx: CanvasRenderingContext2D) {
    const W = this.w, H = this.h;
    const p = clamp(1 - this.arrestT / this.arrestDuration, 0, 1);
    // Stage 0 is the street: an officer has your arms behind your back. Only after that
    // does the frame cut to the inside of the transport.
    if (this.arrestStage === 0) { this.renderCuffed(ctx, p); return; }
    const shake = Math.sin(this.arrestT * 31) * 3 + Math.sin(this.arrestT * 57) * 2;

    ctx.save();
    ctx.fillStyle = '#05080b';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(shake, Math.sin(this.arrestT * 23) * 2);

    // ---- rear doors of the van ----
    const vw = W * 0.66, vh = H * 0.62;
    const vx = (W - vw) / 2, vy = H * 0.16;
    ctx.fillStyle = '#11181c'; ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = '#26343a'; ctx.lineWidth = 6; ctx.strokeRect(vx, vy, vw, vh);
    // two door leaves
    ctx.strokeStyle = '#1c272c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(vx + vw / 2, vy); ctx.lineTo(vx + vw / 2, vy + vh); ctx.stroke();

    // ---- the road seen through the barred window ----
    const wy = vy + vh * 0.18, wh = vh * 0.28;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx + vw * 0.12, wy, vw * 0.76, wh); ctx.clip();
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#0b1a26'); sky.addColorStop(0.55, '#1d2f36'); sky.addColorStop(1, '#0a1114');
    ctx.fillStyle = sky; ctx.fillRect(vx, wy, vw, wh);
    // chasing headlights of the escort
    for (let i = 0; i < 2; i++) {
      const lx = vx + vw * (0.3 + i * 0.42) + Math.sin(this.simulationTime * 1.4 + i) * 12;
      const g = ctx.createRadialGradient(lx, wy + wh * 0.7, 2, lx, wy + wh * 0.7, 90);
      g.addColorStop(0, 'rgba(255,240,200,0.5)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, wy + wh * 0.7, 90, 0, TAU); ctx.fill();
    }
    // road rushing underneath
    ctx.strokeStyle = 'rgba(210,225,235,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const t = (this.simulationTime * 1.5 + i / 9) % 1;
      const y = wy + wh + t * wh * 0.9;
      const w = 40 + t * 160;
      ctx.beginPath(); ctx.moveTo(vx + vw / 2 - w, y); ctx.lineTo(vx + vw / 2 + w, y); ctx.stroke();
    }
    ctx.restore();

    // ---- bars of the window ----
    ctx.fillStyle = '#59666d';
    for (let i = 0; i <= 8; i++) ctx.fillRect(vx + vw * 0.12 + (vw * 0.76 / 8) * i - 2, wy, 4, wh);
    ctx.fillRect(vx + vw * 0.12, wy + wh / 2 - 2, vw * 0.76, 4);

    // ---- two guards on the bench opposite ----
    for (const side of [-1, 1]) {
      const gx = W / 2 + side * vw * 0.24;
      const gy = vy + vh * 0.72;
      ctx.fillStyle = '#1c2a34';
      ctx.beginPath(); ctx.ellipse(gx, gy + 40, 44, 30, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#243645';
      ctx.fillRect(gx - 36, gy - 40, 72, 86);
      ctx.fillStyle = '#0f171c';
      ctx.beginPath(); ctx.arc(gx, gy - 62, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3f6fd8';
      ctx.fillRect(gx - 36, gy - 8, 72, 8);
      // helmet visor
      ctx.fillStyle = Math.sin(this.simulationTime * 2 + side) > 0 ? '#6b8fbf' : '#22384f';
      ctx.fillRect(gx - 20, gy - 70, 40, 12);
    }

    // ---- handcuffs on the operative's wrists, bottom of frame ----
    ctx.strokeStyle = '#9fb0b8'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(W / 2 - 46, H * 0.94, 26, 0.2, Math.PI * 1.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2 + 46, H * 0.94, 26, -0.3, Math.PI * 0.8); ctx.stroke();
    ctx.strokeStyle = '#6d7d85'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 22, H * 0.94); ctx.lineTo(W / 2 + 22, H * 0.94); ctx.stroke();

    // ---- caption ----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7f6f6';
    ctx.font = '900 40px ui-monospace, monospace';
    ctx.fillText('ARRESTED', W / 2, H * 0.1);
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillStyle = '#8fb6c4';
    const line = this.arrestStage === 0 ? 'A CUSTODY OFFICER HAS YOU · THE FIGHT IS OVER FOR NOW'
      : this.arrestStage === 1 ? 'SHOVED INTO THE BACK OF A HYDRA TRANSPORT'
      : this.arrestStage === 2 ? 'NORTH ALONG THE COAST ROAD · THE CAGE IS WAITING'
      : 'INTAKE · THEY MISSED THE PISTOL IN YOUR WAISTBAND';
    ctx.fillText(line, W / 2, H * 0.1 + 26);

    // progress
    ctx.fillStyle = '#0d1a1e'; ctx.fillRect(W * 0.25, H * 0.9, W * 0.5, 5);
    ctx.fillStyle = '#9fc2ff'; ctx.fillRect(W * 0.25, H * 0.9, W * 0.5 * p, 5);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /** The half-second that matters: cuffs on the street, before the van. */
  private renderCuffed(ctx: CanvasRenderingContext2D, p: number) {
    const W = this.w, H = this.h;
    const t = this.simulationTime;

    // ---- night street, from eye level, seen over an officer's shoulder ----
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.66);
    sky.addColorStop(0, '#060a0e');
    sky.addColorStop(0.6, '#0f1a21');
    sky.addColorStop(1, '#1b262c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.66);
    // distant blocks
    ctx.fillStyle = '#0c141a';
    for (let i = 0; i < 9; i++) {
      const bw = 60 + ((i * 53) % 90), bh = 70 + ((i * 97) % 150);
      ctx.fillRect(i * (W / 9) - 10, H * 0.66 - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,214,150,0.20)';
      for (let wy = 0; wy < bh - 24; wy += 22) {
        for (let wx = 8; wx < bw - 14; wx += 20) if ((wx + wy + i) % 3) ctx.fillRect(i * (W / 9) + wx, H * 0.66 - bh + 12 + wy, 6, 9);
      }
      ctx.fillStyle = '#0c141a';
    }
    // tarmac
    const road = ctx.createLinearGradient(0, H * 0.62, 0, H);
    road.addColorStop(0, '#121a1e');
    road.addColorStop(1, '#05080a');
    ctx.fillStyle = road; ctx.fillRect(0, H * 0.62, W, H * 0.38);
    // wet reflections of the two light bars
    ctx.save();
    ctx.globalAlpha = 0.5;
    const refl = ctx.createLinearGradient(0, H * 0.64, 0, H);
    refl.addColorStop(0, 'rgba(90,150,255,0.30)');
    refl.addColorStop(1, 'rgba(90,150,255,0)');
    ctx.fillStyle = refl; ctx.fillRect(W * 0.06, H * 0.64, W * 0.30, H * 0.36);
    const refl2 = ctx.createLinearGradient(0, H * 0.64, 0, H);
    refl2.addColorStop(0, 'rgba(255,80,80,0.28)');
    refl2.addColorStop(1, 'rgba(255,80,80,0)');
    ctx.fillStyle = refl2; ctx.fillRect(W * 0.64, H * 0.64, W * 0.30, H * 0.36);
    ctx.restore();
    // lane paint
    ctx.strokeStyle = 'rgba(226,232,216,0.16)'; ctx.lineWidth = 6;
    ctx.setLineDash([62, 48]);
    ctx.beginPath(); ctx.moveTo(0, H * 0.90); ctx.lineTo(W, H * 0.90); ctx.stroke();
    ctx.setLineDash([]);

    // ---- the transport van behind, with its light bar going ----
    const vx = W * 0.60, vy = H * 0.44, vw = W * 0.42, vh = H * 0.26;
    ctx.fillStyle = '#131c22'; ctx.fillRect(vx, vy, vw, vh + 40);
    ctx.fillStyle = '#1c2932'; ctx.fillRect(vx, vy, vw, 26);
    ctx.strokeStyle = 'rgba(150,180,200,0.20)'; ctx.lineWidth = 2; ctx.strokeRect(vx, vy, vw, vh + 40);
    // barred rear window
    ctx.fillStyle = '#080d10'; ctx.fillRect(vx + vw * 0.12, vy + 44, vw * 0.34, vh * 0.42);
    ctx.strokeStyle = '#5b6a72'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      const bx = vx + vw * 0.12 + (vw * 0.34 / 4) * i;
      ctx.beginPath(); ctx.moveTo(bx, vy + 44); ctx.lineTo(bx, vy + 44 + vh * 0.42); ctx.stroke();
    }
    // light bar: alternating blue / red, hard flashes
    const flash = Math.floor(t * 6) % 2 === 0;
    for (let i = 0; i < 2; i++) {
      const on = (i === 0) === flash;
      const lx = vx + vw * (0.34 + i * 0.30);
      const col = i === 0 ? '90,150,255' : '255,70,70';
      if (on) {
        const gl = ctx.createRadialGradient(lx + 20, vy - 6, 2, lx + 20, vy - 6, 160);
        gl.addColorStop(0, `rgba(${col},0.55)`);
        gl.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx + 20, vy - 6, 160, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = on ? `rgba(${col},0.95)` : `rgba(${col},0.18)`;
      ctx.fillRect(lx, vy - 12, 40, 10);
    }

    // ---- the officer who has you: shoulders, helmet, visor, one hand on your arm ----
    const ox = W * 0.40 + Math.sin(t * 1.9) * 5;
    const shoulderY = H * 0.56;
    // torso
    ctx.fillStyle = '#16232d';
    ctx.beginPath();
    ctx.moveTo(ox - W * 0.145, H + 20);
    ctx.lineTo(ox - W * 0.115, shoulderY + 36);
    ctx.quadraticCurveTo(ox - W * 0.085, shoulderY - 8, ox - W * 0.042, shoulderY - 20);
    ctx.lineTo(ox + W * 0.042, shoulderY - 20);
    ctx.quadraticCurveTo(ox + W * 0.085, shoulderY - 8, ox + W * 0.115, shoulderY + 36);
    ctx.lineTo(ox + W * 0.145, H + 20);
    ctx.closePath(); ctx.fill();
    // body armour plate + shoulder flash
    ctx.fillStyle = '#1e2f3d';
    ctx.beginPath();
    ctx.moveTo(ox - W * 0.065, shoulderY + 6);
    ctx.lineTo(ox + W * 0.065, shoulderY + 6);
    ctx.lineTo(ox + W * 0.052, shoulderY + 170);
    ctx.lineTo(ox - W * 0.052, shoulderY + 170);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,210,0.22)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(200,60,60,0.65)';
    ctx.fillRect(ox + W * 0.09, shoulderY + 34, 34, 11);
    // neck + head + helmet
    ctx.fillStyle = '#8e6a52';
    ctx.fillRect(ox - 13, shoulderY - 52, 26, 26);
    ctx.fillStyle = '#0d1620';
    ctx.beginPath(); ctx.arc(ox, shoulderY - 78, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#26343f';
    ctx.beginPath(); ctx.arc(ox, shoulderY - 84, 36, Math.PI, TAU); ctx.fill();
    ctx.fillRect(ox - 37, shoulderY - 86, 74, 9);
    // visor: cold blue, catches the bar light
    const vis = ctx.createLinearGradient(ox - 26, 0, ox + 26, 0);
    vis.addColorStop(0, 'rgba(90,150,210,0.9)');
    vis.addColorStop(0.5, 'rgba(150,205,245,0.95)');
    vis.addColorStop(1, 'rgba(60,105,150,0.9)');
    ctx.fillStyle = vis;
    ctx.fillRect(ox - 26, shoulderY - 88, 52, 11);
    // the arm reaching for your cuffs
    ctx.strokeStyle = '#16232d'; ctx.lineWidth = 34; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox + W * 0.10, shoulderY + 54);
    ctx.quadraticCurveTo(ox + W * 0.16, shoulderY + 150, W * 0.52, H * 0.83);
    ctx.stroke();
    ctx.fillStyle = '#8e6a52';
    ctx.beginPath(); ctx.arc(W * 0.52, H * 0.83, 20, 0, TAU); ctx.fill();

    // ---- the partner, further back and out of focus ----
    const px2 = W * 0.16;
    ctx.fillStyle = '#101a22';
    ctx.beginPath();
    ctx.moveTo(px2 - W * 0.06, H + 20);
    ctx.lineTo(px2 - W * 0.045, H * 0.62);
    ctx.quadraticCurveTo(px2, H * 0.52, px2 + W * 0.045, H * 0.62);
    ctx.lineTo(px2 + W * 0.06, H + 20);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(px2, H * 0.575, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,170,210,0.35)';
    ctx.fillRect(px2 - 22, H * 0.567, 44, 8);

    // ---- rain, in front of everything ----
    ctx.strokeStyle = 'rgba(196,222,238,0.20)'; ctx.lineWidth = 2;
    for (let i = 0; i < 110; i++) {
      const x = (i * 149 + t * 700) % W;
      const y = (i * 233 + t * 1500) % H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 30); ctx.stroke();
    }

    // ---- your cuffed wrists, shoved into frame ----
    const shake = Math.sin(t * 24) * 4;
    ctx.save();
    ctx.translate(W * 0.5 + shake, H * 0.86);
    ctx.scale(1.5, 1.5);
    // forearms
    ctx.strokeStyle = '#3d2a20'; ctx.lineWidth = 30; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-150, 90); ctx.lineTo(-46, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(150, 90); ctx.lineTo(46, 6); ctx.stroke();
    // hands
    ctx.fillStyle = '#a67c5e';
    ctx.beginPath(); ctx.ellipse(-52, 0, 34, 27, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(52, 0, 34, 27, 0.2, 0, TAU); ctx.fill();
    // cuffs
    ctx.strokeStyle = '#c3d0d8'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.ellipse(-52, 0, 30, 24, -0.15, 0.2, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(52, 0, 30, 24, 0.15, -Math.PI * 0.9, Math.PI * 0.8); ctx.stroke();
    ctx.strokeStyle = '#7f8d96'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(22, -2); ctx.stroke();
    ctx.restore();

    // ---- caption ----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e9f6f6';
    ctx.font = '900 40px ui-monospace, monospace';
    ctx.fillText('C U F F E D', W / 2, H * 0.115);
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillStyle = '#9fc2d4';
    ctx.fillText('HYDRA CUSTODY · THE STREET IS OVER · TRANSPORT IS WAITING', W / 2, H * 0.115 + 26);
    ctx.fillStyle = '#0d1a1e'; ctx.fillRect(W * 0.25, H * 0.955, W * 0.5, 5);
    ctx.fillStyle = '#9fc2ff'; ctx.fillRect(W * 0.25, H * 0.955, W * 0.5 * p, 5);
    ctx.textAlign = 'left';
  }

  /** How many military police are still standing inside the brig. */
  private mpNear(st: { x: number; y: number; w: number; h: number }) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.def.civilian) continue;
      if (e.x > st.x - 160 && e.x < st.x + st.w + 160 && e.y > st.y - 160 && e.y < st.y + st.h + 160) n++;
    }
    return n;
  }

  /**
   * The stockade. The army's own prisoners are not Hydra, and they have no reason to love
   * the men who locked them up: break the brig and they take up rifles for you.
   */
  private breakStockade(st: { x: number; y: number; w: number; h: number }) {
    this.milestone('stockade', 'THE STOCKADE IS OPEN', [
      'The inmates are the army\'s own, and they fight for whoever let them out.',
      'They will follow you for the rest of the run and shoot at what shoots at you.',
      'The brig is worth breaking on every visit: more guns on your side, no cost.',
    ]);
    if (this.stockadeOpen) return;
    const inside = this.mpNear(st);
    if (inside > 0) {
      this.addText(this.px, this.py - 56, `THE MP WING IS STILL FIRING (${inside})`, '#ff9d9d', 14);
      return;
    }
    this.stockadeOpen = true;
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    this.score += 6000;
    for (let i = 0; i < 14; i++) {
      this.allies.push({
        x: cx + rand(-140, 140), y: cy + rand(-120, 120), vx: 0, vy: 0, ang: 0,
        hp: 220, maxHp: 220, cool: rand(0.2, 1), slot: this.allies.length, flash: 0,
        kind: i % 4 === 0 ? 'heavy' : i % 7 === 0 ? 'medic' : 'rifle',
      });
    }
    this.explode(cx - st.w * 0.3, cy, 90, 0, true);
    this.explode(cx + st.w * 0.3, cy, 90, 0, true);
    this.setBanner('STOCKADE BROKEN', 'FOURTEEN OF THE ARMY\'S OWN, ARMED AND ON YOUR SIDE');
    this.addText(cx, cy - 90, 'THE BRIG IS OPEN +6000', '#ffd166', 18);
    this.tellStory({
      id: 'stockade', channel: 'MP STOCKADE / INTERNAL',
      title: 'They were locked up for asking the wrong question.',
      text: 'Fourteen soldiers in a military prison, charged with refusing an order nobody would put in writing. They will not fight for the flag anymore. They will fight for the person who opened the door.',
    }, 11);
    sfx.wave();
  }

  /* ---------------- the glacier vault ---------------- */

  /** The ice gate opens: hand over to the 3D vault. */
  enterGlacier() {
    if (this.status !== 'playing' || !this.glacierSpot) return;
    this.glacierVisits++;
    this.status = 'glacier';
    this.clearInput();
    this.firing = false;
    this.setBanner('THE GLACIER GATE OPENS', 'A BASE INSIDE THE MOUNTAIN — NOTHING THAT FLIES OUT HERE CAN FOLLOW YOU IN');
    sfx.rotor();
    this.onGlacier();
  }

  /** Back on the ice shelf: what the vault gave up. */
  leaveGlacier(stats: { kills: number; escorts: number; plane: boolean; time: number }, tookPlane: boolean) {
    if (this.status !== 'glacier') return;
    this.status = 'playing';
    // Out onto the apron in front of the bulkhead, then pushed clear of anything solid:
    // the old landing spot sat almost inside the perimeter fence.
    this.px = this.glacierSpot?.x ?? this.px;
    this.py = (this.glacierSpot?.y ?? this.py) + 150;
    this.pvx = 0; this.pvy = 0;
    const safe = { x: this.px, y: this.py };
    this.collide(safe, 34);
    this.px = safe.x; this.py = safe.y;
    this.iFrames = 3;
    const kills = Number.isFinite(stats?.kills) ? stats.kills : 0;
    const escorts = Number.isFinite(stats?.escorts) ? stats.escorts : 0;
    const reward = 9000 + kills * 260 + escorts * 180 + (tookPlane ? 22000 : 0);
    this.score += reward;
    if (tookPlane && !this.frostwing) {
      this.frostwing = true;
      this.maxHp += 30; this.hp = this.maxHp;
      this.setBanner('FROSTWING CLEARANCE', 'EVERY INTERCEPTOR YOU SEIZE IS NOW ICE-PLATED AND FASTER');
      this.addText(this.px, this.py - 70, 'FROSTWING AUTHORISED', '#a9ecff', 20);
    } else if (tookPlane) {
      this.setBanner('FROSTWING AGAIN', 'THE VAULT KEPT ITS SECRET BETTER THE SECOND TIME');
    } else {
      this.setBanner('OUT OF THE ICE', `${stats.kills} ICE GUARDS DOWN · THE VAULT IS STILL THERE`);
    }
    this.addText(this.px, this.py - 46, `+${reward}`, '#8be8ff', 18);
    this.hp = Math.max(60, Math.min(this.maxHp, this.hp + 40));
    // The interceptor rolls out of the hangar with you: it is parked on the ice shelf where
    // the operative can walk up to it and fly it without waiting for IRON RESERVE.
    if (tookPlane) this.parkGlacierInterceptor();
    this.tellStory({
      id: 'glacier-vault',
      channel: 'S.H.I.E.L.D. / GLACIER WATCH',
      title: tookPlane ? 'The Frostwing came out of the mountain.' : 'The vault is still standing.',
      text: tookPlane
        ? 'A platoon that had been written off, two gunships nobody ever logged, and an interceptor with no squadron number. The army spent decades hiding a hangar inside a glacier; you spent eleven minutes taking it.'
        : 'The shield platoon is still in there, holding a hall they were never relieved from. The gate is open now, and the ice keeps its own counsel.',
    }, 13);
    sfx.wave();
    this.pushHud();
  }

  /**
   * The Frostwing on the ice: a real, flyable interceptor parked beside the vault gate.
   * It is the same airframe the army flies, so every control, the seeker, the missile
   * stations and the countermeasures work exactly as they do over IRON RESERVE.
   */
  private parkGlacierInterceptor() {
    const base = this.glacierSpot ?? { x: this.px, y: this.py };
    let sx = base.x + 260, sy = base.y + 120;
    let found = false;
    for (let ring = 0; ring < 5 && !found; ring++) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        const tx = base.x + Math.cos(a) * (240 + ring * 70);
        const ty = base.y + Math.sin(a) * (240 + ring * 70) + 90;
        if (!this.pointBlocked(tx, ty) && !this.pointBlocked(tx + 60, ty) && !this.pointBlocked(tx - 60, ty)) {
          sx = tx; sy = ty; found = true; break;
        }
      }
    }
    this.armyJets = this.armyJets.filter((j) => j.manned);
    this.armyJets.push({
      x: sx, y: sy, ang: -Math.PI / 2, hp: 900, maxHp: 900,
      state: 'parked', alt: 0, speed: 0, cool: 0, t: 0,
      tier: 'frostwing', tuned: true, flares: 20,
    });
    this.addText(sx, sy - 80, 'INTERCEPTOR ON THE ICE · PRESS F TO FLY', '#a9ecff', 17);
    this.addText(sx, sy - 58, 'LMB FIRE · G MISSILE · X STATION · E ORBIT · SPACE FLARES · SHIFT BURN', '#8be8ff', 12);
    this.flash = Math.max(this.flash, 0.25); this.flashColor = '150,235,255';
    sfx.rotor();
  }

  /** Step through the sally port on the island, or wake up here after an arrest. */
  enterPrison(mode: 'arrest' | 'visit') {
    if (this.status === 'prison') return;
    this.showTutorial('prison', 'THE CAGE', [
      'You are inside the military prison on the island. Move with WASD, aim with the mouse.',
      'The sally port is the way out: a visit can be walked away from, an arrest cannot.',
      'Guards will be posted at the doors. Fighting your way out is allowed.',
    ]);
    this.prisonVisits++;
    this.status = 'prison';
    this.clearInput();
    this.firing = false;
    this.onPrison(mode);
  }

  /** Back on the surface: the operative keeps the smuggled pistol and the score. */
  /**
   * A prison escape ends the island's interest in the operative.
   *
   * Called the moment the operative walks out of THE CAGE: the alarm stands down, any
   * gunships already over the island break off and go home, and every landing craft still
   * on the water turns around. Nothing new launches while `cageEscaped` holds.
   */
  private standDownIslandDefence() {
    this.cageEscaped = true;
    this.islandLanded = false;
    this.islandWaves = 0;
    this.islandAlarmT = 0;
    let sent = 0;
    for (const h of this.helis) {
      if (h.medevac) continue;
      // No bay, no second sortie: they were scrambled for a prisoner who has already gone,
      // so they fly off the board rather than taxiing in and going back into service.
      h.home = undefined;
      h.retire = true;
      if (h.state !== 'egress') sent++;
      h.state = 'egress';
      h.t = 0;
    }
    for (const b of this.boats) {
      if (b.kind !== 'landing' || b.state === 'retreat' || b.state === 'sunk') continue;
      b.state = 'retreat';
      b.tx = b.homeX; b.ty = b.homeY;
    }
    if (sent > 0) {
      this.addText(this.px, this.py - 132, 'GUNSHIPS BREAKING OFF — THE ISLAND IS QUIET', '#a9ecff', 15);
      sfx.rotor();
    }
  }

  leavePrison(stats: PrisonStats, escaped: boolean) {
    // Every number that reaches the score is sanitised: a missing stat must never turn the
    // campaign score into NaN, which would silently break the run and the leaderboard.
    const freed = Number.isFinite(stats?.freed) ? stats.freed : 0;
    const down = Number.isFinite(stats?.guardsDown) ? stats.guardsDown : 0;
    const reward = escaped ? 25000 + freed * 400 + down * 250 : 1500;
    this.score += reward;
    if (this.prisonFinale && escaped) {
      // The last level, cleared: the campaign ends on the far side of the sally port.
      this.score += 40000;
      this.status = 'victory';
      this.timeScale = 0.25;
      this.prisonFinale = false;
      this.setBanner('CAMPAIGN COMPLETE', `THE CAGE BROKEN · ${stats.freed} INMATES RELEASED`);
      sfx.wave();
      this.pushHud();
      this.onVictory(Math.floor(this.score), this.wave);
      return;
    }
    this.status = 'playing';
    // Step out of the gate onto the forecourt: never straight back into the trigger.
    this.px = PRISON_DOOR.x - 210;
    this.py = PRISON_DOOR.y;
    this.pvx = 0; this.pvy = 0;
    this.prisonReentry = 2.5;
    // A man walking out of the gate is not an amphibious assault: the island's alarm stays
    // cold, and anything already airborne goes home instead of raking the forecourt.
    if (escaped) this.standDownIslandDefence();
    this.hp = Math.max(40, Math.min(this.maxHp, this.hp));
    this.weapon = 'pistol'; this.ammo = Infinity;
    this.weaponAmmo.set('pistol', Infinity);
    this.iFrames = 3;
    this.setBanner(escaped ? 'THE CAGE IS BEHIND YOU' : 'INTAKE COMPLETE', escaped
      ? `+${reward} · ${stats.freed} INMATES RELEASED · ${stats.guardsDown} GUARDS DOWN`
      : `+${reward} · YOU WALKED OUT WITH YOUR OWN PISTOL`);
    this.addText(this.px, this.py - 70, `+${reward}`, '#8be8ff', 20);
    this.tellStory({
      id: 'cage-escape', channel: 'S.H.I.E.L.D. / SIGNAL RECOVERED',
      title: 'The Cage is still standing. That is a problem for Hydra.',
      text: 'A prison that loses three hundred inmates in one night stops being a prison. Hydra will spend weeks rounding them up, weeks it cannot spend hunting you. The pistol from the intake desk is yours to keep.',
    }, 12);
    sfx.wave();
  }

  private enterVault() {
    if (this.status !== 'playing') return;
    this.milestone('vault', 'You found the vault', [
      'This is level 3 access: relics, a recovered airframe and a way out through the tunnels.',
      'Walk to a case and press F. Everything in here is worth taking and nothing shoots back.',
      'In the tunnel: your light matters. The maze is dark and the floor is not all floor.',
    ]);
    if (!this.vaultOpen) { this.score += 12000; this.vaultChoice = 'offer'; }
    this.vaultOpen = true;
    const poi = this.pois.find(p => p.id === 'vault');
    if (poi) poi.discovered = true;
    this.status = 'interior'; this.clearInput();
    this.onVault(true); sfx.pickup();
  }

  leaveVault() {
    if (this.status !== 'interior') return;
    this.clearInput(); this.status = 'playing';
    this.px = VAULT_ENTRY.x; this.py = VAULT_ENTRY.y - 130;
    this.pvx = 0; this.pvy = 0; this.iFrames = 2;
    this.onVault(false); this.setBanner('SURFACE ACCESS', 'S.H.I.E.L.D. / RETURN TO OPERATION');
  }

  vaultAction(action: 'supplies' | 'plane' | 'heli' | 'intel'): string {
    if (this.status !== 'interior') return 'ACCESS DENIED';
    if (action === 'intel') return 'HYDRA airfield: X 9600 / Y 4400. Disable SATCOM to reduce coordination. L seals a hydraulic gate.';
    if (action === 'supplies') {
      if (this.vaultResupplied) return 'This sector\'s supply allocation has already been collected.';
      this.vaultResupplied = true; this.hp = this.maxHp; this.grenades = this.mods.grenadeCap;
      this.shieldMax = Math.max(this.shieldMax, 220); this.shieldHp = this.shieldMax;
      this.aegisCharges = Math.min(5, this.aegisCharges + 2);
      if (this.ammo !== Infinity) this.ammo = WEAPONS[this.weapon].ammo;
      sfx.pickup(); return 'Resupplied: health, ammunition, armor, frags and 2 single-use AEGIS cells. Press C in combat.';
    }
    if (this.vaultChoice === 'taken') return 'Your aircraft and escort have already been assigned to the surface apron.';
    this.claimVaultAircraft(action);
    if (action === 'plane' && this.plane) { this.plane.x = VAULT_ENTRY.x + 230; this.plane.y = VAULT_ENTRY.y - 200; }
    if (action === 'heli') this.playerHeli = makeHeli(VAULT_ENTRY.x + 160, VAULT_ENTRY.y - 170, -Math.PI / 2);
    for (let i = 0; i < this.allies.length; i++) { this.allies[i].x = VAULT_ENTRY.x - 90 + i * 35; this.allies[i].y = VAULT_ENTRY.y - 230; }
    return `${action === 'plane' ? 'NIGHTJAR strategic bomber' : 'KESTREL gunship'} authorized. Six escorts are waiting outside. Exit through the airlock.`;
  }

  /** Claim the bomber (and a full escort) out of the black vault. */
  private claimVaultAircraft(which: 'plane' | 'heli') {
    this.vaultChoice = 'taken';
    const poi = this.pois.find((p) => p.id === 'vault');
    if (poi) poi.looted = true;
    if (which === 'plane') {
      this.plane = {
        x: this.planeSpot.x, y: this.planeSpot.y, vx: 0, vy: 0, ang: -Math.PI / 2, bank: 0,
        hp: 1200, maxHp: 1200, bombCd: 0, gunCd: 0, fuel: 100, active: false,
      };
      this.setBanner('S.H.I.E.L.D. BOMBER RELEASED', 'ESCORT WING ASSIGNED — PRESS F TO FLY');
    }
    // Escort wing: real allied operatives that fight alongside you from here on.
    for (let i = 0; i < 6; i++) {
      this.allies.push({
        x: this.px + rand(-90, 90), y: this.py + rand(-90, 90), vx: 0, vy: 0, ang: 0,
        hp: 260, maxHp: 260, cool: rand(0.2, 1), slot: i, flash: 0,
        kind: i < 3 ? 'rifle' : i < 5 ? 'heavy' : 'medic',
      });
    }
    this.maxHp += 40; this.hp = this.maxHp;
    this.shieldMax = Math.max(this.shieldMax, 260); this.shieldHp = this.shieldMax;
    this.grenades = this.mods.grenadeCap;
    this.score += 15000;
    this.flash = 0.7; this.flashColor = '150,255,220';
    sfx.wave();
  }

  private enterVan(v: Van) {
    this.drivingVan = v;
    v.driving = true;
    this.px = v.x; this.py = v.y;
    this.pvx = 0; this.pvy = 0;
    const label = v.art ? VAN_LABEL[v.art] : 'TRANSPORT';
    this.setBanner(`${label} COMMANDEERED`, 'W/S THROTTLE · A/D STEER · SHIFT RAM · F EXIT');
    sfx.rotor();
  }

  /** The nearest parked vehicle the operative could take, if any. */
  private nearDriveProp() {
    let best: { rect: Rect; kind: 'car' | 'humvee' | 'bus' | 'tanker' | 'truck'; colour: string } | null = null;
    let bestD = 130;
    for (const p of this.driveProps) {
      if (p.rect.dead) continue;
      const cx = p.rect.x + p.rect.w / 2, cy = p.rect.y + p.rect.h / 2;
      const d = Math.hypot(cx - this.px, cy - this.py);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /**
   * A parked lorry stops being scenery. The painted prop is retired (so the world is not
   * left with a solid box where the vehicle used to be), and a real vehicle takes its
   * place — same body, same colour, full throttle, and a hull that can be shot off.
   */
  private requisitionVehicle(p: { rect: Rect; kind: 'car' | 'humvee' | 'bus' | 'tanker' | 'truck'; colour: string }) {
    if (p.rect.dead) return;
    const cx = p.rect.x + p.rect.w / 2, cy = p.rect.y + p.rect.h / 2;
    const horiz = p.rect.w >= p.rect.h;
    p.rect.dead = true;
    this.navigationDirty = true;
    this.grid.build(this.obstacles);
    const hp = p.kind === 'bus' || p.kind === 'tanker' ? 300 : p.kind === 'truck' ? 260 : 210;
    // Vehicles park nose-in against walls and between crates. If the hull would start the
    // drive buried in scenery, roll it out to the nearest gap instead of leaving the
    // operative stuck at the wheel of a car that cannot move.
    let sx = cx, sy = cy;
    if (this.pointBlocked(sx, sy)) {
      let found = false;
      for (let ring = 1; ring <= 4 && !found; ring++) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU;
          const tx = cx + Math.cos(a) * ring * 46, ty = cy + Math.sin(a) * ring * 46;
          if (!this.pointBlocked(tx, ty)) { sx = tx; sy = ty; found = true; break; }
        }
      }
    }
    const v: Van = {
      x: sx, y: sy, ang: horiz ? 0 : Math.PI / 2, speed: 0, lean: 0,
      hp, maxHp: hp, dead: false, driving: false, boost: 0,
      art: p.kind, colour: p.colour,
    };
    this.vans.push(v);
    this.enemies.forEach((e) => { if (Math.hypot(e.x - cx, e.y - cy) < 200) e.alert = true; });
    this.sparks(cx, cy, '#c8cbb4', 14);
    this.addText(cx, cy - 56, `${VAN_LABEL[p.kind]} REQUISITIONED`, '#a9ecff', 15);
    this.score += 120;
    sfx.click();
    this.enterVan(v);
  }

  /** The nearest moving car, so traffic can be stopped and taken like anything else. */
  private nearTrafficCar() {
    let best: RoadCar | null = null;
    let bestD = 120;
    for (const c of this.roadCars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - this.px, c.y - this.py);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /**
   * Stopping a moving car and taking it. The driver is long gone; the operative gets the
   * body, the hull it had left and the road it was already on.
   */
  private commandeerTraffic(c: RoadCar) {
    if (c.dead) return;
    c.dead = true; c.burning = 0; c.panic = 0;
    const v: Van = {
      x: c.x, y: c.y, ang: c.ang, speed: 0, lean: 0,
      hp: Math.max(60, c.hp), maxHp: c.maxHp, dead: false, driving: false, boost: 0,
      art: c.kind, colour: c.colour,
    };
    this.vans.push(v);
    this.sparks(c.x, c.y, '#c8cbb4', 12);
    this.addText(c.x, c.y - 56, `${VAN_LABEL[c.kind]} TAKEN`, '#a9ecff', 15);
    this.score += 150;
    sfx.click();
    this.enterVan(v);
  }

  private exitVan() {
    const v = this.drivingVan;
    if (!v) return;
    if (Math.abs(v.speed) > 130) { this.addText(v.x, v.y - 56, 'SLOW DOWN TO EXIT', '#ffcf7a', 13); return; }
    v.driving = false;
    this.drivingVan = null;
    this.px = v.x - Math.sin(v.ang) * 74;
    this.py = v.y + Math.cos(v.ang) * 74;
    this.pvx = 0; this.pvy = 0;
    sfx.click();
  }

  private enterPlane() {
    if (!this.plane) return;
    this.flyingPlane = true;
    this.plane.active = true;
    this.px = this.plane.x; this.py = this.plane.y;
    this.setBanner('S.H.I.E.L.D. STRATEGIC BOMBER', 'WASD FLY · MOUSE AIMS · LMB NOSE CANNONS · G BOMB CARPET · F LAND');
    sfx.rotor();
  }

  private exitPlane() {
    if (!this.plane) return;
    if (Math.hypot(this.plane.vx, this.plane.vy) > 140) {
      this.addText(this.plane.x, this.plane.y - 90, 'THROTTLE DOWN TO DISEMBARK', '#ffcf7a', 13);
      return;
    }
    const landing = { x: this.plane.x, y: this.plane.y };
    this.collide(landing, 65);
    if (Math.hypot(landing.x - this.plane.x, landing.y - this.plane.y) > 1) {
      this.addText(this.plane.x, this.plane.y - 95, 'FIND A CLEAR LANDING AREA', '#e9c185', 14); return;
    }
    this.flyingPlane = false;
    this.plane.active = false;
    this.px = this.plane.x; this.py = this.plane.y + 110;
    this.pvx = 0; this.pvy = 0;
    sfx.click();
  }

  /** Board / leave the personal captured gunship. */
  private boardGunship() {
    const h = this.playerHeli;
    if (!h) return;
    if (this.piloting) {
      const speed = Math.hypot(h.vx, h.vy);
      if (speed > 90) {
        this.addText(h.x, h.y - 70, 'SLOW DOWN TO DISEMBARK', '#ffcf7a', 13);
        return;
      }
      const landing = { x: h.x, y: h.y }; this.collide(landing, 42);
      if (Math.hypot(landing.x - h.x, landing.y - h.y) > 1) {
        this.addText(h.x, h.y - 70, 'LANDING AREA OBSTRUCTED', '#e9c185', 14); return;
      }
      this.piloting = false;
      h.landed = true;
      this.px = h.x - Math.cos(h.ang) * 46;
      this.py = h.y - Math.sin(h.ang) * 46;
      this.pvx = 0; this.pvy = 0;
      this.setBanner('GUNSHIP LANDED', 'PRESS F NEAR THE AIRCRAFT TO FLY AGAIN');
      sfx.click();
      return;
    }
    if (Math.hypot(h.x - this.px, h.y - this.py) > 130) {
      this.addText(this.px, this.py - 42, 'LOCATE THE HANGAR GUNSHIP', '#9fd8ff', 13);
      return;
    }
    this.piloting = true;
    h.landed = false;
    h.vx = 0; h.vy = 0;
    this.px = h.x; this.py = h.y;
    this.showTutorial('heli', 'YOU ARE FLYING THE GUNSHIP', [
      'W / S collective · A / D attitude · the mouse aims the nose',
      '1 chain gun · 2 Hellfire (ground) · 3 Sidewinder (air) · LMB fire',
      'F lands the aircraft where you are hovering; it stays there for the next sortie.',
    ]);
    this.setBanner('CAPTURED GUNSHIP', '1 CHAIN GUN · 2 HELLFIRE (GROUND) · 3 SIDEWINDER (AIR) · LMB FIRE · F LAND');
    this.addText(h.x, h.y - 84, 'THREE STATIONS ARMED — 1 / 2 / 3', '#a9ecff', 14);
    sfx.rotor();
  }

  /** Climb into a convoy tank you walked up to. */
  private boardTank(t: Tank, reboard = false) {
    t.captured = true;
    t.driven = true;
    t.cool = Math.max(t.cool, 1.2);
    this.playerTank = t;
    t.speed = 0;
    this.px = t.x; this.py = t.y;
    this.pang = t.ang;
    if (!reboard) this.showTutorial('tank', 'You have a tank', [
      'W/S throttle, A/D steer the hull. The mouse lays the turret; LMB fires the main gun.',
      'F dismounts — the hull stays exactly where you leave it. Step back in with F.',
      'No tank gun can break another tank hull, yours included. To kill armour, use rockets,',
      'frags, the air wing, or take the hull. Turret emplacements can be turned with F as well.',
    ]);
    if (reboard) {
      this.setBanner('S.H.I.E.L.D. TANK', 'WASD DRIVE · LMB MAIN GUN · F DISMOUNT');
      sfx.click();
      return;
    }
    this.score += 4000;
    this.setBanner('HYDRA TANK CAPTURED', 'WASD DRIVE · LMB MAIN GUN · F DISMOUNT');
    this.addText(t.x, t.y - 96, 'TANK SEIZED +4000', '#8be8ff', 18);
    sfx.wave();
  }

  private exitTank() {
    const t = this.playerTank;
    if (!t) return;
    if (Math.abs(t.speed) > 90) { this.addText(t.x, t.y - 70, 'STOP THE TANK FIRST', '#ffcf7a', 13); return; }
    t.driven = false; t.speed = 0;
    // It stays yours: nobody else drives it, but the operative is back on foot.
    this.playerTank = null;
    this.px = t.x - Math.sin(t.ang) * 82;
    this.py = t.y + Math.cos(t.ang) * 82;
    this.pvx = 0; this.pvy = 0;
    sfx.click();
  }

  /** Captured tank: heavy tracks, slow turret, one enormous main gun. */
  private updateDrivenTank(dt: number) {
    const t = this.playerTank;
    if (!t || t.dead) { this.playerTank = null; return; }
    const k = this.keys;
    const m = this.moveVector();
    const fwd = this.isTouch ? -m.y : (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const steer = this.isTouch ? m.x : (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    t.speed = lerp(t.speed, fwd > 0 ? 250 : fwd < 0 ? -120 : 0, 1 - Math.pow(fwd !== 0 ? 0.3 : 0.08, dt));
    const grip = clamp(Math.abs(t.speed) / 190, 0, 1);
    t.ang += steer * 1.05 * grip * dt * Math.sign(t.speed || 1);
    t.lean = lerp(t.lean, steer * grip * 0.2, 1 - Math.pow(0.02, dt));

    const next = { x: t.x + Math.cos(t.ang) * t.speed * dt, y: t.y + Math.sin(t.ang) * t.speed * dt };
    const probe = { ...next }; this.collide(probe, 50);
    if (Math.hypot(probe.x - next.x, probe.y - next.y) < 0.5) { t.x = next.x; t.y = next.y; }
    else t.speed *= 0.15;

    // Tracks flatten infantry that stand in front of it.
    if (Math.abs(t.speed) > 60) {
      for (const e of this.enemies) {
        if (e.def.civilian) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) < 82) {
          this.hurtEnemy(e, Math.abs(t.speed) / 2.6, Math.cos(t.ang) * 420, Math.sin(t.ang) * 420);
          e.stun = 0.45;
          t.speed *= 0.94;
        }
      }
    }

    let aim = this.isTouch ? t.ang : Math.atan2(this.mouseY + this.camY - t.y, this.mouseX + this.camX - t.x);
    let trigger = this.firing;
    if (this.aimStick.active) {
      const dx = this.aimStick.x - this.aimStick.ox, dy = this.aimStick.y - this.aimStick.oy;
      if (Math.hypot(dx, dy) > 12) { aim = Math.atan2(dy, dx); trigger = true; }
    }
    t.turret = lerpAngle(t.turret, aim, 1 - Math.exp(-3.5 * dt));
    this.pang = t.turret;
    t.cool = Math.max(0, t.cool - dt);
    if (trigger && t.cool <= 0) {
      t.cool = 1.5;
      const sx = t.x + Math.cos(t.turret) * 72, sy = t.y + Math.sin(t.turret) * 72;
      this.bullets.push({
        x: sx, y: sy, px: sx, py: sy,
        vx: Math.cos(t.turret) * 900, vy: Math.sin(t.turret) * 900,
        dmg: 120, life: 1.5, friendly: true, rocket: true, color: '#ffd9a0', r: 8, hits: [],
      });
      this.addLight(sx, sy, 420, '255,200,130', 0.35);
      this.shocks.push({ x: sx, y: sy, r: 6, max: 110, life: 0.2, t: 0.2, color: '255,215,150', width: 7 });
      this.hitstop = Math.max(this.hitstop, 0.03);
      sfx.shoot('rocket');
    }

    this.px = t.x; this.py = t.y; this.pvx = Math.cos(t.ang) * t.speed; this.pvy = Math.sin(t.ang) * t.speed;
    if (t.speed > 20 && Math.random() < dt * 16)
      this.addParticle(t.x - Math.cos(t.ang) * 84 + rand(-24, 24), t.y - Math.sin(t.ang) * 84 + rand(-24, 24),
        rand(-14, 14), rand(-18, 8), rand(0.5, 1), rand(3, 6), '#6f7a72', false);
  }

  /** Ground vehicle handling: throttle, steering, weight and ramming. */
  private updateDrivenVan(dt: number) {
    const v = this.drivingVan;
    if (!v || v.dead) { this.drivingVan = null; return; }
    if (v.disabled) {
      // Tyres blown: no throttle, no steering, smoke pouring off the wheels.
      v.speed = Math.max(0, v.speed - 320 * dt);
      v.boost = Math.max(0, v.boost - dt);
      v.lean = lerp(v.lean, 0.3, 1 - Math.exp(-3 * dt));
      v.x += Math.cos(v.ang) * v.speed * dt; v.y += Math.sin(v.ang) * v.speed * dt;
      if (Math.random() < dt * 18)
        this.addParticle(v.x + rand(-26, 26), v.y + rand(-26, 26), rand(-8, 8), -rand(18, 44), rand(0.6, 1.2), rand(3, 6), '#2f3230', true);
      this.px = v.x; this.py = v.y;
      return;
    }
    const k = this.keys;
    const joystick = this.moveVector();
    const fwd = this.isTouch ? -joystick.y : (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const steer = this.isTouch ? joystick.x : (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    v.boost = k['shift'] ? Math.min(1, v.boost + dt * 2) : Math.max(0, v.boost - dt * 1.5);
    /* A requisitioned staff car is not an armoured personnel carrier, and neither is it a
     * go-kart. Each body has a top speed, a rate at which it can actually gain speed and a
     * turning circle; a loaded tanker takes ten seconds to reach its cruise, a staff car
     * four. The figures are in arena units per second squared, so they can be reasoned
     * about: 260 u/s² is a brisk car, 95 is a laden lorry. */
    const profile = v.art === 'car' ? { top: 545, rev: -200, accel: 240, brake: 620, turn: 1.25, ram: 0.8 }
      : v.art === 'humvee' ? { top: 495, rev: -180, accel: 200, brake: 640, turn: 1.15, ram: 1 }
      : v.art === 'ambulance' ? { top: 480, rev: -170, accel: 210, brake: 620, turn: 1.1, ram: 0.9 }
      : v.art === 'truck' ? { top: 330, rev: -120, accel: 120, brake: 470, turn: 0.85, ram: 1.35 }
      : v.art === 'bus' ? { top: 360, rev: -130, accel: 130, brake: 500, turn: 0.9, ram: 1.25 }
      : v.art === 'tanker' ? { top: 315, rev: -110, accel: 105, brake: 440, turn: 0.8, ram: 1.5 }
      : { top: 425, rev: -150, accel: 140, brake: 520, turn: 0.95, ram: 1 };
    const top = profile.top + v.boost * profile.top * 0.4;
    /* A vehicle changes direction through the gearbox, not through a sign flip. S while
     * rolling forward is a brake; reverse only engages once the wheels have stopped. */
    const movingFwd = v.speed > 8, movingBack = v.speed < -8;
    let target = 0, rate = 0;
    if (fwd > 0) {
      v.revHold = 0;
      if (movingBack) { target = 0; rate = profile.brake; }
      else { target = top; rate = profile.accel; }
    } else if (fwd < 0) {
      /* S on a moving vehicle is the brake, and reverse has to be *selected*: a driver
       * comes to a stop, the box slips into reverse, and only then does the car creep back.
       * Without that beat a staff car went straight from 500 u/s forward to 200 u/s
       * backwards through zero, which looked like a bug in the physics rather than a gear
       * change. */
      if (movingFwd) { target = 0; rate = profile.brake; }
      else {
        v.revHold = (v.revHold ?? 0) + dt;
        if (v.revHold < 0.3 && v.speed > -6) { target = 0; rate = profile.brake; }
        else { target = profile.rev; rate = profile.accel * 0.55; }
      }
    } else {
      v.revHold = 0;
      // engine braking and rolling resistance: a heavy vehicle carries its speed
      target = 0;
      rate = v.art === 'tanker' || v.art === 'bus' || v.art === 'truck' ? 70 : 110;
    }
    const dv = target - v.speed;
    v.speed += clamp(dv, -rate * dt, rate * dt);
    /* Steering: authority builds from walking pace to a mid-speed peak and then falls off,
     * because a real vehicle's turning circle grows with speed. A parked one does not turn
     * at all, which is exactly what the old linear scale got wrong. */
    const spd = Math.abs(v.speed);
    const authority = clamp(spd / 90, 0, 1) * clamp(1.25 - (spd / profile.top) * 0.5, 0.35, 1.15);
    v.ang += steer * profile.turn * authority * dt * Math.sign(v.speed || 1);
    v.lean = lerp(v.lean, steer * authority * 0.4, 1 - Math.pow(0.01, dt));

    const probe = { x: v.x + Math.cos(v.ang) * v.speed * dt, y: v.y + Math.sin(v.ang) * v.speed * dt };
    // A van is not a boat: the shoreline is a wall.
    let hit = this.inWater(probe.x, probe.y) ? { nx: -Math.cos(v.ang), ny: -Math.sin(v.ang) } : this.collide(probe, 48);
    if (!hit) for (const off of [-66, 66]) {
      const axle = { x: probe.x + Math.cos(v.ang) * off, y: probe.y + Math.sin(v.ang) * off };
      const n = this.collide(axle, 32);
      if (n) { hit = n; break; }
    }
    if (hit) {
      if (Math.abs(v.speed) > 250) {
        this.explode(v.x, v.y, 90, 18, false);
        this.damagePlayer(Math.abs(v.speed) / 26, v.x, v.y);
      }
      // Glancing blows slide instead of sticking: scrub speed by how head-on the impact is
      // and swing the nose along the surface, so a heavy transport scrapes past crate
      // corners and sandbag lines rather than welding itself to them.
      const hx = Math.cos(v.ang), hy = Math.sin(v.ang);
      const dot = clamp(hx * hit.nx + hy * hit.ny, -1, 1);
      const headOn = Math.abs(dot);
      v.speed *= clamp(-0.16 * headOn + 0.55 * (1 - headOn), -0.16, 0.55);
      let tx = hx - dot * hit.nx, ty = hy - dot * hit.ny;
      const tl = Math.hypot(tx, ty);
      if (tl > 0.05) {
        tx /= tl; ty /= tl;
        // keep sliding in the direction we were already heading, never backwards
        if (tx * hx + ty * hy < 0) { tx = -tx; ty = -ty; }
        const want = Math.atan2(ty, tx);
        const delta = Math.atan2(Math.sin(want - v.ang), Math.cos(want - v.ang));
        v.ang += clamp(delta, -2.6 * dt * (1.2 - headOn), 2.6 * dt * (1.2 - headOn));
      }
      v.blockT = (v.blockT || 0) + dt;
      if (v.blockT > 0.9) {
        // Genuinely wedged: rock the wheel and back out, the way a driver would.
        v.blockT = 0;
        v.ang += (Math.random() < 0.5 ? -1 : 1) * 0.6;
        v.speed = -130;
      }
    } else { v.x = probe.x; v.y = probe.y; v.blockT = 0; }
    v.x = clamp(v.x, 90, ARENA_W - 90); v.y = clamp(v.y, 90, ARENA_H - 90);

    // ram anything hostile
    if (Math.abs(v.speed) > 150) {
      for (const e of [...this.enemies]) {
        if (e.def.civilian) continue;
        if (Math.hypot(e.x - v.x, e.y - v.y) < 74) {
          this.hurtEnemy(e, Math.abs(v.speed) / 3.1, Math.cos(v.ang) * 400, Math.sin(v.ang) * 400);
          e.stun = 0.4;
          this.sparks(e.x, e.y, '#ffd166', 10);
          v.speed *= 0.93;
        }
      }
    }
    this.px = v.x; this.py = v.y; this.pvx = Math.cos(v.ang) * v.speed; this.pvy = Math.sin(v.ang) * v.speed;
    let aim = this.isTouch ? v.ang : Math.atan2(this.mouseY + this.camY - v.y, this.mouseX + this.camX - v.x);
    let trigger = this.firing;
    if (this.aimStick.active) {
      const dx = this.aimStick.x - this.aimStick.ox, dy = this.aimStick.y - this.aimStick.oy;
      if (Math.hypot(dx, dy) > 12) { aim = Math.atan2(dy, dx); trigger = true; }
    }
    v.turretAng = lerpAngle(v.turretAng ?? v.ang, aim, 1 - Math.exp(-12 * dt));
    this.pang = v.turretAng;
    v.gunCd = Math.max(0, (v.gunCd || 0) - dt);
    if (trigger && v.gunCd <= 0) {
      v.gunCd = 0.12;
      const a = v.turretAng, x = v.x + Math.cos(a) * 36, y = v.y + Math.sin(a) * 36;
      this.bullets.push({ x, y, px: x, py: y, vx: Math.cos(a) * 1400, vy: Math.sin(a) * 1400, dmg: 23, life: 0.9, friendly: true, color: '#92edff', r: 3, hits: [] });
      this.addLight(x, y, 150, '120,235,255', 0.1); sfx.shoot('rifle');
    }
    // a knocked-about street vehicle starts smoking long before it dies
    if (v.art && v.hp < v.maxHp * 0.45 && Math.random() < 0.5) {
      const ember = v.hp < v.maxHp * 0.2;
      this.addParticle(v.x + rand(-8, 8), v.y - 10 + rand(-6, 6),
        rand(-24, 24), rand(-70, -26), rand(0.5, 1.1), rand(3, 7),
        ember ? '#ff9a5c' : '#5c635a', true);
      if (ember) this.addLight(v.x, v.y, 90, '255,140,70', 0.12);
    }
    if (Math.abs(v.speed) > 60 && Math.random() < 0.7)
      this.addParticle(v.x - Math.cos(v.ang) * 84, v.y - Math.sin(v.ang) * 84,
        rand(-20, 20) - Math.cos(v.ang) * 26, rand(-20, 20) - Math.sin(v.ang) * 26,
        rand(0.3, 0.6), rand(2, 5), v.boost > 0.4 ? '#ffb26a' : '#8b968a', true);
    if (v.boost > 0.3) this.addLight(v.x, v.y, 260, '255,180,110', 0.2);
  }

  /** The vault bomber: heavy, slow to turn, devastating carpet bombs. */
  /**
   * THE BOMBER FLIES ON WASD.
   *
   * The nose follows the mouse (that is where the guns point) and WASD flies the aircraft:
   * W forward, S back, A/D across, with the hull easing into the new heading. It is a
   * heavy strategic bomber, not a fighter, so it turns slowly and carries its speed.
   */
  private updatePlane(dt: number) {
    const p = this.plane;
    if (!p) { this.flyingPlane = false; return; }
    const m = this.moveVector();
    let aim = p.ang;
    let firing = false;
    if (this.aimStick.active) {
      const dx = this.aimStick.x - this.aimStick.ox, dy = this.aimStick.y - this.aimStick.oy;
      if (Math.hypot(dx, dy) > 12) { aim = Math.atan2(dy, dx); firing = true; }
    } else if (!this.isTouch) {
      aim = Math.atan2(this.mouseY + this.camY - p.y, this.mouseX + this.camX - p.x);
      firing = this.firing;
    }
    let turn = aim - p.ang;
    while (turn > Math.PI) turn -= TAU;
    while (turn < -Math.PI) turn += TAU;
    p.ang += Math.sign(turn) * Math.min(Math.abs(turn), 1.25 * dt);
    p.bank = lerp(p.bank, clamp(turn * 0.85, -0.7, 0.7), 1 - Math.pow(0.01, dt));
    const thrust = p.fuel > 0 ? 640 : 95;
    p.vx = lerp(p.vx, m.x * thrust, 1 - Math.pow(0.16, dt));
    p.vy = lerp(p.vy, m.y * thrust, 1 - Math.pow(0.16, dt));
    p.x = clamp(p.x + p.vx * dt, 120, ARENA_W - 120);
    p.y = clamp(p.y + p.vy * dt, 120, ARENA_H - 120);
    p.fuel = Math.max(0, p.fuel - dt * 0.75);
    p.gunCd = Math.max(0, p.gunCd - dt);
    p.bombCd = Math.max(0, p.bombCd - dt);

    if (firing && p.gunCd <= 0) {
      p.gunCd = 0.07;
      for (const side of [-1, 1]) {
        const a = p.ang + rand(-0.02, 0.02);
        const ox = Math.cos(p.ang + Math.PI / 2) * side * 40;
        const oy = Math.sin(p.ang + Math.PI / 2) * side * 40;
        this.bullets.push({
          x: p.x + ox, y: p.y + oy, px: p.x, py: p.y,
          vx: Math.cos(a) * 1650, vy: Math.sin(a) * 1650,
          dmg: 26, life: 1, friendly: true, color: '#cdf6ff', r: 3.4, hits: [],
        });
      }
      this.addLight(p.x, p.y, 220, '190,240,255', 0.1);
      sfx.shoot('smg');
    }
    this.px = p.x; this.py = p.y; this.pvx = p.vx; this.pvy = p.vy; this.pang = p.ang;
    if (Math.random() < 0.7) {
      for (const side of [-1, 1]) {
        const ox = Math.cos(p.ang + Math.PI / 2) * side * 62 - Math.cos(p.ang) * 60;
        const oy = Math.sin(p.ang + Math.PI / 2) * side * 62 - Math.sin(p.ang) * 60;
        this.addParticle(p.x + ox, p.y + oy, rand(-16, 16), rand(12, 40), 0.35, rand(2, 4), '#9db6c0', true);
      }
    }
  }

  /** Carpet bombing run — the bomber's signature. */
  private dropBombs() {
    const p = this.plane;
    if (!p || p.bombCd > 0) return;
    p.bombCd = 1.6;
    for (let i = 0; i < 7; i++) {
      const d = 120 + i * 155;
      const spread = ((i % 2) * 2 - 1) * 42;
      const bx = p.x + Math.cos(p.ang) * d - Math.sin(p.ang) * spread;
      const by = p.y + Math.sin(p.ang) * d + Math.cos(p.ang) * spread;
      this.nades.push({
        x: p.x, y: p.y, vx: (bx - p.x) / (1.1 + i * 0.12), vy: (by - p.y) / (1.1 + i * 0.12),
        t: 1.1 + i * 0.12, z: 170, vz: -35, dmg: 150, big: true, bomb: true,
      });
    }
    this.addText(p.x, p.y - 110, 'BOMBS AWAY', '#cdf6ff', 18);
    this.provokeAirResponse(2.2);
    sfx.shoot('rocket');
  }

  /* ---------------- the Cage crossing ---------------- */

  /**
   * A suspension bridge is a structure, not scenery: bombs near the deck cut into it, and
   * when the span goes, it stays gone. Nobody crosses to the island after that.
   */
  private hurtBridge(x: number, y: number, dmg: number, radius: number) {
    if (this.bridgeDown) return;
    const onDeck = x > BRIDGE.x - 120 && x < BRIDGE.x + BRIDGE.w + 120
      && y > BRIDGE.y - 260 && y < BRIDGE.y + BRIDGE.h + 260;
    if (!onDeck) return;
    // a near miss rattles the span, a direct hit tears it
    const near = Math.hypot(x - (BRIDGE.x + BRIDGE.w / 2), y - (BRIDGE.y + BRIDGE.h / 2));
    const bite = Math.max(40, dmg) * (1 + radius / 400) * (near < BRIDGE.w / 2 ? 1.4 : 0.8);
    this.bridgeHp = Math.max(0, this.bridgeHp - bite);
    if (this.bridgeHp <= 0) {
      this.bridgeDown = true;
      this.shocks.push({ x, y, r: 10, max: 420, life: 0.7, t: 0.7, color: '255,170,90', width: 14 });
      for (let i = 0; i < 5; i++) {
        const gx = BRIDGE.x + BRIDGE.w * (0.38 + i * 0.07), gy = BRIDGE.y + BRIDGE.h / 2;
        this.explode(gx, gy, 120, 0, false);
      }
      this.setBanner('THE CROSSING IS DOWN', 'THE SPAN IS IN THE WATER — THE CAGE IS CUT OFF');
      this.addText(BRIDGE.x + BRIDGE.w / 2, BRIDGE.y - 40, 'SUSPENSION SPAN SEVERED', '#ffd166', 18);
      this.score += 2500;
      sfx.explode();
      return;
    }
    const frac = this.bridgeHp / this.bridgeMaxHp;
    if (frac < 0.66 && this.bridgeWarn === 0) { this.bridgeWarn = 1; this.addText(x, y - 40, 'SPAN DAMAGED — KEEP HITTING IT', '#ffd166', 15); }
    else if (frac < 0.33 && this.bridgeWarn === 1) { this.bridgeWarn = 2; this.addText(x, y - 40, 'SUSPENSION TOWERS BUCKING', '#ff9d7a', 15); }
  }

  /**
   * The Golden Gate crossing: two orange towers, a catenary main cable, hangers down to a
   * stiffened deck, and — if the operative has been busy — a very large hole in the middle.
   */
  private drawSuspensionBridge(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const bx = BRIDGE.x, by = BRIDGE.y, bw = BRIDGE.w, bh = BRIDGE.h;
    const cy = by + bh / 2;
    if (bx + bw < camX - 200 || bx > camX + this.w + 200 || by + bh < camY - 400 || by > camY + this.h + 400) return;
    const t = this.simulationTime;
    const orange = '#c15a2e';
    const orangeLit = '#e0783c';
    const gap0 = bx + bw * 0.4, gap1 = bx + bw * 0.68;

    ctx.save();
    // the shadow of the deck on the water beneath
    ctx.fillStyle = 'rgba(6,16,20,0.55)';
    ctx.fillRect(bx - 10, by - 20, bw + 20, bh + 40);

    // deck: asphalt with a lane line, drawn in two pieces once the span is down
    const deck = (x0: number, x1: number) => {
      ctx.fillStyle = '#232827';
      ctx.fillRect(x0, by, x1 - x0, bh);
      ctx.fillStyle = 'rgba(232,214,150,0.30)';
      for (let x = x0 + 20; x < x1 - 20; x += 64) ctx.fillRect(x, cy - 3, 34, 6);
      // orange kerbs
      ctx.fillStyle = orange;
      ctx.fillRect(x0, by - 6, x1 - x0, 8);
      ctx.fillRect(x0, by + bh - 2, x1 - x0, 8);
    };
    if (!this.bridgeDown) deck(bx, bx + bw);
    else { deck(bx, gap0); deck(gap1, bx + bw); }

    // towers at the third points: legs, cross beams, warning lights
    const towers = [bx + bw * 0.28, bx + bw * 0.72];
    const topY = by - 300;
    for (const tx of towers) {
      const legTop = this.bridgeDown && tx > gap0 && tx < gap1 ? by - 40 : topY;
      ctx.fillStyle = orange;
      ctx.fillRect(tx - 34, legTop, 22, by - legTop + 10);
      ctx.fillRect(tx + 12, legTop, 22, by - legTop + 10);
      ctx.fillStyle = orangeLit;
      ctx.fillRect(tx - 34, legTop, 68, 26);
      ctx.fillRect(tx - 30, by - 150, 60, 16);
      if (legTop < topY + 80) {
        ctx.fillStyle = '#ff6a4a';
        ctx.beginPath(); ctx.arc(tx, legTop - 6, 6 + Math.sin(t * 3) * 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,90,60,0.22)';
        ctx.beginPath(); ctx.arc(tx, legTop - 6, 18, 0, TAU); ctx.fill();
      }
    }

    // main cables: catenary from anchorage to anchorage
    const sag = (x: number) => {
      const span = Math.abs(x - (towers[0] + towers[1]) / 2) / ((towers[1] - towers[0]) / 2);
      const s = Math.min(1, span);
      return by - 286 + s * s * 150;
    };
    ctx.strokeStyle = this.bridgeDown ? '#8a4b2e' : '#d9a45c';
    ctx.lineWidth = 5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let x = bx; x <= bx + bw; x += 12) {
        const y = side < 0 ? sag(x) : by + bh + 10 + (sag(x) - (by - 286));
        if (x === bx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // hangers
    ctx.strokeStyle = 'rgba(220,180,120,0.35)';
    ctx.lineWidth = 2;
    for (let x = bx + 20; x < bx + bw - 10; x += 46) {
      if (this.bridgeDown && x > gap0 - 20 && x < gap1 + 20) continue;
      ctx.beginPath(); ctx.moveTo(x, sag(x)); ctx.lineTo(x, by); ctx.stroke();
    }

    if (this.bridgeDown) {
      // twisted deck ends and cables trailing in the water
      ctx.strokeStyle = '#7a4526';
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const x0 = gap0 - 30 + i * 12, x1 = x0 + 40 + i * 8;
        ctx.beginPath();
        ctx.moveTo(x0, by + i * 8);
        ctx.lineTo(x1, by + 120 + i * 22);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,150,90,0.12)';
      ctx.beginPath(); ctx.ellipse((gap0 + gap1) / 2, cy + 40, (gap1 - gap0) / 2, 90, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,90,0.75)';
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPAN DESTROYED — NO WAY ACROSS', (gap0 + gap1) / 2, by - 340);
      ctx.textAlign = 'left';
    } else if (this.bridgeHp < this.bridgeMaxHp) {
      const frac = Math.max(0, this.bridgeHp / this.bridgeMaxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx + bw / 2 - 90, by - 356, 180, 8);
      ctx.fillStyle = frac > 0.5 ? '#e0a83c' : '#ff6a4a';
      ctx.fillRect(bx + bw / 2 - 90, by - 356, 180 * frac, 8);
    }
    ctx.restore();
  }

  /** Beam batteries: telegraphed charge, then a lethal lance. */
  private updateLasers(dt: number) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      if (l.beam > 0) l.beam -= dt;
      if (l.captured) {
        // fires on Hydra for you now
        l.cool -= dt;
        let target: Enemy | null = null, bd = 1500;
        for (const e of this.enemies) {
          if (e.def.civilian || e.garrison) continue;
          const d = Math.hypot(e.x - l.x, e.y - l.y);
          if (d < bd) { bd = d; target = e; }
        }
        if (target) {
          l.ang = lerpAngle(l.ang, Math.atan2(target.y - l.y, target.x - l.x), 1 - Math.pow(0.002, dt));
          if (l.cool <= 0) {
            l.cool = 2.4; l.beam = 0.3;
            l.targetX = target.x; l.targetY = target.y;
            this.fireBeam(l, true);
          }
        }
        continue;
      }
      const pd = Math.hypot(this.px - l.x, this.py - l.y);
      if (pd > 1500) { l.charge = 0; continue; }
      l.ang = lerpAngle(l.ang, Math.atan2(this.py - l.y, this.px - l.x), 1 - Math.pow(0.004, dt));
      l.cool -= dt;
      if (l.cool <= 0) {
        l.charge += dt;
        if (l.charge > 1.5) {
          l.charge = 0; l.cool = 3.4; l.beam = 0.32;
          l.targetX = this.px; l.targetY = this.py;
          this.fireBeam(l, false);
        }
      }
    }
  }

  private fireBeam(l: Laser, friendly: boolean) {
    const a = l.ang;
    const len = 1600;
    sfx.explode();
    this.addLight(l.x, l.y, 620, friendly ? '140,235,255' : '255,90,110', 0.85);
    this.flash = Math.max(this.flash, 0.35);
    this.flashColor = friendly ? '140,235,255' : '255,90,110';
    for (let s = 0; s < 34; s++) {
      const d = (s / 34) * len;
      this.addParticle(l.x + Math.cos(a) * d, l.y + Math.sin(a) * d,
        rand(-40, 40), rand(-40, 40), rand(0.2, 0.5), rand(3, 7),
        friendly ? '#9fe8ff' : '#ff6a86', true);
    }
    // sweep damage along the lance
    for (let s = 1; s < 40; s++) {
      const d = (s / 40) * len;
      const bx = l.x + Math.cos(a) * d, by = l.y + Math.sin(a) * d;
      if (this.pointBlocked(bx, by)) break;
      if (friendly) {
        for (const e of [...this.enemies]) {
          if (e.def.civilian) continue;
          if (Math.hypot(e.x - bx, e.y - by) < 60) this.hurtEnemy(e, 90);
        }
      } else if (Math.hypot(this.px - bx, this.py - by) < 52) {
        // two of these will finish an unshielded operative
        this.damagePlayer(52, bx, by);
        break;
      }
    }
  }

  /** Escort wing recovered from the vault. */
  private updateAllies(dt: number) {
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      if (a.flash > 0) a.flash -= dt;
      if (a.hp <= 0) {
        this.allies.splice(i, 1);
        this.explode(a.x, a.y, 70, 0, false);
        this.addText(a.x, a.y - 30, 'ESCORT DOWN', '#9fd8ff', 13);
        continue;
      }
      const ang = (a.slot / 6) * TAU;
      const gx = this.px + Math.cos(ang) * 120;
      const gy = this.py + Math.sin(ang) * 120;
      const dx = gx - a.x, dy = gy - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = d > 320 ? 420 : 260;
      a.vx = lerp(a.vx, (dx / d) * sp, 1 - Math.pow(0.004, dt));
      a.vy = lerp(a.vy, (dy / d) * sp, 1 - Math.pow(0.004, dt));
      a.x += a.vx * dt; a.y += a.vy * dt;
      this.collide(a, 14);

      let target: Enemy | null = null, bd = a.kind === 'heavy' ? 620 : 520;
      for (const e of this.enemies) {
        if (e.def.civilian || e.spawnT > 0) continue;
        const ed = Math.hypot(e.x - a.x, e.y - a.y);
        if (ed < bd && this.hasLine(a.x, a.y, e.x, e.y)) { bd = ed; target = e; }
      }
      if (target) a.ang = lerpAngle(a.ang, Math.atan2(target.y - a.y, target.x - a.x), 1 - Math.pow(0.001, dt));
      a.cool -= dt;
      if (a.kind === 'medic') {
        if (this.hp < this.maxHp && Math.hypot(this.px - a.x, this.py - a.y) < 220) {
          this.hp = Math.min(this.maxHp, this.hp + 5 * dt);
          if (Math.random() < dt * 2)
            this.addParticle(this.px, this.py, rand(-20, 20), rand(-40, -12), 0.5, 3, '#8dffb0', true);
        }
      } else if (target && a.cool <= 0) {
        a.cool = a.kind === 'heavy' ? 0.42 : 0.16;
        const pellets = a.kind === 'heavy' ? 4 : 1;
        for (let p = 0; p < pellets; p++) {
          const sa = a.ang + rand(-0.07, 0.07) * (a.kind === 'heavy' ? 2.4 : 1);
          this.bullets.push({
            x: a.x + Math.cos(sa) * 20, y: a.y + Math.sin(sa) * 20, px: a.x, py: a.y,
            vx: Math.cos(sa) * 1250, vy: Math.sin(sa) * 1250,
            dmg: a.kind === 'heavy' ? 15 : 20, life: 0.75, friendly: true,
            color: '#9fe8ff', r: 2.6, hits: [],
          });
        }
      }
    }
  }

  /** Holding a captured base: barricades take damage, reinforcement waves keep coming. */
  private updateSiege(dt: number) {
    for (let i = this.barricades.length - 1; i >= 0; i--) {
      const b = this.barricades[i];
      for (const e of this.enemies) {
        if (e.def.civilian) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 96) {
          b.hp -= 26 * dt;
          if (Math.random() < dt * 5) this.sparks(b.x + rand(-40, 40), b.y + rand(-14, 14), '#ffd166', 3);
        }
      }
      if (b.hp <= 0) {
        this.barricades.splice(i, 1);
        this.explode(b.x, b.y, 130, 26, true);
        this.addText(b.x, b.y - 40, 'BARRICADE BREACHED', '#ff9d9d', 16);
        const poi = this.pois.find((p) => p.gates.some((g) => Math.hypot(g.x - b.x, g.y - b.y) < 40));
        const gate = poi?.gates.find((g) => Math.hypot(g.x - b.x, g.y - b.y) < 40);
        if (gate) gate.built = false;
      }
    }
    if (!this.siege.active) return;
    this.siege.t += dt;
    const poi = this.pois.find((p) => p.id === this.siege.poi);
    if (!poi) { this.siege.active = false; return; }
    const attackers = this.enemies.filter((e) => !e.def.civilian && !e.garrison).length
      + this.trucks.filter((t) => !t.dead).length + this.spawnQueue.length;
    if (attackers === 0 && this.siege.t > 6) {
      this.siege.waves++;
      if (this.siege.waves >= 3) {
        this.siege.active = false;
        this.score += 45000;
        this.setBanner('BASE SECURED', `${poi.name} HELD — +45000 · PERMANENT HOLD`);
        this.objective = `SECTOR ${this.sector}/6 · ASSAULT THE MAIN FORTRESS`;
        for (let i = 0; i < 8; i++)
          this.dropPickup(this.px + rand(-180, 180), this.py + rand(-180, 180),
            i % 4 === 0 ? 'health' : i % 4 === 1 ? 'shield' : i % 4 === 2 ? 'grenade' : 'aegis');
        sfx.wave();
      } else {
        this.siege.t = 0;
        this.setBanner(`WAVE ${this.siege.waves + 1} OF 3`, `HYDRA IS THROWING EVERYTHING AT ${poi.name}`);
        this.beginSiege(poi);
      }
    }
  }

  private updateBaseOverride(dt: number) {
    if (!this.baseOverride.active) {
      // Decay the standoff timer when the operative leaves the point.
      const nearPoi = this.pois.some((p) => !p.secret && !p.captured && Math.hypot(this.px - p.x, this.py - p.y) < 170);
      if (!nearPoi) this.uplinkHold = 0;
      return;
    }
    const poi = this.pois.find(p => p.id === this.baseOverride.poiId);
    if (!poi) { this.baseOverride.active = false; return; }
    const d = Math.hypot(this.px - poi.x, this.py - poi.y);
    if (d < 205) {
      this.baseOverride.progress = Math.min(100, this.baseOverride.progress + dt * 3.3);
      this.objective = `OVERRIDE ${poi.name} (${Math.round(this.baseOverride.progress)}%)`;
      if (Math.random() < dt * 2.5) {
        this.addParticle(poi.x + rand(-30, 30), poi.y + rand(-30, 30), rand(-25, 25), rand(-45, -15), 0.5, 3.5, '#74f2d2', true);
      }
      if (this.baseOverride.progress >= 100) {
        this.baseOverride.active = false;
        poi.captured = true;
        this.score += 35000;
        sfx.wave();
        // The first base taken stops the game and explains what a secured base does.
        if (!this.tutorialsSeen.has('capture')) this.milestone('capture', `${poi.name} SECURED`, [
          'A secured base stops feeding the alarm: its garrison stands down and its gates open to you.',
          'Its loot, vehicles and aircraft are now yours to take — press F on anything that looks drivable.',
          'The score banked 35 000. Securing every marked base is how a sector is finished.',
          'Walk out and take the next one. Nothing here respawns.',
        ]);
        this.setBanner('BASE SECURED / OVERRIDE COMPLETE', `${poi.name} S.H.I.E.L.D. OUTPOST ACTIVE`);
        this.objective = `SECTOR ${this.sector}/6 · ASSAULT THE MAIN FORTRESS`;
        for (let i = 0; i < 4; i++) {
          this.allies.push({
            x: poi.x + rand(-80, 80), y: poi.y + rand(-80, 80), vx: 0, vy: 0, ang: 0,
            hp: 280, maxHp: 280, cool: rand(0.2, 1), slot: i, flash: 0,
            kind: i === 0 ? 'medic' : i === 1 ? 'heavy' : 'rifle',
          });
        }
        for (let i = 0; i < 6; i++) {
          this.dropPickup(poi.x + rand(-120, 120), poi.y + rand(-120, 120),
            i % 3 === 0 ? 'health' : i % 3 === 1 ? 'shield' : 'aegis');
        }
      }
    } else {
      if (Math.random() < dt * 1.5) {
        this.addText(this.px, this.py - 44, 'RETURN TO THE UPLINK CORE TO MAINTAIN OVERRIDE', '#ff9d9d', 13);
      }
    }
  }

  /** Hangar roofs slide apart once the operative is inside the shell. */
  private updateHangars(dt: number) {
    for (const [index, h] of this.hangars.entries()) {
      const inside = this.px > h.x - 10 && this.px < h.x + h.w + 10 &&
                     this.py > h.y - 10 && this.py < h.y + h.h + 10;
      const traffic = this.helis.some(a => a.home === index && ['startup', 'taxi-out', 'takeoff', 'landing', 'taxi-in'].includes(a.state));
      const target = inside || traffic || h.ruined ? 1 : 0;
      if (Math.abs(h.open - target) > 0.001) {
        h.open = lerp(h.open, target, 1 - Math.pow(0.02, dt));
        if (inside && h.open > 0.05 && h.open < 0.09) sfx.rotor();
      }
    }
  }

  private updateFacilities(dt: number) {
    const player = { x: this.px, y: this.py };
    this.nearbyFacility = null;
    let nearest = Infinity;
    for (const f of this.facilities) {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      const d = Math.hypot(player.x - cx, player.y - cy);
      if (d < 1050) f.discovered = true;
      const inside = player.x > f.x - 16 && player.x < f.x + f.w + 16 && player.y > f.y - 16 && player.y < f.y + f.h + 16;
      const atDoor = f.doors.some(p => Math.hypot(player.x - p.x, player.y - p.y) < 185);
      const target = inside || atDoor || f.ruined ? 1 : 0;
      if (Math.abs(f.reveal - target) > 0.001) f.reveal += (target - f.reveal) * (1 - Math.exp(-3.6 * dt));
      const edgeDist = Math.hypot(player.x - clamp(player.x, f.x, f.x + f.w), player.y - clamp(player.y, f.y, f.y + f.h));
      if (edgeDist < 210 && d < nearest) { this.nearbyFacility = f; nearest = d; }
    }
    this.facilityTimer -= dt;
    if (this.facilityTimer > 0) return;
    this.facilityTimer = 0.4;
    const counts = new Map<string, number>();
    const alerts = new Set<string>();
    for (const e of this.enemies) {
      if (!e.facilityId || e.hp <= 0) continue;
      counts.set(e.facilityId, (counts.get(e.facilityId) || 0) + 1);
      if (e.alert) alerts.add(e.facilityId);
    }
    for (const f of this.facilities) {
      f.remaining = counts.get(f.id) || 0;
      f.alarm = alerts.has(f.id);
      if (f.remaining > 0 && f.alarm) {
        const team = this.enemies.filter(e => e.facilityId === f.id && e.hp > 0);
        if (!team.some(e => e.leader)) {
          const successor = team.find(e => e.type === 'warden' || e.type === 'heavy') || team[0];
          if (successor) { successor.leader = true; successor.postRole = 'leader'; }
        }
      }
      if (f.secured || f.remaining > 0 || !f.discovered) continue;
      f.secured = true; f.alarm = false;
      const bonus = 1200 + this.sector * 150;
      this.score += bonus;
      const x = f.x + f.w / 2, y = f.y + f.h - 92;
      this.dropPickup(x - 30, y, 'health');
      this.dropPickup(x + 30, y, f.kind === 'armory' || f.kind === 'laboratory' ? 'aegis' : 'grenade');
      this.addText(x, y - 36, `${f.code} SECURED +${bonus}`, '#92e6ba', 19);
      if (Math.hypot(this.px - x, this.py - y) < 1000) sfx.wave();
    }
  }

  /** Local defenders route through entrances instead of pushing into their own equipment. */
  private postWaypoint(e: Enemy, goal: Point): Point {
    if (this.infantryRoutes.line(e, goal)) return goal;
    let state = this.postNavigation.get(e);
    const stale = !state || state.expires < this.simulationTime || state.revision !== this.infantryRoutes.revision
      || Math.hypot(state.goal.x - goal.x, state.goal.y - goal.y) > 150;
    if (stale && this.infantryBudget > 0) {
      this.infantryBudget--;
      state = { path: this.infantryRoutes.route(e, goal), node: 0, expires: this.simulationTime + 1.5 + e.slot % 4 * 0.2,
        goal, revision: this.infantryRoutes.revision };
      this.postNavigation.set(e, state);
    }
    // No route at all (a beat point inside a compound, a doorway the planner rejects):
    // walk straight at it instead of standing still for the rest of the mission.
    if (!state?.path.length) return Math.hypot(goal.x - e.x, goal.y - e.y) < 460 ? goal : e;
    while (state.node < state.path.length - 1 && Math.hypot(state.path[state.node].x - e.x, state.path[state.node].y - e.y) < 23) state.node++;
    return state.path[state.node];
  }

  /* ------------------------------------------------------------------ */
  /*  NAVY                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * The island is Hydra's crown jewel: the moment the operative sets foot on it the
   * sirens go and everything that floats or flies comes in. Waves keep coming.
   */
  private updateIslandDefence(dt: number) {
    const onIsland = this.px > 13980 && Math.hypot(this.px - ISLAND.x, this.py - ISLAND.y) < 2100;
    // THE CAGE IS BEHIND YOU. Walking out of the prison — on foot, with a smuggled pistol —
    // is not an invasion of the island, and the island must not answer it like one: no
    // landing waves, no gunship flights, no garrison turning out. The silence holds until
    // the operative is off the island; come back later and the defence is live again.
    if (this.cageEscaped) {
      if (!onIsland) this.cageEscaped = false;
      else { this.islandAlarmT = 0; return; }
    }
    if (onIsland && !this.islandLanded) this.startIslandLanding();
    if (onIsland) {
      this.islandAlarmT = Math.max(0, this.islandAlarmT - dt);
      if (this.islandLanded && this.islandAlarmT <= 0 && this.islandWaves < 6) {
        this.islandAlarmT = 24;
        this.startIslandLanding();
      }
    } else if (!onIsland && this.islandLanded) {
      this.islandAlarmT = 0;
    }
  }

  /** One tick of the sea: landing runs, patrols, ramming and the reefs. */
  private updateBoats(dt: number) {
    const spec = (b: Boat) => BOAT[b.kind];
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i];
      if (!b) continue;
      b.t += dt;
      b.wake = lerp(b.wake, Math.min(1, Math.abs(b.speed) / 150), 1 - Math.exp(-4 * dt));
      if (b.state === 'sunk') {
        if (b.t > 9) this.boats.splice(i, 1);
        continue;
      }
      if (b === this.drivingBoat) continue;               // the operative is at the wheel
      // A moored or abandoned skiff sits still until someone takes the helm.
      if (b.faction === 'player' && b.kind === 'skiff') { b.speed = 0; continue; }
      const sp = spec(b);

      // ---- landing run ----
      if (b.state === 'transit' || b.state === 'retreat') {
        const gx = b.state === 'transit' ? b.tx : b.homeX;
        const gy = b.state === 'transit' ? b.ty : b.homeY;
        const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy) || 1;
        const goalA = Math.atan2(dy, dx);
        b.ang = lerpAngle(b.ang, goalA, 1 - Math.pow(0.12, dt));
        const want = b.state === 'transit' ? sp.speed : sp.speed * 1.15;
        b.speed = lerp(b.speed, want, 1 - Math.exp(-2 * dt));
        const step = Math.min(d, b.speed * dt);
        b.x += Math.cos(b.ang) * step; b.y += Math.sin(b.ang) * step;
        if (b.state === 'retreat') b.ramp = Math.max(0, b.ramp - dt * 1.6);
        // Close enough: put the bow on the sand before the sea guard pushes us back out.
        if (b.state === 'transit' && b.kind === 'landing' && d < 150) {
          b.state = 'beach'; b.t = 0; b.speed = 0;
          this.addText(b.x, b.y - 70, `${b.manifest} HOSTILES ASHORE`, '#ffb9a4', 13);
          continue;
        }
        if (d < 70) {
          if (b.state === 'retreat') {
            // home water: the craft turns and is gone over the horizon, no fireworks
            this.boats.splice(i, 1);
            continue;
          }
          if (b.kind !== 'landing') { b.state = 'cruise'; b.t = 0; continue; }
          b.state = 'beach'; b.t = 0; b.speed = 0;
          this.addText(b.x, b.y - 70, `${b.manifest} HOSTILES ASHORE`, '#ffb9a4', 13);
          if (this.inWater(b.x + Math.cos(b.ang) * 60, b.y + Math.sin(b.ang) * 60) === false) {
            /* the ramp already points at sand */
          }
        }
      } else if (b.state === 'beach') {
        b.speed = Math.max(0, b.speed - 120 * dt);
        b.ramp = Math.min(1, b.ramp + dt * 0.9);
        // settle against the sand
        b.x += Math.cos(b.ang) * 22 * dt; b.y += Math.sin(b.ang) * 22 * dt;
        if (b.ramp >= 1) { b.state = 'unload'; b.t = 0; }
      } else if (b.state === 'unload') {
        if (b.troops > 0 && b.t > 0.42) {
          b.t = 0;
          b.troops--;
          b.landed++;
          const a = b.ang;
          const sx = b.x + Math.cos(a) * (spec(b).len * 0.5 + 26);
          const sy = b.y + Math.sin(a) * (spec(b).len * 0.5 + 26);
          const squadId = -820000 - b.id;
          this.spawnEnemy(b.troops % 3 === 0 ? 'gunner' : 'grunt', squadId, b.landed,
            sx + rand(-14, 14), sy + rand(-14, 14));
          const fresh = this.enemies[this.enemies.length - 1];
          if (fresh) { fresh.alert = true; fresh.homeX = sx; fresh.homeY = sy; }
          this.addParticle(sx, sy, rand(-20, 20), rand(-20, 20), 0.4, 3, '#cfd8d2', false);
          if (b.landed % 2 === 0) sfx.click();
        }
        if (b.troops <= 0 && b.t > 1.2) { b.state = 'retreat'; b.t = 0; b.tx = b.homeX; b.ty = b.homeY; }
      } else {
        // ---- patrol / chase ----
        const pdx = this.px - b.x, pdy = this.py - b.y;
        const pd = Math.hypot(pdx, pdy) || 1;
        const huntable = this.drivingBoat !== null || (!this.inWater(this.px, this.py) && pd < 900);
        if (huntable && pd < 1500 && b.faction === 'enemy') {
          if (b.state !== 'chase') { b.state = 'chase'; b.t = 0; this.addText(b.x, b.y - 60, 'PATROL BOAT / INTERCEPT', '#ffb9a4', 13); }
        } else if (b.state === 'chase') b.state = 'cruise';
        if (b.state === 'chase') {
          b.ang = lerpAngle(b.ang, Math.atan2(pdy, pdx), 1 - Math.exp(-1.6 * dt));
          b.speed = lerp(b.speed, BOAT[b.kind].speed * 1.25, 1 - Math.exp(-1.5 * dt));
          b.fireCd = (b.fireCd ?? 0) - dt;
          if (pd < 620 && b.fireCd <= 0) {
            b.fireCd = rand(0.7, 1.2);
            const a = Math.atan2(pdy, pdx) + rand(-0.06, 0.06);
            this.bullets.push({
              x: b.x + Math.cos(a) * 70, y: b.y + Math.sin(a) * 70, px: b.x, py: b.y,
              vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
              dmg: 9, life: 2, friendly: false, color: '#ffb27a', r: 3,
            });
            sfx.shoot('smg');
          }
        } else {
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
          if (d < 120) {
            // pick the next stretch of open water
            const be = LANDING_BEACHES[(b.id + Math.floor(b.t)) % LANDING_BEACHES.length];
            b.tx = clamp(be.ax + rand(-700, 700), SEA.x + 120, ARENA_W - 160);
            b.ty = clamp(be.ay + rand(-900, 900), 120, ARENA_H - 120);
            if (!this.inWater(b.tx, b.ty)) { b.tx = be.ax; b.ty = be.ay; }
          }
          b.ang = lerpAngle(b.ang, Math.atan2(dy, dx), 1 - Math.exp(-1.2 * dt));
          b.speed = lerp(b.speed, BOAT[b.kind].speed * 0.7, 1 - Math.exp(-1.2 * dt));
        }
        const step = b.speed * dt;
        const nx = b.x + Math.cos(b.ang) * step, ny = b.y + Math.sin(b.ang) * step;
        if (this.inWater(nx, ny)) { b.x = nx; b.y = ny; }
        else { b.speed *= 0.4; b.ang += 1.4 * dt; }      // never beach a patrol boat
      }

      // ---- reefs: a hull that runs aground is a hull that burns ----
      this.checkReefs(b, false);

      // ---- patrol hulls never leave the sea (a landing craft is meant to hit the sand) ----
      if (b.kind !== 'landing' && b.state !== 'beach' && b.state !== 'unload' && !this.inWater(b.x, b.y)) {
        const back = Math.atan2(b.homeY - b.y, b.homeX - b.x);
        b.ang = lerpAngle(b.ang, back, 1 - Math.exp(-3 * dt));
        b.speed = Math.max(b.speed, 60);
      }
    }

    // ---- boat against boat: ramming is fatal for both ----
    for (let i = 0; i < this.boats.length; i++) {
      const a = this.boats[i];
      if (a.state === 'sunk') continue;
      for (let k = i + 1; k < this.boats.length; k++) {
        const b = this.boats[k];
        if (b.state === 'sunk') continue;
        // Only an operative at the wheel sinks a hull by ramming it: Hydra's own
        // landing waves run in column and touch each other all the time.
        if (a !== this.drivingBoat && b !== this.drivingBoat) continue;
        const settled = (x: Boat) => x.state === 'beach' || x.state === 'unload' || x.t < 3;
        if (settled(a) || settled(b)) continue;
        const reach = (BOAT[a.kind].len + BOAT[b.kind].len) * 0.34;
        if (Math.hypot(a.x - b.x, a.y - b.y) > reach) continue;
        const closing = Math.abs(a.speed) + Math.abs(b.speed);
        if (closing < 120) continue;
        this.sinkBoat(a); this.sinkBoat(b);
      }
    }
  }

  /** Reef strike: the hull is holed, and the operative aboard dies with it. */
  private checkReefs(b: Boat, driving: boolean) {
    for (const r of this.reefs) {
      if (Math.hypot(b.x - r.x, b.y - r.y) > r.r + 26) continue;
      if (!r.seen) { r.seen = true; this.addText(r.x, r.y - 60, 'REEF', '#ffd9a0', 12); }
      if (driving) {
        this.sinkBoat(b);
        this.damagePlayer(9999, b.x, b.y);
        this.setBanner('HULL BREACHED ON A REEF', 'THE BOAT IS GONE — AND SO ARE YOU');
        return;
      }
      if (b.kind === 'patrol' || b.state === 'chase') { this.sinkBoat(b); return; }
      b.ang += Math.PI * 0.6; b.speed *= 0.2;
    }
  }

  /** Blow a hull apart, with a splash of burning fuel. */
  private sinkBoat(b: Boat) {
    if (b.state === 'sunk') return;
    b.state = 'sunk'; b.t = 0; b.speed = 0;
    this.explode(b.x, b.y, 150, 0, false);
    this.sparks(b.x, b.y, '#ffb066', 22);
    this.addLight(b.x, b.y, 420, '255,170,90', 0.6);
    if (b === this.drivingBoat) {
      this.drivingBoat = null;
      // thrown clear, but the water is not survivable for long
      this.hp = Math.max(0, this.hp - 40);
      this.damagePlayer(9999, b.x, b.y);
      this.iFrames = 0;
    }
  }

  /** Throttle / helm for a boat the operative is driving. */
  private updateDrivenBoat(dt: number) {
    const b = this.drivingBoat;
    if (!b || b.state === 'sunk') { this.drivingBoat = null; return; }
    const k = this.keys;
    const joystick = this.moveVector();
    const fwd = this.isTouch ? -joystick.y : (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const steer = this.isTouch ? joystick.x : (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    const top = BOAT[b.kind].speed * 1.9;
    b.speed = lerp(b.speed, fwd > 0 ? top : fwd < 0 ? -top * 0.35 : 0, 1 - Math.pow(0.1, dt));
    const grip = clamp(Math.abs(b.speed) / 120, 0, 1);
    b.ang += steer * 1.15 * grip * dt * Math.sign(b.speed || 1);
    const nx = b.x + Math.cos(b.ang) * b.speed * dt;
    const ny = b.y + Math.sin(b.ang) * b.speed * dt;
    if (this.inWater(nx, ny)) { b.x = nx; b.y = ny; }
    else {
      // ground: kill the way on and swing the bow back to open water
      b.speed *= -0.25;
      b.ang += 1.1 * dt;
      this.addText(b.x, b.y - 56, 'SHALLOW — BACK OFF', '#ffd9a0', 12);
    }
    this.px = b.x; this.py = b.y;
    this.pvx = 0; this.pvy = 0;
    if (b.wake > 0.25 && Math.random() < 0.6)
      this.addParticle(b.x - Math.cos(b.ang) * 70 + rand(-16, 16), b.y - Math.sin(b.ang) * 70 + rand(-16, 16),
        rand(-18, 18), rand(-18, 18), 0.6, rand(3, 7), '#cfeff2', true);
    this.checkReefs(b, true);
    for (const o of this.boats) {
      if (o === b || o.state === 'sunk' || o.faction === 'player') continue;
      const reach = (BOAT[b.kind].len + BOAT[o.kind].len) * 0.42;
      if (Math.hypot(b.x - o.x, b.y - o.y) < reach && Math.abs(b.speed) > 210) {
        this.sinkBoat(o);
        this.sinkBoat(b);
        this.setBanner('RAMMED A HYDRA HULL', 'THE BOAT IS GONE — AND SO ARE YOU');
        return;
      }
    }
  }

  private enterBoat(b: Boat) {
    this.showTutorial('boat', 'YOU HAVE A BOAT', [
      'W / S throttle · A / D helm · F disembark on a beach',
      'The sea is open water: hulls ram each other at speed and both sink.',
      'If your aircraft comes down in the water you end up in one of these.',
    ]);
    this.drivingBoat = b;
    b.faction = 'player';
    b.crewed = true;
    this.px = b.x; this.py = b.y;
    this.pvx = 0; this.pvy = 0;
    this.setBanner('BOAT SEIZED', 'W/S THROTTLE · A/D HELM · F DISEMBARK');
    sfx.click();
  }

  private exitBoat() {
    const b = this.drivingBoat;
    if (!b) return;
    if (Math.abs(b.speed) > 90) { this.addText(b.x, b.y - 56, 'CUT THE THROTTLE', '#ffcf7a', 13); return; }
    // step off onto the nearest dry ground
    for (const a of [0, 0.6, -0.6, 1.2, -1.2, Math.PI]) {
      const x = b.x + Math.cos(b.ang + a) * 78, y = b.y + Math.sin(b.ang + a) * 78;
      if (!this.inWater(x, y)) { this.px = x; this.py = y; this.drivingBoat = null; sfx.click(); return; }
    }
    this.addText(b.x, b.y - 56, 'NO LANDING HERE', '#ffcf7a', 13);
  }

  /** The island defence: everything floating and flying that Hydra can call in. */
  private startIslandLanding() {
    // Never let a stuck frame call the whole navy in twice.
    if (this.boats.filter((b) => b.kind === 'landing').length > 36) return;
    if (this.islandWaves >= 6) return;
    this.islandLanded = true;
    this.islandWaves++;
    const scale = Math.min(4, this.islandWaves);
    const runs = 3 + scale * 2;
    for (let i = 0; i < runs; i++) {
      const be = LANDING_BEACHES[(this.islandWaves + i) % LANDING_BEACHES.length];
      const spread = (i - runs / 2) * 300;
      const ax = clamp(be.ax + spread * 0.55, SEA.x + 140, ARENA_W - 180);
      const ay = clamp(be.ay + spread * 0.42, 140, ARENA_H - 140);
      const boat = makeBoat('landing', 'enemy', ax, ay,
        Math.atan2(be.by - ay, be.bx - ax),
        { tx: be.bx + rand(-120, 120), ty: be.by + rand(-120, 120), troops: 8 + scale * 2, manifest: 8 + scale * 2,
          homeX: ax, homeY: ay, state: 'transit' });
      this.boats.push(boat);
    }
    for (let i = 0; i < 2 + scale; i++) {
      const be = LANDING_BEACHES[(this.islandWaves + i + 1) % LANDING_BEACHES.length];
      this.helis.push({
        x: be.bx + rand(-260, 260), y: be.by + rand(-260, 260), tx: 14800 + rand(-300, 300), ty: 4075 + rand(-260, 260),
        ang: 0, rotor: 0, state: 'ingress',
        hp: 460 + this.sector * 30, maxHp: 460 + this.sector * 30,
        cool: rand(0.5, 2), rocketCd: rand(2, 5), t: 0,
        orbitA: rand(0, TAU), medevac: false, carrying: 0, announced: false, bank: 0,
      });
    }
    sfx.siren();
    this.setBanner(
      this.islandWaves === 1 ? 'THE CAGE — LANDING ALARM' : `THE CAGE — WAVE ${this.islandWaves}`,
      `${runs} LANDING CRAFT · ${1 + scale} GUNSHIPS · EVERY COP ON THE ISLAND`,
    );
    // and the garrison on the island itself turns out
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - 15180, e.y - 4100) < 1700) e.alert = true;
    }
  }

  /** Where the column should steer next, following roads around the city blocks. */
  private teamWaypoint(team: { x: number; y: number }, goal: Point): Point {
    let st = this.teamNav.get(team);
    const stale = !st || st.expires < this.simulationTime || st.goal.x !== goal.x || st.goal.y !== goal.y;
    if (stale) {
      if (this.infantryBudget <= 0) return st?.path[st.node] ?? goal;
      this.infantryBudget--;
      st = { path: this.infantryRoutes.route(team, goal), node: 0, goal, expires: this.simulationTime + 2 };
      this.teamNav.set(team, st);
    }
    if (!st) return goal;
    while (st.node < st.path.length - 1 && Math.hypot(st.path[st.node].x - team.x, st.path[st.node].y - team.y) < 30) st.node++;
    return st.path[st.node] ?? goal;
  }

  /**
   * A posted officer breaks formation for one reason only: a man at the sally port.
   * Anywhere else he keeps walking his beat — otherwise the whole detail piles onto the
   * operative, and crowd separation shoves the outer men into the sea.
   */
  private postEngaged(e: Enemy, dist: number) {
    return this.px > PRISON_DOOR.x - 60 && dist < 420 && this.hasLine(e.x, e.y, this.px, this.py);
  }

  /** Open water: anything off the bridge, the beaches and the island plateau. */
  private inWater(x: number, y: number) {
    if (x < SEA.x - 30) return false;          // the legacy mainland is dry everywhere
    return !this.onDryGround(x, y);
  }

  /** Walkable ground: keeps beat nodes off the open sea and off the beach waterline. */
  private onDryGround(x: number, y: number, margin = 0) {
    if (x < SEA.x) return true;
    for (const p of this.dryLand) {
      if (x > p.x && x < p.x + p.w && y > p.y + margin && y < p.y + p.h - margin) return true;
    }
    if (x > COAST.x && x < COAST.x + COAST.w && y > COAST.y && y < COAST.y + COAST.h) return true;
    if (x > BRIDGEHEAD.x && x < BRIDGEHEAD.x + BRIDGEHEAD.w && y > BRIDGEHEAD.y && y < BRIDGEHEAD.y + BRIDGEHEAD.h) return true;
    // keep a parapet's width clear so a beat never clips the railing
    if (x > BRIDGE.x - 8 && x < BRIDGE.x + BRIDGE.w + 8 && y > BRIDGE.y + margin && y < BRIDGE.y + BRIDGE.h - margin) {
      // a dropped span is a hole in the world: nothing walks across it
      if (this.bridgeDown) {
        const g0 = BRIDGE.x + BRIDGE.w * 0.4, g1 = BRIDGE.x + BRIDGE.w * 0.68;
        if (x > g0 && x < g1) return false;
      }
      return true;
    }
    const cx = LAND.x + LAND.w / 2, cy = LAND.y + LAND.h / 2;
    const ex = (x - cx) / (LAND.w / 2), ey = (y - cy) / (LAND.h / 2);
    return ex * ex + ey * ey <= 0.93;
  }

  /**
   * WATER IS A WALL. No infantryman in this game can swim, so the shoreline is a hard
   * collision: a step that would put a man in the sea is refused, and the axis that is
   * still on dry land is kept so he slides along the beach instead of stopping dead.
   * Vehicles and pilots are handled elsewhere — nobody takes a tank for a swim either.
   */
  private holdOnLand(prevX: number, prevY: number, e: { x: number; y: number; vx?: number; vy?: number }) {
    if (!this.inWater(e.x, e.y)) return false;
    if (!this.inWater(e.x, prevY)) { e.y = prevY; if (e.vy !== undefined) e.vy = 0; return true; }
    if (!this.inWater(prevX, e.y)) { e.x = prevX; if (e.vx !== undefined) e.vx = 0; return true; }
    if (!this.inWater(prevX, prevY)) {
      e.x = prevX; e.y = prevY;
      if (e.vx !== undefined) e.vx = 0;
      if (e.vy !== undefined) e.vy = 0;
      return true;
    }
    return false;
  }

  /**
   * A posted officer walking his beat. Cheap enough to run for every island/bridge post
   * every frame, so a distant garrison never has to be skipped just to keep the frame rate.
   */
  private walkPost(e: Enemy, dt: number): boolean {
    const path = e.patrol;
    if (!path || !path.length) return false;
    const node = path[(e.patrolNode || 0) % path.length];
    const dx = node.x - e.x, dy = node.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 14) { e.patrolNode = ((e.patrolNode || 0) + 1) % path.length; return true; }
    const sp = Math.max(26, e.def.speed * 0.42);
    const nx = e.x + (dx / d) * sp * dt, ny = e.y + (dy / d) * sp * dt;
    if (this.pointBlocked(nx, ny) || !this.onDryGround(nx, ny)) { e.patrolNode = ((e.patrolNode || 0) + 1) % path.length; return true; }
    e.x = nx; e.y = ny;
    e.ang = lerpAngle(e.ang, Math.atan2(dy, dx), 1 - Math.exp(-5 * dt));
    return true;
  }

  /** Helicopter flight has momentum, drag, banking and independent weapons. */
  private updatePlayerHeli(dt: number) {
    const h = this.playerHeli;
    if (!h) { this.piloting = false; return; }
    const m = this.moveVector();
    let targetAng = h.ang;
    let firing = false;
    if (this.aimStick.active) {
      const dx = this.aimStick.x - this.aimStick.ox, dy = this.aimStick.y - this.aimStick.oy;
      if (Math.hypot(dx, dy) > 12) { targetAng = Math.atan2(dy, dx); firing = true; }
    } else if (!this.isTouch) {
      targetAng = Math.atan2(this.mouseY + this.camY - h.y, this.mouseX + this.camX - h.x);
      firing = this.firing;
    }
    let turn = targetAng - h.ang;
    while (turn > Math.PI) turn -= TAU;
    while (turn < -Math.PI) turn += TAU;
    const turnStep = Math.min(Math.abs(turn), 2.5 * dt);
    h.ang += Math.sign(turn) * turnStep;
    h.bank = lerp(h.bank, clamp(turn * 0.9, -0.65, 0.65), 1 - Math.pow(0.006, dt));
    const thrust = 610 * (h.fuel > 0 ? 1 : 0.35);
    h.vx = lerp(h.vx, m.x * thrust, 1 - Math.pow(0.08, dt));
    h.vy = lerp(h.vy, m.y * thrust, 1 - Math.pow(0.08, dt));
    h.x = clamp(h.x + h.vx * dt, 100, ARENA_W - 100);
    h.y = clamp(h.y + h.vy * dt, 100, ARENA_H - 100);
    h.rotor += dt * (24 + Math.hypot(h.vx, h.vy) * 0.02);
    h.fuel = Math.max(0, h.fuel - dt * (m.len > 0.1 ? 1.05 : 0.3));
    h.fireCd = Math.max(0, h.fireCd - dt);
    h.rocketCd = Math.max(0, h.rocketCd - dt);
    // magazines refill slowly in the air, so a long sortie never ends empty
    for (let i = 0; i < HELI_ORDNANCE.length; i++) {
      const w = HELI_ORDNANCE[i];
      if (w.max > 0) h.ammo[i] = Math.min(w.max, h.ammo[i] + dt / w.regen);
    }
    if (firing) this.fireHeliStation(h);
    this.px = h.x; this.py = h.y; this.pvx = h.vx; this.pvy = h.vy; this.pang = h.ang;
    if (Math.random() < 0.55) this.addParticle(h.x - Math.cos(h.ang) * 60, h.y - Math.sin(h.ang) * 60, rand(-18, 18), rand(15, 48), 0.35, rand(2, 4), '#8ba0a8', true);
    if (h.fuel <= 0 && Math.hypot(h.vx, h.vy) < 50) this.addText(h.x, h.y - 76, 'FUEL LOW — LAND', '#ffb060', 13);
  }

  /** Quick-draw ground rockets: G always throws a Hellfire pair, whatever is selected. */
  private fireHeliRocket(h: PlayerHeli) { this.fireHeliStation(h, 1); }

  /** Pick the station. 1 chain gun, 2 Hellfire, 3 Sidewinder. */
  selectHeliStation(h: PlayerHeli, index: number) {
    const i = clamp(index, 0, HELI_ORDNANCE.length - 1) | 0;
    if (h.station === i) return;
    h.station = i;
    const w = HELI_ORDNANCE[i];
    this.addText(h.x, h.y - 74, `${w.name} · ${w.note}`, '#a9ecff', 13);
    sfx.click();
  }

  /**
   * Nearest airborne contact — transports, troops still on parachute or rope, and
   * enemy gunships. Anything that flies counts, which is what the Sidewinder sees.
   */
  heliAirTarget(from: { x: number; y: number }, range = 2600): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = range;
    for (const a of this.airTransports) {
      const p = { x: a.x, y: a.y - a.altitude * 0.55 };
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d < bd) { bd = d; best = p; }
    }
    for (const p of this.airTroops) {
      const drop = p.duration > 0 ? clamp(p.progress / p.duration, 0, 1) : 1;
      const q = { x: p.x, y: p.y - p.altitude * (1 - drop) };
      const d = Math.hypot(q.x - from.x, q.y - from.y);
      if (d < bd) { bd = d; best = q; }
    }
    for (const h of this.helis) {
      if (h.hp <= 0) continue;
      const d = Math.hypot(h.x - from.x, h.y - from.y);
      if (d < bd) { bd = d; best = { x: h.x, y: h.y }; }
    }
    return best;
  }

  /** Fire whatever station is selected. Each weapon only exists for one target class. */
  private fireHeliStation(h: PlayerHeli, force?: number) {
    const idx = clamp(force ?? h.station ?? 0, 0, HELI_ORDNANCE.length - 1) | 0;
    const w = HELI_ORDNANCE[idx];
    if (idx === 0 ? h.fireCd > 0 : h.rocketCd > 0) return;
    const rounds = Math.max(0, Math.floor(h.ammo[idx]));
    if (w.max > 0 && rounds <= 0) {
      h.rocketCd = 0.8;
      this.addText(h.x, h.y - 74, `${w.short} EMPTY — REARMING`, '#ff9d7a', 12);
      return;
    }
    if (w.target === 'air' && !this.heliAirTarget(h, 2600)) {
      h.rocketCd = 0.6;
      this.addText(h.x, h.y - 74, 'NO AIR CONTACT — SIDEWINDER HELD', '#9fe4ff', 12);
      return;
    }
    const shots = w.max > 0 ? Math.min(w.burst, rounds) : w.burst;
    if (w.max > 0) h.ammo[idx] = rounds - shots;
    if (idx === 0) {
      h.fireCd = w.rate;
      for (const side of [-1, 1]) {
        const a = h.ang + rand(-0.025, 0.025);
        const ox = Math.cos(h.ang + Math.PI / 2) * side * 22;
        const oy = Math.sin(h.ang + Math.PI / 2) * side * 22;
        this.bullets.push({ x: h.x + ox, y: h.y + oy, px: h.x, py: h.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, dmg: w.dmg, life: w.life, friendly: true, color: w.color, r: 3, hits: [], arm: w.target === 'any' ? undefined : w.target });
        this.addParticle(h.x + ox + Math.cos(a) * 22, h.y + oy + Math.sin(a) * 22, Math.cos(a) * rand(180, 360), Math.sin(a) * rand(180, 360), 0.12, 3, '#fff2c4', true);
      }
      this.addLight(h.x, h.y, 170, '180,240,255', 0.1);
      sfx.shoot('smg');
      return;
    }
    h.rocketCd = w.rate;
    for (let i = 0; i < shots; i++) {
      const side = shots === 1 ? 0 : i === 0 ? -1 : 1;
      const a = h.ang + side * 0.035;
      this.bullets.push({
        x: h.x + Math.cos(h.ang + Math.PI / 2) * side * 30,
        y: h.y + Math.sin(h.ang + Math.PI / 2) * side * 30,
        px: h.x, py: h.y,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg, life: w.life, friendly: true, rocket: true, color: w.color, r: 6, hits: [],
        arm: w.target === 'any' ? undefined : w.target,
        homing: w.target === 'air',
      });
    }
    this.addLight(h.x, h.y, 300, idx === 2 ? '150,225,255' : '255,190,110', 0.15);
    sfx.shoot('rocket');
  }

  private collideBarriers(o: { x: number; y: number }, r: number) {
    for (const b of this.barriers) {
      if (b.friendly) continue;
      const rx = o.x - b.x, ry = o.y - b.y;
      const lx = rx * Math.cos(-b.ang) - ry * Math.sin(-b.ang);
      const ly = rx * Math.sin(-b.ang) + ry * Math.cos(-b.ang);
      if (Math.abs(lx) < b.w / 2 + r && Math.abs(ly) < 14 + r) {
        const push = (14 + r - Math.abs(ly)) * (ly < 0 ? -1 : 1);
        o.x += -Math.sin(b.ang) * push;
        o.y += Math.cos(b.ang) * push;
      }
    }
  }

  /** Everything the operative could shoulder right now, in kit order. */
  private carriedWeapons(): { id: string; ammo: number }[] {
    // The DMR and the heavy MG are real pickups (armoury crates, sniper lockers, drops), but
    // they were missing from this list, which meant that carrying one took a slot away from
    // the carbine and left the gun unreachable from the number keys.
    const order = ['rifle', 'shotgun', 'smg', 'rocket', 'gl', 'dmr', 'hmg'];
    const out: { id: string; ammo: number }[] = [];
    for (const id of order) {
      if (!WEAPONS[id]) continue;
      if (id === this.weapon) { out.push({ id, ammo: this.ammo }); continue; }
      const banked = this.weaponAmmo.get(id);
      const base = WEAPONS[id].ammo;
      if (base === Infinity) { out.push({ id, ammo: Infinity }); continue; }
      if (banked === undefined) continue;
      if (banked > 0) out.push({ id, ammo: banked });
    }
    return out;
  }

  /**
   * Number keys 1-6 shoulder a carried weapon. Pressing the same number again puts it away
   * for the carbine. A dry tube falls through to the next weapon that still has rounds in
   * it instead of dumping the operative straight back on the rifle.
   */
  selectWeapon(id: string): boolean {
    if (this.status !== 'playing') return false;
    if (this.playerJet || this.playerTank || this.drivingVan || this.flyingPlane || this.piloting || this.drivingBoat) return false;
    if (!WEAPONS[id]) return false;
    if (id !== 'rifle') {
      const banked = id === this.weapon ? this.ammo : this.weaponAmmo.get(id);
      if (banked !== undefined && banked <= 0) {
        this.addText(this.px, this.py - 34, `${WEAPONS[id].short} — DRY`, '#9fb3c8', 14);
        return false;
      }
    }
    if (this.ammo !== Infinity) this.weaponAmmo.set(this.weapon, this.ammo);
    this.weapon = id;
    const base = WEAPONS[id].ammo;
    const banked = this.weaponAmmo.get(id);
    this.ammo = base === Infinity ? Infinity : (banked !== undefined ? Math.max(0, banked) : base);
    this.fireCd = Math.min(this.fireCd, 0.12);
    sfx.click();
    this.addText(this.px, this.py - 40, WEAPONS[id].short, WEAPONS[id].color, 14);
    return true;
  }

  /**
   * R tops the gun up from the reserve: the tube in your hands pulls rounds out of the
   * banked pile for the same weapon, so a half-empty magazine is never thrown away by a
   * careless pickup. The carbine needs nothing, and a tube with no reserve says so.
   */
  reloadWeapon() {
    if (this.status !== 'playing') return;
    if (this.playerJet || this.playerTank || this.drivingVan || this.flyingPlane || this.piloting || this.drivingBoat) return;
    const W = WEAPONS[this.weapon];
    if (!W || this.ammo === Infinity) {
      this.addText(this.px, this.py - 34, 'NO RESERVE — UNLIMITED', '#9fb3c8', 13);
      return;
    }
    const banked = this.weaponAmmo.get(this.weapon) ?? 0;
    const want = W.ammo - this.ammo;
    if (want <= 0.5) { this.addText(this.px, this.py - 34, `${W.short} — FULL`, '#9fb3c8', 13); return; }
    if (banked <= 0) { this.addText(this.px, this.py - 34, `${W.short} — NO SPARE`, '#ff9d80', 13); return; }
    const take = Math.min(want, banked);
    this.ammo += take;
    const left = banked - take;
    if (left > 0.5) this.weaponAmmo.set(this.weapon, left); else this.weaponAmmo.delete(this.weapon);
    sfx.click();
    this.addText(this.px, this.py - 40, `RELOAD ${W.short} +${Math.floor(take)}`, W.color, 14);
  }

  /** The next weapon with rounds in it, or the carbine when everything is dry. */
  private fallbackWeapon(): string {
    const list = this.carriedWeapons().filter((w) => w.id !== this.weapon);
    const stocked = list.filter((w) => w.ammo === Infinity || w.ammo > 0)
      .sort((a, b) => (b.ammo === Infinity ? 1 : b.ammo) - (a.ammo === Infinity ? 1 : a.ammo));
    return stocked.length ? stocked[0].id : 'rifle';
  }

  private shoot() {
    const W = WEAPONS[this.weapon], M = this.mods;
    this.fireCd = W.rate * M.fireRateMul;
    const muzzle = 26 + W.len;
    const bx = this.px + Math.cos(this.pang) * muzzle;
    const by = this.py + Math.sin(this.pang) * muzzle;
    const dmg = W.dmg * M.damageMul, spread = W.spread * M.spreadMul;

    // The street reacts: anything within earshot stops and puts its hazards on, and the
    // people on the verge run for the nearest cover they can find.
    for (const p of this.peds) {
      if (Math.abs(p.x - this.px) < 900 && Math.abs(p.y - this.py) < 900) p.panic = 2.4 + rand(0, 1.8);
    }
    for (const c of this.roadCars) {
      if (c.dead || c.panic > 0) continue;
      if (Math.abs(c.x - this.px) < 900 && Math.abs(c.y - this.py) < 900) c.panic = 2.6 + rand(0, 1.4);
    }

    // Grenade launcher — lobs a heavy arc shot instead of a bullet
    if (this.weapon === 'gl') {
      this.nades.push({
        x: this.px + Math.cos(this.pang) * 24, y: this.py + Math.sin(this.pang) * 24,
        vx: Math.cos(this.pang) * 760, vy: Math.sin(this.pang) * 760,
        t: 0.85, z: 0, vz: 120, dmg: 105, big: true,
      });
      this.recoil = Math.min(12, this.recoil + 6);
      this.pvx -= Math.cos(this.pang) * 46; this.pvy -= Math.sin(this.pang) * 46;
      sfx.shoot('shotgun');
      this.addLight(bx, by, 240, '255,190,110', 0.14);
      this.ammo -= 1;
      if (this.ammo <= 0) {
        this.weaponAmmo.set(this.weapon, 0);
        const next = this.fallbackWeapon();
        this.weapon = next;
        this.ammo = WEAPONS[next].ammo === Infinity ? Infinity : Math.max(0, this.weaponAmmo.get(next) ?? WEAPONS[next].ammo);
        this.addText(this.px, this.py - 34, `RELOAD → ${WEAPONS[next].short}`, '#9fb3c8', 15);
      }
      return;
    }

    for (let i = 0; i < W.pellets; i++) {
      const a = this.pang + rand(-spread, spread);
      const sp = W.speed * M.bulletSpeedMul * rand(0.94, 1.06);
      this.bullets.push({
        x: bx, y: by, px: bx, py: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg,
        life: W.rocket ? 2.4 : 0.85, friendly: true, rocket: W.rocket, color: W.color,
        r: W.rocket ? 6 : 3, pierce: W.rocket ? 0 : M.pierce, hits: [], explosive: W.rocket ? 0 : M.explosive,
      });
    }
    for (let i = 0; i < (W.rocket ? 24 : 7); i++) {
      const a = this.pang + rand(-0.5, 0.5);
      this.addParticle(bx, by, Math.cos(a) * rand(90, 430), Math.sin(a) * rand(90, 430), rand(0.06, 0.2), rand(2, 5), i % 2 ? '#fff2c4' : W.color, true);
    }
    this.addLight(bx, by, W.rocket ? 300 : 170, '255,210,130', 0.12);
    this.shocks.push({ x: bx, y: by, r: 4, max: W.rocket ? 48 : 20, life: 0.14, t: 0.14, color: '255,225,150', width: 3 });
    this.addParticle(this.px, this.py, Math.cos(this.pang + 1.8) * rand(60, 130), Math.sin(this.pang + 1.8) * rand(60, 130), 0.7, 2, '#e0b464', false, 260);

    this.recoil = Math.min(10, this.recoil + W.kick * 0.55);
    this.pvx -= Math.cos(this.pang) * W.kick * 5;
    this.pvy -= Math.sin(this.pang) * W.kick * 5;
    sfx.shoot(W.sound);

    if (this.ammo !== Infinity) {
      this.ammo -= 1;
      if (this.ammo <= 0) {
        this.weaponAmmo.set(this.weapon, 0);
        const next = this.fallbackWeapon();
        this.weapon = next;
        this.ammo = WEAPONS[next].ammo === Infinity ? Infinity : Math.max(0, this.weaponAmmo.get(next) ?? WEAPONS[next].ammo);
        this.addText(this.px, this.py - 34, `RELOAD → ${WEAPONS[next].short}`, '#9fb3c8', 15);
      }
    }
  }

  /* ---------------- player profiling ---------------- */

  private updateProfile(dt: number) {
    const spd = Math.hypot(this.pvx, this.pvy);
    this.mobility = lerp(this.mobility, clamp(spd / 282, 0, 1.2), 1 - Math.pow(0.2, dt));
    if (spd < 50) this.stationaryT += dt; else this.stationaryT = 0;
    this.camping = lerp(this.camping, clamp(this.stationaryT / 4.5, 0, 1), 1 - Math.pow(0.3, dt));
    const now = performance.now() / 1000;
    this.dashLog = this.dashLog.filter((t) => now - t < 20);

    this.profileT -= dt;
    if (this.profileT > 0) return;
    this.profileT = 0.5;

    const hostiles = this.enemies.filter((e) => !e.def.civilian);
    if (hostiles.length) {
      let best = Infinity;
      for (const e of hostiles) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < best) best = d;
      }
      this.avgRange = lerp(this.avgRange, best, 0.3);
      let blocked = 0, n = 0;
      const step = Math.max(1, Math.floor(hostiles.length / 4));
      for (let i = 0; i < hostiles.length && n < 4; i += step) {
        const e = hostiles[i];
        if (Math.hypot(e.x - this.px, e.y - this.py) < 800) { n++; if (!this.hasLine(e.x, e.y, this.px, this.py)) blocked++; }
      }
      if (n) this.coverUse = lerp(this.coverUse, blocked / n, 0.4);
    }

    // HQ intelligence multiplier — smart from the start, crippled as you destroy it
    const serversAlive = this.servers.filter((s) => !s.dead).length;
    const satsAlive = this.satcoms.filter((s) => !s.dead).length;
    const codersAlive = this.coders.filter((c) => c.hp > 0).length;
    const infra = this.servers.length ? serversAlive / this.servers.length : 0;
    const sat = this.satcoms.length ? satsAlive / this.satcoms.length : 1;
    const staff = this.coders.length ? codersAlive / this.coders.length : 0;
    const generalAlive = this.general && this.general.hp > 0 ? 1 : 0;
    const cmd = (infra * 0.42 + sat * 0.16 + staff * 0.22 + generalAlive * 0.2);
    this.commandOnline = cmd > 0.15;
    this.aiLevel = clamp((0.56 + this.sector * 0.12 + this.wave * 0.03) * (0.35 + cmd * 0.65), 0.2, 1.65);

    this.adaptT -= 0.5;
    if (this.adaptT <= 0) {
      this.adaptT = 6;
      if (this.vtols.some((v) => v.state !== 'out')) this.aiNote = 'VTOL DEPLOYMENTS INBOUND';
      else if (!this.commandOnline) this.aiNote = 'COMMAND NET DOWN — UNITS IMPROVISING';
      else if (serversAlive < this.servers.length) this.aiNote = `MAINFRAMES ${serversAlive}/${this.servers.length} — DEGRADED`;
      else if (this.camping > 0.55) this.aiNote = 'TARGET STATIC → FLANKING ORDER';
      else if (this.mobility > 0.7) this.aiNote = 'TARGET MOBILE → INTERCEPT NET';
      else if (this.dashLog.length >= 6) this.aiNote = 'DASH PATTERN LEARNED → LEAD FIRE';
      else if (this.coverUse > 0.45) this.aiNote = 'COVER DETECTED → BOMBARDIER SUPPORT';
      else if (this.avgRange > 480) this.aiNote = 'STANDOFF → CLOSING FORMATION';
      else this.aiNote = 'HQ ONLINE — PLANNING';
    }
  }

  /* ---------------- SUPREME COMMAND: the General plans attacks ---- */

  private updateCommand(dt: number) {
    this.planT -= dt;
    if (this.planT > 0) return;
    this.planT = this.commandOnline ? 10 : 28;

    // Choose an army-wide doctrine based on learned player profile.
    let t: Tactic;
    if (!this.commandOnline) {
      t = 'column';
    } else if (this.camping > 0.55) {
      t = this.wave % 2 ? 'bombers' : 'pincer';
    } else if (this.coverUse > 0.45) {
      t = 'bombers';                                       // grenade the cover
    } else if (this.mobility > 0.7) {
      t = this.phase === 'assault' ? 'ambush' : 'encircle';
    } else if (this.avgRange > 480) {
      t = 'blitz';
    } else if (this.hp > this.maxHp * 0.7) {
      t = this.phase === 'siege' ? 'turtle' : 'phalanx';
    } else {
      t = 'blitz';
    }
    this.planTactic = t;

    if (this.commandOnline && this.squads.length) {
      // Re-task living squads to the new army plan; anchors keep their role.
      for (const s of this.squads) {
        if (s.doctrine === 'anchor') continue;
        s.tactic = t; s.state = 'advance'; s.stateT = 0;
      }
      // The General gives a live callout explaining the shift.
      const callout: Record<Tactic, string[]> = {
        phalanx: ['SHIELDS UP. WALL THEM IN.'],
        turtle: ['ARMOR RING. GRIND HIM DOWN.'],
        blitz: ['FULL THROTTLE. RUN HIM OVER.'],
        bombers: ['GRENADIERS. FLOOD THE POSITION.'],
        column: ['FORM COLUMN. MOVE FAST.'],
        pincer: ['SPLIT THE LINE. CROSSFIRE.'],
        encircle: ['NO WAY OUT. SURROUND.'],
        ambush: ['HOLD. THEN STRIKE.'],
      };
      let q = callout[t][Math.floor(Math.random() * callout[t].length)];
      if (this.hp < this.maxHp * 0.35) q = 'HE IS WOUNDED. EXECUTE THE PURSUIT.';
      else if (this.camping > 0.55) q = 'HE WILL NOT MOVE. BOMBARD THE COVER.';
      else if (this.mobility > 0.7) q = 'HE RUNS. CUT THE ROUTES.';
      this.addText(this.px, this.py - 100, `HQ ORDER: ${TACTIC_LABEL[t]}`, '#ffb0b0', 17);
      this.addText(this.px, this.py - 78, `“${q}”`, '#ffd166', 13);
      sfx.click();
    }
  }

  /* ---------------- waves ---------------- */

  /** VTOL dropships ferry squads from the fortresses' helipads onto the field. */
  private updateVTOLs(dt: number) {
    for (let i = this.vtols.length - 1; i >= 0; i--) {
      const v = this.vtols[i];
      v.rotor += dt * 28;

      if (v.state === 'in') {
        const dx = v.tx - v.x, dy = v.ty - v.y;
        const d = Math.hypot(dx, dy) || 1;
        v.ang = Math.atan2(dy, dx);
        const sp = 1150;
        if (d <= sp * dt * 1.3) {
          v.state = 'hover'; v.hoverT = 0;
          // announce the delivery if the player will see it
          if (!v.announced && Math.hypot(v.x - this.px, v.y - this.py) < 1500) {
            v.announced = true;
            this.addText(v.x, v.y - 60, '⚠ VTOL DEPLOYING', '#ffb0b0', 15);
            if (Math.hypot(v.x - this.px, v.y - this.py) < 1400) sfx.rotor();
          }
          continue;
        }
        v.x += (dx / d) * sp * dt;
        v.y += (dy / d) * sp * dt;
        // steady flight bob
        v.y += Math.sin(v.rotor * 0.35) * 10 * dt;
        // wake trail
        if (Math.random() < 0.7)
          this.addParticle(v.x - Math.cos(v.ang) * 70, v.y - Math.sin(v.ang) * 70, rand(-20, 20), rand(20, 55), rand(0.3, 0.6), rand(2, 4), '#7d97a5', true);
      } else if (v.state === 'hover') {
        v.hoverT += dt;
        // rotor downwash
        if (Math.random() < 0.85) {
          const a = rand(0, TAU), r = rand(30, 110);
          this.addParticle(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r * 0.4 + 8,
            Math.cos(a) * rand(60, 130), rand(20, 80), rand(0.3, 0.6), rand(2, 4.5), '#93ac9d', true);
        }
        // depart once its squad is aboard the fight
        const hasQueued = this.spawnQueue.some((s) => s.squadId === v.squadId);
        const hasAlive = this.enemies.some((e) => e.squadId === v.squadId);
        if (!hasQueued && v.hoverT > 0.6) {
          v.state = 'out';
          if (hasAlive && v.announced) this.addText(v.x, v.y - 60, 'UNITS AWAY', '#9fb3c8', 12);
        }
      } else { // out — climb away
        const backAng = Math.atan2(HQ.cy - v.y, HQ.cx - v.x);
        v.ang = lerpAngle(v.ang, backAng, 1 - Math.pow(0.01, dt));
        v.x += Math.cos(v.ang) * 1300 * dt;
        v.y += Math.sin(v.ang) * 1300 * dt - 800 * dt;
        v.rotor += dt * 10;
        if (Math.hypot(v.x - HQ.cx, v.y - HQ.cy) < 400 || v.y < -400) this.vtols.splice(i, 1);
      }
    }
  }

  /** Armored convoy trucks — roll out, stop, and troops jump off the tailgate. */
  private updateTrucks(dt: number) {
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      const t = this.trucks[i];
      if (t.dead) { this.trucks.splice(i, 1); continue; }
      if ((t.launchDelay || 0) > 0) { t.launchDelay = Math.max(0, (t.launchDelay || 0) - dt); continue; }
      let motion = this.convoyMotion.get(t);
      if (!motion) {
        const home = this.routes.nearest(t);
        t.x = home.x; t.y = home.y;
        motion = { path: [], node: 0, revision: -1, replan: 0, idle: 0, home, stage: '', door: 0, loaded: 0, loadTime: 0, depart: t.rescue };
        this.convoyMotion.set(t, motion);
        if (!t.rescue) {
          t.state = 'loading'; t.speed = 0;
          t.comp.forEach((type, order) => {
            const p = { x: t.x - Math.cos(t.ang) * (140 + order * 34) - Math.sin(t.ang) * 58, y: t.y - Math.sin(t.ang) * (140 + order * 34) + Math.cos(t.ang) * 58 };
            this.collide(p, 16);
            const e = this.makeEnemy(type, p.x, p.y, t.squadId, order);
            e.boardingTruck = t.squadId; e.boardingOrder = order; e.spawnT = 0;
            this.enemies.push(e);
          });
        }
      }
      motion.door = lerp(motion.door, t.state === 'loading' || t.state === 'deploy' ? 1 : 0, 1 - Math.exp(-2 * dt));
      if (t.disabled) {
        this.plantTruck(t, dt);
        // A knocked-out rig never rolls again: its crew bails out where it stopped.
        if (t.state === 'loading' || t.state === 'drive') { t.state = 'deploy'; t.deployT = 1; }
      }
      if (t.rescue) {
        this.updateRescueTruck(t, dt);
        continue;
      }
      if (t.state === 'loading') {
        motion.loadTime += dt;
        const crew = this.enemies.filter(e => e.boardingTruck === t.squadId);
        for (const e of crew) {
          const order = e.boardingOrder || 0;
          const gap = order > motion.loaded ? 48 + (order - motion.loaded) * 31 : 0;
          const x = t.x - Math.cos(t.ang) * (90 + gap), y = t.y - Math.sin(t.ang) * (90 + gap);
          const d = Math.hypot(x - e.x, y - e.y);
          if (d > 2) {
            e.ang = Math.atan2(y - e.y, x - e.x);
            const step = Math.min(d, dt * 82);
            e.x += (x - e.x) / d * step; e.y += (y - e.y) / d * step; e.wobble += dt * 6;
          }
          if (order === motion.loaded && d < 12 && motion.loadTime > 0.85) {
            this.enemies.splice(this.enemies.indexOf(e), 1);
            motion.loaded++; motion.loadTime = 0;
          }
        }
        if (motion.loaded < t.comp.length && !crew.some(e => e.boardingOrder === motion.loaded)) {
          t.comp[motion.loaded] = ''; motion.loaded++; motion.loadTime = 0;
        }
        if (motion.loaded >= t.comp.length && motion.loadTime > 1.25) {
          t.comp = t.comp.filter(Boolean);
          t.state = t.comp.length ? 'drive' : 'leave';
          motion.depart = true; motion.replan = 0;
          this.addText(t.x, t.y - 58, 'CREW ABOARD / CONVOY DEPARTING', '#e9c481', 12);
        }
        continue;
      }
      if (t.state === 'drive') {
        if (t.disabled) { t.speed = 0; continue; }
        if (!t.announced && Math.hypot(t.x - this.px, t.y - this.py) < 1500) {
          t.announced = true;
          this.addText(t.x, t.y - 58, 'HYDRA TRANSPORT / APPROACHING', '#ffb0b0', 13);
        }
        this.moveTruck(t, dt);
      } else if (t.state === 'deploy') {
        t.speed = 0;
        t.deployT -= dt;
        if (t.deployT <= 0 && t.slot < t.comp.length && motion.door > 0.9) {
          t.deployT = 0.85;
          const tx = t.x - Math.cos(t.ang) * 105;
          const ty = t.y - Math.sin(t.ang) * 105;
          this.spawnEnemy(t.comp[t.slot], t.squadId, t.slot, tx, ty);
          for (let k = 0; k < 8; k++)
            this.addParticle(tx, ty, rand(-40, 40), rand(-10, 50), rand(0.25, 0.45), rand(2, 4), '#9aa78c', true);
          t.slot++;
        } else if (t.slot >= t.comp.length && t.deployT < -1.6) {
          t.state = 'leave'; motion.replan = 0;
        }
      } else {
        if (t.disabled) continue;
        this.moveTruck(t, dt);
        if (Math.hypot(t.x - motion.home.x, t.y - motion.home.y) < 60) {
          const bay = t.parking || this.vans.find(v => v.reserved && Math.hypot(v.x - motion.home.x, v.y - motion.home.y) < 100);
          if (bay) { bay.reserved = false; bay.x = t.x; bay.y = t.y; bay.ang = t.ang; bay.hp = Math.min(bay.maxHp, t.hp); }
          this.trucks.splice(i, 1);
        }
      }
    }
  }

  /** Medical recovery truck: pulls up, visibly boards casualties, then returns to Hydra HQ. */
  private updateRescueTruck(t: Truck, dt: number) {
    if (t.state === 'drive') {
      const target = this.wounded.find((w) => !w.beingCarried);
      if (!target) { t.state = 'leave'; return; }
      t.tx = target.x; t.ty = target.y;
      const dx = t.tx - t.x, dy = t.ty - t.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      let turn = want - t.ang;
      while (turn > Math.PI) turn -= TAU;
      while (turn < -Math.PI) turn += TAU;
      t.ang += Math.sign(turn) * Math.min(Math.abs(turn), 1.25 * dt);
      t.lean = lerp(t.lean, clamp(turn * 0.55, -0.24, 0.24), 1 - Math.pow(0.02, dt));
      t.speed = lerp(t.speed, d < 190 ? 90 : 275, 1 - Math.pow(0.05, dt));
      this.moveTruck(t, dt);
      if (!t.announced && Math.hypot(t.x - this.px, t.y - this.py) < 1200) {
        t.announced = true;
        this.addText(t.x, t.y - 48, '⚕ RECOVERY VEHICLE', '#8dffb0', 14);
      }
      if (d < 195 && this.hasLine(t.x, t.y, target.x, target.y)) {
        t.state = 'deploy'; t.speed = 0; t.rescueWait = 1.7;
        for (const w of this.wounded) {
          if (!w.beingCarried && Math.hypot(w.x - t.x, w.y - t.y) < 215) {
            w.beingCarried = true; w.carrier = t.squadId;
          }
        }
        this.addText(t.x, t.y - 48, 'BOARD WOUNDED', '#8dffb0', 13);
      }
    } else if (t.state === 'deploy') {
      t.rescueWait -= dt;
      const boarding = this.wounded.some((w) => w.beingCarried && w.carrier === t.squadId);
      if (t.rescueWait <= 0 && !boarding) t.state = 'leave';
    } else {
      const home = this.convoyMotion.get(t)?.home || { x: HQ.cx, y: HQ.cy + HQ.h / 2 };
      const dx = home.x - t.x, dy = home.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      let turn = want - t.ang;
      while (turn > Math.PI) turn -= TAU;
      while (turn < -Math.PI) turn += TAU;
      t.ang += Math.sign(turn) * Math.min(Math.abs(turn), 1.5 * dt);
      t.lean = lerp(t.lean, clamp(turn * 0.5, -0.25, 0.25), 1 - Math.pow(0.02, dt));
      t.speed = lerp(t.speed, 330, 1 - Math.pow(0.05, dt));
      this.moveTruck(t, dt);
      if (d < 180) {
        if (t.carrying > 0) this.addText(t.x, t.y - 42, `${t.carrying} CASUALTIES RECOVERED`, '#8dffb0', 13);
        this.trucks.splice(this.trucks.indexOf(t), 1);
      }
    }
  }

  /** Blown tyre: the rig slews sideways, sheds smoke and comes to rest for good. */
  private plantTruck(t: Truck, dt: number) {
    t.wreckT = (t.wreckT || 0) + dt;
    if (t.wreckT > 45) { t.dead = true; return; }   // recovered by a Hydra tow rig
    const sign = t.squadId % 2 ? 1 : -1;
    const skidding = (t.skidT || 0) > 0;
    if (skidding) t.skidT = Math.max(0, (t.skidT || 0) - dt);
    t.speed = Math.max(0, t.speed - (skidding ? 110 : 520) * dt);
    t.lean = lerp(t.lean, 0.42 * sign * (skidding ? 1 : 0.6), 1 - Math.exp(-2.5 * dt));
    if (t.speed > 3) {
      const nx = t.x + Math.cos(t.ang) * t.speed * dt, ny = t.y + Math.sin(t.ang) * t.speed * dt;
      const probe = { x: nx, y: ny }; this.collide(probe, 34);
      if (Math.hypot(probe.x - nx, probe.y - ny) < 0.5) { t.x = nx; t.y = ny; }
      else t.speed = 0;
      if (skidding) t.ang += sign * dt * 1.5;
    }
    if (Math.random() < dt * 22)
      this.addParticle(t.x - Math.cos(t.ang) * 70 + rand(-16, 16), t.y - Math.sin(t.ang) * 70 + rand(-16, 16),
        rand(-24, 24), rand(-8, 28), rand(0.4, 0.9), rand(2, 4), '#43413c', true);
    if (Math.random() < dt * 9)
      this.addParticle(t.x + rand(-20, 20), t.y + rand(-20, 20), rand(-6, 6), -rand(18, 46),
        rand(0.8, 1.5), rand(4, 7), '#2b2d2b', true);
  }

  /** Truck collision uses a wide vehicle body, not a point, so convoys cannot ghost through walls. */
  private moveTruck(t: Truck, dt: number) {
    const m = this.convoyMotion.get(t);
    if (!m) return;
    m.replan -= dt;
    let goal: Point = t.state === 'leave' ? m.home : { x: t.tx, y: t.ty };
    if (m.stage !== t.state || m.revision !== this.routes.revision || m.replan <= 0 || !m.path.length) {
      // Amortize convoy planning instead of running every truck's A* on the same frame.
      if (this.pathBudget <= 0) { t.speed = Math.max(0, t.speed - 200 * dt); return; }
      this.pathBudget--;
      if (t.orderedTarget && t.state === 'drive') goal = t.orderedTarget;
      else if (t.state === 'drive' && !t.rescue && !this.siege.active) {
        const a = Math.atan2(t.y - this.py, t.x - this.px) + (t.squadId % 3 - 1) * 0.35;
        goal = { x: this.px + Math.cos(a) * (230 + t.squadId % 4 * 46), y: this.py + Math.sin(a) * (230 + t.squadId % 4 * 46) };
        t.tx = goal.x; t.ty = goal.y;
      }
      m.path = this.routes.route(t, goal); m.node = 0; m.stage = t.state;
      m.revision = this.routes.revision; m.replan = 7 + Math.abs(t.squadId % 4);
    }
    const end = m.path[m.path.length - 1];
    if (!end) { t.speed = 0; m.replan = 0; return; }   // no path: ask again next frame, never freeze
    if (Math.hypot(t.x - end.x, t.y - end.y) < 45) {
      t.speed = Math.max(0, t.speed - 320 * dt);
      if (t.state === 'drive' && !t.rescue && t.speed < 12) {
        t.state = 'deploy'; t.deployT = 1.4;
        this.addText(t.x, t.y - 58, 'BRAKES SET / DISMOUNT', '#f5cf8a', 12);
      }
      return;
    }
    while (m.node < m.path.length - 1 && Math.hypot(t.x - m.path[m.node].x, t.y - m.path[m.node].y) < 55) m.node++;
    if (m.bypass && Math.hypot(t.x - m.bypass.x, t.y - m.bypass.y) < 40) { m.bypass = undefined; m.replan = 0; }
    const waypoint = m.bypass || m.path[m.node];
    const desired = Math.atan2(waypoint.y - t.y, waypoint.x - t.x);
    const turn = Math.atan2(Math.sin(desired - t.ang), Math.cos(desired - t.ang));
    t.ang += clamp(turn, -dt * 1.2, dt * 1.2);
    t.lean = lerp(t.lean, clamp(turn * 0.35, -0.22, 0.22), 1 - Math.exp(-4 * dt));
    const remaining = Math.hypot(end.x - t.x, end.y - t.y);
    const surface = this.groundFactor(t.x, t.y);
    let targetSpeed = Math.min(175 * surface, Math.sqrt(remaining * 140)) * (Math.abs(turn) > 1.15 ? 0 : Math.max(0.15, Math.cos(turn)));
    // Only brake for doors that can actually open. A locked yard gate is a wall: the
    // vehicle planner already routes around it, so waiting for it stalls the convoy.
    const doorAhead = this.gates.some(g => g.hp > 0 && !g.locked && g.open < 0.97 && segmentBox(t, { x: t.x + Math.cos(t.ang) * 145, y: t.y + Math.sin(t.ang) * 145 }, { x: g.x - (g.ang === 0 ? g.span / 2 : 15), y: g.y - (g.ang === 0 ? 15 : g.span / 2), w: g.ang === 0 ? g.span : 30, h: g.ang === 0 ? 30 : g.span }, 40) !== null);
    if (doorAhead) targetSpeed = 0;
    m.doorWait = doorAhead ? (m.doorWait || 0) + dt : 0;
    if ((m.doorWait || 0) > 3.5) { m.doorWait = 0; m.replan = 0; m.bypass = undefined; }
    let traffic = false;
    for (const other of this.trucks) {
      if (other === t || other.dead) continue;
      const dx = other.x - t.x, dy = other.y - t.y;
      const ahead = dx * Math.cos(t.ang) + dy * Math.sin(t.ang);
      const across = Math.abs(-dx * Math.sin(t.ang) + dy * Math.cos(t.ang));
      // Yield to rank and to anything actually rolling - but never to a vehicle that is
      // itself frozen, or one stalled truck can hold a whole column hostage.
      const rolling = other.speed > 24 || other.state === 'deploy';
      if (ahead > 0 && ahead < 180 && across < 67 && (rolling || (other.squadId < t.squadId && other.speed > 6))) {
        targetSpeed = 0; traffic = true;
      }
    }
    m.trafficTime = traffic ? (m.trafficTime || 0) + dt : 0;
    // Queued nose-to-tail for too long: creep. Trucks do not collide with each other, so a
    // slow roll keeps the column alive while the bypass below looks for room to swing out.
    if ((m.trafficTime || 0) > 3.5) targetSpeed = Math.max(targetSpeed, 46);
    // Long jams escalate: a wider swing clears a convoy queued nose-to-tail.
    const swing = (m.trafficTime || 0) > 7 ? 340 : 215;
    if ((m.trafficTime || 0) > 2.4 && !m.bypass && !doorAhead) {
      for (const side of [1, -1]) {
        const candidate = { x: t.x + Math.cos(t.ang) * 65 - Math.sin(t.ang) * side * swing, y: t.y + Math.sin(t.ang) * 65 + Math.cos(t.ang) * side * swing };
        if (!this.routes.line(t, candidate)) continue;
        if (this.trucks.some(o => o !== t && !o.dead && segmentCircle(t, candidate, o, 115))) continue;
        m.bypass = candidate; m.trafficTime = 0; break;
      }
    }
    t.speed += clamp(targetSpeed - t.speed, -dt * 290, dt * 95);
    const next = { x: t.x + Math.cos(t.ang) * t.speed * dt, y: t.y + Math.sin(t.ang) * t.speed * dt };
    let blocked = !this.routes.line(t, next) || this.inWater(next.x, next.y);
    if (!blocked) for (const off of [-48, 0, 48]) {
      const center = { x: next.x + Math.cos(t.ang) * off, y: next.y + Math.sin(t.ang) * off };
      const original = { ...center }; this.collide(center, 33);
      if (Math.hypot(original.x - center.x, original.y - center.y) > 0.5) { blocked = true; break; }
    }
    if (!blocked) { t.x = next.x; t.y = next.y; m.idle = 0; }
    else {
      t.speed = 0; m.idle += dt;
      if (m.idle > 1.5 && !doorAhead) {
        const back = { x: t.x - Math.cos(t.ang) * 42 * dt, y: t.y - Math.sin(t.ang) * 42 * dt };
        if (this.routes.line(t, back) && !this.trucks.some(o => o !== t && !o.dead && Math.hypot(o.x - back.x, o.y - back.y) < 115)) { t.x = back.x; t.y = back.y; }
        if (m.idle > 3) { m.replan = 0; m.idle = 0; m.bypass = undefined; }
      }
      if (m.idle > 2 && !m.bypass) {
        // Wedged against geometry: shunt sideways onto a verified clear patch, then re-approach.
        shunt: for (const side of [1, -1]) {
          for (const dist of [170, 280]) {
            const cand = { x: t.x - Math.sin(t.ang) * side * dist, y: t.y + Math.cos(t.ang) * side * dist };
            if (!this.routes.clear(cand) || !this.routes.line(t, cand)) continue;
            m.bypass = cand; m.idle = 0; break shunt;
          }
        }
      }
    }
    // Catch-all: no convoy vehicle may sit spinning. If it has made no progress toward its
    // objective for a few seconds, swing the nose and ask the planner for a fresh route.
    m.stall = (t.speed < 9 && Math.hypot(goal.x - t.x, goal.y - t.y) > 240) ? (m.stall || 0) + dt : 0;
    if ((m.stall || 0) > 4) { m.stall = 0; m.replan = 0; m.bypass = undefined; t.ang += (Math.random() < 0.5 ? -1 : 1) * 0.6; }
    if (t.speed > 25 && Math.random() < dt * 18) this.addParticle(t.x - Math.cos(t.ang) * 84, t.y - Math.sin(t.ang) * 84, rand(-15, 15), rand(-20, 10), 0.6, 4, '#83928a', false);
    if (!t.rescue && !this.piloting && !this.flyingPlane && t.speed > 40 && Math.hypot(t.x - this.px, t.y - this.py) < 72) {
      const impact = clamp(t.speed / 22, 5, 22);
      this.damagePlayer(impact, t.x, t.y);
      const a = Math.atan2(this.py - t.y, this.px - t.x);
      this.pvx += Math.cos(a) * t.speed * 0.7;
      this.pvy += Math.sin(a) * t.speed * 0.7;
    }
  }

  private destroyTruck(t: Truck) {
    if (t.dead) return;
    t.dead = true;
    const home = this.convoyMotion.get(t)?.home;
    const bay = t.parking || (home && this.vans.find(v => v.reserved && Math.hypot(v.x - home.x, v.y - home.y) < 100));
    if (bay) { bay.dead = true; bay.reserved = false; }
    for (const e of this.enemies) if (e.boardingTruck === t.squadId) { e.boardingTruck = undefined; e.alert = true; }
    sfx.explode();
    this.hitstop = Math.max(this.hitstop, 0.1);
    this.flash = 0.4; this.flashColor = '255,180,90';
    this.addLight(t.x, t.y, 420, '255,190,110', 0.6);
    this.shocks.push({ x: t.x, y: t.y, r: 10, max: 170, life: 0.45, t: 0.45, color: '255,180,90', width: 12 });
    for (let i = 0; i < 44; i++) {
      const a = rand(0, TAU), v = rand(70, 520);
      this.addParticle(t.x, t.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.8), rand(2, 7), i % 3 ? '#ffb85c' : '#5a6b6e', true);
    }
    this.explode(t.x, t.y, 170, 70, false);
    const remaining = t.comp.length - t.slot;
    const pts = t.rescue ? 2200 + t.carrying * 400 : 1500 + remaining * 200;
    this.score += pts;
    this.addText(t.x, t.y - 44, `${t.rescue ? 'RECOVERY' : 'CONVOY'} TRUCK DOWN +${pts}`, '#ffd166', 19);
    if (remaining > 0) this.addText(t.x, t.y - 24, `${remaining} REINFORCEMENTS WIPED`, '#ffb0b0', 13);
    if (t.rescue && t.carrying > 0) this.addText(t.x, t.y - 24, `${t.carrying} EVACUEES LOST`, '#ffb0b0', 13);
    const r = Math.random();
    if (r < 0.4) this.dropPickup(t.x, t.y, 'health');
    else if (r < 0.7) this.dropPickup(t.x, t.y, 'grenade');
    else this.dropPickup(t.x, t.y, 'shield');
    // A convoy is worth the ambush: whatever it never delivered spills out as heavy
    // ordnance. More riders still aboard means more crates scattered on the road.
    const haul = t.rescue ? ['health', 'health', 'aegis', 'shield', 'ammo']
      : ['rocket', 'hmg', 'shotgun', 'smg', 'grenade', 'shield', 'ammo', 'ammo'];
    const crates = Math.min(3, 1 + Math.floor(remaining / 3));
    for (let k = 0; k < crates; k++) {
      const a = rand(0, TAU), d = rand(28, 78);
      const spot = { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d };
      this.collide(spot, 13);                       // never bury the haul inside a wall
      const pick = haul[Math.floor(Math.random() * haul.length)];
      if (pick === 'rocket' && this.weapon === 'rocket') {
        this.ammo += 4;
        this.addText(spot.x, spot.y - 22, '+4 OG-7V WARHEADS', '#ffa06b', 13);
        this.dropPickup(spot.x, spot.y, 'grenade');
      } else if (pick === 'rocket' || pick === 'hmg' || pick === 'shotgun' || pick === 'smg') {
        this.dropPickup(spot.x, spot.y, 'weapon', pick);
      } else {
        this.dropPickup(spot.x, spot.y, pick as Pickup['kind']);
      }
    }
    if (crates > 1) this.addText(t.x, t.y - 66, 'CARGO SPILLED / HEAVY ORDNANCE', '#ffd166', 13);
  }

  /** Attack gunships: strafing runs, rocket pods, and medevac extraction. */
  private updateHelis(dt: number) {
    for (let i = this.helis.length - 1; i >= 0; i--) {
      const h = this.helis[i];
      // Attacking gunships fly in from wherever they were launched. They only
      // claim a parking bay on the way home, so a sortie never teleports an
      // aircraft onto a pad (and never hides the aircraft parked there).
      // A retired aircraft is leaving, not coming home: it must never claim a parking bay.
      if (h.retire && Math.hypot(h.x - this.px, h.y - this.py) > 3400) {
        this.helis.splice(i, 1);
        continue;
      }
      if (h.home === undefined && h.state === 'egress' && !h.retire) {
        const slot = this.parkedHelis.findIndex((p, index) => !p.taken && ![...this.hangarClaims.values()].includes(index));
        if (slot >= 0) {
          h.home = slot;
          this.hangarClaims.set(h, slot);
        }
      }
      h.sortieT = (h.sortieT || 0) + dt;
      if (this.updateAirfieldCycle(h, dt)) continue;
      h.rotor += dt * 34;
      h.t += dt;
      if (h.cool > 0) h.cool -= dt;
      if (h.rocketCd > 0) h.rocketCd -= dt;
      // banking into turns — feels like a real machine
      const bankTarget = h.state === 'orbit' ? 0.5 : h.state === 'strafe' ? 0.34 : 0.06;
      h.bank = lerp(h.bank, bankTarget, 1 - Math.pow(0.02, dt));

      const pdx = this.px - h.x, pdy = this.py - h.y;
      const pd = Math.hypot(pdx, pdy) || 1;
      if (!h.medevac && (h.sortieT > 45 || h.hp < h.maxHp * 0.3) && h.state !== 'egress') { h.state = 'egress'; h.t = 0; }

      if (!h.announced && pd < 1500) {
        h.announced = true;
        this.addText(h.x, h.y - 70, h.medevac ? '⚕ MEDEVAC INBOUND' : '⚠ GUNSHIP INBOUND', h.medevac ? '#8dffb0' : '#ffb0b0', 16);
        sfx.rotor();
      }

      if (h.state === 'ingress') {
        const dx = h.tx - h.x, dy = h.ty - h.y;
        const d = Math.hypot(dx, dy) || 1;
        h.ang = lerpAngle(h.ang, Math.atan2(dy, dx), 1 - Math.pow(0.004, dt));
        h.x += (dx / d) * 780 * dt;
        h.y += (dy / d) * 780 * dt;
        if (d < 120) { h.state = h.medevac ? 'orbit' : 'strafe'; h.t = 0; }
      } else if (h.state === 'strafe') {
        // gun run: fly straight past the player, cannons blazing
        h.x += Math.cos(h.ang) * 560 * dt;
        h.y += Math.sin(h.ang) * 560 * dt;
        if (h.cool <= 0 && pd < 780) {
          h.cool = 0.14;
          const lead = 0.32;
          const aimA = Math.atan2(this.py + this.pvy * lead - h.y, this.px + this.pvx * lead - h.x) + rand(-0.07, 0.07);
          const sp = 780;
          this.bullets.push({
            x: h.x, y: h.y, px: h.x, py: h.y,
            vx: Math.cos(aimA) * sp, vy: Math.sin(aimA) * sp,
            dmg: 9, life: 1.8, friendly: false, color: '#ffb060', r: 4,
          });
          this.addLight(h.x, h.y, 130, '255,180,90', 0.08);
          if (pd < 1000) sfx.shoot('smg');
        }
        if (h.rocketCd <= 0 && pd < 640) {
          h.rocketCd = rand(5, 8);
          const ra = Math.atan2(this.py + this.pvy * 0.5 - h.y, this.px + this.pvx * 0.5 - h.x);
          for (let k = -1; k <= 1; k++) {
            this.bullets.push({
              x: h.x, y: h.y, px: h.x, py: h.y,
              vx: Math.cos(ra + k * 0.11) * 620, vy: Math.sin(ra + k * 0.11) * 620,
              dmg: 22, life: 2.2, friendly: false, rocket: true, color: '#ff9d5c', r: 6,
            });
          }
          this.addText(h.x, h.y - 50, 'ROCKETS!', '#ffb060', 14);
          sfx.shoot('rocket');
        }
        if (h.t > 3.2) {
          h.state = 'orbit'; h.t = 0;
          h.orbitA = Math.atan2(h.y - this.py, h.x - this.px);
        }
      } else if (h.state === 'orbit') {
        // circle at standoff, picking off / waiting for medevac
        h.orbitA += dt * 0.55;
        const R = h.medevac ? 130 : 430;
        const ox = this.px + Math.cos(h.orbitA) * R;
        const oy = this.py + Math.sin(h.orbitA) * R;
        if (h.medevac) {
          // fly to the nearest wounded and extract them
          let best: Wounded | null = null, bd = Infinity;
          for (const wd of this.wounded) {
            if (wd.beingCarried) continue;
            const d = Math.hypot(wd.x - h.x, wd.y - h.y);
            if (d < bd) { bd = d; best = wd; }
          }
          if (best) {
            const dx = best.x - h.x, dy = best.y - h.y;
            const d = Math.hypot(dx, dy) || 1;
            h.ang = lerpAngle(h.ang, Math.atan2(dy, dx), 1 - Math.pow(0.006, dt));
            h.x += (dx / d) * 520 * dt; h.y += (dy / d) * 520 * dt;
            if (d < 60) {
              // winch them up
              this.wounded.splice(this.wounded.indexOf(best), 1);
              h.carrying++;
              this.addText(h.x, h.y - 46, `EXTRACTED (${h.carrying})`, '#8dffb0', 15);
              this.score -= 150; // you lose the kill bounty
              for (let k = 0; k < 14; k++)
                this.addParticle(best.x, best.y, rand(-40, 40), rand(-120, -40), 0.5, 3, '#8dffb0', true);
            }
          } else { h.state = 'egress'; }
          if (h.t > 22) h.state = 'egress';
        } else {
          const dx = ox - h.x, dy = oy - h.y;
          const d = Math.hypot(dx, dy) || 1;
          h.ang = lerpAngle(h.ang, Math.atan2(pdy, pdx), 1 - Math.pow(0.01, dt));
          h.x += (dx / d) * Math.min(420, d * 3) * dt;
          h.y += (dy / d) * Math.min(420, d * 3) * dt;
          if (h.cool <= 0 && pd < 620 && this.hasLine(h.x, h.y, this.px, this.py)) {
            h.cool = 0.22;
            const aimA = Math.atan2(this.py + this.pvy * 0.3 - h.y, this.px + this.pvx * 0.3 - h.x) + rand(-0.09, 0.09);
            this.bullets.push({
              x: h.x, y: h.y, px: h.x, py: h.y,
              vx: Math.cos(aimA) * 760, vy: Math.sin(aimA) * 760,
              dmg: 8, life: 1.8, friendly: false, color: '#ffb060', r: 4,
            });
          }
          // re-attack
          if (h.t > 6) {
            h.state = 'ingress'; h.t = 0;
            const a = rand(0, TAU);
            h.tx = this.px + Math.cos(a) * 500;
            h.ty = this.py + Math.sin(a) * 500;
            h.ang = Math.atan2(this.py - h.ty, this.px - h.tx);
          }
        }
      } else { // egress — always to a real bay: its hangar, or the pad it was parked on
        const bay = this.heliBay(h);
        const target = bay.approach;
        const dx = target.x - h.x, dy = target.y - h.y, d = Math.hypot(dx, dy) || 1;
        h.ang = lerpAngle(h.ang, Math.atan2(dy, dx), 1 - Math.exp(-3 * dt));
        const step = Math.min(d, dt * 540); h.x += dx / d * step; h.y += dy / d * step;
        if (d < 9) {
          if (bay.hasBay) { h.state = 'landing'; h.t = 0; }
          else { this.releaseBay(h); this.helis.splice(i, 1); }
        }
      }

      // rotor downwash + engine trail
      if (Math.random() < 0.5)
        this.addParticle(h.x - Math.cos(h.ang) * 60, h.y - Math.sin(h.ang) * 60,
          rand(-24, 24), rand(16, 48), rand(0.3, 0.55), rand(2, 4), '#8ba0a8', true);
    }
  }

  private updateAirfieldCycle(h: Heli, dt: number): boolean {
    if (!['startup', 'taxi-out', 'takeoff', 'landing', 'taxi-in', 'service'].includes(h.state)) return false;
    const index = h.home ?? -1, hangar = this.hangars[index], parking = this.parkedHelis[index];
    // Pad-based aircraft have no roof to wait for; hangar aircraft taxi out under a split roof.
    if (!parking) { h.state = 'ingress'; h.altitude = 65; return false; }
    h.t += dt;
    const rpm = h.state === 'startup' ? Math.min(32, h.t * 10) : h.state === 'service' ? Math.max(0, 28 - h.t * 7) : 32;
    h.rotor += rpm * dt;
    if (h.state === 'startup' && h.t > (hangar ? 3.6 : 1.8) && (!hangar || hangar.open > 0.9)) {
      h.state = hangar ? 'taxi-out' : 'takeoff'; h.t = 0;
    }
    else if (h.state === 'takeoff') {
      h.altitude = Math.min(65, (h.altitude || 0) + dt * 17);
      if (h.altitude >= 65) { h.state = 'ingress'; h.t = 0; h.sortieT = 0; h.tx = this.px; h.ty = this.py - 430; }
    } else if (h.state === 'landing') {
      h.altitude = Math.max(0, (h.altitude || 0) - dt * 16);
      if (hangar) {
        if (h.altitude <= 0) { h.state = 'taxi-in'; h.t = 0; }
      } else {
        // Pad landing: settle onto the marked spot, then straight into servicing.
        const dx = parking.x - h.x, dy = parking.y - h.y, d = Math.hypot(dx, dy) || 1;
        const step = Math.min(d, dt * 90); h.x += dx / d * step; h.y += dy / d * step;
        if (h.altitude <= 0 && d < 10) { h.state = 'service'; h.t = 0; }
      }
    } else if (h.state === 'taxi-in' || h.state === 'taxi-out') {
      const target = h.state === 'taxi-in' ? parking : { x: hangar!.doorX, y: hangar!.doorY + 110 };
      const dx = target.x - h.x, dy = target.y - h.y, d = Math.hypot(dx, dy) || 1;
      h.ang = lerpAngle(h.ang, Math.atan2(dy, dx), 1 - Math.exp(-2 * dt));
      const step = Math.min(d, dt * 55);
      const next = { x: h.x + dx / d * step, y: h.y + dy / d * step };
      const safe = { ...next }; this.collide(safe, 34);
      if (Math.hypot(next.x - safe.x, next.y - safe.y) < 0.5) { h.x = next.x; h.y = next.y; }
      if (d < 4) { h.state = h.state === 'taxi-in' ? 'service' : 'takeoff'; h.t = 0; }
    } else if (h.state === 'service' && h.t > 9) {
      // Serviced and parked again: the bay shows its aircraft, ready for the next sortie.
      this.releaseBay(h);
      const idx = this.helis.indexOf(h);
      if (idx >= 0) this.helis.splice(idx, 1);
    }
    return true;
  }

  /** Where an aircraft belongs: its hangar door if it has one, otherwise the pad it launched from. */
  private heliBay(h: Heli): { approach: Point; hasBay: boolean } {
    const index = h.home ?? -1;
    const hangar = this.hangars[index], parking = this.parkedHelis[index];
    if (hangar) return { approach: { x: hangar.doorX, y: hangar.doorY + 110 }, hasBay: true };
    if (parking) return { approach: { x: parking.x, y: parking.y }, hasBay: true };
    const pad = this.helipads.length ? this.helipads[index % this.helipads.length] : null;
    if (pad) return { approach: { x: pad.x, y: pad.y }, hasBay: true };
    return { approach: { x: AIRFIELD.x, y: AIRFIELD.y }, hasBay: false };
  }

  /** Free a bay so its parked aircraft becomes visible (and claimable) again. */
  private releaseBay(h: Heli) {
    this.hangarClaims.delete(h);
    const index = h.home ?? -1;
    if (index >= 0 && this.parkedHelis[index]) this.parkedHelis[index].taken = false;
  }

  private killHeli(h: Heli) {
    if (h.home !== undefined && h.home >= 0 && this.parkedHelis[h.home]) this.parkedHelis[h.home].taken = true;
    this.hangarClaims.delete(h);
    const idx = this.helis.indexOf(h);
    if (idx >= 0) this.helis.splice(idx, 1);
    sfx.explode();
    this.hitstop = Math.max(this.hitstop, 0.14);
    this.timeScale = 0.4;
    this.flash = 0.55; this.flashColor = '255,170,90';
    this.addLight(h.x, h.y, 620, '255,190,110', 0.8);
    this.shocks.push({ x: h.x, y: h.y, r: 12, max: 260, life: 0.55, t: 0.55, color: '255,180,90', width: 14 });
    for (let i = 0; i < 80; i++) {
      const a = rand(0, TAU), v = rand(80, 700);
      this.addParticle(h.x, h.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 1.1), rand(2, 8), i % 3 ? '#ffb85c' : '#4a5a60', true);
    }
    this.explode(h.x, h.y, 230, 80, false);
    const pts = h.medevac ? 2000 : 4000;
    this.score += pts;
    this.addText(h.x, h.y - 56, `GUNSHIP DOWN +${pts}`, '#ffd166', 24);
    if (h.carrying > 0) this.addText(h.x, h.y - 30, `${h.carrying} EVACUEES LOST`, '#ffb0b0', 14);
    this.dropPickup(h.x, h.y, 'shield');
    this.dropPickup(h.x + 40, h.y, 'health');
  }

  /** Enemy medevac: badly wounded soldiers go down and get extracted. */
  private updateWounded(dt: number) {
    for (let i = this.wounded.length - 1; i >= 0; i--) {
      const wd = this.wounded[i];
      if (wd.beingCarried) {
        const truck = this.trucks.find((t) => t.rescue && t.squadId === wd.carrier);
        if (!truck || truck.dead) { wd.beingCarried = false; wd.carrier = 0; }
        else {
          // crawl into the tailgate: visible boarding instead of a disappearing casualty
          const tx = truck.x - Math.cos(truck.ang) * 82;
          const ty = truck.y - Math.sin(truck.ang) * 82;
          wd.x = lerp(wd.x, tx, 1 - Math.pow(0.004, dt));
          wd.y = lerp(wd.y, ty, 1 - Math.pow(0.004, dt));
          if (Math.hypot(wd.x - tx, wd.y - ty) < 9) {
            this.wounded.splice(i, 1);
            truck.carrying++;
            this.addText(truck.x, truck.y - 46, 'CASUALTY ABOARD', '#8dffb0', 12);
          }
          continue;
        }
      }
      wd.t -= dt;
      if (Math.random() < dt * 1.2)
        this.addParticle(wd.x + rand(-8, 8), wd.y + rand(-8, 8), rand(-10, 10), rand(-24, -8), 0.5, 2, '#ff5d6c', true);
      // bleed out — you can finish them for the score
      if (wd.t <= 0) {
        this.wounded.splice(i, 1);
        this.score += 60;
        this.addText(wd.x, wd.y - 20, '+60 KIA', '#d8e6ff', 14);
        this.decals.push({ x: wd.x, y: wd.y, r: 22, a: 0.45, color: '#5c1026' });
        continue;
      }
      // player can execute them at close range
      if (Math.hypot(wd.x - this.px, wd.y - this.py) < 30) {
        this.wounded.splice(i, 1);
        this.score += 120;
        this.addText(wd.x, wd.y - 24, '+120 CONFIRMED', '#ffd166', 15);
        this.sparks(wd.x, wd.y, '#ff5d6c', 10);
        continue;
      }
    }
    // Small casualty groups get an armored recovery truck; bigger groups trigger air medevac.
    if (this.wounded.length >= 1 && !this.trucks.some((t) => t.rescue) && this.commandOnline) {
      const target = this.wounded.find((w) => !w.beingCarried);
      if (target) {
        const id = -this.nextSquadId++;
        this.trucks.push({
          x: HQ.cx, y: HQ.cy + HQ.h / 2 - 45,
          tx: target.x, ty: target.y, ang: Math.atan2(target.y - HQ.cy, target.x - HQ.cx),
          state: 'drive', squadId: id, comp: [], slot: 0, deployT: 0,
          hp: 360, maxHp: 360, dead: false, announced: false,
          speed: 0, lean: 0, rescue: true, carrying: 0, rescueWait: 0,
        });
        this.aiNote = 'ARMORED RECOVERY CONVOY DISPATCHED';
      }
    }
    if (this.wounded.length >= 3 && !this.helis.some((h) => h.medevac) && this.commandOnline) {
      this.helis.push({
        x: HQ.cx, y: HQ.cy + 200,
        tx: this.wounded[0].x, ty: this.wounded[0].y,
        ang: 0, rotor: 0, state: 'ingress',
        hp: 300, maxHp: 300, cool: 0, rocketCd: 99, t: 0,
        orbitA: 0, medevac: true, carrying: 0, announced: false, bank: 0,
      });
      this.aiNote = 'MEDEVAC DISPATCHED — CASUALTIES';
    }
  }

  /** S.H.I.E.L.D. logistics — airdrops a supply crate to keep you alive. */
  private updateSupply(dt: number) {
    this.supplyCd -= dt;
    if (this.supplyCd <= 0 && this.status === 'playing' && this.supply.length < 3) {
      this.supplyCd = rand(30, 42);
      // drop near (but not on) the player
      const a = rand(0, TAU);
      const d = rand(340, 520);
      const x = clamp(this.px + Math.cos(a) * d, 140, ARENA_W - 140);
      const y = clamp(this.py + Math.sin(a) * d, 140, ARENA_H - 140);
      this.supply.push({ x, y, t: 3.2 }); // 3.2s descent, then lands
      this.setBanner('S.H.I.E.L.D. SUPPLY DROP', 'CRATE INBOUND — RETRIEVE IT');
      sfx.rotor();
    }
    for (let i = this.supply.length - 1; i >= 0; i--) {
      const s = this.supply[i];
      s.t -= dt;
      if (s.t <= 0) {
        // crate lands with a soft thump and opens
        this.supply.splice(i, 1);
        this.shocks.push({ x: s.x, y: s.y, r: 6, max: 90, life: 0.4, t: 0.4, color: '140,255,200', width: 6 });
        this.addLight(s.x, s.y, 300, '140,255,200', 0.5);
        for (let k = 0; k < 20; k++) {
          const a = rand(0, TAU);
          this.addParticle(s.x, s.y, Math.cos(a) * rand(40, 190), Math.sin(a) * rand(40, 190), rand(0.3, 0.6), rand(2, 5), '#8dffb0', true);
        }
        // payload: 2-3 pickups
        const n = 2 + (Math.random() < 0.5 ? 1 : 0);
        const pool: (Pickup['kind'] | [Pickup['kind'], string])[] = [
          'health', 'shield', 'grenade', 'ammo', ['weapon', 'shotgun'], ['weapon', 'dmr'], ['weapon', 'smg'],
        ];
        for (let k = 0; k < n; k++) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          const ox = (k - (n - 1) / 2) * 40;
          if (typeof pick === 'string') this.dropPickup(s.x + ox, s.y, pick);
          else this.dropPickup(s.x + ox, s.y, pick[0], pick[1]);
        }
        sfx.pickup();
      }
    }
  }

  private updateBarriers(dt: number) {
    for (let i = this.barriers.length - 1; i >= 0; i--) {
      const b = this.barriers[i];
      b.life -= dt;
      if (b.life <= 0 || b.hp <= 0) {
        if (b.hp <= 0) {
          sfx.explode();
          this.addLight(b.x, b.y, 260, '120,200,255', 0.5);
          for (let k = 0; k < 26; k++) {
            const a = rand(0, TAU);
            this.addParticle(b.x, b.y, Math.cos(a) * rand(60, 300), Math.sin(a) * rand(60, 300), rand(0.3, 0.6), rand(2, 5), '#9fd8ff', true);
          }
          this.score += 300;
          this.addText(b.x, b.y - 30, 'BARRIER DOWN +300', '#9fd8ff', 16);
        }
        this.barriers.splice(i, 1);
      }
    }
  }

  private launchAirlift(kind: AirTransport['kind'], comp: string[], squadId: number, target: Point) {
    const home = kind === 'atlas' ? { x: AIRFIELD.x - 850, y: AIRFIELD.y - 60 } : { x: AIRFIELD.x - 800 + squadId % 3 * 800, y: AIRFIELD.y + 690 };
    const landing = this.infantryRoutes.nearest(target);
    this.airTransports.push({ ...home, home, target: landing, kind, state: 'launch', ang: kind === 'atlas' ? 0 : -Math.PI / 2,
      rotor: 0, bank: 0, altitude: 0, hp: kind === 'atlas' ? 520 : 360, maxHp: kind === 'atlas' ? 520 : 360,
      comp: [...comp], squadId, slot: 0, clock: 0, deployCd: 0.8, announced: false });
  }

  private updateAirlifts(dt: number) {
    for (let i = this.airTransports.length - 1; i >= 0; i--) {
      const a = this.airTransports[i];
      a.clock += dt; a.rotor += dt * (a.state === 'launch' ? Math.min(25, a.clock * 7) : 25);
      const near = Math.hypot(a.x - this.px, a.y - this.py) < 1250;
      if (!a.announced && near) { a.announced = true; this.addText(a.x, a.y - 105, a.kind === 'atlas' ? 'ATLAS / AIRBORNE INFANTRY' : 'MANTIS / FAST-ROPE TEAM', '#e7c297', 13); sfx.rotor(); }
      if (a.state === 'launch') {
        a.altitude = Math.min(a.kind === 'atlas' ? 185 : 135, a.clock * (a.kind === 'atlas' ? 35 : 30));
        if (a.kind === 'atlas') a.x += Math.min(360, a.clock * 75) * dt;
        if (a.clock >= 5.5) { a.state = 'approach'; a.clock = 0; }
      } else if (a.state === 'approach' || a.state === 'return') {
        const target = a.state === 'return' ? a.home : a.target;
        const dx = target.x - a.x, dy = target.y - a.y, d = Math.hypot(dx, dy) || 1;
        const want = Math.atan2(dy, dx);
        const turn = Math.atan2(Math.sin(want - a.ang), Math.cos(want - a.ang));
        a.ang += clamp(turn, -1.6 * dt, 1.6 * dt); a.bank = lerp(a.bank, clamp(turn * 0.4, -0.6, 0.6), 1 - Math.exp(-3 * dt));
        const step = Math.min(d, (a.kind === 'atlas' ? 620 : 470) * dt);
        a.x += dx / d * step; a.y += dy / d * step;
        if (d < 12) { a.state = a.state === 'return' ? 'land' : 'drop'; a.clock = 0; }
      } else if (a.state === 'drop') {
        if (a.kind === 'atlas') { a.x += Math.cos(a.ang) * 130 * dt; a.y += Math.sin(a.ang) * 130 * dt; }
        a.deployCd -= dt;
        if (a.slot < a.comp.length && a.deployCd <= 0) {
          const slot = a.slot++, side = slot % 2 ? 1 : -1;
          const landing = this.infantryRoutes.nearest({ x: a.x - Math.sin(a.ang) * side * 38, y: a.y + Math.cos(a.ang) * side * 38 });
          this.airTroops.push({ ...landing, type: a.comp[slot], slot, squadId: a.squadId, progress: 0,
            duration: a.kind === 'atlas' ? 3.8 : 2.65, kind: a.kind === 'atlas' ? 'parachute' : 'rope',
            topX: a.x - Math.sin(a.ang) * side * 38, topY: a.y + Math.cos(a.ang) * side * 38,
            altitude: a.kind === 'atlas' ? 160 : 85, hp: 42 });
          a.deployCd = a.kind === 'atlas' ? 0.55 : 0.8;
        }
        if (a.slot >= a.comp.length && !this.airTroops.some(p => p.squadId === a.squadId) && a.clock > 4) {
          a.state = 'return'; a.clock = 0;
        }
        if (a.kind === 'mantis' && near && Math.random() < dt * 20) this.addParticle(a.x + rand(-80, 80), a.y + rand(-55, 55), rand(-80, 80), rand(-40, 40), 0.5, 4, '#849388', false);
      } else {
        a.altitude = Math.max(0, a.altitude - dt * 34);
        if (a.altitude <= 0) this.airTransports.splice(i, 1);
      }
    }
    for (let i = this.airTroops.length - 1; i >= 0; i--) {
      const p = this.airTroops[i]; p.progress += dt;
      if (p.progress >= p.duration) {
        this.airTroops.splice(i, 1);
        this.spawnEnemy(p.type, p.squadId, p.slot, p.x, p.y);
        this.sparks(p.x, p.y, '#b0b29b', 5);
      }
    }
  }

  private destroyAirlift(a: AirTransport) {
    const index = this.airTransports.indexOf(a);
    if (index < 0) return;
    this.airTransports.splice(index, 1);
    const points = 2200 + Math.max(0, a.comp.length - a.slot) * 120;
    this.score += points;
    this.explode(a.x, a.y, 210, 90, true);
    this.addText(a.x, a.y - 80, `TRANSPORT DOWN +${points}`, '#eec596', 19);
    for (const p of this.airTroops) if (p.squadId === a.squadId) p.kind = 'parachute';
  }

  private updateWaves(dt: number) {
    this.updateVTOLs(dt);
    this.updateAirlifts(dt);
    this.updateTrucks(dt);
    this.updateTanks(dt);
    this.updateHelis(dt);
    this.updateWounded(dt);
    this.updateBarriers(dt);
    if (!this.waveActive) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startWave();
      return;
    }
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      const transport = this.vtols.find(v => v.squadId === s.squadId);
      if (transport && transport.state !== 'hover') continue;
      s.t -= dt;
      if (s.t <= 0) { this.spawnQueue.splice(i, 1); this.spawnEnemy(s.type, s.squadId, s.slot, s.x, s.y); }
    }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      this.marks[i].t -= dt;
      if (this.marks[i].t <= 0) this.marks.splice(i, 1);
    }
    const fieldEnemies = this.enemies.filter((e) => !e.garrison).length;
    if (this.status === 'playing' && !this.siege.active && !this.baseOverride.active && this.responseOrders.length === 0
        && !this.airTransports.some(a => !['return', 'land'].includes(a.state)) && this.airTroops.length === 0
        && this.spawnQueue.length === 0 && fieldEnemies === 0 && !this.trucks.some(t => !t.dead && !t.disabled && t.state !== 'leave')
        && !this.vtols.some(v => v.state !== 'out') && !this.helis.some(h => !['egress', 'landing', 'taxi-in', 'service'].includes(h.state)) && this.wounded.length === 0) {
      this.waveActive = false;
      this.intermission = 0.9;
      const bonus = 600 * this.wave;
      this.score += bonus;
      this.grenades = Math.min(this.mods.grenadeCap, this.grenades + 2);
      this.hp = Math.min(this.maxHp, this.hp + 14);
      this.setBanner('WAVE REPELLED', `+${bonus} · SELECT LOADOUT`);
      this.addText(this.px, this.py - 46, `+${bonus}`, '#9dffb0', 26);
      sfx.wave();
      this.offerUpgrade();
    }
  }

  /** Composition per formation — units are purpose-built for their tactic. */
  private squadComp(t: Tactic, w: number): string[] {
    const c: string[] = [];
    const veteran = w >= 3;
    switch (t) {
      case 'phalanx':
        c.push('shieldman', 'shieldman', 'shieldman', 'grunt', 'gunner');
        if (veteran) c.push('shieldman', 'medic');
        if (w >= 2) c[1] = 'warden';
        break;
      case 'turtle':
        c.push('shieldman', 'shieldman', 'shieldman', 'heavy', 'gunner');
        if (veteran) c.push('shieldman', 'sniper');
        break;
      case 'blitz':
        c.push('raider', 'rusher', 'rusher', 'raider', 'grunt');
        if (veteran) c.push('rusher', 'raider');
        break;
      case 'bombers':
        c.push('shieldman', 'grunt', 'bomber', 'bomber');
        if (veteran) c.push('bomber', 'sapper');
        break;
      case 'column':
        c.push('grunt', 'grunt', 'gunner', 'rusher');
        if (veteran) c.push('medic');
        break;
      case 'pincer':
        c.push('rusher', 'pathfinder', 'gunner', 'gunner');
        if (veteran) c.push('sapper');
        break;
      case 'encircle':
        c.push('grunt', 'grunt', 'grunt', 'rusher', 'gunner', 'shieldman');
        if (veteran) c.push('heavy');
        break;
      case 'ambush':
        c.push('raider', 'pathfinder', 'grunt', 'sniper');
        if (veteran) c.push('sapper');
        break;
    }
    // Each Hydra territory fields its own experimental regiment.
    if (this.sector === 2) {
      c.push(w % 2 ? 'warhound' : 'bomber');
    } else if (this.sector === 3) {
      c.push(w % 3 ? 'drone' : 'shieldman');
      if (w >= 4 && w % 2 === 0) c.push('sniper');
    } else if (this.sector === 4) {
      c.push(w % 2 ? 'specter' : 'sapper');
      if (w % 3 === 0) c.push('medic');
    } else if (this.sector === 5) {
      c.push(w % 2 ? 'drone' : 'specter');
      if (w % 2 === 0) c.push('juggernaut');
    } else if (this.sector >= 6) {
      // IRON RESERVE: disciplined infantry, sappers, and a major every other wave.
      c.push(w % 2 ? 'armytrooper' : 'armyguard');
      if (w % 3 === 0) c.push('armyengineer');
      if (w % 3 === 1) c.push('armymedic');
      if (w % 2 === 1) c.push('armymajor');
    }
    if (w >= 2 && !c.includes('commander')) c.push('commander');
    if (w >= 4 && w % 2 === 0 && !c.includes('medic')) c.push('medic');
    return c;
  }

  private startWave() {
    this.wave++;
    const w = this.wave;
    this.waveActive = true;
    const isBoss = w % 5 === 0;

    /* ---- ORGANIZED BATTLE DOCTRINE ----
       Enemy command runs a structured operation every wave, not a random dump:
         RECON  → light screen probes for your position
         BOMBARD→ artillery/bombers soften you up
         CONVOY → armored column rolls in and unloads en masse
         ASSAULT→ combined arms with air support
         SIEGE  → everything at once, barriers deployed
    */
    const cycle: typeof this.phase[] = ['recon', 'convoy', 'bombard', 'assault', 'siege'];
    this.phase = isBoss ? 'siege' : cycle[(w - 1) % cycle.length];
    this.phaseName = this.phase.toUpperCase();
    this.phaseT = 0;
    this.tellStory(PHASE_STORY[this.phase], 12);

    // Trucks are now core doctrine — nearly every wave rolls armor.
    const truckCount =
      this.phase === 'convoy' ? clamp(3 + Math.floor(w / 2), 3, 7)
      : this.phase === 'siege' ? clamp(2 + Math.floor(w / 3), 2, 5)
      : this.phase === 'assault' ? 2
      : this.phase === 'bombard' ? 1
      : 2;
    const heliCount =
      this.phase === 'assault' ? clamp(1 + Math.floor(w / 4), 1, 3)
      : this.phase === 'siege' ? clamp(2 + Math.floor(w / 4), 2, 4)
      : this.phase === 'bombard' ? 1 : 0;

    const squadCount = clamp(3 + Math.floor(w / 2) + Math.floor((this.sector - 1) / 2), 4, 8);
    const plan: { tactic: Tactic; comp: string[] }[] = [];
    if (isBoss) plan.push({ tactic: 'turtle', comp: ['boss', 'shieldman', 'shieldman', 'heavy'] });

    // The general's chosen doctrine leads; supporting squads take complementary roles.
    const support = PHASE_TACTICS[this.phase] as Tactic[];
    for (let i = plan.length; i < squadCount; i++) {
      const t: Tactic = i === 0 && w > 1 ? this.planTactic : support[i % support.length];
      plan.push({ tactic: t, comp: this.squadComp(t, w) });
    }
    if (plan.length) this.planTactic = plan[0].tactic;

    let total = 0;
    const towardHQ = Math.atan2(HQ.cy - this.py, HQ.cx - this.px);
    // Organized deployment: convoys form a real column with staggered arrival lanes.
    let trucksLeft = truckCount;
    plan.forEach((p, idx) => {
      const id = this.nextSquadId++;

      // Structured approach vectors instead of pure randomness: squads fan out
      // across an arc facing the player from the fortress side, evenly spaced.
      const spread = 1.55;
      const frac = plan.length > 1 ? idx / (plan.length - 1) - 0.5 : 0;
      const a = towardHQ + frac * spread * 2;
      const dd = 730 + idx * 80;
      const dx = clamp(this.px + Math.cos(a) * dd, 160, ARENA_W - 160);
      const dy = clamp(this.py + Math.sin(a) * dd, 160, ARENA_H - 160);

      this.squads.push({
        id, tactic: p.tactic, state: 'deploy', doctrine: 'hunter',
        size: p.comp.length, stateT: 0, barkCd: rand(1, 3),
        angle: rand(0, TAU), radius: rand(230, 290),
        volleyT: rand(1.6, 3), volleyWindow: 0, grenadeT: rand(3, 7),
        cx: dx, cy: dy, fx: this.px, fy: this.py, facing: 0,
        cohesion: 1, morale: 1, anchorX: dx, anchorY: dy,
      });

      if (trucksLeft > 0) {
        trucksLeft--;
        this.dispatchTruck(p.comp, id, { x: this.px, y: this.py }, undefined, idx * 1.8);
        total += p.comp.length;
      } else {
        this.launchAirlift(idx % 2 === 0 ? 'atlas' : 'mantis', p.comp, id, { x: dx, y: dy });
        total += p.comp.length;
      }
    });

    // -------- CONVOY ARMOUR: tanks roll with the column --------
    const tankCount =
      this.phase === 'convoy' ? 2
      : this.phase === 'siege' ? 2
      : this.phase === 'assault' || this.phase === 'bombard' ? 1
      : 0;
    // A column can only field so much armour at once; the rest stays at the depot.
    for (let i = 0; i < tankCount && this.tanks.filter((t) => !t.dead && !t.captured).length < 3; i++) {
      this.dispatchTank({ x: this.px + rand(-140, 140), y: this.py + rand(-140, 140) });
    }
    if (tankCount > 0) this.tellStory({ id: `tanks-${this.wave}`, channel: 'LOGISTICS INTERCEPT / CONVOY ESCORT', title: 'Armour is moving with the column.', text: 'Every convoy now runs with a tank escort. Small arms do nothing to that hull: break the trucks with grenades, then either avoid the tank or take it for yourself — stand beside it and press F.' }, 11);

    // -------- ATTACK GUNSHIPS --------
    for (let i = 0; i < heliCount; i++) {
      const a = towardHQ + rand(-1.2, 1.2);
      this.helis.push({
        x: HQ.cx + rand(-200, 200), y: HQ.cy + rand(-200, 200),
        tx: this.px + Math.cos(a) * 420, ty: this.py + Math.sin(a) * 420,
        ang: a + Math.PI, rotor: rand(0, TAU), state: 'ingress',
        hp: 420 + w * 26, maxHp: 420 + w * 26,
        cool: rand(1, 2), rocketCd: rand(3, 6), t: 0,
        orbitA: rand(0, TAU), medevac: false, carrying: 0, announced: false, bank: 0,
      });
    }

    // -------- SIEGE: command deploys energy barriers to wall you in --------
    if (this.phase === 'siege' || (this.phase === 'assault' && w >= 6)) {
      const n = this.phase === 'siege' ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const ba = towardHQ + Math.PI + (i / n) * TAU * 0.6 - 0.6;
        const bd2 = rand(300, 420);
        this.barriers.push({
          x: clamp(this.px + Math.cos(ba) * bd2, 120, ARENA_W - 120),
          y: clamp(this.py + Math.sin(ba) * bd2, 120, ARENA_H - 120),
          ang: ba + Math.PI / 2,
          hp: 220, maxHp: 220, w: 150, life: 26, friendly: false,
        });
      }
    }

    sfx.siren();
    if (this.shieldMax > 0) this.shieldHp = this.shieldMax;

    const phaseLabel: Record<typeof this.phase, string> = {
      recon: 'RECON PROBE', bombard: 'BOMBARDMENT', convoy: 'ARMORED COLUMN',
      assault: 'COMBINED ASSAULT', siege: 'FULL SIEGE',
    };
    this.aiTactic = `${phaseLabel[this.phase]} · ${TACTIC_LABEL[this.planTactic]}`;
    const bits: string[] = [];
    if (truckCount) bits.push(`${truckCount} TRUCKS`);
    if (heliCount) bits.push(`${heliCount} GUNSHIPS`);
    bits.push(`${plan.length} FIRETEAMS`);
    this.setBanner(
      isBoss ? `⚠ WAVE ${w} — WARLORD SIEGE` : `WAVE ${w} — ${phaseLabel[this.phase]}`,
      bits.join(' · '),
    );
    sfx.wave();
  }

  private setBanner(a: string, b: string) { this.banner = a; this.bannerSub = b; this.bannerT = 2.4; }

  /** `NE`, `WSW`: which way a point lies, so a HUD hint can be followed. */
  private compassTo(x: number, y: number): string {
    const a = Math.atan2(y - this.py, x - this.px);
    const dirs = ['E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE'];
    return dirs[((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16];
  }

  private makeEnemy(type: string, x: number, y: number, squadId: number, slot: number): Enemy {
    // Defensive fallback: an unknown roster name must never take the whole simulation down.
    const known = ENEMIES[type] ? type : 'grunt';
    const def = ENEMIES[known];
    const scale = def.civilian ? 1 : 1 + Math.max(0, this.wave - 1) * 0.14 + (this.sector - 1) * 0.22;
    let hp = def.hp * (def.boss ? 1 + (this.wave / 5 - 1) * 0.75 : scale);
    let elite = false;
    if (!def.boss && !def.civilian && this.wave >= 2 && Math.random() < Math.min(0.2, 0.06 + this.wave * 0.014)) {
      elite = true; hp *= 2.1;
    }
    return {
      type: known, def, x, y, vx: 0, vy: 0, hp, maxHp: hp, flash: 0, cool: rand(0.4, 1.2),
      ang: 0, wobble: rand(0, TAU), stun: 0, spawnT: 0.5,
      squadId, slot, elite, leader: false, buffed: false,
      snipeT: 0, snipeAng: 0, aimLock: 0, aimAng: 0,
      coverX: 0, coverY: 0, coverT: 0, grenadeCd: rand(3, 8),
      panic: 0, garrison: false, homeX: x, homeY: y, morale: 1,
      lunge: 0, charge: rand(1, 2),
    };
  }

  /** Riot custody officers are rare: a handful per wave, never a formation of them. */
  private maybeCustodian(type: string) {
    if (this.phase === 'recon' || this.wave < 2) return type;
    if (type !== 'guard' && type !== 'grunt' && type !== 'shieldman' && type !== 'warden') return type;
    const already = this.enemies.filter((e) => e.type === 'custodian' && e.hp > 0).length;
    if (already >= 8 + this.wave * 2) return type;
    return Math.random() < 0.26 ? 'custodian' : type;
  }

  private spawnEnemy(type: string, squadId: number, slot: number, dropX?: number, dropY?: number) {
    type = this.maybeCustodian(type);
    const squad = this.squads.find((s) => s.id === squadId);
    // squads land together — prefer under their VTOL while it's delivering
    let bx: number, by: number;
    const vtol = this.vtols.find((v) => v.squadId === squadId);
    const existing = this.enemies.find((e) => e.squadId === squadId && !e.garrison);
    if (dropX !== undefined && dropY !== undefined) { bx = dropX; by = dropY; }
    else if (vtol && vtol.state !== 'out') { bx = vtol.x; by = vtol.y; }
    else if (existing) { bx = existing.x; by = existing.y; }
    else {
      const towardHQ = Math.atan2(HQ.cy - this.py, HQ.cx - this.px);
      const a = towardHQ + rand(-1.5, 1.5);
      const dist = rand(760, 1050);
      bx = clamp(this.px + Math.cos(a) * dist, 120, ARENA_W - 120);
      by = clamp(this.py + Math.sin(a) * dist, 120, ARENA_H - 120);
      if (squad) { squad.cx = bx; squad.cy = by; squad.anchorX = bx; squad.anchorY = by; }
    }
    let x: number, y: number;
    if (dropX !== undefined && dropY !== undefined) {
      x = dropX; y = dropY;
    } else if (vtol) {
      // rope-drop: staggered line under the bird
      x = clamp(bx + ((slot % 2 === 0 ? -1 : 1) * Math.ceil((slot + 1) / 2) * 36), 90, ARENA_W - 90);
      y = clamp(by + rand(-20, 20), 90, ARENA_H - 90);
    } else {
      x = clamp(bx + rand(-80, 80), 90, ARENA_W - 90);
      y = clamp(by + rand(-80, 80), 90, ARENA_H - 90);
    }
    // No custody officer is dispatched into the S.H.I.E.L.D. compound, however the squad
    // lands: an arrest on the friendly doorstep is not a fight, it is a bug report.
    if (type === 'custodian' && Math.hypot(x - VAULT_ENTRY.x, y - VAULT_ENTRY.y) < 1500) type = 'grunt';
    const e = this.makeEnemy(type, x, y, squadId, slot);
    this.collide(e, e.def.r);
    if (vtol) {
      e.spawnT = 0.42;
      for (let i = 0; i < 12; i++)
        this.addParticle(x, y - 46, rand(-30, 30), rand(50, 130), rand(0.25, 0.5), rand(2, 4), '#9ab5c0', true);
    }

    // Leadership: highest rank in the squad commands it.
    const rank = (t: string) => (t === 'commander' ? 6 : t === 'boss' ? 5 : t === 'heavy' ? 4 : t === 'shieldman' ? 3 : t === 'sniper' ? 2 : 1);
    const mates = this.enemies.filter((o) => o.squadId === squadId);
    const cur = mates.find((o) => o.leader);
    if (!cur) e.leader = true;
    else if (rank(type) > rank(cur.type)) { cur.leader = false; e.leader = true; }

    this.enemies.push(e);
    this.marks.push({ x, y, t: 0.5 });
    for (let i = 0; i < (e.elite ? 20 : 12); i++)
      this.addParticle(x, y, rand(-120, 120), rand(-120, 120), 0.4, rand(2, 4), e.elite ? '#ffd166' : e.def.color, true);
  }

  /* ---------------- SQUAD BRAIN ---------------- */

  private squadBark(s: Squad, msg: string, color = '#ffb0b0') {
    const mates = this.enemies.filter((e) => e.squadId === s.id && Math.hypot(e.x - this.px, e.y - this.py) < 1000);
    if (!mates.length) return;
    const l = mates.find((m) => m.leader) || mates[0];
    this.addText(l.x, l.y - l.def.r - 16, msg, color, 13);
  }

  private updateSquads(dt: number) {
    // Waves and convoys can add troops mid-frame: refresh the shared indexes first.
    this.rebuildEnemyBuckets();
    for (const s of this.squads) {
      const mates = this.squadMembers.get(s.id) || NO_ENEMIES;
      if (!mates.length) continue;

      s.stateT += dt; s.barkCd -= dt; s.volleyT -= dt; s.grenadeT -= dt;
      s.angle += dt * 0.24;
      if (s.volleyWindow > 0) s.volleyWindow -= dt;

      let cx = 0, cy = 0;
      for (const m of mates) { cx += m.x; cy += m.y; }
      s.cx = cx / mates.length; s.cy = cy / mates.length;
      s.cohesion = mates.length / Math.max(1, s.size);

      const leader = mates.find((m) => m.leader) || mates[0];
      const dPlayer = Math.hypot(s.cx - this.px, s.cy - this.py);
      // formation faces the player from the leader's position
      s.facing = lerpAngle(s.facing, Math.atan2(this.py - leader.y, this.px - leader.x), 1 - Math.pow(0.0006, dt));

      // morale: falls as the unit is wiped or its leader dies
      const leaderAlive = mates.some((m) => m.leader);
      s.morale = clamp(s.cohesion * (leaderAlive ? 1 : 0.55) * (this.commandOnline ? 1 : 0.7), 0, 1);

      /* ---- state machine ---- */
      const prev = s.state;
      const engageRange = s.tactic === 'blitz' ? 250 : s.tactic === 'turtle' ? 400 : s.tactic === 'bombers' ? 430 : 330;
      if (s.state === 'deploy') {
        if (s.stateT > 0.7) s.state = 'advance';
      } else if (s.state === 'advance') {
        if (s.tactic === 'ambush' && s.stateT < 2.4) { /* coil */ }
        else if (dPlayer < engageRange) s.state = 'engage';
      } else if (s.state === 'engage') {
        if (s.morale < 0.34 && s.stateT > 3) s.state = 'rout';
        else if (s.cohesion < 0.45 && s.stateT > 4) s.state = 'regroup';
        else if (this.camping > 0.6 && s.stateT > 3.2 && s.tactic !== 'turtle') s.state = 'flank';
        else if (dPlayer > engageRange * 2.1) s.state = 'advance';
      } else if (s.state === 'flank') {
        if (s.stateT > 3 || this.camping < 0.3) s.state = 'engage';
      } else if (s.state === 'regroup') {
        if (s.stateT > 3.2) s.state = 'advance';
      } else if (s.state === 'rout') {
        // broken units flee toward the fortress to re-arm
        if (s.stateT > 5) { s.state = 'advance'; s.morale = 0.7; }
      }
      if (prev !== s.state) s.stateT = 0;

      /* ---- synchronized volley ---- */
      if (s.state === 'engage' && s.volleyT <= 0) {
        const shooters = mates.filter((m) => m.def.ranged && !m.def.boss && !m.def.civilian &&
          Math.hypot(m.x - this.px, m.y - this.py) < (m.def.range || 340) * 1.05 &&
          this.hasLine(m.x, m.y, this.px, this.py));
        if (shooters.length >= 2) {
          const lead = 0.3 + this.aiLevel * 0.14;
          s.fx = this.px + this.pvx * lead;
          s.fy = this.py + this.pvy * lead;
          s.volleyWindow = 0.6;
          s.volleyT = rand(2.2, 3.2) - this.aiLevel * 0.8;
          for (const m of shooters) {
            m.aimLock = 0.3 + Math.random() * 0.16;
            m.aimAng = Math.atan2(s.fy - m.y, s.fx - m.x);
            m.cool = m.aimLock;
          }
          this.squadBark(s, 'VOLLEY — MARK!', '#ffcf7a');
        } else s.volleyT = 1.1;
      }

      /* ---- coordinated grenades (bombardiers love this) ---- */
      const wantsNade = s.tactic === 'bombers' ? 0.85 : 0.42;
      if (s.grenadeT <= 0 && dPlayer < 560 && Math.random() < wantsNade) {
        const throwers = mates.filter((m) => (m.type === 'bomber' || m.type === 'commander' || m.type === 'heavy' || m.leader)
          && m.grenadeCd <= 0 && Math.hypot(m.x - this.px, m.y - this.py) < 520);
        if (throwers.length) {
          // bombardiers bracket the target — spread the impacts so dashing out is hard
          const count = s.tactic === 'bombers' ? Math.min(3, throwers.length) : 1;
          for (let i = 0; i < count; i++) {
            const th = throwers[i];
            const spreadA = (i - (count - 1) / 2) * 0.9;
            const dist = Math.hypot(this.px - th.x, this.py - th.y);
            const baseA = Math.atan2(this.py - th.y, this.px - th.x) + spreadA * 0.22;
            const tx = th.x + Math.cos(baseA) * dist + this.pvx * 0.5;
            const ty = th.y + Math.sin(baseA) * dist + this.pvy * 0.5;
            const total = clamp(Math.hypot(tx - th.x, ty - th.y) / 400, 0.75, 1.6);
            this.enemyNades.push({ x: th.x, y: th.y, tx, ty, t: total, total, z: 0 });
            th.grenadeCd = rand(6, 10);
          }
          s.grenadeT = rand(5.5, 9);
          this.squadBark(s, count > 1 ? 'BRACKET — FIRE!' : 'FRAG OUT!', '#ffcf7a');
          sfx.shoot('smg');
        } else s.grenadeT = 1.4;
      }

      /* ---- barks ---- */
      if (s.barkCd <= 0) {
        s.barkCd = rand(5, 9);
        const byState: Record<SquadState, string[]> = {
          deploy: ['MOVING UP!', 'FORM UP!'],
          advance: [`${TACTIC_LABEL[s.tactic]} FORMATION!`, 'HOLD THE LINE!', 'ADVANCE!'],
          engage: ['CONTACT!', 'ENGAGE!', 'PIN HIM DOWN!'],
          flank: ['FLANKING!', 'BREAK LEFT!'],
          regroup: ['REGROUP!', 'TIGHTEN UP!'],
          rout: ['FALL BACK!', 'WE\'RE BREAKING!'],
        };
        const l = byState[s.state];
        this.squadBark(s, l[Math.floor(Math.random() * l.length)], s.state === 'rout' ? '#9fb3c8' : '#ffb0b0');
      }
    }

    /* ---- global director: assign doctrines ---- */
    const alive = this.squads.filter((s) => this.enemies.some((e) => e.squadId === s.id));
    if (alive.length > 1) {
      const scored = alive.map((s) => ({ s, d: Math.hypot(s.cx - this.px, s.cy - this.py) }));
      scored.sort((a, b) => b.d - a.d);
      scored[0].s.doctrine = 'anchor';
      for (let i = 1; i < scored.length; i++) scored[i].s.doctrine = i < 3 ? 'hunter' : 'reserve';
    } else if (alive.length === 1) alive[0].doctrine = 'hunter';

    // prune dead squads
    if (this.squads.length) {
      const live = new Set(this.enemies.map((e) => e.squadId));
      const queued = new Set(this.spawnQueue.map((s) => s.squadId));
      for (const t of this.trucks) if (!t.dead && t.slot < t.comp.length) queued.add(t.squadId);
      for (const a of this.airTransports) if (a.slot < a.comp.length) queued.add(a.squadId);
      for (const p of this.airTroops) queued.add(p.squadId);
      this.squads = this.squads.filter((s) => live.has(s.id) || queued.has(s.id));
      const eng = this.squads.find((s) => s.state === 'engage' || s.state === 'flank');
      if (eng) this.aiTactic = `${TACTIC_LABEL[eng.tactic]} · ${eng.state.toUpperCase()}`;
    }
  }

  /* ---------------- ENEMY UPDATE ---------------- */

  private updateEnemies(dt: number) {
    const commanders = this.enemies.filter((e) => e.type === 'commander' && e.spawnT <= 0 && e.hp > 0);
    const lead = clamp(0.25 + this.aiLevel * 0.4, 0, 0.72);
    const ppx = this.px + this.pvx * lead * 0.55;
    const ppy = this.py + this.pvy * lead * 0.55;
    const list = this.enemies;
    // Nearby separation stays cheap as the map's garrisons grow.
    this.enemyCells.clear();
    for (const e of list) {
      const key = Math.floor(e.y / 128) * 1024 + Math.floor(e.x / 128);
      const bucket = this.enemyCells.get(key);
      if (bucket) bucket.push(e); else this.enemyCells.set(key, [e]);
    }

    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (!e || e.boardingTruck !== undefined) continue;
      // A man in the parade ground does not path, think or shoot until the alarm wakes him.
      if (e.dormant) continue;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      const def = e.def;
      const dx = this.px - e.x, dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (e.garrison && dist > 1650 && !e.alert) {
        // A beat still marches when the operative is on the other side of the map. Without
        // this, every street patrol outside 1 650 m was skipped and stood there like a prop.
        if (e.patrolTeam) {
          const team = this.patrolTeams.find((p) => p.id === e.patrolTeam);
          if (team && Math.hypot(e.x - team.x, e.y - team.y) < 420) {
            const slot = e.patrolSlot || 0;
            const cols = Math.max(1, team.columns || 2), gap = team.spacing || 41;
            const rank = Math.floor(slot / cols), file = slot % cols;
            const forward = -rank * gap, side = (file - (cols - 1) / 2) * (gap * 0.82);
            const tx = team.x + Math.cos(team.angle) * forward - Math.sin(team.angle) * side;
            const ty = team.y + Math.sin(team.angle) * forward + Math.cos(team.angle) * side;
            const k = Math.min(1, dt * 2.2);
            e.x = lerp(e.x, tx, k); e.y = lerp(e.y, ty, k);
            e.ang = team.angle;
            continue;
          }
        }
        if ((e.policePost || !e.alert) && this.walkPost(e, dt)) continue;
        continue;
      }
      if (e.facilityId && dist > 2300) {
        e.alert = false; e.vx = 0; e.vy = 0;
        continue;
      }

      // far-away units get cheap ticks (huge map performance guard)
      const far = dist > 2600;
      if (far && !e.garrison) {
        const fx = e.x, fy = e.y;
        e.x += e.vx * dt; e.y += e.vy * dt;
        this.holdOnLand(fx, fy, e);
        e.vx = lerp(e.vx, (dx / dist) * def.speed, 1 - Math.pow(0.02, dt));
        e.vy = lerp(e.vy, (dy / dist) * def.speed, 1 - Math.pow(0.02, dt));
        continue;
      }

      e.wobble += dt * 6;
      if (e.flash > 0) e.flash -= dt;
      if (e.grenadeCd > 0) e.grenadeCd -= dt;
      e.ang = lerpAngle(e.ang, Math.atan2(dy, dx), 1 - Math.pow(0.0005, dt));
      if (e.stun > 0) {
        e.stun -= dt; e.vx *= 0.86; e.vy *= 0.86;
        e.x += e.vx * dt; e.y += e.vy * dt; this.collide(e, def.r);
        continue;
      }

      /* ===== UNARMED HQ STAFF ===== */
      if (def.civilian) {
        this.updateCivilian(e, dt, dist, dx, dy);
        continue;
      }

      /* ===== GARRISON (asleep until breach) ===== */
      if (e.garrison && !e.alert) {
        if ((dist < 740 && this.hasLine(e.x, e.y, this.px, this.py)) || (this.garrisonAlerted && dist < 1200)) {
          e.alert = true; e.cool = Math.min(e.cool, 0.2);
          for (const mate of list) {
            if (!mate.garrison || mate.def.civilian) continue;
            if ((e.facilityId && mate.facilityId === e.facilityId) || Math.hypot(mate.x - e.x, mate.y - e.y) < 450) mate.alert = true;
          }
          this.addText(e.x, e.y - 36, e.facilityId ? 'POST COMMAND / CONTACT' : 'VISUAL CONTACT / ENGAGE', '#f5a993', 12);
        } else {
          if (!e.patrol?.length && !e.patrolTeam) {
            e.vx = 0; e.vy = 0; e.x = e.homeX; e.y = e.homeY; e.ang = -Math.PI / 2;
            continue;
          }
        }
      }

      const squad = this.squads.find((s) => s.id === e.squadId);
      e.buffed = false;
      for (const c of commanders) if (c !== e && Math.hypot(c.x - e.x, c.y - e.y) < 360) { e.buffed = true; break; }
      if (e.aimLock > 0) e.aimLock -= dt;

      let sp = def.speed * (e.elite ? 1.12 : 1) * (e.buffed ? 1.22 : 1);
      if (e.aimLock > 0) sp *= 0.3;
      let gx = ppx, gy = ppy;

      if (e.garrison) {
        /* --- garrison defends the keep: never chase far from post --- */
        const dHome = Math.hypot(e.x - e.homeX, e.y - e.homeY);
        if (e.patrolTeam && !e.alert) {
          const team = this.patrolTeams.find(p => p.id === e.patrolTeam);
          if (team) {
            // Rank-and-file marching: `columns` abreast, spaced along the column.
            const slot = e.patrolSlot || 0;
            const cols = Math.max(1, team.columns || 2), gap = team.spacing || 41;
            const rank = Math.floor(slot / cols), file = slot % cols;
            const forward = -rank * gap, side = (file - (cols - 1) / 2) * (gap * 0.82);
            gx = team.x + Math.cos(team.angle) * forward - Math.sin(team.angle) * side;
            gy = team.y + Math.sin(team.angle) * forward + Math.cos(team.angle) * side;
            e.homeX = gx; e.homeY = gy; sp = (team.speed || 58) * 1.45;
            const waypoint = this.postWaypoint(e, { x: gx, y: gy }); gx = waypoint.x; gy = waypoint.y;
            e.ang = lerpAngle(e.ang, team.angle, 1 - Math.exp(-4 * dt));
          }
        } else if (e.facilityId) {
          const f = this.facilities.find(f => f.id === e.facilityId);
          if (!e.alert && e.patrol?.length) {
            const node = e.patrolNode || 0, target = e.patrol[node];
            gx = target.x; gy = target.y; sp *= 0.55;
            e.ang = lerpAngle(e.ang, Math.atan2(gy - e.y, gx - e.x), 1 - Math.exp(-4 * dt));
            if (Math.hypot(gx - e.x, gy - e.y) < 20) e.patrolNode = (node + 1) % e.patrol.length;
          } else if (!f || Math.hypot(this.px - (f.x + f.w / 2), this.py - (f.y + f.h / 2)) > 1000) {
            gx = e.homeX; gy = e.homeY;
            if (dHome < 35) e.alert = false;
          } else {
            const retreat = e.postRole === 'leader' || e.postRole === 'support';
            if (e.postRole === 'flank' || e.postRole === 'patrol') {
              const axis = Math.atan2(this.py - f.y - f.h / 2, this.px - f.x - f.w / 2);
              const side = e.slot % 2 ? 1 : -1;
              const lead = this.mobility > 0.65 ? 0.6 : 0.25;
              gx = this.px + this.pvx * lead - Math.sin(axis) * side * 190;
              gy = this.py + this.pvy * lead + Math.cos(axis) * side * 190;
            } else {
              const standoff = retreat ? (def.range || 340) * 0.8 : e.postRole === 'sentry' ? (def.range || 340) * 0.65 : 135;
              gx = this.px - dx / dist * standoff;
              gy = this.py - dy / dist * standoff;
              if (Math.abs(dist - standoff) < 35 && this.hasLine(e.x, e.y, this.px, this.py)) { gx = e.x; gy = e.y; }
            }
          }
          if (Math.hypot(gx - e.x, gy - e.y) > 18) {
            const waypoint = this.postWaypoint(e, { x: gx, y: gy }); gx = waypoint.x; gy = waypoint.y;
          }
        } else if (e.type === 'turret') { gx = e.homeX; gy = e.homeY; sp = 0; }
        else if (e.type === 'custodian' && e.patrol?.length && (e.policePost ? !this.postEngaged(e, dist) : !e.alert)) {
          // walking the beat: a slow circuit around the post, weapon low
          const node = e.patrol[e.patrolNode || 0];
          gx = node.x; gy = node.y; sp = Math.max(26, e.def.speed * 0.42);
          e.ang = lerpAngle(e.ang, Math.atan2(gy - e.y, gx - e.x), 1 - Math.exp(-5 * dt));
          if (Math.hypot(gx - e.x, gy - e.y) < 18) e.patrolNode = ((e.patrolNode || 0) + 1) % e.patrol.length;
        }
        else if (dist < 700 && dHome < 900) { gx = ppx; gy = ppy; }
        else { gx = e.homeX; gy = e.homeY; }

        // Custody officers are not soldiers: they close the distance and put hands on
        // you. A street beat cop leaves his route the moment he has eyes on the operative.
        if (e.type === 'custodian' && !e.policePost) {
          const seesPlayer = dist < 640 && this.hasLine(e.x, e.y, this.px, this.py);
          if (seesPlayer) {
            e.alert = true;
            gx = ppx; gy = ppy; sp = Math.max(sp, def.speed * 1.55);
            e.ang = lerpAngle(e.ang, Math.atan2(this.py - e.y, this.px - e.x), 1 - Math.exp(-8 * dt));
          } else if (dist > 900 && !e.policePost) {
            e.alert = false;
          }
        }
      } else if (squad) {
        const mates = this.squadMembers.get(squad.id) || NO_ENEMIES;
        const leader = mates.find((m) => m.leader) || mates[0];
        const st = squad.state;

        if (st === 'rout') {
          const a = Math.atan2(e.y - this.py, e.x - this.px);
          gx = e.x + Math.cos(a) * 300; gy = e.y + Math.sin(a) * 300; sp *= 1.15;
        } else if (st === 'regroup') {
          gx = squad.cx; gy = squad.cy; sp *= 1.1;
        } else if (st === 'flank') {
          const side = e.slot % 2 === 0 ? 1 : -1;
          const pa = Math.atan2(dy, dx) + side * 1.35;
          gx = this.px + Math.cos(pa) * 340; gy = this.py + Math.sin(pa) * 340; sp *= 1.14;
        } else {
          /* ---- FORMATION KEEPING: the heart of the unit AI ---- */
          const local = formationSlot(squad.tactic, e.slot, squad.size);
          // anchor point: leader pushes toward the player, others hold slots around it
          let ax: number, ay: number;
          if (e.leader) {
            const standoff = squad.tactic === 'turtle' ? 300
              : squad.tactic === 'bombers' ? 380
              : squad.tactic === 'phalanx' ? 210 : 90;
            ax = this.px - Math.cos(squad.facing) * standoff;
            ay = this.py - Math.sin(squad.facing) * standoff;
            if (squad.doctrine === 'anchor') { ax -= Math.cos(squad.facing) * 180; ay -= Math.sin(squad.facing) * 180; }
          } else { ax = leader.x; ay = leader.y; }
          const ca = Math.cos(squad.facing), sa = Math.sin(squad.facing);
          gx = ax + local.x * ca - local.y * sa;
          gy = ay + local.x * sa + local.y * ca;

          // tactic speed feel
          if (squad.tactic === 'blitz') sp *= 1.3;
          else if (squad.tactic === 'turtle') sp *= 0.72;
          else if (squad.tactic === 'phalanx') sp *= 0.85;
          else if (squad.tactic === 'column') sp *= 1.12;

          // ambush units hold at range until the spring
          if (squad.tactic === 'ambush' && st === 'advance' && squad.stateT < 2.4) sp *= 1.3;

          // cover-seeking for shooters during engagements
          if (def.ranged && st === 'engage' && dist > 200 && e.coverT <= 0) {
            const spot = this.findCover(e, dist);
            if (spot) { e.coverX = spot.x; e.coverY = spot.y; e.coverT = rand(2.4, 4); }
            else e.coverT = rand(1.4, 2.6);
          }
          if (e.coverT > 0) {
            e.coverT -= dt;
            if (e.coverX && Math.hypot(e.coverX - e.x, e.coverY - e.y) > 30) { gx = e.coverX; gy = e.coverY; }
          }
        }
      } else if (def.boss) {
        if (dist < 280) { gx = e.x - (dx / dist) * 140; gy = e.y - (dy / dist) * 140; }
      }

      /* ---- steering ---- */
      const gdx = gx - e.x, gdy = gy - e.y;
      const gd = Math.hypot(gdx, gdy) || 1;
      let tx = gdx / gd, ty = gdy / gd;
      if (gd < 22) { tx *= gd / 22; ty *= gd / 22; }
      e.vx = lerp(e.vx, tx * sp, 1 - Math.pow(0.0025, dt));
      e.vy = lerp(e.vy, ty * sp, 1 - Math.pow(0.0025, dt));

      const cellX = Math.floor(e.x / 128), cellY = Math.floor(e.y / 128);
      for (let gy = cellY - 1; gy <= cellY + 1; gy++) for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
        const neighbors = this.enemyCells.get(gy * 1024 + gx);
        if (!neighbors) continue;
        for (const o of neighbors) {
          if (o === e || o.hp <= 0) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const d2 = ox * ox + oy * oy;
          const rr = (def.r + o.def.r) * 0.95;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2), push = ((rr - d) / d) * 3.4;
            e.vx += ox * push; e.vy += oy * push;
          }
        }
      }

      const prevX = e.x, prevY = e.y;
      e.x = clamp(e.x + e.vx * dt, def.r, ARENA_W - def.r);
      e.y = clamp(e.y + e.vy * dt, def.r, ARENA_H - def.r);
      const n = this.collide(e, def.r);
      // the sea is solid ground for the infantry: a wall, not a slow-down
      this.holdOnLand(prevX, prevY, e);
      if (n) {
        const tX = -n.ny, tY = n.nx;
        const dot = e.vx * tX + e.vy * tY;
        e.vx = tX * dot + n.nx * 20; e.vy = tY * dot + n.ny * 20;
      }
      // A posted officer never ends up standing in the sea, whatever shoved him.
      if (e.policePost && !this.onDryGround(e.x, e.y)) {
        e.x = e.homeX; e.y = e.homeY; e.vx = 0; e.vy = 0;
      }

      /* ---- MEDIC: keeps the unit alive ---- */
      if (e.type === 'medic' && e.hp > 0) {
        let target: Enemy | null = null; let bd = Infinity;
        for (const o of this.enemies) {
          if (o.squadId !== e.squadId || o === e || o.hp >= o.maxHp || o.spawnT > 0 || o.def.civilian) continue;
          const dd = Math.hypot(o.x - e.x, o.y - e.y);
          if (dd < 250 && dd < bd) { bd = dd; target = o; }
        }
        if (target) {
          target.hp = Math.min(target.maxHp, target.hp + 16 * dt);
          if (Math.random() < 0.35)
            this.addParticle(target.x, target.y, rand(-18, 18), rand(-34, -10), 0.4, 2.6, '#8dffb0', true);
          if (Math.random() < dt * 0.5)
            this.addText(target.x, target.y - target.def.r - 14, '+', '#8dffb0', 13);
        } else if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + 4 * dt);
      }

      /* ---- SAPPER: mines the approach ---- */
      if (e.type === 'sapper' && e.grenadeCd <= 0 && dist < 540 && dist > 100 && this.mines.length < 14) {
        e.grenadeCd = rand(5.5, 9);
        this.mines.push({ x: e.x, y: e.y, t: 1.1, armed: false });
        if (Math.random() < 0.6) this.addText(e.x, e.y - 26, 'MINE!', '#ffd166', 12);
        this.sparks(e.x, e.y, '#d8b06a', 6);
      }

      /* ---- RAIDER: lunge attack ---- */
      if (e.type === 'raider' || e.type === 'warhound') {
        e.charge -= dt;
        if (e.lunge > 0) {
          e.lunge -= dt;
          const la = Math.atan2(this.py - e.y, this.px - e.x);
          e.vx = Math.cos(la) * 980; e.vy = Math.sin(la) * 980;
          if (Math.random() < 0.6)
            this.addParticle(e.x, e.y, rand(-30, 30), rand(-30, 30), 0.25, 3, e.type === 'warhound' ? '#ff8c62' : '#ff5f9e', true);
        } else if (dist < 250 && e.charge <= 0) {
          e.lunge = 0.28; e.charge = 2.1;
          sfx.dash();
        }
      }

      /* ---- shooting ---- */
      const inVolley = !!(squad && squad.volleyWindow > 0);
      e.cool -= dt * (e.buffed ? 1.25 : 1) * (inVolley ? 1.6 : 1);

      if (e.type === 'sniper') {
        if (e.snipeT > 0) {
          e.snipeT -= dt;
          e.snipeAng = lerpAngle(e.snipeAng, Math.atan2(ppy - e.y, ppx - e.x), 1 - Math.pow(0.001, dt));
          if (e.snipeT <= 0 && dist < def.range!) {
            this.enemyShot(e, e.snipeAng, def.bulletDmg! * (e.elite ? 1.3 : 1), def.bulletSpeed!, '#9fe8ff', 4);
            if (dist < 1200) sfx.shoot('rifle');
            e.cool = def.fireRate! * rand(0.9, 1.15);
          }
        } else if (e.cool <= 0 && dist < def.range! && this.hasLine(e.x, e.y, this.px, this.py)) {
          e.snipeT = inVolley ? 0.32 : 0.62; e.snipeAng = Math.atan2(dy, dx);
        }
      } else if (def.ranged && dist < def.range! && e.cool <= 0 && this.hasLine(e.x, e.y, this.px, this.py)) {
        e.cool = def.fireRate! * rand(0.85, 1.18);
        const pellets = def.pellets ?? 1;
        let aimX: number, aimY: number;
        if (inVolley && squad) { aimX = squad.fx; aimY = squad.fy; }
        else {
          aimX = ppx + (this.dashT > 0 ? Math.cos(this.dashAng) * 100 * this.aiLevel : 0);
          aimY = ppy + (this.dashT > 0 ? Math.sin(this.dashAng) * 100 * this.aiLevel : 0);
        }
        const base = Math.atan2(aimY - e.y, aimX - e.x);
        const acc = inVolley ? 0.45 : 1;
        for (let p = 0; p < pellets; p++) {
          const a = def.boss
            ? (p / pellets) * TAU + e.wobble * 0.1
            : base + (pellets > 1 ? rand(-def.spread!, def.spread!) * acc : rand(-0.045, 0.045) * acc * (1.25 - this.aiLevel * 0.5));
          this.enemyShot(e, a, def.bulletDmg! * (e.elite ? 1.25 : 1) * (inVolley ? 1.12 : 1),
            def.bulletSpeed! * (1 + this.aiLevel * 0.14),
            e.type === 'commander' ? '#ffd166' : e.type === 'flamer' ? '#ff8a3d' : inVolley ? '#ffb060' : '#ff7b7b', def.boss ? 6 : 4);
        }
        /* ---- FLAMER: a visible burning cone, not just fast bullets ---- */
        if (e.type === 'flamer') {
          for (let k = 0; k < 6; k++) {
            const fa = base + rand(-0.34, 0.34), fd = rand(18, def.range!);
            this.addParticle(e.x + Math.cos(fa) * fd, e.y + Math.sin(fa) * fd,
              Math.cos(fa) * rand(45, 150), Math.sin(fa) * rand(45, 150),
              rand(0.24, 0.5), rand(4, 9), k % 3 === 0 ? '#ffe08a' : k % 3 === 1 ? '#ff8a3d' : '#c2410c', true);
          }
          this.addLight(e.x + Math.cos(base) * 70, e.y + Math.sin(base) * 70, 210, '255,140,60', 0.18);
        }
        if (dist < 1100) sfx.shoot(def.boss ? 'shotgun' : 'smg');
      }

      // Custody officers do not shoot: they walk you down and cuff you.
      if (e.type === 'custodian' && !this.inVehicleOrAir
          && dist < def.r + 26 && this.status === 'playing') {
        // A dash or the AEGIS shield still beats a pair of handcuffs.
        // The gate detail only steps in once the operative is past the sally port; on the
        // bridge and the forecourt they let him walk up to the door.
        // No handcuffs inside the S.H.I.E.L.D. compound: that ground belongs to the operative.
        const atShield = Math.hypot(this.px - VAULT_ENTRY.x, this.py - VAULT_ENTRY.y) < 760;
        // ...and nothing at altitude is cuffable, even if the shadow is right under him.
        const overhead = !!(this.playerJet && this.playerJet.alt > 12);
        const mayCuff = !overhead && (!e.policePost || this.px > PRISON_DOOR.x - 40) && !atShield;
        if (mayCuff && this.iFrames <= 0 && this.aegisTime <= 0 && this.dashT <= 0) { this.beginArrest(e); return; }
      }
      // contact damage
      if (!this.piloting && !this.flyingPlane && dist < def.r + 15 && def.dmg > 0) {
        this.damagePlayer(def.dmg * dt * 2.4, e.x, e.y);
        e.vx -= (dx / dist) * 130; e.vy -= (dy / dist) * 130;
        if (this.mods.thorns > 0 && this.iFrames <= 0)
          this.hurtEnemy(e, this.mods.thorns * dt * 2.4, -(dx / dist) * 120, -(dy / dist) * 120);
      }
    }
  }

  /** Unarmed staff: panic, flee, hide behind servers — never fight, never leave. */
  private updateCivilian(e: Enemy, dt: number, dist: number, dx: number, dy: number) {
    const threat = dist < 620;
    if (threat) e.panic = Math.min(1, e.panic + dt * 1.6);
    else e.panic = Math.max(0, e.panic - dt * 0.5);

    let gx = e.homeX, gy = e.homeY;
    if (e.type === 'general') {
      // The general stands his ground at the dais, directing until the end.
      const shielded = this.servers.some((s) => !s.dead);
      if (threat && !shielded) {
        // once his mainframes are gone he backs away, still unarmed
        gx = e.homeX - dx / dist * 90; gy = e.homeY - dy / dist * 90;
      }
      e.ang = lerpAngle(e.ang, Math.atan2(dy, dx), 1 - Math.pow(0.02, dt));
    } else if (e.panic > 0.15) {
      // programmers scatter to the nearest intact server bank, else cower at a wall
      let best: Server | null = null, bd = Infinity;
      for (const s of this.servers) {
        if (s.dead) continue;
        const d = Math.hypot(s.x - e.x, s.y - e.y);
        if (d < bd) { bd = d; best = s; }
      }
      if (best) {
        const a = Math.atan2(best.y - this.py, best.x - this.px);
        gx = best.x + Math.cos(a) * 52; gy = best.y + Math.sin(a) * 52;
      } else {
        gx = e.x - (dx / dist) * 200; gy = e.y - (dy / dist) * 200;
      }
      if (Math.random() < dt * 0.7) this.addText(e.x, e.y - 26, ['!!', 'HELP!', 'HE\'S INSIDE!'][Math.floor(Math.random() * 3)], '#9fd8ff', 12);
    }

    const gdx = gx - e.x, gdy = gy - e.y;
    const gd = Math.hypot(gdx, gdy) || 1;
    const sp = e.def.speed * (0.5 + e.panic * 0.9);
    if (gd > 14) {
      e.vx = lerp(e.vx, (gdx / gd) * sp, 1 - Math.pow(0.004, dt));
      e.vy = lerp(e.vy, (gdy / gd) * sp, 1 - Math.pow(0.004, dt));
    } else { e.vx *= 0.86; e.vy *= 0.86; }
    const cx0 = e.x, cy0 = e.y;
    e.x += e.vx * dt; e.y += e.vy * dt;
    this.collide(e, e.def.r);
    // HQ staff cannot swim either.
    this.holdOnLand(cx0, cy0, e);
  }

  private enemyShot(e: Enemy, a: number, dmg: number, speed: number, color: string, r: number) {
    this.bullets.push({
      x: e.x + Math.cos(a) * (e.def.r + 6), y: e.y + Math.sin(a) * (e.def.r + 6),
      px: e.x, py: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, life: 2.4, friendly: false, color, r,
    });
    for (let k = 0; k < 5; k++)
      this.addParticle(e.x + Math.cos(a) * e.def.r, e.y + Math.sin(a) * e.def.r, rand(-80, 80), rand(-80, 80), 0.14, 3, '#ffb27d', true);
    this.addLight(e.x, e.y, 110, '255,150,90', 0.08);
  }

  private findCover(e: Enemy, dist: number): { x: number; y: number } | null {
    this.grid.query(e.x - 300, e.y - 300, 600, 600, this.qset);
    let best: { x: number; y: number; d: number } | null = null;
    for (const idx of this.qset) {
      const o = this.obstacles[idx];
      if (o.dead) continue;
      if (o.w * o.h > 30000 || o.w * o.h < 900) continue;
      const ox = o.x + o.w / 2, oy = o.y + o.h / 2;
      const a = Math.atan2(oy - this.py, ox - this.px);
      const cx = ox + Math.cos(a) * (Math.max(o.w, o.h) / 2 + 26);
      const cy = oy + Math.sin(a) * (Math.max(o.w, o.h) / 2 + 26);
      const dd = Math.hypot(cx - e.x, cy - e.y);
      if (dd > 280) continue;
      if (this.hasLine(cx, cy, this.px, this.py)) continue; // want blocked = real cover
      if (Math.hypot(cx - this.px, cy - this.py) > dist + 70) continue;
      if (!best || dd < best.d) best = { x: cx, y: cy, d: dd };
    }
    return best;
  }

  /* ---------------- collision & LOS (grid accelerated) ---------- */

  private collide(o: { x: number; y: number }, r: number): { nx: number; ny: number } | null {
    // Walk the spatial buckets directly with a stamp-based dedupe: no Set traffic on the
    // hottest function in the simulation (every soldier, vehicle and the player call it).
    if (this.rectSeen.length < this.obstacles.length) this.rectSeen = new Int32Array(this.obstacles.length);
    const stamp = ++this.rectStamp;
    const cell = this.grid.cell, cols = this.grid.cols, rows = this.grid.rows;
    const gx0 = Math.max(0, Math.floor((o.x - r - 4) / cell)), gx1 = Math.min(cols - 1, Math.floor((o.x + r + 4) / cell));
    const gy0 = Math.max(0, Math.floor((o.y - r - 4) / cell)), gy1 = Math.min(rows - 1, Math.floor((o.y + r + 4) / cell));
    let normal: { nx: number; ny: number } | null = null;
    for (let gy = gy0; gy <= gy1; gy++) {
      const rowBase = gy * cols;
      for (let gx = gx0; gx <= gx1; gx++) {
        const bucket = this.grid.buckets[rowBase + gx];
        for (let k = 0; k < bucket.length; k++) {
      const idx = bucket[k];
      if (this.rectSeen[idx] === stamp) continue;
      this.rectSeen[idx] = stamp;
      const b = this.obstacles[idx];
      if (b.dead) continue;
      const cx = clamp(o.x, b.x, b.x + b.w), cy = clamp(o.y, b.y, b.y + b.h);
      const dx = o.x - cx, dy = o.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 < 0.0001) {
          // Center is inside a rectangle: escape by the nearest face and return a normal.
          const left = Math.abs(o.x - b.x), right = Math.abs(b.x + b.w - o.x);
          const top = Math.abs(o.y - b.y), bottom = Math.abs(b.y + b.h - o.y);
          const min = Math.min(left, right, top, bottom);
          if (min === left) { o.x = b.x - r; normal = { nx: -1, ny: 0 }; }
          else if (min === right) { o.x = b.x + b.w + r; normal = { nx: 1, ny: 0 }; }
          else if (min === top) { o.y = b.y - r; normal = { nx: 0, ny: -1 }; }
          else { o.y = b.y + b.h + r; normal = { nx: 0, ny: 1 }; }
          continue;
        }
        const d = Math.sqrt(d2);
        o.x = cx + (dx / d) * r; o.y = cy + (dy / d) * r;
        normal = { nx: dx / d, ny: dy / d };
      }
        }
      }
    }
    for (const b of this.dynamicNear(o.x - r - 4, o.y - r - 4, o.x + r + 4, o.y + r + 4)) {
      const nx = clamp(o.x, b.x, b.x + b.w), ny = clamp(o.y, b.y, b.y + b.h);
      const dx = o.x - nx, dy = o.y - ny, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.001 && d < r) {
        o.x = nx + dx / d * r; o.y = ny + dy / d * r;
        normal = { nx: dx / d, ny: dy / d };
      } else if (d <= 0.001) {
        if (b.w > b.h) { const dir = o.y < b.y + b.h / 2 ? -1 : 1; o.y = dir < 0 ? b.y - r : b.y + b.h + r; normal = { nx: 0, ny: dir }; }
        else { const dir = o.x < b.x + b.w / 2 ? -1 : 1; o.x = dir < 0 ? b.x - r : b.x + b.w + r; normal = { nx: dir, ny: 0 }; }
      }
    }
    return normal;
  }

  private hasLine(x0: number, y0: number, x1: number, y1: number) {
    // Reused set: hasLine is called thousands of times per second during firefights.
    const candidates = this.lineSet;
    this.grid.query(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), candidates);
    const a = { x: x0, y: y0 }, b = { x: x1, y: y1 };
    for (const index of candidates) {
      const o = this.obstacles[index];
      if (!o.dead && segmentBox(a, b, o) !== null) return false;
    }
    for (const door of this.dynamicNear(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1))) {
      if (segmentBox(a, b, door) !== null) return false;
    }
    return true;
  }

  private pointBlocked(x: number, y: number) {
    const bucket = this.grid.at(x, y);
    for (let k = 0; k < bucket.length; k++) {
      const o = this.obstacles[bucket[k]];
      if (!o.dead && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return true;
    }
    for (const b of this.dynamicNear(x, y, x, y)) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    return false;
  }

  /* ---------------- bullets ---------------- */

  private updateBullets(dt: number) {
    const bl = this.bullets;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      const airArm = b.arm === 'air';
      const groundArm = b.arm === 'ground';
      // a Sidewinder flies above the battlefield: it steers for the nearest aircraft
      if (b.homing) {
        const target = this.heliAirTarget(b, 2600);
        if (target) {
          const want = Math.atan2(target.y - b.y, target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const spd = Math.hypot(b.vx, b.vy);
          const na = cur + clamp(diff, -4.6 * dt, 4.6 * dt);
          b.vx = Math.cos(na) * spd; b.vy = Math.sin(na) * spd;
        }
      }
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      if (b.rocket && Math.random() < 0.8)
        this.addParticle(b.x, b.y, rand(-40, 40), rand(-40, 40), rand(0.2, 0.45), rand(3, 6), Math.random() < 0.5 ? '#ffb15c' : '#8a8a8a', true);

      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > ARENA_W || b.y > ARENA_H;
      // Swept bounds for this step: every target scan below culls with four cheap compares
      // before doing any real geometry, so bullet cost scales with local density, not world size.
      const pad = 64 + b.r;
      const bx0 = Math.min(b.px, b.x) - pad, bx1 = Math.max(b.px, b.x) + pad;
      const by0 = Math.min(b.py, b.y) - pad, by1 = Math.max(b.py, b.y) + pad;
      if (!dead && !airArm) {
        const start = { x: b.px, y: b.py }, end = { x: b.x, y: b.y };
        const candidates = this.bulletSet;
        this.grid.query(Math.min(b.px, b.x) - 3, Math.min(b.py, b.y) - 3, Math.abs(b.x - b.px) + 6, Math.abs(b.y - b.py) + 6, candidates);
        let first = 2, block: Rect | null = null, gate: HydraulicGate | null = null;
        for (const index of candidates) {
          const r = this.obstacles[index];
          if (r.dead) continue;
          /* A gun never shoots its own parapet: rounds fired from an emplacement pass
           * through that emplacement's sandbags and nothing else. */
          if (b.ownPit && b.ownPit.some((q) => q.x === r.x && q.y === r.y && q.w === r.w)) continue;
          if (b.friendly) {
            const special = this.pierceRects.get(r);
            if (special && (special.cells.some(c => !c.dead) || special.crates.some(c => !c.dead))) continue;
          }
          const t = segmentBox(start, end, r, b.r * 0.3);
          if (t !== null && t < first) { first = t; block = r; }
        }
        for (const leaf of this.gateLeaves) {
          const rect = leaf.rect;
          if (rect.x > bx1 || rect.x + rect.w < bx0 || rect.y > by1 || rect.y + rect.h < by0) continue;
          const t = segmentBox(start, end, rect, b.r * 0.3);
          if (t !== null && t < first) { first = t; block = null; gate = leaf.gate; }
        }
        if (first <= 1) {
          b.x = b.px + (end.x - b.px) * first; b.y = b.py + (end.y - b.py) * first;
          dead = true; this.sparks(b.x, b.y, b.color, 5);
          if (block?.kind === 'crate') this.damageCrate(block, b.dmg);
          if (gate) { gate.hp -= b.dmg; if (gate.hp <= 0) this.navigationDirty = true; }
        }
      }

      if (!dead && b.friendly) {
        const sitesRef = this.campaignSites;
        if (sitesRef && !airArm) for (const cell of sitesRef.powerCells) {
          if (cell.dead || cell.x < bx0 || cell.x > bx1 || cell.y < by0 || cell.y > by1) continue;
          if (!segmentCircle({ x: b.px, y: b.py }, b, cell, 48 + b.r)) continue;
          dead = true; cell.hp -= b.dmg;
          this.sparks(b.x, b.y, cell.kind === 'generator' ? '#ffc44c' : '#9fd0ff', 7);
          if (cell.hp <= 0) {
            cell.dead = true;
            this.score += cell.kind === 'generator' ? 1400 : 900;
            this.explode(cell.x, cell.y, 120, 30, true);
            this.addText(cell.x, cell.y - 56, `${cell.kind === 'generator' ? 'GENERATOR DOWN' : 'SERVERS DARK'} +${cell.kind === 'generator' ? 1400 : 900}`, '#f2c98a', 16);
            const remaining = sitesRef.powerCells.filter(c => !c.dead).length;
            if (remaining === 1) this.addText(cell.x, cell.y - 80, 'ONE CELL LEFT — KILL THE GRID', '#efe3ae', 14);
          }
          break;
        }
        if (!groundArm) for (const a of this.airTransports) {
          if (a.x < bx0 || a.x > bx1 || a.y < by0 - 200 || a.y > by1) continue;
          const center = { x: a.x, y: a.y - a.altitude * 0.55 };
          if (!segmentCircle({ x: b.px, y: b.py }, b, center, a.kind === 'atlas' ? 90 : 73)) continue;
          dead = true; a.hp -= b.dmg; this.sparks(b.x, b.y, '#e4c49a', 8);
          if (a.hp <= 0) this.destroyAirlift(a);
          break;
        }
        if (!dead && !groundArm) for (let j = this.airTroops.length - 1; j >= 0; j--) {
          const p = this.airTroops[j];
          if (p.x < bx0 || p.x > bx1 || p.y < by0 - 200 || p.y > by1) continue;
          const center = { x: p.x, y: p.y - p.altitude * (1 - p.progress / p.duration) };
          if (!segmentCircle({ x: b.px, y: b.py }, b, center, 13)) continue;
          dead = true; p.hp -= b.dmg;
          if (p.hp <= 0) { this.airTroops.splice(j, 1); this.score += 100; this.sparks(center.x, center.y, '#c5ad8d', 9); }
          break;
        }
        // army emplacements: suppress the crew, then take the guns
        if (!dead && !groundArm) for (const t of this.armyTurrets) {
          if (t.owner === 'player') continue;
          if (t.x < bx0 || t.x > bx1 || t.y < by0 || t.y > by1) continue;
          if (Math.hypot(b.x - t.x, b.y - t.y) < 52 + b.r) {
            dead = true;
            t.hp -= b.dmg;
            this.sparks(b.x, b.y, '#ffd166', 7);
            if (t.hp <= 0) {
              t.hp = 0;
              this.addText(t.x, t.y - 60, 'EMPLACEMENT SUPPRESSED — PRESS F', '#a9ecff', 14);
            }
            break;
          }
        }
        // military jets
        if (!dead && !groundArm) for (const j of this.armyJets) {
          if (j.state === 'parked') continue;
          if (j.x < bx0 || j.x > bx1 || j.y < by0 || j.y > by1) continue;
          if (Math.hypot(b.x - j.x, b.y - j.y) < 46 + b.r) {
            dead = true;
            j.hp -= b.dmg;
            this.sparks(b.x, b.y, '#ffd166', 8);
            if (j.hp <= 0) {
              j.state = 'parked';
              this.explode(j.x, j.y, 190, 70, true);
              this.score += 1200;
              this.addText(j.x, j.y - 70, 'JET DOWN +1200', '#ffd8a0', 17);
            }
            break;
          }
        }
        // gunships
        if (!dead && !groundArm) for (const h of this.helis) {
          if (h.x < bx0 || h.x > bx1 || h.y < by0 || h.y > by1) continue;
          if (segmentCircle({ x: b.px, y: b.py }, b, h, 44 + b.r)) {
            dead = true;
            h.hp -= b.dmg;
            this.sparks(b.x, b.y, '#ffd166', 8);
            if (h.hp <= 0) this.killHeli(h);
            break;
          }
        }
        // ground targets: skipped entirely by an air-to-air missile
        if (!airArm) {
          // enemy energy barriers block your fire too — break them
          if (!dead) for (const bar of this.barriers) {
            if (bar.x < bx0 || bar.x > bx1 || bar.y < by0 || bar.y > by1) continue;
            const rx = b.x - bar.x, ry = b.y - bar.y;
            const lx = rx * Math.cos(-bar.ang) - ry * Math.sin(-bar.ang);
            const ly = rx * Math.sin(-bar.ang) + ry * Math.cos(-bar.ang);
            if (Math.abs(lx) < bar.w / 2 && Math.abs(ly) < 12) {
              dead = true;
              bar.hp -= b.dmg;
              this.sparks(b.x, b.y, '#9fd8ff', 8);
              break;
            }
          }
          // armed mines — shoot them to clear the path
          if (!dead) for (const m of this.mines) {
            if (!m.armed || m.x < bx0 || m.x > bx1 || m.y < by0 || m.y > by1) continue;
            if (Math.hypot(b.x - m.x, b.y - m.y) < 12 + b.r) {
              dead = true;
              this.mines.splice(this.mines.indexOf(m), 1);
              this.explode(m.x, m.y, 130, 55, true);
              break;
            }
          }
          // parked / driven vans take fire too
          if (!dead) for (const v of this.vans) {
            if (v.dead || v.driving || v.reserved || v.x < bx0 || v.x > bx1 || v.y < by0 || v.y > by1) continue;
            if (Math.abs(b.x - v.x) < 48 && Math.abs(b.y - v.y) < 48) {
              dead = true; v.hp -= b.dmg; this.sparks(b.x, b.y, '#ffd166', 6);
              if (v.hp <= 0) {
                v.dead = true;
                this.explode(v.x, v.y, 150, 60, true);
                this.score += 350;
                this.addText(v.x, v.y - 40, '+350 TRANSPORT', '#ffd166', 15);
              }
              break;
            }
          }
          // a staff car on the ring road is not an armoured transport
          if (!dead) for (const c of this.roadCars) {
            if (c.dead || c.x < bx0 || c.x > bx1 || c.y < by0 || c.y > by1) continue;
            if (segmentCircle({ x: b.px, y: b.py }, b, c, 26 + b.r)) {
              dead = true;
              c.hp -= b.dmg;
              this.sparks(b.x, b.y, '#ffd166', 5);
              if (c.hp <= 0) this.wreckRoadCar(c);
              else c.panic = Math.max(c.panic, 3.2);
              break;
            }
          }
          // beam batteries can be destroyed instead of captured
          if (!dead) for (const l of this.lasers) {
            if (l.captured || l.x < bx0 || l.x > bx1 || l.y < by0 || l.y > by1) continue;
            if (Math.hypot(b.x - l.x, b.y - l.y) < 56) {
              dead = true; l.hp -= b.dmg; this.sparks(b.x, b.y, '#ff8fa3', 8);
              if (l.hp <= 0) {
                this.lasers.splice(this.lasers.indexOf(l), 1);
                this.explode(l.x, l.y, 300, 90, true);
                this.score += 4500;
                this.addText(l.x, l.y - 70, 'BEAM BATTERY DESTROYED +4500', '#ff8fa3', 20);
              }
              break;
            }
          }
          // armored convoy trucks — shoot them before they unload!
          if (!dead) for (const t of this.trucks) {
            if (t.dead || t.x < bx0 || t.x > bx1 || t.y < by0 || t.y > by1) continue;
            const a = { x: (b.px - t.x) * Math.cos(t.ang) + (b.py - t.y) * Math.sin(t.ang), y: -(b.px - t.x) * Math.sin(t.ang) + (b.py - t.y) * Math.cos(t.ang) };
            const end = { x: (b.x - t.x) * Math.cos(t.ang) + (b.y - t.y) * Math.sin(t.ang), y: -(b.x - t.x) * Math.sin(t.ang) + (b.y - t.y) * Math.cos(t.ang) };
            if (segmentBox(a, end, { x: -78, y: -33, w: 156, h: 66 }, b.r) !== null) {
              dead = true;
              t.hp -= b.dmg;
              this.sparks(b.x, b.y, '#ffd166', 8);
              if (t.hp <= 0) this.destroyTruck(t);
              break;
            }
          }
          // fuel barrels — chain-reaction hazards
          if (!dead) for (const br of this.barrels) {
            if (br.dead || br.x < bx0 || br.x > bx1 || br.y < by0 || br.y > by1) continue;
            if (Math.hypot(b.x - br.x, b.y - br.y) < 17 + b.r) {
              dead = true;
              br.hp -= b.dmg;
              this.sparks(b.x, b.y, '#ffd166', 6);
              if (br.hp <= 0) this.igniteBarrel(br);
              break;
            }
          }
          // satcom arrays — secondary command-net targets
          if (!dead) for (const s of this.satcoms) {
            if (s.dead || s.x < bx0 || s.x > bx1 || s.y < by0 || s.y > by1) continue;
            if (Math.hypot(b.x - s.x, b.y - s.y) < 34 + b.r) {
              dead = true;
              s.hp -= b.dmg * (1 + this.mods.emp);
              this.sparks(b.x, b.y, '#c9a4ff', 8);
              this.addText(s.x, s.y - 40, `${Math.round(b.dmg * (1 + this.mods.emp))}`, '#d0b0ff', 13);
              if (s.hp <= 0) this.destroySatcom(s);
              break;
            }
          }
          // servers (primary objective)
          if (!dead) for (const s of this.servers) {
            if (s.dead || s.x < bx0 || s.x > bx1 || s.y < by0 || s.y > by1) continue;
            if (Math.abs(b.x - s.x) < 40 && Math.abs(b.y - s.y) < 32) {
              dead = true;
              s.hp -= b.dmg * (1 + this.mods.emp);
              s.spark = 0.25;
              this.sparks(b.x, b.y, '#7ff0ff', 8);
              this.addText(s.x, s.y - 42, `${Math.round(b.dmg * (1 + this.mods.emp))}`, '#8fe8ff', 14);
              if (s.hp <= 0) this.destroyServer(s);
              break;
            }
          }
          if (!dead) for (const c of this.caches) {
            if (c.dead || c.x < bx0 || c.x > bx1 || c.y < by0 || c.y > by1) continue;
            if (Math.hypot(b.x - c.x, b.y - c.y) < 24 + b.r) {
              dead = true; c.hp -= b.dmg; this.sparks(b.x, b.y, '#b7ff9e', 6);
              if (c.hp <= 0) this.breakCache(c);
              break;
            }
          }
          if (!dead) for (const mc of this.megaCrates) {
            if (mc.dead || mc.x < bx0 || mc.x > bx1 || mc.y < by0 || mc.y > by1) continue;
            if (Math.abs(b.x - mc.x) < mc.w / 2 && Math.abs(b.y - mc.y) < mc.h / 2) {
              dead = true; mc.hp -= b.dmg; this.sparks(b.x, b.y, mc.color, 8);
              if (mc.hp <= 0) this.breakMegaCrate(mc);
              break;
            }
          }
          if (!dead) for (const e of this.enemies) {
            if (e.spawnT > 0 || e.hp <= 0 || e.x < bx0 || e.x > bx1 || e.y < by0 || e.y > by1) continue;
            if (b.hits && b.hits.includes(e)) continue;
            if (segmentCircle({ x: b.px, y: b.py }, b, e, e.def.r + b.r)) {
              if (b.rocket) { dead = true; break; }
              // shield-bearers block frontal fire
              let mult = 1;
              if (e.def.shield) {
                const inc = Math.atan2(b.vy, b.vx);
                const facing = Math.atan2(this.py - e.y, this.px - e.x);
                let diff = Math.abs(((inc - facing - Math.PI + Math.PI) % TAU) - Math.PI);
                if (diff > Math.PI) diff = TAU - diff;
                if (diff < 1.15) {
                  mult = 1 - e.def.shield;
                  this.sparks(b.x, b.y, '#bcd4ff', 10);
                  this.addText(e.x, e.y - e.def.r - 8, 'BLOCKED', '#9fc2ff', 12);
                }
              }
              const crit = Math.random() < this.mods.critChance;
              const dmg = (crit ? b.dmg * this.mods.critMul : b.dmg) * mult;
              this.hurtEnemy(e, dmg, b.vx, b.vy, crit);
              this.sparks(b.x, b.y, crit ? '#fff' : '#ffd7a1', crit ? 12 : 6);
              if (b.explosive) this.explode(b.x, b.y, 62 + b.explosive * 14, b.dmg * 0.45, false);
              b.hits?.push(e);
              if (b.pierce && b.pierce > 0) { b.pierce -= 1; b.dmg *= 0.82; }
              else { dead = true; break; }
            }
          }
        }
      } else if (!dead) {
        // barricades and escorts absorb hostile fire
        for (const bar of this.barricades) {
          if (bar.x < bx0 || bar.x > bx1 || bar.y < by0 || bar.y > by1) continue;
          const rx = b.x - bar.x, ry = b.y - bar.y;
          const lx = rx * Math.cos(-bar.ang) - ry * Math.sin(-bar.ang);
          const ly = rx * Math.sin(-bar.ang) + ry * Math.cos(-bar.ang);
          if (Math.abs(lx) < 80 && Math.abs(ly) < 18) {
            dead = true; bar.hp -= b.dmg; this.sparks(b.x, b.y, '#ffd166', 5); break;
          }
        }
        if (!dead) for (const a of this.allies) {
          if (a.x < bx0 || a.x > bx1 || a.y < by0 || a.y > by1) continue;
          if (Math.hypot(b.x - a.x, b.y - a.y) < 16) {
            dead = true; a.hp -= b.dmg; a.flash = 0.12; this.sparks(b.x, b.y, '#9fd8ff', 6); break;
          }
        }
        const hitRadius = this.flyingPlane ? 115 : this.playerJet ? 74 : this.piloting ? 49 : this.playerTank ? 56 : this.drivingVan ? 52 : 16;
        if (!dead && segmentCircle({ x: b.px, y: b.py }, b, { x: this.px, y: this.py }, hitRadius)) {
          dead = true; this.damagePlayer(b.dmg, b.x - b.vx * 0.12, b.y - b.vy * 0.12); this.sparks(b.x, b.y, '#ff8f8f', 8);
        }
      }
      if (dead) {
        // a Sidewinder's warhead is for aircraft: it must never rake the ground
        if (b.rocket && airArm) this.sparks(b.x, b.y, '#cfefff', 10);
        else if (b.rocket) this.explode(b.x, b.y, 150, Math.max(70, b.dmg), true);
        bl.splice(i, 1);
      }
    }
  }

  /* ---------------- objectives ---------------- */

  private damageCrate(r: Rect, dmg: number) {
    if (r.dead || r.kind !== 'crate') return;
    r.hp = (r.hp ?? 52) - dmg;
    if (r.hp > 0) return;
    r.dead = true; this.navigationDirty = true;
    const x = r.x + r.w / 2, y = r.y + r.h / 2;
    this.sparks(x, y, '#d6bd85', 14); this.score += 40;
    this.decals.push({ x, y, r: Math.max(r.w, r.h) * 0.5, a: 0.35, color: '#342b1e' });
    if (this.decals.length > 120) this.decals.shift();
    const roll = Math.random();
    if (roll < 0.34) this.dropPickup(x, y, 'aegis');
    else if (roll < 0.52) this.dropPickup(x, y, 'health');
    else if (roll < 0.66) this.dropPickup(x, y, 'grenade');
    sfx.hit();
  }

  private damageStructure(r: Rect, damage: number) {
    if (r.dead || damage <= 0) return;
    if (r.kind === 'crate') { this.damageCrate(r, damage); return; }
    r.hp = (r.hp ?? structuralHealth(r.kind)) - damage;
    if (r.hp > 0) return;
    r.dead = true; this.navigationDirty = true;
    this.ruins.push({ x: r.x, y: r.y, w: r.w, h: r.h, seed: this.ruins.length + 11, color: r.tint || '#485353' });
    if (this.ruins.length > 320) this.ruins.shift();
    const x = r.x + r.w / 2, y = r.y + r.h / 2;
    this.sparks(x, y, '#a2a895', 11);
    if (!r.facilityDetail) this.score += 35;
    for (const f of this.facilities) {
      if (r.x + r.w < f.x || r.x > f.x + f.w || r.y + r.h < f.y || r.y > f.y + f.h) continue;
      if (!r.facilityDetail) f.ruined = true;
      for (const p of f.props) {
        if (Math.abs(p.x - r.x) < 2 && Math.abs(p.y - r.y) < 2 && Math.abs(p.w - r.w) < 3 && Math.abs(p.h - r.h) < 3) p.destroyed = true;
      }
    }
    for (const h of this.hangars) if (r.x >= h.x - 2 && r.x <= h.x + h.w + 2 && r.y >= h.y - 2 && r.y <= h.y + h.h + 2 && r.kind === 'hangar') h.ruined = true;
    this.details = this.details.filter(d => distanceToBlock(d.x + d.w / 2, d.y + d.h / 2, r) > 20);
    for (const light of this.spotlights) if (distanceToBlock(light.x, light.y, r) < 28) light.online = false;
    this.facilityPainter.reset();
  }

  private destroyServer(s: Server) {
    if (s.dead) return;
    s.dead = true;
    sfx.explode();
    this.hitstop = Math.max(this.hitstop, 0.1);
    this.flash = 0.5; this.flashColor = '120,220,255';
    this.addLight(s.x, s.y, 460, '120,230,255', 0.6);
    this.shocks.push({ x: s.x, y: s.y, r: 8, max: 200, life: 0.5, t: 0.5, color: '120,230,255', width: 10 });
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU), v = rand(80, 520);
      this.addParticle(s.x, s.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.9), rand(2, 7), i % 3 ? '#7ff0ff' : '#ffffff', true);
    }
    this.decals.push({ x: s.x, y: s.y, r: 60, a: 0.45, color: '#0a2430' });
    this.explode(s.x, s.y, 150, 40, false);
    const left = this.servers.filter((v) => !v.dead).length;
    this.score += 2500;
    this.addText(s.x, s.y - 50, '+2500 MAINFRAME DOWN', '#8fe8ff', 22);
    if (left > 0) {
      this.setBanner('MAINFRAME DESTROYED', `${left} REMAINING — ENEMY AI DEGRADING`);
      this.objective = `DESTROY ${left} MAINFRAME${left > 1 ? 'S' : ''}`;
    } else {
      this.setBanner('COMMAND NET COLLAPSED', 'THE GENERAL IS EXPOSED — ELIMINATE HIM');
      this.objective = 'ELIMINATE THE GENERAL';
      sfx.gameover();
    }
  }

  private igniteBarrel(b: Barrel) {
    if (b.dead) return;
    b.dead = true;
    // delayed fuse so chains ripple instead of exploding recursively
    this.barrelFuses.push({ x: b.x, y: b.y, t: 0.05 + Math.random() * 0.1 });
  }

  private destroySatcom(s: Satcom) {
    if (s.dead) return;
    s.dead = true;
    sfx.explode();
    this.hitstop = Math.max(this.hitstop, 0.06);
    this.flash = 0.3; this.flashColor = '190,140,255';
    this.addLight(s.x, s.y, 340, '190,140,255', 0.5);
    this.shocks.push({ x: s.x, y: s.y, r: 8, max: 160, life: 0.4, t: 0.4, color: '190,140,255', width: 8 });
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU), v = rand(70, 430);
      this.addParticle(s.x, s.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.8), rand(2, 6), i % 3 ? '#c9a4ff' : '#ffffff', true);
    }
    this.decals.push({ x: s.x, y: s.y, r: 46, a: 0.42, color: '#241a38' });
    this.explode(s.x, s.y, 130, 30, false);
    this.score += 1200;
    const left = this.satcoms.filter((v) => !v.dead).length;
    this.addText(s.x, s.y - 50, '+1200 SATCOM DOWN', '#d0b0ff', 19);
    this.setBanner('SATCOM DESTROYED', `${left} ARRAYS ONLINE — ENEMY COORDINATION DEGRADING`);
    if (left <= 0) this.aiNote = 'SATNET OFFLINE — LOCAL TACTICS ONLY';
  }

  private breakCache(c: Cache) {
    if (c.dead) return;
    c.dead = true;
    sfx.explode();
    this.addLight(c.x, c.y, 220, '180,255,150', 0.35);
    this.shocks.push({ x: c.x, y: c.y, r: 6, max: 90, life: 0.3, t: 0.3, color: '180,255,150', width: 6 });
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), v = rand(80, 380);
      this.addParticle(c.x, c.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.7), rand(2, 6), i % 3 ? '#8a9a5b' : '#d7ff9e', true);
    }
    this.score += 200;
    this.addText(c.x, c.y - 24, '+200 CACHE', '#b7ff9e', 18);
    const r = Math.random();
    if (r < 0.24) this.dropPickup(c.x, c.y, 'aegis');
    else if (r < 0.4) this.dropPickup(c.x, c.y, 'health');
    else if (r < 0.52) this.dropPickup(c.x, c.y, 'grenade');
    else {
      const pool = ['shotgun', 'smg', 'dmr', 'shotgun', 'rocket', 'dmr'];
      this.dropPickup(c.x, c.y, 'weapon', pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  private breakMegaCrate(mc: MegaCrate) {
    if (mc.dead) return;
    mc.dead = true;
    sfx.explode();
    this.addLight(mc.x, mc.y, 450, mc.color, 0.75);
    this.shocks.push({ x: mc.x, y: mc.y, r: 12, max: 220, life: 0.5, t: 0.5, color: '120,240,255', width: 14 });
    for (let i = 0; i < 48; i++) {
      const a = rand(0, TAU), v = rand(90, 560);
      this.addParticle(mc.x, mc.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 0.9), rand(3, 8), i % 2 ? mc.color : '#ffffff', true);
    }
    this.decals.push({ x: mc.x, y: mc.y, r: 60, a: 0.45, color: '#172726' });
    this.score += 2500;
    this.addText(mc.x, mc.y - 50, `${mc.label} OPENED +2500`, mc.color, 18);
    this.setBanner('SPECIAL CARGO SECURED', mc.label);

    if (mc.loot === 'tesseract') {
      this.shieldMax = Math.max(this.shieldMax, 350);
      this.shieldHp = this.shieldMax;
      this.explode(mc.x, mc.y, 320, 80, true);
      this.addText(mc.x, mc.y - 75, 'TESSERACT OVERCHARGE / SHIELD 350 + EMP', '#68e7d7', 16);
      this.mods.emp += 0.5;
    } else if (mc.loot === 'gl') {
      this.dropPickup(mc.x - 30, mc.y, 'weapon', 'gl');
      this.dropPickup(mc.x + 30, mc.y, 'grenade');
      this.dropPickup(mc.x, mc.y + 30, 'grenade');
    } else if (mc.loot === 'dmr') {
      this.dropPickup(mc.x - 30, mc.y, 'weapon', 'dmr');
      this.dropPickup(mc.x + 30, mc.y, 'shield');
    } else if (mc.loot === 'aegis_matrix') {
      this.aegisCharges = Math.min(5, this.aegisCharges + 3);
      this.addText(mc.x, mc.y - 75, '+3 AEGIS INVULN CELLS / [C] TO USE', '#80d9ff', 16);
      this.dropPickup(mc.x, mc.y, 'shield');
    } else if (mc.loot === 'nanomed') {
      this.mods.maxHpBonus += 40;
      this.maxHp = 100 + this.mods.maxHpBonus;
      this.hp = this.maxHp;
      this.mods.regen += 3;
      this.addText(mc.x, mc.y - 75, 'NANO-STIM INJECTED / +40 MAX HP + REGEN', '#7dffa1', 16);
      this.dropPickup(mc.x, mc.y, 'health');
    } else if (mc.loot === 'rocket') {
      this.dropPickup(mc.x - 30, mc.y, 'weapon', 'rocket');
      this.dropPickup(mc.x + 30, mc.y, 'shield');
      this.dropPickup(mc.x, mc.y + 30, 'grenade');
    } else if (mc.loot === 'rocket_rack') {
      // The rack launcher: tube in hand, twelve warheads loaded, spare tubes on the floor.
      this.weapon = 'rocket';
      this.ammo = (this.ammo === Infinity ? 0 : this.ammo) + 12;
      this.dropPickup(mc.x - 44, mc.y + 30, 'weapon', 'rocket');
      this.dropPickup(mc.x + 44, mc.y + 30, 'grenade');
      this.dropPickup(mc.x, mc.y + 52, 'shield');
      this.addText(mc.x, mc.y - 78, 'RPG-7 RACK / 12 ROCKETS LOADED', '#ff6b3d', 16);
    } else if (mc.loot === 'rocket_ammo') {
      if (this.weapon === 'rocket') this.ammo += 8;
      else { this.weapon = 'rocket'; this.ammo = (this.ammo === Infinity ? 0 : this.ammo) + 8; }
      this.dropPickup(mc.x + 40, mc.y, 'grenade');
      this.addText(mc.x, mc.y - 78, '+8 OG-7V WARHEADS', '#ffa06b', 15);
    } else if (mc.loot === 'heavy_mg') {
      this.dropPickup(mc.x - 34, mc.y, 'weapon', 'hmg');
      this.dropPickup(mc.x + 34, mc.y, 'shield');
      this.dropPickup(mc.x, mc.y + 34, 'grenade');
      this.addText(mc.x, mc.y - 78, 'KPVT HEAVY MG / 240 BELT', '#ffd166', 16);
    } else if (mc.loot === 'shotgun') {
      this.dropPickup(mc.x - 30, mc.y, 'weapon', 'shotgun');
      this.dropPickup(mc.x + 30, mc.y, 'grenade');
      this.addText(mc.x, mc.y - 78, 'BREACHER-12 / 24 SHELLS', '#ffd27d', 15);
    } else if (mc.loot === 'smg') {
      this.dropPickup(mc.x - 30, mc.y, 'weapon', 'smg');
      this.dropPickup(mc.x + 30, mc.y, 'shield');
      this.addText(mc.x, mc.y - 78, 'VECTOR SMG / 190 ROUNDS', '#c4ff8c', 15);
    } else if (mc.loot === 'demo') {
      this.grenades = Math.min(this.mods.grenadeCap, this.grenades + 6);
      this.mods.explosive += 0.15;
      this.dropPickup(mc.x - 30, mc.y, 'grenade');
      this.dropPickup(mc.x + 30, mc.y, 'aegis');
      this.addText(mc.x, mc.y - 78, 'DEMOLITION SATCHELS / +6 FRAG + BLAST', '#f2a65a', 15);
    }
  }

  private startBaseOverride(poi: PoiState) {
    if (this.baseOverride.active || poi.captured) return;
    this.baseOverride = { active: true, poiId: poi.id, progress: 0, timer: 0 };
    this.setBanner('BASE LOCKDOWN', `${poi.name} / HOLD UPLINK TERMINAL`);
    this.objective = `DEFEND ${poi.name} TERMINAL (0%)`;
    sfx.siren();

    // Heavy MANTIS transport brings an elite fast-roping squad right onto the base courtyard!
    const compA = ['commander', 'warden', 'juggernaut', 'breacher', 'gunner', 'flamer', 'medic', 'grunt'];
    const idA = this.nextSquadId++;
    this.makeSquad(idA, compA, 'blitz', { x: poi.x, y: poi.y });
    this.launchAirlift('mantis', compA, idA, { x: poi.x + rand(-140, 140), y: poi.y + rand(-140, 140) });

    // Armored trucks race from the fortress gate
    const gates = poi.gates.length ? poi.gates : [{ x: poi.x, y: poi.y + poi.r, built: true, hp: 0 }];
    for (let i = 0; i < 4; i++) {
      const g = gates[i % gates.length];
      const compT = ['warden', 'breacher', 'grunt', 'gunner', 'flamer', 'medic'];
      const idT = this.nextSquadId++;
      this.makeSquad(idT, compT, 'phalanx', g);
      this.dispatchTruck(compT, idT, g, `override-${poi.id}`, i * 1.5);
    }

    // An attack gunship circles
    this.helis.push({
      x: HQ.cx, y: HQ.cy, tx: poi.x + rand(-240, 240), ty: poi.y + rand(-240, 240),
      ang: 0, rotor: 0, state: 'ingress',
      hp: 520 + this.sector * 30, maxHp: 520 + this.sector * 30,
      cool: rand(0.5, 1.8), rocketCd: rand(2, 4), t: 0,
      orbitA: rand(0, TAU), medevac: false, carrying: 0, announced: false, bank: 0,
    });
  }

  /* ---------------- damage ---------------- */

  private hurtEnemy(e: Enemy, dmg: number, vx = 0, vy = 0, crit = false) {
    // Shooting a man in the ranks wakes the file either side of him.
    if (e.dormant) {
      e.dormant = false; e.alert = true; e.garrison = false;
      if (this.army) {
        this.armyDormant = Math.max(0, this.armyDormant - 1);
        if (!this.armyAlerted) {
          this.armyAlerted = true; this.armyAlarm = 1; this.armyWakeT = 1.2; this.armyLaunchT = 3;
          this.setBanner('IRON RESERVE · GENERAL QUARTERS', 'THE FIRST SHOT WAKES THE WHOLE BASE');
          sfx.rotor();
        }
        let n = 0;
        for (const q of this.enemies) {
          if (!q.dormant || q === e) continue;
          if (Math.hypot(q.x - e.x, q.y - e.y) > 220) continue;
          q.dormant = false; q.alert = true; q.garrison = false;
          if (++n >= 8) break;
        }
        this.armyDormant = Math.max(0, this.armyDormant - n);
      }
    }
    if (e.hp <= 0 || this.status !== 'playing') return;
    // The general is invulnerable while any mainframe still feeds him targeting data.
    if (e.type === 'general' && this.servers.some((s) => !s.dead)) {
      this.sparks(e.x, e.y, '#ffe08a', 8);
      this.addText(e.x, e.y - 44, 'SHIELDED', '#ffd166', 15);
      return;
    }
    e.hp -= dmg;
    e.flash = 0.12;
    const kb = e.def.boss || e.type === 'general' ? 0.02 : 0.08;
    e.vx += vx * kb; e.vy += vy * kb;
    this.addText(e.x + rand(-8, 8), e.y - e.def.r - 4, crit ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`,
      crit ? '#fff2a0' : '#ffe9a8', crit ? 22 : 14);
    sfx.hit();
    if (!this.garrisonAlerted && e.garrison) this.garrisonAlerted = true;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    const idx = this.enemies.indexOf(e);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);

    // MEDEVAC: regular troops can go down wounded instead of dying outright,
    // and enemy command will try to extract them. Kill them again to confirm.
    if (!e.def.boss && !e.def.civilian && !e.garrison && this.commandOnline &&
        this.wounded.length < 6 && Math.random() < 0.3) {
      this.wounded.push({ x: e.x, y: e.y, type: e.type, t: 60, squadId: e.squadId, beingCarried: false, carrier: 0 });
      this.addText(e.x, e.y - 22, 'WOUNDED — MAN DOWN!', '#ffb0b0', 13);
      this.decals.push({ x: e.x, y: e.y, r: e.def.r * 1.2, a: 0.4, color: e.def.dark });
      for (let i = 0; i < 12; i++) {
        const a = rand(0, TAU);
        this.addParticle(e.x, e.y, Math.cos(a) * rand(40, 180), Math.sin(a) * rand(40, 180), rand(0.3, 0.6), rand(2, 4), e.def.color, true);
      }
      sfx.hit();
      // still counts partially toward the streak
      this.streak++; this.streakT = 3.6;
      this.score += Math.round(e.def.score * 0.35);
      return;
    }

    this.streak++; this.streakT = 3.6;
    this.mult = clamp(1 + Math.floor(this.streak / 4), 1, 10);
    if (this.mult > this.bestMult) this.bestMult = this.mult;

    if (this.mods.lifestealChance > 0 && Math.random() < this.mods.lifestealChance && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 6);
      this.addText(e.x, e.y - 34, '+6', '#ff86a6', 16);
    }

    const pts = Math.round(e.def.score * (e.elite ? 2 : 1) * this.mult);
    this.score += pts;
    this.addText(e.x, e.y - 20, e.elite ? `+${pts} ELITE` : `+${pts}`,
      e.elite ? '#ffd166' : '#d8e6ff', e.def.boss ? 34 : e.elite ? 22 : 18);

    const n = e.def.boss ? 90 : 18;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(60, e.def.boss ? 620 : 330);
      this.addParticle(e.x, e.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.9), rand(2, e.def.boss ? 9 : 5), i % 3 ? e.def.color : '#ffffff', true);
    }
    this.decals.push({ x: e.x, y: e.y, r: e.def.r * rand(1.1, 1.8), a: 0.5, color: e.def.dark });
    if (this.decals.length > 120) this.decals.shift();
    this.shocks.push({ x: e.x, y: e.y, r: 4, max: e.def.r * (e.def.boss ? 9 : 3.4), life: 0.35, t: 0.35, color: e.def.boss ? '255,90,120' : '255,190,190', width: e.def.boss ? 8 : 3 });
    this.addLight(e.x, e.y, e.def.boss ? 420 : 150, '255,140,110', 0.22);
    this.hitstop = e.def.boss ? 0.35 : 0.045;
    sfx.kill();

    // leadership succession — the squad promotes its best survivor
    if (e.leader) {
      const mates = this.enemies.filter((m) => m.squadId === e.squadId && !m.garrison);
      if (mates.length) {
        const rank = (t: string) => (t === 'commander' ? 6 : t === 'heavy' ? 4 : t === 'shieldman' ? 3 : t === 'sniper' ? 2 : 1);
        mates.sort((a, b) => rank(b.type) - rank(a.type));
        mates[0].leader = true;
        this.addText(mates[0].x, mates[0].y - 40, 'TAKING COMMAND', '#ffd166', 14);
      }
    }

    if (e.type === 'coder') {
      this.addText(e.x, e.y - 40, 'PROGRAMMER DOWN — AI WEAKENED', '#8fd8ff', 15);
      this.score += 400;
    }

    if (e.type === 'general') { this.onGeneralKilled(e); return; }

    if ((e.type === 'shieldman' || e.type === 'warden') && Math.random() < 0.55) this.dropPickup(e.x, e.y, 'shield');
    if (e.def.boss) {
      this.timeScale = 0.25; this.flash = 0.7; this.flashColor = '255,120,140';
      sfx.explode(); this.explode(e.x, e.y, 280, 40, false);
      this.dropPickup(e.x, e.y, 'weapon', 'rocket');
      this.dropPickup(e.x + 44, e.y, 'health');
      this.dropPickup(e.x - 44, e.y, 'grenade');
      this.dropPickup(e.x + 88, e.y - 20, 'shield');
    } else if (Math.random() < 0.2 * this.mods.magnetMul) {
      const r = Math.random();
      if (r < 0.34) this.dropPickup(e.x, e.y, 'health');
      else if (r < 0.56) this.dropPickup(e.x, e.y, 'grenade');
      else if (Math.random() < 0.18) {
        // Ammunition is a pickup in its own right, not a weapon called "ammo": handing it
        // out as a weapon crate crashed the renderer and froze the run.
        this.dropPickup(e.x, e.y, 'ammo');
      } else {
        const pool = ['shotgun', 'smg', 'smg', 'dmr', 'shotgun', 'rocket', 'gl', 'dmr', 'gl'];
        this.dropPickup(e.x, e.y, 'weapon', pool[Math.floor(Math.random() * pool.length)]);
      }
    }
  }

  private onGeneralKilled(e: Enemy) {
    this.general = null;
    this.iFrames = 10;
    this.flash = 1; this.flashColor = '255,220,140';
    this.score += 18000 + this.sector * 7000;
    this.objective = `HYDRA BASE ${this.sector}/6 DESTROYED`;
    this.setBanner('DECAPITATION STRIKE', `HYDRA COMMAND ${Math.min(this.sector, 6)}/6 ELIMINATED`);
    sfx.explode();
    for (let i = 0; i < 160; i++) {
      const a = rand(0, TAU), v = rand(60, 780);
      this.addParticle(e.x, e.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.5, 1.6), rand(2, 10), i % 3 ? '#ffe08a' : '#ffffff', true);
    }
    this.addLight(e.x, e.y, 900, '255,220,140', 1.2);
    this.explode(e.x, e.y, 420, 90, false);
    if (this.sector >= SECTORS.length) {
      // Six sectors down — and the last level is not a parade ground. HYDRA's command
      // staff is dead, but the man who ordered the arrest is behind the walls of THE CAGE.
      this.prisonFinale = true;
      this.destination = 'THE CAGE';
      this.transitT = this.transitDuration;
      this.status = 'transit';
      this.piloting = true;
      this.firing = false;
      this.playerHeli = makeHeli(e.x, e.y, -Math.PI / 2, { vx: 0, vy: -700, bank: 0.28, landed: false });
      this.setBanner('LEVEL 7 · THE CAGE', 'SIX SECTORS DOWN — ONE PRISON LEFT');
      this.onTransit(6);
      sfx.rotor();
      return;
    }

    // Force the operative into the captured aircraft for the cinematic transfer.
    this.destination = SECTORS[this.sector]?.name || 'NEXT HYDRA SECTOR';
    this.transitT = this.transitDuration;
    this.status = 'transit';
    this.piloting = true;
    this.firing = false;
    this.playerHeli = makeHeli(e.x, e.y, -Math.PI / 2, { vx: 0, vy: -700, bank: 0.28, landed: false });
    this.onTransit(this.sector + 1);
    sfx.rotor();
  }

  /** LEVEL 7: the operative is set down at the causeway and has to take THE CAGE. */
  private startPrisonLevel() {
    this.status = 'playing';
    this.piloting = false;
    this.playerHeli = null;
    this.px = 14180; this.py = 4075;
    this.pvx = 0; this.pvy = 0;
    this.hp = this.maxHp; this.iFrames = 3;
    this.prisonReentry = 0;
    this.destination = '';
    this.intermission = 1.1;
    this.objective = 'LEVEL 7 · THE CAGE — FORCE THE SALLY PORT';
    this.setBanner('LEVEL 7 · THE CAGE', 'THE LAST LEVEL IS BEHIND THESE WALLS');
    this.tellStory({
      id: 'finale-cage', channel: 'S.H.I.E.L.D. / FINAL DIRECTIVE',
      title: 'The last door in the campaign is a prison door.',
      text: 'Six command bunkers are ash. The officer who signed your arrest is behind the walls of THE CAGE, and every boat, gunship and custody officer on that island has been told you are coming. Take the sally port, find the master release and walk out of the last level alive.',
    }, 16);
    sfx.siren();
    this.startIslandLanding();
  }

  private enterNextSector() {
    const saved = {
      score: this.score, wave: this.wave, bestMult: this.bestMult,
      mods: this.mods, perks: this.perkCounts,
      weapon: this.weapon, ammo: this.ammo,
      maxHp: this.maxHp, shieldMax: this.shieldMax,
      support: this.support,
      mobility: this.mobility, camping: this.camping, avgRange: this.avgRange, coverUse: this.coverUse,
    };
    this.sector = Math.min(SECTORS.length, this.sector + 1);
    try { this.reset(false); } catch (err) { this.survive(err, 'sector-build'); }
    this.score = saved.score;
    this.wave = saved.wave;
    this.bestMult = saved.bestMult;
    this.mods = saved.mods;
    this.perkCounts = saved.perks;
    this.weapon = saved.weapon;
    this.ammo = saved.ammo;
    this.maxHp = saved.maxHp;
    this.hp = this.maxHp;
    this.shieldMax = saved.shieldMax;
    this.shieldHp = this.shieldMax;
    this.support = saved.support;
    // Hydra shares combat telemetry between bases; the next command staff already knows your habits.
    this.mobility = saved.mobility;
    this.camping = saved.camping;
    this.avgRange = saved.avgRange;
    this.coverUse = saved.coverUse;
    if (this.support === 'uplink') this.supplyCd = 14;
    this.grenades = this.mods.grenadeCap;
    this.status = 'playing';
    this.piloting = false;
    this.destination = '';
    this.intermission = 1.1;
    const theme = SECTORS[this.sector - 1];
    this.setBanner(`SECTOR ${this.sector}/6 · ${theme.name}`, `${theme.codename} — HYDRA RESISTANCE ESCALATED`);
    this.objective = `ASSAULT ${theme.name} · DESTROY 6 MAINFRAMES`;
    this.onTransit(0);
    sfx.siren();
  }

  private dropPickup(x: number, y: number, kind: Pickup['kind'], weapon?: string) {
    this.pickups.push({ kind, weapon, x, y, t: 0, life: 20 });
  }

  private explode(x: number, y: number, radius: number, dmg: number, sound: boolean, opts?: { ownBomb?: boolean; grenade?: boolean; shell?: boolean }) {
    if (sound) sfx.explode();
    this.hurtBridge(x, y, dmg, radius);
    this.hitstop = Math.max(this.hitstop, 0.06);
    this.addLight(x, y, radius * 2.4, '255,180,90', 0.45);
    this.shocks.push({ x, y, r: 8, max: radius * 1.15, life: 0.4, t: 0.4, color: '255,170,80', width: 10 });
    this.shocks.push({ x, y, r: 4, max: radius * 0.7, life: 0.25, t: 0.25, color: '255,255,220', width: 16 });
    for (let i = 0; i < 46; i++) {
      const a = rand(0, TAU), v = rand(80, 620);
      this.addParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.8), rand(3, 9),
        i % 3 === 0 ? '#fff0b8' : i % 3 === 1 ? '#ff9436' : '#6b6b6b', true);
    }
    this.decals.push({ x, y, r: radius * 0.5, a: 0.4, color: '#20160f' });
    if (this.decals.length > 120) this.decals.shift();

    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.def.r) {
        const f = 1 - d / (radius + e.def.r);
        const a = Math.atan2(e.y - y, e.x - x);
        e.vx += Math.cos(a) * 420 * f; e.vy += Math.sin(a) * 420 * f;
        e.stun = 0.18;
        this.hurtEnemy(e, dmg * (0.5 + f * 0.9));
      }
    }
    for (const s of this.servers) {
      if (s.dead) continue;
      if (Math.hypot(s.x - x, s.y - y) < radius + 30) {
        s.hp -= dmg * 1.2 * (1 + this.mods.emp); s.spark = 0.25;
        if (s.hp <= 0) this.destroyServer(s);
      }
    }
    for (const c of this.caches) {
      if (c.dead) continue;
      if (Math.hypot(c.x - x, c.y - y) < radius) { c.hp -= dmg * 0.8; if (c.hp <= 0) this.breakCache(c); }
    }
    for (const mc of this.megaCrates) {
      if (mc.dead) continue;
      if (Math.hypot(mc.x - x, mc.y - y) < radius + Math.max(mc.w, mc.h) / 2) {
        mc.hp -= dmg * 1.5;
        if (mc.hp <= 0) this.breakMegaCrate(mc);
      }
    }
    // Traffic burns. A grenade in the ring road leaves a wreck where the staff car was,
    // and the road keeps being used around it.
    for (const c of this.roadCars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > radius + 46) continue;
      c.hp -= dmg * (1.4 - Math.min(1, d / (radius + 46)));
      if (c.hp <= 0) this.wreckRoadCar(c);
      else { c.wait = Math.max(c.wait, 2.4); c.panic = Math.max(c.panic, 3.2); }
    }
    if (dmg > 0) {
      const sitesExplosion = this.campaignSites;
      if (sitesExplosion) for (const cell of sitesExplosion.powerCells) {
        if (cell.dead) continue;
        const d = Math.hypot(cell.x - x, cell.y - y);
        if (d < radius + 45) {
          cell.hp -= dmg * 2;
          if (cell.hp <= 0) {
            cell.dead = true;
            this.score += cell.kind === 'generator' ? 1400 : 900;
            this.addText(cell.x, cell.y - 50, cell.kind === 'generator' ? 'GENERATOR DOWN +1400' : 'SERVERS DARK +900', '#f2c98a', 15);
          }
        }
      }
      for (const r of this.obstacles) {
        if (r.dead) continue;
        const d = distanceToBlock(x, y, r);
        if (d < radius) this.damageStructure(r, dmg * 4.2 * (1 - d / radius * 0.65));
      }
      this.details = this.details.filter(d => distanceToBlock(x, y, d) >= radius * 0.65);
      let furnitureLost = false;
      for (const f of this.facilities) for (const p of f.props) {
        if (p.solid || p.destroyed || distanceToBlock(x, y, p) >= radius * 0.65) continue;
        p.destroyed = true; furnitureLost = true;
      }
      if (furnitureLost) this.facilityPainter.reset();
      for (const g of this.gates) if (g.hp > 0 && Math.hypot(g.x - x, g.y - y) < radius + g.span * 0.3) {
        g.hp -= dmg * 4.5;
        if (g.hp <= 0) { g.open = 1; this.navigationDirty = true; this.addText(g.x, g.y - 43, 'BLAST DOOR DESTROYED', '#d3c3a1', 12); }
      }
      for (const bar of this.barriers) if (Math.hypot(bar.x - x, bar.y - y) < radius + bar.w / 2) bar.hp -= dmg * 2;
      for (const bar of this.barricades) if (Math.hypot(bar.x - x, bar.y - y) < radius + 80) bar.hp -= dmg * 2;
      for (const l of [...this.lasers]) if (!l.captured && Math.hypot(l.x - x, l.y - y) < radius + 50) {
        l.hp -= dmg * 2;
        if (l.hp <= 0) { this.lasers.splice(this.lasers.indexOf(l), 1); this.score += 4500; this.sparks(l.x, l.y, '#fb9c88', 22); }
      }
      for (const s of [...this.satcoms]) if (!s.dead && Math.hypot(s.x - x, s.y - y) < radius + 30) { s.hp -= dmg * 1.5; if (s.hp <= 0) this.destroySatcom(s); }
      /* NO TANK FIRES AT A TANK.
       *
       * A main-gun round is not a saturation bomb, and armour is the one thing on this
       * battlefield that a tank's own gun cannot settle. Shells therefore do nothing to
       * any hull — not the battalion's, not a captured one, and not the hull that fired.
       * The only damage a tank takes is the operative's own weapons, rockets, bombs and
       * the air wing: everything that is not another main gun. */
      for (const tk of this.tanks) {
        if (tk.dead) continue;
        if (opts?.shell) continue;
        if (Math.hypot(tk.x - x, tk.y - y) < radius + 62) this.hurtTank(tk, dmg);
      }
      for (const v of this.vans) if (!v.dead && !v.reserved && !v.driving && Math.hypot(v.x - x, v.y - y) < radius + 45) {
        v.hp -= dmg * 1.5;
        if (v.hp <= 0) { v.dead = true; this.score += 350; this.sparks(v.x, v.y, '#edb57d', 17); }
      }
    }
    // A grenade under a wheel: every ground vehicle on the map skids to a stop,
    // smokes, and stays put. Tanks are the only ones that drive it off.
    if (opts?.grenade) {
      for (const t of this.trucks) {
        if (t.dead || t.disabled) continue;
        if (Math.hypot(t.x - x, t.y - y) < radius + 72) this.disableTruck(t);
      }
      for (const v of this.vans) {
        if (v.dead || v.disabled) continue;
        if (Math.hypot(v.x - x, v.y - y) < radius + 62) this.disableVan(v);
      }
    }
    // explosions crack trucks too
    for (const t of this.trucks) {
      if (t.dead) continue;
      if (Math.hypot(t.x - x, t.y - y) < radius + 60) {
        t.hp -= dmg * 1.5;
        if (t.hp <= 0) this.destroyTruck(t);
      }
    }
    // chain the fuel
    for (const br of this.barrels) {
      if (br.dead) continue;
      if (Math.hypot(br.x - x, br.y - y) < radius + 12) this.igniteBarrel(br);
    }
    const pd = Math.hypot(this.px - x, this.py - y);
    // Your own carpet bombs never hurt the bomber dropping them: the run would
    // otherwise chew through the plane's hull on every pass.
    if (pd < radius && !(opts?.ownBomb && this.flyingPlane)) {
      const f = 1 - pd / radius;
      const a = Math.atan2(this.py - y, this.px - x);
      this.pvx += Math.cos(a) * 380 * f; this.pvy += Math.sin(a) * 380 * f;
      this.damagePlayer(dmg * 0.22 * f, x, y);
    }
  }

  private updateGrenades(dt: number) {
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const g = this.nades[i];
      if (g.bomb) {
        g.t -= dt; g.z = Math.max(0, g.z - dt * 135);
        g.x += g.vx * dt; g.y += g.vy * dt;
        if (g.t <= 0) { this.nades.splice(i, 1); this.explode(g.x, g.y, 210, g.dmg, true, { ownBomb: true }); }
        continue;
      }
      g.t -= dt; g.vz -= 300 * dt;
      g.z = Math.max(0, g.z + g.vz * dt);
      if (g.z <= 0) { g.vz = Math.abs(g.vz) * 0.45; if (g.vz < 18) g.vz = 0; g.vx *= 0.72; g.vy *= 0.72; }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (this.pointBlocked(g.x, g.y)) { g.vx *= -0.6; g.vy *= -0.6; g.x += g.vx * dt * 2; g.y += g.vy * dt * 2; }
      if (Math.random() < 0.5) this.addParticle(g.x, g.y - g.z, rand(-20, 20), rand(-40, -10), 0.4, 2.4, '#b9c6c2', false);
      if (g.t <= 0) {
        this.explode(g.x, g.y, g.big ? 190 : 155, g.dmg, true, { grenade: true });
        this.nades.splice(i, 1);
      }
    }
    for (let i = this.enemyNades.length - 1; i >= 0; i--) {
      const g = this.enemyNades[i];
      g.t -= dt;
      const k = 1 - g.t / g.total;
      g.x = lerp(g.x, g.tx, dt * 3.6); g.y = lerp(g.y, g.ty, dt * 3.6);
      g.z = Math.sin(k * Math.PI) * 100;
      if (Math.random() < 0.5) this.addParticle(g.x, g.y - g.z, rand(-14, 14), rand(-30, -8), 0.35, 2, '#c1cfc9', false);
      if (g.t <= 0) { this.explode(g.x, g.y, g.radius ?? 145, g.dmg ?? 64, true, { shell: !!g.shell }); this.enemyNades.splice(i, 1); }
    }
    // fuel barrel chains ripple outward one fuse at a time
    for (let i = this.barrelFuses.length - 1; i >= 0; i--) {
      const f = this.barrelFuses[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.barrelFuses.splice(i, 1);
        this.explode(f.x, f.y, 165, 92, true);
        this.decals.push({ x: f.x, y: f.y, r: 30, a: 0.4, color: '#2b1a08' });
        if (this.decals.length > 120) this.decals.shift();
      }
    }
  }

  /** Sappers plant mines; armed mines detonate on contact or stray bullets. */
  private updateMines(dt: number) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (!m.armed) {
        m.t -= dt;
        if (m.t <= 0) m.armed = true;
      }
      // player steps on it
      if (m.armed && Math.hypot(m.x - this.px, m.y - this.py) < 24) {
        this.mines.splice(i, 1);
        this.explode(m.x, m.y, 130, 55, true);
        continue;
      }
      // expiry
      m.t -= dt;
      if (m.t < -30) this.mines.splice(i, 1);
    }
  }

  private updatePickups(dt: number) {
    // A crate whose payload cannot be resolved is dropped on the spot: nothing invalid is
    // allowed to survive into a draw call, where it would take the whole frame down.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const q = this.pickups[i];
      if (q.kind === 'weapon' && !WEAPONS[q.weapon || '']) this.pickups.splice(i, 1);
      else if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) this.pickups.splice(i, 1);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt; p.life -= dt;
      const d = Math.hypot(p.x - this.px, p.y - this.py) || 1;
      const mag = 130 * this.mods.magnetMul;
      if (d < mag) {
        const k = (1 - d / mag) * 340 * dt;
        p.x += ((this.px - p.x) / d) * k; p.y += ((this.py - p.y) / d) * k;
      }
      if (d < 26) {
        this.pickups.splice(i, 1);
        sfx.pickup();
        this.flash = 0.15; this.flashColor = '150,255,200';
        if (p.kind === 'aegis') { this.aegisCharges = Math.min(5, this.aegisCharges + 1); this.addText(this.px, this.py - 44, 'AEGIS CELL / C TO DEPLOY', '#9feaff', 16); }
        else if (p.kind === 'health') { this.hp = Math.min(this.maxHp, this.hp + 32); this.addText(this.px, this.py - 34, '+32 HP', '#7dffa1', 20); }
        else if (p.kind === 'shield') {
          this.shieldMax = Math.max(this.shieldMax, 120);
          this.shieldHp = Math.min(this.shieldMax, this.shieldHp + 120);
          this.addText(this.px, this.py - 34, 'RIOT SHIELD +120', '#7fd8ff', 18);
          for (let i2 = 0; i2 < 16; i2++) {
            const a = rand(0, TAU);
            this.addParticle(this.px, this.py, Math.cos(a) * rand(60, 220), Math.sin(a) * rand(60, 220), rand(0.25, 0.5), rand(2, 4), '#7fd8ff', true);
          }
        }
        else if (p.kind === 'grenade') { this.grenades = Math.min(this.mods.grenadeCap, this.grenades + 2); this.addText(this.px, this.py - 34, '+2 FRAG', '#9ad8ff', 20); }
        else if (p.kind === 'ammo') {
          // A resupply can fills every tube the operative is carrying, the one in their
          // hands included. This is what makes carrying five weapons a plan, not a chore.
          let given = 0;
          for (const [id, def] of Object.entries(WEAPONS)) {
            if (def.ammo === Infinity) continue;
            if (id === this.weapon) {
              const add = Math.ceil(def.ammo * 0.6);
              this.ammo = Math.min(def.ammo * 2, this.ammo + add);
              given += add;
            } else if (this.weaponAmmo.has(id) || id === 'pistol') {
              const add = Math.ceil(def.ammo * 0.6);
              this.weaponAmmo.set(id, (this.weaponAmmo.get(id) ?? 0) + add);
              given += add;
            }
          }
          this.addText(this.px, this.py - 34, `RESUPPLY +${given} ROUNDS`, '#ffd166', 18);
        }
        else {
          const w = p.weapon!;
          // Bank what we are holding, then ADD the crate's load to whatever this weapon still
          // had stored. The old code took the larger of the two, which deleted the spare pile
          // every time the same weapon was picked up a second time.
          if (this.weapon === w) {
            this.ammo = WEAPONS[w].ammo === Infinity ? Infinity : this.ammo + WEAPONS[w].ammo;
          } else {
            if (this.ammo !== Infinity) this.weaponAmmo.set(this.weapon, this.ammo);
            const fresh = WEAPONS[w].ammo;
            const stored = this.weaponAmmo.get(w) ?? 0;
            this.weapon = w;
            this.ammo = fresh === Infinity ? Infinity : fresh + stored;
          }
          this.weaponAmmo.delete(w);
          this.addText(this.px, this.py - 34,
            WEAPONS[w].ammo === Infinity ? WEAPONS[w].name : `${WEAPONS[w].name} / ${Math.floor(this.ammo)} ROUNDS`,
            WEAPONS[w].color, 20);
        }
        continue;
      }
      if (p.life <= 0) this.pickups.splice(i, 1);
    }
  }

  damagePlayer(dmg: number, sx: number, sy: number) {
    if (this.iFrames > 0 || this.status !== 'playing') return;
    const sourceAngle = Math.atan2(sy - this.py, sx - this.px);
    const difference = Math.abs(Math.atan2(Math.sin(sourceAngle - this.pang), Math.cos(sourceAngle - this.pang)));
    if (this.aegisTime > 0 && difference < 1.18) {
      this.sparks(this.px + Math.cos(this.pang) * 43, this.py + Math.sin(this.pang) * 43, '#b1f5ff', 5);
      return;
    }
    // Flying a fast jet, the airframe eats the fire; the pilot only dies when it does.
    if (this.playerJet) {
      // A fighter is mostly engine and armour: it eats half of what reaches it, which is
      // what makes a long turning fight survivable for a pilot who uses the flares.
      const j = this.playerJet;
      // Flares buy a break turn as well as spoofing missiles: for the couple of seconds
      // they burn, the airframe takes a third less.
      const breakFactor = this.jetFlareT > 0 ? 0.34 : 0.5;
      j.hp = Math.max(0, j.hp - dmg * breakFactor);
      this.devKeep(j);
      this.sparks(j.x, j.y, '#cfe8ff', 7);
      this.flash = Math.max(this.flash, 0.12); this.flashColor = '200,235,255';
      sfx.hit();
      if (j.hp <= 0) this.addText(j.x, j.y - 80, 'AIRFRAME FAILING', '#ff9d9d', 15);
      return;
    }
    if (this.flyingPlane && this.plane) {
      this.plane.hp = Math.max(0, this.plane.hp - dmg);
      this.devKeep(this.plane);
      this.sparks(this.plane.x, this.plane.y, '#ffbe82', 8);
      if (this.plane.hp <= 0) {
        const x = this.plane.x, y = this.plane.y;
        this.flyingPlane = false; this.plane = null;
        this.hp = Math.max(1, this.hp - 55); this.iFrames = 2;
        this.explode(x, y, 235, 50, true);
        const safe = this.routes.nearest({ x, y }); this.px = safe.x; this.py = safe.y;
        this.setBanner('NIGHTJAR LOST', 'EMERGENCY EJECTION / CONTINUE ON FOOT');
      }
      return;
    }
    // The captured tank eats the hit — armour takes only a fraction of it.
    if (this.playerTank) {
      const t = this.playerTank;
      t.hp = Math.max(0, t.hp - dmg * 0.35);
      this.devKeep(t);
      this.sparks(t.x, t.y, '#ffd166', 9);
      if (t.hp <= 0) {
        this.playerTank = null;
        const x = t.x, y = t.y;
        t.dead = true;
        this.explode(x, y, 240, 0, true);
        this.addText(x, y - 96, 'TANK DESTROYED', '#ff8f7a', 18);
        this.hp = Math.max(1, this.hp - 45); this.iFrames = 1.5;
        const safe = this.routes.nearest({ x, y }); this.px = safe.x; this.py = safe.y;
        this.setBanner('TANK LOST', 'CREW SURVIVED — CONTINUE ON FOOT');
      }
      return;
    }
    if (this.drivingBoat) {
      const b = this.drivingBoat;
      b.hp = Math.max(0, b.hp - dmg);
      this.devKeep(b);
      this.sparks(b.x, b.y, '#9fe6ef', 6);
      if (b.hp <= 0) { this.sinkBoat(b); }
      return;
    }
    if (this.drivingVan) {
      const v = this.drivingVan; v.hp = Math.max(0, v.hp - dmg);
      this.devKeep(v);
      if (v.hp <= 0) {
        v.dead = true; v.driving = false; this.drivingVan = null;
        this.hp = Math.max(1, this.hp - 35); this.iFrames = 1.5;
        this.px = v.x - Math.sin(v.ang) * 95; this.py = v.y + Math.cos(v.ang) * 95;
        this.explode(v.x, v.y, 130, 35, true);
        this.addText(this.px, this.py - 40, 'TRANSPORT LOST', '#ffaf91', 16);
      }
      return;
    }
    // While flying, the armored gunship takes the hit before the pilot.
    if (this.piloting && this.playerHeli) {
      const h = this.playerHeli;
      h.hp -= dmg;
      this.devKeep(h);
      this.sparks(h.x, h.y, '#8be8ff', 8);
      if (h.hp <= 0) {
        const crashX = h.x, crashY = h.y;
        this.playerHeli = null;
        this.piloting = false;
        this.px = crashX; this.py = crashY;
        this.hp = Math.max(1, this.hp - 48);
        this.iFrames = 1;
        this.explode(crashX, crashY, 230, 70, true);
        this.setBanner('GUNSHIP LOST', 'PILOT SURVIVED — CONTINUE ON FOOT');
      }
      return;
    }
    // BALLISTIC SHIELD — intercepts frontal fire inside a 130° arc
    if (this.shieldHp > 0 && dmg > 1) {
      const diff = difference;
      if (diff < 1.15) {
        this.shieldHp -= dmg;
        this.sparks(this.px + Math.cos(this.pang) * 28, this.py + Math.sin(this.pang) * 28, '#7fd8ff', 8);
        if (Math.random() < 0.5) this.addText(this.px, this.py - 32, 'BLOCKED', '#9fd8ff', 12);
        sfx.hit();
        if (this.shieldHp <= 0) {
          this.shieldHp = 0;
          this.flash = 0.28; this.flashColor = '120,200,255';
          const a = this.pang;
          for (let i = 0; i < 22; i++) {
            const sa = a + rand(-1, 1);
            this.addParticle(this.px + Math.cos(a) * 22, this.py + Math.sin(a) * 22,
              Math.cos(sa) * rand(120, 380), Math.sin(sa) * rand(120, 380), rand(0.3, 0.7), rand(2, 5), '#9fd8ff', true);
          }
          this.addText(this.px, this.py - 50, 'SHIELD DOWN', '#9fd8ff', 17);
          sfx.explode();
        }
        return;
      }
    }
    this.hp -= dmg;
    if (dmg > 3) {
      this.iFrames = 0.25;
      this.flash = 0.35; this.flashColor = '255,60,60';
      sfx.hurt();
      const a = Math.atan2(this.py - sy, this.px - sx);
      for (let i = 0; i < 14; i++)
        this.addParticle(this.px, this.py, Math.cos(a + rand(-1, 1)) * rand(80, 260), Math.sin(a + rand(-1, 1)) * rand(80, 260), rand(0.25, 0.6), rand(2, 5), '#ff5d6c', true);
    } else { this.flash = Math.max(this.flash, 0.12); this.flashColor = '255,80,80'; }
    // DEV CONSOLE · INFINITE LIVES. He still takes every hit and the bar still falls — it
    // just stops one point above the floor, so nothing in the world can end the run.
    if (this.hp <= 0 && this.devInfiniteLives) this.hp = 1;
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.hp = 0; this.status = 'over'; this.mult = this.bestMult; this.firing = false;
    this.timeScale = 0.25; this.flash = 0.9; this.flashColor = '255,90,90';
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU), v = rand(60, 520);
      this.addParticle(this.px, this.py, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 1.2), rand(2, 7), i % 2 ? '#7fe9ff' : '#ff5d6c', true);
    }
    sfx.gameover(); this.pushHud();
    this.onOver(Math.floor(this.score), this.wave);
  }

  /* ---------------- upgrades ---------------- */

  private offerUpgrade() {
    const pool = PERKS.filter((p) => (this.perkCounts[p.id] || 0) < p.max);
    const weight = (r: Perk['rarity']) => (r === 'common' ? 1 : r === 'rare' ? 0.55 : 0.3);
    const picks: Perk[] = [];
    const bag = [...pool];
    while (picks.length < 3 && bag.length) {
      let total = 0; for (const p of bag) total += weight(p.rarity);
      let roll = Math.random() * total, idx = 0;
      for (let i = 0; i < bag.length; i++) { roll -= weight(bag[i].rarity); if (roll <= 0) { idx = i; break; } }
      picks.push(bag.splice(idx, 1)[0]);
    }
    this.upgradeChoices = picks;
    this.status = 'upgrade';
    this.onUpgrade(picks);
  }

  getBuild(): { perk: Perk; count: number }[] {
    return PERKS.filter((p) => this.perkCounts[p.id]).map((p) => ({ perk: p, count: this.perkCounts[p.id] }));
  }

  chooseUpgrade(id: string) {
    const perk = this.upgradeChoices.find((p) => p.id === id);
    if (!perk) return;
    perk.apply(this);
    this.perkCounts[id] = (this.perkCounts[id] || 0) + 1;
    this.upgradeChoices = [];
    this.status = 'playing';
    this.intermission = 1.1;
    this.flash = 0.3; this.flashColor = '150,255,200';
    this.addLight(this.px, this.py, 320, '120,255,200', 0.4);
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU), v = rand(60, 260);
      this.addParticle(this.px, this.py, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.7), rand(2, 5), '#7dffcf', true);
    }
    sfx.pickup();
    this.setBanner('LOADOUT UPGRADED', perk.name);
  }

  /* ---------------- fx helpers ---------------- */

  addParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, glow: boolean, grav = 0) {
    if (this.parts.length > 900) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, grav, glow });
  }
  addLight(x: number, y: number, r: number, color: string, life: number) {
    if (this.lights.length > 60) return;
    this.lights.push({ x, y, r, color, life, max: life });
  }
  private sparks(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(50, 260);
      this.addParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.12, 0.35), rand(1.5, 3.5), color, true);
    }
  }
  private addText(x: number, y: number, text: string, color: string, size: number) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, vy: -46, life: 0.9, max: 0.9, text, color, size });
  }

  private updateParticles(dt: number) {
    const p = this.parts;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.life -= dt;
      if (q.life <= 0) { p.splice(i, 1); continue; }
      const d = Math.pow(0.02, dt);
      q.vx *= d; q.vy *= d; q.vy += q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
  }

  private updateFx(dt: number) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.05, dt);
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.t -= dt;
      if (s.t <= 0) { this.shocks.splice(i, 1); continue; }
      s.r = s.max * (1 - Math.pow(1 - (1 - s.t / s.life), 3));
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      this.lights[i].life -= dt;
      if (this.lights[i].life <= 0) this.lights.splice(i, 1);
    }
    for (const s of this.servers) if (s.spark > 0) s.spark -= dt;
    if (this.flash > 0) this.flash -= dt * 2.2;
  }

  private updateCamera(dt: number) {
    let tx = this.px - this.w / 2, ty = this.py - this.h / 2;
    if (!this.isTouch) {
      tx += Math.cos(this.pang) * Math.min(120, this.w * 0.08);
      ty += Math.sin(this.pang) * Math.min(120, this.h * 0.08);
    }
    const k = 1 - Math.pow(0.0006, dt);
    this.camX = clamp(lerp(this.camX, tx, k), 0, Math.max(0, ARENA_W - this.w));
    this.camY = clamp(lerp(this.camY, ty, k), 0, Math.max(0, ARENA_H - this.h));
  }

  /* ================================================================ */
  /* RENDER — layered, lit, 2.5D                                      */
  /* ================================================================ */

  private render() {
    const ctx = this.ctx;
    if (this.status === 'transit') {
      this.renderTransit(ctx);
      return;
    }
    if (this.status === 'arrest') {
      this.renderArrest(ctx);
      return;
    }
    /* ---- PERSPECTIVE ----
     * Flying a jet, the operative can pull the camera back to a tactical view or push it
     * right up to the airframe. The world pass is drawn into a window that is wider than
     * the canvas by exactly the zoom factor, so culling, drawing and lighting all agree
     * about what is on screen; the HUD is drawn afterwards at real size.
     */
    const jetCam = this.jetCamera();
    const zoom = jetCam.zoom;
    const realW = this.w, realH = this.h;
    const prevCamX = this.camX, prevCamY = this.camY;
    let camX = this.camX, camY = this.camY;
    if (jetCam.active) {
      this.w = realW / zoom; this.h = realH / zoom;
      camX = jetCam.x; camY = jetCam.y;
      this.camX = camX; this.camY = camY;
    }

    ctx.save();
    ctx.fillStyle = '#080d0c';
    ctx.fillRect(0, 0, realW, realH);
    if (jetCam.active && zoom !== 1) ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    this.drawGround(ctx, camX, camY);
    this.drawLandmass(ctx, camX, camY);
    this.drawSnowCover(ctx, camX, camY);
    this.drawZones(ctx, camX, camY);
    this.drawSuspensionBridge(ctx, camX, camY);
    this.drawSnowWorks(ctx, camX, camY);
    this.drawPowerLines(ctx, camX, camY);
    this.drawTrafficAndRoutines(ctx, camX, camY);
    this.facilityPainter.drawGround(ctx, this.facilities, { x: camX, y: camY, w: this.w, h: this.h }, this.simulationTime);
    drawRuins(ctx, this.ruins, { x: camX, y: camY, w: this.w, h: this.h });
    this.drawDecals(ctx, camX, camY);
    this.drawHQFloor(ctx, camX, camY);
    this.drawStructures(ctx, camX, camY);
    this.drawBirds(ctx, camX, camY);
    this.drawPrisonDecor(ctx, camX, camY);
    drawDetails(ctx, this.details, { x: camX, y: camY, w: this.w, h: this.h }, this.simulationTime);
    this.drawBarrels(ctx, camX, camY);
    this.drawSatcoms(ctx, camX, camY);
    this.drawServers(ctx, camX, camY);
    this.drawCaches(ctx, camX, camY);
    this.drawSquadLinks(ctx);
    this.drawPickups(ctx);
    this.drawMarks(ctx);
    this.drawEnemies(ctx, camX, camY);
    if (this.support === 'drone' && !this.piloting) this.drawSupportDrone(ctx);
    // While the take-off chain is running the operative is either walking to the aircraft
    // (drawn) or already inside it (not drawn) — never a figure standing on the wing.
    const launchHidden = !!this.launch && this.launch.phase !== 'walk';
    if (this.status !== 'over' && !this.piloting && !this.flyingPlane && !this.drivingVan
      && !this.playerTank && !this.playerJet && !launchHidden) this.drawPlayer(ctx);
    this.drawArmyWorks(ctx, camX, camY);
    this.drawArmyLamps(ctx, camX, camY);
    if (this.playerHeli) this.drawPlayerHeli(ctx, camX, camY);
    this.drawTanks(ctx, camX, camY);
    this.drawVans(ctx, camX, camY);
    this.drawBoats(ctx, camX, camY);
    this.drawArmyAircraft(ctx, camX, camY);
    this.drawLasers(ctx, camX, camY);
    this.drawAllies(ctx);
    this.drawPlane(ctx);
    this.drawHangarAircraft(ctx);
    this.drawHelis(ctx, true);
    this.drawHangars(ctx, camX, camY);
    this.facilityPainter.drawRoofs(ctx, this.facilities, { x: camX, y: camY, w: this.w, h: this.h }, this.simulationTime);
    this.drawStrategicSites(ctx);
    this.drawPrisonIsland(ctx);
    this.drawPowerComplex(ctx);
    for (const g of this.gates) {
      if (g.x < camX - 200 || g.x > camX + this.w + 200 || g.y < camY - 150 || g.y > camY + this.h + 150) continue;
      drawGate(ctx, g, this.simulationTime, Math.hypot(g.x - this.px, g.y - this.py) < 180);
    }
    this.drawBarricades(ctx);
    this.drawVault(ctx);
    this.drawSupply(ctx);
    this.drawBarriers(ctx);
    this.drawWounded(ctx, camX, camY);
    this.drawVTOLs(ctx);
    this.drawHelis(ctx);
    this.drawAirlifts(ctx);
    drawAirborne(ctx, this.airTroops, { x: camX, y: camY, w: this.w, h: this.h });
    this.drawTrucks(ctx, camX, camY);
    this.drawMines(ctx, camX, camY);
    this.drawGrenades(ctx);
    this.drawBullets(ctx);
    this.drawHeliOrdnance(ctx);
    this.drawParticles(ctx);
    this.drawShocks(ctx);
    this.drawTexts(ctx);
    if (this.aegisTime > 0) {
      ctx.save(); ctx.translate(this.px, this.py); ctx.rotate(this.pang);
      const r = this.flyingPlane ? 135 : this.piloting || this.drivingVan ? 82 : 49;
      ctx.strokeStyle = '#c3f8ff'; ctx.lineWidth = 4;
      ctx.shadowColor = '#53d4ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, r, -1.17, 1.17); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#72e1ff77'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(0, 0, r - 5, -1.17, 1.17); ctx.stroke();
      ctx.strokeStyle = '#a4f1ff99'; ctx.lineWidth = 1;
      for (let a = -1.1; a < 1.1; a += 0.18) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 10), Math.sin(a) * (r - 10)); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
      ctx.restore();
    }
    // BLACKOUT: helmet lamps cut cones through the dark toward the player's bearing
    if (this.blackout.active) {
      ctx.save();
      for (const e of this.enemies) {
        if (e.def.civilian || e.spawnT > 0 || e.hp <= 0) continue;
        const dx = e.x - camX, dy = e.y - camY;
        if (dx < -80 || dy < -80 || dx > this.w + 80 || dy > this.h + 80) continue;
        ctx.save();
        ctx.translate(dx, dy); ctx.rotate(e.ang);
        const g = ctx.createLinearGradient(0, 0, 260, 0);
        g.addColorStop(0, 'rgba(255,238,180,0.24)');
        g.addColorStop(0.72, 'rgba(255,238,180,0.05)');
        g.addColorStop(1, 'rgba(255,238,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.arc(0, 0, 260, -0.32, 0.32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff2c0';
        ctx.beginPath(); ctx.arc(9, 0, 2.6, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
    if (jetCam.active) {
      this.w = realW; this.h = realH;
      this.camX = prevCamX; this.camY = prevCamY;
    }

    this.drawScreenFx(ctx);
    this.drawLighting(ctx, camX, camY);
    this.drawBlackoutLamps(ctx, camX, camY);
    this.drawWeather(ctx);
    if (this.playerJet) this.drawJetOverlay(ctx);
    if (this.launch) this.drawLaunchHud(ctx);
    if (this.ditching) this.drawRecallHud(ctx);
    if (this.status === 'playing' || this.status === 'paused' || this.status === 'upgrade') {
      this.drawThreatArrows(ctx, this.camX, this.camY);
      this.drawBossBar(ctx);
      this.drawMinimap(ctx);
    }
    if (this.isTouch && this.status === 'playing') this.drawSticks(ctx);
    this.drawReticle(ctx);
    if (this.tutorial) this.drawTutorial(ctx);
  }

  /** In-game crosshair. The old build relied on the OS cursor, which pointer lock
   *  hides — so the moment the mouse was captured the player was aiming blind. */
  private drawReticle(ctx: CanvasRenderingContext2D) {
    if (this.isTouch || this.status !== 'playing') return;
    const x = this.mouseX, y = this.mouseY;
    const color = this.firing ? '255,186,120' : '150,240,255';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Aim ray: makes the firing direction readable across the whole screen.
    if (this.pointerLocked) {
      const sx = this.px - this.camX, sy = this.py - this.camY;
      const gradient = ctx.createLinearGradient(sx, sy, x, y);
      gradient.addColorStop(0, `rgba(${color},0)`);
      gradient.addColorStop(0.55, `rgba(${color},0.08)`);
      gradient.addColorStop(1, `rgba(${color},0.22)`);
      ctx.strokeStyle = gradient; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke();
    }
    const r = 9 + this.reticlePulse * 3;
    ctx.strokeStyle = `rgba(${color},0.95)`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${color},0.45)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r + 5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${color},0.8)`; ctx.lineWidth = 1.4;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x + d[0] * (r + 2), y + d[1] * (r + 2));
      ctx.lineTo(x + d[0] * (r + 10), y + d[1] * (r + 10));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${color},0.95)`;
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.globalCompositeOperation = 'source-over';
    if (!this.pointerLocked && this.lockGrace > 0) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.lockGrace);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#9fe8ff';
      ctx.fillText('CLICK TO CAPTURE MOUSE', this.w / 2, this.h * 0.14);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#7fb6c4';
      ctx.fillText('FREE CURSOR MODE RUNNING — ESC PAUSES', this.w / 2, this.h * 0.14 + 18);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  /** Full-screen inter-sector flight: the captured gunship carries the operative deeper into Hydra territory. */
  private drawAirlifts(ctx: CanvasRenderingContext2D) {
    for (const a of this.airTransports) {
      if (a.x < this.camX - 320 || a.x > this.camX + this.w + 320 || a.y < this.camY - 320 || a.y > this.camY + this.h + 320) continue;
      if (a.kind === 'atlas') drawFixedWing(ctx, { ...a, bomber: false, friendly: false, active: a.state !== 'land' }, this.simulationTime);
      else drawMantis(ctx, a, this.simulationTime);
      if (a.state === 'drop' && a.kind === 'mantis') {
        ctx.save(); ctx.strokeStyle = '#c3bf9daa'; ctx.lineWidth = 1.5;
        for (const side of [-1, 1]) {
          const x = a.x - Math.sin(a.ang) * side * 38, y = a.y + Math.cos(a.ang) * side * 38;
          ctx.beginPath(); ctx.moveTo(x, y - a.altitude * 0.55); ctx.lineTo(x, y + 8); ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = '#d2bc99'; ctx.textAlign = 'center'; ctx.font = '10px monospace';
      ctx.fillText(`${a.kind.toUpperCase()} / ${a.state.toUpperCase()} / ${a.comp.length - a.slot} ABOARD`, a.x, a.y - a.altitude * 0.55 - 115);
      ctx.fillStyle = '#10252e'; ctx.fillRect(a.x - 48, a.y - a.altitude * 0.55 - 104, 96, 4);
      ctx.fillStyle = '#e0ad7a'; ctx.fillRect(a.x - 48, a.y - a.altitude * 0.55 - 104, 96 * Math.max(0, a.hp / a.maxHp), 4);
      ctx.textAlign = 'left';
    }
  }

  /** The Cage: a landmark label on the island so the prison is findable on foot. */
  private drawPrisonIsland(ctx: CanvasRenderingContext2D) {
    const dist = Math.hypot(ISLAND.x - (this.camX + this.w / 2), ISLAND.y - (this.camY + this.h / 2));
    if (dist > Math.max(this.w, this.h) * 1.3) return;
    ctx.save();
    const near = Math.hypot(this.px - PRISON_DOOR.x, this.py - PRISON_DOOR.y) < 900;
    ctx.textAlign = 'center';
    const titleY = ISLAND.y - 1700;   // over open water, clear of the north shore
    ctx.fillStyle = `rgba(214,226,222,${near ? 0.62 : 0.38})`;
    ctx.font = 'bold 46px ui-monospace, monospace';
    ctx.fillText('I S L A N D   P R I S O N', ISLAND.x, titleY);
    ctx.strokeStyle = `rgba(216,180,90,${near ? 0.5 : 0.26})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ISLAND.x - 250, titleY + 18); ctx.lineTo(ISLAND.x + 250, titleY + 18); ctx.stroke();
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = `rgba(150,180,186,${near ? 0.5 : 0.28})`;
    ctx.fillText('THE CAGE · HYDRA CORRECTIONAL FACILITY', ISLAND.x, titleY + 38);
    // The crossing itself, so the way in is obvious from the mainland side.
    ctx.strokeStyle = 'rgba(216,180,90,0.22)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BRIDGE.x, BRIDGE.y + BRIDGE.h / 2);
    ctx.lineTo(BRIDGE.x + BRIDGE.w, BRIDGE.y + BRIDGE.h / 2);
    ctx.stroke();
    if (near) {
      ctx.fillStyle = 'rgba(216,180,90,0.45)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(this.bridgeDown ? 'CROSSING SEVERED · NO ROUTE TO THE ISLAND' : 'SUSPENSION CROSSING · 1.5 km',
        BRIDGE.x + BRIDGE.w / 2, BRIDGE.y - 400);
      ctx.fillStyle = 'rgba(216,180,90,0.5)';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('SALLY PORT · CROSS THE BRIDGE', PRISON_DOOR.x - 330, PRISON_DOOR.y - 250);
      ctx.fillText('STEP INTO THE GATE TO ENTER', PRISON_DOOR.x - 330, PRISON_DOOR.y - 234);
      ctx.strokeStyle = 'rgba(216,180,90,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PRISON_DOOR.x - 200, PRISON_DOOR.y - 214); ctx.lineTo(PRISON_DOOR.x - 40, PRISON_DOOR.y - 30); ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /**
   * THE GLACIER GATE, seen from the ground.
   *
   * A door in a mountain has to announce itself: a cold pool of light spilling out of the
   * forecourt, a lit lintel over the bulkhead, and the words on the ice. Without this the
   * entrance was a gap between two white blocks with nothing to aim at.
   */
  private drawGlacierGateBeacon(ctx: CanvasRenderingContext2D) {
    const spot = this.glacierSpot;
    if (!spot) return;
    const dx = spot.x - (this.camX + this.w / 2), dy = spot.y - (this.camY + this.h / 2);
    if (Math.abs(dx) > this.w * 0.75 || Math.abs(dy) > this.h * 0.75) return;
    const pulse = 0.55 + Math.sin(this.simulationTime * 1.7) * 0.25;
    ctx.save();
    ctx.translate(spot.x, spot.y);
    // light on the apron
    const g = ctx.createRadialGradient(0, 40, 10, 0, 40, 300);
    g.addColorStop(0, `rgba(155,232,255,${0.3 * pulse})`);
    g.addColorStop(1, 'rgba(155,232,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 40, 300, 220, 0, 0, TAU); ctx.fill();
    // the lintel lamp over the bulkhead
    const lit = this.glacierVisits ? 'rgba(160,214,232,0.7)' : `rgba(190,246,255,${0.55 + pulse * 0.4})`;
    ctx.fillStyle = lit;
    ctx.fillRect(-90, -272, 180, 7);
    ctx.beginPath(); ctx.moveTo(-90, -265); ctx.lineTo(90, -265); ctx.lineTo(60, -215); ctx.lineTo(-60, -215); ctx.closePath();
    const beam = ctx.createLinearGradient(0, -265, 0, -150);
    beam.addColorStop(0, this.glacierVisits ? 'rgba(150,200,220,0.16)' : `rgba(170,240,255,${0.3 * pulse})`);
    beam.addColorStop(1, 'rgba(170,240,255,0)');
    ctx.fillStyle = beam; ctx.fill();
    // stencilled on the ice
    ctx.fillStyle = this.glacierVisits ? 'rgba(180,214,226,0.75)' : 'rgba(215,248,255,0.92)';
    ctx.font = 'bold 13px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.glacierVisits ? 'GLACIER VAULT / OPEN' : 'GLACIER VAULT / ENTRY', 0, -300);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(170,220,235,0.7)';
    ctx.fillText(this.glacierVisits ? '[F] GO BACK INSIDE' : '[F] OPEN THE GATE', 0, 128);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private drawStrategicSites(ctx: CanvasRenderingContext2D) {
    this.drawGlacierGateBeacon(ctx);
    const sites = this.campaignSites;
    if (!sites) return;
    const d = sites.warehouse;
    if (distanceToBlock(this.camX + this.w / 2, this.camY + this.h / 2, d) < Math.max(this.w, this.h)) {
      ctx.save(); ctx.fillStyle = '#bdbba568'; ctx.textAlign = 'center'; ctx.font = 'bold 42px monospace';
      ctx.fillText('GOLIATH', GOLIATH.x, GOLIATH.y + 12);
      ctx.font = '12px monospace'; ctx.fillStyle = '#a2afa777'; ctx.fillText('HYDRA STRATEGIC LOGISTICS / RECEIVING & DISPATCH', GOLIATH.x, GOLIATH.y + 38);
      // Overhead loading gantries travel slowly across their rails.
      for (const side of [-1, 1]) {
        const x = GOLIATH.x, y = GOLIATH.y + side * 417;
        ctx.fillStyle = '#121f27'; ctx.fillRect(x - 620, y - 20, 1240, 15);
        ctx.fillStyle = '#79664b'; ctx.fillRect(x - 620, y - 29, 1240, 10);
        ctx.strokeStyle = '#c6b88b'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 610, y - 25); ctx.lineTo(x + 610, y - 25); ctx.stroke();
        const carriage = x + Math.sin(this.simulationTime * 0.18 + side) * 470;
        ctx.fillStyle = '#c1a067'; ctx.fillRect(carriage - 16, y - 35, 32, 25);
        ctx.strokeStyle = '#b3b7a3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(carriage, y - 15); ctx.lineTo(carriage, y + 45); ctx.arc(carriage + 6, y + 45, 6, Math.PI, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    const library = this.facilities.find(f => f.id === 'mnemosyne');
    if (library && (library.ruined || library.reveal >= 0.4)) for (const book of sites.volumes) {
      ctx.save(); ctx.translate(book.x, book.y);
      const color = sites.librarySolved || book.read ? '#83dec4' : '#d2b67e';
      ctx.fillStyle = '#151d20'; ctx.fillRect(-21, -16, 42, 34);
      ctx.fillStyle = '#8b7552'; ctx.fillRect(-17, -17, 34, 28);
      ctx.fillStyle = '#d2c7a9'; ctx.fillRect(-15, -16, 14, 24); ctx.fillRect(1, -16, 14, 24);
      ctx.strokeStyle = '#7d806b'; ctx.lineWidth = 1;
      for (let y = -11; y < 5; y += 4) { ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(-4, y); ctx.moveTo(4, y); ctx.lineTo(12, y); ctx.stroke(); }
      ctx.fillStyle = color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(['I', 'II', 'III'][book.number - 1], 0, -27);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.stroke();
      if (Math.hypot(this.px - book.x, this.py - book.y) < 88) { ctx.font = '9px monospace'; ctx.fillText(sites.librarySolved ? 'CIPHER RECOVERED' : '[F] READ VOLUME', 0, 46); }
      ctx.restore();
    }

    // Base override terminals at POI centers. Soft targets are not objectives: they carry
    // no uplink, only what is standing on them.
    for (const poi of this.pois) {
      if (poi.secret && !poi.discovered) continue;
      if (poi.soft) continue;
      const d = Math.hypot(this.px - poi.x, this.py - poi.y);
      if (d > 2200) continue;
      ctx.save();
      ctx.translate(poi.x, poi.y);
      const isOverride = this.baseOverride.active && this.baseOverride.poiId === poi.id;
      const col = poi.captured ? '#8be8ff' : isOverride ? '#ff9d5c' : '#ffd166';
      ctx.fillStyle = '#101c22';
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke();
      ctx.save();
      ctx.rotate(this.simulationTime * (isOverride ? 3 : 0.6));
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 64, 0, TAU); ctx.stroke();
      ctx.restore();
      if (isOverride) {
        ctx.strokeStyle = '#68e7d7'; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 54, -Math.PI / 2, -Math.PI / 2 + (this.baseOverride.progress / 100) * TAU);
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(poi.captured ? 'SECURED' : isOverride ? `${Math.round(this.baseOverride.progress)}%` : 'UPLINK', 0, 4);
      if (!poi.captured && !isOverride && Math.hypot(this.px - poi.x, this.py - poi.y) < 170) {
        ctx.fillStyle = '#8be8ff';
        ctx.font = '10px monospace';
        ctx.fillText('[F] OVERRIDE UPLINK', 0, 82);
      }
      ctx.restore();
      ctx.textAlign = 'left';
    }

    this.drawMegaCrates(ctx, this.camX, this.camY);
  }

  private drawMegaCrates(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const mc of this.megaCrates) {
      if (mc.dead) continue;
      if (mc.x < camX - 160 || mc.x > camX + this.w + 160 || mc.y < camY - 160 || mc.y > camY + this.h + 160) continue;
      ctx.save();
      ctx.translate(mc.x, mc.y);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(6, mc.h / 2 + 10, mc.w * 0.55, 18, 0, 0, TAU); ctx.fill();

      const hw = mc.w / 2, hh = mc.h / 2;
      ctx.fillStyle = '#1c262a';
      ctx.fillRect(-hw, -hh, mc.w, mc.h);
      ctx.fillStyle = '#2d3b41';
      ctx.fillRect(-hw + 4, -hh + 4, mc.w - 8, mc.h - 8);

      ctx.strokeStyle = '#151d20'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-hw + 8, -hh + 8); ctx.lineTo(hw - 8, hh - 8);
      ctx.moveTo(hw - 8, -hh + 8); ctx.lineTo(-hw + 8, hh - 8);
      ctx.stroke();

      const pulse = 0.6 + Math.sin(this.simulationTime * 3 + mc.x) * 0.35;
      ctx.strokeStyle = mc.color; ctx.lineWidth = 2.5;
      ctx.strokeRect(-hw, -hh, mc.w, mc.h);

      ctx.fillStyle = '#e4bc72';
      for (const [bx, by] of [[-hw, -hh], [hw - 10, -hh], [-hw, hh - 10], [hw - 10, hh - 10]]) {
        ctx.fillRect(bx, by, 10, 10);
      }

      ctx.fillStyle = 'rgba(10,24,28,0.92)';
      ctx.fillRect(-hw + 10, -14, mc.w - 20, 28);
      ctx.strokeStyle = `rgba(${mc.color}, ${pulse})`; ctx.lineWidth = 1.5;
      ctx.strokeRect(-hw + 10, -14, mc.w - 20, 28);
      ctx.fillStyle = mc.color;
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(mc.id.toUpperCase(), 0, -2);
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.fillStyle = '#d5e6e6';
      ctx.fillText('SHOOT TO BREACH', 0, 9);

      if (mc.hp < mc.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(-hw, -hh - 12, mc.w, 4);
        ctx.fillStyle = mc.color;
        ctx.fillRect(-hw, -hh - 12, mc.w * clamp(mc.hp / mc.maxHp, 0, 1), 4);
      }
      ctx.restore();
      ctx.textAlign = 'left';
    }
  }

  private renderTransit(ctx: CanvasRenderingContext2D) {
    const next = SECTORS[Math.min(SECTORS.length - 1, this.sector)];
    const p = clamp(1 - this.transitT / this.transitDuration, 0, 1);
    const ease = p * p * (3 - 2 * p);
    const old = SECTORS[this.sector - 1] || SECTORS[0];
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, `rgb(${next.haze})`);
    bg.addColorStop(0.55, old.ground);
    bg.addColorStop(1, next.ground);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    // layered terrain parallax
    for (let layer = 0; layer < 3; layer++) {
      const baseY = this.h * (0.62 + layer * 0.1);
      const speed = 90 + layer * 130;
      ctx.fillStyle = layer === 0 ? 'rgba(0,0,0,0.22)' : layer === 1 ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(0, this.h);
      for (let x = -80; x <= this.w + 80; x += 80) {
        const xx = x - ((p * speed * 18) % 80);
        const yy = baseY + Math.sin((x + layer * 190) * 0.012) * (38 + layer * 18) + Math.sin(x * 0.027) * 20;
        ctx.lineTo(xx, yy);
      }
      ctx.lineTo(this.w, this.h); ctx.closePath(); ctx.fill();
    }

    // speed lines / rain / ash change as destination emerges
    ctx.strokeStyle = `rgba(${next.grid},0.22)`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 46; i++) {
      const y = ((i * 83 + p * 1900) % (this.h + 100)) - 50;
      const x = ((i * 173) % (this.w + 200)) - 100;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 70 - ease * 80, y + 20); ctx.stroke();
    }

    // gunship silhouette and detailed S.H.I.E.L.D. markings
    const hx = this.w * (0.42 + Math.sin(p * Math.PI) * 0.08);
    const hy = this.h * 0.45 + Math.sin(performance.now() / 110) * 5;
    const scale = clamp(Math.min(this.w, this.h) / 540, 0.78, 1.35);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(scale, scale);
    ctx.rotate(-0.05 + Math.sin(p * Math.PI * 2) * 0.025);
    ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.beginPath(); ctx.ellipse(10, 100, 135, 25, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#102a33'; ctx.fillRect(-160, -13, 88, 26);
    ctx.fillStyle = '#183e49'; ctx.fillRect(-160, -13, 88, 12);
    ctx.fillStyle = '#132d36'; ctx.fillRect(-168, -43, 14, 44);
    ctx.fillStyle = '#102830'; ctx.fillRect(-38, -66, 52, 25); ctx.fillRect(-38, 41, 52, 25);
    ctx.fillStyle = '#173b46'; ctx.beginPath(); ctx.roundRect(-78, -42, 138, 84, 30); ctx.fill();
    ctx.fillStyle = '#245665'; ctx.beginPath(); ctx.roundRect(-74, -38, 130, 39, 24); ctx.fill();
    ctx.fillStyle = '#06161d'; ctx.beginPath(); ctx.roundRect(30, -31, 58, 62, 20); ctx.fill();
    ctx.fillStyle = 'rgba(135,240,255,0.9)'; ctx.beginPath(); ctx.roundRect(38, -25, 42, 27, 14); ctx.fill();
    ctx.fillStyle = '#8be8ff';
    ctx.beginPath(); ctx.moveTo(-55, -24); ctx.lineTo(-26, -24); ctx.lineTo(-26, 1); ctx.quadraticCurveTo(-40, 25, -55, 29); ctx.quadraticCurveTo(-70, 25, -83, 1); ctx.lineTo(-83, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#08191f'; ctx.fillRect(-59, -17, 8, 34);
    ctx.fillStyle = '#0c2027'; ctx.fillRect(82, -7, 50, 14);
    ctx.fillStyle = '#8be8ff'; ctx.fillRect(125, -4, 14, 8);
    ctx.restore();
    // rotors remain screen-horizontal for readability
    ctx.save(); ctx.translate(hx - 12 * scale, hy - 22 * scale); ctx.rotate(performance.now() / 35);
    ctx.strokeStyle = 'rgba(175,240,250,0.58)'; ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i / 5 * TAU) * 150 * scale, Math.sin(i / 5 * TAU) * 150 * scale); }
    ctx.stroke(); ctx.restore();

    // navigation / mission transfer UI
    ctx.textAlign = 'center';
    ctx.fillStyle = next.accent;
    ctx.font = `900 ${clamp(this.w * 0.035, 24, 52)}px "Chakra Petch", sans-serif`;
    ctx.fillText(`DEPLOYING TO SECTOR ${this.sector + 1}/6`, this.w / 2, this.h * 0.16);
    ctx.fillStyle = '#f5fbfa';
    ctx.font = `900 ${clamp(this.w * 0.025, 19, 36)}px "Chakra Petch", sans-serif`;
    ctx.fillText(next.name, this.w / 2, this.h * 0.22);
    ctx.fillStyle = 'rgba(220,245,240,0.65)';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText(`${next.codename} // ${next.brief.toUpperCase()}`, this.w / 2, this.h * 0.27);
    const bw = Math.min(560, this.w * 0.72), bx = (this.w - bw) / 2, by = this.h * 0.82;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, 8);
    const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, '#2fd6c4'); pg.addColorStop(1, next.accent);
    ctx.fillStyle = pg; ctx.fillRect(bx, by, bw * p, 8);
    ctx.strokeStyle = 'rgba(160,240,225,0.38)'; ctx.strokeRect(bx, by, bw, 8);
    ctx.fillStyle = 'rgba(220,245,240,0.62)'; ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillText(p < 0.35 ? 'EXTRACTING OPERATIVE' : p < 0.72 ? 'HIGH ALTITUDE TRANSIT' : 'DESCENDING INTO HOSTILE AIRSPACE', this.w / 2, by + 30);
    ctx.textAlign = 'left';
  }

  private drawWeather(ctx: CanvasRenderingContext2D) {
    if (this.status !== 'playing') return;
    const theme = SECTORS[this.sector - 1] || SECTORS[0];
    const now = performance.now() * 0.001;
    ctx.save();
    const count = this.dpr > 1.5 ? 58 : 76;
    if (theme.weather === 'rain' || theme.weather === 'toxic') {
      ctx.strokeStyle = theme.weather === 'toxic' ? 'rgba(150,255,90,0.18)' : 'rgba(150,210,225,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = ((i * 173 + now * 370) % (this.w + 100)) - 50;
        const y = ((i * 97 + now * (520 + i % 7 * 23)) % (this.h + 100)) - 50;
        ctx.moveTo(x, y); ctx.lineTo(x - 11, y + 31);
      }
      ctx.stroke();
    } else {
      const snow = theme.weather === 'snow';
      ctx.fillStyle = snow ? 'rgba(225,248,255,0.42)' : theme.weather === 'ash' ? 'rgba(255,115,125,0.20)' : 'rgba(220,165,100,0.18)';
      for (let i = 0; i < count; i++) {
        const sp = snow ? 26 + i % 6 * 6 : 50 + i % 5 * 10;
        const x = ((i * 191 + now * (snow ? 18 : 54)) % (this.w + 60)) - 30;
        const y = ((i * 113 + now * sp) % (this.h + 60)) - 30;
        const r = snow ? 1 + i % 3 : 0.8 + i % 2;
        ctx.beginPath(); ctx.arc(x + Math.sin(now + i) * 12, y, r, 0, TAU); ctx.fill();
      }
    }
    // Sectors 2 and 4 keep their own weather (dust / toxic haze) and now get
    // falling snow on top of it as well.
    if (theme.weather !== 'snow' && (this.sector === 2 || this.sector === 4)) {
      this.drawSnowfall(ctx, 82, 1);
    }
    // The army district gets the one thing the other bases do not have: weather that
    // moves across the ground in sheets, dust devils walking the parade ground, and the
    // shimmer off four square kilometres of hot concrete.
    if (this.army && theme.weather === 'dust') this.drawDustStorm(ctx);
    ctx.restore();
  }

  /** Blowing dust, ground drift and dust devils: the district's own weather. */
  private drawDustStorm(ctx: CanvasRenderingContext2D) {
    const now = performance.now() * 0.001;
    const gust = 0.55 + Math.sin(now * 0.23) * 0.45;
    ctx.save();
    // sheets of dust sliding across the viewport
    for (let layer = 0; layer < 3; layer++) {
      const speed = 34 + layer * 26;
      const alpha = (0.05 + layer * 0.028) * (0.6 + gust * 0.6);
      const grads = ctx.createLinearGradient(0, 0, this.w, 0);
      grads.addColorStop(0, `rgba(196,178,138,0)`);
      grads.addColorStop(0.45, `rgba(196,178,138,${alpha})`);
      grads.addColorStop(1, `rgba(196,178,138,0)`);
      ctx.fillStyle = grads;
      const bandH = 60 + layer * 34;
      for (let i = 0; i < 3; i++) {
        const x = ((now * speed + i * (this.w / 3) + layer * 90) % (this.w + 400)) - 200;
        const y = (this.h * (0.25 + layer * 0.22) + Math.sin(now * 0.5 + i) * 40) % this.h;
        ctx.fillRect(x, y, 320, bandH);
      }
    }
    // grit: fast, low, mostly horizontal
    ctx.fillStyle = `rgba(220,204,164,${0.14 + gust * 0.1})`;
    const grit = this.dpr > 1.5 ? 90 : 130;
    for (let i = 0; i < grit; i++) {
      const x = ((i * 211 + now * (240 + (i % 9) * 40) * gust) % (this.w + 120)) - 60;
      const y = (i * 137) % this.h;
      ctx.fillRect(x, y + Math.sin(now * 3 + i) * 6, 2 + (i % 3), 1);
    }
    // dust devils: two columns of spiralling air, only while the gust is up
    if (gust > 0.5) {
      for (let d = 0; d < 2; d++) {
        const phase = now * 0.35 + d * 2.1;
        const cx = (this.w * (0.3 + d * 0.42) + Math.sin(phase) * 120) % this.w;
        const base = this.h * (0.62 + (d % 2) * 0.12);
        const height = 130 + Math.sin(phase * 1.7) * 40;
        ctx.strokeStyle = `rgba(214,196,152,${0.1 * (gust - 0.5) * 2})`;
        ctx.lineWidth = 8;
        for (let k = 0; k < 5; k++) {
          const t = k / 5;
          const y = base - height * t;
          const spin = Math.sin(phase * 4 + t * 9) * (10 + t * 26);
          ctx.beginPath();
          ctx.ellipse(cx + spin, y, 12 + t * 30, 4 + t * 8, 0, 0, TAU);
          ctx.stroke();
        }
      }
    }
    // heat shimmer along the bottom third: a few translucent vertical slices
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 173 + now * 18) % this.w);
      const h = 90 + (i % 3) * 60;
      const grad = ctx.createLinearGradient(0, this.h - h, 0, this.h);
      grad.addColorStop(0, 'rgba(255,240,200,0)');
      grad.addColorStop(1, 'rgba(255,240,200,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, this.h - h, 40, h);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Layered snowfall, drawn additively over whatever weather a sector already has. */
  private drawSnowfall(ctx: CanvasRenderingContext2D, count: number, strength = 1) {
    const now = performance.now() * 0.001;
    ctx.save();
    const wind = Math.sin(now * 0.18) * 26 + Math.sin(now * 0.07) * 44;
    const layers = [
      { scale: 0.45, speed: 30, sway: 14, alpha: 0.24 },
      { scale: 0.75, speed: 56, sway: 22, alpha: 0.38 },
      { scale: 1, speed: 88, sway: 34, alpha: 0.52 },
    ];
    for (let l = 0; l < layers.length; l++) {
      const layer = layers[l];
      const n = Math.max(4, Math.round(count * (l === 0 ? 0.46 : l === 1 ? 0.32 : 0.22)));
      ctx.fillStyle = `rgba(228,247,255,${Math.min(0.85, layer.alpha * strength)})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const speed = layer.speed * (0.8 + ((i * 37) % 41) / 100);
        const x = ((i * 233 + now * (wind * layer.scale + 26 * layer.scale)) % (this.w + 80)) - 40;
        const y = ((i * 149 + now * speed) % (this.h + 80)) - 40;
        const px = x + Math.sin(now * 1.4 + i * 0.7) * layer.sway;
        const py = y + Math.sin(now * 0.9 + i) * 6;
        const r = layer.scale * (1.1 + ((i * 29) % 17) / 12);
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, TAU);
      }
      ctx.fill();
    }
    // Soft cold glare so the flakes read as snow rather than white dust.
    const cold = ctx.createLinearGradient(0, 0, 0, this.h);
    cold.addColorStop(0, `rgba(190,225,240,${0.05 * strength})`);
    cold.addColorStop(0.55, 'rgba(190,225,240,0)');
    cold.addColorStop(1, `rgba(210,235,245,${0.035 * strength})`);
    ctx.fillStyle = cold;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  private drawSupportDrone(ctx: CanvasRenderingContext2D) {
    const x = this.px + Math.cos(this.droneAng) * 54;
    const y = this.py + Math.sin(this.droneAng) * 54 - 20;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 20, 13, 4, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(this.droneAng * 2);
    ctx.fillStyle = '#1e5041';
    ctx.beginPath(); ctx.roundRect(-13, -8, 26, 16, 7); ctx.fill();
    ctx.fillStyle = '#5be5ad';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9fffd1'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(19, 0); ctx.stroke();
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const theme = SECTORS[this.sector - 1] || SECTORS[0];
    if (this.groundPat) {
      ctx.save();
      ctx.fillStyle = this.groundPat;
      ctx.fillRect(camX - 20, camY - 20, this.w + 40, this.h + 40);
      ctx.restore();
    } else {
      ctx.fillStyle = theme.ground;
      ctx.fillRect(camX, camY, this.w, this.h);
    }
    // subtle grid
    const g = 200;
    ctx.strokeStyle = `rgba(${theme.grid},0.055)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = Math.floor(camX / g) * g, y0 = Math.floor(camY / g) * g;
    for (let x = x0; x < camX + this.w + g; x += g) { ctx.moveTo(x, camY); ctx.lineTo(x, camY + this.h); }
    for (let y = y0; y < camY + this.h + g; y += g) { ctx.moveTo(camX, y); ctx.lineTo(camX + this.w, y); }
    ctx.stroke();
  }

  /** Open water. Drawn before any land so the island can never be painted over by sea. */
  private drawSea(ctx: CanvasRenderingContext2D, sea: { x: number; y: number; w: number; h: number }, camX: number, camY: number) {
          // The flooded north-west coast: deep water, slow swell, surf on the rocks.
          const g = ctx.createLinearGradient(sea.x, sea.y, sea.x + sea.w * 0.4, sea.y + sea.h);
          g.addColorStop(0, 'rgba(8,28,38,0.90)');
          g.addColorStop(0.55, 'rgba(10,38,50,0.86)');
          g.addColorStop(1, 'rgba(14,44,52,0.84)');
          ctx.fillStyle = g; ctx.fillRect(sea.x, sea.y, sea.w, sea.h);
          const t = this.simulationTime;
          // The western sea is huge: only tessellate the water that is on screen.
          const x0 = Math.max(sea.x, camX - 80), x1 = Math.min(sea.x + sea.w, camX + this.w + 80);
          const y0 = Math.max(sea.y, camY - 80), y1 = Math.min(sea.y + sea.h, camY + this.h + 80);
          ctx.strokeStyle = 'rgba(126,206,214,0.10)'; ctx.lineWidth = 2;
          for (let y = Math.ceil((y0 - sea.y - 40) / 74) * 74 + sea.y + 40; y < y1; y += 74) {
            ctx.beginPath();
            for (let x = x0; x < x1; x += 46) {
              const wave = Math.sin((x * 0.011) + (y * 0.017) + t * 1.25) * 7;
              if (x === x0) ctx.moveTo(x, y + wave); else ctx.lineTo(x, y + wave);
            }
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(196,240,244,0.05)'; ctx.lineWidth = 1;
          for (let y = Math.ceil((y0 - sea.y - 14) / 37) * 37 + sea.y + 14; y < y1; y += 37) {
            ctx.beginPath();
            for (let x = x0; x < x1; x += 70) {
              const wave = Math.sin((x * 0.02) - (y * 0.013) - t * 1.9) * 4;
              if (x === x0) ctx.moveTo(x, y + wave); else ctx.lineTo(x, y + wave);
            }
            ctx.stroke();
          }
  }

  /** Solid ground for the prison island: land must never read as water. */
  private drawLandmass(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const onScreen = (z: { x: number; y: number; w: number; h: number }) =>
      !(z.x + z.w < camX - 60 || z.x > camX + this.w + 60 || z.y + z.h < camY - 60 || z.y > camY + this.h + 60);
    for (const z of this.zones) if (onScreen(z) && z.kind === 'lagoon') this.drawSea(ctx, z, camX, camY);
    for (const z of this.zones) {
      if (!onScreen(z) || (z.kind !== 'sand' && z.kind !== 'grass' && z.kind !== 'lawn')) continue;
      const beach = z.kind === 'sand';
      // A big sand or grass field is an island landmass, not a dropped rectangle: both are
      // drawn with the same ragged outline so the prison island has no straight edges.
      const islandShaped = z.w > 1500 && z.h > 1500;
      const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      const g = islandShaped
        ? ctx.createRadialGradient(cx, cy, Math.min(z.w, z.h) * 0.1, cx, cy, Math.max(z.w, z.h) * 0.62)
        : ctx.createLinearGradient(z.x, z.y, z.x, z.y + z.h);
      if (islandShaped && z.kind === 'lawn') {
        g.addColorStop(0, '#3f5136');
        g.addColorStop(0.55, '#47593c');
        g.addColorStop(1, '#33402d');
      } else if (islandShaped) {
        g.addColorStop(0, '#4f4634');
        g.addColorStop(0.55, '#5a4f3b');
        g.addColorStop(1, '#3b372b');
      } else if (beach) {
        g.addColorStop(0, '#4a4335');
        g.addColorStop(0.45, '#554b39');
        g.addColorStop(1, '#3f3a2e');
      } else if (!beach && z.kind === 'lawn') {
        g.addColorStop(0, '#3a4a33');
        g.addColorStop(0.5, '#41553a');
        g.addColorStop(1, '#2f3d2b');
      } else {
        g.addColorStop(0, '#2b3229');
        g.addColorStop(0.5, '#333a2e');
        g.addColorStop(1, '#262c24');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      if (islandShaped) {
        // a ragged ellipse: an island, not a rectangle dropped into the sea
        const steps = 72;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * TAU;
          const wobble = 1 + Math.sin(a * 3 + 0.7) * 0.035 + Math.sin(a * 7 + 2.1) * 0.022;
          const x = cx + Math.cos(a) * (z.w / 2) * wobble;
          const y = cy + Math.sin(a) * (z.h / 2) * wobble;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        ctx.rect(z.x, z.y, z.w, z.h);
      }
      ctx.fill();
      ctx.strokeStyle = beach ? 'rgba(126,110,78,0.4)' : z.kind === 'lawn' ? 'rgba(120,148,104,0.35)' : 'rgba(96,110,84,0.3)';
      ctx.lineWidth = 5;
      ctx.stroke();
      if (beach) {
        // surf: a lighter ring just outside the shoreline
        ctx.strokeStyle = 'rgba(206,236,240,0.13)'; ctx.lineWidth = 9;
        ctx.beginPath();
        if (islandShaped) {
          const steps = 72, surge = 1 + Math.sin(this.simulationTime * 1.4) * 0.006;
          for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * TAU;
            const wobble = 1 + Math.sin(a * 3 + 0.7) * 0.035 + Math.sin(a * 7 + 2.1) * 0.022;
            const x = cx + Math.cos(a) * (z.w / 2 + 26) * wobble * surge;
            const y = cy + Math.sin(a) * (z.h / 2 + 26) * wobble * surge;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
        } else {
          ctx.rect(z.x, z.y, z.w, z.h);
        }
        ctx.stroke();
      }
    }
  }

  private drawZones(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const z of this.zones) {
      if (z.x + z.w < camX - 60 || z.x > camX + this.w + 60 || z.y + z.h < camY - 60 || z.y > camY + this.h + 60) continue;
      switch (z.kind) {
        case 'road': {
          ctx.fillStyle = this.sector === 2 ? '#2a2019' : this.sector === 3 ? '#1e292d' : this.sector === 5 ? '#24151a' : '#171d1c';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          const horiz = z.w >= z.h;
          const len = horiz ? z.w : z.h;
          const thick = horiz ? z.h : z.w;
          const cxR = z.x + z.w / 2, cyR = z.y + z.h / 2;
          // Resurfacing patches and oil: a road is never one flat colour.
          const seed = Math.abs(Math.floor(z.x * 0.37 + z.y * 0.71)) % 97;
          ctx.fillStyle = 'rgba(255,255,255,0.028)';
          for (let p = 0; p < 5; p++) {
            const t = ((seed + p * 31) % 100) / 100;
            const pw = 70 + ((seed + p * 17) % 90), ph = Math.min(thick * 0.6, 40 + ((seed + p * 13) % 60));
            ctx.fillRect(horiz ? z.x + t * (len - pw) : cxR - ph / 2,
              horiz ? cyR - ph / 2 : z.y + t * (len - pw), horiz ? pw : ph, horiz ? ph : pw);
          }
          // Edge lines: the painted shoulder line on both sides.
          ctx.strokeStyle = 'rgba(228,232,220,0.14)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (horiz) {
            ctx.moveTo(z.x, z.y + 7); ctx.lineTo(z.x + z.w, z.y + 7);
            ctx.moveTo(z.x, z.y + z.h - 7); ctx.lineTo(z.x + z.w, z.y + z.h - 7);
          } else {
            ctx.moveTo(z.x + 7, z.y); ctx.lineTo(z.x + 7, z.y + z.h);
            ctx.moveTo(z.x + z.w - 7, z.y); ctx.lineTo(z.x + z.w - 7, z.y + z.h);
          }
          ctx.stroke();
          // Centre line, doubled where the road is wide enough to have two lanes each way.
          ctx.strokeStyle = 'rgba(230,200,120,0.20)';
          ctx.lineWidth = 4; ctx.setLineDash([46, 42]);
          ctx.beginPath();
          if (horiz) { ctx.moveTo(z.x, cyR); ctx.lineTo(z.x + z.w, cyR); }
          else { ctx.moveTo(cxR, z.y); ctx.lineTo(cxR, z.y + z.h); }
          ctx.stroke(); ctx.setLineDash([]);
          if (thick > 150) {
            ctx.strokeStyle = 'rgba(230,200,120,0.13)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (horiz) {
              ctx.moveTo(z.x, cyR - 12); ctx.lineTo(z.x + z.w, cyR - 12);
              ctx.moveTo(z.x, cyR + 12); ctx.lineTo(z.x + z.w, cyR + 12);
            } else {
              ctx.moveTo(cxR - 12, z.y); ctx.lineTo(cxR - 12, z.y + z.h);
              ctx.moveTo(cxR + 12, z.y); ctx.lineTo(cxR + 12, z.y + z.h);
            }
            ctx.stroke();
          }
          // Zebra crossing every ~880 px, with the stop line before it.
          const zebraStep = 880;
          for (let d = 380 + (seed % 5) * 40; d < len - 240; d += zebraStep) {
            const bars = Math.max(4, Math.min(9, Math.floor(thick / 22)));
            ctx.fillStyle = 'rgba(232,238,228,0.22)';
            for (let b = 0; b < bars; b++) {
              const off = (b - (bars - 1) / 2) * (thick / bars);
              if (horiz) ctx.fillRect(z.x + d, cyR + off - thick / bars * 0.3, 26, thick / bars * 0.6);
              else ctx.fillRect(cxR + off - thick / bars * 0.3, z.y + d, thick / bars * 0.6, 26);
            }
            ctx.fillStyle = 'rgba(232,238,228,0.18)';
            if (horiz) ctx.fillRect(z.x + d - 26, z.y + 10, 6, z.h - 20);
            else ctx.fillRect(z.x + 10, z.y + d - 26, z.w - 20, 6);
          }
          // Lane arrows, pointing the way the block is signed.
          ctx.fillStyle = 'rgba(232,238,228,0.16)';
          for (let d = 620 + (seed % 7) * 60; d < len - 200; d += 1240) {
            const ax = horiz ? z.x + d : cxR - 8, ay = horiz ? cyR - 8 : z.y + d;
            ctx.beginPath();
            if (horiz) {
              ctx.moveTo(ax, ay); ctx.lineTo(ax + 26, ay + 8); ctx.lineTo(ax, ay + 16);
            } else {
              ctx.moveTo(ax, ay); ctx.lineTo(ax + 8, ay + 26); ctx.lineTo(ax + 16, ay);
            }
            ctx.closePath(); ctx.fill();
          }
          // Skid marks and a manhole or two.
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 3;
          for (let k = 0; k < 3; k++) {
            const t = ((seed + k * 41) % 100) / 100;
            const sx = horiz ? z.x + t * len : cxR + (k - 1) * 18;
            const sy = horiz ? cyR + (k - 1) * 18 : z.y + t * len;
            ctx.beginPath();
            if (horiz) { ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 60, sy + 12, sx + 130, sy + 4); }
            else { ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 12, sy + 60, sx + 4, sy + 130); }
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(120,130,124,0.22)';
          for (let k = 0; k < 2; k++) {
            const t = ((seed + k * 53) % 100) / 100;
            const mx = horiz ? z.x + t * len : cxR + (k ? 26 : -26);
            const my = horiz ? cyR + (k ? 26 : -26) : z.y + t * len;
            ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'concrete': ctx.fillStyle = 'rgba(120,140,132,0.055)'; ctx.fillRect(z.x, z.y, z.w, z.h); break;
        /* Poured hardstanding. Concrete used to be a 5 % wash, which left the whole army
         * base the same olive as the fields around it: buildings floating on grass. A slab
         * reads as a slab when it is darker than the dirt, jointed, and edged. */
        case 'apron': {
          ctx.fillStyle = 'rgba(30,34,32,0.42)';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(206,216,196,0.055)'; ctx.lineWidth = 1;
          ctx.beginPath();
          for (let jx = z.x + 220; jx < z.x + z.w; jx += 220) { ctx.moveTo(jx, z.y); ctx.lineTo(jx, z.y + z.h); }
          for (let jy = z.y + 220; jy < z.y + z.h; jy += 220) { ctx.moveTo(z.x, jy); ctx.lineTo(z.x + z.w, jy); }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(196,206,176,0.10)'; ctx.lineWidth = 2;
          ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
          break;
        }
        case 'plaza':
          ctx.fillStyle = 'rgba(255,209,102,0.05)'; ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(255,209,102,0.14)'; ctx.lineWidth = 2;
          ctx.strokeRect(z.x, z.y, z.w, z.h);
          break;
        // Sand and grass are painted by drawLandmass() — a translucent wash here would
        // stack a dozen overlapping rectangles into a solid block.
        case 'sand': break;
        case 'lagoon': break;   // the sea is painted by drawLandmass(), under the land
        case 'grass': break;
        case 'lawn': break;   // painted by drawLandmass(), like the island grass
        case 'fuel': ctx.fillStyle = 'rgba(190,110,50,0.06)'; ctx.fillRect(z.x, z.y, z.w, z.h); break;
        /* Per-sector ground cover. These are painted as translucent patches so overlapping
         * zones deepen instead of turning into opaque slabs; every speck is derived from
         * the zone's own coordinates, so nothing flickers between frames. */
        case 'snow': {
          ctx.fillStyle = 'rgba(226,242,250,0.17)';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 2;
          ctx.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4);
          break;
        }
        case 'ice': {
          ctx.fillStyle = 'rgba(150,214,238,0.20)';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          // wind-scoured cracks: two deterministic lines per patch
          ctx.strokeStyle = 'rgba(226,246,255,0.28)'; ctx.lineWidth = 2;
          const s1 = (z.x * 0.37 + z.y * 0.61) % 1;
          ctx.beginPath();
          ctx.moveTo(z.x + z.w * (0.1 + s1 * 0.2), z.y + z.h * 0.15);
          ctx.lineTo(z.x + z.w * (0.45 + s1 * 0.1), z.y + z.h * 0.62);
          ctx.lineTo(z.x + z.w * (0.78 + s1 * 0.1), z.y + z.h * 0.9);
          ctx.moveTo(z.x + z.w * 0.62, z.y + z.h * 0.2);
          ctx.lineTo(z.x + z.w * 0.5, z.y + z.h * 0.55);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3;
          ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
          break;
        }
        case 'marsh': {
          ctx.fillStyle = 'rgba(74,112,52,0.20)';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.fillStyle = 'rgba(30,54,36,0.22)';
          for (let i = 0; i < 3; i++) {
            const px = z.x + z.w * (0.2 + ((i * 37 + z.x) % 60) / 100);
            const py = z.y + z.h * (0.25 + ((i * 53 + z.y) % 55) / 100);
            ctx.beginPath();
            ctx.ellipse(px, py, z.w * 0.16, z.h * 0.1, i * 0.7, 0, TAU);
            ctx.fill();
          }
          break;
        }
        case 'slag': {
          ctx.fillStyle = 'rgba(96,44,48,0.20)';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.fillStyle = 'rgba(255,132,96,0.30)';
          for (let i = 0; i < 4; i++) {
            const px = z.x + ((i * 71 + z.x * 3) % Math.max(1, z.w - 8));
            const py = z.y + ((i * 113 + z.y * 3) % Math.max(1, z.h - 8));
            ctx.fillRect(px, py, 4, 3);
          }
          break;
        }
        case 'puddle': {
          ctx.fillStyle = 'rgba(44,78,96,0.22)';
          ctx.beginPath();
          ctx.ellipse(z.x + z.w / 2, z.y + z.h / 2, z.w / 2, z.h / 2, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(150,220,235,0.16)'; ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }
        case 'runway': {
          ctx.fillStyle = 'rgba(24,32,36,0.85)'; ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(230,240,245,0.30)'; ctx.lineWidth = 6;
          ctx.setLineDash([90, 70]);
          ctx.beginPath(); ctx.moveTo(z.x, z.y + z.h / 2); ctx.lineTo(z.x + z.w, z.y + z.h / 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,209,102,0.28)';
          for (let i = 0; i < 6; i++) { ctx.fillRect(z.x + 30, z.y + 20 + i * 44, 44, 10); ctx.fillRect(z.x + z.w - 74, z.y + 20 + i * 44, 44, 10); }
          break;
        }
        case 'parade': {
          ctx.fillStyle = 'rgba(255,90,110,0.05)'; ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(255,120,140,0.22)'; ctx.lineWidth = 2;
          ctx.strokeRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(255,120,140,0.12)'; ctx.lineWidth = 1;
          ctx.beginPath();
          for (let gx = z.x + 66; gx < z.x + z.w; gx += 132) { ctx.moveTo(gx, z.y); ctx.lineTo(gx, z.y + z.h); }
          ctx.stroke();
          break;
        }
        case 'helipad': {
          ctx.fillStyle = 'rgba(35,48,44,0.5)';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          const cxz = z.x + z.w / 2, cyz = z.y + z.h / 2;
          ctx.strokeStyle = 'rgba(120,230,200,0.35)';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(cxz, cyz, 92, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(120,230,200,0.2)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cxz, cyz, 62, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(120,230,210,0.5)';
          ctx.font = '900 92px ui-sans-serif, system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('H', cxz, cyz);
          ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
          // corner markers
          ctx.fillStyle = 'rgba(120,230,200,0.4)';
          for (const [mx, my] of [[-110, -110], [110, -110], [-110, 110], [110, 110]] as const) {
            ctx.fillRect(cxz + mx - 8, cyz + my - 8, 16, 16);
          }
          break;
        }
        default: break;
      }
    }
  }

  private drawHQFloor(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const { cx, cy, w, h } = HQ;
    if (cx + w < camX || cx - w > camX + this.w || cy + h < camY || cy - h > camY + this.h) return;
    // Hydra painted over the original S.H.I.E.L.D. insignia.
    ctx.save();
    const theme = SECTORS[this.sector - 1] || SECTORS[0];
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy - 40, 260, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy - 40, 200, 0, TAU); ctx.stroke();
    // Triple-serpent technology mark.
    ctx.lineWidth = 9;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 75, cy + 135);
      ctx.bezierCurveTo(cx + i * 90 - 130, cy + 40, cx + i * 90 + 130, cy - 40, cx + i * 75, cy - 190);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + i * 75, cy - 190, 16, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = theme.accent;
    ctx.font = '900 48px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HYDRA SECTOR ${this.sector}`, cx, cy + 245);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ==================================================================== *
   * ISLAND PRISON ART
   *
   * The prison island has its own materials. Nothing here is used by the
   * legacy theatre, and nothing here reuses the base-building textures that
   * made the first attempt look like a Hydra outpost rather than a prison.
   * ==================================================================== */

  private drawPine(ctx: CanvasRenderingContext2D, o: Rect) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, s = Math.min(o.w, o.h) / 2;
    const seed = (Math.sin(o.x * 0.031 + o.y * 0.017) + 1) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath(); ctx.ellipse(cx + s * 0.34, cy + s * 0.46, s * 1.02, s * 0.78, 0, 0, TAU); ctx.fill();
    const layers: [number, number, string][] = [
      [0.75, 0.16, '#12251c'], [0.56, -0.02, '#173023'], [0.36, -0.14, '#1d3d2c'], [0.18, -0.2, '#254b36'],
    ];
    for (const [r, dy, col] of layers) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.05, cy + s * dy, s * r * (0.9 + seed * 0.2), s * r * (0.82 + seed * 0.16), 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(96,150,112,0.16)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx - s * 0.12, cy - s * 0.26, s * 0.3, s * 0.22, 0, 0, TAU); ctx.stroke();
  }

  /** A block of glacier ice: the wall of the arctic annex, and its gate surround. */
  private drawIceBlock(ctx: CanvasRenderingContext2D, o: Rect, tint: string) {
    const lift = Math.min(34, o.h3d * 0.22);
    ctx.save();
    // what the block casts on the ground under it
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(o.x + lift * 0.5, o.y + lift * 0.62, o.w, o.h);
    // the cut face: pale blue at the top, deeper at the bottom
    const face = ctx.createLinearGradient(o.x, o.y - lift, o.x, o.y + o.h);
    face.addColorStop(0, '#f2fbff');
    face.addColorStop(0.35, tint);
    face.addColorStop(1, '#8fb6c6');
    ctx.fillStyle = face;
    ctx.fillRect(o.x, o.y - lift, o.w, o.h + lift);
    // bevels: a lit top edge, a shaded foot
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(o.x, o.y - lift, o.w, 4);
    ctx.fillStyle = 'rgba(28,58,72,0.35)';
    ctx.fillRect(o.x, o.y + o.h - 6, o.w, 6);
    // fracture facets
    const seed = Math.abs(Math.sin(o.x * 0.013 + o.y * 0.017));
    ctx.strokeStyle = 'rgba(60,110,132,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const fx = o.x + o.w * (0.2 + ((seed * (i + 1)) % 0.6));
      ctx.moveTo(fx, o.y - lift + 6);
      ctx.lineTo(fx + (seed - 0.5) * 60, o.y + o.h * (0.45 + i * 0.16));
    }
    ctx.stroke();
    // snow gathered on the top edge
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 4; i++) {
      const sx = o.x + o.w * ((i + seed) / 4.4);
      ctx.beginPath();
      ctx.ellipse(sx, o.y - lift + 5, o.w * 0.16, 5, 0, 0, TAU);
      ctx.fill();
    }
    // outline keeps neighbouring blocks reading as one wall
    ctx.strokeStyle = 'rgba(38,74,92,0.4)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(o.x + 0.5, o.y - lift + 0.5, o.w - 1, o.h + lift - 1);
    ctx.restore();
  }

  private drawRock(ctx: CanvasRenderingContext2D, o: Rect) {
    // PALE ROCK IS ICE.
    //
    // The glacier wall was being drawn by the same dark-boulder code as a roadside rock,
    // so a solid mountain of ice looked like a scattering of black blobs on grey ground
    // and the gate read as a dead end. Pale tints are now drawn as cut ice blocks: hard
    // facets, a snow cap, a cold shadow — and, crucially, as rectangles that tile into a
    // wall, so the player can see exactly what is solid and where the opening is.
    const tint = o.tint || '';
    const pale = /^#[0-9a-f]{6}$/i.test(tint)
      && (parseInt(tint.slice(1, 3), 16) + parseInt(tint.slice(3, 5), 16) + parseInt(tint.slice(5, 7), 16)) > 430;
    if (pale) {
      this.drawIceBlock(ctx, o, tint);
      return;
    }
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, s = Math.min(o.w, o.h) / 2;
    const seed = (Math.sin(o.x * 0.021 + o.y * 0.013) + 1) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(cx + s * 0.2, cy + s * 0.3, s, s * 0.7, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + seed;
      const r = s * (0.72 + (i % 3) * 0.12);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#3b3a33'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,148,132,0.20)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(154,152,138,0.13)';
    ctx.beginPath(); ctx.ellipse(cx - s * 0.2, cy - s * 0.22, s * 0.4, s * 0.26, -0.5, 0, TAU); ctx.fill();
  }

  private drawBoat(ctx: CanvasRenderingContext2D, o: Rect) {
    const rot = Number(o.tint ?? 0) || 0;
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(rot);
    const w = o.w, h = o.h;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(4, 6, w * 0.5, h * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#cfd8d3';
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(-w / 2 + 8, -h / 2, w / 2 - 10, -h / 2);
    ctx.quadraticCurveTo(w / 2, 0, w / 2 - 10, h / 2); ctx.quadraticCurveTo(-w / 2 + 8, h / 2, -w / 2, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#243441';
    ctx.fillRect(-w * 0.16, -h * 0.22, w * 0.3, h * 0.44);
    ctx.fillStyle = 'rgba(255,214,138,0.55)';
    ctx.fillRect(-w * 0.1, -h * 0.12, w * 0.12, h * 0.14);
    ctx.restore();
  }

  private drawBastion(ctx: CanvasRenderingContext2D, o: Rect, h: number) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = Math.min(o.w, o.h) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(cx + h * 0.35, cy + h * 0.5, r * 1.02, r * 0.9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f3a33';
    ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.16, r * 1.06, r * 0.98, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#44514a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,16,14,0.65)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#333f38';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.fillRect(cx + Math.cos(a) * r * 0.93 - 4, cy + Math.sin(a) * r * 0.93 - 4, 8, 8);
    }
    ctx.fillStyle = 'rgba(255,209,102,0.12)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, TAU); ctx.fill();
  }

  private drawCellBlock(ctx: CanvasRenderingContext2D, o: Rect, h: number) {
    const side = '#151d1b', top = o.tint ?? '#3d4a3e';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(o.x + h * 0.5, o.y + h * 0.7, o.w, o.h);
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h); ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.lineTo(o.x + o.w, o.y + o.h + h); ctx.lineTo(o.x, o.y + o.h + h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(side, -8);
    ctx.beginPath();
    ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w + h * 0.45, o.y + h * 0.45);
    ctx.lineTo(o.x + o.w + h * 0.45, o.y + o.h + h * 0.45); ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.closePath(); ctx.fill();
    // roof slab
    ctx.fillStyle = top; ctx.fillRect(o.x, o.y, o.w, o.h);
    // slate ribs, evenly spaced: a real prison roof, not a blank floor
    ctx.strokeStyle = 'rgba(12,18,16,0.55)'; ctx.lineWidth = 3;
    for (let x = o.x + 22; x < o.x + o.w - 10; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, o.y + 8); ctx.lineTo(x, o.y + o.h - 8); ctx.stroke();
    }
    // skylight strips over the cell galleries
    ctx.fillStyle = 'rgba(120,150,160,0.35)';
    for (let x = o.x + 44; x < o.x + o.w - 60; x += 132) ctx.fillRect(x, o.y + o.h * 0.42, 74, 8);
    // rooftop plant
    for (let x = o.x + 96; x < o.x + o.w - 80; x += 210) {
      ctx.fillStyle = '#1b2622'; ctx.fillRect(x, o.y + 18, 54, 34);
      ctx.fillStyle = '#40514a'; ctx.fillRect(x + 4, o.y + 22, 46, 26);
      ctx.strokeStyle = 'rgba(10,16,14,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 8, o.y + 35); ctx.lineTo(x + 46, o.y + 35); ctx.stroke();
    }
    // barred windows on both long faces, so the cell galleries read from any approach
    for (const fy of [o.y + o.h + 16, o.y - 30]) {
      ctx.fillStyle = 'rgba(255,209,102,0.5)';
      for (let x = o.x + 30; x < o.x + o.w - 30; x += 46) {
        ctx.fillRect(x, fy, 22, 12);
        ctx.strokeStyle = 'rgba(8,12,10,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 7, fy); ctx.lineTo(x + 7, fy + 12);
        ctx.moveTo(x + 15, fy); ctx.lineTo(x + 15, fy + 12); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(160,190,180,0.34)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(o.w > 800 ? 'CELL HOUSE' : 'CELLS', o.x + 26, o.y + o.h - 18);
  }

  private drawLighthouse(ctx: CanvasRenderingContext2D, o: Rect) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = Math.min(o.w, o.h) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(cx + 18, cy + 22, r * 1.1, r * 0.9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8d9a96';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9e2dd';
    ctx.beginPath(); ctx.arc(cx, cy - 2, r * 0.74, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b23a3a';
    ctx.beginPath(); ctx.arc(cx, cy - 2, r * 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,226,150,0.9)';
    ctx.beginPath(); ctx.arc(cx, cy - 2, r * 0.24, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,245,240,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - 2, r * 0.86, 0, TAU); ctx.stroke();
  }

  private drawBarrier(ctx: CanvasRenderingContext2D, o: Rect) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(o.x + 4, o.y + 6, o.w, o.h + 8);
    const vertical = o.h >= o.w;
    const n = Math.max(4, Math.floor((vertical ? o.h : o.w) / 26));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#c9cfc4' : '#b23a3a';
      if (vertical) ctx.fillRect(o.x + 2, o.y + (o.h / n) * i, o.w - 4, o.h / n + 1);
      else ctx.fillRect(o.x + (o.w / n) * i, o.y + 2, o.w / n + 1, o.h - 4);
    }
    ctx.strokeStyle = 'rgba(15,22,20,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  /** Gate arch, lamp posts, harbour pier and the flag — drawn, never collided. */
  private drawPrisonDecor(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (!this.prisonDecor.length) return;
    for (const d of this.prisonDecor) {
      if (d.x + d.w < camX - 120 || d.x > camX + this.w + 120 || d.y + d.h < camY - 120 || d.y > camY + this.h + 120) continue;
      if (d.kind === 'lamp') {
        const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 120);
        g.addColorStop(0, 'rgba(255,206,130,0.30)');
        g.addColorStop(1, 'rgba(255,206,130,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, TAU); ctx.fill();
        ctx.fillStyle = '#20282a'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd88f'; ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, TAU); ctx.fill();
      } else if (d.kind === 'gatearch') {
        // A gatehouse, not a gap in a wall: deep stone jambs, a lintel, lit lamps and a
        // painted threshold that says "walk in here".
        const jamb = 34;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(d.x + 8, d.y + 10, d.w, d.h);
        ctx.fillStyle = '#535e54';
        ctx.fillRect(d.x, d.y, d.w, jamb);                       // north jamb
        ctx.fillRect(d.x, d.y + d.h - jamb, d.w, jamb);          // south jamb
        ctx.fillStyle = '#414b44';
        ctx.fillRect(d.x + 8, d.y + jamb - 10, d.w - 16, 12);
        ctx.fillRect(d.x + 8, d.y + d.h - jamb - 2, d.w - 16, 12);
        // painted threshold across the opening
        const th = ctx.createLinearGradient(d.x - 60, 0, d.x + d.w + 10, 0);
        th.addColorStop(0, 'rgba(255,206,130,0)');
        th.addColorStop(0.55, 'rgba(255,206,130,0.16)');
        th.addColorStop(1, 'rgba(255,206,130,0.30)');
        ctx.fillStyle = th;
        ctx.fillRect(d.x - 60, d.y + jamb, d.w + 70, d.h - jamb * 2);
        ctx.strokeStyle = 'rgba(255,209,102,0.55)'; ctx.lineWidth = 3;
        ctx.setLineDash([16, 12]);
        ctx.beginPath();
        ctx.moveTo(d.x - 54, d.y + jamb + 6); ctx.lineTo(d.x + d.w, d.y + jamb + 6);
        ctx.moveTo(d.x - 54, d.y + d.h - jamb - 6); ctx.lineTo(d.x + d.w, d.y + d.h - jamb - 6);
        ctx.stroke(); ctx.setLineDash([]);
        // lamps and the sign
        for (const ly of [d.y + jamb / 2, d.y + d.h - jamb / 2]) {
          const g2 = ctx.createRadialGradient(d.x + 16, ly, 1, d.x + 16, ly, 46);
          g2.addColorStop(0, 'rgba(255,120,90,0.55)'); g2.addColorStop(1, 'rgba(255,120,90,0)');
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(d.x + 16, ly, 46, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff8f7a'; ctx.beginPath(); ctx.arc(d.x + 16, ly, 4, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(14,20,18,0.85)';
        ctx.fillRect(d.x + 30, d.y + d.h / 2 - 11, 96, 22);
        ctx.strokeStyle = 'rgba(255,209,102,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(d.x + 30, d.y + d.h / 2 - 11, 96, 22);
        ctx.fillStyle = 'rgba(255,209,102,0.9)';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText('SALLY PORT', d.x + 36, d.y + d.h / 2 + 4);
      } else if (d.kind === 'pier') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(d.x + 3, d.y + 5, d.w, d.h);
        ctx.fillStyle = '#5a5140'; ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = 'rgba(20,16,10,0.6)'; ctx.lineWidth = 2;
        for (let x = d.x; x < d.x + d.w; x += 18) { ctx.beginPath(); ctx.moveTo(x, d.y); ctx.lineTo(x, d.y + d.h); ctx.stroke(); }
        ctx.fillStyle = '#2c332f';
        for (let x = d.x + 30; x < d.x + d.w; x += 90) ctx.fillRect(x, d.y + 30, 10, 12);
      } else if (d.kind === 'flag') {
        const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
        ctx.fillStyle = '#8d968f'; ctx.fillRect(cx - 2, cy - 70, 4, 70);
        const flap = Math.sin(this.simulationTime * 2.2) * 4;
        ctx.fillStyle = '#8b2f2f';
        ctx.beginPath(); ctx.moveTo(cx + 2, cy - 68); ctx.lineTo(cx + 46 + flap, cy - 58);
        ctx.lineTo(cx + 2, cy - 44); ctx.closePath(); ctx.fill();
      }
    }
  }

  /** 2.5D extruded structures with per-kind materials. */

  /* ---------------- weather and the army, drawn ---------------- */

  /** Snow (or dust / slurry) lying on the ground, under every road and building. */
  private drawSnowCover(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const d = this.dressing;
    if (!d || (!d.snow && !d.dust && !d.marsh && !d.slag)) return;
    const t = this.simulationTime;
    if (d.snow) {
      // a cold wash over the whole visible ground; roads are painted on top of it
      const g = ctx.createLinearGradient(camX, camY, camX + this.w * 0.6, camY + this.h);
      g.addColorStop(0, 'rgba(228,242,248,0.14)');
      g.addColorStop(0.55, 'rgba(206,226,236,0.10)');
      g.addColorStop(1, 'rgba(186,212,224,0.08)');
      ctx.fillStyle = g;
      ctx.fillRect(camX - 20, camY - 20, this.w + 40, this.h + 40);
      // wind-scoured streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 3;
      const step = 180;
      const y0 = Math.floor(camY / step) * step;
      for (let y = y0; y < camY + this.h + step; y += step) {
        ctx.beginPath();
        const phase = Math.sin(t * 0.2 + y * 0.01) * 30;
        for (let x = camX - 40; x < camX + this.w + 40; x += 90) {
          const yy = y + Math.sin((x + phase) * 0.006) * 12;
          if (x === camX - 40) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (d.dust) {
      ctx.fillStyle = 'rgba(190,120,70,0.055)';
      ctx.fillRect(camX - 20, camY - 20, this.w + 40, this.h + 40);
    } else if (d.marsh) {
      ctx.fillStyle = 'rgba(90,140,60,0.045)';
      ctx.fillRect(camX - 20, camY - 20, this.w + 40, this.h + 40);
    } else if (d.slag) {
      ctx.fillStyle = 'rgba(120,60,70,0.05)';
      ctx.fillRect(camX - 20, camY - 20, this.w + 40, this.h + 40);
    }
  }

  /** Cleared lanes, heaps, and the ploughs still working them. */
  private drawSnowWorks(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const d = this.dressing;
    if (!d) return;
    const on = (x: number, y: number, pad = 160) =>
      x > camX - pad && x < camX + this.w + pad && y > camY - pad && y < camY + this.h + pad;

    // freshly cleared asphalt: the snow is gone where the blade has been
    if (d.snow) {
      for (const l of this.clearedLanes) {
        if (!on(l.x, l.y, 200)) continue;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.ang);
        ctx.globalAlpha = Math.min(0.9, l.t / 8);
        ctx.fillStyle = '#20292c';
        ctx.fillRect(-l.len / 2, -l.w / 2, l.len, l.w);
        ctx.fillStyle = 'rgba(230,242,248,0.20)';
        ctx.fillRect(-l.len / 2, -l.w / 2 + 6, l.len, 6);
        ctx.restore();
      }
    }

    // the heaps themselves
    for (const b of this.snowBanks) {
      if (!on(b.x, b.y, b.r + 60)) continue;
      const fill = Math.min(1.6, b.fill);
      const r = b.r * (0.7 + fill * 0.5);
      const h = b.h * (0.6 + fill * 0.7);
      if (d.snow) {
        ctx.fillStyle = 'rgba(226,242,250,0.72)';
        ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * 0.66, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(b.x - r * 0.18, b.y - h * 0.35, r * 0.62, r * 0.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(140,170,186,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(b.x, b.y + r * 0.2, r * 0.9, r * 0.5, 0, 0, TAU); ctx.stroke();
      } else if (d.dust) {
        ctx.fillStyle = 'rgba(168,104,62,0.45)';
        ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      } else if (d.marsh) {
        ctx.fillStyle = 'rgba(74,104,52,0.4)';
        ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * 0.55, 0, 0, TAU); ctx.fill();
      } else if (d.slag) {
        ctx.fillStyle = 'rgba(96,64,70,0.4)';
        ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * 0.55, 0, 0, TAU); ctx.fill();
      }
    }

    // the ploughs: a heavy truck with a blade, a flashing amber bar, and a spray of snow
    for (const p of this.ploughs) {
      if (!on(p.x, p.y, 220)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-62, -30, 132, 66);
      // chassis
      ctx.fillStyle = '#8a5a1e';                       // municipal orange
      ctx.fillRect(-58, -28, 116, 56);
      ctx.fillStyle = '#6d4416';
      ctx.fillRect(-58, 6, 116, 22);
      // cab
      ctx.fillStyle = '#a9722a';
      ctx.fillRect(12, -24, 40, 48);
      ctx.fillStyle = 'rgba(190,230,240,0.55)';
      ctx.fillRect(20, -18, 26, 36);
      // the hopper on the back
      ctx.fillStyle = '#5f4a20';
      ctx.fillRect(-52, -22, 56, 44);
      // blade, angled to the side it throws to
      ctx.save();
      ctx.translate(62, 0);
      ctx.rotate(p.side * 0.42);
      ctx.fillStyle = '#c9d4d8';
      ctx.fillRect(-6, -46, 14, 92);
      ctx.fillStyle = 'rgba(160,180,190,0.8)';
      ctx.fillRect(-6, -46, 5, 92);
      ctx.restore();
      // amber beacon
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(this.simulationTime * 6 + p.ax));
      ctx.fillStyle = `rgba(255,180,60,${blink})`;
      ctx.beginPath(); ctx.arc(32, -30, 6, 0, TAU); ctx.fill();
      // wheels
      ctx.fillStyle = '#14181a';
      for (const [wx, wy] of [[-40, -32], [-40, 32], [32, -32], [32, 32]] as [number, number][]) {
        ctx.beginPath(); ctx.arc(wx, wy, 11, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // snow spray off the blade
      if (d.snow && p.blade > 0.35) {
        const nx = p.nx, ny = p.ny;
        ctx.fillStyle = 'rgba(240,250,255,0.35)';
        for (let i = 0; i < 4; i++) {
          const a = p.blade * 6 + i * 1.7;
          const dd = 18 + ((this.simulationTime * 90 + i * 37) % 70);
          ctx.beginPath();
          ctx.arc(p.x + nx * dd + Math.cos(a) * 10, p.y + ny * dd + Math.sin(a) * 10, 2.4, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  /**
   * A fifth-generation interceptor in plan view: long chined nose, diamond wing with a
   * cropped trailing edge, canted twin tails and two engines. Drawn at ~120 m long so it
   * reads as an aircraft next to a 2 m soldier.
   */
  private drawFighter(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number,
    alt: number, scale: number, boost: number, friendly: boolean, parked: boolean,
    tier: JetTier = 'standard', loadout = 0, aceTrim = false, damage = 0) {
    ctx.save();
    ctx.translate(x, y - alt * 0.22);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    // A prototype is finished in graphite with sand-gold trim: recognisable on the apron
    // from across the airfield, and recognisable in a dogfight from behind. The Frostwing
    // is pale ice-blue with a lit spine.
    const ace = tier === 'prototype';
    const frost = tier === 'frostwing';
    /* FRIENDLY AIRFRAMES USED TO BE PAINTED PALE SAGE (#a9bdb4). Close up, that filled the
     * viewport with a near-white slab the moment the operative strapped in. The finish is
     * now a proper low-contrast grey-green, and the icy machine is a colder steel blue:
     * readable against tarmac and cloud, and no longer a white-out. */
    const body = ace ? (friendly ? '#4c4a53' : parked ? '#39383f' : '#403f47')
      : frost ? (parked ? '#7fa6b4' : '#8fb9c8')
      : friendly ? '#77897f' : parked ? '#5a6650' : '#4f5947';
    const dark = ace ? '#232228' : frost ? '#4d6d78' : friendly ? '#4b5a54' : '#333a2b';
    // wings: diamond planform, leaning back from the intakes to the tail
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(14, 9);
    ctx.lineTo(-6, 62);
    ctx.lineTo(-26, 60);
    ctx.lineTo(-18, 10);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-26, -60);
    ctx.lineTo(-6, -62);
    ctx.lineTo(14, -9);
    ctx.closePath();
    ctx.fill();
    // trailing-edge flaps / tailplanes
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-30, 16); ctx.lineTo(-44, 40); ctx.lineTo(-54, 38); ctx.lineTo(-50, 14);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-30, -16); ctx.lineTo(-44, -40); ctx.lineTo(-54, -38); ctx.lineTo(-50, -14);
    ctx.closePath(); ctx.fill();
    // fuselage: chined forebody tapering to a point
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(58, 0);
    ctx.lineTo(30, -8);
    ctx.lineTo(6, -13);
    ctx.lineTo(-46, -11);
    ctx.lineTo(-56, -7);
    ctx.lineTo(-56, 7);
    ctx.lineTo(-46, 11);
    ctx.lineTo(6, 13);
    ctx.lineTo(30, 8);
    ctx.closePath(); ctx.fill();
    // intakes
    ctx.fillStyle = ace ? '#1b1a20' : '#2b3329';
    ctx.fillRect(8, -14, 18, 6);
    ctx.fillRect(8, 8, 18, 6);
    if (ace || frost) {
      // gold cheat line down the spine and two canard slivers ahead of the wing root
      ctx.fillStyle = frost ? '#eafcff' : friendly ? '#9fe8ff' : '#dfbd78';
      ctx.fillRect(-42, -2.2, 62, 4.4);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(20, 11); ctx.lineTo(4, 22); ctx.lineTo(2, 12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(20, -11); ctx.lineTo(4, -22); ctx.lineTo(2, -12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = friendly ? 'rgba(180,245,255,0.9)' : 'rgba(223,189,120,0.9)';
      ctx.fillRect(-52, -3, 5, 6);
    }
    /* panel lines: an airframe, not a silhouette */
    ctx.strokeStyle = 'rgba(20,28,24,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-30, -9); ctx.lineTo(2, -9);
    ctx.moveTo(-30, 9); ctx.lineTo(2, 9);
    ctx.moveTo(-44, -5); ctx.lineTo(-44, 5);
    ctx.moveTo(-20, -30); ctx.lineTo(-20, -12);
    ctx.moveTo(-20, 30); ctx.lineTo(-20, 12);
    ctx.stroke();
    // canopy: tinted glass with a razor highlight along the rail
    const glass = ctx.createLinearGradient(12, -6, 40, 6);
    glass.addColorStop(0, frost ? 'rgba(196,236,246,0.8)' : ace ? 'rgba(160,190,214,0.8)' : 'rgba(150,196,210,0.72)');
    glass.addColorStop(1, frost ? 'rgba(120,196,224,0.8)' : 'rgba(70,104,120,0.85)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(26, 0, 15, 6, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,248,0.4)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.ellipse(26, 0, 15, 6, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(235,248,255,0.38)';
    ctx.fillRect(16, -2.4, 16, 1.8);

    /* WING STATIONS: a loaded aircraft reads as armed from above. */
    if (loadout > 0 && !parked) {
      const pairs = Math.min(3, Math.ceil(loadout / 2));
      for (let i = 0; i < pairs; i++) {
        for (const side of [-1, 1]) {
          const wy = side * (22 + i * 14);
          const wx = -6 - i * 4;
          ctx.fillStyle = '#c9d3d8';
          ctx.beginPath(); ctx.roundRect(wx - 9, wy - 2.2, 18, 4.4, 2); ctx.fill();
          ctx.fillStyle = friendly ? '#ffd9a0' : '#ffb28a';
          ctx.fillRect(wx + 8, wy - 1.6, 4, 3.2);
        }
      }
    }
    /* navigation lights: red to port, green to starboard, white at the tail */
    if (!parked) {
      const blink = 0.55 + Math.sin(this.simulationTime * 4) * 0.45;
      ctx.fillStyle = `rgba(255,90,90,${blink})`;
      ctx.beginPath(); ctx.arc(-12, 58, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(120,255,150,${blink})`;
      ctx.beginPath(); ctx.arc(-12, -58, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(240,250,255,0.85)';
      ctx.beginPath(); ctx.arc(-56, 0, 2, 0, TAU); ctx.fill();
    }
    /* squadron ace: a gold stripe over the wings */
    if (aceTrim) {
      ctx.fillStyle = 'rgba(255,214,130,0.9)';
      ctx.fillRect(-22, 12, 40, 3.2);
      ctx.fillRect(-22, -15.2, 40, 3.2);
    }
    /* sides: a friendly airframe wears cyan bands, a hostile one wears HYDRA red. In a
     * turning fight that is the only thing that has to be readable at a glance. */
    if (!parked) {
      ctx.fillStyle = friendly ? 'rgba(120,235,255,0.85)' : 'rgba(255,96,84,0.8)';
      ctx.fillRect(2, 26, 9, 26);
      ctx.fillRect(2, -52, 9, 26);
      ctx.fillStyle = friendly ? 'rgba(160,245,255,0.55)' : 'rgba(255,120,100,0.45)';
      ctx.fillRect(30, -7, 4, 14);
    }
    /* battle damage: dark patches and leaking smoke */
    if (damage > 0.55) {
      ctx.fillStyle = `rgba(24,20,18,${Math.min(0.6, (damage - 0.55) * 1.6)})`;
      ctx.beginPath(); ctx.ellipse(-16, 18, 12, 7, 0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-34, -8, 8, 5, -0.2, 0, TAU); ctx.fill();
    }
    // canted twin tails
    ctx.fillStyle = dark;
    ctx.save(); ctx.rotate(0.26); ctx.fillRect(-48, -20, 12, 20); ctx.restore();
    ctx.save(); ctx.rotate(-0.26); ctx.fillRect(-48, 0, 12, 20); ctx.restore();
    // engine nozzles
    ctx.fillStyle = '#20261f';
    ctx.fillRect(-60, -9, 6, 6);
    ctx.fillRect(-60, 3, 6, 6);
    if (!parked || boost > 0.05) {
      const flame = 6 + boost * 40 + Math.sin(this.simulationTime * 34) * 3;
      for (const sy of [-6, 6]) {
        const g = ctx.createLinearGradient(-58, sy, -58 - flame, sy);
        g.addColorStop(0, boost > 0.4 ? 'rgba(235,252,255,1)' : 'rgba(160,215,255,0.72)');
        g.addColorStop(0.4, boost > 0.4 ? 'rgba(150,225,255,0.85)' : 'rgba(130,190,240,0.5)');
        g.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-58, sy - (boost > 0.4 ? 6.5 : 5));
        ctx.lineTo(-58 - flame, sy);
        ctx.lineTo(-58, sy + (boost > 0.4 ? 6.5 : 5));
        ctx.closePath(); ctx.fill();
        // shock diamonds in a hard burner
        if (boost > 0.45) {
          for (let d = 0; d < 3; d++) {
            const dx = -62 - d * (flame * 0.24);
            ctx.fillStyle = `rgba(255,255,255,${0.5 - d * 0.14})`;
            ctx.beginPath(); ctx.ellipse(dx, sy, 2.2 - d * 0.5, 1.6, 0, 0, TAU); ctx.fill();
          }
        }
      }
      if (boost > 0.6) {
        const haze = ctx.createRadialGradient(-70, 0, 2, -70, 0, 30 + boost * 24);
        haze.addColorStop(0, 'rgba(200,240,255,0.28)');
        haze.addColorStop(1, 'rgba(200,240,255,0)');
        ctx.fillStyle = haze;
        ctx.beginPath(); ctx.arc(-70, 0, 30 + boost * 24, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** A burnt-out airframe on the deck: broken spine, no canopy, smoke off the engines. */
  private drawJetWreck(ctx: CanvasRenderingContext2D, j: ArmyJet) {
    const t = j.wreckT ?? 0;
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.rotate(j.ang);
    // scorched ground and the shadow of a hull that is never moving again
    ctx.fillStyle = 'rgba(10,10,10,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 0, 120, 66, 0, 0, TAU); ctx.fill();
    // the airframe, canted: one wing in the dirt, the spine broken behind the cockpit
    ctx.rotate(0.22);
    ctx.fillStyle = '#2b2a28';
    ctx.beginPath();
    ctx.moveTo(96, 12); ctx.lineTo(46, -16); ctx.lineTo(-34, -22); ctx.lineTo(-112, -6);
    ctx.lineTo(-96, 26); ctx.lineTo(-6, 34); ctx.lineTo(52, 30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1a19';
    ctx.beginPath(); ctx.moveTo(-8, 24); ctx.lineTo(-96, 74); ctx.lineTo(-128, 60); ctx.lineTo(-52, 18); ctx.closePath(); ctx.fill();
    // burnt through: a hole where the cockpit was, hot metal still glowing
    ctx.fillStyle = '#0d0c0b';
    ctx.beginPath(); ctx.ellipse(30, 0, 26, 15, 0.1, 0, TAU); ctx.fill();
    const heat = Math.max(0, 1 - t / 40);
    if (heat > 0) {
      ctx.fillStyle = `rgba(255,${110 + 70 * heat},60,${0.25 * heat})`;
      ctx.beginPath(); ctx.ellipse(-40, 6, 30, 12, 0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // smoke: thinning as it cools
    if (heat > 0 && Math.random() < 0.5) {
      this.addParticle(j.x + rand(-30, 30), j.y + rand(-16, 16),
        rand(-14, 14), rand(-46, -14), rand(0.8, 1.7), rand(4, 9),
        heat > 0.5 ? '#3a3a3a' : '#6f7376', true);
    }
    ctx.fillStyle = 'rgba(255,150,140,0.8)';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WRECK · ${j.serial ?? 'AIRFRAME LOST'}`, j.x, j.y - 84);
    ctx.textAlign = 'left';
  }

  /**
   * The airframes, drawn in their own pass ABOVE the ground war. A tank must never be
   * painted over an aircraft: whatever is on the ground is below the aircraft, always.
   */
  private drawArmyAircraft(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const on = (x: number, y: number, pad = 220) =>
      x > camX - pad && x < camX + this.w + pad && y > camY - pad && y < camY + this.h + pad;
    // Interceptors: modelled on a real fifth-generation fighter — long nose, diamond
    // wing, canted twin tails, twin engines — and big enough to read from the ground.
    for (const j of this.armyJets) {
      if (!on(j.x, j.y, 300)) continue;
      const flying = j.state !== 'parked' && !j.wreck && !j.manned;
      // Squadron aces fly a heavier airframe: a longer wingspan reads at a glance.
      const scale = j.ace ? 2.42 : flying ? 2.1 : 2.1;
      /* A WRECK IS A WRECK. A shot-down hull is drawn burnt, canted over on one wing and
       * smoking where it lies — nobody can mistake it for a serviceable aircraft, and
       * there is no board prompt on it. */
      if (j.wreck) {
        this.drawJetWreck(ctx, j);
        continue;
      }
      if (this.playerJet === j) {
        // the operative's own airframe sits in a cold pool of light, so it can be found
        // in a four-aircraft dogfight without looking at the HUD
        const glow = ctx.createRadialGradient(j.x, j.y, 10, j.x, j.y, 130);
        glow.addColorStop(0, 'rgba(150,235,255,0.09)');
        glow.addColorStop(1, 'rgba(150,235,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(j.x, j.y, 130, 0, TAU); ctx.fill();
      }
      if (this.playerJet === j || flying) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(j.x, j.y + (j.alt * 0.22) + 6, 96, 34, j.ang, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      this.drawFighter(ctx, j.x, j.y, j.ang, this.playerJet === j ? j.alt : flying ? j.alt : 0,
        scale, this.playerJet === j ? (j.boost || 0) : flying ? 0.35 : 0, this.playerJet === j,
        !this.playerJet && !flying, j.tier,
        this.playerJet === j ? (j.missiles ?? 0) : 0, !!j.ace, 1 - j.hp / Math.max(1, j.maxHp));
      if (this.playerJet === j || flying) {
        const frac = Math.max(0, j.hp / j.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(j.x - 40, j.y - 96, 80, 6);
        ctx.fillStyle = frac > 0.4 ? '#ffd8a0' : '#ff7a6a';
        ctx.fillRect(j.x - 40, j.y - 96, 80 * frac, 6);
      }
      if (this.playerJet === j) {
        // The cockpit overlay in drawJetOverlay carries the instruments; the only thing
        // worth drawing over the airframe is the burner flame it is already inside.
      } else if (!flying && !j.wreck && !this.playerJet && this.nearArmyJet() === j) {
        ctx.fillStyle = j.tier === 'prototype' ? 'rgba(255,222,160,0.95)'
          : j.tier === 'frostwing' ? 'rgba(200,246,255,0.98)' : 'rgba(200,240,255,0.9)';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(j.ready ? 'F · BOARD'
          : j.tier === 'prototype' ? 'F · ORDER PROTOTYPE OUT'
          : j.tier === 'frostwing' ? 'F · ORDER THE FROSTWING OUT'
          : 'F · ORDER TAKE-OFF', j.x, j.y - 96);
        ctx.textAlign = 'left';
      } else if (!flying && j.tier === 'frostwing' && on(j.x, j.y, 60)) {
        ctx.fillStyle = 'rgba(190,244,255,0.85)';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FROSTWING', j.x, j.y - 92);
        ctx.textAlign = 'left';
      } else if (!flying && j.tier === 'prototype' && on(j.x, j.y, 60)) {
        // Even from a distance the experimental machine is marked, so it can be found.
        ctx.fillStyle = 'rgba(223,189,120,0.75)';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PROTOTYPE', j.x, j.y - 92);
        ctx.textAlign = 'left';
      }
    }

    /* GROUND CREW, on foot, on their way to the aircraft. This is the visible first link of
     * the take-off chain: if nobody walks out, nothing flies. */
    for (const c of this.launchCrew) {
      if (!on(c.x, c.y, 60)) continue;
      const bob = Math.sin(c.t * 9) * 1.6;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(2, 8, 9, 5, 0, 0, TAU); ctx.fill();
      // hi-vis vest and a helmet, not a soldier: these are the fitters and the pilot
      ctx.fillStyle = c.kind === 'pilot' ? '#8fb9c8' : '#d8c07a';
      ctx.beginPath(); ctx.roundRect(-6, -6 + bob, 12, 15, 4); ctx.fill();
      ctx.fillStyle = c.kind === 'pilot' ? '#4d6d78' : '#8a7434';
      ctx.beginPath(); ctx.arc(0, -9 + bob, 5.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(232,246,255,0.85)';
      ctx.beginPath(); ctx.arc(-1.2, -10 + bob, 2.1, 0, TAU); ctx.fill();
      ctx.restore();
    }

  }

  /** Emplacements, jets, the base banner: everything that belongs to the army. */
  /**
   * The base at night is a line of lights.
   *
   * Runway edge lamps, apron floodlights, the parade floodlights and the gate: each fixture
   * in the district throws a pool on the concrete, so the compound reads as an installation
   * under power instead of a scatter of shapes in the dark. Purely additive drawing — the
   * fixtures exist in the world already, this only paints what they are for.
   */
  private drawArmyLamps(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (!this.army || this.sector < 6) return;
    const pad = 200;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.obstacles) {
      if (o.dead || o.kind !== 'lamp') continue;
      if (o.x < camX - pad || o.x > camX + this.w + pad || o.y < camY - pad || o.y > camY + this.h + pad) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const runway = o.w <= 16;
      const r = runway ? 54 : 120;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, runway ? 'rgba(190,235,210,0.30)' : 'rgba(255,235,180,0.28)');
      g.addColorStop(0.55, runway ? 'rgba(150,215,190,0.09)' : 'rgba(255,225,160,0.07)');
      g.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.72, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  private drawArmyWorks(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    // Interceptors are not tied to a base: a jet taken out of the glacier flies wherever it
    // is parked, so the aircraft, its ordnance and its seeker are drawn in every sector.
    const on = (x: number, y: number, pad = 220) =>
      x > camX - pad && x < camX + this.w + pad && y > camY - pad && y < camY + this.h + pad;

    // emplacements: a sandbagged pit, twin barrels, and a shield when it is mine
    for (const t of this.armyTurrets) {
      if (!on(t.x, t.y)) continue;
      const mine = t.owner === 'player';
      ctx.save();
      ctx.translate(t.x, t.y);
      /* THE PIT IS DRAWN AS A PIT: a dug emplacement with a sandbag parapet around it and
       * a concrete floor, and the barrels come out over the low side. Drawn this way the
       * mount has a clear firing arc and the eye can see where its own parapet is, which
       * is the whole reason the crew refuses to shoot inside 150 px. */
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(2, 7, 52, 26, 0, 0, TAU); ctx.fill();
      // dug floor, ringed by the parapet
      ctx.fillStyle = mine ? '#2c4a52' : '#413f30';
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = mine ? '#37616b' : '#4d4a37';
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
      // sandbag parapet: an arc of bags, open toward the guns
      for (let i = 0; i < 15; i++) {
        const a = t.ang + Math.PI + (i / 14 - 0.5) * Math.PI * 1.35;
        const bx = Math.cos(a) * 46, by = Math.sin(a) * 46;
        ctx.fillStyle = i % 2 ? '#7d7050' : '#8a7c58';
        ctx.beginPath(); ctx.ellipse(bx, by, 11, 7, a, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.strokeStyle = mine ? 'rgba(150,235,255,0.7)' : 'rgba(200,180,120,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.stroke();
      // turret body
      ctx.fillStyle = mine ? '#3f6d78' : '#4a5142';
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
      ctx.rotate(t.ang);
      // twin barrels
      const recoil = t.muzzle * 6;
      ctx.fillStyle = '#1d2224';
      ctx.fillRect(16 - recoil, -11, 46, 7);
      ctx.fillRect(16 - recoil, 4, 46, 7);
      ctx.fillStyle = mine ? '#9fe8ff' : '#c8b070';
      ctx.fillRect(16, -9, 12, 3);
      ctx.fillRect(16, 6, 12, 3);
      // muzzle flash
      if (t.flash > 0) {
        ctx.fillStyle = 'rgba(255,220,150,0.9)';
        ctx.beginPath(); ctx.arc(62, 0, 14 * (1 + t.flash * 4), 0, TAU); ctx.fill();
      }
      ctx.restore();
      // health pip
      const frac = Math.max(0, Math.min(1, t.hp / t.maxHp));
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(t.x - 28, t.y - 52, 56, 6);
      ctx.fillStyle = frac > 0.45 ? (mine ? '#7fe0ff' : '#e0c070') : '#ff8f6a';
      ctx.fillRect(t.x - 28, t.y - 52, 56 * frac, 6);
      if (!mine && frac <= 0.75) {
        const canSeize = Math.hypot(t.x - this.px, t.y - this.py) < 150;
        ctx.fillStyle = canSeize ? 'rgba(190,250,255,0.95)' : 'rgba(180,240,255,0.55)';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(canSeize ? 'F · SEIZE' : 'CREW SHAKEN', t.x, t.y - 60);
        ctx.textAlign = 'left';
      }
    }

    /* CONTRAILS: a tapering ribbon behind the aircraft, plus vapour off the wingtips. */
    const pjTrail = this.playerJet;
    if (this.jetTrail.length > 1) {
      for (let i = 1; i < this.jetTrail.length; i++) {
        const a = this.jetTrail[i - 1], b = this.jetTrail[i];
        if (!on(b.x, b.y, 400)) continue;
        const k = Math.max(0, b.t / 0.55);
        ctx.strokeStyle = pjTrail && pjTrail.tier === 'frostwing'
          ? `rgba(186,236,246,${0.22 * k})`
          : `rgba(176,206,222,${0.17 * k})`;
        ctx.lineWidth = 2 + 7 * k;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    for (const t of this.jetTrail) {
      if (!on(t.x, t.y)) continue;
      const a = Math.max(0, t.t / 0.55);
      ctx.fillStyle = `rgba(${pjTrail && pjTrail.tier === 'frostwing' ? '190,244,255' : '190,220,240'},${a * 0.32})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, 9 * a + 2, 0, TAU); ctx.fill();
    }
    /* vapour cones: the wingtips pull cloud when the aircraft is fast and turning hard */
    if (pjTrail && pjTrail.speed > 900) {
      const k = Math.min(1, (pjTrail.speed - 900) / 1200);
      for (const side of [-1, 1]) {
        const tx = pjTrail.x + Math.cos(pjTrail.ang + Math.PI / 2) * side * 54 - Math.cos(pjTrail.ang) * 18;
        const ty = pjTrail.y + Math.sin(pjTrail.ang + Math.PI / 2) * side * 54 - Math.sin(pjTrail.ang) * 18;
        const g = ctx.createRadialGradient(tx, ty, 1, tx, ty, 20 + k * 16);
        g.addColorStop(0, `rgba(255,255,255,${0.28 + k * 0.36})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(tx, ty, 20 + k * 16, 0, TAU); ctx.fill();
      }
    }
    for (const m of this.jetMissiles) {
      if (!on(m.x, m.y)) continue;
      const a = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(a);
      ctx.fillStyle = '#dfe9ef';
      ctx.beginPath(); ctx.roundRect(-12, -3, 24, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,140,0.9)';
      ctx.beginPath(); ctx.moveTo(-12, -3); ctx.lineTo(-26, 0); ctx.lineTo(-12, 3); ctx.fill();
      ctx.restore();
    }
    // hostile air-to-air rockets coming the other way
    for (const m of this.enemyRockets) {
      if (!on(m.x, m.y)) continue;
      const a = Math.atan2(m.vy, m.vx);
      const live = m.spooked <= 0;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(a);
      ctx.fillStyle = live ? '#e6d2c4' : '#8b8f94';
      ctx.beginPath(); ctx.roundRect(-14, -3.5, 26, 7, 3); ctx.fill();
      ctx.fillStyle = live ? 'rgba(255,140,80,0.95)' : 'rgba(150,150,150,0.5)';
      ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-32, 0); ctx.lineTo(-14, 4); ctx.fill();
      ctx.restore();
      if (live && this.playerJet) {
        const pulse = 0.4 + Math.sin(this.simulationTime * 18) * 0.3;
        ctx.strokeStyle = `rgba(255,110,90,${pulse})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(m.x, m.y, 24, 0, TAU); ctx.stroke();
      }
    }
    /* SALVO ROCKETS: a bright motor and a smoke trail, close to the ground */
    for (const r of this.jetRockets) {
      if (!on(r.x, r.y)) continue;
      const a = Math.atan2(r.vy, r.vx);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(232,238,240,0.55)';
      ctx.beginPath(); ctx.ellipse(-22, 0, 24, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8dee2';
      ctx.beginPath(); ctx.roundRect(-10, -2.6, 20, 5.2, 2.6); ctx.fill();
      ctx.fillStyle = 'rgba(255,196,120,0.95)';
      ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-30, 0); ctx.lineTo(-10, 3); ctx.fill();
      ctx.restore();
    }

    /* LANCE BEAMS: a white line of cold light with a hot core */
    for (const b of this.lanceBeams) {
      const k = b.life / b.max;
      const ex = b.x + Math.cos(b.ang) * 2600, ey = b.y + Math.sin(b.ang) * 2600;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(b.x, b.y, ex, ey);
      g.addColorStop(0, `rgba(225,250,255,${0.85 * k})`);
      g.addColorStop(0.7, `rgba(150,235,255,${0.5 * k})`);
      g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 16 * k;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.lineWidth = 4 * k;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
      // muzzle bloom
      const bloom = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 120 * k);
      bloom.addColorStop(0, `rgba(210,248,255,${0.7 * k})`);
      bloom.addColorStop(1, 'rgba(210,248,255,0)');
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(b.x, b.y, 120 * k, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // seeker box on whatever the nose is holding
    const pj = this.playerJet;
    if (pj && pj.lock) {
      const l = pj.lock;
      ctx.save();
      ctx.strokeStyle = l.air ? 'rgba(160,240,255,0.9)' : 'rgba(255,210,140,0.9)';
      ctx.lineWidth = 2;
      const s2 = 26;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(l.x + sx * s2, l.y + sy * s2 - sy * 10);
        ctx.lineTo(l.x + sx * s2, l.y + sy * s2);
        ctx.lineTo(l.x + sx * s2 - sx * 10, l.y + sy * s2);
        ctx.stroke();
      }
      // inner ring closes as the seeker settles: a visible lock tone
      const settle = 0.5 + Math.sin(this.simulationTime * 14) * 0.5;
      ctx.strokeStyle = l.air ? `rgba(180,245,255,${0.35 + settle * 0.4})` : `rgba(255,214,150,${0.3 + settle * 0.35})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(l.x, l.y, 16 + settle * 6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l.x - 6, l.y); ctx.lineTo(l.x + 6, l.y);
      ctx.moveTo(l.x, l.y - 6); ctx.lineTo(l.x, l.y + 6); ctx.stroke();
      // lead pipper: where the target will be when a missile arrives
      const d = Math.hypot(l.x - pj.x, l.y - pj.y);
      const t = d / 900;
      const px2 = l.x + this.pvx * t * 0.5, py2 = l.y + this.pvy * t * 0.5;
      ctx.strokeStyle = 'rgba(255,240,200,0.7)';
      ctx.beginPath(); ctx.arc(px2, py2, 4, 0, TAU); ctx.stroke();
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillStyle = l.air ? '#bff2ff' : '#ffd8a0';
      ctx.textAlign = 'center';
      ctx.fillText(`${l.label} · ${Math.round(d)}m`, l.x, l.y - 38);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // base signage on the approach and over the parade ground
    const a = this.army;
    if (!a) return;
    if (on(a.base.x + a.base.w / 2, a.base.y, 900)) {
      ctx.save();
      ctx.fillStyle = 'rgba(214,224,170,0.5)';
      ctx.font = 'bold 52px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('IRON RESERVE', a.base.x + a.base.w / 2, a.base.y - 120);
      ctx.font = '16px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(214,224,170,0.35)';
      ctx.fillText('ARMY GROUP SOUTH · AUTHORISED PERSONNEL ONLY', a.base.x + a.base.w / 2, a.base.y - 92);
      ctx.restore();
    }
    if (on(a.hq.x, a.hq.y, 700)) {
      ctx.save();
      ctx.fillStyle = this.armyAlerted ? 'rgba(255,140,120,0.35)' : 'rgba(214,224,170,0.22)';
      ctx.font = 'bold 30px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.armyAlerted ? 'GENERAL QUARTERS' : 'COMMAND BUNKER', a.hq.x, a.hq.y - 120);
      ctx.restore();
    }
  }

  /** Parked road vehicles: body, cabin, glass, wheels, and a lit roof. */
  private drawVehicleProp(ctx: CanvasRenderingContext2D, o: Rect) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const horiz = o.w >= o.h;
    const L = (horiz ? o.w : o.h) / 2;
    const Wd = (horiz ? o.h : o.w) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (!horiz) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(-L + 6, -Wd + 8, L * 2, Wd * 2, 8); ctx.fill();
    const body = o.kind === 'humvee' ? (o.tint || '#5a6349')
      : o.kind === 'bus' ? '#33474a' : o.kind === 'tanker' ? '#6a5f45' : (o.tint || '#7a7f6a');
    // chassis
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(-L, -Wd, L * 2, Wd * 2, o.kind === 'car' ? 10 : 6); ctx.fill();
    // cabin
    ctx.fillStyle = 'rgba(20,26,22,0.5)';
    ctx.beginPath();
    ctx.roundRect(-L * 0.34, -Wd * 0.78, L * 0.72, Wd * 1.56, 5);
    ctx.fill();
    // windscreen
    ctx.fillStyle = 'rgba(150,200,215,0.5)';
    if (o.kind === 'bus') {
      for (let i = 0; i < 5; i++) ctx.fillRect(-L * 0.3 + i * L * 0.14, -Wd * 0.62, L * 0.1, Wd * 1.24);
    } else {
      ctx.beginPath(); ctx.roundRect(-L * 0.24, -Wd * 0.6, L * 0.44, Wd * 1.2, 3); ctx.fill();
    }
    // roof markings: military star or a hazard stripe
    ctx.fillStyle = o.kind === 'humvee' ? 'rgba(226,232,190,0.5)' : 'rgba(230,200,120,0.45)';
    ctx.beginPath(); ctx.arc(L * 0.6, 0, Math.min(Wd * 0.34, 7), 0, TAU); ctx.fill();
    // wheels
    ctx.fillStyle = '#151a15';
    for (const wx of [-L * 0.62, L * 0.62]) {
      for (const wy of [-Wd, Wd]) {
        ctx.beginPath(); ctx.ellipse(wx, wy, L * 0.12, Wd * 0.2, 0, 0, TAU); ctx.fill();
      }
    }
    // emergency light bar on the ones that need it
    if (o.kind === 'humvee' || o.kind === 'bus') {
      const on = Math.sin(this.simulationTime * 6 + o.x) > 0;
      ctx.fillStyle = on ? '#ffd166' : '#a15a2a';
      ctx.fillRect(-L * 0.3, -Wd * 0.3, L * 0.16, Wd * 0.6);
    }
    ctx.restore();
  }

  /**
   * Roadside infrastructure. Fifty of these per district used to be nothing at all; now the
   * road has lighting, signage, hoardings and a power line, which is most of what makes a
   * highway read as a highway from a zoomed-out camera. Everything is drawn on the shoulder,
   * out of the carriageway, and every lamp still throws a pool of light on the tarmac.
   */
  private drawStreetProp(ctx: CanvasRenderingContext2D, o: Rect): boolean {
    const H = Math.min(o.h3d, 210);
    const cx = o.x + o.w / 2;
    const footY = o.y + o.h;
    const night = this.sector === 3 || this.sector === 5 || this.blackout?.active;
    const olive = this.sector >= 6;
    const side = (Math.floor(o.x / 7) % 2 === 0) ? 1 : -1;
    switch (o.kind) {
      case 'lamp': {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(cx + 3, footY, 9, 4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#26303a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, footY); ctx.lineTo(cx, footY - H); ctx.stroke();
        // arm and head, leaning over the carriageway
        ctx.strokeStyle = '#2e3a44'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(cx, footY - H); ctx.quadraticCurveTo(cx + side * 16, footY - H - 8, cx + side * 30, footY - H - 4); ctx.stroke();
        const hx = cx + side * 30, hy = footY - H - 2;
        const glow = ctx.createRadialGradient(hx, hy + 6, 2, hx, hy + 6, night ? 70 : 34);
        glow.addColorStop(0, night ? 'rgba(255,238,190,0.55)' : 'rgba(255,238,190,0.24)');
        glow.addColorStop(1, 'rgba(255,238,190,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.ellipse(hx, hy + 10, night ? 62 : 30, night ? 34 : 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f6edc6';
        ctx.beginPath(); ctx.roundRect(hx - 6, hy, 12, 5, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(cx - 1, footY - H, 2, H * 0.4);
        return true;
      }
      case 'sign': {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(cx, footY, 14, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#39423d';
        ctx.fillRect(cx - 14, footY - 26, 3, 26);
        ctx.fillRect(cx + 11, footY - 26, 3, 26);
        ctx.fillStyle = olive ? '#3f4a36' : '#2b3b40';
        ctx.beginPath(); ctx.roundRect(cx - 24, footY - 52, 48, 26, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,160,0.5)'; ctx.lineWidth = 2;
        ctx.strokeRect(cx - 22, footY - 50, 44, 22);
        ctx.fillStyle = 'rgba(255,230,160,0.8)';
        ctx.beginPath();
        ctx.moveTo(cx - 14, footY - 46); ctx.lineTo(cx - 4, footY - 39); ctx.lineTo(cx - 14, footY - 32);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(cx - 2, footY - 41, 16, 4);
        return true;
      }
      case 'billboard': {
        // A hoarding is the loudest thing in a HYDRA district: two legs, one message.
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(cx, footY, 58, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#20272b';
        ctx.fillRect(cx - 44, footY - H, 7, H);
        ctx.fillRect(cx + 37, footY - H, 7, H);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(cx - 50, footY - H - 5, 104, 8);
        // panel, leaning back slightly for perspective
        const pw = 118, ph = 58, px = cx - pw / 2, py = footY - H - ph - 2;
        ctx.fillStyle = olive ? '#39412f' : '#1d2b33';
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(px + pw, py + 4); ctx.lineTo(px + pw, py + ph + 4); ctx.lineTo(px, py + ph);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,209,102,0.45)'; ctx.lineWidth = 2;
        ctx.stroke();
        // octagonal sigil
        ctx.strokeStyle = olive ? 'rgba(214,224,170,0.85)' : 'rgba(255,120,110,0.85)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + Math.PI / 8;
          const rx = px + 26 + Math.cos(a) * 15, ry = py + 30 + Math.sin(a) * 14;
          if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
        }
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = olive ? 'rgba(226,232,190,0.75)' : 'rgba(255,190,180,0.75)';
        ctx.font = '900 11px ui-monospace, monospace';
        ctx.fillText(olive ? 'IRON RESERVE' : 'HYDRA IS ORDER', px + 48, py + 26);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(px + 48, py + 32, 58, 2);
        ctx.fillStyle = olive ? 'rgba(226,232,190,0.5)' : 'rgba(255,190,180,0.5)';
        ctx.font = '700 8px ui-monospace, monospace';
        ctx.fillText(olive ? 'REPORT ALL MOVEMENT' : 'TRUST THE NETWORK', px + 48, py + 44);
        // maintenance catwalk
        ctx.fillStyle = 'rgba(20,26,28,0.8)';
        ctx.fillRect(px - 4, py + ph + 4, pw + 8, 4);
        return true;
      }
      case 'pylon': {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(cx, footY, 26, 7, 0, 0, TAU); ctx.fill();
        const top = footY - H;
        // A-frame legs with lattice bracing, tapering as they climb
        ctx.strokeStyle = '#4a5258'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 26, footY); ctx.lineTo(cx - 8, top + 12);
        ctx.moveTo(cx + 26, footY); ctx.lineTo(cx + 8, top + 12);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120,132,138,0.85)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let h = 0; h < 6; h++) {
          const t0 = h / 6, t1 = (h + 1) / 6;
          const y0 = footY - H * t0, y1 = footY - H * t1;
          const w0 = 26 * (1 - t0) + 8 * t0, w1 = 26 * (1 - t1) + 8 * t1;
          ctx.moveTo(cx - w0, y0); ctx.lineTo(cx + w1, y1);
          ctx.moveTo(cx + w0, y0); ctx.lineTo(cx - w1, y1);
        }
        ctx.stroke();
        // cross arms and insulators
        ctx.strokeStyle = '#5a646a'; ctx.lineWidth = 3;
        for (const [t, span] of [[0.24, 30], [0.46, 24], [0.66, 18]] as [number, number][]) {
          const y = footY - H * t;
          ctx.beginPath(); ctx.moveTo(cx - span, y); ctx.lineTo(cx + span, y); ctx.stroke();
          ctx.fillStyle = '#8d9aa0';
          ctx.fillRect(cx - span - 2, y - 3, 4, 6);
          ctx.fillRect(cx + span - 2, y - 3, 4, 6);
        }
        const blink = Math.sin(performance.now() / 900 + o.x * 0.01) > 0.4;
        ctx.fillStyle = blink ? 'rgba(255,90,80,0.95)' : 'rgba(120,40,38,0.6)';
        ctx.beginPath(); ctx.arc(cx, top + 6, 3.4, 0, TAU); ctx.fill();
        return true;
      }
      case 'busstop': {
        // shelter: roof on four posts, a bench, and a lit advertising pane
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fillRect(o.x + 6, o.y + o.h - 4, o.w - 12, 6);
        ctx.fillStyle = 'rgba(120,150,160,0.22)';
        ctx.fillRect(o.x + 5, o.y + 4, o.w - 10, o.h - 12);
        for (const [px2, py2] of [[o.x + 5, o.y + 4], [o.x + o.w - 8, o.y + 4],
          [o.x + 5, o.y + o.h - 12], [o.x + o.w - 8, o.y + o.h - 12]]) {
          ctx.fillStyle = '#2b3338'; ctx.fillRect(px2, py2, 3, Math.min(H * 0.5, 24));
        }
        ctx.fillStyle = '#38424a';
        ctx.beginPath(); ctx.roundRect(o.x + 2, o.y - 4, o.w - 4, 12, 3); ctx.fill();
        ctx.fillStyle = 'rgba(230,240,235,0.35)';
        ctx.fillRect(o.x + 6, o.y, o.w - 12, 4);
        ctx.fillStyle = '#4b3a2a';
        ctx.fillRect(o.x + 12, o.y + o.h - 20, o.w - 24, 6);
        ctx.fillStyle = 'rgba(255,214,140,0.55)';
        ctx.fillRect(o.x + 8, o.y + 8, 14, 18);
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * Army strongpoint props. These are not Hydra boxes with a coat of paint: a parked hull
   * reads as a hull, a silo as a silo, a howitzer points somewhere. Returns false for
   * anything it does not know, so the generic extruder still handles the rest.
   */
  /**
   * A GATE IS A DOOR IN A FRAME, NOT A DOOR PAINTED ON A WALL.
   *
   * The army's shutters used to fall through to the generic structure renderer: a flat
   * brown box with hazard chevrons, sitting exactly where the rampart was, so the outer
   * gate, the blast gate and the command gate all looked like a door lying on top of the
   * wall. This draws the whole gatehouse instead — a cut threshold, jambs standing proud of
   * the wall on both sides, a lintel across the top and the two steel leaves *inside* the
   * opening, inset far enough that the frame is always visible around them.
   */
  private drawArmyGate(ctx: CanvasRenderingContext2D, frame: { x: number; y: number; w: number; h: number; leaves: Rect[] }) {
    const o = frame;
    const horizontal = frame.w >= frame.h;
    const span = frame.w;
    const thick = frame.h;
    const cx = frame.x + frame.w / 2, cy = frame.y + frame.h / 2;
    const dead = frame.leaves.every((l) => l.dead);
    ctx.save();
    ctx.translate(cx, cy);
    if (!horizontal) ctx.rotate(Math.PI / 2);
    const half = span / 2;
    const t = thick / 2;
    // the opening: a recessed threshold the road runs through
    ctx.fillStyle = '#14100c';
    ctx.fillRect(-half, -t, span, thick);
    const reveal = ctx.createLinearGradient(0, -t, 0, t);
    reveal.addColorStop(0, 'rgba(0,0,0,0.75)');
    reveal.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    reveal.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = reveal; ctx.fillRect(-half, -t, span, thick);
    // road markings continue through the gatehouse
    ctx.fillStyle = 'rgba(226,232,220,0.20)';
    for (let d = -half + 26; d < half - 20; d += 54) ctx.fillRect(d, -1.5, 26, 3);
    // jambs, standing proud of the wall on both sides
    for (const side of [-1, 1]) {
      const x = side < 0 ? -half : half - 26;
      ctx.fillStyle = '#3b3a30'; ctx.fillRect(x, -t - 12, 26, thick + 24);
      ctx.fillStyle = '#55523f'; ctx.fillRect(x, -t - 12, 26, 5);
      ctx.fillStyle = '#1b1a14'; ctx.fillRect(x + (side < 0 ? 22 : 0), -t - 8, 4, thick + 16);
      // the pocket the leaf slides into
      ctx.fillStyle = 'rgba(8,10,9,0.85)'; ctx.fillRect(x + (side < 0 ? 26 : -8), -t + 4, 8, thick - 8);
    }
    // lintel and its shadow across the opening
    ctx.fillStyle = '#46443a'; ctx.fillRect(-half - 12, -t - 22, span + 24, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-half, -t - 10, span, 10);
    ctx.fillStyle = 'rgba(198,190,150,0.28)'; ctx.fillRect(-half - 12, -t - 22, span + 24, 3);
    // the leaves themselves, inside the opening
    const leafW = half - 30;
    for (const side of [-1, 1]) {
      const x = side < 0 ? -leafW : 30;
      ctx.fillStyle = dead ? '#241d16' : '#2f3d46';
      ctx.fillRect(x, -t + 5, leafW, thick - 10);
      ctx.fillStyle = dead ? '#2c231a' : '#465a63';
      ctx.fillRect(x, -t + 5, leafW, 5);
      ctx.strokeStyle = dead ? 'rgba(120,90,60,0.4)' : 'rgba(150,180,190,0.45)';
      ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, -t + 6, leafW - 2, thick - 12);
      // panel seams, so the leaf reads as steel plate and not as a wall
      ctx.fillStyle = dead ? 'rgba(0,0,0,0.5)' : 'rgba(10,20,26,0.55)';
      for (let d = x + 12; d < x + leafW - 8; d += 26) ctx.fillRect(d, -t + 10, 3, thick - 20);
      // hazard band along the foot of the leaf
      if (!dead) {
        ctx.fillStyle = 'rgba(255,190,90,0.55)';
        for (let d = x + 6; d < x + leafW - 10; d += 18) {
          ctx.beginPath();
          ctx.moveTo(d, t - 8); ctx.lineTo(d + 8, t - 8); ctx.lineTo(d + 14, t - 16); ctx.lineTo(d + 6, t - 16);
          ctx.closePath(); ctx.fill();
        }
      }
      // hydraulic ram above the leaf
      ctx.fillStyle = '#1b2a30'; ctx.fillRect(x + 6, -t - 16, leafW - 12, 7);
      ctx.fillStyle = dead ? '#6b5a45' : '#a7bac0';
      ctx.fillRect(x + 10, -t - 14.5, Math.max(0, leafW - 26), 4);
    }
    // status lamp in the middle of the lintel: red when held, dark when blown
    ctx.fillStyle = dead ? '#3a2a22' : (Math.sin(performance.now() / 320) > 0 ? '#ff6f6a' : '#7a2b28');
    ctx.beginPath(); ctx.arc(0, -t - 16, 4, 0, TAU); ctx.fill();
    ctx.restore();
    if (!dead) {
      ctx.strokeStyle = 'rgba(255,190,120,0.18)'; ctx.lineWidth = 1;
      ctx.strokeRect(o.x - 4, o.y - 6, o.w + 8, o.h + 12);
    }
    // health bar: a gate under fire tells you so
    const hpFrac = frame.leaves.reduce((a, l) => a + Math.max(0, l.hp ?? 0), 0) /
      Math.max(1, frame.leaves.reduce((a, l) => a + Math.max(1, l.maxHp ?? 1), 0));
    if (!dead && hpFrac < 0.999) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx - 46, cy - thick / 2 - 40, 92, 5);
      ctx.fillStyle = hpFrac > 0.4 ? '#e0c070' : '#ff8f6a';
      ctx.fillRect(cx - 46, cy - thick / 2 - 40, 92 * hpFrac, 5);
    }
  }

  private drawArmyProp(ctx: CanvasRenderingContext2D, o: Rect): boolean {
    const H = o.h3d;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    switch (o.kind) {
      case 'tank': {
        const k = Math.min(o.w, o.h) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        if (o.w > o.h) ctx.rotate(0); else ctx.rotate(Math.PI / 2);
        const L = Math.max(o.w, o.h) / 2, Wd = Math.min(o.w, o.h) / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(-L + H * 0.3, -Wd + H * 0.5, L * 2, Wd * 2);
        // tracks
        ctx.fillStyle = '#20241e';
        ctx.fillRect(-L, -Wd, L * 2, Wd * 0.34);
        ctx.fillRect(-L, Wd - Wd * 0.34, L * 2, Wd * 0.34);
        // hull
        ctx.fillStyle = o.tint || '#4e5a44';
        ctx.beginPath();
        ctx.moveTo(L, 0); ctx.lineTo(L * 0.55, -Wd * 0.86); ctx.lineTo(-L * 0.92, -Wd * 0.86);
        ctx.lineTo(-L, 0); ctx.lineTo(-L * 0.92, Wd * 0.86); ctx.lineTo(L * 0.55, Wd * 0.86);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(-L * 0.9, -Wd * 0.2, L * 1.7, Wd * 0.4);
        // turret + gun
        ctx.fillStyle = '#59654b';
        ctx.beginPath(); ctx.arc(L * 0.1, 0, Wd * 0.7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3b4335';
        ctx.fillRect(L * 0.2, -Wd * 0.11, L * 0.95, Wd * 0.22);
        ctx.fillStyle = 'rgba(214,224,170,0.55)';
        ctx.fillRect(L * 0.95, -Wd * 0.09, L * 0.2, Wd * 0.18);
        // stowage
        ctx.fillStyle = 'rgba(20,24,18,0.5)';
        ctx.fillRect(-L * 0.7, -Wd * 0.5, L * 0.32, Wd * 0.24);
        void k;
        ctx.restore();
        return true;
      }
      case 'silo': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 8, o.y + 12, o.w, o.h);
        ctx.fillStyle = '#4a4f47';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = 'rgba(214,224,170,0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8);
        const r = Math.min(o.w, o.h) * 0.34;
        ctx.fillStyle = '#2c312b';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,190,120,0.55)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,190,120,0.18)';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, TAU); ctx.fill();
        // hazard chevrons around the hatch
        ctx.strokeStyle = 'rgba(255,205,120,0.5)'; ctx.lineWidth = 5;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.arc(cx, cy, r + 16, a - 0.35, a + 0.35);
          ctx.stroke();
        }
        ctx.restore();
        return true;
      }
      case 'launcher': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 10, o.y + 16, o.w, o.h);
        ctx.fillStyle = '#3a4238';
        ctx.fillRect(o.x, o.y + o.h * 0.45, o.w, o.h * 0.55);
        ctx.save();
        ctx.translate(cx, o.y + o.h * 0.5);
        ctx.rotate(-0.5);
        ctx.fillStyle = o.tint || '#4a5246';
        ctx.fillRect(-o.w * 0.34, -o.h * 0.26, o.w * 0.8, o.h * 0.52);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#20241e';
          ctx.fillRect(-o.w * 0.3, -o.h * 0.2 + i * o.h * 0.15, o.w * 0.62, o.h * 0.09);
          ctx.fillStyle = 'rgba(255,170,120,0.75)';
          ctx.fillRect(o.w * 0.28, -o.h * 0.2 + i * o.h * 0.15, 6, o.h * 0.09);
        }
        ctx.restore();
        ctx.fillStyle = '#59654b';
        ctx.beginPath(); ctx.arc(cx - o.w * 0.22, o.y + o.h * 0.62, o.h * 0.2, 0, TAU); ctx.fill();
        ctx.restore();
        return true;
      }
      case 'howitzer': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 8, o.y + 12, o.w, o.h);
        ctx.fillStyle = '#4a4f3f';
        ctx.fillRect(o.x + o.w * 0.2, o.y + o.h * 0.45, o.w * 0.6, o.h * 0.45);
        ctx.strokeStyle = '#20241e'; ctx.lineWidth = Math.max(3, o.h * 0.09);
        ctx.beginPath();
        ctx.moveTo(cx, o.y + o.h * 0.6); ctx.lineTo(o.x + o.w * 0.9, o.y + o.h * 0.12);
        ctx.stroke();
        ctx.fillStyle = '#59654b';
        ctx.beginPath(); ctx.arc(cx, o.y + o.h * 0.55, o.h * 0.22, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,205,120,0.6)';
        ctx.beginPath(); ctx.arc(o.x + o.w * 0.9, o.y + o.h * 0.12, o.h * 0.07, 0, TAU); ctx.fill();
        ctx.restore();
        return true;
      }
      case 'crane': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.fillRect(o.x + 14, o.y + 18, o.w, o.h);
        ctx.fillStyle = '#3d4438';
        ctx.fillRect(o.x + o.w * 0.4, o.y + o.h * 0.4, o.w * 0.2, o.h * 0.6);
        ctx.strokeStyle = '#8b937e'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, o.y + o.h * 0.45); ctx.lineTo(o.x + o.w * 0.95, o.y + o.h * 0.05);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w * 0.95, o.y + o.h * 0.05); ctx.lineTo(o.x + o.w * 0.95, o.y + o.h * 0.6);
        ctx.stroke();
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(o.x + o.w * 0.95 - 7, o.y + o.h * 0.6, 14, 10);
        ctx.fillStyle = '#a6b09a';
        ctx.fillRect(cx - 8, o.y + o.h * 0.3, 16, o.h * 0.3);
        ctx.restore();
        return true;
      }
      case 'gantry': {
        ctx.save();
        ctx.strokeStyle = '#7d8a74'; ctx.lineWidth = 5;
        for (const gx of [o.x + 10, o.x + o.w - 10]) {
          ctx.beginPath(); ctx.moveTo(gx, o.y + o.h); ctx.lineTo(gx, o.y + 6); ctx.stroke();
        }
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(o.x + 10, o.y + 8); ctx.lineTo(o.x + o.w - 10, o.y + 8);
        ctx.moveTo(o.x + 10, o.y + o.h * 0.7); ctx.lineTo(o.x + o.w - 10, o.y + o.h * 0.25);
        ctx.stroke();
        for (let i = 1; i < 8; i++) {
          const gx = o.x + 10 + (o.w - 20) * i / 8;
          ctx.beginPath(); ctx.moveTo(gx, o.y + 8); ctx.lineTo(gx, o.y + 8 + o.h * 0.2); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(214,224,170,0.35)';
        ctx.fillRect(o.x + o.w * 0.3, o.y + o.h * 0.75, o.w * 0.4, 12);
        ctx.restore();
        return true;
      }
      case 'railcar': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(o.x + 6, o.y + 12, o.w, o.h);
        ctx.fillStyle = o.tint || '#4e5348';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
        for (let i = 1; i < 5; i++) {
          const gx = o.x + (o.w * i) / 5;
          ctx.beginPath(); ctx.moveTo(gx, o.y + 4); ctx.lineTo(gx, o.y + o.h - 4); ctx.stroke();
        }
        ctx.fillStyle = '#22261f';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(o.x + o.w * (0.2 + i * 0.2), o.y + o.h + 4, 6, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(214,224,170,0.35)';
        ctx.fillRect(o.x + 6, o.y + 6, o.w - 12, 5);
        ctx.restore();
        return true;
      }
      case 'tent': {
        ctx.save();
        const ridge = o.h * 0.55;
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(o.x + 8, o.y + 12, o.w, o.h);
        ctx.fillStyle = o.tint || '#7d8474';
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h);
        ctx.lineTo(cx, o.y + o.h - ridge);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(30,36,28,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w * 0.3, o.y + o.h); ctx.lineTo(cx, o.y + o.h - ridge);
        ctx.moveTo(o.x + o.w * 0.7, o.y + o.h); ctx.lineTo(cx, o.y + o.h - ridge);
        ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'bladder': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(cx + 6, cy + 10, o.w / 2, o.h / 2, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = o.tint || '#5c5c44';
        ctx.beginPath(); ctx.ellipse(cx, cy, o.w / 2, o.h / 2, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(20,24,18,0.5)'; ctx.lineWidth = 2;
        for (const t of [-0.45, 0, 0.45]) {
          ctx.beginPath();
          ctx.ellipse(cx + t * o.w * 0.5, cy, o.w * 0.06, o.h / 2, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
        return true;
      }
      case 'target': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(o.x + 5, o.y + 8, o.w, o.h);
        ctx.fillStyle = '#3a362c';
        ctx.fillRect(cx - 4, o.y + o.h * 0.4, 8, o.h * 0.6);
        ctx.fillStyle = o.tint || '#7d7460';
        ctx.fillRect(o.x, o.y, o.w, o.h * 0.6);
        // a painted silhouette and a hit ring
        ctx.fillStyle = 'rgba(30,26,20,0.75)';
        ctx.beginPath(); ctx.arc(cx, o.y + o.h * 0.22, o.h * 0.12, 0, TAU); ctx.fill();
        ctx.fillRect(cx - o.w * 0.12, o.y + o.h * 0.32, o.w * 0.24, o.h * 0.26);
        ctx.strokeStyle = 'rgba(255,120,100,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, o.y + o.h * 0.3, o.h * 0.18, 0, TAU); ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'dronebay': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 12, o.y + 18, o.w, o.h);
        ctx.fillStyle = o.tint || '#44504a';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#2b3530';
        ctx.fillRect(o.x + o.w * 0.12, o.y + o.h * 0.55, o.w * 0.76, o.h * 0.4);
        ctx.strokeStyle = 'rgba(150,235,205,0.45)'; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const gx = o.x + o.w * 0.14 + (o.w * 0.72 * i) / 5;
          ctx.beginPath(); ctx.moveTo(gx, o.y + o.h * 0.58); ctx.lineTo(gx, o.y + o.h * 0.93); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(150,235,205,0.5)';
        ctx.fillRect(o.x + o.w * 0.12, o.y + o.h * 0.45, o.w * 0.76, 6);
        ctx.restore();
        return true;
      }
      case 'megahangar': {
        // 190 m of clear span, a segmented roof and two taxi doors at the front.
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 18, o.y + 24, o.w, o.h);
        ctx.fillStyle = o.tint || '#59634f';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // roof ribs
        ctx.strokeStyle = 'rgba(20,26,18,0.35)';
        ctx.lineWidth = 3;
        for (let gx = o.x + 90; gx < o.x + o.w - 20; gx += 120) {
          ctx.beginPath(); ctx.moveTo(gx, o.y + 8); ctx.lineTo(gx, o.y + o.h - 8); ctx.stroke();
        }
        // central spine light
        ctx.fillStyle = 'rgba(220,240,200,0.14)';
        ctx.fillRect(o.x + 40, o.y + o.h * 0.42, o.w - 80, o.h * 0.16);
        // doors
        const doors = 2;
        for (let i = 0; i < doors; i++) {
          const dx = o.x + o.w * (0.16 + i * 0.42);
          ctx.fillStyle = '#2b332a';
          ctx.fillRect(dx, o.y + o.h - 26, o.w * 0.26, 26);
          ctx.fillStyle = 'rgba(200,220,180,0.25)';
          for (let k = 0; k < 7; k++) ctx.fillRect(dx + 8 + k * (o.w * 0.26 / 7), o.y + o.h - 22, 4, 18);
        }
        ctx.fillStyle = 'rgba(226,232,190,0.5)';
        ctx.font = `bold ${Math.round(Math.min(30, o.h * 0.1))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('9TH AIR WING', o.x + o.w / 2, o.y + o.h * 0.32);
        ctx.textAlign = 'left';
        ctx.restore();
        return true;
      }
      case 'towerblock': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 14, o.y + 20, o.w, o.h);
        ctx.fillStyle = o.tint || '#6a7258';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // window rows: eight floors, lit from inside
        const rows = 8;
        for (let r = 0; r < rows; r++) {
          const ry = o.y + 16 + (o.h - 40) * (r / rows);
          for (let c = 0; c < 9; c++) {
            const wx = o.x + 22 + (o.w - 44) * (c / 9);
            const lit = (r * 9 + c) % 5 !== 0;
            ctx.fillStyle = lit ? 'rgba(240,246,190,0.55)' : 'rgba(30,36,28,0.75)';
            ctx.fillRect(wx, ry, (o.w - 44) / 9 * 0.62, 12);
          }
        }
        // roof plant and a painted number
        ctx.fillStyle = '#3f4738';
        ctx.fillRect(o.x + o.w * 0.2, o.y + o.h * 0.42, o.w * 0.24, o.h * 0.16);
        ctx.fillStyle = 'rgba(226,232,190,0.65)';
        ctx.font = `bold ${Math.round(Math.min(34, o.h * 0.09))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('BARRACKS', o.x + o.w / 2, o.y + o.h * 0.62);
        ctx.textAlign = 'left';
        ctx.restore();
        return true;
      }
      case 'watertower': {
        const cxw = o.x + o.w / 2, cyw = o.y + o.h / 2;
        ctx.save();
        // legs
        ctx.strokeStyle = '#6d7660';
        ctx.lineWidth = 7;
        for (const [dx, dy] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]] as const) {
          ctx.beginPath();
          ctx.moveTo(cxw + dx * o.w, cyw + dy * o.h);
          ctx.lineTo(cxw + dx * o.w * 0.4, cyw + dy * o.h * 0.4);
          ctx.stroke();
        }
        // tank
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(cxw + 8, cyw + 10, o.w * 0.4, o.h * 0.4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = o.tint || '#8b967e';
        ctx.beginPath(); ctx.ellipse(cxw, cyw, o.w * 0.4, o.h * 0.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(30,36,28,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cxw, cyw, o.w * 0.4, o.h * 0.4, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cxw, cyw, o.w * 0.24, o.h * 0.24, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(220,235,250,0.35)';
        ctx.beginPath(); ctx.ellipse(cxw - o.w * 0.1, cyw - o.h * 0.12, o.w * 0.14, o.h * 0.09, 0, 0, TAU); ctx.fill();
        ctx.restore();
        return true;
      }
      case 'radome': {
        const cxd = o.x + o.w / 2, cyd = o.y + o.h / 2;
        const r = Math.min(o.w, o.h) / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.arc(cxd + 10, cyd + 12, r, 0, TAU); ctx.fill();
        ctx.fillStyle = o.tint || '#c9d4c0';
        ctx.beginPath(); ctx.arc(cxd, cyd, r, 0, TAU); ctx.fill();
        // panel seams
        ctx.strokeStyle = 'rgba(120,132,116,0.55)'; ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath(); ctx.arc(cxd, cyd, r * (i / 4), 0, TAU); ctx.stroke();
        }
        const sweep = this.simulationTime * 0.6;
        ctx.strokeStyle = 'rgba(160,255,220,0.5)';
        ctx.beginPath(); ctx.moveTo(cxd, cyd);
        ctx.lineTo(cxd + Math.cos(sweep) * r, cyd + Math.sin(sweep) * r);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.arc(cxd - r * 0.3, cyd - r * 0.35, r * 0.3, 0, TAU); ctx.fill();
        ctx.restore();
        return true;
      }
      case 'kazemat': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 10, o.y + 14, o.w, o.h);
        ctx.fillStyle = o.tint || '#7d8670';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // sloped face and a gun slit
        ctx.fillStyle = 'rgba(20,26,18,0.5)';
        ctx.fillRect(o.x + o.w * 0.12, o.y + o.h * 0.34, o.w * 0.76, o.h * 0.3);
        ctx.fillStyle = '#1a2018';
        ctx.fillRect(o.x + o.w * 0.2, o.y + o.h * 0.4, o.w * 0.6, o.h * 0.16);
        ctx.fillStyle = '#2b332a';
        ctx.fillRect(o.x + o.w * 0.42, o.y + o.h * 0.42, o.w * 0.5, o.h * 0.07);
        ctx.strokeStyle = 'rgba(226,232,190,0.3)'; ctx.lineWidth = 2;
        ctx.strokeRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8);
        ctx.restore();
        return true;
      }
      case 'stockade': {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 12, o.y + 16, o.w, o.h);
        ctx.fillStyle = o.tint || '#7a7f6a';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // cell windows behind bars
        const cols = Math.max(3, Math.round(o.w / 90));
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < cols; c++) {
            const wx = o.x + 16 + (o.w - 32) * (c / cols);
            const wy = o.y + 20 + r * (o.h * 0.44);
            ctx.fillStyle = '#1a201a';
            ctx.fillRect(wx, wy, (o.w - 32) / cols * 0.66, o.h * 0.28);
            ctx.fillStyle = 'rgba(200,210,180,0.35)';
            for (let b = 0; b < 4; b++) ctx.fillRect(wx + 4 + b * 9, wy + 3, 3, o.h * 0.28 - 6);
            // a face at the bars, sometimes
            if ((c + r * 3) % 3 === 0) {
              ctx.fillStyle = 'rgba(220,200,170,0.35)';
              ctx.beginPath();
              ctx.arc(wx + (o.w - 32) / cols * 0.3, wy + o.h * 0.16, 5, 0, TAU);
              ctx.fill();
            }
          }
        }
        ctx.fillStyle = 'rgba(226,232,190,0.4)';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MP / STOCKADE', o.x + o.w / 2, o.y + o.h - 8);
        ctx.textAlign = 'left';
        ctx.restore();
        return true;
      }
      case 'icegate': {
        /* THE GLACIER GATE.
         *
         * The most important door in the sector was being drawn as a plain grey slab. It is
         * a frozen bulkhead rammed into a mountain wall: two ice leaves with a lit seam,
         * a drift of blown snow at the foot, frozen stencils and a lamp that pulses while
         * the vault waits behind it.
         */
        const live = !(this.glacierVisits > 0);
        const pulse = 0.55 + Math.sin(this.simulationTime * 2.2) * 0.35;
        ctx.save();
        // shadow and the bulk of the door
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(o.x + H * 0.4, o.y + H * 0.6, o.w, o.h);
        ctx.fillStyle = '#20343c';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        const face = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
        face.addColorStop(0, '#cfeefa');
        face.addColorStop(0.45, '#9fd4e6');
        face.addColorStop(1, '#6fa9bf');
        ctx.fillStyle = face;
        ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8);
        // two leaves meeting on a lit seam
        const seamX = o.x + o.w / 2;
        ctx.fillStyle = live ? `rgba(150,240,255,${pulse})` : 'rgba(120,170,190,0.35)';
        ctx.fillRect(seamX - 3, o.y + 6, 6, o.h - 12);
        ctx.strokeStyle = 'rgba(40,70,84,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x + 10, o.y + 10, o.w / 2 - 14, o.h - 20);
        ctx.strokeRect(seamX + 4, o.y + 10, o.w / 2 - 14, o.h - 20);
        // hydraulic rams at both shoulders
        ctx.fillStyle = '#3d5560';
        ctx.fillRect(o.x + 4, o.y + o.h * 0.28, 10, o.h * 0.44);
        ctx.fillRect(o.x + o.w - 14, o.y + o.h * 0.28, 10, o.h * 0.44);
        // frost working out from the frame
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 12; k++) {
          const fx = o.x + 16 + (o.w - 32) * ((k * 37) % 100) / 100;
          const fy = o.y + 6 + (o.h - 12) * ((k * 61) % 100) / 100;
          const len = 5 + (k % 4) * 3;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + Math.cos(k) * len, fy + Math.sin(k * 1.7) * len);
          ctx.stroke();
        }
        // blown drift at the foot
        ctx.fillStyle = 'rgba(240,252,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(seamX, o.y + o.h - 4, o.w * 0.46, 13, 0, Math.PI, TAU);
        ctx.fill();
        // stencil and status lamp
        ctx.fillStyle = 'rgba(28,60,74,0.65)';
        ctx.font = 'bold 13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GLACIER', seamX, o.y + o.h * 0.36);
        ctx.textAlign = 'left';
        ctx.fillStyle = live ? `rgba(140,245,255,${pulse})` : 'rgba(120,140,150,0.5)';
        ctx.beginPath();
        ctx.arc(o.x + o.w - 22, o.y + 20, 5.5, 0, TAU);
        ctx.fill();
        // cold air spilling out of the seam
        ctx.globalAlpha = 0.5;
        for (let k = 0; k < 4; k++) {
          const t = (this.simulationTime * 0.5 + k * 0.25) % 1;
          ctx.fillStyle = `rgba(200,245,255,${0.22 * (1 - t)})`;
          ctx.beginPath();
          ctx.arc(seamX + Math.sin(this.simulationTime + k) * 16, o.y + o.h + t * 40, 6 + t * 14, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        return true;
      }
      case 'car': case 'humvee': case 'bus': case 'tanker': {
        this.drawVehicleProp(ctx, o);
        return true;
      }
      case 'rampart': {
        // a low, thick concrete wall with a firing step cut into the top
        const hh = Math.min(H, 40);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(o.x + 6, o.y + 8, o.w, o.h);
        ctx.fillStyle = o.tint || '#5b6053';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        const horiz = o.w >= o.h;
        if (horiz) {
          for (let gx = o.x + 40; gx < o.x + o.w - 20; gx += 120) ctx.fillRect(gx, o.y, 8, o.h);
        } else {
          for (let gy = o.y + 40; gy < o.y + o.h - 20; gy += 120) ctx.fillRect(o.x, gy, o.w, 8);
        }
        ctx.fillStyle = 'rgba(214,224,170,0.18)';
        ctx.fillRect(o.x, o.y, horiz ? o.w : hh * 0.4, horiz ? 6 : o.h);
        ctx.restore();
        return true;
      }
      default: return false;
    }
  }

  /** One pedestrian: shadow, coat, head, and a stride while they walk. */
  private drawPed(ctx: CanvasRenderingContext2D, p: Ped) {
    const coat = p.kind === 'worker' ? '#6b6a4e' : p.kind === 'clerk' ? '#4b5a63' : '#7a5334';
    const stride = p.panic > 0 ? 1 : 0.55;
    const bob = Math.sin(p.phase * stride) * 1.6;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(2, 6, 8, 3.2, 0, 0, TAU); ctx.fill();
    ctx.rotate(p.ang + Math.PI / 2);
    // legs
    ctx.strokeStyle = '#22262a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2.5, 2); ctx.lineTo(-3.5, 7 + bob);
    ctx.moveTo(2.5, 2); ctx.lineTo(3.5, 7 - bob);
    ctx.stroke();
    // torso and shoulders
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.roundRect(-5, -6, 10, 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(-5, -6, 3, 10);
    // head, angled the way they are looking
    ctx.fillStyle = '#c9a98a';
    ctx.beginPath(); ctx.arc(0, -9, 3.4, 0, TAU); ctx.fill();
    // a satchel for the courier, a clipboard for the clerk
    if (p.kind === 'courier') { ctx.fillStyle = '#3b2c1e'; ctx.fillRect(3, -4, 4, 6); }
    if (p.kind === 'clerk') { ctx.fillStyle = '#d8d2c0'; ctx.fillRect(-7, -3, 4, 5); }
    if (p.panic > 0) {
      ctx.fillStyle = 'rgba(255,220,160,0.85)';
      ctx.font = '900 9px ui-monospace, monospace';
      ctx.fillText('!', 0, -18);
    }
    ctx.restore();
  }

  /** A burnt-out chassis: the road keeps its history. */
  private drawRoadWreck(ctx: CanvasRenderingContext2D, c: RoadCar) {
    const L = c.kind === 'bus' ? 58 : c.kind === 'tanker' ? 52 : 36;
    const Wd = c.kind === 'bus' ? 19 : 16;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.ang + 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.roundRect(-L + 4, -Wd + 6, L * 2, Wd * 2, 7); ctx.fill();
    ctx.fillStyle = '#221f1b';
    ctx.beginPath(); ctx.roundRect(-L, -Wd, L * 2, Wd * 2, 6); ctx.fill();
    ctx.fillStyle = '#14120f';
    ctx.beginPath(); ctx.roundRect(-L * 0.4, -Wd * 0.7, L * 0.9, Wd * 1.4, 4); ctx.fill();
    // buckled panels and blown glass
    ctx.strokeStyle = 'rgba(90,84,74,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, -Wd * 0.4); ctx.lineTo(-L * 0.3, Wd * 0.2); ctx.lineTo(L * 0.1, -Wd * 0.3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,28,24,0.9)';
    for (const [wx, wy] of [[-L * 0.55, -Wd - 1], [L * 0.5, -Wd - 1], [-L * 0.55, Wd - 3], [L * 0.5, Wd - 3]]) {
      ctx.beginPath(); ctx.roundRect(wx - 8, wy, 16, 6, 2); ctx.fill();
    }
    if (c.burning > 0) {
      const flick = 0.4 + Math.sin(c.light * 9) * 0.25;
      ctx.fillStyle = `rgba(255,132,54,${flick})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.4, Wd * 0.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * One road vehicle, drawn properly: wheels under the body, a glazed cabin, real lamps and
   * a headlight cone that only matters when the district is dark. Every kind has its own
   * silhouette so a fuel bowser never reads as a staff car from a distance.
   */
  private drawRoadCar(ctx: CanvasRenderingContext2D, c: RoadCar) {
    const L = c.kind === 'bus' ? 62 : c.kind === 'tanker' ? 56 : c.kind === 'truck' ? 60
      : c.kind === 'humvee' ? 44 : c.kind === 'ambulance' ? 46 : 38;
    const Wd = c.kind === 'bus' ? 20 : c.kind === 'tanker' ? 18 : c.kind === 'truck' ? 19 : 17;
    const dark = this.blackout.active || this.sector >= 5;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.ang);
    const bounce = Math.sin(c.light * 9 + c.x * 0.01) * Math.min(1.2, c.speed / 140);
    ctx.translate(0, bounce);
    ctx.transform(1, c.lean * 0.12, 0, 1, 0, 0);

    // headlight cone, laid on the road ahead
    if (c.speed > 6) {
      const beamA = dark ? 0.2 : 0.075;
      const grad = ctx.createLinearGradient(L, 0, L + 210, 0);
      grad.addColorStop(0, `rgba(255,242,200,${beamA})`);
      grad.addColorStop(1, 'rgba(255,242,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(L - 4, -Wd * 0.55); ctx.lineTo(L + 200, -Wd * 2.4);
      ctx.lineTo(L + 200, Wd * 2.4); ctx.lineTo(L - 4, Wd * 0.55);
      ctx.closePath(); ctx.fill();
    }

    // cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.roundRect(-L + 5, -Wd + 6, L * 2, Wd * 2, 7); ctx.fill();

    // wheels first: the body sits over them
    const wheelX = c.kind === 'bus' || c.kind === 'tanker' ? [-L * 0.62, L * 0.5] : [-L * 0.56, L * 0.52];
    for (const wx of wheelX) for (const wy of [-Wd - 1, Wd - 5]) {
      ctx.fillStyle = '#0b1013';
      ctx.beginPath(); ctx.roundRect(wx - 9, wy, 18, 6, 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,130,130,0.5)';
      ctx.fillRect(wx - 6, wy + 2, 3, 2);
    }

    // body
    ctx.fillStyle = c.colour;
    ctx.beginPath(); ctx.roundRect(-L, -Wd, L * 2, Wd * 2, c.kind === 'car' ? 9 : 5); ctx.fill();
    // shading along the flanks and a highlight down the spine
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.roundRect(-L, Wd * 0.35, L * 2, Wd * 0.65, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(-L + 6, -Wd + 2, L * 2 - 12, 2);

    if (c.kind === 'bus') {
      // glazing down both sides with a lit interior, and a door mid-body
      ctx.fillStyle = 'rgba(24,36,40,0.85)';
      ctx.beginPath(); ctx.roundRect(-L + 8, -Wd + 4, L * 2 - 16, Wd - 7, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-L + 8, 3, L * 2 - 16, Wd - 7, 3); ctx.fill();
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = `rgba(226,240,208,${0.22 + (i % 3) * 0.1})`;
        ctx.fillRect(-L + 12 + i * ((L * 2 - 26) / 7), -Wd + 6, (L * 2 - 26) / 7 - 3, Wd - 11);
      }
      ctx.fillStyle = '#1b2426';
      ctx.fillRect(-L * 0.2, -Wd + 1, 2, Wd * 2 - 2);
    } else if (c.kind === 'tanker') {
      // cab forward, cylindrical drum behind with welded bands
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.roundRect(-L, -Wd + 1, L * 0.5, Wd * 2 - 2, 12); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-L + 5, -Wd + 3, L * 1.35, Wd * 2 - 6, 11); ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,24,0.55)'; ctx.lineWidth = 2;
      for (const bx of [-L * 0.7, -L * 0.35, 0]) {
        ctx.beginPath(); ctx.moveTo(bx, -Wd + 3); ctx.lineTo(bx, Wd - 3); ctx.stroke();
      }
      ctx.fillStyle = '#e8b34a';
      ctx.fillRect(-L * 0.18, -Wd + 6, 9, 7);
      ctx.fillStyle = '#12201d';
      ctx.fillRect(-L * 0.18 + 2, -Wd + 8, 5, 3);
    } else if (c.kind === 'truck') {
      // cab forward, canvas tilt over a ribbed cargo bed, tailgate and mud flaps
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.roundRect(-L, -Wd + 1, L * 1.5, Wd * 2 - 2, 3); ctx.fill();
      ctx.fillStyle = 'rgba(58,66,50,0.9)';
      ctx.beginPath(); ctx.roundRect(-L + 2, -Wd + 2, L * 1.25, Wd * 2 - 4, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(24,30,22,0.55)'; ctx.lineWidth = 2;
      for (let bx = -L + 8; bx < L * 0.25; bx += 16) {
        ctx.beginPath(); ctx.moveTo(bx, -Wd + 3); ctx.lineTo(bx, Wd - 3); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,36,28,0.75)';
      ctx.fillRect(L * 0.26, -Wd + 1, 4, Wd * 2 - 2);
      ctx.fillStyle = '#2b3a33';
      ctx.beginPath(); ctx.roundRect(L * 0.3, -Wd + 1, L * 0.52, Wd * 2 - 2, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,196,96,0.55)';
      ctx.fillRect(-L + 3, -Wd + 4, 5, 6);
      ctx.fillRect(-L + 3, Wd - 10, 5, 6);
    } else if (c.kind === 'ambulance') {
      // box body with a red cross on the roof and a light bar
      ctx.fillStyle = 'rgba(236,240,232,0.9)';
      ctx.beginPath(); ctx.roundRect(-L, -Wd + 1, L * 1.5, Wd * 2 - 2, 4); ctx.fill();
      ctx.fillStyle = '#c9352f';
      ctx.fillRect(-L * 0.52, -Wd * 0.2, 20, 5);
      ctx.fillRect(-L * 0.52 + 7, -Wd * 0.62, 6, 18);
    } else if (c.kind === 'humvee') {
      // sloped bonnet, armoured doors, roof ring
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.roundRect(L * 0.35, -Wd + 1, L * 0.6, Wd * 2 - 2, 6); ctx.fill();
      ctx.fillStyle = 'rgba(150,160,142,0.4)';
      ctx.fillRect(-L * 0.55, -Wd + 3, 2, Wd * 2 - 6);
      ctx.fillRect(L * 0.1, -Wd + 3, 2, Wd * 2 - 6);
      ctx.strokeStyle = 'rgba(20,26,22,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-L * 0.05, 0, 9, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#2a332c';
      ctx.fillRect(-L * 0.05 - 2, -2, 20, 4);
    }

    // cabin glazing and roof
    if (c.kind !== 'tanker') {
      ctx.fillStyle = 'rgba(18,30,36,0.8)';
      ctx.beginPath(); ctx.roundRect(L * 0.02, -Wd + 4, L * 0.62, Wd * 2 - 8, 4); ctx.fill();
      const glass = ctx.createLinearGradient(L * 0.05, -Wd + 4, L * 0.55, Wd - 4);
      glass.addColorStop(0, '#9fd3e0'); glass.addColorStop(1, '#2b4b5c');
      ctx.fillStyle = glass;
      ctx.beginPath(); ctx.roundRect(L * 0.08, -Wd + 6, L * 0.5, Wd * 1.2 - 8, 3); ctx.fill();
      ctx.fillStyle = 'rgba(10,18,22,0.55)';
      ctx.fillRect(L * 0.08, -1, L * 0.5, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.roundRect(-L * 0.42, -Wd + 4, L * 0.4, Wd * 2 - 8, 3); ctx.fill();
    }

    // lamps
    const lampOn = 0.55 + Math.sin(c.light * 2.6) * 0.08;
    ctx.fillStyle = `rgba(255,243,198,${lampOn})`;
    ctx.beginPath(); ctx.arc(L - 1, -Wd * 0.62, 3.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(L - 1, Wd * 0.62, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = c.brake > 0.25 ? '#ff5340' : 'rgba(120,40,34,0.75)';
    ctx.fillRect(-L + 1, -Wd * 0.78, 3, 5);
    ctx.fillRect(-L + 1, Wd * 0.78 - 5, 3, 5);
    if (c.kind === 'ambulance' || c.kind === 'humvee') {
      const flash = Math.sin(c.light * 9) > 0;
      ctx.fillStyle = flash ? '#ff5a5a' : '#3a6cff';
      ctx.fillRect(c.kind === 'humvee' ? -L * 0.05 : -L * 0.5, -3, 10, 6);
    }
    // hazards on: the car has stopped because someone is shooting
    if (c.panic > 0) {
      const haz = Math.sin(c.light * 15) > 0;
      ctx.fillStyle = haz ? '#ffae3c' : 'rgba(120,80,26,0.5)';
      for (const hx of [-L + 2, L - 6]) for (const hy of [-Wd, Wd - 4]) ctx.fillRect(hx, hy, 4, 4);
    }
    // a turn indicator while the car is swinging round a corner
    if (Math.abs(c.lean) > 0.12) {
      const blink = Math.sin(c.light * 12) > 0;
      if (blink) {
        ctx.fillStyle = '#ffb347';
        ctx.fillRect(L * 0.78, c.lean > 0 ? Wd - 5 : -Wd, 5, 5);
      }
    }
    ctx.restore();
  }

  /** High-tension spans: two catenaries between neighbouring pylon heads. */
  private drawPowerLines(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (!this.pylons.length) return;
    ctx.save();
    ctx.lineWidth = 1.6;
    for (const p of this.pylons) {
      for (const j of p.links) {
        const q = this.pylons[j];
        if (!q) continue;
        const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x);
        const y0 = x0 === p.x ? p.y : q.y, y1 = x0 === p.x ? q.y : p.y;
        if (x1 < camX - 200 || x0 > camX + this.w + 200) continue;
        if (Math.max(y0, y1) < camY - 400 || Math.min(y0, y1) > camY + this.h + 400) continue;
        const sag = Math.min(70, Math.hypot(x1 - x0, y1 - y0) * 0.12);
        const lift0 = p.h * 0.46, lift1 = q.h * 0.46;
        ctx.strokeStyle = 'rgba(168,182,190,0.30)';
        for (const off of [-9, 9]) {
          ctx.beginPath();
          ctx.moveTo(x0, y0 - lift0 + off);
          ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - Math.min(lift0, lift1) + sag + off, x1, y1 - lift1 + off);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /** Birds, high enough to pass over buildings: a district with nothing alive reads dead. */
  private drawBirds(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (!this.birds.length) return;
    ctx.save();
    for (const b of this.birds) {
      const x = b.ax + Math.cos(b.a) * b.r;
      const y = b.ay + Math.sin(b.a) * b.r * 0.7 - b.alt;
      if (x < camX - 60 || x > camX + this.w + 60 || y < camY - 60 || y > camY + this.h + 60) continue;
      const flap = Math.sin(b.flap) * 0.55;
      ctx.strokeStyle = b.kind === 'crow' ? 'rgba(24,22,26,0.75)' : 'rgba(226,232,230,0.72)';
      ctx.lineWidth = b.kind === 'crow' ? 2.2 : 1.8;
      const s2 = b.kind === 'crow' ? 6 : 8;
      ctx.beginPath();
      ctx.moveTo(x - s2, y + flap * s2 * 0.6);
      ctx.quadraticCurveTo(x - s2 * 0.4, y - s2 * 0.3, x, y);
      ctx.quadraticCurveTo(x + s2 * 0.4, y - s2 * 0.3, x + s2, y + flap * s2 * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Traffic and garrison routines, drawn under the structures so they read as passing. */
  private drawTrafficAndRoutines(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const on = (x: number, y: number, pad = 160) =>
      x > camX - pad && x < camX + this.w + pad && y > camY - pad && y < camY + this.h + pad;

    for (const c of this.roadCars) {
      if (!on(c.x, c.y)) continue;
      if (c.dead) { this.drawRoadWreck(ctx, c); continue; }
      this.drawRoadCar(ctx, c);
    }
    for (const p of this.peds) {
      if (!on(p.x, p.y, 60)) continue;
      this.drawPed(ctx, p);
    }

    for (const r of this.routines) {
      if (!on(r.x, r.y, 420)) continue;
      const fade = Math.min(1, Math.min(r.t, r.dur - r.t) / 1.2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      if (r.kind === 'pt') {
        // a squad jogging a circuit, counted with a barked cadence
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a = r.t * 1.1 + (i / n) * TAU;
          const px = r.x + Math.cos(a) * (74 + (i % 2) * 16);
          const py = r.y + Math.sin(a) * (74 + (i % 2) * 16) * 0.7;
          ctx.fillStyle = '#4d5b33';
          ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(230,232,190,0.5)';
          ctx.fillRect(px - 4, py - 10, 8, 3);
        }
      } else if (r.kind === 'shift') {
        // two files crossing: the old watch out, the new watch in
        for (let i = 0; i < 6; i++) {
          const f = (r.t * 0.16 + i * 0.06) % 1;
          const px = r.x - 190 + f * 380, py = r.y - 40 + (i % 2) * 22;
          ctx.fillStyle = '#4d5b33';
          ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2b3324';
          ctx.fillRect(px - 3, py - 6, 6, 3);
        }
      } else if (r.kind === 'siren') {
        // pulsing red rings over the compound, the way a base tests its alarm
        const k = (Math.sin(r.t * 7) + 1) / 2;
        ctx.strokeStyle = `rgba(255,90,80,${0.15 + k * 0.35})`;
        ctx.lineWidth = 4;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath(); ctx.arc(r.x, r.y, 40 + i * 46 + k * 20, 0, TAU); ctx.stroke();
        }
      } else if (r.kind === 'drill') {
        // three humvees running a figure of eight round a marked box
        for (let i = 0; i < 3; i++) {
          const ph = r.t * 0.8 + (i * TAU) / 3;
          const px = r.x + Math.cos(ph) * 150, py = r.y + Math.sin(ph * 2) * 90;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.atan2(Math.cos(ph * 2) * 180, -Math.sin(ph) * 150) + Math.PI / 2);
          ctx.fillStyle = '#5a6349';
          ctx.beginPath(); ctx.roundRect(-22, -12, 44, 24, 5); ctx.fill();
          ctx.fillStyle = 'rgba(150,205,220,0.5)';
          ctx.fillRect(-4, -8, 16, 16);
          ctx.restore();
        }
      } else if (r.kind === 'crane') {
        // a hook on a cable, swinging a crate between the yard and a truck
        const swing = Math.sin(r.t * 1.1) * 0.5;
        ctx.strokeStyle = 'rgba(210,200,160,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - 90);
        ctx.lineTo(r.x + Math.sin(swing) * 70, r.y - 90 + Math.cos(swing) * 70);
        ctx.stroke();
        ctx.fillStyle = '#6a5a3a';
        ctx.save();
        ctx.translate(r.x + Math.sin(swing) * 70, r.y - 20 + Math.cos(swing) * 70);
        ctx.rotate(swing);
        ctx.fillRect(-14, -10, 28, 20);
        ctx.strokeStyle = '#2b2418'; ctx.lineWidth = 2;
        ctx.strokeRect(-14, -10, 28, 20);
        ctx.restore();
      } else if (r.kind === 'fuel') {
        // a bowser beside a hull, hose out, a fitter on the step
        const fill = Math.min(1, r.t / 8);
        ctx.translate(r.x, r.y);
        ctx.save();
        ctx.translate(-70, 0); ctx.rotate(-0.2);
        ctx.fillStyle = '#4f5a45';
        ctx.beginPath(); ctx.roundRect(-46, -18, 92, 36, 6); ctx.fill();
        ctx.fillStyle = 'rgba(20,26,20,0.55)';
        ctx.beginPath(); ctx.roundRect(-40, -15, 56, 30, 9); ctx.fill();
        ctx.fillStyle = '#8a8f70';
        ctx.fillRect(20, -12, 22, 24);
        ctx.restore();
        // the hull being filled
        ctx.save();
        ctx.translate(60, 6); ctx.rotate(0.15);
        ctx.fillStyle = '#3c4a34';
        ctx.beginPath(); ctx.roundRect(-54, -26, 108, 52, 6); ctx.fill();
        ctx.fillStyle = 'rgba(16,22,16,0.6)';
        ctx.beginPath(); ctx.roundRect(-46, -20, 92, 40, 4); ctx.fill();
        ctx.fillStyle = '#20261c';
        ctx.fillRect(-54, -30, 108, 8); ctx.fillRect(-54, 22, 108, 8);
        ctx.fillStyle = '#2b3324';
        ctx.fillRect(-4, -40, 44, 8);
        ctx.restore();
        // hose and the fill spray
        ctx.strokeStyle = 'rgba(60,66,48,0.9)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-24, -6);
        ctx.quadraticCurveTo(6, -26 - Math.sin(r.t * 2) * 6, 34, -10);
        ctx.stroke();
        ctx.fillStyle = `rgba(200,205,150,${0.2 + fill * 0.35})`;
        for (let i = 0; i < 5; i++) {
          const t = (r.t * 1.6 + i * 0.2) % 1;
          ctx.beginPath();
          ctx.arc(34 + Math.sin(i + r.t) * 4, -10 + t * 18, 2.4 * (1 - t) + 1, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#4d5b33';
        ctx.beginPath(); ctx.arc(12, 16, 7, 0, TAU); ctx.fill();
      } else if (r.kind === 'muster') {
        // roll call: two ranks, an NCO walking the line with a clipboard
        ctx.strokeStyle = 'rgba(226,232,190,0.22)'; ctx.lineWidth = 2;
        ctx.strokeRect(r.x - 130, r.y - 60, 260, 120);
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 5; i++) {
            const px = r.x - 100 + i * 50, py = r.y - 40 + row * 34;
            const stand = Math.sin(r.t * 2 + i + row) * 1.2;
            ctx.fillStyle = '#4d5b33';
            ctx.beginPath(); ctx.arc(px, py + stand, 8, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(230,232,190,0.45)';
            ctx.fillRect(px - 4, py - 10 + stand, 8, 3);
          }
        }
        const walk = Math.sin(r.t * 0.8) * 96;
        ctx.fillStyle = '#6b7350';
        ctx.beginPath(); ctx.arc(r.x + walk, r.y + 56, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(240,240,220,0.75)';
        ctx.fillRect(r.x + walk + 8, r.y + 50, 11, 14);
        ctx.fillStyle = 'rgba(200,205,170,0.5)';
        ctx.fillRect(r.x + walk + 10, r.y + 53, 7, 2);
      } else if (r.kind === 'wash') {
        // a crew hosing down an engine block: water arc, steam, wet ground
        ctx.fillStyle = 'rgba(30,38,30,0.35)';
        ctx.beginPath(); ctx.ellipse(r.x + 26, r.y + 26, 78, 26, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#46503c';
        ctx.beginPath(); ctx.roundRect(r.x + 6, r.y - 12, 96, 30, 5); ctx.fill();
        ctx.fillStyle = 'rgba(150,190,200,0.35)';
        ctx.beginPath(); ctx.roundRect(r.x + 20, r.y - 6, 70, 18, 4); ctx.fill();
        const spray = (r.t * 0.9) % 1;
        ctx.strokeStyle = `rgba(190,235,255,${0.5 - spray * 0.3})`; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r.x - 70, r.y + 10);
        ctx.quadraticCurveTo(r.x - 20, r.y - 40 - Math.sin(r.t * 2) * 8, r.x + 18, r.y + 2);
        ctx.stroke();
        for (let i = 0; i < 7; i++) {
          const t = (r.t * 2 + i * 0.14) % 1;
          ctx.fillStyle = `rgba(220,245,255,${0.5 * (1 - t)})`;
          ctx.beginPath();
          ctx.arc(r.x + 18 + Math.cos(i * 2.1) * 22 * t, r.y + 4 - Math.sin(i * 1.7) * 20 * t + 22 * t * t, 2.6, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#4d5b33';
        ctx.beginPath(); ctx.arc(r.x - 78, r.y + 12, 7, 0, TAU); ctx.fill();
      } else if (r.kind === 'k9') {
        // handler and dog working a lane, nose down, tail going
        const f = (r.t * 0.14) % 1;
        const px = r.x - 150 + f * 300, py = r.y + Math.sin(f * 8) * 3;
        ctx.fillStyle = '#4d5b33';
        ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(230,232,190,0.45)';
        ctx.fillRect(px - 4, py - 10, 8, 3);
        // lead
        ctx.strokeStyle = 'rgba(210,210,180,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px - 4, py + 2); ctx.lineTo(px - 34, py + 12); ctx.stroke();
        // the dog
        ctx.fillStyle = '#2f2a22';
        ctx.beginPath(); ctx.ellipse(px - 40, py + 13, 12, 6, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(px - 50, py + 9, 5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2f2a22'; ctx.lineWidth = 2;
        const wag = Math.sin(r.t * 12) * 5;
        ctx.beginPath(); ctx.moveTo(px - 29, py + 11); ctx.lineTo(px - 22, py + 4 + wag); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,90,0.5)';
        ctx.fillRect(px - 40, py + 7, 4, 2);
      } else {
        // colours: the whole base stops while the flag goes up
        ctx.strokeStyle = 'rgba(220,226,180,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(r.x, r.y + 60); ctx.lineTo(r.x, r.y - 60); ctx.stroke();
        const flap = Math.sin(r.t * 3) * 6;
        ctx.fillStyle = 'rgba(220,226,180,0.5)';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - 60);
        ctx.lineTo(r.x + 54 + flap, r.y - 48);
        ctx.lineTo(r.x, r.y - 34);
        ctx.closePath(); ctx.fill();
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = '#4d5b33';
          ctx.beginPath(); ctx.arc(r.x - 40 + i * 20, r.y + 70, 8, 0, TAU); ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(226,232,190,0.6)';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(r.label, r.x, r.y - 130);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  private drawStructures(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    this.gateFrameDrawn.clear();
    this.grid.query(camX - 120, camY - 160, this.w + 240, this.h + 320, this.qset);
    const idxs = Array.from(this.qset);
    // sort by y so extrusions layer correctly
    idxs.sort((a, b) => this.obstacles[a].y - this.obstacles[b].y);

    for (const i of idxs) {
      const o = this.obstacles[i];
      if (o.dead || o.facilityDetail) continue;
      if (o.kind === 'plane') { this.drawParkedPlane(ctx, o); continue; }
      // ISLAND PRISON materials: drawn here so no base texture or base label leaks onto them.
      if (o.kind === 'pine') { this.drawPine(ctx, o); continue; }
      if (o.kind === 'rock') { this.drawRock(ctx, o); continue; }
      if (o.kind === 'boat') { this.drawBoat(ctx, o); continue; }
      if (o.kind === 'bastion') { this.drawBastion(ctx, o, o.h3d); continue; }
      if (o.kind === 'cellblock') { this.drawCellBlock(ctx, o, o.h3d); continue; }
      if (o.kind === 'lighthouse') { this.drawLighthouse(ctx, o); continue; }
      if (o.kind === 'barrier') { this.drawBarrier(ctx, o); continue; }
      if (o.armyGate) {
        const id = o.armyGateId;
        const frame = id ? this.armyGateFrames.get(id) : undefined;
        if (frame && id) {
          if (!this.gateFrameDrawn.has(id)) { this.gateFrameDrawn.add(id); this.drawArmyGate(ctx, frame); }
        } else this.drawArmyGate(ctx, { x: o.x, y: o.y, w: o.w, h: o.h, leaves: [o] });
        continue;
      }
      if (this.drawArmyProp(ctx, o)) continue;
      if (this.drawStreetProp(ctx, o)) continue;
      const H = o.h3d;
      let top: string, side: string, edge: string;
      switch (o.kind) {
        case 'curtain': top = '#37423a'; side = '#1b231e'; edge = 'rgba(255,209,102,0.30)'; break;
        case 'tower':   top = '#3e4a3f'; side = '#1e2620'; edge = 'rgba(255,209,102,0.42)'; break;
        case 'keep':    top = '#4a4436'; side = '#24211a'; edge = 'rgba(255,209,102,0.55)'; break;
        case 'gate':    top = '#4a3a2a'; side = '#241c14'; edge = 'rgba(255,170,80,0.5)'; break;
        case 'barrack': top = '#2c3a33'; side = '#151d19'; edge = 'rgba(140,220,190,0.22)'; break;
        case 'bunker':  top = '#2a3a30'; side = '#141c18'; edge = 'rgba(255,209,102,0.24)'; break;
        case 'pillar':  top = '#4a4436'; side = '#221f18'; edge = 'rgba(255,209,102,0.4)'; break;
        case 'crate':   top = '#4d5533'; side = '#282d1c'; edge = 'rgba(215,255,158,0.28)'; break;
        case 'sandbag': top = '#7d7050'; side = '#3d3628'; edge = 'rgba(0,0,0,0.4)'; break;
        case 'truck':   top = '#314443'; side = '#1b2a29'; edge = 'rgba(120,230,210,0.3)'; break;
        case 'hangar':  top = '#25404a'; side = '#122229'; edge = 'rgba(140,232,255,0.36)'; break;
        case 'fence':   top = '#39423d'; side = '#1d231f'; edge = 'rgba(255,170,80,0.35)'; break;
        case 'vault':   top = '#1c4038'; side = '#0d221d'; edge = 'rgba(141,255,214,0.55)'; break;
        case 'laboratory': top = '#50676b'; side = '#1b343c'; edge = 'rgba(167,225,216,0.5)'; break;
        case 'radar': top = '#526078'; side = '#1d3048'; edge = 'rgba(163,183,224,0.4)'; break;
        case 'motorpool': top = '#465f6c'; side = '#1a303c'; edge = 'rgba(137,198,221,0.45)'; break;
        case 'power': top = '#595646'; side = '#2b3026'; edge = 'rgba(227,172,115,0.4)'; break;
        case 'armory': top = '#596151'; side = '#253226'; edge = 'rgba(202,190,151,0.4)'; break;
        case 'checkpoint': top = '#5b6055'; side = '#29352d'; edge = 'rgba(227,187,117,0.4)'; break;
        case 'warehouse': top = '#626465'; side = '#28353e'; edge = 'rgba(226,199,160,0.42)'; break;
        case 'library': top = '#736958'; side = '#322b28'; edge = 'rgba(214,186,133,0.48)'; break;
        // ARMY DISTRICT: olive steel, tarmac, painted numbers
        case 'tank':    top = '#4e5a44'; side = '#2a3226'; edge = 'rgba(206,220,160,0.45)'; break;
        case 'rampart': top = '#5b6053'; side = '#2c302a'; edge = 'rgba(214,224,170,0.40)'; break;
        case 'silo':    top = '#565b52'; side = '#2a2e28'; edge = 'rgba(214,224,170,0.42)'; break;
        case 'dronebay': top = '#44504a'; side = '#1e2624'; edge = 'rgba(150,235,205,0.40)'; break;
        case 'railcar': top = '#4e5348'; side = '#262b24'; edge = 'rgba(214,224,170,0.30)'; break;
        case 'crane':   top = '#5a5f50'; side = '#2a2e26'; edge = 'rgba(230,200,120,0.45)'; break;
        case 'gantry':  top = '#57604f'; side = '#282f26'; edge = 'rgba(230,200,120,0.40)'; break;
        case 'launcher': top = '#4a5246'; side = '#232a22'; edge = 'rgba(255,170,120,0.45)'; break;
        case 'howitzer': top = '#4f5443'; side = '#262a20'; edge = 'rgba(255,190,120,0.45)'; break;
        case 'tent':    top = '#7d8474'; side = '#3c423a'; edge = 'rgba(230,230,200,0.30)'; break;
        case 'bladder': top = '#5c5c44'; side = '#2d2d20'; edge = 'rgba(230,200,120,0.35)'; break;
        case 'target':  top = '#7d7460'; side = '#3a362c'; edge = 'rgba(255,140,110,0.55)'; break;
        case 'barrel':  top = '#6a5a2c'; side = '#332c14'; edge = 'rgba(230,200,120,0.4)'; break;
        case 'console': top = '#4a5952'; side = '#243029'; edge = 'rgba(160,235,205,0.45)'; break;
        default:        top = '#26362f'; side = '#131b17'; edge = 'rgba(140,220,190,0.20)'; break;
      }
      if (o.tint && o.kind !== 'crate') top = o.tint;

      // ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      // The shadow is capped: a 320 px extrusion would otherwise throw a shadow longer
      // than the building, which reads as a second building.
      ctx.fillRect(o.x + Math.min(H * 0.5, 84), o.y + Math.min(H * 0.7, 110), o.w, o.h);

      // extruded side faces (light comes from upper-left)
      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.h);
      ctx.lineTo(o.x + o.w, o.y + o.h);
      ctx.lineTo(o.x + o.w, o.y + o.h + H);
      ctx.lineTo(o.x, o.y + o.h + H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(side, -8);
      ctx.beginPath();
      ctx.moveTo(o.x + o.w, o.y);
      ctx.lineTo(o.x + o.w + H * 0.45, o.y + H * 0.45);
      ctx.lineTo(o.x + o.w + H * 0.45, o.y + o.h + H * 0.45);
      ctx.lineTo(o.x + o.w, o.y + o.h);
      ctx.closePath(); ctx.fill();

      // top face
      ctx.fillStyle = top;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      // Sector color grade makes each world visually distinct without losing material readability.
      if (this.sector > 1 && (o.kind === 'curtain' || o.kind === 'tower' || o.kind === 'keep' || o.kind === 'barrack')) {
        const accent = SECTORS[this.sector - 1].accent;
        ctx.save(); ctx.globalAlpha = 0.07 + this.sector * 0.006;
        ctx.fillStyle = accent; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.restore();
      }

      // Weather on the roofs: the Arctic does not have clean buildings.
      if (this.dressing?.snow && o.kind !== 'crate' && o.kind !== 'sandbag') {
        ctx.save();
        ctx.fillStyle = 'rgba(238,248,255,0.5)';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x + 3, o.y + 3, Math.max(0, o.w - 6), Math.max(0, o.h - 6));
        // icicles along the south face
        ctx.strokeStyle = 'rgba(210,240,250,0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let sx = o.x + 8; sx < o.x + o.w - 4; sx += 22) {
          const len = 6 + ((sx * 7 + o.y) % 11);
          ctx.moveTo(sx, o.y + o.h + H * 0.6);
          ctx.lineTo(sx + 2, o.y + o.h + H * 0.6 + len);
        }
        ctx.stroke();
        ctx.restore();
      }

      // material detailing
      if (o.kind === 'tank') {
        /* A parked hull, drawn as a hull rather than as a green box.
         *
         * Ninety of these stand in the armour park and the boneyard, so the shape has to
         * carry: skirting over the tracks, road wheels and track links, a sloped glacis,
         * stowage on the deck, a turret with a mantlet, a long gun with a muzzle brake,
         * a commander's cupola and an antenna. The bar on top is its armour, and it only
         * appears once the hull has been hit, because a pristine park with ninety health
         * bars over it reads as a debug overlay.
         */
        this.drawHullRect(ctx, o);
      } else if (o.kind === 'barrel') {
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w * 0.34, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w * 0.18, 0, TAU); ctx.stroke();
      }
      if (o.kind === 'sandbag') {
        ctx.fillStyle = shade(top, 10);
        const along = o.w >= o.h;
        const n = Math.max(2, Math.floor((along ? o.w : o.h) / 26));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const bx = along ? o.x + t * o.w + o.w / n / 2 : o.x + o.w / 2;
          const by = along ? o.y + o.h / 2 : o.y + t * o.h + o.h / n / 2;
          ctx.beginPath();
          ctx.ellipse(bx, by, along ? o.w / n / 2 - 1 : o.w / 2 - 1, along ? o.h / 2 - 1 : o.h / n / 2 - 1, 0, 0, TAU);
          ctx.fill();
        }
      } else if (o.kind === 'crate') {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(o.x + 5, o.y + 5); ctx.lineTo(o.x + o.w - 5, o.y + o.h - 5);
        ctx.moveTo(o.x + o.w - 5, o.y + 5); ctx.lineTo(o.x + 5, o.y + o.h - 5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(215,255,158,0.35)';
        ctx.fillRect(o.x + o.w / 2 - 9, o.y + 5, 18, 5);
        if (o.hp !== undefined && o.hp < 52) {
          ctx.strokeStyle = '#131b16'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.48, o.y); ctx.lineTo(o.x + o.w * 0.3, o.y + o.h * 0.6); ctx.lineTo(o.x + o.w * 0.6, o.y + o.h * 0.85); ctx.stroke();
        }
      } else if (o.kind === 'tower' || o.kind === 'keep' || o.kind === 'curtain') {
        // crenellations
        ctx.fillStyle = shade(top, 14);
        const step = 34;
        if (o.w >= o.h) {
          for (let x = o.x + 6; x < o.x + o.w - 14; x += step) ctx.fillRect(x, o.y + 4, 18, 8);
          for (let x = o.x + 6; x < o.x + o.w - 14; x += step) ctx.fillRect(x, o.y + o.h - 12, 18, 8);
        } else {
          for (let y = o.y + 6; y < o.y + o.h - 14; y += step) ctx.fillRect(o.x + 4, y, 8, 18);
          for (let y = o.y + 6; y < o.y + o.h - 14; y += step) ctx.fillRect(o.x + o.w - 12, y, 8, 18);
        }
        if (o.kind === 'tower') {
          ctx.fillStyle = 'rgba(255,209,102,0.16)';
          ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, Math.min(o.w, o.h) * 0.3, 0, TAU); ctx.fill();
        }
      } else if (o.kind === 'barrack' || o.kind === 'bunker') {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        const rows = Math.max(1, Math.floor(o.h / 44));
        for (let r = 0; r < rows; r++) ctx.fillRect(o.x + 8, o.y + 12 + r * 44, o.w - 16, 5);
        ctx.fillStyle = 'rgba(255,170,80,0.30)';
        ctx.fillRect(o.x + 8, o.y + o.h - 12, Math.min(34, o.w - 16), 5);
        if (o.w > 150 && o.h > 120) {
          // Rooftop systems vary by footprint; this adds detail without changing collision.
          const variant = Math.floor(o.x + o.y) % 3;
          const vx = o.x + 20, vy = o.y + 22;
          if (variant === 0) {
            ctx.fillStyle = '#142a38'; ctx.fillRect(vx, vy, Math.min(o.w - 40, 158), 72);
            ctx.strokeStyle = '#6392ab66'; ctx.lineWidth = 1;
            for (let px = vx + 6; px < vx + Math.min(o.w - 45, 152); px += 20) { ctx.beginPath(); ctx.moveTo(px, vy + 4); ctx.lineTo(px, vy + 67); ctx.stroke(); }
            for (let py = vy + 14; py < vy + 67; py += 14) { ctx.beginPath(); ctx.moveTo(vx + 4, py); ctx.lineTo(vx + Math.min(o.w - 45, 152), py); ctx.stroke(); }
          } else {
            const ventW = Math.min(64, o.w * 0.25);
            for (let n = 0; n < 2; n++) {
              const px = vx + n * (ventW + 13);
              ctx.fillStyle = '#111f26'; ctx.fillRect(px + 3, vy + 7, ventW, 51);
              ctx.fillStyle = '#4b6268'; ctx.fillRect(px, vy, ventW, 48);
              ctx.fillStyle = '#1b323c'; ctx.beginPath(); ctx.arc(px + ventW / 2, vy + 24, 17, 0, TAU); ctx.fill();
              ctx.strokeStyle = '#749399'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(px + ventW / 2 - 14, vy + 24); ctx.lineTo(px + ventW / 2 + 14, vy + 24); ctx.moveTo(px + ventW / 2, vy + 10); ctx.lineTo(px + ventW / 2, vy + 38); ctx.stroke();
            }
          }
          ctx.fillStyle = '#93aaa15e'; ctx.font = '9px monospace';
          ctx.fillText(variant === 0 ? 'SOLAR / AUXILIARY' : variant === 1 ? 'VENTILATION / 04' : 'LOGISTICS / STORAGE', vx, o.y + o.h - 25);
        }
      }

      // truck detailing: cab, windshield, wheels, headlights
      if (o.kind === 'truck') {
        const vert = o.h >= o.w;
        ctx.fillStyle = shade(top, 12);
        if (vert) {
          ctx.fillRect(o.x + 6, o.y + o.h - 58, o.w - 12, 52);           // cab
          ctx.fillStyle = 'rgba(120,220,255,0.5)';
          ctx.fillRect(o.x + 12, o.y + o.h - 52, o.w - 24, 14);          // windshield
          ctx.fillStyle = '#141a18';
          for (let w2 = 0; w2 < 3; w2++) {                               // wheels
            ctx.fillRect(o.x - 4, o.y + 16 + w2 * 60, 8, 16);
            ctx.fillRect(o.x + o.w - 4, o.y + 16 + w2 * 60, 8, 16);
          }
          ctx.fillStyle = Math.sin(performance.now() / 500 + o.x) > 0.2 ? '#ffe9a8' : 'rgba(255,233,168,0.25)';
          ctx.fillRect(o.x + 10, o.y + o.h - 8, 16, 5);                  // headlights
          ctx.fillRect(o.x + o.w - 26, o.y + o.h - 8, 16, 5);
        }
      }

      // ---- civic and industrial detailing ---------------------------------
      // These kinds used to share one flat, unlabelled box, which made a warehouse, an
      // armoury and a switch hall read identically from the air. Each now carries the
      // roof furniture of what it actually is, so the base can be read while flying over it.
      const cxS = o.x + o.w / 2, cyS = o.y + o.h / 2;
      const smallW = Math.min(o.w, 120), smallH = Math.min(o.h, 120);
      if (o.kind === 'warehouse') {
        // skylight ribbons and painted bay numbers
        ctx.fillStyle = 'rgba(190,215,225,0.20)';
        for (let ry = o.y + 14; ry < o.y + o.h - 12; ry += 34) {
          ctx.fillRect(o.x + 12, ry, Math.min(o.w - 24, 180), 7);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.font = '900 11px ui-monospace, monospace';
        ctx.fillText(`BAY ${String(Math.floor((o.x + o.y) / 97) % 9 + 1).padStart(2, '0')}`, o.x + 12, o.y + o.h - 12);
        ctx.fillStyle = 'rgba(20,28,26,0.55)';
        ctx.fillRect(o.x + o.w * 0.62, o.y + o.h - 8, Math.min(o.w * 0.3, 70), 8);
      } else if (o.kind === 'armory') {
        // crate stacks and a hazard ring around the magazine hatch
        ctx.fillStyle = 'rgba(40,52,38,0.85)';
        for (let i = 0; i < 3; i++) ctx.fillRect(o.x + 16 + i * 26, o.y + 16, 20, 20);
        ctx.strokeStyle = 'rgba(255,196,96,0.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cxS, cyS + smallH * 0.18, Math.min(smallW, smallH) * 0.2, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,196,96,0.8)';
        ctx.beginPath();
        ctx.moveTo(cxS, cyS + smallH * 0.18 - 9); ctx.lineTo(cxS + 8, cyS + smallH * 0.18 + 6);
        ctx.lineTo(cxS - 8, cyS + smallH * 0.18 + 6); ctx.closePath(); ctx.fill();
      } else if (o.kind === 'motorpool') {
        // painted work bays, drain grates, oil
        ctx.strokeStyle = 'rgba(240,235,190,0.30)'; ctx.lineWidth = 3;
        for (let bx = o.x + 26; bx < o.x + o.w - 12; bx += 54) {
          ctx.beginPath(); ctx.moveTo(bx, o.y + 10); ctx.lineTo(bx, o.y + o.h - 10); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let bx = o.x + 40; bx < o.x + o.w - 20; bx += 54) ctx.fillRect(bx, o.y + o.h * 0.62, 22, 8);
        ctx.fillStyle = 'rgba(12,16,14,0.5)';
        ctx.fillRect(o.x + 8, o.y + o.h - 14, Math.min(o.w - 16, 140), 6);
      } else if (o.kind === 'library') {
        // roof ribs, cupola and the archive extension tag
        ctx.strokeStyle = 'rgba(60,48,36,0.55)'; ctx.lineWidth = 2;
        for (let rx = o.x + 16; rx < o.x + o.w - 8; rx += 22) {
          ctx.beginPath(); ctx.moveTo(rx, o.y + 6); ctx.lineTo(rx, o.y + o.h - 6); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(46,38,28,0.9)';
        ctx.beginPath(); ctx.arc(cxS, cyS, Math.min(smallW, smallH) * 0.17, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(196,168,120,0.75)';
        ctx.beginPath(); ctx.arc(cxS, cyS, Math.min(smallW, smallH) * 0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(214,186,133,0.6)';
        ctx.font = '900 10px ui-monospace, monospace';
        ctx.fillText('ARCHIVE', o.x + 10, o.y + o.h - 10);
      } else if (o.kind === 'laboratory') {
        // module pods, coolant stack and a containment ring
        ctx.fillStyle = 'rgba(24,54,62,0.9)';
        ctx.fillRect(o.x + 14, o.y + 14, Math.min(o.w * 0.42, 96), Math.min(o.h * 0.34, 62));
        ctx.fillStyle = 'rgba(96,196,206,0.35)';
        ctx.fillRect(o.x + 20, o.y + 20, Math.min(o.w * 0.36, 82), Math.min(o.h * 0.22, 36));
        ctx.strokeStyle = 'rgba(140,240,225,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x + o.w * 0.7, o.y + o.h * 0.6, Math.min(smallW, smallH) * 0.19, 0, TAU); ctx.stroke();
        const pulse = 0.4 + Math.sin(performance.now() / 700 + o.x) * 0.3;
        ctx.fillStyle = `rgba(150,255,225,${pulse})`;
        ctx.fillRect(o.x + o.w * 0.7 - 4, o.y + o.h * 0.6 - 4, 8, 8);
      } else if (o.kind === 'power') {
        // transformer blocks with insulators and a switch mast
        ctx.fillStyle = 'rgba(38,42,32,0.9)';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(o.x + 14 + i * (smallW * 0.26 + 8), o.y + o.h * 0.4, Math.min(smallW * 0.22, 30), Math.min(smallH * 0.34, 46));
        }
        ctx.strokeStyle = 'rgba(255,214,120,0.55)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const bx = o.x + 14 + i * (smallW * 0.26 + 8);
          ctx.beginPath(); ctx.arc(bx + 14, o.y + o.h * 0.36, 6, 0, TAU); ctx.stroke();
        }
        const arc = Math.sin(performance.now() / 90 + o.y) > 0.97;
        if (arc) {
          ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.3, o.y + o.h * 0.3); ctx.lineTo(o.x + o.w * 0.52, o.y + o.h * 0.5); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,214,120,0.7)';
        ctx.font = '900 10px ui-monospace, monospace';
        ctx.fillText('H.V. / 04', o.x + 10, o.y + o.h - 10);
      } else if (o.kind === 'checkpoint') {
        // booth, boom arm and stencilled lane number
        ctx.fillStyle = 'rgba(226,214,180,0.85)';
        ctx.fillRect(cxS - 16, cyS - 14, 32, 28);
        ctx.fillStyle = 'rgba(40,50,44,0.9)';
        ctx.fillRect(cxS - 10, cyS - 8, 20, 10);
        ctx.fillStyle = 'rgba(255,170,80,0.85)';
        ctx.fillRect(o.x + 6, cyS - 3, o.w - 12, 6);
        ctx.fillStyle = 'rgba(30,38,32,0.8)';
        for (let sx = o.x + 12; sx < o.x + o.w - 10; sx += 18) ctx.fillRect(sx, cyS - 3, 8, 6);
      } else if (o.kind === 'radar') {
        // pedestal, dish and a sweep that betrays the base's alertness
        ctx.fillStyle = 'rgba(20,32,44,0.9)';
        ctx.beginPath(); ctx.arc(cxS, cyS, Math.min(smallW, smallH) * 0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(170,200,235,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cxS, cyS, Math.min(smallW, smallH) * 0.42, 0, TAU); ctx.stroke();
        const sweep = performance.now() / 1400 + o.x * 0.01;
        const grd = ctx.createLinearGradient(cxS, cyS, cxS + Math.cos(sweep) * 90, cyS + Math.sin(sweep) * 90);
        grd.addColorStop(0, 'rgba(150,230,255,0.5)'); grd.addColorStop(1, 'rgba(150,230,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cxS, cyS); ctx.lineTo(cxS + Math.cos(sweep) * Math.min(smallW, smallH) * 0.4, cyS + Math.sin(sweep) * Math.min(smallW, smallH) * 0.4); ctx.stroke();
      } else if (o.kind === 'gate') {
        // two steel leaves, a central seam and hazard chevrons
        ctx.fillStyle = 'rgba(24,18,12,0.85)';
        ctx.fillRect(cxS - 2, o.y + 4, 4, o.h - 8);
        ctx.strokeStyle = 'rgba(255,190,90,0.55)'; ctx.lineWidth = 2;
        const horiz = o.w >= o.h;
        if (horiz) {
          for (let gx = o.x + 10; gx < o.x + o.w - 8; gx += 26) {
            ctx.beginPath(); ctx.moveTo(gx, o.y + o.h * 0.7); ctx.lineTo(gx + 12, o.y + o.h * 0.32); ctx.stroke();
          }
        } else {
          for (let gy = o.y + 10; gy < o.y + o.h - 8; gy += 26) {
            ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.7, gy); ctx.lineTo(o.x + o.w * 0.32, gy + 12); ctx.stroke();
          }
        }
      } else if (o.kind === 'pillar') {
        // load-bearing seams and a cap plate
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
        for (let py = o.y + 10; py < o.y + o.h - 6; py += 18) {
          ctx.beginPath(); ctx.moveTo(o.x + 4, py); ctx.lineTo(o.x + o.w - 4, py); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,225,170,0.28)';
        ctx.strokeRect(o.x + 4, o.y + 4, Math.max(2, o.w - 8), Math.max(2, o.h - 8));
      } else if (o.kind === 'server') {
        // rack rows with live activity lamps
        const rows = Math.max(1, Math.floor(o.h / 22));
        for (let r = 0; r < rows; r++) {
          ctx.fillStyle = 'rgba(18,34,32,0.9)';
          ctx.fillRect(o.x + 8, o.y + 8 + r * 22, Math.max(6, o.w - 16), 12);
          for (let l = 0; l < 4; l++) {
            const on = Math.sin(performance.now() / 220 + r * 2 + l + o.x) > 0;
            ctx.fillStyle = on ? 'rgba(130,255,200,0.9)' : 'rgba(60,110,96,0.5)';
            ctx.fillRect(o.x + 12 + l * 9, o.y + 11 + r * 22, 4, 4);
          }
        }
      } else if (o.kind === 'antenna') {
        // lattice bracing and guy wires
        ctx.strokeStyle = 'rgba(190,215,205,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let by = o.y + 6; by < o.y + o.h - 4; by += 16) {
          ctx.moveTo(o.x + 4, by); ctx.lineTo(o.x + o.w - 4, by + 10);
          ctx.moveTo(o.x + o.w - 4, by); ctx.lineTo(o.x + 4, by + 10);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(190,215,205,0.18)';
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2); ctx.lineTo(o.x - 26, o.y + o.h + 14);
        ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2); ctx.lineTo(o.x + o.w + 26, o.y + o.h + 14);
        ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2); ctx.lineTo(o.x + o.w / 2, o.y - 30);
        ctx.stroke();
      }

      // ---- roof furniture --------------------------------------------------
      // A flat roof is not a plane. Access housings, plant, water tanks and aerials are
      // what a real installation looks like from the air, and they cost nothing to draw.
      if (o.w > 150 && o.h > 130 && H > 55 && o.kind !== 'sandbag' && o.kind !== 'curtain'
        && o.kind !== 'tower' && o.kind !== 'keep') {
        const seed2 = Math.abs(Math.floor(o.x * 0.17 + o.y * 0.29));
        const inX = (f: number) => o.x + 18 + f * Math.max(0, o.w - 60);
        const inY = (f: number) => o.y + 18 + f * Math.max(0, o.h - 60);
        // access housing with a steel door
        const hx2 = inX((seed2 % 5) / 10), hy2 = inY(((seed2 >> 2) % 5) / 10);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(hx2 + 3, hy2 + 4, 38, 30);
        ctx.fillStyle = shade(top, -14);
        ctx.fillRect(hx2, hy2, 38, 30);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(hx2, hy2, 38, 30);
        ctx.fillStyle = 'rgba(200,210,205,0.22)';
        ctx.fillRect(hx2 + 7, hy2 + 8, 10, 14);
        // plant: two condenser boxes with fan rings
        for (let k = 0; k < 2; k++) {
          const ax = inX(0.45 + k * 0.2), ay = inY(0.28 + ((seed2 + k) % 3) * 0.18);
          ctx.fillStyle = shade(top, -22);
          ctx.fillRect(ax, ay, 26, 20);
          ctx.strokeStyle = 'rgba(180,200,200,0.30)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(ax + 13, ay + 10, 7, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(ax + 13, ay + 10, 3, 0, TAU); ctx.stroke();
        }
        // water tank on some roofs
        if (seed2 % 3 === 0) {
          const tx = inX(0.72), ty = inY(0.6);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(tx + 3, ty + 4, 13, 13, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5c6a63';
          ctx.beginPath(); ctx.arc(tx, ty, 12, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(220,235,225,0.22)';
          ctx.beginPath(); ctx.arc(tx - 3, ty - 3, 6, 0, TAU); ctx.fill();
        }
        // aerial mast with a beacon on the taller structures
        if (H > 110) {
          const mx = inX(0.35), my = inY(0.82);
          ctx.strokeStyle = '#8a969b'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - 34); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(mx - 8, my - 22); ctx.lineTo(mx + 8, my - 22); ctx.stroke();
          const blink2 = Math.sin(performance.now() / 620 + o.x * 0.01) > 0.35;
          ctx.fillStyle = blink2 ? 'rgba(255,80,70,0.95)' : 'rgba(110,36,32,0.7)';
          ctx.beginPath(); ctx.arc(mx, my - 36, 2.6, 0, TAU); ctx.fill();
        }
      }

      ctx.strokeStyle = edge; ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    }
  }

  /** fuel drums, satcom dishes, VTOLs — S.H.I.E.L.D. infrastructure visuals */
  private drawBarrels(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const b of this.barrels) {
      if (b.dead) continue;
      if (b.x < camX - 40 || b.x > camX + this.w + 40 || b.y < camY - 60 || b.y > camY + this.h + 60) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(3, 13, 17, 6, 0, 0, TAU); ctx.fill();
      // drum body with rust banding
      ctx.fillStyle = '#7c4a1e';
      ctx.fillRect(-14, -8, 28, 22);
      ctx.fillStyle = '#9a5c22';
      ctx.fillRect(-14, -10, 28, 4);
      ctx.fillRect(-14, 4, 28, 4);
      ctx.fillStyle = '#b3712c';
      ctx.fillRect(-14, -14, 28, 6);
      // hazard chevron
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-8, -2); ctx.lineTo(0, 6); ctx.lineTo(8, -2);
      ctx.lineTo(8, 2); ctx.lineTo(0, 10); ctx.lineTo(-8, 2);
      ctx.closePath(); ctx.fill();
      const flick = Math.sin(performance.now() / 180 + b.x) > 0.5;
      if (flick) {
        ctx.strokeStyle = 'rgba(255,190,80,0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-15, -15, 30, 30);
      }
      ctx.restore();
    }
  }

  private drawSatcoms(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const s of this.satcoms) {
      if (s.x < camX - 120 || s.x > camX + this.w + 120 || s.y < camY - 140 || s.y > camY + this.h + 140) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-34, -18, 68, 40);
        ctx.fillStyle = '#1c1a22'; ctx.fillRect(-32, -16, 64, 38);
        ctx.strokeStyle = 'rgba(160,120,220,0.35)'; ctx.lineWidth = 2;
        ctx.strokeRect(-32, -16, 64, 38);
        // fallen dish
        ctx.fillStyle = '#2a2436';
        ctx.beginPath(); ctx.ellipse(0, -28, 26, 12, -0.5, 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }
      const pulse = 0.6 + Math.sin(performance.now() / 420 + s.x) * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(4, 16, 34, 10, 0, 0, TAU); ctx.fill();
      // mast
      ctx.fillStyle = '#272033';
      ctx.fillRect(-7, -36, 14, 52);
      ctx.fillStyle = '#322a42';
      ctx.fillRect(-3, -36, 6, 52);
      // dish
      ctx.save();
      ctx.translate(0, -40);
      ctx.rotate(Math.sin(performance.now() / 3000 + s.x) * 0.4);
      ctx.fillStyle = '#3b3152';
      ctx.beginPath(); ctx.arc(0, -8, 24, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#584a80';
      ctx.beginPath(); ctx.arc(0, -8, 24, Math.PI, 0); ctx.ellipse(0, -8, 24, 9, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#8f79c9'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-24, -8); ctx.lineTo(0, -26); ctx.stroke();
      ctx.restore();
      // blinking status lamp
      ctx.fillStyle = pulse > 0.7 ? '#c9a4ff' : 'rgba(160,120,220,0.35)';
      ctx.fillRect(-2, -44, 4, 8);
      // base
      ctx.fillStyle = '#2f2a3d'; ctx.fillRect(-26, 12, 52, 12);
      ctx.fillStyle = '#3d3652'; ctx.fillRect(-22, 14, 44, 8);
      ctx.strokeStyle = `rgba(190,150,255,${pulse})`; ctx.lineWidth = 2;
      ctx.strokeRect(-27, 11, 54, 14);
      // hp
      const p = clamp(s.hp / s.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(-30, 30, 60, 5);
      ctx.fillStyle = p > 0.5 ? '#c9a4ff' : p > 0.25 ? '#ffd166' : '#ff5d6c';
      ctx.fillRect(-30, 30, 60 * p, 5);
      // sweep arc
      s.sweep += 0.012;
      ctx.strokeStyle = 'rgba(190,150,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.lineTo(Math.cos(s.sweep) * 120, -40 + Math.sin(s.sweep) * 120);
      ctx.stroke();

      ctx.fillStyle = 'rgba(190,150,255,0.8)';
      ctx.font = '900 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SATCOM', 0, 46);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  private drawVTOLs(ctx: CanvasRenderingContext2D) {
    for (const v of this.vtols) {
      if (v.x < this.camX - 180 || v.x > this.camX + this.w + 180 || v.y < this.camY - 180 || v.y > this.camY + this.h + 180) continue;
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.ang);

      // ground shadow lags below, downwash puff puffs out when hovering
      const hover = v.state === 'hover';
      const alt = hover ? 0 : Math.max(0, (v.state === 'in' ? 0 : Math.min(0, 0)));
      ctx.translate(0, 0);

      ctx.save();
      ctx.rotate(0);
      ctx.fillStyle = `rgba(0,0,0,${hover ? 0.5 : 0.3})`;
      ctx.beginPath(); ctx.ellipse(-6, hover ? 46 : 58, hover ? 66 : 42, hover ? 20 : 11, 0, 0, TAU); ctx.fill();
      ctx.restore();

      ctx.translate(0, alt - (hover ? 0 : 0));
      // tail boom
      ctx.fillStyle = '#24303a';
      ctx.fillRect(-96, -8, 40, 16);
      ctx.fillStyle = '#35485a';
      ctx.fillRect(-96, -8, 40, 8);
      ctx.fillStyle = '#1a232c';
      ctx.fillRect(-100, -13, 8, 26);
      // engines
      ctx.fillStyle = '#111a22';
      ctx.fillRect(-52, -26, 44, 20);
      ctx.fillRect(8, -26, 44, 20);
      // exhaust glow (strong when hovering)
      const glowA = hover ? 0.9 : 0.5;
      ctx.fillStyle = `rgba(255,170,90,${glowA})`;
      ctx.beginPath(); ctx.ellipse(-30, -6, 13, 5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, -6, 13, 5, 0, 0, TAU); ctx.fill();
      // fuselage
      ctx.fillStyle = '#24303a';
      ctx.beginPath(); ctx.roundRect(-60, -24, 82, 48, 14); ctx.fill();
      ctx.fillStyle = '#35485a';
      ctx.beginPath(); ctx.roundRect(-58, -22, 78, 26, 10); ctx.fill();
      // cockpit
      ctx.fillStyle = '#0a1520';
      ctx.beginPath(); ctx.roundRect(10, -16, 30, 32, 8); ctx.fill();
      ctx.fillStyle = 'rgba(120,220,255,0.85)';
      ctx.beginPath(); ctx.roundRect(14, -12, 22, 16, 6); ctx.fill();
      // nose
      ctx.fillStyle = '#1a2630';
      ctx.beginPath(); ctx.moveTo(22, -24); ctx.lineTo(52, 0); ctx.lineTo(22, 24); ctx.closePath(); ctx.fill();
      // payload door / insignia
      ctx.fillStyle = 'rgba(255,80,80,0.75)';
      ctx.fillRect(-40, -14, 60, 6);
      // nav lights
      ctx.fillStyle = Math.sin(performance.now() / 120) > 0 ? '#ff5d5d' : 'rgba(255,90,90,0.3)';
      ctx.beginPath(); ctx.arc(-100, 0, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = Math.sin(performance.now() / 120 + 1.6) > 0 ? '#7dff9b' : 'rgba(120,255,150,0.3)';
      ctx.beginPath(); ctx.arc(50, 0, 4, 0, TAU); ctx.fill();

      ctx.restore();
      // rotor — spins fast, drawn unrotated so it sweeps cleanly
      ctx.save();
      ctx.translate(v.x, v.y - 26);
      ctx.rotate(v.rotor);
      ctx.strokeStyle = 'rgba(200,225,235,0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((k / 4) * TAU) * 74, Math.sin((k / 4) * TAU) * 74);
      }
      ctx.stroke();
      ctx.restore();
      // rotor hub
      ctx.fillStyle = '#141e28';
      ctx.beginPath(); ctx.arc(v.x, v.y - 26, 8, 0, TAU); ctx.fill();
    }
  }

  /**
   * A parked hull in plan view.
   *
   * The armour park, the boneyard and the ranges hold about a hundred of these, every one
   * of them an axis-aligned rect, so the shape has to do all the work: skirting over the
   * tracks, road wheels and links, a sloped glacis, deck stowage, a turret with a mantlet
   * and a long gun with a muzzle brake, a cupola and a whip antenna. Camouflage and grime
   * are keyed off the rect's own position, so two hulls side by side are never identical
   * and nothing shimmers between frames.
   */
  private drawHullRect(ctx: CanvasRenderingContext2D, o: Rect) {
    const alongX = o.w >= o.h;
    const L = alongX ? o.w : o.h;            // length, nose to tail
    const Wd = alongX ? o.h : o.w;           // width over the tracks
    if (L < 40 || Wd < 24) return;
    const seed = Math.abs(Math.sin(o.x * 0.013 + o.y * 0.007) * 10000) % 1;
    const hull = o.tint || '#4a5340';
    const wrecked = (o.hp ?? 1) <= 0 || !!o.dead;
    const burnt = wrecked || (o.hp !== undefined && o.maxHp !== undefined && o.hp < (o.maxHp ?? 1) * 0.25);
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    if (!alongX) ctx.rotate(Math.PI / 2);
    const hl = L / 2, hw = Wd / 2;
    const track = Wd * 0.21;
    const bodyH = Wd * 0.56;
    const turretR = Wd * 0.29;
    // shadow on the concrete
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(3, 6, hl * 0.96, hw * 0.95, 0, 0, TAU); ctx.fill();
    // tracks: a dark run with links picked out, wheels showing at the top edge
    for (const side of [-1, 1]) {
      const ty = side * (hw - track / 2);
      ctx.fillStyle = '#161a16';
      ctx.beginPath(); ctx.roundRect(-hl + 4, ty - track / 2, L - 8, track, 4); ctx.fill();
      ctx.fillStyle = '#39422f';
      for (let i = 0; i < Math.floor((L - 16) / 12); i++) {
        ctx.fillRect(-hl + 9 + i * 12, ty - track / 2 + 2, 7, track - 4);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(-hl + 4, ty - track / 2, L - 8, track, 4); ctx.stroke();
    }
    // hull: a slab between the tracks with a squared glacis at the nose
    ctx.fillStyle = shade(hull, -6);
    ctx.beginPath(); ctx.roundRect(-hl + 8, -bodyH / 2, L - 12, bodyH, 4); ctx.fill();
    ctx.fillStyle = shade(hull, 8);
    ctx.beginPath(); ctx.roundRect(-hl + 11, -bodyH / 2 + 2.5, L - 18, bodyH - 5, 3); ctx.fill();
    // glacis: the sloped front plate, lighter, catching the sky
    ctx.fillStyle = shade(hull, 20);
    ctx.beginPath();
    ctx.moveTo(hl - L * 0.16, -bodyH / 2 + 2);
    ctx.lineTo(hl - 3, -bodyH * 0.3);
    ctx.lineTo(hl - 3, bodyH * 0.3);
    ctx.lineTo(hl - L * 0.16, bodyH / 2 - 2);
    ctx.closePath(); ctx.fill();
    // camouflage: small, low-contrast patches only
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-hl + 11, -bodyH / 2 + 2.5, L - 18, bodyH - 5, 3); ctx.clip();
    for (let i = 0; i < 6; i++) {
      const a = Math.sin(seed * 91 + i * 37) * 0.5 + 0.5;
      const b = Math.sin(seed * 53 + i * 17) * 0.5 + 0.5;
      ctx.fillStyle = i % 2 ? 'rgba(24,30,22,0.22)' : 'rgba(132,140,110,0.16)';
      ctx.beginPath();
      ctx.ellipse(-hl + 22 + a * (L - 44), -bodyH * 0.28 + b * bodyH * 0.56,
        7 + a * 9, 3 + b * 4, a * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // fender stowage and engine grilles
    ctx.fillStyle = 'rgba(16,22,16,0.45)';
    for (let i = 0; i < 5; i++) ctx.fillRect(-hl + L * 0.1 + i * 6, bodyH * 0.04, 3.5, bodyH * 0.3);
    ctx.fillStyle = 'rgba(150,158,132,0.16)';
    ctx.fillRect(-hl + L * 0.08, -bodyH * 0.42, L * 0.2, bodyH * 0.13);
    // tow hooks
    ctx.fillStyle = 'rgba(12,16,12,0.75)';
    ctx.fillRect(hl - 7, -bodyH * 0.3, 5, 4);
    ctx.fillRect(hl - 7, bodyH * 0.3 - 4, 5, 4);
    // turret: an octagonal cast shape with a bustle, ringed and shaded
    const tx = L * 0.02;
    const tr = turretR;
    ctx.fillStyle = shade(hull, 18);
    ctx.beginPath();
    const pts: [number, number][] = [
      [tx - tr * 1.15, -tr * 0.5], [tx - tr * 1.1, tr * 0.5], [tx - tr * 0.5, tr * 0.95],
      [tx + tr * 0.55, tr * 0.95], [tx + tr * 1.0, tr * 0.42], [tx + tr * 1.0, -tr * 0.42],
      [tx + tr * 0.55, -tr * 0.95], [tx - tr * 0.5, -tr * 0.95],
    ];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,12,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // turret ring and a lighter top plate
    ctx.fillStyle = shade(hull, 4);
    ctx.beginPath(); ctx.ellipse(tx - tr * 0.1, 0, tr * 0.72, tr * 0.62, 0, 0, TAU); ctx.fill();
    // mantlet + gun, ending inside the hull's own cell
    ctx.fillStyle = shade(hull, -24);
    ctx.fillRect(tx + tr * 0.92, -tr * 0.28, tr * 0.5, tr * 0.56);
    const gunLen = L * 0.34;
    ctx.fillStyle = '#242b23';
    ctx.fillRect(tx + tr * 1.2, -Wd * 0.027, gunLen, Wd * 0.054);
    // bore evacuator
    ctx.fillStyle = '#2e352c';
    ctx.fillRect(tx + tr * 1.2 + gunLen * 0.42, -Wd * 0.042, Wd * 0.1, Wd * 0.084);
    // muzzle brake
    ctx.fillStyle = '#161b16';
    ctx.fillRect(tx + tr * 1.2 + gunLen - 8, -Wd * 0.045, 10, Wd * 0.09);
    ctx.fillStyle = 'rgba(206,216,188,0.14)';
    ctx.fillRect(tx + tr * 1.2, -Wd * 0.025, gunLen - 8, 1.3);
    // cupola, hatch, coax and whip antenna
    ctx.fillStyle = shade(hull, 30);
    ctx.beginPath(); ctx.arc(tx - tr * 0.5, -tr * 0.36, tr * 0.26, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(10,14,10,0.8)';
    ctx.beginPath(); ctx.arc(tx - tr * 0.5, -tr * 0.36, tr * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b201b';
    ctx.beginPath(); ctx.arc(tx + tr * 0.25, -tr * 0.62, tr * 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(18,24,18,0.75)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(tx - tr * 1.25, -tr * 0.42);
    ctx.quadraticCurveTo(tx - tr * 1.7, -tr * 0.85, tx - tr * 1.95, -tr * 1.3);
    ctx.stroke();
    // headlights and tail lamps
    ctx.fillStyle = burnt ? '#3a3630' : '#ffe9a8';
    ctx.fillRect(hl - 11, -bodyH * 0.34, 4, 4);
    ctx.fillRect(hl - 11, bodyH * 0.22, 4, 4);
    ctx.fillStyle = burnt ? '#4a2a24' : '#ff5d5d';
    ctx.fillRect(-hl + 8, -bodyH * 0.34, 3, 3);
    if (burnt) {
      ctx.fillStyle = 'rgba(10,8,6,0.42)';
      ctx.beginPath(); ctx.ellipse(tx - L * 0.06, 0, tr * 1.2, tr * 1.0, 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(24,17,12,0.45)';
      for (let i = 0; i < 5; i++) {
        const a = Math.sin(seed * 71 + i * 13) * 0.5 + 0.5;
        const b = Math.cos(seed * 37 + i * 29) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(-hl + 26 + a * (L - 64), -bodyH * 0.28 + b * bodyH * 0.56, 3.5 + a * 6, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    // armour bar only once the hull has been hit
    if (o.hp !== undefined && o.maxHp !== undefined && o.hp < o.maxHp) {
      const frac = clamp(o.hp / o.maxHp, 0, 1);
      const cx = o.x + o.w / 2, top = o.y - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(cx - L * 0.3, top, L * 0.6, 5);
      ctx.fillStyle = frac > 0.5 ? '#a8c48f' : frac > 0.22 ? '#ffd166' : '#ff6a5a';
      ctx.fillRect(cx - L * 0.3, top, L * 0.6 * frac, 5);
    }
  }

  /** Convoy tanks: hull, tracks, turret and that very long main gun. */
  private drawTanks(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const t of this.tanks) {
      if (t.dead) continue;
      if (t.x < camX - 220 || t.x > camX + this.w + 220 || t.y < camY - 220 || t.y > camY + this.h + 220) continue;
      ctx.save();
      // ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(t.x + 8, t.y + 16, 104, 46, 0, 0, TAU); ctx.fill();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.ang);
      ctx.rotate(t.lean * 0.1);
      // tracks
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#171d1c';
        ctx.beginPath(); ctx.roundRect(-92, side * 40 - 17, 184, 34, 8); ctx.fill();
        ctx.fillStyle = '#2a322f';
        for (let i = 0; i < 9; i++) ctx.fillRect(-86 + i * 20, side * 40 - 15, 12, 30);
        ctx.strokeStyle = '#0d1110'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-92, side * 40 - 17, 184, 34, 8); ctx.stroke();
      }
      // hull
      ctx.fillStyle = '#3d4a3f';
      ctx.beginPath(); ctx.roundRect(-96, -36, 190, 72, 10); ctx.fill();
      ctx.fillStyle = '#4c5a4d';
      ctx.beginPath(); ctx.roundRect(-92, -32, 182, 28, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,22,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-96, -36, 190, 72, 10); ctx.stroke();
      // sloped front plate + tow hooks
      ctx.fillStyle = '#354136';
      ctx.beginPath(); ctx.moveTo(94, -34); ctx.lineTo(112, -20); ctx.lineTo(112, 20); ctx.lineTo(94, 34); ctx.closePath(); ctx.fill();
      // stowage boxes and spare track links on the hull
      ctx.fillStyle = '#2f3a31'; ctx.fillRect(-88, -30, 34, 18); ctx.fillRect(-88, 14, 34, 16);
      ctx.fillStyle = '#586a58'; ctx.fillRect(-50, -30, 26, 8);
      // engine deck grilles
      ctx.fillStyle = '#222a24';
      for (let i = 0; i < 4; i++) ctx.fillRect(-86 + i * 9, -6, 6, 22);
      // turret (independent of the hull)
      ctx.save();
      ctx.rotate(t.turret - t.ang);
      ctx.fillStyle = '#46543f';
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(16,22,18,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#37452f';
      ctx.beginPath(); ctx.roundRect(-20, -18, 40, 36, 12); ctx.fill();
      // mantlet + barrel
      ctx.fillStyle = '#2e3a2c'; ctx.fillRect(30, -9, 20, 18);
      ctx.fillStyle = '#232c22'; ctx.fillRect(46, -6, 62, 12);
      ctx.fillStyle = '#151a15'; ctx.fillRect(100, -8, 14, 16);
      // muzzle brake
      ctx.fillStyle = '#3a4636'; ctx.fillRect(104, -11, 8, 22);
      // commander hatch + periscope
      ctx.fillStyle = '#5b6b52'; ctx.beginPath(); ctx.arc(-12, -12, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fb98a'; ctx.fillRect(2, -30, 12, 5);
      ctx.restore();
      // headlight + tail lamp
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(106, -26, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = t.captured ? '#8be8ff' : '#ff5d5d';
      ctx.beginPath(); ctx.arc(-98, 24, 4, 0, TAU); ctx.fill();
      ctx.restore();

      /* The bar and the label are information, not decoration: they appear when the hull
       * is damaged or when the operative is close enough to act on it. Thirty-four hulls
       * rolling out of the park used to stencil HYDRA TANK over the whole screen. */
      const frac = clamp(t.hp / t.maxHp, 0, 1);
      const nearHull = Math.hypot(t.x - this.px, t.y - this.py) < 300;
      if (frac < 0.999) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(t.x - 62, t.y - 84, 124, 7);
        ctx.fillStyle = frac > 0.5 ? '#a8c48f' : frac > 0.22 ? '#ffd166' : '#ff6a5a';
        ctx.fillRect(t.x - 62, t.y - 84, 124 * frac, 7);
        ctx.strokeStyle = 'rgba(230,255,220,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(t.x - 62, t.y - 84, 124, 7);
      }
      if (nearHull) {
        ctx.fillStyle = t.captured ? '#8be8ff' : '#e8b0b0';
        ctx.font = '900 10px ui-monospace, monospace'; ctx.textAlign = 'center';
        const armyHull = this.army && t.x > this.army.region.x && t.y > this.army.region.y;
        ctx.fillText(t.captured ? 'S.H.I.E.L.D. TANK' : armyHull ? 'VOJSKA MBT / MAIN GUN' : 'HYDRA TANK / MAIN GUN', t.x, t.y - (frac < 0.999 ? 94 : 72));
        ctx.textAlign = 'left';
      }
    }
  }

  /** Hydra transport vans: parked in ranks, drivable, wreckable. */
  /**
   * A requisitioned street vehicle is drawn with the body it actually has, not with the
   * Hydra transport shell. The road-car renderer already knows every one of these shapes,
   * so the van borrows it and only supplies the state it lacks.
   */
  private roadCarView(v: Van): RoadCar {
    return {
      x: v.x, y: v.y, ang: v.ang, speed: v.speed, cruise: v.speed,
      kind: v.art || 'car', route: [], node: 0, wait: 0,
      dead: false, colour: v.colour || '#7a7f6a', light: this.simulationTime * 2 + v.x * 0.01,
      brake: 0, lean: v.lean, jammed: 0, hp: v.hp, maxHp: v.maxHp, burning: 0, panic: 0,
    };
  }

  /** The burnt shell of a requisitioned vehicle: it stays where it died. */
  private drawVanWreck(ctx: CanvasRenderingContext2D, v: Van) {
    const ghost: RoadCar = { ...this.roadCarView(v), dead: true, burning: 0, speed: 0 };
    this.drawRoadWreck(ctx, ghost);
  }

  private drawVans(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const v of this.vans) {
      if (v.reserved) continue;
      if (v.x < camX - 160 || v.x > camX + this.w + 160 || v.y < camY - 160 || v.y > camY + this.h + 160) continue;
      if (v.dead) { if (v.art) this.drawVanWreck(ctx, v); continue; }
      if (v.art) {
        const near2 = !v.driving && Math.hypot(v.x - this.px, v.y - this.py) < 130
          && !this.piloting && !this.flyingPlane && !this.playerTank && !this.drivingVan;
        this.drawRoadCar(ctx, this.roadCarView(v));
        if (v.hp < v.maxHp) {
          const frac = Math.max(0, v.hp / v.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(v.x - 32, v.y - 46, 64, 5);
          ctx.fillStyle = frac > 0.35 ? '#8fe4c0' : '#f69a83'; ctx.fillRect(v.x - 32, v.y - 46, 64 * frac, 5);
        }
        if (near2) {
          ctx.font = '900 9px ui-monospace, monospace';
          ctx.fillStyle = 'rgba(169,236,255,0.9)';
          ctx.textAlign = 'center';
          ctx.fillText(`[F] DRIVE ${VAN_LABEL[v.art] || 'VEHICLE'}`, v.x, v.y - 54);
          ctx.textAlign = 'left';
        }
        continue;
      }
      const near = !v.driving && !v.disabled && Math.hypot(v.x - this.px, v.y - this.py) < 130 && !this.piloting && !this.flyingPlane && !this.playerTank;
      drawTransport(ctx, v, this.simulationTime, 0, near ? '[F] ARMED TRANSPORT' : '');
      if (v.disabled) {
        const t = performance.now() * 0.001;
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.9 + i * 0.33) % 1;
          ctx.fillStyle = `rgba(48,52,50,${0.4 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(v.x - 26 + Math.sin(t + i) * 8, v.y - 26 - k * 46, 6 + k * 12, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  /** The sea traffic: landing craft, patrols, the skiffs you can take and the reefs. */
  private drawBoats(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    // reefs first, so a hull drawn later sits on top of the rock
    for (const r of this.reefs) {
      if (r.x < camX - 200 || r.x > camX + this.w + 200 || r.y < camY - 200 || r.y > camY + this.h + 200) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(120,168,160,0.22)';
      ctx.beginPath(); ctx.ellipse(r.x, r.y + 8, r.r * 1.5, r.r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b3a3c';
      ctx.beginPath();
      ctx.moveTo(r.x - r.r, r.y + r.r * 0.3);
      ctx.lineTo(r.x - r.r * 0.5, r.y - r.r * 0.75);
      ctx.lineTo(r.x + r.r * 0.15, r.y - r.r * 0.35);
      ctx.lineTo(r.x + r.r * 0.55, r.y - r.r * 0.95);
      ctx.lineTo(r.x + r.r, r.y + r.r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(206,232,228,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y + 10, r.r * 1.15, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.restore();
    }
    for (const b of this.boats) {
      if (b.x < camX - 320 || b.x > camX + this.w + 320 || b.y < camY - 320 || b.y > camY + this.h + 320) continue;
      const near = b === this.drivingBoat ? false
        : Math.hypot(b.x - this.px, b.y - this.py) < 160 && !this.piloting && !this.flyingPlane && !this.drivingVan && !this.playerTank;
      const label = near ? (b.faction === 'enemy' ? '[F] SEIZE BOAT' : '[F] BOARD BOAT') : '';
      drawBoat(ctx, b, this.simulationTime, label);
    }
  }

  /** Hydra beam batteries. Charging telegraph, then a lethal lance. */
  private drawLasers(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const l of this.lasers) {
      if (l.x < camX - 700 || l.x > camX + this.w + 700 || l.y < camY - 700 || l.y > camY + this.h + 700) continue;
      const col = l.captured ? '140,235,255' : '255,80,110';
      // charge telegraph
      if (l.charge > 0) {
        const k = clamp(l.charge / 1.5, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(${col},${0.25 + k * 0.55})`;
        ctx.lineWidth = 2 + k * 6;
        ctx.setLineDash([18, 14]);
        ctx.beginPath(); ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + Math.cos(l.ang) * 1600, l.y + Math.sin(l.ang) * 1600);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
      }
      // firing lance
      if (l.beam > 0) {
        const k = clamp(l.beam / 0.32, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [wd, al] of [[46, 0.28], [22, 0.5], [8, 0.95]] as const) {
          ctx.strokeStyle = `rgba(${col},${al * k})`;
          ctx.lineWidth = wd * k;
          ctx.beginPath(); ctx.moveTo(l.x, l.y);
          ctx.lineTo(l.x + Math.cos(l.ang) * 1600, l.y + Math.sin(l.ang) * 1600);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(5, 24, 52, 18, 0, 0, TAU); ctx.fill();
      // base ring
      ctx.fillStyle = '#1b232a'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.7)`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.stroke();
      ctx.rotate(l.ang);
      // emitter barrel
      ctx.fillStyle = '#2a3944'; ctx.fillRect(-22, -20, 76, 40);
      ctx.fillStyle = '#3d5563'; ctx.fillRect(-18, -15, 66, 14);
      ctx.fillStyle = '#12181d'; ctx.fillRect(40, -11, 52, 22);
      // focusing rings
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(${col},${0.5 + Math.sin(performance.now() / 200 + i) * 0.25})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(58 + i * 16, 0, 15 - i * 2, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = `rgba(${col},${0.5 + (l.charge / 1.5) * 0.5})`;
      ctx.beginPath(); ctx.arc(96, 0, 8 + (l.charge / 1.5) * 8, 0, TAU); ctx.fill();
      ctx.restore();
      // hp / prompt
      const p = clamp(l.hp / l.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(l.x - 50, l.y - 70, 100, 6);
      ctx.fillStyle = l.captured ? '#8be8ff' : p > 0.4 ? '#ffd166' : '#ff5d6c';
      ctx.fillRect(l.x - 50, l.y - 70, 100 * p, 6);
      ctx.fillStyle = l.captured ? '#8be8ff' : '#ff8fa3';
      ctx.font = '900 11px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(l.captured ? 'S.H.I.E.L.D. BEAM' : 'HYDRA BEAM BATTERY', l.x, l.y - 78);
      if (!l.captured && Math.hypot(l.x - this.px, l.y - this.py) < 130) {
        ctx.fillStyle = '#8be8ff'; ctx.fillText('[F] CAPTURE', l.x, l.y + 78);
      }
      ctx.textAlign = 'left';
    }
  }

  /** Escort wing rendered as compact S.H.I.E.L.D. operatives. */
  private drawAllies(ctx: CanvasRenderingContext2D) {
    for (const a of this.allies) {
      if (a.x < this.camX - 80 || a.x > this.camX + this.w + 80) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(3, 9, 13, 6, 0, 0, TAU); ctx.fill();
      ctx.rotate(a.ang);
      ctx.fillStyle = '#0f2c33'; ctx.fillRect(6, -3, 20, 6);
      ctx.fillStyle = a.flash > 0 ? '#fff' : '#123c44';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = a.kind === 'medic' ? '#8dffb0' : a.kind === 'heavy' ? '#7fd8ff' : '#2fd6c4';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#eafcff'; ctx.beginPath(); ctx.arc(4, 0, 4.4, 0, TAU); ctx.fill();
      if (a.kind === 'medic') { ctx.fillStyle = '#0d3a24'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
      ctx.restore();
      const p = clamp(a.hp / a.maxHp, 0, 1);
      if (p < 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(a.x - 14, a.y - 24, 28, 3);
        ctx.fillStyle = '#7dffcf'; ctx.fillRect(a.x - 14, a.y - 24, 28 * p, 3);
      }
    }
  }

  /** The recovered S.H.I.E.L.D. strategic bomber — big, elegant, heavy. */
  private drawPlane(ctx: CanvasRenderingContext2D) {
    const p = this.plane;
    if (!p) return;
    if (p.x < this.camX - 500 || p.x > this.camX + this.w + 500 || p.y < this.camY - 500 || p.y > this.camY + this.h + 500) return;
    const fly = this.flyingPlane;
    drawFixedWing(ctx, { ...p, altitude: fly ? 70 : 0, friendly: true, bomber: true, bombOpen: p.bombCd > 0.9, active: fly }, this.simulationTime);
    ctx.fillStyle = '#8be8ff'; ctx.font = '900 12px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(fly ? `S.H.I.E.L.D. NIGHTJAR / FUEL ${Math.ceil(p.fuel)}%` : 'S.H.I.E.L.D. NIGHTJAR / [F] BOARD', p.x, p.y - 205);
    ctx.textAlign = 'left';
  }

  /** Sealed Hydra hangars whose roofs split open from the inside. */
  private drawHangarAircraft(ctx: CanvasRenderingContext2D) {
    this.parkedHelis.forEach((p, index) => {
      if (p.taken || [...this.hangarClaims.values()].includes(index)) return;
      if (p.x < this.camX - 130 || p.x > this.camX + this.w + 130 || p.y < this.camY - 130 || p.y > this.camY + this.h + 130) return;
      drawParkedAircraft(ctx, p.x, p.y, p.ang, 0.4 + index * 0.18, index === 3 ? '#77c9a8' : '#bc6f79');
      if (!this.hangars[index] || this.hangars[index].open > 0.8) {
        ctx.fillStyle = '#9ecbd1'; ctx.textAlign = 'center'; ctx.font = '10px monospace';
        ctx.fillText('[F] SEIZE AIRCRAFT', p.x, p.y - 105); ctx.textAlign = 'left';
      }
    });
  }

  /** Parked fixed-wing aircraft: fuselage, swept wings, tailplane and a canopy glint. */
  private drawParkedPlane(ctx: CanvasRenderingContext2D, o: Rect) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const L = o.w, W = o.h;
    ctx.save();
    ctx.translate(cx, cy);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(9, 13, L * 0.5, W * 0.42, 0, 0, TAU); ctx.fill();
    // wings
    ctx.fillStyle = '#2c4048';
    ctx.beginPath();
    ctx.moveTo(-L * 0.06, -W * 0.1); ctx.lineTo(L * 0.06, -W * 0.62);
    ctx.lineTo(-L * 0.16, -W * 0.62); ctx.lineTo(-L * 0.2, -W * 0.1); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-L * 0.06, W * 0.1); ctx.lineTo(L * 0.06, W * 0.62);
    ctx.lineTo(-L * 0.16, W * 0.62); ctx.lineTo(-L * 0.2, W * 0.1); ctx.closePath(); ctx.fill();
    // tailplane
    ctx.fillStyle = '#33474f';
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, -W * 0.06); ctx.lineTo(-L * 0.32, -W * 0.34);
    ctx.lineTo(-L * 0.46, -W * 0.34); ctx.lineTo(-L * 0.48, -W * 0.06); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, W * 0.06); ctx.lineTo(-L * 0.32, W * 0.34);
    ctx.lineTo(-L * 0.46, W * 0.34); ctx.lineTo(-L * 0.48, W * 0.06); ctx.closePath(); ctx.fill();
    // fuselage
    const body = ctx.createLinearGradient(0, -W * 0.14, 0, W * 0.14);
    body.addColorStop(0, '#5d6f74'); body.addColorStop(0.5, '#3c4d54'); body.addColorStop(1, '#22343a');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, W * 0.15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8fa3a6'; ctx.lineWidth = 1; ctx.stroke();
    // canopy + intake + roundels
    ctx.fillStyle = '#9fd8e8'; ctx.beginPath(); ctx.ellipse(L * 0.16, 0, L * 0.07, W * 0.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#16242a'; ctx.beginPath(); ctx.ellipse(L * 0.36, 0, L * 0.05, W * 0.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b3554f';
    ctx.beginPath(); ctx.arc(-L * 0.02, -W * 0.44, 6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-L * 0.02, W * 0.44, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  private drawHangars(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const h of this.hangars) {
      if (h.x + h.w < camX - 200 || h.x > camX + this.w + 200) continue;
      if (h.y + h.h < camY - 260 || h.y > camY + this.h + 260) continue;
      const o = clamp(h.open, 0, 1);
      const half = h.w / 2;
      const slide = o * (half + 16);
      ctx.save();
      ctx.globalAlpha = 1 - o;
      // roof halves slide outward
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(dir * slide, 0);
        const rx = dir < 0 ? h.x : h.x + half;
        const index = this.hangars.indexOf(h);
        ctx.fillStyle = ['#20333a', '#323a42', '#2f3f3a', '#244047', '#313440'][index % 5];
        ctx.fillRect(rx, h.y - 16, half, h.h + 16);
        ctx.fillStyle = '#2b454e';
        ctx.fillRect(rx + 5, h.y - 11, half - 10, h.h + 6);
        // corrugated ribs
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let r = 0; r < 7; r++) ctx.fillRect(rx + 8, h.y - 6 + r * 46, half - 16, 7);
        // hydra stripe on the closed seam
        ctx.fillStyle = dir < 0 ? 'rgba(255,90,110,0.5)' : 'rgba(255,90,110,0.5)';
        ctx.fillRect(dir < 0 ? rx + half - 12 : rx + 4, h.y + 20, 8, h.h - 40);
        ctx.strokeStyle = 'rgba(150,215,230,0.28)'; ctx.lineWidth = 2;
        ctx.strokeRect(rx + 2, h.y - 14, half - 4, h.h + 12);
        ctx.restore();
      }
      ctx.restore();
      if (o < 0.8) {
        const index = this.hangars.indexOf(h);
        ctx.save(); ctx.globalAlpha = 1 - o; ctx.textAlign = 'center';
        ctx.fillStyle = '#79989f'; ctx.font = 'bold 29px monospace';
        ctx.fillText(`0${index + 1}`, h.x + h.w / 2, h.y + 98);
        ctx.font = '11px monospace';
        ctx.fillText(['FLIGHT OPERATIONS', 'HEAVY ARMAMENT', 'ENGINEERING', 'AEROMEDICAL', 'STEALTH SYSTEMS'][index % 5], h.x + h.w / 2, h.y + 121);
        ctx.restore();
      }
      // door + prompt
      const near = Math.hypot(h.doorX - this.px, h.doorY - this.py) < 230;
      if (o < 0.5) {
        ctx.strokeStyle = `rgba(255,209,102,${near ? 0.85 : 0.4})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 9]);
        ctx.beginPath();
        ctx.moveTo(h.doorX - 75, h.doorY); ctx.lineTo(h.doorX + 75, h.doorY);
        ctx.stroke(); ctx.setLineDash([]);
        if (near) {
          ctx.fillStyle = '#ffd166'; ctx.font = '900 11px ui-monospace, monospace'; ctx.textAlign = 'center';
          ctx.fillText('HANGAR DOOR — ENTER', h.doorX, h.doorY + 26); ctx.textAlign = 'left';
        }
      } else {
        // interior floor markings revealed
        ctx.save();
        ctx.globalAlpha = o * 0.5;
        ctx.strokeStyle = '#8be8ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(h.x + h.w / 2, h.y + h.h / 2, 92, 0, TAU); ctx.stroke();
        ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.arc(h.x + h.w / 2, h.y + h.h / 2, 120, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  private drawBarricades(ctx: CanvasRenderingContext2D) {
    for (const b of this.barricades) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-84, -8, 168, 30);
      ctx.fillStyle = '#39443c'; ctx.fillRect(-80, -16, 160, 30);
      ctx.fillStyle = '#4d5a4f'; ctx.fillRect(-80, -16, 160, 12);
      // welded plates + hazard stripes
      ctx.fillStyle = '#ffd166';
      for (let i = -70; i < 70; i += 26) ctx.fillRect(i, -12, 12, 22);
      ctx.strokeStyle = '#8dffb0'; ctx.lineWidth = 2;
      ctx.strokeRect(-80, -16, 160, 30);
      ctx.restore();
      const p = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(b.x - 50, b.y - 34, 100, 5);
      ctx.fillStyle = p > 0.4 ? '#8dffb0' : '#ff5d6c';
      ctx.fillRect(b.x - 50, b.y - 34, 100 * p, 5);
    }
  }

  /** The hidden S.H.I.E.L.D. vault entrance. */
  private drawVault(ctx: CanvasRenderingContext2D) {
    const v = VAULT_ENTRY;
    if (v.x < this.camX - 600 || v.x > this.camX + this.w + 600) return;
    const near = Math.hypot(v.x - this.px, v.y - this.py) < 620;
    if (!this.vaultOpen && !near) return;
    ctx.save();
    ctx.translate(v.x, v.y);
    const pulse = 0.4 + Math.sin(performance.now() / 420) * 0.25;
    if (!this.vaultOpen) {
      // just a faint seam in the dirt
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#6f8f88'; ctx.lineWidth = 3;
      ctx.strokeRect(-46, -26, 92, 52);
      ctx.fillStyle = 'rgba(140,255,220,0.15)'; ctx.fillRect(-42, -22, 84, 44);
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(10,30,26,0.9)'; ctx.fillRect(-60, -36, 120, 72);
    ctx.strokeStyle = `rgba(140,255,220,${pulse + 0.35})`; ctx.lineWidth = 4;
    ctx.strokeRect(-60, -36, 120, 72);
    ctx.fillStyle = '#8dffd6';
    ctx.font = '900 13px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('S.H.I.E.L.D.', 0, -50);
    ctx.fillText('BLACK VAULT “ATTIC”', 0, 62);
    // big floor emblem
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#8dffd6'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(300, 0, 250, 0, TAU); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(300, 0, 190, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(215, -110); ctx.lineTo(385, -110); ctx.lineTo(385, 20);
    ctx.quadraticCurveTo(340, 120, 300, 140); ctx.quadraticCurveTo(260, 120, 215, 20);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';
  }

  /** Captured S.H.I.E.L.D. gunship. It remains parked in the Hydra hangar until boarded. */
  private drawPlayerHeli(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const h = this.playerHeli;
    if (!h || h.x < camX - 220 || h.x > camX + this.w + 220 || h.y < camY - 220 || h.y > camY + this.h + 220) return;
    const active = this.piloting;
    const bob = active ? Math.sin(performance.now() / 90) * 3 : 0;
    ctx.save();
    // projected rotor shadow
    ctx.fillStyle = active ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.52)';
    ctx.beginPath(); ctx.ellipse(h.x + h.bank * 22, h.y + (active ? 58 : 28), active ? 62 : 52, active ? 18 : 14, h.ang, 0, TAU); ctx.fill();
    ctx.translate(h.x, h.y + bob);
    ctx.rotate(h.ang + h.bank * 0.14);
    ctx.scale(1, 1 - Math.abs(h.bank) * 0.14);
    // tail boom + tail rotor
    ctx.fillStyle = '#1a3741'; ctx.fillRect(-100, -7, 58, 14);
    ctx.fillStyle = '#275260'; ctx.fillRect(-100, -7, 58, 7);
    ctx.save(); ctx.translate(-100, 0); ctx.rotate(h.rotor * 2.4);
    ctx.strokeStyle = 'rgba(145,235,255,0.58)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); ctx.restore();
    // wings and rocket pods
    ctx.fillStyle = '#17323b'; ctx.fillRect(-16, -43, 30, 16); ctx.fillRect(-16, 27, 30, 16);
    ctx.fillStyle = '#234e5a'; ctx.fillRect(-10, -41, 20, 12); ctx.fillRect(-10, 29, 20, 12);
    // S.H.I.E.L.D. fuselage
    ctx.fillStyle = '#183944'; ctx.beginPath(); ctx.roundRect(-48, -24, 84, 48, 16); ctx.fill();
    ctx.fillStyle = '#285665'; ctx.beginPath(); ctx.roundRect(-45, -21, 78, 24, 12); ctx.fill();
    // cockpit
    ctx.fillStyle = '#07171e'; ctx.beginPath(); ctx.roundRect(8, -17, 31, 34, 10); ctx.fill();
    ctx.fillStyle = active ? 'rgba(130,245,255,0.92)' : 'rgba(130,205,225,0.65)';
    ctx.beginPath(); ctx.roundRect(12, -13, 23, 16, 7); ctx.fill();
    // sleek shield insignia on side
    ctx.fillStyle = '#8be8ff';
    ctx.beginPath(); ctx.moveTo(-24, -13); ctx.lineTo(-9, -13); ctx.lineTo(-9, 1); ctx.quadraticCurveTo(-16, 12, -24, 15); ctx.quadraticCurveTo(-32, 12, -39, 1); ctx.lineTo(-39, -13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#12313a'; ctx.fillRect(-26, -9, 4, 17);
    // nose cannon
    ctx.fillStyle = '#0d1d23'; ctx.fillRect(34, -4, 28, 8);
    ctx.fillStyle = '#8be8ff'; ctx.fillRect(57, -2, 8, 4);
    // skids / landing stance
    ctx.strokeStyle = '#101d22'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-26, -31); ctx.lineTo(22, -31); ctx.moveTo(-26, 31); ctx.lineTo(22, 31); ctx.stroke();
    // navigation lights
    ctx.fillStyle = Math.sin(performance.now() / 110) > 0 ? '#7dffcf' : 'rgba(120,255,200,0.2)'; ctx.beginPath(); ctx.arc(-102, 0, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = Math.sin(performance.now() / 110 + 1.5) > 0 ? '#ff5d6c' : 'rgba(255,90,100,0.2)'; ctx.beginPath(); ctx.arc(42, 0, 4, 0, TAU); ctx.fill();
    ctx.restore();
    // rotor disc on top
    ctx.save(); ctx.translate(h.x, h.y + bob - 8); ctx.rotate(h.rotor);
    ctx.strokeStyle = active ? 'rgba(160,245,255,0.66)' : 'rgba(160,220,230,0.40)'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos((k / 5) * TAU) * 96, Math.sin((k / 5) * TAU) * 96); }
    ctx.stroke();
    ctx.globalAlpha = active ? 0.18 : 0.08; ctx.strokeStyle = '#bff5ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.stroke();
    ctx.restore();
    // display plate
    ctx.fillStyle = '#8be8ff'; ctx.font = '900 10px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText(active ? `S.H.I.E.L.D. GUNSHIP · FUEL ${Math.ceil(h.fuel)}%` : 'CAPTURED S.H.I.E.L.D. GUNSHIP · [F] BOARD', h.x, h.y - 70);
    if (h.hp < h.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(h.x - 52, h.y - 61, 104, 5);
      ctx.fillStyle = '#8be8ff'; ctx.fillRect(h.x - 52, h.y - 61, 104 * clamp(h.hp / h.maxHp, 0, 1), 5);
    }
    ctx.textAlign = 'left';
  }

  /** Attack gunships — armed helicopters with spinning rotors. */
  private drawHelis(ctx: CanvasRenderingContext2D, onGround = false) {
    for (const h of this.helis) {
      const grounded = (h.altitude ?? 65) < 8;
      if (grounded !== onGround) continue;
      if (h.x < this.camX - 220 || h.x > this.camX + this.w + 220 || h.y < this.camY - 220 || h.y > this.camY + this.h + 220) continue;
      ctx.save();
      const bob = Math.sin(h.t * 3.1) * 3;
      const lift = (h.altitude ?? 65) * 0.32;
      // ground shadow, dragged opposite the bank (looks like it's leaning)
      const shOff = 12 + h.bank * 34;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(h.x + Math.cos(h.ang + 1.57) * shOff, h.y + Math.sin(h.ang + 1.57) * shOff + 60, 54, 17, h.ang, 0, TAU); ctx.fill();

      ctx.translate(h.x, h.y + bob * 0.3 - lift);
      ctx.rotate(h.ang);
      // banking: foreshorten the body toward the inside of the turn
      ctx.rotate(h.bank * 0.16);
      ctx.scale(1, 1 - h.bank * 0.22);
      const accent = h.medevac ? '#8dffb0' : '#ff7a7a';
      // tail boom
      ctx.fillStyle = '#1d2a30';
      ctx.fillRect(-92, -6, 52, 12);
      ctx.fillStyle = '#2b3d45';
      ctx.fillRect(-92, -6, 52, 6);
      // tail rotor
      ctx.save();
      ctx.translate(-94, 0);
      ctx.rotate(h.rotor * 2.2);
      ctx.strokeStyle = 'rgba(190,215,225,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();
      ctx.restore();
      // tail fin
      ctx.fillStyle = '#1a252b';
      ctx.fillRect(-98, -22, 9, 22);
      // stub wings with weapon pods
      ctx.fillStyle = '#162026';
      ctx.fillRect(-16, -40, 26, 16);
      ctx.fillRect(-16, 24, 26, 16);
      ctx.fillStyle = h.medevac ? '#2c4a38' : '#3a2020';
      ctx.fillRect(-12, -38, 18, 12);
      ctx.fillRect(-12, 26, 18, 12);
      // fuselage
      ctx.fillStyle = '#22303a';
      ctx.beginPath(); ctx.roundRect(-44, -22, 78, 44, 16); ctx.fill();
      ctx.fillStyle = '#31454f';
      ctx.beginPath(); ctx.roundRect(-42, -20, 74, 22, 12); ctx.fill();
      // cockpit glass
      ctx.fillStyle = '#0a161e';
      ctx.beginPath(); ctx.roundRect(6, -16, 30, 32, 10); ctx.fill();
      ctx.fillStyle = 'rgba(130,225,255,0.85)';
      ctx.beginPath(); ctx.roundRect(10, -12, 22, 15, 7); ctx.fill();
      // nose gun / medic cross
      if (h.medevac) {
        ctx.fillStyle = '#e8fff2';
        ctx.fillRect(-14, -5, 20, 10);
        ctx.fillRect(-9, -12, 10, 24);
      } else {
        ctx.fillStyle = '#0e1418';
        ctx.fillRect(34, -4, 22, 8);
        ctx.fillStyle = accent;
        ctx.fillRect(52, -3, 6, 6);
      }
      // skids
      ctx.strokeStyle = '#141c22'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-24, -30); ctx.lineTo(18, -30);
      ctx.moveTo(-24, 30); ctx.lineTo(18, 30);
      ctx.stroke();
      // nav strobes
      ctx.fillStyle = Math.sin(performance.now() / 110) > 0 ? accent : 'rgba(255,120,120,0.25)';
      ctx.beginPath(); ctx.arc(-96, 0, 4, 0, TAU); ctx.fill();
      ctx.restore();

      // main rotor disc
      ctx.save();
      ctx.translate(h.x, h.y - 6 - lift);
      ctx.rotate(h.rotor);
      ctx.strokeStyle = 'rgba(200,228,238,0.5)'; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((k / 5) * TAU) * 96, Math.sin((k / 5) * TAU) * 96);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#cfe6ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#121c22';
      ctx.beginPath(); ctx.arc(h.x, h.y - 6 - lift, 9, 0, TAU); ctx.fill();

      // health + label
      const p = clamp(h.hp / h.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(h.x - 46, h.y - 74, 92, 6);
      ctx.fillStyle = h.medevac ? '#8dffb0' : p > 0.5 ? '#ffd166' : '#ff5d6c';
      ctx.fillRect(h.x - 46, h.y - 74, 92 * p, 6);
      ctx.fillStyle = accent;
      ctx.font = '900 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(h.medevac ? `⚕ MEDEVAC${h.carrying ? ` (${h.carrying})` : ''}` : 'GUNSHIP', h.x, h.y - 80);
      ctx.textAlign = 'left';
    }
  }

  /** S.H.I.E.L.D.-style deployable energy barriers. */
  private drawBarriers(ctx: CanvasRenderingContext2D) {
    for (const b of this.barriers) {
      if (b.x < this.camX - 200 || b.x > this.camX + this.w + 200) continue;
      const k = clamp(b.hp / b.maxHp, 0, 1);
      const fade = b.life < 4 ? (Math.sin(b.life * 12) > 0 ? 0.4 : 1) : 1;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang);
      ctx.globalAlpha = fade;
      // emitter posts
      ctx.fillStyle = '#1b2b33';
      ctx.fillRect(-b.w / 2 - 8, -10, 16, 26);
      ctx.fillRect(b.w / 2 - 8, -10, 16, 26);
      ctx.fillStyle = '#7fd8ff';
      ctx.fillRect(-b.w / 2 - 5, -8, 10, 6);
      ctx.fillRect(b.w / 2 - 5, -8, 10, 6);
      // energy field
      const pulse = 0.28 + Math.sin(performance.now() / 190) * 0.1;
      ctx.globalAlpha = fade * (pulse + (1 - k) * 0.12);
      ctx.fillStyle = '#4aa8d8';
      ctx.fillRect(-b.w / 2, -9, b.w, 18);
      ctx.globalAlpha = fade * 0.85;
      ctx.strokeStyle = '#9fe4ff'; ctx.lineWidth = 2.5;
      ctx.strokeRect(-b.w / 2, -9, b.w, 18);
      // hex scanlines
      ctx.globalAlpha = fade * 0.4;
      ctx.strokeStyle = '#cdefff'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -b.w / 2 + 10; x < b.w / 2; x += 18) {
        ctx.moveTo(x, -9); ctx.lineTo(x + 8, 9);
      }
      ctx.stroke();
      // hp
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-b.w / 2, -22, b.w, 4);
      ctx.fillStyle = k > 0.5 ? '#9fe4ff' : '#ffd166';
      ctx.fillRect(-b.w / 2, -22, b.w * k, 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** S.H.I.E.L.D. airdrop — target reticle + descending crate on a chute. */
  private drawSupply(ctx: CanvasRenderingContext2D) {
    for (const s of this.supply) {
      const k = clamp(s.t / 3.2, 0, 1);       // 1 = just dropped (high), 0 = landed
      const alt = k * 340;                    // visual altitude
      // ground target reticle
      ctx.save();
      ctx.translate(s.x, s.y);
      const pulse = 0.5 + Math.sin(performance.now() / 160) * 0.3;
      ctx.strokeStyle = `rgba(140,255,200,${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.arc(0, 0, 44, performance.now() / 900, performance.now() / 900 + TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(140,255,200,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-30, 0); ctx.lineTo(30, 0);
      ctx.moveTo(0, -30); ctx.lineTo(0, 30);
      ctx.stroke();
      ctx.fillStyle = `rgba(140,255,200,${0.5 + pulse * 0.4})`;
      ctx.font = '900 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('S.H.I.E.L.D. DROP', 0, 58);
      ctx.textAlign = 'left';
      ctx.restore();

      // falling crate with parachute
      const cx = s.x, cy = s.y - alt;
      // chute
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(160,255,210,0.8)';
      ctx.lineWidth = 2;
      const chuteW = 30 * (0.5 + k * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy - 34, chuteW, Math.PI, 0);
      ctx.stroke();
      // lines to crate
      ctx.beginPath();
      ctx.moveTo(cx - chuteW, cy - 34); ctx.lineTo(cx - 8, cy - 8);
      ctx.moveTo(cx + chuteW, cy - 34); ctx.lineTo(cx + 8, cy - 8);
      ctx.moveTo(cx, cy - 34 - chuteW * 0.4); ctx.lineTo(cx, cy - 8);
      ctx.stroke();
      ctx.restore();
      // crate
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(s.t * 2) * 0.1);
      ctx.fillStyle = '#1f3b32';
      ctx.fillRect(-14, -14, 28, 28);
      ctx.fillStyle = '#2f5a4c';
      ctx.fillRect(-14, -14, 28, 10);
      ctx.strokeStyle = '#8dffb0'; ctx.lineWidth = 2;
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.fillStyle = '#8dffb0';
      ctx.font = '900 15px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('＋', 0, 6);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  /** Wounded enemies crawling and awaiting extraction. */
  private drawWounded(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const wd of this.wounded) {
      if (wd.x < camX - 60 || wd.x > camX + this.w + 60 || wd.y < camY - 60 || wd.y > camY + this.h + 60) continue;
      const def = ENEMIES[wd.type] || ENEMIES.grunt;
      ctx.save();
      ctx.translate(wd.x, wd.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(2, 6, def.r * 0.9, def.r * 0.45, 0, 0, TAU); ctx.fill();
      // prone body
      ctx.rotate(Math.sin(wd.t * 2) * 0.12);
      ctx.fillStyle = def.dark;
      ctx.beginPath(); ctx.ellipse(0, 0, def.r * 1.05, def.r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(0, 0, def.r * 0.78, def.r * 0.42, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      // distress beacon
      const blink = Math.sin(performance.now() / 200) > 0;
      ctx.fillStyle = blink ? '#ff5d6c' : 'rgba(255,93,108,0.3)';
      ctx.beginPath(); ctx.arc(wd.x, wd.y - def.r - 10, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,93,108,${0.25 + (blink ? 0.25 : 0)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wd.x, wd.y, def.r + 14, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffb0b0';
      ctx.font = '900 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WOUNDED', wd.x, wd.y - def.r - 18);
      ctx.textAlign = 'left';
    }
  }

  /** Convoy trucks — armored transport with tailgate troop hatch. */
  private drawTrucks(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const t of this.trucks) {
      if (t.dead) continue;
      if (t.x < camX - 160 || t.x > camX + this.w + 160 || t.y < camY - 160 || t.y > camY + this.h + 160) continue;
      const motion = this.convoyMotion.get(t);
      const label = t.rescue ? `RECOVERY / ${t.carrying} ABOARD`
        : t.state === 'loading' ? `EMBARKING ${motion?.loaded || 0}/${t.comp.length}`
        : t.state === 'deploy' ? `DISEMBARKING ${t.slot}/${t.comp.length}`
        : t.state === 'leave' ? 'RETURNING TO BASE' : 'HYDRA / EN ROUTE';
      drawTransport(ctx, t, this.simulationTime, motion?.door || 0, label);
    }
  }

  /** Sapper-laid mines — blinking danger. */
  private drawMines(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const m of this.mines) {
      if (m.x < camX - 40 || m.x > camX + this.w + 40 || m.y < camY - 40 || m.y > camY + this.h + 40) continue;
      const blink = !m.armed ? Math.sin(performance.now() / 90) > 0 : Math.sin(performance.now() / 420) > 0.1;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(3, 8, 12, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20221e';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = blink ? '#ff4040' : '#7a1f28';
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill();
      // spikes
      ctx.strokeStyle = '#0d0f0d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      }
      ctx.stroke();
      if (!m.armed) {
        ctx.strokeStyle = `rgba(255,100,100,${0.4 + Math.sin(performance.now() / 70) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawServers(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const s of this.servers) {
      if (s.x < camX - 90 || s.x > camX + this.w + 90 || s.y < camY - 90 || s.y > camY + this.h + 90) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-36, -26, 72, 56);
        ctx.fillStyle = '#1b1512'; ctx.fillRect(-34, -24, 68, 52);
        ctx.strokeStyle = 'rgba(120,90,70,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(-34, -24, 68, 52);
        ctx.fillStyle = 'rgba(255,90,60,0.20)';
        for (let i = 0; i < 4; i++) ctx.fillRect(-28 + i * 16, rand(-18, 16), 10, 3);
        ctx.restore();
        continue;
      }
      const pulse = 0.55 + Math.sin(performance.now() / 320 + s.x) * 0.35;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-32, 22, 72, 16);
      // rack body
      ctx.fillStyle = '#16232b'; ctx.fillRect(-36, -30, 72, 60);
      ctx.fillStyle = '#1e3440'; ctx.fillRect(-32, -26, 64, 52);
      // blade rows with blinking LEDs
      for (let r = 0; r < 5; r++) {
        const y = -22 + r * 10;
        ctx.fillStyle = 'rgba(6,16,20,0.9)'; ctx.fillRect(-28, y, 56, 7);
        for (let c = 0; c < 6; c++) {
          const on = Math.sin(performance.now() / (110 + c * 37) + r * 2 + s.x) > 0;
          ctx.fillStyle = on ? '#7ff0ff' : 'rgba(60,140,160,0.4)';
          ctx.fillRect(-25 + c * 9, y + 2, 4, 3);
        }
      }
      ctx.strokeStyle = `rgba(127,240,255,${pulse})`; ctx.lineWidth = 2.5;
      ctx.strokeRect(-36, -30, 72, 60);
      if (s.spark > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${s.spark * 3})`; ctx.lineWidth = 3;
        ctx.strokeRect(-40, -34, 80, 68);
      }
      // health
      const p = clamp(s.hp / s.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(-36, 36, 72, 6);
      ctx.fillStyle = p > 0.5 ? '#7ff0ff' : p > 0.25 ? '#ffd166' : '#ff5d6c';
      ctx.fillRect(-36, 36, 72 * p, 6);
      ctx.fillStyle = 'rgba(127,240,255,0.85)';
      ctx.font = '900 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MAINFRAME', 0, -38);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  private drawCaches(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const c of this.caches) {
      if (c.dead) continue;
      if (c.x < camX - 60 || c.x > camX + this.w + 60 || c.y < camY - 60 || c.y > camY + this.h + 60) continue;
      const pulse = 0.6 + Math.sin(performance.now() / 500 + c.x) * 0.25;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-18, 12, 40, 12);
      ctx.fillStyle = '#2c3a1e'; ctx.fillRect(-20, -15, 40, 32);
      ctx.fillStyle = '#46552e'; ctx.fillRect(-17, -12, 34, 26);
      ctx.strokeStyle = `rgba(183,255,158,${pulse})`; ctx.lineWidth = 2;
      ctx.strokeRect(-20, -15, 40, 32);
      ctx.fillStyle = '#d7ff9e';
      ctx.font = '900 14px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('+', 0, 6);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  private drawSquadLinks(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const s of this.squads) {
      const mates = this.enemies.filter((e) => e.squadId === s.id && e.spawnT <= 0);
      if (mates.length < 2) continue;
      const leader = mates.find((m) => m.leader) || mates[0];
      const col = s.tactic === 'blitz' ? '255,138,61'
        : s.tactic === 'bombers' ? '255,176,61'
        : s.tactic === 'turtle' ? '127,166,255'
        : s.tactic === 'phalanx' ? '160,200,255' : '255,93,93';
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${col},${s.state === 'engage' ? 0.3 : 0.17})`;
      ctx.beginPath();
      for (const m of mates) { if (m === leader) continue; ctx.moveTo(leader.x, leader.y); ctx.lineTo(m.x, m.y); }
      ctx.stroke();

      if (s.volleyWindow > 0) {
        const pulse = 0.55 + Math.sin(performance.now() / 55) * 0.35;
        ctx.strokeStyle = `rgba(255,180,90,${pulse})`; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (const m of mates) if (m.def.ranged) { ctx.moveTo(m.x, m.y); ctx.lineTo(s.fx, s.fy); }
        ctx.stroke();
        ctx.setLineDash([7, 5]);
        ctx.strokeStyle = 'rgba(255,180,90,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.fx, s.fy, 30, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (s.doctrine === 'anchor' && s.state === 'engage') {
        ctx.strokeStyle = `rgba(${col},0.35)`; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(leader.x, leader.y, 28, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    for (const p of this.pickups) {
      if (p.x < this.camX - 50 || p.x > this.camX + this.w + 50 || p.y < this.camY - 50 || p.y > this.camY + this.h + 50) continue;
      const bob = Math.sin(p.t * 4) * 4;
      ctx.globalAlpha = p.life < 3 ? (Math.sin(p.life * 14) > 0 ? 0.35 : 1) : 1;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.rotate(Math.sin(p.t * 2) * 0.2);
      // Any unknown key falls back to the rifle colour: a bad pickup must never be able to
      // throw inside the draw call, because one throw freezes the whole frame.
      const col = p.kind === 'health' ? '#5dff9b' : p.kind === 'grenade' ? '#8fd0ff'
        : p.kind === 'ammo' ? '#ffd166'
        : p.kind === 'shield' || p.kind === 'aegis' ? '#7fd8ff'
        : (WEAPONS[p.weapon || '']?.color || '#8ce8ff');
      ctx.shadowColor = col; ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(10,20,18,0.92)'; ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(-13, -13, 26, 26);
      ctx.shadowBlur = 0; ctx.fillStyle = col;
      if (p.kind === 'health') { ctx.fillRect(-8, -2.5, 16, 5); ctx.fillRect(-2.5, -8, 5, 16); }
      else if (p.kind === 'shield' || p.kind === 'aegis') {
        ctx.beginPath();
        ctx.moveTo(-8, -7);
        ctx.lineTo(8, -7); ctx.lineTo(8, 1);
        ctx.quadraticCurveTo(8, 7, 0, 9);
        ctx.quadraticCurveTo(-8, 7, -8, 1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(10,20,30,0.9)';
        ctx.fillRect(-2, -4, 4, 7);
      }
      else if (p.kind === 'grenade') { ctx.beginPath(); ctx.arc(0, 1, 6, 0, TAU); ctx.fill(); ctx.fillRect(-2, -9, 4, 4); }
      else if (p.kind === 'ammo') {
        // a bandolier: three rounds and a belt link
        ctx.fillRect(-9, -6, 5, 13); ctx.fillRect(-1, -6, 5, 13); ctx.fillRect(7, -6, 5, 13);
        ctx.fillStyle = 'rgba(10,20,18,0.9)';
        ctx.fillRect(-9, 1, 5, 3); ctx.fillRect(-1, 1, 5, 3); ctx.fillRect(7, 1, 5, 3);
      }
      else { ctx.fillRect(-9, -2, 18, 4); ctx.fillRect(3, -6, 4, 5); ctx.fillRect(-7, 2, 4, 6); }
      if (p.kind === 'aegis') { ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#a8efff'; ctx.fillText('C / 3s', 0, 26); ctx.textAlign = 'left'; }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawMarks(ctx: CanvasRenderingContext2D) {
    for (const m of this.marks) {
      const k = 1 - m.t / 0.5;
      ctx.strokeStyle = `rgba(255,80,90,${0.85 * (1 - k * 0.4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(m.x, m.y, 12 + k * 28, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - 22, m.y); ctx.lineTo(m.x + 22, m.y);
      ctx.moveTo(m.x, m.y - 22); ctx.lineTo(m.x, m.y + 22);
      ctx.stroke();
    }
  }

  /** Power yards: glowing turbine stacks, feeder cables and live per-site output. */
  private drawPowerComplex(ctx: CanvasRenderingContext2D) {
    const sites = this.campaignSites;
    if (!sites) return;
    const center = { x: this.camX + this.w / 2, y: this.camY + this.h / 2 };
    for (const site of sites.powerSites) {
      const scx = site.x + site.w / 2, scy = site.y + site.h / 2;
      if (Math.hypot(center.x - scx, center.y - scy) > 1600) continue;
      const cells = sites.powerCells.filter(c => c.site === site.id);
      const state = this.sitePower.get(site.id);
      const load = state ? state.load : 1;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = site.major ? '#d2b36d99' : '#b9c0a877';
      ctx.font = `bold ${site.major ? 32 : 22}px monospace`;
      ctx.fillText(site.name, scx, site.y - 52);
      ctx.font = '10px monospace'; ctx.fillStyle = load > 0 ? '#9fae8a99' : '#e08a6a99';
      const gens = cells.filter(c => c.kind === 'generator');
      const srvs = cells.filter(c => c.kind === 'server');
      ctx.fillText(
        `${site.code} / OUTPUT ${Math.round(load * 100)}% / ${gens.filter(g => !g.dead).length}-${gens.length} GEN / ${srvs.filter(v => !v.dead).length}-${srvs.length} SRV`,
        scx, site.y - 30,
      );
      // feeder cables from the yard spine to each generator
      ctx.strokeStyle = load <= 0 ? '#1b2630' : '#554a33'; ctx.lineWidth = 5;
      ctx.beginPath();
      for (const cell of gens) {
        ctx.moveTo(scx, site.y + 70);
        ctx.quadraticCurveTo((scx + cell.x) / 2, cell.y - 70, cell.x, cell.y);
      }
      ctx.stroke();
      for (const cell of cells) {
        const dead = cell.dead;
        ctx.save(); ctx.translate(cell.x, cell.y);
        if (cell.kind === 'generator') {
          ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(8, 20, 78, 24, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = dead ? '#242a2c' : '#3c342a'; ctx.beginPath(); ctx.roundRect(-62, -78, 124, 156, 14); ctx.fill();
          ctx.fillStyle = dead ? '#171d1f' : '#51462f'; ctx.beginPath(); ctx.roundRect(-54, -70, 108, 62, 9); ctx.fill();
          ctx.fillStyle = dead ? '#1d2427' : '#414e52'; ctx.beginPath(); ctx.roundRect(-54, 2, 108, 66, 9); ctx.fill();
          if (!dead) {
            // turbine fins spin, faster the healthier the yard is
            ctx.save(); ctx.rotate(this.simulationTime * (1.5 + load * 1.6));
            for (let fin = 0; fin < 4; fin++) { ctx.fillStyle = '#e5b94c'; ctx.fillRect(-7, -46, 14, 40); }
            ctx.restore();
            ctx.fillStyle = '#f2ca6b'; ctx.beginPath(); ctx.arc(0, -22, 17, 0, TAU); ctx.fill();
            ctx.fillStyle = '#8fe8c0';
            for (let i = 0; i < 4; i++) ctx.fillRect(-46 + i * 24, 14, 16, 7);
            ctx.strokeStyle = 'rgba(255,220,140,0.4)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 88, 0, TAU); ctx.stroke();
          } else {
            ctx.fillStyle = '#0f1416'; ctx.beginPath(); ctx.arc(0, -22, 17, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#5c3a2a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-40, 20); ctx.lineTo(30, 60); ctx.stroke();
          }
          if (!dead && Math.random() < 0.03) { ctx.fillStyle = '#ffe6a8'; ctx.fillRect(rand(-40, 40), rand(-70, 70), 2, 2); }
        } else {
          // server rack: blinking LED columns, all out when the hall loses power
          ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(6, 12, 66, 16, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = dead ? '#1e2428' : '#2c3a4a'; ctx.beginPath(); ctx.roundRect(-58, -30, 116, 60, 8); ctx.fill();
          for (let row = 0; row < 3; row++) for (let led = 0; led < 8; led++) {
            const on = !dead && (Math.floor(this.simulationTime * 3 + led * 0.7 + row) % 4 !== 0);
            ctx.fillStyle = on ? (led % 3 === 0 ? '#8ff0ff' : '#76e8b8') : dead ? '#10161a' : '#233341';
            ctx.fillRect(-48 + led * 12, -22 + row * 16, 9, 11);
          }
        }
        if (!dead && Math.hypot(this.px - cell.x, this.py - cell.y) < 230) {
          ctx.fillStyle = '#f5d28a'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
          const pct = Math.max(0, Math.ceil((cell.hp / cell.maxHp) * 100));
          ctx.fillText(`${cell.kind === 'generator' ? 'GENERATOR' : 'SERVERS'} / ${pct}% INTEGRITY`, 0, cell.kind === 'generator' ? 100 : 58);
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const e of this.enemies) {
      if (e.x < camX - 90 || e.x > camX + this.w + 90 || e.y < camY - 90 || e.y > camY + this.h + 90) continue;
      const def = e.def;
      const spawning = e.spawnT > 0;

      // commander aura
      if (e.type === 'commander' && !spawning) {
        ctx.save();
        ctx.globalAlpha = 0.14 + Math.sin(performance.now() / 400) * 0.05;
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
        ctx.beginPath(); ctx.arc(e.x, e.y, 360, 0, TAU); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
      // sniper laser
      if (e.type === 'sniper' && e.snipeT > 0) {
        ctx.save(); ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 1.6; ctx.setLineDash([9, 7]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.snipeAng) * 900, e.y + Math.sin(e.snipeAng) * 900);
        ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      }
      // aim-lock tell
      if (e.aimLock > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,160,80,${0.3 + Math.sin(performance.now() / 55) * 0.28})`;
        ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.aimAng) * 420, e.y + Math.sin(e.aimAng) * 420);
        ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      }

      ctx.save();
      ctx.translate(e.x, e.y);
      if (spawning) { const k = 1 - e.spawnT / 0.5; ctx.globalAlpha = k; ctx.scale(0.4 + k * 0.6, 0.4 + k * 0.6); }

      if (e.elite) {
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, def.r + 5 + Math.sin(performance.now() / 300) * 1.5, 0, TAU); ctx.stroke();
      }
      if (e.buffed) {
        ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, def.r + 9, 0, TAU); ctx.stroke();
      }
      // drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(4, def.r * 0.6, def.r * 0.95, def.r * 0.5, 0, 0, TAU); ctx.fill();

      ctx.rotate(e.ang);
      const squash = 1 + Math.sin(e.wobble) * 0.05;
      ctx.scale(1 / squash, squash);
      if (e.type === 'specter' && e.flash <= 0) ctx.globalAlpha *= 0.52 + Math.sin(e.wobble * 0.7) * 0.12;
      const body = e.flash > 0 ? '#ffffff' : def.color;

      if (e.type === 'general') {
        // ornate command figure — cape, epaulettes, no weapon
        ctx.fillStyle = '#5a3f06';
        ctx.beginPath(); ctx.ellipse(-8, 0, def.r * 0.95, def.r * 1.15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = def.dark;
        ctx.beginPath(); ctx.arc(0, 0, def.r, 0, TAU); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(0, 0, def.r * 0.76, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a5a10';
        ctx.fillRect(-4, -def.r * 0.85, 8, def.r * 1.7);
        ctx.fillStyle = '#fff3c9';
        ctx.beginPath(); ctx.arc(def.r * 0.34, 0, def.r * 0.22, 0, TAU); ctx.fill();
        // rank stars
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 4; i++) ctx.fillRect(-def.r * 0.5 + i * 7, -def.r * 0.25, 4, 4);
      } else if (e.type === 'coder') {
        // hunched civilian with a tablet, hands up when panicking
        ctx.fillStyle = def.dark;
        ctx.beginPath(); ctx.arc(0, 0, def.r, 0, TAU); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(0, 0, def.r * 0.74, 0, TAU); ctx.fill();
        ctx.fillStyle = '#0d1c24';
        ctx.fillRect(def.r * 0.1, -6, 11, 12);
        ctx.fillStyle = e.panic > 0.3 ? '#ff9a9a' : '#7ff0ff';
        ctx.fillRect(def.r * 0.1 + 2, -4, 7, 8);
      } else if (e.type === 'drone') {
        // Sector-3 aerial sentry: floating Hydra tech, no human silhouette.
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(2, 16, 18, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = def.dark; ctx.beginPath(); ctx.roundRect(-17, -10, 34, 20, 8); ctx.fill();
        ctx.fillStyle = body; ctx.beginPath(); ctx.roundRect(-13, -7, 26, 14, 6); ctx.fill();
        ctx.strokeStyle = '#87eaff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
        ctx.fillStyle = '#e5fbff'; ctx.beginPath(); ctx.arc(10, 0, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#10242a'; ctx.fillRect(15, -3, 17, 6);
      } else if (e.type === 'turret') {
        // Automated Hydra sentry tower.
        ctx.fillStyle = '#20282b'; ctx.fillRect(-14, -14, 28, 28);
        ctx.fillStyle = '#394248'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(3, 0, 8, 0, TAU); ctx.fill();
        ctx.fillStyle = '#101417'; ctx.fillRect(4, -4, 30, 8);
        ctx.fillStyle = '#ff3858'; ctx.beginPath(); ctx.arc(6, 0, 3, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,56,88,0.45)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
      } else if (e.type === 'warhound') {
        // Low quadruped assault machine.
        ctx.fillStyle = def.dark; ctx.beginPath(); ctx.ellipse(0, 0, 17, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(4, 0, 13, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#26120d';
        ctx.fillRect(-10, -13, 5, 10); ctx.fillRect(-10, 3, 5, 10);
        ctx.fillRect(7, -13, 5, 10); ctx.fillRect(7, 3, 5, 10);
        ctx.fillStyle = '#fff0d8'; ctx.beginPath(); ctx.arc(13, -3, 2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(13, 3, 2, 0, TAU); ctx.fill();
      } else {
        // weapon
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#241e1b';
        if (e.type === 'sniper') ctx.fillRect(def.r * 0.3, -2, def.r * 1.6, 4);
        else if (e.type === 'bomber') { ctx.fillRect(def.r * 0.4, -4, def.r * 0.7, 8); ctx.fillStyle = '#ffb03d'; ctx.beginPath(); ctx.arc(def.r * 1.1, 0, 5, 0, TAU); ctx.fill(); }
        else if (e.type === 'raider') {
          // twin combat blades
          ctx.fillStyle = '#d8dee8';
          ctx.fillRect(def.r * 0.5, -7, 4, 16);
          ctx.fillRect(def.r * 0.5, -9, 4, 16);
          ctx.fillStyle = '#9aa7b8';
          ctx.fillRect(def.r * 0.5, 7, 4, 4);
          ctx.fillRect(def.r * 0.5, 5, 4, 4);
        }
        else if (e.type === 'juggernaut') { ctx.fillRect(def.r * 0.25, -7, def.r * 1.25, 14); }
        else if (e.type === 'flamer') {
          // wide-bore projector with a hose back to the fuel tank
          ctx.fillStyle = '#2a2320'; ctx.fillRect(def.r * 0.35, -4, def.r * 1.15, 8);
          ctx.fillStyle = '#6d5a4a'; ctx.fillRect(def.r * 1.2, -5.5, 7, 11);
          ctx.strokeStyle = '#4a3b30'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-def.r * 0.7, 7); ctx.quadraticCurveTo(0, 12, def.r * 0.4, 3); ctx.stroke();
          ctx.fillStyle = e.cool > def.fireRate! * 0.55 ? '#ffd166' : '#ff6a2c';
          ctx.beginPath(); ctx.arc(def.r * 1.55, 0, 3.2, 0, TAU); ctx.fill();
        }
        else if (e.type === 'specter') { ctx.fillRect(def.r * 0.35, -2, def.r * 1.1, 4); }
        else if (e.type === 'medic') { ctx.fillRect(def.r * 0.4, -2.5, def.r * 0.9, 5); }
        else if (e.type === 'sapper') { ctx.fillRect(def.r * 0.4, -3, def.r * 0.9, 6); }
        else ctx.fillRect(def.r * 0.4, -3, def.r * 0.9, 6);

        ctx.fillStyle = def.dark;
        ctx.beginPath(); ctx.arc(0, 0, def.r, 0, TAU); ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(0, 0, def.r * 0.78, 0, TAU); ctx.fill();
        // medic cross / sapper mine pouch on the chest
        if (e.type === 'medic') {
          ctx.fillStyle = '#e8fff2';
          ctx.fillRect(-3, -7, 6, 14);
          ctx.fillRect(-7, -3, 14, 6);
        } else if (e.type === 'sapper') {
          ctx.fillStyle = '#2a2418';
          ctx.beginPath(); ctx.arc(4, 4, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd166';
          ctx.fillRect(2, 2, 4, 4);
        } else if (e.type === 'warden') {
          ctx.fillStyle = '#aac6c5'; ctx.fillRect(-9, -16, 16, 5); ctx.fillRect(-9, 11, 16, 5);
          ctx.fillStyle = '#102b39'; ctx.fillRect(-7, -8, 9, 16);
          ctx.strokeStyle = '#d6eddb'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-1, 0); ctx.lineTo(-5, 4); ctx.stroke();
        } else if (e.type === 'flamer') {
          // pressurised fuel tank strapped to the back, hazard bands and a pilot gauge
          ctx.fillStyle = '#3a2b1c'; ctx.beginPath(); ctx.roundRect(-def.r - 9, -9, 15, 18, 5); ctx.fill();
          ctx.fillStyle = '#b8642c'; ctx.beginPath(); ctx.roundRect(-def.r - 7, -7, 11, 14, 4); ctx.fill();
          ctx.fillStyle = '#f2d27a'; ctx.fillRect(-def.r - 7, -2, 11, 2.5);
          ctx.fillStyle = '#2b1d12'; ctx.fillRect(-def.r - 4, -11, 5, 4);
          ctx.fillStyle = Math.sin(e.wobble * 2) > 0 ? '#ff8a3d' : '#7a3a15';
          ctx.beginPath(); ctx.arc(-2, 6, 2.6, 0, TAU); ctx.fill();
        } else if (e.type === 'pathfinder') {
          ctx.fillStyle = '#748261'; ctx.fillRect(-16, -7, 9, 14);
          ctx.strokeStyle = '#bed88d'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-13, -7); ctx.lineTo(-19, -20); ctx.stroke();
          ctx.fillStyle = '#dfeb9e'; ctx.fillRect(0, -7, 5, 3);
        }

        // ARMY CAMOUFLAGE. Every soldier in the district wears the same disruptive
        // pattern, drawn deterministically from his own position so it never flickers.
        if (e.type.startsWith('army')) {
          const seed = Math.abs(Math.round(e.homeX * 0.37 + e.homeY * 0.11));
          ctx.save();
          ctx.beginPath(); ctx.arc(0, 0, def.r * 0.78, 0, TAU); ctx.clip();
          const tones = ['#48582f', '#5c6b3c', '#39472a', '#6b7448', '#2f3a22'];
          for (let i = 0; i < 7; i++) {
            const a = ((seed + i * 71) % 360) * Math.PI / 180;
            const rr = ((seed + i * 37) % 100) / 100 * def.r * 0.7;
            ctx.fillStyle = tones[(seed + i) % tones.length];
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr,
              def.r * (0.22 + ((seed + i) % 5) * 0.05), def.r * 0.16, a, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
          // helmet ring + webbing
          ctx.strokeStyle = '#2b3324'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(0, 0, def.r * 0.78, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#2b3324';
          ctx.fillRect(-def.r * 0.7, -2, def.r * 1.4, 4);
          // rank chevron for the majors
          if (e.type === 'armymajor') {
            ctx.fillStyle = '#e2d79a';
            ctx.fillRect(-4, -def.r * 0.95, 8, 3);
            ctx.fillRect(-4, -def.r * 0.95 + 5, 8, 3);
          }
          if (e.type === 'armymedic') {
            ctx.fillStyle = '#e8fff2';
            ctx.fillRect(-2.5, 2, 5, 10);
            ctx.fillRect(-5, 4.5, 10, 5);
          }
        }

        // Custody officer: dark blue uniform, white "POLICE" band, visored helmet.
        if (e.type === 'custodian') {
          ctx.fillStyle = '#16243a'; ctx.fillRect(-def.r * 0.9, -def.r * 0.7, def.r * 1.8, def.r * 1.4);
          ctx.fillStyle = '#dfe9ff'; ctx.fillRect(-def.r * 0.9, -3, def.r * 1.8, 5);
          ctx.fillStyle = '#0e1a2b';
          ctx.beginPath(); ctx.ellipse(def.r * 0.1, 0, def.r * 0.55, def.r * 0.72, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#7fb0ff';
          ctx.beginPath(); ctx.ellipse(def.r * 0.34, 0, def.r * 0.34, def.r * 0.5, 0, 0, TAU); ctx.fill();
          // baton in the free hand
          ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-def.r * 0.7, def.r * 0.5); ctx.lineTo(-def.r * 1.2, def.r * 1.1); ctx.stroke();
        }

        // riot shield for shieldmen — a real visual wall
        if (def.shield) {
          ctx.fillStyle = e.flash > 0 ? '#fff' : '#9fc2ff';
          ctx.beginPath();
          ctx.arc(0, 0, def.r + 9, -0.95, 0.95);
          ctx.lineTo(def.r * 0.2, 0);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#dce9ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, def.r + 9, -0.95, 0.95); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(10,8,10,0.85)';
        ctx.beginPath(); ctx.ellipse(def.r * 0.3, 0, def.r * 0.3, def.r * 0.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = e.flash > 0 ? '#fff'
          : e.type === 'sniper' ? '#9fe8ff'
          : e.type === 'commander' ? '#ffd166'
          : e.type === 'guard' ? '#9be8c4' : '#ffe27d';
        ctx.beginPath(); ctx.ellipse(def.r * 0.34, 0, def.r * 0.13, def.r * 0.3, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // health bar
      if (!spawning && e.hp < e.maxHp) {
        const w = def.boss ? 120 : e.type === 'general' ? 130 : e.elite ? def.r * 2.8 : def.r * 2.2;
        const p = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(e.x - w / 2, e.y - def.r - 13, w, 5);
        ctx.fillStyle = e.type === 'general' ? '#ffe08a' : e.elite ? '#ffd166' : p > 0.5 ? '#7dff9b' : p > 0.25 ? '#ffd166' : '#ff5d6c';
        ctx.fillRect(e.x - w / 2, e.y - def.r - 13, w * p, 5);
      }
      // leader star
      if (!spawning && e.leader && !def.civilian) {
        ctx.fillStyle = '#ffd166'; ctx.font = '900 12px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText('★', e.x, e.y - def.r - (e.hp < e.maxHp ? 20 : 9));
        ctx.textAlign = 'left';
      }
      // civilian tag
      if (!spawning && def.civilian) {
        ctx.fillStyle = e.type === 'general' ? '#ffe08a' : '#8fd8ff';
        ctx.font = '900 10px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText(e.type === 'general' ? '✪ GENERAL' : 'PROGRAMMER', e.x, e.y - def.r - 20);
        if (e.type === 'general' && this.servers.some((s) => !s.dead)) {
          ctx.save();
          ctx.strokeStyle = `rgba(255,209,102,${0.35 + Math.sin(performance.now() / 260) * 0.2})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(e.x, e.y, def.r + 16, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        ctx.textAlign = 'left';
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const W = WEAPONS[this.weapon];
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(4, 10, 16, 8, 0, 0, TAU); ctx.fill();

    // laser sight
    ctx.save();
    ctx.rotate(this.pang);
    const grd = ctx.createLinearGradient(20, 0, 520, 0);
    grd.addColorStop(0, 'rgba(255,80,90,0.55)');
    grd.addColorStop(1, 'rgba(255,80,90,0)');
    ctx.strokeStyle = grd; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(520, 0); ctx.stroke();
    ctx.restore();

    ctx.rotate(this.pang);
    const rec = -this.recoil;
    if (this.iFrames > 0 && Math.sin(performance.now() / 30) > 0) ctx.globalAlpha = 0.55;

    // legs animate with walk cycle
    const legs = Math.sin(this.walkCycle) * 4;
    ctx.fillStyle = '#20504f';
    ctx.fillRect(-12, -11 + legs, 12, 8);
    ctx.fillRect(-12, 3 - legs, 12, 8);
    // weapon
    ctx.fillStyle = '#12181a';
    ctx.fillRect(6 + rec, -3.5, 14 + W.len, 7);
    ctx.fillStyle = W.color;
    ctx.fillRect(14 + rec + W.len * 0.4, -2, 8, 4);
    // body
    ctx.fillStyle = '#0f2a2c';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2fd6c4';
    ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c1f21';
    ctx.fillRect(-4, -8, 7, 16);
    ctx.fillStyle = '#e9fffb';
    ctx.beginPath(); ctx.arc(4, 0, 5.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a1416';
    ctx.fillRect(4, -3.4, 5, 6.8);

    // BALLISTIC SHIELD — translucent riot barrier facing the aim
    if (this.shieldHp > 0) {
      const k = this.shieldHp / Math.max(1, this.shieldMax);
      const flick = Math.sin(performance.now() / 180) * 0.06;
      ctx.globalAlpha = 0.28 + flick + (1 - k) * 0.1;
      ctx.fillStyle = '#2a6d8a';
      ctx.beginPath();
      ctx.moveTo(8, -18);
      ctx.arc(8, 0, 18, -1.15, 1.15);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.55 + flick;
      ctx.strokeStyle = '#7fd8ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(8, 0, 18, -1.15, 1.15);
      ctx.stroke();
      // hex plate lines
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#9fd8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, -14); ctx.lineTo(18, -14);
      ctx.moveTo(8, -7); ctx.lineTo(20, -7);
      ctx.moveTo(8, 0); ctx.lineTo(21, 0);
      ctx.moveTo(8, 7); ctx.lineTo(20, 7);
      ctx.moveTo(8, 14); ctx.lineTo(18, 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawGrenades(ctx: CanvasRenderingContext2D) {
    for (const g of this.nades) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(g.x, g.y, 6, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = g.t < 0.5 && Math.sin(g.t * 40) > 0 ? '#ff5d5d' : '#93b98f';
      ctx.beginPath(); ctx.arc(g.x, g.y - g.z, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#0d1412'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    for (const g of this.enemyNades) {
      const k = 1 - g.t / g.total;
      ctx.save();
      ctx.strokeStyle = `rgba(255,80,80,${0.35 + Math.sin(performance.now() / 90) * 0.25})`;
      ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.beginPath(); ctx.arc(g.tx, g.ty, 72, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,80,80,${0.1 + k * 0.16})`;
      ctx.beginPath(); ctx.arc(g.tx, g.ty, 72 * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,80,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(g.tx - 11, g.ty); ctx.lineTo(g.tx + 11, g.ty);
      ctx.moveTo(g.tx, g.ty - 11); ctx.lineTo(g.tx, g.ty + 11);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(g.x, g.y, 6, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a1e28';
      ctx.beginPath(); ctx.arc(g.x, g.y - g.z, 6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /** Target bracket for the air-to-air station: what the Sidewinder is actually holding. */
  private drawHeliOrdnance(ctx: CanvasRenderingContext2D) {
    const h = this.playerHeli;
    if (!h || !this.piloting) return;
    if (HELI_ORDNANCE[h.station ?? 0].target === 'ground') return;
    const target = this.heliAirTarget(h, 2600);
    if (!target) return;
    if (target.x < this.camX - 80 || target.x > this.camX + this.w + 80) return;
    if (target.y < this.camY - 80 || target.y > this.camY + this.h + 80) return;
    const d = Math.hypot(target.x - h.x, target.y - h.y);
    const r = 34 + Math.sin(this.simulationTime * 6) * 3;
    ctx.save();
    ctx.strokeStyle = 'rgba(159,228,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(target.x, target.y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(159,228,255,0.45)';
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(target.x, target.y); ctx.stroke();
    ctx.fillStyle = 'rgba(190,240,255,0.9)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${h.station === 2 ? 'AIM-9 LOCK' : 'AIR CONTACT'} · ${Math.round(d)} m`, target.x, target.y - r - 8);
    ctx.restore();
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round';
    for (const b of this.bullets) {
      if (b.x < this.camX - 60 || b.x > this.camX + this.w + 60 || b.y < this.camY - 60 || b.y > this.camY + this.h + 60) continue;
      if (b.rocket) {
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = b.arm === 'air' ? '#dcefff' : '#ffd08a'; ctx.fillRect(-10, -4, 20, 8);
        ctx.fillStyle = b.arm === 'air' ? '#7fd8ff' : '#ff6b35';
        ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(18, 0); ctx.lineTo(10, 4); ctx.fill();
        ctx.restore();
        continue;
      }
      const tail = b.friendly ? 5 : 3.4;
      ctx.strokeStyle = b.color; ctx.lineWidth = b.r * 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012 * tail, b.y - b.vy * 0.012 * tail);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = clamp(k, 0, 1);
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + k * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  private drawShocks(ctx: CanvasRenderingContext2D) {
    for (const s of this.shocks) {
      const k = s.t / s.life;
      ctx.strokeStyle = `rgba(${s.color},${k * 0.85})`;
      ctx.lineWidth = s.width * k;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
    }
  }

  private drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      if (t.x < this.camX - 100 || t.x > this.camX + this.w + 100) continue;
      const k = t.life / t.max;
      ctx.globalAlpha = clamp(k * 1.4, 0, 1);
      ctx.font = `900 ${t.size}px ui-monospace, Menlo, monospace`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.78)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /** Additive bloom / light pass — the big visual upgrade. */
  private drawLighting(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const lc = this.lightCtx, cv = this.lightCv;
    if (!lc || !cv) return;
    const sx = cv.width / this.w;
    lc.clearRect(0, 0, cv.width, cv.height);
    lc.globalCompositeOperation = 'lighter';

    const dark = this.blackout.active;
    const glow = (x: number, y: number, r: number, color: string, a: number) => {
      if (dark) { a *= 0.16; r *= 0.72; }
      const px = (x - camX) * sx, py = (y - camY) * sx, pr = r * sx;
      if (px < -pr || py < -pr || px > cv.width + pr || py > cv.height + pr) return;
      const g = lc.createRadialGradient(px, py, 0, px, py, Math.max(1, pr));
      g.addColorStop(0, `rgba(${color},${a})`);
      g.addColorStop(0.45, `rgba(${color},${a * 0.4})`);
      g.addColorStop(1, `rgba(${color},0)`);
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(px, py, Math.max(1, pr), 0, TAU); lc.fill();
    };

    // ambient player aura + muzzle-ready warmth — grows when the grid is dead, your only lantern
    glow(this.px, this.py, dark ? 460 : 260, '90,220,200', dark ? 0.30 : 0.14);
    // bright headlamp pools of hunting infantry in the dark
    if (dark) for (const e of this.enemies) {
      if (e.def.civilian || e.spawnT > 0 || e.hp <= 0) continue;
      glow(e.x, e.y, 200, '255,238,170', 0.34);
      glow(e.x + Math.cos(e.ang) * 130, e.y + Math.sin(e.ang) * 130, 240, '255,238,170', e.alert ? 0.4 : 0.22);
    }
    // Powered installation lighting browns out generator by generator, then dies with HELIOS.
    const brown = dark ? 0 : 0.3 + 0.7 * this.gridOutput;
    const flick = brown > 0 && this.gridOutput < 1 ? (Math.sin(performance.now() / 90) > 0.1 ? 1 : 0.3) : 1;
    if (!dark) for (const s of this.servers) if (!s.dead) glow(s.x, s.y, 240, '80,220,255', (0.2 + Math.sin(performance.now() / 340 + s.x) * 0.05) * brown * flick);
    if (this.campaignSites) for (const cell of this.campaignSites.powerCells) {
      if (cell.dead) continue;
      const local = this.sitePower.get(cell.site);
      const k = dark ? 0.3 : (local && local.dead ? 0.12 : 0.26 * (0.4 + 0.6 * (local ? local.load : 1)));
      glow(cell.x, cell.y, cell.kind === 'generator' ? 300 : 220, cell.kind === 'generator' ? '255,196,90' : '130,215,255', k);
    }
    // dynamic lights
    for (const l of this.lights) {
      const k = clamp(l.life / l.max, 0, 1);
      glow(l.x, l.y, l.r * (0.6 + k * 0.4), l.color, 0.42 * k);
    }
    // Mainframes and building floods depend on their own feeder yard.
    for (const f of this.facilities) {
      if (f.dark) continue;
      if (f.x + f.w < camX - 150 || f.x > camX + this.w + 150 || f.y + f.h < camY - 150 || f.y > camY + this.h + 150) continue;
      const color = f.secured ? '105,220,175' : f.alarm ? '235,130,95' : f.kind === 'radar' ? '130,160,225' : '110,185,195';
      glow(f.x + f.w / 2, f.y + f.h, 140, color, 0.13 * brown * flick);
      if (!f.roofed || f.reveal > 0.4) {
        for (const prop of f.props) if (!prop.destroyed && (prop.kind === 'chamber' || prop.kind === 'console' || prop.kind === 'rack'))
          glow(prop.x + prop.w / 2, prop.y + prop.h / 2, prop.kind === 'rack' ? 120 : 90, f.kind === 'laboratory' ? '100,225,178' : '110,192,211', 0.1 * (f.roofed ? f.reveal : 1) * brown * flick);
      }
    }
    // general beacon
    if (!dark && this.general) glow(this.general.x, this.general.y, 340, '255,209,102', 0.16);
    // caches
    for (const c of this.caches) if (!c.dead) glow(c.x, c.y, 130, '160,255,140', 0.1);
    // explosions / shocks
    for (const s of this.shocks) glow(s.x, s.y, s.r * 2.2, s.color, (s.t / s.life) * 0.3);
    // tracer glow
    for (const b of this.bullets) glow(b.x, b.y, b.rocket ? 150 : 62, b.friendly ? '140,230,255' : '255,120,90', b.rocket ? 0.4 : 0.16);
    // pickups
    for (const p of this.pickups) glow(p.x, p.y, 100, p.kind === 'health' ? '90,255,150' : p.kind === 'grenade' ? '140,210,255' : '255,210,130', 0.16);
    // Aircraft carry no light while they are airborne: gunships, the operative's
    // gunship, the bomber, VTOLs and the transports are dark in flight.
    for (const h of this.helis) {
      if ((h.altitude ?? 65) >= 8) continue;
      glow(h.x, h.y, 220, h.medevac ? '140,255,180' : '255,170,110', 0.16);
    }
    if (this.playerHeli && !this.piloting) {
      glow(this.playerHeli.x, this.playerHeli.y, 200, '120,235,255', 0.14);
    }
    // energy barriers
    for (const b of this.barriers) glow(b.x, b.y, 220, '120,210,255', 0.3);
    // wounded distress beacons
    for (const wd of this.wounded) glow(wd.x, wd.y, 110, '255,90,110', 0.2);
    // S.H.I.E.L.D. supply drop beacon
    for (const s of this.supply) glow(s.x, s.y, 260, '140,255,200', 0.4);
    // installations
    for (const l of this.lasers) {
      const c = l.captured ? '140,235,255' : '255,80,110';
      glow(l.x, l.y, 300 + l.charge * 240, c, 0.24 + l.charge * 0.3 + (l.beam > 0 ? 0.5 : 0));
      if (l.beam > 0) glow(l.x + Math.cos(l.ang) * 700, l.y + Math.sin(l.ang) * 700, 700, c, 0.35);
    }
    for (const v of this.vans) if (!v.dead && v.driving) glow(v.x + Math.cos(v.ang) * 110, v.y + Math.sin(v.ang) * 110, 340, '255,235,170', 0.3);
    for (const a of this.allies) glow(a.x, a.y, 120, '120,255,200', 0.14);
    for (const h of this.hangars) if (h.open > 0.15) glow(h.x + h.w / 2, h.y + h.h / 2, 340 * h.open, '140,232,255', 0.28 * h.open);
    if (this.plane && !this.flyingPlane) glow(this.plane.x, this.plane.y, 300, '150,240,255', 0.2);
    if (this.vaultOpen) glow(this.vaultSpot.x + 300, this.vaultSpot.y, 620, '140,255,220', 0.3);
    // truck headlights
    for (const t of this.trucks) {
      if (t.dead) continue;
      glow(t.x + Math.cos(t.ang) * 110, t.y + Math.sin(t.ang) * 110, 340, '255,235,170', 0.3);
      glow(t.x, t.y, 220, '255,200,120', 0.15);
    }
    // VTOLs and air transports are dark in flight as well: no engine halo, no hover glow.
    // blinking beacons on watchtowers
    const tBlink = performance.now();
    if (!dark) for (const bp of this.beaconSpots) {
      const on = (tBlink + bp.x) % 1400 < 120;
      glow(bp.x, bp.y, on ? 150 : 50, '255,60,60', on ? 0.55 : 0.1);
    }
    // satcom glow + sweep tip
    if (!dark) for (const s of this.satcoms) {
      if (s.dead) continue;
      glow(s.x, s.y - 40, 220, '170,130,255', 0.25);
      glow(s.x + Math.cos(s.sweep) * 120, s.y - 40 + Math.sin(s.sweep) * 120, 90, '190,150,255', 0.35);
    }
    // fuel barrels ember
    for (const b of this.barrels) {
      if (b.dead) continue;
      if (Math.sin(tBlink / 240 + b.x) > 0.55) glow(b.x, b.y, 90, '255,150,60', 0.1);
    }

    lc.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, 0, 0, this.w, this.h);
    ctx.restore();

    // sweeping searchlights from the fortress and watchtowers
    ctx.save(); ctx.translate(-camX, -camY);
    for (const sp of this.spotlights) {
      if (sp.x < camX - 900 || sp.x > camX + this.w + 900 || sp.y < camY - 900 || sp.y > camY + this.h + 900) continue;
      if (!sp.online) continue;
      const target = { x: sp.x + Math.cos(sp.angle) * sp.range, y: sp.y + Math.sin(sp.angle) * sp.range };
      drawSearchlight(ctx, sp, this.security.active, this.security.jammed > 0, Math.max(12, sp.range * this.lightReach(sp, target)));
    }
    ctx.restore();
  }

  /** Draw after the night overlay so helmet cones remain visible in the blackout. */
  private drawBlackoutLamps(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const sector = this.blackout.active;
    if (!sector && !this.siteDark) return;
    ctx.save();
    for (const e of this.enemies) {
      if (e.def.civilian || e.spawnT > 0 || e.hp <= 0) continue;
      // A yard that lost its own generators keeps working — on lamplight.
      if (!sector && !this.localDark(e.x, e.y)) continue;
      const x = e.x - camX, y = e.y - camY;
      if (x < -380 || y < -380 || x > this.w + 380 || y > this.h + 380) continue;
      const range = e.type === 'sentinel' ? 430 : e.alert ? 350 : 265;
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.ang);
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(0, 0, range, 0);
      beam.addColorStop(0, 'rgba(255,241,190,0.22)');
      beam.addColorStop(0.6, 'rgba(255,241,190,0.065)');
      beam.addColorStop(1, 'rgba(255,241,190,0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(9, 0);
      ctx.lineTo(range, range * 0.22); ctx.lineTo(range, -range * 0.22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(9, 0, 2.8, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawScreenFx(ctx: CanvasRenderingContext2D) {
    if (this.blackout.active && (this.status === 'playing' || this.status === 'paused')) {
      // A genuine night falls: punch a dim oval only around your helmet lamp and brief glows.
      const night = ctx.createRadialGradient(
        this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3,
        this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72,
      );
      night.addColorStop(0, 'rgba(5,8,14,0.16)');
      night.addColorStop(0.55, 'rgba(5,8,14,0.52)');
      night.addColorStop(1, 'rgba(4,6,12,0.88)');
      ctx.fillStyle = night; ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.status === 'playing' && this.hp < 35) {
      const p = 0.18 + Math.sin(performance.now() / 180) * 0.08;
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.25, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.6);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,0,40,${p})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    }
    const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.33, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.76);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, this.w, this.h);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${clamp(this.flash, 0, 1) * 0.45})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /** The take-off chain, drawn as a checklist so no link is invisible. */
  private drawLaunchHud(ctx: CanvasRenderingContext2D) {
    const L = this.launch;
    if (!L) return;
    const steps: { key: 'walk' | 'board' | 'taxi' | 'roll'; label: string }[] = [
      { key: 'walk', label: 'CREW TO AIRFRAME' },
      { key: 'board', label: 'BOARD' },
      { key: 'taxi', label: 'TAXI' },
      { key: 'roll', label: 'TAKE-OFF ROLL' },
    ];
    const order = steps.map((x) => x.key);
    const at = order.indexOf(L.phase);
    ctx.save();
    ctx.translate(this.w / 2, this.h - (this.isTouch ? 210 : 148));
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px ui-monospace, monospace';
    const banner = `${L.serial} · TAKE-OFF CHAIN`;
    ctx.fillStyle = 'rgba(6,12,14,0.62)';
    const width = Math.max(320, banner.length * 8 + 60);
    ctx.fillRect(-width / 2, -26, width, 64);
    ctx.fillStyle = '#9fe8ff';
    ctx.fillText(banner, 0, -8);
    let x = -width / 2 + 22;
    for (let i = 0; i < steps.length; i++) {
      const done = i < at, active = i === at;
      ctx.fillStyle = done ? '#7cf6d4' : active ? '#ffd166' : 'rgba(190,220,230,0.35)';
      ctx.textAlign = 'left';
      ctx.fillText(`${done ? '✓' : active ? '▸' : '·'} ${steps[i].label}`, x, 16);
      x += steps[i].label.length * 8 + 34;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(190,220,230,0.6)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('F · ABORT THE ORDER', 0, 32);
    ctx.restore();
    void ctx.canvas;
  }

  /** After a ditching: the wing is on the ground and the operative is in a boat. */
  private drawRecallHud(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(8,16,20,0.66)';
    const w = 380, h = 52;
    ctx.fillRect(this.w / 2 - w / 2, this.h - (this.isTouch ? 280 : 216), w, h);
    ctx.fillStyle = '#ff9d9d';
    ctx.fillText('AIR OPERATIONS SUSPENDED', this.w / 2, this.h - (this.isTouch ? 262 : 198));
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = '#a9ecff';
    ctx.fillText('ALL AIRCRAFT RECALLED · W/S THROTTLE IN THE BOAT', this.w / 2, this.h - (this.isTouch ? 246 : 182));
    ctx.restore();
  }

  /**
   * The first-time card. The simulation is frozen while this is up (see update()), so it is
   * a genuine pause with instructions, not a banner that scrolls away.
   */
  private drawTutorial(ctx: CanvasRenderingContext2D) {
    const card = this.tutorial;
    if (!card) return;
    ctx.save();
    ctx.fillStyle = 'rgba(4,8,10,0.78)';
    ctx.fillRect(0, 0, this.w, this.h);
    const wide = Math.min(this.w - 80, 760);
    const lineH = 24;
    const h = 132 + card.lines.length * lineH;
    const x = (this.w - wide) / 2, y = (this.h - h) / 2;
    ctx.fillStyle = 'rgba(8,16,20,0.94)';
    ctx.fillRect(x, y, wide, h);
    ctx.strokeStyle = 'rgba(150,235,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, wide - 1, h - 1);
    // corner ticks: the same language as the rest of the HUD
    ctx.strokeStyle = 'rgba(150,235,255,0.95)';
    ctx.lineWidth = 3;
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x + sx * wide, y + sy * h - sy * 22);
      ctx.lineTo(x + sx * wide, y + sy * h);
      ctx.lineTo(x + sx * wide - sx * 22, y + sy * h);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fe8ff';
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText('FIELD MANUAL / NEW EQUIPMENT', x + 32, y + 40);
    ctx.fillStyle = '#eaf8ff';
    ctx.font = 'bold 24px ui-monospace, monospace';
    ctx.fillText(card.title, x + 32, y + 76);
    ctx.font = '14px ui-monospace, monospace';
    card.lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? '#cfe8ff' : '#a9c2cf';
      ctx.fillText(`·  ${line}`, x + 32, y + 112 + i * lineH);
    });
    const pulse = 0.55 + Math.sin(this.simulationTime * 4) * 0.35;
    ctx.fillStyle = `rgba(255,209,102,${pulse})`;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(card.hint, x + wide / 2, y + h - 20);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private drawThreatArrows(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const cx = this.w / 2, cy = this.h / 2, pad = 46;
    if (this.vaultNav) {
      const dx = VAULT_ENTRY.x - this.px, dy = VAULT_ENTRY.y - this.py;
      const a = Math.atan2(dy, dx);
      const x = cx + Math.cos(a) * (this.w / 2 - 70), y = cy + Math.sin(a) * (this.h / 2 - 135);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#92ead4'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-7, -8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.save(); ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#b7ebdb';
      ctx.fillText('VAULT / 980 : 7040', clamp(x, 100, this.w - 100), y + 24);
      ctx.restore();
    }
    // THE CAGE: an optional landmark, so it always keeps a bearing marker on screen.
    {
      const sx = ISLAND.x - camX, sy = ISLAND.y - camY;
      if (sx < 80 || sy < 80 || sx > this.w - 80 || sy > this.h - 80) {
        const ang = Math.atan2(ISLAND.y - this.py, ISLAND.x - this.px);
        const ex = cx + Math.cos(ang) * (this.w / 2 - pad);
        const ey = cy + Math.sin(ang) * (this.h / 2 - pad);
        ctx.save();
        ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(159,216,230,0.8)';
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, 8); ctx.lineTo(-8, -8); ctx.closePath(); ctx.fill();
        ctx.restore();
        const km = (Math.hypot(ISLAND.x - this.px, ISLAND.y - this.py) / 1000).toFixed(1);
        const toGate = Math.hypot(PRISON_DOOR.x - this.px, PRISON_DOOR.y - this.py);
        if (toGate > 260) {
          const txt = toGate < 320 ? 'THE CAGE · SALLY PORT AHEAD — STEP INTO THE GATE' : `THE CAGE · SALLY PORT ${Math.round(toGate / 10)} m · CROSS THE BRIDGE`;
          ctx.font = '700 11px "Chakra Petch", sans-serif';
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = 'rgba(6,18,22,0.72)';
          ctx.fillRect(this.w / 2 - tw / 2 - 10, 44, tw + 20, 22);
          ctx.fillStyle = '#bfe9f3';
          ctx.fillText(txt, this.w / 2, 59);
        }
        ctx.save();
        ctx.textAlign = 'center'; ctx.font = '700 10px "Chakra Petch", sans-serif';
        ctx.fillStyle = 'rgba(190,232,242,0.85)';
        ctx.fillText(`THE CAGE · ${km} km`, cx + Math.cos(ang) * (this.w / 2 - pad - 30), cy + Math.sin(ang) * (this.h / 2 - pad - 30));
        ctx.restore();
      }
    }
    // objective marker: fortress / general
    const target = this.general
      ? (this.servers.some((s) => !s.dead) ? { x: HQ.cx, y: HQ.cy, boss: true } : { x: this.general.x, y: this.general.y, boss: true })
      : null;
    if (target) {
      const sx = target.x - camX, sy = target.y - camY;
      if (sx < 0 || sy < 0 || sx > this.w || sy > this.h) {
        const ang = Math.atan2(target.y - this.py, target.x - this.px);
        const ex = cx + Math.cos(ang) * (this.w / 2 - pad);
        const ey = cy + Math.sin(ang) * (this.h / 2 - pad);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd166'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-10, 10); ctx.lineTo(-10, -10); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#ffd166'; ctx.font = '700 10px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        const lx = cx + Math.cos(ang) * (this.w / 2 - pad - 26);
        const ly = cy + Math.sin(ang) * (this.h / 2 - pad - 26);
        ctx.fillText('HQ', lx, ly);
        ctx.restore();
      }
    }
    for (const e of this.enemies) {
      if (e.def.civilian || e.garrison) continue;
      const sx = e.x - camX, sy = e.y - camY;
      if (sx > -20 && sx < this.w + 20 && sy > -20 && sy < this.h + 20) continue;
      if (Math.hypot(e.x - this.px, e.y - this.py) > 1900) continue;
      const ang = Math.atan2(e.y - this.py, e.x - this.px);
      const ex = cx + Math.cos(ang) * (this.w / 2 - pad);
      const ey = cy + Math.sin(ang) * (this.h / 2 - pad);
      ctx.save();
      ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.globalAlpha = e.def.boss ? 0.95 : 0.55;
      ctx.fillStyle = e.def.boss ? '#ff2d55' : '#ff7a7a';
      const s = e.def.boss ? 13 : 8;
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.7); ctx.lineTo(-s * 0.7, -s * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawBossBar(ctx: CanvasRenderingContext2D) {
    const boss = this.enemies.find((e) => e.def.boss);
    const showGeneral = this.general && Math.hypot(this.general.x - this.px, this.general.y - this.py) < 900;
    const target = boss || (showGeneral ? this.general! : null);
    if (!target) return;
    const isGen = target === this.general;
    const w = Math.min(this.w * 0.72, 560);
    const x = (this.w - w) / 2, y = this.h - 46;
    const p = clamp(target.hp / target.maxHp, 0, 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 12px "Chakra Petch", sans-serif';
    ctx.fillStyle = isGen ? '#ffe08a' : '#ff9db1';
    const shielded = isGen && this.servers.some((s) => !s.dead);
    ctx.fillText(isGen ? (shielded ? '✪ SUPREME GENERAL — SHIELDED BY MAINFRAMES' : '✪ SUPREME GENERAL — EXPOSED') : '⚠ WARLORD', this.w / 2, y - 9);
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(x - 2, y - 2, w + 4, 16);
    ctx.fillStyle = 'rgba(50,30,10,0.9)'; ctx.fillRect(x, y, w, 12);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    if (isGen) { g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#ff9d3d'); }
    else { g.addColorStop(0, '#ff2d55'); g.addColorStop(1, '#ff7a3d'); }
    ctx.fillStyle = g; ctx.fillRect(x, y, w * p, 12);
    if (shielded) {
      ctx.fillStyle = 'rgba(127,240,255,0.28)';
      ctx.fillRect(x, y, w, 12);
    }
    ctx.strokeStyle = 'rgba(255,200,140,0.6)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, 12);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  /**
   * THE COCKPIT.
   *
   * Everything the pilot needs, drawn on the glass: the heat tape for the cannon, the
   * rounds on the rails and in the pods, the lance capacitor, the camera the operative is
   * looking through, and a screaming warning when something is inbound.
   */
  private drawJetOverlay(ctx: CanvasRenderingContext2D) {
    const j = this.playerJet;
    if (!j) return;
    const cx = this.w / 2, cy = this.h / 2;
    const heat = j.heat ?? 0;
    const jam = (j.jam ?? 0) > 0;
    const rwr = (j.rwr ?? 0) > 0;
    const charge = j.charge ?? 0;
    const tierName = j.tier === 'prototype' ? 'PROTOTYPE' : j.tier === 'frostwing' ? 'FROSTWING'
      : j.tier === 'standard' ? 'INTERCEPTOR' : 'INTERCEPTOR';
    const viewName = j.view === 1 ? 'TACTICAL' : j.view === 2 ? 'GUN CAM' : 'CHASE';
    ctx.save();
    ctx.font = 'bold 11px "Share Tech Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    /* heat tape: down the left edge, out of the fight */
    const hx = 26, hy = cy - 5, hw = 150;
    ctx.fillStyle = 'rgba(4,14,18,0.6)';
    ctx.fillRect(hx - 2, hy - 2, hw + 4, 14);
    const hg = ctx.createLinearGradient(hx, 0, hx + hw, 0);
    hg.addColorStop(0, '#5fe3c8'); hg.addColorStop(0.6, '#ffd166'); hg.addColorStop(1, '#ff6a4d');
    ctx.fillStyle = hg;
    ctx.fillRect(hx, hy, hw * heat, 10);
    ctx.strokeStyle = jam ? 'rgba(255,120,90,0.95)' : 'rgba(150,230,240,0.5)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(hx, hy, hw, 10);
    ctx.fillStyle = jam ? '#ff9a8a' : 'rgba(190,240,250,0.85)';
    ctx.font = '9px "Share Tech Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(jam ? 'CANNON JAMMED' : 'CANNON HEAT', hx, hy - 12);
    ctx.fillText(`${Math.round(heat * 100)}%`, hx + 96, hy - 12);

    /* the loadout, under the reticle */
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px "Share Tech Mono", ui-monospace, monospace';
    const ammo = `AAM ${j.missiles ?? 0}   RKT ${j.rocketsPlayer ?? 0}   FLR ${j.flares ?? 0}`
      + ((j.lance ?? 0) > 0 ? `   LANCE ${j.lance}` : '');
    ctx.fillStyle = 'rgba(200,246,255,0.92)';
    ctx.fillText(ammo, cx, cy + 62);
    ctx.fillStyle = 'rgba(150,210,225,0.75)';
    ctx.font = '9px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillText(`${tierName} · ${viewName} VIEW · ${Math.round(j.speed)} M/S · ALT ${Math.round(j.alt)}`, cx, cy + 78);

    /* lance capacitor: a ring that fills while R is held */
    if (charge > 0) {
      ctx.strokeStyle = 'rgba(210,250,255,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + charge * TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(220,252,255,0.85)';
      ctx.font = '9px "Share Tech Mono", ui-monospace, monospace';
      ctx.fillText('CHARGING', cx, cy - 58);
    }

    /* RWR: a missile is going to arrive in about a second */
    if (rwr) {
      const pulse = 0.45 + Math.sin(this.simulationTime * 20) * 0.35;
      ctx.strokeStyle = `rgba(255,90,70,${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(10.5, 10.5, this.w - 21, this.h - 21);
      ctx.fillStyle = `rgba(255,120,100,${0.55 + pulse * 0.4})`;
      ctx.font = 'bold 15px "Share Tech Mono", ui-monospace, monospace';
      ctx.fillText('MISSILE INBOUND · SPACE FOR FLARES', cx, cy - 190);
    }

    /* speed streaks on the canopy at speed */
    const spd = Math.hypot(this.pvx, this.pvy);
    if (spd > 700) {
      const k = Math.min(1, (spd - 700) / 1500);
      ctx.strokeStyle = `rgba(210,240,255,${0.12 + k * 0.18})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU + this.simulationTime * 0.35;
        const r0 = Math.min(this.w, this.h) * (0.42 + ((i * 37) % 23) / 60);
        const len = 40 + k * 120;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
    }

    /* reticle: a fighter pipper, not a crosshair */
    ctx.strokeStyle = 'rgba(200,250,255,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU); ctx.stroke();
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
      ctx.lineTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(210,250,255,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, TAU); ctx.fill();
    ctx.textAlign = 'left';
    ctx.restore();
  }

  private drawMinimap(ctx: CanvasRenderingContext2D) {
    const mw = Math.min(168, this.w * 0.24);
    const mh = mw * (ARENA_H / ARENA_W);
    const x = this.w - mw - 14, y = this.h - mh - 14;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = 'rgba(5,12,12,0.88)'; ctx.fillRect(x, y, mw, mh);
    ctx.strokeStyle = 'rgba(120,230,200,0.45)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, mw, mh);
    const sx = mw / ARENA_W, sy = mh / ARENA_H;
    // THE ROAD NETWORK: on a map this size the roads are the only way to navigate by eye,
    // so they are drawn first and faintly under everything else.
    ctx.strokeStyle = 'rgba(150,200,190,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const z of this.zones) {
      if (z.kind !== 'road' || Math.max(z.w, z.h) < 420) continue;
      const horizontal = z.w >= z.h;
      const cxr = x + (z.x + z.w / 2) * sx, cyr = y + (z.y + z.h / 2) * sy;
      const half = (horizontal ? z.w : z.h) * sx * 0.5;
      if (horizontal) { ctx.moveTo(cxr - half, cyr); ctx.lineTo(cxr + half, cyr); }
      else { ctx.moveTo(cxr, cyr - half); ctx.lineTo(cxr, cyr + half); }
    }
    ctx.stroke();
    // the army district reads as a single block on the map
    if (this.army) {
      ctx.strokeStyle = 'rgba(214,224,170,0.35)';
      ctx.strokeRect(x + this.army.base.x * sx, y + this.army.base.y * sy,
        this.army.base.w * sx, this.army.base.h * sy);
      ctx.fillStyle = 'rgba(214,224,170,0.5)';
      ctx.font = '6px monospace';
      ctx.fillText('ARMY', x + (this.army.base.x + 60) * sx, y + (this.army.base.y + 90) * sy);
    }
    // fortress
    ctx.fillStyle = 'rgba(255,209,102,0.22)';
    ctx.fillRect(x + (HQ.cx - HQ.w / 2) * sx, y + (HQ.cy - HQ.h / 2) * sy, HQ.w * sx, HQ.h * sy);
    ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + (HQ.cx - HQ.w / 2) * sx, y + (HQ.cy - HQ.h / 2) * sy, HQ.w * sx, HQ.h * sy);
    // servers
    for (const s of this.servers) {
      ctx.fillStyle = s.dead ? 'rgba(120,80,70,0.6)' : '#7ff0ff';
      ctx.fillRect(x + s.x * sx - 1.5, y + s.y * sy - 1.5, 3, 3);
    }
    // general
    if (this.general) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x + this.general.x * sx - 2.5, y + this.general.y * sy - 2.5, 5, 5);
    }
    // infrastructure markers
    for (const f of this.facilities) {
      if (!f.discovered) continue;
      if (f.id === 'mnemosyne' && !this.pois.find(p => p.id === 'mnemosyne')?.discovered) continue;
      const color = f.secured ? '#80d9b1' : FACILITY_TYPES[f.kind].color;
      const fx = x + (f.x + f.w / 2) * sx, fy = y + (f.y + f.h / 2) * sy;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.strokeRect(fx - 2.5, fy - 2.5, 5, 5);
      if (f.secured) { ctx.fillStyle = color; ctx.fillRect(fx - 1, fy - 1, 2, 2); }
    }
    // THE CAGE — the prison island, on the map in every sector
    {
      const px2 = x + ISLAND.x * sx, py2 = y + ISLAND.y * sy;
      ctx.strokeStyle = '#9fd8e6'; ctx.lineWidth = 1.4;
      ctx.strokeRect(px2 - 4, py2 - 4, 8, 8);
      ctx.fillStyle = '#9fd8e6'; ctx.fillRect(px2 - 1.5, py2 - 1.5, 3, 3);
      ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText('CAGE', px2, py2 - 8);
      ctx.textAlign = 'left';
    }
    /* THE SPECIAL SITES, marked so they can be found: the glacier gate behind its ice
     * door, and the stockade inside the army district. Both are new features and neither
     * should require walking the whole map to discover. */
    if (this.glacierSpot) {
      const gx2 = x + this.glacierSpot.x * sx, gy2 = y + this.glacierSpot.y * sy;
      ctx.strokeStyle = this.glacierVisits ? 'rgba(150,175,185,0.7)' : '#8be8ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(gx2, gy2 - 5); ctx.lineTo(gx2 + 5, gy2); ctx.lineTo(gx2, gy2 + 5); ctx.lineTo(gx2 - 5, gy2);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(139,232,255,0.85)';
      ctx.fillRect(gx2 - 1, gy2 - 1, 2, 2);
      ctx.font = '6px monospace'; ctx.textAlign = 'center';
      ctx.fillText('ICE', gx2, gy2 - 8);
      ctx.textAlign = 'left';
    }
    if (this.stockadeSpot) {
      const st = this.stockadeSpot;
      ctx.strokeStyle = this.stockadeOpen ? 'rgba(150,170,140,0.55)' : '#e8c168';
      ctx.setLineDash(this.stockadeOpen ? [] : [3, 2]);
      ctx.strokeRect(x + st.x * sx, y + st.y * sy, st.w * sx, st.h * sy);
      ctx.setLineDash([]);
      if (!this.stockadeOpen) {
        ctx.fillStyle = '#e8c168';
        ctx.font = '6px monospace'; ctx.textAlign = 'center';
        ctx.fillText('BRIG', x + (st.x + st.w / 2) * sx, y + st.y * sy - 2);
        ctx.textAlign = 'left';
      }
    }
    for (const hp of this.helipads) {
      ctx.fillStyle = '#57c8b8';
      ctx.fillRect(x + hp.x * sx - 1.5, y + hp.y * sy - 1.5, 3, 3);
    }
    for (const s of this.satcoms) {
      ctx.fillStyle = s.dead ? 'rgba(150,120,200,0.35)' : '#c9a4ff';
      ctx.fillRect(x + s.x * sx - 1.5, y + s.y * sy - 1.5, 3, 3);
    }
    // in-flight VTOLs
    for (const a of this.airTransports) {
      ctx.fillStyle = a.kind === 'atlas' ? '#c7d9e8' : '#d0a07c';
      ctx.fillRect(x + a.x * sx - 2, y + a.y * sy - 2, 4, 4);
    }
    for (const v of this.vtols) {
      ctx.fillStyle = v.state === 'hover' ? '#ffb03d' : '#ffd166';
      const s = v.state === 'hover' ? 3 : 2.5;
      ctx.fillRect(x + v.x * sx - s / 2, y + v.y * sy - s / 2, s, s);
    }
    // convoys, gunships, wounded
    for (const t of this.trucks) {
      if (t.dead) continue;
      ctx.fillStyle = '#ffa94d';
      ctx.fillRect(x + t.x * sx - 2, y + t.y * sy - 2, 4, 4);
    }
    for (const h of this.helis) {
      ctx.fillStyle = h.medevac ? '#8dffb0' : '#ff4d4d';
      ctx.fillRect(x + h.x * sx - 2.5, y + h.y * sy - 2.5, 5, 5);
    }
    if (this.playerHeli) {
      ctx.fillStyle = this.piloting ? '#8be8ff' : '#4b9fb5';
      ctx.fillRect(x + this.playerHeli.x * sx - 2, y + this.playerHeli.y * sy - 2, 4, 4);
    }
    // Points of interest. Secret sites stay off the map until discovered.
    for (const poi of this.pois) {
      if (poi.secret && !poi.discovered) continue;
      const px2 = x + poi.x * sx, py2 = y + poi.y * sy;
      const col = poi.kind === 'airfield' ? '#ffb03d'
        : poi.kind === 'laser' ? '#ff5d6c'
        : poi.kind === 'peggy' || poi.kind === 'library' ? '#d9c27a' : poi.kind === 'depot' ? '#bd926f' : '#8dffd6';
      ctx.strokeStyle = col; ctx.lineWidth = 1.4;
      ctx.globalAlpha = poi.captured ? 1 : 0.75;
      ctx.strokeRect(px2 - 4, py2 - 4, 8, 8);
      if (poi.captured) { ctx.fillStyle = col; ctx.fillRect(px2 - 2, py2 - 2, 4, 4); }
      ctx.globalAlpha = 0.82;
    }
    for (const l of this.lasers) {
      ctx.fillStyle = l.captured ? '#8be8ff' : '#ff5d6c';
      ctx.fillRect(x + l.x * sx - 2, y + l.y * sy - 2, 4, 4);
    }
    if (this.plane) {
      ctx.fillStyle = '#cdf6ff';
      ctx.fillRect(x + this.plane.x * sx - 3, y + this.plane.y * sy - 3, 6, 6);
    }
    for (const a of this.allies) {
      ctx.fillStyle = '#7dffcf';
      ctx.fillRect(x + a.x * sx - 1.5, y + a.y * sy - 1.5, 3, 3);
    }
    for (const b of this.barricades) {
      ctx.fillStyle = '#8dffb0';
      ctx.fillRect(x + b.x * sx - 2, y + b.y * sy - 1.5, 4, 3);
    }
    for (const wd of this.wounded) {
      ctx.fillStyle = 'rgba(255,140,150,0.8)';
      ctx.fillRect(x + wd.x * sx - 1.5, y + wd.y * sy - 1.5, 3, 3);
    }
    // S.H.I.E.L.D. supply drops
    for (const s of this.supply) {
      ctx.fillStyle = '#8dffb0';
      ctx.fillRect(x + s.x * sx - 3, y + s.y * sy - 3, 6, 6);
      ctx.strokeStyle = 'rgba(140,255,200,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + s.x * sx - 4, y + s.y * sy - 4, 8, 8);
    }
    // squads (cluster markers)
    for (const s of this.squads) {
      const col = s.tactic === 'blitz' ? '#ff8a3d' : s.tactic === 'bombers' ? '#ffb03d' : '#ff7a7a';
      ctx.fillStyle = col;
      ctx.fillRect(x + s.cx * sx - 2, y + s.cy * sy - 2, 4, 4);
    }
    // player + view box
    ctx.fillStyle = '#2fd6c4';
    ctx.fillRect(x + this.px * sx - 2, y + this.py * sy - 2, 4, 4);
    ctx.strokeStyle = 'rgba(120,230,200,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + this.camX * sx, y + this.camY * sy, this.w * sx, this.h * sy);
    ctx.restore();
  }

  private drawSticks(ctx: CanvasRenderingContext2D) {
    const draw = (s: Stick, color: string) => {
      if (!s.active) return;
      const dx = s.x - s.ox, dy = s.y - s.oy;
      const d = Math.hypot(dx, dy);
      const k = d > 60 ? 60 / d : 1;
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.ox, s.oy, 60, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.72; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(s.ox + dx * k, s.oy + dy * k, 26, 0, TAU); ctx.fill();
      ctx.restore();
    };
    draw(this.moveStick, '#2fd6c4');
    draw(this.aimStick, '#ff8b5c');
  }

  private drawDecals(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const d of this.decals) {
      if (d.x < camX - 80 || d.x > camX + this.w + 80 || d.y < camY - 80 || d.y > camY + this.h + 80) continue;
      ctx.globalAlpha = d.a;
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/* helpers */
function prevent(e: Event) { e.preventDefault(); }
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
