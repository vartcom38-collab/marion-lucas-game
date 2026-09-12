import { getAnnualLifeProfile, annualBeatAllowed, annualWeight, markAnnualBeat } from './annual-life-variation';
import { careerRecoveryFactor } from './lucas-career-evolution';

const SAVE_KEY='marion-lucas-save-v4';
type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;stress?:number;energy?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type CorridaSportResult='triumph'|'solid'|'mixed'|'difficult';
export type CorridaPhysicalState='fine'|'sore'|'bruised'|'minor-cut';
export type CorridaMediaLevel='quiet'|'light'|'busy';
export type CorridaAftermath={id:string;day:number;city:string;sport:CorridaSportResult;physical:CorridaPhysicalState;fatigue:number;media:CorridaMediaLevel;nextDay:'rest'|'travel'|'media'|'normal';created:true};
export type CorridaAftermathBeat={id:string;label:string;intent:string;kind:'relationship'|'rest'|'social'|'self';weight:number;minutes:number;narrative:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isCorrida(i:CalendarItem){return String(i.owner||'').toLowerCase()==='lucas'&&/corrida|arène|arena|plaza|toros/i.test(`${i.title||''} ${i.note||''}`)}
function todayCorrida(s:Save){const d=n(s.day,1);return(s.calendar||[]).find(i=>n(i.day)===d&&isCorrida(i))||null}
function cityOf(i:CalendarItem,s:Save){return String(i.place||s.place||'la ville').replace(/^h[oô]tel\s+/i,'').trim()||'la ville'}
function stored(s:Save){const v=s.flags?.corridaAftermath;return v&&typeof v==='object'?v as CorridaAftermath:null}
function eventMinute(i:CalendarItem){return i.time?mins(i.time):1080}

export function ensureCorridaAftermath():CorridaAftermath|null{
  const s=read();if(!s||!s.official)return null;const existing=stored(s);if(existing&&existing.day===n(s.day,1))return existing;const c=todayCorrida(s);if(!c)return null;const now=mins(s.time),event=eventMinute(c);if(now<event+120)return null;
  const day=n(s.day,1),city=cityOf(c,s),year=getAnnualLifeProfile()?.lifeYear||1,seed=hash(`${year}:${day}:${city}:${String(c.title||'corrida')}`);
  const sport:CorridaSportResult=(['triumph','solid','mixed','difficult'] as const)[seed%4];
  const physicalRoll=(seed>>5)%100;const physical:CorridaPhysicalState=physicalRoll<68?'fine':physicalRoll<88?'sore':physicalRoll<97?'bruised':'minor-cut';
  const rawFatigue=physical==='fine'?12+(seed%9):physical==='sore'?21+(seed%8):physical==='bruised'?28+(seed%7):34+(seed%8);
  const fatigue=Math.max(8,Math.min(48,Math.round(rawFatigue*careerRecoveryFactor())));
  const mediaRoll=(seed>>9)%100;const media:CorridaMediaLevel=sport==='triumph'?(mediaRoll<30?'light':'busy'):mediaRoll<62?'quiet':mediaRoll<90?'light':'busy';
  const nextDay:CorridaAftermath['nextDay']=physical==='minor-cut'||fatigue>=32?'rest':media==='busy'?'media':((seed>>13)%100)<28?'travel':'normal';
  const result:CorridaAftermath={id:`corrida-${day}-${hash(city).toString(36)}`,day,city,sport,physical,fatigue,media,nextDay,created:true};
  const f=s.flags||(s.flags={});f.corridaAftermath=result;s.eventHistory=[...(s.eventHistory||[]),`corrida-result:${sport}`,`corrida-physical:${physical}`,`corrida-media:${media}`].slice(-280);write(s);return result;
}

export function getCorridaAftermathBeat():CorridaAftermathBeat|null{
  const a=ensureCorridaAftermath();const s=read();if(!a||!s)return null;const f=s.flags||{};if(f[`corridaAftermathDone:${a.id}`]===true)return null;const candidates:CorridaAftermathBeat[]=[];
  const add=(b:CorridaAftermathBeat,cooldownYears=1)=>{if(annualBeatAllowed(`corrida-aftermath:${b.id}`,{cooldownYears}))candidates.push(b)};
  if(a.physical==='minor-cut'||a.physical==='bruised')add({id:'check-physical',label:'Voir comment Lucas va vraiment',intent:'corrida-check-physical',kind:'relationship',weight:82,minutes:30,narrative:'Lucas revient marqué par l’effort. Rien de spectaculaire à jouer : d’abord vérifier comment il se sent et laisser retomber l’adrénaline.'},2);
  if(a.fatigue>=26)add({id:'protect-evening',label:'Garder une soirée très calme',intent:'rest',kind:'rest',weight:78,minutes:80,narrative:'La fatigue prend plus de place que le résultat. La meilleure suite peut être de ne rien ajouter à cette journée.'},1);
  if(a.media==='busy')add({id:'let-media-wait',label:'Laisser la presse attendre un peu',intent:'corrida-media-boundary',kind:'self',weight:annualWeight('couple',62),minutes:40,narrative:'Il y a du bruit autour du résultat, mais tout n’a pas besoin d’entrer dans la chambre ou dans leur soirée.'},2);
  if(a.sport==='triumph'&&a.fatigue<30)add({id:'quiet-celebration',label:'Profiter du bon moment sans en faire trop',intent:'corrida-private-evening',kind:'relationship',weight:annualWeight('couple',66),minutes:70,narrative:'La soirée peut être heureuse sans devenir une réception. Le résultat appartient aussi à ce qui se passe une fois la porte refermée.'},2);
  if(a.sport==='difficult'||a.sport==='mixed')add({id:'no-analysis-yet',label:'Ne pas refaire la corrida tout de suite',intent:'corrida-private-evening',kind:'relationship',weight:annualWeight('couple',61),minutes:60,narrative:'Le résultat est encore trop proche pour tout analyser. Il peut simplement rentrer, souffler et redevenir Lucas.'},2);
  add({id:'own-evening',label:'Garder aussi mon propre rythme ce soir',intent:'custom-intent',kind:'self',weight:annualWeight('home',48),minutes:55,narrative:'Même après une corrida, Marion n’est pas obligée de transformer toute sa soirée en prolongement de l’arène.'},1);
  if(!candidates.length)return null;return candidates[hash(`${a.id}:${n(s.time,0)}`)%candidates.length];
}

export function consumeCorridaAftermathBeat(id:string){const a=ensureCorridaAftermath();const s=read();if(!a||!s)return false;const beat=getCorridaAftermathBeat();if(!beat||beat.id!==id)return false;markAnnualBeat(`corrida-aftermath:${id}`);const f=s.flags||(s.flags={});f[`corridaAftermathDone:${a.id}`]=true;f.lastCorridaSportResult=a.sport;f.lastCorridaPhysicalState=a.physical;f.lastCorridaMediaLevel=a.media;f.lastCorridaNextDay=a.nextDay;s.eventHistory=[...(s.eventHistory||[]),`corrida-aftermath-choice:${id}`].slice(-280);write(s);return true}

declare global{interface Window{__moniaCorridaAftermath?:()=>CorridaAftermath|null;__moniaCorridaAftermathBeat?:()=>CorridaAftermathBeat|null;__moniaConsumeCorridaAftermath?:(id:string)=>boolean}}
window.__moniaCorridaAftermath=ensureCorridaAftermath;window.__moniaCorridaAftermathBeat=getCorridaAftermathBeat;window.__moniaConsumeCorridaAftermath=consumeCorridaAftermathBeat;
