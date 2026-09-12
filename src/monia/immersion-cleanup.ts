import './immersion-cleanup.css';

const SAVE_KEY='marion-lucas-save-v4';
type Save={screen?:string;day?:number;place?:string;metLucas?:boolean;flags?:Record<string,unknown>};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}

function cleanNarration(){
  const card=document.getElementById('moniaNarration');
  if(!card)return;
  card.querySelectorAll('span,small').forEach(el=>{
    const text=(el.textContent||'').toLowerCase();
    if(text.includes('monia')||text.includes('généré')||text.includes('genere')||text.includes('secours')||text.includes('local'))el.remove();
  });
  card.classList.add('playerNarrationOnly');
}

function cleanSettings(){
  const block=document.querySelector<HTMLElement>('.moniaSettings');
  if(!block)return;
  block.style.display='none';
}

function simplifyGameHud(){
  const game=document.querySelector<HTMLElement>('.game');
  if(!game)return;
  game.classList.add('moniaImmersiveGame');
  document.querySelectorAll<HTMLElement>('.approvedObjective,.approvedSceneNav,.approvedExplore,.mainAction.approvedAction,.premiumNav').forEach(el=>el.classList.add('legacyGameplayChrome'));
  const top=document.querySelector<HTMLElement>('.approvedTopActions');
  if(top)top.classList.add('compactTopActions');
}

function hideFutureMapSpoilers(){
  const save=read();
  if(!save)return;
  document.querySelectorAll<HTMLButtonElement>('.worldGallery .worldTile').forEach(tile=>{
    const locked=tile.disabled||/pas encore dans ta vie/i.test(tile.textContent||'');
    if(locked)tile.classList.add('futurePlaceHidden');
    else tile.classList.remove('futurePlaceHidden');
  });
  const panel=document.querySelector<HTMLElement>('.worldGalleryPanel');
  if(panel)panel.classList.toggle('earlyWorldMap',Number(save.day||1)<8&&!save.metLucas);
}

function deDuplicateHomeControls(){
  document.querySelectorAll<HTMLElement>('.exactControls').forEach(el=>el.classList.add('accessibilityHitLayer'));
  document.querySelectorAll<HTMLElement>('.gameHotspot').forEach(el=>el.classList.add('subtleWorldHotspot'));
}

function enhance(){cleanNarration();cleanSettings();simplifyGameHud();hideFutureMapSpoilers();deDuplicateHomeControls()}

const observer=new MutationObserver(()=>enhance());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',e=>{if(!e.key||e.key===SAVE_KEY)enhance()});
window.addEventListener('monia:daily-intent',()=>setTimeout(enhance,50));
setInterval(enhance,1300);
setTimeout(enhance,250);
