const MARION_INTRO='./resources/marion-nimes.mp4';
const LUCAS_INTRO='./resources/lucas-intro.mp4';

type IntroPhase='marion'|'lucas';

function setTitle(stage:HTMLElement,phase:IntroPhase){
  const kicker=stage.querySelector<HTMLElement>('.teaserTitle span');
  const title=stage.querySelector<HTMLElement>('.teaserTitle h1');
  if(kicker)kicker.textContent=phase==='marion'?'NÎMES · UNE VIE À COMMENCER':'AILLEURS · UNE AUTRE VIE EN MOUVEMENT';
  if(title)title.textContent=phase==='marion'?'Marion':'Lucas';
}

function mountOpeningSequence(stage:HTMLElement){
  if(stage.dataset.sequenceMounted==='1')return;
  const video=stage.querySelector<HTMLVideoElement>('#cineA');
  const skip=stage.querySelector<HTMLButtonElement>('#skip');
  const progress=stage.querySelector<HTMLElement>('.teaserProgress i');
  if(!video||!skip)return;
  stage.dataset.sequenceMounted='1';

  let phase:IntroPhase='marion';
  let switching=false;

  const syncProgress=()=>{
    if(!progress)return;
    if(Number.isFinite(video.duration)&&video.duration>0)progress.style.transform=`scaleX(${Math.min(1,video.currentTime/video.duration)})`;
  };

  const finish=()=>skip.click();

  const playPhase=async(next:IntroPhase)=>{
    phase=next;
    switching=true;
    setTitle(stage,phase);
    if(progress)progress.style.transform='scaleX(0)';
    video.pause();
    video.src=phase==='marion'?MARION_INTRO:LUCAS_INTRO;
    video.currentTime=0;
    video.load();
    video.ontimeupdate=syncProgress;
    video.onended=()=>{
      if(phase==='marion')void playPhase('lucas');
      else finish();
    };
    video.onerror=()=>{
      if(phase==='marion')void playPhase('lucas');
      else finish();
    };
    try{await video.play()}catch{
      video.muted=true;
      try{await video.play()}catch{if(phase==='marion')void playPhase('lucas');else finish()}
    }finally{switching=false}
  };

  video.onended=()=>{if(!switching)void playPhase('lucas')};
  video.onerror=()=>{if(!switching)void playPhase('lucas')};
  video.ontimeupdate=syncProgress;
  setTitle(stage,'marion');

  const current=video.currentSrc||video.src;
  if(!current.includes('marion-nimes.mp4'))void playPhase('marion');
}

function scan(){
  const stage=document.querySelector<HTMLElement>('.teaserCine');
  if(stage)mountOpeningSequence(stage);
}

const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{childList:true,subtree:true});
scan();

console.info('[Intro] Marion → Lucas → playable apartment sequence active');
