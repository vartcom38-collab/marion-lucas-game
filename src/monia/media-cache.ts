import type { MonIAMediaPlan } from './media-orchestrator';

const CACHE_KEY='monia-remote-media-index-v1';
const MAX_ENTRIES=48;
const TTL_MS=6*60*60*1000;

export type MonIARemoteMediaCacheEntry={
  key:string;
  actor:string;
  imageUrl:string;
  videoUrl:string;
  createdAt:number;
  lastUsedAt:number;
  hits:number;
};

function norm(value:string|undefined){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,90);
}

export function mediaCacheKey(plan:MonIAMediaPlan){
  const v=plan.visual;
  return [plan.actor,v.location,v.wardrobe,v.framing,v.emotion,v.action].map(norm).join('|');
}

function read():MonIARemoteMediaCacheEntry[]{
  try{
    const raw=localStorage.getItem(CACHE_KEY);
    const parsed=raw?JSON.parse(raw):[];
    if(!Array.isArray(parsed))return [];
    const now=Date.now();
    return parsed.filter((entry:MonIARemoteMediaCacheEntry)=>entry?.videoUrl&&entry?.imageUrl&&now-Number(entry.createdAt||0)<TTL_MS);
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
  const entry:MonIARemoteMediaCacheEntry={key,actor:plan.actor,imageUrl,videoUrl,createdAt:now,lastUsedAt:now,hits:0};
  write([entry,...entries.sort((a,b)=>b.lastUsedAt-a.lastUsedAt)]);
  return entry;
}

export function clearExpiredRemoteMedia(){write(read())}
