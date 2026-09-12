const SAVE_KEY='marion-lucas-save-v4';
const MARION_START_AGE=20;
const LUCAS_START_AGE=22;
const DAYS_PER_LIFE_YEAR=365;

type Save={day?:number;marionAge?:number;lucasAge?:number;flags?:Record<string,unknown>};
export type LifeAgeSnapshot={day:number;lifeYear:number;elapsedYears:number;marionAge:number;lucasAge:number;canonical:true;};
export type LifeAgeInvariant={years:number;day:number;marionAge:number;lucasAge:number;ok:boolean};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function ageAtDay(startAge:number,day:number){return startAge+Math.floor((Math.max(1,day)-1)/DAYS_PER_LIFE_YEAR)}

export function getLifeAgeSnapshot(save?:Save|null):LifeAgeSnapshot{
  const s=save===undefined?read():save;
  const day=Math.max(1,n(s?.day,1));
  const elapsedYears=Math.floor((day-1)/DAYS_PER_LIFE_YEAR);
  return{day,lifeYear:elapsedYears+1,elapsedYears,marionAge:ageAtDay(MARION_START_AGE,day),lucasAge:ageAtDay(LUCAS_START_AGE,day),canonical:true};
}

export function getMarionAge(){return getLifeAgeSnapshot().marionAge}
export function getLucasAge(){return getLifeAgeSnapshot().lucasAge}

export function verifyLifeAgeHorizons(yearsList:number[]=[0,1,2,10,30,50]):LifeAgeInvariant[]{
  return yearsList.map(years=>{
    const safeYears=Math.max(0,Math.floor(n(years)));
    const day=1+safeYears*DAYS_PER_LIFE_YEAR;
    const snapshot=getLifeAgeSnapshot({day,marionAge:999,lucasAge:999});
    const marionAge=MARION_START_AGE+safeYears;
    const lucasAge=LUCAS_START_AGE+safeYears;
    return{years:safeYears,day,marionAge:snapshot.marionAge,lucasAge:snapshot.lucasAge,ok:snapshot.marionAge===marionAge&&snapshot.lucasAge===lucasAge};
  });
}

export function legacyAgeFieldsMatchCanonical(save?:Save|null){
  const s=save===undefined?read():save;
  if(!s)return true;
  const ages=getLifeAgeSnapshot(s);
  const marionLegacy=s.marionAge===undefined?ages.marionAge:n(s.marionAge,ages.marionAge);
  const lucasLegacy=s.lucasAge===undefined?ages.lucasAge:n(s.lucasAge,ages.lucasAge);
  return marionLegacy===ages.marionAge&&lucasLegacy===ages.lucasAge;
}

declare global{interface Window{__moniaLifeAges?:()=>LifeAgeSnapshot;__moniaMarionAge?:()=>number;__moniaLucasAge?:()=>number;__moniaLifeAgeHorizons?:()=>LifeAgeInvariant[];__moniaLegacyAgesMatch?:()=>boolean}}
window.__moniaLifeAges=getLifeAgeSnapshot;
window.__moniaMarionAge=getMarionAge;
window.__moniaLucasAge=getLucasAge;
window.__moniaLifeAgeHorizons=verifyLifeAgeHorizons;
window.__moniaLegacyAgesMatch=legacyAgeFieldsMatchCanonical;
