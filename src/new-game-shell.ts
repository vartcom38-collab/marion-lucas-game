import './new-game-shell.css';

type Tool='phone'|'agenda'|'map'|'memories'|null;
type DemoState={tool:Tool,phoneView:'home'|'messages'|'call',selected:string|null,place:string,time:string,memories:string[]};
const SAVE='marion-lucas-save-v4';
const UI='marion-ui-prototype-v1';
const load=():DemoState=>{try{return {...{tool:null,phoneView:'home',selected:null,place:'Chez Marion',time:'09:12',memories:[]},...JSON.parse(localStorage.getItem(UI)||'{}')}}catch{return {tool:null,phoneView:'home',selected:null,place:'Chez Marion',time:'09:12',memories:[]}}};
const state=load(); const persist=()=>localStorage.setItem(UI,JSON.stringify(state));
function mount(){
 const app=document.getElementById('app');if(!app)return;document.getElementById('newGameShell')?.remove();
 const old=[...app.children] as HTMLElement[];old.forEach(x=>x.style.display='none');
 let game:any={};try{game=JSON.parse(localStorage.getItem(SAVE)||'{}')}catch{}
 const root=document.createElement('div');root.id='newGameShell';root.className='ng-shell';
 root.innerHTML=`<div class="ng-scene"><div class="ng-media"><span>MARION · SCÈNE DE VIE</span><small>média canonique connecté ensuite par MonIA</small></div></div>
 <header class="ng-top"><div class="ng-id"><b>Marion</b><span>Nîmes · Mai 1998 · <i id="ngTime">${state.time}</i></span></div><nav>
 <button data-tool="phone">☎<small>Téléphone</small><i class="badge">${game.phoneUnread||1}</i></button>
 <button data-tool="agenda">▦<small>Agenda</small></button><button data-tool="map">⌖<small>Carte</small></button><button data-tool="memories">✦<small>Souvenirs</small></button></nav></header>
 <div class="ng-toast" hidden></div><section class="ng-now"><p>QU’EST-CE QUE TU FAIS MAINTENANT ?</p><div class="ng-choices">
 <button data-intent="marine">Répondre à Marine</button><button data-intent="prepare">Finir de te préparer</button><button data-intent="leave">Sortir maintenant</button></div></section>
 <aside class="ng-panel" hidden><button class="ng-close">×</button><div class="ng-panel-body"></div></aside>`;
 app.appendChild(root);
 const panel=root.querySelector('.ng-panel') as HTMLElement,body=root.querySelector('.ng-panel-body') as HTMLElement,toast=root.querySelector('.ng-toast') as HTMLElement;
 const say=(x:string)=>{toast.textContent=x;toast.hidden=false;setTimeout(()=>toast.hidden=true,1800)};
 const open=(tool:Tool)=>{state.tool=tool;persist();renderPanel()};
 function renderPanel(){if(!state.tool){panel.hidden=true;return}panel.hidden=false;
  if(state.tool==='phone') body.innerHTML=`<em>TÉLÉPHONE · 1998</em><h2>Téléphone</h2><div class="ng-tabs"><button data-phone="messages">Messages</button><button data-phone="call">Appels</button><button>Contacts</button></div><article class="ng-thread" data-phone="messages"><b>Marine</b><span>Tu es où ?</span><small>maintenant</small></article><article><b>Dominic</b><span>Vous ne vous connaissez pas encore.</span></article>`;
  if(state.tool==='agenda') body.innerHTML=`<em>AGENDA</em><h2>Ma journée</h2><article><b>10:30 · Retrouver Marine</b><span>Centre-ville</span><div class="ng-inline"><button data-agenda="go">Y aller</button><button data-agenda="warn">Prévenir</button><button data-agenda="ignore">Continuer ici</button></div></article><article><b>Après-midi</b><span>Temps libre</span></article><article><b>Soirée</b><span>Rien de prévu… pour l’instant.</span></article>`;
  if(state.tool==='map') body.innerHTML=`<em>CARTE · NÎMES</em><h2>Où aller ?</h2><div class="ng-map"><span class="road r1"></span><span class="road r2"></span><button class="pin home" data-place="Chez Marion">⌂<small>Chez Marion</small></button><button class="pin centre" data-place="Centre-ville">●<small>Centre</small></button><button class="pin arena" data-place="Arènes">●<small>Arènes</small></button></div><p class="ng-rule">Tu choisis un lieu. Tu ne choisis jamais ce qui va s’y produire.</p>`;
  if(state.tool==='memories') body.innerHTML=`<em>VOTRE HISTOIRE</em><h2>Souvenirs</h2><p class="ng-rule">Pas de jauge d’amour. MonIA retient ce qui a réellement été vécu.</p><div class="ng-memory">${state.memories.length?state.memories.map(x=>'<article><b>'+x+'</b><span>Ce moment peut réapparaître naturellement plus tard.</span></article>').join(''):'<article><b>Votre histoire commence ici.</b><span>Les souvenirs importants apparaîtront au fil de la partie.</span></article>'}</div>`;
  bindPanel();
 }
 function bindPanel(){body.querySelectorAll('[data-phone="messages"]').forEach(x=>x.addEventListener('click',()=>{body.innerHTML=`<em>MARINE · EN LIGNE</em><h2>Messages</h2><div class="ng-chat"><p>Marine <span>Tu es où ?</span></p><p class="me">Marion <span>Je finis de me préparer.</span></p><p>Marine <span>Dépêche-toi 😄</span></p></div><div class="ng-inline"><button data-reply>Répondre</button><button data-close-chat>Revenir au jeu</button></div>`;body.querySelector('[data-reply]')?.addEventListener('click',()=>say('Marion répond naturellement à Marine'));body.querySelector('[data-close-chat]')?.addEventListener('click',()=>{state.tool=null;persist();renderPanel()})}));
  body.querySelectorAll('[data-agenda]').forEach(x=>x.addEventListener('click',()=>{const a=(x as HTMLElement).dataset.agenda;if(a==='go'){state.place='Centre-ville';state.time='10:12';(root.querySelector('#ngTime') as HTMLElement).textContent=state.time;say('Marion se prépare à partir — le monde continue.')}else if(a==='warn')say('Marine est prévenue.');else say('Tu restes ici. Le rendez-vous, lui, existe toujours.');persist()}));
  body.querySelectorAll('[data-place]').forEach(x=>x.addEventListener('click',()=>{state.place=(x as HTMLElement).dataset.place||state.place;state.tool=null;persist();renderPanel();say('Destination : '+state.place+' — MonIA décide ce qui peut s’y passer.');window.dispatchEvent(new CustomEvent('marion:destination',{detail:{place:state.place}}))}));
 }
 root.querySelectorAll('[data-tool]').forEach(x=>x.addEventListener('click',()=>open((x as HTMLElement).dataset.tool as Tool)));
 root.querySelector('.ng-close')?.addEventListener('click',()=>{state.tool=null;persist();renderPanel()});
 root.querySelectorAll('[data-intent]').forEach(x=>x.addEventListener('click',()=>{root.querySelectorAll('[data-intent]').forEach(y=>y.classList.remove('chosen'));x.classList.add('chosen');const intent=(x as HTMLElement).dataset.intent!;state.selected=intent;if(intent==='marine')open('phone');if(intent==='prepare')say('Marion continue de se préparer.');if(intent==='leave'){state.memories.unshift('Tu as décidé de sortir sans attendre.');state.place='Centre-ville';say('Marion agit immédiatement.');}persist();window.dispatchEvent(new CustomEvent('marion:player-intent',{detail:{intent}}))}));
 renderPanel();
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(mount,80));setTimeout(mount,600);
