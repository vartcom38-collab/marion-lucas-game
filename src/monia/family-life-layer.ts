import './property-life';
import { getLifeAgeSnapshot } from './life-age-engine';

const SAVE_KEY='marion-lucas-save-v4';

type Save={day?:number;marionAge?:number;lucasAge?:number;married?:boolean;children?:number;relationship?:number;trust?:number;flags?:Record<string,unknown>;eventHistory?:string[]};

export type FamilyState='closed'|'thinking'|'trying'|'pregnant'|'postpartum'|'parenting';
export type FamilyOpportunity={
  state:FamilyState;
  eligible:boolean;
  surpriseEligible:boolean;
  reason:string;
  nextCheckDay?:number;
  possibleOutcomes?:string[];
};

function readSave():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function n(v:unknown,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}

export function getFamilyLifeOpportunity():FamilyOpportunity|null{
  const s=readSave();if(!s)return null;
  const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));
  const state=String(f.familyState||'closed') as FamilyState;
  const relationship=n(s.relationship),trust=n(s.trust),marionAge=getLifeAgeSnapshot(s).marionAge;
  if(!s.married&&state==='closed')return{state:'closed',eligible:false,surpriseEligible:false,reason:'Le projet familial reste fermé tant que le couple ne l’a pas réellement ouvert.'};
  if(state==='closed')return{state:'thinking',eligible:true,surpriseEligible:false,reason:'Le sujet peut être évoqué sans imposer de décision.'};
  if(state==='thinking')return{state:'thinking',eligible:relationship>=58&&trust>=52,surpriseEligible:false,reason:'Le couple peut choisir d’essayer, de patienter ou de ne pas vouloir d’enfant.'};
  if(state==='trying'){
    const since=n(f.familyTryingDay,day),wait=Math.max(0,day-since),cooldown=n(f.familyNextCheckDay,since+28);
    return{state:'trying',eligible:day>=cooldown,surpriseEligible:day>=cooldown,reason:wait<30?'Le projet est récent; rien ne doit être instantané.':'Une nouvelle fenêtre naturelle peut être évaluée.',nextCheckDay:cooldown,possibleOutcomes:['not-yet','pregnancy','pause-project']};
  }
  if(state==='pregnant')return{state:'pregnant',eligible:true,surpriseEligible:true,reason:'La grossesse évolue par étapes; les informations importantes peuvent rester des surprises.',possibleOutcomes:['single-pregnancy','twins','girl','boy','keep-sex-secret','complication','loss']};
  if(state==='postpartum')return{state:'postpartum',eligible:true,surpriseEligible:false,reason:'La priorité est l’adaptation au nouveau rythme, au repos et au couple.'};
  if(state==='parenting')return{state:'parenting',eligible:true,surpriseEligible:true,reason:`La famille évolue avec l’âge des enfants et les étapes de vie de Marion (${marionAge} ans).`};
  return{state:'closed',eligible:false,surpriseEligible:false,reason:'Aucune fenêtre familiale active.'};
}

export function markFamilyDecision(decision:'open'|'try'|'wait'|'stop'|'pregnant'|'postpartum'|'parenting'){
  const s=readSave();if(!s)return false;const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));
  if(decision==='open')f.familyState='thinking';
  if(decision==='try'){f.familyState='trying';f.familyTryingDay=day;f.familyNextCheckDay=day+28;}
  if(decision==='wait'){f.familyState='thinking';f.familyNextConversationDay=day+60;}
  if(decision==='stop'){f.familyState='closed';f.familyChoiceStoppedDay=day;}
  if(decision==='pregnant'){f.familyState='pregnant';f.pregnancyStartDay=day;}
  if(decision==='postpartum'){f.familyState='postpartum';f.birthDay=day;}
  if(decision==='parenting'){f.familyState='parenting';}
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'));return true}catch{return false}
}

declare global{interface Window{__moniaFamilyLife?:()=>FamilyOpportunity|null;__moniaFamilyDecision?:(decision:'open'|'try'|'wait'|'stop'|'pregnant'|'postpartum'|'parenting')=>boolean}}
window.__moniaFamilyLife=getFamilyLifeOpportunity;
window.__moniaFamilyDecision=markFamilyDecision;
