import { generateFreeCanonVideo } from './free-video';
import { selectLucasMotionDirections } from './motion-language';
import { moniaCreativeVault } from './creative-vault';

const input=document.getElementById('moniaVisioLucasRef') as HTMLInputElement|null;
const button=document.getElementById('moniaGenerateVisio') as HTMLButtonElement|null;
const status=document.getElementById('moniaVisioStatus');
const output=document.getElementById('moniaVisioOutput');
const params=new URLSearchParams(location.search);
const AUTO_VISIO=params.get('autoVisio')==='1';

function setStatus(text:string){if(status)status.textContent=text}

async function videoFrame(file:File):Promise<File>{
  if(file.type.startsWith('image/'))return file;
  const url=URL.createObjectURL(file);
  try{
    const video=document.createElement('video');
    video.preload='metadata';
    video.muted=true;
    video.playsInline=true;
    video.src=url;
    await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(new Error('Impossible de lire la référence Lucas'));});
    video.currentTime=Math.min(Math.max(video.duration*.35,.15),Math.max(.15,video.duration-.15));
    await new Promise<void>((resolve,reject)=>{video.onseeked=()=>resolve();video.onerror=()=>reject(new Error('Impossible d’extraire une image de la référence'));});
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(512,video.videoWidth||720);
    canvas.height=Math.max(512,video.videoHeight||1280);
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas indisponible');
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Extraction image impossible')),'image/png',1));
    return new File([blob],`lucas-visio-reference-${Date.now()}.png`,{type:'image/png'});
  } finally {URL.revokeObjectURL(url)}
}

function addResultLink(url:string){
  if(!output)return;
  const a=document.createElement('a');
  a.href=url;
  a.target='_blank';
  a.rel='noopener noreferrer';
  a.textContent='🔗 Ouvrir la vidéo générée';
  a.style.color='#fff';
  a.style.fontWeight='700';
  a.style.textDecoration='underline';
  output.appendChild(a);
}

async function run(){
  if(!button||!output)return;
  button.disabled=true;
  output.innerHTML='';
  setStatus('Préparation du candidat visio Lucas…');
  try{
    const selected=input?.files?.[0];
    const referenceFile=selected?await videoFrame(selected):undefined;
    const motion=selectLucasMotionDirections({intent:'visio Lucas calme écoute réaction tendre naturelle regard caméra respiration micro expression',tags:['visio','listening','reaction','tender','closeup'],limit:3});
    const prompt=[
      'Photorealistic live smartphone video-call candidate of the exact canonical Lucas identity, alone in frame.',
      'Preserve the exact canonical Lucas face and facial proportions: eyes, eyebrows, nose, mouth, jaw, hair, stubble, skin tone and age continuity. Lucas has no tattoos and no facial scar.',
      'Natural intimate visio performance: he first looks at the screen, breathes naturally, blinks with irregular human timing, makes a tiny eye movement toward the camera, then gives a very slight restrained half-smile and settles again.',
      'Front-camera framing, warm believable indoor environment, tiny natural phone-camera imperfections, subtle depth of field, no dramatic camera move, no subtitles, no text, no watermark, silent visual performance.',
      'Motion references are movement/timing inspiration only; never copy another person, co-actor, wardrobe, tattoos, scars or body identity.',
      ...motion,
    ].join(' ');
    const result=await generateFreeCanonVideo({
      cellId:'lucas-1',
      referenceFile,
      prompt,
      onState:(state,detail)=>setStatus(detail||state),
    });
    if(result.state!=='ready'||!result.videoUrl)throw new Error(result.error||'Aucun GPU gratuit disponible');
    const asset=await moniaCreativeVault.registerAsset({
      id:`visio-lucas-candidate-${Date.now()}`,
      kind:'visio',actor:'Lucas',role:'visio-listening-reaction',url:result.videoUrl,status:'candidate',source:'generated',
      tags:['lucas','visio','candidate','listening','reaction','tender','closeup','motion-language'],
      metadata:{generator:'monia-free-video',humanApprovalRequired:true,reference:selected?'user-lucas-reference':'canon-atlas',motionLanguage:true,autoVisio:AUTO_VISIO},
    });
    await moniaCreativeVault.recordGeneration({kind:'video',actor:'Lucas',promptKey:'direct-visio-lucas-v2',resultUrl:result.videoUrl,status:'generated'});
    window.dispatchEvent(new CustomEvent('monia:vault-changed',{detail:{asset}}));
    const video=document.createElement('video');
    video.src=result.videoUrl;video.controls=true;video.playsInline=true;video.autoplay=true;video.muted=true;video.loop=true;
    output.appendChild(video);
    addResultLink(result.videoUrl);
    const note=document.createElement('p');
    note.className='status';
    note.textContent='Candidat MonIA créé. Il reste hors du jeu jusqu’à validation dans le coffre.';
    output.appendChild(note);
    setStatus('Candidat visio Lucas prêt à regarder et à valider');
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    setStatus(`Génération indisponible : ${message}`);
  }finally{button.disabled=false}
}

button?.addEventListener('click',()=>void run());

if(AUTO_VISIO){
  window.addEventListener('load',()=>{
    window.setTimeout(()=>void run(),450);
  },{once:true});
}
