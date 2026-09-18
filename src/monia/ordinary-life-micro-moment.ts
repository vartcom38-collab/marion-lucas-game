import './ordinary-life-micro-moment.css';
import type { OrdinaryLifeBeat } from './ordinary-life-variety';
import { getDominicPresence } from './lucas-presence-engine';

let timer=0,phaseTimer=0;
function clean(){document.querySelector('.moniaOrdinaryMicroMoment')?.remove();if(timer)window.clearTimeout(timer);if(phaseTimer)window.clearTimeout(phaseTimer);document.getElementById('homePhotoStage')?.classList.remove('ordinary-moment-active','ordinary-moment-quiet','ordinary-moment-practical','ordinary-moment-self','ordinary-moment-social','ordinary-moment-couple','ordinary-moment-outing','ordinary-phase-1','ordinary-phase-2','ordinary-phase-3')}
function phrases(beat:OrdinaryLifeBeat){
 const id=beat.id.replace(/^ordinary-(quiet|practical|self|social|couple|outing)-/,'');
 const map:Record<string,string[]>={
  'tea-window':['Je prends quelque chose de chaud et je reste près de la fenêtre.','La rue continue en bas pendant que la pièce reste calme.','Je finis ma tasse sans regarder l’heure.'],
  'read-few-pages':['Je m’installe avec quelques pages, juste pour voir.','Le bruit autour finit par disparaître presque complètement.','Quand je relève les yeux, plusieurs minutes ont réellement passé.'],
  'music-floor':['Je lance un morceau sans vraiment réfléchir.','La musique finit par remplir la pièce et changer un peu mon humeur.','Je reste encore jusqu’à la fin du morceau avant de reprendre ce que je faisais.'],
  'balcony-air':['J’ouvre et je sors prendre l’air.','Je reste quelques minutes à regarder la ville sans objectif particulier.','Quand je rentre, l’appartement paraît légèrement différent.'],
  'late-sofa':['Je me laisse tomber sur le canapé sans prévoir la suite.','Le téléphone reste posé à côté, silencieux pour une fois.','Je reste là encore un peu avant de bouger.'],
  'kitchen-reset':['Je commence par ranger une chose, puis une deuxième.','Je nettoie vite le plan de travail sans en faire une corvée.','La cuisine redevient calme et je passe à autre chose.'],
  'water-plants':['Je vérifie les plantes une par une.','Certaines n’ont besoin de rien, d’autres oui.','Je repose l’arrosoir et laisse ce petit geste derrière moi.'],
  'shared-coffee':['Je prépare deux cafés sans que ce soit un événement.','Dominic reste près de moi pendant qu’on échange deux ou trois mots.','On finit chacun notre tasse avant de reprendre nos occupations.'],
  'small-touch':['On se croise dans la pièce presque sans y penser.','Sa main vient brièvement contre la mienne ou dans mon dos.','Le contact passe, simple, et la journée continue.'],
  'quiet-kitchen':['On reste tous les deux dans la cuisine sans programme précis.','Il fait quelque chose de son côté pendant que je fais autre chose.','On échange quelques mots, puis le silence revient naturellement.'],
  'brief-checkin':['Dominic s’arrête deux minutes pour me demander comment ça va.','Je lui réponds sans transformer ça en grande conversation.','On se sourit, puis chacun repart dans sa journée.'],
  'same-room-silence':['On est dans la même pièce sans faire la même chose.','Le silence n’a rien de vide, il fait juste partie du moment.','Quelques minutes passent comme ça avant que l’un de nous bouge.'],
  'short-walk':['Je sors sans destination très précise.','Je prends une rue, puis une autre, juste pour changer d’air.','Je reviens avec la sensation d’avoir coupé un peu la journée.'],
  'sunset-step-out':['Je sors quelques minutes pendant que la lumière baisse.','La ville change doucement de couleur autour de moi.','Je reste jusqu’à ce que le moment passe de lui-même.']
 };
 return map[id]||({
   quiet:['Je ralentis un peu.','Quelques minutes passent sans que rien n’ait besoin d’arriver.','Je reprends ensuite ma journée.'],
   practical:['Je m’occupe d’un détail du quotidien.','Le geste prend quelques minutes, sans urgence.','Quand c’est fait, je passe naturellement à autre chose.'],
   self:['Je garde ce moment pour moi.','Je laisse le temps passer sans remplir chaque seconde.','Je me relève ensuite avec l’impression d’avoir respiré un peu.'],
   social:['Je prends un peu de temps pour quelqu’un.','L’échange reste simple, pas spectaculaire.','Puis la journée reprend.'],
   couple:['Je reste un peu avec Dominic.','On partage ce moment sans chercher à en faire quelque chose de plus grand.','Puis chacun retrouve son rythme.'],
   outing:['Je bouge un peu sans programme précis.','Le décor change, les pensées aussi.','Je reviens quand j’en ai assez.']
 }[beat.kind]);
}
function motion(beat:OrdinaryLifeBeat){const id=beat.id.replace(/^ordinary-(quiet|practical|self|social|couple|outing)-/,'');if(/coffee|kitchen|tea/.test(id))return'near-surface';if(/window|balcony|air|sunset/.test(id))return'open-air';if(/sofa|read|music|same-room/.test(id))return'settle';if(/plant|tidy|laundry/.test(id))return'hands-busy';if(beat.kind==='outing')return'leave-space';if(beat.kind==='couple')return'close-presence';return beat.kind;}
function show(beat:OrdinaryLifeBeat){
 clean();if(beat.kind==='couple'&&getDominicPresence()?.together!==true)return;const stage=document.getElementById('homePhotoStage');if(!(stage instanceof HTMLElement))return;
 const root=document.createElement('div');root.className=`moniaOrdinaryMicroMoment kind-${beat.kind}`;root.setAttribute('aria-live','polite');root.dataset.beat=beat.id;
 const text=document.createElement('span');root.appendChild(text);stage.appendChild(root);
 const lines=phrases(beat).slice(0,3);let phase=0;const duration=7600;const renderPhase=()=>{text.textContent=lines[Math.min(phase,lines.length-1)]||'';stage.classList.remove('ordinary-phase-1','ordinary-phase-2','ordinary-phase-3');stage.classList.add(`ordinary-phase-${phase+1}`);root.dataset.phase=String(phase+1)};
 stage.classList.add('ordinary-moment-active',`ordinary-moment-${beat.kind}`);window.dispatchEvent(new CustomEvent('monia:ordinary-life-world-reaction',{detail:{beat,stage:'home',motion:motion(beat),dominicPresent:getDominicPresence()?.together===true,duration}}));renderPhase();window.requestAnimationFrame(()=>root.classList.add('is-visible'));
 const next=()=>{if(phase>=lines.length-1)return;phase++;renderPhase();if(phase<lines.length-1)phaseTimer=window.setTimeout(next,2350)};phaseTimer=window.setTimeout(next,2350);
 timer=window.setTimeout(()=>{root.classList.remove('is-visible');stage.classList.remove('ordinary-moment-active',`ordinary-moment-${beat.kind}`,'ordinary-phase-1','ordinary-phase-2','ordinary-phase-3');window.setTimeout(()=>root.remove(),420)},duration);
}
window.addEventListener('monia:save-changed',()=>{if(document.querySelector('.modal,.overlay.show,[data-open="true"].phoneDevice,.surprisePlayer,.cinematicOverlay'))clean()});
window.addEventListener('monia:ordinary-life-consumed',((event:CustomEvent<{beat?:OrdinaryLifeBeat}>)=>{if(event.detail?.beat)show(event.detail.beat)}) as EventListener);
