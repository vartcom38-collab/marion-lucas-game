import { moniaCreativeVault, type MonIAAsset } from './creative-vault';

const BLOCKED_HINTS=['candidate','intro-lucas','generated/intro-lucas'];

function isLiveSafe(asset:MonIAAsset){
  if(asset.status!=='approved'||asset.kind!=='visio')return false;
  if(String(asset.actor||'').toLowerCase()!=='lucas')return false;
  if(asset.metadata?.liveAllowed!==true)return false;
  const url=String(asset.url||'').toLowerCase();
  return !!url&&!BLOCKED_HINTS.some(x=>url.includes(x));
}
async function approvedLucasVisio(){
  const assets=await moniaCreativeVault.approvedAssets({kind:'visio',actor:'Lucas'}).catch(()=>[]);
  return assets.find(isLiveSafe)||null;
}
function neutralize(video:HTMLVideoElement){
  try{video.pause()}catch{}
  video.removeAttribute('src');video.load();video.style.display='none';
  const parent=video.parentElement;if(parent&&!parent.querySelector('.moniaNeutralVisio')){const neutral=document.createElement('div');neutral.className='moniaNeutralVisio';neutral.innerHTML='<div class="moniaNeutralAvatar">L</div><strong>Lucas</strong><span>Caméra indisponible pour ce moment</span>';parent.prepend(neutral)}
}
function apply(video:HTMLVideoElement,asset:MonIAAsset|null){
  if(!asset){neutralize(video);return}
  video.style.display='';video.src=asset.url;video.muted=true;video.loop=true;video.playsInline=true;video.closest('.callPoster,.callLive')?.querySelector('.moniaNeutralVisio')?.remove();
  if(video.autoplay)void video.play().catch(()=>undefined);
  void moniaCreativeVault.markUsed(asset.id).catch(()=>undefined);
}
let cached:MonIAAsset|null|undefined;
async function secureAll(){
  if(cached===undefined)cached=await approvedLucasVisio();
  document.querySelectorAll<HTMLVideoElement>('.callPoster video,.callLive video').forEach(video=>apply(video,cached||null));
}
const observer=new MutationObserver(()=>{void secureAll()});observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('storage',()=>{cached=undefined;void secureAll()});setInterval(()=>{void secureAll()},1500);void secureAll();

declare global{interface Window{__moniaApprovedLucasVisio?:()=>Promise<MonIAAsset|null>}}
window.__moniaApprovedLucasVisio=approvedLucasVisio;
