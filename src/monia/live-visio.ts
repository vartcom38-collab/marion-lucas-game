import type { MonIAMaterializedMedia } from './experience-runtime';

const VISIO_MEDIA_KEY='monia-last-visio-media-v1';
const OVERLAY_ID='moniaVisioOverlay';

type LiveState='connecting'|'listening'|'speaking'|'media-error';

function loadMedia():MonIAMaterializedMedia|null{
  try{const raw=sessionStorage.getItem(VISIO_MEDIA_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}
}

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

function installVideo(overlay:HTMLElement,url:string){
  const existing=overlay.querySelector<HTMLVideoElement>('#moniaVisioVideo');
  if(existing){
    if(existing.src!==url)existing.src=url;
    return existing;
  }
  const firstLayer=overlay.firstElementChild as HTMLElement|null;
  if(!firstLayer)return null;
  const placeholder=firstLayer.querySelector<HTMLElement>('div[style*="place-items:center"]');
  const video=document.createElement('video');
  video.id='moniaVisioVideo';
  video.src=url;
  video.autoplay=true;
  video.muted=true;
  video.loop=true;
  video.playsInline=true;
  video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#090807';
  if(placeholder)placeholder.replaceWith(video);else firstLayer.prepend(video);
  void video.play().catch(()=>undefined);
  return video;
}

function speechState(overlay:HTMLElement){
  if(!('speechSynthesis' in window))return;
  if(window.speechSynthesis.speaking||window.speechSynthesis.pending)setState(overlay,'speaking');
  else setState(overlay,'listening');
}

function refresh(){
  const overlay=document.getElementById(OVERLAY_ID);
  if(!overlay)return;
  const media=loadMedia();
  if(media?.state==='ready'&&media.videoUrl){
    installVideo(overlay,media.videoUrl);
    speechState(overlay);
    return;
  }
  if(media?.state==='image-failed'||media?.state==='video-failed'){
    setState(overlay,'media-error');
    return;
  }
  setState(overlay,'connecting');
}

let lastSpeaking=false;
window.setInterval(()=>{
  const overlay=document.getElementById(OVERLAY_ID);
  if(!overlay)return;
  refresh();
  if('speechSynthesis' in window){
    const speaking=window.speechSynthesis.speaking||window.speechSynthesis.pending;
    if(speaking!==lastSpeaking){lastSpeaking=speaking;refresh()}
  }
},650);

window.addEventListener('storage',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

console.info('[MonIA] Live visio state runtime active');
