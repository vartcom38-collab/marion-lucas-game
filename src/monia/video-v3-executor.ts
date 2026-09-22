import {registerCandidateResult,selectBestReviewCandidate,type VideoJob,type VideoCandidate} from '../monia-video-orchestrator';

const API='/api/monia-kaggle-dispatch.php';
const ACTIVE='monia-video-v3-active';
const STATUS='/api/monia-video-status.php';
export type V3Execution={jobId:string;state:'queued'|'dispatching'|'generating'|'candidate-ready'|'regenerating'|'review'|'failed';candidateId?:string;detail?:string;updatedAt:number};

function emit(s:V3Execution){try{sessionStorage.setItem(ACTIVE,JSON.stringify(s))}catch{};window.dispatchEvent(new CustomEvent('monia:video-v3-state',{detail:s}))}
function repairDirectives(reasons:string[]){
 const text=reasons.join(' ').toLowerCase();const add:string[]=[];
 if(/identity|mismatch|face|age|person/.test(text))add.push('Increase canonical identity lock. Reduce head rotation and expression amplitude. Keep face geometry, age, hair, jaw, nose, mouth and skin exactly bound to references.');
 if(/temporal|morph|jitter|flicker|inconsisten/.test(text))add.push('Reduce motion amplitude and camera motion. Preserve facial geometry frame-to-frame; no morphing or gaze jumps.');
 if(/eye|iris|pupil|blink/.test(text))add.push('Lock eye geometry, iris and pupil shape. Use stable natural gaze and minimal blinking.');
 if(/wardrobe|cloth|outfit/.test(text))add.push('Lock exact current wardrobe, fabric, neckline, sleeves and accessories from continuity.');
 if(/continuity|location|lighting|camera/.test(text))add.push('Use previous validated frame as visual continuity authority. Preserve room geometry, actor positions, eyelines, lighting and camera side.');
 if(/hand|finger/.test(text))add.push('Keep hands outside critical framing unless required; when visible use restrained anatomically plausible motion.');
 return add;
}
function gpuPayload(job:VideoJob,c:VideoCandidate,attempt=0,previousReasons:string[]=[]){
 const repairs=repairDirectives(previousReasons);
 return {...job,id:c.id,candidates:undefined,prefetch:undefined,
  prompt:[job.prompt,...repairs].filter(Boolean).join(' '),
  continuity:{...job.continuity,repairAttempt:attempt,repairReasons:previousReasons},
  generation:{...job.generation,selectedBackend:c.backend,candidateCount:1,repairAttempt:attempt,
   seed:Number(job.generation.seed||0)+attempt*7919,
   previousValidatedFrameUrl:job.continuity?.previousValidatedFrameUrl||null},
  candidateOnly:true,narrativeAuthority:false};
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

async function dispatch(job:VideoJob,c:VideoCandidate,attempt=0,previousReasons:string[]=[]){
 c.state='queued';emit({jobId:job.id,candidateId:c.id,state:'dispatching',updatedAt:Date.now()});
 const res=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({job:gpuPayload(job,c,attempt,previousReasons)})});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||body?.ok!==true)throw new Error(body?.error||`dispatch HTTP ${res.status}`);
 c.state='generating';emit({jobId:job.id,candidateId:c.id,state:'generating',detail:String(body.state||'queued'),updatedAt:Date.now()});
 return waitForCandidate(job,c);
}
export async function executeVideoV3Job(job:VideoJob){
 const candidates=job.candidates.filter(c=>c.backend!=='validated-cache');
 if(!candidates.length)throw new Error('No generation candidate available');
 emit({jobId:job.id,state:'queued',updatedAt:Date.now()});
 let last:unknown;let previousReasons:string[]=[];
 for(let i=0;i<candidates.length;i++){
  const c=candidates[i];
  if(i>0)emit({jobId:job.id,candidateId:c.id,state:'regenerating',detail:previousReasons.join(' · ')||'fallback candidate',updatedAt:Date.now()});
  try{
   const result=await dispatch(job,c,i,previousReasons);
   if(c.state==='quality-rejected'||c.state==='technical-rejected'){
    previousReasons=[...c.rejections];last=new Error(previousReasons.join('; ')||'candidate rejected');continue;
   }
   return result;
  }catch(e){
   last=e;c.state='technical-rejected';c.rejections.push(e instanceof Error?e.message:String(e));previousReasons=[...c.rejections];
  }
 }
 const detail=last instanceof Error?last.message:String(last||'all candidates rejected');
 emit({jobId:job.id,state:'failed',detail,updatedAt:Date.now()});throw last;
}
export function installVideoV3Executor(){
 window.addEventListener('monia:video-job-ready',((e:CustomEvent)=>{const job=e.detail?.job as VideoJob|undefined;if(!job)return;void executeVideoV3Job(job).catch(err=>console.error('[MonIA Video V3]',err))}) as EventListener);
}
