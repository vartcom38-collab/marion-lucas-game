import { manifestEntryFromCandidate, readDramaCandidate, readDramaReview, saveDramaReview, type DramaReviewRecord } from './drama-approval';
import { approveAssembledScene, readAssembledSceneCandidate, readAssembledSceneReview, rejectAssembledScene, saveAssembledSceneReview, type AssembledSceneReview } from './assembled-scene-approval';

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

const assembled=readAssembledSceneCandidate();
const assembledReview=readAssembledSceneReview();
const legacy=readDramaCandidate();
const legacyReview=readDramaReview();

if(assembled){
  const defs=[
    ['lucasIdentity','Identité Lucas correcte'],['marionIdentity','Identité Marion correcte'],['continuity','Continuité entre plans'],['wardrobe','Tenues cohérentes'],['location','Lieu / décor cohérent'],['motion','Mouvements naturels'],['canon','Canon respecté'],['completeAssembly','Assemblage complet et propre'],
  ] as const;
  const previous=assembledReview?.candidateId===assembled.id?assembledReview:null;
  titleEl.textContent='Mini-drama assemblé · candidat';
  metaEl.textContent=`${assembled.route} · ${assembled.shotIds.length} plans · ${new Date(assembled.createdAt).toLocaleString('fr-FR')}`;
  stateEl.className='ok';stateEl.textContent='✓ Scène assemblée prête à être contrôlée. Une seule validation approuve tout le mini-drama.';
  const card=document.createElement('article');card.className='clip';
  card.innerHTML=`<video controls playsinline preload="metadata" src="${escapeAttr(assembled.videoUrl)}"></video><div class="meta"><strong>Scène complète</strong><br>continuité ${escapeHtml(assembled.continuityKey)} · candidat uniquement</div>`;
  clipsEl.appendChild(card);
  for(const [key,label] of defs){const row=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.dataset.check=key;input.checked=Boolean(previous?.checks[key]);row.append(input,document.createTextNode(label));checksEl.appendChild(row)}
  notesEl.value=previous?.notes||'';
  const manifest={type:'assembled-scene',candidateId:assembled.id,jobId:assembled.jobId,route:assembled.route,continuityKey:assembled.continuityKey,videoUrl:assembled.videoUrl,shotIds:assembled.shotIds,approvalRequired:true,autoPublish:false};
  manifestEl.textContent=JSON.stringify(manifest,null,2);
  const snapshot=(decision:'pending'|'approved'|'rejected'):AssembledSceneReview=>{const checks={} as AssembledSceneReview['checks'];for(const [key] of defs)checks[key]=checksEl.querySelector<HTMLInputElement>(`[data-check="${key}"]`)?.checked===true;return{candidateId:assembled.id,decision,updatedAt:Date.now(),checks,notes:notesEl.value.trim()}};
  const persist=()=>saveAssembledSceneReview(snapshot('pending'));
  checksEl.addEventListener('change',persist);notesEl.addEventListener('input',persist);
  approveBtn.textContent='✓ Valider la scène complète';
  approveBtn.onclick=async()=>{const review=snapshot('pending');saveAssembledSceneReview(review);if(!Object.values(review.checks).every(Boolean)){stateEl.className='warning';stateEl.textContent='Coche tous les contrôles qualité avant de valider la scène.';return}try{await approveAssembledScene(assembled.id,notesEl.value.trim());stateEl.className='ok';stateEl.textContent='✓ Scène complète approuvée dans le coffre MonIA. Elle peut désormais être utilisée comme média approuvé.'}catch(error){stateEl.className='warning';stateEl.textContent=`Validation impossible : ${error instanceof Error?error.message:String(error)}`}};
  rejectBtn.onclick=async()=>{await rejectAssembledScene(assembled.id,notesEl.value.trim());stateEl.className='warning';stateEl.textContent='Scène complète rejetée. Elle reste hors gameplay.'};
  copyBtn.onclick=()=>copyJson(manifest);
}else if(legacy){
  const defs=[['marionIdentity','Identité Marion correcte'],['lucasIdentity','Identité Lucas correcte'],['wardrobe','Tenues cohérentes'],['location','Lieu / décor cohérent'],['motion','Mouvements naturels'],['continuity','Continuité entre plans'],['canon','Canon respecté'],['voice','Voix validée / silence acceptable']] as const;
  const previous=legacyReview?.candidateId===legacy.drama.id?legacyReview:null;
  titleEl.textContent=legacy.drama.title||'Candidat Drama';metaEl.textContent=`${legacy.drama.clips.length} plans · ${legacy.drama.targetDuration}s cible · ${new Date(legacy.createdAt).toLocaleString('fr-FR')}`;
  stateEl.className=legacy.quality.complete&&legacy.quality.continuity?'ok':'warning';stateEl.textContent=legacy.quality.complete&&legacy.quality.continuity?'✓ Contrôles techniques automatiques passés. Validation humaine requise.':'⚠ Le candidat a un problème technique automatique.';
  for(const clip of legacy.drama.clips){const card=document.createElement('article');card.className='clip';card.innerHTML=`${clip.videoUrl?`<video controls playsinline preload="metadata" src="${escapeAttr(clip.videoUrl)}"></video>`:'<div class="warning">Vidéo absente</div>'}<div class="meta"><strong>${escapeHtml(clip.role)}</strong> · plan ${clip.index+1}<br>${escapeHtml(clip.framing)} · ${escapeHtml(clip.state)}</div>`;clipsEl.appendChild(card)}
  for(const [key,label] of defs){const row=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.dataset.check=key;input.checked=Boolean(previous?.checks[key]);row.append(input,document.createTextNode(label));checksEl.appendChild(row)}
  notesEl.value=previous?.notes||'';const entry=manifestEntryFromCandidate(legacy);manifestEl.textContent=JSON.stringify(entry,null,2);
  const snapshot=(decision:'pending'|'approved'|'rejected'):DramaReviewRecord=>{const checks={} as DramaReviewRecord['checks'];for(const [key] of defs)checks[key]=checksEl.querySelector<HTMLInputElement>(`[data-check="${key}"]`)?.checked===true;return{signature:legacy.signature,candidateId:legacy.drama.id,updatedAt:Date.now(),decision,checks,notes:notesEl.value.trim()}};
  const persist=()=>saveDramaReview(snapshot('pending'));checksEl.addEventListener('change',persist);notesEl.addEventListener('input',persist);
  approveBtn.onclick=()=>{const review=snapshot('approved');if(!legacy.quality.complete||!legacy.quality.continuity||!Object.values(review.checks).every(Boolean)){stateEl.className='warning';stateEl.textContent='Impossible d’approuver tant que tous les contrôles ne sont pas verts.';return}saveDramaReview(review);stateEl.className='ok';stateEl.textContent='✓ Candidat validé localement. Il reste hors production tant que le manifeste verrouillé n’a pas été mis à jour.'};
  rejectBtn.onclick=()=>{saveDramaReview(snapshot('rejected'));stateEl.className='warning';stateEl.textContent='Candidat rejeté. Il ne sera jamais utilisé en live.'};copyBtn.onclick=()=>copyJson(entry);
}else{
  stateEl.textContent='Aucun candidat disponible. Lance d’abord une génération candidate depuis le jeu/Test Lab.';approveBtn.disabled=true;rejectBtn.disabled=true;copyBtn.disabled=true;
}

async function copyJson(value:unknown){try{await navigator.clipboard.writeText(JSON.stringify(value,null,2));copyBtn.textContent='✓ Copié';setTimeout(()=>copyBtn.textContent='Copier l’entrée manifest',1200)}catch{}}
function escapeHtml(value:string){return value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c))}
function escapeAttr(value:string){return escapeHtml(value)}
