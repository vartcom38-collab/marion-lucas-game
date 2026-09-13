import {getLucasCommunicationPolicy} from './monia/lucas-presence-engine';

const SAVE_KEY='marion-lucas-save-v4';

export type RelationshipPhoneContact='Marine'|'Lucas'|string;
export type RelationshipPhoneMessage={from:string;text:string;day:number;read:boolean;thread?:string};
type SaveLike={day?:number;time?:string;place?:string;metLucas?:boolean;phoneUnread?:number;messages?:RelationshipPhoneMessage[];flags?:Record<string,boolean|number|string>;updatedAt?:number};
type LucasCommunication={mode?:'local'|'connect'|'missed'|'unreachable';canCall?:boolean;canMessage?:boolean;responseDelayMinutes?:number;label?:string;reason?:string};

let syncing=false;
let knownMessageCounts:Map<string,number>|null=null;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(save:SaveLike){save.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(save));window.dispatchEvent(new CustomEvent('marion:statechange'))}
function flags(save:SaveLike){if(!save.flags)save.flags={};return save.flags}
function isContactName(value:string){return Boolean(value&&value!=='Toi')}
function messageKey(message:RelationshipPhoneMessage){return`${message.from}|${message.text}|${message.day}|${message.thread||''}`}
function countMessages(messages:RelationshipPhoneMessage[]){const counts=new Map<string,number>();for(const message of messages){const key=messageKey(message);counts.set(key,(counts.get(key)||0)+1)}return counts}
function officialLucasCommunication():LucasCommunication|null{
  try{return getLucasCommunicationPolicy() as LucasCommunication}catch{return null}
}

function nearestContact(messages:RelationshipPhoneMessage[],index:number){
  for(let distance=1;distance<messages.length;distance++){
    const older=index+distance<messages.length?messages[index+distance]:null;
    if(older&&isContactName(older.from))return older.thread||older.from;
    const newer=index-distance>=0?messages[index-distance]:null;
    if(newer&&isContactName(newer.from))return newer.thread||newer.from;
  }
  return'';
}

function fallbackThread(save:SaveLike){
  const messages=save.messages||[];
  const hasMarine=messages.some(message=>message.from==='Marine'||message.thread==='Marine');
  const hasLucas=messages.some(message=>message.from==='Lucas'||message.thread==='Lucas');
  if(!save.metLucas&&hasMarine)return'Marine';
  if(save.metLucas&&hasLucas&&!hasMarine)return'Lucas';
  if(hasMarine&&!hasLucas)return'Marine';
  if(hasLucas&&!hasMarine)return'Lucas';
  return save.metLucas?'Lucas':'Marine';
}

export function normalizeRelationshipPhoneThreads(save:SaveLike){
  const messages=Array.isArray(save.messages)?save.messages:[];
  let changed=false;
  messages.forEach((message,index)=>{
    if(message.thread)return;
    if(isContactName(message.from)){
      message.thread=message.from;
      changed=true;
      return;
    }
    const inferred=nearestContact(messages,index)||fallbackThread(save);
    if(inferred){message.thread=inferred;changed=true}
  });
  return changed;
}

export function relationshipThreadUnread(save:SaveLike,contact:string){
  return(save.messages||[]).filter(message=>message.from!=='Toi'&&!message.read&&(message.thread||message.from)===contact).length;
}

export function markRelationshipThreadRead(save:SaveLike,contact:string){
  normalizeRelationshipPhoneThreads(save);
  let changed=false;
  for(const message of save.messages||[]){
    if(message.from!=='Toi'&&!message.read&&(message.thread||message.from)===contact){message.read=true;changed=true}
  }
  return changed;
}

