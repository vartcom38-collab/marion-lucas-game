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

function launch(s:SaveLike){
  if(open||!eligible(s))return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  open=true;s.flags.dayOneFirstWalkPlayed=true;write(s);
  const veil=document.createElement('div');veil.className='nimesFirstWalkVeil';
  veil.innerHTML=`<section class="nimesFirstWalkCard"><span>NÎMES · DEHORS</span><h2>Tu te laisses porter un peu.</h2><p>Une terrasse se remplit, quelqu’un passe trop vite avec un sac de viennoiseries et un scooter coupe la rue au loin. Rien d’important. Juste la ville qui vit autour de toi.</p><div class="nimesFirstWalkChoices"><button data-nfw="walk"><strong>Continuer à marcher</strong><small>Sans but précis</small></button><button data-nfw="cafe"><strong>Prendre un café</strong><small>Te poser deux minutes</small></button><button data-nfw="shops"><strong>Regarder les boutiques</strong><small>Flâner encore</small></button></div><button id="nfwClose" class="nfwGhost">Juste rester là un instant</button></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('leaving');window.setTimeout(()=>{veil.remove();open=false},240)};
  veil.querySelectorAll<HTMLButtonElement>('[data-nfw]').forEach(b=>b.onclick=()=>{
    const latest=read();if(!latest){close();return}
    const choice=b.dataset.nfw||'walk';latest.flags.dayOneFirstWalkChoice=choice;latest.flags.dayOneFirstWalkAt=latest.time;
    if(choice==='walk'){setMins(latest,mins(latest.time)+18);remember(latest,'Tu as marché dans Nîmes sans objectif précis, juste pour sentir la ville autour de toi.');}
    if(choice==='cafe'){setMins(latest,mins(latest.time)+12);latest.flags.dayOneSuggestedAction='cafeGo';remember(latest,'Tu as eu envie de te poser dans un café plutôt que de suivre un itinéraire.');}
    if(choice==='shops'){setMins(latest,mins(latest.time)+15);latest.flags.dayOneSuggestedAction='shop';remember(latest,'Tu as commencé à regarder les vitrines de Nîmes sans chercher quelque chose de précis.');}
    write(latest);close();window.setTimeout(()=>location.reload(),250);
  });
  (veil.querySelector('#nfwClose') as HTMLButtonElement).onclick=()=>{const latest=read();if(latest){latest.flags.dayOneFirstWalkChoice='pause';latest.flags.dayOneFirstWalkAt=latest.time;write(latest)}close()};
}

function scan(){const s=read();if(!s)return;if(eligible(s))window.setTimeout(()=>{const fresh=read();if(fresh&&eligible(fresh))launch(fresh)},900)}
window.addEventListener('storage',scan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});
window.setTimeout(scan,1200);
console.info('[Day 1] first Nimes walk is now a lived micro-scene, not a menu beat');
