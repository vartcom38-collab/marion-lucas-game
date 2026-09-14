import './property-life';
import './postpartum-family-life';
import { getLifeAgeSnapshot } from './life-age-engine';
import { ensureLifeMilestoneChronology } from './life-milestone-chronology';
import { getPregnancyState, setPregnancyState } from './pregnancy-state';
import { finalizeBirth, startLabor } from './postpartum-family-life';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;marionAge?:number;lucasAge?:number;married?:boolean;children?:number;relationship?:number;trust?:number;flags?:Record<string,unknown>;eventHistory?:string[]};
export type FamilyDecision='open'|'try'|'wait'|'stop'|'pregnant'|'labor'|'postpartum'|'parenting';
export type FamilyState='closed'|'thinking'|'trying'|'pregnant'|'postpartum'|'parenting';
export type FamilyOpportunity={state:FamilyState;eligible:boolean;surpriseEligible:boolean;reason:string;nextCheckDay?:number;possibleOutcomes?:string[]};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}
function marriageEstablished(s:Save){const chronology=ensureLifeMilestoneChronology(s),day=Math.max(1,n(s.day,1)),marriedDay=chronology?.marriedDay||0;return!!s.married&&!!marriedDay&&day>=marriedDay+60}

export function getFamilyLifeOpportunity():FamilyOpportunity|null{
  const s=readSave();if(!s)return null;
  const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));const pregnancy=getPregnancyState(s);
  let state=String(f.familyState||'closed') as FamilyState;
  if(pregnancy?.state==='confirmed')state='pregnant';else if(pregnancy?.state==='postpartum')state='postpartum';else if(pregnancy?.state==='trying'||pregnancy?.state==='possible')state='trying';
  const relationship=n(s.relationship),trust=n(s.trust),marionAge=getLifeAgeSnapshot(s).marionAge;
  if(state==='closed'&&!marriageEstablished(s))return{state:'closed',eligible:false,surpriseEligible:false,reason:'Le projet familial reste fermé tant que la vie après le mariage n’a pas eu le temps de devenir un quotidien.'};
  if(state==='closed')return{state:'thinking',eligible:relationship>=68&&trust>=60,surpriseEligible:false,reason:'Le sujet peut maintenant être évoqué sans imposer de décision ni de calendrier.'};
  if(state==='thinking'){
    const next=n(f.familyNextConversationDay,0);const ready=relationship>=58&&trust>=52&&(!next||day>=next);
    return{state:'thinking',eligible:ready,surpriseEligible:false,reason:next&&day<next?'Le sujet a été remis à plus tard : il ne doit pas revenir immédiatement.':'Le couple peut choisir d’essayer, de patienter ou de ne pas vouloir d’enfant.'};
  }
  if(state==='trying'){
    const since=n(f.familyTryingDay,day),wait=Math.max(0,day-since),cooldown=n(f.familyNextCheckDay,since+28),hiddenPossible=pregnancy?.state==='possible';
    return{state:'trying',eligible:!hiddenPossible&&day>=cooldown,surpriseEligible:!hiddenPossible&&day>=cooldown,reason:hiddenPossible?'Une grossesse possible existe mais reste inconnue : le projet familial ne doit pas révéler ce secret.':wait<30?'Le projet est récent; rien ne doit être instantané.':'Une nouvelle fenêtre naturelle peut être évaluée.',nextCheckDay:hiddenPossible?undefined:cooldown,possibleOutcomes:['not-yet','pregnancy','pause-project']};
  }
  if(state==='pregnant')return{state:'pregnant',eligible:true,surpriseEligible:true,reason:'La grossesse confirmée évolue par étapes; les informations importantes peuvent rester des surprises.',possibleOutcomes:['single-pregnancy','girl','boy','keep-sex-secret','complication','loss']};
  if(state==='postpartum')return{state:'postpartum',eligible:true,surpriseEligible:false,reason:'La priorité est l’adaptation au nouveau rythme, au repos et au couple.'};
  if(state==='parenting')return{state:'parenting',eligible:true,surpriseEligible:true,reason:`La famille évolue avec l’âge des enfants et les étapes de vie de Marion (${marionAge} ans). Un nouveau projet d’enfant peut être rouvert plus tard sans effacer les précédents.`};
  return{state:'closed',eligible:false,surpriseEligible:false,reason:'Aucune fenêtre familiale active.'};
}

export function markFamilyDecision(decision:FamilyDecision){
  const s=readSave();if(!s)return false;const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));const opportunity=getFamilyLifeOpportunity();const current=String(f.familyState||'closed') as FamilyState;const pregnancy=getPregnancyState(s);
  if(decision==='open'){
    if(current!=='closed'||!opportunity?.eligible||!marriageEstablished(s))return false;
    f.familyState='thinking';f.familyProjectOpenedDay=day;
  }
  if(decision==='wait'){
    if(current!=='thinking')return false;
    f.familyState='thinking';f.familyNextConversationDay=day+60;
  }
  if(decision==='stop'){
    if(current!=='thinking'&&current!=='trying')return false;
    f.familyState=n(s.children,0)>0?'parenting':'closed';f.familyChoiceStoppedDay=day;f.contraceptionMode='protected';f.qualifyingConceptionEvent=false;
  }
  if(decision==='parenting'){
    if(n(s.children,0)<1||pregnancy?.state!=='postpartum')return false;
    f.familyState='parenting';
  }
  if(decision==='try'){
    if(current!=='thinking'||!opportunity?.eligible)return false;
    f.contraceptionMode='trying';f.qualifyingConceptionEvent=false;
  }
  if(decision==='pregnant'){
    if(current!=='trying'||pregnancy?.state!=='possible')return false;
  }
  if(decision==='labor'){
    if(pregnancy?.state!=='confirmed'||f.inLabor===true)return false;
  }
  if(decision==='postpartum'){
    if(pregnancy?.state!=='confirmed'||f.inLabor!==true)return false;
  }
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(s));
    if(decision==='parenting')setPregnancyState('none',day);
    if(decision==='open')setPregnancyState('none',day);
    if(decision==='try'){
      if(!setPregnancyState('trying',day))return false;
      const fresh=readSave();if(fresh){const ff=fresh.flags||(fresh.flags={});ff.familyTryingDay=day;ff.familyNextCheckDay=day+28;ff.contraceptionMode='trying';ff.qualifyingConceptionEvent=false;localStorage.setItem(SAVE_KEY,JSON.stringify(fresh))}
    }
    if(decision==='pregnant')setPregnancyState('confirmed',day);
    if(decision==='labor')return startLabor();
    if(decision==='postpartum')return !!finalizeBirth({birthDay:day});
    window.dispatchEvent(new CustomEvent('monia:save-changed',{detail:{key:SAVE_KEY,source:'family-life'}}));return true
  }catch{return false}
}

declare global{interface Window{__moniaFamilyLife?:()=>FamilyOpportunity|null;__moniaFamilyDecision?:(decision:FamilyDecision)=>boolean}}
window.__moniaFamilyLife=getFamilyLifeOpportunity;window.__moniaFamilyDecision=markFamilyDecision;
