import {registerCandidateResult,selectBestReviewCandidate,type VideoJob,type VideoCandidate} from '../monia-video-orchestrator';

const API='/api/monia-kaggle-dispatch.php';
const ACTIVE='monia-video-v3-active';
const STATUS='/api/monia-video-status.php';
export type V3Execution={jobId:string;state:'queued'|'dispatching'|'generating'|'candidate-ready'|'review'|'failed';candidateId?:string;detail?:string;updatedAt:number};

function emit(s:V3Execution){try{sessionStorage.setItem(ACTIVE,JSON.stringify(s))}catch{};window.dispatchEvent(new CustomEvent('monia:video-v3-state',{detail:s}))}
function gpuPayload(job:VideoJob,c:VideoCandidate){
 return {...job,id:c.id,candidates:undefined,prefetch:undefined,generation:{...job.generation,selectedBackend:c.backend,candidateCount:1},candidateOnly:true,narrativeAuthority:false};
}

const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function waitForCandidate(job:VideoJob,c:VideoCandidate){
 for(let attempt=0;attempt<180;attempt++){
  await sleep(attempt<12?5000:15000);
  const r=await fetch(`${STATUS}?id=${encodeURIComponent(c.id)}&t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'}).catch(()=>null);
  if(!r)continue;
  if(r.status===202)continue;
  const body=await r.json().catch(()=>null);
  if(!r.ok||!body?.ok)continue;
  if(body.state==='candidate'&&Array.isArray(body.clips)&&body.clips.length){
   const safe=body.candidateOnly===true&&body.narrativeAuthority===true;
   const result=body.result||{};const q=body.quality||null;
   const technicalPass=safe&&result.state==='candidate'&&q?.technicalPass!==false;
   const identity=q?.identityScore;const temporal=q?.temporalIdentityScore;
   const measuredPass=typeof identity==='number'&&typeof temporal==='number'
     ? identity>=Number(job.qualityGate.minimumIdentityScore||.94)&&temporal>=Number(job.qualityGate.minimumTemporalIdentityScore||.92)
     : undefined;
   const qualityPass=q?.autoReject===true?false:measuredPass;
   const rejections=[...(q?.reasons||[]),...(!safe?['candidate safety flags invalid']:[])];
   registerCandidateResult(job,{candidateId:c.id,url:body.clips[0],technicalPass,qualityPass,score:typeof identity==='number'?identity:undefined,rejections});
   if(body.continuityLastFrame){
    job.continuity={...job.continuity,previousValidatedFrameUrl:body.continuityLastFrame,sourceCandidateId:c.id};
    window.dispatchEvent(new CustomEvent('monia:video-continuity-frame',{detail:{jobId:job.id,candidateId:c.id,url:body.continuityLastFrame}}));
   }
   emit({jobId:job.id,candidateId:c.id,state:'candidate-ready',detail:body.clips[0],updatedAt:Date.now()});
   const review=selectBestReviewCandidate(job);
   if(review)emit({jobId:job.id,candidateId:review.id,state:'review',detail:review.url,updatedAt:Date.now()});
   window.dispatchEvent(new CustomEvent('monia:video-review-required',{detail:{job,candidate:review||c,clips:body.clips,qualityPolicy:job.qualityGate}}));
   return body;
  }
 }
 throw new Error('candidate polling timeout');
}

async function dispatch(job:VideoJob,c:VideoCandidate){
 c.state='queued';emit({jobId:job.id,candidateId:c.id,state:'dispatching',updatedAt:Date.now()});
 const res=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({job:gpuPayload(job,c)})});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||body?.ok!==true)throw new Error(body?.error||`dispatch HTTP ${res.status}`);
 c.state='generating';emit({jobId:job.id,candidateId:c.id,state:'generating',detail:String(body.state||'queued'),updatedAt:Date.now()});
 return waitForCandidate(job,c);
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
