import type { MonIAMediaPlan } from './media-orchestrator';
import { mediaCacheKey } from './media-cache';

const ENDPOINT='./api/monia-media-store.php';
const QUEUE_KEY='monia-server-media-pending-v1';
const HEALTH_KEY='monia-server-media-health-v1';
let tokenPromise:Promise<string|null>|null=null;
let flushing=false;

type Pending={sourceUrl:string;key:string;kind:'image'|'video';attempts:number;nextAt:number};
export type MediaStoreHealth={ok:boolean;checkedAt:number;detail:string};

function readQueue():Pending[]{try{const raw=localStorage.getItem(QUEUE_KEY);const data=raw?JSON.parse(raw):[];return Array.isArray(data)?data.slice(0,24):[]}catch{return []}}
function writeQueue(items:Pending[]){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(items.slice(0,24)))}catch{}}
function writeHealth(value:MediaStoreHealth){try{localStorage.setItem(HEALTH_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-media-store-health',{detail:value}))}catch{}}
export function getMediaStoreHealth():MediaStoreHealth|null{try{const raw=localStorage.getItem(HEALTH_KEY);return raw?JSON.parse(raw) as MediaStoreHealth:null}catch{return null}}
function enqueue(item:Omit<Pending,'attempts'|'nextAt'>){
  const items=readQueue().filter(x=>!(x.sourceUrl===item.sourceUrl&&x.kind===item.kind));
  items.push({...item,attempts:0,nextAt:Date.now()+30_000});writeQueue(items);
}

async function token(){
  if(tokenPromise)return tokenPromise;
  tokenPromise=(async()=>{
    try{
      const response=await fetch(ENDPOINT,{method:'GET',credentials:'same-origin',cache:'no-store'});
      if(!response.ok){writeHealth({ok:false,checkedAt:Date.now(),detail:`HTTP ${response.status}`});return null}
      const data=await response.json();
      const value=typeof data?.token==='string'?data.token:null;
      writeHealth({ok:Boolean(value),checkedAt:Date.now(),detail:value?'PHP Infomaniak prêt':'réponse JSON sans jeton'});
      return value;
    }catch(error){writeHealth({ok:false,checkedAt:Date.now(),detail:error instanceof Error?error.message:String(error)});return null}
  })();
  const value=await tokenPromise;if(!value)tokenPromise=null;return value;
}

export async function checkMediaStoreHealth(force=false):Promise<MediaStoreHealth>{
  const previous=getMediaStoreHealth();
  if(!force&&previous&&Date.now()-previous.checkedAt<5*60_000)return previous;
  if(force)tokenPromise=null;
  const value=await token();
  return getMediaStoreHealth()||{ok:Boolean(value),checkedAt:Date.now(),detail:value?'PHP Infomaniak prêt':'stockage indisponible'};
}

async function send(sourceUrl:string,key:string,kind:'image'|'video'){
  if(!sourceUrl||sourceUrl.startsWith(location.origin)||sourceUrl.startsWith('/'))return sourceUrl;
  const csrf=await token();if(!csrf)return null;
  try{
    const response=await fetch(ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:csrf,sourceUrl,key,kind})});
    if(response.status===403){tokenPromise=null;writeHealth({ok:false,checkedAt:Date.now(),detail:'jeton serveur refusé'});return null}
    if(!response.ok){writeHealth({ok:false,checkedAt:Date.now(),detail:`sauvegarde HTTP ${response.status}`});return null}
    const data=await response.json();
    const stored=typeof data?.url==='string'&&data.url?data.url:null;
    if(stored)writeHealth({ok:true,checkedAt:Date.now(),detail:'stockage média Infomaniak opérationnel'});
    return stored;
  }catch(error){writeHealth({ok:false,checkedAt:Date.now(),detail:error instanceof Error?error.message:String(error)});return null}
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
window.setInterval(()=>{void checkMediaStoreHealth()},5*60_000);
window.addEventListener('online',()=>{void checkMediaStoreHealth(true);void flushQueue()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){void checkMediaStoreHealth();void flushQueue()}});
void checkMediaStoreHealth(true);
