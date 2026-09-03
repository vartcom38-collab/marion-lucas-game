import './introArrival.css';

const APP_ID='app';
const ARRIVAL_ARM='marion-lucas-intro-arrival-armed-v1';
let cineHooked:HTMLVideoElement|null=null;
let arrivalRunning=false;

function app(){return document.getElementById(APP_ID)}
function arm(){try{sessionStorage.setItem(ARRIVAL_ARM,'1')}catch{}}
function disarm(){try{sessionStorage.removeItem(ARRIVAL_ARM)}catch{}}
function armed(){try{return sessionStorage.getItem(ARRIVAL_ARM)==='1'}catch{return false}}
function reduced(){return matchMedia('(prefers-reduced-motion: reduce)').matches}

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
    if(video.duration-video.currentTime<=1.35)root.classList.add('cineLanding');
  };
  video.addEventListener('timeupdate',landing,{passive:true});
  video.addEventListener('ended',()=>root.classList.add('cineLanding'),{once:true});
}

function finish(main:HTMLElement,veil:HTMLElement,caption:HTMLElement){
  main.classList.remove('introArrivalActive','introArrivalBreathe','introArrivalHud','introArrivalControls');
  veil.remove();caption.remove();arrivalRunning=false;disarm();
  window.dispatchEvent(new CustomEvent('monia-intro-arrival-complete',{detail:{place:'home'}}));
}

function startArrival(){
  if(arrivalRunning||!armed())return;
  const main=document.querySelector<HTMLElement>('main.immersivePlayable');
  if(!main)return;
  arrivalRunning=true;
  const veil=document.createElement('div');veil.className='introArrivalVeil';veil.setAttribute('aria-hidden','true');
  const caption=document.createElement('div');caption.className='introArrivalCaption';caption.innerHTML='<span>Nîmes · chez toi</span><strong>Un nouveau matin</strong>';
  main.append(veil,caption);
  main.classList.add('introArrivalActive');
  const fast=reduced();
  const t1=fast?80:220,t2=fast?260:1450,t3=fast?480:2850,t4=fast?700:4200;
  window.setTimeout(()=>main.classList.add('introArrivalBreathe'),t1);
  window.setTimeout(()=>main.classList.add('introArrivalHud'),t2);
  window.setTimeout(()=>main.classList.add('introArrivalControls'),t3);
  window.setTimeout(()=>finish(main,veil,caption),t4);
}

function scan(){hookCinematic();startArrival()}
const observer=new MutationObserver(scan);
const root=app();if(root)observer.observe(root,{childList:true,subtree:true});
scan();

console.info('[Intro] cinematic → apartment landing bridge active');
