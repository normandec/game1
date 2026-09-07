import { sfx } from './audio';
import { AIRFIELD, VAULT_ENTRY, ARENA_W, ARENA_H, HQ, PLAYER_START, SECTORS, SpatialGrid, generateWorld, type Rect, type Zone } from './world';
import { RoutePlanner, segmentBox, segmentCircle, type Point, type Block } from './navigation';
import { makeGates, makeDetails, gateBlocks, drawGate, drawDetails, type HydraulicGate, type RoomDetail } from './installations';
import { drawTransport, drawParkedAircraft } from './vehicleArt';
import { FACILITY_TYPES, type FacilityGuard, type FacilityState, type PostRole } from './facilities';
import { FacilityPainter } from './facilityArt';
import { PROLOGUE, PHASE_STORY, PHASE_TACTICS, LIBRARY_VOLUMES, type StoryEntry } from './campaign';
import { newSecurityState, updateSearchlights, drawSearchlight, type Searchlight } from './security';
import { prepareStructures, structuralHealth, distanceToBlock, drawRuins, type Ruin } from './destruction';
import { drawFixedWing, drawMantis, drawAirborne, type AirTransport, type AirborneTrooper } from './airlift';
import { GOLIATH, MNEMOSYNE, type CampaignSites, type MegaCrate } from './campaignSites';
import { siteLoad, type PowerSite } from './powerGrid';

export { ARENA_W, ARENA_H };

/* ================================================================== */
/* Types                                                              */
/* ================================================================== */

