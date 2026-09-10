import { generateFreeCanonVideo } from './free-video';
import type { MonIAMaterializedMedia } from './experience-runtime';
import { buildAdaptiveLucasVisioPrompt, type LucasVisioState, type LucasVisioMood } from './adaptive-visio';

const BASE_KEY='monia-last-visio-media-v1';
const CANDIDATES_KEY='monia-visio-state-candidates-v2';
const CONTEXT_KEY='monia-visio-context-v1';
const REVIEW_MODE=new URLSearchParams(location.search).get('moniaReview')==='1'||location.hostname==='localhost'||location.hostname==='127.0.0.1';

type VisioCandidateMedia={base?:string;listening?:string;speaking?:string;reaction?:string;thinking?:string;sourceImage?:string;status:'idle'|'generating'|'ready'|'partial'|'error';updatedAt:number;errors:string[]};
type StoredVisioContext={mood?:LucasVisioMood;place?:string;timeOfDay?:string;relationship?:string;recentBeat?:string;outfitHint?:string;backgroundHint?:string};

let running=false;
let lastSource='';
function readBase():MonIAMaterializedMedia|null{try{const raw=sessionStorage.getItem(BASE_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}}
function readCandidates():VisioCandidateMedia|null{try{const raw=sessionStorage.getItem(CANDIDATES_KEY);return raw?JSON.parse(raw) as VisioCandidateMedia:null}catch{return null}}
function readContext():StoredVisioContext{try{const raw=sessionStorage.getItem(CONTEXT_KEY);return raw?JSON.parse(raw) as StoredVisioContext:{}}catch{return {}}}
function writeCandidates(value:VisioCandidateMedia){try{sessionStorage.setItem(CANDIDATES_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-visio-candidates',{detail:value}))}catch{}}
async function imageUrlToFile(url:string){const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error(`source visio inaccessible · HTTP ${r.status}`);const blob=await r.blob();return new File([blob],`monia-visio-${Date.now()}.png`,{type:blob.type||'image/png'})}

function buildPrompt(state:LucasVisioState){
  const context=readContext();
  return buildAdaptiveLucasVisioPrompt({
    state,
    mood:context.mood||'neutral',
    place:context.place,
    timeOfDay:context.timeOfDay,
    relationship:context.relationship,
    recentBeat:context.recentBeat,
    outfitHint:context.outfitHint,
    backgroundHint:context.backgroundHint
  });
}

async function generateState(name:LucasVisioState,file:File,current:VisioCandidateMedia){
  const result=await generateFreeCanonVideo({referenceFile:file,prompt:buildPrompt(name)});
  if(result.state==='ready'&&result.videoUrl){current[name]=result.videoUrl;writeCandidates({...current,updatedAt:Date.now()});return true}
  current.errors.push(`${name}: ${result.error||'génération indisponible'}`);
  writeCandidates({...current,updatedAt:Date.now()});
  return false;
}

async function build(){
  if(!REVIEW_MODE||running)return;
  const base=readBase();
  if(base?.state!=='ready'||!base.videoUrl||!base.imageUrl)return;
  if(base.imageUrl===lastSource){const current=readCandidates();if(current?.status==='ready'||current?.status==='partial')return}
  running=true;
  lastSource=base.imageUrl;
  const current:VisioCandidateMedia={base:base.videoUrl,sourceImage:base.imageUrl,status:'generating',updatedAt:Date.now(),errors:[]};
  writeCandidates(current);
  try{
    const file=await imageUrlToFile(base.imageUrl);
    const listeningOk=await generateState('listening',file,current);
    const speakingOk=await generateState('speaking',file,current);
    const reactionOk=await generateState('reaction',file,current);
    const thinkingOk=await generateState('thinking',file,current);
    const count=[listeningOk,speakingOk,reactionOk,thinkingOk].filter(Boolean).length;
    current.status=count===4?'ready':count>0?'partial':'error';
    current.updatedAt=Date.now();
    writeCandidates(current);
  }catch(error){
    current.status='error';
    current.errors.push(error instanceof Error?error.message:String(error));
    current.updatedAt=Date.now();
    writeCandidates(current);
  }finally{running=false}
}

export function setLucasVisioContext(context:StoredVisioContext){
  try{sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(context));lastSource='';void build()}catch{}
}

if(REVIEW_MODE){window.setInterval(()=>{void build()},1500);window.addEventListener('storage',()=>{void build()});window.addEventListener('monia:statechange',()=>{lastSource='';void build()})}
declare global{interface Window{__moniaVisioCandidates?:()=>VisioCandidateMedia|null;__moniaSetLucasVisioContext?:(context:StoredVisioContext)=>void}}
window.__moniaVisioCandidates=readCandidates;
window.__moniaSetLucasVisioContext=setLucasVisioContext;
console.info(REVIEW_MODE?'[MonIA] Adaptive visio review mode enabled: Lucas identity + context-aware motion':'[MonIA] Production visio: approved media only; unapproved candidate fallback disabled');
