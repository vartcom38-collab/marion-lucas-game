import { getLucasCareerEvolution } from './lucas-career-evolution';
import { getTaurineCareerSeason } from './taurine-career-season';
import { getAnnualLifeProfile } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;stress?:number;energy?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type CareerPressureLevel='low'|'steady'|'high'|'peak';
export type CareerPressureSnapshot={level:CareerPressureLevel;score:number;needsProtection:boolean;mediaHeat:'quiet'|'present'|'strong';restPriority:number;privateLifePriority:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function recent(history:string[],pattern:RegExp,limit=80){return history.slice(-limit).filter(e=>pattern.test(e)).length}

export function getTaurineCareerPressure():CareerPressureSnapshot|null{
  const s=read();if(!s)return null;const career=getLucasCareerEvolution();const season=getTaurineCareerSeason();const annual=getAnnualLifeProfile();const h=s.eventHistory||[];
  const triumphs=recent(h,/corrida-result:triumph/),difficult=recent(h,/corrida-result:difficult/),busyMedia=recent(h,/corrida-media:busy/),travel=recent(h,/travel|torero-travel|corrida-next-day:travel/);
  const stress=n(s.stress),energy=n(s.energy,70);
  let score=(season?.targetDensity||45)*0.42+(career?.prestigeFactor||55)*0.24+(busyMedia*4)+(travel*1.6)+(triumphs*2.2)-(difficult*1.2)+(stress*0.18)+((100-energy)*0.12);
  if(career?.phase==='selective'||career?.phase==='veteran')score-=8;
  if(annual?.tone==='home'||annual?.tone==='couple')score-=5;
  score=clamp(Math.round(score),0,100);
  const level:CareerPressureLevel=score>=78?'peak':score>=61?'high':score>=38?'steady':'low';
  const mediaHeat=busyMedia>=4||triumphs>=5?'strong':busyMedia>=1||triumphs>=2?'present':'quiet';
  const needsProtection=level==='peak'||stress>=75||energy<35;
  return{level,score,needsProtection,mediaHeat,restPriority:clamp(Math.round((100-energy)*0.65+stress*0.35+(needsProtection?18:0)),0,100),privateLifePriority:clamp(Math.round((annual?.coupleBias||50)*0.45+(annual?.homeBias||50)*0.35+(needsProtection?20:0)),0,100),reason:'La pression taurine dépend du rythme de saison, de la notoriété, des voyages, des résultats, de la presse et de la fatigue. Elle peut monter ou retomber sans changer artificiellement les villes.'};
}

declare global{interface Window{__moniaTaurineCareerPressure?:()=>CareerPressureSnapshot|null}}
window.__moniaTaurineCareerPressure=getTaurineCareerPressure;
