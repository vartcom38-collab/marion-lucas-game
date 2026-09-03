import { CANON_DRAMA_ATLAS_CELLS, type DramaAtlasCell } from './drama-atlas';

export type FreeVideoState = 'idle'|'preparing-reference'|'uploading-reference'|'queued'|'generating'|'ready'|'error';
export type FreeVideoResult = { state:FreeVideoState; videoUrl?:string; error?:string; provider:'hf-zerogpu-wan22'; detail?:string };

const SPACE='https://openking-wan2-video-generation.hf.space';
const API='generate_video';

function fileUrl(value:any){
  const candidate=value?.video?.url || value?.url || value?.path || value?.video?.path || (typeof value==='string'?value:'');
  if(!candidate)return '';
  if(/^https?:\/\//.test(candidate))return candidate;
  return `${SPACE}/gradio_api/file=${encodeURIComponent(candidate)}`;
}

async function loadImage(src:string){
  const img=new Image();
  img.decoding='async';
  img.crossOrigin='anonymous';
  img.src=src;
  await img.decode();
  return img;
}

async function cropCell(cell:DramaAtlasCell){
  const img=await loadImage(cell.src);
  const sx=Math.round(cell.crop.x*img.naturalWidth);
  const sy=Math.round(cell.crop.y*img.naturalHeight);
  const sw=Math.max(1,Math.round(cell.crop.width*img.naturalWidth));
  const sh=Math.max(1,Math.round(cell.crop.height*img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=768; canvas.height=1024;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas indisponible');
  ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Impossible de préparer la référence')),'image/png',0.96));
  return new File([blob],`${cell.id}.png`,{type:'image/png'});
}

async function uploadReference(file:File){
  const form=new FormData();
  form.append('files',file,file.name);
  const r=await fetch(`${SPACE}/gradio_api/upload`,{method:'POST',body:form});
  if(!r.ok)throw new Error(`Upload ZeroGPU HTTP ${r.status}`);
  const data=await r.json();
  const path=Array.isArray(data)?data[0]:data?.files?.[0] || data?.path;
  if(!path)throw new Error('Le service ZeroGPU n’a pas renvoyé la référence uploadée.');
  return {path,orig_name:file.name,size:file.size,mime_type:file.type,meta:{_type:'gradio.FileData'}};
}

async function submit(prompt:string,image:any){
  const payload={data:[prompt,image,704,1024,49,25,5,-1]};
  const r=await fetch(`${SPACE}/gradio_api/call/${API}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error(`Queue ZeroGPU HTTP ${r.status}`);
  const data=await r.json();
  if(!data?.event_id)throw new Error('Le service ZeroGPU n’a pas créé de job.');
  return String(data.event_id);
}

async function waitForResult(eventId:string,onState?:(state:FreeVideoState,detail?:string)=>void){
  const r=await fetch(`${SPACE}/gradio_api/call/${API}/${encodeURIComponent(eventId)}`,{headers:{accept:'text/event-stream'}});
  if(!r.ok)throw new Error(`Résultat ZeroGPU HTTP ${r.status}`);
  const text=await r.text();
  const blocks=text.split(/\n\n+/);
  for(const block of blocks){
    const event=block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const raw=block.match(/^data:\s*(.+)$/m)?.[1];
    if(event==='generating')onState?.('generating','GPU en cours de génération');
    if(event==='error')throw new Error(raw || 'Erreur ZeroGPU');
    if(event==='complete' && raw){
      const data=JSON.parse(raw);
      const url=fileUrl(Array.isArray(data)?data[0]:data);
      if(!url)throw new Error('Vidéo générée mais URL introuvable.');
      return url;
    }
  }
  throw new Error('Réponse ZeroGPU incomplète ou file expirée.');
}

export async function generateFreeCanonVideo(input:{cellId?:string;prompt:string;onState?:(state:FreeVideoState,detail?:string)=>void}):Promise<FreeVideoResult>{
  const cell=CANON_DRAMA_ATLAS_CELLS.find(c=>c.id===(input.cellId||'lucas-1')) || CANON_DRAMA_ATLAS_CELLS[0];
  try{
    input.onState?.('preparing-reference',`Préparation ${cell.label}`);
    const file=await cropCell(cell);
    input.onState?.('uploading-reference','Envoi de la référence canon au GPU gratuit');
    const uploaded=await uploadReference(file);
    input.onState?.('queued','En attente d’un GPU gratuit');
    const eventId=await submit(input.prompt,uploaded);
    const videoUrl=await waitForResult(eventId,input.onState);
    input.onState?.('ready','Vidéo prête');
    return {state:'ready',videoUrl,provider:'hf-zerogpu-wan22'};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    input.onState?.('error',message);
    return {state:'error',error:message,provider:'hf-zerogpu-wan22'};
  }
}
