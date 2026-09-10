import { generateFreeCanonVideo } from './free-video';
import { selectLucasMotionDirections } from './motion-language';
import { moniaCreativeVault } from './creative-vault';

const input=document.getElementById('moniaVisioLucasRef') as HTMLInputElement|null;
const button=document.getElementById('moniaGenerateVisio') as HTMLButtonElement|null;
const status=document.getElementById('moniaVisioStatus');
const output=document.getElementById('moniaVisioOutput');

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
      'Photorealistic webcam-style video call candidate of Lucas, alone in frame, seated naturally in front of a computer.',
      'Preserve the exact canonical Lucas identity and facial proportions. Natural skin, hair, eyes, jaw, stubble and age continuity. No tattoos, no facial scar.',
      'He first looks at the screen, breathes naturally, blinks with irregular human timing, makes a tiny eye movement toward the camera, then gives a very slight restrained half-smile and settles again.',
      'Static webcam framing, soft neutral indoor background, subtle depth of field, no zoom, no dramatic camera move, no subtitles, no text, no watermark, silent visual performance.',
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
      metadata:{generator:'monia-free-video',humanApprovalRequired:true,reference:selected?'user-lucas-reference':'canon-atlas',motionLanguage:true},
    });
    await moniaCreativeVault.recordGeneration({kind:'video',actor:'Lucas',promptKey:'direct-visio-lucas-v1',resultUrl:result.videoUrl,status:'generated'});
    window.dispatchEvent(new CustomEvent('monia:vault-changed',{detail:{asset}}));
    const video=document.createElement('video');
    video.src=result.videoUrl;video.controls=true;video.playsInline=true;video.autoplay=true;video.muted=true;video.loop=true;
    output.appendChild(video);
    const note=document.createElement('p');
    note.className='status';
    note.textContent='Candidat MonIA créé. Il reste hors du jeu jusqu’à validation dans le coffre.';
    output.appendChild(note);
    setStatus('Candidat visio Lucas prêt à valider');
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    setStatus(`Génération indisponible : ${message}`);
  }finally{button.disabled=false}
}

button?.addEventListener('click',()=>void run());
