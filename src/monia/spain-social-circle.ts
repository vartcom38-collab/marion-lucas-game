import { getFriendshipEvolution } from './friendship-life-evolution';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SpainContact={id:string;name:string;role:string;origin:'fictional'|'public-context';introduced:boolean;closeness:number;available:boolean;canInvite:boolean;reason:string};
export type SpainSocialOpportunity={id:string;label:string;intent:string;weight:number;minutes:number;contactId?:string;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function inSpain(place:string){return /madrid|spain|espagne|finca|estate|family|sevill|andal|salam|hotel/i.test(place)}
function daysInSpain(s:Save){const d=n(s.flags?.spainLifeOpenedDay,0);return d?Math.max(0,n(s.day,1)-d):0}
function contactCloseness(s:Save,id:string){return Math.max(0,Math.min(100,n(s.flags?.[`spainContact:${id}:closeness`],0)))}
function introduced(s:Save,id:string){return s.flags?.[`spainContact:${id}:introduced`]===true}
function available(s:Save,id:string,weight=50){const m=mins(s.time),slot=Math.floor(m/180);const threshold=Math.max(12,Math.min(52,48-Math.round(weight/5)));return m>=540&&m<1320&&(hash(`${id}-${n(s.day,1)}-${slot}`)%100)>=threshold}

const CONTACTS:Array<{id:string;name:string;role:string;minDays:number}>=[
  {id:'alba',name:'Alba',role:'connaissance locale rencontrée hors du cercle de Lucas',minDays:2},
  {id:'ines',name:'Inés',role:'contact du quotidien qui peut devenir une vraie amie avec le temps',minDays:5},
  {id:'clara',name:'Clara',role:'connaissance liée à une activité personnelle de Marion',minDays:8}
];

export function getSpainContacts():SpainContact[]{
  const s=read();if(!s||!inSpain(String(s.place||'')))return[];
  const elapsed=daysInSpain(s);
  return CONTACTS.filter(c=>elapsed>=c.minDays||introduced(s,c.id)).map(c=>{
    const intro=introduced(s,c.id),raw=contactCloseness(s,c.id),friend=intro?getFriendshipEvolution(c.id,raw):null;const close=friend?.closeness??raw;const free=available(s,c.id,friend?.contactWeight||50);
    return{id:c.id,name:c.name,role:c.role,origin:'fictional' as const,introduced:intro,closeness:close,available:free,canInvite:intro&&free&&close>=12&&!friend?.distanceSeason,reason:!intro?'Cette personne peut être rencontrée progressivement, pas imposée d’avance.':friend?.reason||(close<25?'Le lien existe mais reste encore léger.':close<55?'La relation commence à compter.':'Cette personne fait désormais partie du vrai cercle de Marion.')};
  });
}

export function getSpainSocialOpportunities():SpainSocialOpportunity[]{
  const s=read();if(!s||!inSpain(String(s.place||'')))return[];const elapsed=daysInSpain(s),out:SpainSocialOpportunity[]=[];
  const contacts=getSpainContacts();
  const newcomer=contacts.find(c=>!c.introduced);
  if(newcomer&&elapsed>=2)out.push({id:`meet-${newcomer.id}`,label:'Rester ouverte à une nouvelle rencontre',intent:'custom-intent',weight:50,minutes:60,contactId:newcomer.id,reason:'Le cercle espagnol se construit lentement, par rencontres ordinaires.'});
  const known=contacts.filter(c=>c.introduced&&c.available);
  if(known.length){const chosen=known[hash(`${n(s.day,1)}-${Math.floor(mins(s.time)/120)}-social`)%known.length];const friend=getFriendshipEvolution(chosen.id,chosen.closeness);out.push({id:`contact-${chosen.id}`,label:`Voir si ${chosen.name} est libre`,intent:'open-phone',weight:Math.max(38,Math.min(76,48+(chosen.closeness>35?8:0)+Math.round(((friend?.contactWeight||50)-50)/5))),minutes:15,contactId:chosen.id,reason:friend?.reason||'Les relations secondaires ont leur propre disponibilité et ne sont pas toujours accessibles.'});}
  if(elapsed>=4)out.push({id:'solo-local-routine',label:'Faire quelque chose ici sans connaître personne',intent:'open-map',weight:44,minutes:75,reason:'Marion peut construire sa vie même sans attendre qu’un nouveau cercle social soit disponible.'});
  return out.sort((a,b)=>b.weight-a.weight);
}

export function recordSpainContactMoment(id:string,kind:'meet'|'talk'|'invite'|'shared-time'){
  const s=read();if(!s)return false;const f=s.flags||(s.flags={});const key=`spainContact:${id}:closeness`;if(kind==='meet')f[`spainContact:${id}:introduced`]=true;const gain=kind==='meet'?8:kind==='talk'?4:kind==='invite'?5:10;f[key]=Math.min(100,n(f[key],0)+gain);f[`spainContact:${id}:lastDay`]=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),`friendship:${id}:${kind}`].slice(-320);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}
}

declare global{interface Window{__moniaSpainContacts?:()=>SpainContact[];__moniaSpainSocial?:()=>SpainSocialOpportunity[];__moniaRecordSpainContact?:(id:string,kind:'meet'|'talk'|'invite'|'shared-time')=>boolean}}
window.__moniaSpainContacts=getSpainContacts;window.__moniaSpainSocial=getSpainSocialOpportunities;window.__moniaRecordSpainContact=recordSpainContactMoment;
