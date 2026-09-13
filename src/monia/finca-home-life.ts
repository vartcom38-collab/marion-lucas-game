import './finca-home-life.css';
import {getPropertyLifeSnapshot} from './property-life';
import {PROPERTY_VISUAL_ASSETS} from './property-visual-assets';

const SAVE_KEY='marion-lucas-save-v4';
const FINCA_KEY='marion-lucas-finca-home-v1';

type FincaSpace='courtyard'|'living'|'kitchen'|'grounds'|'annex';
type FincaState={version:1;propertyId?:string;settledDay?:number;care:number;comfort:number;identity:number;lastActionDay?:number;visits:number;upgrades:string[];spaceUses:Record<FincaSpace,number>};
type Save={day?:number;time?:string;place?:string;screen?:string;energy?:number;stress?:number;relationship?:number;flags?:Record<string,unknown>};

const DEFAULT: FincaState={version:1,care:15,comfort:20,identity:10,visits:0,upgrades:[],spaceUses:{courtyard:0,living:0,kitchen:0,grounds:0,annex:0}};
const FINCA_VIEWS:Record<string,Record<'hero'|FincaSpace,string>>={
  'Finca de chênes et pâtures':{hero:'salamanca-finca-exterior',courtyard:'salamanca-finca-patio',living:'salamanca-finca-patio',kitchen:'salamanca-finca-patio',grounds:'salamanca-finca-land',annex:'salamanca-finca-land'},
  'Finca blanche près de Tolède':{hero:'toledo-finca-exterior',courtyard:'toledo-finca-patio',living:'toledo-finca-patio',kitchen:'toledo-finca-patio',grounds:'toledo-finca-olive',annex:'toledo-finca-olive'},
  'Domaine en Estrémadure':{hero:'extremadura-estate-exterior',courtyard:'extremadura-estate-courtyard',living:'extremadura-estate-courtyard',kitchen:'extremadura-estate-courtyard',grounds:'extremadura-estate-land',annex:'extremadura-estate-land'},
  'Maison andalouse avec terres':{hero:'jerez-finca-exterior',courtyard:'jerez-finca-courtyard',living:'jerez-finca-courtyard',kitchen:'jerez-finca-courtyard',grounds:'jerez-finca-land',annex:'jerez-finca-land'},
};
function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function writeSave(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:finca-home-changed'));return true}catch{return false}}
function readState():FincaState{try{const raw=localStorage.getItem(FINCA_KEY);if(!raw)return structuredClone(DEFAULT);const p=JSON.parse(raw) as Partial<FincaState>;return{...structuredClone(DEFAULT),...p,version:1,upgrades:Array.isArray(p.upgrades)?p.upgrades:[],spaceUses:{...DEFAULT.spaceUses,...(p.spaceUses||{})}}}catch{return structuredClone(DEFAULT)}}
function writeState(s:FincaState){try{localStorage.setItem(FINCA_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:finca-home-changed'));return true}catch{return false}}
function currentFinca(){const snap=getPropertyLifeSnapshot();return snap.primary?.kind==='finca'&&snap.primary.owner==='joint'?snap.primary:null}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function addMinutes(save:Save,minutes:number){const current=String(save.time||'09:00').split(':').map(Number);let total=(current[0]||9)*60+(current[1]||0)+minutes;while(total>=1440){total-=1440;save.day=Math.max(1,Number(save.day||1)+1)}save.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function syncProperty(state:FincaState){const finca=currentFinca(),save=readSave();if(!finca||!save)return null;if(state.propertyId!==finca.id){state.propertyId=finca.id;state.settledDay=Number(save.day||1);state.care=18;state.comfort=20;state.identity=12;state.visits=0;state.upgrades=[];state.spaceUses={...DEFAULT.spaceUses};writeState(state)}return finca}

export function getFincaHomeSnapshot(){const state=readState(),finca=syncProperty(state);return{active:Boolean(finca),property:finca,state};}

const ACTIONS={
  courtyard:{label:'Prendre un moment dans la cour',short:'Cour',minutes:35,energy:-2,stress:-7,relationship:1,care:1,comfort:2,identity:1},
  living:{label:'S’installer dans le salon',short:'Salon',minutes:45,energy:1,stress:-6,relationship:1,care:0,comfort:3,identity:2},
  kitchen:{label:'Préparer quelque chose ensemble',short:'Cuisine',minutes:70,energy:-4,stress:-3,relationship:3,care:2,comfort:2,identity:2},
  grounds:{label:'Faire le tour des terres',short:'Terres',minutes:80,energy:-7,stress:-4,relationship:1,care:4,comfort:0,identity:2},
  annex:{label:'S’occuper des dépendances',short:'Dépendances',minutes:95,energy:-9,stress:1,relationship:1,care:6,comfort:1,identity:2},
} as const;

export function doFincaHomeAction(space:FincaSpace){const finca=currentFinca(),save=readSave();if(!finca||!save)return false;const state=readState();syncProperty(state);const a=ACTIONS[space];addMinutes(save,a.minutes);save.energy=clamp(Number(save.energy??70)+a.energy);save.stress=clamp(Number(save.stress??20)+a.stress);save.relationship=clamp(Number(save.relationship??50)+a.relationship);save.place='estate';const flags=save.flags||(save.flags={});flags.fincaHomeActive=true;flags.lastFincaHomeAction=space;state.care=clamp(state.care+a.care);state.comfort=clamp(state.comfort+a.comfort);state.identity=clamp(state.identity+a.identity);state.spaceUses[space]=(state.spaceUses[space]||0)+1;state.lastActionDay=Number(save.day||1);state.visits++;
  if(state.care>=35&&!state.upgrades.includes('grounds-routine'))state.upgrades.push('grounds-routine');
  if(state.comfort>=40&&!state.upgrades.includes('home-settled'))state.upgrades.push('home-settled');
  if(state.identity>=45&&!state.upgrades.includes('their-place'))state.upgrades.push('their-place');
  writeState(state);writeSave(save);return true;}

function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function bar(label:string,value:number){return `<div class="fincaMeter"><span>${esc(label)}</span><i><b style="width:${value}%"></b></i><strong>${value}</strong></div>`}
function spaceButton(space:FincaSpace,title:string,text:string){return `<button class="fincaSpace" data-finca-space="${space}"><strong>${esc(title)}</strong><span>${esc(text)}</span></button>`}

export function openFincaHome(){const snap=getFincaHomeSnapshot();if(!snap.active||!snap.property)return false;document.getElementById('moniaFincaHome')?.remove();const root=document.createElement('div');root.id='moniaFincaHome';root.className='moniaFincaHome';document.body.appendChild(root);const render=()=>{const now=getFincaHomeSnapshot();if(!now.active||!now.property){root.remove();return}const s=now.state;root.innerHTML=`<div class="fincaBackdrop" data-finca-close></div><section class="fincaPanel" role="dialog" aria-modal="true"><header><div><small>LEUR MAISON · ${esc(now.property.region.toUpperCase())}</small><h2>${esc(now.property.name)}</h2><p>Le lieu prend leur rythme à force d’y vivre. Rien ne se débloque d’un coup : la maison se construit dans les habitudes.</p></div><button data-finca-close aria-label="Fermer">×</button></header><div class="fincaBody"><section class="fincaProgress"><h3>Le lieu aujourd’hui</h3>${bar('Entretien',s.care)}${bar('Confort',s.comfort)}${bar('Leur empreinte',s.identity)}<p>${s.upgrades.includes('their-place')?'La finca commence vraiment à porter leur manière de vivre.':s.upgrades.includes('home-settled')?'Ils commencent à avoir leurs habitudes ici.':'Tout est encore récent. Le lieu doit être apprivoisé.'}</p></section><section class="fincaSpaces"><h3>Vivre ici</h3>${spaceButton('courtyard','Cour & patio','Se poser dehors, ralentir, parler ou simplement profiter du lieu.')}${spaceButton('living','Salon','Un espace plus intime pour récupérer et faire de la maison un refuge.')}${spaceButton('kitchen','Cuisine','Les repas et les gestes ordinaires installent les premières vraies habitudes.')}${spaceButton('grounds','Terres','Marcher, observer, vérifier ce qui demande de l’attention.')}${spaceButton('annex','Dépendances','Une partie plus exigeante du domaine, utile à entretenir sur la durée.')}</section></div></section>`;root.querySelectorAll<HTMLElement>('[data-finca-close]').forEach(el=>el.onclick=()=>root.remove());root.querySelectorAll<HTMLButtonElement>('[data-finca-space]').forEach(btn=>btn.onclick=()=>{doFincaHomeAction(btn.dataset.fincaSpace as FincaSpace);render()})};render();return true;}

function contextualSpaces(save:Save,state:FincaState):FincaSpace[]{
  const hour=Number(String(save.time||'12:00').slice(0,2))||12;
  if(hour<10)return ['kitchen','courtyard','grounds'];
  if(hour<17)return state.care<35?['grounds','annex','courtyard']:['grounds','courtyard','living'];
  if(hour<21)return ['kitchen','courtyard','living'];
  return ['living','courtyard','kitchen'];
}
function shouldShowSceneActions(){const save=readSave();return Boolean(currentFinca()&&save&&save.place==='estate'&&(save.screen===undefined||save.screen==='game'));}
function sceneHost(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function removeSceneActions(){document.getElementById('moniaFincaSceneActions')?.remove()}
function currentViewKey(save:Save,fincaName:string){
  const views=FINCA_VIEWS[fincaName];if(!views)return null;
  const last=save.flags?.lastFincaHomeAction;
  if(last==='courtyard'||last==='living'||last==='kitchen'||last==='grounds'||last==='annex')return views[last];
  return views.hero;
}
function syncEstateVisual(){
  const save=readSave(),finca=currentFinca();if(!save||save.place!=='estate'||!finca)return;
  const key=currentViewKey(save,finca.name);if(!key)return;const src=PROPERTY_VISUAL_ASSETS[key]||`./resources/properties/${key}.webp`;
  const photo=document.querySelector<HTMLImageElement>('img.worldPhoto,.worldPhoto img,img[data-world-photo]');
  if(photo&&photo.dataset.fincaViewKey!==key){photo.dataset.fincaViewKey=key;photo.src=src;photo.alt=finca.name;}
  const background=document.querySelector<HTMLElement>('.worldPhoto:not(img),.worldBackdrop,.worldSceneBackground');
  if(background&&background.dataset.fincaViewKey!==key){background.dataset.fincaViewKey=key;background.style.backgroundImage=`url("${src}")`;}
}
function renderSceneActions(){
  if(!shouldShowSceneActions()){removeSceneActions();return}
  const save=readSave();if(!save)return;const state=readState();syncProperty(state);let root=document.getElementById('moniaFincaSceneActions');
  if(!root){root=document.createElement('div');root.id='moniaFincaSceneActions';root.className='fincaSceneActions';sceneHost().appendChild(root)}
  const spaces=contextualSpaces(save,state);
  const mood=state.identity>=45?'Chez eux':state.comfort>=40?'Ils prennent leurs habitudes':'Encore nouveau';
  root.innerHTML=`<div class="fincaSceneStatus"><span>${esc(mood)}</span><small>${esc(String(save.time||''))}</small></div><div class="fincaSceneButtons">${spaces.map(space=>`<button data-finca-scene-space="${space}" title="${esc(ACTIONS[space].label)}"><b>${esc(ACTIONS[space].short)}</b><small>${ACTIONS[space].minutes} min</small></button>`).join('')}<button class="fincaSceneMore" data-finca-scene-more title="Voir toute la finca"><b>•••</b><small>Maison</small></button></div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-finca-scene-space]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const space=btn.dataset.fincaSceneSpace as FincaSpace;if(doFincaHomeAction(space)){syncEstateVisual();renderSceneActions()}});
  root.querySelector<HTMLButtonElement>('[data-finca-scene-more]')?.addEventListener('click',e=>{e.stopPropagation();openFincaHome()});
}

function ensureEntry(){const active=Boolean(currentFinca());document.querySelectorAll<HTMLElement>('[data-finca-home-entry]').forEach(el=>{if(!active)el.remove()});if(!active||document.querySelector('[data-finca-home-entry]'))return;const nav=document.querySelector<HTMLElement>('.premiumNav');if(!nav)return;const b=document.createElement('button');b.type='button';b.dataset.fincaHomeEntry='1';b.title='La finca';b.setAttribute('aria-label','La finca');b.className='fincaHomeNavEntry';b.innerHTML='<b aria-hidden="true">⌂</b><span>La finca</span>';b.onclick=()=>openFincaHome();nav.appendChild(b)}
let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{ensureEntry();syncEstateVisual();renderSceneActions()})}window.addEventListener('monia:property-changed',schedule as EventListener);window.addEventListener('monia:finca-home-changed',schedule as EventListener);window.addEventListener('storage',schedule);new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();

declare global{interface Window{__moniaFincaHome?:()=>ReturnType<typeof getFincaHomeSnapshot>;__moniaOpenFincaHome?:()=>boolean;__moniaDoFincaHomeAction?:(space:FincaSpace)=>boolean}}
window.__moniaFincaHome=getFincaHomeSnapshot;window.__moniaOpenFincaHome=openFincaHome;window.__moniaDoFincaHomeAction=doFincaHomeAction;
