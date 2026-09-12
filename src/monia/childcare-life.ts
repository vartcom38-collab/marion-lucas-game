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
export function getChildcareSnapshot(context:ChildcareContext='home'):ChildcareSnapshot|null{
  const s=read();if(!s)return null;const kids=n(s.children);const day=dayOf(s);
  if(kids<=0)return{needed:false,available:true,mode:'not-needed',canGoOut:true,canTravel:true,canFollowLucas:true,overnightPossible:true,reason:'Aucun mode de garde n’est nécessaire.',needsPlanning:false,nextReliableDay:day};
  if(context==='home')return{needed:false,available:true,mode:'not-needed',canGoOut:true,canTravel:true,canFollowLucas:true,overnightPossible:true,reason:'À la maison, aucune garde extérieure n’est nécessaire par défaut.',needsPlanning:false,nextReliableDay:day};
  const planned=plannedFor(s,context);const travel=context==='travel'||context==='torero-travel';const family=!travel&&familyAvailable(s);const nanny=planned||nannyAvailable(s,travel);const available=planned||family||nanny;
  const mode:ChildcareMode=planned||nanny?(travel?'travel-nanny':'nanny'):family?'family-support':'unarranged';
  const nextReliableDay=available?day:day+1;
  const reason=available?(mode==='family-support'?'La famille peut prendre le relais aujourd’hui. Ce soutien existe, mais il n’est pas supposé disponible à chaque sortie.':travel?'Une garde adaptée au déplacement est possible aujourd’hui. Les enfants ne bloquent pas le voyage, mais l’organisation existe réellement.':'Une garde est possible aujourd’hui. Marion peut sortir sans que cela devienne automatique tous les jours.'):(travel?'Aucune garde de voyage n’est organisée aujourd’hui. Le déplacement peut être reporté ou une solution peut être préparée.':'Aucune garde fiable n’est organisée pour ce créneau. Marion peut changer son plan ou préparer une solution.');
  return{needed:true,available,mode,canGoOut:available,canTravel:travel?available:true,canFollowLucas:context==='torero-travel'?available:true,overnightPossible:available&&(planned||mode==='travel-nanny'||Boolean(s.flags?.childcareNannyEstablished)),reason,needsPlanning:!available,nextReliableDay};
}
export function planChildcare(context:ChildcareContext='outing'){
  const s=read();if(!s||n(s.children)<=0)return false;const f=s.flags||(s.flags={});f.childcarePlannedDay=dayOf(s);f.childcarePlannedContext=context;f.childcareLastPlannedDay=dayOf(s);write(s);return true
}
declare global{interface Window{__moniaChildcare?:(context?:ChildcareContext)=>ChildcareSnapshot|null;__moniaPlanChildcare?:(context?:ChildcareContext)=>boolean}}
window.__moniaChildcare=getChildcareSnapshot;window.__moniaPlanChildcare=planChildcare;
