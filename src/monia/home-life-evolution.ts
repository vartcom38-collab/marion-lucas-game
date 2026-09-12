import { getAnnualLifeProfile, annualWeight } from './annual-life-variation';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;married?:boolean;children?:number;relationship?:number;trust?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type HomeLifeMode='nesting'|'open-house'|'outdoor'|'family'|'quiet'|'between-bases';
export type HomeZone='kitchen'|'table'|'bedroom'|'terrace'|'garden'|'reading-corner'|'entry'|'outdoor';
export type HomeLifeEvolution={mode:HomeLifeMode;preferredZone:HomeZone;homeWeight:number;outdoorWeight:number;guestWeight:number;familyWeight:number;baseFluidity:number;narrative:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function lifeYear(day:number){return Math.floor((Math.max(1,day)-1)/365)+1}
function count(history:string[],re:RegExp){return history.filter(e=>re.test(e)).length}

export function getHomeLifeEvolution():HomeLifeEvolution|null{
  const s=read();if(!s||!s.official)return null;const day=n(s.day,1),year=getAnnualLifeProfile()?.lifeYear||lifeYear(day),annual=getAnnualLifeProfile(),seasonal=getSeasonalLifeSnapshot(),h=s.eventHistory||[];const kids=n(s.children);const place=String(s.place||'').toLowerCase();
  const betweenBases=/nîmes|nimes|madrid|finca|espagne|spain/i.test(place)&&Boolean(s.flags?.spainHomeEstablished||s.flags?.betweenBases||s.flags?.spainRooted);
  const guestHistory=count(h,/guest|invite|family-visit|friend-visit|dinner-with/i);const homeHistory=count(h,/shared-home|couple-routine|homecoming/i);const seed=hash(`home-life:${year}:${Math.floor(day/28)}`)%100;
  let mode:HomeLifeMode='quiet';
  if(betweenBases&&seed<38)mode='between-bases';
  else if(kids>0&&(seed<72||annual?.tone==='home'))mode='family';
  else if((annual?.socialBias||50)>64&&guestHistory>1&&seed<68)mode='open-house';
  else if((seasonal?.season==='spring'||seasonal?.season==='summer')&&(annual?.homeBias||50)<63&&seed<64)mode='outdoor';
  else if(homeHistory>5&&(annual?.coupleBias||50)>54)mode='nesting';

  const zonePool:HomeZone[]=mode==='family'?['kitchen','table','garden','entry']:mode==='open-house'?['table','kitchen','garden','terrace']:mode==='outdoor'?['terrace','garden','outdoor']:mode==='nesting'?['kitchen','reading-corner','bedroom','table']:mode==='between-bases'?['entry','table','bedroom','outdoor']:['reading-corner','kitchen','table','bedroom'];
  const preferredZone=zonePool[hash(`home-zone:${year}:${Math.floor(day/21)}:${mode}`)%zonePool.length];
  const homeWeight=annualWeight('home',mode==='nesting'||mode==='family'?72:mode==='outdoor'?48:60);
  const outdoorWeight=mode==='outdoor'?78:mode==='between-bases'?66:46;
  const guestWeight=Math.max(15,Math.min(88,(annual?.socialBias||50)+(mode==='open-house'?22:0)+(guestHistory>3?8:0)));
  const familyWeight=Math.max(15,Math.min(92,40+kids*14+(mode==='family'?22:0)));
  const baseFluidity=mode==='between-bases'?82:mode==='outdoor'?62:38;
  const narrative=mode==='between-bases'?'Leur façon d’habiter est plus mobile cette période : la maison reste un repère, mais leur vie circule davantage entre plusieurs lieux.':mode==='family'?'La maison fonctionne davantage comme un lieu de passage, de repas et de vie familiale, sans devenir un écran de gestion.':mode==='open-house'?'Cette période de leur vie laisse davantage entrer les proches et les visites dans la maison.':mode==='outdoor'?'Ils vivent davantage dehors en ce moment : terrasse, jardin, sorties et retours rapides prennent plus de place que les longues journées enfermées.':mode==='nesting'?'Ils traversent une période où revenir chez eux compte davantage : des habitudes simples s’installent sans les figer.':'La maison reste un décor vivant plutôt qu’un objectif : parfois centrale, parfois simplement traversée.';
  return{mode,preferredZone,homeWeight,outdoorWeight,guestWeight,familyWeight,baseFluidity,narrative};
}

declare global{interface Window{__moniaHomeLifeEvolution?:()=>HomeLifeEvolution|null}}
window.__moniaHomeLifeEvolution=getHomeLifeEvolution;
