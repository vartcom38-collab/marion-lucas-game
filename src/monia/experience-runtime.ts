import { monia, type MonIAMode, type MonIADirectorRequest, type MonIADirectorResult } from './runtime';
import { buildAutonomousMediaPlan, type MonIAMediaPlan } from './media-orchestrator';
import { buildMonIAGenerationJob, type MonIAGenerationJob } from './generation-job';
import { generateAutonomousSourceImage, type MonIAImageResult } from './autonomous-image';
import { generateFreeCanonVideo, type FreeVideoResult } from './free-video';
import { mediaCacheKey } from './media-cache';
import { persistGeneratedMedia } from './server-media-store';
import { moniaCreativeVault } from './creative-vault';

export type MonIAExperienceResult = {
  response: MonIADirectorResult;
  mediaPlan: MonIAMediaPlan;
  generationJob: MonIAGenerationJob;
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
  generationJobId?:string;
  state:'not-needed'|'image-failed'|'video-failed'|'candidate'|'ready';
};

type Hooks={onImageState?:(state:string,detail?:string)=>void;onVideoState?:(state:string,detail?:string)=>void};

const inFlight=new Map<string,Promise<MonIAMaterializedMedia>>();

function videoPrompt(result:MonIADirectorResult,plan:MonIAMediaPlan,job:MonIAGenerationJob){
  const visual=plan.visual;
  const firstShot=job.shots[0];
  const dialogue=firstShot?.dialogue?.[0]?.text;
  const dialogueRule=dialogue?` Exact spoken dialogue authority: "${dialogue}". Do not invent, omit or replace spoken words. Mouth performance must be built for this exact utterance; V16 audio timing is the master clock.`:'';
  const continuity=job.shots.length>1?' This is one shot inside a longer scene. Preserve identity, wardrobe, location, lighting, screen direction and emotional state so adjacent generated shots can cut together naturally.':'';
  return `Photorealistic live-action video of the exact same person and identity as the supplied clean source frame. ${plan.actor}. Location: ${visual.location}. Framing: ${visual.framing}. Wardrobe continuity: ${visual.wardrobe}. Emotion: ${visual.emotion}. Action: ${visual.action}. Natural breathing, realistic blinking, subtle eye movement, natural head and body motion, physically believable clothing movement and environment motion. Preserve face shape, eyes, nose, mouth, hairline and proportions. Canonical tattoos must remain consistent when naturally visible; never invent or erase visible canonical tattoos. No identity drift, no morphing, no text, no number, no title, no subtitles, no watermark, no UI.${dialogueRule}${continuity} Premium immersive short-drama realism.`;
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
  const tags=[...vaultTags(input.mediaPlan),`job:${input.generationJob.id}`];
  const stamp=Date.now();
  const metadata={persisted,mode:input.mediaPlan.mode,generationJobId:input.generationJob.id,transient:true,automaticCanonPromotion:false};
  const image=await moniaCreativeVault.registerAsset({id:`candidate-image-${stamp}-${Math.random().toString(36).slice(2,7)}`,kind:'image',actor:input.mediaPlan.actor,role,url:imageUrl,status:'candidate',source:'generated',tags,metadata});
  const video=await moniaCreativeVault.registerAsset({id:`candidate-video-${stamp}-${Math.random().toString(36).slice(2,7)}`,kind:input.mediaPlan.mode==='live-visio'?'visio':'video',actor:input.mediaPlan.actor,role,url:videoUrl,status:'candidate',source:'generated',tags,metadata:{...metadata,requiresHumanApprovalForCanon:true}});
  await moniaCreativeVault.recordGeneration({kind:'image',actor:input.mediaPlan.actor,promptKey:mediaCacheKey(input.mediaPlan),resultUrl:imageUrl,status:'generated'}).catch(()=>undefined);
  await moniaCreativeVault.recordGeneration({kind:'video',actor:input.mediaPlan.actor,promptKey:mediaCacheKey(input.mediaPlan),resultUrl:videoUrl,status:'generated'}).catch(()=>undefined);
  return [image.id,video.id];
}

async function generateFresh(input:MonIAExperienceResult,hooks?:Hooks):Promise<MonIAMaterializedMedia>{
  const image=await generateAutonomousSourceImage({plan:input.mediaPlan,onState:(state,detail)=>hooks?.onImageState?.(state,detail)});
  if(image.state!=='ready'||!image.imageUrl)return {image,video:null,generationJobId:input.generationJob.id,state:'image-failed'};

  let file:File;
  try{file=await remoteImageToFile(image.imageUrl)}catch(error){
    return {image:{...image,state:'error',error:error instanceof Error?error.message:String(error)},video:null,imageUrl:image.imageUrl,generationJobId:input.generationJob.id,state:'image-failed'};
  }

  const video=await generateFreeCanonVideo({referenceFile:file,prompt:videoPrompt(input.response,input.mediaPlan,input.generationJob),onState:(state,detail)=>hooks?.onVideoState?.(state,detail)});
  if(video.state!=='ready'||!video.videoUrl)return {image,video,imageUrl:image.imageUrl,generationJobId:input.generationJob.id,state:'video-failed'};

  hooks?.onVideoState?.('persisting','sauvegarde du candidat transitoire dans MonIA');
  const stored=await persistGeneratedMedia(input.mediaPlan,image.imageUrl,video.videoUrl);
  const candidateAssetIds=await registerCandidates(input,stored.imageUrl,stored.videoUrl,stored.persisted).catch(()=>[]);
  hooks?.onVideoState?.('candidate','média généré lié au job MonIA; utilisable après contrôles, jamais promu automatiquement au canon');
  return {image,video,imageUrl:stored.imageUrl,videoUrl:stored.videoUrl,persisted:stored.persisted,candidateAssetIds,generationJobId:input.generationJob.id,state:'candidate'};
}

export class MonIAExperienceRuntime {
  async respond(request:MonIADirectorRequest, mode:MonIAMode='auto', enabled=true):Promise<MonIAExperienceResult>{
    const response=await monia.direct(request,mode,enabled);
    const mediaPlan=buildAutonomousMediaPlan(response,request.context);
    const generationJob=buildMonIAGenerationJob(response,mediaPlan,request);
    return {response,mediaPlan,generationJob};
  }

  async materialize(input:MonIAExperienceResult, hooks?:Hooks):Promise<MonIAMaterializedMedia>{
    if(!input.mediaPlan.visual.required)return {image:null,video:null,generationJobId:input.generationJob.id,state:'not-needed'};

    const approved=await findApprovedVaultMedia(input.mediaPlan);
    if(approved){
      hooks?.onImageState?.('vault','asset validé réutilisé depuis MonIA');
      hooks?.onVideoState?.('vault','aucune génération GPU nécessaire');
      return {image:null,video:null,videoUrl:approved.url,cacheHit:true,reusedAssetId:approved.id,generationJobId:input.generationJob.id,state:'ready'};
    }

    const key=`${mediaCacheKey(input.mediaPlan)}|${input.generationJob.id}`;
    const existing=inFlight.get(key);
    if(existing){
      hooks?.onImageState?.('shared','génération MonIA identique déjà en cours');
      hooks?.onVideoState?.('shared','attente du même job');
      const result=await existing;
      return {...result,sharedGeneration:true};
    }

    const job=generateFresh(input,hooks).finally(()=>inFlight.delete(key));
    inFlight.set(key,job);
    return job;
  }
}

export const moniaExperience=new MonIAExperienceRuntime();
