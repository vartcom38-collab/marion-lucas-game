export type SocialPresenceStatus='remote'|'nearby'|'with-marion'|'away';

export type SocialContactPresence={
  contact:string;
  status:SocialPresenceStatus;
  place:string;
  sinceDay:number;
  sinceTime:string;
  lastContactDay:number;
  lastContactTime:string;
  momentCount:number;
  lastMomentStamp:number;
  lastTone:string;
  snoozeUntilStamp:number;
  source:string;
};

type SocialPresenceState={
  version:1;
  contacts:Record<string,SocialContactPresence>;
  updatedAt:number;
};

type SaveLike={day?:number;time?:string;place?:string;flags?:Record<string,boolean|number|string>};

const KEY='marion-lucas-social-presence-v1';
const SAVE_KEY='marion-lucas-save-v4';

function cleanContact(contact:string){return contact.trim().toLowerCase()}
function safeNumber(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}

function empty():SocialPresenceState{return{version:1,contacts:{},updatedAt:Date.now()}}

function readState():SocialPresenceState{
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return empty();
    const parsed=JSON.parse(raw) as Partial<SocialPresenceState>;
    return{version:1,contacts:parsed.contacts&&typeof parsed.contacts==='object'?parsed.contacts:{},updatedAt:safeNumber(parsed.updatedAt,Date.now())};
  }catch{return empty()}
}

function writeState(state:SocialPresenceState){
  state.updatedAt=Date.now();
  localStorage.setItem(KEY,JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('marion:social-presence-changed'));
}

function base(contact:string,day:number,time:string):SocialContactPresence{return{
  contact,
  status:'remote',
  place:'',
  sinceDay:day,
  sinceTime:time,
  lastContactDay:day,
  lastContactTime:time,
  momentCount:0,
  lastMomentStamp:0,
  lastTone:'',
  snoozeUntilStamp:0,
  source:'unknown',
}}

export function getSocialPresence(contact:string):SocialContactPresence|null{
  const state=readState();
  return state.contacts[cleanContact(contact)]||null;
}

export function setSocialPresence(contact:string,patch:Partial<SocialContactPresence>&{status?:SocialPresenceStatus},day:number,time:string){
  const state=readState();
  const key=cleanContact(contact);
  const current=state.contacts[key]||base(contact,day,time);
  const next:SocialContactPresence={...current,...patch,contact:current.contact||contact,lastContactDay:day,lastContactTime:time};
  if(patch.status&&patch.status!==current.status){next.sinceDay=day;next.sinceTime=time}
  state.contacts[key]=next;
  writeState(state);
  return next;
}

export function recordSocialMoment(contact:string,day:number,time:string,stamp:number,tone=''){const current=getSocialPresence(contact)||base(contact,day,time);return setSocialPresence(contact,{momentCount:current.momentCount+1,lastMomentStamp:stamp,lastTone:tone},day,time)}

export function snoozeSocialContact(contact:string,untilStamp:number,day:number,time:string){return setSocialPresence(contact,{snoozeUntilStamp:untilStamp},day,time)}

export function isSocialContactSnoozed(contact:string,nowStamp:number){return Number(getSocialPresence(contact)?.snoozeUntilStamp||0)>nowStamp}

export function migrateLegacyDayOneMarine(flags:Record<string,boolean|number|string>,day:number,time:string,place:string){
  const previous=getSocialPresence('Marine');
  let status:SocialPresenceStatus='remote';
  if(flags.dayOneWithMarine===true)status='with-marion';
  else if(day===1&&place!=='home'&&flags.dayOneSocialSeeded===true)status='nearby';
  else if(day>1)status='away';
  const momentCount=safeNumber(flags.dayOneMarineMomentCount,previous?.momentCount||0);
  const lastMomentStamp=safeNumber(flags.dayOneMarineLastMomentAt,previous?.lastMomentStamp||0);
  const lastTone=String(flags.dayOneMarineLastTone||previous?.lastTone||'');
  const snoozeUntilStamp=safeNumber(flags.dayOneRendezvousSnoozeUntil,previous?.snoozeUntilStamp||0);
  const placeValue=status==='remote'||status==='away'?'':place;
  if(previous&&previous.status===status&&previous.place===placeValue&&previous.momentCount===momentCount&&previous.lastMomentStamp===lastMomentStamp&&previous.lastTone===lastTone&&previous.snoozeUntilStamp===snoozeUntilStamp)return previous;
  return setSocialPresence('Marine',{
    status,
    place:placeValue,
    momentCount,
    lastMomentStamp,
    lastTone,
    snoozeUntilStamp,
    source:'legacy-day-one-sync',
  },day,time);
}

export function clearStaleCoPresence(day:number,time:string,currentPlace:string){
  const state=readState();
  let changed=false;
  for(const contact of Object.values(state.contacts)){
    if(contact.status==='with-marion'&&(contact.sinceDay!==day||contact.place!==currentPlace)){
      contact.status='away';contact.place='';contact.sinceDay=day;contact.sinceTime=time;contact.source='stale-presence-guard';changed=true;
    }
  }
  if(changed)writeState(state);
}

function syncFromGame(){
  try{
    const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null;
    if(!save)return;
    const day=Math.max(1,safeNumber(save.day,1));
    const time=String(save.time||'09:00');
    const place=String(save.place||'home');
    const flags=save.flags||{};
    if(flags.dayOneSocialSeeded===true||flags.dayOneWithMarine===true)migrateLegacyDayOneMarine(flags,day,time,place);
    clearStaleCoPresence(day,time,place);
  }catch{}
}

declare global{interface Window{__marionSocialPresence?:(contact:string)=>SocialContactPresence|null}}
window.__marionSocialPresence=getSocialPresence;

window.addEventListener('storage',syncFromGame);
window.addEventListener('marion:social-presence-refresh',syncFromGame as EventListener);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncFromGame()});
window.setInterval(syncFromGame,2500);
syncFromGame();
