import { selectLucasMotionDirections } from './motion-language';
import { buildVisioVariation } from './visio-variation';

export type LucasVisioState='listening'|'speaking'|'reaction'|'thinking';
export type LucasVisioMood='neutral'|'tender'|'playful'|'worried'|'hurt'|'distant'|'intense'|'relieved';

export type LucasVisioContext={
  state:LucasVisioState;
  mood?:LucasVisioMood;
  place?:string;
  timeOfDay?:string;
  relationship?:string;
  recentBeat?:string;
  outfitHint?:string;
  backgroundHint?:string;
};

const stateDirection:Record<LucasVisioState,string>={
  listening:'quiet attentive listening, closed mouth, tiny gaze shifts, natural blink timing, subtle breathing, no speech',
  speaking:'natural conversational speech, small jaw/lip motion, occasional eyebrow and head movement, believable breathing, no exaggerated lip sync',
  reaction:'silent emotional reaction, eyes respond first, tiny breath, restrained expression change, then settle naturally',
  thinking:'brief reflective pause, gaze softens or drops slightly, small breath, minimal movement before returning attention to camera'
};

const moodDirection:Record<LucasVisioMood,string>={
  neutral:'calm and grounded, understated expression',
  tender:'soft eyes, restrained warmth, slight affectionate half-smile only when natural',
  playful:'subtle teasing energy, tiny asymmetric smile, lively eyes without overacting',
  worried:'focused eyes, slightly tenser brow and jaw, protective concern, no melodrama',
  hurt:'quieter gaze, controlled disappointment, small pauses, emotion kept contained',
  distant:'more reserved posture and expression, less direct warmth, controlled eye contact',
  intense:'steady gaze, contained tension, economical movement, strong presence without aggression',
  relieved:'soft exhale, jaw and brow release, warmth returning gradually'
};

function clean(value?:string){return (value||'').trim()}

export function buildAdaptiveLucasVisioPrompt(context:LucasVisioContext){
  const mood=context.mood||'neutral';
  const intent=[context.state,mood,context.relationship,context.recentBeat,context.place,context.timeOfDay].filter(Boolean).join(' · ');
  const motion=selectLucasMotionDirections({
    intent,
    tags:['visio',context.state,mood,'closeup','natural',context.relationship||'',context.recentBeat||''].filter(Boolean),
    limit:3
  });
  const variation=buildVisioVariation(context);

  const scene=[
    clean(context.place)&&`PLACE: ${clean(context.place)}`,
    clean(context.timeOfDay)&&`TIME: ${clean(context.timeOfDay)}`,
    clean(context.backgroundHint)&&`BACKGROUND HINT: ${clean(context.backgroundHint)}`,
    clean(context.outfitHint)&&`OUTFIT HINT: ${clean(context.outfitHint)}`,
    clean(context.relationship)&&`RELATIONSHIP CONTEXT: ${clean(context.relationship)}`,
    clean(context.recentBeat)&&`RECENT CONTEXT: ${clean(context.recentBeat)}`
  ].filter(Boolean).join(' ');

  return [
    'Photorealistic live smartphone video-call candidate featuring the exact canonical Lucas identity.',
    'Lucas identity is fixed: preserve the approved face geometry, very light green-gray/hazel eyes, eyebrows, nose, mouth, jaw, dark wavy hair, stubble, skin tone and age continuity. Lucas has no tattoos and no facial scar.',
    'Preserve the approved Lucas physical presence as well: masculine athletic-natural build, grounded shoulders, believable neck/chest proportions and calm contained posture. Male motion references may guide silhouette, posture, body mechanics and spatial presence when compatible with the canon, but must never replace Lucas identity.',
    `STATE: ${stateDirection[context.state]}.`,
    `MOOD: ${moodDirection[mood]}.`,
    scene,
    `VARIATION SIGNATURE: ${variation.signature}.`,
    `FRAMING: ${variation.framing}.`,
    `LIGHTING: ${variation.lighting}.`,
    `SCENE VARIATION: ${variation.background}.`,
    `MICRO ACTION: ${variation.microAction}.`,
    `PERFORMANCE LANGUAGE: ${motion.join(' | ')}`,
    'Every visio must adapt naturally to current story context, time, place, relationship, recent events and emotion. Do not reuse one identical expression, pose, background, lighting setup or rhythm for every call.',
    'Reference videos may inform Lucas body mechanics, posture, walking/leaning/contact style, gesture timing, gaze, pauses and micro-reactions. Never import another actor identity, another face, tattoos, scars, distinctive wardrobe or the identity/appearance of a co-actor. A woman in a reference is not Marion unless Marion canon is explicitly supplied.',
    'Keep smartphone-call realism: front-camera framing, tiny handheld imperfections, natural breathing, irregular blink rhythm, subtle eye-line changes, realistic skin and lighting.',
    'For romantic/intimate beats, use contained chemistry through distance, eye contact, breathing, hand placement and micro-pauses; keep it non-explicit and natural.',
    'No identity drift, no morphing, no exaggerated mouth motion, no robotic blink rhythm, no text, no subtitles, no watermark, no fake zoom.'
  ].filter(Boolean).join(' ');
}
