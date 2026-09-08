import './weeklyLifeRhythmDirector.css';

type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;stress:number;calendar:CalendarItem[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.weeklyLifeRhythm'))}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,260)}

function dayItems(s:SaveLike,day=s.day){return(Array.isArray(s.calendar)?s.calendar:[]).filter(i=>i.day===day)}
function classify(s:SaveLike){
  const today=dayItems(s);const tomorrow=dayItems(s,s.day+1);
  const marion=today.filter(i=>i.owner==='Marion');const lucas=today.filter(i=>i.owner==='Lucas');const together=today.filter(i=>i.owner==='Nous');
  const text=today.map(i=>`${i.title} ${i.note}`.toLowerCase()).join(' ');
  const tomorrowBusy=tomorrow.length>=2;
  if(/corrida|gala|presse|interview|réception|reception|voyage|avion|train|gare|aéroport|aeroport/.test(text))return'charged';
  if(marion.length&&lucas.length)return'parallel';
  if(together.length)return'shared';
  if(today.length===0&&tomorrowBusy)return'breather';
  if(today.length===0)return'calm';
  if(marion.length&&!lucas.length)return'marion';
  if(lucas.length&&!marion.length)return'lucas';
  return'ordinary';
}

function sceneFor(s:SaveLike){
  const kind=classify(s);
  if(kind==='charged')return{kind,k:'JOURNÉE CHARGÉE',t:'Aujourd’hui a déjà son propre rythme.',b:'Il y a des horaires, du mouvement ou du monde autour de vous. Vous ne cherchez pas à transformer chaque creux en moment de couple : la journée avance d’abord comme elle doit avancer.'};
  if(kind==='parallel')return{kind,k:'DEUX VIES EN MÊME TEMPS',t:'Vos journées ne vont pas exactement dans la même direction.',b:'Marion a ses choses, Lucas les siennes. Vous savez simplement où l’autre sera plus tard, et ça suffit à donner une forme à la journée sans devoir tout faire ensemble.'};
  if(kind==='shared')return{kind,k:'UN JOUR POUR VOUS DEUX',t:'Il y a déjà quelque chose qui vous réunit aujourd’hui.',b:'Pas besoin d’ajouter artificiellement une grande scène. Le simple fait d’avoir un point commun dans l’agenda change la manière dont le reste de la journée s’organise.'};
  if(kind==='breather')return{kind,k:'UN PEU D’AIR AVANT DEMAIN',t:'Aujourd’hui est plus calme, et demain le sera moins.',b:'La journée n’a rien à prouver. Elle sert aussi à récupérer, traîner un peu, voir des gens, ou simplement ne pas remplir chaque heure avant que le rythme reparte.'};
  if(kind==='calm')return{kind,k:'UN JOUR NORMAL',t:'Et ça fait du bien que rien ne soit urgent.',b:'Pas de grand événement imposé. Chacun peut dériver dans sa journée, se retrouver, repartir, changer d’idée. Le calme fait lui aussi partie de votre histoire.'};
  if(kind==='marion')return{kind,k:'LA JOURNÉE DE MARION',t:'Aujourd’hui, ton agenda existe vraiment à toi.',b:'Lucas n’a pas besoin d’être le centre de ce qui se passe. Tu avances dans ta journée, et votre couple s’adapte autour de ta vie au lieu de l’effacer.'};
  if(kind==='lucas')return{kind,k:'SON RYTHME À LUI',t:'Lucas a déjà quelque chose qui structure sa journée.',b:'Tu n’es pas obligée de l’attendre ni de tourner autour. Son emploi du temps existe, le tien aussi, et vous vous retrouvez quand vos deux rythmes se recroisent.'};
  return{kind,k:'LE FIL DE LA SEMAINE',t:'La journée trouve sa place entre les autres.',b:'Ni exceptionnelle ni vide : juste une journée qui fait avancer vos habitudes, vos proches, vos projets et votre couple sans tout concentrer au même endroit.'};
}

function eligible(s:SaveLike){if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;if(s.day<3)return false;if(Number(s.flags.weeklyLifeRhythmDay||0)===s.day)return false;const t=mins(s.time);return t>=570&&t<=900}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);s.flags.weeklyLifeRhythmDay=s.day;s.flags.weeklyLifeRhythmType=e.kind;
  if(e.kind==='breather'||e.kind==='calm')s.stress=Math.max(0,Number(s.stress||0)-1);
  if(e.kind==='parallel')s.trust=Number(s.trust||0)+1;
  if([7,14,21].includes(s.day))addMemory(s,'Votre vie commune commence à avoir un vrai rythme de semaine : des jours pleins, des jours séparés et des jours presque vides.');
  write(s);
  const card=document.createElement('aside');card.id='weeklyLifeRhythm';card.className=`weeklyLifeRhythm ${e.kind}`;card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small>`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),5600);setTimeout(()=>{card.remove();active=false},7200);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},15000+((s.day*71+mins(s.time))%9000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,18000);arm();
console.info('[Life] weekly rhythm active: calm, busy, parallel and shared days now read differently without inventing events');