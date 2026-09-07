const start=document.getElementById('start') as HTMLButtonElement;
const state=document.getElementById('state') as HTMLElement;
const log=document.getElementById('log') as HTMLElement;
const videos=document.getElementById('videos') as HTMLElement;

const REPO_RAW='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main';
const MARION_FALLBACK=`${REPO_RAW}/public/resources/photo.png`;
const MARION_ATLAS=[0,1,2,3,4].map(i=>`${REPO_RAW}/assets/monia-atlas/chunks/marion-0${i}.b64`);
const LUCAS_PRIORITY=[
  `${REPO_RAW}/assets/monia-atlas/lucas-priority-01.jpg.b64`,
  `${REPO_RAW}/assets/monia-atlas/lucas-priority-02.jpg.b64`
];
const LUCAS_FALLBACK='https://marion-lucas.marionbolomey.fr/resources/monia/canon/lucas/reference.jpg';
const APARTMENT=`${REPO_RAW}/public/resources/appartement-nimes.png`;
const RAW=`${REPO_RAW}/public/resources/monia/candidates`;

function testJob(){
  const id=`manual-opening-test-${Date.now().toString(36)}`;
  return{
    id,state:'queued',createdAt:new Date().toISOString(),source:'manual-opening-test',candidateOnly:true,narrativeAuthority:false,
    sceneFamily:'opening-intro',signature:'MONIA_NEW_GAME_OPENING_V1',primaryCharacter:'marion',
    prompt:'Premium photorealistic cinematic opening for the game Marion & Lucas. Romantic life-simulation mood, elegant natural light, subtle suspense, realistic body language and micro-expressions. Opening atmosphere only: no future-story reveal, no subtitles, no watermark, no UI, no slideshow.',
    negativePrompt:'identity drift, face morphing, wrong person, distorted face, duplicate person, extra limbs, text, subtitles, watermark, UI, slideshow, photo zoom, portrait framing, vertical video, exaggerated acting, kiss, wedding, children, spoiler',
    characters:[
      {id:'marion',identityMode:'atlas-pack',atlasChunks:MARION_ATLAS,canonRef:MARION_FALLBACK,wardrobe:'natural contemporary morning outfit, understated and elegant'},
      {id:'lucas',identityMode:'priority-image-pack',priorityImages:LUCAS_PRIORITY,canonRef:LUCAS_FALLBACK,wardrobe:'dark contemporary elegant outfit, understated and masculine'}
    ],
    motion:{referenceId:'opening-prototype+latest-lucas-video',tags:['natural-motion','micro-expression','cinematic-landscape','opening-suspense'],copyIdentity:false},
    generation:{
      provider:'kaggle',router:'ltx',width:768,height:432,frames:49,steps:8,fps:12,seconds:4.0,seed:240911,shotCount:4,
      shotCharacters:['marion','lucas','marion',null],
      shotReferenceIndex:[0,0,0,null],
      shotImages:[null,null,null,APARTMENT],
      shotPrompts:[
        'SHOT 1 — NEW GAME OPENING. Marion alone in Nîmes in warm early-morning light. Preserve Marion identity from the canonical atlas pack. She is 20, natural and believable, walking or pausing for a second as if a new chapter is beginning. Gentle breeze in hair, tiny glance upward, subtle hopeful expression, cinematic shallow depth of field, restrained camera movement. No dialogue, no text, no story reveal.',
        'SHOT 2 — LUCAS SUSPENSE. Lucas alone somewhere else. Use the NEW PRIORITY LUCAS PHOTO PACK as face and appearance authority, with the latest Lucas video only for presence and micro-expression. Preserve his exact recognizable face, dark hair, strong gaze, jaw, stubble and visible tattoo details supported by the references. Ignore any text or graphic overlays from reference images. Calm, intense, private presence, subtle shift of gaze, restrained almost-smile, realistic breathing. Do not show Marion, no dialogue, no text, no future-story reveal.',
        'SHOT 3 — FIRST CONNECTION WITHOUT SPOILER. Marion in a natural intimate morning moment. Her attention is caught by a subtle phone vibration or light just outside the main focus; she gives a tiny curious reaction. Preserve Marion identity from the same canonical atlas pack used in shot 1. Keep the phone/interface visually minimal and unreadable. No visible message content, no dialogue, no reveal, no exaggerated reaction. Premium cinematic realism.',
        'SHOT 4 — ARRIVAL INTO GAMEPLAY. Use the supplied apartment image as the visual authority. Create a gentle cinematic settling shot of Marion’s Nîmes apartment in morning light: subtle curtain or plant movement, soft light drift, tiny camera push, realistic lived-in atmosphere. No person required, no text, no UI. End on a stable composition suitable to dissolve seamlessly into the playable apartment.'
      ]
    },
    output:{candidatePath:`public/resources/monia/candidates/${id}/`}
  };
}

async function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}

async function run(){
  start.disabled=true;videos.innerHTML='';
  const job=testJob();
  state.textContent='Déclenchement de l’ouverture de nouvelle partie…';
  log.textContent=`Job ${job.id}`;
  try{
    const r=await fetch('./api/monia-kaggle-dispatch.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({job})});
    const body=await r.json().catch(()=>null) as any;
    if(!r.ok)throw new Error(body?.error||`HTTP ${r.status}`);
    state.textContent='MonIA/Kaggle lancé. Génération des 4 plans…';
    log.textContent+=`\nDispatch accepté. Marion canon → Lucas nouveau pack → suspense → appartement.`;
    const resultUrl=`${RAW}/${encodeURIComponent(job.id)}/result.json`;
    for(let i=0;i<360;i++){
      if(i>0)await sleep(5000);
      const rr=await fetch(`${resultUrl}?t=${Date.now()}`,{cache:'no-store'}).catch(()=>null);
      if(!rr||!rr.ok){state.textContent=`Ouverture en génération… ${i*5}s`;continue}
      const result=await rr.json() as any;
      if(result?.state!=='candidate'||result?.candidateOnly!==true||result?.narrativeAuthority!==false||result?.selectionMode!=='surprise-auto'||!Array.isArray(result?.clips)||result.clips.length<4)continue;
      const base=`${RAW}/${encodeURIComponent(job.id)}`;
      for(const name of result.clips.slice(0,4)){
        const v=document.createElement('video');v.src=`${base}/${encodeURIComponent(name)}?t=${Date.now()}`;v.controls=true;v.playsInline=true;v.style.width='100%';v.style.maxWidth='960px';v.style.aspectRatio='16 / 9';v.style.objectFit='contain';videos.appendChild(v);
      }
      state.textContent='✅ Ouverture complète prête : Marion canon → Lucas nouveau canon → suspense → appartement.';
      log.textContent+=`\n4 plans reçus. Les nouvelles photos Lucas ont été fournies au worker comme références prioritaires.`;
      return;
    }
    throw new Error('Délai dépassé : MonIA n’a pas produit les 4 plans dans le temps prévu.');
  }catch(error){
    state.textContent='❌ Intro non terminée.';
    log.textContent+=`\n${error instanceof Error?error.message:String(error)}`;
  }finally{start.disabled=false}
}

start.addEventListener('click',()=>void run());
