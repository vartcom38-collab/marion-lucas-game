import { cancelMonIAVoice } from './voice-engine';
import { speakLucasExpressive } from './expressive-voice';

const diagnostics=()=>document.getElementById('diagnostics');
const answer=()=>document.getElementById('answer');
let speaking=false;

async function playPremium(button:HTMLButtonElement){
  const text=(answer()?.textContent||'').trim();
  if(!text)return;
  if(speaking){cancelMonIAVoice();speaking=false;button.textContent='▶ Écouter le vocal';return;}
  speaking=true;button.textContent='⏳ CosyVoice…';
  const diag=diagnostics();if(diag)diag.textContent='Test vocal Lucas : CosyVoice expressif strict en cours…';
  const result=await speakLucasExpressive(text,{
    allowFallback:false,
    onProvider:provider=>{if(diag)diag.textContent=`Test vocal Lucas : provider réellement utilisé = ${provider}`},
    onStart:()=>{button.textContent='■ Lecture CosyVoice…'},
    onEnd:()=>{speaking=false;button.textContent='▶ Écouter le vocal'},
    onError:error=>{speaking=false;button.textContent='▶ Écouter le vocal';if(diag)diag.textContent=`❌ CosyVoice réel en échec : ${error}`},
  });
  if(diag){
    if(result.error)diag.textContent=`❌ CosyVoice réel en échec : ${result.error}`;
    else diag.textContent='✓ Test vocal Lucas : provider = cosyvoice expressif';
  }
  if(result.error){speaking=false;button.textContent='▶ Écouter le vocal';}
}

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest('#audioZone .audioPlay') as HTMLButtonElement|null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void playPremium(button);
},true);

console.info('[MonIA Test] Strict expressive CosyVoice bridge active');
