import './living-ambient-motion.css';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={time?:string;place?:string;screen?:string;overlay?:unknown};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function phase(t?:string){const m=mins(t);return m<420?'night':m<600?'dawn':m<1020?'day':m<1200?'golden':m<1320?'evening':'night'}
function remove(){document.getElementById('moniaAmbientMotion')?.remove();document.documentElement.removeAttribute('data-monia-ambient');}

function eligible(){const s=read();if(!s)return false;if(s.screen&&s.screen!=='game')return false;if(document.querySelector('.modal,.overlay.show,[data-open="true"].phoneDevice,.surprise-player'))return false;return true}

function mount(){
  if(!eligible()){remove();return}
  const s=read();if(!s)return;
  const seasonal=getSeasonalLifeSnapshot();
  let root=document.getElementById('moniaAmbientMotion');
  if(!root){root=document.createElement('div');root.id='moniaAmbientMotion';root.className='moniaAmbientMotion';root.setAttribute('aria-hidden','true');document.body.appendChild(root)}
  const p=phase(s.time);const weather=seasonal?.weather||'clear';const season=seasonal?.season||'spring';
  root.className=`moniaAmbientMotion phase-${p} weather-${weather} season-${season}`;
  root.innerHTML=`<span class="ambientLight"></span><span class="ambientShade"></span><span class="ambientWind one"></span><span class="ambientWind two"></span><span class="ambientRain one"></span><span class="ambientRain two"></span><span class="ambientDust one"></span><span class="ambientDust two"></span>`;
  document.documentElement.dataset.moniaAmbient=`${p}-${weather}-${season}`;
}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(mount)}
window.addEventListener('storage',schedule);window.addEventListener('monia:save-changed',schedule);window.addEventListener('monia:daily-intent',()=>setTimeout(schedule,120));
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-open']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

declare global{interface Window{__moniaRefreshAmbientMotion?:()=>void}}
window.__moniaRefreshAmbientMotion=schedule;
