import './immersiveNavigation.css';

/*
 * The apartment is intentionally photo-first.
 * Any old 3D canvas/class left by a previous build is removed defensively so
 * the photoreal apartment image remains the playable backdrop.
 */
function restorePhotoHome(){
  const stages=document.querySelectorAll<HTMLElement>('.immersivePlayable .homePhotoStage');
  stages.forEach(stage=>{
    stage.classList.remove('live3DHome');
    stage.querySelector('#immersiveHome3D')?.remove();
    const img=stage.querySelector<HTMLImageElement>('img');
    if(img){
      img.style.display='block';
      img.style.visibility='visible';
      img.style.opacity='1';
    }
  });
}

let timer=0;
function schedule(){
  if(timer)window.clearTimeout(timer);
  timer=window.setTimeout(restorePhotoHome,40);
}

new MutationObserver(schedule).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',schedule);
schedule();

console.info('[Home] photoreal apartment photo runtime active; 3D disabled');
