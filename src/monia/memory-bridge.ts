import { monia } from './runtime';
import { moniaStorage } from './storage';
import type { MonIADirectorRequest } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';
const THREAD_PREFIX = 'monia-thread-v1';

type LooseSave = {
  day?: number;
  time?: string;
  flags?: Record<string, string | number | boolean>;
};

type ThreadTurn = {
  speaker: string;
  text: string;
  at: number;
};

function clearLegacySmsPending() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw) as LooseSave;
    const flags = save.flags || (save.flags = {});
    const hasLegacyPending = Boolean(flags.smsPending || flags.smsPendingText || flags.smsReplyAt || flags.smsTypingAt || flags.smsTyping);
    if (!hasLegacyPending) return false;
    delete flags.smsPending;
    delete flags.smsPendingText;
    delete flags.smsReplyAt;
    delete flags.smsTypingAt;
    delete flags.smsTyping;
    flags.moniaSmsPending = true;
    flags.moniaSmsPendingAt = `${save.day || 0}:${save.time || ''}`;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

function clearMoniaPending() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw) as LooseSave;
    const flags = save.flags || (save.flags = {});
    if (!flags.moniaSmsPending && !flags.moniaSmsPendingAt) return;
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

function meaningfulPersonalFact(text: string) {
  const value = text.trim();
  if (value.length < 12) return false;
  return /\b(j['’]aime|j['’]adore|je déteste|je deteste|j['’]ai peur|ça me fait peur|ca me fait peur|je rêve|je reve|j['’]aimerais|je voudrais|je veux vraiment|tu me manques|je tiens à toi|je tiens a toi|je suis inquiète|je suis inquiete|je suis heureuse|je suis triste|je préfère|je prefere)\b/i.test(value);
}

function significantChannel(channel: string) {
  return channel === 'scene' || channel === 'visio' || channel === 'call' || channel === 'video';
}

function isTestRequest(request: MonIADirectorRequest) {
  const objective = request.context.activeObjective || '';
  const action = request.context.recentAction || '';
  return /environnement de test|bac à sable|test libre monia/i.test(`${objective} ${action}`);
}

function threadKey(request: MonIADirectorRequest) {
  return `${THREAD_PREFIX}:${isTestRequest(request) ? 'test' : 'game'}:${request.actor || 'actor'}`;
}

function loadThread(request: MonIADirectorRequest): ThreadTurn[] {
  try {
    const raw = sessionStorage.getItem(threadKey(request));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(turn => turn && typeof turn.speaker === 'string' && typeof turn.text === 'string')
      .slice(-8)
      .map(turn => ({ speaker: turn.speaker.slice(0, 40), text: turn.text.slice(0, 260), at: Number(turn.at || 0) }));
  } catch {
    return [];
  }
}

function saveThread(request: MonIADirectorRequest, turns: ThreadTurn[]) {
  try {
    sessionStorage.setItem(threadKey(request), JSON.stringify(turns.slice(-8)));
  } catch {
    // short-term continuity is optional
  }
}

function conversationContext(turns: ThreadTurn[]) {
  if (!turns.length) return [] as string[];
  return [
    'CONVERSATION RÉCENTE (ordre chronologique):',
    ...turns.map(turn => `${turn.speaker}: ${turn.text}`),
  ];
}

const originalDirect = monia.direct.bind(monia);

monia.direct = async (request: MonIADirectorRequest, mode = 'auto', enabled = true) => {
  const managesGameSmsPending = clearLegacySmsPending();

  const query = request.playerText || request.context.recentAction || '';
  const relevant = await monia.relevantMemories(query, request.context.day, ['Marion', request.actor], 8).catch(() => []);
  const longTerm = relevant.map(memory => {
    const tag = memory.kind === 'promise' ? 'PROMESSE' : memory.kind === 'event' ? 'ÉVÉNEMENT' : 'SOUVENIR';
    return `${tag} J${memory.day} ${memory.time} · ${memory.text}`;
  });
  const thread = loadThread(request);
  const continuity = conversationContext(thread);

  const enriched: MonIADirectorRequest = {
    ...request,
    context: {
      ...request.context,
      memories: uniqueMemories([...longTerm, ...(request.context.memories || [])], 12),
      recentEvents: [...continuity, ...(request.context.recentEvents || [])].slice(-14),
      rules: uniqueMemories([
        ...(request.context.rules || []),
        'Les souvenirs marqués PROMESSE sont des engagements à respecter tant qu’un événement plus récent ne les contredit pas.',
        'Les souvenirs personnels peuvent guider le ton ou rappeler une préférence, mais seulement s’ils sont pertinents.',
        'Utiliser un souvenir uniquement s’il est pertinent pour la situation actuelle; ne pas forcer une référence ancienne.',
        'CONVERSATION RÉCENTE représente le fil immédiat: résoudre les pronoms, ellipses et réponses courtes à partir de ce fil.',
        'Si Marion dit seulement pourquoi, sérieux, et demain, quoi, comment ça ou une réponse courte similaire, répondre à ce qu’elle vient réellement de reprendre dans la conversation.',
        'Ne jamais contredire sans raison une information que Lucas vient de donner quelques messages plus tôt.',
        'En cas de contradiction, le contexte le plus récent de la partie est prioritaire.',
      ], 20),
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
  } else if (request.playerText && meaningfulPersonalFact(request.playerText)) {
    void moniaStorage.put({
      id: `personal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: 'event',
      text: `Marion a confié à ${request.actor}: ${request.playerText.slice(0, 180)}`,
      day: request.context.day,
      time: request.context.time,
      actors: ['Marion', request.actor],
      createdAt: Date.now(),
    }).catch(() => undefined);
  }

  try {
    const result = await originalDirect(enriched, mode, enabled);
    const nextThread = [...thread];
    if (request.playerText?.trim()) nextThread.push({ speaker: 'Marion', text: request.playerText.trim().slice(0, 260), at: Date.now() });
    if (result.text?.trim()) nextThread.push({ speaker: request.actor || result.actor || 'Lucas', text: result.text.trim().slice(0, 260), at: Date.now() });
    saveThread(request, nextThread);

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
    if (managesGameSmsPending) clearMoniaPending();
  }
};

console.info('[MonIA] Long-term memory + short-term conversation continuity active');
