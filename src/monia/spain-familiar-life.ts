const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;energy?:number;stress?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FamiliarPlaceKind='cafe'|'walk'|'shopping'|'beauty'|'sport'|'quiet'|'errand';
export type FamiliarPlace={id:string;label:string;kind:FamiliarPlaceKind;familiarity:number;discovered:boolean;available:boolean;reason:string};
export type FamiliarRoutine={id:string;label:string;placeId:string;weight:number;minutes:number;intent:string;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return (h||0)*60+(m||0)}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function inSpain(place:string){return /madrid|spain|espagne|finca|estate|family|sevill|andal|salam|hotel/i.test(place)}
function daysInSpain(s:Save){const d=n(s.flags?.spainLifeOpenedDay,0);return d?Math.max(0,n(s.day,1)-d):0}
function familiarity(s:Save,id:string){return Math.max(0,Math.min(100,n(s.flags?.[`spainPlace:${id}:familiarity`],0)))}
function discovered(s:Save,id:string){return s.flags?.[`spainPlace:${id}:discovered`]===true}
function available(s:Save,id:string){const m=mins(s.time),slot=Math.floor(m/180);return m>=420&&m<1320&&(hash(`${id}-${n(s.day,1)}-${slot}`)%100)>=12}

const PLACES:Array<{id:string;label:string;kind:FamiliarPlaceKind;minDays:number}>=[
  {id:'morning-cafe',label:'Mon café du matin',kind:'cafe',minDays:2},
  {id:'walk-route',label:'Mon endroit pour marcher',kind:'walk',minDays:3},
  {id:'everyday-shops',label:'Mes petites courses habituelles',kind:'errand',minDays:4},
  {id:'beauty-stop',label:'Mon adresse beauté / soin',kind:'beauty',minDays:6},
  {id:'sport-place',label:'Mon endroit pour bouger un peu',kind:'sport',minDays:7},
  {id:'quiet-corner',label:'Un endroit où je vais quand j’ai besoin d’être seule',kind:'quiet',minDays:9}
];

export function getSpainFamiliarPlaces():FamiliarPlace[]{
  const s=read();if(!s||!inSpain(String(s.place||'')))return[];const elapsed=daysInSpain(s);
  return PLACES.filter(p=>elapsed>=p.minDays||discovered(s,p.id)).map(p=>{
    const known=discovered(s,p.id),fam=familiarity(s,p.id),free=available(s,p.id);
    return{id:p.id,label:p.label,kind:p.kind,familiarity:fam,discovered:known,available:free,reason:!known?'Ce lieu peut devenir un repère de Marion si elle y revient.':fam<30?'Le lieu commence juste à lui devenir familier.':fam<65?'C’est désormais un vrai repère du quotidien.':'Cet endroit fait partie de sa vie en Espagne.'};
  });
}

export function getSpainRoutineOpportunities():FamiliarRoutine[]{
  const s=read();if(!s||!inSpain(String(s.place||'')))return[];const m=mins(s.time),energy=n(s.energy,100),stress=n(s.stress),out:FamiliarRoutine[]=[];
  for(const p of getSpainFamiliarPlaces().filter(x=>x.available)){
    if(!p.discovered){out.push({id:`discover-${p.id}`,label:`Découvrir : ${p.label.replace(/^Mon |^Mes |^Un /,'')}`,placeId:p.id,weight:46,minutes:50,intent:'open-map',reason:'Les habitudes se construisent en revenant dans des lieux simples, pas en les débloquant d’un coup.'});continue;}
    const bonus=Math.min(18,Math.floor(p.familiarity/5));
    if(p.kind==='cafe'&&m<720)out.push({id:`routine-${p.id}`,label:'Passer par mon café habituel',placeId:p.id,weight:55+bonus,minutes:35,intent:'open-map',reason:'Un petit rituel du matin rend le lieu vraiment vécu.'});
    else if(p.kind==='walk'&&energy>30)out.push({id:`routine-${p.id}`,label:'Faire mon parcours habituel',placeId:p.id,weight:48+bonus,minutes:50,intent:'open-map',reason:'Les trajets répétés créent un sentiment d’appartenance.'});
    else if(p.kind==='errand')out.push({id:`routine-${p.id}`,label:'Faire mes petites courses comme d’habitude',placeId:p.id,weight:42+bonus,minutes:45,intent:'open-map',reason:'Le quotidien doit aussi exister entre les grandes scènes.'});
    else if(p.kind==='beauty'&&energy>35)out.push({id:`routine-${p.id}`,label:'Prendre un peu soin de moi à mon adresse habituelle',placeId:p.id,weight:39+bonus,minutes:75,intent:'custom-intent',reason:'Les habitudes personnelles renforcent l’autonomie de Marion.'});
    else if(p.kind==='sport'&&energy>45&&stress<75)out.push({id:`routine-${p.id}`,label:'Aller bouger un peu là où j’ai mes habitudes',placeId:p.id,weight:44+bonus,minutes:75,intent:'custom-intent',reason:'Une routine physique régulière donne du relief à la vie quotidienne.'});
    else if(p.kind==='quiet'&&stress>35)out.push({id:`routine-${p.id}`,label:'Aller dans mon coin tranquille',placeId:p.id,weight:52+bonus,minutes:50,intent:'open-map',reason:'Avoir un refuge personnel rend l’Espagne plus intime pour Marion.'});
  }
  return out.sort((a,b)=>b.weight-a.weight).slice(0,3);
}

export function recordSpainPlaceMoment(id:string){
  const s=read();if(!s)return false;const f=s.flags||(s.flags={});const famKey=`spainPlace:${id}:familiarity`;f[`spainPlace:${id}:discovered`]=true;f[famKey]=Math.min(100,n(f[famKey],0)+12);f[`spainPlace:${id}:lastDay`]=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),`spain-place:${id}`].slice(-220);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));return true}catch{return false}
}

declare global{interface Window{__moniaSpainFamiliarPlaces?:()=>FamiliarPlace[];__moniaSpainRoutines?:()=>FamiliarRoutine[];__moniaRecordSpainPlace?:(id:string)=>boolean}}
window.__moniaSpainFamiliarPlaces=getSpainFamiliarPlaces;window.__moniaSpainRoutines=getSpainRoutineOpportunities;window.__moniaRecordSpainPlace=recordSpainPlaceMoment;
