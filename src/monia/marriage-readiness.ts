import { ensureLifeMilestoneChronology } from './life-milestone-chronology';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;official?:boolean;engaged?:boolean;married?:boolean;relationship?:number;trust?:number;pending?:string[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type MarriageReadiness={eligible:boolean;engagedDay:number|null;daysEngaged:number;preparationsReady:boolean;sharedLifeReady:boolean;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function compute(s:Save):MarriageReadiness{
  const day=Math.max(1,n(s.day,1)),f=s.flags||(s.flags={}),chronology=ensureLifeMilestoneChronology(s);const engagedDay=chronology?.engagedDay||null;const daysEngaged=engagedDay?Math.max(0,day-engagedDay):0;
  const sharedLifeReady=f.firstJointPropertyPurchased===true&&f.estateMoved===true;
  const preparationsReady=f.weddingChoiceDone===true&&n(f.weddingChoiceDay,0)>0;
  if(s.married)return{eligible:false,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'Le mariage a déjà eu lieu.'};
  if(!s.engaged||!engagedDay)return{eligible:false,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'Les fiançailles doivent d’abord être réellement établies.'};
  if(!sharedLifeReady)return{eligible:false,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'Leur vie commune doit rester établie avant cette étape.'};
  if(daysEngaged<55)return{eligible:false,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'Les fiançailles ont besoin d’exister dans le temps avant le mariage.'};
  if(!preparationsReady)return{eligible:false,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'Les préparatifs doivent avoir réellement avancé avant le mariage.'};
  if(n(s.relationship)<72||n(s.trust)<64)return{eligible:false,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'Le quotidien du couple doit rester assez stable pour ouvrir cette étape.'};
  return{eligible:true,engagedDay,daysEngaged,preparationsReady,sharedLifeReady,reason:'La chronologie et la vie commune rendent maintenant cette étape possible.'};
}
export function getMarriageReadiness(){const s=read();return s?compute(s):null}
export function recordMarriage(){const s=read();if(!s)return false;const ready=compute(s);if(!ready.eligible)return false;const day=Math.max(1,n(s.day,1)),f=s.flags||(s.flags={});s.married=true;f.marriedDay=day;s.eventHistory=[...(s.eventHistory||[]),`marriage-recorded:${day}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'marriage-readiness'}}));return true}catch{return false}}

function legacyProposalAllowed(s:Save){const day=Math.max(1,n(s.day,1)),f=s.flags||(s.flags={}),c=ensureLifeMilestoneChronology(s),officialDay=c?.officialDay||day,estateDay=n(f.spainHomeEstablishedDay||f.lastArrivalDay,0);return!!s.official&&!s.engaged&&!s.married&&n(s.relationship)>=68&&n(s.trust)>=58&&day>=officialDay+90&&f.firstJointPropertyPurchased===true&&f.estateMoved===true&&estateDay>0&&day>=estateDay+7&&String(f.marriageReadiness||'open')!=='not-yet'&&day>=n(f.proposalCooldownUntilDay,0)}
function sanitizeLegacyMilestones(s:Save){
  const f=s.flags||(s.flags={});let changed=false;const pending=Array.isArray(s.pending)?s.pending:[];
  const allowed=pending.filter(id=>{
    if(id==='proposal')return legacyProposalAllowed(s);
    if(id==='wedding_seed')return s.engaged===true&&!s.married&&n(f.engagedDay,0)>0&&Math.max(1,n(s.day,1))>=n(f.engagedDay,0)+14;
    if(id==='wedding_choice')return s.engaged===true&&!s.married&&f.weddingStarted===true&&n(f.engagedDay,0)>0&&Math.max(1,n(s.day,1))>=n(f.engagedDay,0)+20;
    if(id==='wedding_day')return compute(s).eligible;
    return true;
  });
  if(allowed.length!==pending.length){s.pending=allowed;changed=true}
  if(s.married===true&&f.marriedDay&&f.weddingChoiceDone!==true){s.married=false;delete f.marriedDay;changed=true}
  return changed;
}

const originalSetItem=Storage.prototype.setItem;
if(!(Storage.prototype as unknown as Record<string,unknown>).__moniaMilestoneGuard){
  (Storage.prototype as unknown as Record<string,unknown>).__moniaMilestoneGuard=true;
  Storage.prototype.setItem=function(key:string,value:string){
    if(key!==SAVE_KEY)return originalSetItem.call(this,key,value);
    try{const parsed=JSON.parse(value) as Save;sanitizeLegacyMilestones(parsed);return originalSetItem.call(this,key,JSON.stringify(parsed))}catch{return originalSetItem.call(this,key,value)}
  };
}
function normalizeExisting(){const s=read();if(!s||!sanitizeLegacyMilestones(s))return;originalSetItem.call(localStorage,SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'legacy-marriage-guard'}}))}
normalizeExisting();

declare global{interface Window{__moniaMarriageReadiness?:()=>MarriageReadiness|null;__moniaRecordMarriage?:()=>boolean}}
window.__moniaMarriageReadiness=getMarriageReadiness;window.__moniaRecordMarriage=recordMarriage;
