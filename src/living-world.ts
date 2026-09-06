import './livingWorld.css';

const SAVE_KEY='marion-lucas-save-v4';
let mounted:HTMLElement|null=null;
let canvas:HTMLCanvasElement|null=null;
let ctx:CanvasRenderingContext2D|null=null;
let raf=0;
let particles:Array<{x:number;y:number;r:number;vx:number;vy:number;a:number;phase:number}>=[];

type LooseSave={time?:string;place?:string};

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}

function timeHour(time='12:00'){
  const h=Number(time.split(':')[0]);
  return Number.isFinite(h)?h:12;
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
  const count=Math.max(18,Math.min(48,Math.round(r.width/34)));
  particles=Array.from({length:count},(_,i)=>({
    x:Math.random()*r.width,
    y:Math.random()*r.height,
    r:.45+Math.random()*1.4,
    vx:(Math.random()-.5)*.045,
    vy:-.015-Math.random()*.045,
    a:.06+Math.random()*.16,
    phase:i*.73+Math.random()*6.2,
  }));
}

function palette(save:LooseSave|null){
  const h=timeHour(save?.time);
  const place=(save?.place||'home').toLowerCase();
  const night=h>=21||h<6;
  const evening=h>=18&&h<21;
  const morning=h>=6&&h<11;
  const outdoors=place!=='home';
  return {
    dust:night?'190,210,255':morning?'255,232,196':evening?'255,191,128':'255,244,221',
    glow:night?0.08:outdoors?0.18:0.13,
    drift:outdoors?1.35:1,
  };
}

function draw(game:HTMLElement,now:number){
  if(!ctx||!canvas)return;
  const r=game.getBoundingClientRect();
  ctx.clearRect(0,0,r.width,r.height);
  const save=readSave();
  const p=palette(save);
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

function addVideoHook(game:HTMLElement){
  if(game.querySelector('.livingWorldVideo'))return;
  const save=readSave();
  const place=save?.place||'home';
  const video=document.createElement('video');
  video.className='livingWorldVideo';
  video.muted=true;
  video.loop=true;
  video.playsInline=true;
  video.preload='none';
  video.dataset.place=place;
  video.style.display='none';
  game.appendChild(video);
}

function install(game:HTMLElement){
  if(game===mounted)return;
  mounted=game;
  cancelAnimationFrame(raf);
  ensureCanvas(game);
  addVideoHook(game);
  game.classList.add('livingWorld');
  raf=requestAnimationFrame(t=>draw(game,t));
}

function scan(){
  const game=document.querySelector<HTMLElement>('.game');
  if(game)install(game);
  else{
    mounted=null;
    cancelAnimationFrame(raf);
    canvas?.remove();
    canvas=null;ctx=null;
  }
}

window.addEventListener('resize',()=>{const game=document.querySelector<HTMLElement>('.game');if(game){resize(game);seedParticles(game)}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)cancelAnimationFrame(raf);
  else if(mounted)raf=requestAnimationFrame(t=>draw(mounted as HTMLElement,t));
});
new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
scan();

console.info('[World] Living world layer active');
