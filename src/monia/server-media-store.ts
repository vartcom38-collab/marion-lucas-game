import type { MonIAMediaPlan } from './media-orchestrator';
import { mediaCacheKey } from './media-cache';

const ENDPOINT='./api/monia-media-store.php';
const QUEUE_KEY='monia-server-media-pending-v1';
let tokenPromise:Promise<string|null>|null=null;
let flushing=false;

type Pending={sourceUrl:string;key:string;kind:'image'|'video';attempts:number;nextAt:number};

function readQueue():Pending[]{try{const raw=localStorage.getItem(QUEUE_KEY);const data=raw?JSON.parse(raw):[];return Array.isArray(data)?data.slice(0,24):[]}catch{return []}}
function writeQueue(items:Pending[]){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(items.slice(0,24)))}catch{}}
function enqueue(item:Omit<Pending,'attempts'|'nextAt'>){
  const items=readQueue().filter(x=>!(x.sourceUrl===item.sourceUrl&&x.kind===item.kind));
  items.push({...item,attempts:0,nextAt:Date.now()+30_000});writeQueue(items);
}

async function token(){
  if(tokenPromise)return tokenPromise;
  tokenPromise=(async()=>{
    try{const response=await fetch(ENDPOINT,{method:'GET',credentials:'same-origin',cache:'no-store'});if(!response.ok)return null;const data=await response.json();return typeof data?.token==='string'?data.token:null}catch{return null}
  })();
  const value=await tokenPromise;if(!value)tokenPromise=null;return value;
}

async function send(sourceUrl:string,key:string,kind:'image'|'video'){
  if(!sourceUrl||sourceUrl.startsWith(location.origin)||sourceUrl.startsWith('/'))return sourceUrl;
  const csrf=await token();if(!csrf)return null;
  try{
    const response=await fetch(ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:csrf,sourceUrl,key,kind})});
    if(response.status===403){tokenPromise=null;return null}
    if(!response.ok)return null;
    const data=await response.json();return typeof data?.url==='string'&&data.url?data.url:null;
  }catch{return null}
}

async function persistOne(sourceUrl:string,key:string,kind:'image'|'video'){
  if(!sourceUrl||sourceUrl.startsWith(location.origin)||sourceUrl.startsWith('/'))return sourceUrl;
  const stored=await send(sourceUrl,key,kind);
  if(stored)return stored;
  enqueue({sourceUrl,key,kind});
  return sourceUrl;
}

async function flushQueue(){
  if(flushing||document.hidden||!navigator.onLine)return;
  flushing=true;
  try{
    const now=Date.now(),keep:Pending[]=[];
    for(const item of readQueue()){
      if(item.nextAt>now){keep.push(item);continue}
      const stored=await send(item.sourceUrl,item.key,item.kind);
      if(!stored&&item.attempts<5){const attempts=item.attempts+1;keep.push({...item,attempts,nextAt:Date.now()+Math.min(15*60_000,30_000*Math.pow(2,attempts))})}
    }
    writeQueue(keep);
  }finally{flushing=false}
}

export async function persistGeneratedMedia(plan:MonIAMediaPlan,imageUrl:string,videoUrl:string){
  const key=mediaCacheKey(plan);
  const [storedImageUrl,storedVideoUrl]=await Promise.all([persistOne(imageUrl,`${key}|image`,'image'),persistOne(videoUrl,`${key}|video`,'video')]);
  return {imageUrl:storedImageUrl,videoUrl:storedVideoUrl,persisted:storedImageUrl!==imageUrl||storedVideoUrl!==videoUrl};
}

window.setInterval(()=>{void flushQueue()},45_000);
window.addEventListener('online',()=>{void flushQueue()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void flushQueue()});
