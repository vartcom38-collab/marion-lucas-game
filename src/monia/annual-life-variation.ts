const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;eventHistory?:string[];flags?:Record<string,unknown>};
export type AnnualTone='home'|'social'|'travel'|'career'|'couple'|'mixed';
export type AnnualLifeProfile={lifeYear:number;tone:AnnualTone;secondaryTone:AnnualTone;noveltyBias:number;travelBias:number;socialBias:number;homeBias:number;careerBias:number;coupleBias:number;feriasRemainRecurring:true;signature:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function lifeYear(day:number){return Math.floor((Math.max(1,day)-1)/365)+1}
const TONES:AnnualTone[]=['home','social','travel','career','couple','mixed'];
function score(year:number,key:string,min=28,max=78){return min+(hash(`${year}:${key}:marion-lucas`)%(max-min+1))}

export function getAnnualLifeProfile():AnnualLifeProfile|null{
  const s=read();if(!s)return null;const year=lifeYear(n(s.day,1));const a=hash(`annual:${year}`)%TONES.length;let b=hash(`secondary:${year}`)%TONES.length;if(b===a)b=(b+1)%TONES.length;
  const tone=TONES[a],secondaryTone=TONES[b];
  return{lifeYear:year,tone,secondaryTone,noveltyBias:score(year,'novelty',48,86),travelBias:score(year,'travel'),socialBias:score(year,'social'),homeBias:score(year,'home'),careerBias:score(year,'career'),coupleBias:score(year,'couple'),feriasRemainRecurring:true,signature:`year-${year}-${tone}-${secondaryTone}`};
}

function normalizedBeat(id:string){return id.toLowerCase().replace(/\d+/g,'#').replace(/[^a-zà-ÿ#:-]+/g,'-')}
export function annualBeatAllowed(id:string,opts:{recurring?:boolean;feria?:boolean;cooldownYears?:number}={}){
  if(opts.feria)return true;
  const s=read();if(!s)return true;const year=lifeYear(n(s.day,1));const key=normalizedBeat(id);const history=s.eventHistory||[];const cooldown=Math.max(1,opts.cooldownYears??(opts.recurring?1:3));
  for(let y=Math.max(1,year-cooldown);y<=year;y++)if(history.some(e=>e===`annual-beat:${y}:${key}`))return false;
  return true;
}
export function markAnnualBeat(id:string,opts:{feria?:boolean}={}){const s=read();if(!s)return false;if(opts.feria)return true;const year=lifeYear(n(s.day,1));const key=normalizedBeat(id);s.eventHistory=[...(s.eventHistory||[]),`annual-beat:${year}:${key}`].slice(-260);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}

export function annualWeight(kind:AnnualTone,base:number){const p=getAnnualLifeProfile();if(!p)return base;let bonus=0;if(p.tone===kind)bonus+=12;if(p.secondaryTone===kind)bonus+=6;const bias=kind==='travel'?p.travelBias:kind==='social'?p.socialBias:kind==='home'?p.homeBias:kind==='career'?p.careerBias:kind==='couple'?p.coupleBias:p.noveltyBias;bonus+=Math.round((bias-50)/8);return Math.max(5,base+bonus)}

declare global{interface Window{__moniaAnnualLife?:()=>AnnualLifeProfile|null;__moniaAnnualBeatAllowed?:(id:string,opts?:{recurring?:boolean;feria?:boolean;cooldownYears?:number})=>boolean;__moniaMarkAnnualBeat?:(id:string,opts?:{feria?:boolean})=>boolean}}
window.__moniaAnnualLife=getAnnualLifeProfile;window.__moniaAnnualBeatAllowed=annualBeatAllowed;window.__moniaMarkAnnualBeat=markAnnualBeat;
