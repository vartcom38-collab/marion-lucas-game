import { Client, handle_file } from '@gradio/client';
import { lucasVoiceReferenceFile } from './lucas-voice-reference';

type ClonePreset={id:string;label:string;detail:string;exaggeration:number;temperature:number;cfg:number;seed:number};
const SPACE_ID='ResembleAI/Chatterbox-Multilingual-TTS';
const FAVORITES_KEY='monia-lucas-clone-favorites-v1';
const DEFAULT_TEXT='Marion… attends. Je voulais juste entendre ta voix avant de rentrer.';

const PRESETS:ClonePreset[]=[
{id:'c01',label:'Naturel 1',detail:'très neutre, proche de la référence',exaggeration:.35,temperature:.65,cfg:.55,seed:1101},
{id:'c02',label:'Naturel 2',detail:'neutre avec un peu plus de présence',exaggeration:.45,temperature:.75,cfg:.5,seed:1102},
{id:'c03',label:'Naturel 3',detail:'conversation spontanée',exaggeration:.5,temperature:.85,cfg:.45,seed:1103},
{id:'c04',label:'Tendre 1',detail:'doux et proche',exaggeration:.4,temperature:.7,cfg:.4,seed:1201},
{id:'c05',label:'Tendre 2',detail:'intime sans chuchoter',exaggeration:.55,temperature:.72,cfg:.38,seed:1202},
{id:'c06',label:'Tendre 3',detail:'plus émotionnel et respiré',exaggeration:.68,temperature:.78,cfg:.35,seed:1203},
{id:'c07',label:'Intense 1',detail:'posé, regard sérieux',exaggeration:.7,temperature:.75,cfg:.42,seed:1301},
{id:'c08',label:'Intense 2',detail:'plus de tension dramatique',exaggeration:.85,temperature:.82,cfg:.38,seed:1302},
{id:'c09',label:'Intense 3',detail:'fort mais encore naturel',exaggeration:1.0,temperature:.86,cfg:.34,seed:1303},
{id:'c10',label:'Calme 1',detail:'lent et maîtrisé',exaggeration:.3,temperature:.55,cfg:.65,seed:1401},
{id:'c11',label:'Calme 2',detail:'grave léger, très posé',exaggeration:.38,temperature:.6,cfg:.7,seed:1402},
{id:'c12',label:'Calme 3',detail:'conversation de fin de journée',exaggeration:.48,temperature:.65,cfg:.62,seed:1403},
{id:'c13',label:'Espagnol léger 1',detail:'laisse davantage passer la couleur de la référence',exaggeration:.45,temperature:.75,cfg:.25,seed:1501},
{id:'c14',label:'Espagnol léger 2',detail:'plus souple sur le rythme français',exaggeration:.58,temperature:.8,cfg:.22,seed:1502},
{id:'c15',label:'Espagnol léger 3',detail:'plus expressif, toujours français',exaggeration:.72,temperature:.85,cfg:.2,seed:1503},
{id:'c16',label:'Drama 1',detail:'mini-drama romantique contenu',exaggeration:.75,temperature:.68,cfg:.38,seed:1601},
{id:'c17',label:'Drama 2',detail:'moment important, émotion retenue',exaggeration:.9,temperature:.72,cfg:.34,seed:1602},
{id:'c18',label:'Drama 3',detail:'tension + douceur',exaggeration:1.05,temperature:.76,cfg:.3,seed:1603},
{id:'c19',label:'Visio 1',detail:'naturel caméra, phrases courtes',exaggeration:.38,temperature:.78,cfg:.48,seed:1701},
{id:'c20',label:'Visio 2',detail:'chaleureux, vivant',exaggeration:.52,temperature:.82,cfg:.44,seed:1702},
{id:'c21',label:'Visio 3',detail:'réaction émotionnelle légère',exaggeration:.65,temperature:.86,cfg:.4,seed:1703},
{id:'c22',label:'Jeune 1',detail:'rythme plus léger',exaggeration:.42,temperature:.95,cfg:.38,seed:1801},
{id:'c23',label:'Jeune 2',detail:'spontané mais pas adolescent',exaggeration:.55,temperature:1.0,cfg:.34,seed:1802},
{id:'c24',label:'Jeune 3',detail:'plus énergique',exaggeration:.68,temperature:1.05,cfg:.32,seed:1803},
];

