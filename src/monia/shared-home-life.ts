import { getLucasHomeRhythm } from './lucas-home-rhythm';
import { getMarionHomeRhythm } from './marion-home-rhythm';
import { getAnnualLifeProfile, annualBeatAllowed, annualWeight } from './annual-life-variation';
import { getCoupleRoutine } from './couple-routine-evolution';
import { getHomeLifeEvolution } from './home-life-evolution';
import { getHomeVisitorBeat } from './home-visitors-life';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;relationship?:number;trust?:number;energy?:number;stress?:number;flags?:Record<string,unknown>};
export type SharedHomeBeat={id:string;label:string;intent:string;kind:'relationship'|'self'|'rest'|'social';weight:number;minutes:number;narrative:string;ordinary:true;romanceRequired:false};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}

export function getSharedHomeBeat():SharedHomeBeat|null{
  const s=read();if(!s||!s.official)return null;const lucas=getLucasHomeRhythm(),marion=getMarionHomeRhythm();if(!lucas?.atHome||!marion?.atHome)return null;
  if(lucas.activity==='sleeping'||lucas.activity==='out'||lucas.activity==='training'||lucas.activity==='working'||lucas.activity==='with-cuadrilla')return null;
  if(marion.activity==='sleeping')return null;
  const now=mins(s.time),day=n(s.day,1),rel=n(s.relationship),trust=n(s.trust),energy=n(s.energy,70),stress=n(s.stress);if(rel<25||trust<18)return null;
  const homeLife=getHomeLifeEvolution();

  const visitor=getHomeVisitorBeat();
  if(visitor)return{id:`visitor-${visitor.id}`,label:visitor.label,intent:visitor.intent,kind:'social',weight:visitor.weight,minutes:visitor.minutes,narrative:visitor.narrative,ordinary:true,romanceRequired:false};

  const routine=getCoupleRoutine();
  if(routine&&routine.state!=='faded')return{id:routine.id,label:routine.label,intent:routine.intent,kind:'relationship',weight:routine.weight+Math.round((homeLife?.homeWeight||50)/12),minutes:routine.minutes,narrative:routine.narrative,ordinary:true,romanceRequired:false};

  const annual=getAnnualLifeProfile();const candidates:SharedHomeBeat[]=[];
  const add=(b:SharedHomeBeat,cooldownYears=1)=>{if(annualBeatAllowed(`shared-home:${b.id}`,{cooldownYears}))candidates.push(b)};
  if(homeLife?.mode==='outdoor'&&now>=540&&now<1260)add({id:'live-outside',label:'Passer un moment dehors plutôt qu’à l’intérieur',intent:'shared-home-outdoor',kind:'self',weight:homeLife.outdoorWeight,minutes:50,narrative:`En ce moment, leur maison se vit aussi dehors. ${homeLife.narrative}`,ordinary:true,romanceRequired:false},1);
  if(homeLife?.mode==='between-bases')add({id:'between-bases',label:'Remettre un peu d’ordre avant le prochain départ',intent:'shared-home-between-bases',kind:'self',weight:homeLife.baseFluidity,minutes:35,narrative:homeLife.narrative,ordinary:true,romanceRequired:false},1);
  if(now>=420&&now<720)add({id:'same-room-morning',label:'Rester chacun dans notre truc, ensemble',intent:'shared-home-quiet',kind:'relationship',weight:annualWeight('home',58),minutes:35,narrative:'Ils sont dans la même maison sans avoir besoin de fabriquer un moment. Chacun avance à son rythme, avec l’autre simplement là.',ordinary:true,romanceRequired:false});
  if(now>=690&&now<870)add({id:'simple-meal',label:'Manger quelque chose ensemble',intent:'shared-home-meal',kind:'relationship',weight:annualWeight('home',64),minutes:45,narrative:'Un repas peut rester exactement ce qu’il est : un moment banal, quelques mots, parfois du silence, puis chacun reprend sa journée.',ordinary:true,romanceRequired:false});
  if(now>=1080&&now<1320)add({id:'evening-meal',label:'Préparer ou partager le dîner',intent:'shared-home-meal',kind:'relationship',weight:annualWeight('home',68),minutes:55,narrative:'La soirée peut commencer sans scène particulière : quelque chose à manger, des gestes familiers, la maison qui ralentit autour d’eux.',ordinary:true,romanceRequired:false});
  if(lucas.activity==='resting'||energy<45)add({id:'quiet-nearby',label:'Rester tranquillement dans le même espace',intent:'shared-home-rest',kind:'rest',weight:annualWeight('couple',60),minutes:45,narrative:'Lucas récupère et Marion peut rester près de lui sans que cela devienne une conversation ou une scène romantique. Juste partager le calme.',ordinary:true,romanceRequired:false},2);
  if(marion.activity==='reading'||marion.activity==='work-project'||marion.activity==='quiet-home')add({id:'parallel-life',label:'Continuer chacun ce qu’on faisait',intent:'shared-home-parallel',kind:'self',weight:annualWeight('home',62),minutes:50,narrative:'Vivre ensemble, c’est aussi ça : être dans la même pièce tout en faisant deux choses différentes, sans devoir se solliciter en permanence.',ordinary:true,romanceRequired:false},2);
  if(stress<65&&energy>35)add({id:'small-crossing',label:'Faire une petite pause ensemble',intent:'shared-home-small-break',kind:'relationship',weight:annualWeight('couple',52),minutes:20,narrative:'Ils se croisent dans la maison, échangent quelques mots ou un café, puis la journée repart. Rien de spectaculaire, et c’est justement ce qui la rend vivante.',ordinary:true,romanceRequired:false},2);
  if(!candidates.length)return null;const seed=hash(`${day}:${Math.floor(now/90)}:${lucas.activity}:${marion.activity}:${annual?.tone||'normal'}:${homeLife?.mode||'none'}:${homeLife?.preferredZone||'none'}`);return candidates[seed%candidates.length];
}

declare global{interface Window{__moniaSharedHomeBeat?:()=>SharedHomeBeat|null}}
window.__moniaSharedHomeBeat=getSharedHomeBeat;
