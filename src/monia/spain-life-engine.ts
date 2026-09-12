import { getFranceSpainState } from './france-spain-life-transition';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;metLucas?:boolean;official?:boolean;relationship?:number;trust?:number;stress?:number;energy?:number;calendar?:Array<{day?:number;time?:string;owner?:string;title?:string;place?:string}>;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SpainLifeDirection={id:string;label:string;intent:string;kind:'self'|'social'|'relationship'|'taurine'|'home'|'travel';weight:number;minutes:number;reason:string};
export type SpainLifeSnapshot={active:boolean;stage:'not-yet'|'arriving'|'settling'|'rooted';place:string;directions:SpainLifeDirection[];socialOpen:boolean;homeRoutineOpen:boolean;independentLifeOpen:boolean;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function inSpain(place:string){return /madrid|spain|espagne|finca|estate|family|sevill|andal|salam|hotel/i.test(place)}
function daysSince(s:Save,key:string){const d=n(s.flags?.[key],0);return d?Math.max(0,n(s.day,1)-d):0}

export function getSpainLifeSnapshot():SpainLifeSnapshot|null{
  const s=read();if(!s)return null;const transition=getFranceSpainState();const place=String(s.place||'home');
  if(!inSpain(place)&&transition?.phase!=='spain-rooted'&&transition?.phase!=='between-bases')return{active:false,stage:'not-yet',place,directions:[],socialOpen:false,homeRoutineOpen:false,independentLifeOpen:false,reason:'La vie espagnole n’est pas encore le quotidien de Marion.'};
  const sinceArrival=daysSince(s,'spainLifeOpenedDay');const rooted=transition?.phase==='spain-rooted'||transition?.phase==='between-bases'||!!s.flags?.spainHomeEstablished;
  const stage:SpainLifeSnapshot['stage']=rooted?'rooted':sinceArrival<=3?'arriving':'settling';
  const m=mins(s.time),energy=n(s.energy,100),stress=n(s.stress);const directions:SpainLifeDirection[]=[];
  const socialOpen=stage!=='arriving'||sinceArrival>=1;
  const homeRoutineOpen=stage!=='arriving'||sinceArrival>=2;
  const independentLifeOpen=stage==='rooted'||sinceArrival>=4;

  if(stage==='arriving')directions.push({id:'spain-bearings',label:'Prendre mes repères sans me presser',intent:'open-map',kind:'self',weight:74,minutes:60,reason:'Une arrivée doit laisser de la place à l’observation avant de remplir l’agenda.'});
  if(homeRoutineOpen&&energy>30)directions.push({id:'spain-routine',label:'Créer un peu ma routine ici',intent:'custom-intent',kind:'home',weight:58,minutes:75,reason:'L’Espagne devient un quotidien, pas seulement un décor autour de Lucas.'});
  if(socialOpen&&m>=660&&m<1260&&stress<75)directions.push({id:'spain-social',label:'Voir ce qui se passe autour de moi',intent:'open-phone',kind:'social',weight:52,minutes:60,reason:'Le nouveau cercle social peut s’ouvrir progressivement sans forcer une amitié instantanée.'});
  if(s.metLucas&&s.official)directions.push({id:'spain-lucas-life',label:'Voir comment s’organise la journée de Lucas ici',intent:'open-lucas-day',kind:'taurine',weight:61,minutes:45,reason:'La carrière de Lucas structure une partie de la vie espagnole sans absorber toute celle de Marion.'});
  if(independentLifeOpen&&energy>40)directions.push({id:'spain-own-life',label:'Faire quelque chose qui n’appartient qu’à moi',intent:'custom-intent',kind:'self',weight:64,minutes:90,reason:'Marion doit pouvoir construire une vie indépendante en Espagne.'});
  if(stage==='rooted')directions.push({id:'spain-home',label:'M’occuper un peu de ma vie ici',intent:'open-map',kind:'home',weight:45,minutes:60,reason:'Une vie installée produit des habitudes, des courses, des rendez-vous et des lieux familiers.'});
  if(transition?.canReturnNimes&&stage!=='arriving')directions.push({id:'spain-nimes-link',label:'Garder un lien concret avec Nîmes',intent:'open-phone',kind:'travel',weight:34,minutes:10,reason:'Le départ en Espagne ne coupe pas les racines françaises de Marion.'});

  return{active:true,stage,place,directions:directions.sort((a,b)=>b.weight-a.weight),socialOpen,homeRoutineOpen,independentLifeOpen,reason:stage==='arriving'?'Marion vient d’arriver: découverte et adaptation passent avant la surcharge sociale.':stage==='settling'?'La vie espagnole commence à prendre sa propre forme.':'L’Espagne est maintenant un vrai quotidien, avec une vie de couple mais aussi une vie propre à Marion.'};
}

declare global{interface Window{__moniaSpainLife?:()=>SpainLifeSnapshot|null}}
window.__moniaSpainLife=getSpainLifeSnapshot;
