/**
 * THE CAMPAIGN DIRECTIVE — shown once, the first time the game is ever opened.
 *
 * Round 47 put the win condition on it, because a player could finish a sector and still
 * not know what had ended it. Round 48 finishes the job: knowing *what* to kill is no use
 * if you do not know *where the good things are*. So the second page is a field guide to
 * the places that matter — what each one looks like from the ground, and what you walk out
 * of it with:
 *
 *   the S.H.I.E.L.D. outpost you establish by overriding a compound,
 *   the Black Vault, the one S.H.I.E.L.D. base that never fell,
 *   the glacier vault, a base built inside a mountain in sector 3.
 *
 * It is a genuine once-per-machine card (localStorage). Returning players can re-read it
 * from the start screen, and the same facts live in FIELD INTEL on the operations menu.
 */
import { useState } from 'react';

interface Props {
  onDismiss: () => void;
  /** Which page the card opens on. Only used to render either page in a check harness. */
  initialPage?: 0 | 1;
}

/** One place: how you know you are looking at it, and what it pays. */
function Place(props: {
  tag: string; title: string; accent: string; where: string;
  know: string; get: string[];
}) {
  return (
    <section className={`border-l-2 ${props.accent} bg-[#0a161bcc] p-4`}>
      <p className="text-[9px] tracking-[0.4em] text-teal-300/60">{props.tag}</p>
      <h3 className="mt-1 text-[14px] font-bold tracking-[0.12em] text-[#e2f9ff]">{props.title}</h3>
      <p className="mt-1 text-[10px] leading-relaxed text-teal-200/55">{props.where}</p>
      <p className="mt-3 text-[9px] tracking-[0.3em] text-teal-300/60">HOW YOU KNOW IT</p>
      <p className="mt-1 text-[11px] leading-relaxed text-teal-100/80">{props.know}</p>
      <p className="mt-3 text-[9px] tracking-[0.3em] text-amber-300/60">WHAT YOU GET</p>
      <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-amber-100/80">
        {props.get.map((line) => <li key={line}>· {line}</li>)}
      </ul>
    </section>
  );
}

