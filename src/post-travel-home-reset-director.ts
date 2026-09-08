import './postTravelHomeResetDirector.css';

type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;energy:number;calendar:CalendarItem[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,240)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.distanceReunionPayoff,.postTravelHomeReset'))}
function homeLike(s:SaveLike){return['finca','estate','madrid'].includes(s.place)}
function isTravel(item:CalendarItem){const x=`${item.title||''} ${item.note||''}`.toLowerCase();return /(voyage|déplac|deplac|train|avion|vol|gare|aéroport|aeroport|route|hôtel|hotel)/.test(x)}
function recentTravel(s:SaveLike){
  const items=Array.isArray(s.calendar)?s.calendar:[];
  return items.some(i=>(i.owner==='Lucas'||i.owner==='Nous')&&(i.day===s.day||i.day===s.day-1)&&isTravel(i))||Boolean(s.flags[`travelLucas_${s.day}_arrive`])||Boolean(s.flags[`travelLucas_${s.day-1}_arrive`]);
}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!homeLike(s)||Boolean(s.flags.lucasAway)||Boolean(s.flags.corridaLive))return false;
  if(!recentTravel(s))return false;
  if(Number(s.flags.postTravelHomeResetDay||0)===s.day)return false;
  const t=mins(s.time);return t>=540&&t<=1320;
}

function sceneFor(s:SaveLike){
  const close=Number(s.relationship||0)>=66;
  const tired=Boolean(s.flags.lucasWorkedLong)||Number(s.energy||0)<45;
  const recentIntimacy=Number(s.flags.coupleMadeLoveDay||0)>=s.day-1;
  const k=(s.day*53+Math.round(s.relationship||0)+Math.round(s.trust||0))%5;
  if(tired)return{tone:'tired',k:'REVENIR CHEZ SOI',t:'Les sacs peuvent attendre.',b:'Vous posez les affaires sans vraiment les ranger. Lucas s’assoit une minute, tu fais pareil. Après les horaires et le mouvement, le luxe tient surtout dans le fait de ne plus avoir à repartir.'};
  if(recentIntimacy&&close)return{tone:'intimate',k:'DE RETOUR',t:'Le lieu familier paraît presque différent.',b:'Après une chambre, une route ou des horaires qui n’étaient pas les vôtres, retrouver vos affaires et vos petits gestes habituels rend l’intimité encore plus simple. Vous n’avez plus besoin de créer une parenthèse : elle est déjà là.'};
  if(k===0)return{tone:'bags',k:'LES SACS RESTENT OUVERTS',t:'Le voyage se termine vraiment maintenant.',b:'Une veste sur une chaise, un chargeur remis à sa place, deux trucs sortis d’un sac. Rien de cinématographique — juste cette manière très concrète de redevenir chez vous.'};
  if(k===1)return{tone:'shower',k:'APRÈS LA ROUTE',t:'Chacun reprend ses repères.',b:'Une douche, des vêtements plus confortables, quelque chose à boire. Vous vous croisez dans la pièce avec ce soulagement discret de ne plus être en transit.'};
  if(k===2&&close)return{tone:'quiet',k:'PLUS BESOIN D’ORGANISER',t:'Vous laissez la soirée se remettre en place toute seule.',b:'Lucas pose son téléphone plus loin. Tu t’installes sans demander où. Après le déplacement, le plus intime n’est pas forcément de faire quelque chose ensemble : c’est de retrouver vos automatismes.'};
  return{tone:'ordinary',k:'LE RETOUR À L’ORDINAIRE',t:'Et c’est presque le meilleur moment.',b:'Les horaires cessent d’exister, les sacs se vident lentement, la maison reprend son bruit habituel. Le voyage devient déjà un souvenir pendant que votre quotidien reprend sa place.'};
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);
  s.flags.postTravelHomeResetDay=s.day;s.flags.postTravelHomeResetTone=e.tone;
  s.stress=Math.max(0,Number(s.stress||0)-2);
  if(e.tone==='quiet'||e.tone==='ordinary')s.trust=Number(s.trust||0)+1;
  addMemory(s,'Après un déplacement, vous avez retrouvé vos repères à deux dans les détails les plus ordinaires du retour.');write(s);
  const card=document.createElement('aside');card.id='postTravelHomeReset';card.className=`postTravelHomeReset ${e.tone}`;card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small>`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),6200);setTimeout(()=>{card.remove();active=false},7900);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},19000+((s.day*71+mins(s.time))%9000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,17000);arm();
console.info('[Romance] post-travel home reset active: trips can dissolve back into ordinary couple life');
