import { getPlaceHistory } from './place-history-life';
import { getAnnualLifeProfile } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type PlaceReturnTone='recognition'|'changed-self'|'deep-return'|'seasonal-return'|'light-return';
export type PlaceReturnMoment={destination:string;absenceDays:number;tone:PlaceReturnTone;strength:number;label:string;narrative:string;meaningful:boolean;};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}

export function getPlaceReturnMoment(destination:string):PlaceReturnMoment|null{
  const s=read();if(!s)return null;const history=getPlaceHistory(destination);if(!history||history.visits<1)return null;const day=n(s.day,1),absenceDays=Math.max(0,day-history.lastDay);if(absenceDays<45)return null;
  const annual=getAnnualLifeProfile();let tone:PlaceReturnTone='recognition';
  if(absenceDays>=730&&history.tier!=='new')tone='deep-return';else if(absenceDays>=365)tone='changed-self';else if((annual?.lifeYear||1)>1&&hash(`${destination}:${annual?.lifeYear}:seasonal-return`)%100<45)tone='seasonal-return';else tone='light-return';
  const strength=Math.min(100,Math.round(Math.min(55,absenceDays/12)+history.score*.45));
  const meaningful=strength>=62||history.tier==='important'||history.tier==='deeply-lived';
  const narrative=tone==='deep-return'?'Revenir ici après si longtemps a quelque chose d’étrange : les repères sont encore là, mais eux ne sont plus exactement les mêmes. Le lieu reconnaît leur histoire sans figer le présent.':tone==='changed-self'?'Le lieu paraît familier tout de suite, mais le temps passé ailleurs se sent. Certains gestes reviennent seuls; d’autres appartiennent clairement à une autre période de leur vie.':tone==='seasonal-return'?'Ils connaissent déjà cet endroit, mais cette année il n’a pas tout à fait la même couleur. Même lieu, autre saison de leur vie.':tone==='recognition'?'À peine arrivés, quelques repères reviennent naturellement. Pas de grande nostalgie : juste cette sensation précise d’être déjà venus et d’avoir laissé quelque chose ici.':'Le retour est simple, mais l’endroit n’est plus anonyme. Quelques habitudes reviennent avant même qu’ils y pensent.';
  return{destination,absenceDays,tone,strength,label:absenceDays>=365?'Revenir après longtemps':'Retrouver un lieu connu',narrative,meaningful};
}

export function markPlaceReturn(destination:string){const s=read();if(!s)return false;const m=getPlaceReturnMoment(destination);if(!m)return false;const f=s.flags||(s.flags={});f.lastPlaceReturnDestination=destination;f.lastPlaceReturnDay=n(s.day,1);f.lastPlaceReturnAbsenceDays=m.absenceDays;s.eventHistory=[...(s.eventHistory||[]),`place-return:${m.tone}:${m.absenceDays}:${n(s.day,1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

declare global{interface Window{__moniaPlaceReturn?:(destination:string)=>PlaceReturnMoment|null;__moniaMarkPlaceReturn?:(destination:string)=>boolean}}
window.__moniaPlaceReturn=getPlaceReturnMoment;window.__moniaMarkPlaceReturn=markPlaceReturn;
