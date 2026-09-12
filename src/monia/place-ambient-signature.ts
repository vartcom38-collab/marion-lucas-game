import './place-ambient-signature.css';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={place?:string;time?:string;screen?:string};
type PlaceKind='home-nimes'|'nimes-street'|'cafe'|'arenes'|'station'|'madrid'|'finca'|'estate'|'hotel'|'spain-city'|'generic';

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function placeKind(place:string):PlaceKind{const p=place.toLowerCase();if(/home|appart|nimes-home/.test(p))return'home-nimes';if(/cafe|café/.test(p))return'cafe';if(/arene|arena|arenes|arènes/.test(p))return'arenes';if(/station|gare/.test(p))return'station';if(/madrid/.test(p))return'madrid';if(/finca/.test(p))return'finca';if(/estate|family/.test(p))return'estate';if(/hotel/.test(p))return'hotel';if(/nimes|nîmes/.test(p))return'nimes-street';if(/spain|espagne|sevill|andal|salam/.test(p))return'spain-city';return'generic'}
function eligible(s:Save){return !s.screen||s.screen==='game'}
function remove(){document.getElementById('moniaPlaceAmbient')?.remove();document.documentElement.removeAttribute('data-monia-place-kind')}

function mount(){const s=read();if(!s||!eligible(s)){remove();return}const kind=placeKind(String(s.place||'home'));const seasonal=getSeasonalLifeSnapshot();let root=document.getElementById('moniaPlaceAmbient');if(!root){root=document.createElement('div');root.id='moniaPlaceAmbient';root.className='moniaPlaceAmbient';root.setAttribute('aria-hidden','true');document.body.appendChild(root)}root.className=`moniaPlaceAmbient place-${kind} weather-${seasonal?.weather||'clear'}`;root.innerHTML=`<span class="placeGlow"></span><span class="placeTexture"></span><span class="placeMotion a"></span><span class="placeMotion b"></span>`;document.documentElement.dataset.moniaPlaceKind=kind}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(mount)}
window.addEventListener('storage',schedule);window.addEventListener('monia:save-changed',schedule);window.addEventListener('monia:daily-intent',()=>setTimeout(schedule,100));
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

declare global{interface Window{__moniaRefreshPlaceAmbient?:()=>void}}
window.__moniaRefreshPlaceAmbient=schedule;
