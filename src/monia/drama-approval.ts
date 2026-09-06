import type { MonIALongDrama } from './long-drama';

const MANIFEST_URL='./config/drama-approved.json';
const CANDIDATE_KEY='monia-long-drama-candidate-v1';

type ApprovedEntry={signature:string;title?:string;clips:Array<{id?:string;role?:string;framing?:string;videoUrl:string}>};
type ApprovedManifest={version:number;status:'locked'|string;policy?:Record<string,unknown>;entries:ApprovedEntry[]};

type CandidateRecord={signature:string;createdAt:number;state:'candidate';drama:MonIALongDrama;quality:{continuity:boolean;complete:boolean;identity:'pending';canon:'pending';motion:'pending';voice:'pending'}};

let manifestPromise:Promise<ApprovedManifest|null>|null=null;

export function saveDramaCandidate(signature:string,drama:MonIALongDrama){
  const record:CandidateRecord={
    signature,
    createdAt:Date.now(),
    state:'candidate',
    drama,
    quality:{
      continuity:drama.clips.length>1&&drama.clips.slice(1).every(c=>c.continuitySource==='previous-video-frame'),
      complete:drama.state==='ready'&&drama.clips.every(c=>c.state==='ready'&&Boolean(c.videoUrl)),
      identity:'pending',canon:'pending',motion:'pending',voice:'pending',
    },
  };
  try{sessionStorage.setItem(CANDIDATE_KEY,JSON.stringify(record));window.dispatchEvent(new CustomEvent('monia-drama-candidate',{detail:record}))}catch{}
}

export function readDramaCandidate():CandidateRecord|null{
  try{const raw=sessionStorage.getItem(CANDIDATE_KEY);return raw?JSON.parse(raw) as CandidateRecord:null}catch{return null}
}

async function loadManifest(){
  if(!manifestPromise)manifestPromise=fetch(`${MANIFEST_URL}?v=1`,{cache:'no-store',credentials:'same-origin'})
    .then(r=>r.ok?r.json():null)
    .catch(()=>null) as Promise<ApprovedManifest|null>;
  return manifestPromise;
}

export async function approvedDramaForSignature(signature:string):Promise<MonIALongDrama|null>{
  const manifest=await loadManifest();
  if(!manifest||manifest.status!=='locked'||!Array.isArray(manifest.entries))return null;
  const entry=manifest.entries.find(e=>e.signature===signature);
  if(!entry||!entry.clips?.length)return null;
  return{
    id:`approved-${Math.abs(hash(signature))}`,
    title:entry.title||'Scène approuvée',
    state:'ready',
    targetDuration:entry.clips.length*4,
    clips:entry.clips.map((clip,index)=>({
      id:clip.id||`approved-${index+1}`,
      index,
      role:(clip.role||'reaction') as any,
      framing:(clip.framing||'medium') as any,
      videoUrl:clip.videoUrl,
      state:'ready',
      continuitySource:index===0?'generated-image':'previous-video-frame',
    })),
    errors:[],
  };
}

function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return h}

console.info('[Drama] Approval manifest active: fresh generation is candidate-only');
