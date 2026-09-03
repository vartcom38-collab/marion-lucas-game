import { Client, handle_file } from '@gradio/client';
import { persistGeneratedAudio } from './server-media-store';
import { inferVoiceMood, speakMonIAPremium, type MonIAVoiceMood } from './voice-engine';

export type ExpressiveVoiceResult={provider:'cosyvoice'|'legacy';audioUrl?:string;fallback:boolean;error?:string};

type Options={
  mood?:MonIAVoiceMood;
  allowFallback?:boolean;
  onStart?:()=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
  onProvider?:(provider:'cosyvoice'|'legacy')=>void;
};

const COSY_SPACE_ID='FunAudioLLM/Fun-CosyVoice3-0.5B';
const EDGE_SPACE='https://innoai-edge-tts-text-to-speech.hf.space';
const CACHE_KEY='monia-expressive-lucas-v2';
const SEED_SENTENCE="Je viens de rentrer. Je suis un peu fatigué, mais je suis content de t'entendre.";
let currentAudio:HTMLAudioElement|null=null;

function clean(value:string){return value.replace(/\[\[[^\]]+\]\]/g,' ').replace(/[🎥📹☎🎬▶■◇●🎙]/g,' ').replace(/\s+/g,' ').trim()}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function err(v:unknown){return v instanceof Error?v.message:String(v??'service indisponible')}
function deep(value:any):string{if(!value)return'';if(typeof value==='string')return /^https?:\/\//.test(value)||/\.(wav|mp3|flac|ogg|m4a)(?:$|\?)/i.test(value)?value:'';if(Array.isArray(value)){for(const x of value){const f=deep(x);if(f)return f}return''}for(const x of [value.url,value.path,value.audio?.url,value.audio?.path,value.data,value.output,value.outputs,value.result,value.files]){const f=deep(x);if(f)return f}return''}
function fileUrl(value:any,space:string){const x=deep(value);return !x?'':/^https?:\/\//.test(x)?x:`${space}/gradio_api/file=${encodeURIComponent(x)}`}

async function rawCall(space:string,api:string,data:any[],timeout=60000){
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
  const key='lucas-cosy-seed-v2';
  try{const saved=localStorage.getItem(key);if(saved)return saved}catch{}
  const data=await rawCall(EDGE_SPACE,'tts_interface',[SEED_SENTENCE,'fr-FR-RemyMultilingualNeural',-4,-2],45000);
  const remote=fileUrl(data,EDGE_SPACE);if(!remote)throw new Error('empreinte masculine introuvable');
  const stored=await persistGeneratedAudio(remote,key);const url=stored.audioUrl||remote;
  try{if(stored.persisted)localStorage.setItem(key,url)}catch{}
  return url;
}

function instruction(mood:MonIAVoiceMood){
  const common='Parle en français comme un jeune homme dans une conversation privée réelle. Voix masculine chaude et naturelle, rythme humain irrégulier, respirations discrètes, petites hésitations naturelles, aucune diction de présentateur ou de synthèse vocale.';
  if(mood==='tired')return `${common} Il est fatigué après une longue journée : voix plus basse, un peu soufflée, calme mais émotionnellement présent.`;
  if(mood==='soft')return `${common} Il est tendre et proche : douceur retenue, affection sincère, léger sourire audible, pauses délicates.`;
  if(mood==='warm')return `${common} Il est vraiment heureux de l'entendre : chaleur détendue, sourire discret, énergie spontanée.`;
  if(mood==='intense')return `${common} Il est très ému mais se contrôle : tension contenue, voix ferme, silences chargés, sans crier.`;
  return `${common} Il répond calmement et spontanément, comme pendant une vraie visio.`;
}

function readCache(key:string){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')?.[key]||''}catch{return''}}
function saveCache(key:string,url:string){if(!(url.startsWith('/')||url.startsWith(location.origin)))return;try{const all=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');all[key]=url;localStorage.setItem(CACHE_KEY,JSON.stringify(all))}catch{}}
async function play(url:string,options:Options){if(currentAudio){currentAudio.pause();currentAudio=null}const audio=new Audio(url);currentAudio=audio;audio.onplay=()=>{options.onProvider?.('cosyvoice');options.onStart?.()};audio.onended=()=>{currentAudio=null;options.onEnd?.()};audio.onerror=()=>options.onError?.('lecture CosyVoice impossible');await audio.play()}

function findGenerateEndpoint(info:any){
  const unnamed=info?.unnamed_endpoints||{};
  for(const [key,value] of Object.entries<any>(unnamed)){
    const params=value?.parameters||[],returns=value?.returns||[];
    const labels=params.map((p:any)=>String(p?.label||'').toLowerCase()).join('|');
    if(params.length===9 && returns.some((r:any)=>String(r?.component||'').toLowerCase()==='audio') && (labels.includes('text')||labels.includes('synth')))return Number(key);
  }
  throw new Error(`endpoint CosyVoice generate_audio introuvable (unnamed=${Object.keys(unnamed).join(',')||'aucun'})`);
}

async function cosyGenerate(spoken:string,mood:MonIAVoiceMood,reference:string){
  const app=await Client.connect(COSY_SPACE_ID,{events:['status','data']});
  const info:any=await app.view_api();
  const fnIndex=findGenerateEndpoint(info);
  const result:any=await app.predict(fnIndex,[
    spoken,
    'instruct',
    SEED_SENTENCE,
    handle_file(reference),
    null,
    instruction(mood),
    7319,
    false,
    'En',
  ]);
  const remote=deep(result?.data??result);
  if(!remote)throw new Error(`CosyVoice fn_index=${fnIndex} terminé sans audio`);
  return remote;
}

export async function speakLucasExpressive(text:string,options:Options={}):Promise<ExpressiveVoiceResult>{
  const spoken=clean(text).slice(0,190),mood=options.mood||inferVoiceMood(spoken),key=hash(`cosy-v2|${mood}|${spoken.toLowerCase()}`);
  try{
    const cached=readCache(key);if(cached){await play(cached,options);return {provider:'cosyvoice',audioUrl:cached,fallback:false}}
    const reference=await seedReference();
    const remote=await cosyGenerate(spoken,mood,reference);
    const stored=await persistGeneratedAudio(remote,key),url=stored.audioUrl||remote;if(stored.persisted)saveCache(key,url);
    await play(url,options);return {provider:'cosyvoice',audioUrl:url,fallback:false};
  }catch(error){
    const message=err(error);
    if(options.allowFallback===false){options.onError?.(message);return {provider:'cosyvoice',fallback:false,error:message}}
    options.onProvider?.('legacy');
    const legacy=await speakMonIAPremium(spoken,{actor:'Lucas',mood,onStart:options.onStart,onEnd:options.onEnd,onError:options.onError});
    return {provider:'legacy',audioUrl:legacy.audioUrl,fallback:true,error:message};
  }
}
