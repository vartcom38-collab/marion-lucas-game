export type MonIASceneRoute =
  | 'message-only'
  | 'visio'
  | 'lucas-solo-drama'
  | 'couple-drama'
  | 'family-drama'
  | 'environment-beat';

export type SceneRouteInput = {
  place?: string;
  time?: string;
  relationship?: number;
  trust?: number;
  chemistry?: number;
  official?: boolean;
  engaged?: boolean;
  married?: boolean;
  children?: number;
  recentMessages?: string[];
  recentEvents?: string[];
  memories?: string[];
};

export type SceneRouteDecision = {
  route: MonIASceneRoute;
  reason: string;
  physicalCoPresence: boolean;
  familyContext: boolean;
  intimacyLevel: 'none' | 'soft' | 'close' | 'intense';
  preferredShotGrammar: string[];
};

function text(input: SceneRouteInput) {
  return [...(input.recentMessages || []), ...(input.recentEvents || []), ...(input.memories || [])]
    .join(' · ')
    .toLowerCase();
}

function explicitCoPresence(input: SceneRouteInput, haystack: string) {
  const place = (input.place || '').toLowerCase();
  if (/estate|finca|family/.test(place) && /ensemble|avec lucas|lucas est là|lucas arrive|lucas rentre|retrouv/.test(haystack)) return true;
  return /ensemble au même endroit|dans la même pièce|à côté de lucas|avec lucas|lucas est là|lucas arrive|lucas rentre|ils se retrouvent|retrouvent lucas/.test(haystack);
}

export function routeSceneFromGameState(input: SceneRouteInput): SceneRouteDecision {
  const haystack = text(input);
  const coPresence = explicitCoPresence(input, haystack);
  const familyContext = Number(input.children || 0) > 0 && /enfant|bébé|fille|fils|famille|parent/.test(haystack);
  const relation = Number(input.relationship || 0);
  const chemistry = Number(input.chemistry || 0);
  const remoteSignal = /appel|visio|facetime|vidéo|téléphone|phone|distance|loin|madrid.*nîmes|nîmes.*madrid/.test(haystack);
  const soloSignal = /corrida|arène|entraînement|training|travail|vestiaire|hôtel|seul|lucas seul/.test(haystack);
  const intimateSignal = /baiser|embrass|main|toucher|proximité|contre lui|contre elle|regard|silence|tension|désir|manque/.test(haystack);

  let intimacyLevel: SceneRouteDecision['intimacyLevel'] = 'none';
  if (relation >= 70 || chemistry >= 75) intimacyLevel = 'intense';
  else if (relation >= 45 || chemistry >= 50) intimacyLevel = 'close';
  else if (relation >= 20 || intimateSignal) intimacyLevel = 'soft';

  if (familyContext && coPresence) {
    return {
      route: 'family-drama',
      reason: 'Contexte familial explicite avec co-présence confirmée.',
      physicalCoPresence: true,
      familyContext: true,
      intimacyLevel,
      preferredShotGrammar: ['medium', 'full', 'wide', 'detail', 'close'],
    };
  }

  if (coPresence) {
    return {
      route: 'couple-drama',
      reason: 'Marion et Lucas sont explicitement présents ensemble dans le contexte.',
      physicalCoPresence: true,
      familyContext: false,
      intimacyLevel,
      preferredShotGrammar: intimateSignal ? ['two-shot', 'medium', 'detail', 'close', 'full'] : ['medium', 'two-shot', 'full', 'close'],
    };
  }

  if (remoteSignal) {
    return {
      route: 'visio',
      reason: 'Interaction distante ou appel explicitement indiqué.',
      physicalCoPresence: false,
      familyContext: false,
      intimacyLevel,
      preferredShotGrammar: ['close', 'medium-close', 'detail'],
    };
  }

  if (soloSignal) {
    return {
      route: 'lucas-solo-drama',
      reason: 'Moment de vie de Lucas explicite sans co-présence de Marion.',
      physicalCoPresence: false,
      familyContext: false,
      intimacyLevel: 'none',
      preferredShotGrammar: ['wide', 'full', 'medium', 'close', 'detail'],
    };
  }

  if (/lieu|appartement|fenêtre|ville|nuit|matin|pluie|soleil|ambiance/.test(haystack)) {
    return {
      route: 'environment-beat',
      reason: 'Le contexte soutient une respiration visuelle du monde plutôt qu’une scène personnage.',
      physicalCoPresence: false,
      familyContext: false,
      intimacyLevel: 'none',
      preferredShotGrammar: ['wide', 'detail', 'medium'],
    };
  }

  return {
    route: 'message-only',
    reason: 'Pas assez d’indices fiables pour imposer une scène vidéo sans inventer de présence.',
    physicalCoPresence: false,
    familyContext: false,
    intimacyLevel,
    preferredShotGrammar: [],
  };
}
