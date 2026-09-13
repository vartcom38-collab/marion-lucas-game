import { registerChild, getChildrenLife } from './children-life';
import { getPregnancyState, setPregnancyState } from './pregnancy-state';

const SAVE_KEY='marion-lucas-save-v4';
const BIRTH_WINDOW_DAY=245;
type Save={day?:number;time?:string;place?:string;children?:number;energy?:number;stress?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type PostpartumRhythm={active:boolean;daysSinceBirth:number|null;phase:'none'|'first-days'|'settling'|'new-routine'|'parenting';sleepPressure:number;travelFriction:number;outingFriction:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function gestationDay(s:Save){const preg=getPregnancyState(s);const start=preg?.startDay||preg?.confirmedDay||0;return start?Math.max(0,Math.max(1,n(s.day,1))-start):null}

export function startLabor(){
  const s=read();if(!s)return false;const f=s.flags||(s.flags={}),preg=getPregnancyState(s),g=gestationDay(s);
  if(preg?.state!=='confirmed'||g===null||g<BIRTH_WINDOW_DAY)return false;
  if(f.inLabor===true)return true;
  const day=Math.max(1,n(s.day,1));f.inLabor=true;f.laborStartDay=day;f.laborPregnancyCycle=Math.max(1,preg.cycle||n(f.pregnancyCycle,1));s.eventHistory=[...(s.eventHistory||[]),`labor-start:cycle-${f.laborPregnancyCycle}:${day}`].slice(-420);write(s);window.dispatchEvent(new CustomEvent('monia:labor-started',{detail:{day,cycle:f.laborPregnancyCycle,gestationDay:g}}));return true
}

export function finalizeBirth(input:{birthDay?:number;name?:string;sex?:'girl'|'boy'|'unknown'}={}){
  const s=read();if(!s)return null;const f=s.flags||(s.flags={});const day=Math.max(1,n(input.birthDay,n(s.day,1)));const preg=getPregnancyState(s);
  const cycle=Math.max(1,preg?.cycle||n(f.pregnancyCycle,1));const alreadyFinalized=n(f.lastCanonicalBirthCycle,0)===cycle;
  if(alreadyFinalized||preg?.state==='postpartum'){
    const kids=getChildrenLife();const childId=String(f.lastCanonicalBirthChildId||'');const canonicalDay=n(f.lastBirthDay,n(f.birthDay,day));return kids.find(k=>k.id===childId)||kids.find(k=>k.birthDay===canonicalDay)||kids[kids.length-1]||null
  }
  const g=gestationDay(s);const laborCycle=Math.max(0,n(f.laborPregnancyCycle,0));
  if(preg?.state!=='confirmed'||f.inLabor!==true||g===null||g<BIRTH_WINDOW_DAY||laborCycle!==cycle)return null;
  const child=registerChild({birthDay:day,name:input.name,sex:input.sex});if(!child)return null;
  const fresh=read();if(!fresh)return child;const ff=fresh.flags||(fresh.flags={});ff.lastCanonicalBirthKey=`birth:cycle-${cycle}`;ff.lastCanonicalBirthCycle=cycle;ff.lastCanonicalBirthChildId=child.id;ff.lastBirthDay=day;ff.inLabor=false;delete ff.laborStartDay;delete ff.laborPregnancyCycle;ff.postpartum=true;ff.familyState='postpartum';ff.postpartumStartDay=day;ff.postpartumRecoveryUntilDay=day+42;fresh.energy=Math.max(0,Math.min(100,n(fresh.energy,70)-18));fresh.stress=Math.max(0,Math.min(100,n(fresh.stress,30)+8));fresh.eventHistory=[...(fresh.eventHistory||[]),`canonical-birth:cycle-${cycle}:${child.id}:${day}`].slice(-420);write(fresh);setPregnancyState('postpartum',day);window.dispatchEvent(new CustomEvent('monia:birth-finalized',{detail:{childId:child.id,birthDay:day,cycle}}));return child
}

function completePostpartumIfReady(s:Save,start:number,days:number){
  const f=s.flags||(s.flags={});if(days<180||f.postpartum!==true)return false;
  f.lastPregnancyStartDay=n(f.pregnancyStartDay,n(f.pregnancyPossibleDay,0))||undefined;f.lastPregnancyConfirmedDay=n(f.pregnancyConfirmedDay,0)||undefined;f.lastPostpartumCompletedDay=Math.max(1,n(s.day,1));f.postpartum=false;f.familyState='parenting';f.pregnancyConfirmed=false;f.pregnancyPossible=false;f.inLabor=false;delete f.laborStartDay;delete f.laborPregnancyCycle;delete f.birthDay;delete f.postpartumStartDay;delete f.postpartumRecoveryUntilDay;delete f.pregnancyPossibleDay;delete f.pregnancyTestEarliestDay;delete f.pregnancyConfirmedDay;delete f.pregnancyStartDay;s.eventHistory=[...(s.eventHistory||[]),`postpartum-complete:${start}:${Math.max(1,n(s.day,1))}`].slice(-420);write(s);return true
}

export function getPostpartumRhythm():PostpartumRhythm{
  const s=read();if(!s)return{active:false,daysSinceBirth:null,phase:'none',sleepPressure:0,travelFriction:0,outingFriction:0,reason:'Aucune partie active.'};
  const f=s.flags||{},day=Math.max(1,n(s.day,1)),birthDay=n(f.lastBirthDay,n(f.birthDay,0));const kids=getChildrenLife();const youngest=kids.slice().sort((a,b)=>b.birthDay-a.birthDay)[0];const start=birthDay||youngest?.birthDay||0;if(!start)return{active:false,daysSinceBirth:null,phase:'none',sleepPressure:0,travelFriction:0,outingFriction:0,reason:'Aucune naissance enregistrée.'};
  const days=Math.max(0,day-start);const phase=days<7?'first-days':days<42?'settling':days<180?'new-routine':'parenting';const active=phase!=='parenting';
  if(phase==='parenting')completePostpartumIfReady(s,start,days);
  const sleepTone=youngest?.sleepTone||'mixed';const sleepBase=phase==='first-days'?78:phase==='settling'?58:phase==='new-routine'?34:12;const sleepPressure=Math.max(0,Math.min(100,sleepBase+(sleepTone==='light'?14:sleepTone==='easy'?-10:0)));const travelFriction=phase==='first-days'?95:phase==='settling'?72:phase==='new-routine'?44:18;const outingFriction=phase==='first-days'?72:phase==='settling'?48:phase==='new-routine'?28:10;
  const reason=phase==='first-days'?'Les premiers jours réorganisent presque tout : sommeil, sorties et disponibilité deviennent plus fragiles.':phase==='settling'?'Le foyer commence à trouver ses repères, mais le repos et la logistique restent prioritaires.':phase==='new-routine'?'Une nouvelle routine familiale se construit sans effacer la vie de couple ni les projets personnels.':'La naissance appartient maintenant au rythme familial installé.';
  return{active,daysSinceBirth:days,phase,sleepPressure,travelFriction,outingFriction,reason}
}

function refreshPostpartumLifecycle(){try{getPostpartumRhythm()}catch{}}
window.setTimeout(refreshPostpartumLifecycle,1500);window.addEventListener('storage',refreshPostpartumLifecycle);window.addEventListener('monia:statechange',refreshPostpartumLifecycle as EventListener);window.setInterval(refreshPostpartumLifecycle,45000);

declare global{interface Window{__moniaStartLabor?:()=>boolean;__moniaFinalizeBirth?:(input?:{birthDay?:number;name?:string;sex?:'girl'|'boy'|'unknown'})=>unknown;__moniaPostpartumRhythm?:()=>PostpartumRhythm}}
window.__moniaStartLabor=startLabor;window.__moniaFinalizeBirth=finalizeBirth;window.__moniaPostpartumRhythm=getPostpartumRhythm;
