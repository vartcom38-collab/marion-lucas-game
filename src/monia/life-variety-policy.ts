export type VarietyChannel='message'|'voice'|'call'|'visio'|'cinematic'|'ambient';

type VarietyInput={channel:VarietyChannel;basePriority:number;eventHistory?:string[];messages?:Array<{from?:string;text?:string;day?:number}>;day?:number};

function normalized(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

function channelHits(channel:VarietyChannel,history:string[]){
  const keys:Record<VarietyChannel,string[]>={
    message:['message','sms','text'],voice:['voice','vocal'],call:['call','appel'],visio:['visio','video-call'],cinematic:['cinematic','cinematique','scene'],ambient:['ambient','environment','pov']
  };
  const wanted=keys[channel];
  return history.reduce((n,item)=>n+(wanted.some(k=>normalized(item).includes(k))?1:0),0);
}

export function varietyAdjustedPriority(input:VarietyInput){
  const recent=(input.eventHistory||[]).slice(-12);
  const hits=channelHits(input.channel,recent);
  const last=recent.slice(-4);
  const hotHits=channelHits(input.channel,last);
  // Repetition fatigue is deliberately soft: plausibility and explicit gameplay state still dominate.
  const fatigue=Math.min(24,hits*2+hotHits*4);
  const recoveryBonus=hits===0?4:0;
  return Math.max(1,Math.round(input.basePriority-fatigue+recoveryBonus));
}

export function varietyReason(channel:VarietyChannel,eventHistory:string[]=[]){
  const hits=channelHits(channel,eventHistory.slice(-12));
  if(hits===0)return 'Ce canal a peu été utilisé récemment et peut apporter de la fraîcheur.';
  if(hits>=4)return 'Ce canal a été fréquent récemment; MonIA le pénalise temporairement pour éviter une boucle répétitive.';
  return 'Ce canal reste disponible mais reçoit une légère fatigue de répétition.';
}

console.info('[MonIA] Life variety policy active · soft repetition fatigue only · plausibility and explicit player intent remain authoritative');
