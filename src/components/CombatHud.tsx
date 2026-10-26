import { useEffect, useState } from 'react';
import type { Hud } from '../game/engine';

interface Props {
  hud: Hud; best: number; muted: boolean; fullscreen: boolean;
  onPause: () => void; onMute: () => void; onFullscreen: () => void; onUse: () => void;
  onGate: () => void; onAegis: () => void; onGuide: () => void; onMouse: () => void;
  onDash: () => void; onSecondary: () => void;
  /** Shoulder a carried weapon from the kit (touch players have no number keys). */
  onWeapon: (short: string) => void;
  /** Top the gun up from the banked reserve — the same thing R does on a keyboard. */
  onReload: () => void;
}

export default function CombatHud(p: Props) {
  const h = p.hud;
  const [dismissedStory, setDismissedStory] = useState('');
  const [invOpen, setInvOpen] = useState(false);
  // I or TAB opens the kit; escape closes it before the pause menu ever sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'i' || k === 'tab') { e.preventDefault(); setInvOpen(v => !v); }
      else if (k === 'escape' && invOpen) setInvOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invOpen]);
  const [openedStory, setOpenedStory] = useState('');
  const storyExpanded = dismissedStory !== h.storyTitle && (h.storyTime > 0 || openedStory === h.storyTitle);
  const vehicle = h.flyingPlane || h.piloting || h.driving;
  const hp = vehicle ? h.vehicleHp : h.hp, max = vehicle ? h.vehicleMax : h.maxHp;
  const vehicleName = h.flyingPlane ? 'NIGHTJAR' : h.piloting ? 'KESTREL' : h.tank ? 'HYDRA TANK' : h.driving ? 'HYDRA TRANSPORT' : 'OPERATIVE';
  return <div className="combat-hud">
    <header className="combat-top"><div className="combat-score"><small>PROTOCOL SOLAR ECLIPSE</small><strong>{h.score.toLocaleString()}</strong><span>BEST {p.best.toLocaleString()}</span></div><div className="combat-sector"><small>SECTOR {h.sector} / 06</small><b>{h.sectorName}</b><span>WAVE {String(h.wave).padStart(2, '0')} <i>/</i> {h.enemiesLeft} HOSTILES</span>{h.devInfinite && <em className="combat-dev">DEV · INFINITE LIVES</em>}</div><div className="combat-settings"><button onClick={p.onMute} aria-label={p.muted ? 'Enable sound' : 'Mute sound'}>{p.muted ? 'SOUND OFF' : 'SOUND ON'}</button><button onClick={p.onFullscreen} aria-label={p.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={p.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{p.fullscreen ? 'EXIT FULL' : 'FULLSCREEN'}</button><button onClick={p.onMouse} aria-label="Mouse sensitivity" title="Mouse sensitivity — also the mouse wheel in game">{`MOUSE ${h.mouseSens.toFixed(2)}x`}</button><button onClick={p.onPause} aria-label="Pause game">II <kbd>ESC</kbd></button></div></header>
    {/* The overlay is three stacks, not a dozen elements pinned to the same corners.
        Left: position and the installation you are standing in. Right: objective, the
        searchlight net, the counter-assault warning, the transmission. Centre: override,
        blackout, wave banner, kill chain. Panels inside a stack are laid out by flexbox
        with a gap, so no two of them can land on top of each other — the old absolute
        tops collided below ~900 px tall, and the counter-assault warning sat on the
        searchlight panel at every size. */}
    <div className="combat-left">
      <div className="combat-position"><span>{h.coords}</span><button onClick={p.onGuide} title="Toggle guide to the concealed vault entrance">VAULT GUIDE <kbd>V</kbd></button></div>
      {h.facilityLabel && <div className={`combat-facility ${h.facilityStatus.startsWith('SECURED') ? 'secured' : ''}`}><small>LOCAL INSTALLATION</small><b>{h.facilityLabel}</b><span>{h.facilityStatus}</span></div>}
    </div>
    <div className="combat-center">
      {h.overrideActive && <div className="combat-override"><small>BASE NETWORK OVERRIDE</small><b>{h.overrideBase}</b><div><span style={{ width: `${h.overrideProgress}%` }}/></div><strong>{h.overrideProgress}%</strong><p>HOLD WITHIN 205m OF THE UPLINK / QRF ACTIVE</p></div>}
      {h.blackoutHud && <div className="combat-blackout"><b>NIGHT</b><span>HEADLAMPS INBOUND</span></div>}
      {h.bannerT > 0 && <div key={`${h.wave}${h.banner}`} className="combat-banner" style={{ opacity: Math.min(1, h.bannerT * 2) }}><strong>{h.banner}</strong><span>{h.bannerSub}</span></div>}
      {h.mult > 1 && <div className="combat-combo">x{h.mult}<span>{h.streak} KILL CHAIN</span></div>}
    </div>
    <div className="combat-right">
      <div className="combat-objective"><small>PRIMARY OBJECTIVE</small><p>{h.objective}</p><span>MAINFRAMES {h.serversTotal - h.serversLeft}/{h.serversTotal} <i>/</i> {h.generalShield ? 'COMMAND SHIELDED' : 'GENERAL EXPOSED'}</span></div>
      {(h.alarmActive || h.alarmExposure > 0.05 || h.alarmJammed > 0) && <div className={`combat-security ${h.alarmActive ? 'tracking' : ''}`}>
        <small>{h.alarmJammed > 0 ? 'CARTER CIPHER / IFF MASK' : h.alarmActive ? 'HYDRA SEARCH NETWORK' : 'SEARCHLIGHT EXPOSURE'}</small>
        <b>{h.alarmJammed > 0 ? `${Math.ceil(h.alarmJammed)}s / IDENTITY HIDDEN` : h.alarmActive ? 'SPOTLIGHTS TRACKING YOU' : 'LEAVE THE BEAM'}</b>
        <div><span style={{ width: `${h.alarmActive ? 100 : Math.min(100, h.alarmExposure * 100)}%` }}/></div>
        {h.responseRemaining > 0 && <span>{h.responseRemaining} TROOPS / LOADING RESERVES</span>}
      </div>}
      {h.siegeActive && <div className="combat-warning">HYDRA COUNTER-ASSAULT <span>HOLD THE PERIMETER</span></div>}
      {h.storyTitle && <aside className={`combat-transmission ${storyExpanded ? 'expanded' : ''}`} aria-label="Mission transmission">
        <button onClick={() => { setDismissedStory(storyExpanded ? h.storyTitle : ''); setOpenedStory(storyExpanded ? '' : h.storyTitle); }}><span>{h.storyChannel}</span><b>{storyExpanded ? '-' : '+'}</b></button>
        {storyExpanded && <><strong>{h.storyTitle}</strong><p>{h.storyText}</p></>}
      </aside>}
    </div>
    {/* ONE COLUMN, NOT TWO ABSOLUTE BOXES: the kit used to be pinned at bottom: 164px
        while the vitals grew upward from bottom: 25px, so on any viewport where the vitals
        block is taller than 139 px the KIT chip landed on the health bar. */}
    <div className="combat-bottom-left">
        {/* THE KIT: a real inventory, grouped the way it is packed, not a row of numbers */}
      <div className={`combat-inventory ${invOpen ? 'open' : ''}`}>
        <button className="inv-toggle" onClick={() => setInvOpen(v => !v)} title="Kit / I">
          <kbd>I</kbd><span>KIT</span>
        </button>
        {invOpen && (
          <div className="inv-panel">
            <header>
              <b>OPERATIVE LOADOUT</b>
              <span>SECTOR {h.sector} · {h.sectorName}</span>
            </header>
            <div className="inv-groups">
              {(h.inventory || []).map(group => (
                <section key={group.group}>
                  <h4>{group.group}</h4>
                  <ul>
                    {group.items.map((it, i) => {
                      const selectable = group.group === 'PRIMARY';
                      const isCurrent = selectable && it.tone === 'active';
                      return (
                        <li key={`${group.group}-${i}`}
                          className={`tone-${it.tone} ${isCurrent ? 'is-current' : ''} ${selectable ? 'is-pick' : ''}`}
                          onClick={selectable ? () => (isCurrent ? p.onReload() : p.onWeapon(it.label)) : undefined}
                          title={selectable
                            ? (isCurrent ? `Reload ${it.label} from reserve — R also works` : `Shoulder ${it.label} — number keys also work`)
                            : undefined}>
                          <span>{it.label}</span>
                          <b>{it.detail}</b>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <footer>
              <span>HEALTH {h.hp}/{h.maxHp}</span>
              <span>ARMOR {h.shieldHp}</span>
              <span>FRAGS {h.grenades}</span>
              <span>{h.frostwing ? 'FROSTWING CLEARANCE' : 'NO SPECIAL CLEARANCE'}</span>
              <span className="inv-hint">1-7 SHOULDER · R RELOAD · I CLOSE</span>
            </footer>
          </div>
        )}
      </div>
      <div className="combat-bottom-vitals"><div className="combat-vitals-title"><b>{vehicleName}</b><span>{Math.ceil(hp)} / {max}</span></div><div className="combat-health" role="meter" aria-label={vehicle ? 'Vehicle hull integrity' : 'Health'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}><div className={hp / max < 0.3 ? 'critical' : ''} style={{ width: `${Math.max(0, hp / max) * 100}%` }}/></div>
      <div className="combat-armor"><span>{vehicle && !h.driving ? `FUEL ${Math.ceil(h.vehicleFuel)}%` : `ARMOR ${h.shieldHp}`}</span><span>{h.tank ? 'LMB / MAIN GUN' : vehicle ? 'LMB / MOUNTED CANNON' : `${h.weapon} / ${h.ammo < 0 ? 'UNLIMITED' : h.ammo}`}</span></div>
      {!vehicle && h.shieldMax > 0 && <div className="combat-armor-bar"><div style={{ width: `${h.shieldHp / h.shieldMax * 100}%` }}/></div>}
      <div className="combat-intel"><small>INTERCEPTED COMMS</small><p>{h.aiTactic}</p><span>{h.trucksActive} TRANSPORTS <i>/</i> {h.helisActive + h.airTransports} AIRCRAFT</span></div>
    </div>
    </div>
    <div className="combat-action-area">
      {h.nearPrompt && <div className="combat-interact-hint">{h.nearPrompt}</div>}
      {h.gatePrompt && <div className="combat-gate-hint">{h.gatePrompt}</div>}
      <div className="combat-action-buttons">
        {!vehicle && <button onPointerDown={e => { e.preventDefault(); p.onDash(); }} className={h.dashPct < 1 ? 'cooling' : ''}><kbd>SPACE</kbd><span>DASH</span><div style={{ transform: `scaleX(${h.dashPct})` }}/></button>}
        {!h.driving && <button onClick={p.onSecondary}><kbd>G</kbd><span>{h.flyingPlane ? 'BOMBS' : h.piloting ? 'ROCKETS' : `FRAG ${h.grenades}`}</span></button>}
        <button onClick={p.onAegis} disabled={h.aegisCharges === 0 && h.aegisTime <= 0} className={h.aegisTime > 0 ? 'aegis-active' : ''}><kbd>C</kbd><span>{h.aegisTime > 0 ? `${h.aegisTime.toFixed(1)} SEC` : `AEGIS ${h.aegisCharges}`}</span></button>
        {h.nearPrompt && <button onClick={p.onUse} className="context-action"><kbd>F</kbd><span>{vehicle ? 'EXIT' : 'USE'}</span></button>}
        {h.gatePrompt && <button onClick={p.onGate} className="context-action"><kbd>L</kbd><span>LOCK</span></button>}
      </div>
    </div>
  </div>;
}