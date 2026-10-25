import { useState } from 'react';
import { CLASSES, SUPPORTS } from '../game/engine';
import { SECTORS } from '../game/world';
import type { ScoreEntry } from '../game/scores';
import { PHASE_STORY, PROLOGUE } from '../game/campaign';
import { BUILD_STAMP, GAME_VERSION, VERSION_LABEL } from '../game/version';

interface Props {
  onStart: () => void; onTour: () => void;
  scores: ScoreEntry[]; name: string; setName: (v: string) => void;
  cls: string; setCls: (v: string) => void; support: string; setSupport: (v: string) => void;
  fullscreen: boolean; onFullscreen: () => void;
  /** DEVELOPER CONSOLE: start a run on chosen ground, optionally without the risk of dying. */
  onDevDeploy: (sector: number, infiniteLives: boolean) => void;
}

export function ShieldMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.2"/><path d="M17 16h30v19c0 9-15 16-15 16s-15-7-15-16V16Z" fill="currentColor" fillOpacity=".1" stroke="currentColor"/><path d="m32 21 4 8 10-4-5 8-7 2v9l-2 3-2-3v-9l-7-2-5-8 10 4 4-8Z" fill="currentColor"/></svg>;
}

export default function OperationsMenu(p: Props) {
  const [tab, setTab] = useState('operation');
  const [dev, setDev] = useState(false);
  const [devSector, setDevSector] = useState(1);
  const [devLives, setDevLives] = useState(false);
  return <div className="operations-menu">
    <header className="operations-header"><div className="operations-emblem"><ShieldMark/><span>S.H.I.E.L.D.<small>STRATEGIC OPERATIONS DIVISION</small></span></div><span className="operations-build">CLASSIFIED <b>LEVEL 07</b>
      <em className="operations-version">{VERSION_LABEL}</em>
      <span className="operations-tools">
        <button type="button" className="screen-tool" onClick={p.onFullscreen}
          aria-label={p.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={p.fullscreen ? 'Leave fullscreen' : 'Play fullscreen'}>
          <span aria-hidden="true">{p.fullscreen ? '\u2715' : '\u26F6'}</span>{p.fullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
        </button>
        <button type="button" className={`screen-tool dev-tool${dev ? ' active' : ''}`} onClick={() => setDev(v => !v)}
          aria-expanded={dev} aria-label="Developer console" title="Developer console — insertion sector and infinite lives">
          <span aria-hidden="true">{'\u26A1'}</span>DEV
        </button>
      </span></span></header>
    <nav className="operations-tabs" aria-label="Main menu">{[['operation', 'OPERATION'], ['loadout', 'LOADOUT'], ['intel', 'FIELD INTEL'], ['story', 'DOSSIER'], ['records', 'SERVICE RECORD']].map(([key, text]) => <button className={tab === key ? 'selected' : ''} onClick={() => setTab(key)} key={key}>{text}</button>)}</nav>
    {tab === 'operation' ? <main className="operation-hero">
      <div className="operation-eyebrow"><span/> OPERATION BLACK VAULT <i className="operation-version">BUILD {VERSION_LABEL}</i></div>
      <h1>PROTOCOL<span>SOLAR ECLIPSE</span><i>TACTICAL CAMPAIGN</i></h1>
      <h2>They took our bases.<br/>Take them back.</h2>
      <p>Six command strongholds. One S.H.I.E.L.D. operative.<br className="desktop-break"/> Reclaim the technology. Break the chain of command.</p>
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
        <div className="field-intel" style={{ marginTop: 0 }}><div>
        <h3>INTERCEPTOR / COCKPIT SYSTEMS</h3>
        <p><b>THE FIGHT.</b> Hold <kbd>F</kbd> at a parked jet to take it. The nose follows the mouse; <kbd>W</kbd>/<kbd>S</kbd> throttle, <kbd>A</kbd>/<kbd>D</kbd> roll into a turn, <kbd>SHIFT</kbd> lights the burner. <b>The cannon overheats</b> — the tape on the left of the glass climbs while the trigger is held, and at 100% the barrels <b>jam</b> for a couple of seconds. Everything else, in order of how much noise it makes:</p>
        <p><b><kbd>LMB</kbd> cannon</b> · <b><kbd>G</kbd> air-to-air missile</b> at whatever the seeker box is holding (a lead pipper shows where it will actually be) · <b><kbd>H</kbd> six-rocket salvo</b> out of the wing pods, for ground targets · <b><kbd>R</kbd> the lance</b> — hold to wind the capacitor, and a piercing beam of cold light cuts 2,6 km down the nose (prototype and Frostwing only) · <b><kbd>SPACE</kbd> flares</b> — they spoof inbound missiles and make the airframe much harder to hit for as long as they burn · <kbd>V</kbd> camera cycles chase, wide tactical and close gun camera · <b><kbd>E</kbd> autopilot</b> circles the lock; <kbd>F</kbd> ejects.</p>
      </div><div>
        <h3>THE OPPOSITION</h3>
        <p><b>HUNTER WAVES.</b> Every strafing pass, missile or salvo heats the air-defence net. Two to six hunters are vectored onto you — line interceptors in dark olive with HYDRA-red bands, and every third wave a <b>squadron ace</b>: a bigger airframe with gold stripes over the wings, 900 hull, tighter gun bursts and two more missiles. They <b>lead their guns</b> and <b>break hard</b> the moment your nose is on them, so a head-on pass is their fight, not yours. Watch the red frame around the screen: <b>MISSILE INBOUND</b> means a real one is on the rails behind you.</p>
        <p>Kill them for points and feel the difference between the airframes: the <b>line interceptor</b> is fast and cheap to lose, the <b>prototype</b> carries the lance and 2 400 m/s, the <b>Frostwing</b> out-turns both and hits harder with its ice cannon.</p>
      </div></div>
      <div className="intel-controls">{[['WASD', 'Move / drive / fly'], ['MOUSE', 'Aim / hold left click to fire'], ['F', 'Enter, seize or exit vehicles and vault'], ['L', 'Seal or unlock the nearest hydraulic gate'], ['C', 'Use one AEGIS cell: 3 seconds, forward arc'], ['G / RMB', 'Frag, gunship rockets or bomber payload'], ['1 / 2 / 3', 'Gunship station: chain gun, Hellfire (ground), Sidewinder (air)'], ['SPACE', 'Combat dash'], ['ESC / P', 'Pause the operation']].map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div>
        <p><b>THE GLACIER VAULT / ARCTIC RELAY.</b> The ice wall in sector 3 is a door, not rock: a lit forecourt cut into the mountain at <b>X 10690 / Y 9800</b>, with a lamp over the bulkhead and a concrete apron in front of it. Walk in and press <kbd>F</kbd>. Inside: a thousand-year-old cavern with a base built into it — two aircraft wells, a hangar gantry, an ice guard battalion, a frozen S.H.I.E.L.D. platoon that falls in behind you, and the <b>FROSTWING</b>. Take it and the hall becomes a runway: the gate leaves sink into the ice, the interceptor runs the length of the vault and out into the daylight, and it is parked beside the gate when you get back outside — <b>900 hull, 2.2 km/s, twenty flares, an ice seeker that reaches 3 200 m</b>. Press <kbd>F</kbd> at it to fly it out over the shelf.</p>
        <div><h3>HYDRA DOES NOT TELEPORT</h3><p>Troops board transports in the motor pool, follow roads, slow down and dismount near your position. Seal a gate to redirect the column. Aircraft depart and return to assigned hangars. Destroy crates for supplies; some contain single-use AEGIS cells.</p></div>
        <div><h3>SEARCHLIGHTS / QUICK REACTION FORCES</h3><p>Stand in a visible searchlight cone and every online reflector switches to tracking. Five vans bring a total of <b>30 soldiers</b>. The first intrusion into the main base or the hangar district triggers <b>8 vans carrying 8 soldiers each</b>. These alarms are latched per location, not repeated every frame. Hiding behind cover breaks tracking, but does not cancel a convoy already sent.</p></div>
        <div><h3>AIRLIFT / STRUCTURAL BREACHES</h3><p><b>IRON RESERVE / VOJSKA.</b> The sixth sector is new ground south of everything you have already fought over: a motorised army base held by a thousand men in ranks. <b>Crossing the wall trips the general alarm</b> — the parade stands up in waves, four hulls roll out of the armour park, attack helicopters lift off their pads and fast jets scramble. Any first shot inside the wire wakes the whole base too. The inner blast gate is powered by two generators in the compound: destroy both and the shutter drops. <b>Twin-gun emplacements</b> cover the ground and the air — suppress the crew, then press <kbd>F</kbd> on the pit and the guns work for you.</p>
<p><b>THE BASE ITSELF.</b> Twenty-two named positions, each built differently: a causeway checkpoint, a field-artillery line, an air-defence battery, a signals array, a field hospital, an ammunition depot, a provost post, the 1st Armoured Battalion's park — <b>a hundred and one hulls</b> nose-to-tail — a boneyard, an engineer yard, a combined-arms range, a railhead, a drone hangar, a silo field, an experimental test rig, a cooling plant, the air park, a fuel farm, a forward magazine, two battalion barracks and the command bunker. Every one is held by its own garrison. Once the alarm is up the armour comes in waves: eight to ten hulls every six seconds, thirty-four alive at once.</p>
<p><b>SEIZED INTERCEPTOR.</b> The air park fields fast jets drawn on a real fifth-generation fighter. Walk up to a parked one and press <kbd>F</kbd>: you fly it, and while you do, the sky is yours — nothing else in the army gets off the ground. <b>Hold SHIFT for the afterburner</b>: the interceptor goes from six hundred to seventeen hundred and fifty.</p>
<p><b>THE SOFT SIDE / TWO PROTOTYPES.</b> Not every position out here is the parade ground. Three <b>thinly held company barracks</b> (two men awake, a stove, a supply cache and no heavy weapons) sit out east of the wire at roughly <b>X 16860 / Y 8940</b>, <b>X 16860 / Y 10140</b> and — inside the outer rampart, between the parade and the east barracks — at <b>X 9060 / Y 9700</b>. Beside them, two unfenced <b>forward dispersal strips</b> at <b>X 12925 / Y 8845</b> and <b>X 14925 / Y 8845</b> park spare airframes in the open. Each strip holds one of the two <b>PROTOTYPE interceptors</b>: graphite and gold, <b>1 100 hull</b>, <b>2 400 m/s on the burner</b>, a hotter twin cannon, a seeker that reaches 3 400 m and 12–16 flares. Walk up and press <kbd>F</kbd> to take one — <b>+6 500</b>. They are marked on the map from the first frame, so you can go straight there before the general staff ever hears about it.</p>
<p><b>WINTER SECTORS.</b> The Arctic Relay is fought on snow: drifts line every road, ploughed lanes cut through them, and the municipal ploughs work their rounds in real time, throwing the load onto the shoulder and piling the banks higher as you watch. Roofs, hulls and roads all carry the weather.</p>
<p><b>EVERY SECTOR HAS ITS OWN SOUTH.</b> The new ground below the old south rampart is no longer empty. The Fallen Hub has a drowned pump station, a sluice and a sunken archive; the Red Mesa a cliff fort, derricks and a refinery rail yard; the Arctic an ice station, a frozen airstrip and the glacier wall; the Venom Marsh stilt laboratories over a drowned temple; the Nexus a serpent reactor, an obelisk line and a reliquary. Each is held by that sector's own regiment.</p>
<p><b>THE CROSSING.</b> The island prison is reached over an orange suspension bridge. It is a structure, not scenery: <b>bomb the span and it falls</b>. Nothing crosses to the Cage after that — not you, not the custody officers.</p>
<p><b>GETTING OUT THE OTHER SIDE.</b> Walking out of THE CAGE is not an invasion of the island: the alarm stays cold and <b>no landing waves, no gunships and no garrison</b> come for a man on foot with a smuggled pistol. Anything already airborne breaks off and leaves. The silence holds until you are off the island — come back later and the defence answers like it always did.</p>
<p><b>ATLAS</b> cargo planes deploy parachute troops. Twin-rotor <b>MANTIS</b> helicopters hover while infantry descends on two ropes. Rockets and bombs can break fortifications in sections, including blast doors. New openings are real routes for vehicles and infantry.</p><p><b>CAPTURED GUNSHIP / THREE STATIONS.</b> The <b>chain gun</b> answers anything on the ground or in the air. <b>Hellfire</b> is ground-attack only and cannot lock or damage an aircraft. <b>Sidewinder</b> is air-to-air only, steers itself into transports, gunships and troops still on the ropes, and never rakes the ground. Switch with <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> (or <kbd>X</kbd>); the HUD shows a separate magazine for each and an air-contact lock light.</p></div>
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
    {dev && <div className="dev-console" role="dialog" aria-modal="true" aria-label="Developer console" onClick={e => { if (e.target === e.currentTarget) setDev(false); }}>
      <div className="dev-console-card">
        <header><span><i aria-hidden="true">&#9889;</i><small>DEVELOPER CONSOLE</small></span><button type="button" onClick={() => setDev(false)} aria-label="Close developer console">CLOSE &#10005;</button></header>
        <h2>Drop straight into a sector.</h2>
        <p className="dev-lead">Pick the ground, decide whether the operative can die, then deploy. Nothing here changes a normal run unless you deploy from this panel.</p>
        <div className="dev-sectors">{SECTORS.map((s, i) => <button type="button" key={s.id} className={devSector === i + 1 ? 'active' : ''} onClick={() => setDevSector(i + 1)} aria-pressed={devSector === i + 1}>
          <small>0{i + 1}</small><strong>{s.name}</strong><span>{s.codename} / {s.weather.toUpperCase()}</span>
        </button>)}</div>
        <label className="dev-lives">
          <input type="checkbox" checked={devLives} onChange={e => setDevLives(e.target.checked)} />
          <span><b>INFINITE LIVES</b><small>The operative cannot be killed: every hit still lands, but the pool never reaches zero. Off unless you tick it.</small></span>
        </label>
        <div className="dev-actions">
          <button type="button" className="deploy-button" onClick={() => p.onDevDeploy(devSector, devLives)}>
            DEPLOY TO SECTOR {devSector} <span>&#8599;</span>
          </button>
          <button type="button" className="tour-button" onClick={() => setDev(false)}>CANCEL<span>BACK TO THE MENU</span></button>
        </div>
        <p className="dev-note">SECTOR {devSector} / {SECTORS[devSector - 1].name} · {devLives ? 'INFINITE LIVES ON' : 'NORMAL RULES'} · {p.cls.toUpperCase()} + {p.support.toUpperCase()}</p>
      </div>
    </div>}
    <footer className="operations-footer"><div><span className="secure-dot"/> SECURE CHANNEL ESTABLISHED</div><span>SIX SECTORS <i>/</i> NO CAMERA SHAKE <i>/</i> KEYBOARD + TOUCH</span><small>PROTOCOL {GAME_VERSION.codename} / {BUILD_STAMP}</small></footer>
  </div>;
}