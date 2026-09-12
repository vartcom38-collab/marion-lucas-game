const SAVE_KEY='marion-lucas-save-v4';

type Readiness='not-yet'|'open'|'ready';
type Save={day?:number;official?:boolean;engaged?:boolean;married?:boolean;relationship?:number;trust?:number;flags?:Record<string,unknown>};

export type CommitmentReadiness={
  readiness:Readiness;
  proposalAllowed:boolean;
  canSignalReady:boolean;
  cooldownUntilDay:number;
  reason:string;
};

function read():Save|null{try{const raw=localStorage.getItem(SAVE_KEY);return raw?JSON.parse(raw) as Save:null}catch{return null}}
function write(s:Save){localStorage.setItem(SAVE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('storage'))}
function n(v:unknown,d=0){const x=Number(v);return Number.isFinite(x)?x:d}

export function getCommitmentReadiness():CommitmentReadiness|null{
  const s=read();if(!s)return null;const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));
  const readiness=(String(f.marriageReadiness||'open') as Readiness);
  const officialDay=n(f.officialDay,day);const cooldown=n(f.proposalCooldownUntilDay,0);
  const base=!!s.official&&!s.engaged&&!s.married&&n(s.relationship)>=68&&n(s.trust)>=58&&day>=officialDay+90;
  const proposalAllowed=base&&readiness!=='not-yet'&&day>=cooldown;
  return{readiness,proposalAllowed,canSignalReady:!!s.official&&!s.engaged&&!s.married,cooldownUntilDay:cooldown,reason:proposalAllowed?'La relation et le temps rendent une demande crédible, sans imposer sa date.':readiness==='not-yet'?'Marion a indiqué que ce serait trop tôt pour l’instant.':'La fenêtre n’est pas encore mûre.'};
}

export function setMarriageReadiness(value:Readiness){const s=read();if(!s)return false;const f=s.flags||(s.flags={});f.marriageReadiness=value;f.marriageReadinessDay=Math.max(1,n(s.day,1));if(value==='ready')f.proposalCooldownUntilDay=0;write(s);window.dispatchEvent(new CustomEvent('monia:marriage-readiness',{detail:{value}}));return true}

export function recordProposalResponse(response:'yes'|'too-early'|'no-marriage'){
  const s=read();if(!s)return false;const f=s.flags||(s.flags={});const day=Math.max(1,n(s.day,1));
  f.lastProposalResponse=response;f.lastProposalResponseDay=day;
  if(response==='yes'){s.engaged=true;f.engagedDay=day;f.marriageReadiness='ready'}
  if(response==='too-early'){f.marriageReadiness='not-yet';f.proposalCooldownUntilDay=day+Math.max(60,Math.floor(90+n(s.trust)/2));f.proposalRejectedWithoutRelationshipPenalty=true}
  if(response==='no-marriage'){f.marriageReadiness='not-yet';f.proposalCooldownUntilDay=day+365;f.marriageTopicNeedsConversation=true}
  write(s);window.dispatchEvent(new CustomEvent('monia:proposal-response',{detail:{response}}));return true
}

declare global{interface Window{__moniaCommitmentReadiness?:()=>CommitmentReadiness|null;__moniaSetMarriageReadiness?:(v:Readiness)=>boolean;__moniaRecordProposalResponse?:(v:'yes'|'too-early'|'no-marriage')=>boolean}}
window.__moniaCommitmentReadiness=getCommitmentReadiness;window.__moniaSetMarriageReadiness=setMarriageReadiness;window.__moniaRecordProposalResponse=recordProposalResponse;
