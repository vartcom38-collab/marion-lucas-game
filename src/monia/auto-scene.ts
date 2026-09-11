import { monia } from './runtime';
import type { MonIADirectorResult } from './director';
import { routeSceneFromGameState } from './scene-context-router';
import { planDrama } from './drama-planner';
import { setLucasVisioContext } from './visio-state-media';
import { queueDramaPlan } from './scene-generation-queue';

const SAVE_KEY = 'marion-lucas-save-v4';
const STATE_KEY = 'monia-auto-scene-state-v1';
const SURPRISE_AFTERGLOW_GAME_MINUTES = 90;

type Message = { from: string; text: string; day: number; read: boolean };
type LooseSave = {
  day?: number;
  time?: string;
  place?: string;
  relationship?: number;
  trust?: number;
  chemistry?: number;
  metLucas?: boolean;
  official?: boolean;
  engaged?: boolean;
  married?: boolean;
  children?: number;
  memories?: string[];
  eventHistory?: string[];
  messages?: Message[];
  flags?: Record<string, string | number | boolean>;
};

type AutoState = {
  signature: string;
  lastSceneDay: number;
  lastSceneMinute: number;
  lastRelationshipBand: number;
};

const placeLabels: Record<string, string> = {
  home: 'Appartement de Marion à Nîmes',
  nimes: 'Nîmes',
  cafe: 'Café à Nîmes',
  arenes: 'Arènes de Nîmes',
  station: 'Gare',
  madrid: 'Madrid',
  family: 'Maison familiale',
  finca: 'Finca liée au travail de Lucas',
  estate: 'Propriété du couple en Espagne',
};

function readSave(): LooseSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as LooseSave : null;
  } catch {
    return null;
  }
}

function writeSave(save: LooseSave) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* optional */ }
}

function readState(): AutoState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as AutoState;
  } catch { /* optional */ }
  return { signature: '', lastSceneDay: -1, lastSceneMinute: -9999, lastRelationshipBand: 0 };
}

function writeState(state: AutoState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* optional */ }
}

