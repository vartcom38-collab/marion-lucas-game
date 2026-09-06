import './worldContinuityRuntime.css';

const SAVE_KEY='marion-lucas-save-v4';
const CONTINUITY_KEY='marion-lucas-world-continuity-v1';

type SaveLite={place?:string;time?:string;overlay?:string|null;day?:number};
type Continuity={lastPlace:string;lastTime:string;lastAction:string;lastActionAt:number;visited:Record<string,number>;actionCount:Record<string,number>};

const readJSON=<T>(key:string,fallback:T):T=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}};
const fresh=():Continuity=>({lastPlace:'',lastTime:'',lastAction:'',lastActionAt:0,visited:{},actionCount:{}});
let continuity=readJSON<Continuity>(CONTINUITY_KEY,fresh());
let lastSave='';
let transitionTimer=0;

function saveContinuity(){try{localStorage.setItem(CONTINUITY_KEY,JSON.stringify(continuity))}catch{}}
function readSave(){return readJSON<SaveLite>(SAVE_KEY,{});}
function slug(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)}
function actionName(el:HTMLElement){return(el.dataset.homeAction||el.dataset.worldAction||el.getAttribute('aria-label')||el.textContent||'action').trim().replace(/\s+/g,' ')}

function apply(game:HTMLElement,save:SaveLite){
  const place=save.place||'home';
  const time=save.time||'12:00';
  game.dataset.continuityPlace=place;
  game.dataset.continuityTime=time;
  game.dataset.continuityVisits=String(continuity.visited[place]||0);
  [...game.classList].filter(c=>c.startsWith('continuity-action-')).forEach(c=>game.classList.remove(c));
  if(continuity.lastAction&&Date.now()-continuity.lastActionAt<15*60*1000){
    game.classList.add(`continuity-action-${slug(continuity.lastAction)}`);
    game.dataset.continuityAction=continuity.lastAction;
  }else delete game.dataset.continuityAction;
}

function placeTransition(game:HTMLElement,from:string,to:string){
  if(!from||from===to)return;
  game.classList.remove('continuity-arriving');
  void game.offsetWidth;
  game.classList.add('continuity-arriving');
  if(transitionTimer)window.clearTimeout(transitionTimer);
  transitionTimer=window.setTimeout(()=>game.classList.remove('continuity-arriving'),1100);
}

function sync(){
  const game=document.querySelector<HTMLElement>('.game');
  if(!game)return;
  const raw=localStorage.getItem(SAVE_KEY)||'';
  const save=readSave();
  if(raw!==lastSave){
    const place=save.place||'home';
    const time=save.time||'12:00';
    if(continuity.lastPlace!==place){
      placeTransition(game,continuity.lastPlace,place);
      continuity.visited[place]=(continuity.visited[place]||0)+1;
    }
    continuity.lastPlace=place;
    continuity.lastTime=time;
    saveContinuity();
    lastSave=raw;
  }
  apply(game,save);
}

document.addEventListener('click',e=>{
  const el=(e.target as HTMLElement|null)?.closest<HTMLElement>('[data-home-action],[data-world-action]');
  if(!el)return;
  const name=actionName(el);
  continuity.lastAction=name;
  continuity.lastActionAt=Date.now();
  continuity.actionCount[name]=(continuity.actionCount[name]||0)+1;
  saveContinuity();
  const game=document.querySelector<HTMLElement>('.game');
  if(game){
    game.style.setProperty('--continuity-x',`${(e as MouseEvent).clientX||innerWidth/2}px`);
    game.style.setProperty('--continuity-y',`${(e as MouseEvent).clientY||innerHeight/2}px`);
    game.classList.remove('continuity-react');void game.offsetWidth;game.classList.add('continuity-react');
    window.setTimeout(()=>game.classList.remove('continuity-react'),850);
    apply(game,readSave());
  }
},true);

window.addEventListener('storage',e=>{if(e.key===SAVE_KEY)sync()});
new MutationObserver(sync).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.setInterval(sync,900);
sync();

console.info('[World] Continuity runtime active');
