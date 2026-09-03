import { generateAutonomousSourceImage } from './autonomous-image';
import { generateFreeCanonVideo } from './free-video';
import { persistGeneratedMedia } from './server-media-store';
import type { MonIAMediaPlan } from './media-orchestrator';

export type MonIAIntroShot={id:string;label:string;videoUrl:string;imageUrl?:string;preparedAt:number};

const CACHE_KEY='monia-intro-shots-v1';
const RETRY_KEY='monia-intro-prep-retry-v1';
const RETRY_COOLDOWN=6*60*60*1000;
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

function readCache():MonIAIntroShot[]{
  try{const raw=localStorage.getItem(CACHE_KEY);const value=raw?JSON.parse(raw):[];return Array.isArray(value)?value.filter(v=>v&&typeof v.videoUrl==='string'):[]}catch{return []}
}
function writeCache(items:MonIAIntroShot[]){try{localStorage.setItem(CACHE_KEY,JSON.stringify(items))}catch{}}
export function getPreparedMonIAIntroShots(){return readCache()}

async function remoteImageToFile(url:string,id:string){
  const response=await fetch(url,{mode:'cors'});if(!response.ok)throw new Error(`source image ${id} inaccessible · HTTP ${response.status}`);
  const blob=await response.blob();const type=blob.type||'image/png';return new File([blob],`${id}.${type.includes('jpeg')?'jpg':type.includes('webp')?'webp':'png'}`,{type});
}
function videoPrompt(plan:MonIAMediaPlan){const v=plan.visual;return `Photorealistic live-action cinematic intro shot. Exact same identity and facial proportions as the supplied clean source frame. ${plan.actor}. Location: ${v.location}. Framing: ${v.framing}. Wardrobe: ${v.wardrobe}. Lighting: ${v.lighting}. Action: ${v.action}. Natural breathing, realistic blinking, subtle eye and head motion, believable body and clothing motion, restrained camera movement, premium short-drama realism. No dialogue, no text, no subtitles, no title, no watermark, no UI, no morphing, no identity drift.`}

async function prepareOne(id:string,label:string,plan:MonIAMediaPlan):Promise<MonIAIntroShot|null>{
  const image=await generateAutonomousSourceImage({plan});if(image.state!=='ready'||!image.imageUrl)return null;
  let file:File;try{file=await remoteImageToFile(image.imageUrl,id)}catch{return null}
  const video=await generateFreeCanonVideo({referenceFile:file,prompt:videoPrompt(plan)});if(video.state!=='ready'||!video.videoUrl)return null;
  const stored=await persistGeneratedMedia(plan,image.imageUrl,video.videoUrl);
  return {id,label,videoUrl:stored.videoUrl,imageUrl:stored.imageUrl,preparedAt:Date.now()};
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
