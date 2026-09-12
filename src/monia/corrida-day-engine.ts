import { getAnnualLifeProfile, annualBeatAllowed, annualWeight, markAnnualBeat } from './annual-life-variation';
import { getLucasPresence } from './lucas-presence-engine';

const SAVE_KEY='marion-lucas-save-v4';
type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;stress?:number;energy?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};

export type CorridaPhase='wake'|'morning'|'waiting'|'preparation'|'departure'|'arena-separation'|'post-corrida'|'return';
export type CorridaDayBeat={id:string;phase:CorridaPhase;label:string;intent:string;kind:'relationship'|'self'|'social'|'rest'|'travel';weight:number;minutes:number;narrative:string;city:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isCorrida(i:CalendarItem){return String(i.owner||'').toLowerCase()==='lucas'&&/corrida|arène|arena|plaza|toros/i.test(`${i.title||''} ${i.note||''}`)}
function todayCorrida(s:Save){const d=n(s.day,1);return(s.calendar||[]).find(i=>n(i.day)===d&&isCorrida(i))||null}
function cityOf(i:CalendarItem,s:Save){return String(i.place||s.place||'la ville').replace(/^h[oô]tel\s+/i,'').trim()||'la ville'}
function eventMinute(i:CalendarItem){return i.time?mins(i.time):1080}
function phaseFor(now:number,event:number,history:string[]):CorridaPhase{
  const resultSeen=history.slice(-20).some(e=>/corrida-result|corrida-finished|post-corrida/i.test(e));
  if(resultSeen||now>=event+150)return now>=event+300?'return':'post-corrida';
  if(now<480)return'wake';
  if(now<event-300)return'morning';
  if(now<event-180)return'waiting';
  if(now<event-75)return'preparation';
  if(now<event-20)return'departure';
  return'arena-separation';
}
function pick<T>(items:T[],seed:string){return items.length?items[hash(seed)%items.length]:null}

export function getCorridaDayBeat():CorridaDayBeat|null{
  const s=read();if(!s||!s.official)return null;const corrida=todayCorrida(s);if(!corrida)return null;
  const now=mins(s.time),event=eventMinute(corrida),phase=phaseFor(now,event,s.eventHistory||[]),city=cityOf(corrida,s),year=getAnnualLifeProfile()?.lifeYear||1;
  const energy=n(s.energy,70),stress=n(s.stress),presence=getLucasPresence();const candidates:CorridaDayBeat[]=[];
  const add=(b:CorridaDayBeat,cooldownYears=1)=>{if(annualBeatAllowed(`corrida-day:${b.id}`,{cooldownYears}))candidates.push(b)};

  if(phase==='wake'){
    add({id:'wake-slow',phase,label:'Laisser la matinée commencer doucement',intent:'rest',kind:'rest',weight:annualWeight('home',62),minutes:35,narrative:`Jour de corrida à ${city}. Pour l’instant, rien ne presse encore.`,city},1);
    if(presence?.together)add({id:'wake-together',phase,label:'Prendre le réveil tranquillement avec Lucas',intent:'corrida-private-morning',kind:'relationship',weight:annualWeight('couple',58),minutes:30,narrative:`Le jour est là, mais l’arène est encore loin. Lucas n’a pas besoin d’être déjà dans sa bulle.`,city},2);
  }
  if(phase==='morning'){
    add({id:'breakfast-own-rhythm',phase,label:'Prendre mon petit-déjeuner à mon rythme',intent:'corrida-own-morning',kind:'self',weight:annualWeight('home',61),minutes:40,narrative:`La matinée de corrida ne tourne pas forcément entièrement autour de Lucas.`,city},1);
    if(presence?.together&&stress<75)add({id:'morning-brief-together',phase,label:'Profiter d’un moment simple avant que ça s’accélère',intent:'corrida-private-morning',kind:'relationship',weight:annualWeight('couple',57),minutes:35,narrative:`Avant la préparation, il reste encore un bout de journée normale.`,city},2);
  }
  if(phase==='waiting'){
    add({id:'waiting-own-life',phase,label:'Le laisser tranquille et faire quelque chose pour moi',intent:'custom-intent',kind:'self',weight:annualWeight('career',63),minutes:60,narrative:`À ${city}, l’attente s’installe. Lucas peut avoir besoin de son espace sans que Marion reste suspendue à la porte.`,city},1);
    if(energy<45||stress>62)add({id:'waiting-rest',phase,label:'Me poser un peu avant le départ',intent:'rest',kind:'rest',weight:72,minutes:45,narrative:`Il reste du temps avant l’arène. Mieux vaut ne pas épuiser la journée trop tôt.`,city},1);
  }
  if(phase==='preparation'){
    add({id:'prep-distance',phase,label:'Le laisser entrer dans sa préparation',intent:'corrida-give-space',kind:'self',weight:78,minutes:30,narrative:`Lucas entre peu à peu dans sa préparation. Marion peut être là sans occuper cet espace.`,city},1);
    if(presence?.together&&stress<70)add({id:'prep-brief-contact',phase,label:'Rester quelques minutes avec lui puis le laisser faire',intent:'corrida-brief-contact',kind:'relationship',weight:annualWeight('couple',60),minutes:20,narrative:`Il reste quelques minutes avant que la concentration prenne toute la place.`,city},2);
  }
  if(phase==='departure'){
    add({id:'departure-separate',phase,label:'Le laisser partir avec son équipe',intent:'corrida-departure-separate',kind:'travel',weight:82,minutes:25,narrative:`Le départ pour l’arène approche. Pour ce trajet professionnel, Lucas part avec son chauffeur; la cuadrilla suit séparément avec le camion.`,city},1);
    add({id:'departure-my-plan',phase,label:'Décider où je vais pendant ce temps',intent:'open-map',kind:'self',weight:annualWeight('travel',55),minutes:30,narrative:`Le départ de Lucas ne décide pas automatiquement de la place de Marion dans la journée.`,city},2);
  }
  if(phase==='arena-separation'){
    add({id:'arena-own-position',phase,label:'Vivre l’attente à ma manière',intent:'corrida-arena-choice',kind:'self',weight:75,minutes:60,narrative:`À l’approche de la corrida, chacun a son espace. Marion peut être présente sans être collée au rituel professionnel de Lucas.`,city},1);
  }
  if(phase==='post-corrida'){
    if(stress>60||energy<42)add({id:'post-cut-noise',phase,label:'Couper avec le bruit et récupérer',intent:'rest',kind:'rest',weight:80,minutes:60,narrative:`Après la corrida, la journée peut retomber d’un coup. Il n’y a rien à prouver maintenant.`,city},1);
    add({id:'post-wait-lucas',phase,label:'Attendre de voir dans quel état Lucas revient',intent:'corrida-post-checkin',kind:'relationship',weight:annualWeight('couple',62),minutes:35,narrative:`L’après-corrida n’a jamais exactement le même visage. Mieux vaut voir comment Lucas revient avant de décider de la soirée.`,city},2);
  }
  if(phase==='return'){
    add({id:'return-quiet',phase,label:'Rentrer sans prévoir la suite tout de suite',intent:'rest',kind:'rest',weight:annualWeight('home',65),minutes:55,narrative:`Le retour peut rester simple. La journée taurine est terminée; le reste n’a pas besoin de l’être immédiatement.`,city},1);
    if(presence?.together)add({id:'return-two',phase,label:'Voir si on reste simplement tous les deux',intent:'corrida-private-evening',kind:'relationship',weight:annualWeight('couple',58),minutes:70,narrative:`Une fois la porte refermée, la soirée peut redevenir complètement privée.`,city},2);
  }
  return pick(candidates,`${year}:${n(s.day,1)}:${phase}:${city}:${Math.floor(now/45)}`);
}

export function consumeCorridaDayBeat(id:string){const beat=getCorridaDayBeat();if(!beat||beat.id!==id)return false;markAnnualBeat(`corrida-day:${id}`);const s=read();if(!s)return false;s.eventHistory=[...(s.eventHistory||[]),`corrida-day:${beat.phase}:${id}`].slice(-260);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}

declare global{interface Window{__moniaCorridaDay?:()=>CorridaDayBeat|null;__moniaConsumeCorridaDay?:(id:string)=>boolean}}
window.__moniaCorridaDay=getCorridaDayBeat;window.__moniaConsumeCorridaDay=consumeCorridaDayBeat;
