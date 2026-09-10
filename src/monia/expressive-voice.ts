import { Client, handle_file } from '@gradio/client';
import { persistGeneratedAudio } from './server-media-store';
import { inferVoiceMood, speakMonIAPremium, type MonIAVoiceMood } from './voice-engine';
import { inspectVoiceAudio, voiceQualitySummary, type VoiceQualityReport } from './voice-quality';
import { inspectLucasVoiceConsistency, voiceConsistencySummary, type VoiceConsistencyReport } from './voice-consistency';
import { getLucasGenerationVoiceReference, type LucasVoiceReference } from './voice-reference-provider';

export type ExpressiveVoiceResult={provider:'cosyvoice'|'legacy';audioUrl?:string;fallback:boolean;error?:string;stage?:string;quality?:VoiceQualityReport;consistency?:VoiceConsistencyReport;referenceSource?:LucasVoiceReference['source']};

type Options={
  mood?:MonIAVoiceMood;
  allowFallback?:boolean;
  onStart?:()=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
  onProvider?:(provider:'cosyvoice'|'legacy')=>void;
  onStage?:(stage:string)=>void;
  onQuality?:(quality:VoiceQualityReport)=>void;
  onConsistency?:(consistency:VoiceConsistencyReport)=>void;
};

const COSY_SPACE_ID='FunAudioLLM/Fun-CosyVoice3-0.5B';
const CACHE_KEY='monia-expressive-lucas-v4';
let currentAudio:HTMLAudioElement|null=null;

