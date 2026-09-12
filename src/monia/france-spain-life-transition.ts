const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;calendar?:Array<{day?:number;time?:string;owner?:string;title?:string;place?:string}>;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FranceSpainPhase='nimes-rooted'|'spain-opening'|'transitioning'|'spain-rooted'|'between-bases';
export type FranceSpainState={phase:FranceSpainPhase;nimesIsHome:boolean;spainIsHome:boolean;marineDistance:'same-city'|'distance';canPrepareSpain:boolean;canReturnNimes:boolean;travelFriction:'low'|'normal'|'high';suggestions:Array<{id:string;label:string;intent:string;weight:number}>;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function inNimes(place:string){return /home|nimes|cafe|arenes|station/i.test(place)}
function inSpain(place:string){return /madrid|spain|finca|estate|family|sevill|andal|salam|hotel/i.test(place)}
function recent(s:Save,rx:RegExp){return (s.eventHistory||[]).slice(-30).some(e=>rx.test(String(e)))}

export function getFranceSpainState():FranceSpainState|null{
  const s=read();if(!s)return null;const place=String(s.place||'home');const f=s.flags||{};const day=n(s.day,1);
  const nimes=inNimes(place),spain=inSpain(place);const relationship=n(s.relationship),trust=n(s.trust);
  const hasSpainOpened=!!f.spainLifeOpened||spain||recent(s,/spain|madrid|espagne|move-spain|travel-spain/i);
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

export function markSpainLifeOpened(){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f.spainLifeOpened=true;f.spainLifeOpenedDay=n(s.day,1);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));return true}catch{return false}}
export function markSpainHomeEstablished(){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f.spainLifeOpened=true;f.spainHomeEstablished=true;f.spainHomeEstablishedDay=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),'spain-home-established'].slice(-200);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));return true}catch{return false}}

declare global{interface Window{__moniaFranceSpainState?:()=>FranceSpainState|null;__moniaOpenSpainLife?:()=>boolean;__moniaEstablishSpainHome?:()=>boolean}}
window.__moniaFranceSpainState=getFranceSpainState;window.__moniaOpenSpainLife=markSpainLifeOpened;window.__moniaEstablishSpainHome=markSpainHomeEstablished;
