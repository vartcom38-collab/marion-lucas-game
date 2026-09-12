const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;owner?:string;title?:string;note?:string};
type Save={day?:number;place?:string;official?:boolean;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type WeekPath='follow-lucas'|'stay-home'|'join-later'|'own-agenda'|'mixed';
export type WeekPlan={day:number;taurineDays:number;personalDays:number;decisionNeeded:boolean;recommended:WeekPath;choices:Array<{id:WeekPath;label:string;reason:string}>;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function isLucasTaurine(i:CalendarItem){return i.owner==='Lucas'&&/corrida|feria|toros|arène|arena|entraînement|déplacement|deplacement/i.test(`${i.title||''} ${i.note||''}`)}
function isMarionPlan(i:CalendarItem){return i.owner!=='Lucas'}

export function getWeeklyLifePlan():WeekPlan|null{
  const s=read();if(!s)return null;const day=Math.max(1,Number(s.day||1));const week=(s.calendar||[]).filter(i=>Number(i.day||0)>=day&&Number(i.day||0)<=day+6);const taurine=week.filter(isLucasTaurine);const personal=week.filter(isMarionPlan);const decisionNeeded=!!s.official&&taurine.length>0;
  let recommended:WeekPath='mixed';
  if(taurine.length>=3&&personal.length===0)recommended='follow-lucas';
  else if(personal.length>=2)recommended='own-agenda';
  else if(taurine.length>=2&&personal.length>0)recommended='join-later';
  return{day,taurineDays:taurine.length,personalDays:personal.length,decisionNeeded,recommended,choices:[
    {id:'follow-lucas',label:'Le suivre pendant sa tournée',reason:'Partage des trajets, hôtels, arènes et temps morts de sa semaine professionnelle.'},
    {id:'stay-home',label:'Rester à la maison',reason:'Marion garde son rythme, ses rendez-vous et sa vie propre pendant que Lucas travaille.'},
    {id:'join-later',label:'Le rejoindre plus tard',reason:'Le couple vit quelques jours séparément avant de se retrouver dans une autre ville.'},
    {id:'own-agenda',label:'Prioriser mes propres rendez-vous',reason:'Les engagements de Marion passent avant l’accompagnement de Lucas.'},
    {id:'mixed',label:'Faire un peu des deux',reason:'Accompagner certains jours et garder de l’espace pour sa propre vie.'}
  ]};
}

export function chooseWeeklyPath(path:WeekPath){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f.weekPath=path;f.weekPathDay=Number(s.day||1);s.eventHistory=[...(s.eventHistory||[]),`week-path:${path}`].slice(-160);localStorage.setItem(SAVE_KEY,JSON.stringify(s));return true}

declare global{interface Window{__moniaWeeklyLifePlan?:()=>WeekPlan|null;__moniaChooseWeeklyPath?:(p:WeekPath)=>boolean}}
window.__moniaWeeklyLifePlan=getWeeklyLifePlan;window.__moniaChooseWeeklyPath=chooseWeeklyPath;
