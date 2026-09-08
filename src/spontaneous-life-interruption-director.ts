import './spontaneousLifeInterruptionDirector.css';

type Msg={from:string;text:string,day:number,read:boolean};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;stress:number;energy:number;phoneUnread:number;messages:Msg[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function fmt(total:number){total=((total%1440)+1440)%1440;return`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,260)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.spontaneousLifeInterruption'))}
function inNimes(s:SaveLike){return['home','nimes','cafe'].includes(s.place)}
function eligible(s:SaveLike){
  if(s.screen!=='game'||document.hidden||blocked())return false;
  if(s.day<2||Boolean(s.flags.corridaLive))return false;
  if(Number(s.flags.spontaneousLifeInterruptionDay||0)===s.day)return false;
  const last=Number(s.flags.spontaneousLifeInterruptionLastDay||0);if(last&&s.day-last<3)return false;
  const t=mins(s.time);return t>=660&&t<=1230;
}

function sceneFor(s:SaveLike){
  const nimes=inNimes(s);
  const abroad=['madrid','family','finca','estate'].includes(s.place);
  const k=(s.day*73+mins(s.time)+Math.round(s.stress||0))%5;
  if(nimes&&k===0)return{tone:'marine',from:'Marine',title:'JE SUIS PAS LOIN',body:'Le message arrive sans prévenir.',text:'Je suis dans le coin. 10 minutes de café ? 😭',a:'La rejoindre',c:'Pas aujourd’hui',minutes:22,memory:'Marine a débarqué dans ta journée avec un plan improvisé, comme avant.'};
  if(nimes&&k===1)return{tone:'visit',from:'Marine',title:'ÇA SONNE PRESQUE COMME UNE INVITATION',body:'Marine t’écrit avec zéro préavis.',text:'Dis-moi que t’es pas occupée, j’ai besoin de te voir deux minutes 😂',a:'Dire oui',c:'Lui répondre plus tard',minutes:18,memory:'Une petite improvisation avec Marine a cassé le programme de la journée.'};
  if(abroad&&k<=1)return{tone:'family',from:'Famille',title:'UN APPEL QUI N’ÉTAIT PAS PRÉVU',body:'Rien d’urgent. Juste quelqu’un qui a envie de t’entendre.',text:'On a cinq minutes pour t’appeler si tu veux ❤️',a:'Prendre l’appel',c:'Rappeler plus tard',minutes:12,memory:'Ta famille a pris une place spontanée dans une journée pourtant loin de Nîmes.'};
  if(k===2)return{tone:'marine',from:'Marine',title:'PLAN IMPROVISÉ',body:'Ton téléphone vibre au beau milieu de ce que tu faisais.',text:nimes?'Tu bouges ce soir ? J’ai une idée.':'Quand tu reviens, je te kidnappe une heure. C’est décidé 😭',a:nimes?'Voir ce qu’elle propose':'Répondre maintenant',c:'Continuer ta journée',minutes:nimes?10:4,memory:'Un plan improvisé est apparu sans que tu aies eu besoin de chercher quoi faire.'};
  if(k===3)return{tone:'family',from:'Famille',title:'RIEN DE GRAVE',body:'Juste une petite interruption de vraie vie.',text:'On vient de parler de toi. Tu vas bien ?',a:'Répondre',c:'Plus tard',minutes:5,memory:'Une interruption toute simple t’a rappelé que ta vie continuait aussi en dehors de ton couple.'};
  return{tone:'marine',from:'Marine',title:'MARINE, ÉVIDEMMENT',body:'Elle surgit dans ta journée avec le sens du timing qui la caractérise.',text:'Réponds vite : j’ai une question très importante (pas importante du tout).',a:'Répondre',c:'La faire patienter',minutes:6,memory:'Marine a réussi à interrompre ta journée pour quelque chose de parfaitement pas urgent.'};
}

function resolve(s:SaveLike,accept:boolean,e:ReturnType<typeof sceneFor>){
  s.flags.spontaneousLifeInterruptionDay=s.day;s.flags.spontaneousLifeInterruptionLastDay=s.day;s.flags.spontaneousLifeInterruptionTone=e.tone;s.flags.spontaneousLifeInterruptionChoice=accept?'yes':'later';
  if(accept){s.time=fmt(mins(s.time)+e.minutes);s.stress=Math.max(0,Number(s.stress||0)-1);addMemory(s,e.memory)}
  else addMemory(s,'Tu as laissé passer une petite interruption spontanée pour garder ton propre rythme.');
  write(s);
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);
  s.messages=Array.isArray(s.messages)?s.messages:[];s.messages.unshift({from:e.from,text:e.text,day:s.day,read:false});s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;s.flags.phoneToast=`${e.from}|${e.text}`;s.flags.phoneToastAt=stamp(s);write(s);
  const veil=document.createElement('div');veil.id='spontaneousLifeInterruption';veil.className=`spontaneousLifeInterruption ${e.tone}`;
  veil.innerHTML=`<section><span>${e.title}</span><h2>${e.from}</h2><p>${e.body}</p><em>${e.text}</em><div><button id="spontaneousYes" class="primary">${e.a}</button><button id="spontaneousNo">${e.c}</button></div></section>`;game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');setTimeout(()=>{veil.remove();active=false},260)};
  (veil.querySelector('#spontaneousYes') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,true,e);close();setTimeout(()=>location.reload(),280)};
  (veil.querySelector('#spontaneousNo') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,false,e);close()};
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},24000+((s.day*89+mins(s.time))%13000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,19000);arm();
console.info('[World] spontaneous life interruptions active: friends and family can break the routine without inventing major plot');
