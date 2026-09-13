const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type CanonicalPregnancyState='none'|'trying'|'possible'|'confirmed'|'postpartum'|'loss';
export type PregnancyStateSnapshot={state:CanonicalPregnancyState;possibleDay:number|null;confirmedDay:number|null;birthDay:number|null;canonical:true;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}))}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function derive(s:Save):PregnancyStateSnapshot{
  const f=s.flags||{},day=Math.max(1,n(s.day,1));
  const loss=f.pregnancyLoss===true;
  const postpartum=f.postpartum===true||String(f.familyState||'')==='postpartum';
  const confirmed=f.pregnancyConfirmed===true||String(f.familyState||'')==='pregnant';
  const possible=f.pregnancyPossible===true;
  const trying=f.tryingForBaby===true||String(f.familyState||'')==='trying'||String(f.contraceptionMode||'')==='trying';
  const possibleDay=possible?Math.max(1,n(f.pregnancyPossibleDay,day)):null;
  const confirmedDay=confirmed?Math.max(1,n(f.pregnancyConfirmedDay,n(f.pregnancyStartDay,possibleDay||day))):null;
  const birthDay=postpartum?Math.max(1,n(f.birthDay,day)):null;
  if(loss)return{state:'loss',possibleDay,confirmedDay,birthDay,canonical:true,reason:'Une perte de grossesse est enregistrée.'};
  if(postpartum)return{state:'postpartum',possibleDay,confirmedDay,birthDay,canonical:true,reason:'La naissance a eu lieu et la période post-partum est active.'};
  if(confirmed)return{state:'confirmed',possibleDay,confirmedDay,birthDay,canonical:true,reason:'La grossesse est confirmée.'};
  if(possible)return{state:'possible',possibleDay,confirmedDay:null,birthDay:null,canonical:true,reason:'Une grossesse est biologiquement possible mais reste non confirmée.'};
  if(trying)return{state:'trying',possibleDay:null,confirmedDay:null,birthDay:null,canonical:true,reason:'Le projet bébé est actif sans grossesse connue.'};
  return{state:'none',possibleDay:null,confirmedDay:null,birthDay:null,canonical:true,reason:'Aucune grossesse active n’est enregistrée.'};
}

export function getPregnancyState(save?:Save|null){const s=save===undefined?read():save;return s?derive(s):null}

export function syncPregnancyState(save?:Save|null){
  const s=save===undefined?read():save;if(!s)return null;const f=s.flags||(s.flags={}),snap=derive(s);let changed=false;
  const set=(k:string,v:unknown)=>{if(f[k]!==v){f[k]=v;changed=true}};
  if(snap.state==='trying'){set('familyState','trying');set('tryingForBaby',true)}
  if(snap.state==='possible'){set('pregnancyPossible',true);set('pregnancyPossibleDay',snap.possibleDay);if(String(f.familyState||'')==='pregnant')set('familyState','trying')}
  if(snap.state==='confirmed'){set('pregnancyConfirmed',true);set('pregnancyConfirmedDay',snap.confirmedDay);set('pregnancyStartDay',snap.confirmedDay);set('familyState','pregnant');set('pregnancyPossible',false)}
  if(snap.state==='postpartum'){set('postpartum',true);set('familyState','postpartum');set('birthDay',snap.birthDay)}
  if(snap.state==='loss'){set('pregnancyLoss',true);set('familyState','thinking');set('pregnancyPossible',false);set('pregnancyConfirmed',false)}
  if(changed&&save===undefined)write(s);
  return derive(s);
}

export function setPregnancyState(state:CanonicalPregnancyState,day?:number){
  const s=read();if(!s)return false;const f=s.flags||(s.flags={}),d=Math.max(1,n(day,n(s.day,1)));
  if(state==='trying'){f.familyState='trying';f.tryingForBaby=true;f.familyTryingDay=n(f.familyTryingDay,d)}
  if(state==='possible'){f.pregnancyPossible=true;f.pregnancyPossibleDay=d;f.pregnancyTestEarliestDay=n(f.pregnancyTestEarliestDay,d+10)}
  if(state==='confirmed'){f.pregnancyConfirmed=true;f.pregnancyConfirmedDay=d;f.pregnancyStartDay=d;f.familyState='pregnant';f.pregnancyPossible=false}
  if(state==='postpartum'){f.postpartum=true;f.birthDay=d;f.familyState='postpartum';f.pregnancyConfirmed=false;f.pregnancyPossible=false}
  if(state==='loss'){f.pregnancyLoss=true;f.familyState='thinking';f.pregnancyConfirmed=false;f.pregnancyPossible=false}
  if(state==='none'){f.familyState='closed';f.tryingForBaby=false;f.pregnancyPossible=false;f.pregnancyConfirmed=false;f.postpartum=false;f.pregnancyLoss=false}
  s.eventHistory=[...(s.eventHistory||[]),`pregnancy-state:${state}:${d}`].slice(-240);write(s);return true;
}

window.setTimeout(()=>syncPregnancyState(),900);
window.addEventListener('monia:save-changed',()=>syncPregnancyState());

declare global{interface Window{__moniaPregnancyState?:()=>PregnancyStateSnapshot|null;__moniaSetPregnancyState?:(state:CanonicalPregnancyState,day?:number)=>boolean}}
window.__moniaPregnancyState=()=>getPregnancyState();
window.__moniaSetPregnancyState=setPregnancyState;
