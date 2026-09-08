import './gameplayCinematic.css';

const SAVE_KEY='marion-lucas-save-v4';
let mounted:HTMLElement|null=null;
let idleTimer=0;
let focusLabel:HTMLElement|null=null;
let pulseTimer=0;
let commitTimer=0;
let lastPlace='';

type LooseSave={time?:string;place?:string;camera?:number;overlay?:string|null};

function readSave():LooseSave|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as LooseSave:null}catch{return null}
}

function ensureFocusLabel(){
  if(focusLabel?.isConnected)return focusLabel;
  focusLabel=document.createElement('div');
  focusLabel.className='gpFocusLabel';
  document.body.appendChild(focusLabel);
  return focusLabel;
}

function showFocus(text=''){
  const el=ensureFocusLabel();
  el.textContent=text;
  el.classList.toggle('show',Boolean(text));
}

function beat(text:string){
  document.querySelectorAll('.gpBeat').forEach(n=>n.remove());
  const el=document.createElement('div');
  el.className='gpBeat';
  el.textContent=text;
  document.body.appendChild(el);
  window.setTimeout(()=>el.remove(),1900);
}

function wake(game:HTMLElement){
  game.classList.remove('gp-idle');
  if(idleTimer)window.clearTimeout(idleTimer);
  idleTimer=window.setTimeout(()=>game.classList.add('gp-idle'),5200);
}

function nearestInteractive(game:HTMLElement,x:number,y:number){
  const nodes=[...game.querySelectorAll<HTMLElement>('.gameHotspot,.worldSpot')];
  let best:HTMLElement|null=null,bestDist=Infinity;
  for(const node of nodes){
    const r=node.getBoundingClientRect();
    const d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));
    if(d<bestDist){best=node;bestDist=d}
    node.classList.remove('gp-near');
  }
  if(best&&bestDist<135){
    best.classList.add('gp-near');
    const label=(best.querySelector('span')?.textContent||best.getAttribute('aria-label')||'').trim();
    showFocus(label);
    const br=best.getBoundingClientRect();
    const gr=game.getBoundingClientRect();
    const fx=((br.left+br.width/2-gr.left)/Math.max(1,gr.width))*100;
    const fy=((br.top+br.height/2-gr.top)/Math.max(1,gr.height))*100;
    game.style.setProperty('--gp-focus-x',`${fx.toFixed(2)}%`);
    game.style.setProperty('--gp-focus-y',`${fy.toFixed(2)}%`);
    game.classList.add('gp-has-focus');
  }else{
    showFocus('');
    game.classList.remove('gp-has-focus');
  }
}

function pointerMove(game:HTMLElement,e:PointerEvent){
  const r=game.getBoundingClientRect();
  const x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*20;
  const y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*14;
  game.style.setProperty('--gp-x',x.toFixed(2));
  game.style.setProperty('--gp-y',y.toFixed(2));
  nearestInteractive(game,e.clientX,e.clientY);
  wake(game);
}

function textFromAction(el:HTMLElement){
  return (el.querySelector('span')?.textContent||el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ');
}

function interactionPulse(game:HTMLElement,target:HTMLElement){
  const r=target.getBoundingClientRect();
  const g=game.getBoundingClientRect();
  const x=((r.left+r.width/2-g.left)/Math.max(1,g.width))*100;
  const y=((r.top+r.height/2-g.top)/Math.max(1,g.height))*100;
  game.style.setProperty('--gp-action-x',`${x.toFixed(2)}%`);
  game.style.setProperty('--gp-action-y',`${y.toFixed(2)}%`);
  game.classList.remove('gp-action-pulse');
  void game.offsetWidth;
  game.classList.add('gp-action-pulse','gp-commit-focus');
  if(pulseTimer)window.clearTimeout(pulseTimer);
  if(commitTimer)window.clearTimeout(commitTimer);
  pulseTimer=window.setTimeout(()=>game.classList.remove('gp-action-pulse'),650);
  commitTimer=window.setTimeout(()=>game.classList.remove('gp-commit-focus'),760);
}

function transitionBeat(game:HTMLElement){
  const save=readSave();
  const place=save?.place||'';
  if(!lastPlace){lastPlace=place;return}
  if(place&&place!==lastPlace){
    game.classList.remove('gp-place-transition');
    void game.offsetWidth;
    game.classList.add('gp-place-transition');
    window.setTimeout(()=>game.classList.remove('gp-place-transition'),900);
    lastPlace=place;
  }
}

function syncState(game:HTMLElement){
  const save=readSave();
  if(save?.place){
    game.dataset.gpPlace=save.place;
    if(!lastPlace)lastPlace=save.place;
  }
  if(save?.time)game.dataset.gpTime=save.time;
  transitionBeat(game);
}

function install(game:HTMLElement){
  if(game===mounted)return;
  mounted=game;
  game.classList.add('cinematicGameplay');
  syncState(game);

  const onMove=(e:PointerEvent)=>pointerMove(game,e);
  game.addEventListener('pointermove',onMove,{passive:true});
  game.addEventListener('pointerleave',()=>{
    game.style.setProperty('--gp-x','0');
    game.style.setProperty('--gp-y','0');
    game.querySelectorAll('.gp-near').forEach(n=>n.classList.remove('gp-near'));
    game.classList.remove('gp-has-focus');
    showFocus('');
  },{passive:true});

  ['pointerdown','wheel','touchstart'].forEach(ev=>game.addEventListener(ev,()=>wake(game),{passive:true}));
  game.addEventListener('click',e=>{
    const target=(e.target as HTMLElement|null)?.closest<HTMLElement>('[data-home-action],[data-world-action],.gameHotspot,.worldSpot');
    if(target){
      interactionPulse(game,target);
      const label=textFromAction(target);
      if(label)beat(label);
    }
  },true);

  wake(game);
}

function editableTarget(target:EventTarget|null){
  const el=target as HTMLElement|null;
  return !!el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT'||el.isContentEditable);
}

window.addEventListener('keydown',e=>{
  if(editableTarget(e.target))return;
  const game=document.querySelector<HTMLElement>('.game');
  if(!game)return;
  wake(game);
  if(e.key.toLowerCase()==='e'){
    const action=document.getElementById('actions') as HTMLButtonElement|null;
    if(action){e.preventDefault();action.click();beat('Agir')}
    return;
  }
  if(game.classList.contains('immersivePlayable')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
    const save=readSave();
    if(save?.overlay)return;
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('[data-camera]')];
    if(!buttons.length)return;
    e.preventDefault();
    const current=Number(save?.camera||0);
    const next=e.key==='ArrowRight'?(current+1)%3:(current+2)%3;
    const button=buttons.find(b=>Number(b.dataset.camera)===next);
    button?.click();
  }
});

function scan(){
  const game=document.querySelector<HTMLElement>('.game');
  if(game){
    install(game);
    syncState(game);
  }else{
    mounted=null;
    showFocus('');
  }
}

new MutationObserver(scan).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
scan();

console.info('[Gameplay] Cinematic exploration focus polished');
