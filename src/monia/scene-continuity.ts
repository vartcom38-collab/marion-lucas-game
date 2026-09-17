export type MonIACharacterContinuity={
  id:'Lucas'|'Marion'|string;
  identityLocked:true;
  wardrobe?:string;
  hair?:string;
  visibleTattoos?:string[];
  emotion?:string;
  gazeTarget?:string;
  posture?:string;
  screenPosition?:string;
};

export type MonIASceneContinuityPacket={
  sceneId:string;
  revision:number;
  location:string;
  timeOfDay?:string;
  lighting?:string;
  weather?:string;
  cameraSide?:string;
  props:string[];
  characters:Record<string,MonIACharacterContinuity>;
  lastShotId?:string;
  lastFrameUrl?:string;
  notes:string[];
};

export function createSceneContinuityPacket(input:{sceneId:string;location:string;characters:string[];timeOfDay?:string;lighting?:string;weather?:string}):MonIASceneContinuityPacket{
  const characters:Record<string,MonIACharacterContinuity>={};
  for(const id of input.characters){characters[id]={id,identityLocked:true,visibleTattoos:[]}}
  return {sceneId:input.sceneId,revision:1,location:input.location,timeOfDay:input.timeOfDay,lighting:input.lighting,weather:input.weather,props:[],characters,notes:[]};
}

export function updateSceneContinuity(packet:MonIASceneContinuityPacket,patch:Partial<Omit<MonIASceneContinuityPacket,'sceneId'|'revision'|'characters'>> & {characters?:Record<string,Partial<MonIACharacterContinuity>>}):MonIASceneContinuityPacket{
  const characters={...packet.characters};
  if(patch.characters){
    for(const [id,value] of Object.entries(patch.characters)){
      const previous=characters[id]||{id,identityLocked:true,visibleTattoos:[]};
      characters[id]={...previous,...value,id,identityLocked:true};
    }
  }
  return {...packet,...patch,characters,sceneId:packet.sceneId,revision:packet.revision+1};
}

export function continuityPrompt(packet:MonIASceneContinuityPacket){
  const people=Object.values(packet.characters).map(c=>{
    const tattoos=c.visibleTattoos?.length?` visible canonical tattoos: ${c.visibleTattoos.join(', ')}`:'';
    return `${c.id}: identity locked; wardrobe=${c.wardrobe||'preserve current'}; emotion=${c.emotion||'preserve current'}; gaze=${c.gazeTarget||'preserve current'}; posture=${c.posture||'preserve current'}; screen position=${c.screenPosition||'preserve current'}.${tattoos}`;
  }).join(' ');
  return `Sequence continuity authority for scene ${packet.sceneId}, revision ${packet.revision}. Location must remain ${packet.location}. Lighting=${packet.lighting||'preserve'}; time=${packet.timeOfDay||'preserve'}; weather=${packet.weather||'preserve'}; camera side=${packet.cameraSide||'preserve 180-degree rule'}. Props must remain spatially coherent: ${packet.props.join(', ')||'preserve all established props'}. ${people} Never reset identity, wardrobe, room geometry, tattoos, eyeline or emotional state between adjacent shots unless the story explicitly changes them.`;
}
