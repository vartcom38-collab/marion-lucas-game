import { getAnnualLifeProfile } from './annual-life-variation';
import { getChildcareSnapshot } from './childcare-life';

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
  const yearDrift=(hash(`social-stage:${lifeYear}:${stage}`)%17)-8;const stress=n(s.stress),energy=n(s.energy,70);const childcare=getChildcareSnapshot('outing');
  const presets:Record<SocialLifeStage,{late:number;friend:number;couple:number;formal:number;family:number;spont:number}>={
    'early-adult':{late:78,friend:76,couple:42,formal:24,family:18,spont:82},
    'young-couple':{late:68,friend:68,couple:76,formal:42,family:22,spont:72},
    'established-couple':{late:52,friend:60,couple:74,formal:62,family:38,spont:58},
    'young-family':{late:58,friend:62,couple:68,formal:52,family:74,spont:58},
    'family-years':{late:54,friend:60,couple:66,formal:58,family:70,spont:54},
    'mature-couple':{late:42,friend:56,couple:70,formal:60,family:56,spont:48}
  };
  const p=presets[stage];const freedomBoost=kids>0&&childcare?.available?8:0;const socialEnergy=clamp(Math.round(energy-stress*0.32+(annual?.socialBias||50)*0.36+yearDrift+freedomBoost),12,96);
  const narrative=stage==='early-adult'?'La vie sociale peut être spontanée, tardive et très ouverte, sans que tout doive tourner autour du couple.':stage==='young-couple'?'Leur vie sociale mélange encore beaucoup les amis, les sorties improvisées et les premières invitations vécues à deux.':stage==='established-couple'?'Les sorties sont moins dictées par la nouveauté et davantage par les habitudes, les invitations choisies et les gens qui comptent vraiment.':stage==='young-family'?'Avec les enfants, leur vie sociale continue vraiment : une nounou ou un autre mode de garde fiable leur permet de sortir, de suivre des invitations et de garder des soirées d’adultes quand ils en ont envie.':stage==='family-years'?'La vie familiale coexiste avec leurs sorties, leurs amis et les déplacements de Lucas. Les enfants demandent de l’organisation, pas un renoncement automatique.':'Avec les années, ils choisissent davantage leurs sorties, mais restent libres d’avoir une vraie vie sociale.';
  return{stage,lifeYear,socialEnergy,lateNightWeight:clamp(p.late+yearDrift+freedomBoost,8,94),friendWeight:clamp(p.friend+yearDrift+freedomBoost,12,94),coupleWeight:clamp(p.couple+yearDrift+freedomBoost,12,94),formalEventWeight:clamp(p.formal+yearDrift+freedomBoost,8,94),familyFriendlyWeight:clamp(p.family+yearDrift,8,94),spontaneity:clamp(p.spont+yearDrift+Math.round(freedomBoost/2),8,94),narrative};
}

declare global{interface Window{__moniaSocialLifeStage?:()=>SocialLifeStageSnapshot|null}}
window.__moniaSocialLifeStage=getSocialLifeStage;
