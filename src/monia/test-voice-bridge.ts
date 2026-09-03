import { cancelMonIAVoice, inferVoiceMood } from './voice-engine';
import { speakLucasExpressive } from './expressive-voice';

const diagnostics=()=>document.getElementById('diagnostics');
const answer=()=>document.getElementById('answer');
let speaking=false;

async function playPremium(button:HTMLButtonElement){
  const text=(answer()?.textContent||'').trim();
  if(!text)return;
  if(speaking){cancelMonIAVoice();speaking=false;button.textContent='▶ Écouter le vocal';return;}
  speaking=true;button.textContent='⏳ Voix Lucas expressive…';
  const diag=diagnostics();if(diag)diag.textContent='Test vocal : génération expressive de Lucas en cours…';
  const result=await speakLucasExpressive(text,{
    mood:inferVoiceMood(text),
    onProvider:provider=>{if(diag)diag.textContent=`Test vocal : provider réellement utilisé = ${provider}`},
    onStart:()=>{button.textContent='■ Lecture…'},
    onEnd:()=>{speaking=false;button.textContent='▶ Écouter le vocal'},
    onError:error=>{speaking=false;button.textContent='▶ Écouter le vocal';if(diag)diag.textContent=`Test vocal Lucas : ${error}`},
  });
  if(diag){const extra=result.error?` · ${result.error}`:'';diag.textContent=`Test vocal Lucas : ${result.provider}${result.fallback?' (secours)':''}${extra}`;}
  if(result.fallback&&result.error&&!result.audioUrl){speaking=false;button.textContent='▶ Écouter le vocal';}
}

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest('#audioZone .audioPlay') as HTMLButtonElement|null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void playPremium(button);
},true);

console.info('[MonIA Test] Expressive Lucas voice bridge active');
