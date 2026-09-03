import { moniaExperience } from './experience-runtime';
import type { MonIADirectorResult } from './director';

const SAVE_KEY='marion-lucas-save-v4';
const SETTINGS_KEY='marion-lucas-settings-v2';
const VISIO_KEY='monia-last-visio-v1';

type LooseSave={day:number;time:string;place:string;relationship:number;memories?:string[];eventHistory?:string[];messages?:Array<{from:string;text:string;day:number;read:boolean}>;calendar?:Array<{owner:string;title:string;day:number;note:string}>};
const placeLabels:Record<string,string>={home:'Appartement de Marion à Nîmes',nimes:'Nîmes',cafe:'Café à Nîmes',arenes:'Arènes de Nîmes',station:'Gare',madrid:'Madrid',family:'Maison familiale',finca:'Finca liée au travail de Lucas',estate:'Propriété du couple en Espagne'};

function readSave():LooseSave|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}}
function readPrefs(){try{return {localAI:true,aiMode:'auto',...(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}}catch{return {localAI:true,aiMode:'auto'}}}
function lastVisio():MonIADirectorResult|null{try{const raw=sessionStorage.getItem(VISIO_KEY);return raw?JSON.parse(raw) as MonIADirectorResult:null}catch{return null}}
function relationLabel(value=0){if(value>=70)return'relation très forte et intime';if(value>=45)return'relation proche et solide';if(value>=25)return'relation affectueuse en construction';if(value>=10)return'relation naissante';return'ils se connaissent encore peu'}
function status(text:string){const overlay=document.getElementById('moniaVisioOverlay');const badge=overlay?.querySelector<HTMLElement>('[data-monia-live-state]');if(badge)badge.textContent=`● ${text}`}
function speechEvent(type:'start'|'boundary'|'end'|'error',detail:Record<string,unknown>={}){window.dispatchEvent(new CustomEvent('monia-visio-speech',{detail:{type,at:performance.now(),...detail}}))}

function responsePanel(){
  const overlay=document.getElementById('moniaVisioOverlay');if(!overlay)return null;
  let panel=overlay.querySelector<HTMLElement>('[data-monia-live-dialogue]');if(panel)return panel;
  panel=document.createElement('div');panel.dataset.moniaLiveDialogue='true';
  panel.style.cssText='position:absolute;z-index:6;left:24px;right:24px;bottom:104px;max-width:720px;margin:auto;padding:12px 16px;border-radius:16px;background:rgba(8,7,6,.58);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);font:500 14px/1.45 system-ui,sans-serif;color:white;display:none';
  overlay.appendChild(panel);return panel;
}
function setDialogue(actor:string,text:string){const panel=responsePanel();if(!panel)return;panel.style.display='block';panel.innerHTML=`<strong>${actor}</strong><br>${text.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}`}
function chooseVoice(){if(!('speechSynthesis'in window))return null;const voices=window.speechSynthesis.getVoices();return voices.find(v=>v.lang.toLowerCase()==='fr-fr'&&v.localService)||voices.find(v=>v.lang.toLowerCase().startsWith('fr'))||voices[0]||null}

function speak(text:string){
  if(!('speechSynthesis'in window))return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=.96;u.pitch=.9;
  const voice=chooseVoice();if(voice)u.voice=voice;
  u.onstart=()=>{status('Lucas parle');speechEvent('start',{length:text.length})};
  u.onboundary=e=>speechEvent('boundary',{charIndex:e.charIndex,name:e.name,elapsedTime:e.elapsedTime,textLength:text.length});
  u.onend=()=>{status('Lucas écoute');speechEvent('end')};
  u.onerror=e=>{status('Lucas écoute');speechEvent('error',{error:e.error})};
  window.speechSynthesis.speak(u);
}

function contextFor(text:string){
  const save=readSave();if(!save)return null;const previous=lastVisio();
  const recent=save.messages?.slice(0,6).map(m=>`${m.from}: ${m.text}`)||[];
  const todayLucas=save.calendar?.filter(i=>i.owner==='Lucas'&&i.day===save.day).map(i=>`${i.title} · ${i.note}`)||[];
  return {speaker:'Marion',place:previous?.scene?.location||placeLabels[save.place]||save.place,time:save.time,day:save.day,recentAction:`Pendant une visio en cours, Marion dit à Lucas : ${text.slice(0,180)}`,activeObjective:'Poursuivre naturellement la visio en cours, répondre oralement à Marion sans sortir de la scène ni créer un événement futur',relationship:relationLabel(save.relationship),memories:[...(save.memories||[]).slice(0,6),...recent].slice(0,10),recentEvents:[...(save.eventHistory||[]).slice(-5),...todayLucas].slice(-8),rules:['Ne jamais révéler un événement futur ou une surprise.','Lucas reste absolument fidèle.','Répondre comme Lucas dans une vraie visio, pas comme un assistant.','Ne jamais écrire la réponse de Marion.','Garder le lieu, la tenue et le contexte visuel de la visio actuelle sauf fait explicite contraire.','Réponse orale naturelle, brève, avec hésitations ou micro-pauses seulement si elles sonnent humaines.']};
}

async function answerTurn(transcript:string){
  const context=contextFor(transcript);if(!context)return;const prefs=readPrefs();status('Lucas réfléchit…');setDialogue('Marion',transcript);
  try{
    const experience=await moniaExperience.respond({actor:'Lucas',playerText:transcript,requestedChannel:'visio',context,availableMedia:[]},prefs.aiMode as any,prefs.localAI!==false);
    const result=experience.response;try{sessionStorage.setItem(VISIO_KEY,JSON.stringify(result))}catch{}
    setDialogue('Lucas',result.spokenText||result.text);speak(result.spokenText||result.text);
  }catch(error){console.warn('[MonIA visio turn]',error);status('Lucas écoute')}
}

function installMic(){
  const overlay=document.getElementById('moniaVisioOverlay');if(!overlay||overlay.querySelector('[data-monia-visio-mic]'))return;
  const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!Recognition)return;
  const button=document.createElement('button');button.type='button';button.dataset.moniaVisioMic='true';button.textContent='🎙 Parler';
  button.style.cssText='position:absolute;z-index:8;bottom:28px;left:50%;transform:translateX(-50%);border:0;border-radius:999px;padding:12px 18px;background:rgba(255,255,255,.92);color:#111;font:700 14px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.3)';
  let recognition:any=null;
  button.onclick=()=>{try{window.speechSynthesis?.cancel();speechEvent('end');recognition?.abort?.();recognition=new Recognition();recognition.lang='fr-FR';recognition.interimResults=false;recognition.continuous=false;status('Marion parle…');button.textContent='● Écoute…';recognition.onresult=(e:any)=>{const value=String(e.results?.[0]?.[0]?.transcript||'').trim();if(value)void answerTurn(value)};recognition.onerror=()=>status('Lucas écoute');recognition.onend=()=>{button.textContent='🎙 Parler'};recognition.start()}catch{button.textContent='🎙 Parler';status('Lucas écoute')}};
  overlay.appendChild(button);
}
window.setInterval(()=>{if(document.getElementById('moniaVisioOverlay'))installMic()},700);
console.info('[MonIA] Conversational visio voice turns + speech timing events active');
