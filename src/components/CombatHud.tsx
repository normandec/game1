import { useState } from 'react';
import type { Hud } from '../game/engine';

interface Props {
  hud: Hud; best: number; muted: boolean;
  onPause: () => void; onMute: () => void; onUse: () => void;
  onGate: () => void; onAegis: () => void; onGuide: () => void;
  onDash: () => void; onSecondary: () => void;
}

export default function CombatHud(p: Props) {
  const h = p.hud;
  const [dismissedStory, setDismissedStory] = useState('');
  const [openedStory, setOpenedStory] = useState('');
  const storyExpanded = dismissedStory !== h.storyTitle && (h.storyTime > 0 || openedStory === h.storyTitle);
  const vehicle = h.flyingPlane || h.piloting || h.driving;
  const hp = vehicle ? h.vehicleHp : h.hp, max = vehicle ? h.vehicleMax : h.maxHp;
  const vehicleName = h.flyingPlane ? 'NIGHTJAR' : h.piloting ? 'KESTREL' : h.driving ? 'HYDRA TRANSPORT' : 'OPERATIVE';
  return <div className="combat-hud">
    <header className="combat-top"><div className="combat-score"><small>OPERATION IRON VEIL</small><strong>{h.score.toLocaleString()}</strong><span>BEST {p.best.toLocaleString()}</span></div><div className="combat-sector"><small>SECTOR {h.sector} / 05</small><b>{h.sectorName}</b><span>WAVE {String(h.wave).padStart(2, '0')} <i>/</i> {h.enemiesLeft} HOSTILES</span></div><div className="combat-settings"><button onClick={p.onMute} aria-label={p.muted ? 'Enable sound' : 'Mute sound'}>{p.muted ? 'SOUND OFF' : 'SOUND ON'}</button><button onClick={p.onPause} aria-label="Pause game">II <kbd>ESC</kbd></button></div></header>
    {h.blackoutHud && <div className="combat-blackout"><b>NIGHT</b><span>HEADLAMPS INBOUND</span></div>}
    <div className="combat-objective"><small>PRIMARY OBJECTIVE</small><p>{h.objective}</p><span>MAINFRAMES {h.serversTotal - h.serversLeft}/{h.serversTotal} <i>/</i> {h.generalShield ? 'COMMAND SHIELDED' : 'GENERAL EXPOSED'}</span></div>
    <div className="combat-position"><span>{h.coords}</span><button onClick={p.onGuide} title="Toggle guide to the concealed vault entrance">VAULT GUIDE <kbd>V</kbd></button></div>
    {h.facilityLabel && <div className={`combat-facility ${h.facilityStatus.startsWith('SECURED') ? 'secured' : ''}`}><small>LOCAL INSTALLATION</small><b>{h.facilityLabel}</b><span>{h.facilityStatus}</span></div>}
    {(h.alarmActive || h.alarmExposure > 0.05 || h.alarmJammed > 0) && <div className={`combat-security ${h.alarmActive ? 'tracking' : ''}`}>
      <small>{h.alarmJammed > 0 ? 'CARTER CIPHER / IFF MASK' : h.alarmActive ? 'HYDRA SEARCH NETWORK' : 'SEARCHLIGHT EXPOSURE'}</small>
      <b>{h.alarmJammed > 0 ? `${Math.ceil(h.alarmJammed)}s / IDENTITY HIDDEN` : h.alarmActive ? 'SPOTLIGHTS TRACKING YOU' : 'LEAVE THE BEAM'}</b>
      <div><span style={{ width: `${h.alarmActive ? 100 : Math.min(100, h.alarmExposure * 100)}%` }}/></div>
      {h.responseRemaining > 0 && <span>{h.responseRemaining} TROOPS / LOADING RESERVES</span>}
    </div>}
    {h.bannerT > 0 && <div key={`${h.wave}${h.banner}`} className="combat-banner" style={{ opacity: Math.min(1, h.bannerT * 2) }}><strong>{h.banner}</strong><span>{h.bannerSub}</span></div>}
    {h.overrideActive && <div className="combat-override"><small>BASE NETWORK OVERRIDE</small><b>{h.overrideBase}</b><div><span style={{ width: `${h.overrideProgress}%` }}/></div><strong>{h.overrideProgress}%</strong><p>HOLD WITHIN 205m OF THE UPLINK / QRF ACTIVE</p></div>}
    {h.mult > 1 && <div className="combat-combo">x{h.mult}<span>{h.streak} KILL CHAIN</span></div>}
    <div className="combat-bottom-vitals"><div className="combat-vitals-title"><b>{vehicleName}</b><span>{Math.ceil(hp)} / {max}</span></div><div className="combat-health" role="meter" aria-label={vehicle ? 'Vehicle hull integrity' : 'Health'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}><div className={hp / max < 0.3 ? 'critical' : ''} style={{ width: `${Math.max(0, hp / max) * 100}%` }}/></div>
      <div className="combat-armor"><span>{vehicle && !h.driving ? `FUEL ${Math.ceil(h.vehicleFuel)}%` : `ARMOR ${h.shieldHp}`}</span><span>{vehicle ? 'LMB / MOUNTED CANNON' : `${h.weapon} / ${h.ammo < 0 ? 'UNLIMITED' : h.ammo}`}</span></div>
      {!vehicle && h.shieldMax > 0 && <div className="combat-armor-bar"><div style={{ width: `${h.shieldHp / h.shieldMax * 100}%` }}/></div>}
      <div className="combat-intel"><small>INTERCEPTED COMMS</small><p>{h.aiTactic}</p><span>{h.trucksActive} TRANSPORTS <i>/</i> {h.helisActive + h.airTransports} AIRCRAFT</span></div>
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
    {h.siegeActive && <div className="combat-warning">HYDRA COUNTER-ASSAULT <span>HOLD THE PERIMETER</span></div>}
    {h.storyTitle && <aside className={`combat-transmission ${storyExpanded ? 'expanded' : ''}`} aria-label="Mission transmission">
      <button onClick={() => { setDismissedStory(storyExpanded ? h.storyTitle : ''); setOpenedStory(storyExpanded ? '' : h.storyTitle); }}><span>{h.storyChannel}</span><b>{storyExpanded ? '-' : '+'}</b></button>
      {storyExpanded && <><strong>{h.storyTitle}</strong><p>{h.storyText}</p></>}
    </aside>}
  </div>;
}