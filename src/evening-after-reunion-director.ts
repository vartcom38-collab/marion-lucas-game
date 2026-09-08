import './eveningAfterReunionDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;trust:number;chemistry:number;stress:number;energy:number;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let timer=0;
let active=false;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'20:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,100)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil,.lucasReunionMoodVeil,.eveningAfterReunion'))}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!['finca','estate','madrid','family'].includes(s.place))return false;
  if(!Boolean(s.flags[`lucas_reunion_mood_${s.day}`]))return false;
  if(Boolean(s.flags[`evening_after_reunion_${s.day}`]))return false;
  return mins(s.time)>=1140;
}

function sceneFor(s:SaveLike){
  const tone=String(s.flags.lucasReunionTone||'quiet');
  const choice=String(s.flags.lucasReunionChoice||'a');
  const close=Number(s.relationship||0)>=65;
  if(tone==='fatigue'&&choice==='a')return[
    'PLUS TARD',
    'Il revient de lui-même.',
    'Lucas s’assoit près de toi après avoir pris le temps de souffler. Son épaule finit par toucher la tienne, comme une façon discrète de dire merci.'
  ];
  if(tone==='fatigue'&&choice==='b')return[
    'UN PEU PLUS TARD',
    'Le silence s’est adouci.',
    'Vous ne reparlez pas vraiment de sa journée. Il reste simplement près de toi, plus calme qu’en rentrant.'
  ];
  if(tone==='charged')return[
    'PLUS TARD',
    'La tension n’a pas complètement disparu.',
    close
      ?'La soirée s’est calmée, mais vos regards continuent de se retrouver un peu trop souvent.'
      :'Vous reprenez vos occupations, avec cette drôle d’impression qu’une phrase est restée en suspens.'
  ];
  if(tone==='tendre')return[
    'LE SOIR',
    'Vous finissez par vous retrouver dans le même coin de la maison.',
    'Pas de grande conversation. Juste le genre de proximité qui devient familière avant même qu’on s’en rende compte.'
  ];
  if(choice==='a')return[
    'LE SOIR',
    'La journée finit doucement.',
    'Vous restez ensemble sans programme précis. Le temps passe, et personne ne semble pressé de changer ça.'
  ];
  return[
    'LE SOIR',
    'Chacun garde encore un peu son rythme.',
    'Vous vous croisez, vous vous retrouvez, puis vous repartez faire autre chose. Ça ressemble déjà à une vraie vie à deux.'
  ];
}

function show(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||active||!eligible(s))return;
  active=true;
  const [kicker,title,body]=sceneFor(s);
  const card=document.createElement('aside');card.className='eveningAfterReunion';
  card.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(card);
  s.flags[`evening_after_reunion_${s.day}`]=true;
  s.flags.eveningAfterReunionTone=String(s.flags.lucasReunionTone||'quiet');
  addMemory(s,'La soirée a continué après le retour de Lucas au lieu de s’arrêter avec la scène de retrouvailles.');
  write(s);
  window.setTimeout(()=>card.classList.add('is-leaving'),6500);
  window.setTimeout(()=>{card.remove();active=false},8200);
}

function arm(){
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;return}
  if(timer||active)return;
  timer=window.setTimeout(()=>{timer=0;const fresh=read();if(fresh)show(fresh)},11000);
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,8000);
arm();

console.info('[Romance] post-reunion evening continuity active');
