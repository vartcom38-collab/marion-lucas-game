import './madrid-scene-ambient.css';

const SAVE_KEY='marion-lucas-save-v4';
type MadridSpace='terrace'|'living'|'kitchen'|'bedroom'|'study';
type Save={place?:string;screen?:string;time?:string;flags?:Record<string,unknown>};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function currentSpace(save:Save):MadridSpace|'hero'{const v=save.flags?.lastMadridHomeSpace;return v==='terrace'||v==='living'||v==='kitchen'||v==='bedroom'||v==='study'?v:'hero'}
function period(time?:string){const h=Number(String(time||'12:00').slice(0,2))||12;return h<7?'night':h<11?'morning':h<17?'day':h<21?'evening':'night'}
function sceneHost(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function active(save:Save|null){if(!save||save.place!=='madrid'||(save.screen!==undefined&&save.screen!=='game'))return false;const f=save.flags||{};return Boolean(f.visitingLucasMadrid||f.atLucasMadridHome||f.madridHomeVisit||f.stayingWithLucasMadrid||f.livingWithLucas||f.movedToMadrid||f.cohabitingMadrid)}
function remove(){document.getElementById('moniaMadridAmbient')?.remove()}

function render(){
  const save=readSave();if(!active(save)){remove();return}
  let root=document.getElementById('moniaMadridAmbient');
  if(!root){root=document.createElement('div');root.id='moniaMadridAmbient';root.className='madridSceneAmbient';root.setAttribute('aria-hidden','true');sceneHost().appendChild(root)}
  root.dataset.space=currentSpace(save!);root.dataset.period=period(save!.time);
  root.innerHTML='<i class="madridAmbientLight"></i><i class="madridAmbientLeaves"></i><i class="madridAmbientFire"></i><i class="madridAmbientAir"></i>';
}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
window.addEventListener('storage',schedule);window.addEventListener('monia:madrid-home-changed',schedule as EventListener);window.addEventListener('monia:madrid-life-moment',schedule as EventListener);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
