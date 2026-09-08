import './dayOneDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;introSeen:boolean;metLucas:boolean;
  phoneUnread:number;messages:Array<{from:string;text:string,day:number,read:boolean}>;
  calendar:Array<{owner:'Marion'|'Lucas'|'Nous';title:string;day:number,note:string}>;
  flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
const RELOAD_GUARD='marion-day-one-seed-reload-v1';
let mountedFor='';
let escalationOpen=false;

function read():SaveLike|null{
  try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}
}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function nowStamp(s:SaveLike){return s.day*1440+mins(s.time)}

function seedDayOne(s:SaveLike){
  if(s.flags.dayOneSocialSeeded)return false;
  s.flags.dayOneSocialSeeded=true;
  s.flags.dayOneThread='marine_invite';
  s.messages.unshift({from:'Marine',text:'Tu vas pas passer ta matinée enfermée 😭 Allez viens. Je suis vers les arènes. On prend un café ?',day:1,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;
  if(!s.calendar.some(i=>i.day===1&&i.title==='Retrouver Marine près des arènes')){
    s.calendar.push({owner:'Marion',title:'Retrouver Marine près des arènes',day:1,note:'Elle t’a écrit ce matin. La ville commence déjà à bouger.'});
  }
  s.flags.phoneToast='Marine|Allez viens. Je suis vers les arènes ☕';
  s.flags.phoneToastAt=nowStamp(s);
  write(s);
  return true;
}

function syncFreshGame(){
  const game=document.querySelector('main.game.immersivePlayable');
  if(!game)return;
  const s=read();
  if(!s||s.day!==1||!s.introSeen||s.metLucas||s.place!=='home')return;
  if(seedDayOne(s)){
    try{
      if(sessionStorage.getItem(RELOAD_GUARD)!=='1'){
        sessionStorage.setItem(RELOAD_GUARD,'1');
        window.setTimeout(()=>location.reload(),40);
      }
    }catch{}
  }
}

function removeImpulse(){document.getElementById('dayOneImpulse')?.remove()}

function mountImpulse(s:SaveLike){
  if(s.day!==1||s.metLucas||s.place!=='home'||!s.flags.dayOneSocialSeeded){removeImpulse();return}
  const game=document.querySelector<HTMLElement>('main.game.immersivePlayable');
  if(!game)return;
  const key=`${s.day}-${s.time}-${s.place}-${String(s.flags.dayOneThread||'')}`;
  let card=document.getElementById('dayOneImpulse') as HTMLButtonElement|null;
  if(!card){
    card=document.createElement('button');
    card.id='dayOneImpulse';
    card.className='dayOneImpulse';
    game.appendChild(card);
  }
  const late=mins(s.time)>=600;
  card.innerHTML=late
    ?'<span>MARINE T’ATTEND</span><strong>La matinée vient de trouver son mouvement.</strong><small>Voir où la rejoindre →</small>'
    :'<span>UN MESSAGE CHANGE TES PLANS</span><strong>Marine est déjà en ville.</strong><small>Te préparer →</small>';
  card.onclick=()=>{
    const target=document.getElementById(late?'premiumMap':'premiumWardrobe') as HTMLButtonElement|null;
    target?.click();
  };
  const objective=document.querySelector<HTMLElement>('.approvedObjective');
  if(objective){
    const strong=objective.querySelector('strong'),p=objective.querySelector('p');
    if(strong)strong.textContent=late?'Marine t’attend en ville':'Tu avais prévu une matinée calme…';
    if(p)p.textContent=late?'Tu peux encore prendre ton temps, mais quelque chose t’attire déjà dehors.':'Ton téléphone vient de décider que la journée ne resterait pas tranquille.';
  }
  mountedFor=key;
}

function showEscalation(s:SaveLike){
  if(escalationOpen||s.flags.dayOneMarineCallSeen||s.day!==1||s.place!=='home'||s.metLucas||mins(s.time)<645)return;
  const game=document.querySelector<HTMLElement>('main.game.immersivePlayable');
  if(!game)return;
  escalationOpen=true;
  s.flags.dayOneMarineCallSeen=true;
  s.messages.unshift({from:'Marine',text:'Je suis presque en bas 😅 Descends quand tu es prête, je t’embarque.',day:1,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;
  write(s);
  const veil=document.createElement('div');veil.className='dayOneCallVeil';
  veil.innerHTML=`<section class="dayOneCallCard"><span>APPEL · MARINE</span><h2>« Allez, viens. »</h2><p>Elle est déjà dehors. La ville s’anime et ta matinée vient clairement de changer de direction.</p><div><button id="dayOneGo" class="primary">Je descends</button><button id="dayOneLater">Deux minutes</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.remove();escalationOpen=false};
  (veil.querySelector('#dayOneLater') as HTMLButtonElement).onclick=close;
  (veil.querySelector('#dayOneGo') as HTMLButtonElement).onclick=()=>{
    const latest=read();if(!latest){close();return}
    latest.flags.dayOneThread='marine_on_the_way';
    latest.flags.dayOneLeftWithMarine=true;
    latest.flags.arrivalPlace='nimes';
    latest.flags.arrivalFrom='home';
    latest.flags.arrivalMinutes=15;
    latest.place='nimes';
    const total=mins(latest.time)+15;latest.time=`${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    write(latest);close();location.reload();
  };
}

function scan(){
  syncFreshGame();
  const s=read();if(!s)return;
  mountImpulse(s);
  showEscalation(s);
  if(s.day!==1||s.metLucas||s.place!=='home')removeImpulse();
}

window.addEventListener('marion-home-first-control',()=>window.setTimeout(scan,260));
window.addEventListener('storage',scan);
new MutationObserver(()=>scan()).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(scan,5000);
scan();

console.info('[Day 1] reactive social director active');
