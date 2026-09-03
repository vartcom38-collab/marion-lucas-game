import { CANON_DRAMA_ATLAS_CELLS, type DramaAtlasCell } from './drama-atlas';

export type FreeVideoState = 'idle'|'preparing-reference'|'uploading-reference'|'queued'|'generating'|'ready'|'error';
export type FreeVideoResult = { state:FreeVideoState; videoUrl?:string; error?:string; provider:string; detail?:string; attempts?:string[] };

type Provider={id:string;label:string;space:string;api:string;payload:(prompt:string,image:any)=>unknown[]};

const PROVIDERS:Provider[]=[
  {
    id:'hf-openking-wan22',
    label:'Wan 2.2 ZeroGPU A',
    space:'https://openking-wan2-video-generation.hf.space',
    api:'generate_video',
    payload:(prompt,image)=>[prompt,image,704,1024,49,25,5,-1],
  },
  {
    id:'hf-kpkp21-wan22',
    label:'Wan 2.2 ZeroGPU B',
    space:'https://kpkp21-wan2-video-generation.hf.space',
    api:'generate_video',
    payload:(prompt,image)=>[prompt,image,704,1024,49,25,5,-1],
  },
];

const PROVIDER_TIMEOUT_MS=150_000;

function cleanProviderError(value:unknown,fallback='erreur ZeroGPU sans détail'){
  const raw=value instanceof Error?value.message:String(value??'');
  const clean=raw.trim();
  if(!clean || clean==='null' || clean==='undefined' || clean==='{}' || clean==='[]')return fallback;
  try{
    const parsed=JSON.parse(clean);
    if(parsed==null)return fallback;
    if(typeof parsed==='string' && parsed.trim())return parsed.trim();
    const nested=parsed?.message || parsed?.error || parsed?.detail;
    if(typeof nested==='string' && nested.trim())return nested.trim();
  }catch{}
  return clean;
}

function fileUrl(provider:Provider,value:any){
  const candidate=value?.video?.url || value?.url || value?.path || value?.video?.path || (typeof value==='string'?value:'');
  if(!candidate)return '';
  if(/^https?:\/\//.test(candidate))return candidate;
  return `${provider.space}/gradio_api/file=${encodeURIComponent(candidate)}`;
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

async function uploadReference(provider:Provider,file:File){
  const form=new FormData();
  form.append('files',file,file.name);
  const r=await fetch(`${provider.space}/gradio_api/upload`,{method:'POST',body:form});
  if(!r.ok)throw new Error(`upload refusé · HTTP ${r.status}`);
  const data=await r.json();
  const path=Array.isArray(data)?data[0]:data?.files?.[0] || data?.path;
  if(!path)throw new Error('upload accepté mais référence introuvable');
  return {path,orig_name:file.name,size:file.size,mime_type:file.type,meta:{_type:'gradio.FileData'}};
}

async function submit(provider:Provider,prompt:string,image:any){
  const r=await fetch(`${provider.space}/gradio_api/call/${provider.api}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:provider.payload(prompt,image)}),
  });
  if(!r.ok)throw new Error(`file GPU refusée · HTTP ${r.status}`);
  const data=await r.json();
  if(!data?.event_id)throw new Error('service joignable mais job GPU non créé');
  return String(data.event_id);
}

async function waitForResult(provider:Provider,eventId:string,onState?:(state:FreeVideoState,detail?:string)=>void){
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);
  try{
    const r=await fetch(`${provider.space}/gradio_api/call/${provider.api}/${encodeURIComponent(eventId)}`,{headers:{accept:'text/event-stream'},signal:controller.signal});
    if(!r.ok)throw new Error(`lecture résultat refusée · HTTP ${r.status}`);
    const text=await r.text();
    const blocks=text.split(/\n\n+/);
    for(const block of blocks){
      const event=block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
      const raw=block.match(/^data:\s*(.*)$/m)?.[1];
      if(event==='generating')onState?.('generating',`${provider.label} · GPU en génération`);
      if(event==='error')throw new Error(cleanProviderError(raw,'le GPU a rejeté la génération sans fournir de détail'));
      if(event==='complete' && raw){
        let data:any;
        try{data=JSON.parse(raw)}catch{throw new Error('vidéo annoncée prête mais réponse illisible')}
        const url=fileUrl(provider,Array.isArray(data)?data[0]:data);
        if(!url)throw new Error('vidéo générée mais URL introuvable');
        return url;
      }
    }
    throw new Error('réponse incomplète ou file GPU expirée');
  }catch(error){
    if(error instanceof DOMException && error.name==='AbortError')throw new Error('timeout GPU gratuit');
    throw new Error(cleanProviderError(error));
  }finally{
    window.clearTimeout(timer);
  }
}

async function runProvider(provider:Provider,file:File,prompt:string,onState?:(state:FreeVideoState,detail?:string)=>void){
  onState?.('uploading-reference',`${provider.label} · envoi référence canon`);
  const uploaded=await uploadReference(provider,file);
  onState?.('queued',`${provider.label} · attente GPU gratuit (max 2 min 30)`);
  const eventId=await submit(provider,prompt,uploaded);
  return waitForResult(provider,eventId,onState);
}

export async function generateFreeCanonVideo(input:{cellId?:string;prompt:string;onState?:(state:FreeVideoState,detail?:string)=>void}):Promise<FreeVideoResult>{
  const cell=CANON_DRAMA_ATLAS_CELLS.find(c=>c.id===(input.cellId||'lucas-1')) || CANON_DRAMA_ATLAS_CELLS[0];
  const attempts:string[]=[];
  try{
    input.onState?.('preparing-reference',`Préparation ${cell.label}`);
    const file=await cropCell(cell);
    for(let index=0;index<PROVIDERS.length;index++){
      const provider=PROVIDERS[index];
      try{
        input.onState?.('queued',`${provider.label} · tentative ${index+1}/${PROVIDERS.length}`);
        const videoUrl=await runProvider(provider,file,input.prompt,input.onState);
        input.onState?.('ready',`${provider.label} · vidéo prête`);
        return {state:'ready',videoUrl,provider:provider.id,attempts};
      }catch(error){
        const message=cleanProviderError(error);
        attempts.push(`${provider.label}: ${message}`);
        if(index<PROVIDERS.length-1){
          input.onState?.('queued',`${provider.label} indisponible (${message}) · essai du provider suivant`);
        }
      }
    }
    const message=`Aucun GPU gratuit n’a répondu. ${attempts.join(' | ')}`;
    input.onState?.('error',message);
    return {state:'error',error:message,provider:'hf-zerogpu-pool',attempts};
  }catch(error){
    const message=cleanProviderError(error);
    input.onState?.('error',message);
    return {state:'error',error:message,provider:'hf-zerogpu-pool',attempts};
  }
}