function minutes(time = '00:00') {
  const [h, m] = time.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function gameMinute(save: LooseSave) {
  return Number(save.day || 0) * 1440 + minutes(save.time);
}

function relationBand(value = 0) {
  if (value >= 70) return 4;
  if (value >= 45) return 3;
  if (value >= 25) return 2;
  if (value >= 10) return 1;
  return 0;
}

function relationLabel(value = 0) {
  if (value >= 70) return 'relation très forte et intime';
  if (value >= 45) return 'relation proche et solide';
  if (value >= 25) return 'relation affectueuse en construction';
  if (value >= 10) return 'relation naissante';
  return 'ils se connaissent encore peu';
}

function stripMarkup(text: string) {
  return text.replace(/^\[\[(voice|photo):/, '').replace(/\]\]$/, '').replace(/^[📹🎥☎🎬]\s*/, '').trim();
}

function meaningfulEvent(text: string) {
  return /promis|promesse|rencontr|retrouv|disput|peur|inquiet|important|anniversaire|famille|corrida|arène|voyage|madrid|nîmes|ensemble|couple|officiel|baiser|embrass|amour|je t'aime|manque|bless|hôpital|victoire|échec/i.test(text);
}

function buildSignal(save: LooseSave) {
  const recentMessages = (save.messages || []).slice(0, 8).map(m => `${m.from}: ${stripMarkup(m.text)}`);
  const recentEvents = (save.eventHistory || []).slice(-6);
  const recentMemories = (save.memories || []).slice(0, 6);
  const pool = [...recentMessages, ...recentEvents, ...recentMemories];
  const strong = pool.filter(meaningfulEvent).slice(0, 6);
  const latest = pool.slice(0, 8);
  return { strong, latest, recentMessages, recentEvents, recentMemories };
}

function signature(save: LooseSave) {
  const msg = save.messages?.[0];
  const event = save.eventHistory?.[save.eventHistory.length - 1] || '';
  return `${save.day || 0}|${save.time || ''}|${save.place || ''}|${save.relationship || 0}|${msg?.from || ''}:${msg?.text || ''}|${event}`.slice(0, 700);
}

function inSurpriseAfterglow(save: LooseSave) {
  const raw = save.flags?.moniaSurpriseLastPlaybackGameMinute;
  if (raw === undefined || raw === null || raw === '') return false;
  const last = Number(raw);
  if (!Number.isFinite(last)) return false;
  const age = gameMinute(save) - last;
  return age >= 0 && age < SURPRISE_AFTERGLOW_GAME_MINUTES;
}

function shouldConsider(save: LooseSave, state: AutoState) {
  if (!save.metLucas) return false;
  if (document.hidden) return false;
  if (document.getElementById('moniaDramaScene') || document.getElementById('moniaSceneOffer') || document.getElementById('moniaSurpriseScenePlayer')) return false;
  if (save.flags?.moniaSmsPending) return false;
  if (save.flags?.moniaCinematicActive === true) return false;
  if (inSurpriseAfterglow(save)) return false;
  const sig = signature(save);
  if (!sig || sig === state.signature) return false;
  const now = gameMinute(save);
  const last = state.lastSceneDay * 1440 + state.lastSceneMinute;
  if (state.lastSceneDay >= 0 && now - last < 360) return false;
  return true;
}

function sceneScore(save: LooseSave, state: AutoState) {
  const { strong, latest } = buildSignal(save);
  let score = strong.length * 2;
  const band = relationBand(save.relationship);
  if (band > state.lastRelationshipBand) score += 4;
  if (Number(save.day || 0) > state.lastSceneDay && strong.length) score += 2;
  if ((save.messages || []).slice(0, 4).some(m => meaningfulEvent(m.text))) score += 2;
  if ((save.eventHistory || []).slice(-3).some(meaningfulEvent)) score += 3;
  if (latest.some(t => /promis|promesse/i.test(t))) score += 3;
  return { score, strong, latest, band };
}

function sceneSnapshot(result: MonIADirectorResult, save: LooseSave, route: ReturnType<typeof routeSceneFromGameState>) {
  return JSON.stringify({ channel: 'scene', route, emotion: result.emotion, scene: result.scene, source: result.source, at: `${save.day || 0}:${save.time || '00:00'}:auto:${Date.now()}` });
}

function visioMood(result: MonIADirectorResult) {
  const e = `${result.emotion || ''} ${result.text || ''} ${result.spokenText || ''}`.toLowerCase();
  if (/tendre|warm|soft|affect|amour/.test(e)) return 'tender' as const;
  if (/taquin|playful|sourire|léger/.test(e)) return 'playful' as const;
  if (/inquiet|worried|peur/.test(e)) return 'worried' as const;
  if (/bless|hurt/.test(e)) return 'hurt' as const;
  if (/distant|froid/.test(e)) return 'distant' as const;
  if (/intense|tension|désir/.test(e)) return 'intense' as const;
  if (/soulag|relieved/.test(e)) return 'relieved' as const;
  return 'neutral' as const;
}

function timeOfDay(time = '12:00') {
  const h = Number(time.slice(0, 2));
  if (h < 6) return 'late night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

async function prepareMediaRoute(save: LooseSave, route: ReturnType<typeof routeSceneFromGameState>, result: MonIADirectorResult, memoryLines: string[], assessment: ReturnType<typeof sceneScore>) {
  const fresh = readSave();
  if (!fresh) return;
  const flags = fresh.flags || (fresh.flags = {});

  if (route.route === 'visio') {
    setLucasVisioContext({
      mood: visioMood(result),
      place: placeLabels[save.place || ''] || save.place || 'Lieu actuel',
      timeOfDay: timeOfDay(save.time),
      relationship: relationLabel(save.relationship),
      recentBeat: assessment.strong[0] || assessment.latest[0] || result.text || result.spokenText || '',
    });
    flags.moniaPendingMediaIntent = JSON.stringify({ status: 'context-ready', route: 'visio', approvedOnlyInLive: true, candidateGenerationAllowedOnlyInReview: true, at: Date.now() });
    writeSave(fresh);
    return;
  }

  if (route.route === 'environment-beat') {
    flags.moniaPendingMediaIntent = JSON.stringify({ status: 'approved-cache-only', route: 'environment-beat', preferredShots: route.preferredShotGrammar, at: Date.now() });
    writeSave(fresh);
    return;
  }

  const actors = route.route === 'lucas-solo-drama' ? ['Lucas'] : ['Lucas', 'Marion'];
  const premise = [result.scene?.action || '', result.spokenText || result.text || '', ...assessment.strong.slice(0, 3)].filter(Boolean).join(' · ');

  const plan = await planDrama({
    title: route.route === 'family-drama' ? 'Moment familial' : route.route === 'couple-drama' ? 'Moment Marion & Lucas' : 'Moment Lucas',
    context: {
      speaker: 'Marion',
      place: placeLabels[save.place || ''] || save.place || 'Lieu actuel',
      time: save.time || '00:00',
      day: Number(save.day || 0),
      recentAction: `Continuité immédiate routée: ${route.route}`,
      activeObjective: 'Préparer un storyboard candidat cohérent avec la partie, sans publication automatique.',
      relationship: relationLabel(save.relationship),
      memories: [...memoryLines, ...assessment.strong, ...assessment.latest].slice(0, 12),
      recentEvents: (save.eventHistory || []).slice(-8),
      rules: [
        `Route imposée: ${route.route}.`,
        `Co-présence physique confirmée: ${route.physicalCoPresence ? 'oui' : 'non'}.`,
        `Niveau de proximité: ${route.intimacyLevel}.`,
        `Plans préférés: ${route.preferredShotGrammar.join(', ')}.`,
        'Lucas conserve son identité canon officielle; aucune référence de mouvement ne remplace son visage.',
        'Toute femme de référence sert seulement au blocking et au contact; Marion conserve son propre canon.',
        'Générer un plan candidat uniquement; jamais de média non approuvé en live.',
      ],
    },
    premise: premise || 'Réaction immédiate subtile au contexte déjà établi.',
    actors,
    targetDuration: route.route === 'family-drama' ? 32 : 26,
    format: '16:9',
    availableMedia: ['lucas-intro.mp4', 'appartement-nimes.png'],
    renderMode: 'true_video_required',
  }, true);

  const job = queueDramaPlan(plan, route.route, actors);
  const latest = readSave();
  if (!latest) return;
  const latestFlags = latest.flags || (latest.flags = {});
  latestFlags.moniaPendingDramaPlan = JSON.stringify({ status: 'candidate-plan', route, plan, generationJobId: job.id, continuityKey: job.continuityKey, approvalRequired: true, generatedMediaMayNotAutoPublish: true, at: Date.now() });
  latestFlags.moniaPendingMediaIntent = JSON.stringify({ status: 'candidate-shots-queued', route: route.route, generationJobId: job.id, continuityKey: job.continuityKey, shots: job.shots.map(s => ({ id: s.id, shotSize: s.shotSize, focusActor: s.focusActor, duration: s.duration, status: s.status })), at: Date.now() });
  writeSave(latest);
}

let evaluating = false;
async function evaluate() {
  if (evaluating) return;
  const save = readSave();
  if (!save) return;
  const state = readState();
  if (!shouldConsider(save, state)) {
    state.signature = signature(save);
    writeState(state);
    return;
  }

  const assessment = sceneScore(save, state);
  state.signature = signature(save);
  state.lastRelationshipBand = Math.max(state.lastRelationshipBand, assessment.band);
  writeState(state);
  if (assessment.score < 7) return;

  const signal = buildSignal(save);
  const route = routeSceneFromGameState({
    place: save.place,
    time: save.time,
    relationship: save.relationship,
    trust: save.trust,
    chemistry: save.chemistry,
    official: save.official,
    engaged: save.engaged,
    married: save.married,
    children: save.children,
    recentMessages: signal.recentMessages,
    recentEvents: signal.recentEvents,
    memories: signal.recentMemories,
  });
  if (route.route === 'message-only') return;

  evaluating = true;
  try {
    const query = assessment.strong.join(' · ') || assessment.latest.join(' · ');
    const recalled = await monia.relevantMemories(query, Number(save.day || 0), ['Marion', 'Lucas'], 8).catch(() => []);
    const memoryLines = recalled.map(m => `${m.kind.toUpperCase()} J${m.day} ${m.time} · ${m.text}`);

    const result = await monia.direct({
      actor: 'Lucas',
      requestedChannel: 'scene',
      context: {
        speaker: 'Marion',
        place: placeLabels[save.place || ''] || save.place || 'Lieu actuel',
        time: save.time || '00:00',
        day: Number(save.day || 0),
        recentAction: 'Un moment important vient réellement de se produire dans la partie.',
        activeObjective: `Préparer uniquement une continuité immédiate compatible avec la route ${route.route}; aucun nouveau tournant de scénario.`,
        relationship: relationLabel(save.relationship),
        memories: [...memoryLines, ...assessment.strong, ...assessment.latest].slice(0, 12),
        recentEvents: (save.eventHistory || []).slice(-8),
        rules: [
          'Ne jamais révéler un événement futur ou une surprise.',
          'Ne jamais inventer un événement majeur, une rupture, une trahison, une blessure, une grossesse, un mariage ou un décès.',
          'Lucas reste absolument fidèle.',
          'La scène doit seulement mettre en valeur une conséquence immédiate de faits déjà présents dans le contexte.',
          'Ne jamais décider à la place de Marion.',
          'Ne jamais inventer la présence physique de Lucas.',
          `Route média imposée par l’état réel: ${route.route}.`,
          `Co-présence physique confirmée: ${route.physicalCoPresence ? 'oui' : 'non'}.`,
          `Grammaire de plans préférée: ${route.preferredShotGrammar.join(', ') || 'aucune'}.`,
          `Niveau de proximité autorisé par le contexte: ${route.intimacyLevel}.`,
          'Si le contexte ne suffit pas, rester sur un moment subtil et quotidien.',
          'Durée courte, émotion crédible, dialogue bref.',
        ],
      },
      availableMedia: ['lucas-intro.mp4', 'appartement-nimes.png'],
    }, 'auto', true);

    const fresh = readSave();
    if (!fresh) return;
    const flags = fresh.flags || (fresh.flags = {});
    flags.moniaSceneRoute = JSON.stringify(route);
    flags.moniaLastDirector = sceneSnapshot({ ...result, channel: 'scene' }, fresh, route);
    fresh.messages = fresh.messages || [];
    fresh.messages.unshift({ from: 'Lucas', text: `🎬 ${result.text || result.spokenText || 'Le moment se prolonge.'}`, day: Number(fresh.day || 0), read: true });
    if (result.memory) {
      fresh.memories = fresh.memories || [];
      fresh.memories.unshift(result.memory);
      fresh.memories = fresh.memories.slice(0, 80);
    }
    writeSave(fresh);

    await prepareMediaRoute(fresh, route, result, memoryLines, assessment).catch(error => {
      const latest = readSave();
      if (!latest) return;
      const latestFlags = latest.flags || (latest.flags = {});
      latestFlags.moniaPendingMediaIntent = JSON.stringify({ status: 'planning-error', route: route.route, error: error instanceof Error ? error.message : String(error), at: Date.now() });
      writeSave(latest);
    });

    const done = readState();
    const finalSave = readSave() || fresh;
    done.lastSceneDay = Number(finalSave.day || 0);
    done.lastSceneMinute = minutes(finalSave.time);
    done.lastRelationshipBand = Math.max(done.lastRelationshipBand, relationBand(finalSave.relationship));
    done.signature = signature(finalSave);
    writeState(done);
  } finally {
    evaluating = false;
  }
}

window.setInterval(() => { void evaluate(); }, 2400);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void evaluate(); });
window.addEventListener('monia:game-state-after-surprise', () => {
  const save = readSave();
  const state = readState();
  if (save) state.signature = signature(save);
  writeState(state);
});
window.setTimeout(() => { void evaluate(); }, 1800);

console.info('[MonIA] Intelligent contextual routing + continuity-safe candidate queue active');