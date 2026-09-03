import { Client, handle_file } from '@gradio/client';
import { CANON_DRAMA_ATLAS_CELLS, type DramaAtlasCell } from './drama-atlas';

export type FreeVideoState = 'idle'|'preparing-reference'|'uploading-reference'|'queued'|'generating'|'ready'|'error';
export type FreeVideoResult = { state:FreeVideoState; videoUrl?:string; error?:string; provider:string; detail?:string; attempts?:string[] };

type Provider={id:string;label:string;space:string;spaceId?:string;api?:string;discover?:boolean;payload:(prompt:string,image:any)=>unknown[]};

const PROVIDERS:Provider[]=[
  {
    id:'hf-openking-wan22',
    label:'Wan 2.2 ZeroGPU A',
    space:'https://openking-wan2-video-generation.hf.space',
    spaceId:'OpenKing/wan2-video-generation',
    discover:true,
    payload:(prompt,image)=>[prompt,image,576,1024,49,25,5,-1],
  },
  {
    id:'hf-rioshiina-ltx25',
    label:'LTX 2.5 ZeroGPU B',
    space:'https://rioshiina-ltx-2-5.hf.space',
    api:'run',
    payload:(prompt,image)=>[JSON.stringify({
      task_type:'i2v',
      prompt,
      start_image:image?.path || image,
      negative_prompt:'cartoon, illustration, static image, low quality, distorted face, deformed face, watermark, text, subtitles, title, label, number, jitter, identity drift',
      resolution:'544p',
      aspect_ratio:'9:16 (Portrait)',
      width:544,
      height:960,
      duration:3,
      fps:'24fps',
      seed:-1,
      zero_gpu_duration:60,
      use_spatial_upscaler:false,
      use_temporal_upscaler:false,
      async_execution:false,
    })],
  },
  {
    id:'hf-kpkp21-wan22',
    label:'Wan 2.2 ZeroGPU C',
    space:'https://kpkp21-wan2-video-generation.hf.space',
    spaceId:'Kpkp21/wan2-video-generation',
    discover:true,
    payload:(prompt,image)=>[prompt,image,576,1024,49,25,5,-1],
  },
];

const PROVIDER_TIMEOUT_MS=180_000;

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

function deepVideoCandidate(value:any):string{
  if(!value)return '';
  if(typeof value==='string'){
    if(/\.mp4(?:$|\?)/i.test(value) || /^https?:\/\//.test(value))return value;
    return '';
  }
  if(Array.isArray(value)){
    for(const item of value){const found=deepVideoCandidate(item);if(found)return found;}
    return '';
  }
  const direct=value?.video?.url || value?.url || value?.path || value?.video?.path;
  if(typeof direct==='string' && direct)return direct;
  for(const key of ['videos','files','result','results','output','outputs','data']){
    const found=deepVideoCandidate(value?.[key]);
    if(found)return found;
  }
  return '';
}

function fileUrl(provider:Provider,value:any){
  const candidate=deepVideoCandidate(value);
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
  const baseX=cell.crop.x*img.naturalWidth;
  const baseY=cell.crop.y*img.naturalHeight;
  const baseW=cell.crop.width*img.naturalWidth;
  const baseH=cell.crop.height*img.naturalHeight;
  const trimTop=baseH*0.18;
  const trimSide=baseW*0.025;
  const sx=Math.round(baseX+trimSide);
  const sy=Math.round(baseY+trimTop);
  const sw=Math.max(1,Math.round(baseW-trimSide*2));
  const sh=Math.max(1,Math.round(baseH-trimTop-baseH*0.015));
  const canvas=document.createElement('canvas');
  canvas.width=768; canvas.height=1024;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas indisponible');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Impossible de préparer la référence')),'image/png',1));
  return new File([blob],`${cell.id}-clean.png`,{type:'image/png'});
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

