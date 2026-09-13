const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;official?:boolean;engaged?:boolean;married?:boolean;flags?:Record<string,unknown>};
export type LifeMilestoneChronology={day:number;officialDay:number|null;engagedDay:number|null;marriedDay:number|null;migrated:boolean};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function validDay(v:unknown){const x=n(v,0);return x>=1?Math.floor(x):null}

export function ensureLifeMilestoneChronology(save?:Save|null):LifeMilestoneChronology|null{
  const s=save===undefined?read():save;if(!s)return null;const day=Math.max(1,n(s.day,1));const f=s.flags||(s.flags={});let migrated=false;
  let officialDay=validDay(f.officialDay);let engagedDay=validDay(f.engagedDay);let marriedDay=validDay(f.marriedDay);
  if(s.official&&!officialDay){officialDay=day;f.officialDay=day;migrated=true}
  if(s.engaged&&!engagedDay){engagedDay=day;f.engagedDay=day;migrated=true}
  if(s.married&&!marriedDay){marriedDay=day;f.marriedDay=day;migrated=true}
  if(officialDay&&engagedDay&&engagedDay<officialDay){engagedDay=officialDay;f.engagedDay=officialDay;migrated=true}
  if(engagedDay&&marriedDay&&marriedDay<engagedDay){marriedDay=engagedDay;f.marriedDay=engagedDay;migrated=true}
  if(migrated&&save===undefined){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'life-milestone-chronology'}}))}catch{}}
  return{day,officialDay,engagedDay,marriedDay,migrated};
}

declare global{interface Window{__moniaLifeMilestones?:()=>LifeMilestoneChronology|null}}
window.__moniaLifeMilestones=()=>ensureLifeMilestoneChronology();

void ensureLifeMilestoneChronology();
