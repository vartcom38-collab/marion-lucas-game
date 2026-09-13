import './madrid-region-life.css';
import {getPropertyLifeSnapshot} from './property-life';

const SAVE_KEY='marion-lucas-save-v4';
type Place='madrid'|'family';
type Save={day?:number;time?:string;place?:string;screen?:string;energy?:number;stress?:number;relationship?:number;flags?:Record<string,unknown>};
type Action={id:string;label:string;short:string;minutes:number;energy:number;stress:number;relationship:number};

const FAMILY_VIEWS={
  arrival:'./resources/family/family-exterior.webp',
  salon:'./resources/madrid/family-home-salon.webp',
  table:'./resources/madrid/family-home-table.webp',
  kitchen:'./resources/madrid/family-home-kitchen.webp',
  garden:'./resources/madrid/family-home-terrace.webp',
} as const;
type FamilyView=keyof typeof FAMILY_VIEWS;

const ACTIONS:Record<Place,Action[]>={
  madrid:[
    {id:'walk',label:'Marcher un peu dans le village ou les environs',short:'Marcher',minutes:35,energy:-2,stress:-3,relationship:0},
    {id:'coffee',label:'Prendre quelque chose tranquillement',short:'Prendre un café',minutes:30,energy:1,stress:-2,relationship:0},
    {id:'drive',label:'Faire un petit détour dans les environs',short:'Faire un tour',minutes:45,energy:-1,stress:-2,relationship:0},
  ],
  family:[
    {id:'salon',label:'Rester au salon avec tout le monde',short:'Salon',minutes:45,energy:2,stress:-3,relationship:2},
    {id:'table',label:'Rester un moment à table avec les proches',short:'À table',minutes:55,energy:1,stress:-2,relationship:2},
    {id:'kitchen',label:'Passer un moment dans la cuisine familiale',short:'Cuisine',minutes:40,energy:1,stress:-3,relationship:1},
    {id:'garden',label:'Prendre l’air autour de la maison',short:'Terrasse',minutes:35,energy:0,stress:-4,relationship:1},
  ],
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));window.dispatchEvent(new CustomEvent('monia:madrid-region-changed'));return true}catch{return false}}
function clamp(v:number){return Math.max(0,Math.min(100,Math.round(v)))}
function addMinutes(s:Save,minutes:number){const p=String(s.time||'12:00').split(':').map(Number);let total=(p[0]||12)*60+(p[1]||0)+minutes;while(total>=1440){total-=1440;s.day=Math.max(1,Number(s.day||1)+1)}s.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function madridHomeActive(s:Save){if(s.place!=='madrid')return false;const snap=getPropertyLifeSnapshot();if(snap.primary?.id==='lucas-madrid-house')return true;const f=s.flags||{};return Boolean(f.visitingLucasMadrid||f.atLucasMadridHome||f.madridHomeVisit||f.stayingWithLucasMadrid)}
function currentPlace(s:Save|null):Place|null{if(!s)return null;if(s.place==='family')return'family';if(s.place==='madrid'&&!madridHomeActive(s))return'madrid';return null}
function period(time?:string){const h=Number(String(time||'12:00').slice(0,2))||12;return h<7?'night':h<11?'morning':h<18?'day':h<21?'evening':'night'}
function host(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.worldFrame,.gameWorld,.gameScene')||document.querySelector<HTMLElement>('#app')||document.body}
function remove(){document.getElementById('moniaMadridRegionLife')?.remove()}
function familyView(s:Save):FamilyView{const f=s.flags||{};if(String(f.arrivalPlace||'')==='family')return'arrival';const raw=String(f.lastFamilyHomeView||'');return raw==='salon'||raw==='table'||raw==='kitchen'||raw==='garden'?raw:'arrival'}
function syncFamilyVisual(s:Save){if(s.place!=='family')return;const view=familyView(s),src=FAMILY_VIEWS[view];const photo=document.querySelector<HTMLImageElement>('img.worldPhoto,.worldPhoto img,img[data-world-photo]');if(photo&&photo.dataset.familyView!==view){photo.dataset.familyView=view;photo.src=src;photo.alt='Maison familiale près de Madrid';photo.decoding='async'}const background=document.querySelector<HTMLElement>('.worldPhoto:not(img),.worldBackdrop,.worldSceneBackground');if(background&&background.dataset.familyView!==view){background.dataset.familyView=view;background.style.backgroundImage=`url("${src}")`}}

export function doMadridRegionAction(actionId:string){const s=read(),place=currentPlace(s);if(!s||!place)return false;const action=ACTIONS[place].find(a=>a.id===actionId);if(!action)return false;addMinutes(s,action.minutes);s.energy=clamp(Number(s.energy??70)+action.energy);s.stress=clamp(Number(s.stress??20)+action.stress);s.relationship=clamp(Number(s.relationship??50)+action.relationship);const f=s.flags||(s.flags={});f.lastMadridRegionAction=`${place}:${action.id}`;if(place==='family'){f.familyVisitMoments=Number(f.familyVisitMoments||0)+1;f.lastFamilyHomeView=action.id;delete f.arrivalPlace}const ok=write(s);if(ok&&place==='family')syncFamilyVisual(s);return ok}

function render(){const s=read(),place=currentPlace(s);if(!s||!place||(s.screen&&s.screen!=='game')){remove();return}if(place==='family')syncFamilyVisual(s);let root=document.getElementById('moniaMadridRegionLife');if(!root){root=document.createElement('section');root.id='moniaMadridRegionLife';root.className='madridRegionLife';host().appendChild(root)}const view=place==='family'?familyView(s):'';const nextSignature=`${place}|${period(s.time)}|${view}|${String(s.time||'')}`;if(root.dataset.signature===nextSignature)return;root.dataset.signature=nextSignature;root.dataset.place=place;root.dataset.period=period(s.time);if(place==='family')root.dataset.familyView=view;const title=place==='family'?'Chez les proches de Lucas':'Aux alentours de Madrid';root.innerHTML=`<div class="madridRegionAtmos"><i></i><i></i></div><div class="madridRegionStatus"><span>${title}</span><small>${String(s.time||'')}</small></div><div class="madridRegionActions">${ACTIONS[place].map(a=>`<button data-madrid-region-action="${a.id}" title="${a.label}"><b>${a.short}</b><small>${a.minutes} min</small></button>`).join('')}</div>`;root.querySelectorAll<HTMLButtonElement>('[data-madrid-region-action]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();if(doMadridRegionAction(btn.dataset.madridRegionAction||''))render()})}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
window.addEventListener('storage',schedule);window.addEventListener('monia:property-changed',schedule as EventListener);window.addEventListener('monia:madrid-region-changed',schedule as EventListener);window.addEventListener('monia:madrid-home-changed',schedule as EventListener);new MutationObserver(mutations=>{if(mutations.every(m=>m.target instanceof Node&&document.getElementById('moniaMadridRegionLife')?.contains(m.target as Node)))return;schedule()}).observe(document.body,{childList:true,subtree:true});schedule();

declare global{interface Window{__moniaMadridRegionAction?:(actionId:string)=>boolean}}
window.__moniaMadridRegionAction=doMadridRegionAction;
