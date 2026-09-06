import { generateFreeCanonVideo } from './free-video';
import type { MonIAMaterializedMedia } from './experience-runtime';

const BASE_KEY='monia-last-visio-media-v1';
const CANDIDATES_KEY='monia-visio-state-candidates-v1';

type VisioCandidateMedia={base?:string;listening?:string;speaking?:string;reaction?:string;sourceImage?:string;status:'idle'|'generating'|'ready'|'partial'|'error';updatedAt:number;errors:string[]};

let running=false;
let lastSource='';
function readBase():MonIAMaterializedMedia|null{try{const raw=sessionStorage.getItem(BASE_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}}
function readCandidates():VisioCandidateMedia|null{try{const raw=sessionStorage.getItem(CANDIDATES_KEY);return raw?JSON.parse(raw) as VisioCandidateMedia:null}catch{return null}}
function writeCandidates(value:VisioCandidateMedia){try{sessionStorage.setItem(CANDIDATES_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-visio-candidates',{detail:value}))}catch{}}
async function imageUrlToFile(url:string){const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error(`source visio inaccessible · HTTP ${r.status}`);const blob=await r.blob();return new File([blob],`monia-visio-${Date.now()}.png`,{type:blob.type||'image/png'})}

const prompts={
  listening:'Photorealistic desktop video-call candidate of the exact same Lucas identity as the canonical reference. Quiet listening only: natural breathing, occasional blink, tiny eye movement toward camera, subtle head tilt, relaxed closed mouth, restrained attentive micro-reactions. Preserve face geometry, hair, eyes, stubble, skin tone and natural ears exactly. Lucas has no tattoos and no facial scar. No talking, no identity drift, no morphing, no text, no subtitles, no watermark, no zoom.',
  speaking:'Photorealistic desktop video-call candidate of the exact same Lucas identity as the canonical reference. Natural French conversation: subtle jaw and lip movement, realistic blinking, tiny head and eyebrow motion, believable breathing and posture. Preserve face geometry, hair, eyes, stubble, skin tone and natural ears exactly. Lucas has no tattoos and no facial scar. No exaggerated mouth motion, no identity drift, no morphing, no text, no subtitles, no watermark, no zoom.',
  reaction:'Photorealistic desktop video-call candidate of the exact same Lucas identity as the canonical reference. Silent warm micro-reaction: tiny eye movement, blink, slight breath, restrained half-smile, then settle naturally. Preserve face geometry, hair, eyes, stubble, skin tone and natural ears exactly. Lucas has no tattoos and no facial scar. No speaking, no identity drift, no morphing, no text, no subtitles, no watermark, no zoom.'
} as const;

async function generateState(name:keyof typeof prompts,file:File,current:VisioCandidateMedia){const result=await generateFreeCanonVideo({referenceFile:file,prompt:prompts[name]});if(result.state==='ready'&&result.videoUrl){current[name]=result.videoUrl;writeCandidates({...current,updatedAt:Date.now()});return true}current.errors.push(`${name}: ${result.error||'génération indisponible'}`);writeCandidates({...current,updatedAt:Date.now()});return false}
async function build(){if(running)return;const base=readBase();if(base?.state!=='ready'||!base.videoUrl||!base.imageUrl)return;if(base.imageUrl===lastSource){const current=readCandidates();if(current?.status==='ready'||current?.status==='partial')return}running=true;lastSource=base.imageUrl;const current:VisioCandidateMedia={base:base.videoUrl,sourceImage:base.imageUrl,status:'generating',updatedAt:Date.now(),errors:[]};writeCandidates(current);try{const file=await imageUrlToFile(base.imageUrl);const listeningOk=await generateState('listening',file,current);const speakingOk=await generateState('speaking',file,current);const reactionOk=await generateState('reaction',file,current);const count=[listeningOk,speakingOk,reactionOk].filter(Boolean).length;current.status=count===3?'ready':count>0?'partial':'error';current.updatedAt=Date.now();writeCandidates(current)}catch(error){current.status='error';current.errors.push(error instanceof Error?error.message:String(error));current.updatedAt=Date.now();writeCandidates(current)}finally{running=false}}
window.setInterval(()=>{void build()},1500);window.addEventListener('storage',()=>{void build()});
declare global{interface Window{__moniaVisioCandidates?:()=>VisioCandidateMedia|null}}
window.__moniaVisioCandidates=readCandidates;
console.info('[MonIA] Visio state generator produces review candidates only');
