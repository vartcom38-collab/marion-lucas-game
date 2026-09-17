import { getAnnualLifeProfile, annualWeight } from './annual-life-variation';
import { getAdultLifeRhythm } from './adult-life-rhythm';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;time?:string;place?:string;official?:boolean;married?:boolean;children?:number;stress?:number;energy?:number;seed?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type OrdinaryLifeKind='quiet'|'practical'|'self'|'social'|'couple'|'outing';
export type OrdinaryLifeBeat={id:string;kind:OrdinaryLifeKind;score:number;reason:string;place:string;time:string;};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function hash(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function hour(time:string){const m=/^(\d{1,2})/.exec(time||'');return m?Number(m[1]):12}
function recentPenalty(history:string[],kind:OrdinaryLifeKind){const recent=history.slice(-18);let hits=0;for(const e of recent){const s=e.toLowerCase();if(s.includes(`ordinary:${kind}:`)||s.includes(`daily:${kind}:`))hits++;}return hits*11}
function deterministicNudge(seed:number,key:string){return (hash(`${seed}:${key}`)%13)-6}

export function getOrdinaryLifeBeats():OrdinaryLifeBeat[]{
  const s=read();if(!s)return[];
  const day=Math.max(1,n(s.day,1));const t=String(s.time||'12:00');const h=hour(t);const place=String(s.place||'home');const history=s.eventHistory||[];const annual=getAnnualLifeProfile();const adult=getAdultLifeRhythm();const seed=n(s.seed,31)+day*97+h*13;
  const energy=n(s.energy,70),stress=n(s.stress,20),children=Math.max(0,n(s.children));
  const homeLike=/home|family|finca|estate|madrid/i.test(place);
  const evening=h>=18||h<7;const daytime=h>=9&&h<18;
  const base:Record<OrdinaryLifeKind,number>={
    quiet: annualWeight('home',42)+(evening?10:0)+(stress>=65?16:0)+(energy<=35?14:0),
    practical: annualWeight('home',44)+(daytime?8:0)+(adult.stability>55?8:0),
    self: annualWeight('career',46)+(daytime?8:0)+(adult.flexibility>60?6:0),
    social: annualWeight('social',42)+(daytime?8:0)+(stress>=75?-12:0),
    couple: annualWeight('couple',s.official?48:24)+(evening?9:0)+(children?4:0),
    outing: annualWeight('mixed',40)+(daytime?9:0)+(energy>=55?8:0)+(stress>=75?-10:0),
  };
  const labels:Record<OrdinaryLifeKind,string>={
    quiet:'moment calme et non productif',practical:'petite tâche concrète du quotidien',self:'moment pour la vie propre de Marion',social:'petit lien social sans grand événement',couple:'micro-moment de couple sans en faire une scène majeure',outing:'courte sortie ou changement d’air',
  };
  const ids:Record<OrdinaryLifeKind,string[]>={
    quiet:['tea-window','read-few-pages','music-floor','balcony-air','late-sofa'],
    practical:['tidy-drawer','laundry-fold','kitchen-reset','quick-groceries','water-plants'],
    self:['journal-note','personal-admin','outfit-choice','photo-sort','own-project'],
    social:['friend-message','short-coffee','family-checkin','voice-note-friend','street-hello'],
    couple:['shared-coffee','small-touch','quiet-kitchen','brief-checkin','same-room-silence'],
    outing:['short-walk','bakery-run','market-loop','errand-route','sunset-step-out'],
  };
  const kinds=Object.keys(base) as OrdinaryLifeKind[];
  const out:OrdinaryLifeBeat[]=[];
  for(const kind of kinds){
    let score=base[kind]-recentPenalty(history,kind)+deterministicNudge(seed,kind);
    if(!homeLike&&kind==='practical')score-=9;
    if(!s.official&&kind==='couple')score-=14;
    if(children&&kind==='self')score+=Math.min(8,Math.round(adult.familyAutonomy/12));
    const pool=ids[kind];const id=pool[hash(`${seed}:${kind}:${history.slice(-6).join('|')}`)%pool.length];
    const yearHint=annual?` Profil annuel: ${annual.tone}/${annual.secondaryTone}.`:'';
    out.push({id:`ordinary-${kind}-${id}`,kind,score:Math.max(1,Math.round(score)),place,time:t,reason:`${labels[kind]}. Répétitions récentes pénalisées; contexte heure/énergie/stress et rythme de vie pris en compte.${yearHint}`});
  }
  return out.sort((a,b)=>b.score-a.score);
}

export function markOrdinaryLifeBeat(beat:OrdinaryLifeBeat){const s=read();if(!s)return false;s.eventHistory=[...(s.eventHistory||[]),`ordinary:${beat.kind}:${beat.id}:day-${Math.max(1,n(s.day,1))}`].slice(-240);localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}

declare global{interface Window{__moniaOrdinaryLifeBeats?:()=>OrdinaryLifeBeat[];__moniaMarkOrdinaryLifeBeat?:(beat:OrdinaryLifeBeat)=>boolean}}
window.__moniaOrdinaryLifeBeats=getOrdinaryLifeBeats;window.__moniaMarkOrdinaryLifeBeat=markOrdinaryLifeBeat;
