import { getAnnualLifeProfile } from './annual-life-variation';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';
import { getLucasCareerEvolution } from './lucas-career-evolution';

const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type TaurineSeasonIntensity='light'|'balanced'|'busy'|'very-busy';
export type TaurineCareerSeason={
  lifeYear:number;
  intensity:TaurineSeasonIntensity;
  rhythm:'quiet'|'opening'|'active'|'closing';
  targetDensity:number;
  repeatCitiesAllowed:true;
  repeatFeriasAllowed:true;
  cityNoveltyIsOptional:true;
  principle:string;
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}

export function getTaurineCareerSeason():TaurineCareerSeason|null{
  const s=read();if(!s)return null;const annual=getAnnualLifeProfile();const seasonal=getSeasonalLifeSnapshot();const career=getLucasCareerEvolution();const year=annual?.lifeYear||Math.floor((Math.max(1,n(s.day,1))-1)/365)+1;const roll=hash(`taurine-season:${year}`)%100;
  const intensity:TaurineSeasonIntensity=roll<18?'light':roll<60?'balanced':roll<88?'busy':'very-busy';
  const base=intensity==='light'?34:intensity==='balanced'?52:intensity==='busy'?68:82;
  const rhythm=seasonal?.taurineRhythm||'quiet';
  const seasonalDelta=rhythm==='active'?14:rhythm==='opening'?7:rhythm==='closing'?-5:-18;
  const annualDelta=annual?Math.round((annual.careerBias-50)/3):0;
  const careerDelta=career?Math.round((career.workloadFactor-70)/3):0;
  return{lifeYear:year,intensity,rhythm,targetDensity:Math.max(8,Math.min(95,base+seasonalDelta+annualDelta+careerDelta)),repeatCitiesAllowed:true,repeatFeriasAllowed:true,cityNoveltyIsOptional:true,principle:'Les mêmes villes et les mêmes ferias peuvent revenir plusieurs années. Ce sont le rythme, le cartel, le résultat, la fatigue, les déplacements et la vie autour qui doivent varier, pas la géographie à tout prix.'};
}

export function cityCanRepeat(_city:string){return true}
export function taurineScheduleWeight(base:number){const p=getTaurineCareerSeason();if(!p)return base;return Math.max(5,Math.round(base*(0.7+p.targetDensity/100)))}

declare global{interface Window{__moniaTaurineCareerSeason?:()=>TaurineCareerSeason|null;__moniaTaurineCityCanRepeat?:(city:string)=>boolean;__moniaTaurineScheduleWeight?:(base:number)=>number}}
window.__moniaTaurineCareerSeason=getTaurineCareerSeason;
window.__moniaTaurineCityCanRepeat=cityCanRepeat;
window.__moniaTaurineScheduleWeight=taurineScheduleWeight;
