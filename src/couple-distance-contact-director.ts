import './coupleDistanceContactDirector.css';

type Msg={from:string;text:string,day:number,read:boolean};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;phoneUnread:number;messages:Msg[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,230)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.coupleDistanceContact'))}
function apart(s:SaveLike){return Boolean(s.flags.lucasAway)||Boolean(s.flags.lucasBusy)&&!['finca','estate','madrid','family'].includes(s.place)}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!apart(s)||Boolean(s.flags.corridaLive))return false;
  if(Number(s.relationship||0)<50)return false;
  if(Number(s.flags.coupleDistanceContactDay||0)===s.day)return false;
  const last=Number(s.flags.coupleDistanceContactLastDay||0);if(last&&s.day-last<2)return false;
  const t=mins(s.time);return t>=690&&t<=1320;
}

function sceneFor(s:SaveLike){
  const longingToday=Number(s.flags.coupleDistanceLongingDay||0)===s.day;
  const recentIntimacy=Number(s.flags.coupleMadeLoveDay||0)>=s.day-2;
  const close=Number(s.relationship||0)>=68;
  const trust=Number(s.trust||0)>=56;
  const k=(s.day*47+Math.round(s.relationship||0)+Math.round(s.trust||0))%5;
  if(recentIntimacy&&k%2===0)return{tone:'charged',text:'Tu me manques un peu trop aujourd’hui.',k:'LUCAS',t:'Un message arrive au mauvais moment.',b:'Tu lis la phrase une fois. Puis une deuxième. Ce n’est pas très long, mais ça suffit largement.'};
  if(longingToday&&close)return{tone:'warm',text:'J’ai pensé à toi entre deux trucs. Ça m’a saoulé de pas pouvoir te voir 😭',k:'LUCAS',t:'Il apparaît dans ta journée sans prévenir.',b:'Pas un grand discours. Juste assez pour que l’absence paraisse tout de suite moins vide.'};
  if(trust&&k===1)return{tone:'quiet',text:'Tout va bien ici. Je te raconte après. Toi ça va ?',k:'LUCAS',t:'Il ne disparaît pas dans son rythme.',b:'Le message est banal, presque domestique. C’est précisément pour ça qu’il te fait sourire.'};
  if(k===2)return{tone:'photo',text:'Je viens de voir un truc qui t’aurait fait rire.',k:'LUCAS',t:'Il pense à toi au milieu de sa propre journée.',b:'Il n’y a même pas besoin de contexte. Tu reconnais immédiatement ce petit réflexe de partager avec toi quelque chose de parfaitement inutile.'};
  return{tone:'simple',text:'Tu fais quoi ?',k:'LUCAS',t:'Trois mots suffisent.',b:'Il ne te demande pas de mettre ta journée en pause. Il ouvre juste une petite porte dedans.'};
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);
  s.messages=Array.isArray(s.messages)?s.messages:[];s.messages.unshift({from:'Lucas',text:e.text,day:s.day,read:false});
  s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;
  s.flags.phoneToast=`Lucas|${e.text}`;s.flags.phoneToastAt=stamp(s);
  s.flags.coupleDistanceContactDay=s.day;s.flags.coupleDistanceContactLastDay=s.day;s.flags.coupleDistanceContactTone=e.tone;
  if(e.tone==='quiet'||e.tone==='warm')s.trust=Number(s.trust||0)+1;
  if(e.tone==='charged')s.chemistry=Number(s.chemistry||0)+1;
  addMemory(s,'Même loin, Lucas a trouvé une petite façon d’entrer dans ta journée sans interrompre la tienne.');write(s);
  const card=document.createElement('aside');card.id='coupleDistanceContact';card.className=`coupleDistanceContact ${e.tone}`;
  card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small><em>${e.text}</em>`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),6200);setTimeout(()=>{card.remove();active=false},7900);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},21000+((s.day*61+mins(s.time))%11000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,18000);arm();
console.info('[Romance] distance contact active: Lucas can stay present without interrupting Marion’s life');
