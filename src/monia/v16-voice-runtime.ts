const DISPATCH='/api/monia-v16-voice-dispatch.php';
const STATUS='/api/monia-v16-voice-status.php';
const CACHE_PREFIX='monia-v16-runtime-cache-v1:';

export type LucasV16Emotion='neutral'|'warm'|'amused'|'tender'|'concerned'|'tired'|'whisper';
export type LucasV16RuntimeResult={
  ok:true;state:'ready';request_id:string;text:string;emotion:LucasV16Emotion;duration:number;
  candidate_url:string;voice_id:'lucas-v16-approved-direct-design';candidateOnly:true;canonicalVoicePromotion:false;
};

function normalizeText(text:string){return text.trim().replace(/\s+/g,' ').slice(0,600)}
function hash(value:string){let h1=0x811c9dc5;for(let i=0;i<value.length;i++){h1^=value.charCodeAt(i);h1=Math.imul(h1,0x01000193)}return (h1>>>0).toString(36)}
function requestId(text:string,emotion:LucasV16Emotion){return `v16-${hash(`${normalizeText(text)}|${emotion}|lucas-v16`)}`}
function cacheKey(id:string){return CACHE_PREFIX+id}
function readCache(id:string):LucasV16RuntimeResult|null{try{const raw=sessionStorage.getItem(cacheKey(id));if(!raw)return null;const value=JSON.parse(raw) as LucasV16RuntimeResult;return value?.state==='ready'&&value.request_id===id&&value.voice_id==='lucas-v16-approved-direct-design'&&value.candidate_url?value:null}catch{return null}}
function writeCache(value:LucasV16RuntimeResult){try{sessionStorage.setItem(cacheKey(value.request_id),JSON.stringify(value))}catch{}}
const sleep=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));

export async function renderLucasV16(text:string,emotion:LucasV16Emotion='neutral',signal?:AbortSignal):Promise<LucasV16RuntimeResult>{
  const clean=normalizeText(text);if(!clean)throw new Error('Réplique Lucas vide');
  const id=requestId(clean,emotion);const cached=readCache(id);if(cached&&normalizeText(cached.text)===clean)return cached;
  window.dispatchEvent(new CustomEvent('monia-v16-voice-state',{detail:{state:'dispatching',requestId:id,text:clean,emotion}}));
  const dispatched=await fetch(DISPATCH,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal,body:JSON.stringify({requestId:id,text:clean,emotion})});
  if(!dispatched.ok){const detail=await dispatched.json().catch(()=>({}));throw new Error(String(detail?.error||`V16 dispatch HTTP ${dispatched.status}`))}
  for(let attempt=0;attempt<120;attempt++){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    await sleep(attempt<10?1500:2500);
    const response=await fetch(`${STATUS}?id=${encodeURIComponent(id)}&t=${Date.now()}`,{cache:'no-store',credentials:'same-origin',signal});
    const data=await response.json().catch(()=>null) as any;
    if(response.status===202||data?.state==='processing'){
      window.dispatchEvent(new CustomEvent('monia-v16-voice-state',{detail:{state:'processing',requestId:id,attempt}}));
      continue;
    }
    if(!response.ok||!data?.ok)throw new Error(String(data?.error||`V16 status HTTP ${response.status}`));
    if(data.state!=='ready'||data.request_id!==id||data.voice_id!=='lucas-v16-approved-direct-design'||!data.candidate_url)throw new Error('Résultat V16 incohérent');
    if(normalizeText(String(data.text||''))!==clean)throw new Error('Le texte rendu V16 ne correspond pas à la réplique MonIA');
    const result=data as LucasV16RuntimeResult;writeCache(result);
    window.dispatchEvent(new CustomEvent('monia-v16-voice-state',{detail:{state:'ready',requestId:id,duration:result.duration,url:result.candidate_url}}));
    return result;
  }
  throw new Error('Le rendu V16 n’est pas revenu dans la fenêtre de génération');
}

export function cachedLucasV16(text:string,emotion:LucasV16Emotion='neutral'){return readCache(requestId(normalizeText(text),emotion))}
