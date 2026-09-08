import './lucasSharedRoutineDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;trust:number;chemistry:number;energy:number;stress:number;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let timer=0;
let open=false;
let armed='';

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function fmt(total:number){total=((total%1440)+1440)%1440;return`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,60)}
function overlayOpen(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil'))}
function physicallyTogether(){return Boolean(document.querySelector('[data-world-action="together"],[data-world-action="horseRide"],[data-world-action="trainingVisit"]'))}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||overlayOpen()||!physicallyTogether())return false;
  if(Boolean(s.flags.lucasBusy)||Boolean(s.flags.lucasAway)||Boolean(s.flags.corridaLive)||Boolean(s.flags.lucasRoutineBusy))return false;
  if(Number(s.flags.lucasSharedRoutineDay||0)===s.day)return false;
  if(Number(s.flags.lucasPresenceDay||0)!==s.day)return false; // une présence subtile précède toujours une proposition
  const h=mins(s.time);return h>=660&&h<=1290;
}

function copyFor(s:SaveLike){
  const place=s.place;
  const charged=Number(s.chemistry||0)>=38;
  if(place==='finca')return charged
    ?['LUCAS','« Viens deux minutes. »','Il t’attend dehors, sans expliquer davantage.','Le suivre','Pas maintenant','walk']
    :['LUCAS','« Tu viens prendre l’air avec moi ? »','Rien de prévu. Juste quelques minutes loin du reste.','Le suivre','Le rejoindre plus tard','walk'];
  if(place==='madrid')return charged
    ?['LUCAS','« Viens. »','Il a ce demi-sourire qui ne dit absolument pas ce qu’il a en tête.','Y aller avec lui','Le faire attendre un peu','city']
    :['LUCAS','« J’ai une demi-heure. On sort ? »','Pas de programme. Pas de grand événement. Juste vous deux dans la ville.','Sortir avec lui','Rester encore ici','city'];
  if(place==='family')return['LUCAS','« On s’échappe cinq minutes ? »','La maison est pleine de voix. Il te propose juste un peu d’air.','Le suivre','Rester avec les autres','escape'];
  return charged
    ?['LUCAS','« Viens là. »','Il te regarde comme s’il voulait te voler quelques minutes au reste de la journée.','Le rejoindre','Continuer ce que tu fais','quiet']
    :['LUCAS','« Tu viens avec moi ? »','Il n’en fait pas une scène. C’est presque ça qui donne envie de dire oui.','Le suivre','Pas maintenant','quiet'];
}

function resolve(s:SaveLike,accept:boolean,token:string){
  s.flags.lucasSharedRoutineDay=s.day;
  s.flags.lucasSharedRoutineChoice=accept?'yes':'later';
  s.flags.lucasSharedRoutineKind=token;
  if(accept){
    const duration=token==='city'?35:token==='walk'?28:token==='escape'?18:22;
    s.time=fmt(mins(s.time)+duration);
    s.energy=Math.max(0,Number(s.energy||0)-2);
    s.stress=Math.max(0,Number(s.stress||0)-2);
    s.relationship=Number(s.relationship||0)+1;
    s.trust=Number(s.trust||0)+1;
    if(Number(s.chemistry||0)>=35)s.chemistry=Number(s.chemistry||0)+1;
    addMemory(s,'Lucas t’a proposé spontanément de voler quelques minutes au reste de la journée, et tu l’as suivi.');
  }else{
    addMemory(s,'Lucas t’a proposé spontanément un moment à deux, mais tu as gardé ton rythme cette fois.');
  }
  write(s);
}

function show(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||open||!eligible(s))return;
  open=true;
  const [kicker,title,body,yes,no,token]=copyFor(s);
  const veil=document.createElement('div');veil.className='lucasSharedRoutineVeil';
  veil.innerHTML=`<section class="lucasSharedRoutineCard"><span>${kicker}</span><h2>${title}</h2><p>${body}</p><div><button id="lucasRoutineYes" class="primary">${yes}</button><button id="lucasRoutineNo">${no}</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');window.setTimeout(()=>{veil.remove();open=false},260)};
  (veil.querySelector('#lucasRoutineYes') as HTMLButtonElement).onclick=()=>{const latest=read();if(latest)resolve(latest,true,token);close();window.setTimeout(()=>location.reload(),280)};
  (veil.querySelector('#lucasRoutineNo') as HTMLButtonElement).onclick=()=>{const latest=read();if(latest)resolve(latest,false,token);close()};
}

function arm(){
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;armed='';return}
  const key=`${s.day}-${s.place}-${String(s.flags.lucasPresenceAt||'')}`;if(key===armed||open)return;armed=key;
  if(timer)window.clearTimeout(timer);
  const delay=24000+((s.day*131+mins(s.time)+Math.round(s.relationship||0))%19000);
  timer=window.setTimeout(()=>{const latest=read();if(latest)show(latest)},delay);
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,10000);
arm();

console.info('[Romance] spontaneous shared-routine invitations active');
