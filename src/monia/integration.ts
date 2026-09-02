import { monia } from './runtime';
import type { MonIAChannel, MonIADirectorResult } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';
const SETTINGS_KEY = 'marion-lucas-settings-v2';

type LooseSave = {
  day: number;
  time: string;
  place: string;
  relationship: number;
  trust?: number;
  chemistry?: number;
  metLucas?: boolean;
  memories?: string[];
  eventHistory?: string[];
  messages?: Array<{ from: string; text: string; day: number; read: boolean }>;
  flags?: Record<string, string | number | boolean>;
  calendar?: Array<{ owner: string; title: string; day: number; note: string }>;
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

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function readSave(): LooseSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as LooseSave : null;
  } catch {
    return null;
  }
}

function writeSave(save: LooseSave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function relationLabel(value = 0) {
  if (value >= 70) return 'relation très forte et intime';
  if (value >= 45) return 'relation proche et solide';
  if (value >= 25) return 'relation affectueuse en construction';
  if (value >= 10) return 'relation naissante';
  return 'ils se connaissent encore peu';
}

function requestedChannel(text: string): MonIAChannel | undefined {
  const t = text.toLowerCase();
  if (t.includes('visio') || t.includes('facetime') || t.includes('caméra')) return 'visio';
  if (t.includes('vocal') || t.includes('audio') || t.includes('note vocale')) return 'voice';
  if (t.includes('vidéo') || t.includes('video')) return 'video';
  if (t.includes('appelle-moi') || t.includes('appel moi') || t.includes('téléphone-moi')) return 'call';
  return undefined;
}

function encodeReply(result: MonIADirectorResult) {
  if (result.channel === 'voice') return `[[voice:${result.spokenText || result.text}]]`;
  if (result.channel === 'visio') return `📹 ${result.text}`;
  if (result.channel === 'video') return `🎥 ${result.text}`;
  if (result.channel === 'call') return `☎ ${result.text}`;
  if (result.channel === 'scene') return `🎬 ${result.text}`;
  return result.text;
}

function clearLegacyPending(flags: Record<string, string | number | boolean>) {
  delete flags.smsPending;
  delete flags.smsPendingText;
  delete flags.smsReplyAt;
  delete flags.smsTypingAt;
  delete flags.smsTyping;
}

function renderLiveReply(result: MonIADirectorResult) {
  const thread = document.querySelector('.smsThread');
  if (!thread) return;
  const article = document.createElement('article');
  article.className = 'msg moniaDirectorReply';
  const label = result.channel === 'voice' ? 'VOCAL IA LOCAL' : result.channel === 'visio' ? 'VISIO PROPOSÉE' : result.channel === 'video' ? 'VIDÉO PROPOSÉE' : 'MONIA LOCAL';
  const safe = (value: string) => value.replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
  article.innerHTML = `<b>Lucas</b><p>${safe(result.text)}</p><small>${label} · ${safe(result.emotion)}</small>`;
  thread.prepend(article);
  document.querySelector('.smsPending')?.remove();
}

async function directLatestSms(text: string) {
  const save = readSave();
  if (!save?.metLucas) return;
  const flags = save.flags || (save.flags = {});
  const prefs = readJSON(SETTINGS_KEY, { localAI: true, aiMode: 'auto' as 'auto' | 'light' | 'advanced' });
  const recent = save.messages?.slice(0, 6).map(m => `${m.from}: ${m.text.replace(/^\[\[(voice|photo):|\]\]$/g, '')}`) || [];
  const todayLucas = save.calendar?.filter(i => i.owner === 'Lucas' && i.day === save.day).map(i => `${i.title} · ${i.note}`) || [];
  const context = {
    speaker: 'Marion',
    place: placeLabels[save.place] || save.place,
    time: save.time,
    day: save.day,
    recentAction: `SMS libre envoyé à Lucas: ${text.slice(0, 160)}`,
    activeObjective: 'Répondre naturellement au message sans décider à la place de Marion',
    relationship: relationLabel(save.relationship),
    memories: [...(save.memories || []).slice(0, 6), ...recent].slice(0, 10),
    recentEvents: [...(save.eventHistory || []).slice(-5), ...todayLucas].slice(-8),
    rules: [
      'Ne jamais révéler un événement futur ou une surprise.',
      'Lucas reste absolument fidèle.',
      'Répondre comme Lucas, pas comme un assistant.',
      'Respecter le lieu, l’heure, la relation et son agenda.',
      'Ne jamais écrire la réponse de Marion.',
    ],
  };

  const result = await monia.direct({
    actor: 'Lucas',
    playerText: text,
    requestedChannel: requestedChannel(text),
    context,
    availableMedia: ['lucas-intro.mp4'],
  }, prefs.aiMode, prefs.localAI !== false);

  const fresh = readSave();
  if (!fresh) return;
  const freshFlags = fresh.flags || (fresh.flags = {});
  clearLegacyPending(freshFlags);
  freshFlags.moniaLastDirector = JSON.stringify({
    channel: result.channel,
    emotion: result.emotion,
    scene: result.scene,
    source: result.source,
    at: `${fresh.day}:${fresh.time}`,
  });
  fresh.messages = fresh.messages || [];
  fresh.messages.unshift({ from: 'Lucas', text: encodeReply(result), day: fresh.day, read: true });
  if (result.memory) {
    fresh.memories = fresh.memories || [];
    fresh.memories.unshift(result.memory);
    fresh.memories = fresh.memories.slice(0, 80);
  }
  writeSave(fresh);
  renderLiveReply(result);
}

let lastSignature = '';
function scheduleFromComposer(text: string) {
  const trimmed = text.trim().slice(0, 280);
  if (!trimmed) return;
  const signature = `${Date.now() >> 8}:${trimmed}`;
  if (signature === lastSignature) return;
  lastSignature = signature;
  window.setTimeout(() => { void directLatestSms(trimmed); }, 0);
}

document.addEventListener('click', event => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest('#sendSms')) return;
  const input = document.getElementById('smsComposer') as HTMLTextAreaElement | null;
  if (input) scheduleFromComposer(input.value);
}, true);

document.addEventListener('keydown', event => {
  const target = event.target as HTMLTextAreaElement | null;
  if (!target || target.id !== 'smsComposer') return;
  if (event.key === 'Enter' && !event.shiftKey) scheduleFromComposer(target.value);
}, true);

console.info('[MonIA] Director SMS integration active');
