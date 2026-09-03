import type { MonIAMaterializedMedia } from './experience-runtime';

const VISIO_MEDIA_KEY='monia-last-visio-media-v1';
const OVERLAY_ID='moniaVisioOverlay';

type LiveState='connecting'|'listening'|'speaking'|'media-error';
type StateMedia={base?:string;listening?:string;speaking?:string;reaction?:string;status?:string};

function loadMedia():MonIAMaterializedMedia|null{
  try{const raw=sessionStorage.getItem(VISIO_MEDIA_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}
}
function stateMedia():StateMedia|null{try{return window.__moniaVisioStates?.()||null}catch{return null}}

function ensureStatus(overlay:HTMLElement){
  let badge=overlay.querySelector<HTMLElement>('[data-monia-live-state]');
  if(badge)return badge;
  badge=document.createElement('div');
  badge.dataset.moniaLiveState='connecting';
  badge.style.cssText='position:absolute;z-index:4;top:88px;left:24px;padding:7px 11px;border-radius:999px;background:rgba(0,0,0,.48);backdrop-filter:blur(9px);font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.03em;color:#fff;border:1px solid rgba(255,255,255,.15)';
  overlay.appendChild(badge);
  return badge;
}

function setState(overlay:HTMLElement,state:LiveState){
  const badge=ensureStatus(overlay);
  badge.dataset.moniaLiveState=state;
  badge.textContent=state==='connecting'?'● Connexion vidéo…':state==='speaking'?'● Lucas parle':state==='listening'?'● Lucas écoute':'● Vidéo indisponible';
}

function preferredUrl(state:LiveState,base?:string){
  const states=stateMedia();
  if(state==='speaking')return states?.speaking||states?.reaction||states?.base||base||'';
  if(state==='listening')return states?.listening||states?.base||base||'';
  return states?.base||base||'';
}

function installVideo(overlay:HTMLElement,url:string,state:LiveState){
  if(!url)return null;
  const existing=overlay.querySelector<HTMLVideoElement>('#moniaVisioVideo');
  if(existing){
    const absolute=new URL(url,location.href).href;
    if(existing.src!==absolute){existing.style.opacity='.55';existing.src=url;existing.load();void existing.play().catch(()=>undefined);requestAnimationFrame(()=>existing.style.opacity='1')}
    existing.dataset.moniaVisualState=state;
    return existing;
  }
  const firstLayer=overlay.firstElementChild as HTMLElement|null;
  if(!firstLayer)return null;
  const placeholder=firstLayer.querySelector<HTMLElement>('div[style*="place-items:center"]');
  const video=document.createElement('video');
  video.id='moniaVisioVideo';video.dataset.moniaVisualState=state;video.src=url;video.autoplay=true;video.muted=true;video.loop=true;video.playsInline=true;
  video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#090807;transition:opacity .22s ease';
  if(placeholder)placeholder.replaceWith(video);else firstLayer.prepend(video);
  void video.play().catch(()=>undefined);
  return video;
}

function currentSpeechState():LiveState{
  if(!('speechSynthesis' in window))return 'listening';
  return window.speechSynthesis.speaking||window.speechSynthesis.pending?'speaking':'listening';
}

function refresh(){
  const overlay=document.getElementById(OVERLAY_ID);if(!overlay)return;
  const media=loadMedia();
  if(media?.state==='ready'&&media.videoUrl){
    const state=currentSpeechState();
    installVideo(overlay,preferredUrl(state,media.videoUrl),state);
    setState(overlay,state);return;
  }
  if(media?.state==='image-failed'||media?.state==='video-failed'){setState(overlay,'media-error');return}
  setState(overlay,'connecting');
}

let lastSpeaking=false;
window.setInterval(()=>{
  const overlay=document.getElementById(OVERLAY_ID);if(!overlay)return;
  refresh();
  if('speechSynthesis' in window){const speaking=window.speechSynthesis.speaking||window.speechSynthesis.pending;if(speaking!==lastSpeaking){lastSpeaking=speaking;refresh()}}
},500);

window.addEventListener('storage',refresh);
window.addEventListener('monia-visio-state-media',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

declare global{interface Window{__moniaVisioStates?:()=>StateMedia|null}}

console.info('[MonIA] Live visio state runtime active with generated listening/speaking clips');
