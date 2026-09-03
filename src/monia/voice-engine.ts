import { persistGeneratedAudio } from './server-media-store';

export type MonIAVoiceActor='Lucas'|'Marion';
export type MonIAVoiceMood='neutral'|'warm'|'tired'|'intense'|'soft';

type SpeakOptions={
  actor:MonIAVoiceActor;
  mood?:MonIAVoiceMood;
  referenceAudioUrl?:string;
  onStart?:()=>void;
  onBoundary?:(detail:{charIndex:number;name?:string;elapsedTime?:number;textLength:number})=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
  onProvider?:(provider:'chatterbox'|'browser')=>void;
};

export type MonIAPremiumVoiceResult={provider:'chatterbox'|'browser';audioUrl?:string;fallback:boolean;error?:string;cacheHit?:boolean;persisted?:boolean};

const PREF_KEY='monia-voice-profile-v1';
const AUDIO_CACHE_KEY='monia-premium-voice-cache-v3';
const CHATTERBOX_SPACE='https://resembleai-chatterbox-multilingual-tts.hf.space';
const CHATTERBOX_API='generate_tts_audio';
const CHATTERBOX_TIMEOUT=100_000;
const CANON_REFERENCE:Partial<Record<MonIAVoiceActor,string>>={
  Lucas:'/resources/monia/voices/lucas-reference.wav',
  Marion:'/resources/monia/voices/marion-reference.wav',
};

type StoredProfile={actor:MonIAVoiceActor;voiceName?:string;lang:string;rate:number;pitch:number};
type CachedAudio={key:string;url:string;createdAt:number;lastUsedAt:number};
let currentAudio:HTMLAudioElement|null=null;
let boundaryTimer:number|undefined;

function voices(){return 'speechSynthesis'in window?window.speechSynthesis.getVoices():[]}
function load(actor:MonIAVoiceActor):StoredProfile|null{try{const raw=localStorage.getItem(PREF_KEY);const all=raw?JSON.parse(raw):{};return all?.[actor]||null}catch{return null}}
function save(profile:StoredProfile){try{const raw=localStorage.getItem(PREF_KEY);const all=raw?JSON.parse(raw):{};all[profile.actor]=profile;localStorage.setItem(PREF_KEY,JSON.stringify(all))}catch{}}

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
function chatterboxStyle(mood:MonIAVoiceMood='neutral'){
  if(mood==='tired')return {exaggeration:.28,temperature:.46,cfg:.28};
  if(mood==='soft')return {exaggeration:.32,temperature:.48,cfg:.28};
  if(mood==='warm')return {exaggeration:.37,temperature:.50,cfg:.30};
  if(mood==='intense')return {exaggeration:.46,temperature:.52,cfg:.30};
  return {exaggeration:.32,temperature:.48,cfg:.28};
}

const MALE_VOICE_NAMES=/\b(thomas|nicolas|henri|daniel|alex|arthur|louis|paul|hugo|george|lewis|michael|liam|eric|adam|onyx|fenrir|fable|santa|nicola|jacques|antoine|remy|rémy)\b/i;
function choose(actor:MonIAVoiceActor){
  const available=voices(),stored=load(actor);
  if(stored?.voiceName){
    const existing=available.find(v=>v.name===stored.voiceName);
    if(existing && (actor!=='Lucas'||MALE_VOICE_NAMES.test(existing.name)))return existing;
  }
  const french=available.filter(v=>v.lang.toLowerCase().startsWith('fr'));
  const candidates=actor==='Lucas'?french.filter(v=>MALE_VOICE_NAMES.test(v.name)):french;
  const fallback=candidates.find(v=>v.localService)||candidates[0]||null;
  if(fallback){const base=actorBase(actor);save({actor,voiceName:fallback.name,lang:fallback.lang||'fr-FR',rate:base.rate,pitch:base.pitch})}
  return fallback;
}

