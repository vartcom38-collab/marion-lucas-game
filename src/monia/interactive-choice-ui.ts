import './interactive-resume-runner';
import { readInteractiveScene, type MonIAInteractiveScene } from './interactive-scene';

const ID='moniaInteractiveChoiceOverlay';
const MEDIA_ID='moniaInteractiveSceneMedia';
const MEDIA_VIDEO_ID='moniaInteractiveSceneMediaVideo';
const TRANSITION_ID='moniaInteractiveTransition';

function remove(){document.getElementById(ID)?.remove()}
function removeMedia(){document.getElementById(MEDIA_ID)?.remove();document.getElementById(`${MEDIA_ID}Outgoing`)?.remove()}
function removeTransition(){document.getElementById(TRANSITION_ID)?.remove()}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))}

function showTransition(label='La scène continue…'){
  let node=document.getElementById(TRANSITION_ID);
  if(!node){node=document.createElement('div');node.id=TRANSITION_ID;node.style.cssText='position:fixed;z-index:99996;left:50%;bottom:28px;transform:translateX(-50%);pointer-events:none;padding:8px 12px;border-radius:999px;background:rgba(15,13,12,.54);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.82);font:550 12px/1.2 system-ui,sans-serif;letter-spacing:.01em;box-shadow:0 8px 28px rgba(0,0,0,.18)';document.body.appendChild(node)}
  node.textContent=label;
}

async function canvasFrame(video:HTMLVideoElement,fileName:string):Promise<File|undefined>{
  if(!video.videoWidth||!video.videoHeight)return undefined;
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  const ctx=canvas.getContext('2d');if(!ctx)return undefined;
  try{ctx.drawImage(video,0,0,canvas.width,canvas.height)}catch{return undefined}
  try{const blob=await new Promise<Blob|undefined>(resolve=>canvas.toBlob(value=>resolve(value||undefined),'image/png',1));return blob?new File([blob],fileName,{type:'image/png'}):undefined}catch{return undefined}
}

async function captureFetchedFrame(source:HTMLVideoElement):Promise<File|undefined>{
  const url=source.currentSrc||source.src;if(!url)return undefined;
  try{
    const response=await fetch(url,{mode:'cors'});if(!response.ok)return undefined;
    const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);
    const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
    try{
      await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(new Error('continuity metadata unavailable'));video.src=objectUrl;video.load()});
      const sourceDuration=Number.isFinite(source.duration)&&source.duration>0?source.duration:video.duration;
      const ratio=sourceDuration>0?Math.max(0,Math.min(1,source.currentTime/sourceDuration)):1;
      const target=Math.max(0,(Number.isFinite(video.duration)?video.duration:0)*ratio-.02);
      await new Promise<void>((resolve,reject)=>{video.onseeked=()=>resolve();video.onerror=()=>reject(new Error('continuity seek unavailable'));try{video.currentTime=target}catch(error){reject(error)}});
      return await canvasFrame(video,`monia-interactive-continuity-${Date.now()}.png`);
    }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(objectUrl)}
  }catch{return undefined}
}

async function captureCurrentFrame():Promise<File|undefined>{
  const video=document.getElementById(MEDIA_VIDEO_ID) as HTMLVideoElement|null;
  if(!video)return undefined;
  const direct=await canvasFrame(video,`monia-interactive-continuity-${Date.now()}.png`);if(direct)return direct;
  return captureFetchedFrame(video);
}

function holdCurrentVisual(){
  const video=document.getElementById(MEDIA_VIDEO_ID) as HTMLVideoElement|null;
  if(video){try{video.pause()}catch{};video.removeAttribute('autoplay')}
  showTransition('Lucas réagit…');
}

async function dispatchInput(scene:MonIAInteractiveScene,input:{choiceId?:string;freeText?:string}){
  const continuityFrame=await captureCurrentFrame();
  holdCurrentVisual();
  window.dispatchEvent(new CustomEvent('monia-interactive-player-input',{detail:{sceneId:scene.id,...input,continuityFrame,continuityFrameStatus:continuityFrame?'captured':'unavailable'}}));
  remove();
}

