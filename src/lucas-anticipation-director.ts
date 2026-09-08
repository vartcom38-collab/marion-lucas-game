import './lucasAnticipationDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;phoneUnread:number;
  messages:Array<{from:string;text:string,day:number,read:boolean}>;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let lastPhase='';
let firstMessageCelebrated=false;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function contactAt(s:SaveLike){return Number(s.flags.firstContactAt||s.flags.postContactSeenAt||0)}
function elapsed(s:SaveLike){const at=contactAt(s);return at?Math.max(0,stamp(s)-at):0}

function addMemory(s:SaveLike,text:string){
  if(!Array.isArray(s.memories))s.memories=[];
  if(!s.memories.includes(text))s.memories.unshift(text);
  s.memories=s.memories.slice(0,40);
}

function removeCue(){document.getElementById('lucasAnticipationCue')?.remove()}

function phaseFor(s:SaveLike){
  const e=elapsed(s);
  if(e<25)return'';
  if(e<70)return'echo';
  if(e<135)return'phone';
  if(e<220)return'silence';
  return'late';
}

function cueCopy(s:SaveLike,phase:string){
  const home=s.place==='home';
  if(phase==='echo')return home
    ?['UN DÉTAIL REVIENT','Tu reprends ta matinée.','Et pourtant, ton esprit repart une seconde ailleurs.']
    :['UN DÉTAIL REVIENT','Tu continues à marcher.','Un regard, une voix, quelque chose revient sans prévenir.'];
  if(phase==='phone')return['SANS Y PENSER','Ton regard tombe sur ton téléphone.','Aucune raison particulière. Enfin… presque.'];
  if(phase==='silence')return home
    ?['LE TEMPS PASSE','Le téléphone reste silencieux.','La journée, elle, ne s’arrête pas pour autant.']
    :['LE TEMPS PASSE','La ville continue de bouger.','Tu n’attends rien. Tu le remarques juste un peu trop.'];
  return['PLUS TARD','Tu as presque cessé d’y penser.','Presque.'];
}

function mountCue(s:SaveLike){
  if(!s.metLucas||s.screen!=='game'||Boolean(s.flags.firstMessage)){removeCue();return}
  const phase=phaseFor(s);if(!phase){removeCue();return}
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  if(lastPhase===phase&&document.getElementById('lucasAnticipationCue'))return;
  lastPhase=phase;
  removeCue();
  const cue=document.createElement('aside');cue.id='lucasAnticipationCue';cue.className=`lucasAnticipationCue phase-${phase}`;
  const [kicker,title,body]=cueCopy(s,phase);
  cue.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(cue);
  window.setTimeout(()=>cue.classList.add('is-fading'),phase==='phone'?4800:6200);
  window.setTimeout(()=>cue.remove(),phase==='phone'?6500:8200);
  if(!s.flags[`anticipation_${phase}`]){
    s.flags[`anticipation_${phase}`]=stamp(s);
    if(phase==='phone')addMemory(s,'Sans vraiment l’admettre, tu as vérifié ton téléphone après votre rencontre.');
    write(s);
  }
}

function celebrateFirstMessage(s:SaveLike){
  if(!s.metLucas||!s.flags.firstMessage||s.flags.firstMessageArrivalPlayed||firstMessageCelebrated)return false;
  const hasLucas=Array.isArray(s.messages)&&s.messages.some(m=>m.from==='Lucas');
  if(!hasLucas)return false;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return false;
  firstMessageCelebrated=true;
  s.flags.firstMessageArrivalPlayed=true;
  addMemory(s,'Quand son premier message est arrivé, le silence d’avant a soudain pris un autre sens.');
  write(s);
  document.querySelectorAll<HTMLElement>('#phone,#premiumPhone,#phoneExact').forEach(el=>el.classList.add('lucasMessagePulse'));
  const cue=document.createElement('button');cue.id='lucasMessageArrival';cue.className='lucasMessageArrival';
  cue.innerHTML='<span>LUCAS</span><strong>Ton téléphone vibre.</strong><small>Ouvrir le message →</small>';
  cue.onclick=()=>{(document.getElementById('premiumPhone')||document.getElementById('phone'))?.dispatchEvent(new MouseEvent('click',{bubbles:true}));cue.remove()};
  game.appendChild(cue);
  window.setTimeout(()=>cue.classList.add('is-waiting'),7000);
  return true;
}

function scan(){
  const s=read();if(!s)return;
  if(celebrateFirstMessage(s))return;
  mountCue(s);
}

window.addEventListener('storage',scan);
window.addEventListener('marion-home-first-control',()=>window.setTimeout(scan,350));
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(scan,6500);
scan();

console.info('[Romance] Lucas anticipation director active');
