const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;energy?:number;stress?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>;eventHistory?:string[]};
export type TravelMode='car'|'train'|'flight'|'mixed';
export type TravelState='idle'|'planned'|'departing'|'in-transit'|'arriving'|'staying'|'returning';
export type TravelPlan={id:string;owner:'Marion'|'Lucas'|'together';from:string;to:string;mode:TravelMode;state:TravelState;departDay:number;departTime:string;arrivalDay:number;arrivalTime:string;hotelNight:boolean;fatigue:number;source:'calendar'|'choice'|'explicit';};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function stamp(day:number,time?:string){return day*1440+mins(time)}
function norm(v:unknown){return String(v||'').trim()}
function samePlace(a:string,b:string){return a.toLowerCase()===b.toLowerCase()}
function estimateMode(from:string,to:string):TravelMode{const f=from.toLowerCase(),t=to.toLowerCase();if((/nimes/.test(f)&&/madrid|sevill|salam/.test(t))||(/nimes/.test(t)&&/madrid|sevill|salam/.test(f)))return'flight';if((/madrid/.test(f)&&/sevill|salam/.test(t))||(/madrid/.test(t)&&/sevill|salam/.test(f)))return'train';return'car'}
function durationMinutes(mode:TravelMode,from:string,to:string){if(mode==='flight')return 360;if(mode==='train')return 240;if(/madrid/.test(from.toLowerCase())&&/finca|estate|family/.test(to.toLowerCase()))return 90;return 120}
function addMinutes(day:number,time:string,delta:number){let total=stamp(day,time)+delta;return{day:Math.floor(total/1440),time:`${String(Math.floor((total%1440)/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}}
function currentStored(s:Save):TravelPlan|null{const raw=s.flags?.activeTravelPlan;return raw&&typeof raw==='object'?raw as TravelPlan:null}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));window.dispatchEvent(new Event('storage'));}
function note(s:Save,e:string){s.eventHistory=[...(s.eventHistory||[]),e].slice(-200)}

export function createTravelPlan(input:{owner:'Marion'|'Lucas'|'together';from:string;to:string;departDay?:number;departTime?:string;mode?:TravelMode;source:'calendar'|'choice'|'explicit'}){
  const s=read();if(!s)return null;const from=norm(input.from),to=norm(input.to);if(!from||!to||samePlace(from,to))return null;const departDay=input.departDay??n(s.day,1),departTime=input.departTime||String(s.time||'09:00');const mode=input.mode||estimateMode(from,to);const dur=durationMinutes(mode,from,to);const arr=addMinutes(departDay,departTime,dur);const hotelNight=arr.day>departDay||mins(arr.time)>=1320;const plan:TravelPlan={id:`${input.owner}-${departDay}-${departTime}-${to}`.replace(/\s+/g,'-').toLowerCase(),owner:input.owner,from,to,mode,state:'planned',departDay,departTime,arrivalDay:arr.day,arrivalTime:arr.time,hotelNight,fatigue:mode==='flight'?18:mode==='train'?11:14,source:input.source};const f=s.flags||(s.flags={});f.activeTravelPlan=plan;note(s,`travel-plan:${input.owner}:${from}->${to}`);write(s);return plan;
}

export function syncTravelState():TravelPlan|null{
  const s=read();if(!s)return null;const plan=currentStored(s);if(!plan)return null;const now=stamp(n(s.day,1),String(s.time||'09:00'));const dep=stamp(plan.departDay,plan.departTime),arr=stamp(plan.arrivalDay,plan.arrivalTime);let state:TravelState='planned';if(now>=dep-45&&now<dep)state='departing';else if(now>=dep&&now<arr)state='in-transit';else if(now>=arr&&now<arr+90)state='arriving';else if(now>=arr)state='staying';plan.state=state;const f=s.flags||(s.flags={});f.activeTravelPlan=plan;if((plan.owner==='Marion'||plan.owner==='together')&&state==='in-transit')s.place=`Trajet vers ${plan.to}`;if((plan.owner==='Marion'||plan.owner==='together')&&state==='arriving')s.place=plan.to;if((plan.owner==='Lucas'||plan.owner==='together')){f.lucasCurrentPlace=state==='in-transit'?`Trajet vers ${plan.to}`:state==='arriving'||state==='staying'?plan.to:plan.from;f.lucasWithMarion=plan.owner==='together'&&(state==='departing'||state==='in-transit'||state==='arriving'||state==='staying');}
  if(state==='arriving'&&f[`travelArrivalApplied:${plan.id}`]!==true){f[`travelArrivalApplied:${plan.id}`]=true;s.energy=Math.max(0,n(s.energy,70)-plan.fatigue);s.stress=Math.min(100,n(s.stress)+Math.round(plan.fatigue/3));note(s,`travel-arrival:${plan.owner}:${plan.to}`);}write(s);return plan;
}

export function finishTravelPlan(){const s=read();if(!s)return false;const plan=currentStored(s);if(!plan)return false;const f=s.flags||(s.flags={});delete f.activeTravelPlan;if(plan.owner==='Lucas'&&f.lucasCurrentPlace===plan.to)f.lucasWithMarion=false;note(s,`travel-finished:${plan.owner}:${plan.to}`);write(s);return true}
export function getTravelContinuity(){const s=read();if(!s)return null;const plan=currentStored(s);return plan?syncTravelState():null}

declare global{interface Window{__moniaTravelContinuity?:()=>TravelPlan|null;__moniaCreateTravelPlan?:(input:{owner:'Marion'|'Lucas'|'together';from:string;to:string;departDay?:number;departTime?:string;mode?:TravelMode;source:'calendar'|'choice'|'explicit'})=>TravelPlan|null;__moniaFinishTravelPlan?:()=>boolean}}
window.__moniaTravelContinuity=getTravelContinuity;window.__moniaCreateTravelPlan=createTravelPlan;window.__moniaFinishTravelPlan=finishTravelPlan;
