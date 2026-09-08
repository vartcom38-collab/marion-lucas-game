import './lucasDepartureReturnDirector.css';

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
function addMemory(s:SaveLike,text:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(text))s.memories.unshift(text);s.memories=s.memories.slice(0,80)}
function sharedPlace(s:SaveLike){return ['finca','estate','madrid','family'].includes(s.place)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.lucasSharedRoutineVeil,.lucasDepartureReturnVeil'))}

function eligible(s:SaveLike){return s.metLucas&&s.official&&s.screen==='game'&&sharedPlace(s)&&!document.hidden&&!blocked()}

function departureCopy(s:SaveLike){
  const close=Number(s.relationship||0)>=62;
  if(s.place==='finca')return close
    ?['IL PART','Lucas attrape ses affaires avant de sortir.','Au dernier moment, il revient vers toi juste assez pour poser sa main contre ta nuque. « À tout à l’heure. »']
    :['IL PART','Lucas repart vers les terrains.','Un regard vers toi depuis la porte, puis le bruit de ses pas s’éloigne dans la finca.'];
  return['IL PART','Son rythme de travail reprend.','Il te prévient simplement qu’il revient plus tard, puis la journée continue.'];
}

function returnCopy(s:SaveLike){
  const tired=Boolean(s.flags.lucasWorkedLong)||Boolean(s.flags.lucasLateReturn);
  const close=Number(s.relationship||0)>=58;
  if(tired&&close)return['IL EST RENTRÉ','La porte s’ouvre plus tard que prévu.','Lucas a l’air fatigué. Pourtant son premier regard cherche immédiatement où tu es.'];
  if(tired)return['IL EST RENTRÉ','Tu entends enfin la porte.','Sa journée a été plus longue que prévu. Il pose ses affaires avant même de parler.'];
  if(s.place==='finca'&&close)return['IL REVIENT','Des pas reviennent dans la maison.','Il te trouve du regard presque aussitôt, comme si c’était devenu son premier réflexe.'];
  return['IL REVIENT','Le calme de la maison change.','Lucas est rentré. Rien de spectaculaire, juste cette sensation que le lieu est de nouveau habité autrement.'];
}

function showCard(s:SaveLike,kind:'departure'|'return'){
  if(active||!eligible(s))return;
  const key=`lucas_${kind}_${s.day}`;if(Boolean(s.flags[key]))return;
  const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;
  const [kicker,title,body]=kind==='departure'?departureCopy(s):returnCopy(s);
  const card=document.createElement('aside');card.className=`lucasDepartureReturn ${kind}`;
  card.innerHTML=`<span>${kicker}</span><strong>${title}</strong><small>${body}</small>`;
  game.appendChild(card);
  s.flags[key]=true;
  if(kind==='departure'){
    s.flags.lucasAway=true;s.flags.lucasDepartureMinute=mins(s.time);
    addMemory(s,'Tu as laissé Lucas partir vivre sa journée sans que le monde s’arrête autour de lui.');
  }else{
    s.flags.lucasAway=false;s.flags.lucasReturnMinute=mins(s.time);
    addMemory(s,'Le retour de Lucas a changé l’atmosphère du lieu presque sans un mot.');
  }
  write(s);
  window.setTimeout(()=>card.classList.add('is-leaving'),6000);
  window.setTimeout(()=>{card.remove();active=false},7600);
}

function sync(){
  const s=read();if(!s||!eligible(s))return;
  const phase=String(s.flags.lucasRoutinePhase||'');
  const busy=Boolean(s.flags.lucasRoutineBusy);
  const away=Boolean(s.flags.lucasAway);
  const t=mins(s.time);

  // Le départ est lié au vrai rythme de travail déjà posé par le directeur quotidien.
  if(busy&&!away&&!Boolean(s.flags[`lucas_departure_${s.day}`])){
    if(timer)window.clearTimeout(timer);
    timer=window.setTimeout(()=>{timer=0;const fresh=read();if(fresh)showCard(fresh,'departure')},900);
    return;
  }

  // Certains jours la journée déborde, ce qui rend le retour moins mécanique.
  if(away&&phase==='afternoon'&&s.day%3===0){
    if(!Boolean(s.flags.lucasWorkedLong)){s.flags.lucasWorkedLong=true;write(s)}
    return;
  }

  if(away&&!busy&&(phase==='lunch'||phase==='evening'||phase==='night')){
    if(t>=1190&&Boolean(s.flags.lucasWorkedLong))s.flags.lucasLateReturn=true;
    if(timer)window.clearTimeout(timer);
    timer=window.setTimeout(()=>{timer=0;const fresh=read();if(fresh)showCard(fresh,'return')},1300);
  }
}

window.addEventListener('storage',sync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});
window.setInterval(sync,6500);
sync();

console.info('[Romance] Lucas departure/return emotional rhythm active');
