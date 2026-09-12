const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={owner?:string;title?:string;day?:number;note?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;calendar?:CalendarItem[];flags?:Record<string,unknown>};

export type TaurineMoment='none'|'morning-routine'|'sorteo-window'|'pre-corrida-focus'|'corrida-window'|'post-corrida'|'training-day'|'travel-day';
export type TaurineLifeContext={moment:TaurineMoment;lucasBusy:boolean;marionOptions:string[];mediaRisk:'low'|'medium'|'high';notes:string[]};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function mins(t:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function todayText(s:Save){return (s.calendar||[]).filter(i=>Number(i.day||0)===Number(s.day||1)&&String(i.owner||'').toLowerCase()==='lucas').map(i=>`${i.title||''} ${i.note||''}`).join(' ').toLowerCase()}

export function getTaurineLifeContext():TaurineLifeContext|null{
  const s=read();if(!s)return null;const h=mins(String(s.time||'09:00')),text=todayText(s);let moment:TaurineMoment='none';
  if(/corrida|novillada|arène|arena/.test(text)){
    if(h<660)moment='morning-routine';else if(h<780)moment='sorteo-window';else if(h<960)moment='pre-corrida-focus';else if(h<1200)moment='corrida-window';else moment='post-corrida';
  } else if(/entraîn|entrain|tentadero|campo|finca/.test(text)) moment='training-day';
  else if(/voyage|train|avion|déplacement|deplacement/.test(text)) moment='travel-day';
  const busy=['sorteo-window','pre-corrida-focus','corrida-window','training-day','travel-day'].includes(moment);
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

declare global{interface Window{__moniaTaurineLifeContext?:()=>TaurineLifeContext|null}}
window.__moniaTaurineLifeContext=getTaurineLifeContext;
