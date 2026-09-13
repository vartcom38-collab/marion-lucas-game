import { getChildrenLife } from './children-life';

const SAVE_KEY='marion-lucas-save-v4';
type Parent='marion'|'lucas';
type BondMoment={day:number;parent:Parent;kind:'care'|'play'|'talk'|'school'|'outing'|'travel'|'support'|'conflict'|'celebration';weight:number;note?:string};
type BondRecord={childId:string;marion:number;lucas:number;moments:BondMoment[];lastDay?:number};
type Save={day?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ChildBondSnapshot={childId:string;label:string;stage:string;marionBond:number;lucasBond:number;recentMoments:BondMoment[];sharedRhythm:'care-heavy'|'playful'|'school-life'|'growing-independence'|'adult-relationship'};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:child-bonds-changed'))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function records(s:Save):BondRecord[]{const raw=Array.isArray(s.flags?.childBondRecords)?s.flags?.childBondRecords as BondRecord[]:[];return raw.filter(r=>r&&typeof r.childId==='string')}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function rhythm(stage:string):ChildBondSnapshot['sharedRhythm']{return stage==='newborn'||stage==='baby'||stage==='toddler'?'care-heavy':stage==='child'?'playful':stage==='preteen'?'school-life':stage==='teen'?'growing-independence':'adult-relationship'}

export function ensureChildBonds(){const s=read();if(!s)return[] as ChildBondSnapshot[];const kids=getChildrenLife();const f=s.flags||(s.flags={});let rs=records(s),changed=false;
  for(const kid of kids){if(!rs.some(r=>r.childId===kid.id)){rs.push({childId:kid.id,marion:50,lucas:50,moments:[]});changed=true}}
  rs=rs.filter(r=>kids.some(k=>k.id===r.childId));
  if(changed){f.childBondRecords=rs;write(s)}
  return kids.map(k=>{const r=rs.find(x=>x.childId===k.id)!;return{childId:k.id,label:k.name||k.id,stage:k.stage,marionBond:clamp(n(r.marion,50)),lucasBond:clamp(n(r.lucas,50)),recentMoments:(r.moments||[]).slice(-8),sharedRhythm:rhythm(k.stage)}})
}

export function recordChildBondMoment(childId:string,parent:Parent,kind:BondMoment['kind'],input:{weight?:number;note?:string}={}){
  const s=read();if(!s)return false;const kids=getChildrenLife();if(!kids.some(k=>k.id===childId))return false;const f=s.flags||(s.flags={});const rs=records(s);let r=rs.find(x=>x.childId===childId);if(!r){r={childId,marion:50,lucas:50,moments:[]};rs.push(r)}
  const day=Math.max(1,n(s.day,1)),weight=Math.max(-8,Math.min(8,n(input.weight,kind==='conflict'?-2:2)));const moment:BondMoment={day,parent,kind,weight,note:input.note?.trim()||undefined};r.moments=[...(r.moments||[]),moment].slice(-120);r.lastDay=day;if(parent==='marion')r.marion=clamp(n(r.marion,50)+weight);else r.lucas=clamp(n(r.lucas,50)+weight);f.childBondRecords=rs;s.eventHistory=[...(s.eventHistory||[]),`child-bond:${childId}:${parent}:${kind}:${day}`].slice(-500);write(s);return true
}

export function getChildBond(childId:string){return ensureChildBonds().find(x=>x.childId===childId)||null}

declare global{interface Window{__moniaChildBonds?:()=>ChildBondSnapshot[];__moniaRecordChildBond?:(childId:string,parent:Parent,kind:BondMoment['kind'],input?:{weight?:number;note?:string})=>boolean;__moniaChildBond?:(childId:string)=>ChildBondSnapshot|null}}
window.__moniaChildBonds=ensureChildBonds;window.__moniaRecordChildBond=recordChildBondMoment;window.__moniaChildBond=getChildBond;
