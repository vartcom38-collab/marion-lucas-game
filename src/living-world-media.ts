import './livingWorldMedia.css';

const SAVE_KEY='marion-lucas-save-v4';
const VIDEO_ROOT='./resources/living';

let activeGame:HTMLElement|null=null;
let activeVideo:HTMLVideoElement|null=null;
let token=0;

type LooseSave={place?:string;time?:string};

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}

function sourceFor(place:string){return `${VIDEO_ROOT}/${place}.mp4`}

async function mediaExists(url:string){
  try{
    const r=await fetch(url,{method:'HEAD',cache:'no-store'});
    return r.ok&&Number(r.headers.get('content-length')||1)>1024;
  }catch{return false}
}

function clearVideo(){
  if(activeVideo){
    activeVideo.pause();
    activeVideo.removeAttribute('src');
    activeVideo.load();
    activeVideo.remove();
  }
  activeVideo=null;
  activeGame?.classList.remove('hasLivingVideo');
}

async function mountVideo(game:HTMLElement){
  const current=++token;
  const save=readSave();
  const place=(save?.place||'home').toLowerCase();
  const url=sourceFor(place);
  game.dataset.livingPlace=place;
  clearVideo();
  if(!(await mediaExists(url))||current!==token||!game.isConnected)return;

  const video=document.createElement('video');
  video.className='livingPlaceVideo';
  video.src=url;
  video.muted=true;
  video.loop=true;
  video.playsInline=true;
  video.autoplay=true;
  video.preload='metadata';
  video.setAttribute('aria-hidden','true');
  const backdrop=game.querySelector<HTMLElement>('.worldBackdrop');
  if(backdrop)backdrop.prepend(video);else game.prepend(video);
  activeVideo=video;
  video.addEventListener('canplay',()=>{
    if(activeVideo!==video)return;
    game.classList.add('hasLivingVideo');
    void video.play().catch(()=>undefined);
  },{once:true});
  video.addEventListener('error',()=>{
    if(activeVideo===video)clearVideo();
  },{once:true});
}

function scan(){
  const game=document.querySelector<HTMLElement>('.game');
  if(!game){activeGame=null;clearVideo();return}
  const place=(readSave()?.place||'home').toLowerCase();
  if(game===activeGame&&game.dataset.livingPlace===place)return;
  activeGame=game;
  void mountVideo(game);
}

new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',scan);
document.addEventListener('visibilitychange',()=>{
  if(!activeVideo)return;
  if(document.hidden)activeVideo.pause();else void activeVideo.play().catch(()=>undefined);
});
scan();

console.info('[World] Optional place-video layer active');
