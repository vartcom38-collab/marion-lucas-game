import './relationshipMemoryEchoDirector.css';

type Msg={from:string;text:string,day:number,read:boolean};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;phoneUnread:number;messages:Msg[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};

const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function stamp(s:SaveLike){return s.day*1440+mins(s.time)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,200)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.relationshipMemoryEcho'))}
function together(s:SaveLike){return['finca','estate','madrid','family','nimes','cafe'].includes(s.place)&&!Boolean(s.flags.lucasAway)}

function candidates(s:SaveLike){
  const out:{id:string;day:number;tone:string;k:string;t:string;b:string;message?:string}[]=[];
  const initDay=Number(s.flags.marionCoupleInitiativeLastDay||0);
  if(initDay&&s.flags.marionCoupleInitiativeChoice==='yes'&&s.day-initDay>=1&&s.day-initDay<=4){
    const kind=String(s.flags.marionCoupleInitiativeKind||'quiet');
    const detail=kind==='walk'||kind==='air'?'la balade que tu avais choisie':kind==='city'?'la sortie que tu avais improvisée':kind==='surprise'?'ta petite attention':'ce moment que tu avais lancé toi-même';
    out.push({id:'marion-init',day:initDay,tone:'warm',k:'IL S’EN SOUVIENT',t:'Lucas reprend une idée qui venait de toi.',b:`Sans en faire un événement, il reparle de ${detail}. Pas comme d’un détail oublié : comme de quelque chose qu’il a gardé.`});
  }

  const tensionDay=Number(s.flags.coupleMicroTensionDay||0);
  const tensionTone=String(s.flags.coupleMicroTensionTone||'');
  const tensionChoice=String(s.flags.coupleMicroTensionChoice||'');
  const pressureToday=Number(s.flags.externalWorldPressureCalendarDay||0)===s.day||Boolean(s.flags.externalWorldPressureActive);
  if(tensionDay&&s.day-tensionDay>=1&&s.day-tensionDay<=5&&tensionTone==='late'&&tensionChoice==='c'&&pressureToday){
    out.push({id:'warn-late',day:tensionDay,tone:'message',k:'AVANT QUE TU AIES À DEMANDER',t:'Ton téléphone vibre.',b:'Cette fois, il pense à prévenir avant que l’heure commence à peser.',message:'Ça va finir plus tard aujourd’hui. Je te préviens ❤️'});
  }else if(tensionDay&&s.day-tensionDay>=1&&s.day-tensionDay<=4&&tensionTone==='silence'&&tensionChoice==='a'&&together(s)){
    out.push({id:'space',day:tensionDay,tone:'quiet',k:'IL A RETENU',t:'Il ne prend pas ton silence pour de la distance.',b:'L’autre fois, tu lui avais laissé de l’espace. Aujourd’hui, quand tu te fais plus discrète, Lucas ne force rien. Il reste simplement assez près pour que tu saches qu’il est là.'});
  }

  const repairDay=Number(s.flags.coupleRepairDay||0);
  if(repairDay&&s.day-repairDay>=2&&s.day-repairDay<=5&&together(s)){
    out.push({id:'repair',day:repairDay,tone:'quiet',k:'UN VIEUX PETIT DÉCALAGE',t:'Cette fois, il corrige avant que ça s’installe.',b:'Une phrase pourrait tomber de travers. Lucas s’arrête presque aussitôt, te regarde vraiment, puis reformule. À peine perceptible — sauf que tu sais exactement pourquoi.'});
  }

  const sharedDay=Number(s.flags.lucasSharedRoutineDay||0);
  if(sharedDay&&s.flags.lucasSharedRoutineChoice==='yes'&&s.day-sharedDay>=2&&s.day-sharedDay<=5&&together(s)){
    const kind=String(s.flags.lucasSharedRoutineKind||'quiet');
    const echo=kind==='walk'?'le même chemin que l’autre fois':kind==='city'?'un détour qui ressemble à votre dernière sortie':kind==='escape'?'la petite échappée que vous aviez volée aux autres':'ce petit moment à deux';
    out.push({id:'shared',day:sharedDay,tone:'warm',k:'COMME L’AUTRE FOIS',t:'Lucas te lance un regard avant même de parler.',b:`Tu comprends tout de suite qu’il pense à ${echo}. Ce n’était donc pas juste une parenthèse pour lui non plus.`});
  }

  const intimateDay=Number(s.flags.coupleMadeLoveDay||0);
  if(intimateDay&&s.day-intimateDay>=1&&s.day-intimateDay<=3&&Number(s.chemistry||0)>=45&&together(s)){
    out.push({id:'intimacy',day:intimateDay,tone:'charged',k:'UN DÉTAIL QUI RESTE',t:'Son regard s’arrête une seconde de trop.',b:'Rien n’est dit. Mais il y a dans sa façon de te regarder quelque chose de trop précis pour être accidentel. La nuit d’avant n’a manifestement pas disparu de sa tête non plus.'});
  }

  const reunionDay=Number(s.flags.postEventReunionDay||0);
  if(reunionDay&&s.day-reunionDay>=2&&s.day-reunionDay<=5&&String(s.flags.postEventReunionChoice||'')==='c'&&together(s)){
    out.push({id:'reunion-space',day:reunionDay,tone:'quiet',k:'IL CONNAÎT TON GESTE',t:'Après une journée chargée, il ne se ferme pas complètement.',b:'Tu lui avais déjà laissé le temps de redescendre sans le prendre personnellement. Cette fois, Lucas revient vers toi un peu plus vite — comme s’il savait que tu comprendrais le silence entre les deux.'});
  }
  return out;
}

