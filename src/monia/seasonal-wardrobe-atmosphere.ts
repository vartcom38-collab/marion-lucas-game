import './seasonal-wardrobe-atmosphere.css';
import { getSeasonalLifeSnapshot } from './seasonal-life-engine';

const SAVE_KEY='marion-lucas-save-v4';
type Save={screen?:string;overlay?:unknown;time?:string;day?:number;place?:string;flags?:Record<string,unknown>};
export type WardrobeMood='very-light'|'light'|'mid-season'|'layered'|'warm';
export type AtmospherePhase='dawn'|'day'|'golden-hour'|'evening'|'night';
export type SeasonalVisualState={wardrobeMood:WardrobeMood;wardrobeHint:string;phase:AtmospherePhase;season:string;weather:string;temperatureBand:string;region:string;decorTone:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function phase(t?:string):AtmospherePhase{const m=mins(t);if(m<480)return'dawn';if(m<1020)return'day';if(m<1170)return'golden-hour';if(m<1320)return'evening';return'night'}
function mood(band:string):WardrobeMood{return band==='hot'?'very-light':band==='warm'?'light':band==='cold'?'warm':band==='cool'?'layered':'mid-season'}
function decorTone(season:string,p:AtmospherePhase,weather:string){if(p==='night')return'night';if(p==='golden-hour')return'warm-evening';if(weather==='rain'||weather==='cloudy')return'soft-grey';if(season==='summer')return'sunlit';if(season==='winter')return'cool-soft';if(season==='autumn')return'warm-soft';return'fresh';}

export function getSeasonalVisualState():SeasonalVisualState|null{
  const s=read(),life=getSeasonalLifeSnapshot();if(!s||!life)return null;const p=phase(s.time);
  return{wardrobeMood:mood(life.temperatureBand),wardrobeHint:life.wardrobeHint,phase:p,season:life.season,weather:life.weather,temperatureBand:life.temperatureBand,region:life.region,decorTone:decorTone(life.season,p,life.weather)};
}

function apply(){
  const state=getSeasonalVisualState();if(!state)return;const root=document.documentElement;
  root.dataset.moniaSeason=state.season;root.dataset.moniaWeather=state.weather;root.dataset.moniaDayPhase=state.phase;root.dataset.moniaTemp=state.temperatureBand;root.dataset.moniaDecorTone=state.decorTone;
  root.style.setProperty('--monia-daylight',state.phase==='night'?'0.42':state.phase==='evening'?'0.72':state.phase==='golden-hour'?'0.9':'1');
  const wardrobe=document.querySelector<HTMLElement>('[data-overlay="wardrobe"],.wardrobePanel,.wardrobeSheet,#wardrobeOverlay');
  if(wardrobe){wardrobe.dataset.wardrobeMood=state.wardrobeMood;wardrobe.dataset.wardrobeHint=state.wardrobeHint;let note=wardrobe.querySelector<HTMLElement>('.moniaWardrobeWeatherHint');if(!note){note=document.createElement('div');note.className='moniaWardrobeWeatherHint';wardrobe.prepend(note)}note.textContent=state.wardrobeHint;}
  document.querySelectorAll<HTMLElement>('.homePhotoStage,.approvedHome,.worldPhoto,.placePhoto,.cinematicWorld').forEach(el=>{el.dataset.moniaDecorTone=state.decorTone;el.dataset.moniaWeather=state.weather;});
}

window.addEventListener('storage',apply);window.addEventListener('monia:save-changed',apply);window.addEventListener('monia:daily-intent',()=>setTimeout(apply,80));new MutationObserver(()=>apply()).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});setInterval(apply,2000);setTimeout(apply,300);

declare global{interface Window{__moniaSeasonalVisuals?:()=>SeasonalVisualState|null}}
window.__moniaSeasonalVisuals=getSeasonalVisualState;
