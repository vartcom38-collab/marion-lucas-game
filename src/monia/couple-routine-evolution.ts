import { getAnnualLifeProfile, annualWeight } from './annual-life-variation';
import { getLucasHomeRhythm } from './lucas-home-rhythm';
import { getMarionHomeRhythm } from './marion-home-rhythm';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type CoupleRoutineKind='morning-coffee'|'shared-meal'|'parallel-evening'|'quiet-return'|'late-check-in'|'weekend-slow';
export type CoupleRoutineState='forming'|'familiar'|'strong'|'faded';
export type CoupleRoutine={id:string;kind:CoupleRoutineKind;state:CoupleRoutineState;label:string;narrative:string;intent:string;weight:number;minutes:number;year:number;recurring:true;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function count(history:string[],re:RegExp){return history.filter(e=>re.test(e)).length}
function lifeYear(day:number){return Math.floor((Math.max(1,day)-1)/365)+1}

function stateFor(score:number,year:number,kind:CoupleRoutineKind):CoupleRoutineState{
  const drift=(hash(`routine-drift:${year}:${kind}`)%21)-10;
  const v=score+drift;
  if(v>=14)return'strong';if(v>=7)return'familiar';if(v>=2)return'forming';return'faded';
}

export function getCoupleRoutine():CoupleRoutine|null{
  const s=read();if(!s||!s.official||n(s.relationship)<35||n(s.trust)<28)return null;
  const lucas=getLucasHomeRhythm(),marion=getMarionHomeRhythm();if(!lucas?.atHome||!marion?.atHome)return null;
  const now=mins(s.time),day=n(s.day,1),year=getAnnualLifeProfile()?.lifeYear||lifeYear(day),h=s.eventHistory||[];
  const baseShared=count(h,/shared-home-|shared-home-choice|couple-routine/i)+Math.floor(Math.min(20,n(s.relationship))/8)+Math.floor(Math.min(20,n(s.trust))/10);
  const candidates:Array<{kind:CoupleRoutineKind;window:boolean;score:number;label:string;narrative:string;intent:string;minutes:number;weight:number}>=[
    {kind:'morning-coffee',window:now>=390&&now<660,score:baseShared+count(h,/morning-routine|coffee|café/i),label:'Prendre notre café tranquillement',narrative:'Avec le temps, certains matins ont pris une forme familière : un café, peu de mots, chacun se réveille à son rythme. Ce n’est pas une obligation, juste une habitude qui peut encore exister aujourd’hui.',intent:'couple-routine-morning-coffee',minutes:25,weight:annualWeight('home',64)},
    {kind:'shared-meal',window:(now>=690&&now<870)||(now>=1110&&now<1290),score:baseShared+count(h,/shared-home-meal|meal|dîner|diner/i),label:'Garder notre repas habituel',narrative:'Un repas partagé est devenu l’un de ces repères qui reviennent sans avoir besoin d’être scénarisés. Certains jours ils le gardent, d’autres non.',intent:'couple-routine-shared-meal',minutes:45,weight:annualWeight('home',67)},
    {kind:'parallel-evening',window:now>=1170&&now<1380,score:baseShared+count(h,/shared-home-parallel|parallel/i),label:'Finir la soirée chacun dans notre coin, ensemble',narrative:'Ils ont aussi appris à être ensemble sans faire la même chose : un écran, un livre, du travail, du silence. Une routine douce, qui peut très bien disparaître certaines années puis revenir.',intent:'couple-routine-parallel-evening',minutes:50,weight:annualWeight('home',60)},
    {kind:'quiet-return',window:now>=1020&&now<1320,score:baseShared+count(h,/homecoming|quiet-nearby|return/i),label:'Retrouver notre calme en rentrant',narrative:'Après certaines journées, rentrer et ne rien prévoir est devenu un réflexe de couple. Pas systématique : juste une façon connue de se retrouver.',intent:'couple-routine-quiet-return',minutes:40,weight:annualWeight('couple',58)},
    {kind:'late-check-in',window:now>=1260&&now<1410,score:baseShared+count(h,/late|night|check-in/i),label:'Se raconter juste l’essentiel avant de dormir',narrative:'Certains soirs, ils ont pris l’habitude de se raconter seulement ce qui compte avant de dormir. Parfois cinq minutes suffisent.',intent:'couple-routine-late-check-in',minutes:15,weight:annualWeight('couple',56)},
    {kind:'weekend-slow',window:(day%7===6||day%7===0)&&now>=480&&now<780,score:baseShared+count(h,/slow-morning|weekend/i),label:'Garder une matinée sans urgence',narrative:'Avec les années, quelques matinées sans urgence ont fini par devenir un repère. Pas chaque semaine, pas à heure fixe : juste une habitude possible quand la vie laisse de la place.',intent:'couple-routine-weekend-slow',minutes:60,weight:annualWeight('home',62)}
  ];
  const eligible=candidates.filter(c=>c.window).map(c=>({...c,state:stateFor(c.score,year,c.kind)})).filter(c=>c.state!=='faded');
  if(!eligible.length)return null;const pick=eligible[hash(`routine:${day}:${Math.floor(now/120)}:${year}`)%eligible.length];
  const stateBoost=pick.state==='strong'?10:pick.state==='familiar'?5:0;
  return{id:`routine-${pick.kind}`,kind:pick.kind,state:pick.state,label:pick.label,narrative:pick.narrative,intent:pick.intent,weight:pick.weight+stateBoost,minutes:pick.minutes,year,recurring:true};
}

declare global{interface Window{__moniaCoupleRoutine?:()=>CoupleRoutine|null}}
window.__moniaCoupleRoutine=getCoupleRoutine;
