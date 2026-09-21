import './new-game-shell.css';

const SAVE='marion-lucas-save-v4';
function readSave(){try{return JSON.parse(localStorage.getItem(SAVE)||'null')}catch{return null}}
function mount(){
 const app=document.getElementById('app'); if(!app||document.getElementById('newGameShell'))return;
 const old=app.firstElementChild as HTMLElement|null; if(old) old.style.display='none';
 const s=readSave()||{time:'09:12',place:'home',phoneUnread:1};
 const shell=document.createElement('div');shell.id='newGameShell';shell.className='ng-shell';
 shell.innerHTML=`
 <div class="ng-scene"><div class="ng-placeholder"><span>SCÈNE DE VIE</span><small>Les images et vidéos canoniques viendront ici.</small></div></div>
 <header class="ng-top"><div><b>Marion</b><span>Nîmes · Mai 1998 · ${s.time||'09:12'}</span></div>
 <nav><button data-tool="phone">☎<small>Téléphone</small>${s.phoneUnread?'<i>'+s.phoneUnread+'</i>':''}</button><button data-tool="agenda">▦<small>Agenda</small></button><button data-tool="map">⌖<small>Carte</small></button><button data-tool="memories">✦<small>Souvenirs</small></button></nav></header>
 <section class="ng-now"><p>QU’EST-CE QUE TU FAIS MAINTENANT ?</p><div class="ng-choices">
 <button data-intent="marine">Répondre à Marine</button><button data-intent="prepare">Finir de te préparer</button><button data-intent="leave">Sortir maintenant</button></div></section>
 <aside class="ng-panel" hidden><button class="ng-close">×</button><div class="ng-panel-body"></div></aside>`;
 app.appendChild(shell);
 const panel=shell.querySelector('.ng-panel') as HTMLElement, body=shell.querySelector('.ng-panel-body') as HTMLElement;
 const views:any={
 phone:'<em>TÉLÉPHONE · 1998</em><h2>Messages</h2><article><b>Marine</b><span>Tu es où ?</span></article><article><b>Dominic</b><span>Aucun message pour le moment</span></article>',
 agenda:'<em>AGENDA</em><h2>Ma journée</h2><article><b>10:30 · Marine</b><span>Centre-ville</span></article><article><b>Après-midi</b><span>Libre</span></article>',
 map:'<em>CARTE</em><h2>Nîmes</h2><article><b>Chez Marion</b><span>Vous êtes ici</span></article><article><b>Centre-ville</b><span>Aller ici</span></article><article><b>Arènes</b><span>Aller ici</span></article>',
 memories:'<em>SOUVENIRS</em><h2>Votre histoire commence</h2><article><b>Pas de jauge.</b><span>Les moments vécus apparaîtront ici et pourront influencer la suite.</span></article>'};
 shell.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{body.innerHTML=views[(b as HTMLElement).dataset.tool!];panel.hidden=false}));
 shell.querySelector('.ng-close')?.addEventListener('click',()=>panel.hidden=true);
 shell.querySelectorAll('[data-intent]').forEach(b=>b.addEventListener('click',()=>{shell.querySelectorAll('[data-intent]').forEach(x=>x.classList.remove('chosen'));b.classList.add('chosen');window.dispatchEvent(new CustomEvent('marion:player-intent',{detail:{intent:(b as HTMLElement).dataset.intent}}))}));
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(mount,100));setTimeout(mount,700);
