import { getChildrenLife } from './children-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;children?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type NannyUpdateKind='message'|'photo'|'drawing'|'video-call-request';
export type NannyUpdate={id:string;day:number;time:string;kind:NannyUpdateKind;childId?:string;text:string;mediaKey?:string;read:boolean};
export type TrustedNannySnapshot={established:boolean;available:boolean;childrenCount:number;canTravel:boolean;canStayOvernight:boolean;canSendPhotos:boolean;canSendDrawings:boolean;canHostFamilyVisio:boolean;updates:NannyUpdate[]};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:nanny-changed'));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function updatesOf(s:Save){const raw=s.flags?.trustedNannyUpdates;return Array.isArray(raw)?raw as NannyUpdate[]:[]}
function ensureEstablished(s:Save){const f=s.flags||(s.flags={});if(n(s.children,0)<=0)return false;if(f.childcareNannyDismissed===true)return false;if(f.childcareNannyEstablished!==true){f.childcareNannyEstablished=true;f.trustedNannyEstablishedDay=Math.max(1,n(s.day,1));f.trustedNannyReliable=true;return true}return false}

export function getTrustedNannySnapshot():TrustedNannySnapshot|null{
  const s=read();if(!s)return null;const changed=ensureEstablished(s);if(changed)write(s);const kids=getChildrenLife();const established=kids.length>0&&s.flags?.childcareNannyDismissed!==true;
  return{established,available:established,childrenCount:kids.length,canTravel:established,canStayOvernight:established,canSendPhotos:established,canSendDrawings:established&&kids.some(k=>k.ageYears>=2),canHostFamilyVisio:established,updates:updatesOf(s).slice(-80)}
}

export function queueTrustedNannyUpdate(kind:NannyUpdateKind,input:{childId?:string;text?:string;mediaKey?:string}={}){
  const s=read();if(!s)return null;const changed=ensureEstablished(s);const kids=getChildrenLife();if(!kids.length)return null;const child=input.childId?kids.find(k=>k.id===input.childId):kids[0];
  if(kind==='drawing'&&child&&child.ageYears<2)return null;
  const day=Math.max(1,n(s.day,1)),time=String(s.time||'12:00');const id=`nanny-${kind}-${day}-${Date.now()}`;
  const childLabel=child?.name?.trim()||'le petit';
  const defaultText=kind==='photo'?`Petite photo de ${childLabel} pour vous rassurer. Tout va bien ici.`:kind==='drawing'?`${childLabel} a fait un dessin pour vous. Je vous le garde et je vous envoie une photo.`:kind==='video-call-request'?`${childLabel} est disponible si vous voulez faire un petit appel vidéo.`:`Tout va bien avec ${childLabel}. Je vous tiens au courant.`;
  const u:NannyUpdate={id,day,time,kind,childId:child?.id,text:input.text?.trim()||defaultText,mediaKey:input.mediaKey,read:false};const f=s.flags||(s.flags={});f.trustedNannyUpdates=[...updatesOf(s),u].slice(-120);f.trustedNannyLastUpdateDay=day;
  s.eventHistory=[...(s.eventHistory||[]),`trusted-nanny-update:${kind}:${child?.id||'family'}:${day}`].slice(-520);if(changed)f.trustedNannyReliable=true;write(s);window.dispatchEvent(new CustomEvent('monia:nanny-update',{detail:u}));return u
}

export function markTrustedNannyUpdateRead(id:string){const s=read();if(!s)return false;const f=s.flags||(s.flags={});const list=updatesOf(s);const i=list.findIndex(x=>x.id===id);if(i<0)return false;list[i]={...list[i],read:true};f.trustedNannyUpdates=list;write(s);return true}

export function requestFamilyVideoCall(childId?:string){return queueTrustedNannyUpdate('video-call-request',{childId,text:'La nounou peut installer l’enfant pour un petit appel vidéo quand le gameplay le demande. La visio réelle reste soumise aux médias famille explicitement approuvés.'})}

window.setTimeout(()=>getTrustedNannySnapshot(),1100);
declare global{interface Window{__moniaTrustedNanny?:()=>TrustedNannySnapshot|null;__moniaQueueNannyUpdate?:(kind:NannyUpdateKind,input?:{childId?:string;text?:string;mediaKey?:string})=>NannyUpdate|null;__moniaNannyUpdateRead?:(id:string)=>boolean;__moniaRequestFamilyVideoCall?:(childId?:string)=>NannyUpdate|null}}
window.__moniaTrustedNanny=getTrustedNannySnapshot;window.__moniaQueueNannyUpdate=queueTrustedNannyUpdate;window.__moniaNannyUpdateRead=markTrustedNannyUpdateRead;window.__moniaRequestFamilyVideoCall=requestFamilyVideoCall;
