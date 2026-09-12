import './life-narrative-ui.css';
import {getLifeDirectorSnapshot,type LifeChoice} from './life-director';

function byId(id:string){return document.getElementById(id) as HTMLButtonElement|null}
function clickExisting(id:string){const b=byId(id);if(b){b.click();return true}return false}
function clickAction(action:string){
  if(!clickExisting('actions'))return false;
  window.setTimeout(()=>{
    const target=[...document.querySelectorAll<HTMLButtonElement>('[data-action]')].find(b=>b.dataset.action===action);
    target?.click();
  },30);
  return true;
}
function openPhone(){return clickExisting('premiumPhone')||clickExisting('phone')||clickExisting('phoneExact')}
function openMap(){return clickExisting('premiumMap')||clickExisting('worldQuick')||clickExisting('worldExact')}
function openWardrobe(){return clickExisting('premiumWardrobe')}
function openJournal(){return clickExisting('premiumJournal')||clickExisting('journalQuick')||clickExisting('journalExact')}

function activate(choice:LifeChoice){
  if(choice.action&&clickAction(choice.action))return;
  if(choice.intent==='open-map'){openMap();return}
  if(choice.intent==='open-phone'||choice.intent==='open-latest-message'){
    if(openPhone()&&choice.intent==='open-latest-message')window.setTimeout(()=>{
      const messages=[...document.querySelectorAll<HTMLButtonElement>('[data-phoneapp]')].find(b=>b.dataset.phoneapp==='messages');
      messages?.click();
    },40);
    return;
  }
  if(choice.intent==='open-actions'){clickExisting('actions');return}
  clickExisting('actions');
}

function renderStrip(){
  const game=document.querySelector<HTMLElement>('.game');
  if(!game||document.querySelector('.overlay.open')||document.querySelector('.surprisePlayer'))return;
  const snap=getLifeDirectorSnapshot();if(!snap)return;
  let strip=game.querySelector<HTMLElement>('.lifeNarrativeStrip');
  if(!strip){strip=document.createElement('section');strip.className='lifeNarrativeStrip';game.append(strip)}
  strip.innerHTML=`<div class="lifeNarrativeCopy"><span>${snap.chapter} · Jour ${snap.day} · ${snap.time}</span><p>${snap.narrative}</p></div><div class="lifeChoiceRow">${snap.choices.map((c,i)=>`<button type="button" data-life-choice="${c.id}" data-life-index="${i}"><b>${i+1}</b><span>${c.label}</span></button>`).join('')}</div><div class="lifeFreeRow"><small>Ou fais autre chose</small><button type="button" data-life-free="phone" aria-label="Téléphone">Téléphone</button><button type="button" data-life-free="map" aria-label="Carte">Carte</button><button type="button" data-life-free="wardrobe" aria-label="Garde-robe">Tenues</button><button type="button" data-life-free="journal" aria-label="Journal">Journal</button></div>`;
  strip.querySelectorAll<HTMLButtonElement>('[data-life-choice]').forEach(button=>button.onclick=()=>{
    const choice=snap.choices[Number(button.dataset.lifeIndex||0)];if(choice)activate(choice);
  });
  strip.querySelectorAll<HTMLButtonElement>('[data-life-free]').forEach(button=>button.onclick=()=>{
    const type=button.dataset.lifeFree;
    if(type==='phone')openPhone();
    if(type==='map')openMap();
    if(type==='wardrobe')openWardrobe();
    if(type==='journal')openJournal();
  });
}

function cleanLegacyHud(){
  const game=document.querySelector<HTMLElement>('.game');if(!game)return;
  game.classList.add('lifeNarrativeMode');
}
function refresh(){cleanLegacyHud();renderStrip()}
const observer=new MutationObserver(()=>window.requestAnimationFrame(refresh));
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',refresh);
window.addEventListener('monia:game-state-after-surprise',refresh);
window.setInterval(refresh,1200);
refresh();
