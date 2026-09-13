import './gameplay-visio-director';
import {getLucasCommunicationPolicy} from './lucas-presence-engine';

const MANIFEST_URL='./config/monia-visio-approved.json';
const REQUEST_EVENT='marion-lucas:gameplay-visio';
const READY_EVENT='marion-lucas:gameplay-visio-ready';
let approved=false;
let checked=false;
let syncing=false;

type Manifest={status?:string;fallback?:string|null;states?:Record<string,string|null|undefined>};
function hasApproved(m:Manifest){return m.status==='locked'&&Boolean(m.fallback||Object.values(m.states||{}).some(Boolean))}
async function refreshManifest(){try{const r=await fetch(`${MANIFEST_URL}?v=4`,{cache:'no-cache',credentials:'same-origin'});if(!r.ok)return;approved=hasApproved(await r.json() as Manifest);checked=true;syncButtons()}catch{checked=true;approved=false;syncButtons()}}
function syncButtons(){if(syncing)return;syncing=true;try{const policy=getLucasCommunicationPolicy();document.querySelectorAll<HTMLButtonElement>('[data-social-video-disabled],[data-social-video-request]').forEach(btn=>{const can=approved&&policy.mode==='connect';if(can){btn.classList.remove('isDisabled');btn.disabled=false;delete btn.dataset.socialVideoDisabled;btn.dataset.socialVideoRequest='lucas';btn.title='Lancer une visio avec Lucas';btn.textContent='Visio';}else{btn.classList.add('isDisabled');btn.disabled=true;delete btn.dataset.socialVideoRequest;btn.dataset.socialVideoDisabled='1';btn.textContent='Visio';btn.title=!checked?'Vérification des médias visio…':!approved?'Aucun clip visio Lucas approuvé':policy.mode==='local'?'Lucas est avec toi':policy.label;}})}finally{syncing=false}}

document.addEventListener('click',e=>{const t=e.target as HTMLElement|null;const btn=t?.closest<HTMLButtonElement>('[data-social-video-request]');if(!btn)return;e.preventDefault();e.stopPropagation();const policy=getLucasCommunicationPolicy();if(!approved||policy.mode!=='connect'){syncButtons();return}let day=1,time='';try{const s=JSON.parse(localStorage.getItem('marion-lucas-save-v4')||'{}');day=Number(s.day||1);time=String(s.time||'')}catch{}window.dispatchEvent(new CustomEvent(REQUEST_EVENT,{detail:{source:'gameplay',id:`phone-visio-${day}-${time}`,reason:'Marion choisit de lancer une visio depuis le téléphone.',priority:'normal',validForMinutes:5}}));},{capture:true});

window.addEventListener(READY_EVENT,()=>{const trigger=document.createElement('button');trigger.type='button';trigger.hidden=true;trigger.dataset.moniaVisio='1';document.body.appendChild(trigger);trigger.click();trigger.remove();});
window.addEventListener('marion:statechange',()=>window.setTimeout(syncButtons,0));window.addEventListener('marion:phone-refresh',syncButtons as EventListener);window.addEventListener('storage',syncButtons);document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncButtons();if(!checked)void refreshManifest()}});
void refreshManifest();
console.info('[Visio phone] approved-media and Lucas-availability gate active');
