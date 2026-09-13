const SAVE_KEY='marion-lucas-save-v4';
const APPROVED_URL='./config/phone-photo-approved.json';

export type PhoneMediaKind='selfie'|'place'|'moment'|'family'|'drawing';
export type PhoneMediaMessage={id:string;messageKey:string;thread:string;author:string;day:number;time:string;kind:PhoneMediaKind;src:string;caption?:string;approved:boolean;contextPlace?:string};
type Save={day?:number;time?:string;place?:string;messages?:Array<{from:string;text:string;day:number;read:boolean;thread?:string}>;flags?:Record<string,unknown>;phoneUnread?:number;updatedAt?:number};
type Manifest={status?:string;policy?:Record<string,unknown>;entries?:Array<{id?:string;author?:string;kind?:string;src?:string;media?:string;approved?:boolean}>};
let manifestPromise:Promise<Manifest>|null=null;
function read():Save{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as Save}catch{return {}}}
function write(s:Save){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('marion:phone-refresh'));window.dispatchEvent(new CustomEvent('marion:statechange'))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mediaOf(s:Save){return Array.isArray(s.flags?.phoneMediaMessages)?s.flags?.phoneMediaMessages as PhoneMediaMessage[]:[]}
function safePlace(place:string){const p=place.toLowerCase();if(/n[iî]mes.*(caf|centre|rue)|caf/.test(p))return'./resources/nimes/nimes-cafe.webp';if(/ar[eè]ne/.test(p))return'./resources/nimes/nimes-arenes.webp';if(/gare|station/.test(p))return'./resources/nimes/nimes-station.webp';if(/n[iî]mes/.test(p))return'./resources/nimes/nimes-street.webp';if(/madrid.*(famille|family)/.test(p))return'./resources/madrid/family-home-salon.webp';if(/madrid|finca|estate|country/.test(p))return'./resources/madrid/lucas-country-home-exterior.webp';if(/appart|home|maison/.test(p))return'./resources/nimes/marion-apartment-living.webp';return''}
async function manifest(){if(!manifestPromise)manifestPromise=fetch(APPROVED_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}));return manifestPromise}
async function approvedCharacterPhoto(author:string,kind:PhoneMediaKind){const m=await manifest();if(m.status!=='locked'||m.policy?.approval_required_for_character_photos!==true)return'';const e=(m.entries||[]).find(x=>x.approved!==false&&String(x.author||'').toLowerCase()===author.toLowerCase()&&String(x.kind||'')===kind);return String(e?.src||e?.media||'')}
function messageKey(author:string,thread:string,day:number,text:string,index:number){return`${author}|${thread}|${day}|${text}|${index}`}
export function getPhoneMediaMessages(){return mediaOf(read())}
export function mediaForMessage(message:{from:string;text:string;day:number;thread?:string},index:number,defaultThread:string){const s=read(),thread=message.thread||defaultThread,key=messageKey(message.from,thread,message.day,message.text,index);return mediaOf(s).find(m=>m.messageKey===key)||null}
export async function sendPhonePhoto(input:{author:'Toi'|'Lucas'|'Nounou';thread?:string;kind?:PhoneMediaKind;caption?:string;src?:string;place?:string}){
  const s=read(),day=Math.max(1,n(s.day,1)),time=String(s.time||'12:00'),thread=input.thread||'Lucas',kind=input.kind||'moment',place=input.place||String(s.place||'');let src=String(input.src||'');let approved=false;
  if(kind==='place'||kind==='moment'){src=src||safePlace(place);approved=!!src}else if(kind==='drawing'||kind==='family'){approved=!!src}else{src=src||await approvedCharacterPhoto(input.author==='Toi'?'Marion':input.author,kind);approved=!!src}
  if(!approved||!src)return null;
  const text=input.caption?.trim()|| (kind==='selfie'?'📷 Selfie':kind==='place'?'📷 Photo du moment':kind==='drawing'?'🖍️ Dessin':'📷 Photo');
  s.messages=s.messages||[];const msg={from:input.author,text,day,read:input.author==='Toi',thread};s.messages.unshift(msg);const key=messageKey(msg.from,thread,day,text,0);const rec:PhoneMediaMessage={id:`media-${day}-${Date.now()}`,messageKey:key,thread,author:input.author,day,time,kind,src,caption:input.caption?.trim()||undefined,approved:true,contextPlace:place||undefined};const f=s.flags||(s.flags={});f.phoneMediaMessages=[...mediaOf(s),rec].slice(-180);if(input.author!=='Toi')s.phoneUnread=Math.max(0,n(s.phoneUnread,0))+1;write(s);return rec
}

export async function attachMediaToLatestMessage(input:{author:string;thread:string;kind:PhoneMediaKind;src?:string;caption?:string;place?:string}){
  const s=read(),list=s.messages||[];const i=list.findIndex(m=>m.from===input.author&&(m.thread||input.thread)===input.thread);if(i<0)return null;const msg=list[i];let src=String(input.src||''),approved=false;const place=input.place||String(s.place||'');if(input.kind==='place'||input.kind==='moment'){src=src||safePlace(place);approved=!!src}else if(input.kind==='selfie'){src=src||await approvedCharacterPhoto(input.author==='Toi'?'Marion':input.author,input.kind);approved=!!src}else approved=!!src;if(!approved||!src)return null;const key=messageKey(msg.from,msg.thread||input.thread,msg.day,msg.text,i);const rec:PhoneMediaMessage={id:`media-${msg.day}-${Date.now()}`,messageKey:key,thread:input.thread,author:input.author,day:msg.day,time:String(s.time||'12:00'),kind:input.kind,src,caption:input.caption,approved:true,contextPlace:place||undefined};const f=s.flags||(s.flags={});f.phoneMediaMessages=[...mediaOf(s),rec].slice(-180);write(s);return rec
}

declare global{interface Window{__moniaSendPhonePhoto?:(input:{author:'Toi'|'Lucas'|'Nounou';thread?:string;kind?:PhoneMediaKind;caption?:string;src?:string;place?:string})=>Promise<PhoneMediaMessage|null>;__moniaPhoneMedia?:()=>PhoneMediaMessage[]}}
window.__moniaSendPhonePhoto=sendPhonePhoto;window.__moniaPhoneMedia=getPhoneMediaMessages;
