import './livingWorld.css';

const SAVE_KEY='marion-lucas-save-v4';
let mounted:HTMLElement|null=null;
let canvas:HTMLCanvasElement|null=null;
let ctx:CanvasRenderingContext2D|null=null;
let ambientVideo:HTMLVideoElement|null=null;
let raf=0;
let contextTimer=0;
let activePlace='';
let lastFrame=0;
let cachedSave:LooseSave|null=null;
let cachedPalette={dust:'255,244,221',drift:.72};
let particles:Array<{x:number;y:number;r:number;vx:number;vy:number;a:number;phase:number}>=[];

type LooseSave={time?:string;place?:string};

const coarse=window.matchMedia('(pointer:coarse)').matches;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower=coarse||reducedMotion||Math.min(window.innerWidth,window.innerHeight)<760;
const frameBudget=lowPower?42:30; // ~24 fps mobile, ~33 fps desktop

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}

function timeHour(time='12:00'){
  const h=Number(time.split(':')[0]);
  return Number.isFinite(h)?h:12;
}

function timePart(time='12:00'){
  const h=timeHour(time);
  if(h>=6&&h<12)return 'matin';
  if(h>=12&&h<18)return 'jour';
  if(h>=18&&h<21)return 'soir';
  return 'nuit';
}

function placeKind(place='home'){
  const p=place.toLowerCase();
  if(p==='home')return 'home';
  if(p==='nimes'||p==='cafe'||p==='station')return 'city';
  if(p==='arenes')return 'arena';
  if(p==='finca'||p==='estate'||p==='family')return 'country';
  return 'travel';
}

function palette(save:LooseSave|null){
  const h=timeHour(save?.time);
  const kind=placeKind(save?.place);
  const night=h>=21||h<6;
  const evening=h>=18&&h<21;
  const morning=h>=6&&h<11;
  const outdoors=kind!=='home';
  return {
    dust:night?'190,210,255':morning?'255,232,196':evening?'255,191,128':'255,244,221',
    drift:outdoors?(kind==='country'?1.7:1.35):.72,
  };
}

function refreshSaveCache(){
  cachedSave=readSave();
  cachedPalette=palette(cachedSave);
}

function ensureCanvas(game:HTMLElement){
  if(canvas?.isConnected&&canvas.parentElement===game)return;
  canvas?.remove();
  canvas=document.createElement('canvas');
  canvas.className='livingWorldCanvas';
  canvas.setAttribute('aria-hidden','true');
  game.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true});
  resize(game);
  seedParticles(game);
}

function ensureAtmosphere(game:HTMLElement){
  if(game.querySelector('.livingWorldAmbient'))return;
  const ambient=document.createElement('div');
  ambient.className='livingWorldAmbient';
  ambient.setAttribute('aria-hidden','true');
  ambient.innerHTML='<i class="lwLight"></i><i class="lwShadow"></i><i class="lwBreeze lwBreezeA"></i><i class="lwBreeze lwBreezeB"></i><i class="lwPresence lwPresenceA"></i><i class="lwPresence lwPresenceB"></i>';
  game.appendChild(ambient);
}

function resize(game:HTMLElement){
  if(!canvas)return;
  const r=game.getBoundingClientRect();
  const dpr=Math.min(lowPower?1.1:1.4,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.round(r.width*dpr));
  canvas.height=Math.max(1,Math.round(r.height*dpr));
  canvas.style.width=`${r.width}px`;
  canvas.style.height=`${r.height}px`;
  ctx?.setTransform(dpr,0,0,dpr,0,0);
}

function seedParticles(game:HTMLElement){
  const r=game.getBoundingClientRect();
  const min=lowPower?8:14;
  const max=lowPower?22:36;
  const divisor=lowPower?58:44;
  const count=Math.max(min,Math.min(max,Math.round(r.width/divisor)));
  particles=Array.from({length:count},(_,i)=>({
    x:Math.random()*r.width,
    y:Math.random()*r.height,
    r:.45+Math.random()*1.25,
    vx:(Math.random()-.5)*.04,
    vy:-.014-Math.random()*.04,
    a:.04+Math.random()*.12,
    phase:i*.73+Math.random()*6.2,
  }));
}