export function lucasPhoneAvailability(save:SaveLike){
  const official=officialLucasCommunication();
  if(official){
    if(official.mode==='local')return{canMessage:false,canCall:false,replyDelay:'none' as const,reason:'with-marion'};
    if(official.mode==='missed')return{canMessage:official.canMessage!==false,canCall:official.canCall!==false,replyDelay:'delayed' as const,reason:'working'};
    if(official.mode==='unreachable')return{canMessage:official.canMessage!==false,canCall:false,replyDelay:'delayed' as const,reason:'unreachable'};
    return{canMessage:official.canMessage!==false,canCall:official.canCall!==false,replyDelay:'normal' as const,reason:'available'};
  }
  const state=flags(save);
  const physicallyTogether=state.lucasWithMarion===true||state.lucasPresence==='with-marion'||state.lucasPresenceState==='with-marion';
  const working=state.lucasBusy===true||state.lucasPresence==='working'||state.lucasPresenceState==='working';
  const away=state.lucasAway===true||state.lucasTravelingWithoutMarion===true||state.lucasPresence==='away'||state.lucasPresenceState==='away'||state.lucasPresence==='traveling'||state.lucasPresenceState==='traveling';
  if(physicallyTogether)return{canMessage:false,canCall:false,replyDelay:'none' as const,reason:'with-marion'};
  if(working)return{canMessage:true,canCall:true,replyDelay:'delayed' as const,reason:'working'};
  if(away)return{canMessage:true,canCall:true,replyDelay:'normal' as const,reason:'away'};
  return{canMessage:true,canCall:true,replyDelay:'normal' as const,reason:'available'};
}

export function relationshipPhoneContactAllowed(save:SaveLike,contact:string,channel:'message'|'call'='message'){
  if(contact!=='Lucas')return true;
  const availability=lucasPhoneAvailability(save);
  return channel==='call'?availability.canCall:availability.canMessage;
}

function suppressFreshLocalLucasMessages(save:SaveLike){
  const messages=Array.isArray(save.messages)?save.messages:[];
  if(!knownMessageCounts){knownMessageCounts=countMessages(messages);return false}
  if(lucasPhoneAvailability(save).reason!=='with-marion'){knownMessageCounts=countMessages(messages);return false}
  const seen=new Map<string,number>();let removedUnread=0,removed=false;
  save.messages=messages.filter(message=>{
    const key=messageKey(message),occurrence=(seen.get(key)||0)+1;seen.set(key,occurrence);
    const known=knownMessageCounts?.get(key)||0;
    const isFresh=occurrence>known;
    if(isFresh&&message.from==='Lucas'){
      if(!message.read)removedUnread++;
      removed=true;
      return false;
    }
    return true;
  });
  if(removedUnread)save.phoneUnread=Math.max(0,Number(save.phoneUnread||0)-removedUnread);
  knownMessageCounts=countMessages(save.messages||[]);
  return removed;
}

function guardLegacyLucasInitiative(save:SaveLike){
  if(!save.metLucas)return false;
  const state=flags(save),day=Math.max(1,Number(save.day||1));
  const availability=lucasPhoneAvailability(save);
  const shouldSuppress=availability.reason==='with-marion'||availability.reason==='unreachable';
  const guardDay=Number(state.relationshipPhoneSuppressedInitiativeDay||0);
  if(shouldSuppress){
    if(Number(state.lucasPhoneInitiativeDay||0)===day&&guardDay!==day)return false;
    let changed=false;
    if(Number(state.lucasPhoneInitiativeDay||0)!==day){state.lucasPhoneInitiativeDay=day;changed=true}
    if(guardDay!==day){state.relationshipPhoneSuppressedInitiativeDay=day;changed=true}
    return changed;
  }
  if(guardDay===day){
    if(Number(state.lucasPhoneInitiativeDay||0)===day)delete state.lucasPhoneInitiativeDay;
    delete state.relationshipPhoneSuppressedInitiativeDay;
    return true;
  }
  return false;
}

function sync(){
  if(syncing)return;
  const save=read();if(!save)return;
  const localMessageChanged=suppressFreshLocalLucasMessages(save);
  const threadsChanged=normalizeRelationshipPhoneThreads(save);
  const guardChanged=guardLegacyLucasInitiative(save);
  knownMessageCounts=countMessages(save.messages||[]);
  if(!localMessageChanged&&!threadsChanged&&!guardChanged)return;
  syncing=true;write(save);syncing=false;
}

window.addEventListener('storage',sync);
window.addEventListener('marion:statechange',sync as EventListener);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
window.setInterval(sync,1200);
window.setTimeout(sync,0);

declare global{interface Window{__marionRelationshipPhone?:{normalize:(save:SaveLike)=>boolean;availability:(save:SaveLike)=>ReturnType<typeof lucasPhoneAvailability>;contactAllowed:(save:SaveLike,contact:string,channel?:'message'|'call')=>boolean}}}
window.__marionRelationshipPhone={normalize:normalizeRelationshipPhoneThreads,availability:lucasPhoneAvailability,contactAllowed:relationshipPhoneContactAllowed};

console.info('[Phone] relationship thread continuity active');