function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(Number(s.relationship||0)<42)return false;
  if(Number(s.flags.relationshipMemoryEchoDay||0)===s.day)return false;
  const last=Number(s.flags.relationshipMemoryEchoLastDay||0);if(last&&s.day-last<2)return false;
  const t=mins(s.time);if(t<600||t>1320)return false;
  return candidates(s).some(c=>!Boolean(s.flags[`memoryEcho_${c.id}_${c.day}`]));
}

function choose(s:SaveLike){
  const pool=candidates(s).filter(c=>!Boolean(s.flags[`memoryEcho_${c.id}_${c.day}`]));
  if(!pool.length)return null;
  return pool[(s.day+Math.round(s.trust||0)+Math.round(s.relationship||0))%pool.length]||pool[0];
}

function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  const e=choose(s);if(!e)return;active=true;
  if(e.message){s.messages=Array.isArray(s.messages)?s.messages:[];s.messages.unshift({from:'Lucas',text:e.message,day:s.day,read:false});s.phoneUnread=Math.max(0,Number(s.phoneUnread||0))+1;s.flags.phoneToast=`Lucas|${e.message}`;s.flags.phoneToastAt=stamp(s)}
  s.flags.relationshipMemoryEchoDay=s.day;s.flags.relationshipMemoryEchoLastDay=s.day;s.flags.relationshipMemoryEchoType=e.id;s.flags[`memoryEcho_${e.id}_${e.day}`]=true;
  if(e.id==='warn-late'||e.id==='repair')s.trust=Number(s.trust||0)+1;
  if(e.id==='marion-init'||e.id==='shared')s.relationship=Number(s.relationship||0)+1;
  addMemory(s,'Un détail de votre histoire est revenu plusieurs jours plus tard, comme quelque chose que Lucas avait réellement retenu.');write(s);
  const card=document.createElement('aside');card.id='relationshipMemoryEcho';card.className=`relationshipMemoryEcho ${e.tone}`;card.innerHTML=`<span>${e.k}</span><strong>${e.t}</strong><small>${e.b}</small>${e.message?`<em>Lucas · ${e.message}</em>`:''}`;game.appendChild(card);
  setTimeout(()=>card.classList.add('is-leaving'),6500);setTimeout(()=>{card.remove();active=false},8200);
}

function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},18000+((s.day*83+mins(s.time))%10000))}

window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,16000);arm();
console.info('[Romance] relationship memory echoes active: past choices can quietly return days later');
