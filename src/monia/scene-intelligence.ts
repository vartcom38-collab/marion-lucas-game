export type MonIASceneType = 'visio'|'cinematic'|'gameplay_ambient'|'audio_call'|'phone_message'|'still_image'|'unknown';

export type MonIAScenePlanningInput = {
  request: string;
  explicitType?: MonIASceneType;
  characters?: string[];
  place?: string;
  time?: string;
  emotion?: string;
  relationshipState?: string;
  action?: string;
  wardrobeContext?: string;
};

export type MonIAReferencePlan = {
  character: string;
  requiredClasses: string[];
  preferredRoles: string[];
  sources: string[];
};

export type MonIAScenePlan = {
  type: MonIASceneType;
  confidence: number;
  reason: string[];
  cameraGrammar: string;
  references: MonIAReferencePlan[];
  hardReject: string[];
  context: Record<string,string>;
  valid: boolean;
  validationErrors: string[];
};

const SIGNALS: Record<Exclude<MonIASceneType,'unknown'>, string[]> = {
  visio: ['visio','video call','facetime','appel video','camera frontale','selfie call','front camera'],
  cinematic: ['cinematique','cinematic','mini drama','cutscene','plan serre','camera exterieure','moment important','scene intime'],
  gameplay_ambient: ['gameplay','vie libre','ambiance','idle','monde vivant','exploration','decor vivant','décor vivant'],
  audio_call: ['appel audio','audio call','telephone sans video','appel vocal','coup de fil'],
  phone_message: ['message','sms','texto','imessage','notification','chat'],
  still_image: ['photo','portrait','image fixe','still image'],
};

const TYPE_RULES: Record<Exclude<MonIASceneType,'unknown'>,{camera:string;required:string[];roles:string[];reject:string[]}> = {
  visio: {
    camera:'smartphone_front_camera',
    required:['identity','visio_camera','motion','performance'],
    roles:['face','gaze','micro_expression','gesture_rhythm','speech_presence','speech_rhythm'],
    reject:['visible_phone','external_camera','cinematic_portrait','tripod_look','dolly','cinematic_pan','generic_male_identity'],
  },
  cinematic: {
    camera:'external_cinematic_camera',
    required:['identity','motion'],
    roles:['identity','posture','body_movement','gesture','gaze','micro_expression'],
    reject:['front_camera_selfie_grammar_unless_story_requires_it','generic_male_identity'],
  },
  gameplay_ambient: {
    camera:'player_world_camera',
    required:[],roles:['posture','body_movement'],reject:['forced_cinematic_coverage'],
  },
  audio_call: {
    camera:'none',required:['performance'],roles:['speech_presence','speech_rhythm'],reject:['unrequested_video_generation'],
  },
  phone_message: {
    camera:'none',required:[],roles:[],reject:['unrequested_video_generation','unrequested_voice_generation'],
  },
  still_image: {
    camera:'photographic',required:['identity'],roles:['identity','face','gaze'],reject:['generic_male_identity'],
  },
};

function normalize(s:string){return s.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

function inferType(input:MonIAScenePlanningInput):{type:MonIASceneType;confidence:number;reason:string[]}{
  if(input.explicitType && input.explicitType !== 'unknown') return {type:input.explicitType,confidence:1,reason:['explicit_type']};
  const text=normalize([input.request,input.action,input.place,input.emotion].filter(Boolean).join(' '));
  const scores = Object.entries(SIGNALS).map(([type,signals])=>{
    let score=0;const hits:string[]=[];
    for(const signal of signals){
      const n=normalize(signal);
      if(text.includes(n)){
        score += n.includes(' ')?3:2;
        hits.push(signal);
      }
    }
    return {type:type as Exclude<MonIASceneType,'unknown'>,score,hits};
  }).sort((a,b)=>b.score-a.score);
  const top=scores[0]; const second=scores[1];
  if(!top || top.score===0) return {type:'unknown',confidence:.25,reason:['no_scene_signal']};
  const margin=top.score-(second?.score||0);
  const confidence=Math.min(.98,.56+top.score*.07+margin*.06);
  return {type:top.type,confidence,reason:top.hits.map(h=>`signal:${h}`)};
}

function inferCharacters(input:MonIAScenePlanningInput){
  if(input.characters?.length) return [...new Set(input.characters.map(x=>x.toLowerCase()))];
  const text=normalize([input.request,input.action].filter(Boolean).join(' '));
  const chars:string[]=[];
  if(text.includes('lucas')) chars.push('lucas');
  if(text.includes('marion')) chars.push('marion');
  return chars;
}

export function planMonIAScene(input:MonIAScenePlanningInput):MonIAScenePlan{
  const inferred=inferType(input);
  const chars=inferCharacters(input);
  const context:Record<string,string>={};
  for(const [k,v] of Object.entries({place:input.place,time:input.time,emotion:input.emotion,relationship_state:input.relationshipState,action:input.action,wardrobe_context:input.wardrobeContext})) if(v) context[k]=String(v);
  if(inferred.type==='unknown') return {type:'unknown',confidence:inferred.confidence,reason:inferred.reason,cameraGrammar:'unknown',references:[],hardReject:[],context,valid:false,validationErrors:['scene_type_uncertain']};
  const rule=TYPE_RULES[inferred.type];
  const references:MonIAReferencePlan[]=[];
  if(chars.includes('lucas')){
    const sources=['config/lucas-reference-bank.json'];
    if(inferred.type==='visio') sources.push('config/monia-visio-approved.json');
    if(inferred.type==='cinematic'||inferred.type==='gameplay_ambient') sources.push('config/motion-reference-bank.json');
    references.push({character:'lucas',requiredClasses:[...rule.required],preferredRoles:[...rule.roles],sources});
  }
  if(chars.includes('marion')) references.push({character:'marion',requiredClasses:rule.required.includes('identity')?['identity']:[],preferredRoles:rule.roles.filter(x=>x!=='speech_presence'&&x!=='speech_rhythm'),sources:['character_canon']});
  const errors:string[]=[];
  if(inferred.confidence<.58) errors.push('classification_confidence_too_low');
  if((inferred.type==='visio'||inferred.type==='cinematic'||inferred.type==='still_image')&&chars.length===0) errors.push('visual_scene_without_identified_character');
  return {type:inferred.type,confidence:inferred.confidence,reason:inferred.reason,cameraGrammar:rule.camera,references,hardReject:[...rule.reject],context,valid:errors.length===0,validationErrors:errors};
}

export function assertMonIAScenePlan(plan:MonIAScenePlan){
  if(!plan.valid) throw new Error(`MonIA scene plan rejected: ${plan.validationErrors.join(', ')}`);
  return plan;
}
