import { CLASSES, SUPPORTS, type Hud, type Perk } from '../game/engine';
import type { ScoreEntry } from '../game/scores';

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

export function Btn({
  children,
  onClick,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
}) {
  const base =
    'clip-corner relative px-6 py-3 text-sm md:text-base font-bold uppercase tracking-[0.22em] transition-all duration-150 active:scale-95 select-none';
  const styles =
    variant === 'primary'
      ? 'bg-amber-400 text-[#10160f] hover:bg-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.35)]'
      : variant === 'danger'
        ? 'bg-rose-500/90 text-white hover:bg-rose-400 shadow-[0_0_26px_rgba(244,63,94,0.35)]'
        : 'bg-teal-300/10 text-teal-200 border border-teal-300/35 hover:bg-teal-300/20';
  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function ScoreTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: number }) {
  return (
    <div className="hud-panel clip-corner w-full p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-teal-300/70">
        <span>Top Operatives</span>
        <span className="font-tech">LOCAL</span>
      </div>
      {scores.length === 0 ? (
        <p className="font-tech py-4 text-center text-xs text-teal-100/40">NO RECORDS ON FILE — DEPLOY TO REGISTER</p>
      ) : (
        <ol className="font-tech space-y-[3px] text-[12px] md:text-[13px]">
          {scores.slice(0, 7).map((s, i) => (
            <li
              key={s.date}
              className={`flex items-center gap-2 rounded-sm px-2 py-[3px] ${
                highlight === s.date ? 'bg-amber-400/20 text-amber-200' : i === 0 ? 'text-amber-300/90' : 'text-teal-100/70'
              }`}
            >
              <span className="w-5 opacity-60">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 truncate uppercase">{s.name}</span>
              <span className="opacity-50">W{s.wave}</span>
              <span className="w-16 text-right tabular-nums">{s.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CallsignInput({ name, setName }: { name: string; setName: (n: string) => void }) {
  return (
    <label className="hud-panel clip-corner flex items-center gap-3 px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.3em] text-teal-300/70">Callsign</span>
      <input
        value={name}
        maxLength={12}
        onChange={(e) => setName(e.target.value.toUpperCase())}
        placeholder="OPERATIVE"
        className="font-tech w-32 bg-transparent text-sm uppercase tracking-widest text-amber-200 outline-none placeholder:text-teal-100/25"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

export function HudLayer({
  hud,
  best,
  onPause,
  muted,
  onToggleMute,
}: {
  hud: Hud;
  best: number;
  onPause: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);
  const low = hpPct < 35;
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 md:p-4">
        <div className="hud-panel clip-corner px-3 py-2 md:px-5 md:py-3">
          <div className="text-[9px] uppercase tracking-[0.35em] text-teal-300/70">Score</div>
          <div className="font-tech text-2xl leading-none font-bold text-amber-300 text-glow tabular-nums md:text-4xl">
            {hud.score.toLocaleString()}
          </div>
          <div className="font-tech mt-1 text-[10px] tracking-widest text-teal-100/45">BEST {best.toLocaleString()}</div>
        </div>

        <div className="hud-panel clip-corner px-3 py-2 text-center md:px-6 md:py-3">
          <div className="text-[9px] uppercase tracking-[0.35em] text-teal-300/70">Sector {hud.sector}/5 · Wave</div>
          <div className="font-tech text-xl leading-none font-bold text-teal-200 md:text-3xl">
            {String(hud.wave).padStart(2, '0')}
          </div>
          <div className="font-tech mt-1 text-[10px] tracking-widest text-rose-300/80">
            {hud.enemiesLeft > 0 ? `${hud.enemiesLeft} HOSTILE` : 'CLEAR'}
          </div>
          <div className="font-tech mt-0.5 hidden max-w-40 truncate text-[9px] tracking-widest text-amber-200/55 sm:block">{hud.sectorName}</div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={onToggleMute}
            className="hud-panel clip-corner h-10 w-10 text-teal-200 transition active:scale-90 md:h-12 md:w-12"
            aria-label="mute"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={onPause}
            className="hud-panel clip-corner h-10 w-10 text-teal-200 transition active:scale-90 md:h-12 md:w-12"
            aria-label="pause"
          >
            ❚❚
          </button>
        </div>
      </div>

      {/* combo */}
      {hud.mult > 1 && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 md:top-32">
          <div className="animate-pulse-ring font-tech rounded-sm border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-center text-sm font-bold tracking-[0.3em] text-amber-300">
            x{hud.mult} STREAK {hud.streak}
          </div>
        </div>
      )}

      {/* banner */}
      {hud.bannerT > 0 && (
        <div key={hud.banner + hud.wave} className="absolute inset-x-0 top-1/3 flex flex-col items-center">
          <div className="animate-banner text-center">
            <div className="text-3xl font-bold tracking-[0.18em] text-amber-300 text-glow md:text-6xl">{hud.banner}</div>
            <div className="font-tech mt-2 text-xs tracking-[0.35em] text-teal-200/80 md:text-base">{hud.bannerSub}</div>
          </div>
        </div>
      )}

      {/* bottom left status */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-2 md:bottom-4 md:left-4">
        <div className="hud-panel clip-corner w-52 px-3 py-2 md:w-72 md:px-4 md:py-3">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-teal-300/70">
            <span>Vitals</span>
            <span className={`font-tech ${low ? 'text-rose-400' : 'text-teal-200'}`}>{hud.hp}/{hud.maxHp}</span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-black/60 md:h-3">
            <div
              className={`h-full transition-[width] duration-150 ${low ? 'bg-rose-500' : 'bg-gradient-to-r from-teal-400 to-emerald-300'}`}
              style={{ width: `${hpPct}%`, boxShadow: low ? '0 0 14px #f43f5e' : '0 0 14px #2dd4bf' }}
            />
          </div>

          {hud.shieldMax > 0 && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[9px] uppercase tracking-[0.25em] text-sky-300/80">
                <span>Riot Shield</span>
                <span className="font-tech">{hud.shieldHp}/{hud.shieldMax}</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-black/60">
                <div
                  className={`h-full transition-[width] duration-100 ${hud.shieldHp > 0 ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8]' : 'bg-sky-900'}`}
                  style={{ width: `${(hud.shieldHp / hud.shieldMax) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-teal-300/70">Weapon</div>
              <div className="font-tech text-sm font-bold tracking-widest text-amber-200 md:text-base">{hud.weapon}</div>
            </div>
            <div className="font-tech text-right text-sm text-teal-100/80 md:text-base">
              {hud.ammo < 0 ? '∞' : hud.ammo}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[9px] tracking-[0.2em] text-teal-300/70">FRAG</span>
              {Array.from({ length: Math.min(hud.grenadeCap, 8) }).map((_, i) => (
                <span
                  key={i}
                  className={`inline-block h-2.5 w-2 rounded-[1px] ${i < hud.grenades ? 'bg-sky-300 shadow-[0_0_8px_#7dd3fc]' : 'bg-white/12'}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-[9px] uppercase tracking-[0.25em] text-teal-300/70">
              <span>Dash</span>
              <span>{hud.dashPct >= 1 ? 'READY' : `${Math.round(hud.dashPct * 100)}%`}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-black/60">
              <div
                className={`h-full ${hud.dashPct >= 1 ? 'bg-cyan-300 shadow-[0_0_10px_#67e8f9]' : 'bg-cyan-700'}`}
                style={{ width: `${hud.dashPct * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-2 border-t border-white/10 pt-2">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.25em]">
              <span className="text-rose-300/80">Hostile AI</span>
              <span className="font-tech text-rose-200/60">{'▮'.repeat(Math.max(1, Math.round(hud.aiLevel * 5)))}</span>
            </div>
            <div className="font-tech mt-0.5 flex items-center justify-between text-[10px] tracking-widest">
              <span className="text-amber-200/80">{hud.aiTactic}</span>
              {hud.aiSquads > 0 && <span className="text-teal-100/60">{hud.aiSquads} SQD</span>}
            </div>
            <div className="font-tech mt-1 truncate text-[10px] tracking-widest text-teal-100/50">{hud.aiNote}</div>
            {hud.aiVolley > 0 && (
              <div className="animate-pulse-ring mt-1.5 rounded-sm border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-center text-[10px] font-bold tracking-[0.28em] text-amber-200">
                ⚠ VOLLEY INCOMING
              </div>
            )}
            {hud.aiThreat > 0 && (
              <div className="font-tech mt-1 text-center text-[10px] tracking-[0.28em] text-rose-300">
                💣 GRENADE × {hud.aiThreat}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* mission / objective panel */}
      <div className="absolute top-24 right-2 w-44 md:top-28 md:right-4 md:w-56">
        <div className="hud-panel clip-corner px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.3em] text-amber-300/80">Objective</div>
          <div className="font-tech mt-0.5 text-[11px] leading-tight tracking-wide text-amber-100">{hud.objective}</div>

          <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-[0.25em] text-cyan-300/70">
            <span>Mainframes</span>
            <span className="font-tech">{hud.serversTotal - hud.serversLeft}/{hud.serversTotal}</span>
          </div>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: hud.serversTotal }).map((_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-[1px] ${i < hud.serversTotal - hud.serversLeft ? 'bg-white/12' : 'bg-cyan-300 shadow-[0_0_8px_#67e8f9]'}`}
              />
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-[0.25em]">
            <span className="text-purple-300/70">Satcom</span>
            <span className="font-tech text-purple-200/80">{hud.satcomTotal - hud.satcomsLeft}/{hud.satcomTotal}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.25em]">
            <span className="text-sky-300/70">Programmers</span>
            <span className="font-tech text-sky-200/80">{hud.codersLeft}</span>
          </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[9px] uppercase tracking-[0.25em]">
              <span className="text-amber-300/80">Op Phase</span>
              <span className="font-tech text-amber-200">{hud.phase}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
              {hud.trucksActive > 0 && (
                <span className="font-tech rounded-sm bg-orange-500/15 px-1.5 py-0.5 text-center tracking-widest text-orange-200">
                  🚚 {hud.trucksActive}
                </span>
              )}
              {hud.helisActive > 0 && (
                <span className="animate-pulse-ring font-tech rounded-sm bg-rose-500/20 px-1.5 py-0.5 text-center tracking-widest text-rose-200">
                  🚁 {hud.helisActive}
                </span>
              )}
              {hud.vtolsInbound > 0 && (
                <span className="font-tech rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-center tracking-widest text-amber-200">
                  ✈ {hud.vtolsInbound}
                </span>
              )}
              {hud.barriersActive > 0 && (
                <span className="font-tech rounded-sm bg-sky-500/15 px-1.5 py-0.5 text-center tracking-widest text-sky-200">
                  🔷 {hud.barriersActive}
                </span>
              )}
              {hud.woundedCount > 0 && (
                <span className="font-tech rounded-sm bg-pink-500/15 px-1.5 py-0.5 text-center tracking-widest text-pink-200">
                  ⚕ {hud.woundedCount}
                </span>
              )}
            </div>

          <div className="mt-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.25em]">
            <span className="text-amber-300/80">General</span>
            <span className={`font-tech ${hud.generalShield ? 'text-cyan-300' : 'text-rose-300'}`}>
              {hud.generalHp <= 0 ? 'KIA' : hud.generalShield ? 'SHIELDED' : 'EXPOSED'}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-black/60">
            <div
              className={`h-full ${hud.generalShield ? 'bg-cyan-500/50' : 'bg-gradient-to-r from-amber-400 to-rose-400'}`}
              style={{ width: `${hud.generalHp * 100}%` }}
            />
          </div>

          {hud.piloting && (
            <div className="mt-2 border-t border-sky-300/20 pt-1.5">
              <div className="flex justify-between text-[9px] uppercase tracking-[0.25em] text-sky-300">
                <span>Captured Gunship</span>
                <span className="font-tech">FUEL {Math.ceil(hud.heliFuel)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-black/60">
                <div className="h-full bg-sky-300 shadow-[0_0_8px_#67e8f9]" style={{ width: `${(hud.heliHp / hud.heliMaxHp) * 100}%` }} />
              </div>
              <div className="font-tech mt-1 text-center text-[9px] tracking-widest text-teal-100/60">WASD FLY · LMB GUN · G ROCKET · F LAND</div>
            </div>
          )}

          {hud.driving && (
            <div className="mt-2 rounded-sm border border-amber-300/50 bg-amber-400/10 px-2 py-1 text-center text-[10px] font-bold tracking-[0.18em] text-amber-100">
              🚚 TRANSPORT · W/S THROTTLE · SHIFT RAM
            </div>
          )}
          {hud.flyingPlane && (
            <div className="mt-2 rounded-sm border border-sky-300/60 bg-sky-400/15 px-2 py-1 text-center text-[10px] font-bold tracking-[0.18em] text-sky-100">
              ✈ S.H.I.E.L.D. BOMBER · G BOMB CARPET
            </div>
          )}
          {hud.nearPrompt && (
            <div className="animate-pulse-ring mt-2 rounded-sm border border-teal-300/60 bg-teal-400/15 px-2 py-1 text-center text-[10px] font-bold tracking-[0.18em] text-teal-100">
              {hud.nearPrompt}
            </div>
          )}
          {hud.siegeActive && (
            <div className="animate-pulse-ring mt-2 rounded-sm border border-rose-400/70 bg-rose-500/20 px-2 py-1 text-center text-[10px] font-bold tracking-[0.2em] text-rose-100">
              ⚠ HYDRA COUNTER-SIEGE — HOLD
            </div>
          )}

          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-white/10 pt-2 text-center text-[9px] tracking-widest">
            <span className="text-amber-200/80">SITES {hud.poisCaptured}/{hud.poisTotal}</span>
            <span className="text-sky-200/80">BEAM {hud.lasersHeld}</span>
            <span className={hud.allies > 0 ? 'text-teal-200' : 'text-teal-100/35'}>ESC {hud.allies}</span>
          </div>
          {hud.vaultFound && (
            <div className="font-tech mt-1 text-center text-[9px] tracking-[0.25em] text-emerald-300/80">
              ★ BLACK VAULT SECURED
            </div>
          )}

          {hud.hqDist > 400 && (
            <div className="font-tech mt-2 text-center text-[10px] tracking-[0.25em] text-teal-100/45">
              HQ ⟶ {(hud.hqDist / 100).toFixed(0)}00m
            </div>
          )}
        </div>
      </div>

      {/* S.H.I.E.L.D. field comms ticker */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 md:bottom-4">
        <div className="hud-panel clip-corner flex items-center gap-2 px-3 py-1.5">
          <span className="text-[9px] tracking-[0.3em] text-teal-300/70">S.H.I.E.L.D.</span>
          <span className="font-tech text-[10px] tracking-[0.15em] text-teal-100/80">
            {hud.helisActive > 0 ? 'AIR THREAT — GUNSHIP ON STATION'
              : hud.generalShield ? (hud.hqDist > 3000 ? 'STORM THE FORTRESS NORTH' : 'IN RANGE — BREAK THE PERIMETER')
              : hud.generalHp > 0 ? 'TARGET GENERAL EXPOSED — FINISH HIM'
              : 'SUSTAIN THE LINE'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export function MenuScreen({
  onStart,
  scores,
  name,
  setName,
  touch,
  cls,
  setCls,
  support,
  setSupport,
}: {
  onStart: () => void;
  scores: ScoreEntry[];
  name: string;
  setName: (n: string) => void;
  touch: boolean;
  cls: string;
  setCls: (c: string) => void;
  support: string;
  setSupport: (s: string) => void;
}) {
  return (
    <Overlay>
      <div className="animate-float-up flex w-full max-w-5xl flex-col items-center gap-5 px-4">
        <div className="text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <span className="text-[10px] tracking-[0.5em] text-teal-300/60">S.H.I.E.L.D.</span>
            <svg viewBox="0 0 40 40" className="h-9 w-9 text-teal-300" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="20" cy="20" r="17" opacity="0.5" />
              <path d="M20 5 L23 15 L33 20 L23 25 L20 35 L17 25 L7 20 L17 15 Z" fill="currentColor" fillOpacity="0.25" />
              <circle cx="20" cy="20" r="3" fill="currentColor" />
            </svg>
            <span className="text-[10px] tracking-[0.5em] text-teal-300/60">TACTICAL</span>
          </div>
          <div className="font-tech text-[10px] tracking-[0.6em] text-teal-300/70 md:text-xs">S.H.I.E.L.D. BASE OVERRUN // HYDRA OCCUPATION</div>
          <h1 className="mt-1 text-4xl leading-none font-bold tracking-[0.1em] text-amber-300 text-glow sm:text-6xl md:text-7xl">
            IRON VEIL
          </h1>
          <div className="relative mx-auto mt-2 h-[2px] w-56 overflow-hidden bg-teal-300/20 md:w-80">
            <span className="animate-sweep absolute inset-y-0 w-1/3 bg-amber-300/80" />
          </div>
          <p className="font-tech mt-3 max-w-xl text-xs tracking-widest text-teal-100/60 md:text-sm">
            ONE S.H.I.E.L.D. OPERATIVE · FIVE 98 KM² WARZONES · TAKE BACK THE NETWORK
          </p>
        </div>

        <div className="w-full max-w-4xl">
          <div className="mb-2 text-center text-[10px] uppercase tracking-[0.4em] text-amber-300/70">Campaign · Five Hydra Worlds</div>
          <div className="relative grid grid-cols-5 gap-1">
            <div className="absolute top-5 right-[8%] left-[8%] h-px bg-gradient-to-r from-teal-400/40 via-amber-300/50 to-rose-500/50" />
            {[
              ['01', 'FALLEN HUB', 'text-teal-300'],
              ['02', 'RED MESA', 'text-orange-300'],
              ['03', 'ARCTIC RELAY', 'text-sky-300'],
              ['04', 'VENOM MARSH', 'text-lime-300'],
              ['05', 'HYDRA NEXUS', 'text-rose-300'],
            ].map(([id, label, color]) => (
              <div key={id} className="relative text-center">
                <div className={`font-tech relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-current bg-[#071011] text-[11px] ${color}`}>{id}</div>
                <div className={`mt-1 text-[8px] font-bold tracking-wider sm:text-[10px] ${color}`}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid w-full max-w-3xl gap-3 md:grid-cols-2">
          <div className="hud-panel clip-corner p-4 text-left">
            <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-teal-300/70">Field Manual</div>
            <ul className="font-tech space-y-1 text-[12px] text-teal-100/75 md:text-[13px]">
              {touch ? (
                <>
                  <li>◈ LEFT THUMB — move</li>
                  <li>◈ RIGHT THUMB — aim &amp; auto-fire</li>
                  <li>◈ DASH BUTTON — evade (brief invuln)</li>
                  <li>◈ FRAG BUTTON — lob a grenade</li>
                </>
              ) : (
                <>
                  <li>◈ WASD / ARROWS — move</li>
                  <li>◈ MOUSE — aim · HOLD LMB — fire</li>
                  <li>◈ SPACE / SHIFT — combat dash (invuln)</li>
                  <li>◈ G or RMB — frag grenade</li>
                  <li>◈ ESC / P — pause</li>
                </>
              )}
              <li className="text-amber-300/80">◈ Loot 🛡 SHIELDS block frontal fire</li>
              <li className="text-amber-300/80">◈ M79 THUMPER lobs 190-radius blasts</li>
              <li className="text-amber-300/80">◈ Upgrade after every wave · 1/2/3 keys</li>
              <li className="text-amber-300/80">◈ Shoot green CACHES for loot</li>
            </ul>
          </div>
          <div className="hud-panel clip-corner p-4 text-left">
            <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-rose-300/80">Mission Brief</div>
            <ul className="font-tech space-y-1 text-[12px] text-teal-100/75 md:text-[13px]">
              <li className="text-amber-300/90">◈ Fight north to the HYDRA-OCCUPIED S.H.I.E.L.D. BASE</li>
              <li>◈ <span className="text-amber-300">5-PHASE OPERATION</span> repeats each cycle</li>
              <li>◈ Kill trucks before troops jump off the tailgate!</li>
              <li>◈ <span className="text-rose-300">GUNSHIPS</span> strafe &amp; fire rocket salvos</li>
              <li>◈ <span className="text-green-300">RECOVERY VEHICLES + MEDEVAC</span> extract wounded</li>
              <li>◈ <span className="text-sky-300">ENERGY BARRIERS</span> block your fire — break them</li>
              <li>◈ <span className="text-rose-300">MEDICS</span> heal · <span className="text-amber-300">SAPPERS</span> mine</li>
              <li>◈ Inside the keep: <span className="text-cyan-300">6 MAINFRAMES</span> run their AI</li>
              <li>◈ Down the <span className="text-purple-300">SATCOM arrays</span> on approach</li>
              <li>◈ Board the captured <span className="text-sky-300">S.H.I.E.L.D. GUNSHIP</span> in the hangar [F]</li>
              <li>◈ <span className="text-orange-300">AIR STATION KRAKEN</span>: sealed hangars, 36 vans, parade ranks</li>
              <li>◈ Hangars look shut — walk the door, the roof splits open</li>
              <li>◈ [F] to <span className="text-amber-200">drive vans</span>, seize helis, take beam batteries</li>
              <li>◈ <span className="text-rose-300">BEAM SITES</span> kill in two hits — capture or destroy them</li>
              <li>◈ <span className="text-yellow-200">SSR / PEGGY CARTER</span> stations hold old S.H.I.E.L.D. caches</li>
              <li>◈ Clear a site, then [F] each gate to <span className="text-emerald-300">barricade it</span></li>
              <li>◈ Sealing a base triggers a massed truck-and-horde counter-siege</li>
              <li className="text-emerald-300/90">◈ One vault never fell. It is not on the map. Find it.</li>
              <li>◈ <span className="text-sky-300">PROGRAMMERS</span> &amp; the <span className="text-amber-300">GENERAL</span> are unarmed</li>
              <li>◈ They never leave — the garrison protects them</li>
              <li>◈ Destroy every mainframe to drop his shield</li>
              <li className="text-rose-300/90">◈ Kill the GENERAL to win the war</li>
              <li className="text-teal-200/80">◈ VTOLs fly squads in from helipads</li>
            </ul>
          </div>
        </div>

        <div className="hud-panel clip-corner w-full max-w-3xl p-4 text-left">
          <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-rose-300/80">Enemy Battle Doctrine</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {[
              ['🔍', 'RECON', 'phase 1 — probes find you'],
              ['🚚', 'ARMORED COLUMN', 'phase 2 — up to 7 trucks roll out'],
              ['💣', 'BOMBARDMENT', 'phase 3 — grenadiers soften you'],
              ['🚁', 'COMBINED ASSAULT', 'phase 4 — gunships + armor'],
              ['🔷', 'FULL SIEGE', 'phase 5 — barriers wall you in'],
              ['🛡️', 'PHALANX', '3-deep shield wall'],
              ['⚡', 'BLITZ', 'raider + rusher wedge'],
              ['⚕', 'MEDEVAC', 'wounded get airlifted out'],
            ].map(([i, n, d]) => (
              <div key={n} className="flex items-start gap-2">
                <span className="text-base">{i}</span>
                <div>
                  <div className="text-[11px] font-bold tracking-widest text-amber-200">{n}</div>
                  <div className="font-tech text-[10px] text-teal-100/55">{d}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="font-tech mt-2 text-[10px] tracking-widest text-rose-200/60">
            ⚠ THE GENERAL WATCHES YOU AND RE-PLANS. SQUAD LEADERS (★) ADAPT ON THE GROUND.
          </p>
        </div>

        <div className="w-full max-w-3xl">
          <ScoreTable scores={scores} />
        </div>

        <div className="w-full max-w-3xl">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-teal-300/70">Select Starting Loadout</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {CLASSES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCls(c.id)}
                className={`clip-corner relative px-3 py-2.5 text-left transition-all duration-150 active:scale-95 ${
                  cls === c.id
                    ? 'border border-amber-300/70 bg-amber-400/15 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
                    : 'border border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{c.icon}</span>
                  <span className={`text-[12px] font-bold tracking-widest ${cls === c.id ? 'text-amber-200' : 'text-teal-100/80'}`}>
                    {c.name}
                  </span>
                </div>
                <div className="font-tech mt-1 text-[9px] uppercase tracking-widest text-teal-300/60">{c.tag}</div>
                <div className="font-tech mt-0.5 text-[10px] leading-tight text-teal-100/60">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-3xl">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-sky-300/70">S.H.I.E.L.D. Mission Support</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SUPPORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSupport(s.id)}
                className={`clip-corner flex items-center gap-3 px-3 py-2 text-left transition-all duration-150 active:scale-95 ${
                  support === s.id
                    ? 'border border-sky-300/70 bg-sky-400/15 shadow-[0_0_22px_rgba(56,189,248,0.22)]'
                    : 'border border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span className="text-xl text-sky-200">{s.icon}</span>
                <span>
                  <span className={`block text-[11px] font-bold tracking-widest ${support === s.id ? 'text-sky-100' : 'text-teal-100/80'}`}>{s.name}</span>
                  <span className="font-tech block text-[10px] leading-tight text-teal-100/60">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <CallsignInput name={name} setName={setName} />
          <Btn onClick={onStart} className="px-10 py-4 text-lg">
            ▶ Deploy
          </Btn>
          <p className="font-tech text-[10px] tracking-[0.3em] text-teal-100/35">
            {touch ? 'TAP DEPLOY TO BEGIN' : 'PRESS ENTER TO DEPLOY'}
          </p>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/* Upgrade / loadout draft                                             */
/* ------------------------------------------------------------------ */

const RARITY: Record<Perk['rarity'], { ring: string; tag: string; label: string; glow: string }> = {
  common: { ring: 'border-teal-300/40 hover:border-teal-200', tag: 'text-teal-300/80', label: 'STANDARD', glow: 'hover:shadow-[0_0_30px_rgba(45,212,191,0.35)]' },
  rare: { ring: 'border-sky-400/50 hover:border-sky-300', tag: 'text-sky-300', label: 'RARE', glow: 'hover:shadow-[0_0_34px_rgba(56,189,248,0.4)]' },
  epic: { ring: 'border-fuchsia-400/50 hover:border-fuchsia-300', tag: 'text-fuchsia-300', label: 'PROTOTYPE', glow: 'hover:shadow-[0_0_40px_rgba(232,121,249,0.45)]' },
};

export function UpgradeScreen({
  wave,
  choices,
  onChoose,
  build,
}: {
  wave: number;
  choices: Perk[];
  onChoose: (id: string) => void;
  build: { perk: Perk; count: number }[];
}) {
  return (
    <div className="scanlines absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#04090a]/85 via-[#061012]/92 to-[#04090a]/95 py-6">
      <div className="animate-float-up flex w-full max-w-4xl flex-col items-center gap-5 px-4">
        <div className="text-center">
          <div className="font-tech text-[10px] tracking-[0.55em] text-teal-300/70">WAVE {wave} CLEARED · FIELD REQUISITION</div>
          <h2 className="mt-1 text-3xl font-bold tracking-[0.15em] text-amber-300 text-glow md:text-5xl">SELECT UPGRADE</h2>
          <p className="font-tech mt-1 text-[11px] tracking-[0.3em] text-teal-100/50">CHOOSE ONE · PRESS 1 / 2 / 3</p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3">
          {choices.map((p, i) => {
            const r = RARITY[p.rarity];
            return (
              <button
                key={p.id}
                onClick={() => onChoose(p.id)}
                className={`clip-corner group relative flex flex-col items-center gap-2 border bg-gradient-to-b from-white/[0.06] to-transparent p-5 text-center transition-all duration-150 hover:-translate-y-1 active:scale-95 ${r.ring} ${r.glow}`}
              >
                <span className="absolute top-2 left-3 font-tech text-[10px] text-white/30">{i + 1}</span>
                <span className={`font-tech text-[9px] tracking-[0.3em] ${r.tag}`}>{r.label}</span>
                <span className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]">{p.icon}</span>
                <span className="text-sm font-bold tracking-[0.14em] text-white">{p.name}</span>
                <span className="font-tech text-[12px] leading-snug text-teal-100/70">{p.desc}</span>
              </button>
            );
          })}
        </div>

        {build.length > 0 && <BuildBar build={build} />}
      </div>
    </div>
  );
}

function BuildBar({ build }: { build: { perk: Perk; count: number }[] }) {
  return (
    <div className="hud-panel clip-corner flex max-w-2xl flex-wrap items-center justify-center gap-2 px-4 py-2">
      <span className="font-tech text-[9px] tracking-[0.3em] text-teal-300/60">LOADOUT</span>
      {build.map(({ perk, count }) => (
        <span
          key={perk.id}
          title={`${perk.name} ×${count}`}
          className="flex items-center gap-1 rounded-sm bg-white/5 px-2 py-1 text-xs"
        >
          <span>{perk.icon}</span>
          <span className="font-tech text-teal-100/80">×{count}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pause                                                               */
/* ------------------------------------------------------------------ */

export function PauseScreen({
  hud,
  onResume,
  onRestart,
  onQuit,
  build,
}: {
  hud: Hud;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  build: { perk: Perk; count: number }[];
}) {
  return (
    <Overlay>
      <div className="animate-float-up flex w-full max-w-md flex-col items-center gap-5 px-4">
        <h2 className="text-4xl font-bold tracking-[0.35em] text-teal-200 text-glow">PAUSED</h2>
        <div className="hud-panel clip-corner grid w-full grid-cols-3 gap-2 p-4 text-center">
          <Stat label="Score" value={hud.score.toLocaleString()} />
          <Stat label="Wave" value={String(hud.wave)} />
          <Stat label="Streak" value={`x${hud.mult}`} />
        </div>
        {build.length > 0 && <BuildBar build={build} />}
        <div className="flex flex-wrap justify-center gap-3">
          <Btn onClick={onResume}>Resume</Btn>
          <Btn onClick={onRestart} variant="ghost">Restart</Btn>
          <Btn onClick={onQuit} variant="ghost">Abort</Btn>
        </div>
      </div>
    </Overlay>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.3em] text-teal-300/70">{label}</div>
      <div className="font-tech text-xl font-bold text-amber-300">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Game over                                                           */
/* ------------------------------------------------------------------ */

export function GameOverScreen({
  hud,
  scores,
  name,
  setName,
  onRestart,
  onMenu,
  isBest,
  entryDate,
  build,
}: {
  hud: Hud;
  scores: ScoreEntry[];
  name: string;
  setName: (n: string) => void;
  onRestart: () => void;
  onMenu: () => void;
  isBest: boolean;
  entryDate: number;
  build: { perk: Perk; count: number }[];
}) {
  return (
    <Overlay>
      <div className="animate-float-up flex w-full max-w-3xl flex-col items-center gap-4 px-4">
        <div className="text-center">
          <div className="font-tech text-[10px] tracking-[0.55em] text-rose-400/80">SIGNAL LOST</div>
          <h2 className="text-4xl font-bold tracking-[0.2em] text-rose-400 text-glow md:text-6xl">OPERATIVE DOWN</h2>
        </div>

        <div className="hud-panel clip-corner grid w-full max-w-md grid-cols-3 gap-2 p-4 text-center">
          <Stat label="Final Score" value={hud.score.toLocaleString()} />
          <Stat label="Wave" value={String(hud.wave)} />
          <Stat label="Best Combo" value={`x${hud.mult}`} />
        </div>

        {isBest && (
          <div className="animate-pulse-ring font-tech rounded-sm border border-amber-300/50 bg-amber-400/10 px-4 py-1 text-sm tracking-[0.3em] text-amber-300">
            ★ NEW RECORD ★
          </div>
        )}

        {build.length > 0 && <BuildBar build={build} />}

        <div className="grid w-full gap-3 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-3">
            <CallsignInput name={name} setName={setName} />
            <Btn onClick={onRestart} className="w-full px-8 py-4 text-lg">↻ Redeploy</Btn>
            <Btn onClick={onMenu} variant="ghost" className="w-full">Base</Btn>
            <p className="font-tech text-[10px] tracking-[0.3em] text-teal-100/35">PRESS ENTER TO RESTART</p>
          </div>
          <ScoreTable scores={scores} highlight={entryDate} />
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/* Victory                                                             */
/* ------------------------------------------------------------------ */

export function VictoryScreen({
  hud, scores, name, setName, onRestart, onMenu, isBest, entryDate, build,
}: {
  hud: Hud; scores: ScoreEntry[]; name: string; setName: (n: string) => void;
  onRestart: () => void; onMenu: () => void; isBest: boolean; entryDate: number;
  build: { perk: Perk; count: number }[];
}) {
  return (
    <div className="scanlines absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0b0a04]/93 via-[#12100a]/95 to-[#04090a]/97 py-6">
      <div className="animate-float-up flex w-full max-w-3xl flex-col items-center gap-4 px-4">
        <div className="text-center">
          <div className="font-tech text-[10px] tracking-[0.55em] text-amber-300/80">MISSION ACCOMPLISHED</div>
          <h2 className="text-4xl font-bold tracking-[0.16em] text-amber-300 text-glow md:text-6xl">
            COMMAND ELIMINATED
          </h2>
          <p className="font-tech mt-2 text-xs tracking-[0.3em] text-teal-100/60 md:text-sm">
            FIVE HYDRA COMMAND BASES DESTROYED · S.H.I.E.L.D. HAS RECLAIMED THE NETWORK
          </p>
        </div>

        <div className="hud-panel clip-corner grid w-full max-w-lg grid-cols-4 gap-2 p-4 text-center">
          <Stat label="Score" value={hud.score.toLocaleString()} />
          <Stat label="Wave" value={String(hud.wave)} />
          <Stat label="Bases" value="5/5" />
          <Stat label="Combo" value={`x${hud.mult}`} />
        </div>

        {isBest && (
          <div className="animate-pulse-ring font-tech rounded-sm border border-amber-300/50 bg-amber-400/10 px-4 py-1 text-sm tracking-[0.3em] text-amber-300">
            ★ NEW RECORD ★
          </div>
        )}
        {build.length > 0 && <BuildBar build={build} />}

        <div className="grid w-full gap-3 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-3">
            <CallsignInput name={name} setName={setName} />
            <Btn onClick={onRestart} className="w-full px-8 py-4 text-lg">↻ New Operation</Btn>
            <Btn onClick={onMenu} variant="ghost" className="w-full">Base</Btn>
          </div>
          <ScoreTable scores={scores} highlight={entryDate} />
        </div>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="scanlines absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#04090a]/92 via-[#061012]/95 to-[#04090a]/97 py-6">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Touch action buttons                                                */
/* ------------------------------------------------------------------ */

export function TouchButtons({
  onDash,
  onFrag,
  onUse,
  dashPct,
  grenades,
  showUse,
  piloting,
}: {
  onDash: () => void;
  onFrag: () => void;
  onUse: () => void;
  dashPct: number;
  grenades: number;
  showUse: boolean;
  piloting: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-4">
      <button
        onPointerDown={(e) => { e.preventDefault(); onDash(); }}
        className={`pointer-events-auto h-16 w-16 rounded-full border-2 text-[11px] font-bold tracking-widest transition active:scale-90 ${
          dashPct >= 1 ? 'border-cyan-300 bg-cyan-400/25 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.5)]' : 'border-white/15 bg-white/5 text-white/35'
        }`}
      >
        DASH
      </button>
      <button
        onPointerDown={(e) => { e.preventDefault(); onFrag(); }}
        className={`pointer-events-auto h-16 w-16 rounded-full border-2 text-[11px] font-bold tracking-widest transition active:scale-90 ${
          grenades > 0 ? 'border-sky-300 bg-sky-400/20 text-sky-100 shadow-[0_0_22px_rgba(125,211,252,0.45)]' : 'border-white/15 bg-white/5 text-white/35'
        }`}
      >
        FRAG {grenades}
      </button>
      {showUse && (
        <button
          onPointerDown={(e) => { e.preventDefault(); onUse(); }}
          className="pointer-events-auto h-16 w-16 rounded-full border-2 border-teal-300 bg-teal-400/25 text-[10px] font-bold tracking-widest text-teal-50 shadow-[0_0_22px_rgba(45,212,191,0.5)] transition active:scale-90"
        >
          {piloting ? 'EXIT' : 'USE'}
        </button>
      )}
    </div>
  );
}