function cleanError(value:unknown){
  const raw=value instanceof Error?value.message:String(value??''),text=raw.trim();
  if(!text||text==='null'||text==='undefined')return 'service vocal indisponible';
  try{const parsed=JSON.parse(text);const nested=parsed?.message||parsed?.error||parsed?.detail;if(typeof nested==='string'&&nested.trim())return nested.trim()}catch{}
  return text;
}
function deepAudioCandidate(value:any):string{
  if(!value)return '';
  if(typeof value==='string')return /\.(wav|mp3|flac|ogg|m4a|aac)(?:$|\?)/i.test(value)||/^https?:\/\//.test(value)?value:'';
  if(Array.isArray(value)){for(const item of value){const found=deepAudioCandidate(item);if(found)return found}return ''}
  const direct=value?.audio?.url||value?.url||value?.path||value?.audio?.path;
  if(typeof direct==='string'&&direct)return direct;
  for(const key of ['audio','files','result','results','output','outputs','data']){const found=deepAudioCandidate(value?.[key]);if(found)return found}
  return '';
}
function gradioAudioUrl(value:any){const candidate=deepAudioCandidate(value);if(!candidate)return '';return /^https?:\/\//.test(candidate)?candidate:`${CHATTERBOX_SPACE}/gradio_api/file=${encodeURIComponent(candidate)}`}

function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function voiceKey(text:string,options:SpeakOptions,reference:string|null){return hash(['v3',options.actor,options.mood||'neutral',prepareSpeechText(text).toLowerCase(),reference||'default'].join('|'))}
function readAudioCache():CachedAudio[]{try{const raw=localStorage.getItem(AUDIO_CACHE_KEY),data=raw?JSON.parse(raw):[];return Array.isArray(data)?data.filter((x:CachedAudio)=>x?.url&&Date.now()-x.createdAt<30*24*60*60*1000):[]}catch{return []}}
function writeAudioCache(items:CachedAudio[]){try{localStorage.setItem(AUDIO_CACHE_KEY,JSON.stringify(items.slice(0,80)))}catch{}}
function cachedAudio(key:string){const items=readAudioCache(),found=items.find(x=>x.key===key);if(!found)return null;found.lastUsedAt=Date.now();writeAudioCache([found,...items.filter(x=>x!==found)]);return found.url}
function rememberAudio(key:string,url:string){if(!(url.startsWith('/')||url.startsWith(location.origin)))return;const now=Date.now(),items=readAudioCache().filter(x=>x.key!==key);writeAudioCache([{key,url,createdAt:now,lastUsedAt:now},...items])}

async function referenceIfExists(actor:MonIAVoiceActor,override?:string){
  const requested=override||CANON_REFERENCE[actor];
  if(!requested)return null;
  try{const response=await fetch(requested,{method:'HEAD',cache:'no-store'});return response.ok?new URL(requested,location.href).href:null}catch{return null}
}

async function chatterboxGenerate(text:string,options:SpeakOptions,reference:string|null){
  const clean=prepareSpeechText(text);
  const style=chatterboxStyle(options.mood);
  if(options.actor==='Lucas'&&!reference)throw new Error('référence masculine française Lucas non définie');
  const payload=[clean.slice(0,300),'fr',reference,style.exaggeration,style.temperature,options.actor==='Lucas'?7319:4217,style.cfg];
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),CHATTERBOX_TIMEOUT);
  try{
    const submit=await fetch(`${CHATTERBOX_SPACE}/gradio_api/call/${CHATTERBOX_API}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:payload}),signal:controller.signal});
    if(!submit.ok)throw new Error(`Chatterbox HTTP ${submit.status}`);
    const created=await submit.json();if(!created?.event_id)throw new Error('Chatterbox n’a pas créé de job audio');
    const result=await fetch(`${CHATTERBOX_SPACE}/gradio_api/call/${CHATTERBOX_API}/${encodeURIComponent(created.event_id)}`,{headers:{accept:'text/event-stream'},signal:controller.signal});
    if(!result.ok)throw new Error(`Chatterbox résultat HTTP ${result.status}`);
    for(const block of (await result.text()).split(/\n\n+/)){
      const event=block.match(/^event:\s*(.+)$/m)?.[1]?.trim(),raw=block.match(/^data:\s*(.*)$/m)?.[1];
      if(event==='error')throw new Error(cleanError(raw));
      if(event==='complete'&&raw){let data:any;try{data=JSON.parse(raw)}catch{throw new Error('réponse audio Chatterbox illisible')};const url=gradioAudioUrl(data);if(!url)throw new Error('Chatterbox terminé sans URL audio');return url}
    }
    throw new Error('réponse Chatterbox incomplète');
  }catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw new Error('timeout voix ZeroGPU');throw new Error(cleanError(error))}
  finally{window.clearTimeout(timer)}
}

function simulatedBoundaries(audio:HTMLAudioElement,text:string,callback?:SpeakOptions['onBoundary']){
  if(!callback)return;if(boundaryTimer)window.clearInterval(boundaryTimer);
  const words=[...text.matchAll(/\S+/g)].map(match=>({index:match.index||0}));let cursor=0;
  boundaryTimer=window.setInterval(()=>{if(audio.paused||audio.ended)return;const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:Math.max(1,text.length/13);const target=Math.floor((audio.currentTime/duration)*words.length);while(cursor<=target&&cursor<words.length){callback({charIndex:words[cursor].index,name:'word',elapsedTime:audio.currentTime,textLength:text.length});cursor++}},140);
}

async function playRemoteAudio(url:string,text:string,options:SpeakOptions){
  const clean=prepareSpeechText(text);
  cancelMonIAVoice();const audio=new Audio(url);currentAudio=audio;audio.preload='auto';
  audio.onplay=()=>{options.onProvider?.('chatterbox');options.onStart?.();simulatedBoundaries(audio,clean,options.onBoundary)};
  audio.onended=()=>{if(boundaryTimer)window.clearInterval(boundaryTimer);boundaryTimer=undefined;currentAudio=null;options.onEnd?.()};
  audio.onerror=()=>{if(boundaryTimer)window.clearInterval(boundaryTimer);boundaryTimer=undefined;currentAudio=null;options.onError?.('lecture voix Chatterbox impossible')};
  await audio.play();
}

export function cancelMonIAVoice(){if('speechSynthesis'in window)window.speechSynthesis.cancel();if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null}if(boundaryTimer)window.clearInterval(boundaryTimer);boundaryTimer=undefined}

export function speakMonIA(text:string,options:SpeakOptions){
  if(!('speechSynthesis'in window)){options.onError?.('synthèse vocale indisponible');return false}
  const voice=choose(options.actor);
  if(options.actor==='Lucas'&&!voice){options.onError?.('aucune voix masculine française de secours disponible');return false}
  const clean=prepareSpeechText(text);if(!clean)return false;
  cancelMonIAVoice();options.onProvider?.('browser');
  const utterance=new SpeechSynthesisUtterance(clean),base=actorBase(options.actor),adjust=moodAdjust(options.mood);
  utterance.lang='fr-FR';utterance.rate=Math.max(.82,Math.min(1.02,base.rate+adjust.rate));utterance.pitch=Math.max(.92,Math.min(1.04,base.pitch+adjust.pitch));
  if(voice)utterance.voice=voice;
  utterance.onstart=()=>options.onStart?.();utterance.onboundary=e=>options.onBoundary?.({charIndex:e.charIndex,name:e.name,elapsedTime:e.elapsedTime,textLength:clean.length});utterance.onend=()=>options.onEnd?.();utterance.onerror=e=>options.onError?.(e.error||'erreur vocale');window.speechSynthesis.speak(utterance);return true;
}

export async function speakMonIAPremium(text:string,options:SpeakOptions):Promise<MonIAPremiumVoiceResult>{
  try{
    const reference=await referenceIfExists(options.actor,options.referenceAudioUrl),key=voiceKey(text,options,reference),cached=cachedAudio(key);
    if(cached){await playRemoteAudio(cached,text,options);return {provider:'chatterbox',audioUrl:cached,fallback:false,cacheHit:true,persisted:true}}
    const remoteUrl=await chatterboxGenerate(text,options,reference);
    const stored=await persistGeneratedAudio(remoteUrl,key);
    const audioUrl=stored.audioUrl||remoteUrl;if(stored.persisted)rememberAudio(key,audioUrl);
    await playRemoteAudio(audioUrl,text,options);
    return {provider:'chatterbox',audioUrl,fallback:false,cacheHit:false,persisted:stored.persisted};
  }catch(error){
    const message=cleanError(error),started=speakMonIA(text,options);
    if(started)return {provider:'browser',fallback:true,error:message};
    return {provider:'browser',fallback:true,error:message};
  }
}

export function inferVoiceMood(text:string):MonIAVoiceMood{
  const value=text.toLowerCase();
  if(/fatigu|épuis|crevé|dorm|souffl/.test(value))return 'tired';
  if(/doucement|tendre|embrass|manqu|chérie|ma belle/.test(value))return 'soft';
  if(/colère|furieux|énerv|sérieux|écoute-moi/.test(value))return 'intense';
  if(/sour|content|heureux|plaisir|hâte/.test(value))return 'warm';
  return 'neutral';
}
