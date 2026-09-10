import { Client, handle_file } from '@gradio/client';
import { persistGeneratedAudio } from './server-media-store';
import { inferVoiceMood, speakMonIAPremium, type MonIAVoiceMood } from './voice-engine';
import { inspectVoiceAudio, voiceQualitySummary, type VoiceQualityReport } from './voice-quality';
import { inspectLucasVoiceConsistency, voiceConsistencySummary, type VoiceConsistencyReport } from './voice-consistency';
import { getLucasGenerationVoiceReference, type LucasVoiceReference } from './voice-reference-provider';
import { generateSelfHostedLucasVoice, getSelfHostedVoiceApi } from './self-hosted-voice';

export type ExpressiveVoiceResult={provider:'self-hosted'|'cosyvoice'|'legacy';audioUrl?:string;fallback:boolean;error?:string;stage?:string;quality?:VoiceQualityReport;consistency?:VoiceConsistencyReport;referenceSource?:LucasVoiceReference['source']};

type Options={mood?:MonIAVoiceMood;allowFallback?:boolean;onStart?:()=>void;onEnd?:()=>void;onError?:(error:string)=>void;onProvider?:(provider:'self-hosted'|'cosyvoice'|'legacy')=>void;onStage?:(stage:string)=>void;onQuality?:(quality:VoiceQualityReport)=>void;onConsistency?:(consistency:VoiceConsistencyReport)=>void;};

const COSY_SPACE_ID='FunAudioLLM/Fun-CosyVoice3-0.5B';
const CACHE_KEY='monia-expressive-lucas-v5';
let currentAudio:HTMLAudioElement|null=null;

