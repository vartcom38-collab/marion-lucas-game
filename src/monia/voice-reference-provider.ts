import { LUCAS_VOICE_REFERENCE_BASE64, LUCAS_VOICE_REFERENCE_FILENAME, LUCAS_VOICE_REFERENCE_MIME } from './lucas-voice-reference';

const APPROVED_URL_KEY='monia-lucas-approved-voice-reference-url-v1';
const APPROVED_TEXT_KEY='monia-lucas-approved-voice-reference-text-v1';

export type LucasVoiceReference={
  file:File;
  transcript:string;
  source:'approved-url'|'embedded-canon';
  canonical:boolean;
};

function bytesFromBase64(value:string){
  const raw=atob(value);const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}

async function fileFromUrl(url:string){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`référence Lucas inaccessible · HTTP ${response.status}`);
  const blob=await response.blob();
  return new File([blob],`lucas-approved-${Date.now()}.${blob.type.includes('wav')?'wav':'mp3'}`,{type:blob.type||'audio/mpeg'});
}

export function setApprovedLucasVoiceReference(url:string,transcript:string){
  const cleanUrl=url.trim(),cleanText=transcript.trim();
  if(!cleanUrl||!cleanText)throw new Error('Une URL et la transcription de la référence Lucas sont nécessaires.');
  localStorage.setItem(APPROVED_URL_KEY,cleanUrl);
  localStorage.setItem(APPROVED_TEXT_KEY,cleanText);
  window.dispatchEvent(new CustomEvent('monia:lucas-voice-reference-changed'));
}

export function clearApprovedLucasVoiceReference(){
  localStorage.removeItem(APPROVED_URL_KEY);localStorage.removeItem(APPROVED_TEXT_KEY);
  window.dispatchEvent(new CustomEvent('monia:lucas-voice-reference-changed'));
}

export function hasApprovedLucasVoiceReference(){
  try{return Boolean(localStorage.getItem(APPROVED_URL_KEY)&&localStorage.getItem(APPROVED_TEXT_KEY))}catch{return false}
}

export async function getLucasGenerationVoiceReference():Promise<LucasVoiceReference>{
  try{
    const url=localStorage.getItem(APPROVED_URL_KEY)||'';
    const transcript=localStorage.getItem(APPROVED_TEXT_KEY)||'';
    if(url&&transcript){
      try{return {file:await fileFromUrl(url),transcript,source:'approved-url',canonical:true}}
      catch(error){console.warn('[MonIA Voice] Référence approuvée inaccessible, repli sur le canon embarqué',error)}
    }
  }catch{}
  const bytes=bytesFromBase64(LUCAS_VOICE_REFERENCE_BASE64);
  const file=new File([bytes],LUCAS_VOICE_REFERENCE_FILENAME,{type:LUCAS_VOICE_REFERENCE_MIME});
  return {
    file,
    transcript:"Je viens de rentrer. Je suis un peu fatigué, mais je suis content de t'entendre.",
    source:'embedded-canon',
    canonical:true,
  };
}
