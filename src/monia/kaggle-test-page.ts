const start=document.getElementById('start') as HTMLButtonElement;
const state=document.getElementById('state') as HTMLElement;
const log=document.getElementById('log') as HTMLElement;
const videos=document.getElementById('videos') as HTMLElement;

const MARION='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/photo.png';
const RAW='https://raw.githubusercontent.com/vartcom38-collab/marion-lucas-game/main/public/resources/monia/candidates';

function testJob(){
  const id=`manual-kaggle-test-${Date.now().toString(36)}`;
  return{
    id,state:'queued',createdAt:new Date().toISOString(),source:'manual-safe-test',candidateOnly:true,narrativeAuthority:false,
    sceneFamily:'isolated-test',signature:'manual-isolated-video-test',primaryCharacter:'marion',
    prompt:'Photorealistic cinematic test scene, isolated from the game story. Marion is in a neutral interior, calm and natural. Preserve her identity from the reference image. Only subtle breathing, blinking, tiny gaze changes and a restrained natural smile. No story event, no reveal, no text, no subtitles, no watermark, no UI.',
    negativePrompt:'identity drift, face morphing, wrong person, distorted face, duplicate person, extra limbs, text, subtitles, watermark, UI, slideshow, photo zoom',
    characters:[{id:'marion',canonRef:MARION,wardrobe:'neutral contemporary outfit'}],
    motion:{referenceId:'manual-test',tags:['natural-motion','micro-expression'],copyIdentity:false},
    generation:{provider:'kaggle',router:'ltx',width:320,height:512,frames:17,steps:8,fps:12,seconds:1.4,seed:240907},
    output:{candidatePath:`public/resources/monia/candidates/${id}/`}
  };
}

async function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}

async function run(){
  start.disabled=true;videos.innerHTML='';
  const job=testJob();
  state.textContent='Déclenchement du test…';
  log.textContent=`Job ${job.id}`;
  try{
    const r=await fetch('./api/monia-kaggle-dispatch.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({job})});
    const body=await r.json().catch(()=>null) as any;
    if(!r.ok)throw new Error(body?.error||`HTTP ${r.status}`);
    state.textContent='Kaggle lancé. Génération en cours…';
    log.textContent+=`\nDispatch accepté. J'attends les 2 vidéos…`;
    const resultUrl=`${RAW}/${encodeURIComponent(job.id)}/result.json`;
    for(let i=0;i<180;i++){
      if(i>0)await sleep(5000);
      const rr=await fetch(`${resultUrl}?t=${Date.now()}`,{cache:'no-store'}).catch(()=>null);
      if(!rr||!rr.ok){state.textContent=`Génération en cours… ${i*5}s`;continue}
      const result=await rr.json() as any;
      if(result?.state!=='candidate'||result?.candidateOnly!==true||result?.narrativeAuthority!==false||result?.selectionMode!=='surprise-auto'||!Array.isArray(result?.clips)||result.clips.length<2)continue;
      const base=`${RAW}/${encodeURIComponent(job.id)}`;
      for(const name of result.clips.slice(0,2)){
        const v=document.createElement('video');v.src=`${base}/${encodeURIComponent(name)}?t=${Date.now()}`;v.controls=true;v.playsInline=true;videos.appendChild(v);
      }
      state.textContent='✅ Les 2 vidéos test sont prêtes.';
      log.textContent+=`\nRésultat reçu. Aucun événement du jeu n'a été modifié.`;
      return;
    }
    throw new Error('Délai dépassé : la génération n’a pas produit les 2 vidéos dans le temps prévu.');
  }catch(error){
    state.textContent='❌ Test non terminé.';
    log.textContent+=`\n${error instanceof Error?error.message:String(error)}`;
  }finally{start.disabled=false}
}

start.addEventListener('click',()=>void run());
