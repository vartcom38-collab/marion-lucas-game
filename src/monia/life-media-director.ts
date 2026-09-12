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
import { routeSceneFromGameState, type MonIASceneRoute } from './scene-context-router';
import { buildAdaptiveLucasVisioPrompt, type LucasVisioMood } from './adaptive-visio';

const SAVE_KEY='marion-lucas-save-v4';

type Message={from?:string;text?:string;read?:boolean;day?:number};
type Save={
  day?:number;time?:string;place?:string;marionAge?:number;lucasAge?:number;
  metLucas?:boolean;official?:boolean;engaged?:boolean;married?:boolean;children?:number;
  relationship?:number;trust?:number;chemistry?:number;stress?:number;energy?:number;
  messages?:Message[];eventHistory?:string[];memories?:string[];flags?:Record<string,unknown>;
};

export type LifeMediaChannel='message'|'voice'|'call'|'visio'|'cinematic'|'ambient';
export type LifeMediaOpportunity={
  id:string;
  channel:LifeMediaChannel;
  route:MonIASceneRoute;
  priority:number;
  eligible:boolean;
  approvalRequired:boolean;
  surpriseSafe:boolean;
  reason:string;
  prompt?:string;
  notBeforeDay?:number;
};

export type HiddenLifeReadiness={
  proposal:{eligible:boolean;earliestDay:number;latestSoftDay:number;reason:string};
  wedding:{eligible:boolean;reason:string};
  familyPlanning:{eligible:boolean;reason:string};
};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}
function recentText(s:Save){return [...(s.messages||[]).slice(0,8).map(m=>m.text||''),...(s.eventHistory||[]).slice(-8),...(s.memories||[]).slice(0,8)].join(' · ')}
function relationLabel(s:Save){const r=n(s.relationship);return r>=70?'très proche':r>=45?'proche':r>=20?'en rapprochement':'encore réservé'}
function moodFor(s:Save):LucasVisioMood{const availability=getLucasDailyAvailability();if(availability?.tone==='tender')return'tender';if(availability?.tone==='drained')return'worried';if(availability?.tone==='quiet')return'neutral';const stress=n(s.stress),r=n(s.relationship),t=n(s.trust);if(stress>70)return'worried';if(r>=60&&t>=45)return'tender';if(n(s.chemistry)>=60&&availability?.tone!=='focused')return'playful';return'neutral'}

function hiddenReadiness(s:Save):HiddenLifeReadiness{
  const day=Math.max(1,n(s.day,1));
  const officialDay=n(s.flags?.officialDay,day);
  const engagedDay=n(s.flags?.engagedDay,day);
  const marriedDay=n(s.flags?.marriedDay,day);
  const relation=n(s.relationship),trust=n(s.trust);
  const proposalEarliest=Math.max(officialDay+90,day);
  const proposalLatestSoft=Math.max(proposalEarliest+240,officialDay+540);
  const proposalEligible=!!s.official&&!s.engaged&&relation>=68&&trust>=58&&day>=proposalEarliest;
  const weddingEligible=!!s.engaged&&!s.married&&day>=engagedDay+14;
  const familyPlanning=!!s.married&&day>=marriedDay+45&&relation>=60&&trust>=55;
  return{
    proposal:{eligible:proposalEligible,earliestDay:proposalEarliest,latestSoftDay:proposalLatestSoft,reason:proposalEligible?'Fenêtre relationnelle mûre sans date exacte exposée au joueur.':'Relation ou durée encore insuffisante.'},
    wedding:{eligible:weddingEligible,reason:weddingEligible?'Le mariage peut entrer dans une phase d’organisation détaillée.':'Pas encore dans la fenêtre de préparation.'},
    familyPlanning:{eligible:familyPlanning,reason:familyPlanning?'La vie de couple est assez installée pour ouvrir ce sujet sans l’imposer.':'Sujet encore prématuré ou non décidé.'}
  };
}

export function planLifeMedia():LifeMediaOpportunity[]{
  const s=readSave();const snapshot=getLifeDirectorSnapshot();if(!s||!snapshot)return[];
  const haystack=recentText(s);const lucasAvailability=getLucasDailyAvailability();
  const routeDecision=routeSceneFromGameState({
    place:s.place,time:s.time,relationship:n(s.relationship),trust:n(s.trust),chemistry:n(s.chemistry),official:!!s.official,engaged:!!s.engaged,married:!!s.married,children:n(s.children),
    recentMessages:(s.messages||[]).slice(0,6).map(m=>m.text||''),recentEvents:(s.eventHistory||[]).slice(-6),memories:(s.memories||[]).slice(0,6)
  });
  const out:LifeMediaOpportunity[]=[];
  const unread=(s.messages||[]).find(m=>m.read===false&&m.text);
  if(unread)out.push({id:'unread-message',channel:'message',route:'message-only',priority:100,eligible:true,approvalRequired:false,surpriseSafe:true,reason:'Un message réel existe déjà dans la sauvegarde.'});
  const resonance=getContextualMemoryResonance();
  if(resonance)out.push({id:resonance.id,channel:'ambient',route:'environment-beat',priority:34,eligible:true,approvalRequired:false,surpriseSafe:true,reason:`${resonance.narrative} Le souvenir reste une résonance du présent : aucun flashback automatique et aucune ancienne scène n’est rejouée.`});
  if(s.metLucas&&snapshot.surpriseBudget.call){const canCall=lucasAvailability?.canCallNow!==false;out.push({id:'lucas-call-window',channel:'call',route:'visio',priority:lucasAvailability?.contactWeight||58,eligible:canCall,approvalRequired:false,surpriseSafe:true,reason:lucasAvailability?.reason||'Lucas est connu et un appel spontané peut être proposé ou initié librement.'});}
  if(s.metLucas&&snapshot.surpriseBudget.cinematic){
    const route=routeDecision.route;
    if(route!=='message-only'&&route!=='visio')out.push({id:'contextual-cinematic',channel:'cinematic',route,priority:72,eligible:true,approvalRequired:true,surpriseSafe:true,reason:routeDecision.reason});
  }
  if(s.metLucas&&snapshot.surpriseBudget.voice)out.push({id:'voice-candidate',channel:'voice',route:'message-only',priority:45,eligible:false,approvalRequired:true,surpriseSafe:false,reason:'Canal réservé jusqu’à validation d’une voix Lucas naturelle et stable.'});
  if(s.metLucas){
    const visioPrompt=buildAdaptiveLucasVisioPrompt({state:'speaking',mood:moodFor(s),place:String(s.place||''),timeOfDay:String(s.time||''),relationship:relationLabel(s),recentBeat:`${haystack.slice(-320)} · ${lucasAvailability?.reason||''}`.slice(-420)});
    out.push({id:'adaptive-visio',channel:'visio',route:'visio',priority:lucasAvailability?.contactWeight||66,eligible:lucasAvailability?.canCallNow!==false,approvalRequired:true,surpriseSafe:true,reason:lucasAvailability?.reason||'La visio est adaptée au lieu, à l’heure, à la relation et au contexte récent.',prompt:visioPrompt});
  }
  return out.sort((a,b)=>b.priority-a.priority);
}

export function getHiddenLifeReadiness(){const s=readSave();return s?hiddenReadiness(s):null}

declare global{interface Window{__moniaPlanLifeMedia?:()=>LifeMediaOpportunity[];__moniaHiddenLifeReadiness?:()=>HiddenLifeReadiness|null}}
window.__moniaPlanLifeMedia=planLifeMedia;
window.__moniaHiddenLifeReadiness=getHiddenLifeReadiness;
