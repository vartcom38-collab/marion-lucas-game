import './ordinary-life-direction-bridge.css';
import { getLucasPresence } from './lucas-presence-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Beat={id:string;kind:'quiet'|'practical'|'self'|'social'|'couple'|'outing';score:number;reason:string;place:string;time:string};
type Save={screen?:string;overlay?:unknown;place?:string};
let renderFrame=0;
let lastSignature='';

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c))}
function visible(){const s=read();return !!s&&s.screen==='game'&&!s.overlay&&!document.querySelector('.surprisePlayer,.cinematicOverlay,.phoneDevice[data-open="true"]')}
function norm(v:unknown){return String(v||'').trim().toLowerCase()}
function homeLike(place:string){return /home|appart|maison|finca|hotel|chambre/.test(norm(place))}

const labels:Record<string,string>={
  'tea-window':'Prendre quelque chose et rester un peu là','read-few-pages':'Lire quelques pages','music-floor':'Mettre un peu de musique','balcony-air':'Prendre l’air un instant','late-sofa':'Ne rien faire quelques minutes',
  'tidy-drawer':'Ranger un petit coin','laundry-fold':'Plier ce qui traîne','kitchen-reset':'Remettre un peu la cuisine en ordre','quick-groceries':'Faire une petite course','water-plants':'S’occuper des plantes',
  'journal-note':'Noter quelque chose pour moi','personal-admin':'Régler deux petites choses','outfit-choice':'Choisir tranquillement ma tenue','photo-sort':'Regarder quelques photos','own-project':'Avancer un peu sur mon truc',
  'friend-message':'Envoyer un petit message','short-coffee':'Prendre un café rapidement','family-checkin':'Prendre des nouvelles','voice-note-friend':'Envoyer un vocal','street-hello':'Profiter d’un petit moment dehors',
  'shared-coffee':'Prendre un café avec Lucas','small-touch':'Rester près de Lucas un instant','quiet-kitchen':'Rester avec lui dans la cuisine','brief-checkin':'Prendre deux minutes avec Lucas','same-room-silence':'Rester simplement dans la même pièce',
  'short-walk':'Faire un petit tour','bakery-run':'Passer chercher quelque chose dehors','market-loop':'Faire un détour par le marché','errand-route':'Sortir faire une petite course','sunset-step-out':'Sortir quelques minutes avant la fin du jour',
};
function suffix(id:string){return id.replace(/^ordinary-(quiet|practical|self|social|couple|outing)-/,'')}
function label(beat:Beat){return labels[suffix(beat.id)]||({quiet:'Prendre un moment calme',practical:'Faire un petit truc ici',self:'Prendre un moment pour moi',social:'Voir un peu quelqu’un',couple:'Rester un peu avec Lucas',outing:'Prendre un peu l’air'}[beat.kind])}
function allowed(beat:Beat,s:Save){
  if(beat.kind==='couple'&&getLucasPresence()?.together!==true)return false;
  const id=suffix(beat.id),place=String(s.place||beat.place||'');
  if(['tea-window','read-few-pages','music-floor','balcony-air','late-sofa','tidy-drawer','laundry-fold','kitchen-reset','water-plants','shared-coffee','quiet-kitchen','same-room-silence'].includes(id)&&!homeLike(place))return false;
  return true;
}
function remove(){document.querySelectorAll('[data-ordinary-life-choice]').forEach(el=>el.remove());lastSignature=''}
function render(){
  if(!visible()){remove();return}
  const s=read();const host=document.querySelector<HTMLElement>('.moniaNarrativeChoices');if(!s||!host){remove();return}
  const beats=((window.__moniaOrdinaryLifeBeats?.()||[]) as Beat[]).filter(b=>allowed(b,s)).slice(0,2);
  const existingCount=host.querySelectorAll('.moniaNarrativeChoice:not([data-ordinary-life-choice])').length;
  const room=Math.max(0,5-existingCount);const desired=beats.slice(0,Math.min(2,room));
  const signature=[s.place,getLucasPresence()?.together===true?'with-lucas':'without-lucas',existingCount,...desired.map(b=>b.id)].join('|');
  if(signature===lastSignature&&host.querySelectorAll('[data-ordinary-life-choice]').length===desired.length)return;
  document.querySelectorAll('[data-ordinary-life-choice]').forEach(el=>el.remove());lastSignature=signature;
  for(const beat of desired){const button=document.createElement('button');button.type='button';button.className='moniaNarrativeChoice moniaOrdinaryLifeChoice';button.dataset.ordinaryLifeChoice=beat.id;button.innerHTML=`<span>·</span>${esc(label(beat))}`;button.title=beat.reason;host.appendChild(button)}
}
function schedule(){if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;render()})}

document.addEventListener('click',event=>{const target=event.target as HTMLElement;const button=target.closest<HTMLElement>('[data-ordinary-life-choice]');if(!button)return;const id=String(button.dataset.ordinaryLifeChoice||'');if(!id)return;const result=window.__moniaConsumeOrdinaryLifeBeat?.(id);if(result?.ok){lastSignature='';schedule()}});
window.addEventListener('monia:ordinary-life-opportunity',schedule);window.addEventListener('monia:save-changed',schedule);window.addEventListener('monia:daily-intent',schedule);
new MutationObserver(mutations=>{if(mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(n=>!(n instanceof Element)||!n.closest?.('[data-ordinary-life-choice]'))))schedule()}).observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

declare global{interface Window{__moniaOrdinaryLifeBeats?:()=>Beat[];__moniaConsumeOrdinaryLifeBeat?:(id:string)=>{ok:boolean;minutes:number}}}
