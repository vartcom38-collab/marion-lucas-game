import './marionCorridaDayDirector.css';

type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;energy:number;calendar:CalendarItem[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,160)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.marionCorridaDayVeil,.marionCorridaDayCard'))}
function isCorrida(item:CalendarItem){const text=`${item.title||''} ${item.note||''}`.toLowerCase();return /(corrida|arène|arena)/.test(text)}
function corridaToday(s:SaveLike){return (Array.isArray(s.calendar)?s.calendar:[]).some(i=>(i.owner==='Lucas'||i.owner==='Nous')&&i.day===s.day&&isCorrida(i))}
function baseEligible(s:SaveLike){return s.metLucas&&s.official&&s.screen==='game'&&!document.hidden&&!blocked()&&(corridaToday(s)||Boolean(s.flags.corridaLive)||Number(s.flags.marionSawCorridaLiveDay||0)===s.day)}

function phaseFor(s:SaveLike):'before'|'live'|'waiting'|null{
  if(!baseEligible(s))return null;
  if(Boolean(s.flags.corridaLive)){
    if(Number(s.flags.marionCorridaLiveBeatDay||0)!==s.day)return'live';
    if(Number(s.flags.marionCorridaWaitingBeatDay||0)!==s.day)return'waiting';
    return null;
  }
  if(corridaToday(s)&&Number(s.flags.marionCorridaBeforeBeatDay||0)!==s.day&&mins(s.time)>=540&&mins(s.time)<1110)return'before';
  return null;
}

function beforeCopy(s:SaveLike){
  const close=Number(s.relationship||0)>=64;
  return close?{
    kicker:'AUJOURD’HUI',title:'Tu connais déjà cette version de son silence.',
    body:'Lucas est là, mais une partie de lui est déjà ailleurs. Tu le laisses préparer sa journée sans chercher à remplir chaque seconde.',
    a:'Rester près de lui un moment',b:'Lui laisser son espace'
  }:{
    kicker:'AUJOURD’HUI',title:'La journée n’a pas le même poids.',
    body:'Tu reconnais sa concentration avant même qu’il parte. Le téléphone, les horaires, les affaires vérifiées deux fois : tout annonce ce qui arrive sans avoir besoin d’en parler.',
    a:'Lui souhaiter simplement bonne chance',b:'Ne rien ajouter'
  };
}

function liveCopy(){return{
  kicker:'PENDANT',title:'Le temps devient étrange.',
  body:'Tu peux continuer à bouger, parler, regarder ailleurs. Pourtant une partie de ton attention reste accrochée à ce qui se passe loin de toi.',
  a:'Rester proche des arènes',b:'T’occuper l’esprit'
}}

function waitingCopy(){return{
  kicker:'QUELQUES MINUTES',title:'Tu regardes l’heure sans t’en rendre compte.',
  body:'Pas parce que tu veux connaître le résultat avant qu’il arrive. Juste parce que l’attente a sa propre manière de ralentir le reste du monde.',
  a:'Respirer et laisser passer le temps',b:'Envoyer un message à une amie'
}}

function resolve(s:SaveLike,phase:'before'|'live'|'waiting',choice:'a'|'b'){
  if(phase==='before'){
    s.flags.marionCorridaBeforeBeatDay=s.day;
    s.flags.marionCorridaBeforeChoice=choice;
    if(choice==='a')s.relationship=Number(s.relationship||0)+1;else s.trust=Number(s.trust||0)+1;
    addMemory(s,'Avant une corrida, tu as appris à être présente sans voler de place à la concentration de Lucas.');
  }else if(phase==='live'){
    s.flags.marionCorridaLiveBeatDay=s.day;
    s.flags.marionSawCorridaLiveDay=s.day;
    s.flags.marionCorridaLiveChoice=choice;
    if(choice==='a')s.stress=Number(s.stress||0)+1;else{s.stress=Math.max(0,Number(s.stress||0)-1);s.energy=Math.max(0,Number(s.energy||0)-1)}
    addMemory(s,'Pendant la corrida, ta journée a continué, mais pas tout à fait normalement.');
  }else{
    s.flags.marionCorridaWaitingBeatDay=s.day;
    s.flags.marionCorridaWaitingChoice=choice;
    if(choice==='a')s.stress=Math.max(0,Number(s.stress||0)-1);else{s.stress=Math.max(0,Number(s.stress||0)-1);s.trust=Number(s.trust||0)+1}
    addMemory(s,'Tu as traversé l’attente sans chercher à contrôler ce que tu ne pouvais pas contrôler.');
  }
  write(s);
}

function show(s:SaveLike,phase:'before'|'live'|'waiting'){
  if(active||!baseEligible(s))return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;
  const e=phase==='before'?beforeCopy(s):phase==='live'?liveCopy():waitingCopy();
  const veil=document.createElement('div');veil.className=`marionCorridaDayVeil ${phase}`;
  veil.innerHTML=`<section class="marionCorridaDayCard"><span>${e.kicker}</span><h2>${e.title}</h2><p>${e.body}</p><div><button id="corridaMarionA" class="primary">${e.a}</button><button id="corridaMarionB">${e.b}</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');window.setTimeout(()=>{veil.remove();active=false},260)};
  (veil.querySelector('#corridaMarionA') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,phase,'a');close()};
  (veil.querySelector('#corridaMarionB') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,phase,'b');close()};
}

function arm(){
  const s=read();if(!s){if(timer)window.clearTimeout(timer);timer=0;return}
  const phase=phaseFor(s);
  if(!phase){if(timer)window.clearTimeout(timer);timer=0;return}
  if(active||timer)return;
  const delay=phase==='live'?4500:phase==='waiting'?18000:9000+((s.day*31+mins(s.time))%5000);
  timer=window.setTimeout(()=>{timer=0;const f=read();const p=f?phaseFor(f):null;if(f&&p)show(f,p)},delay);
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
window.setInterval(arm,14000);
arm();
console.info('[Romance] Marion corrida-day anticipation and waiting perspective active');
