import { moniaExperience } from './experience-runtime';
import { materializeLongDrama, playLongDrama, type MonIALongDrama } from './long-drama';
import { GAMEPLAY_DRAMA_EVENT, type GameplayDramaTrigger } from './gameplay-drama-trigger';
import { approvedDramaForSignature, saveDramaCandidate } from './drama-approval';

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

function playApprovedDrama(drama:MonIALongDrama){
  if(!dramaPassesQualityGate(drama)){
    console.warn('[Drama] Approved asset failed runtime integrity gate; gameplay continues',drama.id);
    return;
  }
  if(document.visibilityState==='visible'&&!document.getElementById('moniaVisioOverlay'))playLongDrama(drama);
}

function relationLabel(value:number){
  if(value>=70)return'relation très forte et intime';
  if(value>=45)return'relation proche et solide';
  if(value>=25)return'relation affectueuse en construction';
  if(value>=10)return'relation naissante';
  return'ils se connaissent encore peu';
}

async function generateCandidate(trigger:GameplayDramaTrigger){
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
      activeObjective:'Préparer un candidat cinématographique de cet événement déjà décidé par le gameplay, sans inventer un nouveau tournant.',
      relationship:relationLabel(trigger.relationship),
      memories:[...trigger.memories,dialogue].filter(Boolean).slice(0,10),
      recentEvents:trigger.recentEvents,
      rules:[
        'Le gameplay est l’autorité narrative : ne jamais remplacer, retarder ou inventer l’événement déclencheur.',
        'Cette génération est un candidat de validation et ne doit jamais être publiée automatiquement dans le jeu.',
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

  const candidate=await materializeLongDrama(result);
  saveDramaCandidate(trigger.signature,candidate);
  console.info('[Drama] Fresh generation stored as candidate only; never auto-played',trigger.signature);
}

async function handleGameplayDrama(trigger:GameplayDramaTrigger){
  if(gameplayRunning||document.hidden)return;
  gameplayRunning=true;
  try{
    const approved=await approvedDramaForSignature(trigger.signature);
    if(approved){
      playApprovedDrama(approved);
      return;
    }
    void generateCandidate(trigger).catch(error=>console.warn('[Drama] Candidate generation failed; gameplay continues normally',error));
  }catch(error){
    console.warn('[Drama] Gameplay-triggered Drama lookup failed; gameplay continues normally',error);
  }finally{
    gameplayRunning=false;
  }
}

window.addEventListener(GAMEPLAY_DRAMA_EVENT,((event:Event)=>{
  const trigger=(event as CustomEvent<GameplayDramaTrigger>).detail;
  if(trigger?.source==='gameplay')void handleGameplayDrama(trigger);
}) as EventListener);

console.info('[Drama] Strict gameplay-only + approval-first bridge active: generated media remains candidate-only');
