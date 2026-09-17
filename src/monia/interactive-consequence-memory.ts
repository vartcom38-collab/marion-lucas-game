import { moniaStorage } from './storage';

const SAVE_KEY='marion-lucas-save-v4';
const MAX_HISTORY=24;

type NumericEffects={relationship?:number;trust?:number;chemistry?:number};
type LooseSave={
  day?:number;time?:string;relationship?:number;trust?:number;chemistry?:number;
  flags?:Record<string,unknown>;
};
export type InteractiveConsequence={
  sceneId:string;beatIndex:number;playerInput:string;choiceId?:string;
  consequenceHint?:string;effects?:NumericEffects;actor?:string;
};

function finiteDelta(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.max(-20,Math.min(20,n)):undefined}
function applyDelta(base:unknown,delta:unknown){const d=finiteDelta(delta);if(d===undefined)return base;const current=Number(base);return Math.max(0,Math.min(100,(Number.isFinite(current)?current:0)+d))}

export async function persistInteractiveConsequence(input:InteractiveConsequence){
  let day=0,time='';
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(raw){
      const save=JSON.parse(raw) as LooseSave;day=Number(save.day||0);time=String(save.time||'');
      const flags=save.flags||(save.flags={});
      const previous=Array.isArray(flags.interactiveDecisionHistory)?flags.interactiveDecisionHistory:[];
      const entry={sceneId:input.sceneId,beatIndex:input.beatIndex,choiceId:input.choiceId,playerInput:input.playerInput.slice(0,220),consequenceHint:input.consequenceHint?.slice(0,180),at:Date.now(),day,time};
      flags.lastInteractiveDecision=entry;
      flags.interactiveDecisionHistory=[...previous,entry].slice(-MAX_HISTORY);
      if(input.effects){
        if(input.effects.relationship!==undefined)save.relationship=applyDelta(save.relationship,input.effects.relationship) as number;
        if(input.effects.trust!==undefined)save.trust=applyDelta(save.trust,input.effects.trust) as number;
        if(input.effects.chemistry!==undefined)save.chemistry=applyDelta(save.chemistry,input.effects.chemistry) as number;
      }
      localStorage.setItem(SAVE_KEY,JSON.stringify(save));
      window.dispatchEvent(new CustomEvent('marion-lucas:interactive-consequence',{detail:entry}));
    }
  }catch{}
  const actor=input.actor||'Lucas';
  const text=`Décision de Marion avec ${actor}: ${input.playerInput}${input.consequenceHint?` · conséquence: ${input.consequenceHint}`:''}`.slice(0,260);
  await moniaStorage.put({id:`interactive-${Date.now()}-${Math.random().toString(36).slice(2)}`,kind:'event',text,day,time,actors:['Marion',actor],createdAt:Date.now()}).catch(()=>undefined);
}

console.info('[MonIA] Interactive consequence memory active · durable game-save fact + long-term event memory · numeric effects only when explicitly supplied');