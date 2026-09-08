import './postEventReunionDirector.css';

type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,150)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion'))}
function privateEnough(s:SaveLike){return['finca','estate','madrid','family'].includes(s.place)}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!privateEnough(s)||Boolean(s.flags.corridaLive)||Boolean(s.flags.lucasAway))return false;
  const eventDay=Number(s.flags.externalWorldPressureCalendarDay||0);
  const type=String(s.flags.externalWorldPressureType||'');
  if(!eventDay||eventDay!==s.day)return false;
  if(!['corrida','public','travel','training','work'].includes(type))return false;
  if(Number(s.flags.postEventReunionDay||0)===s.day)return false;
  return mins(s.time)>=1170; // après 19h30 : on laisse d’abord l’événement réellement se dérouler
}

function sceneFor(s:SaveLike){
  const type=String(s.flags.externalWorldPressureType||'work');
  const close=Number(s.relationship||0)>=66;
  const highTrust=Number(s.trust||0)>=55;
  if(type==='corrida')return close?{
    tone:'corrida',k:'ENFIN SEULS',t:'Le bruit autour de lui retombe.',
    b:'Plus de regards à tenir, plus de rôle à jouer. Lucas reste silencieux quelques secondes, puis vient vers toi comme s’il retrouvait enfin un endroit où il n’a rien à prouver.',
    a:'Le prendre dans tes bras',c:'Rester près de lui sans parler'
  }:{
    tone:'corrida',k:'APRÈS',t:'Il redevient simplement Lucas.',
    b:'La journée a laissé sa tension derrière elle. Avec toi, son visage se relâche peu à peu, loin de ce que les autres viennent de voir.',
    a:'T’approcher doucement',c:'Lui laisser quelques minutes'
  };
  if(type==='public')return{
    tone:'public',k:'LA PORTE REFERMÉE',t:'La version publique disparaît presque d’un coup.',
    b:'Il pose son téléphone, desserre enfin les épaules et te regarde autrement. Le contraste est si net que tu le remarques à chaque fois.',
    a:'Venir contre lui',c:'Le taquiner sur son changement de visage'
  };
  if(type==='travel')return{
    tone:'travel',k:'DE RETOUR',t:'Les horaires arrêtent enfin de décider pour vous.',
    b:'Les sacs restent où ils sont. Pendant quelques minutes, aucun départ, aucun message, aucun prochain horaire n’a besoin d’exister.',
    a:'Profiter du calme avec lui',c:'Laisser chacun se poser d’abord'
  };
  if(type==='training')return highTrust?{
    tone:'training',k:'APRÈS L’EFFORT',t:'Il rentre encore concentré.',
    b:'Lucas met un peu de temps à sortir mentalement de sa journée. Puis sa main trouve la tienne, comme un raccourci vers autre chose.',
    a:'Le garder près de toi',c:'Le laisser redescendre à son rythme'
  }:{
    tone:'training',k:'PLUS TARD',t:'La concentration finit par lâcher.',
    b:'Il parle peu au début, puis le rythme ordinaire revient. C’est là que tu retrouves vraiment celui que tu connais.',
    a:'Rester avec lui',c:'Continuer tranquillement la soirée'
  };
  return{
    tone:'work',k:'APRÈS CETTE JOURNÉE',t:'Le monde extérieur reste enfin derrière la porte.',
    b:'Lucas revient vers votre rythme à deux sans grande transition. Un regard, un geste, et la journée commence à perdre son emprise.',
    a:'Aller vers lui',c:'Laisser le calme revenir tout seul'
  };
}

function resolve(s:SaveLike,choice:'a'|'c',tone:string){
  s.flags.postEventReunionDay=s.day;
  s.flags.postEventReunionTone=tone;
  s.flags.postEventReunionChoice=choice;
  s.flags.externalWorldPressureActive=false;
  if(choice==='a'){
    s.relationship=Number(s.relationship||0)+1;
    s.trust=Number(s.trust||0)+1;
    if(tone==='corrida'||tone==='public')s.chemistry=Number(s.chemistry||0)+1;
    s.stress=Math.max(0,Number(s.stress||0)-2);
    addMemory(s,'Après une journée où le monde extérieur avait pris beaucoup de place, vous vous êtes retrouvés vraiment seuls.');
  }else{
    s.trust=Number(s.trust||0)+1;
    s.stress=Math.max(0,Number(s.stress||0)-1);
    addMemory(s,'Après une grosse journée, tu as laissé Lucas revenir à votre intimité à son propre rythme.');
  }
  write(s);
}

function show(s:SaveLike){
  if(active||!eligible(s))return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;
  const e=sceneFor(s);
  const veil=document.createElement('div');veil.id='postEventReunion';veil.className=`postEventReunion ${e.tone}`;
  veil.innerHTML=`<section><span>${e.k}</span><h2>${e.t}</h2><p>${e.b}</p><div><button id="postEventA" class="primary">${e.a}</button><button id="postEventC">${e.c}</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');window.setTimeout(()=>{veil.remove();active=false},260)};
  (veil.querySelector('#postEventA') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,'a',e.tone);close()};
  (veil.querySelector('#postEventC') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,'c',e.tone);close()};
}

function arm(){
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;return}
  if(active||timer)return;
  timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},9000+((s.day*53+mins(s.time))%6500));
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
window.setInterval(arm,13000);
arm();
console.info('[Romance] post-event public/private reunion contrast active');
