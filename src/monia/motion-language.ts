export type LucasMotionProfile={
  id:string;
  tags:string[];
  direction:string;
  avoid:string[];
};

/**
 * Motion-only vocabulary distilled from user-provided reference videos.
 * IMPORTANT: these profiles never authorize copying an actor's face, body identity,
 * wardrobe, tattoos, scars or co-actor appearance. Lucas canon remains authoritative.
 */
export const LUCAS_MOTION_LANGUAGE:LucasMotionProfile[]=[
  {
    id:'restrained-protective-close',
    tags:['protective','close_proximity','tension','car','two_person'],
    direction:'Lucas keeps the torso steady and protective, shoulders controlled, gaze fixed then briefly lowered; one restrained hand/arm movement toward the other person, small jaw tension, natural breathing, no theatrical flailing.',
    avoid:['copy_reference_face','copy_coactor','copy_tattoos','copy_wardrobe','overacting','aggressive_grabbing']
  },
  {
    id:'private-soft-reaction',
    tags:['tender','reaction','listening','micro_expression','closeup'],
    direction:'Lucas listens before reacting: eyes move first, then a tiny head turn; expression softens slowly, restrained half-smile or exhale, subtle brow movement and realistic blink timing.',
    avoid:['copy_reference_face','copy_coactor','fixed_smile','robotic_blink','exaggerated_nod']
  },
  {
    id:'formal-room-presence',
    tags:['formal','standing','social_scene','composed','reaction'],
    direction:'Lucas has a calm grounded presence in a social room: upright but relaxed posture, economical turns of the head, measured eye contact, hands mostly still, short reaction beats before speaking or moving.',
    avoid:['copy_reference_face','copy_coactor','copy_wardrobe','runway_pose','constant_motion']
  },
  {
    id:'everyday-table-behaviour',
    tags:['everyday','table','eating','domestic','natural'],
    direction:'Use ordinary unscripted timing: glance to the other person, look down to the object or food, small hand movement, swallow/breathe, return gaze; actions overlap slightly rather than happening one by one like animation cues.',
    avoid:['copy_reference_face','copy_coactor','copy_props_exactly','mechanical_sequence','perfect_symmetry']
  },
  {
    id:'quiet-emotional-care',
    tags:['care','quiet','tender','close_proximity','hand_contact'],
    direction:'Lucas approaches slowly and checks the other person with his eyes before touching; hand contact is careful and light, fingers settle naturally, posture softens, gaze alternates between face and contact point, emotion stays contained.',
    avoid:['copy_reference_face','copy_coactor','copy_tattoos','sexualized_motion','forceful_contact','melodramatic_crying']
  },
  {
    id:'intimate-proximity-with-restraint',
    tags:['romantic','tender','intimate','proximity','chemistry'],
    direction:'Build chemistry through distance changes rather than big gestures: small lean-in, pause, eye contact, breath, slight head angle and hand placement that remains gentle; hold micro-pauses so the moment feels human and not choreographed.',
    avoid:['copy_reference_face','copy_coactor','copy_body_identity','copy_tattoos','explicit_sexual_action','instant_kiss_loop','overacting']
  },
  {
    id:'cinematic-reaction-rhythm',
    tags:['cinematic','reaction','closeup','tension','dialogue'],
    direction:'Reaction rhythm should read before dialogue: 0.3–1.0s observation beat, small eye change, breath or jaw release, then speech/action. Preserve uneven human timing and occasional stillness.',
    avoid:['copy_reference_face','copy_coactor','constant_head_motion','rubbery_mouth','perfectly_timed_blinks']
  }
];

function norm(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}

export function selectLucasMotionDirections(input:{intent:string;tags?:string[];limit?:number}){
  const words=new Set(norm(`${input.intent} ${(input.tags||[]).join(' ')}`).split(/\s+/).filter(Boolean));
  const scored=LUCAS_MOTION_LANGUAGE.map(profile=>({
    profile,
    score:profile.tags.reduce((sum,tag)=>sum+(words.has(norm(tag))?2:0),0)+profile.tags.reduce((sum,tag)=>sum+(norm(input.intent).includes(norm(tag))?1:0),0)
  })).sort((a,b)=>b.score-a.score);
  const chosen=scored.filter(x=>x.score>0).slice(0,input.limit||3).map(x=>x.profile);
  return (chosen.length?chosen:LUCAS_MOTION_LANGUAGE.slice(0,2)).map(x=>`${x.id}: ${x.direction} AVOID=${x.avoid.join(',')}`);
}
