import './introArrival.css';

const APP_ID='app';
const ARRIVAL_ARM='marion-lucas-intro-arrival-armed-v1';
const SAVE_KEY='marion-lucas-save-v4';
let cineHooked:HTMLVideoElement|null=null;
let arrivalRunning=false;
let firstControlTimer=0;

function app(){return document.getElementById(APP_ID)}
function arm(){try{sessionStorage.setItem(ARRIVAL_ARM,'1')}catch{}}
function disarm(){try{sessionStorage.removeItem(ARRIVAL_ARM)}catch{}}
function armed(){try{return sessionStorage.getItem(ARRIVAL_ARM)==='1'}catch{return false}}
function reduced(){return matchMedia('(prefers-reduced-motion: reduce)').matches}

function patchSave(values:Record<string,boolean|number|string>){
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;
    const save=JSON.parse(raw);save.flags=save.flags||{};
    Object.assign(save.flags,values);save.updatedAt=Date.now();
    localStorage.setItem(SAVE_KEY,JSON.stringify(save));
  }catch{}
}

function preloadHome(){
  const img=new Image();
  img.decoding='async';
  img.src='./resources/appartement-nimes.png';
}

function hookCinematic(){
  const root=document.querySelector<HTMLElement>('.teaserCine');
  const video=document.getElementById('cineA') as HTMLVideoElement|null;
  if(!root||!video||video===cineHooked)return;
  cineHooked=video;arm();preloadHome();
  const landing=()=>{
    if(!Number.isFinite(video.duration)||video.duration<=0)return;
    if(video.duration-video.currentTime<=1.1)root.classList.add('cineLanding');
  };
  video.addEventListener('timeupdate',landing,{passive:true});
  video.addEventListener('ended',()=>root.classList.add('cineLanding'),{once:true});
}

function clearFirstControlNudge(){
  if(firstControlTimer)window.clearTimeout(firstControlTimer);firstControlTimer=0;
  document.querySelector('.firstPlayableNudge')?.remove();
}

function armFirstControlNudge(){
  clearFirstControlNudge();
  let touched=false;
  const mark=(kind:string)=>{
    if(touched)return;touched=true;clearFirstControlNudge();
    patchSave({firstPlayableControlUsed:true,firstPlayableControlKind:kind});
    window.removeEventListener('pointerdown',onPointer,true);window.removeEventListener('keydown',onKey,true);
  };
  const onPointer=()=>mark('pointer');
  const onKey=()=>mark('keyboard');
  window.addEventListener('pointerdown',onPointer,true);window.addEventListener('keydown',onKey,true);
  firstControlTimer=window.setTimeout(()=>{
    if(touched)return;
    const main=document.querySelector<HTMLElement>('main.immersivePlayable');if(!main)return;
    const nudge=document.createElement('aside');nudge.className='firstPlayableNudge';
    nudge.innerHTML='<span>PREMIER MATIN</span><strong>Tu n’as rien à réussir tout de suite.</strong><small>Regarde autour de toi. Ouvre ton téléphone, change-toi, sors… ou reste là quelques minutes.</small>';
    main.appendChild(nudge);patchSave({firstPlayableNeededNudge:true});
    window.setTimeout(()=>nudge.classList.add('is-soft'),6500);
  },13500);
}

function finish(main:HTMLElement,veil:HTMLElement,caption:HTMLElement){
  main.classList.remove('introArrivalActive','introArrivalBreathe','introArrivalHud','introArrivalControls');
  veil.remove();caption.remove();arrivalRunning=false;disarm();
  patchSave({firstPlayableArrivalSeen:true});
  armFirstControlNudge();
  window.dispatchEvent(new CustomEvent('monia-intro-arrival-complete',{detail:{place:'home',playable:true}}));
  window.dispatchEvent(new CustomEvent('marion-home-first-control'));
}

function startArrival(){
  if(arrivalRunning||!armed())return;
  const main=document.querySelector<HTMLElement>('main.immersivePlayable');
  if(!main)return;
  arrivalRunning=true;
  const veil=document.createElement('div');veil.className='introArrivalVeil';veil.setAttribute('aria-hidden','true');
  const caption=document.createElement('div');caption.className='introArrivalCaption';caption.innerHTML='<span>Nîmes · Appartement</span><strong>Premier matin</strong><small>Regarde autour de toi. Fais ce qui te vient.</small>';
  main.append(veil,caption);
  main.classList.add('introArrivalActive');
  const fast=reduced();
  const t1=fast?60:160,t2=fast?180:820,t3=fast?300:1650,t4=fast?440:2600;
  window.setTimeout(()=>main.classList.add('introArrivalBreathe'),t1);
  window.setTimeout(()=>main.classList.add('introArrivalHud'),t2);
  window.setTimeout(()=>main.classList.add('introArrivalControls'),t3);
  window.setTimeout(()=>finish(main,veil,caption),t4);
}

function scan(){hookCinematic();startArrival()}
const observer=new MutationObserver(scan);
const root=app();if(root)observer.observe(root,{childList:true,subtree:true});
scan();

console.info('[Intro] cinematic → playable apartment handoff now observes first-session friction without turning into a tutorial');
