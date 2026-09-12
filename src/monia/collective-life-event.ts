import { getAnnualLifeProfile, annualBeatAllowed, annualWeight, markAnnualBeat } from './annual-life-variation';
import { getCloseCircleMembers } from './close-circle-life';
import { getChildcareSnapshot } from './childcare-life';
import { recordSharedMemory } from './shared-memory-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;children?:number;official?:boolean;married?:boolean;energy?:number;stress?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type CollectiveMomentKind='birthday'|'big-meal'|'celebration'|'close-holiday'|'children-gathering';
export type CollectiveMoment={id:string;kind:CollectiveMomentKind;label:string;intent:string;weight:number;minutes:number;narrative:string;rare:true;closeCircleSize:number;childcareAvailable:boolean;};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function recent(h:string[]){return h.slice(-180).filter(e=>/collective-life:|close-circle:(birthday|holiday|weekend)/i.test(e)).length}
export function getCollectiveLifeMoment():CollectiveMoment|null{
  const s=read();if(!s||!s.official)return null;const day=n(s.day,1),energy=n(s.energy,70),stress=n(s.stress),annual=getAnnualLifeProfile();
  if(day<90||energy<30||stress>86)return null;const circle=getCloseCircleMembers().filter(m=>m.stable);if(circle.length<1)return null;
  const history=s.eventHistory||[],seen=recent(history);const lifeYear=annual?.lifeYear||1;
  const baseGate=Math.max(2,Math.min(12,4+Math.floor(circle.length/2)+(annual?.socialBias||50)/25-seen*2));
  if(hash(`collective-gate:${lifeYear}:${Math.floor(day/21)}`)%100>=baseGate)return null;
  const kids=n(s.children),childcare=getChildcareSnapshot('outing');
  const pool:CollectiveMomentKind[]=['birthday','big-meal','celebration','close-holiday'];if(kids>0)pool.push('children-gathering');
  const kind=pool[hash(`collective-kind:${lifeYear}:${Math.floor(day/30)}:${circle.length}`)%pool.length];
  const cooldown=kind==='birthday'?1:kind==='big-meal'?2:3;if(!annualBeatAllowed(`collective-life:${kind}`,{cooldownYears:cooldown}))return null;
  const common={rare:true as const,closeCircleSize:circle.length,childcareAvailable:childcare?.available!==false};
  if(kind==='birthday')return{id:'collective-birthday',kind,label:'Fêter un anniversaire avec les gens qui comptent',intent:'collective-life:birthday',weight:annualWeight('social',74),minutes:180,narrative:'Un anniversaire peut réunir naturellement le vrai cercle proche. Ce n’est pas une fête automatique chaque année : seulement quand le rythme de leur vie et les liens construits rendent ce moment crédible.',...common};
  if(kind==='big-meal')return{id:'collective-big-meal',kind,label:'Réunir quelques proches autour d’un grand repas',intent:'collective-life:big-meal',weight:annualWeight('home',70),minutes:210,narrative:'De temps en temps, plusieurs personnes importantes se retrouvent autour de la même table. Parce que ces moments sont rares, ils gardent une vraie valeur au lieu de devenir une routine.',...common};
  if(kind==='celebration')return{id:'collective-celebration',kind,label:'Profiter d’une occasion avec le cercle proche',intent:'collective-life:celebration',weight:annualWeight('social',68),minutes:170,narrative:'Une occasion peut réunir amis proches et famille sans devenir automatiquement une grande scène. Certains viennent, d’autres non, et la soirée garde le ton de cette période de leur vie.',...common};
  if(kind==='children-gathering')return{id:'collective-children',kind,label:'Partager un moment avec les proches autour des enfants',intent:'collective-life:children',weight:annualWeight('home',72),minutes:160,narrative:'Les enfants peuvent naturellement créer des moments collectifs avec les proches. Cela n’empêche jamais Marion et Lucas de garder aussi leurs sorties d’adultes grâce à la nounou et aux solutions de garde.',...common};
  return{id:'collective-close-holiday',kind,label:'Partir quelques jours avec des proches',intent:'collective-life:holiday',weight:annualWeight('travel',66),minutes:240,narrative:'Très ponctuellement, leur cercle proche peut partager quelques jours avec eux. Ce type de séjour reste exceptionnel afin que les vacances à deux, en famille ou séparément gardent aussi leur place.',...common};
}
export function consumeCollectiveLifeMoment(id:string){const s=read();if(!s)return false;const key=id.replace(/^collective-life[:-]?/,'');s.eventHistory=[...(s.eventHistory||[]),`collective-life:${key}:${n(s.day,1)}`].slice(-340);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));markAnnualBeat(`collective-life:${key}`);recordSharedMemory(`collective-life:${key}`);window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}
declare global{interface Window{__moniaCollectiveLife?:()=>CollectiveMoment|null;__moniaConsumeCollectiveLife?:(id:string)=>boolean}}
window.__moniaCollectiveLife=getCollectiveLifeMoment;window.__moniaConsumeCollectiveLife=consumeCollectiveLifeMoment;
