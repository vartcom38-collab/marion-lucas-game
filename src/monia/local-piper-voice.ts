export type LocalPiperStatus='idle'|'loading'|'ready'|'error';
export type LocalPiperResult={ok:boolean;audioUrl?:string;error?:string;voiceId:string};

const LUCAS_VOICE_ID='fr_FR-tom-medium';
let modulePromise:Promise<any>|null=null;
let prepared=false;
let currentObjectUrl:string|null=null;

function cleanError(value:unknown){
  const text=value instanceof Error?value.message:String(value??'');
  return text.replace(/\s+/g,' ').trim().slice(0,240)||'Piper local indisponible';
}

async function loadPiper(){
  if(!modulePromise)modulePromise=import('@mintplex-labs/piper-tts-web');
  return modulePromise;
}

export async function prepareLucasLocalVoice(onProgress?:(detail:string)=>void){
  try{
    const tts=await loadPiper();
    const stored=await tts.stored().catch(()=>[]);
    if(Array.isArray(stored)&&stored.includes(LUCAS_VOICE_ID)){prepared=true;onProgress?.('Voix locale Lucas déjà en cache');return {ok:true,voiceId:LUCAS_VOICE_ID};}
    onProgress?.('Téléchargement initial de la voix locale Lucas…');
    await tts.download(LUCAS_VOICE_ID,(progress:any)=>{
      const total=Number(progress?.total||0),loaded=Number(progress?.loaded||0);
      const pct=total>0?Math.max(0,Math.min(100,Math.round(loaded*100/total))):0;
      onProgress?.(pct?`Voix locale Lucas · ${pct}%`:'Voix locale Lucas · préparation');
    });
    prepared=true;
    return {ok:true,voiceId:LUCAS_VOICE_ID};
  }catch(error){return {ok:false,voiceId:LUCAS_VOICE_ID,error:cleanError(error)}}
}

export async function synthesizeLucasLocal(text:string,onProgress?:(detail:string)=>void):Promise<LocalPiperResult>{
  const clean=text.replace(/\s+/g,' ').trim();
  if(!clean)return {ok:false,voiceId:LUCAS_VOICE_ID,error:'texte vocal vide'};
  try{
    if(!prepared){const ready=await prepareLucasLocalVoice(onProgress);if(!ready.ok)return ready;}
    const tts=await loadPiper();
    onProgress?.('Lucas prépare sa voix locale…');
    const wav:Blob=await tts.predict({text:clean.slice(0,700),voiceId:LUCAS_VOICE_ID},(progress:any)=>{
      const total=Number(progress?.total||0),loaded=Number(progress?.loaded||0);
      const pct=total>0?Math.max(0,Math.min(100,Math.round(loaded*100/total))):0;
      if(pct)onProgress?.(`Voix locale Lucas · ${pct}%`);
    });
    if(!(wav instanceof Blob)||wav.size<256)throw new Error('Piper a renvoyé un audio vide');
    if(currentObjectUrl)URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl=URL.createObjectURL(wav);
    return {ok:true,audioUrl:currentObjectUrl,voiceId:LUCAS_VOICE_ID};
  }catch(error){return {ok:false,voiceId:LUCAS_VOICE_ID,error:cleanError(error)}}
}

export function releaseLucasLocalVoiceUrl(){if(currentObjectUrl){URL.revokeObjectURL(currentObjectUrl);currentObjectUrl=null}}
export const LUCAS_LOCAL_VOICE_ID=LUCAS_VOICE_ID;
