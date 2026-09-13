import { getPlaceHistory, recordCurrentPlaceMoment } from './place-history-life';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;place?:string;official?:boolean;married?:boolean;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ResidenceKind='marion-home'|'shared-home'|'family-base'|'private-base'|'hotel'|'touring-base'|'visit'|'unknown';
export type ResidenceSnapshot={place:string;kind:ResidenceKind;isHome:boolean;isTemporary:boolean;canFeelAtHome:boolean;reason:string;};
export type ResidenceReadiness={place:string;eligible:boolean;recommendedKind:'shared-home'|'private-base'|'marion-home'|null;historyTier:string;score:number;visits:number;meaningfulMoments:number;reason:string;};
export type FamilyBaseStay={place:string;active:boolean;visits:number;familiarity:number;stage:'new'|'familiar'|'very-familiar';reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function norm(v:unknown){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function same(a:unknown,b:unknown){const x=norm(a),y=norm(b);return!!x&&!!y&&x===y}
function transientPlace(p:string){return/hotel|trajet|aeroport|airport|route|transfert|arena|arene|corrida|gare|station|cafe/.test(p)}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function familyKey(place:string){return norm(place).replace(/[^a-z0-9]+/g,'-').slice(0,40)||'family-base'}

export function getResidenceSnapshot(place?:string):ResidenceSnapshot{
  const s=read();const raw=String(place||s?.place||'');const p=norm(raw),f=s?.flags||{};
  const shared=String(f.sharedHomePlace||f.coupleHomePlace||'');const marion=String(f.marionHomePlace||'');const lucas=String(f.lucasHomePlace||'');
  if(/hotel|hotel\b/.test(p))return{place:raw,kind:/feria|corrida|tournee|touring/.test(p)?'touring-base':'hotel',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Un hôtel reste une base temporaire, même lorsqu’ils y reviennent souvent pendant les saisons taurines.'};
  if(shared&&same(raw,shared))return{place:raw,kind:'shared-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Ce lieu est enregistré comme leur domicile commun, indépendamment des voyages et des tournées.'};
  if(marion&&same(raw,marion))return{place:raw,kind:'marion-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Ce lieu est un domicile personnel de Marion.'};
  if(lucas&&same(raw,lucas))return{place:raw,kind:'private-base',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Ce lieu est une base privée durable de Lucas.'};
  if(/appart.*nimes|nimes.*appart|home.*nimes|nimes-home|chez marion/.test(p))return{place:raw,kind:'marion-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'L’appartement de Nîmes est une vraie base de vie de Marion, pas une étape de voyage.'};
  if(/maison commune|chez eux|domicile commun|shared-home|couple-home/.test(p))return{place:raw,kind:'shared-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Le libellé désigne explicitement leur domicile commun.'};
  if(/finca|family estate|maison familiale|family home/.test(p))return{place:raw,kind:'family-base',isHome:false,isTemporary:false,canFeelAtHome:true,reason:'La maison familiale peut devenir très familière et intime sans jamais être confondue automatiquement avec le domicile principal de Marion et Lucas.'};
  if(/madrid|nimes|sevill|salam|pamplona|ville|city/.test(p))return{place:raw,kind:'visit',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Une ville connue n’est pas automatiquement un domicile : il faut une maison ou une base explicitement établie.'};
  if(/trajet|aeroport|airport|route|transfert/.test(p))return{place:raw,kind:'visit',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Ce lieu appartient au déplacement, pas à leur résidence.'};
  return{place:raw,kind:'unknown',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Aucune base résidentielle durable n’est établie pour ce lieu.'};
}

export function getFamilyBaseStay(place?:string):FamilyBaseStay{
  const s=read();const raw=String(place||s?.place||'');const residence=getResidenceSnapshot(raw);if(!s||residence.kind!=='family-base')return{place:raw,active:false,visits:0,familiarity:0,stage:'new',reason:'Marion ne séjourne pas actuellement dans une maison familiale.'};
  const key=familyKey(raw),f=s.flags||{},visits=n(f[`familyBase:${key}:visits`]),familiarity=Math.max(0,Math.min(100,n(f[`familyBase:${key}:familiarity`])),stage:FamilyBaseStay['stage']=familiarity>=65?'very-familiar':familiarity>=25?'familiar':'new';
  const reason=stage==='very-familiar'?'Marion connaît très bien la maison et ses habitudes, mais ce lieu reste une base familiale et non leur domicile.':stage==='familiar'?'Les repères deviennent naturels au fil des séjours, sans transformer cette maison en chez-eux.':'La maison est encore un lieu de séjour à découvrir, même si elle peut déjà sembler accueillante.';
  return{place:raw,active:true,visits,familiarity,stage,reason};
}

export function recordFamilyBaseStay(place?:string,meaningful=false){
  const s=read();const raw=String(place||s?.place||'');if(!s||getResidenceSnapshot(raw).kind!=='family-base')return false;const key=familyKey(raw),f=s.flags||(s.flags={});f[`familyBase:${key}:visits`]=n(f[`familyBase:${key}:visits`])+1;f[`familyBase:${key}:familiarity`]=Math.min(100,n(f[`familyBase:${key}:familiarity`])+(meaningful?8:5));f[`familyBase:${key}:lastDay`]=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),`family-base-stay:${key}:${meaningful?'meaningful':'ordinary'}:${n(s.day,1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));recordCurrentPlaceMoment(meaningful);window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'family-base-stay'}}));return true}catch{return false}
}

export function getResidenceReadiness(place?:string):ResidenceReadiness{
  const s=read();const raw=String(place||s?.place||'');const p=norm(raw);const history=getPlaceHistory(raw);const current=getResidenceSnapshot(raw);
  if(current.isHome)return{place:raw,eligible:false,recommendedKind:null,historyTier:history?.tier||'new',score:history?.score||0,visits:history?.visits||0,meaningfulMoments:history?.meaningfulMoments||0,reason:'Ce lieu est déjà enregistré comme une base de vie durable.'};
  if(current.kind==='family-base')return{place:raw,eligible:false,recommendedKind:null,historyTier:history?.tier||'new',score:history?.score||0,visits:history?.visits||0,meaningfulMoments:history?.meaningfulMoments||0,reason:'Une maison familiale peut devenir très familière sans être proposée automatiquement comme domicile du couple.'};
  if(transientPlace(p))return{place:raw,eligible:false,recommendedKind:null,historyTier:history?.tier||'new',score:history?.score||0,visits:history?.visits||0,meaningfulMoments:history?.meaningfulMoments||0,reason:'Un lieu de passage, de travail ou d’hébergement temporaire ne devient pas un domicile par répétition.'};
  const score=history?.score||0,visits=history?.visits||0,moments=history?.meaningfulMoments||0;
  const deeplyLived=!!history&&(history.tier==='anchored'||history.tier==='important'||history.tier==='deeply-lived')&&visits>=4&&moments>=1;
  const coupleEligible=!!s?.official&&deeplyLived;
  const recommendedKind:ResidenceReadiness['recommendedKind']=coupleEligible?'shared-home':deeplyLived?'private-base':null;
  return{place:raw,eligible:deeplyLived,recommendedKind,historyTier:history?.tier||'new',score,visits,meaningfulMoments:moments,reason:deeplyLived?(coupleEligible?'Le lieu a accumulé assez de quotidien et de moments vécus pour pouvoir devenir une base commune si le gameplay le décide.':'Le lieu est assez vécu pour devenir une base durable, mais il ne change pas de statut automatiquement.'):'Le lieu peut compter émotionnellement sans être encore assez vécu pour devenir une résidence durable.'};
}

export function setResidenceBase(kind:'marion-home'|'shared-home'|'private-base',place:string){const s=read();if(!s||!place.trim())return false;if(getResidenceSnapshot(place).kind==='family-base'&&kind==='shared-home')return false;const f=s.flags||(s.flags={});if(kind==='marion-home')f.marionHomePlace=place;else if(kind==='shared-home')f.sharedHomePlace=place;else f.lucasHomePlace=place;s.eventHistory=[...(s.eventHistory||[]),`residence-base:${kind}:${place}:${Number(s.day||1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

function syncFamilyBaseArrival(){
  const s=read();if(!s||getResidenceSnapshot(s.place).kind!=='family-base')return;const events=s.eventHistory||[];const last=[...events].reverse().find(e=>String(e).startsWith('travel-arrival-moment:family-base:'));if(!last)return;const key=familyKey(String(s.place||'')),f=s.flags||(s.flags={}),token=`${n(s.day,1)}:${key}:${last}`;if(String(f.lastFamilyBaseArrivalToken||'')===token)return;f.lastFamilyBaseArrivalToken=token;try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));recordFamilyBaseStay(String(s.place||''),true)}catch{/* optional continuity layer */}
}
let familySyncQueued=false;function scheduleFamilySync(){if(familySyncQueued)return;familySyncQueued=true;queueMicrotask(()=>{familySyncQueued=false;syncFamilyBaseArrival()})}
window.addEventListener('monia:save-changed',scheduleFamilySync as EventListener);window.addEventListener('storage',scheduleFamilySync);setTimeout(scheduleFamilySync,350);

declare global{interface Window{__moniaResidence?:(place?:string)=>ResidenceSnapshot;__moniaResidenceReadiness?:(place?:string)=>ResidenceReadiness;__moniaSetResidenceBase?:(kind:'marion-home'|'shared-home'|'private-base',place:string)=>boolean;__moniaFamilyBaseStay?:(place?:string)=>FamilyBaseStay;__moniaRecordFamilyBaseStay?:(place?:string,meaningful?:boolean)=>boolean}}
window.__moniaResidence=getResidenceSnapshot;window.__moniaResidenceReadiness=getResidenceReadiness;window.__moniaSetResidenceBase=setResidenceBase;window.__moniaFamilyBaseStay=getFamilyBaseStay;window.__moniaRecordFamilyBaseStay=recordFamilyBaseStay;
