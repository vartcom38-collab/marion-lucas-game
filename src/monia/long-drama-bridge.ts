import { moniaExperience } from './experience-runtime';
import { materializeLongDrama, playLongDrama } from './long-drama';

const runtime=moniaExperience as any;
const original=runtime.respond.bind(runtime);
let running=false;

runtime.respond=async(...args:any[])=>{
  const result=await original(...args);
  const channel=result?.response?.channel;
  const cinematic=result?.mediaPlan?.mode==='cinematic-drama'||channel==='scene'||channel==='video';
  if(cinematic&&result?.mediaPlan?.visual?.required&&!running){
    running=true;
    void materializeLongDrama(result).then(drama=>{
      if((drama.state==='ready'||drama.state==='partial')&&drama.clips.filter((c:any)=>c.state==='ready'&&c.videoUrl).length>=2){
        if(document.visibilityState==='visible'&&!document.getElementById('moniaVisioOverlay'))playLongDrama(drama);
        else try{sessionStorage.setItem('monia-long-drama-pending-v1','1')}catch{}
      }
    }).catch(error=>console.warn('[MonIA long drama]',error)).finally(()=>{running=false});
  }
  return result;
};

function playPending(){
  try{
    if(sessionStorage.getItem('monia-long-drama-pending-v1')!=='1')return;
    if(document.getElementById('moniaVisioOverlay'))return;
    sessionStorage.removeItem('monia-long-drama-pending-v1');playLongDrama();
  }catch{}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)playPending()});
window.setInterval(playPending,1800);

console.info('[MonIA] Automatic long-drama bridge active');
