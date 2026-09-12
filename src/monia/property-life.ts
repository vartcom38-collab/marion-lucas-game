const SAVE_KEY='marion-lucas-save-v4';
const PROPERTY_KEY='marion-lucas-properties-v1';

type Owner='marion'|'lucas'|'joint';
export type PropertyKind='apartment'|'house'|'finca'|'city-flat'|'coastal-home'|'country-home';
export type PropertyUse='primary'|'secondary'|'available'|'sold';
export type PropertyRecord={
  id:string;
  name:string;
  kind:PropertyKind;
  owner:Owner;
  city:string;
  region:string;
  country:'France'|'Espagne';
  use:PropertyUse;
  acquiredDay:number;
  soldDay?:number;
  purchasePrice?:number;
  sourceOfferId?:string;
  canonicalPlace?:'home'|'madrid'|'estate';
};
export type PropertyOffer={
  id:string;
  title:string;
  kind:PropertyKind;
  city:string;
  region:string;
  country:'Espagne';
  price:number;
  hectares?:number;
  bedrooms:number;
  character:string;
  distanceNote:string;
  firstHomeEligible:boolean;
};
type PropertyState={
  version:1;
  searchOpen:boolean;
  searchOpenedDay?:number;
  searchReason?:'joint-home'|'secondary-home'|'investment';
  shortlisted:string[];
  owned:PropertyRecord[];
  lastOfferRefreshDay:number;
  offerSeed:number;
};
type Save={
  day?:number;
  place?:string;
  relationship?:number;
  official?:boolean;
  flags?:Record<string,unknown>;
};

