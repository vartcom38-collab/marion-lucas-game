import type { MonIAAsset } from './creative-vault';

const QUEUE_KEY='monia-surprise-delivery-queue-v1';
const SEEN_KEY='monia-surprise-delivery-seen-v1';
const SAVE_KEY='marion-lucas-save-v4';
const MAX_GAME_MINUTES=360;

type DeliveryContext={
  day?:number;
  time?:string;
  place?:string;
  physicalCoPresence?:boolean;
};

export type SurpriseDelivery={
  assetId:string;
  route:string;
  videoUrl:string;
  continuityKey?:string;
  approvedAt:number;
  approvalMode:string;
  context?:DeliveryContext;
};

function readJson<T>(key:string,fallback:T):T{
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}
}
function writeJson(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* optional */}}
function gameMinutes(day?:number,time='00:00'){
  const [h,m]=String(time||'00:00').split(':').map(Number);
  return Number(day||0)*1440+(Number.isFinite(h)?h:0)*60+(Number.isFinite(m)?m:0);
}
function currentContext():DeliveryContext{
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return{};
    const save=JSON.parse(raw) as {day?:number;time?:string;place?:string;flags?:Record<string,unknown>};
    let physical: boolean|undefined;
    const explicit=save.flags?.moniaPhysicalCoPresence;
    if(typeof explicit==='boolean')physical=explicit;
    else if(explicit!==undefined){
      const v=String(explicit).toLowerCase();
      if(['true','1','yes','oui'].includes(v))physical=true;
      if(['false','0','no','non'].includes(v))physical=false;
    }
    if(physical===undefined&&typeof save.flags?.moniaPendingDramaPlan==='string'){
      try{
        const pending=JSON.parse(String(save.flags.moniaPendingDramaPlan)) as {route?:{physicalCoPresence?:boolean}};
        if(typeof pending.route?.physicalCoPresence==='boolean')physical=pending.route.physicalCoPresence;
      }catch{/* optional */}
    }
    return{day:Number(save.day||0),time:save.time||'00:00',place:save.place,physicalCoPresence:physical};
  }catch{return{}}
}

export function readSurpriseDeliveryQueue(){return readJson<SurpriseDelivery[]>(QUEUE_KEY,[])}
export function readSeenSurpriseScenes(){return readJson<string[]>(SEEN_KEY,[])}

export function isSurpriseDeliveryContextValid(delivery:SurpriseDelivery,now=currentContext()){
  const origin=delivery.context;
  if(!origin)return true;
  const route=delivery.route.toLowerCase();
  const needsPhysical=route.includes('couple')||route.includes('family')||route.includes('duo');
  if(needsPhysical&&now.physicalCoPresence===false)return false;
  if(needsPhysical&&origin.physicalCoPresence===false)return false;
  if(needsPhysical&&origin.place&&now.place&&origin.place!==now.place)return false;
  if(origin.day!==undefined&&now.day!==undefined){
    const age=gameMinutes(now.day,now.time)-gameMinutes(origin.day,origin.time);
    if(age<0||age>MAX_GAME_MINUTES)return false;
  }
  return true;
}

export function pruneStaleSurpriseScenes(){
  const queue=readSurpriseDeliveryQueue();
  const kept=queue.filter(item=>isSurpriseDeliveryContextValid(item));
  if(kept.length!==queue.length){
    writeJson(QUEUE_KEY,kept);
    window.dispatchEvent(new CustomEvent('monia:surprise-scene-pruned',{detail:{removed:queue.length-kept.length}}));
  }
  return kept;
}

export function enqueueApprovedSurpriseScene(asset:MonIAAsset){
  if(asset.status!=='approved'||asset.kind!=='video')return false;
  if(!asset.tags.includes('assembled-scene'))return false;
  const queue=pruneStaleSurpriseScenes();
  const seen=new Set(readSeenSurpriseScenes());
  if(seen.has(asset.id)||queue.some(x=>x.assetId===asset.id))return false;
  const route=String(asset.role||'').replace(/^assembled-/,'')||String(asset.metadata?.route||'scene');
  const delivery:SurpriseDelivery={
    assetId:asset.id,
    route,
    videoUrl:asset.url,
    continuityKey:typeof asset.metadata?.continuityKey==='string'?asset.metadata.continuityKey:undefined,
    approvedAt:Date.now(),
    approvalMode:String(asset.metadata?.approvalMode||'approved'),
    context:currentContext(),
  };
  queue.push(delivery);
  writeJson(QUEUE_KEY,queue.slice(-12));
  window.dispatchEvent(new CustomEvent('monia:surprise-scene-ready',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  return true;
}

export function peekNextSurpriseScene(route?:string){
  const queue=pruneStaleSurpriseScenes();
  if(!route)return queue[0]||null;
  return queue.find(x=>x.route===route)||null;
}

export function consumeSurpriseScene(assetId:string){
  const queue=readSurpriseDeliveryQueue();
  const index=queue.findIndex(x=>x.assetId===assetId);
  if(index<0)return null;
  const [delivery]=queue.splice(index,1);
  writeJson(QUEUE_KEY,queue);
  const seen=readSeenSurpriseScenes();
  if(!seen.includes(delivery.assetId))writeJson(SEEN_KEY,[...seen,delivery.assetId].slice(-100));
  window.dispatchEvent(new CustomEvent('monia:surprise-scene-consumed',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  return delivery;
}

export function consumeNextSurpriseScene(route?:string){
  const next=peekNextSurpriseScene(route);
  return next?consumeSurpriseScene(next.assetId):null;
}

export function clearSurpriseDeliveryQueue(){writeJson(QUEUE_KEY,[])}

declare global{
  interface Window{
    __moniaPeekSurpriseScene?:(route?:string)=>SurpriseDelivery|null;
    __moniaConsumeSurpriseScene?:(route?:string)=>SurpriseDelivery|null;
    __moniaPruneSurpriseScenes?:()=>SurpriseDelivery[];
  }
}
window.__moniaPeekSurpriseScene=peekNextSurpriseScene;
window.__moniaConsumeSurpriseScene=consumeNextSurpriseScene;
window.__moniaPruneSurpriseScenes=pruneStaleSurpriseScenes;
