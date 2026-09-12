import './dayOneDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;introSeen:boolean;metLucas:boolean;
  phoneUnread:number;messages:Array<{from:string;text:string,day:number,read:boolean}>;
  calendar:Array<{owner:'Marion'|'Lucas'|'Nous';title:string;day:number,note:string}>;
  memories?:string[];
  flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
const RELOAD_GUARD='marion-day-one-seed-reload-v2';
let escalationOpen=false;
let rendezvousOpen=false;
let companionMomentOpen=false;
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
  const invite='Tu vas pas passer ta matinée enfermée 😭 Allez viens. Je suis vers les arènes. On prend un café ?';
  const existing=s.messages.some(m=>m.from==='Marine'&&(/vers les arènes.*café/i.test(m.text)||m.text===invite));
  let changed=false;
  if(!s.flags.dayOneSocialSeeded){s.flags.dayOneSocialSeeded=true;changed=true}
  if(!s.flags.dayOneThread){s.flags.dayOneThread='marine_invite';changed=true}
  if(!existing){s.messages.unshift({from:'Marine',text:invite,day:1,read:false});s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;changed=true}
  if(!s.calendar.some(i=>i.day===1&&i.title==='Retrouver Marine près des arènes')){
    s.calendar.push({owner:'Marion',title:'Retrouver Marine près des arènes',day:1,note:'Elle t’a écrit ce matin. Tu peux la rejoindre quand tu veux.'});changed=true
  }
  if(!s.flags.phoneToast){s.flags.phoneToast='Marine|Je suis vers les arènes ☕';s.flags.phoneToastAt=nowStamp(s);changed=true}
  if(changed)write(s);
  return changed;
}

function refreshAfterSeed(){
  try{
    if(sessionStorage.getItem(RELOAD_GUARD)==='1')return;
    sessionStorage.setItem(RELOAD_GUARD,'1');
    window.setTimeout(()=>location.reload(),40);
  }catch{}
}

