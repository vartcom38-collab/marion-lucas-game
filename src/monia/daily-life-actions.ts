import { getDailyLifeSnapshot, interpretFreeIntent, type DailyDirection } from './daily-life-engine';
import { markSpontaneousLifeBeat } from './spontaneous-life-engine';
import { consumeDynamicPlanChange } from './dynamic-plan-change-engine';
import { recordSpainContactMoment } from './spain-social-circle';
import { recordSpainPlaceMoment } from './spain-familiar-life';
import { resolveTravelArrival } from './travel-arrival-engine';
import { consumeFeriaHotelBeat } from './feria-hotel-life-engine';
import { consumeSocialOutingBeat } from './social-outing-life';
import { applyCurrentPlaceHistory } from './place-history-life';
import { getLongStayRoutine, resolveLongStayRoutine } from './long-stay-routine-life';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;stress?:number;energy?:number;eventHistory?:string[];flags?:Record<string,unknown>};
export type DailyActionResult={ok:boolean;intent:string;handledBy:'bridge'|'game'|'player';minutes:number;message?:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save,meaningfulPlaceMoment=false){applyCurrentPlaceHistory(s,meaningfulPlaceMoment);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function addMinutes(s:Save,minutes:number){const [h,m]=String(s.time||'09:00').split(':').map(Number);let total=(h||0)*60+(m||0)+Math.max(0,minutes);while(total>=1440){total-=1440;s.day=n(s.day,1)+1;}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
function note(s:Save,event:string){s.eventHistory=[...(s.eventHistory||[]),event].slice(-260)}
function dispatch(intent:string,detail:Record<string,unknown>={}){window.dispatchEvent(new CustomEvent('monia:daily-intent',{detail:{intent,...detail}}));}
function currentDirection(id:string){return getDailyLifeSnapshot()?.directions.find(d=>d.id===id)||null}
function adjust(s:Save,energy:number,stress:number){s.energy=Math.max(0,Math.min(100,n(s.energy,70)+energy));s.stress=Math.max(0,Math.min(100,n(s.stress)+stress));}

function bridge(direction:DailyDirection):DailyActionResult{
  const s=read();if(!s)return{ok:false,intent:direction.intent,handledBy:'bridge',minutes:0,message:'Aucune partie active.'};
  const mins=direction.minutes||0;
  switch(direction.intent){
    case 'rest':addMinutes(s,mins);adjust(s,14,-10);note(s,'daily-rest');write(s);dispatch('state-changed',{source:'rest'});return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:mins};
    case 'morning-routine':addMinutes(s,mins);adjust(s,4,-1);note(s,'daily-morning-routine');write(s);dispatch('state-changed',{source:'morning-routine'});return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:mins};
    case 'follow-calendar':case 'open-lucas-day':case 'continue-torero-travel':case 'open-phone-lucas':case 'open-latest-message':case 'open-phone':case 'open-map':case 'evening-options':case 'open-intimacy-choice':case 'open-wardrobe':dispatch(direction.intent,{direction});return{ok:true,intent:direction.intent,handledBy:'game',minutes:0};
    case 'custom-intent':dispatch('open-custom-intent',{direction});return{ok:true,intent:direction.intent,handledBy:'player',minutes:0};
    default:dispatch(direction.intent,{direction});return{ok:true,intent:direction.intent,handledBy:'game',minutes:0};
  }
}

function handleMarionHome(direction:DailyDirection){
  if(direction.source!=='marion-home-rhythm'||!direction.intent.startsWith('marion-home:'))return false;
  const s=read();if(!s)return false;const activity=direction.intent.split(':')[1]||'quiet-home';const mins=Math.max(15,direction.minutes||35);
  addMinutes(s,mins);
  const effects:Record<string,[number,number]>={
    'self-care':[3,-6],reading:[1,-5],cooking:[2,-3],'work-project':[-5,1],'quiet-home':[6,-8]
  };
  const [energy,stress]=effects[activity]||[0,-2];adjust(s,energy,stress);
  const f=s.flags||(s.flags={});f.lastMarionHomeActivity=activity;f.lastMarionHomeActivityDay=n(s.day,1);f.lastMarionHomeActivityTime=String(s.time||'09:00');
  note(s,`marion-home:${activity}:${n(s.day,1)}`);write(s,activity==='cooking'||activity==='work-project');dispatch('state-changed',{source:'marion-home',activity,direction});return true;
}

function handleSharedHome(direction:DailyDirection){
  if(direction.source!=='shared-home-life'||!direction.intent.startsWith('shared-home-'))return false;
  const s=read();if(!s)return false;const activity=direction.intent.replace(/^shared-home-/,'');const mins=Math.max(15,direction.minutes||35);
  addMinutes(s,mins);
  const effects:Record<string,[number,number]>={quiet:[1,-3],meal:[5,-2],rest:[5,-6],parallel:[-2,-1],'small-break':[2,-3],outdoor:[-3,-5],'between-bases':[-3,-2]};
  const [energy,stress]=effects[activity]||[0,-2];adjust(s,energy,stress);
  const f=s.flags||(s.flags={});f.lastSharedHomeActivity=activity;f.lastSharedHomeDay=n(s.day,1);
  note(s,`shared-home-choice:${activity}:${n(s.day,1)}`);write(s,activity==='meal'||activity==='outdoor');dispatch('state-changed',{source:'shared-home',activity,direction});return true;
}

