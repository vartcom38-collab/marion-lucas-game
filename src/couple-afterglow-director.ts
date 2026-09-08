import './coupleAfterglowDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;chemistry:number;memories:string[];
  flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let active=false;
let timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,60)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil'))}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(Number(s.flags.lucasSharedRoutineDay||0)!==s.day)return false;
  if(String(s.flags.lucasSharedRoutineChoice||'')!=='yes')return false;
  if(Number(s.flags.coupleAfterglowDay||0)===s.day)return false;
  return true;
}

function copyFor(s:SaveLike){
  const place=s.place;
  const kind=String(s.flags.lucasSharedRoutineKind||'quiet');
  const charged=Number(s.chemistry||0)>=40;
  if(place==='finca'||kind==='walk')return charged
    ?['APRÈS','Vous reprenez doucement le chemin du retour.','Vos épaules se frôlent plusieurs fois. Aucun de vous ne s’écarte vraiment.']
    :['APRÈS','Vous revenez vers la maison sans vous presser.','La conversation s’est arrêtée, mais le silence est resté confortable.'];
  if(place==='madrid'||kind==='city')return charged
    ?['QUELQUES MINUTES PLUS TARD','La ville recommence à faire du bruit autour de vous.','Lucas marche encore un peu trop près de toi.']
    :['QUELQUES MINUTES PLUS TARD','Vous rejoignez le rythme de la ville.','Ce petit détour n’avait rien d’important. Pourtant la journée paraît différente.'];
  if(place==='family'||kind==='escape')return['EN REVENANT','Les voix de la maison reviennent avant même d’entrer.','Lucas te laisse passer devant lui, sa main restant une seconde contre ton dos.'];
  return charged
    ?['APRÈS','Vous reprenez chacun ce que vous faisiez.','Le calme revient. Pas vraiment la distance.']
    :['APRÈS','Le moment se termine sans vraie conclusion.','C’est justement ce qui lui donne l’air d’avoir vraiment eu lieu.'];
}

function show(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||active||!eligible(s))return;
  active=true;
  const [kicker,title,body]=copyFor(s);
  const card=document.createElement('aside');card.className='coupleAfterglow';
  card.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(card);
  s.flags.coupleAfterglowDay=s.day;
  s.flags.coupleAfterglowPlace=s.place;
  addMemory(s,'Un moment à deux s’est terminé sans couper net la sensation entre vous.');
  write(s);
  window.setTimeout(()=>card.classList.add('is-soft'),5200);
  window.setTimeout(()=>{card.remove();active=false},7600);
}

function arm(){
  const s=read();
  if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;return}
  if(timer)return;
  timer=window.setTimeout(()=>{timer=0;const latest=read();if(latest)show(latest)},9000);
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,9000);
arm();

console.info('[Romance] couple afterglow layer active');
