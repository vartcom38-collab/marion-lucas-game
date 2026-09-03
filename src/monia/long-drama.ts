import { generateAutonomousSourceImage } from './autonomous-image';
import { generateFreeCanonVideo } from './free-video';
import type { MonIAExperienceResult } from './experience-runtime';
import type { MonIAMediaPlan, MonIAFraming } from './media-orchestrator';

export type MonIALongDramaClip={id:string;index:number;framing:MonIAFraming;imageUrl?:string;videoUrl?:string;state:'queued'|'image'|'video'|'ready'|'error';error?:string};
export type MonIALongDrama={id:string;title:string;state:'queued'|'generating'|'ready'|'partial'|'error';targetDuration:number;clips:MonIALongDramaClip[];errors:string[]};

const STORE_KEY='monia-long-drama-v1';
let active=false;

function write(value:MonIALongDrama){try{sessionStorage.setItem(STORE_KEY,JSON.stringify(value));window.dispatchEvent(new CustomEvent('monia-long-drama',{detail:value}))}catch{}}
export function readLongDrama():MonIALongDrama|null{try{const raw=sessionStorage.getItem(STORE_KEY);return raw?JSON.parse(raw) as MonIALongDrama:null}catch{return null}}

function framingSequence(base:MonIAFraming,count:number):MonIAFraming[]{
  const pool:MonIAFraming[]=['chest','close','waist','chest','close','full-body','chest','waist'];
  if(base==='two-shot')return Array.from({length:count},(_,i)=>i%3===0?'two-shot':i%3===1?'close':'chest');
  if(base==='full-body')pool[0]='full-body';
  return Array.from({length:count},(_,i)=>i===0?base:pool[i%pool.length]);
}

function shotPlan(base:MonIAMediaPlan,index:number,count:number,framing:MonIAFraming):MonIAMediaPlan{
  const progress=(index+1)/count;
  const phase=progress<.34?'beginning':progress<.72?'middle':'ending';
  const action=`${base.visual.action}. This is shot ${index+1}/${count} of the same continuous scene (${phase}). Preserve exact wardrobe, room, lighting, hair and identity continuity from the previous shot. Add only subtle natural evolution: breathing, eye contact, posture shift, hand movement or a small reaction. Do not invent a new story event.`;
  return {...base,visual:{...base.visual,framing,action,durationTarget:Math.min(6,Math.max(3,base.assembly.clipDurationRange[1]))},assembly:{...base.assembly,multiShot:false,targetSceneDuration:Math.min(6,base.assembly.clipDurationRange[1])}};
}

async function urlToFile(url:string,index:number){const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error(`source plan ${index+1} inaccessible · HTTP ${r.status}`);const blob=await r.blob();return new File([blob],`monia-drama-shot-${index+1}.png`,{type:blob.type||'image/png'})}
function videoPrompt(plan:MonIAMediaPlan,index:number,count:number){return `Photorealistic live-action vertical mini-drama shot ${index+1}/${count}. Exact same identity as source image. ${plan.actor}. ${plan.visual.action}. Location: ${plan.visual.location}. Framing: ${plan.visual.framing}. Emotion: ${plan.visual.emotion}. Natural breathing, blinking, eye movement, head/body motion, realistic clothing motion, cinematic camera stability. Strict continuity of face, wardrobe, hair, room and lighting. No text, title, subtitles, watermark, UI, morphing or identity drift.`}

export async function materializeLongDrama(experience:MonIAExperienceResult,onProgress?:(value:MonIALongDrama)=>void):Promise<MonIALongDrama>{
  const plan=experience.mediaPlan;
  const target=Math.max(12,Math.min(60,plan.assembly.targetSceneDuration||30));
  const estimatedClip=5;
  const count=Math.max(3,Math.min(8,Math.ceil(target/estimatedClip)));
  const framings=framingSequence(plan.visual.framing,count);
  const drama:MonIALongDrama={id:`long-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:experience.response.text.slice(0,80)||'Scène MonIA',state:'queued',targetDuration:target,clips:Array.from({length:count},(_,i)=>({id:`shot-${i+1}`,index:i,framing:framings[i],state:'queued'})),errors:[]};
  if(active)return drama;
  active=true;write(drama);onProgress?.(drama);
  try{
    drama.state='generating';write(drama);
    for(let i=0;i<count;i++){
      const clip=drama.clips[i];const shot=shotPlan(plan,i,count,framings[i]);
      try{
        clip.state='image';write(drama);onProgress?.(drama);
        const image=await generateAutonomousSourceImage({plan:shot});
        if(image.state!=='ready'||!image.imageUrl)throw new Error(image.error||'image source indisponible');
        clip.imageUrl=image.imageUrl;
        const file=await urlToFile(image.imageUrl,i);
        clip.state='video';write(drama);onProgress?.(drama);
        const video=await generateFreeCanonVideo({referenceFile:file,prompt:videoPrompt(shot,i,count)});
        if(video.state!=='ready'||!video.videoUrl)throw new Error(video.error||'vidéo indisponible');
        clip.videoUrl=video.videoUrl;clip.state='ready';write(drama);onProgress?.(drama);
      }catch(error){clip.state='error';clip.error=error instanceof Error?error.message:String(error);drama.errors.push(`${clip.id}: ${clip.error}`);write(drama);onProgress?.(drama)}
    }
    const ready=drama.clips.filter(c=>c.state==='ready').length;
    drama.state=ready===count?'ready':ready>1?'partial':'error';write(drama);onProgress?.(drama);return drama;
  }finally{active=false}
}

export function playLongDrama(drama=readLongDrama()){
  if(!drama)return;const urls=drama.clips.filter(c=>c.state==='ready'&&c.videoUrl).map(c=>c.videoUrl!) ;if(!urls.length)return;
  document.getElementById('moniaLongDramaOverlay')?.remove();
  const overlay=document.createElement('div');overlay.id='moniaLongDramaOverlay';overlay.style.cssText='position:fixed;inset:0;z-index:99998;background:#050403;color:white;display:grid;place-items:center;font-family:system-ui,sans-serif';
  overlay.innerHTML=`<video id="moniaLongDramaVideo" playsinline autoplay style="width:100%;height:100%;object-fit:cover;background:#000"></video><button id="moniaLongDramaClose" style="position:absolute;top:22px;right:22px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:white;font-size:24px">×</button><div id="moniaLongDramaCounter" style="position:absolute;left:20px;bottom:20px;padding:8px 11px;border-radius:999px;background:rgba(0,0,0,.48);font-size:12px"></div>`;
  document.body.appendChild(overlay);const video=overlay.querySelector<HTMLVideoElement>('#moniaLongDramaVideo')!;const counter=overlay.querySelector<HTMLElement>('#moniaLongDramaCounter')!;let index=0;
  const next=()=>{if(index>=urls.length){overlay.remove();return}video.src=urls[index];counter.textContent=`Plan ${index+1}/${urls.length}`;index++;void video.play().catch(()=>undefined)};video.onended=next;overlay.querySelector('#moniaLongDramaClose')?.addEventListener('click',()=>overlay.remove());next();
}

console.info('[MonIA] Autonomous multi-shot long drama runtime ready');
