import { monia, type MonIAMode, type MonIADirectorRequest, type MonIADirectorResult } from './runtime';
import { buildAutonomousMediaPlan, type MonIAMediaPlan } from './media-orchestrator';
import { generateAutonomousSourceImage, type MonIAImageResult } from './autonomous-image';
import { generateFreeCanonVideo, type FreeVideoResult } from './free-video';
import { findCachedRemoteMedia, mediaCacheKey, rememberRemoteMedia } from './media-cache';

export type MonIAExperienceResult = {
  response: MonIADirectorResult;
  mediaPlan: MonIAMediaPlan;
};

export type MonIAMaterializedMedia={
  image:MonIAImageResult|null;
  video:FreeVideoResult|null;
  imageUrl?:string;
  videoUrl?:string;
  cacheHit?:boolean;
  sharedGeneration?:boolean;
  state:'not-needed'|'image-failed'|'video-failed'|'ready';
};

type Hooks={onImageState?:(state:string,detail?:string)=>void;onVideoState?:(state:string,detail?:string)=>void};

const inFlight=new Map<string,Promise<MonIAMaterializedMedia>>();

function videoPrompt(result:MonIADirectorResult,plan:MonIAMediaPlan){
  const visual=plan.visual;
  return `Photorealistic live-action cinematic video of the exact same person and identity as the supplied clean source frame. ${plan.actor}. Location: ${visual.location}. Framing: ${visual.framing}. Wardrobe continuity: ${visual.wardrobe}. Emotion: ${visual.emotion}. Action: ${visual.action}. Natural breathing, realistic blinking, subtle eye movement, natural head and body motion, physically believable clothing movement and environment motion. Preserve face shape, eyes, nose, mouth, hairline and proportions. No identity drift, no morphing, no text, no number, no title, no subtitles, no watermark, no UI. Premium immersive short-drama realism.`;
}

async function remoteImageToFile(url:string){
  const response=await fetch(url,{mode:'cors'});
  if(!response.ok)throw new Error(`Image source inaccessible · HTTP ${response.status}`);
  const blob=await response.blob();
  const type=blob.type||'image/png';
  const ext=type.includes('webp')?'webp':type.includes('jpeg')?'jpg':'png';
  return new File([blob],`monia-source-${Date.now()}.${ext}`,{type});
}

async function generateFresh(input:MonIAExperienceResult,hooks?:Hooks):Promise<MonIAMaterializedMedia>{
  const image=await generateAutonomousSourceImage({plan:input.mediaPlan,onState:(state,detail)=>hooks?.onImageState?.(state,detail)});
  if(image.state!=='ready'||!image.imageUrl)return {image,video:null,state:'image-failed'};

  let file:File;
  try{file=await remoteImageToFile(image.imageUrl)}catch(error){
    return {image:{...image,state:'error',error:error instanceof Error?error.message:String(error)},video:null,imageUrl:image.imageUrl,state:'image-failed'};
  }

  const video=await generateFreeCanonVideo({referenceFile:file,prompt:videoPrompt(input.response,input.mediaPlan),onState:(state,detail)=>hooks?.onVideoState?.(state,detail)});
  if(video.state!=='ready'||!video.videoUrl)return {image,video,imageUrl:image.imageUrl,state:'video-failed'};
  rememberRemoteMedia(input.mediaPlan,image.imageUrl,video.videoUrl);
  return {image,video,imageUrl:image.imageUrl,videoUrl:video.videoUrl,cacheHit:false,state:'ready'};
}

export class MonIAExperienceRuntime {
  async respond(request:MonIADirectorRequest, mode:MonIAMode='auto', enabled=true):Promise<MonIAExperienceResult>{
    const response=await monia.direct(request,mode,enabled);
    const mediaPlan=buildAutonomousMediaPlan(response,request.context);
    return {response,mediaPlan};
  }

  async materialize(input:MonIAExperienceResult, hooks?:Hooks):Promise<MonIAMaterializedMedia>{
    if(!input.mediaPlan.visual.required)return {image:null,video:null,state:'not-needed'};

    const cached=findCachedRemoteMedia(input.mediaPlan);
    if(cached){
      hooks?.onImageState?.('cache','source distante réutilisée');
      hooks?.onVideoState?.('cache','vraie vidéo distante réutilisée');
      return {image:null,video:null,imageUrl:cached.imageUrl,videoUrl:cached.videoUrl,cacheHit:true,state:'ready'};
    }

    const key=mediaCacheKey(input.mediaPlan);
    const existing=inFlight.get(key);
    if(existing){
      hooks?.onImageState?.('shared','génération identique déjà en cours');
      hooks?.onVideoState?.('shared','attente du même rendu GPU');
      const result=await existing;
      return {...result,sharedGeneration:true};
    }

    const job=generateFresh(input,hooks).finally(()=>inFlight.delete(key));
    inFlight.set(key,job);
    return job;
  }
}

export const moniaExperience=new MonIAExperienceRuntime();
