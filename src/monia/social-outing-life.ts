import { getAnnualLifeProfile, annualBeatAllowed, annualWeight, markAnnualBeat } from './annual-life-variation';
import { getLucasPresence } from './lucas-presence-engine';
import { getFriendshipEvolution } from './friendship-life-evolution';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;time?:string;place?:string;official?:boolean;metLucas?:boolean;stress?:number;energy?:number;visibility?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SocialOutingMode='with-lucas'|'marion-solo'|'join-later'|'leave-early'|'separate-plans';
export type SocialOutingKind='restaurant'|'friends'|'taurine-event'|'casual-evening'|'invitation';
export type SocialOutingBeat={id:string;kind:SocialOutingKind;mode:SocialOutingMode;label:string;intent:string;weight:number;minutes:number;narrative:string;lucasRequired:boolean;marionAutonomy:true;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function mins(t?:string){const [h,m]=String(t||'09:00').split(':').map(Number);return(h||0)*60+(m||0)}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function recent(h:string[],re:RegExp,limit=100){return h.slice(-limit).filter(e=>re.test(e)).length}

export function getSocialOutingBeat():SocialOutingBeat|null{
  const s=read();if(!s)return null;const now=mins(s.time),day=n(s.day,1),energy=n(s.energy,70),stress=n(s.stress),h=s.eventHistory||[];
  if(now<660||now>1380||energy<28||stress>82)return null;
  const annual=getAnnualLifeProfile(),presence=getLucasPresence();
  const recentOutings=recent(h,/social-outing|restaurant-outing|taurine-social|friends-evening/i,80);
  const socialBias=annual?.socialBias||50;const gate=Math.max(7,Math.min(44,Math.round(socialBias/2)-recentOutings*5));
  if(hash(`social-outing-gate:${day}:${Math.floor(now/120)}`)%100>=gate)return null;
  const out:SocialOutingBeat[]=[];
  const add=(b:SocialOutingBeat,cooldownYears=1)=>{if(annualBeatAllowed(`social-outing:${b.id}`,{cooldownYears}))out.push(b)};
  const lucasTogether=Boolean(presence?.together);const lucasReachable=Boolean(presence?.reachableByPhone);const visible=n(s.visibility);
  const marine=getFriendshipEvolution('marine',62);
  const spainFriends=['alba','ines','clara'].map(id=>getFriendshipEvolution(id,28)).filter(Boolean);
  const hasFriend=Boolean((marine?.meetingWeight||0)>=46||spainFriends.some(f=>(f?.meetingWeight||0)>=44));

  if(lucasTogether)add({id:'simple-dinner-together',kind:'restaurant',mode:'with-lucas',label:'Sortir dîner quelque part avec Lucas',intent:'social-outing:with-lucas',weight:annualWeight('couple',61),minutes:110,narrative:'Ils peuvent sortir dîner sans que ce soit un rendez-vous exceptionnel : juste changer d’air, manger quelque part et laisser la soirée suivre son cours.',lucasRequired:true,marionAutonomy:true},2);
  if(hasFriend)add({id:'own-friends-evening',kind:'friends',mode:'marion-solo',label:'Voir du monde de mon côté',intent:'social-outing:marion-solo',weight:annualWeight('social',64),minutes:120,narrative:'Marion peut avoir sa propre soirée, retrouver une amie ou accepter une invitation sans que Lucas soit automatiquement inclus.',lucasRequired:false,marionAutonomy:true},1);
  if(s.official&&visible>=6&&lucasReachable)add({id:'taurine-invitation',kind:'taurine-event',mode:lucasTogether?'with-lucas':'join-later',label:lucasTogether?'Accompagner Lucas à une invitation du milieu taurin':'Rejoindre Lucas plus tard si j’en ai envie',intent:lucasTogether?'social-outing:taurine-with-lucas':'social-outing:join-later',weight:annualWeight('social',57),minutes:130,narrative:'Une invitation liée au milieu taurin peut entrer dans leur soirée, mais Marion garde le choix d’y aller avec Lucas, de le rejoindre plus tard ou de faire autre chose.',lucasRequired:true,marionAutonomy:true},1);
  if(lucasTogether)add({id:'leave-before-lucas',kind:'invitation',mode:'leave-early',label:'Venir un moment puis rentrer avant Lucas',intent:'social-outing:leave-early',weight:annualWeight('social',52),minutes:75,narrative:'Marion peut accompagner Lucas un moment puis rentrer avant lui. Leur couple n’oblige pas leurs soirées à commencer et finir exactement au même moment.',lucasRequired:true,marionAutonomy:true},2);
  if(lucasTogether||lucasReachable)add({id:'separate-evening',kind:'casual-evening',mode:'separate-plans',label:'Faire chacun notre soirée',intent:'social-outing:separate-plans',weight:annualWeight('self',55),minutes:105,narrative:'Ils peuvent très bien avoir deux programmes différents ce soir. Chacun garde sa vie, puis ils se retrouvent plus tard ou le lendemain.',lucasRequired:false,marionAutonomy:true},2);
  if(!out.length)return null;return out[hash(`social-outing-pick:${day}:${Math.floor(now/90)}:${presence?.state||'none'}`)%out.length];
}

export function consumeSocialOutingBeat(id:string){const s=read();if(!s)return false;const key=id.replace(/^social-outing-/,'');markAnnualBeat(`social-outing:${key}`);s.eventHistory=[...(s.eventHistory||[]),`social-outing:${key}`].slice(-260);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}}

declare global{interface Window{__moniaSocialOuting?:()=>SocialOutingBeat|null;__moniaConsumeSocialOuting?:(id:string)=>boolean}}
window.__moniaSocialOuting=getSocialOutingBeat;window.__moniaConsumeSocialOuting=consumeSocialOutingBeat;
