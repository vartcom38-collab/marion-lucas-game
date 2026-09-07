const start=document.getElementById('start') as HTMLButtonElement;
const state=document.getElementById('state') as HTMLElement;
const log=document.getElementById('log') as HTMLElement;
const videos=document.getElementById('videos') as HTMLElement;

const MARION='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/photo.png';
const LUCAS='https://marion-lucas.marionbolomey.fr/resources/monia/canon/lucas/reference.jpg';
const RAW='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/monia/candidates';

function testJob(){
  const id=`manual-opening-test-${Date.now().toString(36)}`;
  return{
    id,state:'queued',createdAt:new Date().toISOString(),source:'manual-opening-test',candidateOnly:true,narrativeAuthority:false,
    sceneFamily:'opening-intro',signature:'new-game-opening-prototype',primaryCharacter:'marion',
    prompt:'Premium photorealistic cinematic opening for the game Marion & Lucas. Romantic life-simulation mood, elegant morning light, subtle suspense, realistic body language and micro-expressions. This is an opening atmosphere only: no future-story reveal, no subtitles, no watermark, no UI, no slideshow.',
    negativePrompt:'identity drift, face morphing, wrong person, distorted face, duplicate person, extra limbs, text, subtitles, watermark, UI, slideshow, photo zoom, portrait framing, vertical video, exaggerated acting, kiss, wedding, children, spoiler',
    characters:[
      {id:'marion',canonRef:MARION,wardrobe:'natural contemporary morning outfit, understated and elegant'},
      {id:'lucas',canonRef:LUCAS,wardrobe:'dark contemporary casual outfit, understated and elegant'}
    ],
    motion:{referenceId:'opening-prototype',tags:['natural-motion','micro-expression','cinematic-landscape','opening-suspense'],copyIdentity:false},
    generation:{
      provider:'kaggle',router:'ltx',width:768,height:432,frames:49,steps:8,fps:12,seconds:4.0,seed:240911,
      shotCharacters:['marion','lucas'],
      shotPrompts:[
        'Opening shot of Marion in Nîmes in warm early-morning light. She is alone, 20 years old, natural and believable, walking or pausing for a second as if a new chapter is beginning. Gentle breeze in hair, tiny glance upward, subtle hopeful expression, cinematic shallow depth of field, restrained camera movement. No dialogue, no text, no reveal, no romance event yet.',
        'Opening suspense shot of Lucas somewhere else, alone. Preserve Lucas identity exactly. He is calm, intense and private, with a subtle shift of gaze and a restrained almost-smile as if something is about to begin. Warm cinematic light, elegant composition, realistic breathing and micro-expression, slight camera life. Do not show Marion in this shot, no dialogue, no text, no future-story reveal.'
      ]
    },
    output:{candidatePath:`public/resources/monia/candidates/${id}/`}
  };
}

async function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}

async function run(){
  start.disabled=true;videos.innerHTML='';
  const job=testJob();
  state.textContent='Déclenchement de l’intro…';
  log.textContent=`Job ${job.id}`;
  try{
    const r=await fetch('./api/monia-kaggle-dispatch.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({job})});
    const body=await r.json().catch(()=>null) as any;
    if(!r.ok)throw new Error(body?.error||`HTTP ${r.status}`);
    state.textContent='MonIA/Kaggle lancé. Génération de l’ouverture…';
    log.textContent+=`\nDispatch accepté. J'attends Marion puis Lucas, en 16:9…`;
    const resultUrl=`${RAW}/${encodeURIComponent(job.id)}/result.json`;
    for(let i=0;i<180;i++){
      if(i>0)await sleep(5000);
      const rr=await fetch(`${resultUrl}?t=${Date.now()}`,{cache:'no-store'}).catch(()=>null);
      if(!rr||!rr.ok){state.textContent=`Ouverture en génération… ${i*5}s`;continue}
      const result=await rr.json() as any;
      if(result?.state!=='candidate'||result?.candidateOnly!==true||result?.narrativeAuthority!==false||result?.selectionMode!=='surprise-auto'||!Array.isArray(result?.clips)||result.clips.length<2)continue;
      const base=`${RAW}/${encodeURIComponent(job.id)}`;
      for(const name of result.clips.slice(0,2)){
        const v=document.createElement('video');v.src=`${base}/${encodeURIComponent(name)}?t=${Date.now()}`;v.controls=true;v.playsInline=true;v.style.width='100%';v.style.maxWidth='960px';v.style.aspectRatio='16 / 9';v.style.objectFit='contain';videos.appendChild(v);
      }
      state.textContent='✅ Prototype d’ouverture prêt : Marion → Lucas.';
      log.textContent+=`\nEnsuite, dans le jeu final, ces plans enchaîneront vers l'appartement jouable.`;
      return;
    }
    throw new Error('Délai dépassé : MonIA n’a pas produit les 2 plans dans le temps prévu.');
  }catch(error){
    state.textContent='❌ Intro non terminée.';
    log.textContent+=`\n${error instanceof Error?error.message:String(error)}`;
  }finally{start.disabled=false}
}

start.addEventListener('click',()=>void run());
