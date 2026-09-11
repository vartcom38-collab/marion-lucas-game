import { consumeSurpriseScene, isSurpriseDeliveryContextValid, peekNextSurpriseScene, type SurpriseDelivery } from './surprise-delivery';

const OVERLAY_ID='moniaSurpriseScenePlayer';
let playing=false;

function routeAllowedNow(delivery:SurpriseDelivery){
  try{
    const raw=localStorage.getItem('marion-lucas-save-v4');
    if(!raw)return isSurpriseDeliveryContextValid(delivery);
    const save=JSON.parse(raw) as {metLucas?:boolean;flags?:Record<string,unknown>};
    if(!save.metLucas)return false;
    if(save.flags?.moniaSmsPending)return false;
    return isSurpriseDeliveryContextValid(delivery);
  }catch{return isSurpriseDeliveryContextValid(delivery)}
}

function canPresent(){
  if(playing||document.hidden)return false;
  if(document.getElementById(OVERLAY_ID))return false;
  if(document.getElementById('moniaDramaScene')||document.getElementById('moniaSceneOffer'))return false;
  return true;
}

function closeOverlay(root:HTMLElement){
  playing=false;
  root.remove();
  window.dispatchEvent(new CustomEvent('monia:surprise-playback-ended'));
}

function renderScene(delivery:SurpriseDelivery){
  if(!canPresent())return false;
  if(!routeAllowedNow(delivery))return false;
  playing=true;
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
  window.setTimeout(()=>{void playNextApprovedSurpriseScene(route)},450);
}

window.addEventListener('monia:surprise-scene-ready',(event)=>{
  const route=String((event as CustomEvent<{route?:string}>).detail?.route||'');
  tryAutoPlay(route||undefined);
});
window.addEventListener('monia:surprise-playback-ended',()=>tryAutoPlay());
window.addEventListener('focus',()=>tryAutoPlay());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tryAutoPlay()});

tryAutoPlay();

declare global{
  interface Window{
    __moniaPlayNextSurpriseScene?:(route?:string)=>boolean;
  }
}
window.__moniaPlayNextSurpriseScene=playNextApprovedSurpriseScene;