export default function CampaignDirective({ onDismiss, initialPage = 0 }: Props) {
  const [page, setPage] = useState<0 | 1>(initialPage);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#03080bee] p-3 font-mono sm:p-4">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto border border-teal-300/30 bg-[#050f14f5] p-5 shadow-[0_30px_120px_#000] sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] tracking-[0.55em] text-teal-300/70">CAMPAIGN DIRECTIVE · READ ONCE</p>
          <div className="flex gap-1">
            {[0, 1].map((n) => (
              <button
                key={n}
                onClick={() => setPage(n as 0 | 1)}
                aria-label={n === 0 ? 'Page one: what winning means' : 'Page two: what you will find'}
                className={`h-1.5 w-7 ${page === n ? 'bg-teal-300' : 'bg-teal-300/25'}`}
              />
            ))}
          </div>
        </div>

        {page === 0 ? (
          <>
            <h1 className="mt-2 text-2xl font-black tracking-[0.16em] text-[#e6fbff] sm:text-3xl">WHAT WINNING MEANS</h1>
            <p className="mt-2 text-[12px] leading-relaxed text-teal-100/60">
              You are not here to hold ground. Every level ends when one specific thing stops existing.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <section className="border-l-2 border-teal-300/60 bg-[#0a1a20cc] p-4">
                <p className="text-[9px] tracking-[0.4em] text-teal-300/70">SECTORS 1 – 6</p>
                <h2 className="mt-1 text-[15px] font-bold tracking-[0.14em] text-[#dff8ff]">DESTROY THE GENERAL</h2>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-teal-100/75">
                  <li>· Each sector is commanded by one <b className="text-[#bfe9ff]">supreme general</b>.</li>
                  <li>· Find him, destroy him, and the sector is yours — the next one opens.</li>
                  <li>· His health is metered under <b className="text-[#bfe9ff]">PRIMARY OBJECTIVE</b> on the HUD.</li>
                </ul>
              </section>

              <section className="border-l-2 border-amber-400/60 bg-[#1a0f0bcc] p-4">
                <p className="text-[9px] tracking-[0.4em] text-amber-300/70">LEVEL 7 · THE CAGE</p>
                <h2 className="mt-1 text-[15px] font-bold tracking-[0.14em] text-[#ffeede]">DESTROY THE COMMAND CORE</h2>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-100/75">
                  <li>· No general is left. The last target is a machine.</li>
                  <li>· It is the <b className="text-[#ffd9b0]">CAGE command core</b>, in CONTROL A of the prison.</li>
                  <li>· Shoot it down and the campaign is won — every lock in the compound opens with it.</li>
                </ul>
              </section>
            </div>

            <p className="mt-5 border-t border-teal-300/15 pt-4 text-[11px] leading-relaxed text-teal-100/55">
              Everything else — the armour, the aircraft, the stockade, the vault, the glacier — is a
              tool for reaching that target. Nothing else ends a level.
            </p>

            <button
              onClick={() => setPage(1)}
              className="mt-5 w-full border border-teal-300/50 bg-teal-400/10 px-6 py-3 text-[12px] font-bold tracking-[0.3em] text-[#dff8ff] transition hover:bg-teal-400/20"
            >
              NEXT — WHAT YOU WILL FIND &nbsp;→
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-black tracking-[0.16em] text-[#e6fbff] sm:text-3xl">WHAT YOU WILL FIND</h1>
            <p className="mt-2 text-[12px] leading-relaxed text-teal-100/60">
              Three places pay better than the ground they sit on. Each one announces itself before you
              are close enough to be shot at — learn the silhouette, not the coordinates.
            </p>

            <div className="mt-5 space-y-3">
              <Place
                tag="S.H.I.E.L.D. OUTPOST · EVERY SECTOR"
                title="THE BASE YOU TAKE BACK"
                accent="border-teal-300/60"
                where="Any named compound on the map — KRAKEN, GOLIATH, HELIOS, or a checkpoint, lab, signals station, workshop, substation or munitions bunker."
                know="A walled yard of bunker walls with four gates and a mast inside. HYDRA colours, HYDRA garrison. In the middle stands the uplink core: a lit console on a plinth, with a ring of teal light on the concrete."
                get={[
                  'Stand at the uplink core and the OVERRIDE meter fills — about thirty seconds, and it stops the moment you step away.',
                  'At 100% the yard becomes a S.H.I.E.L.D. outpost: +35 000, the garrison stands down, the gates open to you.',
                  'Four allies fall in — a medic, a heavy and two riflemen — plus six supply drops of health, shields and AEGIS cells.',
                  'Every crate, vehicle and aircraft in the yard is yours, and that base never feeds the alarm again.',
                ]}
              />

              <Place
                tag="THE BLACK VAULT · ALL SECTORS"
                title="THE BASE THAT NEVER FELL"
                accent="border-sky-300/60"
                where="North-west of insertion, hatch at roughly X 980 / Y 7040. Press V in the field and a route to it is drawn on your HUD."
                know="A low concrete lip in a plaza, an open north hatch, and a lit stair going down. No HYDRA banner, no red lamps: the lights are still white and the eagle is still on the wall."
                get={[
                  'A full S.H.I.E.L.D. hangar under the ground: aircraft requisitions, supplies, a medical bay and the Carter archive.',
                  'Walk out and the battlefield is exactly as you left it — nothing respawns while you are below.',
                  'This is where a losing run is rebuilt: take a hull, take the med bay, go back up.',
                ]}
              />

              <Place
                tag="THE GLACIER VAULT · SECTOR 3 ONLY"
                title="A BASE BUILT INSIDE A MOUNTAIN"
                accent="border-cyan-200/60"
                where="The ice station's south ground, at about X 10690 / Y 9800. Marked from the first frame with a diamond and the word ICE."
                know="The ice wall is a door, not rock: a lit lamp over a steel bulkhead, stencilled GLACIER VAULT / ENTRY, and a pulsing blue glow on the apron in front of it. Press F at the bulkhead."
                get={[
                  'A cavern base with two aircraft wells, a hangar gantry and an ice guard battalion — on foot, in 3D.',
                  'Twenty frozen 1ST WINTER SHIELD troopers wake up and fight behind you, and they will drag you back out if you fall.',
                  'The FROSTWING: 900 hull, 2.2 km/s, twenty flares, a seeker that reaches 3 200 m. Taking it pays +22 000.',
                  'Frostwing clearance is permanent: every interceptor you seize afterwards is ice-plated and faster.',
                ]}
              />
            </div>

            <p className="mt-5 border-t border-teal-300/15 pt-4 text-[11px] leading-relaxed text-teal-100/55">
              The stockade in the army district opens onto fourteen soldiers who will fight for whoever
              broke the door. Everything else in this list — and the full intel on every sector — is under
              FIELD INTEL on this menu.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setPage(0)}
                className="border border-teal-300/30 px-5 py-3 text-[11px] tracking-[0.3em] text-teal-200/70 transition hover:bg-teal-400/10"
              >
                ← WIN CONDITION
              </button>
              <button
                onClick={onDismiss}
                className="flex-1 border border-teal-300/50 bg-teal-400/10 px-6 py-3 text-[12px] font-bold tracking-[0.3em] text-[#dff8ff] transition hover:bg-teal-400/20"
              >
                UNDERSTOOD — TO THE MAP
              </button>
            </div>
          </>
        )}

        <p className="mt-3 text-center text-[9px] tracking-[0.3em] text-teal-100/30">
          SHOWN ONCE · RE-READ IT FROM THE START SCREEN · THE SAME RULES ARE ON THE HUD
        </p>
      </div>
    </div>
  );
}
