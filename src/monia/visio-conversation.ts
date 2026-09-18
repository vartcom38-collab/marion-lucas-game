import { moniaExperience } from './experience-runtime';
import type { MonIADirectorResult } from './director';
import { cancelMonIAVoice } from './voice-engine';
import { renderLucasV16, type LucasV16Emotion } from './v16-voice-runtime';

const SAVE_KEY='marion-lucas-save-v4';
const SETTINGS_KEY='marion-lucas-settings-v2';
const VISIO_KEY='monia-last-visio-v1';
const V16_SAMPLE_LINE="Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça.";
const V16_SAMPLE_URL='/resources/monia/generated/lucas-voice-v16-b-smoother-flow-fr-candidate.wav';

type LooseSave={day:number;time:string;place:string;relationship:number;memories?:string[];eventHistory?:string[];messages?:Array<{from:string;text:string;day:number;read:boolean}>;calendar?:Array<{owner:string;title:string;day:number,note:string}>};
const placeLabels:Record<string,string>={home:'Appartement de Marion à Nîmes',nimes:'Nîmes',cafe:'Café à Nîmes',arenes:'Arènes de Nîmes',station:'Gare',madrid:'Madrid',family:'Maison familiale',finca:'Finca liée au travail de Dominic',estate:'Propriété du couple en Espagne'};
let activeAudio:HTMLAudioElement|null=null;
let voiceAbort:AbortController|null=null;

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function readPrefs(){try{return {localAI:true,aiMode:'auto',...(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}}catch{return {localAI:true,aiMode:'auto'}}}
function lastVisio():MonIADirectorResult|null{try{const raw=sessionStorage.getItem(VISIO_KEY);return raw?JSON.parse(raw) as MonIADirectorResult:null}catch{return null}}
function relationLabel(value=0){if(value>=70)return'relation très forte et intime';if(value>=45)return'relation proche et solide';if(value>=25)return'relation affectueuse en construction';if(value>=10)return'relation naissante';return'ils se connaissent encore peu'}
function status(text:string){const overlay=document.getElementById('moniaVisioOverlay');const badge=overlay?.querySelector<HTMLElement>('[data-monia-live-state]');if(badge)badge.textContent=`● ${text}`}
function speechEvent(type:'start'|'boundary'|'end'|'error'|'thinking',detail:Record<string,unknown>={}){window.dispatchEvent(new CustomEvent('monia-visio-speech',{detail:{type,at:performance.now(),...detail}}))}
function stopGenericVoice(){try{cancelMonIAVoice()}catch{}try{window.speechSynthesis?.cancel()}catch{}}
function stopLucasAudio(){voiceAbort?.abort();voiceAbort=null;if(activeAudio){try{activeAudio.pause();activeAudio.src=''}catch{}activeAudio=null}}

function responsePanel(){const overlay=document.getElementById('moniaVisioOverlay');if(!overlay)return null;let panel=overlay.querySelector<HTMLElement>('[data-monia-live-dialogue]');if(panel)return panel;panel=document.createElement('div');panel.dataset.moniaLiveDialogue='true';panel.style.cssText='position:absolute;z-index:6;left:24px;right:24px;bottom:104px;max-width:720px;margin:auto;padding:12px 16px;border-radius:16px;background:rgba(8,7,6,.58);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);font:500 14px/1.45 system-ui,sans-serif;color:white;display:none';overlay.appendChild(panel);return panel}
function setDialogue(actor:string,text:string){const panel=responsePanel();if(!panel)return;panel.style.display='block';panel.innerHTML=`<strong>${actor}</strong><br>${text.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}`}
function normalizeLine(text:string){return text.toLowerCase().replace(/[’']/g,"'").replace(/[.…,!?;:]+/g,' ').replace(/\s+/g,' ').trim()}
function voiceEmotion(value:string|undefined):LucasV16Emotion{const v=(value||'').toLowerCase();if(/tendre|tender|doux|affect/.test(v))return'tender';if(/amus|souri|taquin|playful/.test(v))return'amused';if(/inquiet|concern|protect|tendu/.test(v))return'concerned';if(/fatigu|tired|épuis/.test(v))return'tired';if(/chuchot|whisper|murmur/.test(v))return'whisper';if(/chaud|warm|proche|intime/.test(v))return'warm';return'neutral'}

async function playV16(url:string,text:string,provider:string,duration?:number){
  stopLucasAudio();stopGenericVoice();
  const audio=new Audio(url);activeAudio=audio;audio.preload='auto';
  audio.onplay=()=>{status('Dominic parle · V16');speechEvent('start',{provider,length:text.length,duration})};
  audio.onended=()=>{if(activeAudio===audio)activeAudio=null;status('Dominic réagit');speechEvent('end',{provider,duration})};
  audio.onerror=()=>{if(activeAudio===audio)activeAudio=null;status('Audio V16 indisponible');speechEvent('error',{provider,error:'audio V16 illisible'})};
  try{await audio.play()}catch(error){if(activeAudio===audio)activeAudio=null;status('Lecture V16 bloquée');speechEvent('error',{provider,error:error instanceof Error?error.message:String(error)})}
}

async function speak(text:string,emotion:string|undefined){
  stopLucasAudio();stopGenericVoice();
  if(normalizeLine(text)===normalizeLine(V16_SAMPLE_LINE)){
    await playV16(V16_SAMPLE_URL,text,'monia-v16-approved-reference');
    return;
  }
  const intent=voiceEmotion(emotion);voiceAbort=new AbortController();
  status('MonIA prépare la voix V16…');speechEvent('thinking',{provider:'monia-v16-runtime',intent});
  try{
    const rendered=await renderLucasV16(text,intent,voiceAbort.signal);
    voiceAbort=null;
    await playV16(rendered.candidate_url,text,'monia-v16-runtime',rendered.duration);
  }catch(error){
    if((error as any)?.name==='AbortError')return;
    voiceAbort=null;status('Rendu V16 indisponible · aucune voix de remplacement');
    speechEvent('error',{provider:'monia-v16-runtime',error:error instanceof Error?error.message:String(error)});
  }
}

function contextFor(text:string){const save=readSave();if(!save)return null;const previous=lastVisio();const recent=save.messages?.slice(0,6).map(m=>`${m.from}: ${m.text}`)||[];const todayDominic=save.calendar?.filter(i=>['Dominic','Lucas'].includes(i.owner)&&i.day===save.day).map(i=>`${i.title} · ${i.note}`)||[];return {speaker:'Marion',place:previous?.scene?.location||placeLabels[save.place]||save.place,time:save.time,day:save.day,recentAction:`Pendant une visio en cours, Marion dit à Dominic : ${text.slice(0,180)}`,activeObjective:'Poursuivre naturellement la visio en cours, répondre oralement à Marion sans sortir de la scène ni créer un événement futur',relationship:relationLabel(save.relationship),memories:[...(save.memories||[]).slice(0,6),...recent].slice(0,10),recentEvents:[...(save.eventHistory||[]).slice(-5),...todayDominic].slice(-8),rules:['Ne jamais révéler un événement futur ou une surprise.','Dominic reste absolument fidèle.','Répondre comme Dominic dans une vraie visio, pas comme un assistant.','Ne jamais écrire la réponse de Marion.','Garder le lieu, la tenue et le contexte visuel de la visio actuelle sauf fait explicite contraire.','Réponse naturelle et brève.','Toute parole audible de Dominic doit utiliser la voix V16 approuvée; ne jamais utiliser Piper, SpeechSynthesis ou une voix générique en remplacement.']}}

async function answerTurn(transcript:string){const context=contextFor(transcript);if(!context)return;const prefs=readPrefs();stopLucasAudio();stopGenericVoice();status('Dominic réfléchit…');speechEvent('thinking');setDialogue('Marion',transcript);try{const experience=await moniaExperience.respond({actor:'Dominic',playerText:transcript,requestedChannel:'visio',context,availableMedia:[]},prefs.aiMode as any,prefs.localAI!==false);const result=experience.response;try{sessionStorage.setItem(VISIO_KEY,JSON.stringify(result))}catch{}const line=result.spokenText||result.text;setDialogue('Dominic',line);void speak(line,result.emotion)}catch(error){console.warn('[MonIA visio turn]',error);status('Dominic écoute');speechEvent('error',{error:error instanceof Error?error.message:String(error)})}}

function installMic(){const overlay=document.getElementById('moniaVisioOverlay');if(!overlay||overlay.querySelector('[data-monia-visio-mic]'))return;stopGenericVoice();const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Recognition)return;const button=document.createElement('button');button.type='button';button.dataset.moniaVisioMic='true';button.textContent='🎙 Parler';button.style.cssText='position:absolute;z-index:8;bottom:28px;left:50%;transform:translateX(-50%);border:0;border-radius:999px;padding:12px 18px;background:rgba(255,255,255,.92);color:#111;font:700 14px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.3)';let recognition:any=null;button.onclick=()=>{try{stopLucasAudio();stopGenericVoice();speechEvent('end');recognition?.abort?.();recognition=new Recognition();recognition.lang='fr-FR';recognition.interimResults=false;recognition.continuous=false;status('Marion parle…');button.textContent='● Écoute…';recognition.onresult=(e:any)=>{const value=String(e.results?.[0]?.[0]?.transcript||'').trim();if(value)void answerTurn(value)};recognition.onerror=()=>status('Dominic écoute');recognition.onend=()=>{button.textContent='🎙 Parler'};recognition.start()}catch{button.textContent='🎙 Parler';status('Dominic écoute')}};overlay.appendChild(button)}
window.setInterval(()=>{const overlay=document.getElementById('moniaVisioOverlay');if(overlay){stopGenericVoice();installMic()}else if(activeAudio||voiceAbort)stopLucasAudio()},700);
console.info('[MonIA] Conversational visio now requests, verifies and plays exact dynamic Dominic V16 audio; generic fallbacks remain forbidden');
