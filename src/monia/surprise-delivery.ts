import type { MonIAAsset } from './creative-vault';

const QUEUE_KEY='monia-surprise-delivery-queue-v1';
const SEEN_KEY='monia-surprise-delivery-seen-v1';

export type SurpriseDelivery={
  assetId:string;
  route:string;
  videoUrl:string;
  continuityKey?:string;
  approvedAt:number;
  approvalMode:string;
};

function readJson<T>(key:string,fallback:T):T{
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}
}
function writeJson(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* optional */}}

export function readSurpriseDeliveryQueue(){return readJson<SurpriseDelivery[]>(QUEUE_KEY,[])}
export function readSeenSurpriseScenes(){return readJson<string[]>(SEEN_KEY,[])}

export function enqueueApprovedSurpriseScene(asset:MonIAAsset){
  if(asset.status!=='approved'||asset.kind!=='video')return false;
  if(!asset.tags.includes('assembled-scene'))return false;
  const queue=readSurpriseDeliveryQueue();
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
  };
  queue.push(delivery);
  writeJson(QUEUE_KEY,queue.slice(-12));
  window.dispatchEvent(new CustomEvent('monia:surprise-scene-ready',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  return true;
}

export function peekNextSurpriseScene(route?:string){
  const queue=readSurpriseDeliveryQueue();
  if(!route)return queue[0]||null;
  return queue.find(x=>x.route===route)||null;
}

export function consumeNextSurpriseScene(route?:string){
  const queue=readSurpriseDeliveryQueue();
  const index=route?queue.findIndex(x=>x.route===route):(queue.length?0:-1);
  if(index<0)return null;
  const [delivery]=queue.splice(index,1);
  writeJson(QUEUE_KEY,queue);
  const seen=readSeenSurpriseScenes();
  if(!seen.includes(delivery.assetId))writeJson(SEEN_KEY,[...seen,delivery.assetId].slice(-100));
  window.dispatchEvent(new CustomEvent('monia:surprise-scene-consumed',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  return delivery;
}

export function clearSurpriseDeliveryQueue(){writeJson(QUEUE_KEY,[])}

declare global{
  interface Window{
    __moniaPeekSurpriseScene?:(route?:string)=>SurpriseDelivery|null;
    __moniaConsumeSurpriseScene?:(route?:string)=>SurpriseDelivery|null;
  }
}
window.__moniaPeekSurpriseScene=peekNextSurpriseScene;
window.__moniaConsumeSurpriseScene=consumeNextSurpriseScene;
