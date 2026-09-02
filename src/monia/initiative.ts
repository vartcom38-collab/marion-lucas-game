import { monia } from './runtime';
import type { MonIAChannel } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';
const STATE_KEY = 'monia-initiative-state-v1';

type Message = { from: string; text: string; day: number; read: boolean };
type LooseSave = {
  day?: number;
  time?: string;
  place?: string;
  relationship?: number;
  metLucas?: boolean;
  messages?: Message[];
  eventHistory?: string[];
  memories?: string[];
  flags?: Record<string, string | number | boolean>;
};

type InitiativeState = {
  lastDay: number;
  lastMinute: number;
  lastSignature: string;
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

function readState(): InitiativeState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as InitiativeState;
  } catch { /* optional */ }
  return { lastDay: -1, lastMinute: -9999, lastSignature: '' };
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

function latestLucasMessage(save: LooseSave) {
  return (save.messages || []).find(m => m.from === 'Lucas');
}

function latestMarionMessage(save: LooseSave) {
  return (save.messages || []).find(m => m.from === 'Toi' || m.from === 'Marion');
}

function signature(save: LooseSave) {
  const lucas = latestLucasMessage(save);
  const marion = latestMarionMessage(save);
  return `${save.day || 0}|${save.time || ''}|${save.relationship || 0}|${lucas?.text || ''}|${marion?.text || ''}`.slice(0, 700);
}

function hasPendingInteraction(save: LooseSave) {
  const f = save.flags || {};
  return Boolean(f.smsPending || f.smsPendingText || f.smsReplyAt || f.smsTyping || f.moniaSmsPending || f.moniaLastDirector);
}

function chooseChannel(save: LooseSave): MonIAChannel {
  const hour = Math.floor(minuteOfDay(save.time) / 60);
  const relation = Number(save.relationship || 0);
  if (relation >= 35 && hour >= 18 && hour <= 22) return 'voice';
  return 'text';
}

function initiativeScore(save: LooseSave, state: InitiativeState) {
  let score = 0;
  const now = absoluteMinute(save);
  const last = state.lastDay * 1440 + state.lastMinute;
  const since = state.lastDay >= 0 ? now - last : 9999;
  const relation = Number(save.relationship || 0);
  const marion = latestMarionMessage(save);
  const lucas = latestLucasMessage(save);

  if (since < 360) return -999; // never more than about once per 6 in-game hours
  if (relation >= 20) score += 2;
  if (relation >= 45) score += 2;
  if (relation >= 70) score += 1;
  if (marion && (!lucas || marion.day >= lucas.day)) score += 2;
  if ((save.eventHistory || []).slice(-3).some(e => /important|manque|promesse|famille|corrida|peur|inquiet|rencontr|ensemble/i.test(e))) score += 2;
  if ((save.memories || []).slice(0, 6).some(e => /manque|promesse|aime|peur|inquiet|voudrais|envie/i.test(e))) score += 1;

  return score;
}

function mayRun(save: LooseSave, state: InitiativeState) {
  if (!save.metLucas) return false;
  if (document.hidden) return false;
  if (hasPendingInteraction(save)) return false;
  if (document.getElementById('moniaDramaScene') || document.getElementById('moniaSceneOffer')) return false;
  const sig = signature(save);
  if (!sig || sig === state.lastSignature) return false;
  return initiativeScore(save, state) >= 6;
}

function safeContext(save: LooseSave) {
  const recentMessages = (save.messages || []).slice(0, 6).map(m => `${m.from}: ${String(m.text || '').slice(0, 180)}`);
  return {
    speaker: 'Marion',
    place: save.place || 'Lieu actuel',
    time: save.time || '00:00',
    day: Number(save.day || 0),
    recentAction: 'Lucas envisage une petite initiative naturelle sans événement de scénario.',
    activeObjective: 'Choisir une micro-initiative crédible ou rester discret; jamais créer un tournant de l’histoire.',
    relationship: relationLabel(save.relationship),
    memories: (save.memories || []).slice(0, 8),
    recentEvents: [...recentMessages, ...(save.eventHistory || []).slice(-5)].slice(-12),
    rules: [
      'Ne jamais révéler une surprise future.',
      'Ne jamais inventer de rendez-vous, voyage, visite, dispute, rupture, déclaration majeure ou événement canon.',
      'Lucas reste absolument fidèle.',
      'Une initiative doit être légère: prendre des nouvelles, rebondir sur un échange récent, partager une pensée courte ou proposer de reparler.',
      'Si le contexte ne justifie rien, rester très sobre.',
      'Ne jamais décider à la place de Marion.',
      'Ne pas spammer ni multiplier les messages.',
    ],
  };
}

let running = false;
async function evaluate() {
  if (running) return;
  const save = readSave();
  if (!save) return;
  const state = readState();
  state.lastSignature = signature(save);
  writeState(state);
  if (!mayRun(save, state)) return;

  running = true;
  try {
    const channel = chooseChannel(save);
    const result = await monia.direct({
      actor: 'Lucas',
      requestedChannel: channel,
      context: safeContext(save),
      availableMedia: ['lucas-intro.mp4'],
    }, 'auto', true);

    const fresh = readSave();
    if (!fresh) return;
    fresh.messages = fresh.messages || [];
    const prefix = result.channel === 'voice' ? '[[voice:' : '';
    const suffix = result.channel === 'voice' ? ']]' : '';
    fresh.messages.unshift({
      from: 'Lucas',
      text: `${prefix}${result.text || result.spokenText}${suffix}`,
      day: Number(fresh.day || 0),
      read: false,
    });
    if (result.memory) {
      fresh.memories = fresh.memories || [];
      fresh.memories.unshift(result.memory);
      fresh.memories = fresh.memories.slice(0, 80);
    }
    writeSave(fresh);

    const done = readState();
    done.lastDay = Number(fresh.day || 0);
    done.lastMinute = minuteOfDay(fresh.time);
    done.lastSignature = signature(fresh);
    writeState(done);
  } finally {
    running = false;
  }
}

window.setInterval(() => { void evaluate(); }, 3500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void evaluate(); });
window.setTimeout(() => { void evaluate(); }, 2600);

console.info('[MonIA] Safe spontaneous Lucas initiative layer active');
