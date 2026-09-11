import { moniaCreativeVault } from './creative-vault';
import { learnSurpriseTrustFromHumanApproval, surpriseGate, type SurpriseCandidateFacts } from './surprise-approval';
import { enqueueApprovedSurpriseScene } from './surprise-delivery';

const CANDIDATE_KEY='monia-assembled-scene-candidate-v1';
const REVIEW_KEY='monia-assembled-scene-review-v1';

export type AssembledSceneCandidate={
  id:string;
  jobId:string;
  route:string;
  continuityKey:string;
  videoUrl:string;
  createdAt:number;
  status:'candidate';
  approvalRequired:true;
  autoPublish:false;
  shotIds:string[];
  metadata?:Record<string,string|number|boolean|null>;
};

export type AssembledSceneReview={
  candidateId:string;
  decision:'pending'|'approved'|'rejected';
  updatedAt:number;
  checks:{
    lucasIdentity:boolean;
    marionIdentity:boolean;
    continuity:boolean;
    wardrobe:boolean;
    location:boolean;
    motion:boolean;
    canon:boolean;
    completeAssembly:boolean;
  };
  notes:string;
};

function readJson<T>(key:string):T|null{
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:null}catch{return null}
}
function writeJson(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* optional */}}
function boolMeta(candidate:AssembledSceneCandidate,key:string){return candidate.metadata?.[key]===true}

function factsFromCandidate(candidate:AssembledSceneCandidate):SurpriseCandidateFacts{
  return{
    route:candidate.route,
    completeAssembly:boolMeta(candidate,'completeAssembly'),
    lucasIdentity:boolMeta(candidate,'lucasIdentity'),
    marionIdentity:boolMeta(candidate,'marionIdentity'),
    continuity:boolMeta(candidate,'continuity'),
    wardrobe:boolMeta(candidate,'wardrobe'),
    location:boolMeta(candidate,'location'),
    motion:boolMeta(candidate,'motion'),
    canon:boolMeta(candidate,'canon'),
    qualityVerified:boolMeta(candidate,'qualityVerified'),
    usesNewIdentityMethod:boolMeta(candidate,'usesNewIdentityMethod'),
    usesNewVoiceIdentity:boolMeta(candidate,'usesNewVoiceIdentity'),
    usesNewIntimateGrammar:boolMeta(candidate,'usesNewIntimateGrammar'),
    usesNewFamilyGrammar:boolMeta(candidate,'usesNewFamilyGrammar'),
    usesNewBackendBehavior:boolMeta(candidate,'usesNewBackendBehavior'),
  };
}

function reviewFromFacts(candidate:AssembledSceneCandidate,facts:SurpriseCandidateFacts,decision:'pending'|'approved'='pending'):AssembledSceneReview{
  return{
    candidateId:candidate.id,
    decision,
    updatedAt:Date.now(),
    checks:{
      lucasIdentity:facts.lucasIdentity,
      marionIdentity:facts.marionIdentity,
      continuity:facts.continuity,
      wardrobe:facts.wardrobe,
      location:facts.location,
      motion:facts.motion,
      canon:facts.canon,
      completeAssembly:facts.completeAssembly,
    },
    notes:decision==='approved'?'Approved automatically by MonIA Surprise Mode quality gate.':'',
  };
}

export function saveAssembledSceneCandidate(candidate:AssembledSceneCandidate){
  if(candidate.status!=='candidate'||candidate.approvalRequired!==true||candidate.autoPublish!==false)throw new Error('Invalid assembled scene candidate policy');
  writeJson(CANDIDATE_KEY,candidate);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-candidate',{detail:candidate}));
  void evaluateAssembledSceneForSurprise(candidate).catch(()=>undefined);
}

export function readAssembledSceneCandidate(){return readJson<AssembledSceneCandidate>(CANDIDATE_KEY)}
export function readAssembledSceneReview(){return readJson<AssembledSceneReview>(REVIEW_KEY)}

export function saveAssembledSceneReview(review:AssembledSceneReview){
  writeJson(REVIEW_KEY,review);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-review',{detail:review}));
}

function allChecksPass(review:AssembledSceneReview){return Object.values(review.checks).every(Boolean)}

