import { PROLOGUE } from '../game/campaign';
import { ShieldMark } from './OperationsMenu';

export default function OperationBriefing({ onBegin, onBack }: { onBegin: () => void; onBack: () => void }) {
  return <section className="operation-briefing" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
    <div className="briefing-document">
      <div className="briefing-stamp"><ShieldMark/><div><span>S.H.I.E.L.D.</span><small>DIRECTORATE / EYES ONLY</small></div><b>FILE 07-0317</b></div>
      <div className="briefing-classification">CLASSIFIED TRANSMISSION <span>03:17:00 ZULU</span></div>
      <small className="briefing-chapter">IRON VEIL / CAMPAIGN PROLOGUE</small>
      <h1 id="briefing-title">The night the<br/><em>badges changed.</em></h1>
      <p>{PROLOGUE.text}</p>
      <div className="briefing-orders"><span>MISSION DIRECTIVES</span><ol><li><b>01</b> Recover the five occupied command sectors.</li><li><b>02</b> Disrupt Goliath's transport and supply network.</li><li><b>03</b> Find the Mnemosyne cipher. Bring our people home.</li></ol></div>
      <div className="briefing-actions"><button className="deploy-button" onClick={onBegin}>BEGIN INSERTION <span>&#8599;</span></button><button onClick={onBack}>BACK TO OPERATIONS</button><small><kbd>ENTER</kbd> TO CONTINUE</small></div>
    </div>
    <div className="briefing-signal"><span/> VERIFIED SECURE CHANNEL <i>/</i> TRUST THE SIGNAL, NOT THE UNIFORM.</div>
  </section>;
}