export type GameStatus = 'menu' | 'playing' | 'paused' | 'over' | 'upgrade' | 'transit' | 'victory' | 'interior';

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
  sector: number; basesCleared: number; sectorName: string; destination: string; transitPct: number;
  driving: boolean; flyingPlane: boolean; allies: number; barricades: number;
  siegeActive: boolean; lasersHeld: number; poisCaptured: number; poisTotal: number;
  vaultFound: boolean; nearPrompt: string;
  coords: string; gatePrompt: string; aegisCharges: number; aegisTime: number;
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
  turret:    { hp: 260, speed: 0, r: 19, dmg: 0, score: 650, color: '#ff3858', dark: '#4f101c', ranged: true, range: 620, fireRate: 0.72, bulletSpeed: 720, bulletDmg: 11, pellets: 1, spread: 0.018 },
  boss:      { hp: 1500, speed: 72, r: 44, dmg: 28, score: 3000, color: '#ff2d55', dark: '#450a18', ranged: true, range: 520, fireRate: 1.05, bulletSpeed: 460, bulletDmg: 12, pellets: 10, spread: 6.28, boss: true },
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
interface Bullet { x: number; y: number; px: number; py: number; vx: number; vy: number; dmg: number; life: number; friendly: boolean; rocket?: boolean; color: string; r: number; pierce?: number; hits?: Enemy[]; explosive?: number; }
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
  mission?: string; orderedTarget?: Point; launchDelay?: number; parking?: Van;
}
interface Mine { x: number; y: number; t: number; armed: boolean; }
/** Attack gunship — strafes, hovers, rockets the player. */
interface Heli {
  x: number; y: number; tx: number; ty: number; ang: number; rotor: number;
  state: 'startup' | 'taxi-out' | 'takeoff' | 'ingress' | 'strafe' | 'orbit' | 'egress' | 'landing' | 'taxi-in' | 'service';
  hp: number; maxHp: number; cool: number; rocketCd: number; t: number;
  orbitA: number; medevac: boolean; carrying: number; announced: boolean;
  bank: number;
  home?: number; altitude?: number; serviceT?: number; sortieT?: number;
}
interface VTOL {
  x: number; y: number; tx: number; ty: number;
  state: 'in' | 'hover' | 'out'; squadId: number;
  rotor: number; hoverT: number; ang: number; announced: boolean;
  bank: number;
}
interface SupplyDrop { x: number; y: number; t: number; }
/** Hangar shell: sealed roof outside, splits open once the operative is within. */
interface HangarState { x: number; y: number; w: number; h: number; doorX: number; doorY: number; open: number; ruined?: boolean; }
/** Parked / drivable Hydra transport van. */
interface Van {
  x: number; y: number; ang: number; speed: number; lean: number;
  hp: number; maxHp: number; dead: boolean; driving: boolean; boost: number;
  gunCd?: number; turretAng?: number; reserved?: boolean; blockT?: number;
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
  gates: { x: number; y: number; built: boolean; hp: number }[];
}
interface Barricade { x: number; y: number; hp: number; maxHp: number; ang: number; }
/** Captured S.H.I.E.L.D. gunship the player can fly out of the Hydra hangar. */
interface PlayerHeli {
  x: number; y: number; vx: number; vy: number; ang: number; rotor: number; bank: number;
  hp: number; maxHp: number; fuel: number; fireCd: number; rocketCd: number; landed: boolean;
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
interface Pickup { kind: 'health' | 'grenade' | 'weapon' | 'shield' | 'aegis'; weapon?: string; x: number; y: number; t: number; life: number; }
interface FloatText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number; }
interface Grenade { x: number; y: number; vx: number; vy: number; t: number; z: number; vz: number; dmg: number; big?: boolean; bomb?: boolean; }
interface EGrenade { x: number; y: number; tx: number; ty: number; t: number; total: number; z: number; }
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
  moveStick: Stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };
  aimStick: Stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };

  constructor(canvas: HTMLCanvasElement, cb: {
    onHud: (h: Hud) => void; onOver: (s: number, w: number) => void;
    onPauseToggle: () => void; onUpgrade: (c: Perk[]) => void;
    onVictory: (s: number, w: number) => void; onTransit: (sector: number) => void;
    onVault: (open: boolean) => void;
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onHud = cb.onHud; this.onOver = cb.onOver;
    this.onPauseToggle = cb.onPauseToggle; this.onUpgrade = cb.onUpgrade;
    this.onVictory = cb.onVictory;
    this.onTransit = cb.onTransit;
    this.onVault = cb.onVault;
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

  reset(newCampaign = true) {
    this.clearInput();
    this.dynamicRects = [];
    this.dynBuckets.clear();
    if (newCampaign) this.sector = 1;
    this.makeGroundPattern();
    const world = generateWorld(this.sector);
    this.obstacles = prepareStructures(world.rects);
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
      for (const d of [46, 92, 140]) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
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

    this.px = PLAYER_START.x; this.py = PLAYER_START.y; this.pvx = 0; this.pvy = 0;
    this.pang = -Math.PI / 2;
    this.hp = this.maxHp = 100;
    this.shieldHp = 0; this.shieldMax = 0;
    this.weapon = 'rifle'; this.ammo = Infinity; this.weaponAmmo.clear();
    this.fireCd = 0; this.dashCd = 0; this.dashT = 0; this.iFrames = 0;
    this.grenades = 4; this.recoil = 0;
    this.score = 0; this.wave = 0; this.streak = 0; this.streakT = 0; this.mult = 1; this.bestMult = 1;
    this.enemies = []; this.bullets = []; this.parts = []; this.pickups = [];
    this.texts = []; this.nades = []; this.enemyNades = []; this.shocks = [];
    this.decals = []; this.marks = []; this.lights = [];
    this.squads = []; this.spawnQueue = []; this.nextSquadId = 1;
    this.trucks = []; this.mines = []; this.helis = []; this.barriers = []; this.wounded = [];
    this.supply = []; this.supplyCd = 26;
    this.piloting = false;
    this.support = 'aegis'; this.supportCd = 0; this.droneAng = 0;
    this.hangars = world.hangars.map((h) => ({ ...h, open: 0 }));
    this.vans = world.vanSpots.map((v) => ({
      x: v.x, y: v.y, ang: v.ang, speed: 0, lean: 0,
      hp: 240, maxHp: 240, dead: false, driving: false, boost: 0,
    }));
    this.lasers = world.laserSpots.map((l) => ({
      x: l.x, y: l.y, ang: 0, hp: 420 + this.sector * 60, maxHp: 420 + this.sector * 60,
      charge: 0, cool: rand(2, 5), beam: 0, captured: false, targetX: l.x, targetY: l.y,
    }));
    this.parkedHelis = world.parkedHelis.map((p) => ({ ...p, taken: false }));
    this.pois = world.pois.map((p) => ({
      ...p, discovered: !p.secret, cleared: false, captured: false, looted: false,
      gates: p.gates.map((g) => ({ x: g.x, y: g.y, built: false, hp: 600 })),
    }));
    this.vaultSpot = world.vaultSpot;
    this.planeSpot = world.planeSpot;
    this.allies = []; this.barricades = [];
    this.plane = null; this.drivingVan = null; this.flyingPlane = false;
    this.vaultOpen = false; this.vaultChoice = 'none';
    this.siege = { active: false, t: 0, poi: '', waves: 0 };
    this.prompt = '';
    this.megaCrates = world.campaignSites?.megaCrates.map(mc => ({ ...mc, dead: false, hp: mc.maxHp })) || [];
    this.baseOverride = { active: false, poiId: '', progress: 0, timer: 0 };
    // Parade garrison standing at attention on the airfield apron.
    this.paradeSpots = world.paradeSpots;
    this.playerHeli = {
      x: this.hangarSpot.x, y: this.hangarSpot.y + 108, vx: 0, vy: 0, ang: Math.PI / 2,
      rotor: 0, bank: 0, hp: 900, maxHp: 900, fuel: 100, fireCd: 0, rocketCd: 0, landed: true,
    };
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
    this.objective = `SECTOR ${this.sector}/5 · ASSAULT ${SECTORS[this.sector - 1].name}`;
    this.buildPierceRects();
    this.populateHQ();
    this.rebuildNavigation();
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

  startRun(cls = 'assault', support = 'aegis') {
    this.reset();
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
    this.setBanner('OPERATION IRON VEIL', 'ENEMY COMMAND IS ALREADY HUNTING YOU');
    this.tellStory(PROLOGUE, 14);
    sfx.resume();
  }

  /* ---------------- input ---------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (this.status === 'interior') return;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (this.keys[k]) return;
    this.keys[k] = true;
    if (k === 'escape' || k === 'p') this.onPauseToggle();
    if (this.status !== 'playing') return;
    if (k === ' ' || k === 'shift') { if (!this.piloting && !this.flyingPlane && !this.drivingVan) this.doDash(); }
    if (k === 'g' || k === 'q' || k === 'e') {
      if (this.flyingPlane) this.dropBombs();
      else if (this.piloting && this.playerHeli) this.fireHeliRocket(this.playerHeli);
      else if (!this.drivingVan) this.throwGrenade();
    }
    if (k === 'f') this.interactHeli();
    if (k === 'l') this.toggleGate();
    if (k === 'c') this.activateAegis();
    if (k === 'v') this.toggleVaultRoute();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private onPointerDown = (e: PointerEvent) => {
    if (this.status !== 'playing') return;
    this.canvas.setPointerCapture(e.pointerId);
    sfx.resume();
    const p = this.local(e);
    if (e.pointerType === 'touch') {
      this.isTouch = true;
      const s = p.x < this.w * 0.5 ? this.moveStick : this.aimStick;
      if (!s.active) { s.id = e.pointerId; s.ox = p.x; s.oy = p.y; s.x = p.x; s.y = p.y; s.active = true; }
    } else {
      this.isTouch = false;
      this.mouseX = p.x; this.mouseY = p.y;
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this.throwGrenade();
    }
  };
  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e);
    if (e.pointerType === 'touch') {
      for (const s of [this.moveStick, this.aimStick]) if (s.active && s.id === e.pointerId) { s.x = p.x; s.y = p.y; }
    } else { this.mouseX = p.x; this.mouseY = p.y; }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      for (const s of [this.moveStick, this.aimStick]) if (s.active && s.id === e.pointerId) { s.active = false; s.id = -1; }
    } else if (e.button === 0) this.firing = false;
  };

  /* ---------------- actions ---------------- */

  doDash() {
    if (this.status !== 'playing' || this.piloting || this.flyingPlane || this.drivingVan) return;
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
    if (this.drivingVan) return;
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
      if (this.hitstop > 0) { this.hitstop -= dt; this.update(dt * 0.12); }
      else this.update(dt * this.timeScale);
      this.timeScale = lerp(this.timeScale, 1, dt * 2);
    } else if (this.status === 'transit') this.updateTransit(dt);
    else if (this.status === 'menu') this.idleUpdate(dt);
    else if (this.status === 'over' || this.status === 'victory') {
      const s = dt * 0.45;
      this.updateParticles(s); this.updateFx(s); this.updateCamera(s);
    }
    if (this.status !== 'interior' && this.status !== 'menu') this.render();
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.06; this.pushHud(); }
  };

  private updateTransit(dt: number) {
    this.transitT -= dt;
    if (this.playerHeli) this.playerHeli.rotor += dt * 36;
    if (this.transitT <= 0) this.enterNextSector();
  }

  /** Context prompt shown on the HUD for whatever the operative can interact with. */
  private nearPrompt(): string {
    if (this.flyingPlane) return 'F · LAND BOMBER';
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
    const l = this.lasers.find((q) => !q.captured && Math.hypot(q.x - this.px, q.y - this.py) < 120);
    if (l) return 'F · CAPTURE BEAM';
    for (const poi of this.pois) {
      for (const g of poi.gates) {
        if (!g.built && Math.hypot(g.x - this.px, g.y - this.py) < 150) return 'F · BARRICADE GATE';
      }
    }
    const p = this.parkedHelis.find((q, index) => !q.taken && !this.helis.some(h => h.home === index) && Math.hypot(q.x - this.px, q.y - this.py) < 120);
    if (p) return 'F · SEIZE GUNSHIP';
    const v = this.vans.find((q) => !q.dead && !q.reserved && Math.hypot(q.x - this.px, q.y - this.py) < 110);
    if (v) return 'F · DRIVE TRANSPORT';
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
      hangarDist: this.playerHeli ? Math.hypot(this.playerHeli.x - this.px, this.playerHeli.y - this.py) : 0,
      sector: this.sector,
      basesCleared: Math.max(0, this.sector - 1),
      sectorName: SECTORS[this.sector - 1]?.name || 'UNKNOWN SECTOR',
      destination: this.destination,
      transitPct: this.status === 'transit' ? clamp(1 - this.transitT / this.transitDuration, 0, 1) : 0,
      driving: !!this.drivingVan,
      flyingPlane: this.flyingPlane,
      allies: this.allies.length,
      barricades: this.barricades.length,
      siegeActive: this.siege.active,
      lasersHeld: this.lasers.filter((l) => l.captured).length,
      poisCaptured: this.pois.filter((p) => p.captured).length,
      poisTotal: this.pois.filter((p) => !p.secret).length,
      vaultFound: this.vaultOpen,
      nearPrompt: this.nearPrompt(),
      coords: `X ${Math.round(this.px)}  Y ${Math.round(this.py)}`,
      gatePrompt: this.gates.some(g => g.hp > 0 && Math.hypot(g.x - this.px, g.y - this.py) < 165) ? 'L / LOCK OR UNLOCK GATE' : '',
      aegisCharges: this.aegisCharges, aegisTime: this.aegisTime,
      vehicleHp: this.flyingPlane ? this.plane?.hp || 0 : this.drivingVan ? this.drivingVan.hp : this.piloting ? this.playerHeli?.hp || 0 : 0,
      vehicleMax: this.flyingPlane ? this.plane?.maxHp || 1 : this.drivingVan ? this.drivingVan.maxHp : this.piloting ? this.playerHeli?.maxHp || 1 : 1,
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

  private update(dt: number) {
    this.pathBudget = 1;
    this.infantryBudget = 1;
    this.rebuildEnemyBuckets();
    this.simulationTime += dt;
    this.storyTime = Math.max(0, this.storyTime - dt);
    this.archiveReadCooldown = Math.max(0, this.archiveReadCooldown - dt);
    this.aegisTime = Math.max(0, this.aegisTime - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.updateGates(dt);
    if (this.navigationDirty) this.rebuildNavigation();
    this.updatePlayer(dt);
    if (this.status !== 'playing') return;
    this.updateSecurity(dt);
    this.updateResponseOrders(dt);
    this.updatePatrolTeams(dt);
    this.updateBlackout(dt);
    this.updateProfile(dt);
    this.updateCommand(dt);
    this.updateWaves(dt);
    if (this.status !== 'playing') return;
    this.updateSquads(dt);
    this.updateEnemies(dt);
    if (this.status !== 'playing') return;
    this.updateSupport(dt);
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
    const parking = this.vans.filter(v => !v.dead && !v.reserved && !v.driving)
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

  private updateResponseOrders(dt: number) {
    this.responseTimer -= dt;
    if (this.responseTimer > 0 || !this.responseOrders.length || this.trucks.filter(t => !t.dead && t.state !== 'leave').length >= 22) return;
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
    for (const p of this.patrolTeams) {
      if (Math.hypot(p.x - this.px, p.y - this.py) > 2000) continue;
      const members = this.enemies.filter(e => e.patrolTeam === p.id);
      if (!members.length) continue;
      if (members.some(e => e.alert)) { for (const e of members) e.alert = true; continue; }
      p.wait = Math.max(0, p.wait - dt);
      if (p.wait > 0) continue;
      const goal = p.points[p.node], dx = goal.x - p.x, dy = goal.y - p.y, d = Math.hypot(dx, dy) || 1;
      p.angle = lerpAngle(p.angle, Math.atan2(dy, dx), 1 - Math.exp(-2.5 * dt));
      // Road and apron columns march faster than foot patrols inside a compound.
      const march = p.speed ?? (p.kind === 'road' ? 74 : p.kind === 'apron' ? 62 : 58);
      const step = Math.min(d, march * dt); p.x += dx / d * step; p.y += dy / d * step;
      if (d < 6) { p.node = (p.node + 1) % p.points.length; p.wait = p.kind === 'road' ? 1.5 : 5; }
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
    for (const z of this.zones) {
      if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
      switch (z.kind) {
        case 'road': return 1.14;
        case 'plaza': return 1.08;
        case 'concrete': return 1.06;
        case 'helipad': return 1.1;
        case 'fuel': return 0.96;
        case 'sand': return 0.88;
        case 'grass': return 1.0;
        default: return 1;
      }
    }
    return 1;
  }

  private updatePlayer(dt: number) {
    this.updateVault(dt);
    if (this.status !== 'playing') return;
    if (this.flyingPlane) { this.updatePlane(dt); return; }
    if (this.drivingVan) { this.updateDrivenVan(dt); return; }
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
    this.px = clamp(this.px + this.pvx * dt, 80, ARENA_W - 80);
    this.py = clamp(this.py + this.pvy * dt, 80, ARENA_H - 80);
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

  /** Master interact: aircraft, vans, beam batteries, barricades, the black vault. */
  interactHeli() {
    if (this.status !== 'playing') return;
    // exit whatever we are piloting first
    if (this.flyingPlane && this.plane) { this.exitPlane(); return; }
    if (this.drivingVan) { this.exitVan(); return; }
    if (this.piloting) { this.boardGunship(); return; }
    const mc = this.megaCrates.find((c) => !c.dead && Math.hypot(this.px - c.x, this.py - c.y) < 100);
    if (mc) {
      this.breakMegaCrate(mc);
      return;
    }
    const poiCore = this.pois.find((p) => !p.secret && !p.captured && Math.hypot(this.px - p.x, this.py - p.y) < 170);
    if (poiCore && !this.baseOverride.active) {
      const defenders = this.enemies.filter(e => !e.def.civilian && e.hp > 0 && Math.hypot(e.x - poiCore.x, e.y - poiCore.y) < Math.max(420, poiCore.r * 0.8)).length;
      if (defenders > 0) this.addText(this.px, this.py - 48, `UPLINK LOCKED / ${defenders} DEFENDERS REMAIN`, '#ff9d9d', 13);
      else this.startBaseOverride(poiCore);
      return;
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
      if (!this.playerHeli) this.playerHeli = { x: parked.x, y: parked.y, vx: 0, vy: 0, ang: parked.ang, bank: 0, rotor: 0, hp: 900, maxHp: 900, fuel: 100, landed: true, fireCd: 0, rocketCd: 0 };
      this.playerHeli.x = parked.x; this.playerHeli.y = parked.y;
      this.playerHeli.hp = this.playerHeli.maxHp; this.playerHeli.fuel = 100;
      this.score += 2500;
      this.addText(parked.x, parked.y - 80, 'AIRCRAFT SEIZED +2500', '#8be8ff', 18);
      this.boardGunship();
      return;
    }
    // 6) drive a van
    const van = this.vans.find((v) => !v.dead && !v.reserved && Math.hypot(v.x - this.px, v.y - this.py) < 110);
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

  /** Reveal the vault when the operative stumbles onto the buried hatch. */
  private updateVault(dt: number) {
    void dt;
    if (this.piloting || this.flyingPlane || this.drivingVan) return;
    if (Math.hypot(this.px - VAULT_ENTRY.x, this.py - VAULT_ENTRY.y) < 48) this.enterVault();
  }

  private enterVault() {
    if (this.status !== 'playing') return;
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
    if (action === 'heli') this.playerHeli = { x: VAULT_ENTRY.x + 160, y: VAULT_ENTRY.y - 170, vx: 0, vy: 0, ang: -Math.PI / 2, hp: 900, maxHp: 900, rotor: 0, bank: 0, fuel: 100, fireCd: 0, rocketCd: 0, landed: true };
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
    this.setBanner('TRANSPORT COMMANDEERED', 'W/S THROTTLE · A/D STEER · SHIFT RAM · F EXIT');
    sfx.rotor();
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
    this.setBanner('S.H.I.E.L.D. STRATEGIC BOMBER', 'WASD FLY · LMB NOSE CANNONS · G BOMB CARPET · F LAND');
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
    this.setBanner('CAPTURED GUNSHIP', 'WASD FLY · LMB TWIN CANNONS · G ROCKET POD · F LAND');
    sfx.rotor();
  }

  /** Ground vehicle handling: throttle, steering, weight and ramming. */
  private updateDrivenVan(dt: number) {
    const v = this.drivingVan;
    if (!v || v.dead) { this.drivingVan = null; return; }
    const k = this.keys;
    const joystick = this.moveVector();
    const fwd = this.isTouch ? -joystick.y : (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const steer = this.isTouch ? joystick.x : (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    v.boost = k['shift'] ? Math.min(1, v.boost + dt * 2) : Math.max(0, v.boost - dt * 1.5);
    const top = 430 + v.boost * 200;
    const target = fwd > 0 ? top : fwd < 0 ? -150 : 0;
    v.speed = lerp(v.speed, target, 1 - Math.pow(fwd !== 0 ? 0.22 : 0.05, dt));
    // steering authority scales with speed, like a real heavy transport
    const grip = clamp(Math.abs(v.speed) / 260, 0, 1);
    v.ang += steer * 1.5 * grip * dt * Math.sign(v.speed || 1);
    v.lean = lerp(v.lean, steer * grip * 0.4, 1 - Math.pow(0.01, dt));

    const probe = { x: v.x + Math.cos(v.ang) * v.speed * dt, y: v.y + Math.sin(v.ang) * v.speed * dt };
    let hit = this.collide(probe, 48);
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
    if (Math.abs(v.speed) > 60 && Math.random() < 0.7)
      this.addParticle(v.x - Math.cos(v.ang) * 84, v.y - Math.sin(v.ang) * 84,
        rand(-20, 20) - Math.cos(v.ang) * 26, rand(-20, 20) - Math.sin(v.ang) * 26,
        rand(0.3, 0.6), rand(2, 5), v.boost > 0.4 ? '#ffb26a' : '#8b968a', true);
    if (v.boost > 0.3) this.addLight(v.x, v.y, 260, '255,180,110', 0.2);
  }

  /** The vault bomber: heavy, slow to turn, devastating carpet bombs. */
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
    sfx.shoot('rocket');
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
        this.objective = `SECTOR ${this.sector}/5 · ASSAULT THE MAIN FORTRESS`;
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
    if (!this.baseOverride.active) return;
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
        this.setBanner('BASE SECURED / OVERRIDE COMPLETE', `${poi.name} S.H.I.E.L.D. OUTPOST ACTIVE`);
        this.objective = `SECTOR ${this.sector}/5 · ASSAULT THE MAIN FORTRESS`;
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
    if (!state?.path.length) return e;
    while (state.node < state.path.length - 1 && Math.hypot(state.path[state.node].x - e.x, state.path[state.node].y - e.y) < 23) state.node++;
    return state.path[state.node];
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
    if (firing && h.fireCd <= 0) {
      h.fireCd = 0.08;
      for (const side of [-1, 1]) {
        const a = h.ang + rand(-0.025, 0.025);
        const ox = Math.cos(h.ang + Math.PI / 2) * side * 22;
        const oy = Math.sin(h.ang + Math.PI / 2) * side * 22;
        this.bullets.push({ x: h.x + ox, y: h.y + oy, px: h.x, py: h.y, vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500, dmg: 19, life: 0.9, friendly: true, color: '#b8f4ff', r: 3, hits: [] });
        this.addParticle(h.x + ox + Math.cos(a) * 22, h.y + oy + Math.sin(a) * 22, Math.cos(a) * rand(180, 360), Math.sin(a) * rand(180, 360), 0.12, 3, '#fff2c4', true);
      }
      this.addLight(h.x, h.y, 170, '180,240,255', 0.1);
      sfx.shoot('smg');
    }
    this.px = h.x; this.py = h.y; this.pvx = h.vx; this.pvy = h.vy; this.pang = h.ang;
    if (Math.random() < 0.55) this.addParticle(h.x - Math.cos(h.ang) * 60, h.y - Math.sin(h.ang) * 60, rand(-18, 18), rand(15, 48), 0.35, rand(2, 4), '#8ba0a8', true);
    if (h.fuel <= 0 && Math.hypot(h.vx, h.vy) < 50) this.addText(h.x, h.y - 76, 'FUEL LOW — LAND', '#ffb060', 13);
  }

  private fireHeliRocket(h: PlayerHeli) {
    if (h.rocketCd > 0) return;
    h.rocketCd = 1.1;
    for (const side of [-1, 1]) {
      const a = h.ang + side * 0.035;
      this.bullets.push({ x: h.x + Math.cos(h.ang + Math.PI / 2) * side * 30, y: h.y + Math.sin(h.ang + Math.PI / 2) * side * 30, px: h.x, py: h.y, vx: Math.cos(a) * 850, vy: Math.sin(a) * 850, dmg: 88, life: 1.8, friendly: true, rocket: true, color: '#9fe4ff', r: 6, hits: [] });
    }
    this.addLight(h.x, h.y, 300, '255,190,110', 0.15);
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

  private shoot() {
    const W = WEAPONS[this.weapon], M = this.mods;
    this.fireCd = W.rate * M.fireRateMul;
    const muzzle = 26 + W.len;
    const bx = this.px + Math.cos(this.pang) * muzzle;
    const by = this.py + Math.sin(this.pang) * muzzle;
    const dmg = W.dmg * M.damageMul, spread = W.spread * M.spreadMul;

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
        this.weapon = 'rifle'; this.ammo = Infinity;
        this.addText(this.px, this.py - 34, 'RELOAD → RIFLE', '#9fb3c8', 15);
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
        this.weapon = 'rifle'; this.ammo = Infinity;
        this.addText(this.px, this.py - 34, 'RELOAD → RIFLE', '#9fb3c8', 15);
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
    let blocked = !this.routes.line(t, next);
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
    const haul = t.rescue ? ['health', 'health', 'aegis', 'shield'] : ['rocket', 'hmg', 'shotgun', 'smg', 'grenade', 'shield'];
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
      if (h.home === undefined) {
        const slot = this.parkedHelis.findIndex((p, index) => !p.taken && ![...this.hangarClaims.values()].includes(index));
        h.home = slot;
        if (slot >= 0) {
          this.hangarClaims.set(h, slot); h.x = this.parkedHelis[slot].x; h.y = this.parkedHelis[slot].y;
          h.state = 'startup'; h.t = 0; h.rotor = 0; h.altitude = 0; h.sortieT = 0;
        } else {
          // No free bay: hold over the airfield instead of vanishing mid-sortie.
          const pad = this.helipads.find(pd => Math.hypot(pd.x - h.x, pd.y - h.y) > 400) || this.helipads[0];
          if (pad) { h.tx = pad.x; h.ty = pad.y; }
          h.altitude = 65;
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
          'health', 'shield', 'grenade', ['weapon', 'shotgun'], ['weapon', 'dmr'], ['weapon', 'smg'],
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
        && this.spawnQueue.length === 0 && fieldEnemies === 0 && !this.trucks.some(t => !t.dead && t.state !== 'leave')
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
    } else if (this.sector >= 5) {
      c.push(w % 2 ? 'drone' : 'specter');
      if (w % 2 === 0) c.push('juggernaut');
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

  private spawnEnemy(type: string, squadId: number, slot: number, dropX?: number, dropY?: number) {
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
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      const def = e.def;
      const dx = this.px - e.x, dy = this.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (e.garrison && dist > 1650 && !e.alert) continue;
      if (e.facilityId && dist > 2300) {
        e.alert = false; e.vx = 0; e.vy = 0;
        continue;
      }

      // far-away units get cheap ticks (huge map performance guard)
      const far = dist > 2600;
      if (far && !e.garrison) {
        e.x += e.vx * dt; e.y += e.vy * dt;
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
        else if (dist < 700 && dHome < 900) { gx = ppx; gy = ppy; }
        else { gx = e.homeX; gy = e.homeY; }
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

      e.x = clamp(e.x + e.vx * dt, def.r, ARENA_W - def.r);
      e.y = clamp(e.y + e.vy * dt, def.r, ARENA_H - def.r);
      const n = this.collide(e, def.r);
      if (n) {
        const tX = -n.ny, tY = n.nx;
        const dot = e.vx * tX + e.vy * tY;
        e.vx = tX * dot + n.nx * 20; e.vy = tY * dot + n.ny * 20;
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
    e.x += e.vx * dt; e.y += e.vy * dt;
    this.collide(e, e.def.r);
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
      if (!dead) {
        const start = { x: b.px, y: b.py }, end = { x: b.x, y: b.y };
        const candidates = this.bulletSet;
        this.grid.query(Math.min(b.px, b.x) - 3, Math.min(b.py, b.y) - 3, Math.abs(b.x - b.px) + 6, Math.abs(b.y - b.py) + 6, candidates);
        let first = 2, block: Rect | null = null, gate: HydraulicGate | null = null;
        for (const index of candidates) {
          const r = this.obstacles[index];
          if (r.dead) continue;
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
        if (sitesRef) for (const cell of sitesRef.powerCells) {
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
        for (const a of this.airTransports) {
          if (a.x < bx0 || a.x > bx1 || a.y < by0 - 200 || a.y > by1) continue;
          const center = { x: a.x, y: a.y - a.altitude * 0.55 };
          if (!segmentCircle({ x: b.px, y: b.py }, b, center, a.kind === 'atlas' ? 90 : 73)) continue;
          dead = true; a.hp -= b.dmg; this.sparks(b.x, b.y, '#e4c49a', 8);
          if (a.hp <= 0) this.destroyAirlift(a);
          break;
        }
        if (!dead) for (let j = this.airTroops.length - 1; j >= 0; j--) {
          const p = this.airTroops[j];
          if (p.x < bx0 || p.x > bx1 || p.y < by0 - 200 || p.y > by1) continue;
          const center = { x: p.x, y: p.y - p.altitude * (1 - p.progress / p.duration) };
          if (!segmentCircle({ x: b.px, y: b.py }, b, center, 13)) continue;
          dead = true; p.hp -= b.dmg;
          if (p.hp <= 0) { this.airTroops.splice(j, 1); this.score += 100; this.sparks(center.x, center.y, '#c5ad8d', 9); }
          break;
        }
        // gunships
        if (!dead) for (const h of this.helis) {
          if (h.x < bx0 || h.x > bx1 || h.y < by0 || h.y > by1) continue;
          if (segmentCircle({ x: b.px, y: b.py }, b, h, 44 + b.r)) {
            dead = true;
            h.hp -= b.dmg;
            this.sparks(b.x, b.y, '#ffd166', 8);
            if (h.hp <= 0) this.killHeli(h);
            break;
          }
        }
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
        const hitRadius = this.flyingPlane ? 115 : this.piloting ? 49 : this.drivingVan ? 52 : 16;
        if (!dead && segmentCircle({ x: b.px, y: b.py }, b, { x: this.px, y: this.py }, hitRadius)) {
          dead = true; this.damagePlayer(b.dmg, b.x - b.vx * 0.12, b.y - b.vy * 0.12); this.sparks(b.x, b.y, '#ff8f8f', 8);
        }
      }
      if (dead) {
        if (b.rocket) this.explode(b.x, b.y, 150, Math.max(70, b.dmg), true);
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
      else {
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
    this.objective = `HYDRA BASE ${this.sector}/5 DESTROYED`;
    this.setBanner('DECAPITATION STRIKE', `HYDRA COMMAND ${this.sector}/5 ELIMINATED`);
    sfx.explode();
    for (let i = 0; i < 160; i++) {
      const a = rand(0, TAU), v = rand(60, 780);
      this.addParticle(e.x, e.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.5, 1.6), rand(2, 10), i % 3 ? '#ffe08a' : '#ffffff', true);
    }
    this.addLight(e.x, e.y, 900, '255,220,140', 1.2);
    this.explode(e.x, e.y, 420, 90, false);
    if (this.sector >= SECTORS.length) {
      this.status = 'victory';
      this.timeScale = 0.2;
      sfx.gameover();
      this.pushHud();
      this.onVictory(Math.floor(this.score), this.wave);
      return;
    }

    // Force the operative into the captured aircraft for the cinematic transfer.
    this.destination = SECTORS[this.sector]?.name || 'NEXT HYDRA SECTOR';
    this.transitT = this.transitDuration;
    this.status = 'transit';
    this.piloting = true;
    this.firing = false;
    this.playerHeli = {
      x: e.x, y: e.y, vx: 0, vy: -700, ang: -Math.PI / 2,
      rotor: 0, bank: 0.28, hp: 900, maxHp: 900, fuel: 100, fireCd: 0, rocketCd: 0, landed: false,
    };
    this.onTransit(this.sector + 1);
    sfx.rotor();
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
    this.reset(false);
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
    this.setBanner(`SECTOR ${this.sector}/5 · ${theme.name}`, `${theme.codename} — HYDRA RESISTANCE ESCALATED`);
    this.objective = `ASSAULT ${theme.name} · DESTROY 6 MAINFRAMES`;
    this.onTransit(0);
    sfx.siren();
  }

  private dropPickup(x: number, y: number, kind: Pickup['kind'], weapon?: string) {
    this.pickups.push({ kind, weapon, x, y, t: 0, life: 20 });
  }

  private explode(x: number, y: number, radius: number, dmg: number, sound: boolean) {
    if (sound) sfx.explode();
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
      for (const v of this.vans) if (!v.dead && !v.reserved && !v.driving && Math.hypot(v.x - x, v.y - y) < radius + 45) {
        v.hp -= dmg * 1.5;
        if (v.hp <= 0) { v.dead = true; this.score += 350; this.sparks(v.x, v.y, '#edb57d', 17); }
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
    if (pd < radius) {
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
        if (g.t <= 0) { this.nades.splice(i, 1); this.explode(g.x, g.y, 210, g.dmg, true); }
        continue;
      }
      g.t -= dt; g.vz -= 300 * dt;
      g.z = Math.max(0, g.z + g.vz * dt);
      if (g.z <= 0) { g.vz = Math.abs(g.vz) * 0.45; if (g.vz < 18) g.vz = 0; g.vx *= 0.72; g.vy *= 0.72; }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (this.pointBlocked(g.x, g.y)) { g.vx *= -0.6; g.vy *= -0.6; g.x += g.vx * dt * 2; g.y += g.vy * dt * 2; }
      if (Math.random() < 0.5) this.addParticle(g.x, g.y - g.z, rand(-20, 20), rand(-40, -10), 0.4, 2.4, '#b9c6c2', false);
      if (g.t <= 0) {
        this.explode(g.x, g.y, g.big ? 190 : 155, g.dmg, true);
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
      if (g.t <= 0) { this.explode(g.x, g.y, 145, 64, true); this.enemyNades.splice(i, 1); }
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
        else {
          const w = p.weapon!;
          // Bank what we are holding, then take the better of the crate's load and whatever
          // this weapon still had stored - spare rockets survive swapping tubes.
          if (this.ammo !== Infinity) this.weaponAmmo.set(this.weapon, this.ammo);
          const fresh = WEAPONS[w].ammo;
          this.weapon = w;
          this.ammo = fresh === Infinity ? Infinity : Math.max(fresh, this.weaponAmmo.get(w) ?? 0);
          this.addText(this.px, this.py - 34, WEAPONS[w].name + (fresh !== Infinity && (this.weaponAmmo.get(w) ?? 0) > fresh ? ` / ${this.ammo} ROUNDS KEPT` : ''), WEAPONS[w].color, 20);
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
    if (this.flyingPlane && this.plane) {
      this.plane.hp = Math.max(0, this.plane.hp - dmg);
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
    if (this.drivingVan) {
      const v = this.drivingVan; v.hp = Math.max(0, v.hp - dmg);
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
    const camX = this.camX, camY = this.camY;

    ctx.save();
    ctx.fillStyle = '#080d0c';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.translate(-camX, -camY);

    this.drawGround(ctx, camX, camY);
    this.drawZones(ctx, camX, camY);
    this.facilityPainter.drawGround(ctx, this.facilities, { x: camX, y: camY, w: this.w, h: this.h }, this.simulationTime);
    drawRuins(ctx, this.ruins, { x: camX, y: camY, w: this.w, h: this.h });
    this.drawDecals(ctx, camX, camY);
    this.drawHQFloor(ctx, camX, camY);
    this.drawStructures(ctx, camX, camY);
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
    if (this.status !== 'over' && !this.piloting && !this.flyingPlane && !this.drivingVan) this.drawPlayer(ctx);
    if (this.playerHeli) this.drawPlayerHeli(ctx, camX, camY);
    this.drawVans(ctx, camX, camY);
    this.drawLasers(ctx, camX, camY);
    this.drawAllies(ctx);
    this.drawPlane(ctx);
    this.drawHangarAircraft(ctx);
    this.drawHelis(ctx, true);
    this.drawHangars(ctx, camX, camY);
    this.facilityPainter.drawRoofs(ctx, this.facilities, { x: camX, y: camY, w: this.w, h: this.h }, this.simulationTime);
    this.drawStrategicSites(ctx);
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

    this.drawScreenFx(ctx);
    this.drawLighting(ctx, camX, camY);
    this.drawBlackoutLamps(ctx, camX, camY);
    this.drawWeather(ctx);
    if (this.status === 'playing' || this.status === 'paused' || this.status === 'upgrade') {
      this.drawThreatArrows(ctx, camX, camY);
      this.drawBossBar(ctx);
      this.drawMinimap(ctx);
    }
    if (this.isTouch && this.status === 'playing') this.drawSticks(ctx);
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

  private drawStrategicSites(ctx: CanvasRenderingContext2D) {
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

    // Base override terminals at POI centers
    for (const poi of this.pois) {
      if (poi.secret && !poi.discovered) continue;
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
    ctx.fillText(`DEPLOYING TO SECTOR ${this.sector + 1}/5`, this.w / 2, this.h * 0.16);
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

  private drawZones(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const z of this.zones) {
      if (z.x + z.w < camX - 60 || z.x > camX + this.w + 60 || z.y + z.h < camY - 60 || z.y > camY + this.h + 60) continue;
      switch (z.kind) {
        case 'road':
          ctx.fillStyle = this.sector === 2 ? '#2a2019' : this.sector === 3 ? '#1e292d' : this.sector === 5 ? '#24151a' : '#171d1c';
          ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(230,200,120,0.16)';
          ctx.lineWidth = 4; ctx.setLineDash([46, 42]);
          ctx.beginPath();
          if (z.w > z.h) { ctx.moveTo(z.x, z.y + z.h / 2); ctx.lineTo(z.x + z.w, z.y + z.h / 2); }
          else { ctx.moveTo(z.x + z.w / 2, z.y); ctx.lineTo(z.x + z.w / 2, z.y + z.h); }
          ctx.stroke(); ctx.setLineDash([]);
          break;
        case 'concrete': ctx.fillStyle = 'rgba(120,140,132,0.055)'; ctx.fillRect(z.x, z.y, z.w, z.h); break;
        case 'plaza':
          ctx.fillStyle = 'rgba(255,209,102,0.05)'; ctx.fillRect(z.x, z.y, z.w, z.h);
          ctx.strokeStyle = 'rgba(255,209,102,0.14)'; ctx.lineWidth = 2;
          ctx.strokeRect(z.x, z.y, z.w, z.h);
          break;
        case 'sand': ctx.fillStyle = 'rgba(190,160,100,0.05)'; ctx.fillRect(z.x, z.y, z.w, z.h); break;
        case 'grass': ctx.fillStyle = 'rgba(90,160,110,0.045)'; ctx.fillRect(z.x, z.y, z.w, z.h); break;
        case 'fuel': ctx.fillStyle = 'rgba(190,110,50,0.06)'; ctx.fillRect(z.x, z.y, z.w, z.h); break;
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

  /** 2.5D extruded structures with per-kind materials. */
  private drawStructures(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    this.grid.query(camX - 120, camY - 160, this.w + 240, this.h + 320, this.qset);
    const idxs = Array.from(this.qset);
    // sort by y so extrusions layer correctly
    idxs.sort((a, b) => this.obstacles[a].y - this.obstacles[b].y);

    for (const i of idxs) {
      const o = this.obstacles[i];
      if (o.dead || o.facilityDetail) continue;
      if (o.kind === 'plane') { this.drawParkedPlane(ctx, o); continue; }
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
        default:        top = '#26362f'; side = '#131b17'; edge = 'rgba(140,220,190,0.20)'; break;
      }
      if (o.tint && o.kind !== 'crate') top = o.tint;

      // ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(o.x + H * 0.5, o.y + H * 0.7, o.w, o.h);

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

      // material detailing
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

  /** Hydra transport vans: parked in ranks, drivable, wreckable. */
  private drawVans(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const v of this.vans) {
      if (v.dead || v.reserved) continue;
      if (v.x < camX - 160 || v.x > camX + this.w + 160 || v.y < camY - 160 || v.y > camY + this.h + 160) continue;
      const near = !v.driving && Math.hypot(v.x - this.px, v.y - this.py) < 130 && !this.piloting && !this.flyingPlane;
      drawTransport(ctx, v, this.simulationTime, 0, near ? '[F] ARMED TRANSPORT' : '');
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
      const col = p.kind === 'health' ? '#5dff9b' : p.kind === 'grenade' ? '#8fd0ff' : p.kind === 'shield' || p.kind === 'aegis' ? '#7fd8ff' : WEAPONS[p.weapon!].color;
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

  private drawBullets(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round';
    for (const b of this.bullets) {
      if (b.x < this.camX - 60 || b.x > this.camX + this.w + 60 || b.y < this.camY - 60 || b.y > this.camY + this.h + 60) continue;
      if (b.rocket) {
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#ffd08a'; ctx.fillRect(-10, -4, 20, 8);
        ctx.fillStyle = '#ff6b35';
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
    // gunship spotlights + engine glow
    for (const h of this.helis) {
      glow(h.x, h.y, 420, h.medevac ? '140,255,180' : '255,170,110', 0.4);
      // downward searchlight cone tip
      glow(h.x + Math.cos(h.ang) * 120, h.y + Math.sin(h.ang) * 120, 260, '255,240,200', 0.22);
    }
    if (this.playerHeli) {
      glow(this.playerHeli.x, this.playerHeli.y, this.piloting ? 480 : 220, '120,235,255', this.piloting ? 0.48 : 0.18);
      if (this.piloting) glow(this.playerHeli.x + Math.cos(this.playerHeli.ang) * 100, this.playerHeli.y + Math.sin(this.playerHeli.ang) * 100, 260, '255,235,180', 0.26);
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
    if (this.plane) glow(this.plane.x, this.plane.y, this.flyingPlane ? 640 : 320, '150,240,255', this.flyingPlane ? 0.5 : 0.22);
    if (this.vaultOpen) glow(this.vaultSpot.x + 300, this.vaultSpot.y, 620, '140,255,220', 0.3);
    // truck headlights
    for (const t of this.trucks) {
      if (t.dead) continue;
      glow(t.x + Math.cos(t.ang) * 110, t.y + Math.sin(t.ang) * 110, 340, '255,235,170', 0.3);
      glow(t.x, t.y, 220, '255,200,120', 0.15);
    }
    // VTOL engine light + rotor wash
    for (const a of this.airTransports) glow(a.x, a.y - a.altitude * 0.55, 210, '177,206,222', 0.13);
    for (const v of this.vtols) {
      glow(v.x, v.y, v.state === 'hover' ? 500 : 300, '160,220,240', v.state === 'hover' ? 0.5 : 0.3);
      if (v.state === 'hover') glow(v.x, v.y + 30, 380, '255,180,100', 0.25);
    }
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
