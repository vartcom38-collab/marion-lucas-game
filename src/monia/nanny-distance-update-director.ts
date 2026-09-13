import { getChildrenLife } from './children-life';
import { getTrustedNannySnapshot, queueTrustedNannyUpdate, type NannyUpdateKind } from './trusted-nanny-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;children?:number;place?:string;flags?:Record<string,unknown>};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t:string){const [h,m]=String(t||'12:00').split(':').map(Number);return(h||0)*60+(m||0)}
function trustedNannyHasChildren(s:Save){const f=s.flags||{},day=Math.max(1,n(s.day,1));const context=String(f.childcarePlannedContext||'');return n(f.childcarePlannedDay,0)===day&&String(f.childcarePlannedProvider||'')==='nanny'&&(context==='travel'||context==='torero-travel'||n(f.childrenWithTrustedNannyDay,0)===day)}
function bothParentsAway(s:Save){const f=s.flags||{};return f.travelWithLucas===true||String(f.toreroTravelChoice||'')==='follow'||String(f.weekPath||'')==='follow-lucas'||(Boolean(f.activeTravelPlan)&&Boolean(f.lucasAway)===false)}
function desiredUpdate(s:Save):{kind:NannyUpdateKind;mediaKey?:string}{
  const kids=getChildrenLife(),youngest=kids.slice().sort((a,b)=>a.ageDays-b.ageDays)[0],f=s.flags||{};const seed=(Math.max(1,n(s.day,1))*17+kids.length*11)%6;
  const photoKey=typeof f.trustedNannyPhotoMediaKey==='string'?String(f.trustedNannyPhotoMediaKey).trim():'';const drawingKey=typeof f.trustedNannyDrawingMediaKey==='string'?String(f.trustedNannyDrawingMediaKey).trim():'';
  if(youngest&&youngest.ageYears>=2&&seed===4&&drawingKey)return{kind:'drawing',mediaKey:drawingKey};
  if((seed===1||seed===3)&&photoKey)return{kind:'photo',mediaKey:photoKey};
  return{kind:'message'}
}
export function maybeSendNannyDistanceUpdate(){
  const s=read();if(!s||n(s.children,0)<=0||!bothParentsAway(s)||!trustedNannyHasChildren(s))return null;const nanny=getTrustedNannySnapshot();if(!nanny?.available)return null;const f=s.flags||{},day=Math.max(1,n(s.day,1));if(n(f.trustedNannyLastUpdateDay,0)===day)return null;const t=mins(String(s.time||'12:00'));if(t<600||t>1260)return null;const update=desiredUpdate(s);return queueTrustedNannyUpdate(update.kind,{mediaKey:update.mediaKey})
}
window.setTimeout(()=>maybeSendNannyDistanceUpdate(),5500);window.addEventListener('monia:save-changed',()=>window.setTimeout(()=>maybeSendNannyDistanceUpdate(),1200));window.setInterval(()=>maybeSendNannyDistanceUpdate(),45000);
declare global{interface Window{__moniaMaybeNannyDistanceUpdate?:()=>unknown}}
window.__moniaMaybeNannyDistanceUpdate=maybeSendNannyDistanceUpdate;