let appPromise:Promise<any>|null=null;
let activeAudio:HTMLAudioElement|null=null;
const generated=new Map<string,string>();
function favorites(){try{return new Set<string>(JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]'))}catch{return new Set<string>()}}
function saveFavorites(set:Set<string>){localStorage.setItem(FAVORITES_KEY,JSON.stringify([...set]));}
function stopAudio(){if(activeAudio){activeAudio.pause();activeAudio.src='';activeAudio=null}}
function deepAudio(value:any):string{
  if(!value)return'';
  if(typeof value==='string'&&(/^https?:\/\//.test(value)||/\.(wav|mp3|flac|ogg)(?:$|\?)/i.test(value)))return value;
  if(Array.isArray(value)){for(const item of value){const found=deepAudio(item);if(found)return found}return''}
  const direct=value?.url||value?.path||value?.audio?.url||value?.audio?.path;
  if(typeof direct==='string'&&direct)return direct;
  for(const key of ['data','result','output','outputs','files']){const found=deepAudio(value?.[key]);if(found)return found}
  return'';
}
async function client(){if(!appPromise)appPromise=Client.connect(SPACE_ID,{events:['status','data']});return appPromise}
async function endpoint(app:any){
  const info=await app.view_api();
  const named=info?.named_endpoints||{};
  for(const [name,spec] of Object.entries<any>(named)){
    const params=spec?.parameters||[];
    if(params.length>=7&&params.some((p:any)=>String(p?.label||p?.parameter_name||'').toLowerCase().includes('language')))return name;
  }
  const unnamed=info?.unnamed_endpoints||{};
  for(const [name,spec] of Object.entries<any>(unnamed))if((spec?.parameters||[]).length>=7)return Number(name);
  throw new Error('Endpoint Chatterbox introuvable');
}
async function generate(preset:ClonePreset,text:string,onStatus:(s:string)=>void){
  const cached=generated.get(preset.id);if(cached)return cached;
  onStatus('connexion ZeroGPU…');
  const app=await client();
  const ep=await endpoint(app);
  onStatus('envoi de la voix de référence…');
  const ref=lucasVoiceReferenceFile();
  const result=await app.predict(ep as any,[text.slice(0,300)||DEFAULT_TEXT,'fr',handle_file(ref),preset.exaggeration,preset.temperature,preset.seed,preset.cfg]);
  const url=deepAudio(result?.data??result);
  if(!url)throw new Error('Audio généré mais URL introuvable');
  generated.set(preset.id,url);return url;
}
function mount(){
  const host=document.getElementById('voiceAuditionLab');if(!host||document.getElementById('lucasCloneLab'))return;
  const section=document.createElement('section');section.id='lucasCloneLab';section.className='card voiceLab';
  section.innerHTML=`<h2>🧬 Clones de la vraie voix Lucas</h2><p class="status">Ces candidats utilisent tous la voix de l'homme que tu as validée comme référence. Chatterbox Multilingual tourne sur une file ZeroGPU gratuite. Aucun candidat n'est envoyé dans le jeu automatiquement.</p><div class="referenceNote"><strong>Référence verrouillée</strong><p>Voix homme de la vidéo validée · extrait préparé pour le clonage. Le bouton ci-dessous permet de la réécouter.</p><button type="button" class="ghost" data-clone-reference>▶ Écouter la référence</button></div><label style="display:block;margin-top:14px">Phrase de comparaison<textarea data-clone-text rows="3">${DEFAULT_TEXT}</textarea></label><div class="voiceToolbar"><button type="button" class="ghost" data-clone-stop>■ Tout arrêter</button><label><input type="checkbox" data-clone-favorites> seulement mes ★</label><span class="pill" data-clone-count>${PRESETS.length} candidats</span><span class="pill" data-clone-status>Prêt</span></div><div class="voiceGrid" data-clone-grid></div>`;
  host.insertAdjacentElement('afterend',section);
  const grid=section.querySelector<HTMLElement>('[data-clone-grid]')!;
  const status=section.querySelector<HTMLElement>('[data-clone-status]')!;
  const text=section.querySelector<HTMLTextAreaElement>('[data-clone-text]')!;
  const only=section.querySelector<HTMLInputElement>('[data-clone-favorites]')!;
  const fav=favorites();
  const render=()=>{
    grid.innerHTML='';const list=only.checked?PRESETS.filter(p=>fav.has(p.id)):PRESETS;
    for(const p of list){const card=document.createElement('article');card.className='voiceCandidate';card.dataset.cloneId=p.id;card.innerHTML=`<div class="voiceCandidateTop"><div><strong>${p.label}</strong><small>${p.detail}</small></div><button type="button" class="voiceStar" data-star>${fav.has(p.id)?'★':'☆'}</button></div><div class="voicePreset">Même voix de base<span>expressivité ${p.exaggeration.toFixed(2)} · rythme ${p.cfg.toFixed(2)} · variation ${p.temperature.toFixed(2)}</span></div><div class="voiceActions"><button type="button" class="voiceListen" data-generate>▶ Générer / écouter</button><code>${p.id}</code></div>`;
      card.querySelector('[data-star]')?.addEventListener('click',()=>{fav.has(p.id)?fav.delete(p.id):fav.add(p.id);saveFavorites(fav);render()});
      card.querySelector('[data-generate]')?.addEventListener('click',async e=>{const button=e.currentTarget as HTMLButtonElement;button.disabled=true;stopAudio();try{status.textContent=`${p.label} · génération…`;const url=await generate(p,text.value,s=>status.textContent=`${p.label} · ${s}`);activeAudio=new Audio(url);activeAudio.preload='auto';activeAudio.onended=()=>{activeAudio=null;status.textContent='Prêt'};await activeAudio.play();status.textContent=`${p.label} · lecture`}catch(err){status.textContent=`Échec ${p.label} · ${err instanceof Error?err.message:String(err)}`}finally{button.disabled=false}});
      grid.appendChild(card)
    }
  };
  only.addEventListener('change',render);section.querySelector('[data-clone-stop]')?.addEventListener('click',()=>{stopAudio();status.textContent='Arrêté'});
  section.querySelector('[data-clone-reference]')?.addEventListener('click',()=>{stopAudio();const file=lucasVoiceReferenceFile();const url=URL.createObjectURL(file);activeAudio=new Audio(url);activeAudio.onended=()=>{URL.revokeObjectURL(url);activeAudio=null};void activeAudio.play()});
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
console.info('[MonIA Test] Lucas reference-voice clone audition lab ready');
