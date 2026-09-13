import { getChildrenLife } from './children-life';
import { getTrustedNannySnapshot, queueTrustedNannyUpdate, type NannyUpdateKind } from './trusted-nanny-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;children?:number;place?:string;flags?:Record<string,unknown>};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t:string){const [h,m]=String(t||'12:00').split(':').map(Number);return(h||0)*60+(m||0)}
function bothParentsAway(s:Save){const f=s.flags||{};return f.travelWithLucas===true||String(f.toreroTravelChoice||'')==='follow'||String(f.weekPath||'')==='follow-lucas'||(Boolean(f.activeTravelPlan)&&Boolean(f.lucasAway)===false)}
function desiredKind(s:Save):NannyUpdateKind{
  const kids=getChildrenLife(),youngest=kids.slice().sort((a,b)=>a.ageDays-b.ageDays)[0];const seed=(Math.max(1,n(s.day,1))*17+kids.length*11)%6;
  if(youngest&&youngest.ageYears>=2&&seed===4)return'drawing';
  if(seed===1||seed===3)return'photo';
  return'message'
}
export function maybeSendNannyDistanceUpdate(){
  const s=read();if(!s||n(s.children,0)<=0||!bothParentsAway(s))return null;const nanny=getTrustedNannySnapshot();if(!nanny?.available)return null;const f=s.flags||{},day=Math.max(1,n(s.day,1));if(n(f.trustedNannyLastUpdateDay,0)===day)return null;const t=mins(String(s.time||'12:00'));if(t<600||t>1260)return null;return queueTrustedNannyUpdate(desiredKind(s))
}
window.setTimeout(()=>maybeSendNannyDistanceUpdate(),5500);window.addEventListener('monia:save-changed',()=>window.setTimeout(()=>maybeSendNannyDistanceUpdate(),1200));window.setInterval(()=>maybeSendNannyDistanceUpdate(),45000);
declare global{interface Window{__moniaMaybeNannyDistanceUpdate?:()=>unknown}}
window.__moniaMaybeNannyDistanceUpdate=maybeSendNannyDistanceUpdate;
