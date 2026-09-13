import './nimes-home-life.css';

const SAVE_KEY='marion-lucas-save-v4';
type Space='living'|'kitchen'|'bedroom'|'study';
type Save={place?:string;screen?:string;time?:string;energy?:number;stress?:number;flags?:Record<string,unknown>};

const VIEWS:Record<'hero'|Space,string>={
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
function current(s:Save){const v=s.flags?.lastNimesHomeSpace;return v==='living'||v==='kitchen'||v==='bedroom'||v==='study'?v:'living'}
function host(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function remove(){document.getElementById('moniaNimesHome')?.remove()}
function render(){const s=read();if(!active(s)){remove();return}const space=current(s!);let root=document.getElementById('moniaNimesHome');if(!root){root=document.createElement('section');root.id='moniaNimesHome';root.className='nimesHomePhoto';host().appendChild(root)}if(root.dataset.space===space)return;root.dataset.space=space;root.style.backgroundImage=`url("${VIEWS[space]}")`;root.innerHTML=`<div class="nimesHomeShade"></div><div class="nimesHomeActions">${(Object.keys(ACTIONS) as Space[]).map(k=>`<button data-nimes-space="${k}" class="${k===space?'isActive':''}" title="${ACTIONS[k].label}">${ACTIONS[k].short}</button>`).join('')}</div>`;root.querySelectorAll<HTMLButtonElement>('[data-nimes-space]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const next=btn.dataset.nimesSpace as Space;const save=read();if(!save)return;const f=save.flags||(save.flags={});f.lastNimesHomeSpace=next;write(save);render()})}
let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
window.addEventListener('storage',schedule);window.addEventListener('monia:nimes-home-changed',schedule as EventListener);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
