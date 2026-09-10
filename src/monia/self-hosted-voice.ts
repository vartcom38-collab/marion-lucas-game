import type { LucasVoiceReference } from './voice-reference-provider';

const ENV_URL=String((import.meta as any).env?.VITE_MONIA_VOICE_API_URL||'').trim().replace(/\/$/,'');
const STORAGE_KEY='monia-self-hosted-voice-api-v1';

export function getSelfHostedVoiceApi(){
  try{return (localStorage.getItem(STORAGE_KEY)||ENV_URL).trim().replace(/\/$/,'')}catch{return ENV_URL}
}

export function setSelfHostedVoiceApi(url:string){
  const clean=url.trim().replace(/\/$/,'');
  if(clean)localStorage.setItem(STORAGE_KEY,clean);else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('monia:self-hosted-voice-api-changed'));
}

export async function selfHostedVoiceHealth(timeout=5000){
  const base=getSelfHostedVoiceApi();if(!base)return {ok:false,error:'service vocal auto-hébergé non configuré'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(`${base}/health`,{signal:controller.signal,cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)}}finally{clearTimeout(timer)}
}

export async function generateSelfHostedLucasVoice(text:string,reference:LucasVoiceReference,mood:string){
  const base=getSelfHostedVoiceApi();if(!base)throw new Error('service vocal auto-hébergé non configuré');
  const form=new FormData();
  form.append('text',text);
  form.append('language','fr');
  form.append('reference',reference.file,reference.file.name);
  const settings=mood==='soft'?{exaggeration:.42,cfg:.36,temp:.72}:mood==='warm'?{exaggeration:.56,cfg:.38,temp:.8}:mood==='intense'?{exaggeration:.72,cfg:.42,temp:.76}:mood==='tired'?{exaggeration:.34,cfg:.5,temp:.66}:{exaggeration:.48,cfg:.42,temp:.78};
  form.append('exaggeration',String(settings.exaggeration));form.append('cfg_weight',String(settings.cfg));form.append('temperature',String(settings.temp));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
  try{
    const r=await fetch(`${base}/v1/voice/lucas`,{method:'POST',body:form,signal:controller.signal});
    if(!r.ok)throw new Error(`service vocal HTTP ${r.status}`);
    const blob=await r.blob();if(blob.size<256)throw new Error('service vocal a renvoyé un audio vide');
    return URL.createObjectURL(blob);
  }finally{clearTimeout(timer)}
}
