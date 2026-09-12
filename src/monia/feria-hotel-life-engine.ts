import { getAnnualLifeProfile, annualBeatAllowed, annualWeight } from './annual-life-variation';
import { getTravelArrivalMoment } from './travel-arrival-engine';

const SAVE_KEY='marion-lucas-save-v4';
type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;stress?:number;energy?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type FeriaHotelBeat={id:string;label:string;intent:string;kind:'relationship'|'social'|'rest'|'self';weight:number;minutes:number;narrative:string;city:string;phase:'arrival'|'pre-corrida'|'post-corrida'|'off-day';};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isTaurine(i:CalendarItem){return String(i.owner||'').toLowerCase()==='lucas'&&/corrida|feria|toros|arène|arena|plaza|tentadero/i.test(`${i.title||''} ${i.note||''}`)}
function city(i:CalendarItem|undefined,place:string){return String(i?.place||place||'la ville').replace(/^hotel\s+/i,'').trim()||'la ville'}
function todays(s:Save){return(s.calendar||[]).filter(i=>n(i.day)===n(s.day,1)&&isTaurine(i))}
function phase(s:Save,items:CalendarItem[]):FeriaHotelBeat['phase']{const arrival=getTravelArrivalMoment();if(arrival)return'arrival';const now=mins(s.time),next=items.filter(i=>i.time&&mins(i.time)>=now).sort((a,b)=>mins(a.time)-mins(b.time))[0];const past=items.filter(i=>i.time&&mins(i.time)<now).sort((a,b)=>mins(b.time)-mins(a.time))[0];if(next&&mins(next.time)-now<=360)return'pre-corrida';if(past&&now-mins(past.time)<=300)return'post-corrida';return'off-day'}
function pick<T>(xs:T[],seed:string){return xs.length?xs[hash(seed)%xs.length]:null}

export function getFeriaHotelBeat():FeriaHotelBeat|null{
 const s=read();if(!s||!s.official)return null;const items=todays(s);const p=String(s.place||'');const hotel=/hotel|hôtel/i.test(p);if(!items.length&&!hotel)return null;
 const ph=phase(s,items),c=city(items[0],p),year=getAnnualLifeProfile()?.lifeYear||1;const seed=`${year}:${n(s.day,1)}:${ph}:${c}`;const energy=n(s.energy,70),stress=n(s.stress);
 const candidates:FeriaHotelBeat[]=[];
 const add=(b:FeriaHotelBeat,cooldownYears=2)=>{if(annualBeatAllowed(`feria-hotel:${b.id}`,{cooldownYears}))candidates.push(b)};
 if(ph==='arrival'){
   add({id:'arrival-quiet',label:'S’installer sans se presser',intent:'rest',kind:'rest',weight:annualWeight('home',66),minutes:45,narrative:`L’arrivée à ${c} est calme. Les valises peuvent attendre quelques minutes.`,city:c,phase:ph},1);
   add({id:'arrival-team',label:'Descendre voir l’équipe un moment',intent:'feria-team-moment',kind:'social',weight:annualWeight('social',56),minutes:50,narrative:`À ${c}, l’équipe s’installe de son côté. Rien n’oblige Marion à suivre le même rythme qu’eux.`,city:c,phase:ph},2);
 }
 if(ph==='pre-corrida'){
   if(stress<78)add({id:'pre-corrida-private',label:'Garder un moment calme avec Lucas',intent:'feria-private-moment',kind:'relationship',weight:annualWeight('couple',63),minutes:35,narrative:`L’hôtel a ce calme particulier d’avant corrida. Lucas se prépare, chacun à son rythme.`,city:c,phase:ph},2);
   add({id:'pre-corrida-own',label:'Laisser Lucas à sa préparation et faire ma vie',intent:'custom-intent',kind:'self',weight:annualWeight('career',58),minutes:60,narrative:`La corrida approche à ${c}. Marion n’a pas besoin d’occuper chaque minute autour de Lucas.`,city:c,phase:ph},1);
 }
 if(ph==='post-corrida'){
   if(energy<42||stress>66)add({id:'post-corrida-recover',label:'Rentrer et couper avec la journée',intent:'rest',kind:'rest',weight:78,minutes:75,narrative:`Après les arènes, l’hôtel peut simplement redevenir un refuge.`,city:c,phase:ph},1);
   add({id:'post-corrida-dinner',label:'Voir si un dîner se fait avec l’équipe',intent:'feria-team-dinner',kind:'social',weight:annualWeight('social',52),minutes:100,narrative:`Après la corrida, rien n’est automatique : parfois l’équipe se retrouve, parfois chacun disparaît dans sa chambre.`,city:c,phase:ph},3);
   add({id:'post-corrida-two',label:'Rester seulement tous les deux',intent:'feria-private-moment',kind:'relationship',weight:annualWeight('couple',57),minutes:70,narrative:`La soirée peut rester très simple, loin du bruit des arènes.`,city:c,phase:ph},2);
 }
 if(ph==='off-day'){
   add({id:'off-day-city',label:'Profiter un peu de la ville',intent:'open-map',kind:'self',weight:annualWeight('travel',54),minutes:120,narrative:`Entre deux temps taurins, ${c} existe aussi en dehors des arènes.`,city:c,phase:ph},2);
   add({id:'off-day-room',label:'Ne rien programmer pour l’instant',intent:'rest',kind:'rest',weight:annualWeight('home',46),minutes:50,narrative:`Une journée de feria n’a pas besoin d’être remplie du matin au soir.`,city:c,phase:ph},1);
 }
 return pick(candidates,seed);
}

export function consumeFeriaHotelBeat(id:string){const s=read();if(!s)return false;const year=getAnnualLifeProfile()?.lifeYear||1;s.eventHistory=[...(s.eventHistory||[]),`annual-beat:${year}:feria-hotel:${id}`].slice(-260);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}

declare global{interface Window{__moniaFeriaHotelLife?:()=>FeriaHotelBeat|null;__moniaConsumeFeriaHotelBeat?:(id:string)=>boolean}}
window.__moniaFeriaHotelLife=getFeriaHotelBeat;window.__moniaConsumeFeriaHotelBeat=consumeFeriaHotelBeat;
