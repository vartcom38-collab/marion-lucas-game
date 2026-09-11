const SAVE_KEY='marion-lucas-save-v4';
const INVITE="Tu vas pas passer ta matinée enfermée 😭 Allez viens. Je suis vers les arènes. On prend un café ?";
const MARKER='marineDay1InviteSeeded';

type Message={from:string;text:string;day:number;read:boolean};
type Save={
  day?:number;
  time?:string;
  place?:string;
  screen?:string;
  introSeen?:boolean;
  phoneUnread?:number;
  messages?:Message[];
  eventHistory?:string[];
  flags?:Record<string,boolean|number|string>;
};

function readSave():Save|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}
}
function writeSave(save:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{/* optional */}}

function alreadyPastInvite(save:Save){
  const events=(save.eventHistory||[]).join(' ').toLowerCase();
  return /marine/.test(events)&&/(café|cafe|arènes|arenes|retrouv)/.test(events);
}

export function ensureMarineDayOneInvite(){
  const save=readSave();
  if(!save||!save.introSeen)return false;
  if(Number(save.day||1)>1)return false;
  const flags=save.flags||(save.flags={});
  if(flags[MARKER]===true)return false;
  const messages=save.messages||(save.messages=[]);
  const existing=messages.find(m=>m.from==='Marine'&&(m.text===INVITE||/vers les arènes.*café/i.test(m.text)));
  if(existing){
    flags[MARKER]=true;
    writeSave(save);
    return false;
  }
  if(alreadyPastInvite(save)){
    flags[MARKER]=true;
    writeSave(save);
    return false;
  }

  messages.unshift({from:'Marine',text:INVITE,day:Number(save.day||1),read:false});
  save.phoneUnread=Math.max(1,Number(save.phoneUnread||0)+1);
  flags[MARKER]=true;
  flags.moniaSmsPending=true;
  writeSave(save);
  window.dispatchEvent(new CustomEvent('monia:phone-message-seeded',{detail:{from:'Marine',day:Number(save.day||1)}}));
  window.dispatchEvent(new Event('storage'));
  return true;
}

window.setTimeout(()=>{ensureMarineDayOneInvite()},900);
window.setInterval(()=>{ensureMarineDayOneInvite()},2500);
window.addEventListener('monia:game-state-after-surprise',()=>{ensureMarineDayOneInvite()});

declare global{
  interface Window{__moniaEnsureMarineDayOneInvite?:()=>boolean}
}
window.__moniaEnsureMarineDayOneInvite=ensureMarineDayOneInvite;
