const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type PlaceHistoryTier='new'|'familiar'|'anchored'|'important'|'deeply-lived';
export type PlaceHistorySnapshot={id:string;label:string;tier:PlaceHistoryTier;score:number;visits:number;meaningfulMoments:number;firstDay:number;lastDay:number;yearsKnown:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function normalize(place:string){const p=String(place||'home').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(/appart|home.*nimes|nimes.*home/.test(p))return'nimes-home';if(/finca/.test(p))return'finca';if(/hotel/.test(p))return`hotel-${p.replace(/[^a-z0-9]+/g,'-').slice(0,28)}`;if(/madrid/.test(p))return'madrid';if(/nimes/.test(p))return'nimes';if(/sevill/.test(p))return'seville';if(/salam/.test(p))return'salamanca';if(/arena|arene/.test(p))return`arena-${p.replace(/[^a-z0-9]+/g,'-').slice(0,28)}`;return p.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'home'}
function key(id:string,suffix:string){return`placeHistory:${id}:${suffix}`}
function labelFor(place:string){const raw=String(place||'').trim();return raw||'Cet endroit'}

export function applyCurrentPlaceHistory(s:Save,meaningful=false){const day=Math.max(1,n(s.day,1)),id=normalize(String(s.place||'home')),f=s.flags||(s.flags={});const first=key(id,'firstDay'),last=key(id,'lastDay'),visits=key(id,'visits'),moments=key(id,'meaningfulMoments');if(!n(f[first]))f[first]=day;const previous=n(f[last]);if(previous!==day)f[visits]=n(f[visits])+1;f[last]=day;if(meaningful)f[moments]=n(f[moments])+1;f[key(id,'label')]=labelFor(String(s.place||''));return id}

export function recordCurrentPlaceMoment(meaningful=false){const s=read();if(!s)return false;const id=applyCurrentPlaceHistory(s,meaningful);s.eventHistory=[...(s.eventHistory||[]),`place-lived:${id}:${meaningful?'meaningful':'ordinary'}:${n(s.day,1)}`].slice(-420);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

export function getPlaceHistory(place?:string):PlaceHistorySnapshot|null{const s=read();if(!s)return null;const raw=String(place||s.place||'home'),id=normalize(raw),f=s.flags||{},first=n(f[key(id,'firstDay')]);if(!first)return{id,label:labelFor(raw),tier:'new',score:0,visits:0,meaningfulMoments:0,firstDay:n(s.day,1),lastDay:n(s.day,1),yearsKnown:0,reason:'Cet endroit n’a pas encore accumulé assez de vie pour avoir une histoire propre.'};const visits=n(f[key(id,'visits')]),meaningfulMoments=n(f[key(id,'meaningfulMoments')]),last=n(f[key(id,'lastDay')],first),yearsKnown=Math.max(0,(n(s.day,1)-first)/365);const score=clamp(Math.round(visits*4+meaningfulMoments*11+Math.min(30,yearsKnown*8)),0,100);const tier:PlaceHistoryTier=score>=84?'deeply-lived':score>=64?'important':score>=40?'anchored':score>=16?'familiar':'new';const reason=tier==='deeply-lived'?'Ce lieu porte maintenant plusieurs années de quotidien, de passages et de moments importants. Il fait partie de leur histoire sans avoir besoin d’être transformé en sanctuaire.':tier==='important'?'Cet endroit compte vraiment dans leur parcours : ils y ont assez vécu pour que le présent y ait une profondeur particulière.':tier==='anchored'?'Ce lieu est devenu un vrai repère. Il ne sert plus seulement de décor : il appartient désormais à leur vie.':tier==='familiar'?'L’endroit commence à avoir ses habitudes, ses repères et une sensation de retour.':'Le lieu est encore récent dans leur histoire.';return{id,label:String(f[key(id,'label')]||labelFor(raw)),tier,score,visits,meaningfulMoments,firstDay:first,lastDay:last,yearsKnown,reason}}

export function getCurrentPlaceHistory(){return getPlaceHistory()}

declare global{interface Window{__moniaPlaceHistory?:(place?:string)=>PlaceHistorySnapshot|null;__moniaCurrentPlaceHistory?:()=>PlaceHistorySnapshot|null;__moniaRecordCurrentPlaceMoment?:(meaningful?:boolean)=>boolean}}
window.__moniaPlaceHistory=getPlaceHistory;window.__moniaCurrentPlaceHistory=getCurrentPlaceHistory;window.__moniaRecordCurrentPlaceMoment=recordCurrentPlaceMoment;
