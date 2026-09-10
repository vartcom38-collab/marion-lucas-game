import './storyShell.css';

const SAVE_KEY='marion-lucas-save-v4';
let currentHost:HTMLElement|null=null;
let panel:HTMLElement|null=null;
let refreshTimer=0;

type SaveLike={
  day?:number;time?:string;place?:string;metLucas?:boolean;phoneUnread?:number;
  messages?:Array<{from:string;text:string;day:number;read:boolean}>;
  flags?:Record<string,boolean|number|string>;
};

type GuideAction={label:string;kind:'phone'|'wardrobe'|'map'|'join'|'free';primary?:boolean};
type GuideCopy={kicker:string;title:string;body:string;actions:GuideAction[]};

function readSave():SaveLike|null{
  try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw):null}catch{return null}
}
function writeSave(save:any){save.updatedAt=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(save))}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function setMins(save:any,total:number){total=((total%1440)+1440)%1440;save.time=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function isHome(save:SaveLike|null){return (save?.place||'home')==='home'}
function hasUnread(save:SaveLike|null){return (save?.messages||[]).some(m=>m.from!=='Toi'&&!m.read)||Number(save?.phoneUnread||0)>0}
function marineInviteSeen(save:SaveLike|null){return (save?.messages||[]).some(m=>m.from==='Marine'&&m.read&&/arènes|café|viens/i.test(m.text))}

function narrativeFor(save:SaveLike|null):GuideCopy{
  const day=Number(save?.day||1);
  const time=String(save?.time||'09:00');
  if(day===1&&!save?.metLucas&&isHome(save)){
    if(hasUnread(save))return {
      kicker:`JOUR 1 · ${time}`,
      title:'Ton téléphone vient de vibrer.',
      body:'Quelqu’un t’écrit. Tu peux regarder maintenant, ou finir de te préparer avant de répondre.',
      actions:[
        {label:'Lire le message',kind:'phone',primary:true},
        {label:'Me préparer',kind:'wardrobe'}
      ]
    };
    if(marineInviteSeen(save))return {
      kicker:`JOUR 1 · ${time}`,
      title:'Tu as maintenant un vrai choix.',
      body:'Une proposition t’attend dehors. Tu peux la suivre tout de suite ou prendre encore un peu de temps chez toi.',
      actions:[
        {label:'Rejoindre Marine',kind:'join',primary:true},
        {label:'Prendre mon temps',kind:'free'}
      ]
    };
    return {
      kicker:`JOUR 1 · ${time}`,
      title:'Commence ta matinée.',
      body:'Pas besoin de chercher quoi faire : prépare-toi tranquillement. Le reste de la journée viendra à toi.',
      actions:[
        {label:'Me préparer',kind:'wardrobe',primary:true},
        {label:'Regarder mon téléphone',kind:'phone'}
      ]
    };
  }
  return {
    kicker:`JOUR ${day} · ${time}`,
    title:'Ta journée continue.',
    body:'Tu peux suivre ce qui se présente ou reprendre la main quand tu en as envie.',
    actions:[]
  };
}

function clickControl(ids:string[],words:string[]){
  for(const id of ids){const el=document.getElementById(id) as HTMLButtonElement|null;if(el){el.click();return true}}
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('button')];
  const target=buttons.find(b=>words.some(w=>(b.textContent||b.getAttribute('aria-label')||'').toLowerCase().includes(w)));
  if(target){target.click();return true}
  return false;
}

function perform(kind:GuideAction['kind']){
  const save=readSave();
  if(kind==='phone'){
    clickControl(['premiumPhone','phone','phoneExact'],['téléphone','telephone','phone']);
    window.setTimeout(()=>{
      const phone=document.querySelector<HTMLElement>('.phoneDevice');
      if(!phone)return;
      const messageBtn=[...phone.querySelectorAll<HTMLButtonElement>('button')].find(b=>(b.textContent||'').toLowerCase().includes('message'));
      messageBtn?.click();
    },140);
    return;
  }
  if(kind==='wardrobe'){clickControl(['premiumWardrobe','wardrobe'],['garde-robe','tenue','wardrobe']);return}
  if(kind==='map'){clickControl(['premiumMap','map'],['carte','sortir','map']);return}
  if(kind==='join'){
    if(!save)return;
    const full:any=save;
    full.flags=full.flags||{};
    full.flags.dayOneThread='marine_on_the_way';
    full.flags.dayOneLeftWithMarine=true;
    full.flags.arrivalPlace='nimes';
    full.flags.arrivalFrom='home';
    full.flags.arrivalMinutes=15;
    full.place='nimes';
    setMins(full,mins(String(full.time||'09:00'))+15);
    if(Array.isArray(full.memories)&&!full.memories.includes('Tu as décidé de rejoindre Marine en ville.'))full.memories.unshift('Tu as décidé de rejoindre Marine en ville.');
    writeSave(full);
    location.reload();
    return;
  }
  if(kind==='free'){
    if(!save)return;
    const full:any=save;full.flags=full.flags||{};full.flags.dayOneGuideSnoozedUntil=Date.now()+8*60*1000;writeSave(full);schedule();
  }
}

function ensurePanel(host:HTMLElement){
  if(panel&&panel.isConnected&&currentHost===host)return panel;
  panel?.remove();
  currentHost=host;
  panel=document.createElement('section');
  panel.className='storyShell storyShellGuide';
  panel.setAttribute('aria-label','Direction de la scène');
  panel.innerHTML='<div class="storyShellText"><div class="storyShellKicker"></div><h2></h2><p></p></div><div class="storyGuideChoices" role="group" aria-label="Choix disponibles"></div>';
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
  const choices=p.querySelector<HTMLElement>('.storyGuideChoices')!;
  choices.innerHTML='';
  const snoozed=Number((save as any)?.flags?.dayOneGuideSnoozedUntil||0)>Date.now();
  if(!snoozed)copy.actions.forEach(action=>{
    const b=document.createElement('button');b.type='button';b.className=`storyGuideAction${action.primary?' primary':''}`;b.textContent=action.label;b.onclick=()=>perform(action.kind);choices.appendChild(b)
  });
  p.classList.toggle('noGuideActions',!choices.children.length);
}

function schedule(){if(refreshTimer)window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(render,80)}
new MutationObserver(schedule).observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('storage',schedule);
window.addEventListener('marion-home-first-control',schedule as EventListener);
window.setInterval(schedule,2500);
schedule();
