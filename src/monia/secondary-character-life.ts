import { getFriendshipEvolution } from './friendship-life-evolution';

const SAVE_KEY='marion-lucas-save-v4';

type Message={from?:string;text?:string;read?:boolean;day?:number};
type Save={day?:number;time?:string;place?:string;messages?:Message[];flags?:Record<string,unknown>;eventHistory?:string[]};

export type SecondaryCharacterState={
  id:string;name:string;home:string;currentPlace:string;distance:'same-city'|'distance';available:boolean;relationshipRole:string;canInvite:boolean;canMeet:boolean;canMessage:boolean;reason:string;
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function marionInNimes(place:string){return /home|nimes|cafe|arenes|station/i.test(place)}
function marionInSpain(place:string){return /madrid|family|finca|estate|spain|sevill|andal|salam|hotel/i.test(place)}

export function getMarineState():SecondaryCharacterState|null{
  const s=read();if(!s)return null;
  const day=n(s.day,1),m=mins(s.time),place=String(s.place||'home');
  const sameCity=marionInNimes(place);const distance=marionInSpain(place);const slot=Math.floor(m/180);const friendship=getFriendshipEvolution('marine',62);
  const unavailableThreshold=Math.max(12,Math.min(42,34-Math.round(((friendship?.contactWeight||50)-50)/5)));
  const unavailable=(hash(`marine-${day}-${slot}`)%100)<unavailableThreshold;const late=m>=1380||m<420;const available=!late&&!unavailable;
  const canMeet=sameCity&&available&&!friendship?.distanceSeason;const canMessage=!late;
  const relationReason=friendship?.reason||'Marine reste une amie importante avec son propre rythme.';
  return{
    id:'marine',name:'Marine',home:'Nîmes',currentPlace:'Nîmes',distance:sameCity?'same-city':'distance',available,
    relationshipRole:'amie de Marion à Nîmes',canInvite:canMeet,canMeet,canMessage,
    reason:sameCity?(canMeet?`Marine est à Nîmes et peut être disponible. ${relationReason}`:`Marine est à Nîmes, mais leur lien et leurs journées ont aussi leur propre rythme. ${relationReason}`):(distance?`Marion est en Espagne; Marine reste à Nîmes. ${relationReason}`:`Marine reste basée à Nîmes même quand Marion est ailleurs. ${relationReason}`)
  };
}

export function materializeMarineInvitation(){
  const s=read(),state=getMarineState(),friendship=getFriendshipEvolution('marine',62);if(!s||!state||!state.canInvite)return false;
  const f=s.flags||(s.flags={});const stamp=n(s.day,1)*1440+mins(s.time);const last=n(f.marineLastAutonomousInviteAt,0);const cooldownHours=friendship?.phase==='close'||friendship?.phase==='returning'?30:friendship?.phase==='quiet'?72:42;if(last&&stamp-last<cooldownHours*60)return false;
  const variants=['Je suis en ville là. Si t’as envie, on peut se prendre un café sans prise de tête.','Je vais faire un tour vers le centre. Si tu veux venir avec moi, dis-moi.','J’ai un moment de libre aujourd’hui. Ça te dit qu’on se voie un peu ?'];
  const text=variants[hash(`marine-invite-${n(s.day,1)}-${Math.floor(mins(s.time)/120)}`)%variants.length];const messages=s.messages||(s.messages=[]);messages.unshift({from:'Marine',text,read:false,day:n(s.day,1)});f.marineLastAutonomousInviteAt=stamp;f.marineHome='Nîmes';s.eventHistory=[...(s.eventHistory||[]),'friendship:marine:invite'].slice(-320);
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));window.dispatchEvent(new CustomEvent('monia:secondary-character-message',{detail:{from:'Marine',kind:'invitation'}}));return true}catch{return false}
}

export function getSecondaryCharacters(){const marine=getMarineState();return marine?[marine]:[]}

declare global{interface Window{__moniaSecondaryCharacters?:()=>SecondaryCharacterState[];__moniaMarineState?:()=>SecondaryCharacterState|null;__moniaMarineInvite?:()=>boolean}}
window.__moniaSecondaryCharacters=getSecondaryCharacters;window.__moniaMarineState=getMarineState;window.__moniaMarineInvite=materializeMarineInvitation;