function render(scene:MonIAInteractiveScene){
  remove();
  if(scene.state==='error'){removeTransition();return}
  if(scene.state!=='awaiting-choice')return;
  removeTransition();
  const overlay=document.createElement('div');overlay.id=ID;
  overlay.style.cssText='position:fixed;inset:0;z-index:99997;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;padding:0 22px 34px;font-family:system-ui,sans-serif';
  const choices=scene.choices.map((choice,index)=>`<button data-choice="${escapeHtml(choice.id)}" style="pointer-events:auto;border:1px solid rgba(255,255,255,.22);background:rgba(18,15,13,.72);backdrop-filter:blur(16px);color:white;border-radius:18px;padding:13px 16px;text-align:left;font-size:14px;line-height:1.3;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.22)"><span style="opacity:.6;margin-right:8px">${index+1}</span>${escapeHtml(choice.label)}</button>`).join('');
  overlay.innerHTML=`<div style="width:min(820px,100%);display:grid;gap:10px"><div style="display:grid;gap:8px">${choices}</div><form id="moniaInteractiveFreeForm" style="pointer-events:auto;display:flex;gap:8px;background:rgba(18,15,13,.68);backdrop-filter:blur(16px);padding:8px;border-radius:18px;border:1px solid rgba(255,255,255,.16)"><input id="moniaInteractiveFreeInput" autocomplete="off" placeholder="Dire ou faire autre chose…" style="flex:1;min-width:0;border:0;outline:0;background:transparent;color:white;padding:9px 10px;font-size:14px"><button type="submit" style="border:0;border-radius:12px;padding:9px 14px;background:rgba(255,255,255,.92);color:#17120f;font-weight:650;cursor:pointer">Continuer</button></form></div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(button=>button.addEventListener('click',()=>{const choiceId=button.dataset.choice;if(!choiceId)return;void dispatchInput(scene,{choiceId})}));
  overlay.querySelector<HTMLFormElement>('#moniaInteractiveFreeForm')?.addEventListener('submit',event=>{event.preventDefault();const input=overlay.querySelector<HTMLInputElement>('#moniaInteractiveFreeInput');const freeText=input?.value.trim()||'';if(!freeText)return;void dispatchInput(scene,{freeText})});
}

function playMaterialized(detail:any){
  const media=detail?.media||{};const videoUrl=String(media.videoUrl||'');const imageUrl=String(media.imageUrl||'');if(!videoUrl&&!imageUrl)return;
  const outgoing=document.getElementById(MEDIA_ID) as HTMLElement|null;if(outgoing)outgoing.id=`${MEDIA_ID}Outgoing`;
  const layer=document.createElement('div');layer.id=MEDIA_ID;layer.style.cssText='position:fixed;inset:0;z-index:99991;background:#050403;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .18s ease';document.body.appendChild(layer);
  const reveal=()=>{requestAnimationFrame(()=>layer.style.opacity='1');window.setTimeout(()=>{document.getElementById(`${MEDIA_ID}Outgoing`)?.remove();removeTransition()},190)};
  if(videoUrl){
    const video=document.createElement('video');video.id=MEDIA_VIDEO_ID;video.crossOrigin='anonymous';video.autoplay=true;video.playsInline=true;video.controls=false;video.preload='auto';video.muted=media.voiceAudioUrl&&!media.speechEngine;video.style.cssText='width:100%;height:100%;object-fit:cover;background:#000';video.src=videoUrl;layer.appendChild(video);
    video.addEventListener('canplay',reveal,{once:true});video.addEventListener('error',()=>{layer.remove();if(outgoing)outgoing.id=MEDIA_ID;removeTransition()},{once:true});void video.play().catch(()=>undefined);
  }else{
    const image=document.createElement('img');image.crossOrigin='anonymous';image.alt='';image.style.cssText='width:100%;height:100%;object-fit:cover;background:#000';image.onload=reveal;image.onerror=()=>{layer.remove();if(outgoing)outgoing.id=MEDIA_ID;removeTransition()};image.src=imageUrl;layer.appendChild(image);
  }
}

window.addEventListener('monia-interactive-scene',event=>render((event as CustomEvent<MonIAInteractiveScene>).detail));
window.addEventListener('monia-interactive-media-ready',event=>playMaterialized((event as CustomEvent).detail));
window.addEventListener('beforeunload',()=>{remove();removeMedia();removeTransition()});
const current=readInteractiveScene();if(current){render(current);if(current.lastMediaUrl)playMaterialized({media:{videoUrl:current.lastMediaUrl}})}
console.info('[MonIA] Interactive player active · hold previous visual while branch renders · captured-frame continuity · seamless crossfade to validated next media');
