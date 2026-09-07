import { useState } from 'react';
import { CLASSES, SUPPORTS } from '../game/engine';
import type { ScoreEntry } from '../game/scores';
import { PHASE_STORY, PROLOGUE } from '../game/campaign';

interface Props {
  onStart: () => void; onTour: () => void;
  scores: ScoreEntry[]; name: string; setName: (v: string) => void;
  cls: string; setCls: (v: string) => void; support: string; setSupport: (v: string) => void;
}

export function ShieldMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.2"/><path d="M17 16h30v19c0 9-15 16-15 16s-15-7-15-16V16Z" fill="currentColor" fillOpacity=".1" stroke="currentColor"/><path d="m32 21 4 8 10-4-5 8-7 2v9l-2 3-2-3v-9l-7-2-5-8 10 4 4-8Z" fill="currentColor"/></svg>;
}

export default function OperationsMenu(p: Props) {
  const [tab, setTab] = useState('operation');
  return <div className="operations-menu">
    <header className="operations-header"><div className="operations-emblem"><ShieldMark/><span>S.H.I.E.L.D.<small>STRATEGIC OPERATIONS DIVISION</small></span></div><span className="operations-build">CLASSIFIED <b>LEVEL 07</b></span></header>
    <nav className="operations-tabs" aria-label="Main menu">{[['operation', 'OPERATION'], ['loadout', 'LOADOUT'], ['intel', 'FIELD INTEL'], ['story', 'DOSSIER'], ['records', 'SERVICE RECORD']].map(([key, text]) => <button className={tab === key ? 'selected' : ''} onClick={() => setTab(key)} key={key}>{text}</button>)}</nav>
    {tab === 'operation' ? <main className="operation-hero">
      <div className="operation-eyebrow"><span/> OPERATION BLACK VAULT</div>
      <h1>IRON<span>VEIL</span><i>TACTICAL CAMPAIGN</i></h1>
      <h2>They took our bases.<br/>Take them back.</h2>
      <p>Five HYDRA strongholds. One S.H.I.E.L.D. operative.<br className="desktop-break"/> Reclaim the technology. Break the chain of command.</p>
      <div className="operation-cta"><button className="deploy-button" onClick={p.onStart}>DEPLOY OPERATIVE <span>&#8599;</span></button><button className="tour-button" onClick={p.onTour}>EXPLORE THE VAULT <span>3D TOUR</span></button></div>
      <div className="operation-keyhint"><kbd>ENTER</kbd> TO DEPLOY <span>/</span> {p.cls.toUpperCase()} + {p.support.toUpperCase()}</div>
    </main> : <section className="operation-panel">
      <div className="operation-panel-heading"><small>PERSONNEL TERMINAL / 07</small><h2>{tab === 'loadout' ? 'Prepare for insertion.' : tab === 'intel' ? 'Know the battlefield.' : tab === 'story' ? 'The occupied network.' : 'Your service record.'}</h2></div>
      {tab === 'loadout' && <>
        <label className="operation-callsign">OPERATIVE CALLSIGN<input value={p.name} placeholder="OPERATIVE" maxLength={12} onChange={e => p.setName(e.target.value.toUpperCase())}/></label>
        <h3>STARTING LOADOUT</h3><div className="loadout-options">{CLASSES.map((c, i) => <button className={p.cls === c.id ? 'active' : ''} onClick={() => p.setCls(c.id)} key={c.id}><small>0{i + 1}</small><strong>{c.name}</strong><span>{c.desc}</span></button>)}</div>
        <h3>MISSION SUPPORT</h3><div className="support-options">{SUPPORTS.map(s => <button className={p.support === s.id ? 'active' : ''} onClick={() => p.setSupport(s.id)} key={s.id}><strong>{s.name}</strong><span>{s.desc}</span></button>)}</div>
        <button className="deploy-button" onClick={p.onStart}>DEPLOY WITH THIS LOADOUT <span>&#8599;</span></button>
      </>}
      {tab === 'intel' && <div className="field-intel">
        <div><h3>BLACK VAULT / EXACT ENTRANCE</h3><p>The concealed north hatch is at <b>X 980 / Y 7040</b>, in the southwest. From insertion at X 6000 / Y 6800, travel west, then slightly south. Approach on foot and press <kbd>F</kbd>. Press <kbd>V</kbd> in the field for an optional guide to the hatch. Coordinates are on the HUD.</p><p>Inside: a full 3D S.H.I.E.L.D. hangar, aircraft requisitions, supplies, medical support and the Carter archive. Return to surface restores the same battlefield.</p></div>
        <div className="intel-controls">{[['WASD', 'Move / drive / fly'], ['MOUSE', 'Aim / hold left click to fire'], ['F', 'Enter, seize or exit vehicles and vault'], ['L', 'Seal or unlock the nearest hydraulic gate'], ['C', 'Use one AEGIS cell: 3 seconds, forward arc'], ['G / RMB', 'Frag, gunship rockets or bomber payload'], ['SPACE', 'Combat dash'], ['ESC / P', 'Pause the operation']].map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div>
        <div><h3>HYDRA DOES NOT TELEPORT</h3><p>Troops board transports in the motor pool, follow roads, slow down and dismount near your position. Seal a gate to redirect the column. Aircraft depart and return to assigned hangars. Destroy crates for supplies; some contain single-use AEGIS cells.</p></div>
        <div><h3>SEARCHLIGHTS / QUICK REACTION FORCES</h3><p>Stand in a visible searchlight cone and every online reflector switches to tracking. Five vans bring a total of <b>30 soldiers</b>. The first intrusion into the main base or the hangar district triggers <b>8 vans carrying 8 soldiers each</b>. These alarms are latched per location, not repeated every frame. Hiding behind cover breaks tracking, but does not cancel a convoy already sent.</p></div>
        <div><h3>AIRLIFT / STRUCTURAL BREACHES</h3><p><b>ATLAS</b> cargo planes deploy parachute troops. Twin-rotor <b>MANTIS</b> helicopters hover while infantry descends on two ropes. Rockets and bombs can break fortifications in sections, including blast doors. New openings are real routes for vehicles and infantry.</p></div>
        <div><h3>HELIOS / THE NIGHT PROTOCOL</h3><p>The sector's power flows from <b>HELIOS at X 7300 / Y 3400</b>: six turbine generators and four armored server blocks, defended by fixed machine guns, an elite garrison and two marching patrols. Destroy all ten cells and the grid collapses — searchlights, radar and warehouse floods go dark. HYDRA switches to helmet lamps and deploys two hunting columns toward your last position.</p></div>
        <div><h3>GOLIATH / MNEMOSYNE</h3><p>The enlarged warehouse fortress at <b>X 2800 / Y 4520</b> feeds HYDRA's reserves from four mega-storage halls filled with oversized cargo: Tesseract shielding, a heavy M79 crate, DMR armor-piercing rounds, AEGIS cells, nano-stims and a rocket arsenal. Goliath and Kraken both field marching row patrols. The unlisted Mnemosyne Library is farther north.</p></div>
        <div><h3>FIELD EXPANSION / SIX INSTALLATION CLASSES</h3><p>Explore defended installations throughout each sector. Laboratory, workshop and armory roofs reveal their interiors as you approach an entrance. Wide hydraulic gates preserve convoy routes. Clear a garrison to secure its supplies and earn a one-time score bonus.</p>
          <dl className="installation-intel">{[
            ['CP', 'SECURITY CHECKPOINT', 'Searchlights, sandbag lanes, guard booths and shield teams.'],
            ['BIO', 'BIORESEARCH LAB', 'Glass containment chambers, examination rooms and medical support.'],
            ['SIG', 'SIGNALS STATION', 'Rotating radar dish, communications racks and long-range sentries.'],
            ['MTR', 'ARMORED WORKSHOP', 'Vehicle lifts, repair benches, spare parts and heavy infantry.'],
            ['PWR', 'POWER SUBSTATION', 'Transformers, cooling tanks, power conduits and sapper patrols.'],
            ['ARM', 'MUNITIONS BUNKER', 'Weapon racks, ammunition stores and reinforced blast walls.'],
          ].map(([code, name, detail]) => <div key={code}><dt><span>{code}</span>{name}</dt><dd>{detail}</dd></div>)}</dl>
          <p><b>New contacts:</b> Wardens hold the entrance behind ballistic shields. Pathfinders patrol the perimeter and move around your flank. Officers coordinate each post; medics support their own team. Expect four to eight attacking fireteams per wave, plus the local garrisons.</p>
        </div>
      </div>}
      {tab === 'story' && <div className="field-intel dossier-entries">{[PROLOGUE, ...Object.values(PHASE_STORY)].map(s => <article key={s.id}><small>{s.channel}</small><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>}
      {tab === 'records' && <div className="service-records"><div className="record-head"><span>RANK / CALLSIGN</span><span>WAVE</span><span>SCORE</span></div>{p.scores.length ? p.scores.map((s, i) => <div className="record-line" key={`${s.date}-${i}`}><span><small>{String(i + 1).padStart(2, '0')}</small>{s.name}</span><span>{s.wave}</span><strong>{s.score.toLocaleString()}</strong></div>) : <p>No records yet. Complete an operation to register your callsign.</p>}<small className="records-note">Stored on this device. Campaign scores are saved at defeat or final victory.</small></div>}
    </section>}
    <footer className="operations-footer"><div><span className="secure-dot"/> SECURE CHANNEL ESTABLISHED</div><span>FIVE SECTORS <i>/</i> NO CAMERA SHAKE <i>/</i> KEYBOARD + TOUCH</span><small>IRON VEIL / NIGHTFALL PROTOCOL</small></footer>
  </div>;
}