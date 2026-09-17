import type { MonIADirectorRequest, MonIADirectorResult } from './director';
import type { MonIAMediaPlan } from './media-orchestrator';

export type MonIAGenerationMedium='visio'|'cinematic'|'gameplay-life'|'ambient'|'audio-call'|'voice-message'|'text';
export type MonIAGenerationStep='dialogue'|'voice'|'storyboard'|'identity-bind'|'visual'|'sync'|'quality-control'|'assemble'|'publish-transient';

export type MonIAGenerationShot={
  id:string;
  durationHint:number;
  camera:string;
  action:string;
  emotion:string;
  actors:string[];
  dialogue?:Array<{actor:string;text:string;voice:'lucas-v16-direct-design'|'none'}>;
  continuityFromPrevious:boolean;
};

export type MonIAGenerationJob={
  version:1;
  id:string;
  createdAt:string;
  medium:MonIAGenerationMedium;
  transient:true;
  narrativeAuthority:'game-save';
  context:{place:string;time:string;day:number;relationship:string;recentAction:string};
  actors:Array<{
    id:string;
    identityRef?:string;
    motionBank?:string;
    voice?:{
      renderer:'scripts/monia_lucas_v16_runtime_voice.py';
      strategy:'config/lucas-voice-strategy.json';
      fallback:'forbidden';
    };
  }>;
  dialogueAuthority:'exact-text-before-video';
  steps:MonIAGenerationStep[];
  shots:MonIAGenerationShot[];
  continuity:{
    lockIdentityAcrossShots:true;
    lockWardrobeWithinScene:true;
    lockLocationWithinScene:true;
    lockLightingWithinScene:true;
    carryEmotionAcrossCuts:true;
    reusePreviousFrameWhenHelpful:true;
  };
  validation:{
    requireIdentity:boolean;
    requireCameraGrammar:boolean;
    requireExactDialogueMatch:boolean;
    requireV16WhenLucasSpeaks:boolean;
    requireAVCoherence:boolean;
    allowAutomaticCanonPromotion:false;
  };
};

function hash(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function mediumFor(result:MonIADirectorResult,plan:MonIAMediaPlan):MonIAGenerationMedium{
  if(result.channel==='visio'||plan.mode==='live-visio')return'visio';
  if(result.channel==='scene'||result.channel==='video')return'cinematic';
  if(result.channel==='call')return'audio-call';
  if(result.channel==='voice')return'voice-message';
  if(!plan.visual.required)return'text';
  return'gameplay-life';
}
function splitDuration(total:number,maxShot:number){const parts:number[]=[];let left=Math.max(1,total);while(left>0){const d=Math.min(maxShot,left);parts.push(d);left-=d}return parts}

export function buildMonIAGenerationJob(result:MonIADirectorResult,plan:MonIAMediaPlan,request:MonIADirectorRequest):MonIAGenerationJob{
  const medium=mediumFor(result,plan);
  const context=request.context;
  const lucasSpeaks=Boolean((result.spokenText||result.text)?.trim())&&result.actor?.toLowerCase?.()==='lucas';
  const requestedDuration=Math.max(4,Math.min(120,Number(result.scene?.duration||8)));
  const shotDurations=medium==='cinematic'&&requestedDuration>18?splitDuration(requestedDuration,8):[requestedDuration];
  const exactText=(result.spokenText||result.text||'').trim();
  const actors=[result.actor||'Lucas'].filter(Boolean);
  const shots=shotDurations.map((durationHint,index):MonIAGenerationShot=>({
    id:`shot-${index+1}`,
    durationHint,
    camera:medium==='visio'?'Lucas smartphone front camera; viewer is Marion; phone invisible':String(result.scene?.framing||plan.visual.framing||'natural cinematic camera'),
    action:index===0?String(result.scene?.action||plan.visual.action||'natural immediate action'):'continue the same scene with coherent screen direction and emotional continuity',
    emotion:String(result.emotion||plan.visual.emotion||'natural'),
    actors,
    dialogue:index===0&&lucasSpeaks?[{actor:'Lucas',text:exactText,voice:'lucas-v16-direct-design'}]:undefined,
    continuityFromPrevious:index>0,
  }));
  const seed=[medium,context.place,context.time,context.day,context.recentAction,exactText].join('|');
  return{
    version:1,id:`monia-${hash(seed)}`,createdAt:new Date().toISOString(),medium,transient:true,narrativeAuthority:'game-save',
    context:{place:context.place,time:context.time,day:context.day,relationship:context.relationship,recentAction:context.recentAction},
    actors:actors.map(id=>id.toLowerCase()==='lucas'?{id:'Lucas',identityRef:'config/lucas-reference-bank.json',motionBank:'config/motion-reference-bank.json',voice:{renderer:'scripts/monia_lucas_v16_runtime_voice.py',strategy:'config/lucas-voice-strategy.json',fallback:'forbidden'}}:{id}),
    dialogueAuthority:'exact-text-before-video',
    steps:lucasSpeaks?['dialogue','voice','storyboard','identity-bind','visual','sync','quality-control','assemble','publish-transient']:['storyboard','identity-bind','visual','quality-control','assemble','publish-transient'],
    shots,
    continuity:{lockIdentityAcrossShots:true,lockWardrobeWithinScene:true,lockLocationWithinScene:true,lockLightingWithinScene:true,carryEmotionAcrossCuts:true,reusePreviousFrameWhenHelpful:true},
    validation:{requireIdentity:actors.some(a=>a.toLowerCase()==='lucas'),requireCameraGrammar:medium==='visio'||medium==='cinematic',requireExactDialogueMatch:lucasSpeaks,requireV16WhenLucasSpeaks:lucasSpeaks,requireAVCoherence:lucasSpeaks&&(medium==='visio'||medium==='cinematic'),allowAutomaticCanonPromotion:false},
  };
}
