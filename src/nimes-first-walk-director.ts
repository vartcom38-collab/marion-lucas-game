import './nimesFirstWalkDirector.css';

type SaveLike={day:number;time:string;place:string;metLucas:boolean;phoneUnread:number;messages:Array<{from:string;text:string,day:number,read:boolean}>;memories?:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let open=false;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function remember(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,40)}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function setMins(s:SaveLike,total:number){total=((total%1440)+1440)%1440;s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}

function eligible(s:SaveLike){return s.day===1&&s.place==='nimes'&&!s.metLucas&&!!s.flags.dayOneSocialSeeded&&!!s.flags.dayOneNimesArrivalShown&&!s.flags.dayOneFirstWalkPlayed&&mins(s.time)>=570&&mins(s.time)<=750}
function marineInviteExists(s:SaveLike){return (s.messages||[]).some(m=>m.from==='Marine'&&/(ar[eè]nes|caf[eé]|viens|rejoins)/i.test(m.text||''))}

function launch(s:SaveLike){
  if(open||!eligible(s))return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  open=true;s.flags.dayOneFirstWalkPlayed=true;write(s);
  const hasMarine=marineInviteExists(s);
  const veil=document.createElement('div');veil.className='nimesFirstWalkVeil';
  veil.innerHTML=`<section class="nimesFirstWalkCard"><span>NÎMES · DEHORS</span><h2>La matinée est lancée.</h2><p>${hasMarine?'Marine est quelque part vers les arènes. Tu peux aller dans sa direction tout de suite, ou laisser la ville te retenir quelques minutes.':'Tu viens de sortir. La ville bouge déjà autour de toi et plusieurs directions s’ouvrent naturellement.'}</p><div class="nimesFirstWalkChoices">${hasMarine?'<button data-nfw="marine"><strong>Aller vers les arènes</strong><small>Retrouver Marine</small></button>':''}<button data-nfw="cafe"><strong>Prendre un café avant</strong><small>Te poser quelques minutes</small></button><button data-nfw="detour"><strong>Faire un petit détour</strong><small>Regarder ce qui se passe autour</small></button></div><button id="nfwClose" class="nfwGhost">Rester libre pour l’instant</button></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('leaving');window.setTimeout(()=>{veil.remove();open=false},240)};
  veil.querySelectorAll<HTMLButtonElement>('[data-nfw]').forEach(b=>b.onclick=()=>{
    const latest=read();if(!latest){close();return}
    const choice=b.dataset.nfw||'detour';latest.flags.dayOneFirstWalkChoice=choice;latest.flags.dayOneFirstWalkAt=latest.time;
    if(choice==='marine'){
      setMins(latest,mins(latest.time)+12);
      latest.flags.dayOneThread='marine_heading_to_meet';
      latest.flags.dayOneSuggestedAction='meetMarine';
      remember(latest,'Tu as pris naturellement la direction des arènes pour retrouver Marine.');
    }
    if(choice==='cafe'){
      setMins(latest,mins(latest.time)+14);
      latest.flags.dayOneSuggestedAction='cafeGo';
      latest.flags.dayOneRendezvousSnoozeUntil=latest.day*1440+mins(latest.time)+15;
      remember(latest,'Tu as choisi de prendre un café avant de poursuivre ta matinée.');
    }
    if(choice==='detour'){
      setMins(latest,mins(latest.time)+11);
      latest.flags.dayOneSuggestedAction='wander';
      latest.flags.dayOneRendezvousSnoozeUntil=latest.day*1440+mins(latest.time)+12;
      remember(latest,'Tu as fait un détour dans Nîmes avant de rejoindre le fil de ta journée.');
    }
    write(latest);close();window.setTimeout(()=>location.reload(),250);
  });
  (veil.querySelector('#nfwClose') as HTMLButtonElement).onclick=()=>{const latest=read();if(latest){latest.flags.dayOneFirstWalkChoice='free';latest.flags.dayOneFirstWalkAt=latest.time;latest.flags.dayOneRendezvousSnoozeUntil=latest.day*1440+mins(latest.time)+10;write(latest)}close()};
}

function scan(){const s=read();if(!s)return;if(eligible(s))window.setTimeout(()=>{const fresh=read();if(fresh&&eligible(fresh))launch(fresh)},1100)}
window.addEventListener('storage',scan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
window.setTimeout(scan,1350);
console.info('[Day 1] first Nimes outing now gives a clear direction while preserving player freedom');
