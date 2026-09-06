import { moniaExperience } from './experience-runtime';
import { materializeLongDrama, playLongDrama, readLongDrama, type MonIALongDrama } from './long-drama';
import { GAMEPLAY_DRAMA_EVENT, type GameplayDramaTrigger } from './gameplay-drama-trigger';

const runtime=moniaExperience as any;
let gameplayRunning=false;

function dramaPassesQualityGate(drama:MonIALongDrama|null){
  if(!drama||drama.state!=='ready'||drama.clips.length<3)return false;
  if(!drama.clips.every(c=>c.state==='ready'&&Boolean(c.videoUrl)))return false;
  if(drama.clips[0]?.role!=='establishing'||drama.clips[0]?.continuitySource!=='generated-image')return false;
  if(!drama.clips.slice(1).every(c=>c.continuitySource==='previous-video-frame'))return false;
  if(!drama.clips.some(c=>c.role==='dialogue'||c.role==='reaction'||c.role==='two-shot'))return false;
  return true;
}

function deliverDrama(drama:MonIALongDrama){
  if(!dramaPassesQualityGate(drama)){
    console.warn('[Drama] Quality gate rejected incomplete or discontinuous scene; gameplay continues normally',drama.state,drama.errors);
    return;
  }
  if(document.visibilityState==='visible'&&!document.getElementById('moniaVisioOverlay'))playLongDrama(drama);
  else try{sessionStorage.setItem('monia-long-drama-pending-v1','1')}catch{}
}

function relationLabel(value:number){
  if(value>=70)return'relation très forte et intime';
  if(value>=45)return'relation proche et solide';
  if(value>=25)return'relation affectueuse en construction';
  if(value>=10)return'relation naissante';
  return'ils se connaissent encore peu';
}

async function handleGameplayDrama(trigger:GameplayDramaTrigger){
  if(gameplayRunning||document.hidden)return;
  gameplayRunning=true;
  try{
    const dialogue=trigger.dialogue.length?trigger.dialogue.join(' · '):trigger.body;
    const result=await runtime.respond({
      actor:'Lucas',
      requestedChannel:'scene',
      context:{
        speaker:'Marion',
        place:trigger.place,
        time:trigger.time,
        day:trigger.day,
        recentAction:`Le gameplay vient de déclencher cette scène : ${trigger.title}. ${trigger.body}`,
        activeObjective:'Mettre en scène cinématographiquement cet événement déjà décidé par le gameplay, sans inventer un nouveau tournant.',
        relationship:relationLabel(trigger.relationship),
        memories:[...trigger.memories,dialogue].filter(Boolean).slice(0,10),
        recentEvents:trigger.recentEvents,
        rules:[
          'Le gameplay est l’autorité narrative : ne jamais remplacer, retarder ou inventer l’événement déclencheur.',
          'Ne jamais révéler un événement futur ou une surprise.',
          'Lucas reste absolument fidèle.',
          'Préserver les identités canoniques de Marion et Lucas dans chaque plan.',
          `Conserver la tenue actuelle de Marion : ${trigger.outfit||'tenue du gameplay'}.`,
          `Respecter le ton ${trigger.tone} et la présentation ${trigger.presentation}.`,
          'La scène doit rester courte et rendre le contrôle au gameplay immédiatement après.',
          'Pas de texte, sous-titres, watermark ou UI dans les images générées.',
        ],
      },
      availableMedia:['lucas-intro.mp4','appartement-nimes.png'],
    },'auto',true);

    const channel=result?.response?.channel;
    const cinematic=result?.mediaPlan?.mode==='cinematic-drama'||channel==='scene'||channel==='video';
    if(!cinematic||!result?.mediaPlan?.visual?.required)return;

    const drama=await materializeLongDrama(result);
    deliverDrama(drama);
  }catch(error){
    console.warn('[Drama] Gameplay-triggered generation failed; gameplay continues normally',error);
  }finally{
    gameplayRunning=false;
  }
}

window.addEventListener(GAMEPLAY_DRAMA_EVENT,((event:Event)=>{
  const trigger=(event as CustomEvent<GameplayDramaTrigger>).detail;
  if(trigger?.source==='gameplay')void handleGameplayDrama(trigger);
}) as EventListener);

function playPending(){
  try{
    if(sessionStorage.getItem('monia-long-drama-pending-v1')!=='1')return;
    if(document.getElementById('moniaVisioOverlay'))return;
    sessionStorage.removeItem('monia-long-drama-pending-v1');
    const drama=readLongDrama();
    if(dramaPassesQualityGate(drama))playLongDrama(drama);
  }catch{}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)playPending()});
window.setInterval(playPending,1800);

console.info('[Drama] Strict gameplay-only generation bridge + real previous-frame continuity quality gate active');
