import { generateAutonomousSourceImage } from './autonomous-image';
import { generateFreeCanonVideo } from './free-video';
import { persistGeneratedMedia } from './server-media-store';
import { CANON_DRAMA_ATLAS_CELLS } from './drama-atlas';
import type { MonIAMediaPlan } from './media-orchestrator';

export type MonIAIntroShot={id:string;label:string;videoUrl:string;imageUrl?:string;preparedAt:number};
export type MonIAIntroStatus={shotId:string;stage:string;detail?:string;updatedAt:number;ok?:boolean};

const CACHE_KEY='monia-intro-shots-v1';
const RETRY_KEY='monia-intro-prep-retry-v3';
const STATUS_KEY='monia-intro-prep-status-v2';
const STATUS_ENDPOINT='./api/monia-intro-status.php';
const RETRY_COOLDOWN=10*60*1000;
let active:Promise<MonIAIntroShot[]>|null=null;

const SHOTS:[string,string,MonIAMediaPlan][]=[
  ['marion-morning','NÎMES',{
    mode:'cinematic-drama',actor:'Marion',channel:'video',autonomous:true,surpriseSafe:true,
    visual:{required:true,trueVideoRequired:true,sourceStrategy:'generate-clean-source',framing:'waist',location:'Appartement à Nîmes, France, près d’une fenêtre ou d’un balcon, matin calme',wardrobe:'Tenue quotidienne simple, jeune et naturelle, cohérente avec une matinée chez elle; aucun changement d’identité ou accessoire narratif',lighting:'Lumière méditerranéenne naturelle du matin, douce, chaude et réaliste',action:'Marion fait quelques pas naturellement près de la fenêtre, regarde brièvement dehors, respire, cligne des yeux, micro-expression discrète, léger mouvement des cheveux; aucune pose mannequin',emotion:'warm',durationTarget:6,quality:'production',allowTextInFrame:false,allowStoryboardAsFinal:false,identityLock:'strict'},
    voice:{required:false,text:'',liveTurnTaking:false,lipSyncRequired:false,emotion:'warm'},
    assembly:{multiShot:false,targetSceneDuration:6,clipDurationRange:[4,7],reuseValidatedClips:true,generateMissingClips:true},
    cache:{serverOnly:true,reusable:true,tags:['intro','marion','nimes','morning','canonical']},
    rationale:['Ouverture cinématographique sans révélation narrative.','Vraie vidéo obligatoire; aucune image fixe comme rendu final.']
  }],
  ['lucas-presence','AILLEURS, AU MÊME MOMENT',{
    mode:'cinematic-drama',actor:'Lucas',channel:'video',autonomous:true,surpriseSafe:true,
    visual:{required:true,trueVideoRequired:true,sourceStrategy:'generate-clean-source',framing:'chest',location:'Intérieur réaliste et neutre en matinée, sans indice narratif nouveau ni lieu explicitement identifiable',wardrobe:'Tenue quotidienne masculine sobre et crédible; conserver strictement le visage canonique de Lucas, sans tatouage, sans inventer de détail narratif',lighting:'Lumière naturelle douce du matin, cinématographique mais crédible',action:'Lucas est simplement présent dans un moment de vie calme; respiration naturelle, clignements, léger mouvement du regard et de la tête, gestes subtils; aucune action qui révèle la suite',emotion:'neutral',durationTarget:5,quality:'production',allowTextInFrame:false,allowStoryboardAsFinal:false,identityLock:'strict'},
    voice:{required:false,text:'',liveTurnTaking:false,lipSyncRequired:false,emotion:'neutral'},
    assembly:{multiShot:false,targetSceneDuration:5,clipDurationRange:[4,6],reuseValidatedClips:true,generateMissingClips:true},
    cache:{serverOnly:true,reusable:true,tags:['intro','lucas','neutral','canonical']},
    rationale:['Présence de Lucas sans spoiler.','Vraie vidéo obligatoire; identité canonique stricte.']
  }]
];

function reportRemote(value:MonIAIntroStatus){
  void fetch(STATUS_ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),keepalive:true}).catch(()=>{});
}
function setStatus(value:MonIAIntroStatus){
  try{localStorage.setItem(STATUS_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-intro-status',{detail:value}))}catch{}
  reportRemote(value);
}
export function getMonIAIntroStatus():MonIAIntroStatus|null{try{const raw=localStorage.getItem(STATUS_KEY);return raw?JSON.parse(raw) as MonIAIntroStatus:null}catch{return null}}
function readCache():MonIAIntroShot[]{try{const raw=localStorage.getItem(CACHE_KEY);const value=raw?JSON.parse(raw):[];return Array.isArray(value)?value.filter(v=>v&&typeof v.videoUrl==='string'):[]}catch{return []}}
function writeCache(items:MonIAIntroShot[]){try{localStorage.setItem(CACHE_KEY,JSON.stringify(items))}catch{}}
export function getPreparedMonIAIntroShots(){return readCache()}

async function remoteImageToFile(url:string,id:string){
  setStatus({shotId:id,stage:'image-download',detail:'récupération de la source image',updatedAt:Date.now()});
  const response=await fetch(url,{mode:'cors'});if(!response.ok)throw new Error(`source image ${id} inaccessible · HTTP ${response.status}`);
  const blob=await response.blob();const type=blob.type||'image/png';return new File([blob],`${id}.${type.includes('jpeg')?'jpg':type.includes('webp')?'webp':'png'}`,{type});
}

function loadImage(src:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`atlas canonique inaccessible · ${src}`));img.src=src;
  });
}

