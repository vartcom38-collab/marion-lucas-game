import { getChildrenLife } from './children-life';

const SAVE_KEY='marion-lucas-save-v4';
type PhoneMsg={from:string;text:string;day:number;read:boolean;thread?:string};
type Save={day?:number;time?:string;place?:string;children?:number;phoneUnread?:number;messages?:PhoneMsg[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type NannyUpdateKind='message'|'photo'|'drawing'|'video-call-request';
export type NannyUpdate={id:string;day:number;time:string;kind:NannyUpdateKind;childId?:string;text:string;mediaKey?:string;read:boolean};
export type TrustedNannySnapshot={established:boolean;available:boolean;childrenCount:number;canTravel:boolean;canStayOvernight:boolean;canSendPhotos:boolean;canSendDrawings:boolean;canHostFamilyVisio:boolean;updates:NannyUpdate[]};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:nanny-changed'));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function updatesOf(s:Save){const raw=s.flags?.trustedNannyUpdates;return Array.isArray(raw)?raw as NannyUpdate[]:[]}
function isEstablished(s:Save){return n(s.children,0)>0&&s.flags?.childcareNannyEstablished===true&&s.flags?.childcareNannyDismissed!==true}
function pushToPhone(s:Save,u:NannyUpdate){
  const prefix=u.kind==='photo'?'📷 ':u.kind==='drawing'?'🖍️ ':u.kind==='video-call-request'?'📹 ':'';s.messages=Array.isArray(s.messages)?s.messages:[];s.messages.unshift({from:'Nounou',text:`${prefix}${u.text}`,day:u.day,read:false,thread:'Nounou'});s.phoneUnread=Math.max(0,n(s.phoneUnread,0))+1;const f=s.flags||(s.flags={});f.phoneToast=`Nounou|${prefix}${u.text}`;f.phoneToastAt=u.day*1440;
}

export function establishTrustedNanny(){
  const s=read();if(!s||n(s.children,0)<=0)return false;const f=s.flags||(s.flags={});if(f.childcareNannyDismissed===true)return false;if(f.childcareNannyEstablished===true)return true;
  const day=Math.max(1,n(s.day,1));f.childcareNannyEstablished=true;f.trustedNannyEstablishedDay=day;f.trustedNannyReliable=true;s.eventHistory=[...(s.eventHistory||[]),`trusted-nanny-established:${day}`].slice(-520);write(s);return true
}

export function dismissTrustedNanny(){const s=read();if(!s)return false;const f=s.flags||(s.flags={});if(f.childcareNannyEstablished!==true)return false;f.childcareNannyDismissed=true;f.childcareNannyEstablished=false;s.eventHistory=[...(s.eventHistory||[]),`trusted-nanny-dismissed:${Math.max(1,n(s.day,1))}`].slice(-520);write(s);return true}

export function getTrustedNannySnapshot():TrustedNannySnapshot|null{
  const s=read();if(!s)return null;const kids=getChildrenLife();const established=isEstablished(s);const f=s.flags||{};const photoReady=established&&typeof f.trustedNannyPhotoMediaKey==='string'&&String(f.trustedNannyPhotoMediaKey).trim().length>0;const drawingReady=established&&kids.some(k=>k.ageYears>=2)&&typeof f.trustedNannyDrawingMediaKey==='string'&&String(f.trustedNannyDrawingMediaKey).trim().length>0;
  return{established,available:established,childrenCount:kids.length,canTravel:established,canStayOvernight:established,canSendPhotos:photoReady,canSendDrawings:drawingReady,canHostFamilyVisio:established,updates:established?updatesOf(s).slice(-80):[]}
}

export function queueTrustedNannyUpdate(kind:NannyUpdateKind,input:{childId?:string;text?:string;mediaKey?:string}={}){
  const s=read();if(!s||!isEstablished(s))return null;const kids=getChildrenLife();if(!kids.length)return null;const child=input.childId?kids.find(k=>k.id===input.childId):kids[0];
  if(kind==='drawing'&&child&&child.ageYears<2)return null;const mediaKind=kind==='photo'||kind==='drawing';const effectiveKind:NannyUpdateKind=mediaKind&&!input.mediaKey?'message':kind;
  const day=Math.max(1,n(s.day,1)),time=String(s.time||'12:00');const id=`nanny-${effectiveKind}-${day}-${Date.now()}`;
  const childLabel=child?.name?.trim()||'le petit';
  const defaultText=effectiveKind==='photo'?`Petite photo de ${childLabel} pour vous rassurer. Tout va bien ici.`:effectiveKind==='drawing'?`${childLabel} a fait un dessin pour vous. Je vous le garde et je vous envoie une photo.`:effectiveKind==='video-call-request'?`${childLabel} est disponible si vous voulez faire un petit appel vidéo.`:`Tout va bien avec ${childLabel}. Je vous tiens au courant.`;
  const u:NannyUpdate={id,day,time,kind:effectiveKind,childId:child?.id,text:input.text?.trim()||defaultText,mediaKey:effectiveKind===kind?input.mediaKey:undefined,read:false};const f=s.flags||(s.flags={});f.trustedNannyUpdates=[...updatesOf(s),u].slice(-120);f.trustedNannyLastUpdateDay=day;
  pushToPhone(s,u);s.eventHistory=[...(s.eventHistory||[]),`trusted-nanny-update:${effectiveKind}:${child?.id||'family'}:${day}`].slice(-520);write(s);window.dispatchEvent(new CustomEvent('monia:nanny-update',{detail:u}));return u
}

export function markTrustedNannyUpdateRead(id:string){const s=read();if(!s||!isEstablished(s))return false;const f=s.flags||(s.flags={});const list=updatesOf(s);const i=list.findIndex(x=>x.id===id);if(i<0)return false;list[i]={...list[i],read:true};f.trustedNannyUpdates=list;write(s);return true}

export function requestFamilyVideoCall(childId?:string){const s=read();if(!s||!isEstablished(s))return null;return queueTrustedNannyUpdate('video-call-request',{childId,text:'La nounou peut installer l’enfant pour un petit appel vidéo quand le gameplay le demande. La visio réelle reste soumise aux médias famille explicitement approuvés.'})}

window.setTimeout(()=>getTrustedNannySnapshot(),1100);
declare global{interface Window{__moniaTrustedNanny?:()=>TrustedNannySnapshot|null;__moniaEstablishTrustedNanny?:()=>boolean;__moniaDismissTrustedNanny?:()=>boolean;__moniaQueueNannyUpdate?:(kind:NannyUpdateKind,input?:{childId?:string;text?:string;mediaKey?:string})=>NannyUpdate|null;__moniaNannyUpdateRead?:(id:string)=>boolean;__moniaRequestFamilyVideoCall?:(childId?:string)=>NannyUpdate|null}}
window.__moniaTrustedNanny=getTrustedNannySnapshot;window.__moniaEstablishTrustedNanny=establishTrustedNanny;window.__moniaDismissTrustedNanny=dismissTrustedNanny;window.__moniaQueueNannyUpdate=queueTrustedNannyUpdate;window.__moniaNannyUpdateRead=markTrustedNannyUpdateRead;window.__moniaRequestFamilyVideoCall=requestFamilyVideoCall;
