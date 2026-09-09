import './homeLiving.css';

let mounted:HTMLElement|null=null;
let idleTimer=0;
let discoveryTimers:number[]=[];
let discoveryCursor=0;
let firstControlAt=0;
let hasActed=false;
let echoTimer=0;
let moveFrame=0;
let lastPointer:PointerEvent|null=null;

function clearDiscovery(){for(const t of discoveryTimers)window.clearTimeout(t);discoveryTimers=[]}

function revealOne(stage:HTMLElement,delay=0){
  if(hasActed)return;
  clearDiscovery();
  const hotspots=[...stage.querySelectorAll<HTMLElement>('.gameHotspot')].filter(h=>h.offsetParent!==null);
  if(!hotspots.length)return;
  const target=hotspots[discoveryCursor%hotspots.length];
  discoveryCursor=(discoveryCursor+1)%hotspots.length;
  discoveryTimers.push(window.setTimeout(()=>target.classList.add('is-discovering'),delay));
  discoveryTimers.push(window.setTimeout(()=>target.classList.remove('is-discovering'),delay+1200));
}

function scheduleGentleDiscovery(stage:HTMLElement){
  if(hasActed)return;
  clearDiscovery();
  const elapsed=firstControlAt?Date.now()-firstControlAt:99999;
  const delay=Math.max(2200,7600-elapsed);
  discoveryTimers.push(window.setTimeout(()=>{
    const game=stage.closest('.immersivePlayable');
    if(hasActed||!game||game.querySelector('.overlay.open,.eventOverlay,.incomingCallOverlay'))return;
    revealOne(stage);
  },delay));
}

function actionLabel(hotspot:HTMLElement){
  const label=hotspot.querySelector<HTMLElement>('span')?.textContent?.trim()||hotspot.getAttribute('aria-label')?.trim()||'';
  return label.replace(/^(observer|voir|ouvrir|aller|utiliser)\s+/i,'').slice(0,42);
}

function feedback(stage:HTMLElement,hotspot:HTMLElement,e:PointerEvent){
  hasActed=true;clearDiscovery();
  hotspot.classList.remove('is-discovering');hotspot.classList.add('is-pressed');
  window.setTimeout(()=>hotspot.classList.remove('is-pressed'),360);
  const r=stage.getBoundingClientRect();
  const pulse=document.createElement('i');pulse.className='homeTouchPulse';pulse.style.left=`${e.clientX-r.left}px`;pulse.style.top=`${e.clientY-r.top}px`;stage.appendChild(pulse);window.setTimeout(()=>pulse.remove(),560);
  const label=actionLabel(hotspot);
  if(label){
    stage.querySelector('.homeActionEcho')?.remove();
    const echo=document.createElement('div');echo.className='homeActionEcho';echo.textContent=label;stage.appendChild(echo);
    if(echoTimer)window.clearTimeout(echoTimer);echoTimer=window.setTimeout(()=>{echo.classList.add('is-leaving');window.setTimeout(()=>echo.remove(),220)},650);
  }
  if((e.pointerType==='touch'||e.pointerType==='pen')&&'vibrate' in navigator){try{navigator.vibrate(6)}catch{}}
}

function updatePointer(stage:HTMLElement,game:HTMLElement|null){
  moveFrame=0;
  const e=lastPointer;
  lastPointer=null;
  if(!e||!stage.isConnected)return;
  const hotspots=[...stage.querySelectorAll<HTMLElement>('.gameHotspot')];
  for(const h of hotspots){
    const hr=h.getBoundingClientRect();
    const dx=e.clientX-(hr.left+hr.width/2),dy=e.clientY-(hr.top+hr.height/2);
    h.classList.toggle('is-near',Math.hypot(dx,dy)<96);
  }
  game?.classList.remove('home-ui-idle');
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
    idleTimer=window.setTimeout(()=>game?.classList.add('home-ui-idle'),6800);
  };
  const move=(e:PointerEvent)=>{
    lastPointer=e;
    if(!moveFrame)moveFrame=requestAnimationFrame(()=>updatePointer(stage,game));
    wake();
  };
  stage.addEventListener('pointermove',move,{passive:true});
  stage.addEventListener('pointerleave',()=>{
    if(moveFrame){cancelAnimationFrame(moveFrame);moveFrame=0}
    lastPointer=null;
    stage.querySelectorAll('.gameHotspot.is-near').forEach(x=>x.classList.remove('is-near'));
  },{passive:true});
  stage.addEventListener('pointerdown',(e)=>{
    wake();
    const target=e.target as HTMLElement|null;
    const hotspot=target?.closest<HTMLElement>('.gameHotspot')||null;
    if(hotspot)feedback(stage,hotspot,e);
    else if((e.pointerType==='touch'||e.pointerType==='pen'))revealOne(stage,140);
  },{passive:true});
  ['keydown','wheel','touchstart'].forEach(ev=>game?.addEventListener(ev,wake,{passive:true} as AddEventListenerOptions));
  wake();
  scheduleGentleDiscovery(stage);
}

function scan(){
  const stage=document.getElementById('homePhotoStage');
  if(stage instanceof HTMLElement)install(stage);
}

window.addEventListener('marion-home-first-control',()=>{
  firstControlAt=Date.now();
  const stage=document.getElementById('homePhotoStage');
  if(stage instanceof HTMLElement)scheduleGentleDiscovery(stage);
});

new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
scan();
