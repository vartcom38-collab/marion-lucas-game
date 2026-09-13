import './nimes-home-life.css';
import './nimes-city-life';

const SAVE_KEY='marion-lucas-save-v4';
type Space='living'|'kitchen'|'bedroom'|'study';
type View='hero'|Space;
type Save={day?:number;place?:string;screen?:string;time?:string;energy?:number;stress?:number;memories?:string[];flags?:Record<string,unknown>};
type HomeAction={id:string;label:string;minutes:number;energy:number;stress:number};

const VIEWS:Record<View,string>={
  hero:'./resources/nimes/marion-apartment-exterior.webp',
  living:'./resources/nimes/marion-apartment-living.webp',
  kitchen:'./resources/nimes/marion-apartment-kitchen.webp',
  bedroom:'./resources/nimes/marion-apartment-bedroom.webp',
  study:'./resources/nimes/marion-apartment-study.webp',
};
const SPACES={
  living:{label:'Se poser au salon',short:'Salon'},
  kitchen:{label:'Passer par la cuisine',short:'Cuisine'},
  bedroom:{label:'Aller dans la chambre',short:'Chambre'},
  study:{label:'Lire ou avancer sur un projet',short:'Coin lecture'},
} as const;
const LIFE_ACTIONS:Record<Space,HomeAction[]>={
  living:[
    {id:'settle',label:'Se poser un moment',minutes:30,energy:2,stress:-4},
    {id:'music',label:'Mettre un peu de musique',minutes:20,energy:1,stress:-3},
    {id:'quiet',label:'Profiter du calme',minutes:25,energy:2,stress:-3},
  ],
  kitchen:[
    {id:'eat',label:'Préparer quelque chose à manger',minutes:30,energy:6,stress:-1},
    {id:'drink',label:'Prendre quelque chose tranquillement',minutes:15,energy:2,stress:-1},
    {id:'cook',label:'Cuisiner sans se presser',minutes:45,energy:4,stress:-3},
  ],
  bedroom:[
    {id:'rest',label:'S’allonger un moment',minutes:45,energy:9,stress:-5},
    {id:'prepare',label:'Prendre le temps de se préparer',minutes:25,energy:1,stress:-2},
    {id:'slow',label:'Rester encore un peu au calme',minutes:30,energy:4,stress:-4},
  ],
  study:[
    {id:'read',label:'Lire tranquillement',minutes:35,energy:1,stress:-4},
    {id:'project',label:'Avancer sur quelque chose',minutes:50,energy:-3,stress:-1},
    {id:'notes',label:'Mettre quelques idées au clair',minutes:25,energy:-1,stress:-2},
  ],
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:nimes-home-changed'));return true}catch{return false}}
function active(s:Save|null){return Boolean(s&&s.place==='home'&&(!s.screen||s.screen==='game'))}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function addMinutes(s:Save,minutes:number){const [h,m]=String(s.time||'09:00').split(':').map(Number);let total=(h||9)*60+(m||0)+minutes;while(total>=1440){total-=1440;s.day=Math.max(1,Number(s.day||1)+1)}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function period(time?:string){const h=Number(String(time||'12:00').slice(0,2))||12;return h<7?'night':h<11?'morning':h<18?'day':h<21?'evening':'night'}
function current(s:Save):View{if(s.flags?.showNimesHomeExterior)return'hero';const v=s.flags?.lastNimesHomeSpace;return v==='living'||v==='kitchen'||v==='bedroom'||v==='study'?v:'living'}
function host(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function remove(){document.getElementById('moniaNimesHome')?.remove()}
function choose(space:Space){const save=read();if(!save)return;const f=save.flags||(save.flags={});delete f.showNimesHomeExterior;f.lastNimesHomeSpace=space;write(save)}

export function doNimesHomeAction(actionId:string){
  const s=read();if(!s||s.place!=='home')return false;
  const view=current(s);if(view==='hero')return false;
  const action=LIFE_ACTIONS[view].find(a=>a.id===actionId);if(!action)return false;
  addMinutes(s,action.minutes);s.energy=clamp(Number(s.energy??70)+action.energy);s.stress=clamp(Number(s.stress??20)+action.stress);
  const f=s.flags||(s.flags={});f.lastNimesHomeAction=`${view}:${action.id}`;f.lastNimesHomeActionDay=Number(s.day||1);f.lastNimesHomeActionTime=String(s.time||'');
  return write(s);
}

export function leaveNimesHome(){
  const s=read();if(!s||s.place!=='home')return false;
  addMinutes(s,12);s.energy=clamp(Number(s.energy??70)-1);const f=s.flags||(s.flags={});f.lastNimesTravel='home>nimes';f.arrivalFrom='home';f.arrivalPlace='nimes';f.arrivalMinutes=12;s.place='nimes';
  const ok=write(s);if(ok)window.dispatchEvent(new CustomEvent('monia:nimes-city-changed'));return ok;
}

export function showNimesHomeArrival(){const save=read();if(!save)return false;const f=save.flags||(save.flags={});f.showNimesHomeExterior=true;save.place='home';write(save);window.setTimeout(()=>{const latest=read();if(!latest||latest.place!=='home')return;const flags=latest.flags||(latest.flags={});delete flags.showNimesHomeExterior;if(!flags.lastNimesHomeSpace)flags.lastNimesHomeSpace='living';write(latest)},1800);return true}

let lastSignature='';
function render(){
  const s=read();if(!active(s)){lastSignature='';remove();return}
  const view=current(s!);const signature=`${view}|${period(s!.time)}|${s!.time}|${s!.energy}|${s!.stress}`;
  let root=document.getElementById('moniaNimesHome');
  if(root&&signature===lastSignature)return;
  if(!root){root=document.createElement('section');root.id='moniaNimesHome';root.className='nimesHomePhoto';host().appendChild(root)}
  lastSignature=signature;root.dataset.space=view;root.dataset.period=period(s!.time);root.style.backgroundImage=`url("${VIEWS[view]}")`;
  const spaceNav=view==='hero'?'':`<div class="nimesHomeActions nimesHomeSpaces">${(Object.keys(SPACES) as Space[]).map(k=>`<button data-nimes-space="${k}" class="${k===view?'isActive':''}" title="${SPACES[k].label}">${SPACES[k].short}</button>`).join('')}</div>`;
  const life=view==='hero'?'':`<div class="nimesHomeLifeActions">${LIFE_ACTIONS[view].map(a=>`<button data-nimes-home-action="${a.id}" title="${a.label}"><b>${a.label}</b><small>${a.minutes} min</small></button>`).join('')}<button data-nimes-leave="1"><b>Sortir dans Nîmes</b><small>12 min</small></button></div>`;
  root.innerHTML=`<div class="nimesHomeShade"></div><div class="nimesHomeLeaves"></div><div class="nimesHomeWarmth"></div>${life}${spaceNav}`;
  root.querySelectorAll<HTMLButtonElement>('[data-nimes-space]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();choose(btn.dataset.nimesSpace as Space)});
  root.querySelectorAll<HTMLButtonElement>('[data-nimes-home-action]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();doNimesHomeAction(btn.dataset.nimesHomeAction||'')});
  root.querySelector<HTMLButtonElement>('[data-nimes-leave]')?.addEventListener('click',e=>{e.stopPropagation();leaveNimesHome()});
}
let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
window.addEventListener('storage',schedule);window.addEventListener('monia:nimes-home-changed',schedule as EventListener);window.addEventListener('monia:nimes-home-arrival',()=>{showNimesHomeArrival();schedule()});new MutationObserver(mutations=>{if(mutations.some(m=>!(m.target as Element)?.closest?.('#moniaNimesHome')))schedule()}).observe(document.body,{childList:true,subtree:true});schedule();

declare global{interface Window{__moniaShowNimesHomeArrival?:()=>boolean;__moniaNimesHomeAction?:(actionId:string)=>boolean;__moniaLeaveNimesHome?:()=>boolean}}
window.__moniaShowNimesHomeArrival=showNimesHomeArrival;window.__moniaNimesHomeAction=doNimesHomeAction;window.__moniaLeaveNimesHome=leaveNimesHome;
