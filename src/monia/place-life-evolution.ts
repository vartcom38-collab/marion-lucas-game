import { getAnnualLifeProfile } from './annual-life-variation';
import { getCurrentPlaceHistory } from './place-history-life';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;place?:string;children?:number;official?:boolean;married?:boolean;flags?:Record<string,unknown>;eventHistory?:string[]};
export type PlaceLifeMode='fresh'|'habitual'|'social'|'family'|'quiet'|'transit'|'memory-rich';
export type PlaceLifeEvolution={placeId:string;mode:PlaceLifeMode;lifeYear:number;usageShift:string;ambientDensity:number;socialPresence:number;familyPresence:number;memoryPresence:number;reason:string};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
export function getCurrentPlaceLifeEvolution():PlaceLifeEvolution|null{
 const s=read(),history=getCurrentPlaceHistory();if(!s||!history)return null;const annual=getAnnualLifeProfile(),season=getSeasonalLifeSnapshot();const year=annual?.lifeYear||Math.floor((Math.max(1,n(s.day,1))-1)/365)+1;const place=String(s.place||'home');
 const home=/home|maison|appartement|finca|domicile|chez eux/i.test(place),hotel=/hotel/i.test(place),kids=n(s.children),seed=hash(`place-evolution:${history.id}:${year}`)%100;
 const memoryPresence=clamp(history.score+(history.meaningfulMoments*3));const socialPresence=clamp((annual?.socialBias||50)+(history.visits>8?8:0)+(seed%17)-8);const familyPresence=clamp((kids>0?58:24)+(home?18:0)+(s.married?8:0)+(seed%13)-6);const ambientDensity=clamp(36+history.score*.42+(annual?.homeBias||50)*.18+(season?.season==='summer'?8:0));
 let mode:PlaceLifeMode='fresh';if(hotel)mode='transit';else if(history.tier==='deeply-lived'||history.tier==='important')mode='memory-rich';else if(home&&kids>0&&familyPresence>=58)mode='family';else if(socialPresence>=68)mode='social';else if(history.tier==='anchored'||history.tier==='familiar')mode='habitual';else if((annual?.homeBias||50)>=65)mode='quiet';
 const usageShift=mode==='memory-rich'?'Le lieu n’est plus vécu comme avant : les habitudes ont changé, mais plusieurs époques de leur vie y coexistent désormais.':mode==='family'?'Le lieu est davantage traversé par la vie familiale cette année, sans empêcher les sorties, les voyages ni la vie adulte.':mode==='social'?'Cette année, le lieu sert davantage de point de rencontre et de passage.':mode==='habitual'?'Le lieu fonctionne surtout comme un repère du quotidien, avec des usages devenus naturels.':mode==='quiet'?'Cette période rend le lieu plus calme et plus intime qu’à d’autres années.':mode==='transit'?'Ce lieu reste une base temporaire : son ambiance dépend surtout du passage et du rythme du moment.':'Le lieu est encore suffisamment neuf pour que ses usages ne soient pas figés.';
 return{placeId:history.id,mode,lifeYear:year,usageShift,ambientDensity,socialPresence,familyPresence,memoryPresence,reason:`${history.reason} ${usageShift}`};
}
declare global{interface Window{__moniaPlaceLifeEvolution?:()=>PlaceLifeEvolution|null}}
window.__moniaPlaceLifeEvolution=getCurrentPlaceLifeEvolution;
