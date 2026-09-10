import './immersiveNavigation.css';
import { EngineStore } from '@babylonjs/core';

let timer=0;

function stopHome3D(){
  for(const engine of [...EngineStore.Instances]){
    const canvas=engine.getRenderingCanvas();
    const id=canvas?.id||'';
    if(id==='world3d'||id==='world360'||id==='immersiveHome3D'){
      try{engine.stopRenderLoop()}catch{}
      try{engine.dispose()}catch{}
    }
  }
  document.querySelectorAll<HTMLCanvasElement>('#world3d,#world360,#immersiveHome3D').forEach(c=>c.remove());
  document.querySelectorAll<HTMLElement>('.homePhotoStage').forEach(stage=>{
    stage.classList.remove('live3DHome');
    let img=stage.querySelector<HTMLImageElement>(':scope > img');
    if(!img){
      img=document.createElement('img');
      img.src='./resources/appartement-nimes.png';
      img.alt='Appartement de Marion à Nîmes';
      stage.prepend(img);
    }
    img.style.removeProperty('display');
    img.style.removeProperty('visibility');
    img.style.removeProperty('opacity');
  });
}

function schedule(){
  if(timer)window.clearTimeout(timer);
  timer=window.setTimeout(stopHome3D,120);
}

new MutationObserver(records=>{
  if(records.some(r=>[...r.addedNodes].some(n=>n instanceof HTMLCanvasElement||n instanceof HTMLElement&&n.querySelector?.('#world3d,#world360,#immersiveHome3D,.homePhotoStage'))))schedule();
}).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});

window.addEventListener('visibilitychange',()=>{if(!document.hidden)stopHome3D()});
window.setTimeout(stopHome3D,0);
window.setTimeout(stopHome3D,500);
console.info('[Home] photo mode locked; Babylon home render loops are disabled');