function draw(game:HTMLElement,now:number){
  raf=requestAnimationFrame(t=>draw(game,t));
  if(document.hidden||!ctx||!canvas)return;
  if(now-lastFrame<frameBudget)return;
  lastFrame=now;
  const r=game.getBoundingClientRect();
  ctx.clearRect(0,0,r.width,r.height);
  const p=cachedPalette;
  for(const dot of particles){
    dot.x+=dot.vx*p.drift;
    dot.y+=dot.vy*p.drift;
    if(dot.y<-8){dot.y=r.height+8;dot.x=Math.random()*r.width}
    if(dot.x<-8)dot.x=r.width+8;
    if(dot.x>r.width+8)dot.x=-8;
    const pulse=.72+.28*Math.sin(now*.00045+dot.phase);
    ctx.beginPath();
    ctx.fillStyle=`rgba(${p.dust},${dot.a*pulse})`;
    ctx.arc(dot.x,dot.y,dot.r,0,Math.PI*2);
    ctx.fill();
  }
}

function ensureVideo(game:HTMLElement){
  const existing=game.querySelector<HTMLVideoElement>('.livingWorldVideo');
  if(existing){ambientVideo=existing;return existing}
  const video=document.createElement('video');
  video.className='livingWorldVideo';
  video.muted=true;
  video.loop=true;
  video.playsInline=true;
  video.autoplay=!reducedMotion;
  video.preload=lowPower?'none':'metadata';
  video.setAttribute('aria-hidden','true');
  game.prepend(video);
  ambientVideo=video;
  return video;
}

function loadPlaceVideo(game:HTMLElement,place:string){
  const video=ensureVideo(game);
  if(video.dataset.place===place)return;
  video.dataset.place=place;
  video.classList.remove('is-ready');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if(reducedMotion)return;
  const src=`./resources/living/${encodeURIComponent(place)}.mp4`;
  const onReady=()=>{
    video.classList.add('is-ready');
    if(!document.hidden)void video.play().catch(()=>undefined);
  };
  const onError=()=>{
    video.classList.remove('is-ready');
    video.removeAttribute('src');
    video.load();
  };
  video.oncanplay=onReady;
  video.onerror=onError;
  video.src=src;
  video.load();
}

function syncContext(game:HTMLElement){
  refreshSaveCache();
  const save=cachedSave;
  const place=(save?.place||'home').toLowerCase();
  const part=timePart(save?.time);
  const kind=placeKind(place);
  game.dataset.livingPlace=place;
  game.dataset.livingKind=kind;
  game.dataset.livingTime=part;
  for(const name of ['matin','jour','soir','nuit'])game.classList.toggle(`part-${name}`,part===name);
  for(const name of ['home','city','arena','country','travel'])game.classList.toggle(`living-${name}`,kind===name);
  if(activePlace!==place){activePlace=place;loadPlaceVideo(game,place);seedParticles(game)}
}

function install(game:HTMLElement){
  if(game===mounted)return;
  mounted=game;
  activePlace='';
  cancelAnimationFrame(raf);
  if(contextTimer)window.clearInterval(contextTimer);
  ensureCanvas(game);
  ensureAtmosphere(game);
  ensureVideo(game);
  game.classList.add('livingWorld');
  syncContext(game);
  contextTimer=window.setInterval(()=>syncContext(game),2200);
  lastFrame=0;
  raf=requestAnimationFrame(t=>draw(game,t));
}

function releaseVideo(){
  if(!ambientVideo)return;
  ambientVideo.pause();
  ambientVideo.removeAttribute('src');
  ambientVideo.load();
  ambientVideo=null;
}

function scan(){
  const game=document.querySelector<HTMLElement>('.game');
  if(game)install(game);
  else{
    mounted=null;
    activePlace='';
    cancelAnimationFrame(raf);
    raf=0;
    if(contextTimer)window.clearInterval(contextTimer);
    contextTimer=0;
    releaseVideo();
    canvas?.remove();
    canvas=null;ctx=null;
    particles=[];
  }
}

window.addEventListener('resize',()=>{const game=document.querySelector<HTMLElement>('.game');if(game){resize(game);seedParticles(game)}});
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY&&mounted)syncContext(mounted)});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);raf=0;ambientVideo?.pause()}
  else if(mounted){refreshSaveCache();lastFrame=0;if(!raf)raf=requestAnimationFrame(t=>draw(mounted as HTMLElement,t));if(!reducedMotion)void ambientVideo?.play().catch(()=>undefined)}
});
new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
scan();

console.info('[World] Living world renderer optimized for lower heat and fewer frame/storage costs');