async function registerApprovedAsset(candidate:AssembledSceneCandidate,review:AssembledSceneReview,approvalMode:'atomic-whole-scene'|'surprise-mode-monIA',notes=''){
  const asset=await moniaCreativeVault.registerAsset({
    id:`approved-scene-${candidate.id}`,
    kind:'video',
    actor:candidate.route==='lucas-solo-drama'?'Lucas':candidate.route==='marion-solo-drama'?'Marion':'Marion & Lucas',
    role:`assembled-${candidate.route}`,
    url:candidate.videoUrl,
    status:'approved',
    source:'generated',
    tags:['assembled-scene','approved',candidate.route,candidate.continuityKey,approvalMode],
    metadata:{
      candidateId:candidate.id,
      jobId:candidate.jobId,
      route:candidate.route,
      continuityKey:candidate.continuityKey,
      approvalMode,
      shotCount:candidate.shotIds.length,
      notes,
    },
  });
  const approvedReview:AssembledSceneReview={...review,decision:'approved',updatedAt:Date.now(),notes:notes||review.notes};
  saveAssembledSceneReview(approvedReview);
  enqueueApprovedSurpriseScene(asset);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-approved',{detail:{candidate,asset,review:approvedReview,approvalMode}}));
  return asset;
}

export async function evaluateAssembledSceneForSurprise(candidate=readAssembledSceneCandidate()){
  if(!candidate)return{decision:'human-review' as const,reason:'no-candidate'};
  const facts=factsFromCandidate(candidate);
  const gate=surpriseGate(facts);
  if(gate.decision!=='monia-approved'){
    const existing=readAssembledSceneReview();
    if(!existing||existing.candidateId!==candidate.id)saveAssembledSceneReview(reviewFromFacts(candidate,facts));
    window.dispatchEvent(new CustomEvent('monia:assembled-scene-human-review-required',{detail:{candidate,gate}}));
    return gate;
  }
  const review=reviewFromFacts(candidate,facts,'approved');
  return registerApprovedAsset(candidate,review,'surprise-mode-monIA',`Surprise Mode: ${gate.reason}`);
}

export async function approveAssembledScene(candidateId:string,notes=''){
  const candidate=readAssembledSceneCandidate();
  const review=readAssembledSceneReview();
  if(!candidate||candidate.id!==candidateId)throw new Error('Assembled scene candidate not found');
  if(!review||review.candidateId!==candidateId)throw new Error('Review missing for assembled scene');
  if(!allChecksPass(review))throw new Error('All assembled-scene review checks must pass before approval');
  const asset=await registerApprovedAsset(candidate,review,'atomic-whole-scene',notes);
  const facts=factsFromCandidate(candidate);
  facts.lucasIdentity=review.checks.lucasIdentity;
  facts.marionIdentity=review.checks.marionIdentity;
  facts.continuity=review.checks.continuity;
  facts.wardrobe=review.checks.wardrobe;
  facts.location=review.checks.location;
  facts.motion=review.checks.motion;
  facts.canon=review.checks.canon;
  facts.completeAssembly=review.checks.completeAssembly;
  const trust=learnSurpriseTrustFromHumanApproval(facts);
  window.dispatchEvent(new CustomEvent('monia:surprise-mode-progress',{detail:{candidateId,route:candidate.route,trust}}));
  return asset;
}

export async function rejectAssembledScene(candidateId:string,notes=''){
  const candidate=readAssembledSceneCandidate();
  if(!candidate||candidate.id!==candidateId)throw new Error('Assembled scene candidate not found');
  const current=readAssembledSceneReview();
  const review:AssembledSceneReview={
    candidateId,
    decision:'rejected',
    updatedAt:Date.now(),
    checks:current?.checks||{lucasIdentity:false,marionIdentity:false,continuity:false,wardrobe:false,location:false,motion:false,canon:false,completeAssembly:false},
    notes,
  };
  saveAssembledSceneReview(review);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-rejected',{detail:{candidate,review}}));
  return review;
}

declare global{
  interface Window{
    __moniaAssembledSceneCandidate?:()=>AssembledSceneCandidate|null;
    __moniaApproveAssembledScene?:(candidateId:string,notes?:string)=>Promise<unknown>;
    __moniaRejectAssembledScene?:(candidateId:string,notes?:string)=>Promise<unknown>;
    __moniaEvaluateAssembledSceneForSurprise?:()=>Promise<unknown>;
  }
}
window.__moniaAssembledSceneCandidate=readAssembledSceneCandidate;
window.__moniaApproveAssembledScene=approveAssembledScene;
window.__moniaRejectAssembledScene=rejectAssembledScene;
window.__moniaEvaluateAssembledSceneForSurprise=()=>evaluateAssembledSceneForSurprise();
