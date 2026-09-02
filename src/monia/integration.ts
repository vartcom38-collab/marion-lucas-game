import { monia } from './runtime';
import type { MonIAChannel, MonIADirectorResult } from './director';

const SAVE_KEY = 'marion-lucas-save-v4';
const SETTINGS_KEY = 'marion-lucas-settings-v2';
const VISIO_KEY = 'monia-last-visio-v1';

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

function safeHTML(value: string) {
  return value.replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}

function voiceMarkup(text: string) {
  const duration = String(Math.max(6, Math.min(29, Math.round(text.length / 10)))).padStart(2, '0');
  return `<div class="voiceNote moniaVoiceNote"><button type="button" data-monia-voice aria-label="Lire la note vocale">▶</button><div><i></i><i></i><i></i><i></i><i></i><i></i></div><span>0:${duration}</span></div><small class="voiceTranscript">${safeHTML(text)}</small>`;
}

function visioMarkup(result: MonIADirectorResult) {
  const scene = result.scene;
  const detail = scene ? `${scene.location} · ${scene.action}` : 'Visio proposée par MonIA';
  return `<p>${safeHTML(result.text)}</p><button type="button" data-monia-visio class="moniaVisioLaunch">◇ Ouvrir la visio</button><small>${safeHTML(detail)}</small>`;
}

function renderLiveReply(result: MonIADirectorResult) {
  const thread = document.querySelector('.smsThread');
  if (!thread) return;
  const article = document.createElement('article');
  article.className = 'msg moniaDirectorReply';
  const label = result.channel === 'voice' ? 'VOCAL IA LOCAL' : result.channel === 'visio' ? 'VISIO IA LOCALE' : result.channel === 'video' ? 'VIDÉO PROPOSÉE' : 'MONIA LOCAL';
  const body = result.channel === 'voice'
    ? voiceMarkup(result.spokenText || result.text)
    : result.channel === 'visio'
      ? visioMarkup(result)
      : `<p>${safeHTML(result.text)}</p>`;
  article.innerHTML = `<b>Lucas</b>${body}<small>${label} · ${safeHTML(result.emotion)}</small>`;
  thread.prepend(article);
  document.querySelector('.smsPending')?.remove();
}

function chooseLocalVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const score = (voice: SpeechSynthesisVoice) => {
    const lang = voice.lang.toLowerCase();
    const name = voice.name.toLowerCase();
    let points = 0;
    if (lang === 'fr-fr') points += 100;
    else if (lang.startsWith('fr')) points += 80;
    else if (lang === 'es-es') points += 35;
    if (voice.localService) points += 20;
    if (/natural|premium|enhanced/.test(name)) points += 15;
    return points;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
}

function speakLocal(text: string, button?: HTMLButtonElement | null) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  const clean = text.trim();
  if (!clean) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.96;
  utterance.pitch = 0.9;
  const voice = chooseLocalVoice();
  if (voice) utterance.voice = voice;
  if (button) button.textContent = '■';
  const restore = () => { if (button) button.textContent = '▶'; };
  utterance.onend = restore;
  utterance.onerror = restore;
  window.speechSynthesis.speak(utterance);
}

function closeVisio() {
  window.speechSynthesis?.cancel();
  document.getElementById('moniaVisioOverlay')?.remove();
}

