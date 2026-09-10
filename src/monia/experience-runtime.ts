import { monia, type MonIAMode, type MonIADirectorRequest, type MonIADirectorResult } from './runtime';
import { buildAutonomousMediaPlan, type MonIAMediaPlan } from './media-orchestrator';
import { generateAutonomousSourceImage, type MonIAImageResult } from './autonomous-image';
import { generateFreeCanonVideo, type FreeVideoResult } from './free-video';
import { mediaCacheKey } from './media-cache';
import { persistGeneratedMedia } from './server-media-store';
import { moniaCreativeVault } from './creative-vault';

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
  persisted?:boolean;
  candidateAssetIds?:string[];
  reusedAssetId?:string;
  state:'not-needed'|'image-failed'|'video-failed'|'candidate'|'ready';
};

type Hooks={onImageState?:(state:string,detail?:string)=>void;onVideoState?:(state:string,detail?:string)=>void};

const inFlight=new Map<string,Promise<MonIAMaterializedMedia>>();

function videoPrompt(result:MonIADirectorResult,plan:MonIAMediaPlan){
  const visual=plan.visual;
  return `Photorealistic live-action cinematic video of the exact same person and identity as the supplied clean source frame. ${plan.actor}. Location: ${visual.location}. Framing: ${visual.framing}. Wardrobe continuity: ${visual.wardrobe}. Emotion: ${visual.emotion}. Action: ${visual.action}. Natural breathing, realistic blinking, subtle eye movement, natural head and body motion, physically believable clothing movement and environment motion. Preserve face shape, eyes, nose, mouth, hairline and proportions. No identity drift, no morphing, no text, no number, no title, no subtitles, no watermark, no UI. Premium immersive short-drama realism.`;
}

function vaultTags(plan:MonIAMediaPlan){
  return [plan.mode,plan.visual.location,plan.visual.framing,plan.visual.emotion,plan.visual.action].filter(Boolean).map(String);
}

async function findApprovedVaultMedia(plan:MonIAMediaPlan){
  const role=plan.mode==='live-visio'?'live-visio':'cinematic-drama';
  const tags=vaultTags(plan);
  const videos=await moniaCreativeVault.approvedAssets({kind:plan.mode==='live-visio'?'visio':'video',actor:plan.actor,role,tags}).catch(()=>[]);
  const video=videos[0];
  if(!video)return null;
  await moniaCreativeVault.markUsed(video.id).catch(()=>undefined);
  await moniaCreativeVault.recordGeneration({kind:'video',actor:plan.actor,promptKey:mediaCacheKey(plan),resultUrl:video.url,reusedAssetId:video.id,status:'reused'}).catch(()=>undefined);
  return video;
}

async function remoteImageToFile(url:string){
  const response=await fetch(url,{mode:'cors'});
  if(!response.ok)throw new Error(`Image source inaccessible · HTTP ${response.status}`);
  const blob=await response.blob();
  const type=blob.type||'image/png';
  const ext=type.includes('webp')?'webp':type.includes('jpeg')?'jpg':'png';
  return new File([blob],`monia-source-${Date.now()}.${ext}`,{type});
}

async function registerCandidates(input:MonIAExperienceResult,imageUrl:string,videoUrl:string,persisted:boolean){
  const role=input.mediaPlan.mode==='live-visio'?'live-visio':'cinematic-drama';
  const tags=vaultTags(input.mediaPlan);
  const stamp=Date.now();
  const image=await moniaCreativeVault.registerAsset({id:`candidate-image-${stamp}-${Math.random().toString(36).slice(2,7)}`,kind:'image',actor:input.mediaPlan.actor,role,url:imageUrl,status:'candidate',source:'generated',tags,metadata:{persisted,mode:input.mediaPlan.mode}});
  const video=await moniaCreativeVault.registerAsset({id:`candidate-video-${stamp}-${Math.random().toString(36).slice(2,7)}`,kind:input.mediaPlan.mode==='live-visio'?'visio':'video',actor:input.mediaPlan.actor,role,url:videoUrl,status:'candidate',source:'generated',tags,metadata:{persisted,mode:input.mediaPlan.mode,requiresHumanApproval:true}});
  await moniaCreativeVault.recordGeneration({kind:'image',actor:input.mediaPlan.actor,promptKey:mediaCacheKey(input.mediaPlan),resultUrl:imageUrl,status:'generated'}).catch(()=>undefined);
  await moniaCreativeVault.recordGeneration({kind:'video',actor:input.mediaPlan.actor,promptKey:mediaCacheKey(input.mediaPlan),resultUrl:videoUrl,status:'generated'}).catch(()=>undefined);
  return [image.id,video.id];
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

  hooks?.onVideoState?.('persisting','sauvegarde du candidat dans la bibliothèque MonIA');
  const stored=await persistGeneratedMedia(input.mediaPlan,image.imageUrl,video.videoUrl);
  const candidateAssetIds=await registerCandidates(input,stored.imageUrl,stored.videoUrl,stored.persisted).catch(()=>[]);
  hooks?.onVideoState?.('candidate','nouveau média conservé hors gameplay en attente de validation');
  return {image,video,imageUrl:stored.imageUrl,videoUrl:stored.videoUrl,persisted:stored.persisted,candidateAssetIds,state:'candidate'};
}

export class MonIAExperienceRuntime {
  async respond(request:MonIADirectorRequest, mode:MonIAMode='auto', enabled=true):Promise<MonIAExperienceResult>{
    const response=await monia.direct(request,mode,enabled);
    const mediaPlan=buildAutonomousMediaPlan(response,request.context);
    return {response,mediaPlan};
  }

  async materialize(input:MonIAExperienceResult, hooks?:Hooks):Promise<MonIAMaterializedMedia>{
    if(!input.mediaPlan.visual.required)return {image:null,video:null,state:'not-needed'};

    const approved=await findApprovedVaultMedia(input.mediaPlan);
    if(approved){
      hooks?.onImageState?.('vault','asset validé réutilisé depuis MonIA');
      hooks?.onVideoState?.('vault','aucune génération GPU nécessaire');
      return {image:null,video:null,videoUrl:approved.url,cacheHit:true,reusedAssetId:approved.id,state:'ready'};
    }

    const key=mediaCacheKey(input.mediaPlan);
    const existing=inFlight.get(key);
    if(existing){
      hooks?.onImageState?.('shared','génération candidate identique déjà en cours');
      hooks?.onVideoState?.('shared','attente du même candidat');
      const result=await existing;
      return {...result,sharedGeneration:true};
    }

    const job=generateFresh(input,hooks).finally(()=>inFlight.delete(key));
    inFlight.set(key,job);
    return job;
  }
}

export const moniaExperience=new MonIAExperienceRuntime();
