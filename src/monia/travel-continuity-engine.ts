const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;energy?:number;stress?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type TravelMode='car'|'flight';
export type TravelState='idle'|'planned'|'departing'|'in-transit'|'arriving'|'staying'|'returning';
export type TravelPlan={id:string;owner:'Marion'|'Lucas'|'together';from:string;to:string;mode:TravelMode;state:TravelState;departDay:number;departTime:string;arrivalDay:number;arrivalTime:string;hotelNight:boolean;fatigue:number;source:'calendar'|'choice'|'explicit';driver:'self'|'chauffeur'|'airport-transfer';cuadrillaTruck:boolean;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function stamp(day:number,time?:string){return day*1440+mins(time)}
function norm(v:unknown){return String(v||'').trim()}
function samePlace(a:string,b:string){return a.toLowerCase()===b.toLowerCase()}
function routeArea(v:string){const p=v.toLowerCase();if(/nîmes|nimes|home|café|cafe|arènes|arenes|station/.test(p))return'nimes';if(/madrid/.test(p))return'madrid';if(/finca|estate|family/.test(p))return'finca';if(/sevill|andal/.test(p))return'seville';if(/salam/.test(p))return'salamanca';return p}
function estimateMode(from:string,to:string):TravelMode{const f=routeArea(from),t=routeArea(to);if(f===t)return'car';if((f==='nimes'&&['madrid','seville','salamanca'].includes(t))||(t==='nimes'&&['madrid','seville','salamanca'].includes(f)))return'flight';return'car'}
function durationMinutes(mode:TravelMode,from:string,to:string){const f=routeArea(from),t=routeArea(to);if(f===t)return f==='nimes'?25:35;if((f==='madrid'&&t==='finca')||(f==='finca'&&t==='madrid'))return 90;if(mode==='flight')return 360;if((f==='madrid'&&t==='salamanca')||(f==='salamanca'&&t==='madrid'))return 150;if((f==='madrid'&&t==='seville')||(f==='seville'&&t==='madrid'))return 330;if(['madrid','finca','seville','salamanca'].includes(f)&&['madrid','finca','seville','salamanca'].includes(t))return 240;return 90}
function addMinutes(day:number,time:string,delta:number){let total=stamp(day,time)+delta;return{day:Math.floor(total/1440),time:`${String(Math.floor((total%1440)/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}}
function currentStored(s:Save):TravelPlan|null{const raw=s.flags?.activeTravelPlan;return raw&&typeof raw==='object'?raw as TravelPlan:null}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));window.dispatchEvent(new Event('storage'));}
function note(s:Save,e:string){s.eventHistory=[...(s.eventHistory||[]),e].slice(-200)}
function transportMeta(owner:TravelPlan['owner'],mode:TravelMode){const lucasTrip=owner==='Lucas'||owner==='together';const driver:TravelPlan['driver']=mode==='flight'?'airport-transfer':lucasTrip?'chauffeur':'self';return{driver,cuadrillaTruck:lucasTrip};}

export function createTravelPlan(input:{owner:'Marion'|'Lucas'|'together';from:string;to:string;departDay?:number;departTime?:string;mode?:TravelMode;source:'calendar'|'choice'|'explicit'}){
  const s=read();if(!s)return null;const from=norm(input.from),to=norm(input.to);if(!from||!to||samePlace(from,to))return null;const departDay=input.departDay??n(s.day,1),departTime=input.departTime||String(s.time||'09:00');const mode=input.mode||estimateMode(from,to);const dur=durationMinutes(mode,from,to);const arr=addMinutes(departDay,departTime,dur);const hotelNight=arr.day>departDay||mins(arr.time)>=1320;const local=routeArea(from)===routeArea(to);const fatigue=local?3:mode==='flight'?18:12;const meta=transportMeta(input.owner,mode);const plan:TravelPlan={id:`${input.owner}-${departDay}-${departTime}-${to}`.replace(/\s+/g,'-').toLowerCase(),owner:input.owner,from,to,mode,state:'planned',departDay,departTime,arrivalDay:arr.day,arrivalTime:arr.time,hotelNight,fatigue,source:input.source,driver:meta.driver,cuadrillaTruck:meta.cuadrillaTruck};const f=s.flags||(s.flags={});f.activeTravelPlan=plan;if(meta.cuadrillaTruck)f.cuadrillaTruckOnRoute=true;note(s,`travel-plan:${input.owner}:${from}->${to}:${mode}`);write(s);return plan;
}

export function syncTravelState():TravelPlan|null{
  const s=read();if(!s)return null;const plan=currentStored(s);if(!plan)return null;const now=stamp(n(s.day,1),String(s.time||'09:00'));const dep=stamp(plan.departDay,plan.departTime),arr=stamp(plan.arrivalDay,plan.arrivalTime);let state:TravelState='planned';if(now>=dep-45&&now<dep)state='departing';else if(now>=dep&&now<arr)state='in-transit';else if(now>=arr&&now<arr+90)state='arriving';else if(now>=arr)state='staying';plan.state=state;const f=s.flags||(s.flags={});f.activeTravelPlan=plan;if((plan.owner==='Marion'||plan.owner==='together')&&state==='in-transit')s.place=`Trajet vers ${plan.to}`;if((plan.owner==='Marion'||plan.owner==='together')&&(state==='arriving'||state==='staying'))s.place=plan.to;if((plan.owner==='Lucas'||plan.owner==='together')){f.lucasCurrentPlace=state==='in-transit'?`Trajet vers ${plan.to}`:state==='arriving'||state==='staying'?plan.to:plan.from;f.lucasWithMarion=plan.owner==='together'&&(state==='departing'||state==='in-transit'||state==='arriving'||state==='staying');f.lucasHasChauffeur=plan.mode==='car';f.cuadrillaTruckOnRoute=plan.cuadrillaTruck&&(['departing','in-transit','arriving'].includes(state));}
  if(state==='arriving'&&f[`travelArrivalApplied:${plan.id}`]!==true){f[`travelArrivalApplied:${plan.id}`]=true;s.energy=Math.max(0,n(s.energy,70)-plan.fatigue);s.stress=Math.min(100,n(s.stress)+Math.round(plan.fatigue/3));note(s,`travel-arrival:${plan.owner}:${plan.to}`);}write(s);return plan;
}

export function finishTravelPlan(){const s=read();if(!s)return false;const plan=currentStored(s);if(!plan)return false;const f=s.flags||(s.flags={});delete f.activeTravelPlan;f.cuadrillaTruckOnRoute=false;if(plan.owner==='Lucas'&&f.lucasCurrentPlace===plan.to)f.lucasWithMarion=false;note(s,`travel-finished:${plan.owner}:${plan.to}`);write(s);return true}
export function getTravelContinuity(){const s=read();if(!s)return null;const plan=currentStored(s);return plan?syncTravelState():null}

declare global{interface Window{__moniaTravelContinuity?:()=>TravelPlan|null;__moniaCreateTravelPlan?:(input:{owner:'Marion'|'Lucas'|'together';from:string;to:string;departDay?:number;departTime?:string;mode?:TravelMode;source:'calendar'|'choice'|'explicit'})=>TravelPlan|null;__moniaFinishTravelPlan?:()=>boolean}}
window.__moniaTravelContinuity=getTravelContinuity;window.__moniaCreateTravelPlan=createTravelPlan;window.__moniaFinishTravelPlan=finishTravelPlan;
