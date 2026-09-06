import './premiumCinema.css';

const SAVE='marion-lucas-save-v4';
const MEDIA=[
  './resources/marion-nimes.mp4',
  './resources/monia/generated/intro-lucas-candidate-desktop.mp4',
  './resources/appartement-nimes.png'
];
let mounted:HTMLElement|null=null;
let lastPlace='';
let raf=0;
let frames=0;
let started=performance.now();

type LooseSave={place?:string;time?:string;overlay?:string|null;screen?:string};
function save():LooseSave{try{return JSON.parse(localStorage.getItem(SAVE)||'{}')}catch{return {}}}

function preload(){
  const conn=(navigator as any).connection;
  if(conn?.saveData)return;
  for(const src of MEDIA){
    const link=document.createElement('link');
    link.rel=src.endsWith('.mp4')?'preload':'prefetch';
    link.as=src.endsWith('.mp4')?'video':'image';
    link.href=src;
    document.head.appendChild(link);
  }
}

function transition(game:HTMLElement){
  game.classList.remove('pc-place-change');
  void game.offsetWidth;
  game.classList.add('pc-place-change');
  window.setTimeout(()=>game.classList.remove('pc-place-change'),850);
}

function pulse(game:HTMLElement,x:number,y:number){
  const r=game.getBoundingClientRect();
  game.style.setProperty('--pc-click-x',`${Math.max(0,Math.min(100,(x-r.left)/Math.max(1,r.width)*100))}%`);
  game.style.setProperty('--pc-click-y',`${Math.max(0,Math.min(100,(y-r.top)/Math.max(1,r.height)*100))}%`);
  game.classList.remove('pc-interact');
  void game.offsetWidth;
  game.classList.add('pc-interact');
  window.setTimeout(()=>game.classList.remove('pc-interact'),520);
}

function sync(game:HTMLElement){
  const s=save();
  const place=(s.place||'home').toLowerCase();
  if(lastPlace&&place!==lastPlace)transition(game);
  lastPlace=place;
  game.dataset.pcPlace=place;
  game.classList.toggle('pc-overlay-open',Boolean(s.overlay));
  const hour=Number((s.time||'12:00').split(':')[0]);
  game.dataset.pcDaypart=hour>=21||hour<6?'night':hour>=18?'evening':hour<11?'morning':'day';
}

function install(game:HTMLElement){
  if(game===mounted)return;
  mounted=game;
  game.classList.add('premiumCinema');
  game.addEventListener('pointerdown',e=>{
    const target=(e.target as HTMLElement|null)?.closest('[data-home-action],[data-world-action],.worldSpot,.gameHotspot,button');
    if(target)pulse(game,e.clientX,e.clientY);
  },{passive:true});
  sync(game);
}

function scan(){
  const game=document.querySelector<HTMLElement>('.game');
  if(game){install(game);sync(game)} else mounted=null;
}

function performanceGuard(now:number){
  frames++;
  const elapsed=now-started;
  if(elapsed>3500){
    const fps=frames/(elapsed/1000);
    document.documentElement.classList.toggle('pc-low-fps',fps<42);
    frames=0;started=now;
  }
  raf=requestAnimationFrame(performanceGuard);
}

new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',scan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
preload();scan();raf=requestAnimationFrame(performanceGuard);
console.info('[Cinema] Premium cinematic layer active');
