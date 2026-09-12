import { annualBeatAllowed, annualWeight, markAnnualBeat } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Message={from?:string;text?:string;read?:boolean;day?:number};
type Save={day?:number;time?:string;place?:string;metLucas?:boolean;official?:boolean;relationship?:number;stress?:number;energy?:number;messages?:Message[];calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};

export type SpontaneousBeat={id:string;label:string;intent:string;kind:'social'|'relationship'|'self'|'travel'|'quiet';weight:number;minutes:number;narrative:string;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function key(s:Save){return n(s.day,1)*1440+mins(s.time)}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function recentStrong(s:Save){return (s.eventHistory||[]).slice(-5).some(e=>/proposal|birth|injury|accident|media-crisis|cinematic|surprise/i.test(e))}
function busyToday(s:Save){const d=n(s.day,1),now=mins(s.time);return (s.calendar||[]).filter(x=>n(x.day)===d&&(!x.time||mins(x.time)>=now-10)).length>=3}
function cooldownReady(s:Save,id:string,hours:number){const last=n(s.flags?.[`spontaneous:${id}`],0);return !last||key(s)-last>=hours*60}
function pick<T>(items:T[],seed:string){return items.length?items[hash(seed)%items.length]:null}
function canUse(id:string,recurring=false){return annualBeatAllowed(`spontaneous:${id}`,{recurring,cooldownYears:recurring?1:2})}

export function getSpontaneousLifeBeat():SpontaneousBeat|null{
  const s=read();if(!s)return null;
  const day=n(s.day,1),time=String(s.time||'09:00'),m=mins(time),place=String(s.place||'home'),stress=n(s.stress),energy=n(s.energy,100);
  if(recentStrong(s)||stress>=80||energy<24||busyToday(s))return null;
  const chance=(hash(`${day}-${Math.floor(m/90)}-${place}`)%100);
  if(chance>42)return null;
  const candidates:SpontaneousBeat[]=[];

  if(cooldownReady(s,'quiet',12)&&canUse('quiet',true)&&/home|madrid|estate|family/.test(place))candidates.push({id:'quiet',label:m<720?'Prendre dix minutes sans rien prévoir':'Laisser le moment respirer',intent:'rest',kind:'quiet',weight:annualWeight('home',38),minutes:20,narrative:m<720?'La maison est calme et rien ne presse vraiment pour les prochaines minutes.':'Il y a un petit creux dans la journée, juste assez pour ne rien décider tout de suite.',reason:'Moment de respiration simple et non événementiel.'});
  if(cooldownReady(s,'wander',18)&&canUse('wander')&&m>=660&&m<1200)candidates.push({id:'wander',label:'Faire un détour sans but précis',intent:'open-map',kind:'travel',weight:annualWeight('travel',44),minutes:45,narrative:'Tu pourrais rentrer directement… ou prendre un détour juste parce que la journée le permet.',reason:'Sortie spontanée légère entre deux temps forts.'});
  if(cooldownReady(s,'self',20)&&canUse('self',true)&&energy>45)candidates.push({id:'self',label:'Faire quelque chose juste pour moi',intent:'custom-intent',kind:'self',weight:annualWeight('mixed',41),minutes:60,narrative:'Tu as un peu de temps devant toi, assez pour faire quelque chose qui n’appartient qu’à toi.',reason:'Maintenir une vie personnelle autonome.'});
  if(s.metLucas&&cooldownReady(s,'lucas-checkin',16)&&canUse('lucas-checkin',true)&&!/madrid|estate|family|finca/.test(place))candidates.push({id:'lucas-checkin',label:m>=1140?'Envoyer un petit message à Lucas':'Prendre spontanément de ses nouvelles',intent:'open-phone-lucas',kind:'relationship',weight:annualWeight('couple',52),minutes:8,narrative:'Lucas te traverse l’esprit sans qu’il y ait besoin d’une raison particulière.',reason:'Contact naturel du couple hors scènes prévues.'});
  if(s.official&&cooldownReady(s,'couple-plan',30)&&canUse('couple-plan')&&m>=1020&&m<1320)candidates.push({id:'couple-plan',label:'Voir si on improvise quelque chose ce soir',intent:'open-phone-lucas',kind:'relationship',weight:annualWeight('couple',47),minutes:10,narrative:'La soirée n’est pas encore décidée. Elle pourrait très bien changer au dernier moment.',reason:'Plan de couple improvisé le jour même.'});
  if(cooldownReady(s,'social',28)&&canUse('social',true)&&day>1)candidates.push({id:'social',label:'Voir si quelqu’un est disponible aujourd’hui',intent:'open-phone',kind:'social',weight:annualWeight('social',43),minutes:10,narrative:'Il reste assez de place dans la journée pour écrire à quelqu’un et voir ce qui se passe.',reason:'Vie sociale secondaire autonome.'});

  return pick(candidates,`${day}-${Math.floor(m/60)}-${place}-${n(s.relationship)}`);
}

export function markSpontaneousLifeBeat(id:string){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f[`spontaneous:${id}`]=key(s);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));markAnnualBeat(`spontaneous:${id}`);window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

declare global{interface Window{__moniaSpontaneousLife?:()=>SpontaneousBeat|null;__moniaMarkSpontaneousLife?:(id:string)=>boolean}}
window.__moniaSpontaneousLife=getSpontaneousLifeBeat;window.__moniaMarkSpontaneousLife=markSpontaneousLifeBeat;