function openVisio(result: MonIADirectorResult) {
  closeVisio();
  const scene = result.scene;
  const overlay = document.createElement('div');
  overlay.id = 'moniaVisioOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#090807;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:inherit;color:white';
  const framing = safeHTML(scene?.framing || 'caméra téléphone, plan poitrine naturel');
  const location = safeHTML(scene?.location || 'Visio avec Lucas');
  const action = safeHTML(scene?.action || 'Lucas réagit naturellement');
  const duration = Math.max(4, Math.min(30, scene?.duration || 8));
  overlay.innerHTML = `<div style="position:absolute;inset:0;overflow:hidden"><video id="moniaVisioVideo" src="./resources/lucas-intro.mp4" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;transform:scale(1.035);animation:moniaVisioFloat 8s ease-in-out infinite alternate"></video><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42),transparent 35%,rgba(0,0,0,.68))"></div></div><style>@keyframes moniaVisioFloat{from{transform:scale(1.035) translate3d(-.3%,0,0)}to{transform:scale(1.065) translate3d(.3%,-.3%,0)}}</style><div style="position:absolute;top:22px;left:24px;right:24px;display:flex;justify-content:space-between;align-items:flex-start;text-shadow:0 2px 12px #000"><div><small style="letter-spacing:.18em">VISIO · MONIA LOCAL</small><h2 style="margin:.35rem 0 0;font-size:1.35rem">Lucas</h2><span style="opacity:.75;font-size:.82rem">${location}</span></div><button id="closeMoniaVisio" style="border:0;border-radius:999px;width:44px;height:44px;background:rgba(0,0,0,.52);color:#fff;font-size:24px;cursor:pointer">×</button></div><div style="position:absolute;left:24px;right:24px;bottom:24px;max-width:720px;margin:auto;background:rgba(12,10,9,.62);backdrop-filter:blur(12px);padding:18px 20px;border-radius:20px;border:1px solid rgba(255,255,255,.14)"><small style="opacity:.68">${framing} · ${duration}s · ${safeHTML(result.emotion)}</small><p style="font-size:1.08rem;line-height:1.45;margin:.55rem 0">${safeHTML(result.spokenText || result.text)}</p><span style="opacity:.65;font-size:.8rem">${action}</span><div style="display:flex;gap:10px;margin-top:14px"><button id="replayMoniaVoice" style="border:0;border-radius:999px;padding:10px 16px;cursor:pointer">▶ Réécouter</button><button id="endMoniaVisio" style="border:0;border-radius:999px;padding:10px 16px;background:#a33131;color:white;cursor:pointer">Raccrocher</button></div></div>`;
  document.body.appendChild(overlay);
  const close = () => closeVisio();
  document.getElementById('closeMoniaVisio')?.addEventListener('click', close);
  document.getElementById('endMoniaVisio')?.addEventListener('click', close);
  document.getElementById('replayMoniaVoice')?.addEventListener('click', () => speakLocal(result.spokenText || result.text));
  window.setTimeout(() => speakLocal(result.spokenText || result.text), 350);
}

function loadLastVisio() {
  try {
    const raw = sessionStorage.getItem(VISIO_KEY);
    return raw ? JSON.parse(raw) as MonIADirectorResult : null;
  } catch {
    return null;
  }
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

  if (result.channel === 'visio') {
    try { sessionStorage.setItem(VISIO_KEY, JSON.stringify(result)); } catch { /* storage optional */ }
  }

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
  const visioButton = target?.closest('[data-monia-visio]') as HTMLButtonElement | null;
  if (visioButton) {
    event.preventDefault();
    event.stopPropagation();
    const result = loadLastVisio();
    if (result) openVisio(result);
    return;
  }

  const voiceButton = target?.closest('.voiceNote button') as HTMLButtonElement | null;
  if (voiceButton) {
    event.preventDefault();
    event.stopPropagation();
    const article = voiceButton.closest('.msg');
    const transcript = article?.querySelector('.voiceTranscript')?.textContent || '';
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
      voiceButton.textContent = '▶';
    } else {
      speakLocal(transcript, voiceButton);
    }
    return;
  }

  if (!target?.closest('#sendSms')) return;
  const input = document.getElementById('smsComposer') as HTMLTextAreaElement | null;
  if (input) scheduleFromComposer(input.value);
}, true);

document.addEventListener('keydown', event => {
  const target = event.target as HTMLTextAreaElement | null;
  if (!target || target.id !== 'smsComposer') return;
  if (event.key === 'Enter' && !event.shiftKey) scheduleFromComposer(target.value);
}, true);

if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

console.info('[MonIA] Director SMS + local voice + animated visio integration active');
