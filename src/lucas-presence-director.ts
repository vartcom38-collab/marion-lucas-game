import './lucasPresenceDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;chemistry:number;memories:string[];eventHistory:string[];
  flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let timer=0;
let armedKey='';
let active=false;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,60)}
function hasCoPresenceAffordance(){return Boolean(document.querySelector('[data-world-action="together"],[data-world-action="horseRide"],[data-world-action="trainingVisit"]'))}
function overlayOpen(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer'))}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||overlayOpen())return false;
  if(!hasCoPresenceAffordance())return false;
  if(Boolean(s.flags.lucasBusy)||Boolean(s.flags.lucasAway)||Boolean(s.flags.corridaLive)||Boolean(s.flags.lucasRoutineBusy))return false;
  if(Number(s.flags.lucasPresenceDay||0)===s.day)return false;
  const h=mins(s.time);return h>=570&&h<=1350;
}

function chooseBeat(s:SaveLike){
  const place=s.place;
  const warm=Number(s.relationship||0)>=55;
  const charged=Number(s.chemistry||0)>=35;
  const pool=place==='finca'
    ?[
      ['SANS UN MOT','Lucas passe près de toi et sa main effleure doucement le bas de ton dos.','Le geste ne dure qu’une seconde. C’est justement pour ça qu’il reste.'],
      ['ENTRE DEUX CHOSES','Il revient de dehors, encore dans son rythme de travail.','Son regard change légèrement quand il te voit.'],
      ['TOUT PRÈS','Vous vous croisez presque sans vous arrêter.','Il se penche juste assez pour déposer un baiser contre ta tempe avant de repartir.']
    ]
    :place==='madrid'||place==='family'
    ?[
      ['AU MILIEU DES AUTRES','La conversation continue autour de vous.','Sous la table, ses doigts trouvent brièvement les tiens.'],
      ['UN REGARD','Quelqu’un lui parle. Lucas répond normalement.','Mais pendant une seconde, il ne regarde que toi.'],
      ['EN PASSANT','Il passe derrière toi dans la pièce.','Sa main se pose une seconde à ta taille, comme si c’était devenu naturel.']
    ]
    :[
      ['TOUT PRÈS','Il vient se placer derrière toi sans interrompre ce que tu fais.','Ses bras se referment un instant autour de toi, puis il te laisse reprendre.'],
      ['RIEN D’EXTRAORDINAIRE','Vous êtes dans la même pièce, chacun occupé.','En passant, il dépose un baiser dans tes cheveux.'],
      ['UN SILENCE','Vos regards se croisent un peu trop longtemps.','Personne ne dit rien. Personne n’en a vraiment besoin.']
    ];
  if(charged)pool.push(['UNE SECONDE DE TROP','Il s’approche pour te dire quelque chose, puis s’arrête.','La distance entre vous devient soudain beaucoup plus courte qu’elle ne devrait.']);
  if(warm)pool.push(['COMME UNE HABITUDE','Lucas cherche ta main sans même y penser.','Le geste est devenu simple. Pas moins précieux.']);
  const seed=(s.day*17+mins(s.time)+Math.round(s.relationship||0)+Math.round(s.chemistry||0))%pool.length;
  return pool[Math.abs(seed)]||pool[0];
}

function showBeat(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||active||!eligible(s))return;
  active=true;
  const [kicker,title,body]=chooseBeat(s);
  const beat=document.createElement('aside');beat.className='lucasPresenceBeat';
  beat.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(beat);
  s.flags.lucasPresenceDay=s.day;s.flags.lucasPresenceAt=stamp(s);s.flags.lucasPresencePlace=s.place;
  addMemory(s,`Un petit geste de Lucas a rendu un moment ordinaire plus intime à ${s.place}.`);
  write(s);
  window.setTimeout(()=>beat.classList.add('is-leaving'),6200);
  window.setTimeout(()=>{beat.remove();active=false},7800);
}

function arm(){
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;armedKey='';return}
  const key=`${s.day}-${s.place}-${s.time}`;if(key===armedKey||active)return;armedKey=key;
  if(timer)window.clearTimeout(timer);
  const delay=18000+((s.day*97+mins(s.time))%17000);
  timer=window.setTimeout(()=>{const latest=read();if(latest)showBeat(latest)},delay);
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,9000);
arm();

console.info('[Romance] spontaneous Lucas physical-presence microbeats active');
