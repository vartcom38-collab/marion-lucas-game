import { getLifeAgeSnapshot, syncCanonicalAgeFields } from './life-age-engine';
import { ensureLifeMilestoneChronology } from './life-milestone-chronology';

const SAVE_KEY='marion-lucas-save-v4';
type ChildRecord={id?:string;birthDay?:number};
type Save={day?:number;eventHistory?:string[];flags?:Record<string,unknown>};
export type LongHorizonIntegrity={ok:boolean;day:number;yearsElapsed:number;issues:string[];repairs:string[]};
let running=false;
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
export function auditLongHorizonIntegrity(repair=true):LongHorizonIntegrity{
 const s=read();if(!s)return{ok:true,day:1,yearsElapsed:0,issues:[],repairs:[]};const day=Math.max(1,Math.floor(n(s.day,1))),issues:string[]=[],repairs:string[]=[];const f=s.flags||(s.flags={});
 const ages=getLifeAgeSnapshot(s);if(!Number.isFinite(ages.marionAge)||!Number.isFinite(ages.lucasAge))issues.push('invalid-canonical-age');
 const chronology=ensureLifeMilestoneChronology(s);if(chronology?.officialDay&&chronology.engagedDay&&chronology.engagedDay<chronology.officialDay)issues.push('engagement-before-official');if(chronology?.engagedDay&&chronology.marriedDay&&chronology.marriedDay<chronology.engagedDay)issues.push('marriage-before-engagement');
 const children=Array.isArray(f.childRecords)?f.childRecords as ChildRecord[]:[];for(const child of children){const b=n(child.birthDay,0);if(b<1)issues.push(`child-invalid-birth:${String(child.id||'unknown')}`);else if(b>day)issues.push(`child-future-birth:${String(child.id||'unknown')}`)}
 if(Array.isArray(s.eventHistory)&&s.eventHistory.length>500){if(repair){s.eventHistory=s.eventHistory.slice(-500);repairs.push('trimmed-event-history')}else issues.push('event-history-unbounded')}
 if(repair){syncCanonicalAgeFields();if(repairs.length){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s))}catch{issues.push('save-write-failed')}}}
 return{ok:issues.length===0,day,yearsElapsed:Math.floor((day-1)/365),issues,repairs};
}
function refresh(){if(running)return;running=true;try{auditLongHorizonIntegrity(true)}finally{running=false}}
window.setTimeout(refresh,2200);window.addEventListener('storage',refresh);window.addEventListener('monia:save-changed',refresh as EventListener);window.setInterval(refresh,120000);
declare global{interface Window{__moniaLongHorizonIntegrity?:(repair?:boolean)=>LongHorizonIntegrity}}
window.__moniaLongHorizonIntegrity=auditLongHorizonIntegrity;
