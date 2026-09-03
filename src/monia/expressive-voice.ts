import { persistGeneratedAudio } from './server-media-store';
import { inferVoiceMood, speakMonIAPremium, type MonIAVoiceMood } from './voice-engine';

export type ExpressiveVoiceResult={provider:'cosyvoice'|'legacy';audioUrl?:string;fallback:boolean;error?:string};

type Options={
  mood?:MonIAVoiceMood;
  onStart?:()=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
  onProvider?:(provider:'cosyvoice'|'legacy')=>void;
};

const COSY_SPACE='https://funaudiollm-fun-cosyvoice3-0-5b.hf.space';
const EDGE_SPACE='https://innoai-edge-tts-text-to-speech.hf.space';
const CACHE_KEY='monia-expressive-lucas-v1';
let currentAudio:HTMLAudioElement|null=null;

function clean(value:string){return value.replace(/\[\[[^\]]+\]\]/g,' ').replace(/[🎥📹☎🎬▶■◇●🎙]/g,' ').replace(/\s+/g,' ').trim()}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function err(v:unknown){return v instanceof Error?v.message:String(v??'service indisponible')}
function deep(value:any):string{if(!value)return'';if(typeof value==='string')return /^https?:\/\//.test(value)||/\.(wav|mp3|flac|ogg|m4a)(?:$|\?)/i.test(value)?value:'';if(Array.isArray(value)){for(const x of value){const f=deep(x);if(f)return f}return''}for(const x of [value.url,value.path,value.audio?.url,value.audio?.path,value.data,value.output,value.outputs,value.result,value.files]){const f=deep(x);if(f)return f}return''}
function fileUrl(value:any,space:string){const x=deep(value);return !x?'':/^https?:\/\//.test(x)?x:`${space}/gradio_api/file=${encodeURIComponent(x)}`}

async function call(space:string,api:string,data:any[],timeout=120000){
  const c=new AbortController(),timer=window.setTimeout(()=>c.abort(),timeout);
  try{
    const s=await fetch(`${space}/gradio_api/call/${api}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data}),signal:c.signal});
    if(!s.ok)throw new Error(`HTTP ${s.status}`);const j=await s.json();if(!j.event_id)throw new Error('job non créé');
    const r=await fetch(`${space}/gradio_api/call/${api}/${encodeURIComponent(j.event_id)}`,{headers:{accept:'text/event-stream'},signal:c.signal});if(!r.ok)throw new Error(`résultat HTTP ${r.status}`);
    for(const block of (await r.text()).split(/\n\n+/)){const ev=block.match(/^event:\s*(.+)$/m)?.[1]?.trim(),raw=block.match(/^data:\s*(.*)$/m)?.[1];if(ev==='error')throw new Error(raw||'erreur provider');if(ev==='complete'&&raw){try{return JSON.parse(raw)}catch{throw new Error('réponse illisible')}}}
    throw new Error('réponse incomplète');
  }finally{window.clearTimeout(timer)}
}

async function seedReference(){
  const key='lucas-cosy-seed-v1';
  try{const saved=localStorage.getItem(key);if(saved)return saved}catch{}
  const sentence="Je viens de rentrer. Je suis un peu fatigué, mais je suis content de t'entendre.";
  const data=await call(EDGE_SPACE,'tts_interface',[sentence,'fr-FR-RemyMultilingualNeural',-5,-2],45000);
  const remote=fileUrl(data,EDGE_SPACE);if(!remote)throw new Error('empreinte masculine introuvable');
  const stored=await persistGeneratedAudio(remote,'lucas-cosy-seed-v1');const url=stored.audioUrl||remote;
  try{if(stored.persisted)localStorage.setItem(key,url)}catch{}
  return url;
}

async function uploadReference(url:string){
  const response=await fetch(url);if(!response.ok)throw new Error(`référence HTTP ${response.status}`);const blob=await response.blob();
  const fd=new FormData();fd.append('files',blob,'lucas-reference.mp3');
  const upload=await fetch(`${COSY_SPACE}/gradio_api/upload`,{method:'POST',body:fd});if(!upload.ok)throw new Error(`upload CosyVoice HTTP ${upload.status}`);
  const json=await upload.json();const path=Array.isArray(json)?(json[0]?.path||json[0]):json?.path;if(!path)throw new Error('upload CosyVoice sans chemin');return path;
}

function instruction(mood:MonIAVoiceMood){
  const common='Speak in French like a real young adult man in a private one-to-one conversation. Natural intimate delivery, warm low male timbre, subtle breaths, tiny hesitations, human irregular rhythm, nuanced emotion. Never sound like an announcer, narrator or text-to-speech system.';
  if(mood==='tired')return `${common} He is tired after a long day: quieter, slightly breathy, slower, emotionally present, not sleepy or monotone.`;
  if(mood==='soft')return `${common} He is tender and close: soft voice, restrained affection, a faint smile audible in the voice, gentle pauses.`;
  if(mood==='warm')return `${common} He is genuinely happy to hear her: relaxed warmth, subtle smile, spontaneous conversational energy.`;
  if(mood==='intense')return `${common} He is emotionally intense but controlled: firmer voice, contained tension, meaningful pauses, never shouting.`;
  return `${common} Calm, spontaneous and attentive, as if responding in a real video call.`;
}

function readCache(key:string){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')?.[key]||''}catch{return''}}
function saveCache(key:string,url:string){if(!(url.startsWith('/')||url.startsWith(location.origin)))return;try{const all=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');all[key]=url;localStorage.setItem(CACHE_KEY,JSON.stringify(all))}catch{}}

async function play(url:string,options:Options){if(currentAudio){currentAudio.pause();currentAudio=null}const audio=new Audio(url);currentAudio=audio;audio.onplay=()=>{options.onProvider?.('cosyvoice');options.onStart?.()};audio.onended=()=>{currentAudio=null;options.onEnd?.()};audio.onerror=()=>options.onError?.('lecture CosyVoice impossible');await audio.play()}

export async function speakLucasExpressive(text:string,options:Options={}):Promise<ExpressiveVoiceResult>{
  const spoken=clean(text).slice(0,190),mood=options.mood||inferVoiceMood(spoken),key=hash(`cosy-v1|${mood}|${spoken.toLowerCase()}`);
  try{
    const cached=readCache(key);if(cached){await play(cached,options);return {provider:'cosyvoice',audioUrl:cached,fallback:false}}
    const reference=await seedReference(),uploaded=await uploadReference(reference);
    const data=await call(COSY_SPACE,'generate_audio',[spoken,'instruct','',uploaded,null,instruction(mood),7319,false,'En'],150000);
    const remote=fileUrl(data,COSY_SPACE);if(!remote)throw new Error('CosyVoice terminé sans audio');
    const stored=await persistGeneratedAudio(remote,key),url=stored.audioUrl||remote;if(stored.persisted)saveCache(key,url);
    await play(url,options);return {provider:'cosyvoice',audioUrl:url,fallback:false};
  }catch(error){
    const message=err(error);options.onProvider?.('legacy');
    const legacy=await speakMonIAPremium(spoken,{actor:'Lucas',mood,onStart:options.onStart,onEnd:options.onEnd,onError:options.onError});
    return {provider:'legacy',audioUrl:legacy.audioUrl,fallback:true,error:message};
  }
}
