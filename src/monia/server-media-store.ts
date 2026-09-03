import type { MonIAMediaPlan } from './media-orchestrator';
import { mediaCacheKey } from './media-cache';

const ENDPOINT='./api/monia-media-store.php';
let tokenPromise:Promise<string|null>|null=null;

async function token(){
  if(tokenPromise)return tokenPromise;
  tokenPromise=(async()=>{
    try{
      const response=await fetch(ENDPOINT,{method:'GET',credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return null;
      const data=await response.json();
      return typeof data?.token==='string'?data.token:null;
    }catch{return null}
  })();
  const value=await tokenPromise;
  if(!value)tokenPromise=null;
  return value;
}

async function persistOne(sourceUrl:string,key:string,kind:'image'|'video'){
  if(!sourceUrl||sourceUrl.startsWith(location.origin)||sourceUrl.startsWith('/'))return sourceUrl;
  const csrf=await token();
  if(!csrf)return sourceUrl;
  try{
    const response=await fetch(ENDPOINT,{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token:csrf,sourceUrl,key,kind}),
    });
    if(response.status===403){tokenPromise=null;return sourceUrl}
    if(!response.ok)return sourceUrl;
    const data=await response.json();
    return typeof data?.url==='string'&&data.url?data.url:sourceUrl;
  }catch{return sourceUrl}
}

export async function persistGeneratedMedia(plan:MonIAMediaPlan,imageUrl:string,videoUrl:string){
  const key=mediaCacheKey(plan);
  const [storedImageUrl,storedVideoUrl]=await Promise.all([
    persistOne(imageUrl,`${key}|image`,'image'),
    persistOne(videoUrl,`${key}|video`,'video'),
  ]);
  return {
    imageUrl:storedImageUrl,
    videoUrl:storedVideoUrl,
    persisted:storedImageUrl!==imageUrl||storedVideoUrl!==videoUrl,
  };
}
