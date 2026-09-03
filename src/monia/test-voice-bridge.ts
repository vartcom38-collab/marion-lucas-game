import { cancelMonIAVoice, inferVoiceMood, speakMonIAPremium } from './voice-engine';

const diagnostics=()=>document.getElementById('diagnostics');
const answer=()=>document.getElementById('answer');
let speaking=false;

async function playPremium(button:HTMLButtonElement){
  const text=(answer()?.textContent||'').trim();
  if(!text)return;
  if(speaking){cancelMonIAVoice();speaking=false;button.textContent='▶ Écouter le vocal';return;}
  speaking=true;button.textContent='⏳ Voix Lucas…';
  const diag=diagnostics();if(diag)diag.textContent='Test vocal : moteur Lucas premium en cours…';
  const result=await speakMonIAPremium(text,{
    actor:'Lucas',
    mood:inferVoiceMood(text),
    onProvider:provider=>{if(diag)diag.textContent=`Test vocal : provider réellement utilisé = ${provider}`},
    onStart:()=>{button.textContent='■ Lecture…'},
    onEnd:()=>{speaking=false;button.textContent='▶ Écouter le vocal'},
    onError:error=>{speaking=false;button.textContent='▶ Écouter le vocal';if(diag)diag.textContent=`Test vocal Lucas indisponible : ${error}`},
  });
  if(diag){
    const extra=result.error?` · ${result.error}`:'';
    diag.textContent=`Test vocal Lucas : ${result.provider}${result.fallback?' (secours)':''}${result.cacheHit?' · cache':''}${extra}`;
  }
  if(result.provider==='browser'&&result.error&&!result.audioUrl){speaking=false;button.textContent='▶ Écouter le vocal';}
}

document.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest('#audioZone .audioPlay') as HTMLButtonElement|null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  void playPremium(button);
},true);

console.info('[MonIA Test] Premium Lucas voice bridge active');