const CATALOG:Omit<PropertyOffer,'id'>[]=[
  {title:'Finca de chênes et pâtures',kind:'finca',city:'Salamanque',region:'Castille-et-León',country:'Espagne',price:1180000,hectares:34,bedrooms:6,character:'Maison en pierre, grands prés, dépendances et beaucoup d’intimité.',distanceNote:'À l’ouest de Madrid, environnement rural très ouvert.',firstHomeEligible:true},
  {title:'Finca blanche près de Tolède',kind:'finca',city:'Tolède',region:'Castille-La Manche',country:'Espagne',price:1460000,hectares:27,bedrooms:5,character:'Architecture claire, patio, oliviers et installations à rénover partiellement.',distanceNote:'Assez proche de Madrid pour garder un lien régulier avec la capitale.',firstHomeEligible:true},
  {title:'Domaine en Estrémadure',kind:'finca',city:'Trujillo',region:'Estrémadure',country:'Espagne',price:980000,hectares:48,bedrooms:7,character:'Très vaste, ancien corps de ferme, paysage brut et beaucoup de potentiel.',distanceNote:'Plus éloigné de Madrid, avec une vraie sensation de changement de vie.',firstHomeEligible:true},
  {title:'Maison andalouse avec terres',kind:'finca',city:'Jerez de la Frontera',region:'Andalousie',country:'Espagne',price:1690000,hectares:19,bedrooms:6,character:'Cour intérieure, terres sèches, lumière du sud et bâtiments annexes.',distanceNote:'Sud de l’Espagne, climat et rythme très différents de Madrid.',firstHomeEligible:true},
  {title:'Appartement ancien à Séville',kind:'city-flat',city:'Séville',region:'Andalousie',country:'Espagne',price:640000,bedrooms:3,character:'Beaux volumes, balcon et emplacement central pour de courts séjours.',distanceNote:'Pied-à-terre urbain, pratique pour quelques jours.',firstHomeEligible:false},
  {title:'Appartement lumineux à Valence',kind:'city-flat',city:'Valence',region:'Communauté valencienne',country:'Espagne',price:590000,bedrooms:3,character:'Terrasse, grandes fenêtres et accès rapide au centre comme à la mer.',distanceNote:'Pied-à-terre polyvalent entre ville et côte.',firstHomeEligible:false},
  {title:'Maison sur la côte basque',kind:'coastal-home',city:'Saint-Sébastien',region:'Pays basque',country:'Espagne',price:1320000,bedrooms:4,character:'Maison élégante, jardin compact et air marin.',distanceNote:'Résidence secondaire au nord, adaptée aux séjours plus calmes.',firstHomeEligible:false},
  {title:'Maison méditerranéenne',kind:'coastal-home',city:'Sóller',region:'Îles Baléares',country:'Espagne',price:1850000,bedrooms:5,character:'Pierre claire, terrasses, agrumes et vue sur les reliefs.',distanceNote:'Pied-à-terre insulaire, plus exceptionnel et moins spontané.',firstHomeEligible:false},
  {title:'Maison de campagne catalane',kind:'country-home',city:'Gérone',region:'Catalogne',country:'Espagne',price:890000,bedrooms:4,character:'Ancienne bâtisse restaurée, jardin et environnement très vert.',distanceNote:'Résidence secondaire entre campagne et accès à la côte.',firstHomeEligible:false},
];

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function writeSave(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:property-changed'));return true}catch{return false}}
function dayOf(s:Save|null){return Math.max(1,Number(s?.day||1)||1)}
function initialState():PropertyState{
  const s=readSave(),day=dayOf(s);
  return{version:1,searchOpen:false,shortlisted:[],lastOfferRefreshDay:0,offerSeed:day,owned:[
    {id:'marion-nimes-apartment',name:'Appartement de Marion',kind:'apartment',owner:'marion',city:'Nîmes',region:'Occitanie',country:'France',use:'primary',acquiredDay:1,canonicalPlace:'home'},
    {id:'lucas-madrid-house',name:'Maison de Lucas',kind:'house',owner:'lucas',city:'Madrid',region:'Communauté de Madrid',country:'Espagne',use:'available',acquiredDay:1,canonicalPlace:'madrid'},
  ]};
}
function readState():PropertyState{
  try{
    const raw=localStorage.getItem(PROPERTY_KEY);if(!raw)return initialState();
    const parsed=JSON.parse(raw) as Partial<PropertyState>;
    const base=initialState();
    return{...base,...parsed,version:1,shortlisted:Array.isArray(parsed.shortlisted)?parsed.shortlisted:[],owned:Array.isArray(parsed.owned)&&parsed.owned.length?parsed.owned:base.owned};
  }catch{return initialState()}
}
function writeState(state:PropertyState){try{localStorage.setItem(PROPERTY_KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent('monia:property-changed'));return true}catch{return false}}
function hasJointFinca(state:PropertyState){return state.owned.some(p=>p.owner==='joint'&&p.kind==='finca'&&p.use!=='sold')}
function currentPrimary(state:PropertyState){return state.owned.find(p=>p.use==='primary')||null}
function normalizePrimaryForCohabitation(state:PropertyState,s:Save|null){
  const f=s?.flags||{};
  const movedToMadrid=Boolean(f.livingWithLucas||f.movedToMadrid||f.cohabitingMadrid);
  if(!movedToMadrid||hasJointFinca(state))return state;
  for(const p of state.owned){if(p.use==='primary')p.use='available'}
  const madrid=state.owned.find(p=>p.id==='lucas-madrid-house');if(madrid)madrid.use='primary';
  return state;
}
function offerId(index:number,seed:number){return`property-${index}-${seed%997}`}
function availableOffers(state:PropertyState,s:Save|null){
  const firstJoint=!hasJointFinca(state);
  const offset=(state.offerSeed+Math.floor(dayOf(s)/21))%CATALOG.length;
  const ordered=CATALOG.map((_,i)=>CATALOG[(i+offset)%CATALOG.length]);
  const filtered=firstJoint?ordered.filter(o=>o.firstHomeEligible):ordered;
  return filtered.slice(0,firstJoint?4:6).map((o,i)=>({...o,id:offerId(CATALOG.indexOf(o),state.offerSeed)}));
}

export function getPropertyLifeSnapshot(){
  const s=readSave();let state=readState();state=normalizePrimaryForCohabitation(state,s);writeState(state);
  return{
    searchOpen:state.searchOpen,
    searchReason:state.searchReason||null,
    firstJointPurchasePending:!hasJointFinca(state),
    primary:currentPrimary(state),
    owned:state.owned.filter(p=>p.use!=='sold'),
    history:state.owned,
    shortlisted:state.shortlisted,
    offers:state.searchOpen?availableOffers(state,s):[],
  };
}

export function openPropertySearch(reason:'joint-home'|'secondary-home'|'investment'='joint-home'){
  const s=readSave();if(!s)return false;const state=normalizePrimaryForCohabitation(readState(),s);
  if(reason!=='joint-home'&&!hasJointFinca(state))return false;
  state.searchOpen=true;state.searchReason=reason;state.searchOpenedDay=dayOf(s);state.offerSeed=(dayOf(s)*37+state.owned.length*101)%10007;state.lastOfferRefreshDay=dayOf(s);
  return writeState(state);
}
export function closePropertySearch(){const state=readState();state.searchOpen=false;return writeState(state)}
export function refreshPropertyOffers(){const s=readSave();if(!s)return false;const state=readState();const day=dayOf(s);if(day-state.lastOfferRefreshDay<7)return false;state.offerSeed=(state.offerSeed+137+day)%10007;state.lastOfferRefreshDay=day;return writeState(state)}
export function shortlistProperty(offerIdValue:string){const s=readSave();const state=readState();const offer=availableOffers(state,s).find(o=>o.id===offerIdValue);if(!offer)return false;state.shortlisted=[offerIdValue,...state.shortlisted.filter(x=>x!==offerIdValue)].slice(0,5);return writeState(state)}
export function purchaseProperty(offerIdValue:string,makePrimary=false){
  const s=readSave();if(!s)return false;const state=normalizePrimaryForCohabitation(readState(),s);const offer=availableOffers(state,s).find(o=>o.id===offerIdValue);if(!offer)return false;
  const firstJoint=!hasJointFinca(state);if(firstJoint&&!offer.firstHomeEligible)return false;
  if(makePrimary)for(const p of state.owned)if(p.use==='primary')p.use='available';
  const id=`owned-${offer.id}-${dayOf(s)}`;
  state.owned.push({id,name:offer.title,kind:offer.kind,owner:'joint',city:offer.city,region:offer.region,country:'Espagne',use:makePrimary?'primary':'secondary',acquiredDay:dayOf(s),purchasePrice:offer.price,sourceOfferId:offer.id,canonicalPlace:offer.kind==='finca'?'estate':undefined});
  state.searchOpen=false;state.shortlisted=state.shortlisted.filter(x=>x!==offer.id);
  const f=s.flags||(s.flags={});f.propertyPortfolioStarted=true;f.lastPropertyPurchaseDay=dayOf(s);
  if(firstJoint){f.firstJointPropertyPurchased=true;f.firstJointPropertyId=id;}
  if(makePrimary&&offer.kind==='finca'){f.estateMoved=true;f.primaryPropertyId=id;s.place='estate';}
  writeState(state);writeSave(s);return true;
}
export function setPrimaryProperty(propertyId:string){
  const s=readSave();if(!s)return false;const state=readState();const target=state.owned.find(p=>p.id===propertyId&&p.use!=='sold');if(!target)return false;
  for(const p of state.owned)if(p.use==='primary')p.use=p.id===target.id?'primary':'available';target.use='primary';
  const f=s.flags||(s.flags={});f.primaryPropertyId=target.id;
  if(target.canonicalPlace)s.place=target.canonicalPlace;
  if(target.kind==='finca')f.estateMoved=true;
  writeState(state);writeSave(s);return true;
}
export function sellProperty(propertyId:string){
  const s=readSave();if(!s)return false;const state=readState();const target=state.owned.find(p=>p.id===propertyId&&p.use!=='sold');if(!target||target.id==='marion-nimes-apartment'||target.id==='lucas-madrid-house')return false;
  if(target.use==='primary')return false;target.use='sold';target.soldDay=dayOf(s);writeState(state);const f=s.flags||(s.flags={});f.lastPropertySaleDay=dayOf(s);writeSave(s);return true;
}

declare global{interface Window{
  __moniaProperties?:()=>ReturnType<typeof getPropertyLifeSnapshot>;
  __moniaOpenPropertySearch?:(reason?:'joint-home'|'secondary-home'|'investment')=>boolean;
  __moniaClosePropertySearch?:()=>boolean;
  __moniaRefreshPropertyOffers?:()=>boolean;
  __moniaShortlistProperty?:(offerId:string)=>boolean;
  __moniaPurchaseProperty?:(offerId:string,makePrimary?:boolean)=>boolean;
  __moniaSetPrimaryProperty?:(propertyId:string)=>boolean;
  __moniaSellProperty?:(propertyId:string)=>boolean;
}}
window.__moniaProperties=getPropertyLifeSnapshot;
window.__moniaOpenPropertySearch=openPropertySearch;
window.__moniaClosePropertySearch=closePropertySearch;
window.__moniaRefreshPropertyOffers=refreshPropertyOffers;
window.__moniaShortlistProperty=shortlistProperty;
window.__moniaPurchaseProperty=purchaseProperty;
window.__moniaSetPrimaryProperty=setPrimaryProperty;
window.__moniaSellProperty=sellProperty;
