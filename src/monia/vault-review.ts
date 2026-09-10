import { moniaCreativeVault, type MonIAAsset } from './creative-vault';

function safe(value:string){return value.replace(/[&<>\"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]||c));}

function media(asset:MonIAAsset){
  if(asset.kind==='voice')return `<audio controls preload="metadata" src="${safe(asset.url)}" style="width:100%"></audio>`;
  if(asset.kind==='video'||asset.kind==='visio')return `<video controls playsinline preload="metadata" src="${safe(asset.url)}" style="width:100%;max-height:360px;object-fit:contain;background:#111;border-radius:14px"></video>`;
  if(asset.kind==='image'||asset.kind==='decor'||asset.kind==='wardrobe')return `<img src="${safe(asset.url)}" alt="${safe(asset.role||asset.kind)}" style="width:100%;max-height:360px;object-fit:contain;background:#111;border-radius:14px" />`;
  return `<a href="${safe(asset.url)}" target="_blank" rel="noreferrer">Ouvrir le média</a>`;
}

function meta(asset:MonIAAsset){
  const entries=Object.entries(asset.metadata||{}).filter(([,v])=>v!==null&&v!==undefined).slice(0,6);
  return entries.length?`<small style="display:block;opacity:.72;margin-top:8px">${entries.map(([k,v])=>`${safe(k)}: ${safe(String(v))}`).join(' · ')}</small>`:'';
}

export function mountMonIAVaultReview(){
  if(document.getElementById('moniaVaultReview'))return;
  const host=document.createElement('section');host.id='moniaVaultReview';
  host.style.cssText='margin:24px auto;max-width:1100px;padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:rgba(20,18,16,.78);color:inherit';
  host.innerHTML='<div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap"><div><small style="letter-spacing:.12em;opacity:.7">COFFRE MONIA</small><h2 style="margin:.25rem 0">Candidats à valider</h2><p style="margin:.25rem 0;opacity:.72">Rien n’entre dans le jeu tant que tu ne l’as pas approuvé ici.</p></div><button id="refreshMoniaVault" type="button">↻ Actualiser</button></div><div id="moniaVaultStats" style="margin:14px 0;opacity:.8"></div><div id="moniaVaultCandidates"></div>';
  document.body.appendChild(host);

  const render=async()=>{
    const [stats,candidates]=await Promise.all([moniaCreativeVault.stats(),moniaCreativeVault.candidateAssets()]);
    const statsEl=document.getElementById('moniaVaultStats');if(statsEl)statsEl.textContent=`${stats.approved} approuvés · ${stats.candidates} candidats · ${stats.reused} réutilisations`;
    const list=document.getElementById('moniaVaultCandidates');if(!list)return;
    if(!candidates.length){list.innerHTML='<p style="padding:18px 0;opacity:.65">Aucun candidat en attente pour le moment.</p>';return;}
    list.innerHTML=candidates.map(asset=>`<article data-vault-id="${safe(asset.id)}" style="padding:16px 0;border-top:1px solid rgba(255,255,255,.1)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><strong>${safe(asset.actor||'MonIA')} · ${safe(asset.role||asset.kind)}</strong><div style="font-size:.86rem;opacity:.7">${safe(asset.kind)} · ${asset.tags.map(safe).join(' · ')}</div></div><span style="font-size:.78rem;opacity:.65">CANDIDAT</span></div><div style="margin:12px 0">${media(asset)}</div>${meta(asset)}<div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button type="button" data-vault-approve="${safe(asset.id)}">✓ Approuver</button><button type="button" data-vault-reject="${safe(asset.id)}">✕ Rejeter</button></div></article>`).join('');
  };

  host.addEventListener('click',async e=>{
    const target=e.target as HTMLElement;
    const approve=target.closest('[data-vault-approve]') as HTMLElement|null;
    const reject=target.closest('[data-vault-reject]') as HTMLElement|null;
    if(approve){const id=approve.dataset.vaultApprove||'';if(id&&window.confirm('Valider ce média pour que MonIA puisse le réutiliser dans le jeu ?')){await moniaCreativeVault.updateAsset(id,{status:'approved'});await render();window.dispatchEvent(new CustomEvent('monia:vault-changed'));}return;}
    if(reject){const id=reject.dataset.vaultReject||'';if(id){await moniaCreativeVault.updateAsset(id,{status:'rejected'});await render();window.dispatchEvent(new CustomEvent('monia:vault-changed'));}return;}
  });
  document.getElementById('refreshMoniaVault')?.addEventListener('click',()=>void render());
  window.addEventListener('monia:vault-changed',()=>void render());
  void render();
}
