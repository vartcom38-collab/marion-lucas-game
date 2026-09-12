const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SharedMemoryKind='couple'|'family'|'social'|'travel'|'taurine'|'home';
export type SharedMemory={id:string;kind:SharedMemoryKind;originEvent:string;originDay:number;ageDays:number;importance:number;canResurface:boolean;reason:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function classify(event:string):SharedMemoryKind|null{
  if(/proposal|wedding|intimacy|shared-home|couple-routine/i.test(event))return'couple';
  if(/birth|pregnan|children|family|collective-life:children/i.test(event))return'family';
  if(/social-bond|close-circle|collective-life|friend|home-visitor/i.test(event))return'social';
  if(/travel|arrival|holiday|trip/i.test(event))return'travel';
  if(/corrida|feria|taurine|torero/i.test(event))return'taurine';
  if(/marion-home|home-life|shared-home/i.test(event))return'home';
  return null;
}
function importance(event:string){let score=35;if(/proposal|wedding|birth|first|injury|major|collective-life|inner-circle/i.test(event))score+=35;if(/corrida-result|holiday|anniversary|birthday|close-circle/i.test(event))score+=18;if(/routine|visitor|meal|coffee/i.test(event))score-=8;return Math.max(20,Math.min(96,score));}
function parseDay(event:string,fallback:number){const m=event.match(/:(\d{1,6})$/);return m?Math.max(1,Number(m[1])):fallback;}

export function getSharedMemories():SharedMemory[]{
  const s=read();if(!s)return[];const today=n(s.day,1),h=s.eventHistory||[],out:SharedMemory[]=[];const seen=new Set<string>();
  for(let i=h.length-1;i>=0&&out.length<28;i--){const e=String(h[i]||'');const kind=classify(e);if(!kind)continue;const normalized=e.toLowerCase().replace(/:\d+$/,'').replace(/annual-beat:[^:]+:/,'');if(seen.has(normalized))continue;seen.add(normalized);const originDay=parseDay(e,Math.max(1,today-Math.max(1,h.length-i)*7));const ageDays=Math.max(0,today-originDay);const imp=importance(e);const canResurface=ageDays>=45&&imp>=42;out.push({id:`memory-${hash(normalized).toString(36)}`,kind,originEvent:e,originDay,ageDays,importance:imp,canResurface,reason:canResurface?'Ce moment est assez ancien et marquant pour pouvoir revenir naturellement plus tard, sans rejouer la scène.':'Ce moment reste enregistré mais n’a pas besoin de revenir immédiatement.'});}
  return out;
}

export function getResurfacingMemory():SharedMemory|null{
  const s=read();if(!s)return null;const day=n(s.day,1),f=s.flags||{},eligible=getSharedMemories().filter(m=>m.canResurface&&day-n(f[`memory:${m.id}:lastResurfaceDay`],0)>=120);if(!eligible.length)return null;
  const gate=hash(`memory-gate:${Math.floor(day/14)}`)%100;if(gate>=18)return null;return eligible[hash(`memory-pick:${day}:${String(s.place||'')}`)%eligible.length]||null;
}

export function markMemoryResurfaced(id:string){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f[`memory:${id}:lastResurfaceDay`]=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),`memory-resurfaced:${id}:${n(s.day,1)}`].slice(-360);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

export function recordSharedMemory(event:string){const s=read();if(!s)return false;const day=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),`memory-anchor:${event}:${day}`].slice(-360);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

declare global{interface Window{__moniaSharedMemories?:()=>SharedMemory[];__moniaResurfacingMemory?:()=>SharedMemory|null;__moniaMarkMemoryResurfaced?:(id:string)=>boolean;__moniaRecordSharedMemory?:(event:string)=>boolean}}
window.__moniaSharedMemories=getSharedMemories;window.__moniaResurfacingMemory=getResurfacingMemory;window.__moniaMarkMemoryResurfaced=markMemoryResurfaced;window.__moniaRecordSharedMemory=recordSharedMemory;
