const SAVE_KEY='marion-lucas-save-v4';

type ChildRecord={id:string;birthDay:number;name?:string;sex?:'girl'|'boy'|'unknown';temperament:'calm'|'curious'|'sensitive'|'energetic';sleepTone:'easy'|'mixed'|'light';socialTone:'observant'|'warm'|'independent'|'outgoing'};
type Save={day?:number;children?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ChildLifeSnapshot=ChildRecord&{ageDays:number;ageYears:number;stage:'newborn'|'baby'|'toddler'|'child'|'preteen'|'teen'|'adult-child'};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:children-changed'))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function stage(ageDays:number):ChildLifeSnapshot['stage']{const y=ageDays/365;return y<.08?'newborn':y<2?'baby':y<4?'toddler':y<10?'child':y<13?'preteen':y<18?'teen':'adult-child'}
function getRecords(s:Save):ChildRecord[]{const f=s.flags||(s.flags={});const raw=Array.isArray(f.childRecords)?f.childRecords as ChildRecord[]:[];return raw.filter(x=>x&&typeof x.id==='string'&&Number.isFinite(Number(x.birthDay)))}
function makeRecord(index:number,birthDay:number):ChildRecord{const id=`child-${index+1}-${birthDay}`;const temps:ChildRecord['temperament'][]=['calm','curious','sensitive','energetic'];const sleeps:ChildRecord['sleepTone'][]=['easy','mixed','light'];const socials:ChildRecord['socialTone'][]=['observant','warm','independent','outgoing'];return{id,birthDay,temperament:temps[hash(`${id}:temperament`)%temps.length],sleepTone:sleeps[hash(`${id}:sleep`)%sleeps.length],socialTone:socials[hash(`${id}:social`)%socials.length],sex:'unknown'} }
function historyBirthDays(s:Save){
  const found:number[]=[];for(const entry of s.eventHistory||[]){const text=String(entry);let m=text.match(/^canonical-birth:cycle-\d+:[^:]+:(\d+)$/);if(!m)m=text.match(/^child-registered:[^:]+:(\d+)$/);if(!m)continue;const day=Math.max(1,n(m[1],0));if(day&&!found.includes(day))found.push(day)}return found.sort((a,b)=>a-b)
}

export function ensureChildRecords(){const s=read();if(!s)return[] as ChildLifeSnapshot[];const count=Math.max(0,Math.floor(n(s.children,0)));const f=s.flags||(s.flags={});let records=getRecords(s);let changed=false;const historical=historyBirthDays(s);
  while(records.length<count){const index=records.length;const explicit=n(f[`child:${index+1}:birthDay`],0);const recovered=historical[index]||0;const fallback=n(f.lastBirthDay,n(f.birthDay,n(s.day,1)));const birthDay=Math.max(1,explicit||recovered||fallback);records.push(makeRecord(index,birthDay));if(!explicit&&!recovered)f.childRecordsChronologyApproximate=true;changed=true}
  if(records.length>count&&count>=0){records=records.slice(0,count);changed=true}
  if(changed){f.childRecords=records;f.childRecordsMigratedDay=Math.max(1,n(s.day,1));s.eventHistory=[...(s.eventHistory||[]),`children-records-sync:${count}:${n(s.day,1)}`].slice(-420);write(s)}
  const day=Math.max(1,n(s.day,1));return records.map(r=>{const ageDays=Math.max(0,day-r.birthDay);return{...r,ageDays,ageYears:ageDays/365,stage:stage(ageDays)}})
}

export function registerChild(input:{birthDay?:number;name?:string;sex?:'girl'|'boy'|'unknown'}={}){const s=read();if(!s)return null;const f=s.flags||(s.flags={});const records=getRecords(s);const birthDay=Math.max(1,n(input.birthDay,n(s.day,1)));const r=makeRecord(records.length,birthDay);if(input.name?.trim())r.name=input.name.trim();if(input.sex)r.sex=input.sex;records.push(r);f.childRecords=records;s.children=records.length;f.lastBirthDay=birthDay;s.eventHistory=[...(s.eventHistory||[]),`child-registered:${r.id}:${birthDay}`].slice(-420);write(s);return r}

export function updateChildIdentity(id:string,patch:{name?:string;sex?:'girl'|'boy'|'unknown'}){const s=read();if(!s)return false;const f=s.flags||(s.flags={});const records=getRecords(s);const i=records.findIndex(r=>r.id===id);if(i<0)return false;if(patch.name!==undefined)records[i].name=patch.name.trim()||undefined;if(patch.sex)records[i].sex=patch.sex;f.childRecords=records;write(s);return true}

export function getChildrenLife(){return ensureChildRecords()}

declare global{interface Window{__moniaChildrenLife?:()=>ChildLifeSnapshot[];__moniaRegisterChild?:(input?:{birthDay?:number;name?:string;sex?:'girl'|'boy'|'unknown'})=>ChildRecord|null;__moniaUpdateChildIdentity?:(id:string,patch:{name?:string;sex?:'girl'|'boy'|'unknown'})=>boolean}}
window.__moniaChildrenLife=getChildrenLife;window.__moniaRegisterChild=registerChild;window.__moniaUpdateChildIdentity=updateChildIdentity;
