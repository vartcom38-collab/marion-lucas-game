import { getLucasPresence } from './lucas-presence-engine';
import { getTaurineCareerPressure } from './taurine-career-pressure-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;flags?:Record<string,unknown>};
export type LucasHomeActivity='sleeping'|'resting'|'training'|'working'|'with-cuadrilla'|'out'|'quiet-home'|'available';
export type LucasHomeRhythm={atHome:boolean;activity:LucasHomeActivity;interruptible:boolean;privateTimePossible:boolean;contactNatural:boolean;label:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function isHomeLike(place:string){return /home|maison|appartement|finca|chez eux|domicile/i.test(place)}

export function getLucasHomeRhythm():LucasHomeRhythm|null{
  const s=read();if(!s||!s.official)return null;const presence=getLucasPresence();if(!presence||!presence.together)return null;const place=String(s.place||'');if(!isHomeLike(place))return null;
  const now=mins(s.time),pressure=getTaurineCareerPressure(),seed=hash(`${n(s.day,1)}:${Math.floor(now/90)}:${pressure?.level||'none'}`);
  let activity:LucasHomeActivity='available';
  if(now<390||now>=1410)activity='sleeping';
  else if((pressure?.restPriority||0)>=78&&(now<660||now>=1260))activity='resting';
  else if(now>=420&&now<660&&seed%4===0)activity='training';
  else if(pressure?.level==='high'||pressure?.level==='peak'){activity=seed%3===0?'with-cuadrilla':'working';}
  else if(seed%9===0)activity='out';
  else if(seed%4===0)activity='quiet-home';

  const interruptible=activity==='available'||activity==='quiet-home'||activity==='resting';
  const privateTimePossible=activity==='available'||activity==='quiet-home';
  const contactNatural=activity!=='sleeping'&&activity!=='working'&&activity!=='training'&&activity!=='with-cuadrilla';
  const label=activity==='sleeping'?'Lucas dort.':activity==='resting'?'Lucas récupère tranquillement.':activity==='training'?'Lucas est pris par son entraînement.':activity==='working'?'Lucas travaille encore sur des choses liées à sa carrière.':activity==='with-cuadrilla'?'Lucas est occupé avec la cuadrilla.':activity==='out'?'Lucas est sorti un moment.':activity==='quiet-home'?'Lucas est à la maison, dans un moment calme.':'Lucas est à la maison et disponible.';
  return{atHome:true,activity,interruptible,privateTimePossible,contactNatural,label};
}

declare global{interface Window{__moniaLucasHomeRhythm?:()=>LucasHomeRhythm|null}}
window.__moniaLucasHomeRhythm=getLucasHomeRhythm;
