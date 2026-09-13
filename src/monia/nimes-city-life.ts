import './nimes-city-life.css';

const SAVE_KEY='marion-lucas-save-v4';
type Place='nimes'|'cafe'|'arenes'|'station';
type Target=Place|'home';
type Save={day?:number;time?:string;place?:string;screen?:string;energy?:number;stress?:number;relationship?:number;flags?:Record<string,unknown>};
type Action={id:string;label:string;short:string;minutes:number;energy:number;stress:number;relationship:number};
type Route={target:Target;label:string;minutes:number};
type MomentChoice={id:string;label:string;minutes:number;energy?:number;stress?:number;relationship?:number};
type Moment={key:string;title:string;text:string;choices:MomentChoice[]};

const VIEWS:Record<Place,string>={
  nimes:'./resources/nimes/nimes-street.webp',
  cafe:'./resources/nimes/nimes-cafe.webp',
  arenes:'./resources/nimes/nimes-arenes.webp',
  station:'./resources/nimes/nimes-station.webp',
};
const ACTIONS:Record<Place,Action[]>={
  nimes:[
    {id:'walk',label:'Marcher un peu dans le centre',short:'Marcher',minutes:35,energy:-2,stress:-3,relationship:0},
    {id:'pause',label:'S’arrêter quelques minutes',short:'Faire une pause',minutes:20,energy:1,stress:-2,relationship:0},
    {id:'wander',label:'Flâner sans but précis',short:'Flâner',minutes:45,energy:-2,stress:-4,relationship:0},
  ],
  cafe:[
    {id:'coffee',label:'Prendre quelque chose tranquillement',short:'Prendre un café',minutes:35,energy:2,stress:-3,relationship:0},
    {id:'stay',label:'Rester encore un moment',short:'Rester',minutes:45,energy:1,stress:-2,relationship:0},
    {id:'watch',label:'Regarder la ville passer',short:'Observer',minutes:25,energy:0,stress:-2,relationship:0},
  ],
  arenes:[
    {id:'around',label:'Faire le tour des arènes',short:'Faire le tour',minutes:30,energy:-2,stress:-1,relationship:0},
    {id:'pause',label:'Rester un moment sur la place',short:'Rester ici',minutes:25,energy:0,stress:-1,relationship:0},
    {id:'atmosphere',label:'Prendre l’ambiance du lieu',short:'Profiter',minutes:20,energy:0,stress:-1,relationship:0},
  ],
  station:[
    {id:'platform',label:'Attendre tranquillement',short:'Attendre',minutes:20,energy:0,stress:1,relationship:0},
    {id:'coffee',label:'Prendre quelque chose avant de partir',short:'Prendre un café',minutes:20,energy:2,stress:-1,relationship:0},
    {id:'hall',label:'Rester dans le hall quelques minutes',short:'Rester',minutes:15,energy:0,stress:0,relationship:0},
  ],
};
const ROUTES:Record<Place,Route[]>={
  nimes:[{target:'home',label:'Rentrer chez Marion',minutes:12},{target:'cafe',label:'Aller au café',minutes:8},{target:'arenes',label:'Aller aux arènes',minutes:10},{target:'station',label:'Aller à la gare',minutes:15}],
  cafe:[{target:'nimes',label:'Revenir dans le centre',minutes:8},{target:'home',label:'Rentrer chez Marion',minutes:10},{target:'arenes',label:'Aller aux arènes',minutes:7},{target:'station',label:'Aller à la gare',minutes:16}],
  arenes:[{target:'nimes',label:'Revenir dans le centre',minutes:10},{target:'cafe',label:'Passer au café',minutes:7},{target:'home',label:'Rentrer chez Marion',minutes:12},{target:'station',label:'Aller à la gare',minutes:18}],
  station:[{target:'nimes',label:'Revenir dans le centre',minutes:15},{target:'home',label:'Rentrer chez Marion',minutes:18},{target:'cafe',label:'Passer au café',minutes:16}],
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:nimes-city-changed'));return true}catch{return false}}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function addMinutes(s:Save,minutes:number){const p=String(s.time||'12:00').split(':').map(Number);let total=(p[0]||12)*60+(p[1]||0)+minutes;while(total>=1440){total-=1440;s.day=Math.max(1,Number(s.day||1)+1)}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function isPlace(v:unknown):v is Place{return v==='nimes'||v==='cafe'||v==='arenes'||v==='station'}
function active(s:Save|null){return Boolean(s&&isPlace(s.place)&&(!s.screen||s.screen==='game'))}
function hour(time?:string){return Number(String(time||'12:00').slice(0,2))||12}
function period(time?:string){const h=hour(time);return h<7?'night':h<11?'morning':h<18?'day':h<21?'evening':'night'}
function host(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function remove(){document.getElementById('moniaNimesCityLife')?.remove()}

export function doNimesCityAction(actionId:string){const s=read();if(!s||!isPlace(s.place))return false;const action=ACTIONS[s.place].find(a=>a.id===actionId);if(!action)return false;addMinutes(s,action.minutes);s.energy=clamp(Number(s.energy??70)+action.energy);s.stress=clamp(Number(s.stress??20)+action.stress);s.relationship=clamp(Number(s.relationship??50)+action.relationship);const f=s.flags||(s.flags={});f.lastNimesCityAction=`${s.place}:${action.id}`;return write(s)}

export function travelInNimes(target:Target){const s=read();if(!s||!isPlace(s.place))return false;const route=ROUTES[s.place].find(r=>r.target===target);if(!route)return false;addMinutes(s,route.minutes);s.energy=clamp(Number(s.energy??70)-1);const f=s.flags||(s.flags={});f.lastNimesTravel=`${s.place}>${target}`;s.place=target;const ok=write(s);if(ok&&target==='home')window.dispatchEvent(new CustomEvent('monia:nimes-home-arrival'));return ok}

function possibleMoment(s:Save,place:Place):Moment|null{const day=Math.max(1,Number(s.day||1));if(day<3||(place!=='cafe'&&place!=='arenes'))return null;const f=s.flags||(s.flags={});const last=Number(f.lastNimesCityMomentDay||-99);if(day-last<4)return null;const slot=Math.floor(hour(s.time)/3);if((day*7+slot+(place==='cafe'?2:5))%6!==0)return null;const key=`${place}:${day}:${slot}`;if(f.lastNimesCityMomentKey===key)return null;if(place==='cafe')return{key,title:'Un petit imprévu',text:'Quelqu’un que Marion connaît de vue lui fait signe depuis une table voisine.',choices:[{id:'hello',label:'Aller dire bonjour',minutes:20,stress:-1},{id:'quiet',label:'Rester tranquillement',minutes:10,stress:-2}]};return{key,title:'Sur la place',text:'L’ambiance change doucement autour des arènes et Marion hésite à rester encore un peu.',choices:[{id:'stay',label:'Rester voir',minutes:25,energy:-1,stress:-1},{id:'move',label:'Continuer sa route',minutes:10}]}}
function resolveMoment(moment:Moment,choiceId:string){const s=read();if(!s||!isPlace(s.place))return false;const choice=moment.choices.find(c=>c.id===choiceId);if(!choice)return false;addMinutes(s,choice.minutes);s.energy=clamp(Number(s.energy??70)+Number(choice.energy||0));s.stress=clamp(Number(s.stress??20)+Number(choice.stress||0));s.relationship=clamp(Number(s.relationship??50)+Number(choice.relationship||0));const f=s.flags||(s.flags={});f.lastNimesCityMomentKey=moment.key;f.lastNimesCityMomentDay=Math.max(1,Number(s.day||1));return write(s)}

function render(){const s=read();if(!active(s)){remove();return}const place=s!.place as Place;let root=document.getElementById('moniaNimesCityLife');if(!root){root=document.createElement('div');root.id='moniaNimesCityLife';root.className='nimesCityLife';host().appendChild(root)}root.dataset.place=place;root.dataset.period=period(s!.time);root.style.backgroundImage=`url("${VIEWS[place]}")`;const actions=ACTIONS[place];const routes=ROUTES[place];const moment=possibleMoment(s!,place);root.innerHTML=`<div class="nimesCityAtmos"><i></i><i></i></div><div class="nimesCityRoutes">${routes.map(r=>`<button data-nimes-route="${r.target}" title="${r.label}">${r.label}<small>${r.minutes} min</small></button>`).join('')}</div>${moment?`<div class="nimesCityMoment"><span>${moment.title}</span><p>${moment.text}</p><div>${moment.choices.map(c=>`<button data-nimes-moment="${c.id}">${c.label}</button>`).join('')}</div></div>`:''}<div class="nimesCityActions">${actions.map(a=>`<button data-nimes-city-action="${a.id}" title="${a.label}"><b>${a.short}</b><small>${a.minutes} min</small></button>`).join('')}</div>`;root.querySelectorAll<HTMLButtonElement>('[data-nimes-city-action]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();doNimesCityAction(btn.dataset.nimesCityAction||'')});root.querySelectorAll<HTMLButtonElement>('[data-nimes-route]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();travelInNimes(btn.dataset.nimesRoute as Target)});if(moment)root.querySelectorAll<HTMLButtonElement>('[data-nimes-moment]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();resolveMoment(moment,btn.dataset.nimesMoment||'')})}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}window.addEventListener('storage',schedule);window.addEventListener('monia:nimes-city-changed',schedule as EventListener);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();

declare global{interface Window{__moniaNimesCityAction?:(actionId:string)=>boolean;__moniaNimesTravel?:(target:Target)=>boolean}}
window.__moniaNimesCityAction=doNimesCityAction;window.__moniaNimesTravel=travelInNimes;
