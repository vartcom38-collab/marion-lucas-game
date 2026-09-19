export type Day1ContactSave={
  day:number;
  place:string;
  metDominic:boolean;
  flags:Record<string,unknown>;
};

function n(value:unknown,fallback=0){const x=Number(value);return Number.isFinite(x)?x:fallback}

export function day1FirstContactThresholdAbs(save:Day1ContactSave){
  const targetLocal=n(save.flags.firstContactTarget,900);
  const targetAbs=save.day*1440+targetLocal;
  const earliestAbs=n(save.flags.firstContactEarliest,0);
  return Math.max(targetAbs,earliestAbs);
}

export function shouldTriggerDay1FirstContact(save:Day1ContactSave,localMinutes:number){
  if(save.metDominic||save.day!==1||save.place==='home')return false;
  const now=save.day*1440+localMinutes;
  return now>=day1FirstContactThresholdAbs(save);
}

export function shouldTriggerDay1FeriaPull(save:Day1ContactSave,localMinutes:number){
  if(save.metDominic||save.day!==1||save.place!=='home'||save.flags.feriaPullDone===true)return false;
  return localMinutes>=1110;
}

export function nextFeriaPullEarliestAbs(save:Day1ContactSave,absoluteNow:number){
  return absoluteNow+35;
}
