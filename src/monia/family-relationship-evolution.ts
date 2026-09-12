import { getAnnualLifeProfile } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;children?:number;married?:boolean;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FamilySide='marion'|'lucas';
export type FamilyCloseness='distant'|'light'|'present'|'close';
export type FamilyRelationshipState={side:FamilySide;closeness:FamilyCloseness;contactWeight:number;visitWeight:number;supportWeight:number;distanceSeason:boolean;returnSeason:boolean;reason:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function count(h:string[],re:RegExp,limit=260){return h.slice(-limit).filter(e=>re.test(e)).length}

export function getFamilyRelationshipEvolution(side:FamilySide):FamilyRelationshipState|null{
  const s=read();if(!s)return null;const h=s.eventHistory||[],year=getAnnualLifeProfile()?.lifeYear||Math.floor((Math.max(1,n(s.day,1))-1)/365)+1;
  const own=side==='marion'?/extended-family[^:]*:marion|family[^:]*:marion|marion-family/i:/extended-family[^:]*:lucas|family[^:]*:lucas|lucas-family/i;
  const both=/extended-family[^:]*:both|family[^:]*:both/i;
  const visits=count(h,own)+count(h,both);const support=count(h,new RegExp(`${side}.*(support|children|help)|(support|children|help).*${side}`,'i'))+Math.floor(count(h,both)/2);
  const drift=(hash(`family-drift:${side}:${year}`)%31)-15;
  const lifePhaseBoost=n(s.children)>0?8:s.married?4:0;
  let score=40+Math.min(24,visits*4)+Math.min(12,support*3)+lifePhaseBoost+drift;
  const distanceSeason=hash(`family-distance:${side}:${year}`)%100<18;
  const returnSeason=!distanceSeason&&hash(`family-return:${side}:${year}`)%100<20;
  if(distanceSeason)score-=16;if(returnSeason)score+=12;score=clamp(score,0,100);
  const closeness:FamilyCloseness=score>=72?'close':score>=52?'present':score>=32?'light':'distant';
  const contactWeight=clamp(Math.round(score+(returnSeason?8:0)-(distanceSeason?8:0)),12,92);
  const visitWeight=clamp(Math.round(score*0.86+(n(s.children)>0?7:0)),10,88);
  const supportWeight=clamp(Math.round(score*0.72+(n(s.children)>0?18:0)),8,90);
  const reason=distanceSeason?'La famille est moins présente cette année sans qu’un conflit soit nécessaire.':returnSeason?'Après une période plus discrète, les liens reprennent naturellement davantage de place.':closeness==='close'?'Les liens familiaux sont très présents dans cette période de leur vie.':closeness==='present'?'La famille reste régulièrement présente sans envahir leur quotidien.':closeness==='light'?'Les liens existent mais passent davantage par des nouvelles occasionnelles que par des visites.':'La famille est actuellement en arrière-plan, sans rupture imposée.';
  return{side,closeness,contactWeight,visitWeight,supportWeight,distanceSeason,returnSeason,reason};
}

export function getFamilyRelationshipOverview(){return{marion:getFamilyRelationshipEvolution('marion'),lucas:getFamilyRelationshipEvolution('lucas')}}

declare global{interface Window{__moniaFamilyRelationship?:(side:FamilySide)=>FamilyRelationshipState|null;__moniaFamilyRelationships?:()=>ReturnType<typeof getFamilyRelationshipOverview>}}
window.__moniaFamilyRelationship=getFamilyRelationshipEvolution;
window.__moniaFamilyRelationships=getFamilyRelationshipOverview;
