import { getAnnualLifeProfile, annualBeatAllowed, annualWeight } from './annual-life-variation';
import { getHomeLifeEvolution } from './home-life-evolution';
import { getFamilyRelationshipEvolution, type FamilySide } from './family-relationship-evolution';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;married?:boolean;children?:number;relationship?:number;trust?:number;stress?:number;energy?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ExtendedFamilySide='marion'|'lucas'|'both';
export type ExtendedFamilyBeatKind='quick-visit'|'family-meal'|'child-support'|'stay-over'|'phone-before-visit'|'quiet-passage';
export type ExtendedFamilyBeat={id:string;side:ExtendedFamilySide;kind:ExtendedFamilyBeatKind;label:string;intent:string;weight:number;minutes:number;narrative:string;ordinary:true;rare:false;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function recent(history:string[],re:RegExp,limit=140){return history.slice(-limit).filter(e=>re.test(e)).length}
function homeLike(place:string){return /home|maison|appartement|finca|chez eux|domicile/i.test(place)}
function pickSide(day:number,year:number):ExtendedFamilySide{
  const marion=getFamilyRelationshipEvolution('marion'),lucas=getFamilyRelationshipEvolution('lucas');
  if(!marion&&!lucas)return hash(`family-side:${day}:${year}`)%2===0?'marion':'lucas';
  const bothRoom=Math.min(marion?.visitWeight||0,lucas?.visitWeight||0);
  if(bothRoom>=54&&hash(`family-both:${day}:${year}`)%100<18)return'both';
  const mw=marion?.visitWeight||25,lw=lucas?.visitWeight||25,total=mw+lw;
  return hash(`family-side:${day}:${year}`)%Math.max(1,total)<mw?'marion':'lucas';
}
function relationFor(side:ExtendedFamilySide){if(side==='both')return null;return getFamilyRelationshipEvolution(side as FamilySide)}

export function getExtendedFamilyBeat():ExtendedFamilyBeat|null{
  const s=read();if(!s||!s.official||!homeLike(String(s.place||'')))return null;
  const now=mins(s.time);if(now<600||now>1290)return null;
  const evolution=getHomeLifeEvolution();if(!evolution)return null;
  const energy=n(s.energy,70),stress=n(s.stress);if(energy<34||stress>78)return null;
  const annual=getAnnualLifeProfile(),h=s.eventHistory||[],day=n(s.day,1),kids=n(s.children),slot=Math.floor(now/150),year=annual?.lifeYear||1;
  const familyRecent=recent(h,/extended-family|family-visit|family-meal|family-house-flow/i,110);
  const socialRoom=Math.max(0,Math.round(((annual?.socialBias||50)+(evolution.familyWeight||45))/2)-familyRecent*8);
  const seed=hash(`extended-family:${day}:${slot}:${year}:${evolution.mode}`)%100;
  if(seed>=Math.max(7,Math.min(38,Math.round(socialRoom/3))))return null;

  const side=pickSide(day,year),relation=relationFor(side);
  if(relation?.distanceSeason&&hash(`family-distance-gate:${day}:${slot}:${side}`)%100<64)return null;
  const candidates:ExtendedFamilyBeat[]=[];
  const add=(b:ExtendedFamilyBeat,cooldownYears=1)=>{if(annualBeatAllowed(`extended-family:${b.id}`,{cooldownYears}))candidates.push(b)};
  const sideLabel=side==='marion'?'de Marion':side==='lucas'?'de Lucas':'des deux côtés';
  const visitBoost=side==='both'?0:Math.round(((relation?.visitWeight||50)-50)/5);
  const supportBoost=side==='both'?0:Math.round(((relation?.supportWeight||50)-50)/5);

  add({id:`quiet-passage-${side}`,side,kind:'quiet-passage',label:'Profiter d’un passage familial tranquille',intent:`extended-family-quiet:${side}`,weight:annualWeight('home',56)+visitBoost,minutes:45,narrative:`Un proche de la famille ${sideLabel} passe simplement un moment. Pas de grand programme : quelques nouvelles, la maison continue de vivre, puis chacun repart à son rythme.`,ordinary:true,rare:false},2);
  if(now>=690&&now<870||now>=1110&&now<1260)add({id:`meal-${side}`,side,kind:'family-meal',label:'Partager un repas avec la famille',intent:`extended-family-meal:${side}`,weight:annualWeight('home',63)+visitBoost,minutes:85,narrative:`Un repas avec la famille ${sideLabel} s’insère naturellement dans la journée. Il peut être chaleureux, animé ou très simple sans devenir un événement exceptionnel.`,ordinary:true,rare:false},2);
  if(kids>0&&evolution.familyWeight>=52)add({id:`children-${side}`,side,kind:'child-support',label:'Laisser les proches profiter un peu des enfants',intent:`extended-family-children:${side}`,weight:annualWeight('home',68)+supportBoost,minutes:75,narrative:`Avec les enfants, les proches prennent parfois davantage de place dans la maison. Ils passent voir la famille, donnent un coup de main ou restent un peu pendant que Marion et Lucas soufflent.`,ordinary:true,rare:false},1);
  if(evolution.mode==='open-house'&&energy>55&&!relation?.distanceSeason)add({id:`longer-${side}`,side,kind:'stay-over',label:'Laisser la visite se prolonger',intent:`extended-family-stay:${side}`,weight:annualWeight('social',61)+visitBoost,minutes:110,narrative:`La visite familiale se prolonge un peu. Rien n’oblige à en faire une réception : on parle, on mange peut-être quelque chose, les gens vont et viennent dans la maison.`,ordinary:true,rare:false},3);
  add({id:`check-before-${side}`,side,kind:'phone-before-visit',label:'Voir si la famille passe plus tard',intent:`extended-family-phone:${side}`,weight:annualWeight('social',44)+(relation?.returnSeason?10:0),minutes:10,narrative:`Un message ou un appel suffit parfois pour savoir si quelqu’un de la famille ${sideLabel} passera plus tard. La journée ne s’organise pas forcément autour de ça.`,ordinary:true,rare:false},2);
  if(!candidates.length)return null;
  return candidates.sort((a,b)=>b.weight-a.weight)[hash(`extended-family-pick:${day}:${slot}:${side}:${evolution.preferredZone}`)%Math.min(3,candidates.length)];
}

declare global{interface Window{__moniaExtendedFamilyBeat?:()=>ExtendedFamilyBeat|null}}
window.__moniaExtendedFamilyBeat=getExtendedFamilyBeat;
