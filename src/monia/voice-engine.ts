export type MonIAVoiceActor='Lucas'|'Marion';
export type MonIAVoiceMood='neutral'|'warm'|'tired'|'intense'|'soft';

type SpeakOptions={
  actor:MonIAVoiceActor;
  mood?:MonIAVoiceMood;
  onStart?:()=>void;
  onBoundary?:(detail:{charIndex:number;name?:string;elapsedTime?:number;textLength:number})=>void;
  onEnd?:()=>void;
  onError?:(error:string)=>void;
};

const PREF_KEY='monia-voice-profile-v1';

type StoredProfile={actor:MonIAVoiceActor;voiceName?:string;lang:string;rate:number;pitch:number};

function voices(){return 'speechSynthesis'in window?window.speechSynthesis.getVoices():[]}

function load(actor:MonIAVoiceActor):StoredProfile|null{
  try{const raw=localStorage.getItem(PREF_KEY);const all=raw?JSON.parse(raw):{};return all?.[actor]||null}catch{return null}
}
function save(profile:StoredProfile){
  try{const raw=localStorage.getItem(PREF_KEY);const all=raw?JSON.parse(raw):{};all[profile.actor]=profile;localStorage.setItem(PREF_KEY,JSON.stringify(all))}catch{}
}

function actorBase(actor:MonIAVoiceActor){
  if(actor==='Lucas')return {rate:.94,pitch:.86};
  return {rate:.98,pitch:1.02};
}

function moodAdjust(mood:MonIAVoiceMood='neutral'){
  if(mood==='tired')return {rate:-.08,pitch:-.03};
  if(mood==='warm')return {rate:-.02,pitch:.01};
  if(mood==='soft')return {rate:-.05,pitch:.02};
  if(mood==='intense')return {rate:.01,pitch:-.02};
  return {rate:0,pitch:0};
}

function choose(actor:MonIAVoiceActor){
  const available=voices();
  const stored=load(actor);
  if(stored?.voiceName){const existing=available.find(v=>v.name===stored.voiceName);if(existing)return existing}
  const french=available.filter(v=>v.lang.toLowerCase()==='fr-fr');
  const local=french.find(v=>v.localService);
  const fallback=local||french[0]||available.find(v=>v.lang.toLowerCase().startsWith('fr'))||available[0]||null;
  if(fallback){const base=actorBase(actor);save({actor,voiceName:fallback.name,lang:fallback.lang||'fr-FR',rate:base.rate,pitch:base.pitch})}
  return fallback;
}

export function cancelMonIAVoice(){if('speechSynthesis'in window)window.speechSynthesis.cancel()}

export function speakMonIA(text:string,options:SpeakOptions){
  if(!('speechSynthesis'in window)){options.onError?.('synthèse vocale indisponible');return false}
  cancelMonIAVoice();
  const utterance=new SpeechSynthesisUtterance(text);
  const base=actorBase(options.actor),adjust=moodAdjust(options.mood);
  utterance.lang='fr-FR';utterance.rate=Math.max(.72,Math.min(1.08,base.rate+adjust.rate));utterance.pitch=Math.max(.72,Math.min(1.12,base.pitch+adjust.pitch));
  const voice=choose(options.actor);if(voice)utterance.voice=voice;
  utterance.onstart=()=>options.onStart?.();
  utterance.onboundary=e=>options.onBoundary?.({charIndex:e.charIndex,name:e.name,elapsedTime:e.elapsedTime,textLength:text.length});
  utterance.onend=()=>options.onEnd?.();
  utterance.onerror=e=>options.onError?.(e.error||'erreur vocale');
  window.speechSynthesis.speak(utterance);
  return true;
}

export function inferVoiceMood(text:string):MonIAVoiceMood{
  const value=text.toLowerCase();
  if(/fatigu|épuis|crevé|dorm|souffl/.test(value))return 'tired';
  if(/doucement|tendre|embrass|manqu|chérie|ma belle/.test(value))return 'soft';
  if(/colère|furieux|énerv|sérieux|écoute-moi/.test(value))return 'intense';
  if(/sour|content|heureux|plaisir|hâte/.test(value))return 'warm';
  return 'neutral';
}