function handleCoupleRoutine(direction:DailyDirection){
  if(direction.source!=='shared-home-life'||!direction.intent.startsWith('couple-routine-'))return false;
  const s=read();if(!s)return false;const kind=direction.intent.replace(/^couple-routine-/,'');const mins=Math.max(10,direction.minutes||30);
  addMinutes(s,mins);
  const effects:Record<string,[number,number]>={'morning-coffee':[2,-2],'shared-meal':[4,-2],'parallel-evening':[-1,-3],'quiet-return':[4,-5],'late-check-in':[-1,-3],'weekend-slow':[5,-5]};
  const [energy,stress]=effects[kind]||[1,-2];adjust(s,energy,stress);
  const f=s.flags||(s.flags={});f[`coupleRoutine:${kind}:lastDay`]=n(s.day,1);f[`coupleRoutine:${kind}:count`]=n(f[`coupleRoutine:${kind}:count`])+1;
  note(s,`couple-routine:${kind}:${n(s.day,1)}`);write(s,kind==='shared-meal'||kind==='quiet-return');dispatch('state-changed',{source:'couple-routine',kind,direction});return true;
}

function handleSpainSocial(direction:DailyDirection){const id=direction.id;const meet=id.match(/^spain-spain-social-meet-(.+)$/);if(meet){recordSpainContactMoment(meet[1],'meet');const s=read();if(s){addMinutes(s,Math.max(30,direction.minutes||60));note(s,`spain-social-meet:${meet[1]}`);write(s,true);}dispatch('state-changed',{source:'spain-social-meet',contactId:meet[1]});return true;}const contact=id.match(/^spain-spain-social-contact-(.+)$/);if(contact){recordSpainContactMoment(contact[1],'talk');dispatch('open-phone',{source:'spain-social-contact',contactId:contact[1]});return true;}return false;}
function handleSpainRoutine(direction:DailyDirection){const match=direction.id.match(/spain-routine-(?:discover|routine)-(.+)$/);if(!match)return false;const placeId=match[1];recordSpainPlaceMoment(placeId);const s=read();if(s){addMinutes(s,Math.max(25,direction.minutes||45));note(s,`spain-familiar-place:${placeId}`);write(s,true);}dispatch(direction.intent,{source:'spain-familiar-place',placeId,direction});return true;}
function handleTravelArrival(direction:DailyDirection){const match=direction.id.match(/^arrival-(.+)$/);if(!match)return false;const ok=resolveTravelArrival(match[1]);if(ok){const s=read();if(s)write(s);dispatch('state-changed',{source:'travel-arrival',actionId:match[1]});}return ok;}
function handleSocialOuting(direction:DailyDirection){if(direction.source!=='social-outing-life')return false;const s=read();if(!s)return false;consumeSocialOutingBeat(direction.id);const mode=direction.intent.split(':')[1]||'social';const mins=Math.max(30,direction.minutes||75);addMinutes(s,mins);adjust(s,-(mode==='marion-solo'||mode==='separate-plans'?8:6),mode==='taurine-with-lucas'?0:-4);note(s,`social-outing-choice:${mode}`);write(s,true);dispatch('state-changed',{source:'social-outing',mode,direction});return true;}

export function executeDailyDirection(id:string):DailyActionResult{
  const direction=currentDirection(id);
  if(!direction){const stay=getLongStayRoutine();if(stay?.id===id&&resolveLongStayRoutine(id)){dispatch('state-changed',{source:'long-stay-routine',kind:stay.kind});return{ok:true,intent:stay.intent,handledBy:'bridge',minutes:stay.minutes};}return{ok:false,intent:id,handledBy:'bridge',minutes:0,message:'Cette direction n’est plus disponible.'};}
  if(direction.source==='spontaneous-life'&&direction.id.startsWith('spontaneous-'))markSpontaneousLifeBeat(direction.id.replace('spontaneous-',''));
  if(direction.source==='dynamic-plan-change'&&direction.id.startsWith('planchange-'))consumeDynamicPlanChange(direction.id.replace('planchange-',''));
  if(direction.source==='feria-hotel-life'&&direction.id.startsWith('feria-hotel-'))consumeFeriaHotelBeat(direction.id.replace('feria-hotel-',''));
  if(direction.source==='travel-arrival'&&handleTravelArrival(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  if(direction.source==='marion-home-rhythm'&&handleMarionHome(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  if(direction.source==='shared-home-life'&&handleCoupleRoutine(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  if(direction.source==='shared-home-life'&&handleSharedHome(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  if(direction.source==='spain-life'&&handleSpainSocial(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  if(direction.source==='spain-life'&&handleSpainRoutine(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  if(handleSocialOuting(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  return bridge(direction);
}

export function executeFreeIntent(text:string):DailyActionResult{const parsed=interpretFreeIntent(text);if(!parsed.allowed)return{ok:false,intent:text,handledBy:'player',minutes:0,message:'Écris ce que Marion a envie de faire.'};const s=read();if(s){const f=s.flags||(s.flags={});f.lastFreeIntent=text.trim().slice(0,220);f.lastFreeIntentDay=n(s.day,1);f.lastFreeIntentTime=String(s.time||'09:00');write(s,/restaurant|café|cafe|plage|arène|arena|feria|maison|finca|voyage|sortie|soirée|soiree/i.test(text));}dispatch('free-intent',{text:text.trim(),kind:parsed.kind});return{ok:true,intent:text.trim(),handledBy:'player',minutes:0};}

declare global{interface Window{__moniaExecuteDailyDirection?:(id:string)=>DailyActionResult;__moniaExecuteFreeIntent?:(text:string)=>DailyActionResult}}
window.__moniaExecuteDailyDirection=executeDailyDirection;window.__moniaExecuteFreeIntent=executeFreeIntent;
