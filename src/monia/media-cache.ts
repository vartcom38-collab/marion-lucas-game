import type { MonIAMediaPlan } from './media-orchestrator';

const CACHE_KEY='monia-remote-media-index-v1';
const MAX_ENTRIES=96;
const TEMP_TTL_MS=6*60*60*1000;
const PERSISTED_TTL_MS=30*24*60*60*1000;

export type MonIARemoteMediaCacheEntry={
  key:string;
  actor:string;
  imageUrl:string;
  videoUrl:string;
  createdAt:number;
  lastUsedAt:number;
  hits:number;
  persisted?:boolean;
};

function norm(value:string|undefined){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,90);
}

export function mediaCacheKey(plan:MonIAMediaPlan){
  const v=plan.visual;
  return [plan.actor,v.location,v.wardrobe,v.framing,v.emotion,v.action].map(norm).join('|');
}

function sameOrigin(url:string){
  try{return new URL(url,location.href).origin===location.origin}catch{return false}
}

function read():MonIARemoteMediaCacheEntry[]{
  try{
    const raw=localStorage.getItem(CACHE_KEY);
    const parsed=raw?JSON.parse(raw):[];
    if(!Array.isArray(parsed))return [];
    const now=Date.now();
    return parsed.filter((entry:MonIARemoteMediaCacheEntry)=>{
      if(!entry?.videoUrl||!entry?.imageUrl)return false;
      const persisted=entry.persisted===true||(sameOrigin(entry.videoUrl)&&sameOrigin(entry.imageUrl));
      const ttl=persisted?PERSISTED_TTL_MS:TEMP_TTL_MS;
      return now-Number(entry.createdAt||0)<ttl;
    });
  }catch{return []}
}

function write(entries:MonIARemoteMediaCacheEntry[]){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(entries.slice(0,MAX_ENTRIES)))}catch{}
}

export function findCachedRemoteMedia(plan:MonIAMediaPlan){
  const key=mediaCacheKey(plan);
  const entries=read();
  const entry=entries.find(item=>item.key===key);
  if(!entry)return null;
  entry.lastUsedAt=Date.now();entry.hits=(entry.hits||0)+1;
  write([entry,...entries.filter(item=>item!==entry)]);
  return entry;
}

export function rememberRemoteMedia(plan:MonIAMediaPlan,imageUrl:string,videoUrl:string){
  const key=mediaCacheKey(plan),now=Date.now();
  const entries=read().filter(item=>item.key!==key);
  const persisted=sameOrigin(imageUrl)&&sameOrigin(videoUrl);
  const entry:MonIARemoteMediaCacheEntry={key,actor:plan.actor,imageUrl,videoUrl,createdAt:now,lastUsedAt:now,hits:0,persisted};
  write([entry,...entries.sort((a,b)=>b.lastUsedAt-a.lastUsedAt)]);
  return entry;
}

export function clearExpiredRemoteMedia(){write(read())}
