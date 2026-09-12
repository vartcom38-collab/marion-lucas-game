import { getAnnualLifeProfile, annualBeatAllowed, annualWeight } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SocialConnectionKind='friend-network'|'taurine-network'|'local-contact'|'couple-circle';
export type SocialConnectionThread={id:string;kind:SocialConnectionKind;strength:number;firstDay:number;lastDay:number;encounters:number;active:boolean;reason:string};
export type SocialConnectionFollowUp={id:string;threadId:string;kind:SocialConnectionKind;label:string;intent:string;weight:number;minutes:number;narrative:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function threadKey(id:string,k:string){return `socialThread:${id}:${k}`}

function descriptors(kind:SocialConnectionKind){
  if(kind==='taurine-network')return{label:'Répondre à une invitation qui revient',narrative:'Une personne déjà croisée dans le milieu taurin reprend contact. Ce n’est pas forcément quelqu’un qui deviendra proche : certaines connaissances reviennent simplement de temps en temps au fil des saisons.'};
  if(kind==='friend-network')return{label:'Revoir quelqu’un croisé par des amis',narrative:'Un lien né autour d’amis revient naturellement dans le paysage. Marion peut donner suite, rester sur quelque chose de léger ou laisser cette connaissance repartir en arrière-plan.'};
  if(kind==='couple-circle')return{label:'Retrouver des gens déjà vus ensemble',narrative:'Des personnes déjà croisées par Marion et Lucas proposent de se revoir. Leur cercle commun peut se construire sans remplacer les amitiés que chacun garde de son côté.'};
  return{label:'Donner suite à une connaissance locale',narrative:'Une connaissance rencontrée dans la vie quotidienne réapparaît après un certain temps. Le lien peut rester occasionnel ou devenir plus familier selon ce qui est réellement vécu.'};
}

export function recordSocialConnection(source:string){
  const s=read();if(!s)return false;const day=n(s.day,1),f=s.flags||(s.flags={});
  const kind:SocialConnectionKind=/taurine/i.test(source)?'taurine-network':/friends|marion-solo/i.test(source)?'friend-network':/with-lucas|day-social/i.test(source)?'couple-circle':'local-contact';
  const slot=hash(`${source}:${Math.floor(day/45)}`)%3;const id=`${kind}-${slot}`;
  const strengthKey=threadKey(id,'strength'),encountersKey=threadKey(id,'encounters');
  if(!n(f[threadKey(id,'firstDay')]))f[threadKey(id,'firstDay')]=day;
  f[threadKey(id,'lastDay')]=day;f[encountersKey]=n(f[encountersKey])+1;f[strengthKey]=Math.min(100,n(f[strengthKey],18)+8+(kind==='friend-network'?4:0));f[threadKey(id,'kind')]=kind;
  s.eventHistory=[...(s.eventHistory||[]),`social-connection:${id}:${day}`].slice(-300);
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}
}

export function getSocialConnectionThreads():SocialConnectionThread[]{
  const s=read();if(!s)return[];const f=s.flags||{},day=n(s.day,1),out:SocialConnectionThread[]=[];
  for(const kind of ['friend-network','taurine-network','local-contact','couple-circle'] as SocialConnectionKind[]){for(let slot=0;slot<3;slot++){const id=`${kind}-${slot}`,first=n(f[threadKey(id,'firstDay')]);if(!first)continue;const last=n(f[threadKey(id,'lastDay')],first),strength=n(f[threadKey(id,'strength')],18),encounters=n(f[threadKey(id,'encounters')],1);const gap=day-last;const active=strength>=18&&gap<900;out.push({id,kind,strength,firstDay:first,lastDay:last,encounters,active,reason:gap>365?'Ce lien n’a pas disparu, mais il est devenu très occasionnel.':encounters>=3?'Cette connaissance revient assez régulièrement pour commencer à faire partie du paysage social.':'Le lien existe encore sans être devenu une amitié imposée.'});}}
  return out;
}

export function getSocialConnectionFollowUp():SocialConnectionFollowUp|null{
  const s=read();if(!s)return null;const day=n(s.day,1),annual=getAnnualLifeProfile();const eligible=getSocialConnectionThreads().filter(t=>t.active&&day-t.lastDay>=21);
  if(!eligible.length)return null;const candidates=eligible.filter(t=>annualBeatAllowed(`social-followup:${t.id}`,{cooldownYears:1}));if(!candidates.length)return null;
  const chosen=candidates[hash(`social-followup:${day}:${annual?.lifeYear||1}`)%candidates.length];const gap=day-chosen.lastDay;
  const gate=Math.min(55,14+chosen.strength/2+Math.min(18,gap/20));if(hash(`social-followup-gate:${chosen.id}:${Math.floor(day/7)}`)%100>=gate)return null;
  const d=descriptors(chosen.kind);return{id:`followup-${chosen.id}`,threadId:chosen.id,kind:chosen.kind,label:d.label,intent:`social-outing:followup:${chosen.id}`,weight:annualWeight('social',Math.min(76,42+Math.round(chosen.strength/3))),minutes:chosen.kind==='taurine-network'?120:90,narrative:d.narrative};
}

declare global{interface Window{__moniaSocialConnections?:()=>SocialConnectionThread[];__moniaSocialConnectionFollowUp?:()=>SocialConnectionFollowUp|null;__moniaRecordSocialConnection?:(source:string)=>boolean}}
window.__moniaSocialConnections=getSocialConnectionThreads;window.__moniaSocialConnectionFollowUp=getSocialConnectionFollowUp;window.__moniaRecordSocialConnection=recordSocialConnection;
