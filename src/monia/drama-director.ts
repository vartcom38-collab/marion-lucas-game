import type { MonIADirectorResult } from './director';
import type { MonIAScenePlan, MonIASceneType } from './scene-intelligence';

export type MonIAExperienceMode = 'ambient'|'micro_reaction'|'visio'|'cinematic'|'drama_sequence';

export type MonIADramaPlanningInput = {
  scenePlan: MonIAScenePlan;
  director?: MonIADirectorResult | null;
  request: string;
  relationship?: string;
  place?: string;
  time?: string;
  recentMemories?: string[];
  playerAgencyRequired?: boolean;
  surpriseAllowed?: boolean;
};

export type MonIADramaBeat = {
  id: string;
  purpose: 'entry_hook'|'context_anchor'|'human_action'|'emotional_turn'|'choice_pressure'|'consequence'|'exit';
  medium: MonIASceneType;
  seconds: number;
  description: string;
};

export type MonIADramaPlan = {
  mode: MonIAExperienceMode;
  intensity: 'low'|'medium'|'high';
  targetDuration: number;
  beats: MonIADramaBeat[];
  choices: string[];
  shouldPauseGameplay: boolean;
  resumeGameplayAfter: boolean;
  continuityKeys: string[];
  generationNotes: string[];
};

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}

function modeFor(type: MonIASceneType, request: string, director?: MonIADirectorResult | null): MonIAExperienceMode {
  const text = `${request} ${director?.scene?.action || ''}`.toLowerCase();
  if (type === 'visio') return 'visio';
  if (type === 'gameplay_ambient') return 'ambient';
  if (type === 'cinematic') {
    if (/drama|dispute|dispute|choc|surprise|révélation|revelation|important|tension|intime|émotion|emotion/.test(text)) return 'drama_sequence';
    return 'cinematic';
  }
  if (type === 'phone_message' || type === 'audio_call') return 'micro_reaction';
  return director?.scene ? 'cinematic' : 'micro_reaction';
}

function intensityFor(input: MonIADramaPlanningInput): 'low'|'medium'|'high' {
  const e = input.director?.emotion;
  if (e === 'intense' || e === 'worried') return 'high';
  if (e === 'tender' || e === 'playful' || e === 'focused') return 'medium';
  return 'low';
}

function baseDuration(mode: MonIAExperienceMode, director?: MonIADirectorResult | null): number {
  const requested = director?.scene?.duration || 0;
  if (requested) return clamp(requested, 4, mode === 'drama_sequence' ? 60 : 30);
  if (mode === 'ambient') return 7;
  if (mode === 'micro_reaction') return 5;
  if (mode === 'visio') return 10;
  if (mode === 'cinematic') return 12;
  return 24;
}

function choicesFor(input: MonIADramaPlanningInput): string[] {
  if (!input.playerAgencyRequired) return [];
  const actor = input.director?.actor || 'Lucas';
  return [
    `Répondre franchement à ${actor}`,
    'Rester plus réservée',
    'Changer légèrement de sujet',
  ];
}

export function planDramaExperience(input: MonIADramaPlanningInput): MonIADramaPlan {
  const mode = modeFor(input.scenePlan.type, input.request, input.director);
  const intensity = intensityFor(input);
  const targetDuration = baseDuration(mode, input.director);
  const beats: MonIADramaBeat[] = [];
  const sceneDescription = input.director?.scene?.action || input.request || 'moment de vie';
  const medium = input.scenePlan.type;

  if (mode === 'ambient') {
    beats.push({id:'ambient-life',purpose:'human_action',medium,seconds:targetDuration,description:'Animer subtilement le décor et les signes de vie sans interrompre la joueuse.'});
  } else if (mode === 'micro_reaction') {
    beats.push({id:'reaction',purpose:'human_action',medium,seconds:targetDuration,description:`Montrer une réaction humaine courte et lisible liée à: ${sceneDescription}`});
  } else {
    const entry = Math.max(2, Math.round(targetDuration * .18));
    const anchor = Math.max(2, Math.round(targetDuration * .16));
    const action = Math.max(2, Math.round(targetDuration * .24));
    const turn = Math.max(2, Math.round(targetDuration * .22));
    const exit = Math.max(2, targetDuration - entry - anchor - action - turn);
    beats.push(
      {id:'entry',purpose:'entry_hook',medium,seconds:entry,description:'Entrer immédiatement par un geste, un regard, un son ou une situation déjà en cours; pas de préambule explicatif.'},
      {id:'anchor',purpose:'context_anchor',medium,seconds:anchor,description:`Rendre lisibles le lieu, le moment et la relation sans exposition artificielle. ${input.place || ''} ${input.time || ''}`.trim()},
      {id:'action',purpose:'human_action',medium,seconds:action,description:sceneDescription},
      {id:'turn',purpose:'emotional_turn',medium,seconds:turn,description:`Créer une évolution émotionnelle ${intensity}, fondée sur le contexte réel et non sur un drama inventé.`},
      {id:'exit',purpose:'exit',medium,seconds:exit,description:'Finir sur une conséquence lisible puis rendre la main au gameplay, sauf si un choix joueur est nécessaire.'},
    );
  }

  const choices = choicesFor(input);
  if (choices.length && beats.length > 1) {
    beats.splice(beats.length - 1, 0, {
      id:'choice',
      purpose:'choice_pressure',
      medium,
      seconds:3,
      description:'Suspendre juste assez le moment pour laisser Marion agir; MonIA ne décide pas sa réponse à sa place.',
    });
  }

  return {
    mode,
    intensity,
    targetDuration,
    beats,
    choices,
    shouldPauseGameplay: mode === 'visio' || mode === 'cinematic' || mode === 'drama_sequence',
    resumeGameplayAfter: true,
    continuityKeys:['location','time','wardrobe','relationship','recent_dialogue','physical_position','held_objects','visible_injuries'],
    generationNotes:[
      'Preserve canonical identity and voice.',
      'Use the camera grammar from scenePlan exactly.',
      'Do not manufacture infidelity, danger or misunderstanding merely to create a cliffhanger.',
      'If consecutive generated shots belong to one event, preserve spatial, lighting, wardrobe and emotional continuity.',
      input.surpriseAllowed ? 'A surprise may emerge only from plausible current-state information.' : 'Do not introduce an unrequested surprise.',
    ],
  };
}
