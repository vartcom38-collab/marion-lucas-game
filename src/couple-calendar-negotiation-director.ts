import './coupleCalendarNegotiationDirector.css';

type CalendarItem={owner:'Marion'|'Lucas'|'Nous';title:string;day:number;note:string};
type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;official:boolean;relationship:number;trust:number;chemistry:number;stress:number;calendar:CalendarItem[];memories:string[];flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let active=false,timer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function addMemory(s:SaveLike,t:string){if(!Array.isArray(s.memories))s.memories=[];if(!s.memories.includes(t))s.memories.unshift(t);s.memories=s.memories.slice(0,260)}
function blocked(){return Boolean(document.querySelector('#overlay.open,.eventOverlay,.incomingCallOverlay,.moniaDramaScene,#moniaSceneOffer,.coupleIntimacyVeil,.postEventReunion,.coupleCalendarNegotiation'))}
function itemsFor(s:SaveLike,day:number){return (Array.isArray(s.calendar)?s.calendar:[]).filter(i=>i.day===day)}
function lucasBusyItem(i:CalendarItem){const x=`${i.title||''} ${i.note||''}`.toLowerCase();return i.owner==='Lucas'&&/(corrida|entraî|entrain|travail|presse|interview|voyage|déplac|train|avion|gala|réception|reception)/.test(x)}
function marionItem(i:CalendarItem){return i.owner==='Marion'}
function sharedItem(i:CalendarItem){return i.owner==='Nous'}
function context(s:SaveLike){
  const today=itemsFor(s,s.day),tomorrow=itemsFor(s,s.day+1);
  const marion=[...today,...tomorrow].find(marionItem)||null;
  const lucas=[...today,...tomorrow].find(lucasBusyItem)||null;
  const shared=[...today,...tomorrow].find(sharedItem)||null;
  if(!marion&&!lucas&&!shared)return null;
  return{marion,lucas,shared};
}
function eligible(s:SaveLike){
  if(!s.metLucas||!s.official||s.screen!=='game'||document.hidden||blocked())return false;
  if(Number(s.relationship||0)<54||Number(s.trust||0)<42)return false;
  if(Boolean(s.flags.corridaLive))return false;
  if(Number(s.flags.coupleCalendarNegotiationDay||0)===s.day)return false;
  const last=Number(s.flags.coupleCalendarNegotiationLastDay||0);if(last&&s.day-last<3)return false;
  if(!context(s))return false;
  const t=mins(s.time);return t>=720&&t<=1260;
}
function clean(t:string){return String(t||'').replace(/\s+/g,' ').trim().slice(0,72)}
function sceneFor(s:SaveLike){
  const c=context(s)!;
  const close=Number(s.relationship||0)>=68;
  if(c.marion&&c.lucas){
    return{tone:'both',k:'DEUX AGENDAS',t:'Vos journées ne s’emboîtent pas toutes seules.',b:`Tu as « ${clean(c.marion.title)} ». Lucas a « ${clean(c.lucas.title)} ». Personne n’annule sa vie pour l’autre : vous regardez juste où trouver un vrai moment ensemble.`,a:'Chercher un créneau à deux',c:'Garder chacun son programme',kind:'both'};
  }
  if(c.marion){
    return{tone:'marion',k:'TON PROGRAMME COMPTE AUSSI',t:'Lucas regarde ton agenda avant de parler du sien.',b:`Tu as « ${clean(c.marion.title)} ». Il ne part pas du principe que tu vas t’adapter. Il te demande simplement quand tu seras vraiment disponible.`,a:'Lui dire ce qui t’arrange',c:'Laisser chacun gérer',kind:'marion'};
  }
  if(c.shared){
    return{tone:'shared',k:'UN TRUC À VOUS',t:'Il y a déjà quelque chose de prévu ensemble.',b:`« ${clean(c.shared.title)} » est dans l’agenda. Au lieu de transformer ça en grand événement, vous commencez déjà à organiser le reste autour, très naturellement.`,a:'Garder ce moment protégé',c:'Rester souples',kind:'shared'};
  }
  return{tone:'lucas',k:'SON MONDE PREND DE LA PLACE',t:'Lucas te parle de son programme avant qu’il ne déborde sur le tien.',b:close?`Il a « ${clean(c.lucas!.title)} ». Cette fois, il te dit ce qu’il sait et ce qu’il ne sait pas encore, sans attendre que tu sois disponible par défaut.`:`Il a « ${clean(c.lucas!.title)} ». Tu commences à voir comment son rythme peut changer une journée, mais aussi comment vous pouvez éviter qu’il décide de tout.`,a:'Poser ton propre rythme aussi',c:'Voir comment la journée se passe',kind:'lucas'};
}
function resolve(s:SaveLike,choice:'a'|'c',kind:string){
  s.flags.coupleCalendarNegotiationDay=s.day;s.flags.coupleCalendarNegotiationLastDay=s.day;s.flags.coupleCalendarNegotiationKind=kind;s.flags.coupleCalendarNegotiationChoice=choice;
  if(choice==='a'){s.trust=Number(s.trust||0)+1;s.stress=Math.max(0,Number(s.stress||0)-1);if(kind==='both'||kind==='shared')s.relationship=Number(s.relationship||0)+1;addMemory(s,'Vous avez commencé à faire tenir deux vies dans le même agenda sans que l’une efface l’autre.');}
  else{addMemory(s,'Vous avez gardé chacun votre programme sans transformer la coordination du quotidien en preuve d’amour.');}
  write(s);
}
function show(s:SaveLike){
  if(active||!eligible(s))return;const game=document.querySelector<HTMLElement>('main.game');if(!game)return;
  active=true;const e=sceneFor(s);const veil=document.createElement('div');veil.id='coupleCalendarNegotiation';veil.className=`coupleCalendarNegotiation ${e.tone}`;
  veil.innerHTML=`<section><span>${e.k}</span><h2>${e.t}</h2><p>${e.b}</p><div><button id="calendarA" class="primary">${e.a}</button><button id="calendarC">${e.c}</button></div></section>`;game.appendChild(veil);
  const close=()=>{veil.classList.add('is-leaving');setTimeout(()=>{veil.remove();active=false},260)};
  (veil.querySelector('#calendarA') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,'a',e.kind);close()};
  (veil.querySelector('#calendarC') as HTMLButtonElement).onclick=()=>{const f=read();if(f)resolve(f,'c',e.kind);close()};
}
function arm(){const s=read();if(!s||!eligible(s)){if(timer)clearTimeout(timer);timer=0;return}if(active||timer)return;timer=window.setTimeout(()=>{timer=0;const f=read();if(f)show(f)},22000+((s.day*79+mins(s.time))%10000))}
window.addEventListener('storage',arm);document.addEventListener('visibilitychange',()=>{if(!document.hidden)arm()});window.setInterval(arm,19000);arm();
console.info('[Romance] shared calendar negotiation active without inventing new plans');