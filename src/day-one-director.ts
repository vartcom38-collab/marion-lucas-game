import './dayOneDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;introSeen:boolean;metLucas:boolean;
  phoneUnread:number;messages:Array<{from:string;text:string,day:number,read:boolean}>;
  calendar:Array<{owner:'Marion'|'Lucas'|'Nous';title:string;day:number,note:string}>;
  memories?:string[];
  flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
const RELOAD_GUARD='marion-day-one-seed-reload-v1';
let escalationOpen=false;
let rendezvousOpen=false;
let nimesArrivalTimer=0;

function read():SaveLike|null{
  try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}
}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function setMins(s:SaveLike,total:number){total=((total%1440)+1440)%1440;s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function nowStamp(s:SaveLike){return s.day*1440+mins(s.time)}
function remember(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,40)}

function seedDayOne(s:SaveLike){
  if(s.flags.dayOneSocialSeeded)return false;
  s.flags.dayOneSocialSeeded=true;
  s.flags.dayOneThread='marine_invite';
  s.messages.unshift({from:'Marine',text:'Tu vas pas passer ta matinée enfermée 😭 Allez viens. Je suis vers les arènes. On prend un café ?',day:1,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;
  if(!s.calendar.some(i=>i.day===1&&i.title==='Retrouver Marine près des arènes')){
    s.calendar.push({owner:'Marion',title:'Retrouver Marine près des arènes',day:1,note:'Elle t’a écrit ce matin. La ville commence déjà à bouger.'});
  }
  s.flags.phoneToast='Marine|Je suis vers les arènes ☕';
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
function removeCompanion(){document.getElementById('dayOneCompanion')?.remove()}
function removeNimesArrival(){document.getElementById('dayOneNimesArrival')?.remove()}

function mountImpulse(s:SaveLike){
  if(s.day!==1||s.metLucas||s.place!=='home'||!s.flags.dayOneSocialSeeded||mins(s.time)<550){removeImpulse();return}
  const game=document.querySelector<HTMLElement>('main.game.immersivePlayable');
  if(!game)return;
  let card=document.getElementById('dayOneImpulse') as HTMLButtonElement|null;
  if(!card){card=document.createElement('button');card.id='dayOneImpulse';card.className='dayOneImpulse';game.appendChild(card)}
  const late=mins(s.time)>=600;
  card.innerHTML=late
    ?'<span>MARINE EST EN VILLE</span><strong>Son café tient toujours.</strong><small>Voir où elle est →</small>'
    :'<span>UN MESSAGE T’ATTEND</span><strong>Marine te propose un café près des arènes.</strong><small>Regarder quand tu veux →</small>';
  card.onclick=()=>{const target=document.getElementById(late?'premiumMap':'premiumPhone') as HTMLButtonElement|null;target?.click()};
  const objective=document.querySelector<HTMLElement>('.approvedObjective');
  if(objective&&mins(s.time)>=565){
    const strong=objective.querySelector('strong'),p=objective.querySelector('p');
    if(strong)strong.textContent=late?'Marine est déjà dehors':'La matinée reste à toi';
    if(p)p.textContent=late?'Tu peux la rejoindre, ou finir ce que tu fais avant de sortir.':'Un message t’attend, mais rien ne presse. Tu peux encore profiter de l’appartement.';
  }
}

function mountNimesArrival(s:SaveLike){
  if(s.day!==1||s.metLucas||s.place!=='nimes'||!s.flags.dayOneSocialSeeded){removeNimesArrival();return}
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  const existing=document.getElementById('dayOneNimesArrival');
  if(existing)return;
  if(s.flags.dayOneNimesArrivalShown)return;
  s.flags.dayOneNimesArrivalShown=true;
  s.flags.dayOneNimesArrivalAt=Date.now();
  write(s);
  game.classList.add('dayOneFirstNimes');
  const card=document.createElement('aside');
  card.id='dayOneNimesArrival';card.className='dayOneNimesArrival';
  card.innerHTML='<span>NÎMES · PREMIERS PAS</span><strong>La ville est déjà en mouvement.</strong><small>Tu peux regarder autour de toi avant de décider quoi que ce soit.</small>';
  game.appendChild(card);
  if(nimesArrivalTimer)window.clearTimeout(nimesArrivalTimer);
  nimesArrivalTimer=window.setTimeout(()=>{
    card.classList.add('leaving');
    game.classList.remove('dayOneFirstNimes');
    window.setTimeout(()=>card.remove(),320);
  },4200);
}

function showEscalation(s:SaveLike){
  if(escalationOpen||s.flags.dayOneMarineCallSeen||s.day!==1||s.place!=='home'||s.metLucas||mins(s.time)<660)return;
  const game=document.querySelector<HTMLElement>('main.game.immersivePlayable');if(!game)return;
  escalationOpen=true;s.flags.dayOneMarineCallSeen=true;
  s.messages.unshift({from:'Marine',text:'Bon 😭 je suis pas loin. Descends quand tu veux, je t’embarque.',day:1,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;write(s);
  const veil=document.createElement('div');veil.className='dayOneCallVeil';
  veil.innerHTML=`<section class="dayOneCallCard"><span>APPEL · MARINE</span><h2>« Alors, tu viens ? »</h2><p>Elle est dehors, de bonne humeur, sans te mettre la pression. La ville bouge déjà et tu sens que rester enfermée toute la matinée serait dommage.</p><div><button id="dayOneGo" class="primary">Oui, j’arrive</button><button id="dayOneLater">Je finis un truc</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.remove();escalationOpen=false};
  (veil.querySelector('#dayOneLater') as HTMLButtonElement).onclick=close;
  (veil.querySelector('#dayOneGo') as HTMLButtonElement).onclick=()=>{
    const latest=read();if(!latest){close();return}
    latest.flags.dayOneThread='marine_on_the_way';latest.flags.dayOneLeftWithMarine=true;
    latest.flags.arrivalPlace='nimes';latest.flags.arrivalFrom='home';latest.flags.arrivalMinutes=15;latest.place='nimes';
    setMins(latest,mins(latest.time)+15);remember(latest,'Marine t’a sortie de chez toi presque sans te laisser le temps de réfléchir.');
    write(latest);close();location.reload();
  };
}

function mountCompanion(s:SaveLike){
  if(s.day!==1||s.metLucas||s.place==='home'||!s.flags.dayOneSocialSeeded){removeCompanion();return}
  const arrivalAt=Number(s.flags.dayOneNimesArrivalAt||0);
  if(s.place==='nimes'&&arrivalAt&&Date.now()-arrivalAt<6500){removeCompanion();return}
  if(Number(s.flags.dayOneRendezvousSnoozeUntil||0)>nowStamp(s)){removeCompanion();return}
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  let card=document.getElementById('dayOneCompanion') as HTMLButtonElement|null;
  if(!card){card=document.createElement('button');card.id='dayOneCompanion';card.className='dayOneCompanion';game.appendChild(card)}
  const together=!!s.flags.dayOneWithMarine;
  card.innerHTML=together
    ?'<span>AVEC MARINE</span><strong>Elle marche à côté de toi, café à la main.</strong><small>La conversation continue sans que tu aies besoin de la provoquer.</small>'
    :'<span>MARINE · À DEUX PAS</span><strong>Elle vient de te faire signe entre deux passants.</strong><small>La rejoindre →</small>';
  card.onclick=()=>{if(!together)showRendezvous(s)};
}

function showRendezvous(s:SaveLike){
  if(rendezvousOpen||s.day!==1||s.metLucas||s.place==='home')return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  rendezvousOpen=true;
  const veil=document.createElement('div');veil.className='dayOneCallVeil dayOneMeetVeil';
  veil.innerHTML=`<section class="dayOneCallCard dayOneMeetCard"><span>NÎMES · AVEC MARINE</span><h2>Tu la retrouves naturellement.</h2><p>Marine arrive avec son énergie habituelle, te raconte trois choses à la fois et la ville reprend simplement autour de vous.</p><div><button id="dayOneMeet" class="primary">Marcher avec elle</button><button id="dayOneWander">Flâner encore un peu</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.remove();rendezvousOpen=false};
  (veil.querySelector('#dayOneWander') as HTMLButtonElement).onclick=()=>{const latest=read();if(latest){latest.flags.dayOneRendezvousSnoozeUntil=nowStamp(latest)+25;write(latest)}close()};
  (veil.querySelector('#dayOneMeet') as HTMLButtonElement).onclick=()=>{
    const latest=read();if(!latest){close();return}
    latest.flags.dayOneWithMarine=true;latest.flags.dayOneThread='marine_together';
    const target=Math.max(mins(latest.time)+35,660);setMins(latest,target);
    remember(latest,'Tu as retrouvé Marine dans Nîmes. Pendant un moment, la journée ressemblait encore à une journée ordinaire.');
    write(latest);close();location.reload();
  };
}

function scan(){
  syncFreshGame();const s=read();if(!s)return;
  mountImpulse(s);mountNimesArrival(s);showEscalation(s);mountCompanion(s);
  if(s.day!==1||s.metLucas||s.place!=='home')removeImpulse();
  if(s.day!==1||s.metLucas||s.place==='home')removeCompanion();
  if(s.day!==1||s.metLucas||s.place!=='nimes')removeNimesArrival();
}

window.addEventListener('marion-home-first-control',()=>window.setTimeout(scan,260));
window.addEventListener('storage',scan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
window.setInterval(scan,4500);
scan();

console.info('[Day 1] reactive social director active with calmer home and first Nimes breathing room');
