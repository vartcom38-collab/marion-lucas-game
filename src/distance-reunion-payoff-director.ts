import './distanceReunionPayoffDirector.css';

type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,240)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasDepartureReturn,.lucasReunionMoodVeil,.postEventReunion,.distanceReunionPayoff'))}
function sharedPlace(s:SaveLike){return['finca','estate','madrid','family'].includes(s.place)}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!sharedPlace(s)||Boolean(s.flags.lucasAway)||Boolean(s.flags.corridaLive))return false;
  if(!Boolean(s.flags[`lucas_return_${s.day}`]))return false;
  const hadDistance=Number(s.flags.coupleDistanceLongingDay||0)===s.day||Number(s.flags.coupleDistanceContactDay||0)===s.day;
  if(!hadDistance)return false;
  if(Number(s.flags.distanceReunionPayoffDay||0)===s.day)return false;
  const returned=Number(s.flags.lucasReturnMinute||0);if(!returned||mins(s.time)<returned)return false;
  return Number(s.relationship||0)>=50;
}

function sceneFor(s:SaveLike){
  const contact=Number(s.flags.coupleDistanceContactDay||0)===s.day;
  const longing=Number(s.flags.coupleDistanceLongingDay||0)===s.day;
  const charged=String(s.flags.coupleDistanceContactTone||'')==='charged'||String(s.flags.coupleDistanceLongingTone||'')==='charged';
  const close=Number(s.relationship||0)>=68;
  const tired=Boolean(s.flags.lucasWorkedLong)||Boolean(s.flags.lucasLateReturn);
  if(charged&&close)return{tone:'charged',k:'ENFIN LÀ',t:'Le manque disparaît d’un coup.',b:'Il pose à peine ses affaires. Vos regards se croisent et toute la distance de la journée revient une dernière fois — mais cette fois, vous êtes dans la même pièce.'};
  if(tired&&longing)return{tone:'tired',k:'IL EST RENTRÉ',t:'Tu avais senti son absence toute la journée.',b:'Il est fatigué, pas très bavard. Tu n’as pas besoin de lui demander grand-chose : le simple fait qu’il soit revenu change déjà l’atmosphère.'};
  if(contact&&close)return{tone:'warm',k:'APRÈS LES MESSAGES',t:'Le téléphone n’a plus besoin de faire le lien.',b:'Quelques heures plus tôt, il était juste une phrase sur ton écran. Maintenant Lucas est là, devant toi, avec ce petit sourire qui dit qu’il avait envie de rentrer aussi.'};
  if(longing)return{tone:'quiet',k:'LE RETOUR',t:'La place vide ne l’est plus.',b:'Rien de spectaculaire. Tu continues presque ce que tu faisais, sauf que ton corps s’est déjà détendu avant même que tu t’en rendes compte.'};
  return{tone:'simple',k:'DE NOUVEAU ENSEMBLE',t:'La distance retombe.',b:'La journée reprend une forme plus familière dès qu’il revient. Pas besoin d’en faire un événement : votre rythme se remet simplement à deux.'};
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);
  s.flags.distanceReunionPayoffDay=s.day;s.flags.distanceReunionPayoffTone=e.tone;s.flags.distanceReunionPayoffAt=mins(s.time);
  if(e.tone==='warm'||e.tone==='quiet')s.trust=Number(s.trust||0)+1;
  if(e.tone==='charged')s.chemistry=Number(s.chemistry||0)+1;
  s.stress=Math.max(0,Number(s.stress||0)-1);
  addMemory(s,'Une journée à distance a eu un vrai point d’arrivée quand vous vous êtes retrouvés.');write(s);
  const card=document.createElement('aside');card.id='distanceReunionPayoff';card.className=`distanceReunionPayoff ${e.tone}`;card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small>`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),6200);setTimeout(()=>{card.remove();active=false},7900);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},9000+((s.day*53+mins(s.time))%7000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,15000);arm();
console.info('[Romance] distance reunion payoff active after real returns');
