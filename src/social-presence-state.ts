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

const KEY='marion-lucas-social-presence-v1';

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
  const current=getSocialPresence('Marine');
  if(current)return current;
  let status:SocialPresenceStatus='remote';
  if(flags.dayOneWithMarine===true)status='with-marion';
  else if(day===1&&place!=='home'&&flags.dayOneSocialSeeded===true)status='nearby';
  return setSocialPresence('Marine',{
    status,
    place:status==='remote'?'':place,
    momentCount:safeNumber(flags.dayOneMarineMomentCount,0),
    lastMomentStamp:safeNumber(flags.dayOneMarineLastMomentAt,0),
    lastTone:String(flags.dayOneMarineLastTone||''),
    snoozeUntilStamp:safeNumber(flags.dayOneRendezvousSnoozeUntil,0),
    source:'day-one-migration',
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

declare global{interface Window{__marionSocialPresence?:(contact:string)=>SocialContactPresence|null}}
window.__marionSocialPresence=getSocialPresence;
