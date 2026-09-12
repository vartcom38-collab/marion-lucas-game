import { getSharedMemories, markMemoryResurfaced, type SharedMemory } from './shared-memory-life';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type MemoryResonanceTrigger='place'|'season'|'taurine-rhythm'|'home-rhythm'|'family-rhythm'|'social-rhythm'|'time-passing';
export type MemoryResonanceCue={id:string;memoryId:string;kind:SharedMemory['kind'];trigger:MemoryResonanceTrigger;strength:number;subtle:true;replayScene:false;label:string;narrative:string;intent:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function homeLike(place:string){return /home|maison|appartement|finca|domicile|chez eux/i.test(place)}
function triggerFor(m:SharedMemory,place:string,season?:string):MemoryResonanceTrigger{
  if(m.kind==='taurine'&&/arène|arena|feria|corrida|séville|sevilla|madrid|nîmes|nimes|pamplona/i.test(place))return'taurine-rhythm';
  if(m.kind==='home'&&homeLike(place))return'home-rhythm';
  if(m.kind==='family'&&homeLike(place))return'family-rhythm';
  if(m.kind==='social'&&/restaurant|café|cafe|ville|soirée|soiree/i.test(place))return'social-rhythm';
  if(m.kind==='travel'&&!homeLike(place))return'place';
  if(season)return'season';
  return'time-passing';
}
function copy(kind:SharedMemory['kind'],trigger:MemoryResonanceTrigger){
  if(trigger==='taurine-rhythm')return'Le rythme du lieu réveille quelque chose d’ancien. Pas un flashback, juste cette impression fugace que certaines saisons se répondent à des années de distance.';
  if(trigger==='home-rhythm')return'Un détail banal de la maison fait remonter un vieux souvenir pendant quelques secondes, puis la journée continue.';
  if(trigger==='family-rhythm')return'La vie de famille fait parfois écho à des moments plus anciens. Le souvenir passe sans arrêter le présent.';
  if(trigger==='social-rhythm')return'Une ambiance, une table ou quelques voix rappellent brièvement une autre époque de leur vie sociale.';
  if(trigger==='place')return'Être ici fait remonter la sensation d’un autre déplacement vécu longtemps auparavant, sans rejouer ce qui s’était passé.';
  if(trigger==='season')return kind==='couple'?'La saison a quelque chose de familier. Un souvenir à deux traverse le moment sans prendre toute la place.':'La lumière et l’air de cette période de l’année ramènent un souvenir ancien, presque par association.';
  return'Le temps a passé, mais certains moments restent quelque part. L’un d’eux revient brièvement à l’esprit avant de laisser le présent reprendre sa place.';
}

export function getContextualMemoryResonance():MemoryResonanceCue|null{
  const s=read();if(!s)return null;const day=n(s.day,1),place=String(s.place||''),season=getSeasonalLifeSnapshot();
  const memories=getSharedMemories().filter(m=>m.canResurface&&m.ageDays>=90&&day-n(s.flags?.[`memory:${m.id}:lastResurfaceDay`],0)>=150);
  if(!memories.length)return null;
  const ranked=memories.map(m=>{const trigger=triggerFor(m,place,season?.season);let bonus=0;if(trigger==='place'||trigger==='taurine-rhythm'||trigger==='home-rhythm'||trigger==='family-rhythm')bonus+=18;if(m.ageDays>=365)bonus+=8;return{m,trigger,score:m.importance+bonus};}).sort((a,b)=>b.score-a.score);
  const gate=hash(`memory-resonance:${Math.floor(day/10)}:${place}:${season?.season||'none'}`)%100;if(gate>=22)return null;
  const pick=ranked[hash(`memory-resonance-pick:${Math.floor(day/10)}:${place}`)%Math.min(4,ranked.length)];if(!pick)return null;
  return{id:`resonance-${pick.m.id}`,memoryId:pick.m.id,kind:pick.m.kind,trigger:pick.trigger,strength:Math.min(100,pick.score),subtle:true,replayScene:false,label:'Un souvenir revient brièvement',narrative:copy(pick.m.kind,pick.trigger),intent:`memory-resonance:${pick.m.id}`};
}

export function consumeContextualMemoryResonance(memoryId:string){return markMemoryResurfaced(memoryId)}

declare global{interface Window{__moniaMemoryResonance?:()=>MemoryResonanceCue|null;__moniaConsumeMemoryResonance?:(memoryId:string)=>boolean}}
window.__moniaMemoryResonance=getContextualMemoryResonance;
window.__moniaConsumeMemoryResonance=consumeContextualMemoryResonance;
