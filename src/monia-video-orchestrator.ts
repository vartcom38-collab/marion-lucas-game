import type {MoniaWorldState} from './monia-world-state';

export type VideoRequestV3={
 schema:'monia-video-request-v3';runId:string;sceneId:string;beatId:string;
 story:{day:number;time:string;phase:string;location?:string};
 characters:Array<{name:string;outfitId?:string|null;canonicalIdentityRequired:boolean}>;
 cameraCandidates:string[];durationTargetSeconds:[number,number];
 shotGrammar?:{shotSize?:'extreme-closeup'|'closeup'|'medium-closeup'|'medium'|'medium-wide'|'wide';angle?:string;principalIntent?:string;cutIntent?:string;sequenceIndex?:number;sequenceLength?:number};
 staging?:{characters:Array<{name:string;screenSide?:string;posture?:string;gazeTarget?:string;gesture?:string;emotion?:string;distance?:string}>;interaction?:string};
 continuity:{token:any;location?:string;outfitMarion?:string|null;outfitDominic?:string|null};
 quality:{candidateOnly:boolean;requireIdentity:boolean;requireEyeStability:boolean;requireTemporalStability:boolean;requireWardrobeContinuity:boolean};
 prefetch:string[];
};

export type VideoBackend='validated-cache'|'hf-zerogpu'|'kaggle-ltx'|'future-reference-video-backend';
export type CandidateState='planned'|'queued'|'generating'|'technical-rejected'|'quality-rejected'|'human-review'|'approved'|'cached'|'live';

export type VideoCandidate={
 id:string;backend:VideoBackend;state:CandidateState;purpose:'primary'|'prefetch';
 branchId?:string;score?:number;url?:string;rejections:string[];
};

export type VideoJob={
 id:string;candidateOnly:true;narrativeAuthority:false;schemaVersion:3;
 sourceRequest:VideoRequestV3;primaryCharacter:string;characters:any[];
 prompt:string;negativePrompt:string;generation:any;qualityGate:any;continuity:any;
 candidates:VideoCandidate[];prefetch:any[];
};

const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
const identity=(name:string)=>name.toLowerCase()==='dominic'?'lucas':name.toLowerCase();
const characterPack=(c:VideoRequestV3['characters'][number])=>{
 const id=identity(c.name);
 if(id==='marion')return{id,authority:'config/marion-multiview-canon.json',qa:'config/marion-video-identity-qa.json',outfitId:c.outfitId||null};
 return{id:'lucas',authority:'config/lucas-reference-bank.json',multiview:'config/dominic-multiview-canon-v2.json',directPack:'config/dominic-direct-reference-pack-v3.json',motionBank:'config/motion-reference-bank.json',outfitId:c.outfitId||null};
};

export const chooseVideoBackends=(r:VideoRequestV3):VideoBackend[]=>{
 // Approved cache wins when continuity/context match. Generation remains replaceable behind this router.
 const order:VideoBackend[]=['validated-cache'];
 const front=r.cameraCandidates.some(x=>/front|visio|selfie/i.test(x));
 // Primary free compute path: public ZeroGPU image-to-video providers. Kaggle remains a fallback.
 order.push('hf-zerogpu');
 order.push('kaggle-ltx');
 if(!front)order.push('future-reference-video-backend');
 return order;
};

const qualityChecks=(r:VideoRequestV3)=>[
 'true-video','canonical-identity','eyes','temporal-face-stability','wardrobe',
 'hands-when-visible','location','lighting','camera-contract','artifact-free',
 ...(r.characters.some(c=>identity(c.name)==='lucas')?['lucas-canonical-tattoos-when-visible']:[])
];

