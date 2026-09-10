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
  if(day<=1)return {
    kicker:'DÉBUT DE L’AVENTURE',
    title:'Nîmes, ce matin',
    body:'La journée commence doucement. Tu peux prendre ton temps, regarder ce qui t’attend… ou simplement décider de sortir.'
  };
  return {
    kicker:`JOUR ${day}`,
    title:'Un nouveau moment',
    body:'Ta vie continue. Les lieux, les messages et les rencontres peuvent faire basculer la journée sans prévenir.'
  };
}

function cleanLabel(h:HTMLElement){
  const raw=h.querySelector<HTMLElement>('span')?.textContent?.trim()||h.getAttribute('aria-label')?.trim()||'';
  return raw.replace(/^(observer|voir|ouvrir|aller|utiliser)\s+/i,'').trim();
}

function collectActions(host:HTMLElement){
  const seen=new Set<string>();
  const list:Array<{label:string;target:HTMLElement}>=[];
  for(const h of host.querySelectorAll<HTMLElement>('.gameHotspot')){
    if(h.offsetParent===null)continue;
    const label=cleanLabel(h);
    if(!label||seen.has(label))continue;
    seen.add(label);list.push({label,target:h});
    if(list.length>=3)break;
  }
  return list;
}

function ensurePanel(host:HTMLElement){
  if(panel&&panel.isConnected&&currentHost===host)return panel;
  panel?.remove();
  currentHost=host;
  panel=document.createElement('section');
  panel.className='storyShell';
  panel.setAttribute('aria-label','Narration et choix');
  panel.innerHTML='<div class="storyShellText"><div class="storyShellKicker"></div><h2></h2><p></p></div><div class="storyShellChoices"></div>';
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
  const choices=p.querySelector<HTMLElement>('.storyShellChoices')!;
  choices.replaceChildren();
  for(const action of collectActions(host)){
    const b=document.createElement('button');
    b.type='button';b.className='storyChoice';b.textContent=action.label;
    b.addEventListener('click',()=>action.target.click());
    choices.appendChild(b);
  }
  p.classList.toggle('hasChoices',choices.childElementCount>0);
}

function schedule(){if(refreshTimer)window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(render,80)}
new MutationObserver(schedule).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
window.addEventListener('storage',schedule);
window.addEventListener('marion-home-first-control',schedule as EventListener);
schedule();
