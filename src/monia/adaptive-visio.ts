import { selectLucasMotionDirections } from './motion-language';

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

  const scene=[
    clean(context.place)&&`PLACE: ${clean(context.place)}`,
    clean(context.timeOfDay)&&`TIME: ${clean(context.timeOfDay)}`,
    clean(context.backgroundHint)&&`BACKGROUND: ${clean(context.backgroundHint)}`,
    clean(context.outfitHint)&&`OUTFIT: ${clean(context.outfitHint)}`,
    clean(context.relationship)&&`RELATIONSHIP CONTEXT: ${clean(context.relationship)}`,
    clean(context.recentBeat)&&`RECENT CONTEXT: ${clean(context.recentBeat)}`
  ].filter(Boolean).join(' ');

  return [
    'Photorealistic live smartphone video-call candidate featuring the exact canonical Lucas identity.',
    'Lucas identity is fixed: preserve the approved face geometry, eyes, eyebrows, nose, mouth, jaw, hair, stubble, skin tone and age continuity. Lucas has no tattoos and no facial scar.',
    `STATE: ${stateDirection[context.state]}.`,
    `MOOD: ${moodDirection[mood]}.`,
    scene,
    `MOTION LANGUAGE: ${motion.join(' | ')}`,
    'Every visio must adapt naturally to current story context, time, place, relationship, recent events and emotion. Do not reuse one identical expression, pose, background or rhythm for every call.',
    'Motion references are gesture/timing references only. Never copy any reference actor or co-actor identity, face, body identity, wardrobe, tattoos, scars or distinctive appearance.',
    'Keep smartphone-call realism: front-camera framing, tiny handheld imperfections, natural breathing, irregular blink rhythm, subtle eye-line changes, realistic skin and lighting.',
    'No identity drift, no morphing, no exaggerated mouth motion, no robotic blink rhythm, no text, no subtitles, no watermark, no fake zoom.'
  ].filter(Boolean).join(' ');
}
