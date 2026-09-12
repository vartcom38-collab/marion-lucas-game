import { getSocialConnectionThreads, type SocialConnectionKind } from './social-connection-continuity';

const SAVE_KEY='marion-lucas-save-v4';
type Save={day?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type SocialBondTier='passing'|'familiar'|'regular'|'important'|'inner-circle';
export type SocialBondState={threadId:string;kind:SocialConnectionKind;tier:SocialBondTier;score:number;encounters:number;daysKnown:number;organic:boolean;reason:string};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}

export function getSocialBondState(threadId:string):SocialBondState|null{
  const s=read();if(!s)return null;const thread=getSocialConnectionThreads().find(t=>t.id===threadId);if(!thread)return null;
  const day=n(s.day,1),daysKnown=Math.max(0,day-thread.firstDay),gap=Math.max(0,day-thread.lastDay);
  const continuity=Math.min(24,Math.floor(daysKnown/45)*3);
  const lived=Math.min(36,thread.encounters*6);
  const recencyPenalty=Math.min(28,Math.floor(gap/90)*5);
  const score=clamp(Math.round(thread.strength*0.46+lived+continuity-recencyPenalty),0,100);
  const tier:SocialBondTier=score>=82&&thread.encounters>=7?'inner-circle':score>=65&&thread.encounters>=5?'important':score>=45&&thread.encounters>=3?'regular':score>=25?'familiar':'passing';
  const reason=tier==='inner-circle'?'Ce lien est devenu un élément durable du vrai cercle proche grâce à ce qui a été vécu sur la durée.':tier==='important'?'Cette personne commence à compter réellement : le lien revient, tient dans le temps et ne dépend plus d’une seule soirée.':tier==='regular'?'La connaissance revient assez souvent pour devenir une présence sociale régulière.':tier==='familiar'?'Le visage est désormais familier, mais rien n’oblige encore cette relation à devenir proche.':'Le lien reste léger et peut très bien ne jamais dépasser la simple connaissance.';
  return{threadId,kind:thread.kind,tier,score,encounters:thread.encounters,daysKnown,organic:true,reason};
}

export function getEmergingImportantBonds(){return getSocialConnectionThreads().map(t=>getSocialBondState(t.id)).filter((b):b is SocialBondState=>!!b&&(b.tier==='important'||b.tier==='inner-circle')).sort((a,b)=>b.score-a.score)}

export function markSocialBondMoment(threadId:string){
  const s=read();if(!s)return false;const bond=getSocialBondState(threadId);if(!bond)return false;const f=s.flags||(s.flags={});f[`socialBond:${threadId}:tier`]=bond.tier;f[`socialBond:${threadId}:score`]=bond.score;f[`socialBond:${threadId}:lastDay`]=n(s.day,1);s.eventHistory=[...(s.eventHistory||[]),`social-bond:${threadId}:${bond.tier}`].slice(-320);try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY}}));return true}catch{return false}
}

declare global{interface Window{__moniaSocialBond?:(threadId:string)=>SocialBondState|null;__moniaImportantSocialBonds?:()=>SocialBondState[];__moniaMarkSocialBond?:(threadId:string)=>boolean}}
window.__moniaSocialBond=getSocialBondState;window.__moniaImportantSocialBonds=getEmergingImportantBonds;window.__moniaMarkSocialBond=markSocialBondMoment;
