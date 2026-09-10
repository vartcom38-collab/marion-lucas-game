import './storyShell.css';

const SAVE_KEY='marion-lucas-save-v4';
let currentHost:HTMLElement|null=null;
let panel:HTMLElement|null=null;
let refreshTimer=0;

function readSave(){
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw):null}catch{return null}
}

function isHome(save:any){return (save?.place||'home')==='home'}

function narrativeFor(save:any){
  const day=Number(save?.day||1);
  const time=String(save?.time||'09:00');
  if(day<=1)return {
    kicker:'NÎMES · JOUR 1',
    title: time<'12:00'?'Un matin à toi':'Ta journée commence',
    body:'Prends le temps de regarder autour de toi. Tu peux explorer l’appartement directement, ouvrir ton téléphone ou sortir quand tu en as envie.'
  };
  return {
    kicker:`JOUR ${day}`,
    title:'Chez toi',
    body:'Le monde continue autour de toi. Explore, réponds à tes messages ou poursuis simplement ta journée.'
  };
}

function ensurePanel(host:HTMLElement){
  if(panel&&panel.isConnected&&currentHost===host)return panel;
  panel?.remove();
  currentHost=host;
  panel=document.createElement('section');
  panel.className='storyShell storyShellAmbient';
  panel.setAttribute('aria-label','Contexte de la scène');
  panel.innerHTML='<div class="storyShellText"><div class="storyShellKicker"></div><h2></h2><p></p></div>';
  host.appendChild(panel);
  return panel;
}

function render(){
  const host=document.querySelector<HTMLElement>('.immersivePlayable');
  const save=readSave();
  if(!host||!isHome(save)){panel?.remove();panel=null;currentHost=null;return}
  const p=ensurePanel(host);
  const copy=narrativeFor(save);
  p.querySelector<HTMLElement>('.storyShellKicker')!.textContent=copy.kicker;
  p.querySelector<HTMLHeadingElement>('h2')!.textContent=copy.title;
  p.querySelector<HTMLParagraphElement>('p')!.textContent=copy.body;
}

function schedule(){if(refreshTimer)window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(render,80)}
new MutationObserver(schedule).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',schedule);
window.addEventListener('marion-home-first-control',schedule as EventListener);
schedule();
