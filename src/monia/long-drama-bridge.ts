import { moniaExperience } from './experience-runtime';
import { materializeLongDrama, playLongDrama, type MonIALongDrama } from './long-drama';
import { GAMEPLAY_DRAMA_EVENT, type GameplayDramaTrigger } from './gameplay-drama-trigger';
import { approvedDramaForSignature, saveDramaCandidate } from './drama-approval';

const runtime=moniaExperience as any;
let gameplayRunning=false;

const KAGGLE_DISPATCH_URL='./api/monia-kaggle-dispatch.php';
const REPO_RAW='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main';
const MARION_CANON='https://marion-lucas.marionbolomey.fr/resources/monia/canon/marion/reference.jpg';
const LUCAS_CANON='https://marion-lucas.marionbolomey.fr/resources/monia/canon/lucas/reference.jpg';

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

function safeId(value:string){
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'scene';
}

function kaggleJobForTrigger(trigger:GameplayDramaTrigger){
  const id=`game-${safeId(trigger.signature)}-${Date.now().toString(36)}`;
  const dialogue=trigger.dialogue.length?trigger.dialogue.join(' · '):trigger.body;
  return{
    id,
    state:'queued',
    createdAt:new Date().toISOString(),
    source:'gameplay-surprise',
    candidateOnly:true,
    narrativeAuthority:false,
    sceneFamily:trigger.presentation||'gameplay-drama',
    signature:trigger.signature,
    primaryCharacter:'lucas',
    prompt:[
      'Photorealistic cinematic short scene from the Marion & Lucas life game.',
      `Event already decided by gameplay: ${trigger.title}. ${trigger.body}`,
      dialogue?`Dialogue/emotional beat: ${dialogue}.`:'',
      `Place: ${trigger.place}. Time: ${trigger.time}. Day: ${trigger.day}.`,
      `Relationship: ${relationLabel(trigger.relationship)}. Tone: ${trigger.tone}.`,
      `Marion outfit continuity: ${trigger.outfit||'current gameplay outfit'}.`,
      'Preserve Marion and Lucas canonical identities exactly. Natural movement, subtle breathing and micro-expressions, realistic skin and lighting, simple elegant camera.',
      'Do not invent future events or alter the gameplay event. Lucas remains faithful. No text, subtitles, watermark or UI.'
    ].filter(Boolean).join(' '),
    negativePrompt:'identity drift, face morphing, wrong person, distorted face, duplicate person, extra limbs, text, subtitles, watermark, UI, slideshow, photo zoom',
    characters:[
      {id:'marion',canonRef:MARION_CANON,wardrobe:trigger.outfit||'current gameplay outfit'},
      {id:'lucas',canonRef:LUCAS_CANON,wardrobe:'canon gameplay wardrobe'}
    ],
    motion:{referenceId:'gameplay-auto',tags:['natural-motion','micro-expression'],copyIdentity:false},
    generation:{provider:'kaggle',router:'ltx',width:320,height:512,frames:17,steps:8,fps:12,seconds:1.4,seed:Math.abs(hash(id))||240907},
    output:{candidatePath:`public/resources/monia/candidates/${id}/`}
  };
}

async function dispatchKagglePair(trigger:GameplayDramaTrigger):Promise<{id:string}|null>{
  const job=kaggleJobForTrigger(trigger);
  const response=await fetch(KAGGLE_DISPATCH_URL,{
    method:'POST',
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({job})
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null) as any;
    console.warn('[Drama] Kaggle dispatch unavailable; falling back to runtime generator',response.status,detail?.error||'');
    return null;
  }
  return{id:job.id};
}

async function waitForKagglePair(id:string):Promise<MonIALongDrama|null>{
  const base=`${REPO_RAW}/public/resources/monia/candidates/${encodeURIComponent(id)}`;
  for(let attempt=0;attempt<90;attempt++){
    if(attempt>0)await new Promise(resolve=>setTimeout(resolve,5000));
    if(document.hidden)return null;
    try{
      const response=await fetch(`${base}/result.json?t=${Date.now()}`,{cache:'no-store',mode:'cors'});
      if(!response.ok)continue;
      const result=await response.json() as any;
      if(result?.state!=='candidate'||result?.candidateOnly!==true||result?.narrativeAuthority!==false)continue;
      if(result?.selectionMode!=='surprise-auto'||!Array.isArray(result?.clips)||result.clips.length<2)continue;
      if(result?.continuity?.[0]!=='generated-image'||result?.continuity?.[1]!=='previous-video-frame')continue;
      const clips=result.clips.slice(0,2).map((name:string,index:number)=>({
        id:`${id}-${index+1}`,
        index,
        role:(index===0?'reaction':'two-shot') as any,
        framing:(index===0?'medium':'close') as any,
        videoUrl:`${base}/${encodeURIComponent(name)}?v=${Date.now()}`,
        state:'ready' as const,
        continuitySource:(index===0?'generated-image':'previous-video-frame') as any,
      }));
      return{id:`kaggle-${id}`,title:'Scène',state:'ready',targetDuration:clips.length*2,clips,errors:[]};
    }catch{}
  }
  return null;
}

