/**
 * THE CAMPAIGN DIRECTIVE — shown once, the first time the game is ever opened.
 *
 * The report from the last round was blunt about it: a player can finish a sector and still
 * not know what actually ended it, and the last level has no general in it at all. So the
 * first thing the game ever says is the win condition, in two lines:
 *
 *   every sector — destroy the commanding general;
 *   the last level — destroy the CAGE command core.
 *
 * It is stored in localStorage so it is a genuine once-per-machine card: returning players
 * go straight to the map, and the same rules are repeated on the deploy card and on the HUD
 * (the PRIMARY OBJECTIVE block names the target and meters its health).
 */
interface Props {
  onDismiss: () => void;
}

export default function CampaignDirective({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#03080bee] p-4 font-mono">
      <div className="w-full max-w-2xl border border-teal-300/30 bg-[#050f14f2] p-7 shadow-[0_30px_120px_#000]">
        <p className="text-[10px] tracking-[0.55em] text-teal-300/70">CAMPAIGN DIRECTIVE · READ ONCE</p>
        <h1 className="mt-2 text-3xl font-black tracking-[0.18em] text-[#e6fbff]">WHAT WINNING MEANS</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-teal-100/60">
          You are not here to hold ground. Every level ends when one specific thing stops existing.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <section className="border-l-2 border-teal-300/60 bg-[#0a1a20cc] p-4">
            <p className="text-[9px] tracking-[0.4em] text-teal-300/70">SECTORS 1 – 6</p>
            <h2 className="mt-1 text-[15px] font-bold tracking-[0.14em] text-[#dff8ff]">DESTROY THE GENERAL</h2>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-teal-100/75">
              <li>· Each Hydra sector is commanded by one <b className="text-[#bfe9ff]">supreme general</b>.</li>
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
          onClick={onDismiss}
          className="mt-5 w-full border border-teal-300/50 bg-teal-400/10 px-6 py-3 text-[12px] font-bold tracking-[0.35em] text-[#dff8ff] transition hover:bg-teal-400/20"
        >
          UNDERSTOOD — TO THE MAP
        </button>
        <p className="mt-2 text-center text-[9px] tracking-[0.3em] text-teal-100/30">
          SHOWN ONCE · THE SAME RULES ARE ON THE DEPLOY CARD AND THE HUD
        </p>
      </div>
    </div>
  );
}
