import { cancelMonIAVoice } from './voice-engine';
import { synthesizeLucasLocal, LUCAS_LOCAL_VOICE_ID } from './local-piper-voice';

const diagnostics=()=>document.getElementById('diagnostics');
const answer=()=>document.getElementById('answer');
let speaking=false;
let audio:HTMLAudioElement|null=null;

async function playLocal(button:HTMLButtonElement){
  const text=(answer()?.textContent||'').trim();
  if(!text)return;
  if(speaking){cancelMonIAVoice();if(audio){audio.pause();audio.src='';audio=null}speaking=false;button.textContent='▶ Écouter Lucas local';return;}
  speaking=true;button.textContent='⏳ Piper local…';
  const diag=diagnostics();if(diag)diag.textContent=`Test vocal Lucas : Piper local ${LUCAS_LOCAL_VOICE_ID}…`;
  const result=await synthesizeLucasLocal(text,detail=>{if(diag)diag.textContent=`Piper Lucas · ${detail}`});
  if(!result.ok||!result.audioUrl){speaking=false;button.textContent='▶ Écouter Lucas local';if(diag)diag.textContent=`❌ Piper local en échec : ${result.error||'audio indisponible'}`;return;}
  audio=new Audio(result.audioUrl);audio.preload='auto';
  audio.onplay=()=>{button.textContent='■ Lecture Piper locale…';if(diag)diag.textContent=`✓ Voix locale Lucas · ${LUCAS_LOCAL_VOICE_ID}`};
  audio.onended=()=>{speaking=false;audio=null;button.textContent='▶ Écouter Lucas local'};
  audio.onerror=()=>{speaking=false;audio=null;button.textContent='▶ Écouter Lucas local';if(diag)diag.textContent='❌ Lecture Piper locale impossible'};
  try{await audio.play()}catch(error){speaking=false;audio=null;button.textContent='▶ Écouter Lucas local';if(diag)diag.textContent=`❌ Lecture bloquée : ${error instanceof Error?error.message:String(error)}`;}
}

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest('#audioZone .audioPlay') as HTMLButtonElement|null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void playLocal(button);
},true);

console.info('[MonIA Test] Local Piper Lucas diagnostics active');
