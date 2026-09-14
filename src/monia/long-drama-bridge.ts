import { moniaExperience } from './experience-runtime';
import { materializeLongDrama, playLongDrama, type MonIALongDrama } from './long-drama';
import { GAMEPLAY_DRAMA_EVENT, type GameplayDramaTrigger } from './gameplay-drama-trigger';
import { approvedDramaForSignature, saveDramaCandidate } from './drama-approval';
import { getLucasPresence } from './lucas-presence-engine';

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

function lucasCanAppearNow(){
  const presence=getLucasPresence();
  return presence?.together===true;
}

function playApprovedRuntimeDrama(drama:MonIALongDrama){
  if(!lucasCanAppearNow()){
    console.warn('[Drama] approved scene blocked because Lucas is not physically with Marion');
    return false;
  }
  if(!dramaPassesQualityGate(drama)){
    console.warn('[Drama] approved asset failed runtime integrity gate; gameplay continues',drama.id);
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
    motion:{referenceId:'gameplay-candidate',tags:['natural-motion','micro-expression'],copyIdentity:false},
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
    console.warn('[Drama] Kaggle dispatch unavailable; falling back to runtime candidate generator',response.status,detail?.error||'');
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

async function generateCandidateViaRuntime(trigger:GameplayDramaTrigger){
  const dialogue=trigger.dialogue.length?trigger.dialogue.join(' · '):trigger.body;
  const result=await runtime.respond({
    actor:'Lucas',
    requestedChannel:'scene',
    context:{
      speaker:'Marion',place:trigger.place,time:trigger.time,day:trigger.day,
      recentAction:`Le gameplay vient d'autoriser cette scène candidate : ${trigger.title}. ${trigger.body}`,
      activeObjective:'Matérialiser cet événement déjà décidé par le gameplay en candidat cinématographique à réviser. Ne jamais publier ni jouer automatiquement ce candidat.',
      relationship:relationLabel(trigger.relationship),
      memories:[...trigger.memories,dialogue].filter(Boolean).slice(0,10),recentEvents:trigger.recentEvents,
      rules:[
        'Le gameplay est l’autorité narrative : ne jamais remplacer, retarder ou inventer l’événement déclencheur.',
        'Toute génération fraîche reste un candidat hors-live jusqu’à approbation explicite.',
        'Ne jamais révéler un événement futur ou une surprise.','Lucas reste absolument fidèle.',
        'Préserver les identités canoniques de Marion et Lucas dans chaque plan.',
        `Conserver la tenue actuelle de Marion : ${trigger.outfit||'tenue du gameplay'}.`,
        `Respecter le ton ${trigger.tone} et la présentation ${trigger.presentation}.`,
        'La scène doit rester courte. Pas de texte, sous-titres, watermark ou UI dans les images générées.'
      ],
    },
    availableMedia:['lucas-intro.mp4','appartement-nimes.png'],
  },'auto',true);
  const channel=result?.response?.channel;
  const cinematic=result?.mediaPlan?.mode==='cinematic-drama'||channel==='scene'||channel==='video';
  if(!cinematic||!result?.mediaPlan?.visual?.required)return null;
  const generated=await materializeLongDrama(result);
  saveDramaCandidate(trigger.signature,generated);
  console.info('[Drama] runtime candidate saved for review; never auto-played',trigger.signature);
  return generated;
}

async function generateCandidate(trigger:GameplayDramaTrigger){
  if(!lucasCanAppearNow()){
    console.info('[Drama] candidate generation skipped: Lucas is not physically with Marion',trigger.requestId);
    return;
  }
  const dispatched=await dispatchKagglePair(trigger).catch(()=>null);
  if(dispatched){
    const generated=await waitForKagglePair(dispatched.id);
    if(generated){
      saveDramaCandidate(trigger.signature,generated);
      console.info('[Drama] Kaggle candidate saved for review; never auto-played',trigger.signature);
      return;
    }
    console.warn('[Drama] Kaggle candidate timed out; using runtime candidate fallback',trigger.signature);
  }
  await generateCandidateViaRuntime(trigger);
}

async function handleGameplayDrama(trigger:GameplayDramaTrigger){
  if(gameplayRunning||document.hidden)return;
  gameplayRunning=true;
  try{
    if(!lucasCanAppearNow()){
      console.info('[Drama] explicit request ignored because current cast no longer matches',trigger.requestId);
      return;
    }
    const approved=await approvedDramaForSignature(trigger.signature);
    if(approved){
      playApprovedRuntimeDrama(approved);
      return;
    }
    await generateCandidate(trigger);
  }catch(error){console.warn('[Drama] Gameplay-triggered candidate generation failed; gameplay continues normally',error)}
  finally{gameplayRunning=false}
}

window.addEventListener(GAMEPLAY_DRAMA_EVENT,((event:Event)=>{
  const trigger=(event as CustomEvent<GameplayDramaTrigger>).detail;
  if(trigger?.source==='gameplay')void handleGameplayDrama(trigger);
}) as EventListener);

function hash(value:string){let h=0;for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;return h}

console.info('[Drama] Gameplay-only cinematic pipeline active: approved assets may play; fresh generations are candidate-only');
