import './fincaBelongingDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let active=false;
let timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,60)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil'))}

function level(s:SaveLike){
  const visits=Number(s.flags.fincaDaysSeen||0);
  const rel=Number(s.relationship||0);
  const trust=Number(s.trust||0);
  if(visits>=7&&rel>=68&&trust>=55)return 4;
  if(visits>=5&&rel>=58)return 3;
  if(visits>=3&&rel>=48)return 2;
  if(visits>=1)return 1;
  return 0;
}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(s.place!=='finca'&&s.place!=='estate')return false;
  if(Number(s.flags.fincaBelongingBeatDay||0)===s.day)return false;
  return level(s)>0;
}

function syncVisit(s:SaveLike){
  if(s.place!=='finca'&&s.place!=='estate')return;
  const last=Number(s.flags.fincaLastSeenDay||0);
  if(last===s.day)return;
  s.flags.fincaLastSeenDay=s.day;
  s.flags.fincaDaysSeen=Number(s.flags.fincaDaysSeen||0)+1;
  write(s);
}

function copy(s:SaveLike){
  const l=level(s);
  if(l>=4)return['CHEZ LUI. UN PEU CHEZ TOI.','En cherchant quelque chose, tu ouvres un tiroir sans même réfléchir.','Il y a tes affaires dedans. Pas posées là pour la nuit. Rangées.'];
  if(l===3)return['ÇA RESTE','Une brosse, un livre, un chargeur. Rien d’important.','Sauf qu’ils ne repartent plus vraiment avec toi.'];
  if(l===2)return['PETITE TRACE','Dans la salle de bain, quelque chose à toi est resté près des affaires de Lucas.','Personne n’en a parlé. Personne ne l’a rangé ailleurs.'];
  return['EN ARRIVANT','Tu reconnais déjà le bruit de la maison à cette heure-ci.','Cette fois, tu ne poses pas ton sac près de la porte. Tu sais déjà où le mettre.'];
}

function renderMarkers(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  game.querySelectorAll('.fincaBelongingMarker').forEach(n=>n.remove());
  const l=level(s);if(l<2)return;
  const markers=[
    ['Salle de bain',l>=2?'une petite affaire de Marion est restée ici':''],
    ['Chambre',l>=3?'un livre et un chargeur ne repartent plus à chaque fois':''],
    ['Dressing',l>=4?'un espace existe maintenant pour ses affaires':'']
  ].filter(([,text])=>text);
  markers.forEach(([title,text],i)=>{
    const node=document.createElement('div');node.className='fincaBelongingMarker';node.style.setProperty('--belong-index',String(i));
    node.innerHTML=`<span>${title}</span><small>${text}</small>`;game.appendChild(node);
  });
}

function show(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||active||!eligible(s))return;
  active=true;
  const [kicker,title,body]=copy(s);
  const beat=document.createElement('aside');beat.className='fincaBelongingBeat';
  beat.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(beat);
  s.flags.fincaBelongingBeatDay=s.day;
  s.flags.fincaBelongingLevel=level(s);
  addMemory(s,level(s)>=4?'Tu as réalisé que certaines de tes affaires avaient maintenant leur place chez Lucas.':'Ta présence commence à laisser de petites traces naturelles à la finca.');
  write(s);renderMarkers(s);
  window.setTimeout(()=>beat.classList.add('is-leaving'),6200);
  window.setTimeout(()=>{beat.remove();active=false},7800);
}

function arm(){
  const s=read();if(!s)return;
  syncVisit(s);
  const latest=read();if(!latest)return;
  if(latest.place==='finca'||latest.place==='estate')renderMarkers(latest);
  if(!eligible(latest)){if(timer)window.clearTimeout(timer);timer=0;return}
  if(timer||active)return;
  timer=window.setTimeout(()=>{timer=0;const now=read();if(now)show(now)},16000+((latest.day*83+mins(latest.time))%14000));
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,10000);
arm();

console.info('[Home] progressive Marion belonging at finca active');
