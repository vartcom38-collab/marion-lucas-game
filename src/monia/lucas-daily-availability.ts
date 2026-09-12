import { getLucasPresence } from './lucas-presence-engine';
import { getTaurineCareerPressure } from './taurine-career-pressure-engine';
import { getLucasCareerEvolution } from './lucas-career-evolution';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;official?:boolean;relationship?:number;trust?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type LucasContactAvailability='easy'|'normal'|'limited'|'later';
export type LucasDailyTone='tender'|'quiet'|'focused'|'drained'|'normal';
export type LucasDailyAvailability={availability:LucasContactAvailability;tone:LucasDailyTone;canCallNow:boolean;canMessageNow:boolean;privateTimeWeight:number;contactWeight:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}

export function getLucasDailyAvailability():LucasDailyAvailability|null{
  const s=read();if(!s)return null;const presence=getLucasPresence();if(!presence)return null;const pressure=getTaurineCareerPressure();const career=getLucasCareerEvolution();const now=mins(s.time);const rel=n(s.relationship),trust=n(s.trust);const seed=hash(`${n(s.day,1)}:${Math.floor(now/90)}:${pressure?.level||'none'}`);
  let availability:LucasContactAvailability='normal';
  if(presence.state==='traveling')availability='later';
  else if(presence.state==='working')availability=pressure?.level==='peak'?'later':'limited';
  else if(pressure?.level==='peak')availability='limited';
  else if(pressure?.level==='low'&&rel>=45)availability='easy';

  let tone:LucasDailyTone='normal';
  if((pressure?.restPriority||0)>=78)tone='drained';
  else if(presence.state==='working'||pressure?.level==='high'||pressure?.level==='peak')tone='focused';
  else if((pressure?.privateLifePriority||0)>=72&&rel>=55&&trust>=45)tone=(seed%3===0?'quiet':'tender');
  else if(career?.phase==='selective'||career?.phase==='veteran')tone='quiet';

  const canMessageNow=presence.reachableByPhone!==false;
  const canCallNow=canMessageNow&&availability!=='later'&&!(presence.state==='working'&&availability==='limited');
  const privateBase=presence.privateTimePossible?64:0;
  const privateTimeWeight=presence.privateTimePossible?clamp(privateBase+Math.round((pressure?.privateLifePriority||50)/6)-Math.round((pressure?.restPriority||0)/9),28,88):0;
  const contactBase=availability==='easy'?72:availability==='normal'?60:availability==='limited'?43:28;
  const contactWeight=clamp(contactBase+(tone==='tender'?7:0)+(tone==='drained'?-5:0),20,82);
  const reason=availability==='later'?'Lucas est pris par un déplacement ou un moment professionnel qui rend un appel immédiat peu naturel.':availability==='limited'?'Lucas reste joignable, mais sa disponibilité est réduite par son rythme professionnel.':tone==='drained'?'Lucas est présent mais très fatigué; les échanges courts et calmes sont plus naturels.':tone==='tender'?'La pression extérieure retombe assez pour laisser davantage de place au couple.':'Lucas reste disponible sans que sa carrière disparaisse du contexte.';
  return{availability,tone,canCallNow,canMessageNow,privateTimeWeight,contactWeight,reason};
}

declare global{interface Window{__moniaLucasDailyAvailability?:()=>LucasDailyAvailability|null}}
window.__moniaLucasDailyAvailability=getLucasDailyAvailability;
