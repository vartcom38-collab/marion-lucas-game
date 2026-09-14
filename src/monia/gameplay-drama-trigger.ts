const SAVE_KEY='marion-lucas-save-v4';
const EVENT_NAME='marion-lucas:gameplay-drama';
const REQUEST_EVENT='monia:cinematic-gameplay-requested';
const CINEMATIC_ROUTES=new Set(['lucas-solo-drama','couple-drama','family-drama']);
let lastRequestId='';

type LooseSave={
  day?:number;time?:string;place?:string;relationship?:number;trust?:number;chemistry?:number;
  metLucas?:boolean;official?:boolean;memories?:string[];eventHistory?:string[];outfit?:string;
  flags?:Record<string,unknown>;
};

export type GameplayDramaTrigger={
  source:'gameplay';
  requestId:string;
  route:string;
  signature:string;
  day:number;
  time:string;
  place:string;
  title:string;
  body:string;
  dialogue:string[];
  tone:string;
  presentation:string;
  relationship:number;
  trust:number;
  chemistry:number;
  outfit:string;
  memories:string[];
  recentEvents:string[];
};

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}

function explicitRequest(save:LooseSave){
  const flags=save.flags||{};
  const requestId=String(flags.gameplayCinematicRequestId||'').trim();
  const route=String(flags.gameplayCinematicRoute||'').trim();
  const reason=String(flags.gameplayCinematicReason||'').trim();
  const requestDay=Number(flags.gameplayCinematicRequestDay||0);
  const day=Number(save.day||0);
  if(!requestId||requestId===lastRequestId||!CINEMATIC_ROUTES.has(route)||!reason)return null;
  if(!day||requestDay!==day)return null;
  return{requestId,route,reason};
}

function buildTrigger():GameplayDramaTrigger|null{
  const save=readSave();
  if(!save?.metLucas)return null;
  const request=explicitRequest(save);
  if(!request)return null;
  const signature=`gameplay|${request.requestId}|${request.route}`.slice(0,1200);
  return{
    source:'gameplay',requestId:request.requestId,route:request.route,signature,
    day:Number(save.day||0),time:save.time||'00:00',place:save.place||'home',
    title:'Grand moment du gameplay',body:request.reason,dialogue:[],tone:'cinematic',presentation:request.route,
    relationship:Number(save.relationship||0),trust:Number(save.trust||0),chemistry:Number(save.chemistry||0),
    outfit:save.outfit||'',memories:(save.memories||[]).slice(0,8),recentEvents:(save.eventHistory||[]).slice(-8),
  };
}

function dispatchExplicitGameplayTrigger(){
  const trigger=buildTrigger();
  if(!trigger)return;
  lastRequestId=trigger.requestId;
  window.dispatchEvent(new CustomEvent<GameplayDramaTrigger>(EVENT_NAME,{detail:trigger}));
  console.info('[Drama] Explicit gameplay request accepted',trigger.requestId);
}

window.addEventListener(REQUEST_EVENT,dispatchExplicitGameplayTrigger as EventListener);

export const GAMEPLAY_DRAMA_EVENT=EVENT_NAME;
console.info('[Drama] Explicit gameplay-only trigger bridge active');
