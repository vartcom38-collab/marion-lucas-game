import { getAnnualLifeProfile } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;marionAge?:number;official?:boolean;engaged?:boolean;married?:boolean;children?:number;stress?:number;energy?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SocialLifeStage='early-adult'|'young-couple'|'established-couple'|'young-family'|'family-years'|'mature-couple';
export type SocialLifeStageSnapshot={stage:SocialLifeStage;lifeYear:number;socialEnergy:number;lateNightWeight:number;friendWeight:number;coupleWeight:number;formalEventWeight:number;familyFriendlyWeight:number;spontaneity:number;narrative:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}

export function getSocialLifeStage():SocialLifeStageSnapshot|null{
  const s=read();if(!s)return null;const annual=getAnnualLifeProfile();const lifeYear=annual?.lifeYear||Math.floor((Math.max(1,n(s.day,1))-1)/365)+1;
  const baseAge=n(s.marionAge,20);const age=baseAge+Math.max(0,lifeYear-1);const kids=n(s.children);let stage:SocialLifeStage='early-adult';
  if(kids>0&&age<33)stage='young-family';else if(kids>0&&age<46)stage='family-years';else if(age>=46)stage='mature-couple';else if(s.married||age>=30)stage='established-couple';else if(s.official)stage='young-couple';
  const yearDrift=(hash(`social-stage:${lifeYear}:${stage}`)%17)-8;const stress=n(s.stress),energy=n(s.energy,70);
  const presets:Record<SocialLifeStage,{late:number;friend:number;couple:number;formal:number;family:number;spont:number}>={
    'early-adult':{late:78,friend:76,couple:42,formal:24,family:18,spont:82},
    'young-couple':{late:68,friend:68,couple:76,formal:42,family:22,spont:72},
    'established-couple':{late:48,friend:58,couple:72,formal:62,family:38,spont:54},
    'young-family':{late:24,friend:46,couple:56,formal:34,family:82,spont:34},
    'family-years':{late:28,friend:52,couple:60,formal:48,family:74,spont:40},
    'mature-couple':{late:36,friend:54,couple:68,formal:58,family:56,spont:46}
  };
  const p=presets[stage];const socialEnergy=clamp(Math.round(energy-stress*0.32+(annual?.socialBias||50)*0.36+yearDrift),12,92);
  const narrative=stage==='early-adult'?'La vie sociale peut être spontanée, tardive et très ouverte, sans que tout doive tourner autour du couple.':stage==='young-couple'?'Leur vie sociale mélange encore beaucoup les amis, les sorties improvisées et les premières invitations vécues à deux.':stage==='established-couple'?'Les sorties sont moins dictées par la nouveauté et davantage par les habitudes, les invitations choisies et les gens qui comptent vraiment.':stage==='young-family'?'Les sorties existent toujours, mais elles demandent davantage d’organisation et les soirées très tardives deviennent moins centrales.':stage==='family-years'?'La vie sociale alterne entre amis, famille, événements choisis et moments où chacun garde ses propres plans.':'Avec les années, ils sortent moins pour remplir la soirée que pour voir les bonnes personnes, accepter une belle invitation ou simplement profiter d’un moment dehors.';
  return{stage,lifeYear,socialEnergy,lateNightWeight:clamp(p.late+yearDrift,8,92),friendWeight:clamp(p.friend+yearDrift,12,92),coupleWeight:clamp(p.couple+yearDrift,12,92),formalEventWeight:clamp(p.formal+yearDrift,8,92),familyFriendlyWeight:clamp(p.family+yearDrift,8,94),spontaneity:clamp(p.spont+yearDrift,8,94),narrative};
}

declare global{interface Window{__moniaSocialLifeStage?:()=>SocialLifeStageSnapshot|null}}
window.__moniaSocialLifeStage=getSocialLifeStage;
