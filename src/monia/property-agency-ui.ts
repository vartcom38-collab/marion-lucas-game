import './property-agency-ui.css';
import {
  getPropertyLifeSnapshot,
  shortlistProperty,
  purchaseProperty,
  refreshPropertyOffers,
  setPrimaryProperty,
  sellProperty,
  type PropertyOffer,
  type PropertyRecord,
} from './property-life';

const VISIT_KEY='marion-lucas-property-visits-v1';
type Visits={visited:Record<string,number>;selected?:string};

function readVisits():Visits{try{const raw=localStorage.getItem(VISIT_KEY);return raw?JSON.parse(raw) as Visits:{visited:{}}}catch{return{visited:{}}}}
function writeVisits(v:Visits){try{localStorage.setItem(VISIT_KEY,JSON.stringify(v));window.dispatchEvent(new CustomEvent('monia:property-ui-changed'))}catch{}}
function money(v:number){return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function offerTone(o:PropertyOffer){if(o.kind==='finca')return /Andalous/.test(o.region)?'south':/Estrém/.test(o.region)?'dry':/Tolède|Manche/.test(o.region)?'olive':'oak';if(o.kind==='coastal-home')return'coast';if(o.kind==='city-flat')return'city';return'green'}
function kindLabel(kind:string){return kind==='finca'?'Finca':kind==='city-flat'?'Appartement':kind==='coastal-home'?'Maison côtière':kind==='country-home'?'Maison de campagne':kind==='apartment'?'Appartement':'Maison'}
function useLabel(use:string){return use==='primary'?'Résidence principale':use==='secondary'?'Pied-à-terre':use==='available'?'Autre résidence':'Vendu'}

function ensureEntry(){
  const snap=getPropertyLifeSnapshot();
  const shouldShow=snap.searchOpen||snap.owned.some(p=>p.owner==='joint');
  document.querySelectorAll<HTMLElement>('[data-property-entry]').forEach(el=>{if(!shouldShow)el.remove()});
  if(!shouldShow||document.querySelector('[data-property-entry]'))return;
  const nav=document.querySelector<HTMLElement>('.premiumNav');
  if(!nav)return;
  const b=document.createElement('button');b.type='button';b.dataset.propertyEntry='1';b.className='propertyNavEntry';b.title='Immobilier';b.setAttribute('aria-label','Immobilier');
  b.innerHTML='<b aria-hidden="true">⌂</b><span>Immobilier</span>';
  b.onclick=()=>openPanel();nav.appendChild(b);
}

function propertyCard(p:PropertyRecord){
  return `<article class="ownedProperty ${p.use==='primary'?'isPrimary':''}">
    <div><small>${esc(kindLabel(p.kind))}</small><h3>${esc(p.name)}</h3><p>${esc(p.city)} · ${esc(p.region)}</p></div>
    <strong>${esc(useLabel(p.use))}</strong>
    <div class="propertyActions">
      ${p.use!=='primary'?`<button data-primary="${esc(p.id)}">En faire la résidence principale</button>`:''}
      ${p.owner==='joint'&&p.use!=='primary'?`<button data-sell="${esc(p.id)}">Revendre</button>`:''}
    </div>
  </article>`;
}

function offerCard(o:PropertyOffer,visited:boolean,shortlisted:boolean){
  const facts=[`${o.bedrooms} chambres`,o.hectares?`${o.hectares} ha`:null].filter(Boolean).join(' · ');
  return `<article class="propertyOffer tone-${offerTone(o)} ${visited?'isVisited':''}">
    <div class="propertyPhoto" aria-hidden="true"><i></i><span>${esc(o.city)}</span></div>
    <div class="propertyOfferBody">
      <div class="propertyOfferMeta"><small>${esc(kindLabel(o.kind))}</small><strong>${money(o.price)}</strong></div>
      <h3>${esc(o.title)}</h3><p class="propertyRegion">${esc(o.city)} · ${esc(o.region)}</p>
      <p>${esc(o.character)}</p><p class="propertyFacts">${esc(facts)}${facts?' · ':''}${esc(o.distanceNote)}</p>
      <div class="propertyOfferActions">
        <button data-shortlist="${esc(o.id)}">${shortlisted?'★ Favori':'☆ Favori'}</button>
        <button data-visit="${esc(o.id)}">${visited?'Revoir le bien':'Organiser une visite'}</button>
        <button data-buy="${esc(o.id)}" ${visited?'':'disabled'}>${visited?'Faire une offre':'Visite requise'}</button>
      </div>
    </div>
  </article>`;
}

function renderPanel(root:HTMLElement){
  const snap=getPropertyLifeSnapshot(),visits=readVisits();
  const reason=snap.firstJointPurchasePending?'Chercher un lieu à eux':'Leur patrimoine immobilier';
  root.innerHTML=`<div class="propertyAgencyBackdrop" data-close-property></div><section class="propertyAgencyPanel" role="dialog" aria-modal="true" aria-label="Immobilier">
    <header><div><small>ESPAGNE · IMMOBILIER</small><h2>${esc(reason)}</h2><p>${snap.firstJointPurchasePending?'Comparer plusieurs régions, visiter, réfléchir à deux, puis décider.':'Résidence principale, pieds-à-terre et biens achetés au fil de leur vie.'}</p></div><button class="propertyClose" data-close-property aria-label="Fermer">×</button></header>
    <div class="propertyAgencyContent">
      <section class="propertyOwnedSection"><div class="propertySectionTitle"><span>Leurs biens</span><small>${snap.owned.length} actif${snap.owned.length>1?'s':''}</small></div><div class="propertyOwnedGrid">${snap.owned.map(propertyCard).join('')}</div></section>
      ${snap.searchOpen?`<section class="propertyOffersSection"><div class="propertySectionTitle"><span>Offres à visiter</span><button data-refresh-property>Actualiser les offres</button></div><div class="propertyOfferGrid">${snap.offers.map(o=>offerCard(o,Boolean(visits.visited[o.id]),snap.shortlisted.includes(o.id))).join('')}</div></section>`:''}
    </div>
  </section>`;
  root.querySelectorAll<HTMLElement>('[data-close-property]').forEach(el=>el.onclick=()=>root.remove());
  root.querySelectorAll<HTMLButtonElement>('[data-shortlist]').forEach(b=>b.onclick=()=>{shortlistProperty(b.dataset.shortlist||'');renderPanel(root)});
  root.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach(b=>b.onclick=()=>startVisit(root,b.dataset.visit||''));
  root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b=>b.onclick=()=>confirmPurchase(root,b.dataset.buy||''));
  root.querySelectorAll<HTMLButtonElement>('[data-primary]').forEach(b=>b.onclick=()=>{setPrimaryProperty(b.dataset.primary||'');renderPanel(root)});
  root.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(b=>b.onclick=()=>{if(confirm('Revendre ce bien secondaire ?')){sellProperty(b.dataset.sell||'');renderPanel(root)}});
  root.querySelector<HTMLButtonElement>('[data-refresh-property]')?.addEventListener('click',()=>{refreshPropertyOffers();renderPanel(root)});
}

