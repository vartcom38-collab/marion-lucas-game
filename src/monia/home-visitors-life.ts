import { getAnnualLifeProfile, annualBeatAllowed, annualWeight } from './annual-life-variation';
import { getHomeLifeEvolution } from './home-life-evolution';
import { getMarineState } from './secondary-character-life';
import { getExtendedFamilyBeat } from './extended-family-life';
import { getCloseCircleMoment } from './close-circle-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;married?:boolean;children?:number;relationship?:number;trust?:number;stress?:number;energy?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type HomeVisitorKind='friend'|'family'|'marine'|'neighbour'|'drop-in';
export type HomeVisitorBeat={id:string;kind:HomeVisitorKind;label:string;intent:string;weight:number;minutes:number;narrative:string;planned:boolean;ordinary:true;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isHomeLike(place:string){return /home|maison|appartement|finca|chez eux|domicile/i.test(place)}
function recent(history:string[],re:RegExp,limit=70){return history.slice(-limit).filter(e=>re.test(e)).length}

export function getHomeVisitorBeat():HomeVisitorBeat|null{
  const s=read();if(!s||!s.official||!isHomeLike(String(s.place||'')))return null;
  const now=mins(s.time);if(now<570||now>1320)return null;
  const evolution=getHomeLifeEvolution();if(!evolution)return null;
  const energy=n(s.energy,70),stress=n(s.stress);if(energy<28||stress>82)return null;
  const h=s.eventHistory||[];const annual=getAnnualLifeProfile();const day=n(s.day,1),slot=Math.floor(now/120),seed=hash(`home-visitor:${day}:${slot}:${evolution.mode}`)%100;
  const recentVisits=recent(h,/home-visitor|family-visit|friend-visit|marine-home-visit|guest|extended-family|close-circle/i,45);
  const gate=Math.max(8,Math.min(54,Math.round((evolution.guestWeight+(annual?.socialBias||50))/4)-recentVisits*6));
  if(seed>=gate)return null;

  const close=getCloseCircleMoment();
  if(close&&(close.kind==='home-visit'||close.kind==='meal'||close.kind==='children'||close.kind==='birthday')&&hash(`close-circle-home:${day}:${slot}`)%100<62)return{id:`close-${close.id}`,kind:'friend',label:close.label,intent:close.intent,weight:close.weight,minutes:close.minutes,narrative:close.narrative,planned:close.kind==='birthday'||close.kind==='meal',ordinary:true};

  const extended=getExtendedFamilyBeat();
  if(extended&&hash(`extended-family-priority:${day}:${slot}`)%100<58)return{id:`extended-${extended.id}`,kind:'family',label:extended.label,intent:extended.intent,weight:extended.weight,minutes:extended.minutes,narrative:extended.narrative,planned:extended.kind==='family-meal'||extended.kind==='stay-over',ordinary:true};

  const candidates:HomeVisitorBeat[]=[];
  const add=(b:HomeVisitorBeat,cooldownYears=1)=>{if(annualBeatAllowed(`home-visitor:${b.id}`,{cooldownYears}))candidates.push(b)};
  const marine=getMarineState();
  if(marine?.distance==='same-city'&&marine.canMeet&&/nîmes|nimes/i.test(String(s.place||'')))add({id:'marine-drop-in',kind:'marine',label:'Laisser Marine passer un moment',intent:'home-visitor-marine',weight:annualWeight('social',64),minutes:55,narrative:'Marine peut passer sans que cela devienne une grande sortie : un café, quelques nouvelles et la vie de la maison continue autour.',planned:false,ordinary:true},1);
  add({id:'friend-coffee',kind:'friend',label:'Recevoir quelqu’un pour un café',intent:'home-visitor-friend',weight:annualWeight('social',58),minutes:50,narrative:'Quelqu’un de proche passe prendre un café. La visite reste simple, sans transformer l’après-midi en événement.',planned:false,ordinary:true},2);
  if(evolution.familyWeight>=48)add({id:'family-passing',kind:'family',label:'Profiter d’un passage de la famille',intent:'home-visitor-family',weight:annualWeight('home',61),minutes:70,narrative:'Un passage familial s’insère dans la journée : quelques nouvelles, quelque chose à boire ou à manger, puis chacun reprend son rythme.',planned:seed%3===0,ordinary:true},2);
  if(evolution.mode==='open-house')add({id:'easy-dinner',kind:'drop-in',label:'Garder du monde un peu plus longtemps',intent:'home-visitor-stay',weight:annualWeight('social',66),minutes:90,narrative:'La maison est plus ouverte en ce moment. Une visite peut naturellement se prolonger autour d’un repas sans devenir une réception organisée.',planned:false,ordinary:true},2);
  if(evolution.mode==='family'&&n(s.children)>0)add({id:'family-house-flow',kind:'family',label:'Laisser la maison vivre avec les passages',intent:'home-visitor-family-flow',weight:annualWeight('home',68),minutes:75,narrative:'La maison est plus familiale à cette période de leur vie : les passages et les repas s’intègrent au quotidien plutôt que de tout arrêter.',planned:false,ordinary:true},1);
  add({id:'short-hello',kind:'neighbour',label:'Prendre quelques minutes pour quelqu’un qui passe',intent:'home-visitor-short',weight:annualWeight('social',46),minutes:20,narrative:'Quelqu’un passe brièvement. Quelques minutes à l’entrée ou autour d’un café suffisent ; tout le reste de la journée n’a pas besoin de changer.',planned:false,ordinary:true},2);
  if(!candidates.length)return null;
  return candidates[hash(`home-visitor-pick:${day}:${slot}:${evolution.preferredZone}`)%candidates.length];
}

declare global{interface Window{__moniaHomeVisitorBeat?:()=>HomeVisitorBeat|null}}
window.__moniaHomeVisitorBeat=getHomeVisitorBeat;
