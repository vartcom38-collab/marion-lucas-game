import { getEmergingImportantBonds, type SocialBondState } from './social-bond-emergence';
import { getAnnualLifeProfile, annualBeatAllowed, annualWeight } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;children?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type CloseCircleMomentKind='home-visit'|'birthday'|'meal'|'holiday'|'children'|'weekend';
export type CloseCircleMember={threadId:string;tier:'important'|'inner-circle';score:number;role:'marion-friend'|'couple-circle'|'taurine-close'|'local-close';stable:boolean;};
export type CloseCircleMoment={id:string;kind:CloseCircleMomentKind;threadId:string;label:string;intent:string;weight:number;minutes:number;narrative:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function roleOf(b:SocialBondState):CloseCircleMember['role']{return b.kind==='friend-network'?'marion-friend':b.kind==='couple-circle'?'couple-circle':b.kind==='taurine-network'?'taurine-close':'local-close'}

export function getCloseCircleMembers():CloseCircleMember[]{
  const s=read();if(!s)return[];const f=s.flags||(s.flags={});
  return getEmergingImportantBonds().slice(0,6).map(b=>{
    const seen=n(f[`closeCircle:${b.threadId}:since`],0);if(!seen)f[`closeCircle:${b.threadId}:since`]=n(s.day,1);
    return{threadId:b.threadId,tier:b.tier==='inner-circle'?'inner-circle':'important',score:b.score,role:roleOf(b),stable:b.tier==='inner-circle'||b.daysKnown>=180};
  });
}

export function getCloseCircleMoment():CloseCircleMoment|null{
  const s=read();if(!s)return null;const members=getCloseCircleMembers().filter(m=>m.stable);if(!members.length)return null;
  const day=n(s.day,1),annual=getAnnualLifeProfile();const chosen=members[hash(`close-circle-member:${day}:${annual?.lifeYear||1}`)%members.length];
  const kids=n(s.children);const pool:CloseCircleMomentKind[]=['home-visit','meal','birthday','weekend','holiday'];if(kids>0)pool.push('children');
  const kind=pool[hash(`close-circle-kind:${chosen.threadId}:${Math.floor(day/21)}`)%pool.length];
  if(!annualBeatAllowed(`close-circle:${chosen.threadId}:${kind}`,{cooldownYears:kind==='birthday'?1:2}))return null;
  const common={threadId:chosen.threadId,weight:annualWeight(kind==='holiday'||kind==='weekend'?'travel':'social',chosen.tier==='inner-circle'?72:62),minutes:kind==='home-visit'?75:kind==='meal'?120:kind==='children'?90:kind==='birthday'?150:240};
  if(kind==='home-visit')return{id:`close-home-${chosen.threadId}`,kind,...common,label:'Recevoir quelqu’un du cercle proche',intent:`close-circle:home:${chosen.threadId}`,narrative:'Ce lien est assez installé pour entrer naturellement dans la maison : pas comme un invité exceptionnel, mais comme quelqu’un qui fait réellement partie de leur vie.'};
  if(kind==='meal')return{id:`close-meal-${chosen.threadId}`,kind,...common,label:'Partager un repas avec quelqu’un qui compte',intent:`close-circle:meal:${chosen.threadId}`,narrative:'Un repas avec quelqu’un du cercle proche peut revenir au fil des années sans avoir besoin d’une occasion particulière.'};
  if(kind==='children')return{id:`close-children-${chosen.threadId}`,kind,...common,label:'Voir quelqu’un de proche autour des enfants',intent:`close-circle:children:${chosen.threadId}`,narrative:'Avec les enfants, certains liens proches prennent aussi leur place dans la vie familiale : passages, repas, anniversaires ou moments simples, sans remplacer la nounou ni la liberté de Marion.'};
  if(kind==='birthday')return{id:`close-birthday-${chosen.threadId}`,kind,...common,label:'Inclure le cercle proche dans un anniversaire',intent:`close-circle:birthday:${chosen.threadId}`,narrative:'Les anniversaires finissent par révéler qui fait vraiment partie du cercle : certaines personnes reviennent naturellement année après année.'};
  if(kind==='holiday')return{id:`close-holiday-${chosen.threadId}`,kind,...common,label:'Proposer quelques jours avec des proches',intent:`close-circle:holiday:${chosen.threadId}`,narrative:'Quand un lien tient vraiment dans le temps, il peut parfois dépasser les simples soirées et entrer dans un séjour, quelques jours ensemble ou des vacances partagées.'};
  return{id:`close-weekend-${chosen.threadId}`,kind,...common,label:'Passer un week-end avec des proches',intent:`close-circle:weekend:${chosen.threadId}`,narrative:'Le cercle proche peut aussi prendre place dans des week-ends simples, sans transformer chaque lien en grande intrigue.'};
}

declare global{interface Window{__moniaCloseCircle?:()=>CloseCircleMember[];__moniaCloseCircleMoment?:()=>CloseCircleMoment|null}}
window.__moniaCloseCircle=getCloseCircleMembers;window.__moniaCloseCircleMoment=getCloseCircleMoment;
