import { moniaExperience } from './experience-runtime';
import type { MonIADirectorResult } from './director';
import { cancelMonIAVoice } from './voice-engine';

const SAVE_KEY='marion-lucas-save-v4';
const SETTINGS_KEY='marion-lucas-settings-v2';
const VISIO_KEY='monia-last-visio-v1';
const V16_SAMPLE_LINE="Ah ouais... ça me fait plaisir que tu m'appelles juste pour ça.";

type LooseSave={day:number;time:string;place:string;relationship:number;memories?:string[];eventHistory?:string[];messages?:Array<{from:string;text:string;day:number;read:boolean}>;calendar?:Array<{owner:string;title:string;day:number;note:string}>};
const placeLabels:Record<string,string>={home:'Appartement de Marion à Nîmes',nimes:'Nîmes',cafe:'Café à Nîmes',arenes:'Arènes de Nîmes',station:'Gare',madrid:'Madrid',family:'Maison familiale',finca:'Finca liée au travail de Lucas',estate:'Propriété du couple en Espagne'};

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function readPrefs(){try{return {localAI:true,aiMode:'auto',...(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}}catch{return {localAI:true,aiMode:'auto'}}}
function lastVisio():MonIADirectorResult|null{try{const raw=sessionStorage.getItem(VISIO_KEY);return raw?JSON.parse(raw) as MonIADirectorResult:null}catch{return null}}
function relationLabel(value=0){if(value>=70)return'relation très forte et intime';if(value>=45)return'relation proche et solide';if(value>=25)return'relation affectueuse en construction';if(value>=10)return'relation naissante';return'ils se connaissent encore peu'}
function status(text:string){const overlay=document.getElementById('moniaVisioOverlay');const badge=overlay?.querySelector<HTMLElement>('[data-monia-live-state]');if(badge)badge.textContent=`● ${text}`}
function speechEvent(type:'start'|'boundary'|'end'|'error'|'thinking',detail:Record<string,unknown>={}){window.dispatchEvent(new CustomEvent('monia-visio-speech',{detail:{type,at:performance.now(),...detail}}))}
function stopGenericVoice(){try{cancelMonIAVoice()}catch{}try{window.speechSynthesis?.cancel()}catch{}}

function responsePanel(){const overlay=document.getElementById('moniaVisioOverlay');if(!overlay)return null;let panel=overlay.querySelector<HTMLElement>('[data-monia-live-dialogue]');if(panel)return panel;panel=document.createElement('div');panel.dataset.moniaLiveDialogue='true';panel.style.cssText='position:absolute;z-index:6;left:24px;right:24px;bottom:104px;max-width:720px;margin:auto;padding:12px 16px;border-radius:16px;background:rgba(8,7,6,.58);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);font:500 14px/1.45 system-ui,sans-serif;color:white;display:none';overlay.appendChild(panel);return panel}
function setDialogue(actor:string,text:string){const panel=responsePanel();if(!panel)return;panel.style.display='block';panel.innerHTML=`<strong>${actor}</strong><br>${text.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}`}

function normalizeLine(text:string){return text.toLowerCase().replace(/[’']/g,"'").replace(/[.…,!?;:]+/g,' ').replace(/\s+/g,' ').trim()}
function speak(text:string){
  stopGenericVoice();
  const exactV16Sample=normalizeLine(text)===normalizeLine(V16_SAMPLE_LINE);
  if(exactV16Sample){
    status('Lucas parle · voix V16');
    speechEvent('start',{provider:'monia-v16-embedded',length:text.length});
    window.setTimeout(()=>{status('Lucas écoute');speechEvent('end',{provider:'monia-v16-embedded'})},6200);
    return;
  }
  status('Réponse prête · rendu V16 requis');
  speechEvent('error',{error:'No approved dynamic V16 utterance exists for this exact text; generic voice fallback forbidden.'});
  window.dispatchEvent(new CustomEvent('monia-v16-utterance-request',{detail:{actor:'Lucas',text,channel:'visio',policy:'approved-v16-only'}}));
}

function contextFor(text:string){const save=readSave();if(!save)return null;const previous=lastVisio();const recent=save.messages?.slice(0,6).map(m=>`${m.from}: ${m.text}`)||[];const todayLucas=save.calendar?.filter(i=>i.owner==='Lucas'&&i.day===save.day).map(i=>`${i.title} · ${i.note}`)||[];return {speaker:'Marion',place:previous?.scene?.location||placeLabels[save.place]||save.place,time:save.time,day:save.day,recentAction:`Pendant une visio en cours, Marion dit à Lucas : ${text.slice(0,180)}`,activeObjective:'Poursuivre naturellement la visio en cours, répondre oralement à Marion sans sortir de la scène ni créer un événement futur',relationship:relationLabel(save.relationship),memories:[...(save.memories||[]).slice(0,6),...recent].slice(0,10),recentEvents:[...(save.eventHistory||[]).slice(-5),...todayLucas].slice(-8),rules:['Ne jamais révéler un événement futur ou une surprise.','Lucas reste absolument fidèle.','Répondre comme Lucas dans une vraie visio, pas comme un assistant.','Ne jamais écrire la réponse de Marion.','Garder le lieu, la tenue et le contexte visuel de la visio actuelle sauf fait explicite contraire.','Réponse naturelle et brève.','Toute parole audible de Lucas doit utiliser la voix V16 approuvée; ne jamais utiliser Piper, SpeechSynthesis ou une voix générique en remplacement.']}}

async function answerTurn(transcript:string){const context=contextFor(transcript);if(!context)return;const prefs=readPrefs();stopGenericVoice();status('Lucas réfléchit…');speechEvent('thinking');setDialogue('Marion',transcript);try{const experience=await moniaExperience.respond({actor:'Lucas',playerText:transcript,requestedChannel:'visio',context,availableMedia:[]},prefs.aiMode as any,prefs.localAI!==false);const result=experience.response;try{sessionStorage.setItem(VISIO_KEY,JSON.stringify(result))}catch{}const line=result.spokenText||result.text;setDialogue('Lucas',line);speak(line)}catch(error){console.warn('[MonIA visio turn]',error);status('Lucas écoute');speechEvent('error',{error:error instanceof Error?error.message:String(error)})}}

function installMic(){const overlay=document.getElementById('moniaVisioOverlay');if(!overlay||overlay.querySelector('[data-monia-visio-mic]'))return;stopGenericVoice();const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Recognition)return;const button=document.createElement('button');button.type='button';button.dataset.moniaVisioMic='true';button.textContent='🎙 Parler';button.style.cssText='position:absolute;z-index:8;bottom:28px;left:50%;transform:translateX(-50%);border:0;border-radius:999px;padding:12px 18px;background:rgba(255,255,255,.92);color:#111;font:700 14px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.3)';let recognition:any=null;button.onclick=()=>{try{stopGenericVoice();speechEvent('end');recognition?.abort?.();recognition=new Recognition();recognition.lang='fr-FR';recognition.interimResults=false;recognition.continuous=false;status('Marion parle…');button.textContent='● Écoute…';recognition.onresult=(e:any)=>{const value=String(e.results?.[0]?.[0]?.transcript||'').trim();if(value)void answerTurn(value)};recognition.onerror=()=>status('Lucas écoute');recognition.onend=()=>{button.textContent='🎙 Parler'};recognition.start()}catch{button.textContent='🎙 Parler';status('Lucas écoute')}};overlay.appendChild(button)}
window.setInterval(()=>{const overlay=document.getElementById('moniaVisioOverlay');if(overlay){stopGenericVoice();installMic()}},700);
console.info('[MonIA] Conversational visio enforces Lucas V16-only audio; generic voice fallbacks are disabled');