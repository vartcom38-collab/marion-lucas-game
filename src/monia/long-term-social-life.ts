const SAVE_KEY='marion-lucas-save-v4';

type PhoneMessage={from?:string;thread?:string;day?:number};
type SocialRecord={id:string;name:string;firstKnownDay:number;lastContactDay:number;lastSeenDay?:number;bond:number;source:'phone'|'existing';lastNormalizedDay:number};
type Save={day?:number;messages?:PhoneMessage[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type SocialContactSnapshot={id:string;name:string;bond:number;tier:'distant'|'familiar'|'close'|'inner-circle';daysSinceContact:number;yearsKnown:number;canNaturallyReconnect:boolean};
export type LongTermSocialSnapshot={contacts:SocialContactSnapshot[];suggestedContactId?:string;nextOpportunityDay?:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'long-term-social-life'}}))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,a=0,b=100){return Math.max(a,Math.min(b,v))}
function recordsOf(s:Save):SocialRecord[]{const raw=s.flags?.socialContacts;return Array.isArray(raw)?(raw as SocialRecord[]).filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'):[]}
function tier(bond:number):SocialContactSnapshot['tier']{return bond>=78?'inner-circle':bond>=55?'close':bond>=30?'familiar':'distant'}
function eventDay(m:PhoneMessage,fallback:number){return Math.max(1,n(m.day,fallback))}
function knownContacts(s:Save){
  const day=Math.max(1,n(s.day,1));const found=new Map<string,{name:string;first:number;last:number}>();
  for(const m of s.messages||[]){const name=String(m.thread||m.from||'').trim();if(!name||name==='Toi'||name==='Lucas')continue;const d=eventDay(m,day);const prev=found.get(name);found.set(name,{name,first:prev?Math.min(prev.first,d):d,last:prev?Math.max(prev.last,d):d})}
  return [...found.values()]
}
function normalizeBond(r:SocialRecord,day:number){
  const from=Math.max(r.lastNormalizedDay||r.lastContactDay||r.firstKnownDay,1);if(day<=from)return false;
  const silence=Math.max(0,day-Math.max(1,r.lastContactDay));const elapsed=day-from;
  // Links cool only after months of silence, and never collapse just because years pass.
  const decayStart=120;const eligible=Math.max(0,silence-decayStart);const previousEligible=Math.max(0,(silence-elapsed)-decayStart);const periods=Math.floor(eligible/90)-Math.floor(previousEligible/90);
  if(periods>0)r.bond=clamp(r.bond-periods*2,18,100);
  r.lastNormalizedDay=day;return true
}
function syncRecords(s:Save){
  const day=Math.max(1,n(s.day,1));const known=knownContacts(s);const records=recordsOf(s);let changed=false;
  for(const k of known){let r=records.find(x=>x.name===k.name);if(!r){r={id:`social:${k.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'contact'}`,name:k.name,firstKnownDay:k.first,lastContactDay:k.last,bond:k.name==='Marine'?72:48,source:'phone',lastNormalizedDay:day};records.push(r);changed=true}else{if(k.first<r.firstKnownDay){r.firstKnownDay=k.first;changed=true}if(k.last>r.lastContactDay){const gap=Math.max(0,k.last-r.lastContactDay);r.lastContactDay=k.last;r.bond=clamp(r.bond+(gap>30?5:2),18,100);changed=true}}
    if(normalizeBond(r,day))changed=true;
  }
  for(const r of records)if(normalizeBond(r,day))changed=true;
  if(changed){const f=s.flags||(s.flags={});f.socialContacts=records;f.socialLifeLastSyncDay=day;s.eventHistory=[...(s.eventHistory||[]),`social-life-sync:${day}:${records.length}`].slice(-420)}
  return{records,changed}
}
export function getLongTermSocialSnapshot():LongTermSocialSnapshot{
  const s=read();if(!s)return{contacts:[],reason:'Aucune partie active.'};const day=Math.max(1,n(s.day,1));const {records,changed}=syncRecords(s);if(changed)write(s);
  const contacts=records.map(r=>{const silence=Math.max(0,day-r.lastContactDay);return{id:r.id,name:r.name,bond:Math.round(r.bond),tier:tier(r.bond),daysSinceContact:silence,yearsKnown:Math.max(0,(day-r.firstKnownDay)/365),canNaturallyReconnect:silence>=45&&r.bond>=24}}).sort((a,b)=>b.bond-a.bond);
  const f=s.flags||(s.flags={});const lastOpportunity=Math.max(0,n(f.socialOpportunityDay,0));const candidate=contacts.filter(c=>c.canNaturallyReconnect).sort((a,b)=>b.daysSinceContact-a.daysSinceContact)[0];const cooldown=90;const allowed=!!candidate&&day>=lastOpportunity+cooldown;
  return{contacts,suggestedContactId:allowed?candidate?.id:undefined,nextOpportunityDay:candidate?Math.max(day,lastOpportunity+cooldown):undefined,reason:!contacts.length?'La vie sociale se construira à partir des personnes réellement rencontrées ou contactées.':allowed?'Un lien existant pourrait naturellement revenir dans la vie de Marion, sans imposer de message automatique.':'Les liens existants restent présents et évoluent lentement avec le temps.'};
}
export function markSocialOpportunityUsed(contactId:string){const s=read();if(!s)return false;const day=Math.max(1,n(s.day,1));const {records}=syncRecords(s);const r=records.find(x=>x.id===contactId);if(!r)return false;const f=s.flags||(s.flags={});f.socialOpportunityDay=day;f.socialOpportunityContactId=contactId;f.socialContacts=records;s.eventHistory=[...(s.eventHistory||[]),`social-opportunity:${contactId}:${day}`].slice(-420);write(s);return true}
function refresh(){try{getLongTermSocialSnapshot()}catch{}}
window.setTimeout(refresh,1600);window.addEventListener('storage',refresh);window.addEventListener('marion:statechange',refresh as EventListener);window.setInterval(refresh,60000);
declare global{interface Window{__moniaLongTermSocialLife?:()=>LongTermSocialSnapshot;__moniaUseSocialOpportunity?:(contactId:string)=>boolean}}
window.__moniaLongTermSocialLife=getLongTermSocialSnapshot;window.__moniaUseSocialOpportunity=markSocialOpportunityUsed;
