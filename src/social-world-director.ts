import './socialWorldDirector.css';

type Msg={from:string;text:string,day:number,read:boolean};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;phoneUnread:number;messages:Msg[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let timer=0;
let active=false;
let armed='';
let socialEchoTimer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('marion:statechange',{detail:{source:'social-world'}}))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil'))}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,60)}

function eligible(s:SaveLike){
  if(s.screen!=='game'||document.hidden||blocked()||active)return false;
  if(s.day<2)return false; // le Jour 1 garde son rythme narratif dédié
  if(Number(s.flags.socialWorldDay||0)===s.day)return false;
  const h=mins(s.time);return h>=570&&h<=1290;
}

function pick(s:SaveLike){
  const abroad=['madrid','family','finca','estate'].includes(s.place);
  const pool=abroad
    ?[
      ['Marine','Tu survis à ta nouvelle vie ou tu m’oublies complètement ? 😭','Un message de Nîmes traverse la journée comme si la distance n’existait pas.'],
      ['Marine','J’ai vu un truc qui m’a fait penser à toi. Je te raconterai.','Ta vie d’avant continue elle aussi, quelque part.'],
      ['Famille','Petit message pour prendre de tes nouvelles ❤️','Quelques mots ordinaires suffisent à ramener Nîmes dans la pièce.']
    ]
    :[
      ['Marine','Café cette semaine ? J’ai plein de trucs à te raconter.','La vie sociale continue sans attendre un grand événement.'],
      ['Marine','Je viens de passer devant notre coin. Ça m’a fait rire toute seule 😭','Un souvenir banal revient sans prévenir.'],
      ['Famille','Tu m’appelles quand tu as cinq minutes ? Rien de grave ❤️','Le téléphone te rappelle qu’il n’y a pas que les grands bouleversements dans une vie.']
    ];
  const i=Math.abs((s.day*31+mins(s.time)+String(s.place).length)%pool.length);
  return pool[i]||pool[0];
}

function show(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||!eligible(s))return;
  active=true;
  const [from,text,ambient]=pick(s);
  s.messages=Array.isArray(s.messages)?s.messages:[];
  s.messages.unshift({from,text,day:s.day,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;
  s.flags.socialWorldDay=s.day;
  s.flags.socialWorldAt=stamp(s);
  s.flags.phoneToast=`${from}|${text}`;
  s.flags.phoneToastAt=stamp(s);
  addMemory(s,`${from} a repris naturellement contact pendant ta journée.`);
  write(s);
  const cue=document.createElement('aside');cue.className='socialWorldCue';
  cue.innerHTML=`<span>${from.toUpperCase()}</span><strong>${text}</strong><small>${ambient}</small>`;
  game.appendChild(cue);
  window.setTimeout(()=>cue.classList.add('is-soft'),5200);
  window.setTimeout(()=>{cue.remove();active=false},7600);
}

function socialEchoText(kind:string,who:string,duration:number){
  if(who==='marine'){
    if(duration<5)return null;
    return kind==='visio'
      ?['Marine','Ça m’a fait du bien de te voir ❤️','Ton initiative laisse une petite trace dans la journée.']
      :['Marine','Ça m’a fait plaisir que tu m’appelles ❤️','Le monde réagit aussi aux choses que tu choisis de faire toi-même.'];
  }
  if(who==='lucas'){
    if(duration<4)return null;
    return kind==='visio'
      ?['Lucas','J’ai aimé te voir. On se reparle après.','La visio n’était pas juste décorative : elle devient un souvenir partagé.']
      :['Lucas','Content de t’avoir entendue.','Un simple appel peut infléchir le ton du reste de la journée.'];
  }
  return null;
}

function consumeSocialInitiative(){
  const s=read();if(!s||!s.flags)return;
  const pending=String(s.flags.socialInitiativePending||'');
  const serial=Number(s.flags.socialInitiativeSerial||0);
  if(!pending||!serial||Number(s.flags.socialInitiativeHandledSerial||0)===serial)return;
  const [kind,who]=pending.split(':');
  const duration=Number(s.flags.socialInitiativeDuration||0);
  s.flags.socialInitiativeHandledSerial=serial;
  s.flags.socialInitiativePending='';
  const echo=socialEchoText(kind,who,duration);
  if(!echo){write(s);return}
  const [from,text,ambient]=echo;
  addMemory(s,`${from} a réagi à ton initiative spontanée.`);
  write(s);
  if(socialEchoTimer)window.clearTimeout(socialEchoTimer);
  socialEchoTimer=window.setTimeout(()=>{
    const latest=read();if(!latest||document.hidden||blocked())return;
    latest.messages=Array.isArray(latest.messages)?latest.messages:[];
    latest.messages.unshift({from,text,day:latest.day,read:false});
    latest.phoneUnread=Math.max(0,Number(latest.phoneUnread||0))+1;
    latest.flags.phoneToast=`${from}|${text}`;
    latest.flags.phoneToastAt=stamp(latest);
    write(latest);
    const game=document.querySelector<HTMLElement>('main.game');
    if(game){const cue=document.createElement('aside');cue.className='socialWorldCue socialInitiativeCue';cue.innerHTML=`<span>${from.toUpperCase()}</span><strong>${text}</strong><small>${ambient}</small>`;game.appendChild(cue);window.setTimeout(()=>cue.classList.add('is-soft'),4400);window.setTimeout(()=>cue.remove(),6500)}
  },1800);
}

function arm(){
  consumeSocialInitiative();
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;armed='';return}
  const key=`${s.day}-${s.place}`;if(key===armed)return;armed=key;
  const delay=36000+((s.day*211+mins(s.time))%26000);
  timer=window.setTimeout(()=>{timer=0;const latest=read();if(latest)show(latest)},delay);
}

window.addEventListener('storage',arm);
window.addEventListener('marion:statechange',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof HTMLElement&&(n.matches?.('main.game,.phoneDevice')||n.querySelector?.('main.game,.phoneDevice')))))arm()}).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,12000);
arm();

console.info('[World] free social initiatives can now ripple back into messages and memory');
