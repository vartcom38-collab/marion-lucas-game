import './domesticCoexistenceDirector.css';

type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;energy:number;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function fmt(total:number){total=((total%1440)+1440)%1440;return`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,250)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.domesticCoexistence'))}
function homeLike(s:SaveLike){return['finca','estate','madrid'].includes(s.place)}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!homeLike(s)||Boolean(s.flags.lucasAway)||Boolean(s.flags.corridaLive)||Boolean(s.flags.lucasRoutineBusy))return false;
  if(Number(s.relationship||0)<58||Number(s.trust||0)<44)return false;
  if(Number(s.flags.domesticCoexistenceDay||0)===s.day)return false;
  const last=Number(s.flags.domesticCoexistenceLastDay||0);if(last&&s.day-last<3)return false;
  const t=mins(s.time);return t>=660&&t<=1290;
}

function sceneFor(s:SaveLike){
  const close=Number(s.relationship||0)>=70;
  const k=(s.day*29+Math.round(s.relationship||0)+Math.round(s.trust||0))%5;
  if(k===0)return{tone:'mess',k:'UN PETIT BAZAR À DEUX',t:'La maison commence à montrer que vous y vivez vraiment.',b:'Une veste de Lucas traîne, tes affaires occupent un coin qui n’était pas à toi au début. Ce n’est pas très rangé, mais c’est étrangement rassurant.',a:'Ranger ensemble deux minutes',c:'Laisser comme ça',kind:'mess'};
  if(k===1)return{tone:'food',k:'QU’EST-CE QU’ON MANGE ?',t:'Une question parfaitement banale devient votre problème commun.',b:'Lucas ouvre un placard, le referme, regarde dans le frigo et te lance ce regard qui signifie clairement qu’il n’a aucune idée non plus.',a:'Improviser quelque chose ensemble',c:'Faire simple chacun de son côté',kind:'food'};
  if(k===2)return{tone:'space',k:'VIVRE DANS LE MÊME ESPACE',t:'Vous n’avez pas toujours besoin d’être ensemble pour être ensemble.',b:close?'Tu fais ton truc d’un côté, Lucas le sien de l’autre. De temps en temps l’un traverse la pièce, touche l’épaule de l’autre, puis repart. La proximité n’a plus besoin d’occuper toute l’attention.':'Vous commencez à trouver une manière de partager le même lieu sans remplir chaque silence.',a:'Rester chacun dans son rythme',c:'Le rejoindre un moment',kind:'space'};
  if(k===3)return{tone:'chores',k:'LES TRUCS PAS ROMANTIQUES',t:'Il y a aussi le linge, les verres, les petites choses à faire.',b:'Lucas prend quelque chose à ranger sans en parler. Tu fais pareil avec autre chose. Rien d’excitant, sauf peut-être cette impression bizarrement douce de fonctionner en équipe.',a:'L’aider et finir vite',c:'Le taquiner au passage',kind:'chores'};
  return{tone:'habit',k:'CHEZ VOUS, PRESQUE SANS LE DIRE',t:'Vos gestes commencent à se mélanger au décor.',b:'Tu sais où il pose ses clés. Il sait quel verre tu prends presque toujours. Ce ne sont pas de grandes preuves d’amour, juste les traces d’une vie qui commence à s’emboîter.',a:'Profiter de ce calme',c:'Aller vers lui',kind:'habit'};
}

function resolve(s:SaveLike,choice:'a'|'c',kind:string){
  s.flags.domesticCoexistenceDay=s.day;s.flags.domesticCoexistenceLastDay=s.day;s.flags.domesticCoexistenceKind=kind;s.flags.domesticCoexistenceChoice=choice;
  if(choice==='a'){
    const duration=kind==='food'?28:kind==='mess'||kind==='chores'?16:18;
    s.time=fmt(mins(s.time)+duration);s.stress=Math.max(0,Number(s.stress||0)-2);s.trust=Number(s.trust||0)+1;
    if(kind==='food'||kind==='habit')s.relationship=Number(s.relationship||0)+1;
  }else{
    if(kind==='chores'||kind==='habit'||kind==='space')s.chemistry=Number(s.chemistry||0)+(kind==='chores'?1:0);
    s.stress=Math.max(0,Number(s.stress||0)-1);
  }
  addMemory(s,'Votre quotidien à deux a commencé à exister aussi dans les choses banales, pas seulement dans les grands moments.');write(s);
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);const veil=document.createElement('div');veil.id='domesticCoexistence';veil.className=`domesticCoexistence ${e.tone}`;
  veil.innerHTML=`<section><span>${e.k}</span><h2>${e.t}</h2><p>${e.b}</p><div><button id="domesticA" class="primary">${e.a}</button><button id="domesticC">${e.c}</button></div></section>`;game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');setTimeout(()=>{veil.remove();active=false},260)};
  (veil.querySelector('#domesticA') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,'a',e.kind);close();setTimeout(()=>location.reload(),280)};
  (veil.querySelector('#domesticC') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,'c',e.kind);close();setTimeout(()=>location.reload(),280)};
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},20000+((s.day*97+mins(s.time))%10000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,18000);arm();
console.info('[Romance] domestic coexistence active: ordinary shared life now has its own texture');
