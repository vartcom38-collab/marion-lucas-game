const SAVE_KEY='marion-lucas-save-v4';
const MARION_START_AGE=20;
const LUCAS_START_AGE=22;
const DAYS_PER_LIFE_YEAR=365;
export const MARION_BIRTHDAY={month:7,day:4,dayOfYear:185,label:'4 juillet'} as const;
export const LUCAS_BIRTHDAY={month:10,day:3,dayOfYear:276,label:'3 octobre'} as const;

type Save={day?:number;marionAge?:number;lucasAge?:number;flags?:Record<string,unknown>;updatedAt?:number};
export type LifeAgeSnapshot={day:number;lifeYear:number;elapsedYears:number;dayOfYear:number;marionAge:number;lucasAge:number;canonical:true;};
export type LifeAgeInvariant={years:number;day:number;marionAge:number;lucasAge:number;ok:boolean};
let syncing=false;

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function dayOfYear(day:number){return((Math.max(1,day)-1)%DAYS_PER_LIFE_YEAR)+1}
function ageAtDay(startAge:number,birthdayDayOfYear:number,day:number){const safeDay=Math.max(1,day);const elapsedYears=Math.floor((safeDay-1)/DAYS_PER_LIFE_YEAR);return startAge+elapsedYears+(dayOfYear(safeDay)>=birthdayDayOfYear?1:0)}

export function getLifeAgeSnapshot(save?:Save|null):LifeAgeSnapshot{
  const s=save===undefined?read():save;
  const day=Math.max(1,n(s?.day,1));
  const elapsedYears=Math.floor((day-1)/DAYS_PER_LIFE_YEAR);
  return{day,lifeYear:elapsedYears+1,elapsedYears,dayOfYear:dayOfYear(day),marionAge:ageAtDay(MARION_START_AGE,MARION_BIRTHDAY.dayOfYear,day),lucasAge:ageAtDay(LUCAS_START_AGE,LUCAS_BIRTHDAY.dayOfYear,day),canonical:true};
}

export function getMarionAge(){return getLifeAgeSnapshot().marionAge}
export function getLucasAge(){return getLifeAgeSnapshot().lucasAge}
export function isMarionBirthday(day=getLifeAgeSnapshot().day){return dayOfYear(day)===MARION_BIRTHDAY.dayOfYear}
export function isLucasBirthday(day=getLifeAgeSnapshot().day){return dayOfYear(day)===LUCAS_BIRTHDAY.dayOfYear}

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

export function syncCanonicalAgeFields(){
  if(syncing)return false;const s=read();if(!s)return false;const ages=getLifeAgeSnapshot(s);
  if(s.marionAge===ages.marionAge&&s.lucasAge===ages.lucasAge)return false;
  syncing=true;try{s.marionAge=ages.marionAge;s.lucasAge=ages.lucasAge;s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('marion:age-sync',{detail:ages}));return true}finally{syncing=false}
}

function scheduleSync(){window.setTimeout(syncCanonicalAgeFields,0)}
window.addEventListener('marion:statechange',scheduleSync);window.addEventListener('monia:save-changed',scheduleSync as EventListener);window.addEventListener('storage',scheduleSync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncCanonicalAgeFields()});syncCanonicalAgeFields();

declare global{interface Window{__moniaLifeAges?:()=>LifeAgeSnapshot;__moniaMarionAge?:()=>number;__moniaLucasAge?:()=>number;__moniaLifeAgeHorizons?:()=>LifeAgeInvariant[];__moniaLegacyAgesMatch?:()=>boolean;__moniaSyncCanonicalAges?:()=>boolean;__moniaIsMarionBirthday?:(day?:number)=>boolean;__moniaIsLucasBirthday?:(day?:number)=>boolean}}
window.__moniaLifeAges=getLifeAgeSnapshot;
window.__moniaMarionAge=getMarionAge;
window.__moniaLucasAge=getLucasAge;
window.__moniaLifeAgeHorizons=verifyLifeAgeHorizons;
window.__moniaLegacyAgesMatch=legacyAgeFieldsMatchCanonical;
window.__moniaSyncCanonicalAges=syncCanonicalAgeFields;
window.__moniaIsMarionBirthday=isMarionBirthday;
window.__moniaIsLucasBirthday=isLucasBirthday;
