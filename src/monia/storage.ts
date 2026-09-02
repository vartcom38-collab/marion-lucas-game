export type MonIAMemory={id:string;kind:'action'|'dialogue'|'event'|'promise';text:string;day:number;time:string;actors:string[];createdAt:number};
export type MonIAMemoryQuery={text?:string;day?:number;actors?:string[];limit?:number};
export interface MonIAStorage{put(memory:MonIAMemory):Promise<void>;recent(limit:number):Promise<MonIAMemory[]>;relevant(query:MonIAMemoryQuery):Promise<MonIAMemory[]>;clear():Promise<void>}

function normalize(value:string){
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

function tokens(value:string){
  const stop=new Set(['avec','dans','pour','mais','plus','comme','elle','lui','les','des','une','que','qui','quoi','est','suis','son','ses','sur','pas','toi','moi','marion','lucas']);
  return new Set(normalize(value).split(/\s+/).filter(t=>t.length>=3&&!stop.has(t)));
}

function scoreMemory(memory:MonIAMemory,query:MonIAMemoryQuery){
  let score=0;
  const wanted=tokens(query.text||'');
  const own=tokens(memory.text);
  wanted.forEach(t=>{if(own.has(t))score+=8;else if(normalize(memory.text).includes(t))score+=3});
  const actors=(query.actors||[]).map(normalize);
  actors.forEach(actor=>{if(memory.actors.some(a=>normalize(a)===actor))score+=6});
  if(typeof query.day==='number'){
    const age=Math.max(0,query.day-memory.day);
    score+=Math.max(0,8-Math.min(age,8));
  }
  if(memory.kind==='promise')score+=10;
  else if(memory.kind==='event')score+=6;
  else if(memory.kind==='dialogue')score+=3;
  const ageMs=Math.max(0,Date.now()-memory.createdAt);
  score+=Math.max(0,4-Math.floor(ageMs/(1000*60*60*24*7)));
  return score;
}

class IndexedDBStorage implements MonIAStorage{
  private dbPromise:Promise<IDBDatabase>|null=null;
  private db(){
    if(this.dbPromise)return this.dbPromise;
    this.dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open('monia-runtime',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('memories'))db.createObjectStore('memories',{keyPath:'id'})};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error)
    });
    return this.dbPromise
  }
  async put(memory:MonIAMemory){const db=await this.db();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('memories','readwrite');tx.objectStore('memories').put(memory);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
  async all(){const db=await this.db();return new Promise<MonIAMemory[]>((resolve,reject)=>{const tx=db.transaction('memories','readonly');const req=tx.objectStore('memories').getAll();req.onsuccess=()=>resolve(req.result as MonIAMemory[]);req.onerror=()=>reject(req.error)})}
  async recent(limit:number){return (await this.all()).sort((a,b)=>b.createdAt-a.createdAt).slice(0,limit)}
  async relevant(query:MonIAMemoryQuery){
    const limit=Math.max(1,Math.min(24,query.limit||10));
    const all=await this.all();
    return all.map(memory=>({memory,score:scoreMemory(memory,query)})).sort((a,b)=>b.score-a.score||b.memory.createdAt-a.memory.createdAt).filter(x=>x.score>0).slice(0,limit).map(x=>x.memory)
  }
  async clear(){const db=await this.db();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('memories','readwrite');tx.objectStore('memories').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
}
export const moniaStorage:MonIAStorage=new IndexedDBStorage();
