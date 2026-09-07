import { MEDIA_OPPORTUNITIES_EVENT, readMediaOpportunities, type MediaOpportunity } from './media-predictor';

const SAVE_KEY='marion-lucas-save-v4';
const QUEUE_KEY='monia-studio-video-jobs-v1';
const QUEUE_EVENT='marion-lucas:studio-jobs';
const MAX_JOBS=3;

type LooseSave={day?:number;time?:string;place?:string;relationship?:number;trust?:number;chemistry?:number;outfit?:string;metLucas?:boolean};
type StudioJob={
  id:string;state:'queued';createdAt:string;source:'anticipation';candidateOnly:true;narrativeAuthority:false;
  sceneFamily:string;signature:string;prompt:string;negativePrompt:string;
  characters:Array<{id:'marion'|'lucas';canonRef:string;wardrobe:string}>;
  motion?:{referenceId:string;tags:string[];copyIdentity:false};
  continuity:{reusePreviousFrame:boolean};
  generation:{provider:'kaggle';router:'auto';width:number;height:number;frames:number;fps:number;steps:number};
  output:{candidatePath:string;approvedPath:string};
};

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return Math.abs(h).toString(36)}

function motionFor(family:string){
  if(family.includes('family')||family.includes('child'))return {referenceId:'motion-user-20260906-b',tags:['parent_child_interaction','carrying_child','protective_posture','walking_with_child'],copyIdentity:false as const};
  if(family.includes('arrival')||family.includes('approach'))return {referenceId:'motion-user-20260906-a',tags:['walking','blocking','body_movement','camera_timing'],copyIdentity:false as const};
  return undefined;
}

function familyAction(family:string){
  const map:Record<string,string>={
    'reaction-closeup':'a restrained natural reaction close-up with breathing, blinking and subtle eye movement',
    'conversation-two-shot':'a quiet natural two-person conversation beat with believable spacing and micro-reactions',
    'arrival-departure':'a natural entrance or departure beat with realistic walking, stopping and screen direction',
    'quiet-proximity':'a quiet proximity beat with subtle posture changes and no forced contact',
    'comfort-support':'a supportive emotional beat with restrained protective body language',
    'romantic-approach':'a gentle romantic approach with natural hesitation and respectful distance',
    'affectionate-contact':'a brief affectionate contact beat, tender and non-explicit',
    'intimate-transition-fade':'a tasteful romantic transition that remains non-explicit and suitable for fade-to-black',
  };
  return map[family]||'a natural cinematic reaction beat';
}

function buildJob(opp:MediaOpportunity,save:LooseSave):StudioJob{
  const key=`${opp.id}|${opp.contextKey}`;
  const id=`studio-${hash(key)}`;
  const place=opp.constraints.place||save.place||'current gameplay location';
  const outfit=opp.constraints.outfit||save.outfit||'current gameplay wardrobe';
  const prompt=`Photorealistic live-action vertical mini-drama candidate. ${familyAction(opp.family)}. Current gameplay location: ${place}. Preserve canonical identities exactly. Marion keeps current wardrobe: ${outfit}. Natural lighting, realistic body mechanics, micro-expressions, restrained camera movement. This is only a reusable media-family candidate and must not invent or reveal a future story event.`;
  const chars:Array<{id:'marion'|'lucas';canonRef:string;wardrobe:string}>=[{id:'marion',canonRef:'/resources/monia/canon/marion/reference.jpg',wardrobe:outfit}];
  if(save.metLucas)chars.push({id:'lucas',canonRef:'/resources/monia/canon/lucas/reference.jpg',wardrobe:'gameplay-current'});
  return{
    id,state:'queued',createdAt:new Date().toISOString(),source:'anticipation',candidateOnly:true,narrativeAuthority:false,
    sceneFamily:opp.family,signature:key,prompt,
    negativePrompt:'identity drift, face morphing, age drift, wrong wardrobe, copied reference-person identity, extra limbs, distorted hands, text, subtitles, watermark, UI, invented story event',
    characters:chars,motion:motionFor(opp.family),continuity:{reusePreviousFrame:true},
    generation:{provider:'kaggle',router:'auto',width:480,height:832,frames:97,fps:24,steps:30},
    output:{candidatePath:`studio/candidates/${id}/`,approvedPath:'config/drama-approved.json'},
  };
}

function refresh(opps=readMediaOpportunities()){
  const save=readSave();if(!save)return;
  const jobs=opps.filter(o=>o.candidateOnly&&o.narrativeAuthority===false&&o.expiresAt>Date.now()).slice(0,MAX_JOBS).map(o=>buildJob(o,save));
  try{localStorage.setItem(QUEUE_KEY,JSON.stringify(jobs))}catch{}
  window.dispatchEvent(new CustomEvent<StudioJob[]>(QUEUE_EVENT,{detail:jobs}));
}

window.addEventListener(MEDIA_OPPORTUNITIES_EVENT,((event:Event)=>refresh((event as CustomEvent<MediaOpportunity[]>).detail||[])) as EventListener);
window.setTimeout(()=>refresh(),1800);

export function readStudioJobs():StudioJob[]{try{const raw=localStorage.getItem(QUEUE_KEY);return raw?JSON.parse(raw) as StudioJob[]:[]}catch{return[]}}
export const STUDIO_JOBS_EVENT=QUEUE_EVENT;
console.info('[MonIA Studio] Spoiler-safe candidate job queue active; cloud transport remains separate from gameplay');
