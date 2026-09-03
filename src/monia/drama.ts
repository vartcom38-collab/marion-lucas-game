import { MARION_LUCAS_PROFILE, type MonIACompactContext } from './profile';

export type DramaShotSize = 'extreme-close' | 'close' | 'medium-close' | 'medium' | 'two-shot' | 'detail';
export type DramaCameraMove = 'locked' | 'slow-push' | 'slow-pull' | 'handheld-soft' | 'pan-soft';
export type DramaTransition = 'cut' | 'reaction-cut' | 'match-cut' | 'hold';
export type MonIARenderMode = 'true_video_required' | 'video_optional' | 'no_video';

export type MonIADramaRequest = {
  title?: string;
  context: MonIACompactContext;
  premise: string;
  actors: string[];
  targetDuration?: number;
  format?: '9:16' | '16:9';
  availableMedia?: string[];
  renderMode?: MonIARenderMode;
};

export type MonIADramaShot = {
  id: string;
  duration: number;
  shotSize: DramaShotSize;
  cameraMove: DramaCameraMove;
  actors: string[];
  focusActor: string;
  emotion: string;
  action: string;
  dialogue: string;
  reaction: string;
  lighting: string;
  continuity: string;
  transition: DramaTransition;
  generationPrompt: string;
};

export type MonIADramaPlan = {
  title: string;
  format: '9:16' | '16:9';
  targetDuration: number;
  rhythm: 'tense' | 'intimate' | 'romantic' | 'quiet' | 'playful';
  location: string;
  continuityAnchor: string;
  shots: MonIADramaShot[];
  voiceLines: { actor: string; text: string; emotion: string; shotId: string }[];
  source: 'local' | 'fallback';
  renderMode: MonIARenderMode;
};

const shotSizes = new Set<DramaShotSize>(['extreme-close','close','medium-close','medium','two-shot','detail']);
const moves = new Set<DramaCameraMove>(['locked','slow-push','slow-pull','handheld-soft','pan-soft']);
const transitions = new Set<DramaTransition>(['cut','reaction-cut','match-cut','hold']);
const rhythms = new Set<MonIADramaPlan['rhythm']>(['tense','intimate','romantic','quiet','playful']);

function clampDuration(value: unknown, min = 1.5, max = 8) {
  const n = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 3));
}

export function fallbackDramaPlan(request: MonIADramaRequest): MonIADramaPlan {
  const actors = request.actors.length ? request.actors : ['Lucas'];
  const focus = actors.includes('Lucas') ? 'Lucas' : actors[0];
  const location = request.context.place || 'Lieu actuel';
  const renderMode = request.renderMode || 'true_video_required';
  const mk = (id:string, duration:number, shotSize:DramaShotSize, actor:string, action:string, dialogue:string, transition:DramaTransition):MonIADramaShot => ({
    id,duration,shotSize,cameraMove:shotSize==='close'?'slow-push':'locked',actors:[actor],focusActor:actor,
    emotion:'contained',action,dialogue,reaction:'micro-expression naturelle, regard lisible',
    lighting:'lumière cinématographique réaliste cohérente avec l’heure',
    continuity:`Même visage canonique, même tenue, même coiffure et même décor que les plans précédents à ${location}.`,transition,
    generationPrompt:`Photorealistic cinematic micro-drama, ${request.format || '9:16'}, ${location}, ${actor}, canonical identity preserved, real human motion, breathing, blinking, subtle head movement, ${shotSize} shot, ${action}, natural micro-expressions, realistic skin, subtle camera movement, coherent lighting and wardrobe, no text, no watermark, true video only.`
  });
  const shots = [
    mk('s1',3,'medium-close',focus,`${focus} absorbe le moment avant de parler`,'','cut'),
    mk('s2',3,'close',focus,`${focus} répond avec une émotion retenue`,'Je t’écoute.','reaction-cut'),
    mk('s3',2.5,'detail',focus,'un bref silence laisse passer la réaction','','cut'),
    mk('s4',3.5,'close',focus,`${focus} soutient le regard, sans surjouer`,'','hold'),
  ];
  return {title:request.title || 'Micro-drama',format:request.format || '9:16',targetDuration:shots.reduce((a,s)=>a+s.duration,0),rhythm:'intimate',location,continuityAnchor:`${location} · J${request.context.day} ${request.context.time}`,shots,voiceLines:shots.filter(s=>s.dialogue).map(s=>({actor:s.focusActor,text:s.dialogue,emotion:s.emotion,shotId:s.id})),source:'fallback',renderMode};
}

