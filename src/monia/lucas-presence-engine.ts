const SAVE_KEY='marion-lucas-save-v4';

type CalendarItem={day?:number;time?:string;owner?:string;title?:string;note?:string;place?:string};
type Save={day?:number;time?:string;place?:string;official?:boolean;calendar?:CalendarItem[];flags?:Record<string,unknown>};

export type LucasPresenceState='with-marion'|'same-area'|'working'|'traveling'|'away'|'unknown';
export type LucasPresenceSnapshot={
  state:LucasPresenceState;
  lucasPlace:string;
  marionPlace:string;
  together:boolean;
  reachableByPhone:boolean;
  privateTimePossible:boolean;
  reason:string;
  source:'explicit-flag'|'calendar'|'travel-choice'|'inference'|'unknown';
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function norm(v:unknown){return String(v||'').trim().toLowerCase()}
function area(place:string){const p=norm(place);if(/nîmes|nimes|home|cafe|arenes|arènes|station/.test(p))return'nimes';if(/madrid/.test(p))return'madrid';if(/sevill|andal/.test(p))return'andalusia';if(/salam/.test(p))return'salamanca';if(/finca|estate|family/.test(p))return'finca';if(/hotel/.test(p))return'hotel';if(/arena|arène|arène|plaza|corrida/.test(p))return'arena';return p||'unknown'}
function todayLucasItems(s:Save){const d=n(s.day,1);return(s.calendar||[]).filter(i=>n(i.day)===d&&norm(i.owner)==='lucas')}
function isProfessional(i:CalendarItem){return/corrida|feria|toros|arène|arena|entraînement|entrainement|presse|media|déplacement|deplacement|voyage|flight|train|route|meeting/i.test(`${i.title||''} ${i.note||''}`)}
function currentItem(s:Save){const now=mins(s.time);const items=todayLucasItems(s);const exact=items.find(i=>{if(!i.time)return false;const start=mins(i.time);return now>=start-30&&now<=start+150});return exact||items.find(i=>!i.time)||null}
function itemPlace(i:CalendarItem|null){if(!i)return'';return String(i.place||i.note||i.title||'').trim()}

export function getLucasPresence():LucasPresenceSnapshot|null{
  const s=read();if(!s)return null;
  const f=s.flags||{};const marionPlace=String(s.place||'');const marionArea=area(marionPlace);
  const explicit=String(f.lucasCurrentPlace||'').trim();
  if(explicit){const lucasArea=area(explicit),together=f.lucasWithMarion===true||lucasArea===marionArea&&f.lucasWithMarion!==false;return{state:together?'with-marion':lucasArea===marionArea?'same-area':'away',lucasPlace:explicit,marionPlace,together,reachableByPhone:true,privateTimePossible:together,reason:together?'Lucas est explicitement enregistré avec Marion.':'La position de Lucas est enregistrée séparément de celle de Marion.',source:'explicit-flag'};}
  const item=currentItem(s);if(item){const lp=itemPlace(item);const la=area(lp);const professional=isProfessional(item);if(professional){const traveling=/déplacement|deplacement|voyage|flight|train|route/i.test(`${item.title||''} ${item.note||''}`);return{state:traveling?'traveling':'working',lucasPlace:lp||'activité professionnelle',marionPlace,together:false,reachableByPhone:!traveling,privateTimePossible:false,reason:traveling?'Lucas est en déplacement professionnel.':'Lucas a une activité professionnelle en cours.',source:'calendar'};}const together=la!=='unknown'&&la===marionArea;return{state:together?'with-marion':la===marionArea?'same-area':'away',lucasPlace:lp||'agenda Lucas',marionPlace,together,reachableByPhone:true,privateTimePossible:together,reason:together?'L’agenda place Lucas au même endroit que Marion.':'L’agenda place Lucas ailleurs pour ce moment.',source:'calendar'};}
  if(f.travelWithLucas===true){return{state:'with-marion',lucasPlace:marionPlace,marionPlace,together:true,reachableByPhone:true,privateTimePossible:true,reason:'Marion a choisi de voyager avec Lucas et aucun engagement séparé ne le place ailleurs.',source:'travel-choice'};}
  if(f.travelWithLucas===false&&f.toreroTravelChoiceDay&&n(f.toreroTravelChoiceDay)<=n(s.day,1)){return{state:'away',lucasPlace:'déplacement de Lucas',marionPlace,together:false,reachableByPhone:true,privateTimePossible:false,reason:'Marion ne suit pas actuellement le déplacement professionnel de Lucas.',source:'travel-choice'};}
  if(!s.official)return{state:'unknown',lucasPlace:'',marionPlace,together:false,reachableByPhone:true,privateTimePossible:false,reason:'Aucune présence physique de Lucas n’est supposée avant que la relation et le contexte ne l’établissent.',source:'unknown'};
  return{state:'unknown',lucasPlace:'',marionPlace,together:false,reachableByPhone:true,privateTimePossible:false,reason:'Le lieu de Marion seul ne suffit plus à supposer que Lucas est physiquement présent.',source:'inference'};
}

declare global{interface Window{__moniaLucasPresence?:()=>LucasPresenceSnapshot|null}}
window.__moniaLucasPresence=getLucasPresence;
