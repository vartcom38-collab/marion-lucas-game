const QUEUE_KEY='monia-v16-runtime-requests-v1';
const REQUEST_EVENT='marion-lucas:monia-v16-request';
const READY_EVENT='marion-lucas:monia-v16-ready';
const DISPATCH_URL='./api/monia-v16-voice-dispatch.php';
const STATUS_URL='./api/monia-v16-voice-status.php';

export type LucasV16Intent='neutral'|'warm'|'tender'|'concerned'|'tired'|'amused'|'whisper';
export type LucasV16Request={
  id:string;
  actor:'Lucas';
  text:string;
  intent:LucasV16Intent;
  sceneJobId?:string;
  createdAt:number;
  status:'queued';
  renderer:'scripts/monia_lucas_v16_runtime_voice.py';
  fallback:'forbidden';
};
export type LucasV16Ready={id:string;audioUrl:string;duration:number;text:string;sceneJobId?:string};

function readQueue():LucasV16Request[]{
  try{const raw=sessionStorage.getItem(QUEUE_KEY);return raw?JSON.parse(raw) as LucasV16Request[]:[]}catch{return[]}
}
function writeQueue(queue:LucasV16Request[]){try{sessionStorage.setItem(QUEUE_KEY,JSON.stringify(queue.slice(-20)))}catch{}}
function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return Math.abs(h).toString(36)}
function sleep(ms:number){return new Promise(resolve=>window.setTimeout(resolve,ms))}

export function requestLucasV16(text:string,intent:LucasV16Intent='neutral',sceneJobId?:string){
  const clean=text.trim();
  if(!clean)throw new Error('Lucas V16 request requires non-empty text');
  const id=`v16-${hash(`${clean}|${intent}|${sceneJobId||''}|${Date.now()}`)}`;
  const request:LucasV16Request={id,actor:'Lucas',text:clean,intent,sceneJobId,createdAt:Date.now(),status:'queued',renderer:'scripts/monia_lucas_v16_runtime_voice.py',fallback:'forbidden'};
  const queue=readQueue();queue.push(request);writeQueue(queue);
  window.dispatchEvent(new CustomEvent<LucasV16Request>(REQUEST_EVENT,{detail:request}));
  return request;
}

export function consumeLucasV16Request(id:string){const queue=readQueue();const hit=queue.find(item=>item.id===id)||null;if(hit)writeQueue(queue.filter(item=>item.id!==id));return hit}
export function readLucasV16Requests(){return readQueue()}
export function announceLucasV16Ready(detail:LucasV16Ready){window.dispatchEvent(new CustomEvent<LucasV16Ready>(READY_EVENT,{detail}))}

export async function renderLucasV16(request:LucasV16Request):Promise<LucasV16Ready>{
  const dispatch=await fetch(DISPATCH_URL,{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId:request.id,text:request.text,emotion:request.intent,sceneJobId:request.sceneJobId||null})
  });
  if(!dispatch.ok){const detail=await dispatch.json().catch(()=>null) as any;throw new Error(detail?.error||`V16 dispatch failed · HTTP ${dispatch.status}`)}

  for(let attempt=0;attempt<60;attempt++){
    if(attempt>0)await sleep(2000);
    const status=await fetch(`${STATUS_URL}?id=${encodeURIComponent(request.id)}&t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
    if(status.status===202)continue;
    if(!status.ok){const detail=await status.json().catch(()=>null) as any;throw new Error(detail?.error||`V16 status failed · HTTP ${status.status}`)}
    const data=await status.json() as any;
    const audioUrl=String(data.candidate_url||data.audio_url||data.audioUrl||'').trim();
    const text=String(data.text||'').trim();
    const duration=Number(data.duration||data.seconds||0);
    if(data.state!=='ready'||!audioUrl||!Number.isFinite(duration)||duration<=0)throw new Error('V16 renderer returned an incomplete result');
    if(text!==request.text)throw new Error('V16 renderer returned different dialogue text');
    const ready:LucasV16Ready={id:request.id,audioUrl,duration,text,sceneJobId:request.sceneJobId};
    consumeLucasV16Request(request.id);
    announceLucasV16Ready(ready);
    return ready;
  }
  throw new Error(`V16 runtime render timed out for ${request.id}`);
}

export const LUCAS_V16_REQUEST_EVENT=REQUEST_EVENT;
export const LUCAS_V16_READY_EVENT=READY_EVENT;

console.info('[MonIA] Shared Lucas V16 runtime bridge active · same-origin render dispatch · generic voice fallback forbidden');
