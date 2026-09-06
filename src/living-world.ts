import './livingWorld.css';

const SAVE_KEY='marion-lucas-save-v4';
let mounted:HTMLElement|null=null;
let canvas:HTMLCanvasElement|null=null;
let ctx:CanvasRenderingContext2D|null=null;
let ambientVideo:HTMLVideoElement|null=null;
let raf=0;
let contextTimer=0;
let activePlace='';
let particles:Array<{x:number;y:number;r:number;vx:number;vy:number;a:number;phase:number}>=[];

type LooseSave={time?:string;place?:string};

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

function ensureCanvas(game:HTMLElement){
  if(canvas?.isConnected&&canvas.parentElement===game)return;
  canvas?.remove();
  canvas=document.createElement('canvas');
  canvas.className='livingWorldCanvas';
  canvas.setAttribute('aria-hidden','true');
  game.appendChild(canvas);
  ctx=canvas.getContext('2d');
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
  const dpr=Math.min(1.5,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.round(r.width*dpr));
  canvas.height=Math.max(1,Math.round(r.height*dpr));
  canvas.style.width=`${r.width}px`;
  canvas.style.height=`${r.height}px`;
  ctx?.setTransform(dpr,0,0,dpr,0,0);
}

function seedParticles(game:HTMLElement){
  const r=game.getBoundingClientRect();
  const count=Math.max(16,Math.min(46,Math.round(r.width/38)));
  particles=Array.from({length:count},(_,i)=>({
    x:Math.random()*r.width,
    y:Math.random()*r.height,
    r:.45+Math.random()*1.35,
    vx:(Math.random()-.5)*.045,
    vy:-.015-Math.random()*.045,
    a:.045+Math.random()*.14,
    phase:i*.73+Math.random()*6.2,
  }));
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

function draw(game:HTMLElement,now:number){
  if(!ctx||!canvas)return;
  const r=game.getBoundingClientRect();
  ctx.clearRect(0,0,r.width,r.height);
  const p=palette(readSave());
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
  raf=requestAnimationFrame(t=>draw(game,t));
}

function ensureVideo(game:HTMLElement){
  const existing=game.querySelector<HTMLVideoElement>('.livingWorldVideo');
  if(existing){ambientVideo=existing;return existing}
  const video=document.createElement('video');
  video.className='livingWorldVideo';
  video.muted=true;
  video.loop=true;
  video.playsInline=true;
  video.autoplay=true;
  video.preload='metadata';
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
  const src=`./resources/living/${encodeURIComponent(place)}.mp4`;
  const onReady=()=>{
    video.classList.add('is-ready');
    void video.play().catch(()=>undefined);
  };
  const onError=()=>{
    video.classList.remove('is-ready');
    video.removeAttribute('src');
  };
  video.oncanplay=onReady;
  video.onerror=onError;
  video.src=src;
  video.load();
}

function syncContext(game:HTMLElement){
  const save=readSave();
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
  contextTimer=window.setInterval(()=>syncContext(game),1200);
  raf=requestAnimationFrame(t=>draw(game,t));
}

function scan(){
  const game=document.querySelector<HTMLElement>('.game');
  if(game)install(game);
  else{
    mounted=null;
    activePlace='';
    cancelAnimationFrame(raf);
    if(contextTimer)window.clearInterval(contextTimer);
    contextTimer=0;
    ambientVideo?.pause();
    ambientVideo=null;
    canvas?.remove();
    canvas=null;ctx=null;
  }
}

window.addEventListener('resize',()=>{const game=document.querySelector<HTMLElement>('.game');if(game){resize(game);seedParticles(game)}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);ambientVideo?.pause()}
  else if(mounted){raf=requestAnimationFrame(t=>draw(mounted as HTMLElement,t));void ambientVideo?.play().catch(()=>undefined)}
});
new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
scan();

console.info('[World] Living world contextual renderer active');
