import './intimacy-life-layer';
import './torero-travel-life';
import './travel-continuity-engine';
import './travel-arrival-engine';
import './annual-life-variation';
import './taurine-career-season';
import './taurine-career-pressure-engine';
import './lucas-daily-availability';
import './social-economy-life';
import './conception-bridge';
import './weekly-life-planner';
import './taurine-world-network';
import './narrative-ui';
import './ordinary-life-direction-bridge';
import './ordinary-life-micro-moment';
import './gameplay-intent-router';
import './iphone-conversations';
import './visio-live-guard';
import './immersion-cleanup';
import './world-map-experience';
import './seasonal-wardrobe-atmosphere';
import './living-ambient-motion';
import './place-ambient-signature';
import { getContextualMemoryResonance } from './contextual-memory-resonance';
import { getLifeDirectorSnapshot } from './life-director';
import { getLucasDailyAvailability } from './lucas-daily-availability';
import { getLucasPresence } from './lucas-presence-engine';
import { ensureLifeMilestoneChronology } from './life-milestone-chronology';
import { routeSceneFromGameState, type MonIASceneRoute } from './scene-context-router';
import { buildAdaptiveLucasVisioPrompt, type LucasVisioMood } from './adaptive-visio';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;chemistry?:number;stress?:number;energy?:number;overlay?:unknown;flags?:Record<string,unknown>;eventHistory?:string[]};
export type LifeMediaChannel='message'|'voice'|'call'|'visio'|'cinematic'|'ambient';
export type LifeMediaOpportunity={id:string;channel:LifeMediaChannel;priority:number;reason:string;actor?:string;route?:MonIASceneRoute;payload?:Record<string,unknown>};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function norm(v:unknown){return String(v||'').trim().toLowerCase()}
function recent(s:Save,needle:string,limit=12){return(s.eventHistory||[]).slice(-limit).some(x=>norm(x).includes(needle))}
function hour(time:string){const m=/^(\d{1,2})/.exec(time||'');return m?Number(m[1]):12}

export function getLifeMediaOpportunities():LifeMediaOpportunity[]{
  ensureLifeMilestoneChronology();
  const s=read();if(!s)return[];const out:LifeMediaOpportunity[]=[];const f=s.flags||{};const presence=getLucasPresence();const availability=getLucasDailyAvailability();const director=getLifeDirectorSnapshot();const h=hour(String(s.time||'12:00'));
  if(f.unreadLucasMessage===true)out.push({id:'unread-lucas-message',channel:'message',priority:100,reason:'Un message Lucas attend déjà dans la réalité de la partie.',actor:'lucas'});
  const resonance=getContextualMemoryResonance();if(resonance&&resonance.score>=45)out.push({id:`memory-${resonance.memory.id}`,channel:'ambient',priority:34,reason:'Un souvenir réellement pertinent peut colorer discrètement le moment.',payload:{memoryId:resonance.memory.id}});
  if(!presence?.together&&availability?.phoneReachable&&s.official&&!recent(s,'lucas-call',8)&&h>=10&&h<=22)out.push({id:'lucas-call-window',channel:'call',priority:48,reason:'Lucas est séparé de Marion mais joignable; un appel reste plausible.',actor:'lucas'});
  const requested=norm(f.requestedMedia||f.requestedChannel);if(requested==='cinematic'){const route=routeSceneFromGameState({requestedMedium:'cinematic'});out.push({id:'explicit-cinematic',channel:'cinematic',priority:92,reason:'Une cinématique a été explicitement demandée par le gameplay.',route})}
  if(requested==='voice')out.push({id:'voice-request-held',channel:'ambient',priority:1,reason:'La voix autonome reste désactivée tant que le contexte ne justifie pas une performance V16.',actor:'lucas'});
  if(s.official&&!presence?.together&&availability?.phoneReachable&&!recent(s,'visio',12)&&h>=17&&h<=23){const mood:LucasVisioMood=numeric(s.stress)>=65?'concerned':numeric(s.chemistry)>=72?'tender':'warm';out.push({id:'adaptive-visio',channel:'visio',priority:42,reason:'Une visio peut apparaître naturellement sans être systématique.',actor:'lucas',payload:{prompt:buildAdaptiveLucasVisioPrompt(mood)}})}
  if(director?.moment)out.push({id:`director-${director.moment.id}`,channel:'ambient',priority:Math.max(8,Math.min(38,director.moment.priority||20)),reason:'Le directeur de vie garde le monde actif sans imposer un média lourd.',payload:{moment:director.moment.id}});
  return out.sort((a,b)=>b.priority-a.priority);
}
function numeric(v:unknown,f=0){const n=Number(v);return Number.isFinite(n)?n:f}

declare global{interface Window{__moniaLifeMediaOpportunities?:()=>LifeMediaOpportunity[]}}
window.__moniaLifeMediaOpportunities=getLifeMediaOpportunities;
