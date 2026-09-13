import { resolveLucasHomeRhythm } from './lucas-home-rhythm';
import {getLucasProfessionalContext} from './lucas-professional-context';
import '../social-presence-state';

const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;calendar?:CalendarItem[];flags?:Record<string,unknown>};

export type LucasPresenceState='with-marion'|'same-area'|'working'|'traveling'|'away'|'unknown';
export type LucasPresenceSnapshot={
  state:LucasPresenceState;
  lucasPlace:string;
  marionPlace:string;
  together:boolean;
  reachableByPhone:boolean;
  privateTimePossible:boolean;
  reason:string;
  source:'explicit-flag'|'calendar'|'travel-choice'|'inference'|'unknown';
};
export type LucasCommunicationPolicy={
  mode:'local'|'connect'|'missed'|'unreachable';
  canCall:boolean;
  canMessage:boolean;
  responseDelayMinutes:number;
  label:string;
  reason:string;
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function norm(v:unknown){return String(v||'').trim().toLowerCase()}
function area(place:string){const p=norm(place);if(/nîmes|nimes|home|cafe|arenes|arènes|station/.test(p))return'nimes';if(/madrid/.test(p))return'madrid';if(/sevill|andal/.test(p))return'andalusia';if(/salam/.test(p))return'salamanca';if(/finca|estate|family/.test(p))return'finca';if(/hotel/.test(p))return'hotel';if(/arena|arène|plaza|corrida/.test(p))return'arena';return p||'unknown'}
function todayLucasItems(s:Save){const d=n(s.day,1);return(s.calendar||[]).filter(i=>n(i.day)===d&&norm(i.owner)==='lucas')}
function itemPlace(i:CalendarItem|null){if(!i)return'';return String(i.place||i.note||i.title||'').trim()}
function passiveCalendarItem(s:Save){const items=todayLucasItems(s);return items.find(i=>!i.time)||null}
function homeAdjusted(snapshot:LucasPresenceSnapshot){if(!snapshot.together)return snapshot;const home=resolveLucasHomeRhythm(snapshot.marionPlace,true);if(!home)return snapshot;return{...snapshot,privateTimePossible:home.privateTimePossible,reason:home.activity==='available'?snapshot.reason:home.label};}

export function getLucasPresence():LucasPresenceSnapshot|null{
  const s=read();if(!s)return null;
  const f=s.flags||{};const marionPlace=String(s.place||'');const marionArea=area(marionPlace);
  const explicit=String(f.lucasCurrentPlace||'').trim();
  if(explicit){const lucasArea=area(explicit),together=f.lucasWithMarion===true||lucasArea===marionArea&&f.lucasWithMarion!==false;return homeAdjusted({state:together?'with-marion':lucasArea===marionArea?'same-area':'away',lucasPlace:explicit,marionPlace,together,reachableByPhone:!together,privateTimePossible:together,reason:together?'Lucas est explicitement enregistré avec Marion.':'La position de Lucas est enregistrée séparément de celle de Marion.',source:'explicit-flag'});}
  const professional=getLucasProfessionalContext();
  if(professional.active){
    const lp=professional.place||professional.title||'activité professionnelle';
    if(professional.kind==='travel')return{state:'traveling',lucasPlace:lp,marionPlace,together:false,reachableByPhone:false,privateTimePossible:false,reason:professional.reason,source:'calendar'};
    return{state:'working',lucasPlace:lp,marionPlace,together:false,reachableByPhone:professional.phone!=='unreachable',privateTimePossible:false,reason:professional.reason,source:'calendar'};
  }
  const item=passiveCalendarItem(s);if(item){const lp=itemPlace(item),la=area(lp),together=la!=='unknown'&&la===marionArea;return homeAdjusted({state:together?'with-marion':la===marionArea?'same-area':'away',lucasPlace:lp||'agenda Lucas',marionPlace,together,reachableByPhone:!together,privateTimePossible:together,reason:together?'L’agenda place Lucas au même endroit que Marion.':'L’agenda place Lucas ailleurs pour ce moment.',source:'calendar'});}
  if(f.travelWithLucas===true)return homeAdjusted({state:'with-marion',lucasPlace:marionPlace,marionPlace,together:true,reachableByPhone:false,privateTimePossible:true,reason:'Marion a choisi de voyager avec Lucas et aucun engagement séparé ne le place ailleurs.',source:'travel-choice'});
  if(f.travelWithLucas===false&&f.toreroTravelChoiceDay&&n(f.toreroTravelChoiceDay)<=n(s.day,1)){return{state:'away',lucasPlace:'déplacement de Lucas',marionPlace,together:false,reachableByPhone:true,privateTimePossible:false,reason:'Marion ne suit pas actuellement le déplacement professionnel de Lucas.',source:'travel-choice'};}
  if(!s.official)return{state:'unknown',lucasPlace:'',marionPlace,together:false,reachableByPhone:true,privateTimePossible:false,reason:'Aucune présence physique de Lucas n’est supposée avant que la relation et le contexte ne l’établissent.',source:'unknown'};
  return{state:'unknown',lucasPlace:'',marionPlace,together:false,reachableByPhone:true,privateTimePossible:false,reason:'Le lieu de Marion seul ne suffit plus à supposer que Lucas est physiquement présent.',source:'inference'};
}

export function getLucasCommunicationPolicy():LucasCommunicationPolicy{
  const p=getLucasPresence(),pro=getLucasProfessionalContext();
  if(!p)return{mode:'connect',canCall:true,canMessage:true,responseDelayMinutes:0,label:'Disponible',reason:'Aucun blocage de disponibilité connu.'};
  if(p.together)return{mode:'local',canCall:false,canMessage:true,responseDelayMinutes:0,label:'Avec toi',reason:'Lucas est physiquement avec Marion : une interaction locale doit primer sur le téléphone.'};
  if(pro.active&&pro.phone==='unreachable')return{mode:'unreachable',canCall:false,canMessage:true,responseDelayMinutes:pro.responseDelayMinutes,label:pro.kind==='travel'?'En déplacement':'Indisponible',reason:pro.reason};
  if(pro.active&&pro.phone==='limited')return{mode:'missed',canCall:true,canMessage:true,responseDelayMinutes:pro.responseDelayMinutes,label:pro.recovery?'En récupération':'Occupé',reason:pro.reason};
  if(p.state==='traveling'||!p.reachableByPhone)return{mode:'unreachable',canCall:false,canMessage:true,responseDelayMinutes:75,label:'En déplacement',reason:p.reason};
  if(p.state==='working')return{mode:'missed',canCall:true,canMessage:true,responseDelayMinutes:45,label:'Occupé',reason:p.reason};
  return{mode:'connect',canCall:true,canMessage:true,responseDelayMinutes:0,label:p.state==='same-area'?'Dans le secteur':'Disponible',reason:p.reason};
}

declare global{interface Window{__moniaLucasPresence?:()=>LucasPresenceSnapshot|null;__moniaLucasCommunication?:()=>LucasCommunicationPolicy}}
window.__moniaLucasPresence=getLucasPresence;
window.__moniaLucasCommunication=getLucasCommunicationPolicy;
