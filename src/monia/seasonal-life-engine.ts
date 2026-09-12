const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;flags?:Record<string,unknown>;eventHistory?:string[]};
export type LifeSeason='spring'|'summer'|'autumn'|'winter';
export type WeatherKind='clear'|'warm'|'hot'|'cloudy'|'rain'|'wind'|'cool'|'cold';
export type SeasonalDirection={id:string;label:string;intent:string;kind:'self'|'travel'|'home';weight:number;minutes:number;reason:string};
export type SeasonalLifeSnapshot={season:LifeSeason;year:number;dayOfYear:number;region:'nimes'|'spain'|'other';weather:WeatherKind;temperatureBand:'cold'|'cool'|'mild'|'warm'|'hot';daylight:'short'|'balanced'|'long';taurineRhythm:'quiet'|'opening'|'active'|'closing';directions:SeasonalDirection[];atmosphere:string;wardrobeHint:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function region(place:string):SeasonalLifeSnapshot['region']{if(/nimes|home|arenes|cafe|station/i.test(place))return'nimes';if(/madrid|spain|espagne|finca|estate|family|sevill|andal|salam|hotel/i.test(place))return'spain';return'other'}
function seasonFor(dayOfYear:number):LifeSeason{if(dayOfYear<=91)return'spring';if(dayOfYear<=182)return'summer';if(dayOfYear<=273)return'autumn';return'winter'}
function taurineRhythm(season:LifeSeason,dayOfYear:number):SeasonalLifeSnapshot['taurineRhythm']{if(season==='spring')return dayOfYear<35?'opening':'active';if(season==='summer')return'active';if(season==='autumn')return dayOfYear<235?'closing':'quiet';return'quiet'}
function weatherFor(s:Save,season:LifeSeason,r:SeasonalLifeSnapshot['region']):WeatherKind{
  const day=n(s.day,1),roll=hash(`${day}-${r}-${season}-weather`)%100;
  if(season==='summer'){if(r==='spain')return roll<64?'hot':roll<86?'warm':roll<94?'wind':'cloudy';return roll<45?'hot':roll<78?'warm':roll<90?'wind':'cloudy'}
  if(season==='winter'){if(r==='spain')return roll<42?'clear':roll<66?'cool':roll<83?'cloudy':roll<93?'rain':'cold';return roll<26?'clear':roll<55?'cool':roll<76?'cloudy':roll<91?'rain':'cold'}
  if(season==='autumn')return roll<34?'clear':roll<55?'cool':roll<73?'cloudy':roll<90?'rain':'wind';
  return roll<48?'clear':roll<68?'warm':roll<82?'cloudy':roll<93?'rain':'wind';
}
function tempBand(w:WeatherKind):SeasonalLifeSnapshot['temperatureBand']{if(w==='hot')return'hot';if(w==='warm')return'warm';if(w==='cold')return'cold';if(w==='cool'||w==='rain'||w==='wind')return'cool';return'mild'}
function atmosphere(season:LifeSeason,w:WeatherKind,r:SeasonalLifeSnapshot['region']){
  const place=r==='spain'?'ici en Espagne':r==='nimes'?'à Nîmes':'autour de Marion';
  if(w==='rain')return`La pluie change le rythme ${place}. Les plans peuvent devenir plus intérieurs sans arrêter la journée.`;
  if(w==='hot')return`La chaleur pèse davantage sur les heures centrales ${place}. Les sorties deviennent plus agréables tôt ou plus tard.`;
  if(w==='cold')return`L’air est franchement froid ${place}. La journée appelle davantage les lieux abrités et les moments calmes.`;
  if(w==='wind')return`Le vent donne une autre allure à la journée ${place}. Certaines sorties restent possibles, mais moins confortables.`;
  if(season==='spring')return`La saison donne envie de ressortir et de reprendre des habitudes dehors ${place}.`;
  if(season==='summer')return`Les journées sont longues ${place}; la vie peut facilement glisser vers des soirées plus tardives.`;
  if(season==='autumn')return`Le rythme se resserre un peu ${place}, entre journées encore douces et retours plus tôt.`;
  return`Les journées sont plus courtes ${place}, avec davantage de moments intérieurs et de routines.`;
}
function wardrobeHint(b:SeasonalLifeSnapshot['temperatureBand']){return b==='hot'?'Tenues légères, tissus respirants et soirées encore douces.':b==='warm'?'Tenues légères avec une couche pour la fin de journée.':b==='cold'?'Manteau, maille et chaussures fermées deviennent logiques.':b==='cool'?'Une veste ou une maille suffit souvent, selon l’heure.':'Une tenue de mi-saison fonctionne bien.'}
function directions(season:LifeSeason,w:WeatherKind,r:SeasonalLifeSnapshot['region']):SeasonalDirection[]{const out:SeasonalDirection[]=[];
  if(w==='hot')out.push({id:'heat-rhythm',label:'Adapter ma journée à la chaleur',intent:'custom-intent',kind:'self',weight:49,minutes:45,reason:'La météo doit modifier les habitudes sans devenir une contrainte permanente.'});
  else if(w==='rain'||w==='cold')out.push({id:'weather-indoor',label:'Faire quelque chose à l’abri',intent:'custom-intent',kind:'home',weight:46,minutes:60,reason:'Une mauvaise météo doit ouvrir d’autres options plutôt que bloquer la journée.'});
  else if(w==='clear'||w==='warm')out.push({id:'weather-outdoor',label:r==='spain'?'Profiter un peu de l’extérieur ici':'Profiter un peu de l’extérieur',intent:'open-map',kind:'travel',weight:43,minutes:75,reason:'Le beau temps peut pousser doucement vers des lieux extérieurs déjà accessibles.'});
  if(season==='summer')out.push({id:'late-summer-evening',label:'Garder quelque chose pour plus tard ce soir',intent:'evening-options',kind:'self',weight:36,minutes:60,reason:'Les longues journées d’été déplacent naturellement une partie de la vie vers la soirée.'});
  if(season==='winter')out.push({id:'winter-home-rhythm',label:'Prendre soin de mon rythme aujourd’hui',intent:'custom-intent',kind:'home',weight:34,minutes:45,reason:'L’hiver doit changer la texture du quotidien sans le rendre vide.'});
  return out;
}

export function getSeasonalLifeSnapshot():SeasonalLifeSnapshot|null{
  const s=read();if(!s)return null;const day=Math.max(1,n(s.day,1));const dayOfYear=((day-1)%365)+1;const year=Math.floor((day-1)/365)+1;const season=seasonFor(dayOfYear);const r=region(String(s.place||'home'));const weather=weatherFor(s,season,r);const band=tempBand(weather);const daylight:SeasonalLifeSnapshot['daylight']=season==='summer'?'long':season==='winter'?'short':'balanced';
  return{season,year,dayOfYear,region:r,weather,temperatureBand:band,daylight,taurineRhythm:taurineRhythm(season,dayOfYear),directions:directions(season,weather,r),atmosphere:atmosphere(season,weather,r),wardrobeHint:wardrobeHint(band)};
}

declare global{interface Window{__moniaSeasonalLife?:()=>SeasonalLifeSnapshot|null}}
window.__moniaSeasonalLife=getSeasonalLifeSnapshot;
