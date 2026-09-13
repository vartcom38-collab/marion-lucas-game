import './nimes-home-life.css';
import './nimes-city-life';

const SAVE_KEY='marion-lucas-save-v4';
type Space='living'|'kitchen'|'bedroom'|'study';
type View='hero'|Space;
type Save={place?:string;screen?:string;time?:string;energy?:number;stress?:number;flags?:Record<string,unknown>};

const VIEWS:Record<View,string>={
  hero:'./resources/nimes/marion-apartment-exterior.webp',
  living:'./resources/nimes/marion-apartment-living.webp',
  kitchen:'./resources/nimes/marion-apartment-kitchen.webp',
  bedroom:'./resources/nimes/marion-apartment-bedroom.webp',
  study:'./resources/nimes/marion-apartment-study.webp',
};
const ACTIONS={
  living:{label:'Se poser au salon',short:'Salon'},
  kitchen:{label:'Passer par la cuisine',short:'Cuisine'},
  bedroom:{label:'Aller dans la chambre',short:'Chambre'},
  study:{label:'Lire ou avancer sur un projet',short:'Coin lecture'},
} as const;
function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:nimes-home-changed'));return true}catch{return false}}
function active(s:Save|null){return Boolean(s&&s.place==='home'&&(!s.screen||s.screen==='game'))}
function period(time?:string){const h=Number(String(time||'12:00').slice(0,2))||12;return h<7?'night':h<11?'morning':h<18?'day':h<21?'evening':'night'}
function current(s:Save):View{if(s.flags?.showNimesHomeExterior)return'hero';const v=s.flags?.lastNimesHomeSpace;return v==='living'||v==='kitchen'||v==='bedroom'||v==='study'?v:'living'}
function host(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function remove(){document.getElementById('moniaNimesHome')?.remove()}
function choose(space:Space){const save=read();if(!save)return;const f=save.flags||(save.flags={});delete f.showNimesHomeExterior;f.lastNimesHomeSpace=space;write(save)}
export function showNimesHomeArrival(){const save=read();if(!save)return false;const f=save.flags||(save.flags={});f.showNimesHomeExterior=true;save.place='home';write(save);window.setTimeout(()=>{const latest=read();if(!latest||latest.place!=='home')return;const flags=latest.flags||(latest.flags={});delete flags.showNimesHomeExterior;if(!flags.lastNimesHomeSpace)flags.lastNimesHomeSpace='living';write(latest)},1800);return true}
function render(){const s=read();if(!active(s)){remove();return}const view=current(s!);let root=document.getElementById('moniaNimesHome');if(!root){root=document.createElement('section');root.id='moniaNimesHome';root.className='nimesHomePhoto';host().appendChild(root)}root.dataset.space=view;root.dataset.period=period(s!.time);root.style.backgroundImage=`url("${VIEWS[view]}")`;const buttons=view==='hero'?'':`<div class="nimesHomeActions">${(Object.keys(ACTIONS) as Space[]).map(k=>`<button data-nimes-space="${k}" class="${k===view?'isActive':''}" title="${ACTIONS[k].label}">${ACTIONS[k].short}</button>`).join('')}</div>`;root.innerHTML=`<div class="nimesHomeShade"></div><div class="nimesHomeLeaves"></div><div class="nimesHomeWarmth"></div>${buttons}`;root.querySelectorAll<HTMLButtonElement>('[data-nimes-space]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();choose(btn.dataset.nimesSpace as Space)})}
let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
window.addEventListener('storage',schedule);window.addEventListener('monia:nimes-home-changed',schedule as EventListener);window.addEventListener('monia:nimes-home-arrival',()=>{showNimesHomeArrival();schedule()});new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();

declare global{interface Window{__moniaShowNimesHomeArrival?:()=>boolean}}
window.__moniaShowNimesHomeArrival=showNimesHomeArrival;
