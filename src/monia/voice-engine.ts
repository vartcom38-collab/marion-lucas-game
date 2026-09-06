import { synthesizeLucasLocal } from './local-piper-voice';

export type MonIAVoiceActor='Lucas'|'Marion';
export type MonIAVoiceMood='neutral'|'warm'|'tired'|'intense'|'soft';
export type VoiceProvider='piper-local'|'browser';
export type SpeakOptions={
  actor:MonIAVoiceActor;
  mood?:MonIAVoiceMood;
  referenceAudioUrl?:string;
  allowBrowserFallback?:boolean;
  onStart?:()=>void;
  onBoundary?:(detail:{charIndex:number;name?:string;elapsedTime?:number;textLength:number})=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
  onProvider?:(provider:VoiceProvider)=>void;
};

export type MonIAPremiumVoiceResult={provider:VoiceProvider;audioUrl?:string;fallback:boolean;error?:string;cacheHit?:boolean;persisted?:boolean};

let currentAudio:HTMLAudioElement|null=null;
let currentObjectUrl:string|null=null;
let boundaryTimer:number|undefined;

function prepareSpeechText(value:string){
  return value
    .replace(/\[\[[^\]]+\]\]/g,' ')
    .replace(/[🎥📹☎🎬▶■◇●🎙]/g,' ')
    .replace(/\s*\.\.\.\s*/g,'… ')
    .replace(/\s*([,;:!?])\s*/g,'$1 ')
    .replace(/([.!?…])(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g,'$1 ')
    .replace(/\s+/g,' ')
    .trim();
}

function actorBase(actor:MonIAVoiceActor){return actor==='Lucas'?{rate:.91,pitch:.96}:{rate:.98,pitch:1.02}}
function moodAdjust(mood:MonIAVoiceMood='neutral'){
  if(mood==='tired')return {rate:-.05,pitch:-.01};
  if(mood==='warm')return {rate:-.01,pitch:0};
  if(mood==='soft')return {rate:-.03,pitch:0};
  if(mood==='intense')return {rate:.01,pitch:-.01};
  return {rate:0,pitch:0};
}

function simulatedBoundaries(audio:HTMLAudioElement,text:string,callback?:SpeakOptions['onBoundary']){
  if(!callback)return;
  if(boundaryTimer)window.clearInterval(boundaryTimer);
  const words=[...text.matchAll(/\S+/g)].map(match=>({index:match.index||0}));
  let cursor=0;
  boundaryTimer=window.setInterval(()=>{
    if(audio.paused||audio.ended)return;
    const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:Math.max(1,text.length/13);
    const target=Math.floor((audio.currentTime/duration)*words.length);
    while(cursor<=target&&cursor<words.length){
      callback({charIndex:words[cursor].index,name:'word',elapsedTime:audio.currentTime,textLength:text.length});
      cursor++;
    }
  },140);
}

export function cancelMonIAVoice(){
  if('speechSynthesis'in window)window.speechSynthesis.cancel();
  if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null}
  if(currentObjectUrl){URL.revokeObjectURL(currentObjectUrl);currentObjectUrl=null}
  if(boundaryTimer)window.clearInterval(boundaryTimer);
  boundaryTimer=undefined;
}

function browserSpeak(text:string,options:SpeakOptions){
  if(!('speechSynthesis'in window)){options.onError?.('synthèse vocale locale du navigateur indisponible');return false}
  const clean=prepareSpeechText(text);if(!clean)return false;
  cancelMonIAVoice();
  const utterance=new SpeechSynthesisUtterance(clean),base=actorBase(options.actor),adjust=moodAdjust(options.mood);
  utterance.lang='fr-FR';
  utterance.rate=Math.max(.82,Math.min(1.02,base.rate+adjust.rate));
  utterance.pitch=Math.max(.92,Math.min(1.04,base.pitch+adjust.pitch));
  utterance.onstart=()=>{options.onProvider?.('browser');options.onStart?.()};
  utterance.onboundary=e=>options.onBoundary?.({charIndex:e.charIndex,name:e.name,elapsedTime:e.elapsedTime,textLength:clean.length});
  utterance.onend=()=>options.onEnd?.();
  utterance.onerror=e=>options.onError?.(e.error||'erreur vocale locale');
  window.speechSynthesis.speak(utterance);
  return true;
}

export function speakMonIA(text:string,options:SpeakOptions){
  if(options.actor==='Lucas'){
    void speakMonIAPremium(text,{...options,allowBrowserFallback:false});
    return true;
  }
  return browserSpeak(text,options);
}

export async function speakMonIAPremium(text:string,options:SpeakOptions):Promise<MonIAPremiumVoiceResult>{
  const clean=prepareSpeechText(text);
  if(!clean){const error='texte vocal vide';options.onError?.(error);return {provider:'piper-local',fallback:true,error}}

  if(options.actor==='Lucas'){
    cancelMonIAVoice();
    const generated=await synthesizeLucasLocal(clean);
    if(!generated.ok||!generated.audioUrl){
      const error=generated.error||'Piper local indisponible';
      options.onError?.(error);
      return {provider:'piper-local',fallback:true,error};
    }
    try{
      currentObjectUrl=generated.audioUrl;
      const audio=new Audio(generated.audioUrl);currentAudio=audio;audio.preload='auto';
      audio.onplay=()=>{options.onProvider?.('piper-local');options.onStart?.();simulatedBoundaries(audio,clean,options.onBoundary)};
      audio.onended=()=>{if(boundaryTimer)window.clearInterval(boundaryTimer);boundaryTimer=undefined;currentAudio=null;options.onEnd?.()};
      audio.onerror=()=>{if(boundaryTimer)window.clearInterval(boundaryTimer);boundaryTimer=undefined;currentAudio=null;options.onError?.('lecture Piper locale impossible')};
      await audio.play();
      return {provider:'piper-local',audioUrl:generated.audioUrl,fallback:false,persisted:true};
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      options.onError?.(message);
      return {provider:'piper-local',fallback:true,error:message};
    }
  }

  const started=browserSpeak(clean,options);
  return {provider:'browser',fallback:!started,error:started?undefined:'synthèse vocale locale indisponible'};
}

export function inferVoiceMood(text:string):MonIAVoiceMood{
  const value=text.toLowerCase();
  if(/fatigu|épuis|crevé|dorm|souffl/.test(value))return 'tired';
  if(/doucement|tendre|embrass|manqu|chérie|ma belle/.test(value))return 'soft';
  if(/colère|furieux|énerv|sérieux|écoute-moi/.test(value))return 'intense';
  if(/sour|content|heureux|plaisir|hâte/.test(value))return 'warm';
  return 'neutral';
}
