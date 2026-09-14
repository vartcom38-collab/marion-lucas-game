import { ensureLifeMilestoneChronology } from './life-milestone-chronology';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;married?:boolean;children?:number;pending?:string[];flags?:Record<string,unknown>};
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function familyProjectAvailable(s:Save){const c=ensureLifeMilestoneChronology(s),day=Math.max(1,n(s.day,1)),marriedDay=c?.marriedDay||0;return!!s.married&&!!marriedDay&&day>=marriedDay+60}
function sanitize(s:Save,previous?:Save|null){const f=s.flags||(s.flags={});let changed=false;const pending=Array.isArray(s.pending)?s.pending:[];const next=pending.filter(id=>id==='family_future'?familyProjectAvailable(s):id!=='family_growth');if(next.length!==pending.length){s.pending=next;changed=true}
  if(f.familyWanted===true&&String(f.familyState||'closed')==='closed'){f.familyState='thinking';f.familyProjectOpenedDay=Math.max(1,n(s.day,1));changed=true}
  if(previous&&n(s.children,0)>n(previous.children,0)&&f.familyGrowthDone===true&&f.postpartum!==true){s.children=n(previous.children,0);f.familyGrowthDone=false;changed=true}
  return changed}
const inheritedSetItem=Storage.prototype.setItem;
if(!(Storage.prototype as unknown as Record<string,unknown>).__moniaFamilyProgressionGuard){
  (Storage.prototype as unknown as Record<string,unknown>).__moniaFamilyProgressionGuard=true;
  Storage.prototype.setItem=function(key:string,value:string){
    if(key!==SAVE_KEY)return inheritedSetItem.call(this,key,value);
    try{const previousRaw=this.getItem(SAVE_KEY),previous=previousRaw?JSON.parse(previousRaw) as Save:null,parsed=JSON.parse(value) as Save;sanitize(parsed,previous);return inheritedSetItem.call(this,key,JSON.stringify(parsed))}catch{return inheritedSetItem.call(this,key,value)}
  };
}
function normalize(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;const s=JSON.parse(raw) as Save;if(!sanitize(s,null))return;inheritedSetItem.call(localStorage,SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'legacy-family-progression-guard'}}))}catch{}}
normalize();