async function generateAndPlayViaRuntime(trigger:GameplayDramaTrigger){
  const dialogue=trigger.dialogue.length?trigger.dialogue.join(' · '):trigger.body;
  const result=await runtime.respond({
    actor:'Lucas',
    requestedChannel:'scene',
    context:{
      speaker:'Marion',place:trigger.place,time:trigger.time,day:trigger.day,
      recentAction:`Le gameplay vient de déclencher cette scène : ${trigger.title}. ${trigger.body}`,
      activeObjective:'Matérialiser automatiquement cet événement déjà décidé par le gameplay en une courte scène cinématographique jouable, sans inventer un nouveau tournant.',
      relationship:relationLabel(trigger.relationship),
      memories:[...trigger.memories,dialogue].filter(Boolean).slice(0,10),recentEvents:trigger.recentEvents,
      rules:[
        'Le gameplay est l’autorité narrative : ne jamais remplacer, retarder ou inventer l’événement déclencheur.',
        'La joueuse ne doit pas avoir à valider manuellement cette scène : elle doit la découvrir uniquement au moment où elle arrive dans le jeu.',
        'Ne jamais révéler un événement futur ou une surprise.','Lucas reste absolument fidèle.',
        'Préserver les identités canoniques de Marion et Lucas dans chaque plan.',
        `Conserver la tenue actuelle de Marion : ${trigger.outfit||'tenue du gameplay'}.`,
        `Respecter le ton ${trigger.tone} et la présentation ${trigger.presentation}.`,
        'La scène doit rester courte et rendre le contrôle au gameplay immédiatement après.','Pas de texte, sous-titres, watermark ou UI dans les images générées.'
      ],
    },
    availableMedia:['lucas-intro.mp4','appartement-nimes.png'],
  },'auto',true);
  const channel=result?.response?.channel;
  const cinematic=result?.mediaPlan?.mode==='cinematic-drama'||channel==='scene'||channel==='video';
  if(!cinematic||!result?.mediaPlan?.visual?.required)return;
  const generated=await materializeLongDrama(result);
  saveDramaCandidate(trigger.signature,generated);
  playRuntimeDrama(generated,'generated');
}

async function generateAndPlay(trigger:GameplayDramaTrigger){
  const dispatched=await dispatchKagglePair(trigger).catch(()=>null);
  if(dispatched){
    const generated=await waitForKagglePair(dispatched.id);
    if(generated){
      saveDramaCandidate(trigger.signature,generated);
      if(playRuntimeDrama(generated,'generated'))console.info('[Drama] Kaggle surprise pair auto-played',trigger.signature);
      return;
    }
    console.warn('[Drama] Kaggle surprise pair timed out; using runtime fallback',trigger.signature);
  }
  await generateAndPlayViaRuntime(trigger);
}

async function handleGameplayDrama(trigger:GameplayDramaTrigger){
  if(gameplayRunning||document.hidden)return;
  gameplayRunning=true;
  try{
    const approved=await approvedDramaForSignature(trigger.signature);
    if(approved&&playRuntimeDrama(approved,'approved'))return;
    await generateAndPlay(trigger);
  }catch(error){console.warn('[Drama] Gameplay-triggered Drama generation failed; gameplay continues normally',error)}
  finally{gameplayRunning=false}
}

window.addEventListener(GAMEPLAY_DRAMA_EVENT,((event:Event)=>{
  const trigger=(event as CustomEvent<GameplayDramaTrigger>).detail;
  if(trigger?.source==='gameplay')void handleGameplayDrama(trigger);
}) as EventListener);

function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return h}

console.info('[Drama] Surprise Kaggle runtime active: gameplay dispatches a two-clip continuity-linked pair and auto-plays it after safety checks; manual review is debug-only');
