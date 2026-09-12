const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;lucasAge?:number;official?:boolean;flags?:Record<string,unknown>;eventHistory?:string[]};
export type LucasCareerPhase='rising'|'prime'|'established'|'selective'|'veteran';
export type LucasCareerEvolution={
  lifeYear:number;
  age:number;
  phase:LucasCareerPhase;
  workloadFactor:number;
  prestigeFactor:number;
  recoveryNeed:number;
  variability:number;
  retirementForced:false;
  repeatMajorCities:true;
  principle:string;
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function lifeYear(day:number){return Math.floor((Math.max(1,day)-1)/365)+1}
function resultMomentum(history:string[]){let score=0;for(const e of history.slice(-120)){if(e==='corrida-result:triumph')score+=3;else if(e==='corrida-result:solid')score+=1;else if(e==='corrida-result:difficult')score-=2;else if(/injury|accident/i.test(e))score-=4;}return clamp(score,-12,16)}
function phaseFor(age:number,year:number,momentum:number):LucasCareerPhase{
  if(age<=25&&year<=4)return'rising';
  if(age<=32||momentum>=10)return'prime';
  if(age<=38)return'established';
  if(age<=45)return'selective';
  return'veteran';
}

export function getLucasCareerEvolution():LucasCareerEvolution|null{
  const s=read();if(!s)return null;const year=lifeYear(n(s.day,1));const age=n(s.lucasAge,22)+Math.max(0,year-1);const momentum=resultMomentum(s.eventHistory||[]);const phase=phaseFor(age,year,momentum);const yearlyNoise=(hash(`lucas-career:${year}`)%21)-10;
  const baseWork=phase==='rising'?82:phase==='prime'?92:phase==='established'?78:phase==='selective'?58:42;
  const prestigeBase=phase==='rising'?46:phase==='prime'?82:phase==='established'?90:phase==='selective'?92:88;
  const recoveryBase=phase==='rising'?36:phase==='prime'?42:phase==='established'?53:phase==='selective'?67:78;
  return{
    lifeYear:year,
    age,
    phase,
    workloadFactor:clamp(baseWork+yearlyNoise+Math.round(momentum*1.2),25,100),
    prestigeFactor:clamp(prestigeBase+Math.round(momentum*1.5),25,100),
    recoveryNeed:clamp(recoveryBase-Math.round(momentum/3),20,95),
    variability:45+(hash(`lucas-career-var:${year}`)%46),
    retirementForced:false,
    repeatMajorCities:true,
    principle:'La carrière évolue avec les années, les résultats et la récupération. Les grandes villes peuvent revenir souvent. Le jeu ne force pas une retraite à un âge arbitraire : le rythme devient progressivement plus sélectif si cela correspond à la trajectoire vécue.'
  };
}

export function careerScheduleFactor(){const c=getLucasCareerEvolution();return c?c.workloadFactor/75:1}
export function careerRecoveryFactor(){const c=getLucasCareerEvolution();return c?c.recoveryNeed/50:1}

declare global{interface Window{__moniaLucasCareer?:()=>LucasCareerEvolution|null;__moniaCareerScheduleFactor?:()=>number;__moniaCareerRecoveryFactor?:()=>number}}
window.__moniaLucasCareer=getLucasCareerEvolution;
window.__moniaCareerScheduleFactor=careerScheduleFactor;
window.__moniaCareerRecoveryFactor=careerRecoveryFactor;