function clean(value:string){return value.replace(/\[\[[^\]]+\]\]/g,' ').replace(/[🎥📹☎🎬▶■◇●🎙]/g,' ').replace(/\s+/g,' ').trim()}
function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function err(v:unknown){return v instanceof Error?v.message:String(v??'service indisponible')}
function deep(value:any):string{if(!value)return'';if(typeof value==='string')return /^https?:\/\//.test(value)||/\.(wav|mp3|flac|ogg|m4a)(?:$|\?)/i.test(value)?value:'';if(Array.isArray(value)){for(const x of value){const f=deep(x);if(f)return f}return''}for(const x of [value.url,value.path,value.audio?.url,value.audio?.path,value.data,value.output,value.outputs,value.result,value.files]){const f=deep(x);if(f)return f}return''}

function instruction(mood:MonIAVoiceMood){
  const common='Parle en français comme un jeune homme dans une conversation privée réelle. Garde exactement le même locuteur que la référence fournie : timbre, âge vocal, placement et couleur générale. Voix masculine chaude et naturelle, rythme humain irrégulier, respirations discrètes, petites hésitations naturelles, aucune diction de présentateur ou de synthèse vocale.';
  if(mood==='tired')return `${common} Il est fatigué après une longue journée : voix plus basse, un peu soufflée, calme mais émotionnellement présent.`;
  if(mood==='soft')return `${common} Il est tendre et proche : douceur retenue, affection sincère, léger sourire audible, pauses délicates.`;
  if(mood==='warm')return `${common} Il est vraiment heureux de l'entendre : chaleur détendue, sourire discret, énergie spontanée.`;
  if(mood==='intense')return `${common} Il est très ému mais se contrôle : tension contenue, voix ferme, silences chargés, sans crier.`;
  return `${common} Il répond calmement et spontanément, comme pendant une vraie visio.`;
}

function readCache(key:string){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')?.[key]||''}catch{return''}}
function saveCache(key:string,url:string){if(!(url.startsWith('/')||url.startsWith(location.origin)))return;try{const all=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');all[key]=url;localStorage.setItem(CACHE_KEY,JSON.stringify(all))}catch{}}
async function play(url:string,options:Options){options.onStage?.('7/7 · lecture audio validée');if(currentAudio){currentAudio.pause();currentAudio=null}const audio=new Audio(url);currentAudio=audio;audio.onplay=()=>{options.onProvider?.('cosyvoice');options.onStart?.()};audio.onended=()=>{currentAudio=null;options.onEnd?.()};audio.onerror=()=>options.onError?.('lecture CosyVoice impossible');await audio.play()}

function findGenerateEndpoint(info:any){
  const unnamed=info?.unnamed_endpoints||{};
  for(const [key,value] of Object.entries<any>(unnamed)){
    const params=value?.parameters||[],returns=value?.returns||[];
    const labels=params.map((p:any)=>String(p?.label||'').toLowerCase()).join('|');
    if(params.length===9&&returns.some((r:any)=>String(r?.component||'').toLowerCase()==='audio')&&(labels.includes('text')||labels.includes('synth')))return Number(key);
  }
  throw new Error(`endpoint CosyVoice generate_audio introuvable (unnamed=${Object.keys(unnamed).join(',')||'aucun'})`);
}

async function cosyGenerate(spoken:string,mood:MonIAVoiceMood,reference:LucasVoiceReference,onStage?:(stage:string)=>void){
  onStage?.(`1/7 · référence Lucas ${reference.source==='approved-url'?'approuvée':'canon embarqué'}`);
  const app=await Client.connect(COSY_SPACE_ID,{events:['status','data']});
  onStage?.('2/7 · connexion moteur vocal');
  const info:any=await app.view_api();
  onStage?.('3/7 · préparation clonage de timbre');
  const fnIndex=findGenerateEndpoint(info);
  onStage?.('4/7 · génération depuis la référence Lucas');
  const result:any=await app.predict(fnIndex,[spoken,'instruct',reference.transcript,handle_file(reference.file),null,instruction(mood),7319,false,'En']);
  const remote=deep(result?.data??result);
  if(!remote)throw new Error(`CosyVoice fn_index=${fnIndex} terminé sans audio`);
  return remote;
}

async function preflight(url:string,options:Options){
  options.onStage?.('5/7 · contrôle qualité de la voix');
  const quality=await inspectVoiceAudio(url);options.onQuality?.(quality);
  if(quality.status==='reject')throw new Error(voiceQualitySummary(quality));
  options.onStage?.('6/7 · contrôle cohérence Lucas');
  const consistency=await inspectLucasVoiceConsistency(url);options.onConsistency?.(consistency);
  if(consistency.status==='hold')throw new Error(voiceConsistencySummary(consistency));
  return {quality,consistency};
}

export async function speakLucasExpressive(text:string,options:Options={}):Promise<ExpressiveVoiceResult>{
  const spoken=clean(text).slice(0,190),mood=options.mood||inferVoiceMood(spoken);
  let stage='initialisation',quality:VoiceQualityReport|undefined,consistency:VoiceConsistencyReport|undefined,referenceSource:LucasVoiceReference['source']|undefined;
  const setStage=(value:string)=>{stage=value;options.onStage?.(value)};
  try{
    const reference=await getLucasGenerationVoiceReference();referenceSource=reference.source;
    const key=hash(`cosy-v4|${reference.source}|${mood}|${spoken.toLowerCase()}`);
    const cached=readCache(key);
    if(cached){setStage('5/7 · contrôle cache Lucas');({quality,consistency}=await preflight(cached,options));await play(cached,options);return {provider:'cosyvoice',audioUrl:cached,fallback:false,stage,quality,consistency,referenceSource}}
    const remote=await cosyGenerate(spoken,mood,reference,setStage);
    setStage('4.5/7 · stockage audio Infomaniak');
    const stored=await persistGeneratedAudio(remote,key),url=stored.audioUrl||remote;
    ({quality,consistency}=await preflight(url,options));
    if(stored.persisted)saveCache(key,url);
    await play(url,options);return {provider:'cosyvoice',audioUrl:url,fallback:false,stage,quality,consistency,referenceSource};
  }catch(error){
    const message=`${stage} · ${err(error)}`;
    if(options.allowFallback===false){options.onError?.(message);return {provider:'cosyvoice',fallback:false,error:message,stage,quality,consistency,referenceSource}}
    options.onProvider?.('legacy');
    const legacy=await speakMonIAPremium(spoken,{actor:'Lucas',mood,onStart:options.onStart,onEnd:options.onEnd,onError:options.onError});
    return {provider:'legacy',audioUrl:legacy.audioUrl,fallback:true,error:message,stage,quality,consistency,referenceSource};
  }
}
