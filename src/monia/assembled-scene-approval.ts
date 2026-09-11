import { moniaCreativeVault } from './creative-vault';

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

export function saveAssembledSceneCandidate(candidate:AssembledSceneCandidate){
  if(candidate.status!=='candidate'||candidate.approvalRequired!==true||candidate.autoPublish!==false)throw new Error('Invalid assembled scene candidate policy');
  writeJson(CANDIDATE_KEY,candidate);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-candidate',{detail:candidate}));
}

export function readAssembledSceneCandidate(){return readJson<AssembledSceneCandidate>(CANDIDATE_KEY)}
export function readAssembledSceneReview(){return readJson<AssembledSceneReview>(REVIEW_KEY)}

export function saveAssembledSceneReview(review:AssembledSceneReview){
  writeJson(REVIEW_KEY,review);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-review',{detail:review}));
}

function allChecksPass(review:AssembledSceneReview){return Object.values(review.checks).every(Boolean)}

export async function approveAssembledScene(candidateId:string,notes=''){
  const candidate=readAssembledSceneCandidate();
  const review=readAssembledSceneReview();
  if(!candidate||candidate.id!==candidateId)throw new Error('Assembled scene candidate not found');
  if(!review||review.candidateId!==candidateId)throw new Error('Review missing for assembled scene');
  if(!allChecksPass(review))throw new Error('All assembled-scene review checks must pass before approval');

  const asset=await moniaCreativeVault.registerAsset({
    id:`approved-scene-${candidate.id}`,
    kind:'video',
    actor:candidate.route==='lucas-solo-drama'?'Lucas':'Marion & Lucas',
    role:`assembled-${candidate.route}`,
    url:candidate.videoUrl,
    status:'approved',
    source:'generated',
    tags:['assembled-scene','approved',candidate.route,candidate.continuityKey],
    metadata:{
      candidateId:candidate.id,
      jobId:candidate.jobId,
      continuityKey:candidate.continuityKey,
      approvalMode:'atomic-whole-scene',
      shotCount:candidate.shotIds.length,
      notes,
    },
  });

  const approvedReview:AssembledSceneReview={...review,decision:'approved',updatedAt:Date.now(),notes:notes||review.notes};
  saveAssembledSceneReview(approvedReview);
  window.dispatchEvent(new CustomEvent('monia:assembled-scene-approved',{detail:{candidate,asset,review:approvedReview}}));
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
  }
}
window.__moniaAssembledSceneCandidate=readAssembledSceneCandidate;
window.__moniaApproveAssembledScene=approveAssembledScene;
window.__moniaRejectAssembledScene=rejectAssembledScene;
