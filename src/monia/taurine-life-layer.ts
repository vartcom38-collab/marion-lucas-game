import './taurine-life-layer.css';
import {getLucasCareerEvolution} from './lucas-career-evolution';
import {getLucasPresence} from './lucas-presence-engine';
import {getLucasProfessionalContext} from './lucas-professional-context';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;flags?:Record<string,unknown>};

export type TaurineMoment='none'|'morning-routine'|'sorteo-window'|'pre-corrida-focus'|'corrida-window'|'post-corrida'|'training-day'|'travel-day';
export type TaurineLifeContext={moment:TaurineMoment;lucasBusy:boolean;marionOptions:string[];mediaRisk:'low'|'medium'|'high';notes:string[]};
type Trace={rhythm:'training'|'focus'|'departure'|'recovery'|'team'|'quiet';eyebrow:string;title:string;detail:string;tone:'quiet'|'focus'};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function esc(v:string){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function visibleCareerPlace(place:string){return['madrid','family','finca','estate','hotel','arenes'].includes(place)}

export function getTaurineLifeContext():TaurineLifeContext|null{
  const s=read();if(!s)return null;const h=mins(String(s.time||'09:00')),pro=getLucasProfessionalContext();let moment:TaurineMoment='none';
  if(pro.kind==='corrida'){
    if(pro.phase==='after'||pro.recovery)moment='post-corrida';
    else if(h<660)moment='morning-routine';
    else if(h<780)moment='sorteo-window';
    else if(pro.phase==='before')moment='pre-corrida-focus';
    else moment='corrida-window';
  }else if(pro.kind==='training')moment='training-day';
  else if(pro.kind==='travel')moment='travel-day';
  else if(pro.kind==='recovery')moment='post-corrida';
  const busy=pro.active&&pro.phone!=='available';
  const opts:string[]=[];const notes:string[]=[];
  if(moment==='morning-routine'){opts.push('Laisser Lucas suivre son rituel','Prendre le petit-déjeuner ensemble si le contexte le permet');notes.push('Ne pas transformer le matin de corrida en rendez-vous romantique obligatoire.')}
  if(moment==='sorteo-window'){opts.push('Le laisser à ses obligations','Suivre la matinée de loin');notes.push('Le sorteo/apartado est un moment professionnel, pas une sortie de couple.')}
  if(moment==='pre-corrida-focus'){opts.push('L’accompagner sans l’envahir','Le laisser se concentrer','Faire sa propre journée');notes.push('Prioriser concentration, repos, cuadrilla, hôtel et logistique.')}
  if(moment==='corrida-window'){opts.push('Assister au spectacle','Rester en tribune','Être au callejón seulement si une autorisation/invitation existe','Faire autre chose en ville');notes.push('Le callejón ne doit jamais être présenté comme librement accessible.')}
  if(moment==='post-corrida'){opts.push('Attendre Lucas','Le laisser avec la presse et son équipe','Le rejoindre plus tard');notes.push('La disponibilité dépend du résultat, de la presse, des soins éventuels et de la cuadrilla.')}
  if(moment==='training-day')opts.push('Aller le voir s’entraîner','Le laisser travailler','Faire une activité séparée');
  if(moment==='travel-day')opts.push('Voyager avec lui si le contexte le permet','Le rejoindre plus tard','Rester à Nîmes/Madrid et vivre sa propre journée');
  const mediaRisk=moment==='corrida-window'||moment==='post-corrida'?'high':moment==='pre-corrida-focus'||moment==='travel-day'?'medium':'low';
  return{moment,lucasBusy:busy,marionOptions:opts,mediaRisk,notes};
}

function traceFor(s:Save):Trace|null{
  if(!s.metLucas||!visibleCareerPlace(String(s.place||'')))return null;
  const context=getTaurineLifeContext(),presence=getLucasPresence(),career=getLucasCareerEvolution(),pro=getLucasProfessionalContext();if(!context||!career)return null;
  const day=Number(s.day||1),variant=hash(`${day}:${career.phase}:${context.moment}:${pro.kind}:${pro.phase}`)%3;
  if(context.moment==='training-day'){
    const titles=['Le travail a commencé tôt','Une journée physique','Le matériel n’est pas rangé'];
    const details=['Sac, bouteille et affaires d’entraînement laissent deviner le rythme de la matinée.','La maison porte les traces d’un passage rapide entre préparation et récupération.','Quelques affaires près de l’entrée rappellent que Lucas n’est pas simplement « absent ».'];
    return{rhythm:pro.recovery?'recovery':'training',eyebrow:'Rythme de Lucas',title:titles[variant],detail:details[variant],tone:'focus'};
  }
  if(context.moment==='travel-day'||presence?.state==='traveling'){
    const titles=['Départ en cours','La journée se joue ailleurs','Un passage, puis la route'];
    const details=['Valise légère et affaires prêtes : son travail l’emmène ailleurs pour quelques heures ou davantage.','Le lieu paraît momentanément plus calme ; Lucas est pris par un déplacement professionnel.','Les traces d’un départ récent restent visibles sans figer Marion dans l’attente.'];
    return{rhythm:'departure',eyebrow:'Mouvement',title:titles[variant],detail:details[variant],tone:'quiet'};
  }
  if(context.moment==='post-corrida'||pro.recovery){
    const titles=['Le rythme retombe','Après l’intensité','Retour plus silencieux'];
    const details=['La journée laisse place à la récupération, aux échanges avec l’équipe et au calme.','Tout n’est pas immédiatement disponible après une journée d’arène.','Le décor paraît plus posé : récupération, douche, soins et silence prennent leur place.'];
    return{rhythm:'recovery',eyebrow:'Après la journée',title:titles[variant],detail:details[variant],tone:'quiet'};
  }
  if(context.moment==='pre-corrida-focus'||context.moment==='sorteo-window'||context.moment==='corrida-window'){
    const titles=['Une maison en mode travail','Concentration','Son équipe gravite autour de la journée'];
    const details=['Téléphone, horaires et passages rapides donnent au lieu un autre rythme.','La présence de Lucas, quand il est là, est plus concentrée que disponible.','La journée se structure autour de ses obligations sans transformer Marion en simple accompagnatrice.'];
    return{rhythm:'focus',eyebrow:'Journée professionnelle',title:titles[variant],detail:details[variant],tone:'focus'};
  }
  if(pro.kind==='media'||pro.kind==='team'||presence?.state==='working')return{rhythm:'team',eyebrow:'En coulisses',title:'Lucas est pris par son travail',detail:'Le lieu continue de vivre pendant qu’il gère entraînement, équipe ou rendez-vous professionnels.',tone:'quiet'};
  if(career.recoveryNeed>=68&&hash(`recovery:${day}`)%4===0)return{rhythm:'recovery',eyebrow:'Rythme plus calme',title:'Une journée qui ménage le corps',detail:'La carrière se ressent aussi dans les moments où Lucas réduit le rythme et récupère.',tone:'quiet'};
  return null;
}

function world(){return document.querySelector<HTMLElement>('.worldScene,.worldStage,.gameWorld,.gameScene')}
function removeTrace(){document.getElementById('taurineCareerTrace')?.remove();const w=world();if(w){delete w.dataset.taurineRhythm;delete w.dataset.taurinePhase}}
function renderTrace(){const s=read(),w=world();if(!s||!w){removeTrace();return}const trace=traceFor(s),career=getLucasCareerEvolution();if(!trace||!career){removeTrace();return}w.dataset.taurineRhythm=trace.rhythm;w.dataset.taurinePhase=career.phase;let root=document.getElementById('taurineCareerTrace');if(root?.dataset.key===`${s.day}:${s.time}:${trace.rhythm}`)return;root?.remove();root=document.createElement('aside');root.id='taurineCareerTrace';root.className='taurineCareerTrace';root.dataset.tone=trace.tone;root.dataset.key=`${s.day}:${s.time}:${trace.rhythm}`;root.setAttribute('aria-hidden','true');root.innerHTML=`<span>${esc(trace.eyebrow)}</span><strong>${esc(trace.title)}</strong><small>${esc(trace.detail)}</small>`;w.appendChild(root)}
let timer=0;function schedule(){if(timer)window.clearTimeout(timer);timer=window.setTimeout(renderTrace,140)}
window.addEventListener('storage',schedule);window.addEventListener('marion:statechange',schedule as EventListener);window.addEventListener('monia:madrid-home-changed',schedule as EventListener);window.addEventListener('monia:travel-arrival',schedule as EventListener);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});window.setInterval(schedule,12000);schedule();

declare global{interface Window{__moniaTaurineLifeContext?:()=>TaurineLifeContext|null}}
window.__moniaTaurineLifeContext=getTaurineLifeContext;
console.info('[Taurine life] career traces, calls and presence now share one professional context');
