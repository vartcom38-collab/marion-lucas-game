import './intro-sequence.css';
import { getPreparedMonIAIntroShots, prepareMonIAIntroShots } from './monia/intro-ai';

type Shot={src:string;label:string};
type ServerShot={id:string;label?:string;videoUrl:string};

const sleep=(ms:number)=>new Promise<void>(r=>window.setTimeout(r,ms));

function sourceOf(id:string){return(document.getElementById(id) as HTMLVideoElement|null)?.src||''}

function muteFromSettings(){
  try{const raw=localStorage.getItem('marion-lucas-settings-v2');if(!raw)return false;const p=JSON.parse(raw);return p?.sound===false}catch{return false}
}

async function serverIntroShots():Promise<ServerShot[]>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),1400);
  try{
    const response=await fetch(`./resources/monia/generated/intro-manifest.json?ts=${Date.now()}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
    if(!response.ok)return [];
    const data=await response.json();
    return Array.isArray(data?.shots)?data.shots.filter((s:any)=>s&&typeof s.id==='string'&&typeof s.videoUrl==='string'&&s.videoUrl):[];
  }catch{return []}
  finally{window.clearTimeout(timer)}
}

function introShots(serverPrepared:ServerShot[]=[]):Shot[]{
  const prepared=getPreparedMonIAIntroShots();
  const marion=serverPrepared.find(s=>s.id==='marion-morning')||prepared.find(s=>s.id==='marion-morning');
  const lucas=serverPrepared.find(s=>s.id==='lucas-presence')||prepared.find(s=>s.id==='lucas-presence');
  return [
    {src:marion?.videoUrl||sourceOf('introVideo'),label:marion?.label||'NÎMES'},
    {src:lucas?.videoUrl||sourceOf('lucasVideo'),label:lucas?.label||'AILLEURS, AU MÊME MOMENT'},
  ].filter(s=>Boolean(s.src));
}

async function playSafe(video:HTMLVideoElement){
  try{await video.play();return true}catch{video.muted=true;try{await video.play();return true}catch{return false}}
}

async function mountSequence(stage:HTMLElement){
  if(stage.dataset.sequenceMounted==='1')return;
  const legacy=stage.querySelector<HTMLVideoElement>('#cineA');
  const skip=stage.querySelector<HTMLButtonElement>('#skip');
  if(!legacy||!skip)return;
  stage.dataset.sequenceMounted='1';

  const serverPrepared=await serverIntroShots();
  legacy.pause();legacy.onended=null;legacy.ontimeupdate=null;legacy.classList.remove('active');legacy.style.display='none';

  const shots=introShots(serverPrepared);
  if(!shots.length){skip.click();return}

  stage.classList.add('multiShotIntro');
  const shell=document.createElement('div');shell.className='introSequenceShell';
  shell.innerHTML=`<video class="introShot introShotA" playsinline preload="auto"></video><video class="introShot introShotB" playsinline preload="auto"></video><div class="introCinemaShade"></div><div class="introShotMeta"><span></span></div><div class="introSequenceProgress"><i></i></div>`;
  stage.insertBefore(shell,stage.firstChild);
  const players=[shell.querySelector<HTMLVideoElement>('.introShotA')!,shell.querySelector<HTMLVideoElement>('.introShotB')!];
  const meta=shell.querySelector<HTMLElement>('.introShotMeta span')!;
  const progress=shell.querySelector<HTMLElement>('.introSequenceProgress i')!;
  let stopped=false;
  const stop=()=>{stopped=true;players.forEach(v=>{v.pause();v.removeAttribute('src');v.load()})};
  skip.addEventListener('click',stop,{once:true});
  const durations:number[]=new Array(shots.length).fill(1);
  let completed=0;

  for(let i=0;i<shots.length&&!stopped;i++){
    const current=players[i%2],other=players[(i+1)%2];
    other.classList.remove('visible');other.pause();
    current.src=shots[i].src;current.muted=muteFromSettings();current.volume=1;current.load();
    if(shots[i+1]){other.src=shots[i+1].src;other.preload='auto';other.load()}
    meta.textContent=shots[i].label;
    await new Promise<void>(resolve=>{
      const ready=()=>{durations[i]=Number.isFinite(current.duration)&&current.duration>0?current.duration:1;resolve()};
      if(current.readyState>=1)ready();else{current.addEventListener('loadedmetadata',ready,{once:true});window.setTimeout(resolve,1400)}
    });
    if(stopped)break;
    current.classList.add('visible');
    const update=()=>{const total=durations.reduce((a,b)=>a+b,0)||1;const now=completed+Math.min(current.currentTime||0,durations[i]);progress.style.transform=`scaleX(${Math.min(1,now/total)})`};
    current.addEventListener('timeupdate',update);
    const ok=await playSafe(current);if(!ok){current.removeEventListener('timeupdate',update);continue}
    await new Promise<void>(resolve=>{current.addEventListener('ended',()=>resolve(),{once:true});window.setTimeout(()=>{if(current.ended||stopped)resolve()},Math.max(1200,durations[i]*1000+2500))});
    current.removeEventListener('timeupdate',update);completed+=durations[i];progress.style.transform=`scaleX(${Math.min(1,completed/(durations.reduce((a,b)=>a+b,0)||1))})`;
    if(i<shots.length-1&&!stopped){current.classList.add('fading');await sleep(360);current.classList.remove('visible','fading');await sleep(90)}
  }
  if(!stopped){stage.classList.add('introSequenceEnding');await sleep(520);skip.click()}
}

// Le worker serveur MonIA est prioritaire. La génération navigateur reste un secours opportuniste.
window.setTimeout(()=>{void prepareMonIAIntroShots()},1800);

const observer=new MutationObserver(()=>{const stage=document.querySelector<HTMLElement>('.teaserCine');if(stage)void mountSequence(stage)});
observer.observe(document.documentElement,{childList:true,subtree:true});
const existing=document.querySelector<HTMLElement>('.teaserCine');if(existing)void mountSequence(existing);