function syncFreshGame(){
  const game=document.querySelector('main.game.immersivePlayable');
  if(!game)return;
  const s=read();
  if(!s||s.day!==1||!s.introSeen||s.metLucas||s.place!=='home')return;
  const changed=seedDayOne(s);
  if(changed||s.flags.dayOneSocialSeeded)refreshAfterSeed();
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
  card.innerHTML='<span>NÎMES · PREMIERS PAS</span><strong>La ville est déjà en mouvement.</strong><small>Marine est dans le secteur. Tu peux la rejoindre ou regarder un peu autour de toi.</small>';
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

const marineWalkMoments=[
  {line:'Marine ralentit juste assez pour te montrer une vitrine du menton.',quote:'« Celle-là, elle est tellement toi. Enfin… peut-être pas à neuf heures du matin. »',a:'La taquiner',b:'Regarder la vitrine'},
  {line:'Elle reprend son histoire exactement là où elle l’avait laissée, sans vérifier si tu suivais.',quote:'« Et donc là, je lui ai dit : mais t’es sérieux ? »',a:'Laisser Marine raconter',b:'Lui demander la suite'},
  {line:'Vous vous décalez toutes les deux pour laisser passer un groupe sur le trottoir.',quote:'« J’adore quand la ville commence comme ça. On sait jamais où on va finir. »',a:'Continuer avec elle',b:'Prendre votre temps'},
  {line:'Marine te tend son café deux secondes pendant qu’elle fouille dans son sac.',quote:'« Tiens. Et bois pas tout, je te connais. »',a:'Boire une gorgée quand même',b:'Faire semblant d’être sage'}
];

function showCompanionMoment(s:SaveLike){
  if(companionMomentOpen||!s.flags.dayOneWithMarine||s.metLucas||s.place==='home')return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  companionMomentOpen=true;
  const count=Number(s.flags.dayOneMarineMomentCount||0);
  const m=marineWalkMoments[count%marineWalkMoments.length];
  const veil=document.createElement('div');veil.className='dayOneCompanionMomentVeil';
  veil.innerHTML=`<section class="dayOneCompanionMoment"><span>EN MARCHANT · MARINE</span><p>${m.line}</p><blockquote>${m.quote}</blockquote><div><button data-marine-moment="a">${m.a}</button><button data-marine-moment="b">${m.b}</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('leaving');window.setTimeout(()=>{veil.remove();companionMomentOpen=false},220)};
  veil.querySelectorAll<HTMLButtonElement>('[data-marine-moment]').forEach(btn=>btn.onclick=()=>{
    const latest=read();if(!latest){close();return}
    latest.flags.dayOneMarineMomentCount=Number(latest.flags.dayOneMarineMomentCount||0)+1;
    latest.flags.dayOneMarineLastMomentAt=nowStamp(latest);
    latest.flags.dayOneMarineLastTone=btn.dataset.marineMoment||'a';
    setMins(latest,mins(latest.time)+(btn.dataset.marineMoment==='a'?9:11));
    if(count===0)remember(latest,'Avec Marine, la première promenade dans Nîmes a pris le rythme d’une vraie matinée entre amies.');
    write(latest);close();window.setTimeout(()=>location.reload(),240);
  });
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
  if(together){
    const count=Number(s.flags.dayOneMarineMomentCount||0);
    const snippets=['Elle parle, regarde les vitrines et se décale avec toi dans la foule.','La conversation saute d’un sujet à l’autre sans jamais vraiment s’arrêter.','Vous marchez au même rythme sans avoir décidé d’un itinéraire.','Elle te repasse son café comme si c’était parfaitement normal.'];
    card.innerHTML=`<span>AVEC MARINE</span><strong>${snippets[count%snippets.length]}</strong><small>Un moment avec elle →</small>`;
    card.onclick=()=>showCompanionMoment(s);
  }else{
    card.innerHTML='<span>MARINE · À DEUX PAS</span><strong>Elle vient de te faire signe entre deux passants.</strong><small>La rejoindre →</small>';
    card.onclick=()=>showRendezvous(s);
  }
}

function showRendezvous(s:SaveLike){
  if(rendezvousOpen||s.day!==1||s.metLucas||s.place==='home')return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  rendezvousOpen=true;
  const veil=document.createElement('div');veil.className='dayOneCallVeil dayOneMeetVeil';
  veil.innerHTML=`<section class="dayOneCallCard dayOneMeetCard"><span>NÎMES · AVEC MARINE</span><h2>Tu la retrouves naturellement.</h2><p>Vous prenez le café promis, marchez un moment et la conversation s’étire sans que tu regardes l’heure. La matinée avance parce que vous la vivez, pas parce que le jeu attend.</p><div><button id="dayOneMeet" class="primary">Continuer avec elle</button><button id="dayOneWander">Flâner encore un peu</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.remove();rendezvousOpen=false};
  (veil.querySelector('#dayOneWander') as HTMLButtonElement).onclick=()=>{const latest=read();if(latest){latest.flags.dayOneRendezvousSnoozeUntil=nowStamp(latest)+25;write(latest)}close()};
  (veil.querySelector('#dayOneMeet') as HTMLButtonElement).onclick=()=>{
    const latest=read();if(!latest){close();return}
    latest.flags.dayOneWithMarine=true;latest.flags.dayOneThread='marine_together';
    const target=Math.max(mins(latest.time)+70,650);setMins(latest,target);
    remember(latest,'Tu as retrouvé Marine dans Nîmes. Un café et une longue marche ont fait avancer la matinée naturellement.');
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
window.addEventListener('monia:phone-message-seeded',()=>{scan();refreshAfterSeed()});
window.addEventListener('storage',scan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
window.setInterval(scan,4500);
scan();

console.info('[Day 1] Marine now anchors a continuous morning instead of a hidden time gate');
