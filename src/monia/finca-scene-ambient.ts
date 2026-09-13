import './finca-scene-ambient.css';
import './nimes-home-life';

const SAVE_KEY='marion-lucas-save-v4';
type FincaSpace='courtyard'|'living'|'kitchen'|'grounds'|'annex';
type Save={place?:string;screen?:string;time?:string;flags?:Record<string,unknown>};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function currentSpace(save:Save):FincaSpace|'hero'{const v=save.flags?.lastFincaHomeAction;return v==='courtyard'||v==='living'||v==='kitchen'||v==='grounds'||v==='annex'?v:'hero'}
function period(time?:string){const h=Number(String(time||'12:00').slice(0,2))||12;return h<7?'night':h<11?'morning':h<17?'day':h<21?'evening':'night'}
function sceneHost(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function active(save:Save|null){return Boolean(save&&save.place==='estate'&&(save.screen===undefined||save.screen==='game'))}
function remove(){document.getElementById('moniaFincaAmbient')?.remove()}

function render(){
  const save=readSave();if(!active(save)){remove();return}
  let root=document.getElementById('moniaFincaAmbient');
  if(!root){root=document.createElement('div');root.id='moniaFincaAmbient';root.className='fincaSceneAmbient';root.setAttribute('aria-hidden','true');sceneHost().appendChild(root)}
  const space=currentSpace(save!);const when=period(save!.time);
  root.dataset.space=space;root.dataset.period=when;
  root.innerHTML='<i class="fincaAmbientLight"></i><i class="fincaAmbientLeaves"></i><i class="fincaAmbientAir"></i>';
}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
window.addEventListener('storage',schedule);window.addEventListener('monia:finca-home-changed',schedule as EventListener);window.addEventListener('monia:property-changed',schedule as EventListener);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
