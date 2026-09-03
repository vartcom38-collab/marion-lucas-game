import { cancelMonIAVoice, inferVoiceMood, speakMonIAPremium } from './voice-engine';

let activeButton:HTMLButtonElement|null=null;

function restore(){if(activeButton){activeButton.textContent='▶';activeButton.disabled=false;activeButton=null}}

async function playVoiceNote(button:HTMLButtonElement,text:string){
  const clean=text.trim();if(!clean)return;
  cancelMonIAVoice();restore();activeButton=button;button.disabled=true;button.textContent='…';
  await speakMonIAPremium(clean,{
    actor:'Lucas',mood:inferVoiceMood(clean),
    onStart:()=>{button.disabled=false;button.textContent='■'},
    onEnd:restore,
    onError:restore,
    onProvider:provider=>{button.title=provider==='chatterbox'?'Voix MonIA premium':'Voix locale de secours'},
  });
}

window.addEventListener('click',event=>{
  const target=event.target as HTMLElement|null;
  const button=target?.closest('.voiceNote button') as HTMLButtonElement|null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(activeButton===button){cancelMonIAVoice();restore();return}
  const article=button.closest('.msg');
  const transcript=article?.querySelector('.voiceTranscript')?.textContent||'';
  void playVoiceNote(button,transcript);
},true);

window.addEventListener('beforeunload',cancelMonIAVoice);
console.info('[MonIA] Premium persistent actor voice bridge active for voice notes');
