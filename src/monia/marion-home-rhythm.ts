import { getAnnualLifeProfile, annualWeight } from './annual-life-variation';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;energy?:number;stress?:number;flags?:Record<string,unknown>};
export type MarionHomeActivity='sleeping'|'slow-morning'|'self-care'|'reading'|'cooking'|'work-project'|'wardrobe'|'calling-friend'|'out-errand'|'quiet-home'|'available';
export type MarionHomeRhythm={atHome:boolean;activity:MarionHomeActivity;label:string;intent:string;kind:'self'|'social'|'rest'|'free';weight:number;minutes:number;independentFromLucas:true;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isHomeLike(place:string){return /home|maison|appartement|finca|chez eux|domicile/i.test(place)}

export function getMarionHomeRhythm():MarionHomeRhythm|null{
  const s=read();if(!s||!isHomeLike(String(s.place||'')))return null;
  const now=mins(s.time),energy=n(s.energy,70),stress=n(s.stress),annual=getAnnualLifeProfile(),seasonal=getSeasonalLifeSnapshot();
  if(now<390||now>=1410)return{atHome:true,activity:'sleeping',label:'Dormir',intent:'rest',kind:'rest',weight:88,minutes:90,independentFromLucas:true};
  if(energy<32||stress>72)return{atHome:true,activity:'quiet-home',label:'Prendre un vrai moment pour moi',intent:'rest',kind:'rest',weight:84,minutes:55,independentFromLucas:true};
  const seed=hash(`${n(s.day,1)}:${Math.floor(now/90)}:${annual?.tone||'normal'}:${seasonal?.season||'none'}`)%100;
  const candidates:MarionHomeRhythm[]=[
    {atHome:true,activity:'slow-morning',label:'Prendre mon temps à la maison',intent:'morning-routine',kind:'self',weight:annualWeight('home',64),minutes:35,independentFromLucas:true},
    {atHome:true,activity:'self-care',label:'M’occuper un peu de moi',intent:'custom-intent',kind:'self',weight:annualWeight('self',61),minutes:45,independentFromLucas:true},
    {atHome:true,activity:'reading',label:'Lire un moment tranquille',intent:'custom-intent',kind:'self',weight:annualWeight('home',54),minutes:40,independentFromLucas:true},
    {atHome:true,activity:'cooking',label:'Préparer quelque chose à manger',intent:'custom-intent',kind:'self',weight:annualWeight('home',58),minutes:50,independentFromLucas:true},
    {atHome:true,activity:'work-project',label:'Avancer sur quelque chose à moi',intent:'custom-intent',kind:'self',weight:annualWeight('career',63),minutes:65,independentFromLucas:true},
    {atHome:true,activity:'wardrobe',label:'Regarder mes tenues et changer un peu',intent:'open-wardrobe',kind:'self',weight:52,minutes:25,independentFromLucas:true},
    {atHome:true,activity:'calling-friend',label:'Prendre des nouvelles de quelqu’un',intent:'open-phone',kind:'social',weight:annualWeight('social',55),minutes:15,independentFromLucas:true},
    {atHome:true,activity:'quiet-home',label:'Profiter simplement de la maison',intent:'custom-intent',kind:'self',weight:annualWeight('home',57),minutes:35,independentFromLucas:true}
  ];
  const filtered=now<720?candidates.filter(c=>!['calling-friend','wardrobe'].includes(c.activity)):now>=1320?candidates.filter(c=>!['work-project'].includes(c.activity)):candidates;
  return filtered[seed%filtered.length]||null;
}

declare global{interface Window{__moniaMarionHomeRhythm?:()=>MarionHomeRhythm|null}}
window.__moniaMarionHomeRhythm=getMarionHomeRhythm;
