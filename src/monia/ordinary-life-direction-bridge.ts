import './ordinary-life-direction-bridge.css';

const SAVE_KEY='marion-lucas-save-v4';
type Beat={id:string;kind:'quiet'|'practical'|'self'|'social'|'couple'|'outing';score:number;reason:string;place:string;time:string};
type Save={screen?:string;overlay?:unknown};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c))}
function visible(){const s=read();return !!s&&s.screen==='game'&&!s.overlay&&!document.querySelector('.surprisePlayer,.cinematicOverlay,.phoneDevice[data-open="true"]')}

const labels:Record<string,string>={
  'tea-window':'Prendre quelque chose et rester un peu là',
  'read-few-pages':'Lire quelques pages',
  'music-floor':'Mettre un peu de musique',
  'balcony-air':'Prendre l’air un instant',
  'late-sofa':'Ne rien faire quelques minutes',
  'tidy-drawer':'Ranger un petit coin',
  'laundry-fold':'Plier ce qui traîne',
  'kitchen-reset':'Remettre un peu la cuisine en ordre',
  'quick-groceries':'Faire une petite course',
  'water-plants':'S’occuper des plantes',
  'journal-note':'Noter quelque chose pour moi',
  'personal-admin':'Régler deux petites choses',
  'outfit-choice':'Choisir tranquillement ma tenue',
  'photo-sort':'Regarder quelques photos',
  'own-project':'Avancer un peu sur mon truc',
  'friend-message':'Envoyer un petit message',
  'short-coffee':'Prendre un café rapidement',
  'family-checkin':'Prendre des nouvelles',
  'voice-note-friend':'Envoyer un vocal',
  'street-hello':'Profiter d’un petit moment dehors',
  'shared-coffee':'Prendre un café avec Lucas',
  'small-touch':'Rester près de Lucas un instant',
  'quiet-kitchen':'Rester avec lui dans la cuisine',
  'brief-checkin':'Prendre deux minutes avec Lucas',
  'same-room-silence':'Rester simplement dans la même pièce',
  'short-walk':'Faire un petit tour',
  'bakery-run':'Passer chercher quelque chose dehors',
  'market-loop':'Faire un détour par le marché',
  'errand-route':'Sortir faire une petite course',
  'sunset-step-out':'Sortir quelques minutes avant la fin du jour',
};
function suffix(id:string){return id.replace(/^ordinary-(quiet|practical|self|social|couple|outing)-/,'')}
function label(beat:Beat){return labels[suffix(beat.id)]||({quiet:'Prendre un moment calme',practical:'Faire un petit truc ici',self:'Prendre un moment pour moi',social:'Voir un peu quelqu’un',couple:'Rester un peu avec Lucas',outing:'Prendre un peu l’air'}[beat.kind])}

function remove(){document.querySelectorAll('[data-ordinary-life-choice]').forEach(el=>el.remove())}
function render(){
  remove();if(!visible())return;
  const host=document.querySelector<HTMLElement>('.moniaNarrativeChoices');if(!host)return;
  const beats=(window.__moniaOrdinaryLifeBeats?.()||[]).slice(0,2) as Beat[];if(!beats.length)return;
  const existingCount=host.querySelectorAll('.moniaNarrativeChoice').length;
  const room=Math.max(0,5-existingCount);if(room<=0)return;
  for(const beat of beats.slice(0,Math.min(2,room))){
    const button=document.createElement('button');button.type='button';button.className='moniaNarrativeChoice moniaOrdinaryLifeChoice';button.dataset.ordinaryLifeChoice=beat.id;
    button.innerHTML=`<span>·</span>${esc(label(beat))}`;button.title=beat.reason;host.appendChild(button);
  }
}

document.addEventListener('click',event=>{const target=event.target as HTMLElement;const button=target.closest<HTMLElement>('[data-ordinary-life-choice]');if(!button)return;const id=String(button.dataset.ordinaryLifeChoice||'');if(!id)return;const result=window.__moniaConsumeOrdinaryLifeBeat?.(id);if(result?.ok){remove();window.setTimeout(render,120)}});
window.addEventListener('monia:ordinary-life-opportunity',()=>window.setTimeout(render,50));
window.addEventListener('monia:save-changed',()=>window.setTimeout(render,80));
window.addEventListener('monia:daily-intent',()=>window.setTimeout(render,100));
new MutationObserver(()=>window.requestAnimationFrame(render)).observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>window.setTimeout(render,200),{once:true});else window.setTimeout(render,200);

declare global{interface Window{__moniaOrdinaryLifeBeats?:()=>Beat[];__moniaConsumeOrdinaryLifeBeat?:(id:string)=>{ok:boolean;minutes:number}}}
