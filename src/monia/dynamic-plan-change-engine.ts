import { getMarineState, materializeMarineInvitation } from './secondary-character-life';

const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Message={from?:string;text?:string;read?:boolean;day?:number};
type Save={day?:number;time?:string;place?:string;metLucas?:boolean;official?:boolean;stress?:number;energy?:number;phoneUnread?:number;messages?:Message[];calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};

export type PlanChangeKind='invitation'|'delay'|'cancelled'|'transport'|'lucas-schedule'|'social';
export type PlanChange={id:string;kind:PlanChangeKind;label:string;detail:string;intent:string;weight:number;minutes:number;source:string;expiresAt:number};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'))}catch{}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function nowKey(s:Save){return n(s.day,1)*1440+mins(s.time)}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function recentStrong(s:Save){return (s.eventHistory||[]).slice(-6).some(e=>/proposal|birth|injury|accident|media-crisis|cinematic|surprise/i.test(e))}
function ready(s:Save,id:string,hours:number){const last=n(s.flags?.[`planchange:${id}`],0);return !last||nowKey(s)-last>=hours*60}
function today(s:Save){return (s.calendar||[]).filter(x=>n(x.day)===n(s.day,1))}
function hasUnreadFrom(s:Save,who:string){return (s.messages||[]).some(m=>m.read===false&&String(m.from||'').toLowerCase()===who.toLowerCase())}

export function getDynamicPlanChange():PlanChange|null{
  const s=read();if(!s)return null;
  const day=n(s.day,1),m=mins(s.time),stress=n(s.stress),energy=n(s.energy,100),place=String(s.place||'home');
  if(recentStrong(s)||stress>=82||energy<22)return null;
  const slot=Math.floor(m/120),chance=hash(`${day}-${slot}-${place}-planchange`)%100;
  if(chance>28)return null;
  const list:PlanChange[]=[];const items=today(s);const lucasItems=items.filter(i=>String(i.owner||'').toLowerCase()==='lucas');

  if(s.metLucas&&s.official&&lucasItems.length&&ready(s,'lucas-schedule',24)){
    const next=lucasItems.find(i=>!i.time||mins(i.time)>=m-20);
    if(next)list.push({id:'lucas-schedule',kind:'lucas-schedule',label:'Le programme de Lucas vient de bouger',detail:`${String(next.title||'Un engagement')} peut modifier ce que vous aviez imaginé pour aujourd’hui.`,intent:'open-lucas-day',weight:78,minutes:10,source:'calendar',expiresAt:nowKey(s)+240});
  }
  const marine=getMarineState();
  if(day>1&&marine?.canInvite&&!hasUnreadFrom(s,'Marine')&&ready(s,'marine-last-minute',36)&&m>=660&&m<=1170){
    list.push({id:'marine-last-minute',kind:'invitation',label:'Marine propose quelque chose au dernier moment',detail:'Marine est à Nîmes. Si Marion est encore en ville et que Marine est libre, elles peuvent se voir spontanément.',intent:'open-phone',weight:67,minutes:10,source:'social-circle',expiresAt:nowKey(s)+180});
  }
  if(items.some(i=>String(i.owner||'').toLowerCase()==='marion')&&ready(s,'appointment-shift',48)&&m>=540&&m<=1080){
    list.push({id:'appointment-shift',kind:'delay',label:'Un rendez-vous peut changer d’horaire',detail:'Ton planning n’est pas gravé dans le marbre. Tu peux vérifier ton agenda avant de décider.',intent:'follow-calendar',weight:63,minutes:5,source:'calendar',expiresAt:nowKey(s)+150});
  }
  if(ready(s,'transport',72)&&m>=600&&m<=1200&&!/home|madrid|estate|family/.test(place)){
    list.push({id:'transport',kind:'transport',label:'Le trajet ne se passe pas exactement comme prévu',detail:'Un contretemps léger peut t’obliger à revoir l’ordre de ta journée.',intent:'open-map',weight:54,minutes:20,source:'travel',expiresAt:nowKey(s)+120});
  }
  if(s.metLucas&&ready(s,'couple-replan',30)&&m>=1020&&m<=1290){
    list.push({id:'couple-replan',kind:'social',label:'La soirée peut encore changer',detail:'Vous pouvez garder le plan prévu, improviser autre chose, ou chacun faire sa soirée.',intent:'open-phone-lucas',weight:58,minutes:10,source:'relationship',expiresAt:nowKey(s)+180});
  }

  if(!list.length)return null;return list.sort((a,b)=>b.weight-a.weight)[hash(`${day}-${slot}-${place}-choice`)%list.length]||null;
}

function materialize(s:Save,id:string){
  if(id==='marine-last-minute')materializeMarineInvitation();
  if(id==='appointment-shift'){const f=s.flags||(s.flags={});f.calendarNeedsAttention=true;}
  if(id==='transport'){const f=s.flags||(s.flags={});f.travelNeedsReplan=true;}
  if(id==='lucas-schedule'){const f=s.flags||(s.flags={});f.lucasScheduleShiftedToday=true;}
}

export function consumeDynamicPlanChange(id:string){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f[`planchange:${id}`]=nowKey(s);f.lastPlanChange=id;f.lastPlanChangeAt=nowKey(s);materialize(s,id);write(s);return true}

declare global{interface Window{__moniaDynamicPlanChange?:()=>PlanChange|null;__moniaConsumePlanChange?:(id:string)=>boolean}}
window.__moniaDynamicPlanChange=getDynamicPlanChange;window.__moniaConsumePlanChange=consumeDynamicPlanChange;