export const buildVideoJob=(r:VideoRequestV3,w:MoniaWorldState):VideoJob=>{
 const names=r.characters.map(x=>x.name).join(' and ');
 const requestedCamera=r.cameraCandidates[0]||'cinematic';
 const camera=/front|visio|selfie|handheld-by-character/i.test(requestedCamera)?'external cinematic observer camera; nobody holds, touches or looks into the camera':requestedCamera;
 const shot=r.shotGrammar||{};
 const duration:[number,number]=[Math.max(2,Math.min(5,r.durationTargetSeconds?.[0]??2)),Math.max(2,Math.min(5,r.durationTargetSeconds?.[1]??5))];
 const backends=chooseVideoBackends(r);
 const base=`v3-${slug(r.sceneId)}-${slug(r.beatId)}-${w.clock.dayIndex}-${w.clock.time.replace(':','')}`;
 const staging=(r.staging?.characters||[]).map(x=>`${x.name}: screen=${x.screenSide||'preserve'}, posture=${x.posture||'natural'}, gaze=${x.gazeTarget||'contextual'}, gesture=${x.gesture||'subtle'}, emotion=${x.emotion||'contextual'}, distance=${x.distance||'contextual'}`).join(' | ');
 const prompt=`Photorealistic cinematic micro-shot in ${r.story.location||'Nîmes'}. Shot size: ${shot.shotSize||'medium'}. Angle: ${shot.angle||camera}. Principal intention: ${shot.principalIntent||'one restrained natural action or reaction only'}. Cut intent: ${shot.cutIntent||'end on a clean natural editorial cut'}. This is shot ${(shot.sequenceIndex??0)+1}${shot.sequenceLength?` of ${shot.sequenceLength}`:''}; do not perform actions belonging to other shots.  ${names} are the canonical people from bound identity references. Camera grammar: ${camera}. Blocking authority: ${staging||'natural lived blocking'}. Interaction authority: ${r.staging?.interaction||'natural independent body language'}. Natural full-body lived action with meaningful pose change and interaction with the environment, stable facial anatomy and gaze, physically plausible posture, coherent light/environment, exact wardrobe and identity continuity. The camera is an external invisible observer: no character holds the camera, no selfie, no phone-as-camera, no direct-to-lens performance. One principal action, reaction, look, gesture or spoken intention only. Preserve the exact beginning state long enough to read the shot, perform that single intention naturally, then settle into a clean cut point. Never compress a whole scene into this clip; never a montage, slideshow, advertisement, stylized clip or animated still.`;
 const candidates:VideoCandidate[]=backends.filter(x=>x!=='validated-cache').slice(0,2).map((backend,i)=>({id:`${base}-c${i+1}`,backend,state:'planned',purpose:'primary',rejections:[]}));
 const prefetch=(r.prefetch||[]).slice(0,3).map((branchId,i)=>({id:`${base}-prefetch-${i+1}`,branchId,priority:i+1,candidateOnly:true,narrativeAuthority:false,continuity:r.continuity,status:'planned'}));
 return {
  id:base,candidateOnly:true,narrativeAuthority:false,schemaVersion:3,sourceRequest:r,
  primaryCharacter:identity(r.characters[0]?.name||'Marion'),characters:r.characters.map(characterPack),
  prompt,
  negativePrompt:'identity drift, different person, face morphing, facial jitter, eye drift, crossed eyes, asymmetric eyes, malformed iris, malformed pupils, eyelid warping, gaze jump, repeated blink, plastic skin, mouth deformation, bad teeth, hand deformation, extra fingers, body morphing, wardrobe change, hairstyle change, temporal flicker, camera jump, selfie, character holding camera, arm extended toward camera, phone filming, direct-to-lens vlog, static pose, animated still, text, captions, logo, watermark, illustration, CGI look',
  generation:{staging:r.staging||null,shotGrammar:shot,durationTargetSeconds:duration,editingUnit:'cinematic-micro-shot',router:'auto-v3',backendOrder:backends,selectionMode:'quality-first',candidateCount:candidates.length,width:768,height:448,frames:49,steps:12,fps:12,seed:w.seed,cameraCandidates:r.cameraCandidates},
  qualityGate:{required:true,policy:'config/monia-generation-quality.json',
      referenceLibraryRouter:'config/monia-reference-library-router-v1.json',humanApprovalBeforeLive:true,failClosed:true,checks:qualityChecks(r),minimumIdentityScore:.94,minimumTemporalIdentityScore:.92},
  continuity:r.continuity,candidates,prefetch
 };
};

