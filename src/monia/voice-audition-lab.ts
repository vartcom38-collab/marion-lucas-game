const FAVORITES_KEY='monia-lucas-voice-audition-favorites-v1';

type AuditionPreset={id:string;label:string;rate:number;pitch:number;note:string};
type Candidate={id:string;voice:SpeechSynthesisVoice;preset:AuditionPreset};

const PRESETS:AuditionPreset[]=[
  {id:'natural',label:'Naturel jeune',rate:.98,pitch:.96,note:'jeune, simple, conversation'},
  {id:'warm',label:'Chaleureux',rate:.93,pitch:.92,note:'plus doux et proche'},
  {id:'deep',label:'Grave jeune',rate:.94,pitch:.84,note:'plus grave sans vieillir Lucas'},
  {id:'intense',label:'Intense calme',rate:.88,pitch:.88,note:'posé, retenu, cinématographique'},
  {id:'tender',label:'Tendre intime',rate:.86,pitch:.94,note:'lent, doux, proche caméra'},
  {id:'spanish',label:'Couleur espagnole',rate:.96,pitch:.9,note:'à tester surtout sur une voix ES'},
];

const DEFAULT_TEXT='Marion… attends. Je voulais juste entendre ta voix avant de rentrer.';

function readFavorites(){try{return new Set<string>(JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'))}catch{return new Set<string>()}}
function writeFavorites(value:Set<string>){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...value]))}catch{}}
function esc(value:string){return value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}
function voiceKey(v:SpeechSynthesisVoice){return `${v.name}|${v.lang}|${v.voiceURI}`}
function candidateId(v:SpeechSynthesisVoice,p:AuditionPreset){return `${voiceKey(v)}|${p.id}`}

function relevantVoices(){
  const all=speechSynthesis.getVoices();
  const preferred=all.filter(v=>/^(fr|es)(-|_)/i.test(v.lang));
  const localFirst=[...preferred].sort((a,b)=>Number(b.localService)-Number(a.localService)||a.lang.localeCompare(b.lang)||a.name.localeCompare(b.name));
  return localFirst.length?localFirst:all;
}

function stop(){try{speechSynthesis.cancel()}catch{}}
function speak(candidate:Candidate,text:string,button:HTMLButtonElement){
  stop();
  const utterance=new SpeechSynthesisUtterance(text.trim()||DEFAULT_TEXT);
  utterance.voice=candidate.voice;
  utterance.lang=candidate.voice.lang||'fr-FR';
  utterance.rate=candidate.preset.rate;
  utterance.pitch=candidate.preset.pitch;
  const old=button.textContent;
  button.textContent='■ Stop';
  utterance.onend=()=>{button.textContent=old||'▶ Écouter'};
  utterance.onerror=()=>{button.textContent=old||'▶ Écouter'};
  speechSynthesis.speak(utterance);
}

function buildCandidateCard(candidate:Candidate,favorites:Set<string>,text:()=>string){
  const id=candidate.id;
  const article=document.createElement('article');
  article.className='voiceCandidate';
  article.dataset.voiceCandidate=id;
  article.innerHTML=`<div class="voiceCandidateTop"><div><strong>${esc(candidate.voice.name)}</strong><small>${esc(candidate.voice.lang)} · ${candidate.voice.localService?'locale':'système/réseau'}</small></div><button type="button" class="voiceStar" aria-label="Favori">${favorites.has(id)?'★':'☆'}</button></div><div class="voicePreset">${esc(candidate.preset.label)} <span>${esc(candidate.preset.note)}</span></div><div class="voiceActions"><button type="button" class="voiceListen">▶ Écouter</button><code>rate ${candidate.preset.rate.toFixed(2)} · pitch ${candidate.preset.pitch.toFixed(2)}</code></div>`;
  const play=article.querySelector<HTMLButtonElement>('.voiceListen')!;
  play.addEventListener('click',()=>speak(candidate,text(),play));
  const star=article.querySelector<HTMLButtonElement>('.voiceStar')!;
  star.addEventListener('click',()=>{
    if(favorites.has(id)){favorites.delete(id);star.textContent='☆'}else{favorites.add(id);star.textContent='★'}
    writeFavorites(favorites);
    updateSummary();
  });
  return article;
}

let summaryTarget:HTMLElement|null=null;
let favoritesRef=new Set<string>();
function updateSummary(){if(summaryTarget)summaryTarget.textContent=`${favoritesRef.size} candidat${favoritesRef.size>1?'s':''} retenu${favoritesRef.size>1?'s':''}`}

function mount(){
  const root=document.getElementById('voiceAuditionLab');
  if(!root||!('speechSynthesis'in window))return;
  const grid=root.querySelector<HTMLElement>('[data-voice-grid]')!;
  const textArea=root.querySelector<HTMLTextAreaElement>('#voiceAuditionText')!;
  const summary=root.querySelector<HTMLElement>('[data-voice-summary]')!;
  summaryTarget=summary;favoritesRef=readFavorites();updateSummary();

  const render=()=>{
    const voices=relevantVoices();
    grid.innerHTML='';
    if(!voices.length){grid.innerHTML='<p class="status">Aucune voix système détectée pour le moment. Recharge la page après quelques secondes.</p>';return}
    const candidates:Candidate[]=[];
    for(const voice of voices){for(const preset of PRESETS)candidates.push({id:candidateId(voice,preset),voice,preset})}
    for(const candidate of candidates)grid.appendChild(buildCandidateCard(candidate,favoritesRef,()=>textArea.value));
    const count=root.querySelector<HTMLElement>('[data-voice-count]');
    if(count)count.textContent=`${voices.length} voix de base · ${candidates.length} écoutes possibles`;
  };

  render();
  speechSynthesis.onvoiceschanged=render;

  const stopBtn=root.querySelector<HTMLButtonElement>('#voiceStopAll');
  stopBtn?.addEventListener('click',stop);
  const favoritesOnly=root.querySelector<HTMLInputElement>('#voiceFavoritesOnly');
  favoritesOnly?.addEventListener('change',()=>{
    root.querySelectorAll<HTMLElement>('[data-voice-candidate]').forEach(card=>{
      card.hidden=Boolean(favoritesOnly.checked&&!favoritesRef.has(card.dataset.voiceCandidate||''));
    });
  });

  const input=root.querySelector<HTMLInputElement>('#voiceReferenceVideo');
  const video=root.querySelector<HTMLVideoElement>('#voiceReferencePlayer');
  const refStatus=root.querySelector<HTMLElement>('[data-reference-status]');
  input?.addEventListener('change',()=>{
    const file=input.files?.[0];
    if(!file||!video)return;
    if(video.dataset.objectUrl)URL.revokeObjectURL(video.dataset.objectUrl);
    const url=URL.createObjectURL(file);video.dataset.objectUrl=url;video.src=url;video.hidden=false;video.load();
    if(refStatus)refStatus.textContent=`Référence chargée localement : ${file.name}`;
  });
  window.addEventListener('beforeunload',()=>{if(video?.dataset.objectUrl)URL.revokeObjectURL(video.dataset.objectUrl)});
}

document.addEventListener('DOMContentLoaded',mount);
console.info('[MonIA Test] Lucas voice audition lab ready');
