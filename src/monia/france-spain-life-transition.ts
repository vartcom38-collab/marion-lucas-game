import { isNimesPlace, isSpainPlace } from './spain-geography';
import { getResidenceSnapshot } from './residence-base-life';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;calendar?:Array<{day?:number;time?:string;owner?:string;title?:string;place?:string}>;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FranceSpainPhase='nimes-rooted'|'spain-opening'|'transitioning'|'spain-rooted'|'between-bases';
export type FranceSpainState={phase:FranceSpainPhase;nimesIsHome:boolean;spainIsHome:boolean;marineDistance:'same-city'|'distance';canPrepareSpain:boolean;canReturnNimes:boolean;travelFriction:'low'|'normal'|'high';suggestions:Array<{id:string;label:string;intent:string;weight:number}>;reason:string};
export type SpainInstallationReadiness={eligible:boolean;daysSinceOpening:number;livedMoments:number;basePlace:string|null;baseKind:string|null;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function recent(s:Save,rx:RegExp){return (s.eventHistory||[]).slice(-30).some(e=>rx.test(String(e)))}
function installationBase(s:Save){const f=s.flags||{};const candidates=[f.sharedHomePlace,f.coupleHomePlace,f.lucasHomePlace].map(v=>String(v||'').trim()).filter(Boolean);return candidates.find(isSpainPlace)||null}

export function getSpainInstallationReadiness():SpainInstallationReadiness{
  const s=read();if(!s)return{eligible:false,daysSinceOpening:0,livedMoments:0,basePlace:null,baseKind:null,reason:'Aucune partie active.'};
  const f=s.flags||{},openedDay=n(f.spainLifeOpenedDay),daysSinceOpening=openedDay?Math.max(0,n(s.day,1)-openedDay):0;
  const livedMoments=(s.eventHistory||[]).filter(e=>/spain-place:|spain-familiar-place:|spain-social-|spain-life-opened:|place-lived:(madrid|seville|salamanca|finca)/i.test(String(e))).length;
  const basePlace=installationBase(s),base=basePlace?getResidenceSnapshot(basePlace):null;
  if(f.spainHomeEstablished===true)return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base?.kind||null,reason:'Une base espagnole est déjà établie.'};
  if(!s.official)return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base?.kind||null,reason:'La relation n’est pas encore dans une phase où une installation commune peut être posée.'};
  if(!openedDay)return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base?.kind||null,reason:'La vie en Espagne doit d’abord avoir réellement commencé.'};
  if(daysSinceOpening<4||livedMoments<3)return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base?.kind||null,reason:'Il faut d’abord plusieurs jours et plusieurs moments ordinaires vécus sur place : l’installation ne doit pas être instantanée.'};
  if(n(s.relationship)<40||n(s.trust)<30)return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base?.kind||null,reason:'Le quotidien commun n’est pas encore assez stable pour transformer un séjour en installation.'};
  if(!basePlace||!base)return{eligible:false,daysSinceOpening,livedMoments,basePlace:null,baseKind:null,reason:'Il faut qu’une vraie base résidentielle espagnole ait été choisie avant de parler d’installation.'};
  if(base.kind==='family-base')return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base.kind,reason:'La maison familiale reste une base familiale : elle ne devient jamais automatiquement le domicile du couple.'};
  if(!base.isHome||base.isTemporary)return{eligible:false,daysSinceOpening,livedMoments,basePlace,baseKind:base.kind,reason:'Un hôtel, une ville ou un lieu de passage ne peut pas devenir un domicile par simple répétition.'};
  return{eligible:true,daysSinceOpening,livedMoments,basePlace,baseKind:base.kind,reason:'La vie sur place a eu le temps de devenir un quotidien et une vraie base résidentielle existe. Le gameplay peut maintenant confirmer l’installation.'};
}