function findVideoEndpoint(info:any){
  const unnamed=info?.unnamed_endpoints||{};
  const named=info?.named_endpoints||{};
  for(const [key,value] of Object.entries<any>(unnamed)){
    const params=value?.parameters||[];
    const returns=value?.returns||[];
    const hasVideo=returns.some((r:any)=>String(r?.component||r?.type||'').toLowerCase().includes('video'));
    const labels=params.map((p:any)=>String(p?.label||p?.parameter_name||'').toLowerCase()).join('|');
    if(params.length>=7 && params.length<=9 && hasVideo && labels.includes('prompt'))return Number(key);
  }
  for(const [key,value] of Object.entries<any>(named)){
    const params=value?.parameters||[];
    const returns=value?.returns||[];
    const hasVideo=returns.some((r:any)=>String(r?.component||r?.type||'').toLowerCase().includes('video'));
    if(hasVideo && params.length>=1)return key;
  }
  throw new Error(`endpoint vidéo Gradio introuvable (unnamed=${Object.keys(unnamed).join(',')||'aucun'})`);
}

async function runDiscoveredProvider(provider:Provider,file:File,prompt:string,onState?:(state:FreeVideoState,detail?:string)=>void){
  if(!provider.spaceId)throw new Error('Space ID manquant');
  onState?.('queued',`${provider.label} · lecture API réelle`);
  const app=await Client.connect(provider.spaceId,{events:['status','data']});
  const info:any=await app.view_api();
  const endpoint=findVideoEndpoint(info);
  onState?.('uploading-reference',`${provider.label} · référence canon via client Gradio`);
  const payload=provider.payload(prompt,handle_file(file));
  onState?.('generating',`${provider.label} · génération GPU · endpoint ${String(endpoint)}`);
  const prediction=app.predict(endpoint as any,payload as any);
  const timeout=new Promise<never>((_,reject)=>window.setTimeout(()=>reject(new Error('timeout GPU gratuit')),PROVIDER_TIMEOUT_MS));
  const result:any=await Promise.race([prediction,timeout]);
  const url=fileUrl(provider,result?.data??result);
  if(!url)throw new Error(`job terminé sans URL vidéo · endpoint ${String(endpoint)}`);
  return url;
}

async function submit(provider:Provider,prompt:string,image:any){
  if(!provider.api)throw new Error('endpoint API manquant');
  const r=await fetch(`${provider.space}/gradio_api/call/${provider.api}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:provider.payload(prompt,image)}),
  });
  if(!r.ok)throw new Error(`file GPU refusée · HTTP ${r.status}`);
  const data=await r.json();
  if(!data?.event_id)throw new Error('service joignable mais job GPU non créé');
  return String(data.event_id);
}

async function waitForResult(provider:Provider,eventId:string,onState?:(state:FreeVideoState,detail?:string)=>void){
  if(!provider.api)throw new Error('endpoint API manquant');
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
        const url=fileUrl(provider,data);
        if(!url)throw new Error('job terminé mais aucune URL vidéo trouvée');
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
  if(provider.discover)return runDiscoveredProvider(provider,file,prompt,onState);
  onState?.('uploading-reference',`${provider.label} · envoi référence canon`);
  const uploaded=await uploadReference(provider,file);
  onState?.('queued',`${provider.label} · attente GPU gratuit`);
  const eventId=await submit(provider,prompt,uploaded);
  return waitForResult(provider,eventId,onState);
}

export async function generateFreeCanonVideo(input:{cellId?:string;referenceFile?:File;prompt:string;onState?:(state:FreeVideoState,detail?:string)=>void}):Promise<FreeVideoResult>{
  const cell=CANON_DRAMA_ATLAS_CELLS.find(c=>c.id===(input.cellId||'lucas-1')) || CANON_DRAMA_ATLAS_CELLS[0];
  const attempts:string[]=[];
  try{
    input.onState?.('preparing-reference',input.referenceFile?'Préparation source propre générée par MonIA':`Préparation référence canon ${cell.label}`);
    const file=input.referenceFile || await cropCell(cell);
    for(let index=0;index<PROVIDERS.length;index++){
      const provider=PROVIDERS[index];
      try{
        input.onState?.('queued',`${provider.label} · tentative ${index+1}/${PROVIDERS.length}`);
        const videoUrl=await runProvider(provider,file,input.prompt,input.onState);
        input.onState?.('ready',`${provider.label} · vraie vidéo prête`);
        return {state:'ready',videoUrl,provider:provider.id,attempts};
      }catch(error){
        const message=cleanProviderError(error);
        attempts.push(`${provider.label}: ${message}`);
        if(index<PROVIDERS.length-1)input.onState?.('queued',`${provider.label} indisponible (${message}) · provider suivant`);
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
