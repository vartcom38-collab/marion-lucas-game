import './homeLiving.css';

let mounted:HTMLElement|null=null;
let idleTimer=0;
let discoveryTimers:number[]=[];

function clearDiscovery(){for(const t of discoveryTimers)window.clearTimeout(t);discoveryTimers=[]}

function pulseHotspots(stage:HTMLElement){
  clearDiscovery();
  const hotspots=[...stage.querySelectorAll<HTMLElement>('.gameHotspot')].slice(0,5);
  hotspots.forEach((h,index)=>{
    discoveryTimers.push(window.setTimeout(()=>h.classList.add('is-discovering'),450+index*430));
    discoveryTimers.push(window.setTimeout(()=>h.classList.remove('is-discovering'),1450+index*430));
  });
}

function install(stage:HTMLElement){
  if(stage===mounted)return;
  mounted=stage;
  if(!stage.querySelector('.homeLivingWindow')){
    for(const cls of ['homeLivingWindow','homeLivingShadow','homeLivingAir','homeLivingGlass']){
      const layer=document.createElement('div');
      layer.className=`homeLivingLayer ${cls}`;
      stage.appendChild(layer);
    }
  }
  const game=stage.closest('.immersivePlayable') as HTMLElement|null;
  const wake=()=>{
    game?.classList.remove('home-ui-idle');
    if(idleTimer)window.clearTimeout(idleTimer);
    idleTimer=window.setTimeout(()=>game?.classList.add('home-ui-idle'),4200);
  };
  const move=(e:PointerEvent)=>{
    const r=stage.getBoundingClientRect();
    const x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*18;
    const y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*12;
    stage.style.setProperty('--look-x',x.toFixed(2));
    stage.style.setProperty('--look-y',y.toFixed(2));
    const hotspots=[...stage.querySelectorAll<HTMLElement>('.gameHotspot')];
    for(const h of hotspots){
      const hr=h.getBoundingClientRect();
      const dx=e.clientX-(hr.left+hr.width/2),dy=e.clientY-(hr.top+hr.height/2);
      h.classList.toggle('is-near',Math.hypot(dx,dy)<110);
    }
    wake();
  };
  stage.addEventListener('pointermove',move,{passive:true});
  stage.addEventListener('pointerleave',()=>{
    stage.style.setProperty('--look-x','0');stage.style.setProperty('--look-y','0');
    stage.querySelectorAll('.gameHotspot.is-near').forEach(x=>x.classList.remove('is-near'));
  },{passive:true});
  stage.addEventListener('pointerdown',(e)=>{
    if((e.pointerType==='touch'||e.pointerType==='pen')){
      const target=e.target as HTMLElement|null;
      if(!target?.closest('.gameHotspot'))pulseHotspots(stage);
    }
  },{passive:true});
  ['pointerdown','keydown','wheel','touchstart'].forEach(ev=>game?.addEventListener(ev,wake,{passive:true} as AddEventListenerOptions));
  wake();
  pulseHotspots(stage);
}

function scan(){
  const stage=document.getElementById('homePhotoStage');
  if(stage instanceof HTMLElement)install(stage);
}

window.addEventListener('marion-home-first-control',()=>{
  const stage=document.getElementById('homePhotoStage');
  if(stage instanceof HTMLElement)pulseHotspots(stage);
});

new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
scan();
