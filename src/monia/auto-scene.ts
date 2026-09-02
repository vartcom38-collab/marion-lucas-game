import { monia } from './runtime';
import type { MonIADirectorResult } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';
const STATE_KEY = 'monia-auto-scene-state-v1';

type Message = { from: string; text: string; day: number; read: boolean };
type LooseSave = {
  day?: number;
  time?: string;
  place?: string;
  relationship?: number;
  trust?: number;
  chemistry?: number;
  metLucas?: boolean;
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
  return { strong, latest };
}

function signature(save: LooseSave) {
  const msg = save.messages?.[0];
  const event = save.eventHistory?.[save.eventHistory.length - 1] || '';
  return `${save.day || 0}|${save.time || ''}|${save.place || ''}|${save.relationship || 0}|${msg?.from || ''}:${msg?.text || ''}|${event}`.slice(0, 700);
}

function shouldConsider(save: LooseSave, state: AutoState) {
  if (!save.metLucas) return false;
  if (document.hidden) return false;
  if (document.getElementById('moniaDramaScene') || document.getElementById('moniaSceneOffer')) return false;
  if (save.flags?.moniaSmsPending) return false;

  const sig = signature(save);
  if (!sig || sig === state.signature) return false;

  const day = Number(save.day || 0);
  const now = day * 1440 + minutes(save.time);
  const last = state.lastSceneDay * 1440 + state.lastSceneMinute;
  if (state.lastSceneDay >= 0 && now - last < 360) return false; // max about one spontaneous scene per 6 in-game hours

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

function sceneSnapshot(result: MonIADirectorResult, save: LooseSave) {
  return JSON.stringify({
    channel: 'scene',
    emotion: result.emotion,
    scene: result.scene,
    source: result.source,
    at: `${save.day || 0}:${save.time || '00:00'}:auto:${Date.now()}`,
  });
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

  // Deliberately high threshold: silence is better than an artificial scene.
  if (assessment.score < 7) return;

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
        activeObjective: 'Proposer uniquement une micro-scène de réaction ou de continuité immédiate, jamais un nouveau tournant de scénario.',
        relationship: relationLabel(save.relationship),
        memories: [...memoryLines, ...assessment.strong, ...assessment.latest].slice(0, 12),
        recentEvents: (save.eventHistory || []).slice(-8),
        rules: [
          'Ne jamais révéler un événement futur ou une surprise.',
          'Ne jamais inventer un événement majeur, une rupture, une trahison, une blessure, une grossesse, un mariage ou un décès.',
          'Lucas reste absolument fidèle.',
          'La scène doit seulement mettre en valeur une conséquence immédiate de faits déjà présents dans le contexte.',
          'Ne jamais décider à la place de Marion.',
          'Si le contexte ne suffit pas, rester sur un moment subtil et quotidien.',
          'Durée courte, émotion crédible, dialogue bref.',
        ],
      },
      availableMedia: ['lucas-intro.mp4', 'appartement-nimes.png'],
    }, 'auto', true);

    const fresh = readSave();
    if (!fresh) return;
    const flags = fresh.flags || (fresh.flags = {});
    flags.moniaLastDirector = sceneSnapshot({ ...result, channel: 'scene' }, fresh);
    fresh.messages = fresh.messages || [];
    fresh.messages.unshift({
      from: 'Lucas',
      text: `🎬 ${result.text || result.spokenText || 'Le moment se prolonge.'}`,
      day: Number(fresh.day || 0),
      read: true,
    });
    if (result.memory) {
      fresh.memories = fresh.memories || [];
      fresh.memories.unshift(result.memory);
      fresh.memories = fresh.memories.slice(0, 80);
    }
    writeSave(fresh);

    const done = readState();
    done.lastSceneDay = Number(fresh.day || 0);
    done.lastSceneMinute = minutes(fresh.time);
    done.lastRelationshipBand = Math.max(done.lastRelationshipBand, relationBand(fresh.relationship));
    done.signature = signature(fresh);
    writeState(done);
  } finally {
    evaluating = false;
  }
}

window.setInterval(() => { void evaluate(); }, 2400);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void evaluate(); });
window.setTimeout(() => { void evaluate(); }, 1800);

console.info('[MonIA] Intelligent contextual scene triggers active');
