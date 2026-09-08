import './coupleRitualsDirector.css';

type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;energy:number;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,210)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.coupleRitualCue'))}
function sharedPlace(s:SaveLike){return['finca','estate','madrid','family'].includes(s.place)}

function phase(s:SaveLike){const t=mins(s.time);if(t>=450&&t<600)return'morning';if(t>=690&&t<840)return'midday';if(t>=1050&&t<1230)return'evening';if(t>=1230&&t<=1380)return'night';return''}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!sharedPlace(s)||Boolean(s.flags.lucasAway)||Boolean(s.flags.corridaLive))return false;
  if(Number(s.relationship||0)<52||Number(s.trust||0)<40)return false;
  const p=phase(s);if(!p)return false;
  if(Boolean(s.flags[`coupleRitual_${s.day}_${p}`]))return false;
  const last=Number(s.flags.coupleRitualLastDay||0);if(last&&s.day-last<2)return false;
  return true;
}

function sceneFor(s:SaveLike,p:string){
  const close=Number(s.relationship||0)>=68;
  const charged=Number(s.chemistry||0)>=48;
  const place=s.place;
  if(p==='morning'){
    if(Boolean(s.flags.lucasRoutineBusy))return{tone:'morning',k:'AVANT DE PARTIR',t:'Le geste arrive presque sans y penser.',b:close?'Lucas attrape ce qu’il lui faut, revient juste une seconde vers toi, t’embrasse rapidement et repart. À force, ce petit détour est devenu une habitude.':'Avant de filer, il pose sa main sur ton épaule et cherche ton regard. Rien de solennel. Juste un petit “je reviens” sans le dire.'};
    return{tone:'morning',k:'LE MATIN',t:'Vous avez déjà vos petits automatismes.',b:place==='finca'||place==='estate'?'Deux boissons posées presque toujours au même endroit, une fenêtre qu’on ouvre, quelques mots encore à moitié endormis. Personne n’a décidé que ce serait votre rituel. C’est juste arrivé.':'Le matin commence souvent par la même petite proximité : quelques minutes avant que chacun reprenne son rythme.'};
  }
  if(p==='midday')return{tone:'midday',k:'UN PETIT RÉFLEXE',t:'Vous vous cherchez naturellement dans la journée.',b:'Pas pour tout faire ensemble. Juste ce réflexe de vérifier où est l’autre, d’attendre trente secondes, de laisser une place. Les habitudes commencent à parler à votre place.'};
  if(p==='evening')return charged?{tone:'evening',k:'EN FIN DE JOURNÉE',t:'Il y a un moment où le reste commence à décrocher.',b:'Peu importe ce qui s’est passé avant : quand vous vous retrouvez enfin dans la même pièce, un regard suffit souvent à marquer le passage entre le monde extérieur et vous deux.'}:{tone:'evening',k:'LE SOIR',t:'Vous avez votre façon de redescendre.',b:'Parfois vous parlez, parfois pas. Mais il y a presque toujours ce moment où Lucas vient se poser près de toi avant de vraiment considérer la journée terminée.'};
  return{tone:'night',k:'AVANT DE DORMIR',t:'Le dernier geste de la journée devient familier.',b:close?'Une main qui cherche la tienne dans le noir, un baiser absent sur la tempe, quelques mots soufflés sans importance. Les grandes déclarations comptent moins que ce qui revient chaque soir.':'Même les soirs fatigués, vous finissez souvent par vous retrouver quelques secondes avant que la lumière s’éteigne.'};
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const p=phase(s);const e=sceneFor(s,p);
  s.flags[`coupleRitual_${s.day}_${p}`]=true;s.flags.coupleRitualLastDay=s.day;s.flags.coupleRitualLastPhase=p;
  const count=Number(s.flags.coupleRitualCount||0)+1;s.flags.coupleRitualCount=count;
  if(count===2)addMemory(s,'Sans vraiment les décider, vous commencez à avoir vos propres petits rituels de couple.');
  else if(count===5)addMemory(s,'Certains gestes entre vous sont devenus si familiers qu’ils n’ont plus besoin d’être expliqués.');
  if(count===2||count===5)s.trust=Number(s.trust||0)+1;
  write(s);
  const card=document.createElement('aside');card.id='coupleRitualCue';card.className=`coupleRitualCue ${e.tone}`;card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small>`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),6000);setTimeout(()=>{card.remove();active=false},7600);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},17000+((s.day*67+mins(s.time))%9000))}

window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,16000);arm();
console.info('[Romance] couple rituals emerge gradually from repeated shared life');