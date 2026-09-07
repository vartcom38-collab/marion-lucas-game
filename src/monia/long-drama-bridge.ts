import { moniaExperience } from './experience-runtime';
import { materializeLongDrama, playLongDrama, type MonIALongDrama } from './long-drama';
import { GAMEPLAY_DRAMA_EVENT, type GameplayDramaTrigger } from './gameplay-drama-trigger';
import { approvedDramaForSignature, saveDramaCandidate } from './drama-approval';

const runtime=moniaExperience as any;
let gameplayRunning=false;

function dramaPassesQualityGate(drama:MonIALongDrama|null){
  if(!drama||drama.state!=='ready'||drama.clips.length<2)return false;
  if(!drama.clips.every(c=>c.state==='ready'&&Boolean(c.videoUrl)))return false;
  if(drama.clips[0]?.continuitySource!=='generated-image')return false;
  if(!drama.clips.slice(1).every(c=>c.continuitySource==='previous-video-frame'))return false;
  if(!drama.clips.some(c=>c.role==='dialogue'||c.role==='reaction'||c.role==='two-shot'))return false;
  return true;
}

function playRuntimeDrama(drama:MonIALongDrama,source:'approved'|'generated'){
  if(!dramaPassesQualityGate(drama)){
    console.warn(`[Drama] ${source} asset failed runtime integrity gate; gameplay continues`,drama.id);
    return false;
  }
  if(document.visibilityState==='visible'&&!document.getElementById('moniaVisioOverlay')){
    playLongDrama(drama);
    return true;
  }
  return false;
}

function relationLabel(value:number){
  if(value>=70)return'relation très forte et intime';
  if(value>=45)return'relation proche et solide';
  if(value>=25)return'relation affectueuse en construction';
  if(value>=10)return'relation naissante';
  return'ils se connaissent encore peu';
}

async function generateAndPlay(trigger:GameplayDramaTrigger){
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
      activeObjective:'Matérialiser automatiquement cet événement déjà décidé par le gameplay en une courte scène cinématographique jouable, sans inventer un nouveau tournant.',
      relationship:relationLabel(trigger.relationship),
      memories:[...trigger.memories,dialogue].filter(Boolean).slice(0,10),
      recentEvents:trigger.recentEvents,
      rules:[
        'Le gameplay est l’autorité narrative : ne jamais remplacer, retarder ou inventer l’événement déclencheur.',
        'La joueuse ne doit pas avoir à valider manuellement cette scène : elle doit la découvrir uniquement au moment où elle arrive dans le jeu.',
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

  const generated=await materializeLongDrama(result);
  saveDramaCandidate(trigger.signature,generated);

  if(playRuntimeDrama(generated,'generated')){
    console.info('[Drama] Safe generated scene auto-played for surprise gameplay',trigger.signature);
  }else{
    console.warn('[Drama] Generated scene kept as debug candidate because runtime integrity gate did not pass',trigger.signature);
  }
}

async function handleGameplayDrama(trigger:GameplayDramaTrigger){
  if(gameplayRunning||document.hidden)return;
  gameplayRunning=true;
  try{
    const approved=await approvedDramaForSignature(trigger.signature);
    if(approved&&playRuntimeDrama(approved,'approved'))return;
    await generateAndPlay(trigger);
  }catch(error){
    console.warn('[Drama] Gameplay-triggered Drama generation failed; gameplay continues normally',error);
  }finally{
    gameplayRunning=false;
  }
}

window.addEventListener(GAMEPLAY_DRAMA_EVENT,((event:Event)=>{
  const trigger=(event as CustomEvent<GameplayDramaTrigger>).detail;
  if(trigger?.source==='gameplay')void handleGameplayDrama(trigger);
}) as EventListener);

console.info('[Drama] Surprise runtime active: safe generated scenes can auto-play; manual review remains debug-only');
