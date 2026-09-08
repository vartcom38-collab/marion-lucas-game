import './coupleSleepWakeDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;trust:number;chemistry:number;stress:number;energy:number;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let active=false;
let timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,100)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil,.lucasReunionMoodVeil,.coupleSleepWake,.coupleIntimacyVeil,.coupleIntimacyFade'))}
function sharedPlace(s:SaveLike){return['finca','estate','madrid','family'].includes(s.place)}
function eligible(s:SaveLike){return s.metLucas&&s.official&&s.screen==='game'&&sharedPlace(s)&&!document.hidden&&!blocked()}

function nightCopy(s:SaveLike){
  const close=Number(s.relationship||0)>=62;
  const after=String(s.flags.lucasReunionTone||'');
  const intimateTonight=Number(s.flags.coupleMadeLoveDay||0)===s.day;
  if(intimateTonight)return['PLUS TARD','La nuit a changé de rythme.','Après ce moment gardé hors champ, vous restez encore un peu réveillés dans le calme, plus proches et beaucoup moins pressés de retrouver le reste du monde.'];
  if(after==='fatigue')return['PLUS TARD','La maison s’est enfin tue.','Lucas s’endort plus vite que d’habitude. Tu sens encore la fatigue de sa journée dans sa façon de relâcher enfin les épaules.'];
  if(after==='charged'&&Number(s.chemistry||0)>=45)return['TARD DANS LA NUIT','Vous ne parlez presque plus.','Il reste juste cette proximité tranquille, un peu trop consciente d’elle-même, jusqu’à ce que le sommeil gagne.'];
  if(close)return['AVANT DE DORMIR','La journée se termine sans scène particulière.','Vous vous rapprochez presque par habitude. C’est devenu simple, et c’est peut-être ça qui touche le plus.'];
  return['LA NUIT','La maison ralentit complètement.','Chacun trouve sa place, encore un peu attentif à la présence de l’autre dans le silence.'];
}

function morningCopy(s:SaveLike){
  const early=s.day%3===1;
  const close=Number(s.relationship||0)>=60;
  const intimateYesterday=Number(s.flags.coupleMadeLoveDay||0)===s.day-1;
  if(intimateYesterday&&early)return['AU RÉVEIL','Le côté de Lucas est déjà vide.','Il est parti tôt, mais cette fois son absence paraît différente. La nuit précédente flotte encore dans la pièce, jusque dans le petit mot laissé près de ta tasse.'];
  if(intimateYesterday)return['LE MATIN D’APRÈS','La lumière arrive doucement.','Lucas est encore là. Son regard rencontre le tien avec cette douceur un peu embarrassante et très intime des choses qu’on n’a pas besoin de raconter.'];
  if(early)return close
    ?['AU RÉVEIL','Le côté de Lucas est déjà vide.','Il est parti tôt. Sur la table, il a laissé sa tasse près de la tienne et un bref « à plus tard » griffonné sur un papier.']
    :['AU RÉVEIL','Lucas est déjà parti.','La maison est silencieuse. Son départ a eu lieu avant que tu ouvres les yeux.'];
  if(close)return['LE MATIN','Tu te réveilles avant que la journée commence vraiment.','Lucas est encore là, les traits plus doux que lorsqu’il est happé par le reste du monde.'];
  return['LE MATIN','La lumière entre doucement.','Vous émergez chacun à votre rythme, dans ce calme étrange des débuts où rien n’est encore tout à fait une habitude.'];
}

function show(s:SaveLike,kind:'night'|'morning'){
  if(active||!eligible(s))return;
  const key=`couple_${kind}_${s.day}`;if(Boolean(s.flags[key]))return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;
  const [kicker,title,body]=kind==='night'?nightCopy(s):morningCopy(s);
  const card=document.createElement('aside');card.id='coupleSleepWake';card.className=`coupleSleepWake ${kind}`;
  card.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(card);
  s.flags[key]=true;
  if(kind==='night'){
    s.flags.lastNightShared=true;
    if(Number(s.flags.coupleMadeLoveDay||0)===s.day)s.flags.lastNightIntimate=true;
    addMemory(s,Number(s.flags.coupleMadeLoveDay||0)===s.day?'Après votre moment intime, la nuit s’est terminée dans une proximité calme et assumée.':'La fin de journée avec Lucas s’est installée dans une intimité calme, sans avoir besoin d’être spectaculaire.');
  }else{
    s.flags.lastWakeTogether=s.day%3!==1;
    if(Number(s.flags.coupleMadeLoveDay||0)===s.day-1)s.flags.lastWakeAfterIntimacy=true;
    addMemory(s,Number(s.flags.coupleMadeLoveDay||0)===s.day-1?'Le matin après votre nuit intime a eu une douceur différente du reste.':s.day%3===1?'Tu t’es réveillée après le départ matinal de Lucas.':'Le matin avec Lucas a commencé dans un calme de plus en plus familier.');
  }
  write(s);
  window.setTimeout(()=>card.classList.add('is-leaving'),6500);
  window.setTimeout(()=>{card.remove();active=false},8200);
}

function arm(){
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;return}
  const t=mins(s.time);
  let kind:'night'|'morning'|null=null;
  if(t>=1290||t<120)kind='night';
  else if(t>=390&&t<540)kind='morning';
  if(!kind)return;
  if(Boolean(s.flags[`couple_${kind}_${s.day}`])||active||timer)return;
  timer=window.setTimeout(()=>{timer=0;const fresh=read();if(fresh)show(fresh,kind as 'night'|'morning')},5000+((s.day*71+t)%5000));
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,7000);
arm();

console.info('[Romance] shared night + wake rhythm active');
