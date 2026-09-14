import { getLifeAgeSnapshot } from './life-age-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;children?:number;careerLevel?:number;flags?:Record<string,unknown>};
export type AdultLifeRhythm={marionAge:number;lucasAge:number;phase:'twenties'|'thirties'|'forties'|'fifties'|'sixties-plus';stability:number;flexibility:number;legacyWeight:number;familyAutonomy:number;reason:string};
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function smooth(age:number,start:number,end:number){if(age<=start)return 0;if(age>=end)return 1;const t=(age-start)/(end-start);return t*t*(3-2*t)}
export function getAdultLifeRhythm():AdultLifeRhythm{
 const s=read();const ages=getLifeAgeSnapshot(s),a=ages.marionAge,la=ages.lucasAge,children=Math.max(0,n(s?.children));
 const phase=a<30?'twenties':a<40?'thirties':a<50?'forties':a<60?'fifties':'sixties-plus';
 // These are pacing weights, never health or capability assumptions. They move gradually instead of resetting on birthdays.
 const stability=clamp(34+smooth(a,25,45)*34+smooth(a,45,65)*12);
 const flexibility=clamp(78-smooth(a,30,55)*12+smooth(a,55,70)*8);
 const legacyWeight=clamp(8+smooth(Math.max(a,la),35,60)*62);
 const familyAutonomy=clamp(children?22+smooth(a,38,60)*50:70);
 const reason=phase==='twenties'?'La vie adulte reste très ouverte : les habitudes se construisent sans figer la suite.':phase==='thirties'?'Les choix accumulés donnent davantage d’ancrage, tout en laissant de la place aux changements.':phase==='forties'?'Les années précédentes comptent davantage : carrière, famille, lieux et amitiés se rééquilibrent sans remise à zéro.':phase==='fifties'?'La vie gagne en continuité et en transmission, avec encore de vrais projets et déplacements possibles.':'Les liens, les choix et l’histoire commune pèsent davantage que l’âge seul : la partie continue sans basculer dans un épilogue automatique.';
 return{marionAge:a,lucasAge:la,phase,stability,flexibility,legacyWeight,familyAutonomy,reason};
}
declare global{interface Window{__moniaAdultLifeRhythm?:()=>AdultLifeRhythm}}
window.__moniaAdultLifeRhythm=getAdultLifeRhythm;