export type CinematicMicroShot={shotSize:NonNullable<VideoRequestV3['shotGrammar']>['shotSize'];angle:string;principalIntent:string;cutIntent:string};

export const planCinematicCoverage=(intent:string,characters:string[]):CinematicMicroShot[]=>{
 const conversation=characters.length>1;
 const shots:CinematicMicroShot[]=[
  {shotSize:'medium',angle:'external observer, stable establishing angle',principalIntent:intent,cutIntent:'cut after the principal action settles'},
  {shotSize:'closeup',angle:'clean reaction angle',principalIntent:'one subtle facial reaction to the immediately preceding beat',cutIntent:'cut on settled gaze or breath'}
 ];
 if(conversation)shots.push(
  {shotSize:'medium-closeup',angle:'over-shoulder on the current speaker, preserve screen direction',principalIntent:'one short spoken or listening intention only',cutIntent:'cut at the end of the line or listening reaction'},
  {shotSize:'closeup',angle:'reverse reaction angle across the same axis',principalIntent:'listener reaction only; no extra action',cutIntent:'cut on eyes, breath or restrained expression'}
 );
 shots.push({shotSize:'medium-wide',angle:'external observer, same scene axis',principalIntent:'one restrained body movement or environmental interaction',cutIntent:'clean movement completion for editorial transition'});
 return shots;
};

export const buildMicroShotSequence=(r:VideoRequestV3,w:MoniaWorldState,intent:string)=>{
 const coverage=planCinematicCoverage(intent,r.characters.map(c=>c.name));
 return coverage.map((shot,i)=>buildVideoJob({...r,beatId:`${r.beatId}-shot-${i+1}`,durationTargetSeconds:[2,5],shotGrammar:{...shot,sequenceIndex:i,sequenceLength:coverage.length}},w));
};

export const queueVideoJob=(job:VideoJob)=>{
 const detail={job,dispatchType:'monia_video_v3',jobId:job.id,candidateOnly:true};
 window.dispatchEvent(new CustomEvent('monia:video-job-ready',{detail}));
 job.prefetch.forEach(item=>window.dispatchEvent(new CustomEvent('monia:video-prefetch-planned',{detail:{parentJobId:job.id,...item}})));
 return detail;
};

export const registerCandidateResult=(job:VideoJob,result:{candidateId:string;url?:string;technicalPass:boolean;qualityPass?:boolean;score?:number;rejections?:string[]})=>{
 const c=job.candidates.find(x=>x.id===result.candidateId);if(!c)return null;
 c.url=result.url;c.score=result.score;c.rejections=result.rejections||[];
 c.state=!result.technicalPass?'technical-rejected':result.qualityPass===false?'quality-rejected':'human-review';
 window.dispatchEvent(new CustomEvent('monia:video-candidate-updated',{detail:{jobId:job.id,candidate:c}}));
 return c;
};

export const selectBestReviewCandidate=(job:VideoJob)=>{
 const eligible=job.candidates.filter(c=>c.state==='human-review'&&c.url);
 return eligible.sort((a,b)=>(b.score??-1)-(a.score??-1))[0]||null;
};

export const approveCandidate=(job:VideoJob,candidateId:string)=>{
 const c=job.candidates.find(x=>x.id===candidateId);if(!c||c.state!=='human-review'||!c.url)return null;
 c.state='approved';
 if(job.continuity?.candidateSourceId===c.id&&job.continuity?.candidateLastFrameUrl){
  job.continuity={...job.continuity,previousValidatedFrameUrl:job.continuity.candidateLastFrameUrl,sourceCandidateId:c.id,candidateLastFrameUrl:null,candidateSourceId:null};
  window.dispatchEvent(new CustomEvent('monia:video-continuity-frame',{detail:{jobId:job.id,candidateId:c.id,url:job.continuity.previousValidatedFrameUrl,validated:true}}));
 }
 window.dispatchEvent(new CustomEvent('monia:video-approved',{detail:{jobId:job.id,candidate:c,continuity:job.continuity}}));
 return c;
};

export const handleVideoRequest=(r:VideoRequestV3,w:MoniaWorldState)=>queueVideoJob(buildVideoJob(r,w));
