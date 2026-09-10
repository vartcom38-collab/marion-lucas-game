import { generateFreeCanonVideo } from './free-video';
import type { MonIAMaterializedMedia } from './experience-runtime';
import { selectLucasMotionDirections } from './motion-language';

const BASE_KEY='monia-last-visio-media-v1';
const CANDIDATES_KEY='monia-visio-state-candidates-v1';
const REVIEW_MODE=new URLSearchParams(location.search).get('moniaReview')==='1'||location.hostname==='localhost'||location.hostname==='127.0.0.1';

type VisioCandidateMedia={base?:string;listening?:string;speaking?:string;reaction?:string;sourceImage?:string;status:'idle'|'generating'|'ready'|'partial'|'error';updatedAt:number;errors:string[]};

type VisioState='listening'|'speaking'|'reaction';

let running=false;
let lastSource='';
function readBase():MonIAMaterializedMedia|null{try{const raw=sessionStorage.getItem(BASE_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}}
function readCandidates():VisioCandidateMedia|null{try{const raw=sessionStorage.getItem(CANDIDATES_KEY);return raw?JSON.parse(raw) as VisioCandidateMedia:null}catch{return null}}
function writeCandidates(value:VisioCandidateMedia){try{sessionStorage.setItem(CANDIDATES_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-visio-candidates',{detail:value}))}catch{}}
async function imageUrlToFile(url:string){const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error(`source visio inaccessible · HTTP ${r.status}`);const blob=await r.blob();return new File([blob],`monia-visio-${Date.now()}.png`,{type:blob.type||'image/png'})}

const stateBasePrompt:Record<VisioState,string>={
  listening:'Photorealistic desktop video-call candidate of the exact same Lucas identity as the canonical reference. Quiet listening only: natural breathing, occasional blink, tiny eye movement toward camera, subtle head tilt, relaxed closed mouth, restrained attentive micro-reactions.',
  speaking:'Photorealistic desktop video-call candidate of the exact same Lucas identity as the canonical reference. Natural French conversation: subtle jaw and lip movement, realistic blinking, tiny head and eyebrow motion, believable breathing and posture.',
  reaction:'Photorealistic desktop video-call candidate of the exact same Lucas identity as the canonical reference. Silent warm micro-reaction: tiny eye movement, blink, slight breath, restrained half-smile, then settle naturally.'
};

const stateMotionIntent:Record<VisioState,{intent:string;tags:string[]}>= {
  listening:{intent:'Lucas écoute en visio avec une présence tendre, calme et naturelle, regard caméra et micro-réactions contenues',tags:['visio','listening','tender','reaction','closeup']},
  speaking:{intent:'Lucas parle naturellement en visio, dialogue intime mais sobre, petits mouvements du visage et du haut du corps sans surjeu',tags:['visio','dialogue','natural','closeup','reaction']},
  reaction:{intent:'Lucas a une réaction silencieuse et tendre en visio, sourire retenu, respiration et regard avant tout geste',tags:['visio','reaction','tender','quiet','closeup']}
};

function buildPrompt(name:VisioState){
  const motion=selectLucasMotionDirections({...stateMotionIntent[name],limit:2});
  return [
    stateBasePrompt[name],
    `MOTION LANGUAGE: ${motion.join(' | ')}`,
    'Motion references are gesture/timing references only. Never copy any reference actor or co-actor identity, face, body identity, wardrobe, tattoos, scars or distinctive appearance.',
    'Preserve canonical Lucas face geometry, hair, eyes, nose, mouth, jaw, stubble, skin tone, age continuity and natural ears exactly. Lucas has no tattoos and no facial scar.',
    name==='listening'?'No talking.':'' ,
    name==='reaction'?'No speaking.':'',
    'No identity drift, no morphing, no exaggerated mouth motion, no robotic blink rhythm, no text, no subtitles, no watermark, no zoom.'
  ].filter(Boolean).join(' ');
}

async function generateState(name:VisioState,file:File,current:VisioCandidateMedia){const result=await generateFreeCanonVideo({referenceFile:file,prompt:buildPrompt(name)});if(result.state==='ready'&&result.videoUrl){current[name]=result.videoUrl;writeCandidates({...current,updatedAt:Date.now()});return true}current.errors.push(`${name}: ${result.error||'génération indisponible'}`);writeCandidates({...current,updatedAt:Date.now()});return false}
async function build(){if(!REVIEW_MODE||running)return;const base=readBase();if(base?.state!=='ready'||!base.videoUrl||!base.imageUrl)return;if(base.imageUrl===lastSource){const current=readCandidates();if(current?.status==='ready'||current?.status==='partial')return}running=true;lastSource=base.imageUrl;const current:VisioCandidateMedia={base:base.videoUrl,sourceImage:base.imageUrl,status:'generating',updatedAt:Date.now(),errors:[]};writeCandidates(current);try{const file=await imageUrlToFile(base.imageUrl);const listeningOk=await generateState('listening',file,current);const speakingOk=await generateState('speaking',file,current);const reactionOk=await generateState('reaction',file,current);const count=[listeningOk,speakingOk,reactionOk].filter(Boolean).length;current.status=count===3?'ready':count>0?'partial':'error';current.updatedAt=Date.now();writeCandidates(current)}catch(error){current.status='error';current.errors.push(error instanceof Error?error.message:String(error));current.updatedAt=Date.now();writeCandidates(current)}finally{running=false}}
if(REVIEW_MODE){window.setInterval(()=>{void build()},1500);window.addEventListener('storage',()=>{void build()})}
declare global{interface Window{__moniaVisioCandidates?:()=>VisioCandidateMedia|null}}
window.__moniaVisioCandidates=readCandidates;
console.info(REVIEW_MODE?'[MonIA] Visio review mode enabled: Lucas motion language active':'[MonIA] Production visio: candidate generation disabled; approved media only');
