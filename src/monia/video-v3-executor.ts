import type {VideoJob,VideoCandidate} from '../monia-video-orchestrator';

const API='/api/monia-kaggle-dispatch.php';
const ACTIVE='monia-video-v3-active';
export type V3Execution={jobId:string;state:'queued'|'dispatching'|'generating'|'candidate-ready'|'review'|'failed';candidateId?:string;detail?:string;updatedAt:number};

function emit(s:V3Execution){try{sessionStorage.setItem(ACTIVE,JSON.stringify(s))}catch{};window.dispatchEvent(new CustomEvent('monia:video-v3-state',{detail:s}))}
function gpuPayload(job:VideoJob,c:VideoCandidate){
 return {...job,id:c.id,candidates:undefined,prefetch:undefined,generation:{...job.generation,selectedBackend:c.backend,candidateCount:1},candidateOnly:true,narrativeAuthority:false};
}
async function dispatch(job:VideoJob,c:VideoCandidate){
 c.state='queued';emit({jobId:job.id,candidateId:c.id,state:'dispatching',updatedAt:Date.now()});
 const res=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({job:gpuPayload(job,c)})});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||body?.ok!==true)throw new Error(body?.error||`dispatch HTTP ${res.status}`);
 c.state='generating';emit({jobId:job.id,candidateId:c.id,state:'generating',detail:String(body.state||'queued'),updatedAt:Date.now()});
 return body;
}
export async function executeVideoV3Job(job:VideoJob){
 const candidates=job.candidates.filter(c=>c.backend!=='validated-cache');
 if(!candidates.length)throw new Error('No generation candidate available');
 emit({jobId:job.id,state:'queued',updatedAt:Date.now()});
 // Spend-free policy: dispatch one candidate first. Additional candidates only after failure/rejection.
 let last:unknown;
 for(const c of candidates){
  try{return await dispatch(job,c)}catch(e){last=e;c.state='technical-rejected';c.rejections.push(e instanceof Error?e.message:String(e))}
 }
 const detail=last instanceof Error?last.message:String(last||'dispatch failed');emit({jobId:job.id,state:'failed',detail,updatedAt:Date.now()});throw last;
}
export function installVideoV3Executor(){
 window.addEventListener('monia:video-job-ready',((e:CustomEvent)=>{const job=e.detail?.job as VideoJob|undefined;if(!job)return;void executeVideoV3Job(job).catch(err=>console.error('[MonIA Video V3]',err))}) as EventListener);
}
