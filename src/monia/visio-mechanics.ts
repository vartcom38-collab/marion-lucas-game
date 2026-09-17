export type MonIAVisioDirection='incoming'|'outgoing';
export type MonIAVisioPhase='ringing'|'connecting'|'listening'|'speaking'|'reaction'|'thinking'|'ending';
export type MonIAVisioDevice='desktop'|'tablet';

export type MonIAVisioMechanicsPlan={
  direction:MonIAVisioDirection;
  device:MonIAVisioDevice;
  phase:MonIAVisioPhase;
  lucasVisible:boolean;
  marionVisible:boolean;
  cameraGrammar:'lucas_front_camera';
  gazeTarget:'marion_screen_near_lens'|'brief_lens_check'|'natural_offscreen';
  allowFreeReply:boolean;
  suggestedChoices:string[];
  keepSceneAliveWhileChoosing:boolean;
  generationRequired:boolean;
  validation:string[];
};

const BASE_VALIDATION=[
  'same Lucas canonical identity',
  'viewer is Lucas front-facing smartphone camera',
  'phone is never visible',
  'Lucas gaze stays mainly near Marion image / near lens axis',
  'brief off-axis glances are natural and temporary',
  'no persistent side-looking gaze',
  'natural breathing and irregular blinking',
  'no frozen visual while Marion chooses',
  'V16 voice whenever Lucas speaks',
  'spoken text, voice and mouth performance must match',
  'desktop/tablet presentation must not imitate a phone-sized viewport',
];

function defaultChoices(phase:MonIAVisioPhase,direction:MonIAVisioDirection){
  if(phase==='ringing')return direction==='incoming'?['Décrocher','Laisser sonner']:['Annuler'];
  if(phase==='listening'||phase==='reaction'||phase==='thinking')return['Répondre naturellement','Dire autre chose…','Raccrocher'];
  if(phase==='speaking')return[];
  return['Raccrocher'];
}

export function planVisioMechanics(input:{direction:MonIAVisioDirection;device?:MonIAVisioDevice;phase?:MonIAVisioPhase}):MonIAVisioMechanicsPlan{
  const phase=input.phase||'ringing';
  const device=input.device||'desktop';
  const lucasVisible=!['ringing','connecting'].includes(phase)||input.direction==='incoming';
  const marionVisible=false;
  return{
    direction:input.direction,
    device,
    phase,
    lucasVisible,
    marionVisible,
    cameraGrammar:'lucas_front_camera',
    gazeTarget:phase==='thinking'?'natural_offscreen':phase==='reaction'?'brief_lens_check':'marion_screen_near_lens',
    allowFreeReply:phase==='listening'||phase==='reaction'||phase==='thinking',
    suggestedChoices:defaultChoices(phase,input.direction),
    keepSceneAliveWhileChoosing:true,
    generationRequired:['listening','speaking','reaction','thinking'].includes(phase),
    validation:[...BASE_VALIDATION,
      input.direction==='incoming'?'incoming call must feel unexpected but contextually plausible':'outgoing call must begin from Marion initiating contact',
      phase==='speaking'?'Lucas speaking performance must be voice-led from V16 audio':'silent Lucas state must not contain unrelated mouth speech',
    ],
  };
}

export function visioGazePrompt(phase:MonIAVisioPhase){
  if(phase==='thinking')return 'Lucas may glance briefly away while thinking, then naturally returns his gaze toward Marion on the screen near the lens axis. Never hold a sideways stare.';
  if(phase==='reaction')return 'Lucas reacts while looking mostly at Marion image on screen, very near the lens axis, with only tiny brief lens checks.';
  if(phase==='speaking')return 'While speaking, Lucas looks primarily at Marion image on the screen just below/near the front-camera lens, with natural micro-shifts; avoid a persistent off-axis or sideward gaze.';
  return 'Lucas listens to Marion by looking mainly at her image on screen near the camera axis, with occasional brief lens checks and tiny natural glances away.';
}

export function visioPresentation(device:MonIAVisioDevice){
  return device==='tablet'?{
    maxWidth:'980px',aspect:'4:3',videoFit:'cover',controls:'bottom-floating',selfPreview:'small-top-corner'
  }:{
    maxWidth:'1320px',aspect:'16:10',videoFit:'cover',controls:'bottom-floating',selfPreview:'small-top-corner'
  };
}

declare global{interface Window{
  __moniaPlanVisioMechanics?:(input:{direction:MonIAVisioDirection;device?:MonIAVisioDevice;phase?:MonIAVisioPhase})=>MonIAVisioMechanicsPlan;
}}
if(typeof window!=='undefined')window.__moniaPlanVisioMechanics=planVisioMechanics;
