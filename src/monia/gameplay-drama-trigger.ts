const SAVE_KEY='marion-lucas-save-v4';
const EVENT_NAME='marion-lucas:gameplay-drama';
let lastSignature='';

type LooseSave={
  day?:number;time?:string;place?:string;relationship?:number;trust?:number;chemistry?:number;
  metLucas?:boolean;official?:boolean;memories?:string[];eventHistory?:string[];outfit?:string;
  flags?:Record<string,string|number|boolean>;
};

export type GameplayDramaTrigger={
  source:'gameplay';
  signature:string;
  day:number;
  time:string;
  place:string;
  title:string;
  body:string;
  dialogue:string[];
  tone:string;
  presentation:string;
  relationship:number;
  trust:number;
  chemistry:number;
  outfit:string;
  memories:string[];
  recentEvents:string[];
};

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}

function text(el:Element|null){return (el?.textContent||'').trim().replace(/\s+/g,' ')}

function eligible(overlay:HTMLElement){
  if(!overlay.classList.contains('dramaOverlay'))return false;
  if(overlay.classList.contains('stage-phone')||overlay.classList.contains('stage-ambient'))return false;
  return overlay.classList.contains('tone-intense')||overlay.classList.contains('tone-intimate')||overlay.classList.contains('tone-tense')||overlay.classList.contains('tone-cinematic');
}

function buildTrigger(overlay:HTMLElement):GameplayDramaTrigger|null{
  if(!eligible(overlay))return null;
  const save=readSave();
  if(!save)return null;
  const title=text(overlay.querySelector('.cleanNarrative > span'));
  const body=text(overlay.querySelector('.sceneBody,.cleanNarrative > p'));
  const dialogue=[...overlay.querySelectorAll<HTMLElement>('.cleanDialogue p')].map(n=>text(n)).filter(Boolean);
  if(!title&&!body&&!dialogue.length)return null;
  const tone=[...overlay.classList].find(c=>c.startsWith('tone-'))?.slice(5)||'cinematic';
  const presentation=[...overlay.classList].find(c=>c.startsWith('stage-'))?.slice(6)||'close';
  const signature=`${save.day||0}|${save.time||''}|${save.place||''}|${title}|${body}|${dialogue.join('|')}`.slice(0,1200);
  return{
    source:'gameplay',signature,day:Number(save.day||0),time:save.time||'00:00',place:save.place||'home',
    title,body,dialogue,tone,presentation,relationship:Number(save.relationship||0),trust:Number(save.trust||0),
    chemistry:Number(save.chemistry||0),outfit:save.outfit||'',memories:(save.memories||[]).slice(0,8),
    recentEvents:(save.eventHistory||[]).slice(-8),
  };
}

function inspect(){
  const overlay=document.querySelector<HTMLElement>('#overlay.dramaOverlay');
  if(!overlay)return;
  const trigger=buildTrigger(overlay);
  if(!trigger||trigger.signature===lastSignature)return;
  lastSignature=trigger.signature;
  window.dispatchEvent(new CustomEvent<GameplayDramaTrigger>(EVENT_NAME,{detail:trigger}));
  console.info('[Drama] Gameplay requested cinematic treatment',trigger.title||trigger.signature);
}

new MutationObserver(inspect).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
window.setTimeout(inspect,800);

export const GAMEPLAY_DRAMA_EVENT=EVENT_NAME;
console.info('[Drama] Gameplay trigger bridge active');