export function dramaPrompt(request: MonIADramaRequest) {
  const target = Math.max(12, Math.min(60, request.targetDuration || 28));
  const format = request.format || '9:16';
  const renderMode = request.renderMode || 'true_video_required';
  return `Tu es MonIA Drama Director. Tu construis un storyboard VIDEO générable plan par plan pour Marion & Lucas.\n\nRÉFÉRENCE DE GRAMMAIRE VISUELLE: mini-drama vertical photoréaliste, alternance de gros plans émotionnels, plans poitrine, champ/contrechamp, inserts de détail, micro-silences, réactions lisibles, raccords rapides mais propres. Le montage crée la tension; aucun plan ne doit être inutile. Ne copie aucune scène existante.\n\nRéponds UNIQUEMENT avec un JSON valide sans markdown:\n{"title":"...","format":"${format}","targetDuration":${target},"rhythm":"intimate","location":"...","continuityAnchor":"...","shots":[{"id":"s1","duration":3,"shotSize":"close","cameraMove":"slow-push","actors":["Lucas"],"focusActor":"Lucas","emotion":"...","action":"...","dialogue":"...","reaction":"...","lighting":"...","continuity":"...","transition":"reaction-cut","generationPrompt":"..."}],"voiceLines":[{"actor":"Lucas","text":"...","emotion":"...","shotId":"s1"}]}\n\nRÈGLES DE PRODUCTION:\n- 4 à 12 plans. Total visé ${target}s. Chaque plan 1.5 à 8s.\n- shotSize: extreme-close, close, medium-close, medium, two-shot ou detail.\n- cameraMove: locked, slow-push, slow-pull, handheld-soft ou pan-soft.\n- transition: cut, reaction-cut, match-cut ou hold.\n- Réserver les gros plans aux émotions/réactions importantes.\n- Un dialogue court doit avoir une réaction avant ou après; ne jamais aligner uniquement des personnages qui parlent.\n- generationPrompt est en anglais, autonome et utilisable par un moteur vidéo. Il décrit identité canonique conservée, cadrage, action, expression, caméra, lumière, décor, continuité tenue/coiffure; no text, no watermark.\n- Le plan DOIT décrire du mouvement humain réel : respiration, clignements, micro-mouvements de tête, regard, posture ou geste crédible.\n- Maintenir strictement mêmes visages, âges, cheveux, vêtements et géographie d’un plan au suivant.\n- Ne jamais inventer une apparence canonique différente de Marion ou Lucas.\n- Ne jamais inventer un événement futur important, une trahison, une infidélité ou un tournant majeur absent du contexte. Lucas reste absolument fidèle.\n- Ne jamais décider ce que Marion choisit ou ressent si ce n’est pas fourni par le contexte; montrer seulement les réactions déjà justifiées.\n- Le contenu doit rester une conséquence immédiate de PREMISE et CONTEXTE.\n- Pas de texte incrusté dans les images; les sous-titres seront ajoutés au montage.\n- MODE DE RENDU=${renderMode}. Si true_video_required, aucune image fixe, aucun zoom Ken Burns, aucune planche découpée ne peut être considéré comme rendu final.\n\nPROFIL=${JSON.stringify(MARION_LUCAS_PROFILE)}\nPREMISE=${JSON.stringify(request.premise)}\nACTEURS=${JSON.stringify(request.actors)}\nMEDIAS=${JSON.stringify(request.availableMedia || [])}\nCONTEXTE=${JSON.stringify(request.context)}`;
}

export function parseDramaJSON(raw: string, fallback: MonIADramaPlan): MonIADramaPlan | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(v?.shots)) return null;
    const shots: MonIADramaShot[] = v.shots.slice(0,12).map((s:any, index:number) => ({
      id: typeof s?.id === 'string' && s.id ? s.id.slice(0,20) : `s${index+1}`,
      duration: clampDuration(s?.duration),
      shotSize: shotSizes.has(s?.shotSize) ? s.shotSize : 'close',
      cameraMove: moves.has(s?.cameraMove) ? s.cameraMove : 'locked',
      actors: Array.isArray(s?.actors) ? s.actors.map(String).slice(0,3) : [],
      focusActor: String(s?.focusActor || fallback.shots[0]?.focusActor || 'Lucas').slice(0,50),
      emotion: String(s?.emotion || 'contained').slice(0,100),
      action: String(s?.action || '').slice(0,300),
      dialogue: String(s?.dialogue || '').slice(0,240),
      reaction: String(s?.reaction || '').slice(0,220),
      lighting: String(s?.lighting || '').slice(0,220),
      continuity: String(s?.continuity || '').slice(0,300),
      transition: transitions.has(s?.transition) ? s.transition : 'cut',
      generationPrompt: String(s?.generationPrompt || '').slice(0,900),
    })).filter((s:MonIADramaShot) => s.action || s.dialogue || s.generationPrompt);
    if (shots.length < 4) return null;
    const format: '9:16'|'16:9' = v?.format === '16:9' ? '16:9' : '9:16';
    const targetDuration = Math.max(12, Math.min(60, shots.reduce((sum,s)=>sum+s.duration,0)));
    const voiceLines = shots.filter(s=>s.dialogue).map(s=>({actor:s.focusActor,text:s.dialogue,emotion:s.emotion,shotId:s.id}));
    return {
      title: String(v?.title || fallback.title).slice(0,100),
      format,
      targetDuration,
      rhythm: rhythms.has(v?.rhythm) ? v.rhythm : fallback.rhythm,
      location: String(v?.location || fallback.location).slice(0,140),
      continuityAnchor: String(v?.continuityAnchor || fallback.continuityAnchor).slice(0,220),
      shots,
      voiceLines,
      source:'local',
      renderMode:fallback.renderMode,
    };
  } catch {
    return null;
  }
}