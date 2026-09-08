import './postContactDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;phoneUnread:number;
  messages:Array<{from:string;text:string,day:number,read:boolean}>;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let lastKey='';
let pulseTimer=0;
let breathingTimer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function firstAt(s:SaveLike){return Number(s.flags.firstContactAt||0)}

function addMemory(s:SaveLike,text:string){
  if(!Array.isArray(s.memories))s.memories=[];
  if(!s.memories.includes(text))s.memories.unshift(text);
  s.memories=s.memories.slice(0,40);
}

function seedAftermath(s:SaveLike){
  if(!s.metLucas||s.flags.postContactSeeded)return false;
  s.flags.postContactSeeded=true;
  s.flags.postContactMood='unsettled';
  s.flags.postContactSeenAt=stamp(s);
  s.flags.postContactBreathingStartedAt=Date.now();
  addMemory(s,'Après cette rencontre, un détail te revient sans raison précise.');
  write(s);
  return true;
}

function mountBreathingRoom(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');
  if(!game||!s.metLucas||s.flags.postContactBreathingDone)return;
  const started=Number(s.flags.postContactBreathingStartedAt||0);
  if(!started)return;
  const elapsed=Date.now()-started;
  if(elapsed>=4200){
    game.classList.remove('postContactBreathing');
    s.flags.postContactBreathingDone=true;
    write(s);
    return;
  }
  game.classList.add('postContactBreathing');
  if(breathingTimer)window.clearTimeout(breathingTimer);
  breathingTimer=window.setTimeout(()=>{
    game.classList.remove('postContactBreathing');
    const latest=read();
    if(latest&&!latest.flags.postContactBreathingDone){latest.flags.postContactBreathingDone=true;write(latest)}
  },Math.max(250,4200-elapsed));
}

function maybeMarineEcho(s:SaveLike){
  if(!s.metLucas||s.flags.postContactMarineEcho||s.day>2)return false;
  const contact=firstAt(s)||Number(s.flags.postContactSeenAt||0);
  if(!contact||stamp(s)-contact<45)return false;
  s.flags.postContactMarineEcho=true;
  s.messages.unshift({from:'Marine',text:'Tu me racontes quand tu peux 👀',day:s.day,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;
  s.flags.phoneToast='Marine|Tu me racontes quand tu peux 👀';
  s.flags.phoneToastAt=stamp(s);
  write(s);
  return true;
}

function removePulse(){document.getElementById('postContactPulse')?.remove()}
function mountPulse(s:SaveLike){
  if(!s.metLucas||s.screen!=='game'){removePulse();return}
  const game=document.querySelector<HTMLElement>('main.game');if(!game){removePulse();return}
  const contact=firstAt(s)||Number(s.flags.postContactSeenAt||0);
  const elapsed=contact?stamp(s)-contact:0;
  const firstMessage=Boolean(s.flags.firstMessage);
  if(firstMessage||elapsed>210){removePulse();return}
  const key=`${s.day}-${s.time}-${s.place}-${firstMessage}`;
  if(key===lastKey&&document.getElementById('postContactPulse'))return;
  lastKey=key;
  let pulse=document.getElementById('postContactPulse');
  if(!pulse){pulse=document.createElement('aside');pulse.id='postContactPulse';pulse.className='postContactPulse';game.appendChild(pulse)}
  const home=s.place==='home';
  pulse.innerHTML=home
    ?'<span>UN PEU PLUS TARD</span><strong>L’appartement est redevenu calme.</strong><small>Mais pas tout à fait comme ce matin.</small>'
    :'<span>QUELQUE CHOSE RESTE</span><strong>La ville continue autour de toi.</strong><small>Ton esprit, lui, revient parfois au même instant.</small>';
  if(pulseTimer)window.clearTimeout(pulseTimer);
  pulseTimer=window.setTimeout(()=>pulse?.classList.add('is-soft'),5200);
}

function scan(){
  const s=read();if(!s)return;
  const seeded=seedAftermath(s);
  if(seeded){window.setTimeout(scan,80);return}
  mountBreathingRoom(s);
  if(maybeMarineEcho(s)){window.setTimeout(()=>location.reload(),40);return}
  mountPulse(s);
}

window.addEventListener('storage',scan);
window.addEventListener('marion-home-first-control',()=>window.setTimeout(scan,300));
document.addEventListener('click',e=>{
  const t=e.target as HTMLElement|null;
  if(t?.closest('.eventOverlay,.choice,.eventCard,[data-choice]'))window.setTimeout(scan,320);
},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
window.setInterval(scan,7000);
scan();

console.info('[Romance] post-contact flow polished with breathing room and lighter DOM watching');
