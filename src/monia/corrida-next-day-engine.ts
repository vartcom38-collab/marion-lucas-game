import { getAnnualLifeProfile, annualBeatAllowed, annualWeight, markAnnualBeat } from './annual-life-variation';
import { ensureCorridaAftermath, type CorridaAftermath } from './corrida-aftermath-engine';

const SAVE_KEY='marion-lucas-save-v4';
type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;energy?:number;stress?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type CorridaNextDayBeat={id:string;label:string;intent:string;kind:'rest'|'relationship'|'social'|'self'|'travel';weight:number;minutes:number;narrative:string;source:'recovery'|'media'|'travel'|'normal';};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function storedAftermath(s:Save){const v=s.flags?.corridaAftermath;return v&&typeof v==='object'?v as CorridaAftermath:null}
function relevantAftermath(s:Save){const a=storedAftermath(s);return a&&n(s.day,1)===a.day+1?a:null}
function nextLucasObligation(s:Save){const d=n(s.day,1);return(s.calendar||[]).filter(i=>n(i.day)===d&&String(i.owner||'').toLowerCase()==='lucas').sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99')))[0]||null}
function pick<T>(items:T[],seed:string){return items.length?items[hash(seed)%items.length]:null}

export function getCorridaNextDayBeat():CorridaNextDayBeat|null{
  const s=read();if(!s||!s.official)return null;ensureCorridaAftermath();const a=relevantAftermath(s);if(!a)return null;const f=s.flags||{};if(f[`corridaNextDayDone:${a.id}`]===true)return null;
  const year=getAnnualLifeProfile()?.lifeYear||1,energy=n(s.energy,70),stress=n(s.stress),obligation=nextLucasObligation(s),candidates:CorridaNextDayBeat[]=[];
  const add=(b:CorridaNextDayBeat,cooldownYears=1)=>{if(annualBeatAllowed(`corrida-next-day:${b.id}`,{cooldownYears}))candidates.push(b)};
  if(a.nextDay==='rest'||a.fatigue>=28||a.physical!=='fine'){
    add({id:'slow-start',label:'Laisser la matinée tranquille',intent:'rest',kind:'rest',weight:82,minutes:75,narrative:'Le lendemain ne ressemble pas à un nouveau départ net. Le corps de Lucas réclame encore un peu de calme et la journée peut commencer plus tard.',source:'recovery'},1);
    add({id:'own-morning',label:'Faire ma matinée de mon côté',intent:'custom-intent',kind:'self',weight:annualWeight('home',56),minutes:70,narrative:'Lucas récupère. Marion peut laisser la maison ou la chambre retrouver son rythme sans rester en permanence autour de lui.',source:'recovery'},2);
  }
  if(a.nextDay==='media'||a.media==='busy'){
    add({id:'media-boundary',label:'Ne pas organiser la journée autour de la presse',intent:'corrida-media-boundary',kind:'self',weight:annualWeight('career',61),minutes:45,narrative:'Le résultat circule encore, mais la journée privée n’a pas besoin de devenir une annexe des interviews.',source:'media'},2);
    if(a.sport==='triumph')add({id:'short-media-window',label:'Laisser Lucas gérer un court moment presse',intent:'corrida-media-window',kind:'social',weight:58,minutes:50,narrative:'Il peut y avoir quelques obligations médiatiques, puis la journée reprend autrement. Rien n’impose d’en faire un événement permanent.',source:'media'},2);
  }
  if(a.nextDay==='travel'){
    add({id:'pack-and-leave',label:'Préparer tranquillement le départ',intent:'continue-torero-travel',kind:'travel',weight:72,minutes:60,narrative:'La feria continue peut-être ailleurs. Avant de repartir, il reste un matin de sacs, de café et de timings à recaler.',source:'travel'},1);
    add({id:'one-last-hour',label:'Garder encore un peu de temps avant la route',intent:'rest',kind:'rest',weight:annualWeight('couple',55),minutes:50,narrative:'Le prochain trajet existe déjà, mais il n’a pas besoin de commencer à la seconde où le jour se lève.',source:'travel'},2);
  }
  if(obligation)add({id:'lucas-obligation',label:`Voir comment s’organise ${String(obligation.title||'la journée de Lucas')}`,intent:'open-lucas-day',kind:'relationship',weight:68,minutes:25,narrative:'Une nouvelle obligation peut suivre très vite, mais elle ne gomme pas la fatigue ni ce qui reste de la veille.',source:'normal'},1);
  if(energy<42||stress>65)add({id:'marion-recovery',label:'Ralentir aussi de mon côté',intent:'rest',kind:'rest',weight:76,minutes:60,narrative:'La veille a aussi laissé quelque chose chez Marion. Elle peut récupérer sans attendre que Lucas décide du rythme.',source:'normal'},1);
  add({id:'normal-morning',label:'Reprendre une journée presque normale',intent:'morning-routine',kind:'self',weight:annualWeight('home',52),minutes:40,narrative:'Parfois, le lendemain d’une corrida est justement ordinaire : café, messages, douche, agenda. La vie reprend sans grande scène.',source:'normal'},1);
  return pick(candidates,`${year}:${a.id}:${a.nextDay}:${Math.floor(n(s.day,1)/2)}`);
}

export function consumeCorridaNextDayBeat(id:string){const s=read();const beat=getCorridaNextDayBeat();const a=s?relevantAftermath(s):null;if(!s||!beat||!a||beat.id!==id)return false;markAnnualBeat(`corrida-next-day:${id}`);const f=s.flags||(s.flags={});f[`corridaNextDayDone:${a.id}`]=true;f.lastCorridaNextDayBeat=id;s.eventHistory=[...(s.eventHistory||[]),`corrida-next-day:${beat.source}:${id}`].slice(-300);write(s);return true}

declare global{interface Window{__moniaCorridaNextDay?:()=>CorridaNextDayBeat|null;__moniaConsumeCorridaNextDay?:(id:string)=>boolean}}
window.__moniaCorridaNextDay=getCorridaNextDayBeat;window.__moniaConsumeCorridaNextDay=consumeCorridaNextDayBeat;
