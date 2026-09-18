import { getDominicPresence } from './lucas-presence-engine';
import { hasMetDominic } from './relationship-chronology';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;metDominic?:boolean;official?:boolean;relationship?:number;trust?:number;chemistry?:number;stress?:number;energy?:number;married?:boolean;children?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type IntimacyChoice='accept'|'not-now'|'initiate'|'protected'|'unprotected'|'trying';
export type IntimacyWindow={available:boolean;reason:string;initiator:'Marion'|'Lucas'|'either';cinematicEligible:boolean;fadeToBlack:true;conceptionEligible:boolean;contraceptionMode:'protected'|'unprotected'|'trying'|'unknown';};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
export function getIntimacyWindow():IntimacyWindow|null{
 const s=read();if(!s)return null;const f=s.flags||(s.flags={});const relation=n(s.relationship),trust=n(s.trust),chem=n(s.chemistry),stress=n(s.stress),energy=n(s.energy,100);const together=hasMetDominic(s)&&getDominicPresence()?.together===true;const available=together&&!!s.official&&relation>=35&&trust>=28&&chem>=30&&stress<85&&energy>15;
 const mode=String(f.contraceptionMode||'unknown') as IntimacyWindow['contraceptionMode'];
 const activeBabyProject=String(f.familyState||'')==='trying'&&f.tryingForBaby===true;
 return{available,reason:available?'Un moment intime peut arriver naturellement si les deux en ont envie.':'Le contexte, la proximité ou l’état du couple ne soutient pas ce moment.',initiator:'either',cinematicEligible:available,fadeToBlack:true,conceptionEligible:available&&activeBabyProject&&mode==='trying',contraceptionMode:mode};
}
export function recordIntimacy(choice:IntimacyChoice){const s=read();if(!s)return false;const f=s.flags||(s.flags={});const day=n(s.day,1);if(choice==='not-now'){f.lastIntimacyDeclinedDay=day;f.intimacyDeclineReason='not-now';localStorage.setItem(SAVE_KEY,JSON.stringify(s));return true}
 if(choice==='protected'||choice==='unprotected'||choice==='trying')f.contraceptionMode=choice;
 if(choice==='accept'||choice==='initiate'){
  f.lastIntimacyDay=day;f.intimacyCount=n(f.intimacyCount)+1;
  const activeBabyProject=String(f.familyState||'')==='trying'&&f.tryingForBaby===true&&String(f.contraceptionMode)==='trying';
  f.qualifyingConceptionEvent=activeBabyProject;
  if(activeBabyProject)f.qualifyingConceptionEventDay=day;
  s.eventHistory=[...(s.eventHistory||[]),'intimacy-private-fade-to-black'].slice(-120);
 }
 localStorage.setItem(SAVE_KEY,JSON.stringify(s));return true}
export function conceptionMayRoll(){const s=read();if(!s)return false;const f=s.flags||{};return String(f.familyState||'')==='trying'&&f.tryingForBaby===true&&String(f.contraceptionMode||'')==='trying'&&!!f.qualifyingConceptionEvent&&!f.pregnant&&!f.pregnancyPossible&&!f.pregnancyConfirmed&&!f.pregnancyLoss&&!f.postpartum;}
declare global{interface Window{__moniaIntimacyWindow?:()=>IntimacyWindow|null;__moniaRecordIntimacy?:(c:IntimacyChoice)=>boolean;__moniaConceptionMayRoll?:()=>boolean}}
window.__moniaIntimacyWindow=getIntimacyWindow;window.__moniaRecordIntimacy=recordIntimacy;window.__moniaConceptionMayRoll=conceptionMayRoll;