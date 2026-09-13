import { getChildrenLife } from './children-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;children?:number;official?:boolean;married?:boolean;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ChildcareMode='not-needed'|'nanny'|'family-support'|'travel-nanny'|'unarranged';
export type ChildcareContext='home'|'outing'|'travel'|'torero-travel';
export type ChildcareSnapshot={needed:boolean;available:boolean;mode:ChildcareMode;canGoOut:boolean;canTravel:boolean;canFollowLucas:boolean;overnightPossible:boolean;reason:string;needsPlanning:boolean;nextReliableDay:number};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:childcare-changed'))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function dayOf(s:Save){return Math.max(1,n(s.day,1))}
function plannedFor(s:Save,context:ChildcareContext){const f=s.flags||{};const day=dayOf(s);return n(f.childcarePlannedDay,0)===day&&(String(f.childcarePlannedContext||'')===context||String(f.childcarePlannedContext||'')==='any')}
function familyAvailable(s:Save){const f=s.flags||{};const day=dayOf(s);return Boolean(f.familyCloser||f.familySupportUnlocked)&&((day+n(s.children,0)*3)%5!==0)}
function nannyAvailable(s:Save,travel=false){const f=s.flags||{};if(f.childcareNannyDismissed)return false;if(f.childcareNannyEstablished)return true;const day=dayOf(s);return travel?(day%4!==0):(day%3!==0)}
function careLoad(){const kids=getChildrenLife();if(!kids.length)return{needs:false,overnightSensitive:false,travelSensitive:false,label:'Aucun mode de garde n’est nécessaire.'};const youngest=Math.min(...kids.map(k=>k.ageYears));const needs=kids.some(k=>k.ageYears<12);const overnightSensitive=kids.some(k=>k.ageYears<10);const travelSensitive=kids.some(k=>k.ageYears<6);const label=youngest<1?'La présence d’un bébé demande une organisation de garde réelle.':youngest<4?'La présence d’un jeune enfant demande une organisation de garde adaptée.':needs?'Les enfants ont encore besoin d’une solution de garde selon les sorties.':'Les enfants sont assez grands pour ne plus nécessiter une garde systématique.';return{needs,overnightSensitive,travelSensitive,label}}
export function getChildcareSnapshot(context:ChildcareContext='home'):ChildcareSnapshot|null{
  const s=read();if(!s)return null;const day=dayOf(s);const load=careLoad();
  if(!load.needs)return{needed:false,available:true,mode:'not-needed',canGoOut:true,canTravel:true,canFollowLucas:true,overnightPossible:true,reason:load.label,needsPlanning:false,nextReliableDay:day};
  if(context==='home')return{needed:false,available:true,mode:'not-needed',canGoOut:true,canTravel:true,canFollowLucas:true,overnightPossible:true,reason:'À la maison, aucune garde extérieure n’est nécessaire par défaut.',needsPlanning:false,nextReliableDay:day};
  const planned=plannedFor(s,context);const travel=context==='travel'||context==='torero-travel';const family=!travel&&familyAvailable(s);const nanny=planned||nannyAvailable(s,travel);const available=planned||family||nanny;
  const mode:ChildcareMode=planned||nanny?(travel?'travel-nanny':'nanny'):family?'family-support':'unarranged';
  const nextReliableDay=available?day:day+1;
  const reason=available?(mode==='family-support'?'La famille peut prendre le relais aujourd’hui. Ce soutien existe, mais il n’est pas supposé disponible à chaque sortie.':travel?(load.travelSensitive?'Une garde adaptée aux plus jeunes est organisée pour le déplacement.':'Une garde de voyage est possible aujourd’hui.'):'Une garde est possible aujourd’hui. Marion peut sortir sans que cela devienne automatique tous les jours.'):(travel?'Aucune garde de voyage fiable n’est organisée aujourd’hui. Le déplacement peut être reporté ou préparé autrement.':'Aucune garde fiable n’est organisée pour ce créneau. Marion peut changer son plan ou préparer une solution.');
  return{needed:true,available,mode,canGoOut:available,canTravel:travel?available:true,canFollowLucas:context==='torero-travel'?available:true,overnightPossible:available&&(!load.overnightSensitive||planned||mode==='travel-nanny'||Boolean(s.flags?.childcareNannyEstablished)),reason,needsPlanning:!available,nextReliableDay};
}
export function planChildcare(context:ChildcareContext='outing'){
  const s=read();if(!s||!careLoad().needs)return false;const f=s.flags||(s.flags={});f.childcarePlannedDay=dayOf(s);f.childcarePlannedContext=context;f.childcareLastPlannedDay=dayOf(s);write(s);return true
}
declare global{interface Window{__moniaChildcare?:(context?:ChildcareContext)=>ChildcareSnapshot|null;__moniaPlanChildcare?:(context?:ChildcareContext)=>boolean}}
window.__moniaChildcare=getChildcareSnapshot;window.__moniaPlanChildcare=planChildcare;
