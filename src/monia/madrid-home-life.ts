import './madrid-home-life.css';
import './madrid-life-moments';
import {getPropertyLifeSnapshot} from './property-life';

const SAVE_KEY='marion-lucas-save-v4';
const STATE_KEY='marion-lucas-madrid-home-v1';

type Space='terrace'|'living'|'kitchen'|'bedroom'|'study';
type Save={day?:number;time?:string;place?:string;screen?:string;energy?:number;stress?:number;relationship?:number;flags?:Record<string,unknown>};
type State={version:1;settledDay?:number;sharedMoments:number;spaceUses:Record<Space,number>};
const DEFAULT:State={version:1,sharedMoments:0,spaceUses:{terrace:0,living:0,kitchen:0,bedroom:0,study:0}};

const ACTIONS={
  terrace:{label:'Prendre l’air sur la terrasse',short:'Terrasse',minutes:35,energy:0,stress:-5,relationship:1},
  living:{label:'Se retrouver au salon',short:'Salon',minutes:45,energy:2,stress:-4,relationship:2},
  kitchen:{label:'Partager un repas à la maison',short:'Cuisine',minutes:70,energy:1,stress:-3,relationship:3},
  bedroom:{label:'Se retirer un moment',short:'Chambre',minutes:50,energy:4,stress:-5,relationship:2},
  study:{label:'Passer par le bureau de Lucas',short:'Bureau',minutes:35,energy:-1,stress:0,relationship:1},
} as const;

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function writeSave(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:madrid-home-changed'));return true}catch{return false}}
function readState():State{try{const raw=localStorage.getItem(STATE_KEY);if(!raw)return structuredClone(DEFAULT);const p=JSON.parse(raw) as Partial<State>;return{...structuredClone(DEFAULT),...p,version:1,spaceUses:{...DEFAULT.spaceUses,...(p.spaceUses||{})}}}catch{return structuredClone(DEFAULT)}}
function writeState(s:State){try{localStorage.setItem(STATE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:madrid-home-changed'));return true}catch{return false}}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function addMinutes(save:Save,minutes:number){const p=String(save.time||'12:00').split(':').map(Number);let total=(p[0]||12)*60+(p[1]||0)+minutes;while(total>=1440){total-=1440;save.day=Math.max(1,Number(save.day||1)+1)}save.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function madridIsHome(){const snap=getPropertyLifeSnapshot();return snap.primary?.id==='lucas-madrid-house'}
function active(){const s=readSave();return Boolean(s&&madridIsHome()&&s.place==='madrid')}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}

export function doMadridHomeAction(space:Space){const save=readSave();if(!save||!active())return false;const state=readState();if(!state.settledDay)state.settledDay=Number(save.day||1);const a=ACTIONS[space];addMinutes(save,a.minutes);save.energy=clamp(Number(save.energy??70)+a.energy);save.stress=clamp(Number(save.stress??20)+a.stress);save.relationship=clamp(Number(save.relationship??50)+a.relationship);const f=save.flags||(save.flags={});f.lastMadridHomeSpace=space;f.madridHomeShared=true;state.sharedMoments++;state.spaceUses[space]=(state.spaceUses[space]||0)+1;writeState(state);writeSave(save);return true}

function contextual(save:Save):Space[]{const h=Number(String(save.time||'12:00').slice(0,2))||12;if(h<10)return['kitchen','terrace','living'];if(h<17)return['study','terrace','living'];if(h<21)return['kitchen','terrace','living'];return['living','bedroom','terrace']}
function host(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function remove(){document.getElementById('moniaMadridHomeActions')?.remove()}
function render(){const save=readSave();if(!save||!active()||(save.screen&&save.screen!=='game')){remove();return}let root=document.getElementById('moniaMadridHomeActions');if(!root){root=document.createElement('div');root.id='moniaMadridHomeActions';root.className='madridHomeActions';host().appendChild(root)}const state=readState();const spaces=contextual(save);const label=state.sharedMoments>=8?'Chez eux à Madrid':state.sharedMoments>=3?'Ils prennent leurs habitudes':'Chez Lucas';root.innerHTML=`<div class="madridHomeStatus"><span>${esc(label)}</span><small>${esc(String(save.time||''))}</small></div><div class="madridHomeButtons">${spaces.map(space=>`<button data-madrid-space="${space}" title="${esc(ACTIONS[space].label)}"><b>${esc(ACTIONS[space].short)}</b><small>${ACTIONS[space].minutes} min</small></button>`).join('')}</div>`;root.querySelectorAll<HTMLButtonElement>('[data-madrid-space]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();if(doMadridHomeAction(btn.dataset.madridSpace as Space))render()})}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}window.addEventListener('storage',schedule);window.addEventListener('monia:property-changed',schedule as EventListener);window.addEventListener('monia:madrid-home-changed',schedule as EventListener);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();

declare global{interface Window{__moniaMadridHomeAction?:(space:Space)=>boolean}}
window.__moniaMadridHomeAction=doMadridHomeAction;
