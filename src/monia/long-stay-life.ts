import { getResidenceSnapshot } from './residence-base-life';
import { getPlaceHistory } from './place-history-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;place?:string;energy?:number;stress?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type LongStayPhase='arrival'|'settling'|'temporary-base'|'lived-in'|'departing';
export type LongStaySnapshot={place:string;phase:LongStayPhase;daysHere:number;temporaryBase:boolean;homeLikeRhythm:boolean;residenceKind:string;reason:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function key(place:string){return String(place||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'unknown'}

export function getLongStaySnapshot(place?:string):LongStaySnapshot|null{
  const s=read();if(!s)return null;const raw=String(place||s.place||'');if(!raw)return null;const f=s.flags||(s.flags={});const k=key(raw),today=n(s.day,1);const startKey=`longStay:${k}:startDay`;let start=n(f[startKey],0);if(!start){start=today;f[startKey]=today;}const daysHere=Math.max(0,today-start);const residence=getResidenceSnapshot(raw);const history=getPlaceHistory(raw);
  if(residence.isHome)return{place:raw,phase:'lived-in',daysHere,temporaryBase:false,homeLikeRhythm:true,residenceKind:residence.kind,reason:'C’est déjà un vrai domicile : le séjour n’a pas besoin d’être reclassé en base temporaire.'};
  const temporaryBase=daysHere>=6&&!/trajet|route|aeroport|airport|transfert/i.test(raw);
  const homeLikeRhythm=temporaryBase&&(daysHere>=10||(history?.tier==='anchored'||history?.tier==='important'||history?.tier==='deeply-lived'));
  const phase:LongStayPhase=daysHere<2?'arrival':daysHere<6?'settling':daysHere<15?'temporary-base':'lived-in';
  const reason=!temporaryBase?'Le lieu reste encore une étape ou un séjour court.':homeLikeRhythm?'Le séjour dure assez longtemps pour créer de vraies habitudes sur place, sans transformer ce lieu en domicile permanent.':'Le lieu devient une base temporaire avec quelques repères quotidiens.';
  return{place:raw,phase,daysHere,temporaryBase,homeLikeRhythm,residenceKind:residence.kind,reason};
}

export function recordLongStayMoment(place?:string){const s=read();if(!s)return false;const snap=getLongStaySnapshot(place);if(!snap)return false;const f=s.flags||(s.flags={});const k=key(snap.place);f[`longStay:${k}:lastDay`]=n(s.day,1);f[`longStay:${k}:phase`]=snap.phase;f[`longStay:${k}:temporaryBase`]=snap.temporaryBase;f[`longStay:${k}:homeLikeRhythm`]=snap.homeLikeRhythm;s.eventHistory=[...(s.eventHistory||[]),`long-stay:${k}:${snap.phase}:${n(s.day,1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

export function resetLongStay(place:string){const s=read();if(!s)return false;const f=s.flags||(s.flags={}),k=key(place);delete f[`longStay:${k}:startDay`];delete f[`longStay:${k}:lastDay`];delete f[`longStay:${k}:phase`];delete f[`longStay:${k}:temporaryBase`];delete f[`longStay:${k}:homeLikeRhythm`];try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

declare global{interface Window{__moniaLongStay?:(place?:string)=>LongStaySnapshot|null;__moniaRecordLongStay?:(place?:string)=>boolean;__moniaResetLongStay?:(place:string)=>boolean}}
window.__moniaLongStay=getLongStaySnapshot;window.__moniaRecordLongStay=recordLongStayMoment;window.__moniaResetLongStay=resetLongStay;
