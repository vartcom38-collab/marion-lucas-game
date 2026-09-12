import { getLifeTimeline } from './life-timeline-engine';
import { getFamilyLifeOpportunity } from './family-life-layer';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;stress?:number;energy?:number;visibility?:number;children?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type RareLifeEvent={id:string;eligible:boolean;weight:number;sensitive:boolean;cooldownDays:number;reason:string;channels:Array<'message'|'call'|'visio'|'cinematic'|'ambient'>};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}
function daysSince(f:Record<string,unknown>,key:string,day:number){const last=n(f[key],-99999);return day-last}

export function getRareLifeEvents():RareLifeEvent[]{
  const s=readSave();const timeline=getLifeTimeline();const family=getFamilyLifeOpportunity();if(!s||!timeline)return[];
  const day=timeline.day,f=s.flags||(s.flags={}),stress=n(s.stress),energy=n(s.energy,100),visibility=n(s.visibility),out:RareLifeEvent[]=[];
  const add=(e:RareLifeEvent)=>out.push(e);
  add({id:'unexpected-media-photo',eligible:visibility>=35&&daysSince(f,'lastMediaSurpriseDay',day)>=21,weight:30+Math.min(35,visibility/2),sensitive:false,cooldownDays:21,reason:'La visibilité rend possible une photo ou un article non anticipé, sans en faire une crise automatique.',channels:['message','ambient','cinematic']});
  add({id:'torero-injury-window',eligible:timeline.lucasAge>=22&&daysSince(f,'lastToreroInjuryDay',day)>=120,weight:12,sensitive:true,cooldownDays:120,reason:'Une blessure peut exister dans une carrière taurine, mais doit rester rare et contextuelle.',channels:['call','message','cinematic']});
  add({id:'career-breakthrough',eligible:daysSince(f,'lastCareerBreakthroughDay',day)>=90,weight:20,sensitive:false,cooldownDays:90,reason:'Une saison peut apporter une opportunité, une date importante ou un changement de statut.',channels:['message','call','cinematic']});
  add({id:'family-good-news',eligible:family?.state==='trying'&&!!family.surpriseEligible&&daysSince(f,'lastFamilyOutcomeDay',day)>=28,weight:18,sensitive:true,cooldownDays:28,reason:'Une grossesse éventuelle ne doit jamais être instantanée ni garantie.',channels:['message','call','cinematic']});
  add({id:'family-loss',eligible:family?.state==='pregnant'&&daysSince(f,'lastFamilySensitiveEventDay',day)>=365,weight:2,sensitive:true,cooldownDays:365,reason:'Événement exceptionnel et non obligatoire; ne jamais l’utiliser comme twist fréquent ou gratuit.',channels:['call','cinematic','ambient']});
  add({id:'burnout-reset',eligible:(stress>=75||energy<=20)&&daysSince(f,'lastRecoveryArcDay',day)>=45,weight:28,sensitive:false,cooldownDays:45,reason:'Une période trop chargée peut forcer le rythme de vie à ralentir sans transformer cela en catastrophe.',channels:['ambient','message','call']});
  return out.filter(e=>e.eligible).sort((a,b)=>b.weight-a.weight);
}

declare global{interface Window{__moniaRareLifeEvents?:()=>RareLifeEvent[]}}
window.__moniaRareLifeEvents=getRareLifeEvents;