export function getFranceSpainState():FranceSpainState|null{
  const s=read();if(!s)return null;const place=String(s.place||'home');const f=s.flags||{};const day=n(s.day,1);
  const nimes=isNimesPlace(place)||place==='home',spain=isSpainPlace(place);const relationship=n(s.relationship),trust=n(s.trust);
  const hasSpainOpened=!!f.spainLifeOpened||spain||recent(s,/spain|madrid|espagne|sevill|andal|salamanca|move-spain|travel-spain/i);
  const hasSpainRoot=!!f.spainHomeEstablished||recent(s,/spain-home-established|moved-to-spain/i);
  let phase:FranceSpainPhase='nimes-rooted';
  if(hasSpainRoot&&nimes)phase='between-bases';else if(hasSpainRoot)phase='spain-rooted';else if(spain)phase='transitioning';else if(hasSpainOpened)phase='spain-opening';
  const canPrepareSpain=!!s.metLucas&&relationship>=35&&trust>=25&&(hasSpainOpened||day>7);
  const canReturnNimes=hasSpainOpened||hasSpainRoot||spain;
  const suggestions:FranceSpainState['suggestions']=[];
  if(canPrepareSpain&&!spain&&!hasSpainRoot)suggestions.push({id:'prepare-spain',label:'Préparer tranquillement la suite en Espagne',intent:'open-map',weight:48});
  if(spain)suggestions.push({id:'settle-spain-day',label:'Prendre mes repères ici',intent:'custom-intent',weight:52});
  if(spain)suggestions.push({id:'message-marine-distance',label:'Donner des nouvelles à Marine à Nîmes',intent:'open-phone',weight:43});
  if(canReturnNimes&&spain)suggestions.push({id:'think-nimes-return',label:'Voir quand je pourrais repasser à Nîmes',intent:'open-map',weight:31});
  const friction:FranceSpainState['travelFriction']=Number(f.travelNeedsReplan)?'high':phase==='transitioning'?'normal':'low';
  const reason=phase==='nimes-rooted'?'Nîmes reste le centre de la vie de Marion pour l’instant.':phase==='spain-opening'?'L’Espagne commence à devenir une vraie possibilité sans effacer Nîmes.':phase==='transitioning'?'Marion est entre deux rythmes de vie; ses liens français continuent à distance.':phase==='spain-rooted'?'L’Espagne est devenue son quotidien, tandis que Nîmes reste une racine importante.':'Marion a désormais une vie qui peut circuler entre l’Espagne et Nîmes.';
  return{phase,nimesIsHome:!hasSpainRoot||nimes,spainIsHome:hasSpainRoot,marineDistance:nimes?'same-city':'distance',canPrepareSpain,canReturnNimes,travelFriction:friction,suggestions,reason};
}

export function markSpainLifeOpened(){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f.spainLifeOpened=true;if(!n(f.spainLifeOpenedDay))f.spainLifeOpenedDay=n(s.day,1);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}
export function markSpainHomeEstablished(){const s=read();if(!s)return false;const readiness=getSpainInstallationReadiness();if(!readiness.eligible||!readiness.basePlace)return false;const f=s.flags||(s.flags={});f.spainLifeOpened=true;if(!n(f.spainLifeOpenedDay))f.spainLifeOpenedDay=n(s.day,1);f.spainHomeEstablished=true;f.spainHomeEstablishedDay=n(s.day,1);f.spainHomePlace=readiness.basePlace;s.eventHistory=[...(s.eventHistory||[]),`spain-home-established:${readiness.basePlace}:${n(s.day,1)}`].slice(-300);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'spain-installation'}}));return true}catch{return false}}

declare global{interface Window{__moniaFranceSpainState?:()=>FranceSpainState|null;__moniaOpenSpainLife?:()=>boolean;__moniaEstablishSpainHome?:()=>boolean;__moniaSpainInstallationReadiness?:()=>SpainInstallationReadiness}}
window.__moniaFranceSpainState=getFranceSpainState;window.__moniaOpenSpainLife=markSpainLifeOpened;window.__moniaEstablishSpainHome=markSpainHomeEstablished;window.__moniaSpainInstallationReadiness=getSpainInstallationReadiness;
