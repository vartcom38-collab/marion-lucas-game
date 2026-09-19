import {moniaTeaserRuntime,type TeaserClip} from './monia/teaser-runtime';

const app=document.querySelector<HTMLDivElement>('#app')!;
let clips:TeaserClip[]=moniaTeaserRuntime.clips;
let index=0;
let autoplay=false;
let timer=0;

const fallback:Record<string,{image:string;video?:string}>={
  opening:{image:'./resources/nimes/marion-apartment-living.webp'},
  city:{image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4'},
  marine:{image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4'},
  encounter:{image:'./resources/nimes/nimes-arenes.webp',video:'./resources/living/arenes.mp4'},
  message:{image:'./resources/nimes/marion-apartment-living.webp'},
  visio:{image:'./resources/madrid/lucas-country-home-bedroom.webp'},
  career:{image:'./resources/madrid/lucas-country-home-exterior.webp'},
  life:{image:'./resources/nimes/nimes-cafe.webp',video:'./resources/living/cafe.mp4'},
  future:{image:'./resources/family/family-exterior.webp'},
  replay:{image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4'}
};

function overlay(clip:TeaserClip){
  const ui=clip.beat.ui;
  if(ui==='choices')return '<div class="choices"><button>Parler</button><button>Continuer</button><button>Regarder le téléphone</button></div>';
  if(ui==='phone')return '<div class="phone"><div class="notch"></div><small>21:43</small><h3>Dominic</h3><div class="bubble">Tu es bien rentrée ?</div><div class="phoneActions"><span>Message</span><span>Appel</span><span>Visio</span></div></div>';
  if(ui==='map')return '<div class="map"><b>Nîmes</b><span>Appartement</span><span>Esplanade</span><span class="active">Arènes</span><span>Café</span></div>';
  if(ui==='agenda')return '<div class="agenda"><b>Cette semaine</b><span>Corrida · samedi 17:00</span><span>Marine · dîner 20:00</span><span>Madrid · lundi</span></div>';
  if(ui==='replay')return '<div class="replay"><b>Nouvelle partie</b><span>Sortie plus tôt</span><span>Marine plus tard</span><span>Autre itinéraire</span><span>Autres conversations</span></div>';
  return '';
}

function media(clip:TeaserClip){
  if(clip.media?.videoUrl){
    const voice=clip.media.voiceAudioUrl?'<audio id="voice" src="'+clip.media.voiceAudioUrl+'" autoplay></audio>':'';
    return '<video id="video" src="'+clip.media.videoUrl+'" autoplay playsinline '+(clip.media.voiceAudioUrl?'':'muted')+'></video>'+voice;
  }
  const f=fallback[clip.beat.id]||fallback.opening;
  return f.video?'<video id="video" src="'+f.video+'" autoplay muted loop playsinline></video>':'<div class="still" style="background-image:url(\''+f.image+'\')"></div>';
}

function render(){
  const clip=clips[index];
  if(!clip)return;
  const ready=clips.filter(c=>c.state==='ready'||c.state==='fallback').length;
  app.innerHTML=
  '<main class="teaser"><div class="media">'+media(clip)+'</div><div class="veil"></div>'+
  '<div class="brand">MARION & DOMINIC</div>'+
  '<section class="copy"><small>'+clip.beat.kicker+'</small><h1>'+clip.beat.title+'</h1><p>'+clip.beat.place+' · '+clip.beat.time+'</p></section>'+
  overlay(clip)+
  '<div class="status">'+clip.state.toUpperCase()+'</div>'+
  '<footer><div class="bar"><i style="width:'+(((index+1)/clips.length)*100)+'%"></i></div><div class="controls"><button id="prev">←</button><button id="auto">'+(autoplay?'Pause':'Lecture auto')+'</button><button id="next">→</button><button id="generate">Générer avec MonIA ('+ready+'/'+clips.length+')</button></div></footer>'+
  '</main>'+
  '<style>*{box-sizing:border-box}html,body,#app{margin:0;width:100%;height:100%;overflow:hidden;background:#060606;color:#fff;font-family:Inter,system-ui,sans-serif}.teaser{position:relative;width:100vw;height:100vh;overflow:hidden}.media,.media video,.still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background-size:cover;background-position:center}.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.02) 40%,rgba(0,0,0,.68))}.brand{position:absolute;top:4vh;left:4vw;font-size:12px;letter-spacing:.26em;opacity:.82}.copy{position:absolute;left:5vw;bottom:17vh;max-width:760px;text-shadow:0 4px 26px #000}.copy small{letter-spacing:.22em;opacity:.72}.copy h1{font:500 clamp(34px,6vw,82px)/.95 Georgia,serif;margin:10px 0 8px}.copy p{margin:0;opacity:.75}.choices{position:absolute;left:50%;bottom:6vh;transform:translateX(-50%);display:flex;gap:8px;padding:8px;background:rgba(12,12,12,.58);border-radius:999px;backdrop-filter:blur(15px)}button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;border-radius:999px;padding:10px 15px;font:inherit}.phone{position:absolute;right:7vw;top:16vh;width:250px;min-height:430px;border-radius:34px;padding:20px 17px;background:rgba(17,17,18,.94);border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.55)}.notch{width:88px;height:16px;background:#000;border-radius:999px;margin:-10px auto 25px}.phone h3{text-align:center}.bubble{margin-top:30px;padding:12px;border-radius:16px;background:#333}.phoneActions{display:flex;gap:6px;justify-content:center;margin-top:24px;font-size:12px}.phoneActions span{padding:7px 9px;border-radius:999px;background:#252525}.map,.agenda,.replay{position:absolute;right:5vw;bottom:17vh;width:min(320px,38vw);display:grid;gap:7px;padding:14px 16px;border-radius:16px;background:rgba(10,10,10,.65);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12)}.map span,.agenda span,.replay span{opacity:.72}.map .active{opacity:1;font-weight:700}.status{position:absolute;right:4vw;top:4vh;font-size:10px;letter-spacing:.18em;opacity:.55}footer{position:absolute;left:4vw;right:4vw;bottom:2vh}.bar{height:3px;background:rgba(255,255,255,.18);overflow:hidden;border-radius:99px}.bar i{display:block;height:100%;background:#fff}.controls{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}@media(max-width:720px){.copy{left:4vw;right:4vw;bottom:20vh}.phone{right:4vw;transform:scale(.78);transform-origin:top right}.choices{width:92%;overflow:auto}.map,.agenda,.replay{width:86vw;right:7vw}.controls{justify-content:center;flex-wrap:wrap}}</style>';

  document.querySelector('#prev')?.addEventListener('click',()=>{index=(index-1+clips.length)%clips.length;render()});
  document.querySelector('#next')?.addEventListener('click',()=>{index=(index+1)%clips.length;render()});
  document.querySelector('#auto')?.addEventListener('click',()=>{autoplay=!autoplay;schedule();render()});
  document.querySelector('#generate')?.addEventListener('click',generate);

  const video=document.querySelector<HTMLVideoElement>('#video');
  const voice=document.querySelector<HTMLAudioElement>('#voice');
  if(video&&voice){
    video.addEventListener('play',()=>{voice.currentTime=Math.min(video.currentTime,voice.duration||video.currentTime);void voice.play().catch(()=>undefined)});
    video.addEventListener('pause',()=>voice.pause());
  }
}
function schedule(){if(timer)clearTimeout(timer);if(!autoplay)return;timer=window.setTimeout(()=>{index=(index+1)%clips.length;render();schedule()},7000)}
async function generate(){
  const b=document.querySelector<HTMLButtonElement>('#generate');if(b){b.disabled=true;b.textContent='MonIA génère…'}
  clips=await moniaTeaserRuntime.generate(v=>{clips=[...v];render()});
  render();
}
window.addEventListener('monia:teaser',((e:CustomEvent<{clips:TeaserClip[]}>)=>{clips=e.detail.clips;render()}) as EventListener);
render();
