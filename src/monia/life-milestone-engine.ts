import './birthday-life';
import { getLifeAgeSnapshot } from './life-age-engine';
import { getChildrenLife, type ChildLifeSnapshot } from './children-life';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;marionAge?:number;lucasAge?:number;flags?:Record<string,unknown>;eventHistory?:string[];memories?:string[];updatedAt?:number};
type ChildStage=ChildLifeSnapshot['stage'];
export type LifeMilestoneSnapshot={day:number;initialized:boolean;marionAge:number;lucasAge:number;childStages:Record<string,ChildStage>;events:string[];canonical:true};

const STAGES:ChildStage[]=['newborn','baby','toddler','child','preteen','teen','adult-child'];
let syncing=false;

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function stageMap(v:unknown):Record<string,ChildStage>{if(!v||typeof v!=='object'||Array.isArray(v))return{};const out:Record<string,ChildStage>={};for(const [id,stage] of Object.entries(v as Record<string,unknown>)){if(STAGES.includes(stage as ChildStage))out[id]=stage as ChildStage}return out}
function addUnique(list:string[]|undefined,text:string,max:number){const next=Array.isArray(list)?list:[];if(!next.includes(text))next.unshift(text);return next.slice(0,max)}
function stageLabel(stage:ChildStage){return stage==='newborn'?'nouveau-né':stage==='baby'?'bébé':stage==='toddler'?'petite enfance':stage==='child'?'enfance':stage==='preteen'?'pré-adolescence':stage==='teen'?'adolescence':'âge adulte'}
function childLabel(child:ChildLifeSnapshot){return child.name?.trim()||'Un enfant de la famille'}
function crossedStages(from:ChildStage,to:ChildStage){const a=STAGES.indexOf(from),b=STAGES.indexOf(to);return a>=0&&b>a?STAGES.slice(a+1,b+1):[]}
function sameStages(a:Record<string,ChildStage>,b:Record<string,ChildStage>){const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>a[k]===b[k])}

export function syncLifeMilestones():LifeMilestoneSnapshot|null{
  if(syncing)return null;const s=read();if(!s)return null;syncing=true;
  try{
    const f=s.flags||(s.flags={}),day=Math.max(1,n(s.day,1)),ages=getLifeAgeSnapshot(s),children=getChildrenLife();
    const currentStages=Object.fromEntries(children.map(c=>[c.id,c.stage])) as Record<string,ChildStage>;
    const observedDay=n(f.lifeMilestoneObservedDay,0),observedMarion=n(f.lifeMilestoneMarionAge,-1),observedLucas=n(f.lifeMilestoneLucasAge,-1),observedStages=stageMap(f.lifeMilestoneChildStages);
    const initialized=observedDay>0&&observedMarion>=0&&observedLucas>=0;const events:string[]=[];

    if(!initialized||day<observedDay){
      f.lifeMilestoneObservedDay=day;f.lifeMilestoneMarionAge=ages.marionAge;f.lifeMilestoneLucasAge=ages.lucasAge;f.lifeMilestoneChildStages=currentStages;f.lifeMilestoneSchema=1;s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));
      return{day,initialized:false,marionAge:ages.marionAge,lucasAge:ages.lucasAge,childStages:currentStages,events,canonical:true};
    }

    if(ages.marionAge>observedMarion){for(let age=observedMarion+1;age<=ages.marionAge;age++){const e=`life-age:marion:${age}`;events.push(e);s.memories=addUnique(s.memories,`Marion a eu ${age} ans.`,80)}}
    if(ages.lucasAge>observedLucas){for(let age=observedLucas+1;age<=ages.lucasAge;age++){const e=`life-age:lucas:${age}`;events.push(e);s.memories=addUnique(s.memories,`Lucas a eu ${age} ans.`,80)}}

    for(const child of children){const previous=observedStages[child.id];if(!previous)continue;for(const next of crossedStages(previous,child.stage)){const e=`child-stage:${child.id}:${next}`;events.push(e);s.memories=addUnique(s.memories,`${childLabel(child)} entre dans une nouvelle étape : ${stageLabel(next)}.`,80)}}

    const observationChanged=day!==observedDay||ages.marionAge!==observedMarion||ages.lucasAge!==observedLucas||!sameStages(currentStages,observedStages);
    if(observationChanged||events.length){
      f.lifeMilestoneObservedDay=day;f.lifeMilestoneMarionAge=ages.marionAge;f.lifeMilestoneLucasAge=ages.lucasAge;f.lifeMilestoneChildStages=currentStages;f.lifeMilestoneSchema=1;
      if(events.length){const history=Array.isArray(s.eventHistory)?s.eventHistory:[];for(const e of events){if(!history.includes(e))history.push(e)}s.eventHistory=history.slice(-420)}
      s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    }
    if(events.length)window.dispatchEvent(new CustomEvent('monia:life-milestones',{detail:{day,events}}));
    return{day,initialized:true,marionAge:ages.marionAge,lucasAge:ages.lucasAge,childStages:currentStages,events,canonical:true};
  }finally{syncing=false}
}

function refresh(){window.setTimeout(()=>{try{syncLifeMilestones()}catch{}},0)}
window.setTimeout(refresh,1200);window.addEventListener('marion:statechange',refresh);window.addEventListener('monia:save-changed',refresh as EventListener);window.addEventListener('monia:children-changed',refresh as EventListener);window.addEventListener('storage',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

declare global{interface Window{__moniaLifeMilestones?:()=>LifeMilestoneSnapshot|null}}
window.__moniaLifeMilestones=syncLifeMilestones;
