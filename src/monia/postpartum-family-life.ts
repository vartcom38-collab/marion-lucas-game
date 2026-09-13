import { registerChild, getChildrenLife } from './children-life';
import { getPregnancyState, setPregnancyState } from './pregnancy-state';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;children?:number;energy?:number;stress?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type PostpartumRhythm={active:boolean;daysSinceBirth:number|null;phase:'none'|'first-days'|'settling'|'new-routine'|'parenting';sleepPressure:number;travelFriction:number;outingFriction:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}

export function finalizeBirth(input:{birthDay?:number;name?:string;sex?:'girl'|'boy'|'unknown'}={}){
  const s=read();if(!s)return null;const f=s.flags||(s.flags={});const day=Math.max(1,n(input.birthDay,n(s.day,1)));
  const preg=getPregnancyState(s);if(preg?.state!=='confirmed'&&preg?.state!=='postpartum'&&!f.inLabor)return null;
  const existingKey=String(f.lastCanonicalBirthKey||'');const birthKey=`birth:${day}`;
  if(existingKey===birthKey){const kids=getChildrenLife();return kids.find(k=>k.birthDay===day)||kids[kids.length-1]||null}
  const child=registerChild({birthDay:day,name:input.name,sex:input.sex});if(!child)return null;
  const fresh=read();if(!fresh)return child;const ff=fresh.flags||(fresh.flags={});ff.lastCanonicalBirthKey=birthKey;ff.lastBirthDay=day;ff.inLabor=false;ff.postpartum=true;ff.familyState='postpartum';ff.postpartumStartDay=day;ff.postpartumRecoveryUntilDay=day+42;fresh.energy=Math.max(0,Math.min(100,n(fresh.energy,70)-18));fresh.stress=Math.max(0,Math.min(100,n(fresh.stress,30)+8));fresh.eventHistory=[...(fresh.eventHistory||[]),`canonical-birth:${child.id}:${day}`].slice(-420);write(fresh);setPregnancyState('postpartum',day);window.dispatchEvent(new CustomEvent('monia:birth-finalized',{detail:{childId:child.id,birthDay:day}}));return child
}

export function getPostpartumRhythm():PostpartumRhythm{
  const s=read();if(!s)return{active:false,daysSinceBirth:null,phase:'none',sleepPressure:0,travelFriction:0,outingFriction:0,reason:'Aucune partie active.'};
  const f=s.flags||{},day=Math.max(1,n(s.day,1)),birthDay=n(f.lastBirthDay,n(f.birthDay,0));const kids=getChildrenLife();const youngest=kids.slice().sort((a,b)=>b.birthDay-a.birthDay)[0];const start=birthDay||youngest?.birthDay||0;if(!start)return{active:false,daysSinceBirth:null,phase:'none',sleepPressure:0,travelFriction:0,outingFriction:0,reason:'Aucune naissance enregistrée.'};
  const days=Math.max(0,day-start);const phase=days<7?'first-days':days<42?'settling':days<180?'new-routine':'parenting';const active=phase!=='parenting';
  const sleepTone=youngest?.sleepTone||'mixed';const sleepBase=phase==='first-days'?78:phase==='settling'?58:phase==='new-routine'?34:12;const sleepPressure=Math.max(0,Math.min(100,sleepBase+(sleepTone==='light'?14:sleepTone==='easy'?-10:0)));const travelFriction=phase==='first-days'?95:phase==='settling'?72:phase==='new-routine'?44:18;const outingFriction=phase==='first-days'?72:phase==='settling'?48:phase==='new-routine'?28:10;
  const reason=phase==='first-days'?'Les premiers jours réorganisent presque tout : sommeil, sorties et disponibilité deviennent plus fragiles.':phase==='settling'?'Le foyer commence à trouver ses repères, mais le repos et la logistique restent prioritaires.':phase==='new-routine'?'Une nouvelle routine familiale se construit sans effacer la vie de couple ni les projets personnels.':'La naissance appartient maintenant au rythme familial installé.';
  return{active,daysSinceBirth:days,phase,sleepPressure,travelFriction,outingFriction,reason}
}

declare global{interface Window{__moniaFinalizeBirth?:(input?:{birthDay?:number;name?:string;sex?:'girl'|'boy'|'unknown'})=>unknown;__moniaPostpartumRhythm?:()=>PostpartumRhythm}}
window.__moniaFinalizeBirth=finalizeBirth;window.__moniaPostpartumRhythm=getPostpartumRhythm;
