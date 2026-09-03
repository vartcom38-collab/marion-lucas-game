import { CANON_DRAMA_ATLAS_CELLS, type DramaAtlasCell } from './drama-atlas';
import type { MonIAMediaPlan } from './media-orchestrator';

export type MonIAImageState='idle'|'preparing-reference'|'uploading-reference'|'queued'|'generating'|'ready'|'error';
export type MonIAImageResult={state:MonIAImageState;imageUrl?:string;provider:string;error?:string;attempts:string[]};

type Provider={id:string;label:string;space:string;api:string;payload:(prompt:string,image:any,width:number,height:number)=>unknown[]};

const PROVIDERS:Provider[]=[
  {
    id:'hf-somebeast-flux-pulid',
    label:'FLUX PuLID ZeroGPU A',
    space:'https://somebeast-flux-pulid.hf.space',
    api:'generate_image',
    payload:(prompt,image,width,height)=>[width,height,20,0,4,-1,prompt,image,1.05,'text, caption, title, watermark, logo, distorted face, deformed hands, duplicate person, identity drift, low quality',1,1,128],
  },
  {
    id:'hf-yanze-pulid-flux',
    label:'FLUX PuLID ZeroGPU B',
    space:'https://yanze-pulid-flux.hf.space',
    api:'generate_image',
    payload:(prompt,image,width,height)=>[width,height,20,0,4,-1,prompt,image,1.05,'text, caption, title, watermark, logo, distorted face, deformed hands, duplicate person, identity drift, low quality',1,1,128],
  },
];

const TIMEOUT_MS=120_000;

function cleanError(value:unknown){
  const raw=value instanceof Error?value.message:String(value??'');
  const text=raw.trim();
  if(!text||text==='null'||text==='undefined')return 'service image gratuit indisponible sans détail';
  try{
    const parsed=JSON.parse(text);
    if(parsed==null)return 'service image gratuit indisponible sans détail';
    const detail=parsed?.message||parsed?.error||parsed?.detail;
    if(typeof detail==='string'&&detail.trim())return detail.trim();
  }catch{}
  return text;
}

function referenceCell(plan:MonIAMediaPlan):DramaAtlasCell{
  const actor=plan.actor.toLowerCase();
  const preferred=actor.includes('marion')?'marion-1':actor.includes('lucas')?'lucas-1':'duo-i-1';
  return CANON_DRAMA_ATLAS_CELLS.find(c=>c.id===preferred)||CANON_DRAMA_ATLAS_CELLS[0];
}

async function loadImage(src:string){
  const img=new Image();
  img.decoding='async';
  img.crossOrigin='anonymous';
  img.src=src;
  await img.decode();
  return img;
}

