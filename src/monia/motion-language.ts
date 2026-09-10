export type LucasMotionProfile={
  id:string;
  tags:string[];
  aliases?:string[];
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
    aliases:['protecteur','proche','tension','voiture','duo'],
    direction:'Lucas keeps the torso steady and protective, shoulders controlled, gaze fixed then briefly lowered; one restrained hand/arm movement toward the other person, small jaw tension, natural breathing, no theatrical flailing.',
    avoid:['copy_reference_face','copy_coactor','copy_tattoos','copy_wardrobe','overacting','aggressive_grabbing']
  },
  {
    id:'private-soft-reaction',
    tags:['tender','reaction','listening','micro_expression','closeup'],
    aliases:['tendre','reaction','ecoute','visio','regard','sourire'],
    direction:'Lucas listens before reacting: eyes move first, then a tiny head turn; expression softens slowly, restrained half-smile or exhale, subtle brow movement and realistic blink timing.',
    avoid:['copy_reference_face','copy_coactor','fixed_smile','robotic_blink','exaggerated_nod']
  },
  {
    id:'formal-room-presence',
    tags:['formal','standing','social_scene','composed','reaction'],
    aliases:['formel','debout','public','reception','calme','compose'],
    direction:'Lucas has a calm grounded presence in a social room: upright but relaxed posture, economical turns of the head, measured eye contact, hands mostly still, short reaction beats before speaking or moving.',
    avoid:['copy_reference_face','copy_coactor','copy_wardrobe','runway_pose','constant_motion']
  },
  {
    id:'everyday-table-behaviour',
    tags:['everyday','table','eating','domestic','natural'],
    aliases:['quotidien','repas','manger','maison','domestique','naturel'],
    direction:'Use ordinary unscripted timing: glance to the other person, look down to the object or food, small hand movement, swallow/breathe, return gaze; actions overlap slightly rather than happening one by one like animation cues.',
    avoid:['copy_reference_face','copy_coactor','copy_props_exactly','mechanical_sequence','perfect_symmetry']
  },
  {
    id:'quiet-emotional-care',
    tags:['care','quiet','tender','close_proximity','hand_contact'],
    aliases:['soin','rassurer','doux','silence','contact','reconfort'],
    direction:'Lucas approaches slowly and checks the other person with his eyes before touching; hand contact is careful and light, fingers settle naturally, posture softens, gaze alternates between face and contact point, emotion stays contained.',
    avoid:['copy_reference_face','copy_coactor','copy_tattoos','sexualized_motion','forceful_contact','melodramatic_crying']
  },
  {
    id:'intimate-proximity-with-restraint',
    tags:['romantic','tender','intimate','proximity','chemistry'],
    aliases:['romantique','tendre','intime','proximite','chimie','amoureux'],
    direction:'Build chemistry through distance changes rather than big gestures: small lean-in, pause, eye contact, breath, slight head angle and hand placement that remains gentle; hold micro-pauses so the moment feels human and not choreographed.',
    avoid:['copy_reference_face','copy_coactor','copy_body_identity','copy_tattoos','explicit_sexual_action','instant_kiss_loop','overacting']
  },
  {
    id:'cinematic-reaction-rhythm',
    tags:['cinematic','reaction','closeup','tension','dialogue'],
    aliases:['cinematique','reaction','gros plan','tension','dialogue','silence'],
    direction:'Reaction rhythm should read before dialogue: 0.3–1.0s observation beat, small eye change, breath or jaw release, then speech/action. Preserve uneven human timing and occasional stillness.',
    avoid:['copy_reference_face','copy_coactor','constant_head_motion','rubbery_mouth','perfectly_timed_blinks']
  },
  {
    id:'face-touch-tender-approach',
    tags:['romantic','face_touch','tender','approach','close_proximity','chemistry'],
    aliases:['caresse visage','toucher visage','approche','tendre','proximite','romantique'],
    direction:'For a tender face-contact beat, Lucas closes distance slowly, checks consent through eye contact and a micro-pause, lifts the hand without sudden acceleration, settles fingertips lightly near cheek or jaw, then keeps the body still enough for the emotion to read.',
    avoid:['copy_reference_face','copy_coactor','copy_body_identity','copy_tattoos','forceful_face_grab','instant_contact','sexualized_motion']
  },
  {
    id:'protective-parent-child-calm',
    tags:['family','child','protective','care','parent_child','gentle'],
    aliases:['famille','enfant','pere','protecteur','doux','porter enfant','parent'],
    direction:'With a child, Lucas moves with slower acceleration and stable support: torso turns before the arms, hands secure without squeezing, gaze checks the child frequently, posture stays protective and calm, and transitions avoid abrupt or playful jolts unless explicitly requested.',
    avoid:['copy_reference_face','copy_child_identity','copy_coactor','unsafe_child_motion','rough_handling','adult_romantic_gesture']
  },
  {
    id:'emotion-object-reaction',
    tags:['emotion','object','gift','reaction','closeup','quiet'],
    aliases:['emotion','objet','cadeau','reaction','gros plan','souvenir'],
    direction:'When an object carries emotion, Lucas looks to it first, pauses, lets the eyes and breath change before the hands move, touches or turns the object with small precise motion, then returns gaze to the other person. The object should support the reaction rather than trigger exaggerated acting.',
    avoid:['copy_reference_face','copy_prop_exactly','copy_coactor','overacting','constant_fidgeting','instant_smile']
  },
  {
    id:'contained-formal-tension',
    tags:['formal','tension','public','standing','controlled','social_scene'],
    aliases:['formel','tension contenue','public','debout','controle','social'],
    direction:'In a formal or public tense moment, Lucas stays physically economical: weight shifts subtly, chin and eyes lead attention changes, hands remain controlled, breath and jaw carry tension, and any step toward another person is deliberate rather than aggressive.',
    avoid:['copy_reference_face','copy_coactor','copy_wardrobe','pacing','aggressive_posture','theatrical_gestures']
  }
];

function norm(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(v:string){return new Set(norm(v).split(/\s+/).filter(Boolean))}

export function selectLucasMotionDirections(input:{intent:string;tags?:string[];limit?:number}){
  const haystack=norm(`${input.intent} ${(input.tags||[]).join(' ')}`);
  const words=tokens(haystack);
  const scored=LUCAS_MOTION_LANGUAGE.map(profile=>{
    const phrases=[...profile.tags,...(profile.aliases||[])].map(norm).filter(Boolean);
    let score=0;
    for(const phrase of phrases){
      if(haystack.includes(phrase))score+=phrase.includes(' ')?4:2;
      for(const word of phrase.split(/\s+/)){if(word.length>2&&words.has(word))score+=1;}
    }
    return {profile,score};
  }).sort((a,b)=>b.score-a.score);
  const chosen=scored.filter(x=>x.score>0).slice(0,input.limit||3).map(x=>x.profile);
  const fallback=['private-soft-reaction','cinematic-reaction-rhythm']
    .map(id=>LUCAS_MOTION_LANGUAGE.find(x=>x.id===id))
    .filter((x):x is LucasMotionProfile=>Boolean(x));
  return (chosen.length?chosen:fallback).map(x=>`${x.id}: ${x.direction} AVOID=${x.avoid.join(',')}`);
}
