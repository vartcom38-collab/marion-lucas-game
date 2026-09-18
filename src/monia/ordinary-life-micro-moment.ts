import './ordinary-life-micro-moment.css';
import type { OrdinaryLifeBeat } from './ordinary-life-variety';
import { getLucasPresence } from './lucas-presence-engine';

let timer=0;
function clean(){document.querySelector('.moniaOrdinaryMicroMoment')?.remove();if(timer)window.clearTimeout(timer);document.getElementById('homePhotoStage')?.classList.remove('ordinary-moment-active','ordinary-moment-quiet','ordinary-moment-practical','ordinary-moment-self','ordinary-moment-social','ordinary-moment-couple','ordinary-moment-outing')}
function phrase(beat:OrdinaryLifeBeat){
 const id=beat.id.replace(/^ordinary-(quiet|practical|self|social|couple|outing)-/,'');
 const map:Record<string,string>={
  'tea-window':'La pièce continue de vivre autour de moi.','read-few-pages':'Quelques minutes passent sans urgence.','music-floor':'La musique prend doucement sa place.','balcony-air':'Un peu d’air, juste quelques instants.','late-sofa':'Je me pose sans chercher à remplir le silence.',
  'kitchen-reset':'Je remets machinalement deux ou trois choses en place.','water-plants':'Un geste simple, presque automatique.','shared-coffee':'Lucas reste là, tout près, pendant que le moment s’installe.','small-touch':'Un contact bref, naturel, sans interrompre ce qu’on faisait.','quiet-kitchen':'On reste dans la cuisine sans avoir besoin d’en faire une scène.','brief-checkin':'Quelques mots entre nous, simplement.','same-room-silence':'On partage le même silence, chacun dans son rythme.',
  'short-walk':'Je change d’air quelques minutes.','sunset-step-out':'Je sors juste un moment avant que la lumière tombe.'
 };
 return map[id]||({quiet:'Un petit moment calme passe.',practical:'Je m’occupe d’un détail du quotidien.',self:'Je prends quelques minutes pour moi.',social:'Un petit lien avec l’extérieur.',couple:'Un moment simple avec Lucas.',outing:'Je bouge un peu, sans programme.'}[beat.kind]);
}
function show(beat:OrdinaryLifeBeat){
 clean();if(beat.kind==='couple'&&getLucasPresence()?.together!==true)return;const stage=document.getElementById('homePhotoStage');if(!(stage instanceof HTMLElement))return;
 const root=document.createElement('div');root.className=`moniaOrdinaryMicroMoment kind-${beat.kind}`;root.setAttribute('aria-live','polite');root.dataset.beat=beat.id;
 const text=document.createElement('span');text.textContent=phrase(beat);root.appendChild(text);stage.appendChild(root);
 stage.classList.add('ordinary-moment-active',`ordinary-moment-${beat.kind}`);window.dispatchEvent(new CustomEvent('monia:ordinary-life-world-reaction',{detail:{beat,stage:'home',duration:2600}}));window.requestAnimationFrame(()=>root.classList.add('is-visible'));
 timer=window.setTimeout(()=>{root.classList.remove('is-visible');stage.classList.remove('ordinary-moment-active',`ordinary-moment-${beat.kind}`);window.setTimeout(()=>root.remove(),420)},2600);
}
window.addEventListener('monia:save-changed',()=>{if(document.querySelector('.modal,.overlay.show,[data-open="true"].phoneDevice,.surprisePlayer,.cinematicOverlay'))clean()});
window.addEventListener('monia:ordinary-life-consumed',((event:CustomEvent<{beat?:OrdinaryLifeBeat}>)=>{if(event.detail?.beat)show(event.detail.beat)}) as EventListener);
