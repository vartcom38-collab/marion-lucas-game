import { consumeNextSurpriseScene, peekNextSurpriseScene, type SurpriseDelivery } from './surprise-delivery';

const OVERLAY_ID='moniaSurpriseScenePlayer';
let playing=false;

function routeAllowedNow(route:string){
  try{
    const raw=localStorage.getItem('marion-lucas-save-v4');
    if(!raw)return true;
    const save=JSON.parse(raw) as {place?:string;metLucas?:boolean;flags?:Record<string,unknown>};
    if(!save.metLucas)return false;
    if(save.flags?.moniaSmsPending)return false;
    if(route.includes('couple')||route.includes('family')){
      const physical=String(save.flags?.moniaPhysicalCoPresence||'').toLowerCase();
      if(physical==='false'||physical==='0'||physical==='no')return false;
    }
    return true;
  }catch{return true}
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
  if(!routeAllowedNow(delivery.route))return false;
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
  const finish=()=>closeOverlay(root);
  video.addEventListener('ended',finish,{once:true});
  video.addEventListener('error',finish,{once:true});
  skip.addEventListener('click',finish,{once:true});
  root.append(video,skip);
  document.body.appendChild(root);
  const consumed=consumeNextSurpriseScene(delivery.route);
  if(!consumed){finish();return false}
  window.dispatchEvent(new CustomEvent('monia:surprise-playback-started',{detail:{route:delivery.route,assetId:delivery.assetId}}));
  void video.play().catch(()=>{
    video.controls=true;
  });
  return true;
}

export function playNextApprovedSurpriseScene(route?:string){
  if(!canPresent())return false;
  const next=peekNextSurpriseScene(route);
  if(!next||!routeAllowedNow(next.route))return false;
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
