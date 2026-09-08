import './coupleDistanceLongingDirector.css';

type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,220)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.coupleDistanceLonging'))}
function apart(s:SaveLike){return Boolean(s.flags.lucasAway)||Boolean(s.flags.lucasBusy)&&!['finca','estate','madrid','family'].includes(s.place)}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!apart(s)||Boolean(s.flags.corridaLive))return false;
  if(Number(s.relationship||0)<48)return false;
  if(Number(s.flags.coupleDistanceLongingDay||0)===s.day)return false;
  const last=Number(s.flags.coupleDistanceLongingLastDay||0);if(last&&s.day-last<2)return false;
  const t=mins(s.time);return t>=660&&t<=1320;
}

function sceneFor(s:SaveLike){
  const recentIntimacy=Number(s.flags.coupleMadeLoveDay||0)>=s.day-2;
  const ritualCount=Number(s.flags.coupleRitualCount||0);
  const pressure=String(s.flags.externalWorldPressureType||'');
  const k=(s.day*41+Math.round(s.relationship||0)+Math.round(s.chemistry||0))%5;
  if(recentIntimacy)return{tone:'charged',k:'LA DISTANCE CHANGE TOUT',t:'Son absence a une présence étrange.',b:'Tu continues ta journée normalement. Pourtant, certains détails te ramènent exactement à la dernière fois où vous étiez seuls. Le manque n’est pas seulement tendre.'};
  if(ritualCount>=2&&k%2===0)return{tone:'ritual',k:'IL MANQUE UN PETIT GESTE',t:'C’est une habitude absente qui te le rappelle.',b:'Le matin, le soir, un endroit où il se pose d’habitude… Rien de dramatique. C’est juste là que tu réalises à quel point vos petits rituels ont commencé à prendre de la place.'};
  if(pressure==='travel')return{tone:'travel',k:'ENTRE DEUX JOURNÉES',t:'Vous vivez chacun votre rythme.',b:'Les horaires ne coïncident pas vraiment. Tu penses à lui au mauvais moment, puis tu ranges ton téléphone et tu continues. Le manque se glisse surtout dans les interstices.'};
  if(k===1)return{tone:'phone',k:'UN RÉFLEXE',t:'Tu prends ton téléphone sans raison précise.',b:'Pas forcément pour lui écrire. Juste ce geste automatique, comme si une partie de toi vérifiait qu’il pouvait encore entrer dans la journée.'};
  return{tone:'quiet',k:'IL N’EST PAS LÀ',t:'La journée reste pleine malgré tout.',b:'Tu fais tes choses, tu réponds aux gens, tu avances. Et puis parfois, pendant quelques secondes, son absence prend exactement la forme de la place qu’il aurait occupée.'};
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);
  s.flags.coupleDistanceLongingDay=s.day;s.flags.coupleDistanceLongingLastDay=s.day;s.flags.coupleDistanceLongingTone=e.tone;
  if(e.tone==='ritual')s.trust=Number(s.trust||0)+1;
  if(e.tone==='charged')s.chemistry=Number(s.chemistry||0)+1;
  addMemory(s,'Même séparés, votre relation continue d’exister dans les petits réflexes de la journée.');write(s);
  const card=document.createElement('aside');card.id='coupleDistanceLonging';card.className=`coupleDistanceLonging ${e.tone}`;card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small>`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),6200);setTimeout(()=>{card.remove();active=false},7900);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},18000+((s.day*59+mins(s.time))%10000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,17000);arm();
console.info('[Romance] distance and longing cues active without inventing new travel or plot events');