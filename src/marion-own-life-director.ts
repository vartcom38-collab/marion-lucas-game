import './marionOwnLifeDirector.css';

type Msg={from:string;text:string,day:number,read:boolean};
type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;careerLevel:number;stress:number;energy:number;phoneUnread:number;messages:Msg[];calendar:CalendarItem[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,180)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.marionOwnLife'))}
function abroad(s:SaveLike){return['madrid','family','finca','estate'].includes(s.place)}
function bigLucasDay(s:SaveLike){const type=String(s.flags.externalWorldPressureType||'');const eventDay=Number(s.flags.externalWorldPressureCalendarDay||0);return eventDay===s.day&&['corrida','travel','public'].includes(type)}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(s.day<3||bigLucasDay(s))return false;
  const last=Number(s.flags.marionOwnLifeLastDay||0);if(last&&s.day-last<2)return false;
  if(Number(s.flags.marionOwnLifeDay||0)===s.day)return false;
  const t=mins(s.time);return t>=600&&t<=1260;
}

function pick(s:SaveLike){
  const away=abroad(s);
  const k=(s.day*37+mins(s.time)+Number(s.careerLevel||0))%5;
  if(away&&k===0)return{tone:'marine',kind:'message',from:'Marine',title:'UN BOUT DE NÎMES',body:'Ton téléphone vibre au milieu d’une journée qui n’a rien à voir avec ta vie d’avant.',text:'Je te préviens, quand tu reviens je te monopolise pour un café. J’ai trop de trucs à te raconter 😭',memory:'Même loin, Marine continue à faire partie de ta vie sans attendre que tu sois disponible pour Lucas.'};
  if(away&&k===1)return{tone:'self',kind:'self',title:'UNE HEURE À TOI',body:'Tu réalises que tu connais déjà les horaires de Lucas mieux que les tiens aujourd’hui.',detail:'Alors tu gardes un moment juste pour toi : marcher, boire quelque chose, regarder la ville sans attendre personne.',memory:'Tu as gardé un morceau de la journée qui n’appartenait qu’à toi.'};
  if(k===2)return{tone:'family',kind:'message',from:'Famille',title:'CHEZ TOI AUSSI, ÇA CONTINUE',body:'Un message arrive sans urgence, juste parce que ta vie ne s’est pas arrêtée quand Lucas est entré dedans.',text:'Tu nous appelles quand tu peux ❤️ Rien de spécial, on voulait juste t’entendre.',memory:'Ta famille a repris naturellement sa place dans une journée où Lucas n’était pas le seul centre.'};
  if(k===3)return{tone:'project',kind:'self',title:'UN TRUC À TOI',body:'Une idée personnelle que tu avais laissée de côté te revient soudainement.',detail:Number(s.careerLevel||0)>0?'Tu notes deux choses avant de les oublier. Ce projet-là avance parce que tu le fais avancer, pas parce que quelqu’un t’emmène quelque part.':'Tu notes l’idée quelque part. Ce n’est encore rien de précis, mais ça t’appartient complètement.',memory:'Une envie personnelle a repris de la place dans ta tête, indépendamment de Lucas.'};
  return{tone:'friend',kind:'message',from:'Marine',title:'TA VIE À TOI AUSSI',body:'Marine débarque dans ta journée avec son timing habituel.',text:away?'Envoie-moi juste une photo de ta tête là maintenant. J’ai besoin de vérifier que l’Espagne ne t’a pas transformée 😂':'Tu fais quoi cette semaine ? Et ne me réponds pas “je sais pas” 😭',memory:'Marine a continué à te traiter exactement comme avant, sans réduire ta vie à ton couple.'};
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=pick(s);
  if(e.kind==='message'&&e.from&&e.text){s.messages=Array.isArray(s.messages)?s.messages:[];s.messages.unshift({from:e.from,text:e.text,day:s.day,read:false});s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;s.flags.phoneToast=`${e.from}|${e.text}`;s.flags.phoneToastAt=stamp(s)}
  s.flags.marionOwnLifeDay=s.day;s.flags.marionOwnLifeLastDay=s.day;s.flags.marionOwnLifeTone=e.tone;
  if(e.kind==='self')s.stress=Math.max(0,Number(s.stress||0)-1);
  addMemory(s,e.memory);write(s);
  const card=document.createElement('aside');card.id='marionOwnLife';card.className=`marionOwnLife ${e.tone}`;
  card.innerHTML=`<span>${e.title}</span><strong>${e.kind==='message'&&e.from?e.from:e.body}</strong><small>${e.kind==='message'?e.body:(e.detail||'')}</small>${e.kind==='message'&&e.text?`<em>${e.text}</em>`:''}`;
  game.appendChild(card);setTimeout(()=>card.classList.add('is-leaving'),6200);setTimeout(()=>{card.remove();active=false},7900)
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},16000+((s.day*73+mins(s.time))%9000))}

window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,15000);arm();
console.info('[Marion] independent-life rhythm active: friends, family and personal space persist beyond Lucas');
