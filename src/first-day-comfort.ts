import './firstDayComfort.css';

type SaveLike={day:number;time:string;place:string;screen:string;metLucas:boolean;outfit?:string;flags:Record<string,boolean|number|string>;updatedAt:number};
const SAVE_KEY='marion-lucas-save-v4';
let toastTimer=0;

function read():SaveLike|null{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as SaveLike|null}catch{return null}}
function write(s:SaveLike){s.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s))}
function isFirstHome(s:SaveLike|null){return Boolean(s&&s.day===1&&s.place==='home'&&!s.metLucas&&s.screen==='game')}
function noteFlag(key:string,value:boolean|string=true){window.setTimeout(()=>{const s=read();if(!s)return;s.flags[key]=value;write(s)},80)}

function showToast(title:string,body:string,duration=2300){
  document.querySelector('.firstDayComfortToast')?.remove();
  const toast=document.createElement('aside');toast.className='firstDayComfortToast';toast.innerHTML=`<strong>${title}</strong><small>${body}</small>`;document.body.appendChild(toast);
  if(toastTimer)window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{toast.classList.add('is-leaving');window.setTimeout(()=>toast.remove(),260)},duration);
}

function decorateWardrobe(){
  const s=read();if(!isFirstHome(s))return;
  const panel=document.querySelector<HTMLElement>('.wardrobeStudio');if(!panel||panel.querySelector('.firstWardrobeComfort'))return;
  const note=document.createElement('div');note.className='firstWardrobeComfort';note.innerHTML='<span>PREMIER MATIN</span><strong>Choisis juste ce qui te ressemble.</strong><small>Aucune tenue n’est “meilleure”. Le jeu ne te note pas sur ton look.</small>';
  panel.prepend(note);noteFlag('firstWardrobeComfortSeen');
}

function decorateWorld(){
  const s=read();if(!isFirstHome(s))return;
  const panel=document.querySelector<HTMLElement>('.worldGalleryPanel');if(!panel)return;
  const nimes=panel.querySelector<HTMLButtonElement>('[data-place="nimes"]');if(!nimes)return;
  nimes.classList.add('firstDaySuggestedPlace');
  if(!panel.querySelector('.firstMapComfort')){
    const title=panel.querySelector('.screenTitle');const note=document.createElement('div');note.className='firstMapComfort';note.innerHTML='<span>POUR SORTIR</span><strong>Nîmes est juste là.</strong><small>Tu peux partir maintenant, ou refermer la carte et rester encore chez toi.</small>';title?.appendChild(note);
  }
  noteFlag('firstMapComfortSeen');
}

function exitVeil(){
  document.querySelector('.firstDayExitVeil')?.remove();
  const veil=document.createElement('div');veil.className='firstDayExitVeil';veil.innerHTML='<div><span>NÎMES</span><strong>Tu attrapes tes affaires.</strong><small>La porte se referme derrière toi.</small></div>';document.body.appendChild(veil);
  window.setTimeout(()=>veil.classList.add('is-visible'),20);window.setTimeout(()=>veil.classList.add('is-leaving'),900);window.setTimeout(()=>veil.remove(),1450);
}

function handleClick(e:MouseEvent){
  const target=e.target as HTMLElement|null;if(!target)return;
  const s=read();
  if(target.closest('#premiumWardrobe,#goWardrobe'))window.setTimeout(decorateWardrobe,80);
  if(target.closest('#premiumMap,#worldQuick,#worldExact,#goWorld'))window.setTimeout(decorateWorld,80);
  if(isFirstHome(s)&&target.closest('.wardrobeStudio [data-outfit]')){
    noteFlag('firstDayChoseOutfit');
    window.setTimeout(()=>showToast('Ça te va.','Pas besoin d’en faire plus pour être prête.'),120);
  }
  const place=target.closest<HTMLElement>('[data-place]')?.dataset.place;
  if(isFirstHome(s)&&place==='nimes'){
    exitVeil();noteFlag('firstDayLeftHomeComfortably');
  }
}

document.addEventListener('click',handleClick,{passive:true,capture:true});
console.info('[Day 1] gentle preparation and home-to-Nîmes transition comfort active');
