import './lucasReunionMoodDirector.css';

type SaveLike={
  day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;
  relationship:number;trust:number;chemistry:number;stress:number;energy:number;
  memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number;
};

const SAVE_KEY='marion-lucas-save-v4';
let timer=0;
let open=false;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,90)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil,.lucasReunionMoodVeil'))}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(!['finca','estate','madrid','family'].includes(s.place))return false;
  if(!Boolean(s.flags[`lucas_return_${s.day}`]))return false;
  if(Boolean(s.flags[`lucas_reunion_mood_${s.day}`]))return false;
  return true;
}

function moodFor(s:SaveLike){
  const tired=Boolean(s.flags.lucasWorkedLong)||Boolean(s.flags.lucasLateReturn);
  const close=Number(s.relationship||0)>=60;
  const charged=Number(s.chemistry||0)>=42;
  const selector=(s.day*37+Math.round(s.relationship||0)+Math.round(s.trust||0))%4;
  if(tired&&selector%2===0)return{
    tone:'fatigue',kicker:'CE SOIR',title:'Il a besoin de redescendre.',
    body:'Lucas rentre avec la journée encore collée aux épaules. Il te regarde, mais ne vient pas tout de suite.',
    a:'Le laisser souffler',b:'Aller doucement vers lui'
  };
  if(tired)return{
    tone:'tendre',kicker:'EN RENTRANT',title:'Il vient vers toi sans parler.',
    body:'Il pose ses affaires, puis s’arrête près de toi comme si le reste pouvait attendre quelques secondes.',
    a:'Rester près de lui',b:'Lui laisser le temps de rentrer'
  };
  if(charged&&close&&selector===3)return{
    tone:'charged',kicker:'À PEINE RENTRÉ',title:'Son regard s’attarde.',
    body:'Il devait sûrement te dire quelque chose. Il ne le fait pas. La distance entre vous devient simplement plus courte.',
    a:'Ne pas bouger',b:'Casser doucement le silence'
  };
  return close?{
    tone:'warm',kicker:'IL EST LÀ',title:'La soirée reprend autrement.',
    body:'Lucas te trouve presque aussitôt. Rien de spectaculaire : juste ce petit réflexe de revenir vers toi.',
    a:'Aller à sa rencontre',b:'Le laisser venir'
  }:{
    tone:'quiet',kicker:'IL EST RENTRÉ',title:'Vous vous retrouvez sans cérémonie.',
    body:'La maison change de rythme. Vous reprenez chacun votre place, un peu plus proches qu’avant son départ.',
    a:'Rester avec lui un moment',b:'Continuer tranquillement ta soirée'
  };
}

function resolve(s:SaveLike,choice:'a'|'b',tone:string){
  s.flags[`lucas_reunion_mood_${s.day}`]=true;
  s.flags.lucasReunionChoice=choice;
  s.flags.lucasReunionTone=tone;
  if(choice==='a'){
    if(tone==='fatigue'){
      s.trust=Number(s.trust||0)+1;
      s.stress=Math.max(0,Number(s.stress||0)-1);
      addMemory(s,'Tu as laissé à Lucas l’espace de revenir à lui avant de revenir à vous.');
    }else{
      s.relationship=Number(s.relationship||0)+1;
      if(tone==='charged')s.chemistry=Number(s.chemistry||0)+1;
      addMemory(s,'À son retour, vous vous êtes retrouvés sans avoir besoin d’en faire un événement.');
    }
  }else{
    if(tone==='fatigue'||tone==='tendre'){
      s.trust=Number(s.trust||0)+1;
      addMemory(s,'Tu as choisi une présence douce au retour de Lucas, sans lui imposer un rythme.');
    }else{
      addMemory(s,'Le retour de Lucas s’est fondu dans la soirée sans couper ton propre rythme.');
    }
  }
  write(s);
}

function show(s:SaveLike){
  const game=document.querySelector<HTMLElement>('main.game');if(!game||open||!eligible(s))return;
  open=true;
  const mood=moodFor(s);
  const veil=document.createElement('div');veil.className=`lucasReunionMoodVeil ${mood.tone}`;
  veil.innerHTML=`<section class="lucasReunionMoodCard"><span>${mood.kicker}</span><h2>${mood.title}</h2><p>${mood.body}</p><div><button id="reunionA" class="primary">${mood.a}</button><button id="reunionB">${mood.b}</button></div></section>`;
  game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');window.setTimeout(()=>{veil.remove();open=false},260)};
  (veil.querySelector('#reunionA') as HTMLButtonElement).onclick=()=>{const fresh=read();if(fresh)resolve(fresh,'a',mood.tone);close()};
  (veil.querySelector('#reunionB') as HTMLButtonElement).onclick=()=>{const fresh=read();if(fresh)resolve(fresh,'b',mood.tone);close()};
}

function arm(){
  const s=read();if(!s||!eligible(s)){if(timer)window.clearTimeout(timer);timer=0;return}
  if(timer||open)return;
  const delay=7000+((s.day*113+Math.round(s.relationship||0))%6000);
  timer=window.setTimeout(()=>{timer=0;const fresh=read();if(fresh)show(fresh)},delay);
}

window.addEventListener('storage',arm);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});
new MutationObserver(arm).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(arm,7000);
arm();

console.info('[Romance] variable Lucas reunion moods active');
