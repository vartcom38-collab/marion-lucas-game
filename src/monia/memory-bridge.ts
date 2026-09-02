import { monia } from './runtime';
import { moniaStorage } from './storage';
import type { MonIADirectorRequest } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';

type LooseSave = {
  day?: number;
  time?: string;
  flags?: Record<string, string | number | boolean>;
};

function clearLegacySmsPending() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw) as LooseSave;
    const flags = save.flags || (save.flags = {});
    delete flags.smsPending;
    delete flags.smsPendingText;
    delete flags.smsReplyAt;
    delete flags.smsTypingAt;
    delete flags.smsTyping;
    flags.moniaSmsPending = true;
    flags.moniaSmsPendingAt = `${save.day || 0}:${save.time || ''}`;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // optional safety bridge: never block the game
  }
}

function clearMoniaPending() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw) as LooseSave;
    const flags = save.flags || (save.flags = {});
    delete flags.moniaSmsPending;
    delete flags.moniaSmsPendingAt;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // optional safety bridge: never block the game
  }
}

function uniqueMemories(values: string[], limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

function explicitPromise(text: string) {
  return /\b(je te promets|promets-moi|promis|je promets|on se promet)\b/i.test(text);
}

function significantChannel(channel: string) {
  return channel === 'scene' || channel === 'visio' || channel === 'call' || channel === 'video';
}

const originalDirect = monia.direct.bind(monia);

monia.direct = async (request: MonIADirectorRequest, mode = 'auto', enabled = true) => {
  clearLegacySmsPending();

  const query = request.playerText || request.context.recentAction || '';
  const relevant = await monia.relevantMemories(query, request.context.day, ['Marion', request.actor], 8).catch(() => []);
  const longTerm = relevant.map(memory => {
    const tag = memory.kind === 'promise' ? 'PROMESSE' : memory.kind === 'event' ? 'ÉVÉNEMENT' : 'SOUVENIR';
    return `${tag} J${memory.day} ${memory.time} · ${memory.text}`;
  });

  const enriched: MonIADirectorRequest = {
    ...request,
    context: {
      ...request.context,
      memories: uniqueMemories([...longTerm, ...(request.context.memories || [])], 12),
      rules: uniqueMemories([
        ...(request.context.rules || []),
        'Les souvenirs marqués PROMESSE sont des engagements à respecter tant qu’un événement plus récent ne les contredit pas.',
        'Utiliser un souvenir uniquement s’il est pertinent pour la situation actuelle; ne pas forcer une référence ancienne.',
        'En cas de contradiction, le contexte le plus récent de la partie est prioritaire.',
      ], 16),
    },
  };

  if (request.playerText && explicitPromise(request.playerText)) {
    void moniaStorage.put({
      id: `promise-in-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: 'promise',
      text: `Marion à ${request.actor}: ${request.playerText.slice(0, 180)}`,
      day: request.context.day,
      time: request.context.time,
      actors: ['Marion', request.actor],
      createdAt: Date.now(),
    }).catch(() => undefined);
  }

  try {
    const result = await originalDirect(enriched, mode, enabled);
    if (result.memory && explicitPromise(`${result.text} ${result.memory}`)) {
      void moniaStorage.put({
        id: `promise-out-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: 'promise',
        text: `${request.actor}: ${result.memory.slice(0, 180)}`,
        day: request.context.day,
        time: request.context.time,
        actors: [request.actor, 'Marion'],
        createdAt: Date.now(),
      }).catch(() => undefined);
    }
    if (significantChannel(result.channel)) {
      void moniaStorage.put({
        id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: 'event',
        text: `${result.channel} avec ${request.actor}: ${(result.memory || result.text).slice(0, 180)}`,
        day: request.context.day,
        time: request.context.time,
        actors: ['Marion', request.actor],
        createdAt: Date.now(),
      }).catch(() => undefined);
    }
    return result;
  } finally {
    clearMoniaPending();
  }
};

console.info('[MonIA] Long-term contextual memory bridge active');
