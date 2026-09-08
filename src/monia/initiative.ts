import { monia } from './runtime';
import type { MonIAChannel } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';
const STATE_KEY = 'monia-initiative-state-v3';

type Message = { from: string; text: string; day: number; read: boolean };
type LooseSave = {
  day?: number;
  time?: string;
  place?: string;
  relationship?: number;
  metLucas?: boolean;
  phoneUnread?: number;
  messages?: Message[];
  eventHistory?: string[];
  memories?: string[];
  flags?: Record<string, string | number | boolean>;
  updatedAt?: number;
};

type InitiativeState = {
  lastDay: number;
  lastMinute: number;
  lastObservedContent: string;
  lastChangeDay: number;
  lastChangeMinute: number;
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
  try { save.updatedAt = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* optional */ }
}

function readState(): InitiativeState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as InitiativeState;
  } catch { /* optional */ }
  return { lastDay: -1, lastMinute: -9999, lastObservedContent: '', lastChangeDay: -1, lastChangeMinute: 0 };
}

function writeState(state: InitiativeState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* optional */ }
}

function minuteOfDay(time = '00:00') {
  const [h, m] = time.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function absoluteMinute(save: LooseSave) {
  return Number(save.day || 0) * 1440 + minuteOfDay(save.time);
}

function relationLabel(value = 0) {
  if (value >= 70) return 'relation très forte et intime';
  if (value >= 45) return 'relation proche et solide';
  if (value >= 25) return 'relation affectueuse en construction';
  if (value >= 10) return 'relation naissante';
  return 'ils se connaissent encore peu';
}

function latestMessages(save: LooseSave) {
  return (save.messages || []).slice(0, 8);
}

function contentSignature(save: LooseSave) {
  const messages = latestMessages(save).slice(0, 4).map(m => `${m.from}:${m.text}`).join('|');
  const event = (save.eventHistory || []).slice(-2).join('|');
  return `${save.day || 0}|${save.relationship || 0}|${messages}|${event}`.slice(0, 1200);
}

function hasPendingInteraction(save: LooseSave) {
  const f = save.flags || {};
  return Boolean(f.smsPending || f.smsPendingText || f.smsReplyAt || f.smsTyping || f.moniaSmsPending);
}

function lucasUnavailable(save: LooseSave) {
  const f = save.flags || {};
  return Boolean(
    f.lucasBusy ||
    f.lucasAtTraining ||
    f.lucasInCorrida ||
    f.corridaInProgress ||
    f.lucasTraveling ||
    f.lucasSleeping
  );
}

function latestSpeaker(save: LooseSave) {
  const latest = latestMessages(save)[0];
  return latest?.from || '';
}

function chooseChannel(save: LooseSave, silenceMinutes: number): MonIAChannel {
  const hour = Math.floor(minuteOfDay(save.time) / 60);
  const relation = Number(save.relationship || 0);
  const emotionalContext = (save.memories || []).slice(0, 6).some(e => /manque|promesse|peur|inquiet|envie|tendre|important/i.test(e));
  if (relation >= 40 && silenceMinutes >= 240 && emotionalContext && hour >= 18 && hour <= 22) return 'voice';
  return 'text';
}

function silenceSinceChange(save: LooseSave, state: InitiativeState) {
  if (state.lastChangeDay < 0) return 0;
  return absoluteMinute(save) - (state.lastChangeDay * 1440 + state.lastChangeMinute);
}

function initiativeScore(save: LooseSave, state: InitiativeState) {
  let score = 0;
  const now = absoluteMinute(save);
  const last = state.lastDay * 1440 + state.lastMinute;
  const sinceInitiative = state.lastDay >= 0 ? now - last : 9999;
  const silence = silenceSinceChange(save, state);
  const relation = Number(save.relationship || 0);
  const latest = latestSpeaker(save);
  const hour = Math.floor(minuteOfDay(save.time) / 60);

  if (sinceInitiative < 360) return -999;
  if (silence < 90) return -999;
  if (latest === 'Lucas' && silence < 300) return -999;
  if (lucasUnavailable(save)) return -999;
  if (hour < 8 || hour >= 23) return -999;

  if (silence >= 120) score += 2;
  if (silence >= 240) score += 2;
  if (silence >= 480) score += 1;
  if (relation >= 20) score += 1;
  if (relation >= 45) score += 2;
  if (relation >= 70) score += 1;
  if (latest === 'Toi' || latest === 'Marion') score += 1;
  if ((save.eventHistory || []).slice(-3).some(e => /important|manque|promesse|famille|corrida|peur|inquiet|rencontr|ensemble/i.test(e))) score += 2;
  if ((save.memories || []).slice(0, 6).some(e => /manque|promesse|aime|peur|inquiet|voudrais|envie/i.test(e))) score += 1;

  return score;
}

function mayRun(save: LooseSave, state: InitiativeState) {
  if (!save.metLucas) return false;
  if (document.hidden) return false;
  if (hasPendingInteraction(save)) return false;
  if (document.getElementById('moniaDramaScene') || document.getElementById('moniaSceneOffer')) return false;
  return initiativeScore(save, state) >= 7;
}

function safeContext(save: LooseSave, silenceMinutes: number) {
  const recentMessages = latestMessages(save).slice(0, 6).map(m => `${m.from}: ${String(m.text || '').slice(0, 180)}`);
  const latest = latestSpeaker(save);
  return {
    speaker: 'Marion',
    place: save.place || 'Lieu actuel',
    time: save.time || '00:00',
    day: Number(save.day || 0),
    recentAction: `Silence naturel d'environ ${Math.max(0, Math.round(silenceMinutes))} minutes de jeu depuis le dernier changement de conversation.`,
    activeObjective: 'Décider d’une micro-initiative crédible de Lucas sans créer de nouvel événement de scénario.',
    relationship: relationLabel(save.relationship),
    memories: (save.memories || []).slice(0, 8),
    recentEvents: [...recentMessages, ...(save.eventHistory || []).slice(-5)].slice(-12),
    rules: [
      'Ne jamais révéler une surprise future.',
      'Ne jamais inventer de rendez-vous, voyage, visite, dispute, rupture, déclaration majeure ou événement canon.',
      'Lucas reste absolument fidèle.',
      'Une initiative doit être légère: prendre des nouvelles, rebondir sur un échange récent, partager une pensée courte ou proposer de reparler.',
      latest === 'Lucas' ? 'Lucas a parlé en dernier: s’il reprend contact, son message doit être particulièrement bref et justifié par le temps écoulé.' : 'Marion a parlé récemment: Lucas peut relancer seulement si le silence rend cette relance naturelle.',
      'Le silence est une option normale. Ne pas transformer chaque pause en événement ou en déclaration affective.',
      'Ne jamais décider à la place de Marion.',
      'Ne pas spammer ni multiplier les messages.',
    ],
  };
}

function plainPreview(text: string) {
  return text.replace(/^\[\[voice:/, '').replace(/\]\]$/, '').slice(0, 110);
}

let running = false;
async function evaluate() {
  if (running) return;
  const save = readSave();
  if (!save) return;
  const state = readState();
  const currentContent = contentSignature(save);

  if (currentContent !== state.lastObservedContent) {
    state.lastObservedContent = currentContent;
    state.lastChangeDay = Number(save.day || 0);
    state.lastChangeMinute = minuteOfDay(save.time);
    writeState(state);
    return;
  }

  if (!mayRun(save, state)) return;

  running = true;
  try {
    const silence = silenceSinceChange(save, state);
    const channel = chooseChannel(save, silence);
    const result = await monia.direct({
      actor: 'Lucas',
      requestedChannel: channel,
      context: safeContext(save, silence),
      availableMedia: ['lucas-intro.mp4'],
    }, 'auto', true);

    const fresh = readSave();
    if (!fresh) return;
    fresh.messages = fresh.messages || [];
    fresh.flags = fresh.flags || {};
    const prefix = result.channel === 'voice' ? '[[voice:' : '';
    const suffix = result.channel === 'voice' ? ']]' : '';
    const rendered = `${prefix}${result.text || result.spokenText}${suffix}`;
    fresh.messages.unshift({
      from: 'Lucas',
      text: rendered,
      day: Number(fresh.day || 0),
      read: false,
    });
    fresh.phoneUnread = Math.max(0, Number(fresh.phoneUnread || 0)) + 1;
    fresh.flags.phoneToast = `Lucas|${result.channel === 'voice' ? 'Message vocal' : plainPreview(rendered)}`;
    fresh.flags.phoneToastAt = absoluteMinute(fresh);
    fresh.flags.lastLucasInitiativeAt = absoluteMinute(fresh);
    fresh.flags.lastLucasInitiativeChannel = result.channel;
    if (result.memory) {
      fresh.memories = fresh.memories || [];
      fresh.memories.unshift(result.memory);
      fresh.memories = fresh.memories.slice(0, 80);
    }
    writeSave(fresh);

    window.dispatchEvent(new CustomEvent('marion-lucas-phone-initiative', { detail: { actor: 'Lucas', channel: result.channel } }));

    const done = readState();
    done.lastDay = Number(fresh.day || 0);
    done.lastMinute = minuteOfDay(fresh.time);
    done.lastObservedContent = contentSignature(fresh);
    done.lastChangeDay = Number(fresh.day || 0);
    done.lastChangeMinute = minuteOfDay(fresh.time);
    writeState(done);
  } finally {
    running = false;
  }
}

window.setInterval(() => { void evaluate(); }, 3500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void evaluate(); });
window.setTimeout(() => { void evaluate(); }, 2600);

console.info('[MonIA] Contextual Lucas initiative + conversational silence layer active');
