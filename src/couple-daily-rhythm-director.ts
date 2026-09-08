import './coupleDailyRhythmDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let active=false;
let lastPhase='';

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,70)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil'))}
function atSharedHome(s:SaveLike){return s.place==='finca'||s.place==='estate'||s.place==='family'||s.place==='madrid'}

function phaseFor(s:SaveLike){
  const t=mins(s.time);
  if(t<450)return'night';
  if(t<570)return'morning';
  if(t<710)return'training';
  if(t<840)return'lunch';
  if(t<1080)return'afternoon';
  if(t<1290)return'evening';
  return'night';
}

function routineBusy(s:SaveLike,phase:string){
  if(!atSharedHome(s))return false;
  if(phase==='training')return true;
  if(phase==='afternoon')return s.day%3===0; // certains jours, travail/entraînement se prolonge
  return false;
}

function copyFor(s:SaveLike,phase:string,busy:boolean){
  if(phase==='morning')return s.place==='finca'
    ?['LE MATIN','La maison s’éveille doucement.','Lucas est déjà debout. Une tasse est posée près de la tienne, comme si ça allait de soi.']
    :['LE MATIN','La journée commence sans cérémonie.','Vous vous croisez encore à moitié réveillés, chacun cherchant son rythme.'];
  if(phase==='training')return['UN PEU PLUS TARD','Lucas est parti s’entraîner.','La finca paraît plus calme quand son rythme s’éloigne vers les terrains.'];
  if(phase==='lunch')return['IL REVIENT','Une porte, des pas, puis sa voix quelque part dans la maison.','Il est revenu de l’entraînement. L’ambiance change presque immédiatement.'];
  if(phase==='afternoon'&&busy)return['L’APRÈS-MIDI','Son travail se prolonge aujourd’hui.','Tu continues ta journée sans l’attendre. Tu sais simplement qu’il est pris.'];
  if(phase==='afternoon')return['L’APRÈS-MIDI','Vous avez chacun vos occupations.','De temps en temps, vous vous retrouvez dans la même pièce sans l’avoir prévu.'];
  if(phase==='evening')return s.place==='finca'
    ?['LE SOIR','La lumière baisse sur la finca.','Le rythme ralentit enfin. Lucas n’a plus l’air d’être ailleurs.']
    :['LE SOIR','La journée se replie doucement.','Vous commencez à retrouver ce petit calme qui n’appartient qu’à vous.'];
  return['TARD','La maison devient silencieuse.','Il reste quelques bruits familiers, puis presque plus rien.'];
}

function showCue(s:SaveLike,phase:string,busy:boolean){
  if(active||blocked()||s.screen!=='game'||document.hidden)return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  const key=`rhythmCue_${s.day}_${phase}`;
  if(Boolean(s.flags[key]))return;
  active=true;
  const [kicker,title,body]=copyFor(s,phase,busy);
  const cue=document.createElement('aside');cue.className='coupleDailyRhythmCue';
  cue.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(cue);
  s.flags[key]=true;
  if(phase==='morning'&&s.place==='finca')addMemory(s,'Les matins à la finca commencent à prendre un rythme familier à deux.');
  if(phase==='training')addMemory(s,'Tu commences à connaître le rythme de travail de Lucas sans avoir besoin qu’il te l’explique.');
  write(s);
  window.setTimeout(()=>cue.classList.add('is-leaving'),5600);
  window.setTimeout(()=>{cue.remove();active=false},7200);
}

function sync(){
  const s=read();if(!s)return;
  if(!s.metLucas||!s.official||!atSharedHome(s)){
    if(Boolean(s.flags.lucasRoutineBusy)){s.flags.lucasRoutineBusy=false;write(s)}
    lastPhase='';return;
  }
  const phase=phaseFor(s);const busy=routineBusy(s,phase);
  const changed=Boolean(s.flags.lucasRoutineBusy)!==busy;
  if(changed){s.flags.lucasRoutineBusy=busy;s.flags.lucasRoutinePhase=phase;write(s)}
  if(phase!==lastPhase){lastPhase=phase;window.setTimeout(()=>{const fresh=read();if(fresh)showCue(fresh,phase,busy)},700)}
}

window.addEventListener('storage',sync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(sync,7000);
sync();

console.info('[Romance] couple daily rhythm + Lucas presence/absence layer active');
