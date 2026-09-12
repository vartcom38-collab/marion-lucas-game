import './wedding-journey-engine';
import './pregnancy-journey-engine';
import { getLifeAgeSnapshot } from './life-age-engine';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;marionAge?:number;lucasAge?:number;official?:boolean;engaged?:boolean;married?:boolean;children?:number;relationship?:number;trust?:number;careerLevel?:number;visibility?:number;flags?:Record<string,unknown>;eventHistory?:string[]};

export type LifeEra='early-adult'|'building'|'established'|'midlife'|'later-life';
export type TimelineWindow={id:string;open:boolean;weight:number;notBeforeDay:number;expiresAfterDay?:number;reason:string;tags:string[]};
export type LifeTimelineSnapshot={day:number;marionAge:number;lucasAge:number;era:LifeEra;windows:TimelineWindow[];};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}
function eraFor(a:number):LifeEra{return a<25?'early-adult':a<35?'building':a<50?'established':a<65?'midlife':'later-life'}

export function getLifeTimeline():LifeTimelineSnapshot|null{
  const s=readSave();if(!s)return null;const ages=getLifeAgeSnapshot(s),day=ages.day,ma=ages.marionAge,la=ages.lucasAge,f=s.flags||(s.flags={});const rel=n(s.relationship),trust=n(s.trust),children=n(s.children),career=n(s.careerLevel,1),visibility=n(s.visibility);
  const windows:TimelineWindow[]=[];
  const push=(w:TimelineWindow)=>windows.push(w);
  const officialDay=n(f.officialDay,day),engagedDay=n(f.engagedDay,day),marriedDay=n(f.marriedDay,day);
  push({id:'proposal',open:!!s.official&&!s.engaged&&rel>=68&&trust>=58&&day>=officialDay+90,weight:62,notBeforeDay:officialDay+90,expiresAfterDay:officialDay+720,reason:'Le couple est assez mûr pour qu’une demande puisse arriver sans date fixe.',tags:['couple','surprise','commitment']});
  push({id:'wedding-planning',open:!!s.engaged&&!s.married&&day>=engagedDay+14,weight:70,notBeforeDay:engagedDay+14,reason:'Les préparatifs peuvent devenir un vrai arc de vie.',tags:['wedding','planning','family']});
  push({id:'family-conversation',open:!!s.married&&day>=marriedDay+45&&rel>=60&&trust>=55,weight:48,notBeforeDay:marriedDay+45,reason:'Le sujet familial peut apparaître naturellement, sans devenir une obligation.',tags:['family','choice']});
  push({id:'career-step',open:career>=1&&day>=30,weight:40+Math.min(25,career*4),notBeforeDay:30,reason:'La carrière de Lucas continue indépendamment de la vie de couple.',tags:['torero','career','travel']});
  push({id:'media-pressure',open:visibility>=25,weight:Math.min(85,30+visibility),notBeforeDay:1,reason:'Plus le couple est visible, plus une séquence média crédible devient possible.',tags:['media','paparazzi','press']});
  push({id:'parenting-stage',open:children>0,weight:55,notBeforeDay:n(f.birthDay,day),reason:'Les enfants grandissent; chaque âge ouvre de nouveaux rythmes et décisions.',tags:['family','children','aging']});
  push({id:'torero-transition',open:la>=34||career>=5,weight:42,notBeforeDay:1,reason:'Avec l’âge et l’expérience, la trajectoire taurine peut évoluer: sélection des dates, transmission, blessures, rythme ou retraite.',tags:['torero','aging','career']});
  push({id:'midlife-rebalance',open:ma>=40,weight:35,notBeforeDay:1,reason:'Les priorités, lieux de vie et équilibres familiaux peuvent changer avec les années.',tags:['aging','home','identity']});
  return{day,marionAge:ma,lucasAge:la,era:eraFor(ma),windows:windows.sort((a,b)=>Number(b.open)-Number(a.open)||b.weight-a.weight)};
}

declare global{interface Window{__moniaLifeTimeline?:()=>LifeTimelineSnapshot|null}}
window.__moniaLifeTimeline=getLifeTimeline;