function startVisit(root:HTMLElement,id:string){
  const snap=getPropertyLifeSnapshot(),o=snap.offers.find(x=>x.id===id);if(!o)return;
  const visits=readVisits();visits.selected=id;writeVisits(visits);
  root.innerHTML=`<div class="propertyAgencyBackdrop"></div><section class="propertyVisit" role="dialog" aria-modal="true"><div class="propertyVisitVisual tone-${offerTone(o)}"><i></i></div><div class="propertyVisitText"><small>VISITE · ${esc(o.region.toUpperCase())}</small><h2>${esc(o.title)}</h2><p>${esc(o.character)}</p><p>${esc(o.distanceNote)}</p><div class="visitImpressions"><span>Marion observe les volumes, la lumière et ce que la vie quotidienne pourrait devenir ici.</span><span>Lucas regarde surtout les accès, les terres et la façon dont le lieu pourrait s’intégrer à leur rythme.</span></div><div class="visitActions"><button data-leave>Continuer la recherche</button><button data-favorite>Garder en favori</button><button data-finish>Finir la visite</button></div></div></section>`;
  root.querySelector<HTMLButtonElement>('[data-leave]')!.onclick=()=>renderPanel(root);
  root.querySelector<HTMLButtonElement>('[data-favorite]')!.onclick=()=>{shortlistProperty(id);renderPanel(root)};
  root.querySelector<HTMLButtonElement>('[data-finish]')!.onclick=()=>{const v=readVisits();v.visited[id]=Date.now();delete v.selected;writeVisits(v);renderPanel(root)};
}

function confirmPurchase(root:HTMLElement,id:string){
  const snap=getPropertyLifeSnapshot(),o=snap.offers.find(x=>x.id===id);if(!o)return;
  if(!readVisits().visited[id])return;
  root.innerHTML=`<div class="propertyAgencyBackdrop"></div><section class="propertyDecision" role="dialog" aria-modal="true"><small>DÉCISION À DEUX</small><h2>${esc(o.title)}</h2><p>${money(o.price)} · ${esc(o.city)} · ${esc(o.region)}</p><p>Acheter ce bien ne les oblige pas à y déménager. Ils peuvent en faire leur résidence principale ou le garder comme autre propriété.</p><div><button data-cancel>Aucune décision maintenant</button><button data-secondary>Acheter comme autre résidence</button><button data-main>Acheter et s’y installer</button></div></section>`;
  root.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>renderPanel(root);
  root.querySelector<HTMLButtonElement>('[data-secondary]')!.onclick=()=>{purchaseProperty(id,false);renderPanel(root)};
  root.querySelector<HTMLButtonElement>('[data-main]')!.onclick=()=>{purchaseProperty(id,true);renderPanel(root)};
}

export function openPropertyAgency(){
  let root=document.getElementById('moniaPropertyAgency');if(root)root.remove();
  root=document.createElement('div');root.id='moniaPropertyAgency';root.className='moniaPropertyAgency';document.body.appendChild(root);renderPanel(root);
}
function openPanel(){openPropertyAgency()}

let raf=0;function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(ensureEntry)}
window.addEventListener('monia:property-changed',schedule as EventListener);window.addEventListener('monia:property-ui-changed',schedule as EventListener);window.addEventListener('storage',schedule);new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});schedule();

declare global{interface Window{__moniaOpenPropertyAgency?:()=>void}}
window.__moniaOpenPropertyAgency=openPropertyAgency;
