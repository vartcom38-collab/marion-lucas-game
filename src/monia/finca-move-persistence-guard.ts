import { getPropertyLifeSnapshot } from './property-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={place?:string;flags?:Record<string,unknown>};

type TravelPlan={id?:string;to?:string;state?:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'finca-move-persistence'}}));return true}catch{return false}}
function norm(v:unknown){return String(v||'').trim().toLowerCase()}

export function syncFincaMovePersistence(){
  const s=read();if(!s)return false;const f=s.flags||(s.flags={});
  const primary=getPropertyLifeSnapshot().primary;
  if(!primary||primary.owner!=='joint'||primary.kind!=='finca')return false;
  const plan=(f.activeTravelPlan&&typeof f.activeTravelPlan==='object'?f.activeTravelPlan:null) as TravelPlan|null;
  const travellingToEstate=!!plan&&norm(plan.to)==='estate'&&plan.state!=='completed'&&plan.state!=='cancelled';
  if(travellingToEstate){
    const changed=f.estateMovePending!==true||String(f.estateMovePropertyId||'')!==primary.id||f.estateMoved!==false;
    if(!changed)return true;
    f.estateMovePending=true;f.estateMovePropertyId=primary.id;f.primaryPropertyId=primary.id;f.estateMoved=false;return write(s);
  }
  if(norm(s.place)==='estate'&&f.estateMoved===true){
    const changed=f.estateMovePending!==false||String(f.estateMovePropertyId||'')!==primary.id;
    if(!changed)return true;
    f.estateMovePending=false;f.estateMovePropertyId=primary.id;f.primaryPropertyId=primary.id;return write(s);
  }
  return false;
}

let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;syncFincaMovePersistence()})}
window.addEventListener('monia:property-changed',schedule as EventListener);window.addEventListener('monia:save-changed',schedule as EventListener);window.addEventListener('storage',schedule);setTimeout(schedule,300);

declare global{interface Window{__moniaSyncFincaMovePersistence?:()=>boolean}}
window.__moniaSyncFincaMovePersistence=syncFincaMovePersistence;
