const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;visibility?:number;eventHistory?:string[];flags?:Record<string,unknown>};
export type MediaTone='fact'|'rumor'|'false';
export type MediaOpportunity={eligible:boolean;tone:MediaTone;intensity:'quiet'|'noticeable'|'major';subject:string;reason:string;cooldownDays:number};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

export function getMediaOpportunity():MediaOpportunity|null{
  const s=read();if(!s)return null;const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));const last=n(f.lastMediaEventDay,-999);const visibility=n(s.visibility);const official=!!s.official;const seed=hash(`${day}|${s.place}|${s.time}|${visibility}|${official}|${(s.eventHistory||[]).length}`)%100;
  const cooldown=visibility>=45?3:visibility>=20?6:10;const baseChance=Math.min(55,8+Math.floor(visibility*.65)+(official?8:0));const eligible=day-last>=cooldown&&seed<baseChance;
  const tone:MediaTone=seed%10<6?'fact':seed%10<9?'rumor':'false';
  const intensity=visibility>=55?'major':visibility>=25?'noticeable':'quiet';
  const subjects=['présence aux arènes','sortie après une corrida','déplacement aperçu','soirée publique','photo prise à distance','présence auprès de Lucas'];
  const subject=subjects[seed%subjects.length];
  return{eligible,tone,intensity,subject,reason:eligible?'La visibilité et le contexte permettent un événement média imprévisible sans l’imposer.':'Cooldown média ou visibilité trop faible.',cooldownDays:cooldown};
}

export function markMediaEventTriggered(){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f.lastMediaEventDay=Math.max(1,n(s.day,1));localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));return true}

declare global{interface Window{__moniaMediaOpportunity?:()=>MediaOpportunity|null;__moniaMarkMediaEventTriggered?:()=>boolean}}
window.__moniaMediaOpportunity=getMediaOpportunity;window.__moniaMarkMediaEventTriggered=markMediaEventTriggered;