async function canonicalAtlasSource(actor:'Marion'|'Lucas',id:string){
  const cell=CANON_DRAMA_ATLAS_CELLS.find(c=>c.actors.length===1&&c.actors[0]===actor&&c.mood==='neutral')
    || CANON_DRAMA_ATLAS_CELLS.find(c=>c.actors.length===1&&c.actors[0]===actor);
  if(!cell)throw new Error(`aucune référence canonique atlas pour ${actor}`);
  setStatus({shotId:id,stage:'image:fallback-atlas',detail:`référence canonique locale ${cell.id}`,updatedAt:Date.now()});
  const img=await loadImage(cell.src);
  const sx=cell.crop.x*img.naturalWidth,sy=cell.crop.y*img.naturalHeight;
  let sw=cell.crop.width*img.naturalWidth,sh=cell.crop.height*img.naturalHeight;
  const targetRatio=576/1024,sourceRatio=sw/sh;
  let cropX=sx,cropY=sy;
  if(sourceRatio>targetRatio){const nextW=sh*targetRatio;cropX+=Math.max(0,(sw-nextW)/2);sw=nextW}
  else if(sourceRatio<targetRatio){const nextH=sw/targetRatio;cropY+=Math.max(0,(sh-nextH)/2);sh=nextH}
  const canvas=document.createElement('canvas');canvas.width=576;canvas.height=1024;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('canvas canonique indisponible');
  ctx.drawImage(img,cropX,cropY,sw,sh,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('export atlas impossible')),'image/webp',.94));
  return {file:new File([blob],`${id}-canon.webp`,{type:'image/webp'}),imageUrl:cell.src};
}

function videoPrompt(plan:MonIAMediaPlan){const v=plan.visual;return `Photorealistic live-action cinematic intro shot. Exact same identity and facial proportions as the supplied clean source frame. ${plan.actor}. Location: ${v.location}. Framing: ${v.framing}. Wardrobe: ${v.wardrobe}. Lighting: ${v.lighting}. Action: ${v.action}. Natural breathing, realistic blinking, subtle eye and head motion, believable body and clothing motion, restrained camera movement, premium short-drama realism. No dialogue, no text, no subtitles, no title, no watermark, no UI, no morphing, no identity drift.`}

async function prepareOne(id:string,label:string,plan:MonIAMediaPlan):Promise<MonIAIntroShot|null>{
  let file:File|null=null;
  let imageUrl='';
  setStatus({shotId:id,stage:'image',detail:'préparation de la source canonique',updatedAt:Date.now()});
  try{
    const image=await generateAutonomousSourceImage({plan,onState:(stage,detail)=>setStatus({shotId:id,stage:`image:${stage}`,detail,updatedAt:Date.now()})});
    if(image.state==='ready'&&image.imageUrl){
      try{file=await remoteImageToFile(image.imageUrl,id);imageUrl=image.imageUrl}catch{}
    }
  }catch{}
  if(!file){
    try{const fallback=await canonicalAtlasSource(plan.actor as 'Marion'|'Lucas',id);file=fallback.file;imageUrl=fallback.imageUrl}
    catch(error){setStatus({shotId:id,stage:'image-error',detail:error instanceof Error?error.message:String(error),updatedAt:Date.now(),ok:false});return null}
  }
  setStatus({shotId:id,stage:'video',detail:'lancement du moteur vidéo avec identité canonique',updatedAt:Date.now()});
  const video=await generateFreeCanonVideo({referenceFile:file,prompt:videoPrompt(plan),onState:(stage,detail)=>setStatus({shotId:id,stage:`video:${stage}`,detail,updatedAt:Date.now()})});
  if(video.state!=='ready'||!video.videoUrl){setStatus({shotId:id,stage:'video-error',detail:video.error||'vidéo non produite',updatedAt:Date.now(),ok:false});return null}
  setStatus({shotId:id,stage:'persisting',detail:'stockage Infomaniak',updatedAt:Date.now()});
  const stored=await persistGeneratedMedia(plan,imageUrl,video.videoUrl);
  const shot={id,label,videoUrl:stored.videoUrl,imageUrl:stored.imageUrl,preparedAt:Date.now()};
  setStatus({shotId:id,stage:'ready',detail:stored.persisted?'vidéo stockée sur Infomaniak':'vidéo prête',updatedAt:Date.now(),ok:true});
  return shot;
}

export async function prepareMonIAIntroShots(force=false):Promise<MonIAIntroShot[]>{
  const cached=readCache();if(cached.length>=SHOTS.length&&!force)return cached;
  const last=Number(localStorage.getItem(RETRY_KEY)||0);if(!force&&last&&Date.now()-last<RETRY_COOLDOWN)return cached;
  if(active)return active;
  active=(async()=>{
    try{
      localStorage.setItem(RETRY_KEY,String(Date.now()));
      const map=new Map(cached.map(v=>[v.id,v]));
      for(const [id,label,plan] of SHOTS){
        if(map.has(id)&&!force)continue;
        const shot=await prepareOne(id,label,plan);if(shot){map.set(id,shot);writeCache([...map.values()]);window.dispatchEvent(new CustomEvent('monia-intro-shot-ready',{detail:shot}))}
      }
      return [...map.values()];
    }finally{active=null}
  })();
  return active;
}
