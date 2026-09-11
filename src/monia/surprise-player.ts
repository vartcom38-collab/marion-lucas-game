import { consumeSurpriseScene, isSurpriseDeliveryContextValid, peekNextSurpriseScene, type SurpriseDelivery } from './surprise-delivery';

const OVERLAY_ID='moniaSurpriseScenePlayer';
const SAVE_KEY='marion-lucas-save-v4';
const AUTO_COOLDOWN_MS=45000;
let playing=false;
let lastPlaybackFinishedAt=0;
let lastSaveSignature='';
let queuedOpportunity=false;

function readSave(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    return raw?JSON.parse(raw) as {day?:number;time?:string;place?:string;relationship?:number;messages?:Array<{from?:string;text?:string}>;eventHistory?:string[];metLucas?:boolean;flags?:Record<string,unknown>}:null;
  }catch{return null}
}

function saveSignature(){
  const save=readSave();
  if(!save)return'';
  const message=save.messages?.[0];
  const event=save.eventHistory?.[save.eventHistory.length-1]||'';
  return `${save.day||0}|${save.time||''}|${save.place||''}|${save.relationship||0}|${message?.from||''}:${message?.text||''}|${event}`.slice(0,900);
}

function routeAllowedNow(delivery:SurpriseDelivery){
  const save=readSave();
  if(save){
    if(!save.metLucas)return false;
    if(save.flags?.moniaSmsPending)return false;
  }
  return isSurpriseDeliveryContextValid(delivery);
}

function canPresent(auto=false){
  if(playing||document.hidden)return false;
  if(document.getElementById(OVERLAY_ID))return false;
  if(document.getElementById('moniaDramaScene')||document.getElementById('moniaSceneOffer'))return false;
  if(auto&&lastPlaybackFinishedAt&&Date.now()-lastPlaybackFinishedAt<AUTO_COOLDOWN_MS)return false;
  return true;
}

function closeOverlay(root:HTMLElement){
  playing=false;
  lastPlaybackFinishedAt=Date.now();
  root.remove();
  window.dispatchEvent(new CustomEvent('monia:surprise-playback-ended'));
}

function renderScene(delivery:SurpriseDelivery){
  if(!canPresent())return false;
  if(!routeAllowedNow(delivery))return false;
  playing=true;
  queuedOpportunity=false;
  const root=document.createElement('div');
  root.id=OVERLAY_ID;
  root.setAttribute('role','dialog');
  root.setAttribute('aria-label','Scène');
  root.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:center;justify-content:center;';
  const video=document.createElement('video');
  video.src=delivery.videoUrl;
  video.autoplay=true;
  video.playsInline=true;
  video.controls=false;
  video.preload='auto';
  video.style.cssText='width:100%;height:100%;object-fit:contain;background:#000;';
  const skip=document.createElement('button');
  skip.type='button';
  skip.textContent='Passer';
  skip.setAttribute('aria-label','Passer la scène');
  skip.style.cssText='position:absolute;right:18px;top:18px;border:0;border-radius:999px;padding:10px 14px;background:rgba(0,0,0,.45);color:#fff;font:600 14px system-ui;backdrop-filter:blur(8px);cursor:pointer;';
  let finished=false;
  const finish=(consume:boolean,reason:'ended'|'skipped'|'error')=>{
    if(finished)return;
    finished=true;
    if(consume)consumeSurpriseScene(delivery.assetId);
    window.dispatchEvent(new CustomEvent('monia:surprise-playback-result',{detail:{route:delivery.route,assetId:delivery.assetId,reason,consumed:consume}}));
    closeOverlay(root);
  };
  video.addEventListener('ended',()=>finish(true,'ended'),{once:true});
  video.addEventListener('error',()=>finish(false,'error'),{once:true});
  skip.addEventListener('click',()=>finish(true,'skipped'),{once:true});
  root.append(video,skip);
  document.body.appendChild(root);
  window.dispatchEvent(new CustomEvent('monia:surprise-playback-started',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  void video.play().catch(()=>{
    video.controls=true;
    window.dispatchEvent(new CustomEvent('monia:surprise-playback-needs-user-action',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  });
  return true;
}

export function playNextApprovedSurpriseScene(route?:string){
  if(!canPresent())return false;
  const next=peekNextSurpriseScene(route);
  if(!next||!routeAllowedNow(next))return false;
  return renderScene(next);
}

function tryAutoPlay(route?:string){
  if(!canPresent(true))return false;
  const next=peekNextSurpriseScene(route);
  if(!next||!routeAllowedNow(next))return false;
  return renderScene(next);
}

function signalOpportunity(route?:string){
  queuedOpportunity=true;
  window.setTimeout(()=>{
    if(!queuedOpportunity)return;
    void tryAutoPlay(route);
  },650);
}

window.addEventListener('monia:surprise-scene-ready',(event)=>{
  const route=String((event as CustomEvent<{route?:string}>).detail?.route||'');
  signalOpportunity(route||undefined);
});
window.addEventListener('monia:surprise-scene-opportunity',(event)=>{
  const route=String((event as CustomEvent<{route?:string}>).detail?.route||'');
  signalOpportunity(route||undefined);
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){
    lastSaveSignature=saveSignature();
  }
});

lastSaveSignature=saveSignature();
window.setInterval(()=>{
  if(document.hidden||playing)return;
  const nextSignature=saveSignature();
  if(!nextSignature||nextSignature===lastSaveSignature)return;
  lastSaveSignature=nextSignature;
  signalOpportunity();
},1800);

declare global{
  interface Window{
    __moniaPlayNextSurpriseScene?:(route?:string)=>boolean;
    __moniaSignalSurpriseOpportunity?:(route?:string)=>void;
  }
}
window.__moniaPlayNextSurpriseScene=playNextApprovedSurpriseScene;
window.__moniaSignalSurpriseOpportunity=signalOpportunity;
