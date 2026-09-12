import { getLongStaySnapshot, recordLongStayMoment } from './long-stay-life';
import { getResidenceSnapshot } from './residence-base-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;energy?:number;stress?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type LongStayRoutineKind='breakfast'|'groceries'|'quiet-corner'|'hotel-reset'|'walk'|'laundry'|'local-coffee';
export type LongStayRoutine={id:string;kind:LongStayRoutineKind;label:string;intent:string;weight:number;minutes:number;energyDelta:number;stressDelta:number;narrative:string;};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function recent(s:Save,kind:string){return (s.eventHistory||[]).slice(-24).some(e=>e.includes(`long-stay-routine:${kind}:`))}
export function getLongStayRoutine():LongStayRoutine|null{
 const s=read();if(!s)return null;const stay=getLongStaySnapshot();if(!stay||!stay.temporaryBase)return null;const residence=getResidenceSnapshot();if(residence.isHome)return null;
 const m=mins(s.time),energy=n(s.energy,70),stress=n(s.stress),hotel=residence.kind==='hotel'||residence.kind==='touring-base'||/hotel|hôtel/i.test(String(s.place||''));const out:LongStayRoutine[]=[];
 const add=(r:LongStayRoutine)=>{if(!recent(s,r.kind))out.push(r)};
 if(m>=420&&m<690)add({id:'longstay-breakfast',kind:'breakfast',label:hotel?'Prendre mon petit-déjeuner comme d’habitude ici':'Passer prendre quelque chose au même endroit ce matin',intent:'long-stay-routine:breakfast',weight:66,minutes:40,energyDelta:6,stressDelta:-3,narrative:'À force de rester ici, le matin commence à avoir ses habitudes. Pas une nouvelle vie permanente : juste un rythme qui s’installe le temps du séjour.'});
 if(m>=600&&m<1140)add({id:'longstay-groceries',kind:'groceries',label:'Faire les petites courses pour les prochains jours',intent:'long-stay-routine:groceries',weight:54,minutes:55,energyDelta:-3,stressDelta:-2,narrative:'Quand un séjour dure, il y a forcément les choses ordinaires : eau, fruits, produits du quotidien, deux ou trois habitudes qui évitent de vivre uniquement entre valises et restaurants.'});
 if(stress>=40)add({id:'longstay-quiet-corner',kind:'quiet-corner',label:'Retourner dans mon coin tranquille ici',intent:'long-stay-routine:quiet-corner',weight:63,minutes:45,energyDelta:3,stressDelta:-9,narrative:'Même loin de chez elle, Marion finit par repérer un endroit où se poser sans programme. Un petit refuge temporaire, rien de plus.'});
 if(hotel&&m>=900)add({id:'longstay-hotel-reset',kind:'hotel-reset',label:'Rentrer un peu à l’hôtel avant la suite',intent:'long-stay-routine:hotel-reset',weight:58,minutes:50,energyDelta:8,stressDelta:-7,narrative:'La chambre d’hôtel commence à servir de vraie base de journée : on y revient entre deux choses, on recharge le téléphone, on change de tenue, on souffle.'});
 if(energy>=38&&m>=570&&m<1260)add({id:'longstay-walk',kind:'walk',label:'Faire mon trajet habituel dans le quartier',intent:'long-stay-routine:walk',weight:48,minutes:45,energyDelta:-4,stressDelta:-5,narrative:'Au bout de quelques jours, certains trajets cessent d’être nouveaux. Marion marche sans vérifier chaque rue : le séjour commence simplement à être vécu.'});
 if(stay.daysHere>=8)add({id:'longstay-laundry',kind:'laundry',label:'M’occuper du linge et remettre un peu d’ordre',intent:'long-stay-routine:laundry',weight:42,minutes:50,energyDelta:-3,stressDelta:-3,narrative:'Un séjour assez long finit toujours par contenir du linge, des affaires à ranger et des détails très peu cinématographiques — précisément ce qui le rend crédible.'});
 if(m>=480&&m<1110)add({id:'longstay-local-coffee',kind:'local-coffee',label:'Passer au café où je commence à avoir mes habitudes',intent:'long-stay-routine:local-coffee',weight:55,minutes:35,energyDelta:2,stressDelta:-4,narrative:'Ce n’est pas encore « son » café. Mais elle n’a plus besoin de réfléchir pour savoir où aller, et ça suffit à donner au séjour un petit goût d’habitude.'});
 if(!out.length)return null;return out.sort((a,b)=>b.weight-a.weight)[hash(`${s.day}:${s.time}:${s.place}`)%Math.min(3,out.length)]||out[0];
}
export function resolveLongStayRoutine(id:string){const s=read();if(!s)return false;const r=getLongStayRoutine();if(!r||r.id!==id)return false;const [h,m]=String(s.time||'09:00').split(':').map(Number);let total=(h||0)*60+(m||0)+r.minutes;while(total>=1440){total-=1440;s.day=n(s.day,1)+1}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;s.energy=Math.max(0,Math.min(100,n(s.energy,70)+r.energyDelta));s.stress=Math.max(0,Math.min(100,n(s.stress)+r.stressDelta));s.eventHistory=[...(s.eventHistory||[]),`long-stay-routine:${r.kind}:${n(s.day,1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));recordLongStayMoment();window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}
declare global{interface Window{__moniaLongStayRoutine?:()=>LongStayRoutine|null;__moniaResolveLongStayRoutine?:(id:string)=>boolean}}
window.__moniaLongStayRoutine=getLongStayRoutine;window.__moniaResolveLongStayRoutine=resolveLongStayRoutine;
