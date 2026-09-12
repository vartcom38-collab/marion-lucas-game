const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;place?:string;official?:boolean;married?:boolean;flags?:Record<string,unknown>;eventHistory?:string[]};
export type ResidenceKind='marion-home'|'shared-home'|'family-base'|'private-base'|'hotel'|'touring-base'|'visit'|'unknown';
export type ResidenceSnapshot={place:string;kind:ResidenceKind;isHome:boolean;isTemporary:boolean;canFeelAtHome:boolean;reason:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function norm(v:unknown){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function same(a:unknown,b:unknown){const x=norm(a),y=norm(b);return!!x&&!!y&&x===y}

export function getResidenceSnapshot(place?:string):ResidenceSnapshot{
  const s=read();const raw=String(place||s?.place||'');const p=norm(raw),f=s?.flags||{};
  const shared=String(f.sharedHomePlace||f.coupleHomePlace||'');const marion=String(f.marionHomePlace||'');const lucas=String(f.lucasHomePlace||'');
  if(/hotel|hotel\b/.test(p))return{place:raw,kind:/feria|corrida|tournee|touring/.test(p)?'touring-base':'hotel',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Un hôtel reste une base temporaire, même lorsqu’ils y reviennent souvent pendant les saisons taurines.'};
  if(shared&&same(raw,shared))return{place:raw,kind:'shared-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Ce lieu est enregistré comme leur domicile commun, indépendamment des voyages et des tournées.'};
  if(marion&&same(raw,marion))return{place:raw,kind:'marion-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Ce lieu est un domicile personnel de Marion.'};
  if(lucas&&same(raw,lucas))return{place:raw,kind:'private-base',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Ce lieu est une base privée durable de Lucas.'};
  if(/appart.*nimes|nimes.*appart|home.*nimes|nimes-home|chez marion/.test(p))return{place:raw,kind:'marion-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'L’appartement de Nîmes est une vraie base de vie de Marion, pas une étape de voyage.'};
  if(/maison commune|chez eux|domicile commun|shared-home|couple-home/.test(p))return{place:raw,kind:'shared-home',isHome:true,isTemporary:false,canFeelAtHome:true,reason:'Le libellé désigne explicitement leur domicile commun.'};
  if(/finca|family estate|maison familiale|family home/.test(p))return{place:raw,kind:'family-base',isHome:false,isTemporary:false,canFeelAtHome:true,reason:'La finca peut être très familière et intime sans être automatiquement leur domicile principal.'};
  if(/madrid|nimes|sevill|salam|pamplona|ville|city/.test(p))return{place:raw,kind:'visit',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Une ville connue n’est pas automatiquement un domicile : il faut une maison ou une base explicitement établie.'};
  if(/trajet|aeroport|airport|route|transfert/.test(p))return{place:raw,kind:'visit',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Ce lieu appartient au déplacement, pas à leur résidence.'};
  return{place:raw,kind:'unknown',isHome:false,isTemporary:true,canFeelAtHome:false,reason:'Aucune base résidentielle durable n’est établie pour ce lieu.'};
}

export function setResidenceBase(kind:'marion-home'|'shared-home'|'private-base',place:string){const s=read();if(!s||!place.trim())return false;const f=s.flags||(s.flags={});if(kind==='marion-home')f.marionHomePlace=place;else if(kind==='shared-home')f.sharedHomePlace=place;else f.lucasHomePlace=place;s.eventHistory=[...(s.eventHistory||[]),`residence-base:${kind}:${place}:${Number(s.day||1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

declare global{interface Window{__moniaResidence?:(place?:string)=>ResidenceSnapshot;__moniaSetResidenceBase?:(kind:'marion-home'|'shared-home'|'private-base',place:string)=>boolean}}
window.__moniaResidence=getResidenceSnapshot;window.__moniaSetResidenceBase=setResidenceBase;
