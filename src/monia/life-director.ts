import './daily-life-actions';
import './wedding-journey-engine';
import './pregnancy-journey-engine';
import './conception-bridge';
import './weekly-life-planner';
import './taurine-world-network';
import { getDailyLifeSnapshot } from './daily-life-engine';
import { getLongStayRoutine } from './long-stay-routine-life';

const SAVE_KEY='marion-lucas-save-v4';

export type LifeChoiceKind='story'|'phone'|'travel'|'self'|'wait';
export type LifeChoice={id:string;label:string;kind:LifeChoiceKind;action?:string;intent:string;weight:number};
export type LifeDirectorSnapshot={day:number;time:string;place:string;age:number;lifeYear:number;chapter:string;narrative:string;choices:LifeChoice[];freeActions:{phone:boolean;map:boolean;wardrobe:boolean;journal:boolean;customIntent?:boolean};surpriseBudget:{voice:boolean;cinematic:boolean;call:boolean;message:boolean};};

type Message={from?:string;text?:string;read?:boolean;day?:number};
type Save={day?:number;time?:string;place?:string;marionAge?:number;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;stress?:number;energy?:number;phoneUnread?:number;messages?:Message[];flags?:Record<string,unknown>;eventHistory?:string[];calendar?:Array<{day?:number;owner?:string;title?:string}>};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function ageFor(s:Save){const start=Number(s.marionAge||20);return start+Math.floor(Math.max(0,Number(s.day||1)-1)/365)}
function chapterFor(s:Save){const age=ageFor(s),met=!!s.metLucas,official=!!s.official;if(!met)return age<=21?'Une vie qui commence':'Trouver son rythme';if(!official)return'Ce qui se rapproche';if(age<25)return'Construire à deux';if(age<35)return'Choisir sa vie';if(age<50)return'Une vie pleine';return'Ce qui reste et grandit';}
function fallbackNarrative(s:Save){return Number(s.day||1)<=1?'Une nouvelle journée commence. Tu peux suivre une piste ou faire complètement autrement.':'Le moment reste ouvert. Tu peux suivre ce qui se présente ou décider autre chose.'}
function mapKind(kind:string):LifeChoiceKind{if(kind==='travel')return'travel';if(kind==='relationship'||kind==='social')return'phone';if(kind==='rest')return'wait';if(kind==='self'||kind==='obligation')return'self';return'story'}
function surpriseBudget(s:Save){const daily=getDailyLifeSnapshot();const met=!!s.metLucas,unread=Number(s.phoneUnread||0)>0,stress=Number(s.stress||0),energy=Number(s.energy||100);const allowance=daily?.pacing.surpriseAllowance??1;return{voice:met&&energy>20&&allowance>0,cinematic:met&&stress<80&&allowance>0,call:met&&allowance>0,message:unread||met};}
export function getLifeDirectorSnapshot():LifeDirectorSnapshot|null{
  const s=readSave();if(!s)return null;const day=Math.max(1,Number(s.day||1));const daily=getDailyLifeSnapshot();
  const choices:LifeChoice[]=(daily?.directions||[]).map(d=>({id:d.id,label:d.label,kind:mapKind(d.kind),intent:d.intent,weight:d.weight}));
  const stay=getLongStayRoutine();if(stay&&!choices.some(c=>c.id===stay.id)){choices.push({id:stay.id,label:stay.label,kind:'self',intent:stay.intent,weight:stay.weight});choices.sort((a,b)=>b.weight-a.weight);}
  const narrative=daily?.narrative||stay?.narrative||fallbackNarrative(s);
  return{day,time:String(s.time||'09:00'),place:String(s.place||'home'),age:ageFor(s),lifeYear:Math.floor((day-1)/365)+1,chapter:chapterFor(s),narrative,choices:choices.slice(0,5),freeActions:{phone:true,map:true,wardrobe:true,journal:true,customIntent:true},surpriseBudget:surpriseBudget(s)};
}

declare global{interface Window{__moniaLifeDirector?:()=>LifeDirectorSnapshot|null}}
window.__moniaLifeDirector=getLifeDirectorSnapshot;
