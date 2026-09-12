const FALLBACK='./resources/photo.png';

function bindImage(img:HTMLImageElement){
  if(img.dataset.visualGuard==='1')return;
  img.dataset.visualGuard='1';
  const fallback=()=>{
    if(img.dataset.visualFallback==='1')return;
    img.dataset.visualFallback='1';
    img.classList.add('visualFallback');
    img.src=FALLBACK;
  };
  img.addEventListener('error',fallback);
  if(img.complete&&img.naturalWidth===0)fallback();
}

function scan(){
  document.querySelectorAll<HTMLImageElement>('.worldPhoto').forEach(bindImage);
}

new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
scan();

console.info('[World] Exterior image resilience guard active');
