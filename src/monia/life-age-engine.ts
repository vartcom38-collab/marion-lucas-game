const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;marionAge?:number;lucasAge?:number;flags?:Record<string,unknown>};
export type LifeAgeSnapshot={day:number;lifeYear:number;elapsedYears:number;marionAge:number;lucasAge:number;canonical:true;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}

export function getLifeAgeSnapshot(save?:Save|null):LifeAgeSnapshot{
  const s=save===undefined?read():save;const day=Math.max(1,n(s?.day,1));const elapsedYears=Math.floor((day-1)/365);
  return{day,lifeYear:elapsedYears+1,elapsedYears,marionAge:20+elapsedYears,lucasAge:22+elapsedYears,canonical:true};
}

export function getMarionAge(){return getLifeAgeSnapshot().marionAge}
export function getLucasAge(){return getLifeAgeSnapshot().lucasAge}

declare global{interface Window{__moniaLifeAges?:()=>LifeAgeSnapshot;__moniaMarionAge?:()=>number;__moniaLucasAge?:()=>number}}
window.__moniaLifeAges=getLifeAgeSnapshot;window.__moniaMarionAge=getMarionAge;window.__moniaLucasAge=getLucasAge;