function clean(value:string){return value.replace(/\[\[[^\]]+\]\]/g,' ').replace(/[🎥📹☎🎬▶■◇●🎙]/g,' ').replace(/\s+/g,' ').trim()}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function err(v:unknown){return v instanceof Error?v.message:String(v??'service indisponible')}
function deep(value:any):string{if(!value)return'';if(typeof value==='string')return /^https?:\/\//.test(value)||/\.(wav|mp3|flac|ogg|m4a)(?:$|\?)/i.test(value)?value:'';if(Array.isArray(value)){for(const x of value){const f=deep(x);if(f)return f}return''}for(const x of [value.url,value.path,value.audio?.url,value.audio?.path,value.data,value.output,value.outputs,value.result,value.files]){const f=deep(x);if(f)return f}return''}
function freeGpuReviewEnabled(){try{return new URLSearchParams(location.search).get('moniaFreeGpu')==='1'||location.hostname==='localhost'}catch{return false}}

function instruction(mood:MonIAVoiceMood){const common='Parle en français comme un jeune homme dans une conversation privée réelle. Garde exactement le même locuteur que la référence fournie : timbre, âge vocal, placement et couleur générale. Rythme humain irrégulier, respirations discrètes, fins de phrases non mécaniques, petites hésitations naturelles, aucune diction de présentateur ou de synthèse vocale.';if(mood==='tired')return `${common} Fatigué : voix plus basse, un peu soufflée, calme.`;if(mood==='soft')return `${common} Tendre et proche : douceur retenue, léger sourire audible, pauses délicates.`;if(mood==='warm')return `${common} Heureux de l'entendre : chaleur détendue, spontanéité.`;if(mood==='intense')return `${common} Très ému mais contenu : tension, silences courts, sans crier.`;return `${common} Répond calmement et spontanément, comme pendant une vraie visio.`;}

function readCache(key:string){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')?.[key]||''}catch{return''}}
function saveCache(key:string,url:string){if(!(url.startsWith('/')||url.startsWith(location.origin)))return;try{const all=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');all[key]=url;localStorage.setItem(CACHE_KEY,JSON.stringify(all))}catch{}}
async function play(url:string,options:Options,provider:'self-hosted'|'cosyvoice'){options.onStage?.('lecture voix Lucas');if(currentAudio){currentAudio.pause();currentAudio=null}const audio=new Audio(url);currentAudio=audio;audio.onplay=()=>{options.onProvider?.(provider);options.onStart?.()};audio.onended=()=>{currentAudio=null;options.onEnd?.()};audio.onerror=()=>options.onError?.('lecture voix Lucas impossible');await audio.play()}

function findGenerateEndpoint(info:any){const unnamed=info?.unnamed_endpoints||{};for(const [key,value] of Object.entries<any>(unnamed)){const params=value?.parameters||[],returns=value?.returns||[];const labels=params.map((p:any)=>String(p?.label||'').toLowerCase()).join('|');if(params.length===9&&returns.some((r:any)=>String(r?.component||'').toLowerCase()==='audio')&&(labels.includes('text')||labels.includes('synth')))return Number(key);}throw new Error('endpoint CosyVoice introuvable');}
async function cosyGenerate(spoken:string,mood:MonIAVoiceMood,reference:LucasVoiceReference,onStage?:(stage:string)=>void){onStage?.('génération de secours GPU gratuit');const app=await Client.connect(COSY_SPACE_ID,{events:['status','data']});const info:any=await app.view_api();const fnIndex=findGenerateEndpoint(info);const result:any=await app.predict(fnIndex,[spoken,'instruct',reference.transcript,handle_file(reference.file),null,instruction(mood),7319,false,'En']);const remote=deep(result?.data??result);if(!remote)throw new Error('CosyVoice terminé sans audio');return remote;}

async function preflight(url:string,options:Options){options.onStage?.('contrôle qualité voix');const quality=await inspectVoiceAudio(url);options.onQuality?.(quality);if(quality.status==='reject')throw new Error(voiceQualitySummary(quality));const consistency=await inspectLucasVoiceConsistency(url);options.onConsistency?.(consistency);if(consistency.status==='hold')throw new Error(voiceConsistencySummary(consistency));return {quality,consistency};}

export async function speakLucasExpressive(text:string,options:Options={}):Promise<ExpressiveVoiceResult>{
  const spoken=clean(text).slice(0,190),mood=options.mood||inferVoiceMood(spoken);let stage='initialisation',quality:VoiceQualityReport|undefined,consistency:VoiceConsistencyReport|undefined,referenceSource:LucasVoiceReference['source']|undefined;const setStage=(v:string)=>{stage=v;options.onStage?.(v)};
  try{
    const reference=await getLucasGenerationVoiceReference();referenceSource=reference.source;
    if(getSelfHostedVoiceApi()){
      setStage('génération MonIA auto-hébergée · sans quota GPU tiers');
      const url=await generateSelfHostedLucasVoice(spoken,reference,mood);
      ({quality,consistency}=await preflight(url,options));
      await play(url,options,'self-hosted');
      return {provider:'self-hosted',audioUrl:url,fallback:false,stage,quality,consistency,referenceSource};
    }
    if(freeGpuReviewEnabled()){
      const key=hash(`cosy-v5|${reference.source}|${mood}|${spoken.toLowerCase()}`),cached=readCache(key);
      if(cached){({quality,consistency}=await preflight(cached,options));await play(cached,options,'cosyvoice');return {provider:'cosyvoice',audioUrl:cached,fallback:false,stage,quality,consistency,referenceSource}}
      const remote=await cosyGenerate(spoken,mood,reference,setStage);const stored=await persistGeneratedAudio(remote,key),url=stored.audioUrl||remote;({quality,consistency}=await preflight(url,options));if(stored.persisted)saveCache(key,url);await play(url,options,'cosyvoice');return {provider:'cosyvoice',audioUrl:url,fallback:false,stage,quality,consistency,referenceSource};
    }
    throw new Error('service vocal auto-hébergé non connecté');
  }catch(error){const message=`${stage} · ${err(error)}`;if(options.allowFallback===false){options.onError?.(message);return {provider:'self-hosted',fallback:false,error:message,stage,quality,consistency,referenceSource}}options.onProvider?.('legacy');const legacy=await speakMonIAPremium(spoken,{actor:'Lucas',mood,onStart:options.onStart,onEnd:options.onEnd,onError:options.onError});return {provider:'legacy',audioUrl:legacy.audioUrl,fallback:true,error:message,stage,quality,consistency,referenceSource};}
}
