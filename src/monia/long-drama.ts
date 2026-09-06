import { generateAutonomousSourceImage } from './autonomous-image';
import { generateFreeCanonVideo } from './free-video';
import type { MonIAExperienceResult } from './experience-runtime';
import { cancelMonIAVoice } from './voice-engine';
import { buildRuntimeDramaShots, shotMediaPlan, type RuntimeDramaShot } from './drama-shot-planner';

export type MonIALongDramaClip={id:string;index:number;role:RuntimeDramaShot['role'];framing:RuntimeDramaShot['framing'];imageUrl?:string;videoUrl?:string;voiceText?:string;voiceActor?:'Lucas'|'Marion';continuitySource?:'generated-image'|'previous-video-frame'|'previous-reference-fallback';state:'queued'|'image'|'video'|'ready'|'error';error?:string};
export type MonIALongDrama={id:string;title:string;state:'queued'|'generating'|'ready'|'partial'|'error';targetDuration:number;clips:MonIALongDramaClip[];errors:string[]};

const STORE_KEY='monia-long-drama-v1';
let active=false;

function write(value:MonIALongDrama){try{sessionStorage.setItem(STORE_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-long-drama',{detail:value}))}catch{}}
export function readLongDrama():MonIALongDrama|null{try{const raw=sessionStorage.getItem(STORE_KEY);return raw?JSON.parse(raw) as MonIALongDrama:null}catch{return null}}

async function urlToFile(url:string,index:number){const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error(`source plan ${index+1} inaccessible · HTTP ${r.status}`);const blob=await r.blob();return new File([blob],`monia-drama-shot-${index+1}.png`,{type:blob.type||'image/png'})}

async function extractLastVideoFrame(url:string,index:number):Promise<File>{
  const response=await fetch(url,{mode:'cors'});
  if(!response.ok)throw new Error(`clip ${index+1} inaccessible pour continuité · HTTP ${response.status}`);
  const blob=await response.blob();
  const objectUrl=URL.createObjectURL(blob);
  const video=document.createElement('video');
  video.muted=true;video.playsInline=true;video.preload='auto';
  try{
    await new Promise<void>((resolve,reject)=>{
      const fail=()=>reject(new Error(`métadonnées du clip ${index+1} illisibles`));
      video.onloadedmetadata=()=>resolve();video.onerror=fail;video.src=objectUrl;video.load();
    });
    const target=Math.max(0,Number.isFinite(video.duration)?video.duration-.08:0);
    await new Promise<void>((resolve,reject)=>{
      const fail=()=>reject(new Error(`dernière frame du clip ${index+1} inaccessible`));
      video.onseeked=()=>resolve();video.onerror=fail;
      try{video.currentTime=target}catch(error){reject(error)}
    });
    const width=video.videoWidth||576,height=video.videoHeight||1024;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas continuité indisponible');
    ctx.drawImage(video,0,0,width,height);
    const frame=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Extraction frame impossible')),'image/png',1));
    return new File([frame],`monia-drama-continuity-${index+1}.png`,{type:'image/png'});
  }finally{
    video.removeAttribute('src');video.load();URL.revokeObjectURL(objectUrl);
  }
}

function videoPrompt(shot:RuntimeDramaShot,plan:ReturnType<typeof shotMediaPlan>,index:number,count:number,usingPreviousFrame:boolean){
  const continuity=usingPreviousFrame
    ? ' The supplied source image is the actual final frame of the previous shot. Begin from that exact face, pose, wardrobe, lighting, room geometry and screen direction, then reframe naturally for this shot without a visual reset.'
    : shot.continuityFrom
      ? ` Direct visual continuation of ${shot.continuityFrom}; keep screen direction and spatial relationships identical.`
      : ' Lock the baseline continuity for the scene.';
  return `Photorealistic live-action vertical mini-drama ${shot.role} shot ${index+1}/${count}. Exact same canonical identity as the supplied source image. ${plan.actor}. ${plan.visual.action}. Location: ${plan.visual.location}. Framing: ${plan.visual.framing}. Emotion: ${plan.visual.emotion}.${continuity} Natural breathing, blinking, eye movement, restrained head/body motion and realistic clothing/environment motion. Preserve face, wardrobe, hair, props, room geometry and lighting. No text, title, subtitles, watermark, UI, morphing, identity drift or invented story event.`;
}

export async function materializeLongDrama(experience:MonIAExperienceResult,onProgress?:(value:MonIALongDrama)=>void):Promise<MonIALongDrama>{
  const basePlan=experience.mediaPlan;
  const shots=buildRuntimeDramaShots(experience);
  const target=Math.round(shots.reduce((sum,s)=>sum+s.duration,0));
  const drama:MonIALongDrama={
    id:`long-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    title:experience.response.text.slice(0,80)||'Scène MonIA',
    state:'queued',targetDuration:target,
    clips:shots.map(shot=>({id:shot.id,index:shot.index,role:shot.role,framing:shot.framing,voiceText:shot.voiceText,voiceActor:shot.actor||undefined,state:'queued'})),
    errors:[],
  };
  if(active)return drama;
  active=true;write(drama);onProgress?.(drama);
  let continuityFrame:File|null=null;
  try{
    drama.state='generating';write(drama);
    for(let i=0;i<shots.length;i++){
      const shotSpec=shots[i];
      const clip=drama.clips[i];
      const shot=shotMediaPlan(basePlan,shotSpec);
      try{
        clip.state='image';write(drama);onProgress?.(drama);
        let sourceFile:File;
        let usingPreviousFrame=false;
        if(i>0&&shotSpec.reusePreviousFrame&&continuityFrame){
          sourceFile=continuityFrame;
          usingPreviousFrame=true;
          clip.continuitySource='previous-video-frame';
        }else{
          const image=await generateAutonomousSourceImage({plan:shot});
          if(image.state!=='ready'||!image.imageUrl)throw new Error(image.error||'image source indisponible');
          clip.imageUrl=image.imageUrl;
          sourceFile=await urlToFile(image.imageUrl,i);
          clip.continuitySource=i===0?'generated-image':'previous-reference-fallback';
        }
        clip.state='video';write(drama);onProgress?.(drama);
        const video=await generateFreeCanonVideo({referenceFile:sourceFile,prompt:videoPrompt(shotSpec,shot,i,shots.length,usingPreviousFrame)});
        if(video.state!=='ready'||!video.videoUrl)throw new Error(video.error||'vidéo indisponible');
        clip.videoUrl=video.videoUrl;clip.state='ready';write(drama);onProgress?.(drama);
        try{
          continuityFrame=await extractLastVideoFrame(video.videoUrl,i);
        }catch(error){
          continuityFrame=sourceFile;
          drama.errors.push(`${clip.id}: continuité vidéo indisponible, référence précédente conservée (${error instanceof Error?error.message:String(error)})`);
          clip.continuitySource=clip.continuitySource||'previous-reference-fallback';
          write(drama);onProgress?.(drama);
        }
      }catch(error){
        clip.state='error';
        clip.error=error instanceof Error?error.message:String(error);
        drama.errors.push(`${clip.id}: ${clip.error}`);
        write(drama);onProgress?.(drama);
      }
    }
    const ready=drama.clips.filter(c=>c.state==='ready').length;
    drama.state=ready===shots.length?'ready':ready>1?'partial':'error';
    write(drama);onProgress?.(drama);return drama;
  }finally{active=false}
}

export function playLongDrama(drama=readLongDrama()){
  if(!drama)return;
  const clips=drama.clips.filter(c=>c.state==='ready'&&c.videoUrl);
  if(!clips.length)return;
  cancelMonIAVoice();
  document.getElementById('moniaLongDramaOverlay')?.remove();
  const overlay=document.createElement('div');
  overlay.id='moniaLongDramaOverlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:99998;background:#050403;color:white;display:grid;place-items:center;font-family:system-ui,sans-serif';
  overlay.innerHTML=`<video id="moniaLongDramaVideo" playsinline autoplay muted style="width:100%;height:100%;object-fit:cover;background:#000"></video><button id="moniaLongDramaClose" style="position:absolute;top:22px;right:22px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:white;font-size:24px">×</button><div id="moniaLongDramaCounter" style="position:absolute;left:20px;bottom:20px;padding:8px 11px;border-radius:999px;background:rgba(0,0,0,.48);font-size:12px"></div>`;
  document.body.appendChild(overlay);
  const video=overlay.querySelector<HTMLVideoElement>('#moniaLongDramaVideo')!;
  const counter=overlay.querySelector<HTMLElement>('#moniaLongDramaCounter')!;
  let index=0;
  const next=()=>{
    if(index>=clips.length){overlay.remove();return}
    const clip=clips[index];
    video.src=clip.videoUrl!;
    counter.textContent=`${clip.role} · plan ${index+1}/${clips.length}`;
    index++;
    void video.play().catch(()=>undefined);
  };
  video.onended=next;
  overlay.querySelector('#moniaLongDramaClose')?.addEventListener('click',()=>overlay.remove());
  next();
}

console.info('[Drama] Gameplay-authoritative multi-shot runtime ready with previous-video-frame continuity; automatic character voice remains disabled until canon validation');
