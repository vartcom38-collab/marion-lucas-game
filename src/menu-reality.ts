import './menuReality.css';

const SAVE_KEY='marion-lucas-save-v4';
type SaveLike={day?:number;time?:string;place?:string;screen?:string;updatedAt?:number};

function readSave():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}

function placeLabel(place?:string){const labels:Record<string,string>={home:'Nîmes · Appartement',nimes:'Nîmes',cafe:'Nîmes · Café',arenes:'Nîmes · Arènes',station:'Nîmes · Gare',madrid:'Madrid',family:'Espagne',finca:'Finca',estate:'Espagne'};return labels[place||'']||'Ta vie'}

function mountMenu(){
  const stage=document.querySelector<HTMLElement>('.menuStage');
  const card=stage?.querySelector<HTMLElement>('.menuCard');
  if(!stage||!card||stage.dataset.cinematicMenu==='1')return;
  stage.dataset.cinematicMenu='1';stage.classList.add('cinematicMenu');
  const save=readSave();
  const h1=card.querySelector('h1');
  const p=card.querySelector('p');
  const small=card.querySelector('small');
  if(h1)h1.insertAdjacentHTML('beforebegin','<div class="menuEdition"><span>UNE HISTOIRE À VIVRE</span><i></i></div>');
  if(p)p.textContent='Entre dans la vie de Marion. Le reste se découvre en jouant.';
  if(save){
    card.classList.add('hasSave');
    const cont=card.querySelector<HTMLButtonElement>('#continue');
    const fresh=card.querySelector<HTMLButtonElement>('#newGame');
    cont?.classList.add('primary','continuePrimary');
    fresh?.classList.remove('primary');fresh?.classList.add('newSecondary');
    if(small)small.innerHTML=`<span class="saveDot"></span><b>Partie en cours</b> · Jour ${save.day||1} · ${placeLabel(save.place)} · ${save.time||''}`;
    card.insertAdjacentHTML('beforeend','<div class="menuContinueHint">Continuer reprend exactement ton histoire.</div>');
  }else if(small){
    small.innerHTML='<span class="saveDot empty"></span>Nouvelle histoire · aucun choix encore écrit';
  }
  card.insertAdjacentHTML('afterbegin','<div class="menuMonogram" aria-hidden="true"><span>M</span><i>&</i><span>L</span></div>');
  stage.insertAdjacentHTML('beforeend','<div class="menuAtmosphere" aria-hidden="true"><i></i><i></i><i></i></div>');
}

function showNewGameConfirm(button:HTMLButtonElement){
  if(document.getElementById('newGameConfirm'))return;
  const stage=document.querySelector<HTMLElement>('.menuStage');if(!stage)return;
  const box=document.createElement('div');box.id='newGameConfirm';box.className='newGameConfirm';
  box.innerHTML='<section><span>NOUVELLE PARTIE</span><h2>Recommencer l’histoire ?</h2><p>Ta partie actuelle sera remplacée par un nouveau départ.</p><div><button id="cancelNewGame">Garder ma partie</button><button id="confirmNewGame" class="dangerSoft">Oui, recommencer</button></div></section>';
  stage.appendChild(box);
  box.querySelector<HTMLButtonElement>('#cancelNewGame')?.addEventListener('click',()=>box.remove(),{once:true});
  box.querySelector<HTMLButtonElement>('#confirmNewGame')?.addEventListener('click',()=>{button.dataset.confirmedNew='1';box.remove();button.click()},{once:true});
}

document.addEventListener('click',e=>{
  const t=e.target as HTMLElement|null;
  const newGame=t?.closest<HTMLButtonElement>('#newGame');
  if(newGame&&readSave()&&newGame.dataset.confirmedNew!=='1'){
    e.preventDefault();e.stopImmediatePropagation();showNewGameConfirm(newGame);return;
  }
  if(newGame?.dataset.confirmedNew==='1')delete newGame.dataset.confirmedNew;
  window.setTimeout(mountMenu,40);
},{capture:true});

window.addEventListener('DOMContentLoaded',mountMenu,{once:true});
window.setTimeout(mountMenu,0);

console.info('[Menu] cinematic start screen active');
