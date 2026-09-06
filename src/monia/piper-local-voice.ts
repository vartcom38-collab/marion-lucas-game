import * as tts from '@mintplex-labs/piper-tts-web';

export const LUCAS_PIPER_VOICE='fr_FR-tom-medium';
let currentAudio:HTMLAudioElement|null=null;

export type PiperProgress={label:string;percent?:number};

export async function ensureLucasPiperVoice(onProgress?:(p:PiperProgress)=>void){
  const stored=await tts.stored().catch(()=>[] as string[]);
  if(stored.includes(LUCAS_PIPER_VOICE))return true;
  onProgress?.({label:'Téléchargement initial de la voix locale de Lucas'});
  await tts.download(LUCAS_PIPER_VOICE,(progress:any)=>{
    const total=Number(progress?.total||0),loaded=Number(progress?.loaded||0);
    const percent=total>0?Math.max(0,Math.min(100,Math.round(loaded*100/total))):undefined;
    onProgress?.({label:'Téléchargement initial de la voix locale de Lucas',percent});
  });
  return true;
}

export async function synthesizeLucasPiper(text:string,onProgress?:(p:PiperProgress)=>void){
  await ensureLucasPiperVoice(onProgress);
  onProgress?.({label:'Synthèse locale de la voix de Lucas'});
  return tts.predict({text:text.slice(0,700),voiceId:LUCAS_PIPER_VOICE},(progress:any)=>{
    const total=Number(progress?.total||0),loaded=Number(progress?.loaded||0);
    const percent=total>0?Math.max(0,Math.min(100,Math.round(loaded*100/total))):undefined;
    onProgress?.({label:'Préparation locale de la voix de Lucas',percent});
  });
}

export function stopLucasPiper(){
  if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null}
}

export async function playLucasPiper(text:string,options:{
  onProgress?:(p:PiperProgress)=>void;
  onStart?:()=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
}={}){
  try{
    stopLucasPiper();
    const wav=await synthesizeLucasPiper(text,options.onProgress);
    const url=URL.createObjectURL(wav);
    const audio=new Audio(url);currentAudio=audio;audio.preload='auto';
    audio.onplay=()=>options.onStart?.();
    audio.onended=()=>{URL.revokeObjectURL(url);currentAudio=null;options.onEnd?.()};
    audio.onerror=()=>{URL.revokeObjectURL(url);currentAudio=null;options.onError?.('lecture Piper locale impossible')};
    await audio.play();
    return {ok:true as const,provider:'piper-local' as const,audio};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    options.onError?.(message);
    return {ok:false as const,provider:'piper-local' as const,error:message};
  }
}
