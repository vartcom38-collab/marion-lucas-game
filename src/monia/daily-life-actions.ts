import { getDailyLifeSnapshot, interpretFreeIntent, type DailyDirection } from './daily-life-engine';
import { markSpontaneousLifeBeat } from './spontaneous-life-engine';
import { consumeDynamicPlanChange } from './dynamic-plan-change-engine';
import { recordSpainContactMoment } from './spain-social-circle';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;stress?:number;energy?:number;eventHistory?:string[];flags?:Record<string,unknown>};
export type DailyActionResult={ok:boolean;intent:string;handledBy:'bridge'|'game'|'player';minutes:number;message?:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));window.dispatchEvent(new Event('storage'));}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function addMinutes(s:Save,minutes:number){const [h,m]=String(s.time||'09:00').split(':').map(Number);let total=(h||0)*60+(m||0)+Math.max(0,minutes);while(total>=1440){total-=1440;s.day=n(s.day,1)+1;}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
function note(s:Save,event:string){s.eventHistory=[...(s.eventHistory||[]),event].slice(-180)}
function dispatch(intent:string,detail:Record<string,unknown>={}){window.dispatchEvent(new CustomEvent('monia:daily-intent',{detail:{intent,...detail}}));}
function currentDirection(id:string){return getDailyLifeSnapshot()?.directions.find(d=>d.id===id)||null}

function bridge(direction:DailyDirection):DailyActionResult{
  const s=read();if(!s)return{ok:false,intent:direction.intent,handledBy:'bridge',minutes:0,message:'Aucune partie active.'};
  const mins=direction.minutes||0;
  switch(direction.intent){
    case 'rest':
      addMinutes(s,mins);s.energy=Math.min(100,n(s.energy,70)+14);s.stress=Math.max(0,n(s.stress)-10);note(s,'daily-rest');write(s);dispatch('state-changed',{source:'rest'});return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:mins};
    case 'morning-routine':
      addMinutes(s,mins);s.energy=Math.min(100,n(s.energy,70)+4);note(s,'daily-morning-routine');write(s);dispatch('state-changed',{source:'morning-routine'});return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:mins};
    case 'follow-calendar':
    case 'open-lucas-day':
    case 'continue-torero-travel':
    case 'open-phone-lucas':
    case 'open-latest-message':
    case 'open-phone':
    case 'open-map':
    case 'evening-options':
    case 'open-intimacy-choice':
      dispatch(direction.intent,{direction});return{ok:true,intent:direction.intent,handledBy:'game',minutes:0};
    case 'custom-intent':
      dispatch('open-custom-intent',{direction});return{ok:true,intent:direction.intent,handledBy:'player',minutes:0};
    default:
      dispatch(direction.intent,{direction});return{ok:true,intent:direction.intent,handledBy:'game',minutes:0};
  }
}

function handleSpainSocial(direction:DailyDirection){
  const id=direction.id;
  const meet=id.match(/^spain-spain-social-meet-(.+)$/);if(meet){recordSpainContactMoment(meet[1],'meet');const s=read();if(s){addMinutes(s,Math.max(30,direction.minutes||60));note(s,`spain-social-meet:${meet[1]}`);write(s);}dispatch('state-changed',{source:'spain-social-meet',contactId:meet[1]});return true;}
  const contact=id.match(/^spain-spain-social-contact-(.+)$/);if(contact){recordSpainContactMoment(contact[1],'talk');dispatch('open-phone',{source:'spain-social-contact',contactId:contact[1]});return true;}
  return false;
}

export function executeDailyDirection(id:string):DailyActionResult{
  const direction=currentDirection(id);if(!direction)return{ok:false,intent:id,handledBy:'bridge',minutes:0,message:'Cette direction n’est plus disponible.'};
  if(direction.source==='spontaneous-life'&&direction.id.startsWith('spontaneous-'))markSpontaneousLifeBeat(direction.id.replace('spontaneous-',''));
  if(direction.source==='dynamic-plan-change'&&direction.id.startsWith('planchange-'))consumeDynamicPlanChange(direction.id.replace('planchange-',''));
  if(direction.source==='spain-life'&&handleSpainSocial(direction))return{ok:true,intent:direction.intent,handledBy:'bridge',minutes:direction.minutes||0};
  return bridge(direction);
}

export function executeFreeIntent(text:string):DailyActionResult{
  const parsed=interpretFreeIntent(text);if(!parsed.allowed)return{ok:false,intent:text,handledBy:'player',minutes:0,message:'Écris ce que Marion a envie de faire.'};
  const s=read();if(s){const f=s.flags||(s.flags={});f.lastFreeIntent=text.trim().slice(0,220);f.lastFreeIntentDay=n(s.day,1);f.lastFreeIntentTime=String(s.time||'09:00');write(s);}
  dispatch('free-intent',{text:text.trim(),kind:parsed.kind});
  return{ok:true,intent:text.trim(),handledBy:'player',minutes:0};
}

declare global{interface Window{__moniaExecuteDailyDirection?:(id:string)=>DailyActionResult;__moniaExecuteFreeIntent?:(text:string)=>DailyActionResult}}
window.__moniaExecuteDailyDirection=executeDailyDirection;
window.__moniaExecuteFreeIntent=executeFreeIntent;
