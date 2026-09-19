import {moniaJuryRuntime,type JuryClip} from './monia/jury-demo-runtime';

const app=document.querySelector<HTMLDivElement>('#app')!;
let clips:JuryClip[]=moniaJuryRuntime.clips;
let index=0;
let playing=false;
let timer=0;

const fallback:Record<string,{image:string;video?:string}>={
  home:{image:'./resources/nimes/marion-apartment-living.webp'},
  street:{image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4'},
  marine:{image:'./resources/nimes/nimes-street.webp',video:'./resources/living/street.mp4'},
  feria:{image:'./resources/nimes/nimes-arenes.webp',video:'./resources/living/arenes.mp4'},
  encounter:{image:'./resources/nimes/nimes-arenes.webp',video:'./resources/living/arenes.mp4'},
  phone:{image:'./resources/madrid/lucas-country-home-bedroom.webp'},
  systems:{image:'./resources/nimes/marion-apartment-study.webp'},
  future:{image:'./resources/properties/jerez-finca-courtyard.webp'},
};

function ui(clip:JuryClip){
  const m=clip.beat.interfaceMode;
  if(m==='choices')return '<div class="choiceBar"><button>Parler avec Marine</button><button>Continuer</button><button>Terrasse</button></div>';
  if(m==='phone')return '<div class="phone"><div class="notch"></div><small>20:41</small><h3>Dominic</h3><div class="msg other">Tu fais quoi ?</div><div class="msg me">Je viens de rentrer</div><div class="callRow"><button>Appel</button><button>Visio</button></div></div>';
  if(m==='agenda')return '<div class="systemPanel"><div><b>Agenda</b><span>Corrida · samedi 17:00</span><span>Dîner avec Marine · 20:00</span></div><div><b>Tenue</b><span>Casual Nîmes</span><span>Changer</span></div><div><b>Déplacements</b><span>Nîmes → Madrid</span><span>Voir la carte</span></div></div>';
  if(m==='map')return '<div class="miniMap"><span>Appartement</span><span>Esplanade</span><span class="active">Arènes</span><span>Café</span></div>';
  if(m==='cinema')return '<div class="cinemaTag">CINÉMATIQUE CONTEXTUELLE</div>';
  if(m==='replay')return '<div class="replay"><b>Nouvelle partie</b><span>07:58 · sortie tôt</span><span>09:42 · retrouve Marine plus tard</span><span>12:18 · rencontre différente</span></div>';
  return '<div class="choiceBar"><button>Regarder le téléphone</button><button>Se préparer</button><button>Sortir</button></div>';
}

function media(clip:JuryClip){
  if(clip.media?.videoUrl){
    const voice=clip.media.voiceAudioUrl?'<audio id="heroVoice" src="'+clip.media.voiceAudioUrl+'" autoplay></audio>':'';
    return '<video id="heroVideo" src="'+clip.media.videoUrl+'" autoplay playsinline '+(clip.media.voiceAudioUrl?'':'muted')+'></video>'+voice;
  }
  const f=fallback[clip.beat.id]||fallback.home;
  return f.video?'<video id="heroVideo" src="'+f.video+'" autoplay muted loop playsinline></video>':'<div class="still" style="background-image:url('+f.image+')"></div>';
}

function render(){
  const clip=clips[index]; if(!clip)return;
  const done=clips.filter(c=>c.state==='ready'||c.state==='fallback').length;
  app.innerHTML='<main class="demo"><div class="media">'+media(clip)+'</div><div class="shade"></div>'+
  '<header><div><small>MARION & DOMINIC · DÉMO JURY</small><h1>'+clip.beat.title+'</h1><p>'+clip.beat.subtitle+'</p></div><div class="counter">'+(index+1)+' / '+clips.length+'</div></header>'+
  '<section class="caption"><b>'+clip.beat.caption+'</b><span>'+clip.beat.place+' · Jour '+clip.beat.day+' · '+clip.beat.time+'</span></section>'+
  ui(clip)+
  '<footer><div class="progress"><i style="width:'+(((index+1)/clips.length)*100)+'%"></i></div><div class="controls"><button id="prev">←</button><button id="play">'+(playing?'Pause':'Lecture auto')+'</button><button id="next">→</button><button id="generate">Générer avec MonIA ('+done+'/'+clips.length+')</button></div></footer></main>'+
  '<style>*{box-sizing:border-box}body{margin:0;background:#090807;color:#fff;font-family:Inter,system-ui,sans-serif}.demo{position:relative;width:100vw;height:100vh;overflow:hidden;background:#0a0908}.media,.media video,.still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background-size:cover;background-position:center}.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,4,3,.58),rgba(5,4,3,.06) 42%,rgba(5,4,3,.72))}header{position:absolute;left:4vw;right:4vw;top:4vh;display:flex;justify-content:space-between;gap:20px;text-shadow:0 3px 24px #000}header small{letter-spacing:.2em;font-size:11px;opacity:.74}header h1{font:500 clamp(28px,5vw,68px)/.96 Georgia,serif;margin:10px 0 5px;max-width:880px}header p{margin:0;opacity:.78}.counter{font-size:13px;opacity:.7}.caption{position:absolute;left:4vw;bottom:16vh;max-width:620px;padding:16px 18px;background:rgba(8,7,6,.58);border:1px solid rgba(255,255,255,.15);border-radius:18px;backdrop-filter:blur(14px)}.caption b{display:block;font-size:18px}.caption span{display:block;margin-top:6px;opacity:.7;font-size:13px}.choiceBar{position:absolute;left:50%;bottom:7vh;transform:translateX(-50%);display:flex;gap:8px;padding:8px;border-radius:999px;background:rgba(8,7,6,.62);backdrop-filter:blur(16px)}button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);color:#fff;border-radius:999px;padding:10px 15px}.phone{position:absolute;right:7vw;top:18vh;width:260px;min-height:480px;border-radius:36px;padding:22px 18px;background:rgba(15,15,16,.92);box-shadow:0 30px 90px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.14)}.notch{width:90px;height:18px;border-radius:999px;background:#000;margin:-11px auto 25px}.phone h3{text-align:center}.msg{max-width:82%;padding:9px 11px;border-radius:15px;margin:12px 0;background:#333}.msg.me{margin-left:auto;background:#2d6cdf}.callRow{display:flex;gap:8px;justify-content:center;margin-top:26px}.systemPanel{position:absolute;right:5vw;top:20vh;width:min(420px,40vw);display:grid;gap:10px}.systemPanel>div{padding:14px 16px;border-radius:16px;background:rgba(9,8,7,.68);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.14)}.systemPanel b,.systemPanel span{display:block}.systemPanel span{margin-top:5px;opacity:.72}.miniMap,.replay{position:absolute;right:5vw;bottom:18vh;display:grid;gap:7px;padding:14px 16px;border-radius:16px;background:rgba(9,8,7,.7);backdrop-filter:blur(14px)}.miniMap span,.replay span{opacity:.72}.miniMap .active{opacity:1;font-weight:700}.cinemaTag{position:absolute;left:50%;top:7vh;transform:translateX(-50%);padding:9px 13px;border-radius:999px;background:rgba(0,0,0,.55);font-size:11px;letter-spacing:.16em}footer{position:absolute;left:4vw;right:4vw;bottom:2vh}.progress{height:3px;background:rgba(255,255,255,.18);border-radius:99px;overflow:hidden}.progress i{display:block;height:100%;background:#fff}.controls{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}@media(max-width:720px){.phone{right:4vw;width:230px;transform:scale(.8);transform-origin:top right}.caption{left:4vw;right:4vw;bottom:20vh}.choiceBar{width:92%;overflow:auto}.systemPanel{width:88vw;right:6vw}.controls{justify-content:center;flex-wrap:wrap}}</style>';
  document.querySelector('#prev')?.addEventListener('click',()=>{index=(index-1+clips.length)%clips.length;render()});
  document.querySelector('#next')?.addEventListener('click',()=>{index=(index+1)%clips.length;render()});
  document.querySelector('#play')?.addEventListener('click',()=>{playing=!playing;schedule();render()});
  document.querySelector('#generate')?.addEventListener('click',generate);
  const video=document.querySelector<HTMLVideoElement>('#heroVideo');
  const voice=document.querySelector<HTMLAudioElement>('#heroVoice');
  if(video&&voice){video.addEventListener('play',()=>{voice.currentTime=video.currentTime;void voice.play().catch(()=>undefined)});video.addEventListener('pause',()=>voice.pause())}
}

function schedule(){
  if(timer)window.clearTimeout(timer);
  if(!playing)return;
  timer=window.setTimeout(()=>{index=(index+1)%clips.length;render();schedule()},9000);
}

async function generate(){
  const btn=document.querySelector<HTMLButtonElement>('#generate');if(btn){btn.disabled=true;btn.textContent='MonIA génère…'}
  clips=await moniaJuryRuntime.generate(value=>{clips=[...value];render()});
  render();
}

window.addEventListener('monia:jury-demo',((e:CustomEvent<{clips:JuryClip[]}>)=>{clips=e.detail.clips;render()}) as EventListener);
render();
