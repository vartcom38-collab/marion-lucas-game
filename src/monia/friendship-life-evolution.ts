import { getAnnualLifeProfile } from './annual-life-variation';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FriendshipPhase='forming'|'steady'|'close'|'quiet'|'returning';
export type FriendshipState={id:string;phase:FriendshipPhase;closeness:number;contactWeight:number;meetingWeight:number;distanceSeason:boolean;returnSeason:boolean;reason:string};
export type LucasFriendCircleState={phase:'busy-circle'|'steady-circle'|'quiet-circle'|'reconnecting';socialWeight:number;privateFriendWeight:number;professionalOverlapWeight:number;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function count(h:string[],id:string){const safe=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(`friend(ship)?[^:]*:${safe}|spainContact:${safe}|${safe}.*(talk|invite|shared-time|friend)`,'i');return h.slice(-320).filter(e=>re.test(e)).length}

export function getFriendshipEvolution(id:string,baseCloseness=35):FriendshipState|null{
  const s=read();if(!s)return null;const year=getAnnualLifeProfile()?.lifeYear||Math.floor((Math.max(1,n(s.day,1))-1)/365)+1;const h=s.eventHistory||[];
  const flagClose=n(s.flags?.[`spainContact:${id}:closeness`],baseCloseness);const lived=count(h,id);const drift=(hash(`friend-drift:${id}:${year}`)%29)-14;
  const distanceSeason=hash(`friend-distance:${id}:${year}`)%100<18;
  const returnSeason=!distanceSeason&&hash(`friend-return:${id}:${year}`)%100<22;
  const closeness=clamp(Math.round(flagClose+Math.min(24,lived*3)+drift+(distanceSeason?-15:0)+(returnSeason?12:0)),0,100);
  const phase:FriendshipPhase=returnSeason?'returning':distanceSeason?'quiet':closeness>=68?'close':closeness>=38?'steady':'forming';
  const contactWeight=clamp(Math.round(closeness+(returnSeason?8:0)-(distanceSeason?10:0)),12,92);
  const meetingWeight=clamp(Math.round(closeness*0.88+(returnSeason?10:0)-(distanceSeason?12:0)),10,90);
  const reason=phase==='quiet'?'Le lien est plus discret cette année sans qu’il y ait besoin de conflit.':phase==='returning'?'Après une période plus calme, le lien reprend naturellement de la place.':phase==='close'?'Cette amitié fait vraiment partie de la vie de Marion.':phase==='steady'?'Le lien est installé mais garde son propre rythme.':'La relation est encore en train de se construire.';
  return{id,phase,closeness,contactWeight,meetingWeight,distanceSeason,returnSeason,reason};
}

export function getLucasFriendCircleEvolution():LucasFriendCircleState|null{
  const s=read();if(!s)return null;const p=getAnnualLifeProfile();const year=p?.lifeYear||Math.floor((Math.max(1,n(s.day,1))-1)/365)+1;const h=s.eventHistory||[];
  const socialHistory=h.slice(-260).filter(e=>/lucas.*(friend|ami|dinner|social)|cuadrilla.*(dinner|visit|social)/i.test(e)).length;
  const drift=hash(`lucas-friend-circle:${year}`)%100;
  const reconnecting=drift>=78;const quiet=drift<20;const busy=!quiet&&!reconnecting&&(p?.socialBias||50)>=62;
  const phase:LucasFriendCircleState['phase']=reconnecting?'reconnecting':quiet?'quiet-circle':busy?'busy-circle':'steady-circle';
  const socialWeight=clamp((p?.socialBias||50)+(busy?15:0)+(quiet?-18:0)+(reconnecting?10:0)+Math.min(10,socialHistory),12,90);
  const privateFriendWeight=clamp(socialWeight+(phase==='steady-circle'?5:0)-6,10,86);
  const professionalOverlapWeight=clamp((p?.careerBias||50)+(busy?10:0)-(quiet?8:0),12,88);
  const reason=phase==='quiet-circle'?'Les amis de Lucas restent davantage en arrière-plan cette année, sans rupture imposée.':phase==='reconnecting'?'Des liens que Lucas voyait moins peuvent reprendre naturellement de la place.':phase==='busy-circle'?'La vie sociale de Lucas est plus présente cette année, parfois mêlée au milieu taurin sans se confondre avec lui.':'Lucas garde un cercle stable, avec des moments privés et d’autres liés à sa vie professionnelle.';
  return{phase,socialWeight,privateFriendWeight,professionalOverlapWeight,reason};
}

export function getFriendshipOverview(){return{marion:['marine','alba','ines','clara'].map(id=>getFriendshipEvolution(id,id==='marine'?62:28)).filter(Boolean),lucas:getLucasFriendCircleEvolution()}}

declare global{interface Window{__moniaFriendship?:(id:string,baseCloseness?:number)=>FriendshipState|null;__moniaFriendships?:()=>ReturnType<typeof getFriendshipOverview>;__moniaLucasFriendCircle?:()=>LucasFriendCircleState|null}}
window.__moniaFriendship=getFriendshipEvolution;window.__moniaFriendships=getFriendshipOverview;window.__moniaLucasFriendCircle=getLucasFriendCircleEvolution;
