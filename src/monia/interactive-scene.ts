import { createSceneContinuityPacket, updateSceneContinuityPacket, continuityPrompt, type MonIASceneContinuityPacket } from './scene-continuity';

export type MonIAInteractiveChoice={
  id:string;
  label:string;
  intent:string;
  consequenceHint?:string;
};

export type MonIAInteractiveExperience={
  response:any;
  scenePlan?:any;
  dramaPlan?:any;
  mediaPlan?:any;
  generationJob?:any;
};

export type MonIAInteractiveScene={
  id:string;
  experience:MonIAInteractiveExperience;
  continuity:MonIASceneContinuityPacket;
  beatIndex:number;
  state:'playing'|'awaiting-choice'|'resuming'|'materializing'|'complete'|'error';
  choices:MonIAInteractiveChoice[];
  freeResponseAllowed:true;
  lastPlayerInput?:string;
  branchHistory:{beatIndex:number;choiceId?:string;freeText?:string;at:number}[];
  lastMediaUrl?:string;
  error?:string;
};

const STORE_KEY='monia-interactive-scene-v1';

function write(scene:MonIAInteractiveScene){
  try{sessionStorage.setItem(STORE_KEY,JSON.stringify(scene));window.dispatchEvent(new CustomEvent('monia-interactive-scene',{detail:scene}))}catch{}
}

export function readInteractiveScene():MonIAInteractiveScene|null{
  try{const raw=sessionStorage.getItem(STORE_KEY);return raw?JSON.parse(raw) as MonIAInteractiveScene:null}catch{return null}
}

function cleanChoices(raw:unknown):MonIAInteractiveChoice[]{
  if(!Array.isArray(raw))return [];
  return raw.slice(0,3).map((item:any,index)=>({
    id:String(item?.id||`choice-${index+1}`),
    label:String(item?.label||item?.text||`Choix ${index+1}`).trim(),
    intent:String(item?.intent||item?.effect||'continue naturally').trim(),
    consequenceHint:item?.consequenceHint?String(item.consequenceHint):undefined,
  })).filter(item=>item.label);
}

function experienceSceneId(experience:MonIAInteractiveExperience){
  return String(experience.generationJob?.id||experience.dramaPlan?.id||experience.scenePlan?.id||`scene-${Date.now()}`);
}

function experienceLocation(experience:MonIAInteractiveExperience){
  return String(experience.mediaPlan?.visual?.location||experience.scenePlan?.world?.place||experience.response?.scene?.location||'preserve current location');
}

function experienceActors(experience:MonIAInteractiveExperience){
  const actors=Array.isArray(experience.generationJob?.actors)?experience.generationJob.actors:[];
  if(actors.length)return actors.map(String);
  const actor=String(experience.response?.actor||'Lucas');
  return actor?[actor]:['Lucas'];
}

function experienceEmotion(experience:MonIAInteractiveExperience){
  return String(experience.mediaPlan?.visual?.emotion||experience.response?.emotion||'preserve current emotion');
}

export function startInteractiveScene(experience:MonIAInteractiveExperience,choices:unknown=[]):MonIAInteractiveScene{
  const actors=experienceActors(experience);
  let continuity=createSceneContinuityPacket({
    sceneId:`interactive-${experienceSceneId(experience)}`,
    characters:actors,
    location:experienceLocation(experience),
    lighting:'preserve established scene lighting',
  });
  continuity=updateSceneContinuityPacket(continuity,{emotionalBeat:experienceEmotion(experience)});
  const scene:MonIAInteractiveScene={
    id:`interactive-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    experience,continuity,beatIndex:0,state:'playing',choices:cleanChoices(choices),freeResponseAllowed:true,branchHistory:[],
  };
  write(scene);return scene;
}

export function pauseForChoice(scene:MonIAInteractiveScene,choices:unknown):MonIAInteractiveScene{
  const next={...scene,state:'awaiting-choice' as const,choices:cleanChoices(choices)};
  write(next);return next;
}

export function applyInteractiveChoice(scene:MonIAInteractiveScene,input:{choiceId?:string;freeText?:string}):MonIAInteractiveScene{
  if(scene.state!=='awaiting-choice')throw new Error('Interactive scene is not awaiting a player choice');
  const freeText=String(input.freeText||'').trim();
  const choice=input.choiceId?scene.choices.find(item=>item.id===input.choiceId):undefined;
  if(!choice&&!freeText)throw new Error('A listed choice or free response is required');
  const playerInput=freeText||choice!.label;
  const continuity=updateSceneContinuityPacket(scene.continuity,{
    emotionalBeat:choice?.intent||freeText,
    lastValidatedBeat:`Player decision at beat ${scene.beatIndex}: ${playerInput}`,
  });
  const next:MonIAInteractiveScene={
    ...scene,continuity,state:'resuming',lastPlayerInput:playerInput,
    branchHistory:[...scene.branchHistory,{beatIndex:scene.beatIndex,choiceId:choice?.id,freeText:freeText||undefined,at:Date.now()}],
    choices:[],beatIndex:scene.beatIndex+1,
  };
  write(next);return next;
}

export function buildInteractiveResumePrompt(scene:MonIAInteractiveScene){
  if(scene.state!=='resuming'||!scene.lastPlayerInput)throw new Error('Interactive scene has no pending branch to resume');
  return [
    'Continue the exact same scene after the player decision. Do not reset time, room, wardrobe, character positions or relationship state.',
    continuityPrompt(scene.continuity),
    `Player decision authority: ${scene.lastPlayerInput}.`,
    'React causally to that decision. Preserve everything already established unless the decision itself naturally changes it.',
    'Remain in POV unless the dramatic grammar explicitly warrants a brief external cinematic. Keep the scene alive while presenting any next choice.',
    'If another decision point is reached, offer at most three concise contextual choices plus free-response capability.',
  ].join(' ');
}

export function markInteractiveScenePlaying(scene:MonIAInteractiveScene,patch:Parameters<typeof updateSceneContinuityPacket>[1]={}){
  const next={...scene,state:'playing' as const,continuity:updateSceneContinuityPacket(scene.continuity,patch)};
  write(next);return next;
}

export function markInteractiveSceneMaterializing(scene:MonIAInteractiveScene){const next={...scene,state:'materializing' as const};write(next);return next}
export function attachInteractiveMedia(scene:MonIAInteractiveScene,mediaUrl?:string){const next={...scene,state:'playing' as const,lastMediaUrl:mediaUrl||scene.lastMediaUrl};write(next);return next}
export function failInteractiveScene(scene:MonIAInteractiveScene,error:string){const next={...scene,state:'error' as const,error};write(next);return next}
export function completeInteractiveScene(scene:MonIAInteractiveScene){const next={...scene,state:'complete' as const,choices:[]};write(next);return next}

console.info('[MonIA] Interactive scene branches ready · listed choices + free response · same-scene continuity preserved across narrative and media runtimes');
