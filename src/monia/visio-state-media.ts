import { generateFreeCanonVideo } from './free-video';
import type { MonIAMaterializedMedia } from './experience-runtime';

const BASE_KEY='monia-last-visio-media-v1';
const STATES_KEY='monia-visio-state-media-v1';

type VisioStateMedia={base?:string;listening?:string;speaking?:string;reaction?:string;sourceImage?:string;status:'idle'|'generating'|'ready'|'partial'|'error';updatedAt:number;errors:string[]};

let running=false;
let lastSource='';

function readBase():MonIAMaterializedMedia|null{try{const raw=sessionStorage.getItem(BASE_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}}
function readStates():VisioStateMedia|null{try{const raw=sessionStorage.getItem(STATES_KEY);return raw?JSON.parse(raw) as VisioStateMedia:null}catch{return null}}
function writeStates(value:VisioStateMedia){try{sessionStorage.setItem(STATES_KEY,JSON.stringify(value));window.dispatchEvent(new Event('monia-visio-state-media'))}catch{}}

async function imageUrlToFile(url:string){
  const r=await fetch(url,{mode:'cors'});
  if(!r.ok)throw new Error(`source visio inaccessible · HTTP ${r.status}`);
  const blob=await r.blob();
  const type=blob.type||'image/png';
  return new File([blob],`monia-visio-${Date.now()}.png`,{type});
}

const prompts={
  listening:'Photorealistic live video call. Exact same identity, face, clothing, location and lighting as the source image. Lucas is quietly listening to Marion on a video call: natural breathing, occasional blink, tiny eye movements toward the phone camera, subtle head tilt, relaxed mouth mostly closed, small attentive micro-reactions. No talking, no text, no subtitles, no watermark, no camera zoom, no identity drift.',
  speaking:'Photorealistic live video call. Exact same identity, face, clothing, location and lighting as the source image. Lucas is naturally answering Marion on a video call: realistic conversational facial movement, subtle jaw and lip motion as if speaking French, natural blinking, tiny head and eyebrow movements, breathing, believable posture. No exaggerated mouth motion, no text, no subtitles, no watermark, no camera zoom, no identity drift.',
  reaction:'Photorealistic live video call. Exact same identity, face, clothing, location and lighting as the source image. Lucas reacts silently for a moment to something Marion just said: a brief genuine micro-expression matching a warm intimate conversation, tiny eye movement, blink, slight breath and restrained half-smile, then settles naturally. No speaking, no text, no subtitles, no watermark, no camera zoom, no identity drift.',
} as const;

async function generateState(name:keyof typeof prompts,file:File,current:VisioStateMedia){
  const result=await generateFreeCanonVideo({referenceFile:file,prompt:prompts[name]});
  if(result.state==='ready'&&result.videoUrl){current[name]=result.videoUrl;writeStates({...current,updatedAt:Date.now()});return true}
  current.errors.push(`${name}: ${result.error||'génération indisponible'}`);writeStates({...current,updatedAt:Date.now()});return false;
}

async function build(){
  if(running)return;
  const base=readBase();
  if(base?.state!=='ready'||!base.videoUrl||!base.imageUrl)return;
  if(base.imageUrl===lastSource){const current=readStates();if(current?.status==='ready'||current?.status==='partial')return}
  running=true;lastSource=base.imageUrl;
  const current:VisioStateMedia={base:base.videoUrl,sourceImage:base.imageUrl,status:'generating',updatedAt:Date.now(),errors:[]};
  writeStates(current);
  try{
    const file=await imageUrlToFile(base.imageUrl);
    // Base generated clip stays usable immediately. Additional states enrich the call in the background.
    const listeningOk=await generateState('listening',file,current);
    const speakingOk=await generateState('speaking',file,current);
    const reactionOk=await generateState('reaction',file,current);
    const count=[listeningOk,speakingOk,reactionOk].filter(Boolean).length;
    current.status=count===3?'ready':count>0?'partial':'error';
    current.updatedAt=Date.now();writeStates(current);
  }catch(error){current.status='error';current.errors.push(error instanceof Error?error.message:String(error));current.updatedAt=Date.now();writeStates(current)}finally{running=false}
}

window.setInterval(()=>{void build()},1200);
window.addEventListener('monia-visio-state-media',()=>undefined);
window.addEventListener('storage',()=>{void build()});

declare global{interface Window{__moniaVisioStates?:()=>VisioStateMedia|null}}
window.__moniaVisioStates=readStates;

console.info('[MonIA] Autonomous listening/speaking/reaction visio clip generator active');
