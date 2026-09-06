import type { MonIAExperienceResult } from './experience-runtime';
import type { MonIAMediaPlan, MonIAFraming } from './media-orchestrator';

export type DramaShotRole='establishing'|'dialogue'|'reaction'|'two-shot'|'closing';
export type RuntimeDramaShot={
  id:string;
  index:number;
  role:DramaShotRole;
  framing:MonIAFraming;
  duration:number;
  actor:'Lucas'|'Marion'|null;
  voiceText?:string;
  action:string;
  emotion:string;
  continuityFrom?:string;
  reusePreviousFrame:boolean;
};

function actorFrom(plan:MonIAMediaPlan):'Lucas'|'Marion'|null{
  const value=String(plan.actor||'').toLowerCase();
  if(value.includes('lucas'))return'Lucas';
  if(value.includes('marion'))return'Marion';
  return null;
}

function clampDuration(value:number){return Math.max(2.2,Math.min(6,value))}

export function buildRuntimeDramaShots(experience:MonIAExperienceResult):RuntimeDramaShot[]{
  const plan=experience.mediaPlan;
  const actor=actorFrom(plan);
  const spoken=(experience.response.spokenText||experience.response.text||'').trim();
  const target=Math.max(10,Math.min(35,plan.assembly.targetSceneDuration||18));

  const defs:Array<Omit<RuntimeDramaShot,'id'|'index'|'duration'|'continuityFrom'>>=[
    {
      role:'establishing',framing:plan.visual.framing==='two-shot'?'two-shot':'waist',actor:null,
      action:`Establish the exact current location and physical positions. ${plan.visual.action}. No dialogue yet; only natural breathing and environment movement.`,
      emotion:plan.visual.emotion,reusePreviousFrame:false,
    },
    {
      role:'dialogue',framing:'close',actor,voiceText:spoken||undefined,
      action:`Intimate performance shot. ${actor||'The active character'} delivers only the dialogue already decided by gameplay. Restrained facial acting, eye focus, breath and tiny posture changes.`,
      emotion:plan.visual.emotion,reusePreviousFrame:true,
    },
    {
      role:'reaction',framing:'close',actor:actor==='Lucas'?'Marion':actor==='Marion'?'Lucas':null,
      action:'Silent reaction to the previous line: eyes, breath, micro-expression and a very small head or hand movement only. No new dialogue and no new story information.',
      emotion:`reaction to ${plan.visual.emotion}`,reusePreviousFrame:true,
    },
    {
      role:'two-shot',framing:'two-shot',actor:null,
      action:'Return both characters to the same continuous space. Preserve exact positions, wardrobe, hair, lighting and emotional tension. A small shared gesture or gaze may evolve naturally; do not invent a new event.',
      emotion:plan.visual.emotion,reusePreviousFrame:true,
    },
    {
      role:'closing',framing:'chest',actor,
      action:'Closing beat of the same gameplay event. Hold the emotional consequence for a moment, then leave a clean natural ending that can return immediately to gameplay. No extra plot development.',
      emotion:plan.visual.emotion,reusePreviousFrame:true,
    },
  ];

  const desired=Math.max(3,Math.min(defs.length,Math.round(target/3.5)));
  const selected=defs.slice(0,desired);
  const each=clampDuration(target/selected.length);
  return selected.map((shot,index)=>({
    ...shot,
    id:`shot-${index+1}`,
    index,
    duration:each,
    continuityFrom:index?`shot-${index}`:undefined,
  }));
}

export function shotMediaPlan(base:MonIAMediaPlan,shot:RuntimeDramaShot):MonIAMediaPlan{
  const continuity=shot.continuityFrom
    ? ` Continue directly from ${shot.continuityFrom}; preserve exact face, wardrobe, hair, room geometry, props, lighting and screen direction.`
    : ' This is the establishing shot; lock the visual continuity baseline for every following shot.';
  return {
    ...base,
    actor:shot.actor||base.actor,
    visual:{
      ...base.visual,
      framing:shot.framing,
      emotion:shot.emotion,
      action:`${shot.action}${continuity}`,
      durationTarget:shot.duration,
    },
    assembly:{...base.assembly,multiShot:false,targetSceneDuration:shot.duration},
  };
}
