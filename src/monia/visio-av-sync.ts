import type { MonIAMaterializedMedia } from './experience-runtime';
import { buildSpeechPerformanceRequest, renderSpeechPerformance } from './speech-performance-bridge';

const VISIO_MEDIA_KEY='monia-last-visio-media-v1';
const OVERLAY_ID='moniaVisioOverlay';
const VIDEO_ID='moniaVisioVideo';
const MAX_SOFT_DRIFT=0.18;
const MAX_HARD_DRIFT=0.45;

let activeAudio:HTMLAudioElement|null=null;
let monitor:number|undefined;
let hardDriftCount=0;
let attachToken=0;
const speechJobs=new Map<string,Promise<string>>();

function media():MonIAMaterializedMedia|null{
  try{const raw=sessionStorage.getItem(VISIO_MEDIA_KEY);return raw?JSON.parse(raw) as MonIAMaterializedMedia:null}catch{return null}
}
function saveMedia(value:MonIAMaterializedMedia){try{sessionStorage.setItem(VISIO_MEDIA_KEY,JSON.stringify(value))}catch{}}

function cleanup(){
  attachToken+=1;
  if(monitor!==undefined){window.clearInterval(monitor);monitor=undefined}
  hardDriftCount=0;
  if(activeAudio){activeAudio.pause();activeAudio.src='';activeAudio=null}
}
function stopGenericSpeech(){try{window.speechSynthesis?.cancel()}catch{}}

async function playLocked(video:HTMLVideoElement,audio:HTMLAudioElement){
  stopGenericSpeech(); video.loop=false; video.muted=true; video.pause(); audio.pause(); video.currentTime=0; audio.currentTime=0;
  await Promise.allSettled([video.play(),audio.play()]);
}

function beginDriftGuard(video:HTMLVideoElement,audio:HTMLAudioElement){
  if(monitor!==undefined)window.clearInterval(monitor);
  monitor=window.setInterval(()=>{
    if(audio.paused||video.paused||audio.ended)return;
    const drift=video.currentTime-audio.currentTime,abs=Math.abs(drift);
    if(abs>MAX_HARD_DRIFT){
      hardDriftCount+=1;
      if(hardDriftCount>=3){console.warn('[MonIA visio] A/V drift rejected',drift);audio.pause();video.pause();stopGenericSpeech();return}
    }else hardDriftCount=0;
    if(abs>MAX_SOFT_DRIFT){
      // V16 is the master clock. Seek visual time only; never warp playback rate or pitch.
      try{video.currentTime=Math.min(audio.currentTime,Number.isFinite(video.duration)?Math.max(0,video.duration-.02):audio.currentTime)}catch{}
    }
  },120);
}

function bindReplay(video:HTMLVideoElement,audio:HTMLAudioElement){
  const button=document.getElementById('replayMoniaVoice'); if(!button)return;
  button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();void playLocked(video,audio)},true);
}

async function requireSpeechPerformance(current:MonIAMaterializedMedia,video:HTMLVideoElement,token:number){
  const extra=current as MonIAMaterializedMedia & {speechPerformanceUrl?:string;speechPerformanceEngine?:string};
  if(extra.speechPerformanceUrl){video.src=extra.speechPerformanceUrl;video.load();return extra.speechPerformanceUrl}
  if(!current.videoUrl||!current.voiceAudioUrl||!current.generationJobId)throw new Error('spoken visio missing video, V16 audio or generation job id');
  const key=`${current.generationJobId}|${current.videoUrl}|${current.voiceAudioUrl}`;
  let task=speechJobs.get(key);
  if(!task){
    const request=buildSpeechPerformanceRequest(current.videoUrl,current.voiceAudioUrl,current.generationJobId);
    task=renderSpeechPerformance(request).then(ready=>ready.videoUrl).finally(()=>speechJobs.delete(key));
    speechJobs.set(key,task);
  }
  video.pause(); video.muted=true;
  const url=await task;
  if(token!==attachToken)throw new Error('visio changed while speech-performance was rendering');
  extra.speechPerformanceUrl=url; extra.speechPerformanceEngine='musetalk-v1.5'; extra.videoUrl=url; saveMedia(extra);
  video.src=url; video.load();
  return url;
}

async function attach(){
  const overlay=document.getElementById(OVERLAY_ID); const video=document.getElementById(VIDEO_ID) as HTMLVideoElement|null;
  if(!overlay||!video)return;
  const current=media(); if(!current?.voiceAudioUrl||!current.voiceText)return;
  const token=++attachToken;
  cleanup(); attachToken=token; stopGenericSpeech();
  window.setTimeout(stopGenericSpeech,420); window.setTimeout(stopGenericSpeech,800);

  try{
    await requireSpeechPerformance(current,video,token);
  }catch(error){
    console.warn('[MonIA visio] speech-performance unavailable; raw talking video is not allowed',error);
    video.pause(); stopGenericSpeech(); return;
  }
  if(token!==attachToken)return;

  const audio=new Audio(current.voiceAudioUrl); audio.preload='auto'; audio.crossOrigin='anonymous'; activeAudio=audio;
  audio.addEventListener('ended',()=>{video.pause();if(monitor!==undefined){window.clearInterval(monitor);monitor=undefined}});
  audio.addEventListener('error',()=>{console.warn('[MonIA visio] V16 audio failed; generic fallback forbidden');video.pause();stopGenericSpeech()});
  bindReplay(video,audio); beginDriftGuard(video,audio);
  try{await playLocked(video,audio)}catch(error){console.warn('[MonIA visio] synchronized playback blocked',error)}
}

const observer=new MutationObserver(()=>{if(document.getElementById(OVERLAY_ID))void attach();else cleanup()});
function start(){observer.observe(document.body,{childList:true,subtree:true});if(document.getElementById(OVERLAY_ID))void attach()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('beforeunload',cleanup);
console.info('[MonIA] Visio speech performance active · V16 -> MuseTalk 1.5 -> AV gate -> playback');
