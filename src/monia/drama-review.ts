import { manifestEntryFromCandidate, readDramaCandidate, readDramaReview, saveDramaReview, type DramaReviewRecord } from './drama-approval';

const checksDef=[
  ['marionIdentity','Identité Marion correcte'],
  ['lucasIdentity','Identité Lucas correcte'],
  ['wardrobe','Tenues cohérentes'],
  ['location','Lieu / décor cohérent'],
  ['motion','Mouvements naturels'],
  ['continuity','Continuité entre plans'],
  ['canon','Canon respecté'],
  ['voice','Voix validée / silence acceptable'],
] as const;

type CheckKey=(typeof checksDef)[number][0];
const candidate=readDramaCandidate();
const previous=readDramaReview();
const stateEl=document.getElementById('reviewState')!;
const titleEl=document.getElementById('candidateTitle')!;
const metaEl=document.getElementById('candidateMeta')!;
const clipsEl=document.getElementById('clips')!;
const checksEl=document.getElementById('checks')!;
const notesEl=document.getElementById('notes') as HTMLTextAreaElement;
const manifestEl=document.getElementById('manifestJson')!;
const approveBtn=document.getElementById('approve') as HTMLButtonElement;
const rejectBtn=document.getElementById('reject') as HTMLButtonElement;
const copyBtn=document.getElementById('copy') as HTMLButtonElement;

if(!candidate){
  stateEl.textContent='Aucun candidat disponible. Lance d’abord une génération candidate depuis le jeu/Test Lab.';
  approveBtn.disabled=true;rejectBtn.disabled=true;copyBtn.disabled=true;
}else{
  const sameReview=previous?.candidateId===candidate.drama.id?previous:null;
  titleEl.textContent=candidate.drama.title||'Candidat Drama';
  metaEl.textContent=`${candidate.drama.clips.length} plans · ${candidate.drama.targetDuration}s cible · ${new Date(candidate.createdAt).toLocaleString('fr-FR')}`;
  stateEl.className=candidate.quality.complete&&candidate.quality.continuity?'ok':'warning';
  stateEl.textContent=candidate.quality.complete&&candidate.quality.continuity?'✓ Contrôles techniques automatiques passés. Validation humaine requise.':'⚠ Le candidat a un problème technique automatique. Il ne peut pas être approuvé.';

  for(const clip of candidate.drama.clips){
    const card=document.createElement('article');card.className='clip';
    const video=clip.videoUrl?`<video controls playsinline preload="metadata" src="${escapeAttr(clip.videoUrl)}"></video>`:'<div class="warning">Vidéo absente</div>';
    card.innerHTML=`${video}<div class="meta"><strong>${escapeHtml(clip.role)}</strong> · plan ${clip.index+1}<br>${escapeHtml(clip.framing)} · continuité: ${escapeHtml(clip.continuitySource||'—')} · ${escapeHtml(clip.state)}</div>`;
    clipsEl.appendChild(card);
  }

  for(const [key,label] of checksDef){
    const row=document.createElement('label');
    const input=document.createElement('input');input.type='checkbox';input.dataset.check=key;
    input.checked=Boolean(sameReview?.checks[key]);
    row.append(input,document.createTextNode(label));checksEl.appendChild(row);
  }
  notesEl.value=sameReview?.notes||'';
  const entry=manifestEntryFromCandidate(candidate);
  manifestEl.textContent=JSON.stringify(entry,null,2);

  function snapshot(decision:'pending'|'approved'|'rejected'):DramaReviewRecord{
    const checks={} as DramaReviewRecord['checks'];
    for(const [key] of checksDef)checks[key]=(checksEl.querySelector<HTMLInputElement>(`[data-check="${key}"]`)?.checked)===true;
    return{signature:candidate!.signature,candidateId:candidate!.drama.id,updatedAt:Date.now(),decision,checks,notes:notesEl.value.trim()};
  }
  function allChecks(review:DramaReviewRecord){return Object.values(review.checks).every(Boolean)}
  function persistPending(){saveDramaReview(snapshot('pending'))}
  checksEl.addEventListener('change',persistPending);notesEl.addEventListener('input',persistPending);
  approveBtn.onclick=()=>{
    const review=snapshot('approved');
    if(!candidate!.quality.complete||!candidate!.quality.continuity){stateEl.className='warning';stateEl.textContent='Impossible d’approuver : les contrôles techniques ne sont pas tous verts.';return}
    if(!allChecks(review)){stateEl.className='warning';stateEl.textContent='Coche tous les contrôles qualité avant d’approuver.';return}
    saveDramaReview(review);stateEl.className='ok';stateEl.textContent='✓ Candidat validé localement. Il reste hors production tant que le manifeste verrouillé n’a pas été mis à jour.';
  };
  rejectBtn.onclick=()=>{const review=snapshot('rejected');saveDramaReview(review);stateEl.className='warning';stateEl.textContent='Candidat rejeté. Il ne sera jamais utilisé en live.'};
  copyBtn.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(entry,null,2));copyBtn.textContent='✓ Copié';setTimeout(()=>copyBtn.textContent='Copier l’entrée manifest',1200)}catch{}};
}

function escapeHtml(value:string){return value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}
function escapeAttr(value:string){return escapeHtml(value)}