async function cleanReference(cell:DramaAtlasCell){
  const img=await loadImage(cell.src);
  const padX=cell.crop.width*.07;
  const padTop=cell.crop.height*.13;
  const sx=Math.max(0,Math.round((cell.crop.x+padX)*img.naturalWidth));
  const sy=Math.max(0,Math.round((cell.crop.y+padTop)*img.naturalHeight));
  const sw=Math.max(1,Math.round((cell.crop.width-padX*2)*img.naturalWidth));
  const sh=Math.max(1,Math.round((cell.crop.height-padTop-cell.crop.height*.04)*img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=1024;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas indisponible');
  ctx.fillStyle='#111';ctx.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.max(canvas.width/sw,canvas.height/sh);
  const dw=sw*scale,dh=sh*scale;
  ctx.drawImage(img,sx,sy,sw,sh,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Référence canon impossible à préparer')),'image/png',.98));
  return new File([blob],`${cell.id}-identity.png`,{type:'image/png'});
}

async function upload(provider:Provider,file:File){
  const form=new FormData();form.append('files',file,file.name);
  const r=await fetch(`${provider.space}/gradio_api/upload`,{method:'POST',body:form});
  if(!r.ok)throw new Error(`upload HTTP ${r.status}`);
  const data=await r.json();
  const path=Array.isArray(data)?data[0]:data?.files?.[0]||data?.path;
  if(!path)throw new Error('référence identité non reçue par le provider');
  return {path,orig_name:file.name,size:file.size,mime_type:file.type,meta:{_type:'gradio.FileData'}};
}

function dimensions(plan:MonIAMediaPlan){
  if(plan.visual.framing==='full-body')return {width:768,height:1152};
  if(plan.visual.framing==='two-shot')return {width:896,height:1152};
  return {width:768,height:1024};
}

function generationPrompt(plan:MonIAMediaPlan){
  const framing=plan.visual.framing==='full-body'?'full body, head to toe':plan.visual.framing==='waist'?'waist-up medium shot':plan.visual.framing==='chest'?'natural chest-up smartphone framing':plan.visual.framing==='close'?'cinematic close portrait':plan.visual.framing==='two-shot'?'natural two-person cinematic shot':'natural cinematic medium shot';
  return `Photorealistic cinematic still used as a clean source frame for a live-action video. Exact same identity and facial proportions as the supplied canonical reference. ${plan.actor}. ${framing}. Location: ${plan.visual.location}. Wardrobe: ${plan.visual.wardrobe}. Emotion: ${plan.visual.emotion}. Action setup: ${plan.visual.action}. Lighting: ${plan.visual.lighting}. Natural anatomy, realistic skin texture, realistic hands, complete clothing when visible, believable environment, premium live-action drama quality, no beauty-filter face drift. No text, no title, no number, no subtitles, no watermark, no UI, no frame border.`;
}

function outputUrl(provider:Provider,value:any):string{
  const visit=(v:any):string=>{
    if(!v)return '';
    if(typeof v==='string')return /\.(png|jpg|jpeg|webp)(?:$|\?)/i.test(v)||/^https?:\/\//.test(v)?v:'';
    if(Array.isArray(v)){for(const item of v){const hit=visit(item);if(hit)return hit;}return '';}
    const direct=v?.image?.url||v?.url||v?.path||v?.image?.path;
    if(typeof direct==='string'&&direct)return direct;
    for(const key of ['images','files','result','results','output','outputs','data']){const hit=visit(v?.[key]);if(hit)return hit;}
    return '';
  };
  const candidate=visit(value);
  if(!candidate)return '';
  if(/^https?:\/\//.test(candidate))return candidate;
  return `${provider.space}/gradio_api/file=${encodeURIComponent(candidate)}`;
}

async function call(provider:Provider,prompt:string,file:File,plan:MonIAMediaPlan,onState?:(state:MonIAImageState,detail?:string)=>void){
  onState?.('uploading-reference',`${provider.label} · verrouillage identité`);
  const image=await upload(provider,file);
  const {width,height}=dimensions(plan);
  const submit=await fetch(`${provider.space}/gradio_api/call/${provider.api}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:provider.payload(prompt,image,width,height)})});
  if(!submit.ok)throw new Error(`queue image HTTP ${submit.status}`);
  const accepted=await submit.json();
  if(!accepted?.event_id)throw new Error('job image non créé');
  onState?.('queued',`${provider.label} · attente GPU image`);
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const result=await fetch(`${provider.space}/gradio_api/call/${provider.api}/${encodeURIComponent(String(accepted.event_id))}`,{headers:{accept:'text/event-stream'},signal:controller.signal});
    if(!result.ok)throw new Error(`résultat image HTTP ${result.status}`);
    const text=await result.text();
    for(const block of text.split(/\n\n+/)){
      const event=block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
      const raw=block.match(/^data:\s*(.*)$/m)?.[1];
      if(event==='generating')onState?.('generating',`${provider.label} · génération image propre`);
      if(event==='error')throw new Error(cleanError(raw));
      if(event==='complete'&&raw){
        let data:any;try{data=JSON.parse(raw)}catch{throw new Error('réponse image illisible')}
        const url=outputUrl(provider,data);
        if(!url)throw new Error('image terminée mais URL introuvable');
        return url;
      }
    }
    throw new Error('réponse image incomplète');
  }catch(error){
    if(error instanceof DOMException&&error.name==='AbortError')throw new Error('timeout GPU image gratuit');
    throw error;
  }finally{window.clearTimeout(timer)}
}

export async function generateAutonomousSourceImage(input:{plan:MonIAMediaPlan;onState?:(state:MonIAImageState,detail?:string)=>void}):Promise<MonIAImageResult>{
  const attempts:string[]=[];
  if(!input.plan.visual.required)return {state:'ready',provider:'none',attempts};
  try{
    const cell=referenceCell(input.plan);
    input.onState?.('preparing-reference',`Identité canon ${input.plan.actor} · préparation interne`);
    const reference=await cleanReference(cell);
    const prompt=generationPrompt(input.plan);
    for(const provider of PROVIDERS){
      try{
        const imageUrl=await call(provider,prompt,reference,input.plan,input.onState);
        input.onState?.('ready',`${provider.label} · source propre prête`);
        return {state:'ready',imageUrl,provider:provider.id,attempts};
      }catch(error){attempts.push(`${provider.label}: ${cleanError(error)}`)}
    }
    const error=`Aucun moteur image gratuit n’a produit de source propre. ${attempts.join(' | ')}`;
    input.onState?.('error',error);
    return {state:'error',provider:'hf-image-pool',error,attempts};
  }catch(error){
    const message=cleanError(error);input.onState?.('error',message);
    return {state:'error',provider:'hf-image-pool',error:message,attempts};
  }
}
