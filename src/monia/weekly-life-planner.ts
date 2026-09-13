import { annualWeight, getAnnualLifeProfile } from './annual-life-variation';
import { getResidenceSnapshot } from './residence-base-life';
import { getCurrentPlaceHistory } from './place-history-life';
import { getPostpartumRhythm } from './postpartum-family-life';
import { getFamilyDevelopmentSnapshot } from './child-development-life';

const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;owner?:string;title?:string;note?:string};
type Save={day?:number;place?:string;official?:boolean;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type WeekPath='follow-lucas'|'stay-home'|'join-later'|'own-agenda'|'mixed';
export type WeekPlan={day:number;taurineDays:number;personalDays:number;decisionNeeded:boolean;recommended:WeekPath;choices:Array<{id:WeekPath;label:string;reason:string}>;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function isLucasTaurine(i:CalendarItem){return i.owner==='Lucas'&&/corrida|feria|toros|arène|arena|entraînement|déplacement|deplacement/i.test(`${i.title||''} ${i.note||''}`)}
function isMarionPlan(i:CalendarItem){return i.owner!=='Lucas'}
function livedHomeWeight(){
  const residence=getResidenceSnapshot();const history=getCurrentPlaceHistory();
  if(!residence.isHome)return{bonus:-8,label:'Ici, Marion est de passage : cette semaine ne doit pas être artificiellement traitée comme une routine domestique.'};
  const depth=history?.tier==='deeply-lived'?14:history?.tier==='important'?10:history?.tier==='anchored'?6:history?.tier==='familiar'?3:0;
  const shared=residence.kind==='shared-home'?4:0;
  return{bonus:depth+shared,label:history&&history.tier!=='new'?`Cette base porte déjà ${history.tier==='deeply-lived'?'plusieurs années de vie':history.tier==='important'?'une histoire importante':history.tier==='anchored'?'des habitudes solides':'des repères familiers'}.`:'Cette base est encore récente : ses habitudes peuvent évoluer librement.'};
}

export function getWeeklyLifePlan():WeekPlan|null{
  const s=read();if(!s)return null;const day=Math.max(1,Number(s.day||1));const week=(s.calendar||[]).filter(i=>Number(i.day||0)>=day&&Number(i.day||0)<=day+6);const taurine=week.filter(isLucasTaurine);const personal=week.filter(isMarionPlan);const decisionNeeded=!!s.official&&taurine.length>0;const annual=getAnnualLifeProfile();const home=livedHomeWeight();const postpartum=getPostpartumRhythm();const family=getFamilyDevelopmentSnapshot();
  const recoveryWeight=postpartum.active?Math.round(postpartum.sleepPressure*.32):0;
  const postpartumTravelPenalty=postpartum.active?Math.round(postpartum.travelFriction*.48):0;
  const postpartumOutingPenalty=postpartum.active?Math.round(postpartum.outingFriction*.28):0;
  const familyStructureBonus=postpartum.active?0:Math.round(family.structuredWeekWeight*.14);
  const familyTravelPenalty=postpartum.active?0:Math.round(family.travelFriction*.22);
  const familyOutingPenalty=postpartum.active?0:Math.round(family.outingFriction*.12);
  const candidates:Array<{id:WeekPath;score:number}>=[
    {id:'follow-lucas',score:annualWeight('travel',taurine.length>=3?70:42)+(personal.length===0?12:0)+(home.bonus<0?4:0)-postpartumTravelPenalty-familyTravelPenalty},
    {id:'stay-home',score:annualWeight('home',personal.length>=2?66:44)+home.bonus+recoveryWeight+familyStructureBonus},
    {id:'join-later',score:annualWeight('couple',taurine.length>=2&&personal.length>0?72:46)+Math.round(home.bonus/3)-Math.round(postpartumTravelPenalty*.65)-Math.round(familyTravelPenalty*.6)},
    {id:'own-agenda',score:annualWeight('career',personal.length>=2?78:40)+(home.bonus>0?Math.round(home.bonus/2):0)-postpartumOutingPenalty-familyOutingPenalty},
    {id:'mixed',score:annualWeight('mixed',58)+Math.round(home.bonus/4)-Math.round(postpartumOutingPenalty*.5)+Math.round(family.autonomyRelief*.08)}
  ];
  let recommended=candidates.sort((a,b)=>b.score-a.score)[0].id;
  if(!decisionNeeded)recommended=postpartum.active?'stay-home':personal.length>=2?'own-agenda':family.children.length?'mixed':'mixed';
  const yearText=annual?` Cette année, le rythme général tire davantage vers ${annual.tone==='home'?'la vie à la maison':annual.tone==='social'?'les liens sociaux':annual.tone==='travel'?'les déplacements':annual.tone==='career'?'les projets personnels':annual.tone==='couple'?'la vie de couple':'un équilibre plus imprévisible'}.`:'';
  const homeText=` ${home.label}`;const recoveryText=postpartum.active?` ${postpartum.reason}`:'';const familyText=!postpartum.active&&family.children.length?` ${family.reason}`:'';
  return{day,taurineDays:taurine.length,personalDays:personal.length,decisionNeeded,recommended,choices:[
    {id:'follow-lucas',label:'Le suivre pendant sa tournée',reason:`Partage des trajets de corrida, hôtels, arènes et temps morts de sa semaine professionnelle.${yearText}${recoveryText}${familyText}`},
    {id:'stay-home',label:'Rester à la maison',reason:`Marion garde son rythme, ses rendez-vous et sa vie propre pendant que Lucas travaille.${yearText}${homeText}${recoveryText}${familyText}`},
    {id:'join-later',label:'Le rejoindre plus tard',reason:`Le couple vit quelques jours séparément avant de se retrouver dans une autre ville.${yearText}${recoveryText}${familyText}`},
    {id:'own-agenda',label:'Prioriser mes propres rendez-vous',reason:`Les engagements de Marion passent avant l’accompagnement de Lucas.${yearText}${homeText}${recoveryText}${familyText}`},
    {id:'mixed',label:'Faire un peu des deux',reason:`Accompagner certains jours et garder de l’espace pour sa propre vie.${yearText}${homeText}${recoveryText}${familyText}`}
  ]};
}

export function chooseWeeklyPath(path:WeekPath){const s=read();if(!s)return false;const f=s.flags||(s.flags={});const residence=getResidenceSnapshot();const history=getCurrentPlaceHistory();f.weekPath=path;f.weekPathDay=Number(s.day||1);if(['stay-home','own-agenda','mixed'].includes(path)&&residence.isHome){f.weekRoutineBasePlace=String(s.place||'');f.weekRoutineBaseKind=residence.kind;f.weekRoutineBaseDay=Number(s.day||1);f.weekRoutineBaseHistoryTier=history?.tier||'new';}s.eventHistory=[...(s.eventHistory||[]),`week-path:${path}`].slice(-160);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}

declare global{interface Window{__moniaWeeklyLifePlan?:()=>WeekPlan|null;__moniaChooseWeeklyPath?:(p:WeekPath)=>boolean}}
window.__moniaWeeklyLifePlan=getWeeklyLifePlan;window.__moniaChooseWeeklyPath=chooseWeeklyPath;
