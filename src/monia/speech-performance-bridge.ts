const DISPATCH_URL='./api/monia-speech-performance-dispatch.php';
const STATUS_URL='./api/monia-speech-performance-status.php';

export type MonIASpeechPerformanceRequest={
  id:string;
  videoUrl:string;
  audioUrl:string;
  sceneJobId:string;
  engine:'musetalk-v1.5';
  candidateOnly:true;
  canonicalPromotion:false;
};

export type MonIASpeechPerformanceReady={
  id:string;
  videoUrl:string;
  engine:'musetalk-v1.5';
  sceneJobId:string;
  avGate?:unknown;
  phonemePerfectClaim:false;
};

function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return Math.abs(h).toString(36)}
function sleep(ms:number){return new Promise(resolve=>window.setTimeout(resolve,ms))}

export function buildSpeechPerformanceRequest(videoUrl:string,audioUrl:string,sceneJobId:string):MonIASpeechPerformanceRequest{
  const cleanVideo=videoUrl.trim(),cleanAudio=audioUrl.trim();
  if(!cleanVideo||!cleanAudio)throw new Error('Speech performance requires video and V16 audio');
  return {id:`speech-${hash(`${cleanVideo}|${cleanAudio}|${sceneJobId}|${Date.now()}`)}`,videoUrl:cleanVideo,audioUrl:cleanAudio,sceneJobId,engine:'musetalk-v1.5',candidateOnly:true,canonicalPromotion:false};
}

export async function renderSpeechPerformance(request:MonIASpeechPerformanceRequest):Promise<MonIASpeechPerformanceReady>{
  const dispatch=await fetch(DISPATCH_URL,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  if(!dispatch.ok){const detail=await dispatch.json().catch(()=>null) as any;throw new Error(detail?.error||`speech-performance dispatch failed · HTTP ${dispatch.status}`)}
  for(let attempt=0;attempt<90;attempt++){
    if(attempt>0)await sleep(5000);
    const status=await fetch(`${STATUS_URL}?id=${encodeURIComponent(request.id)}&t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
    if(status.status===202)continue;
    if(!status.ok){const detail=await status.json().catch(()=>null) as any;throw new Error(detail?.error||`speech-performance status failed · HTTP ${status.status}`)}
    const data=await status.json() as any;
    const videoUrl=String(data.videoUrl||'').trim();
    if(data.state!=='ready'||!videoUrl||data.engine!=='musetalk-v1.5'||data.phonemePerfectClaim!==false)throw new Error('speech-performance result incomplete');
    return {id:request.id,videoUrl,engine:'musetalk-v1.5',sceneJobId:request.sceneJobId,avGate:data.avGate,phonemePerfectClaim:false};
  }
  throw new Error(`speech-performance timed out for ${request.id}`);
}

console.info('[MonIA] Audio-driven speech performance bridge active · MuseTalk 1.5 candidate-only');
