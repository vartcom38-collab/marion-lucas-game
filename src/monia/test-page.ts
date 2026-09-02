import { monia } from './runtime';
import { inferMessageTone, type MonIAChannel, type MonIADirectorResult, type MonIAMessageTone } from './director';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = $('msg') as HTMLTextAreaElement;
const place = $('place') as HTMLInputElement;
const time = $('time') as HTMLInputElement;
const relationship = $('relationship') as HTMLSelectElement;
const answer = $('answer');
const raw = $('raw');
const engine = $('engine');
const diagnostics = $('diagnostics');
const audioZone = $('audioZone');

let lastResult: MonIADirectorResult | null = null;
let currentTone: MonIAMessageTone = 'neutral';

const toneLabels: Record<MonIAMessageTone, string> = {
  neutral: 'neutre',
  tender: 'tendre',
  playful: 'taquin',
  worried: 'inquiet',
  jealous: 'jaloux / inquiet',
  hurt: 'blessé / vexé',
  angry: 'énervé',
  distant: 'distant',
  urgent: 'urgent',
};

function engineStatusText(prefix = 'Moteur') {
  const status = monia.getStatus();
  const progress = status.progress ? ` · ${Math.round(Math.max(0, Math.min(100, status.progress)))}%` : '';
  return `${prefix} : ${status.status} · ${status.label}${progress} · Sous-texte : ${toneLabels[currentTone]}`;
}

function setBusy(channel: string, text: string) {
  currentTone = inferMessageTone(text);
  engine.textContent = `MonIA locale · ${channel}`;
  engine.dataset.state = 'loading';
  answer.textContent = 'Réflexion locale en cours…';
  raw.textContent = 'Chargement du modèle / génération…';
  audioZone.innerHTML = '';
  diagnostics.textContent = engineStatusText();
}

function chooseLocalVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const french = voices.filter(v => v.lang.toLowerCase().startsWith('fr'));
  const localFrench = french.filter(v => v.localService);
  return localFrench[0] || french[0] || voices[0] || null;
}

function playVoice(text: string, button?: HTMLButtonElement | null) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    diagnostics.textContent = `Audio navigateur indisponible sur cet appareil. · Sous-texte : ${toneLabels[currentTone]}`;
    return;
  }
  const clean = text.trim();
  if (!clean) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.96;
  utterance.pitch = 0.9;
  const voice = chooseLocalVoice();
  if (voice) utterance.voice = voice;
  if (button) button.textContent = '■ Lecture…';
  const restore = () => { if (button) button.textContent = '▶ Écouter le vocal'; };
  utterance.onend = restore;
  utterance.onerror = restore;
  window.speechSynthesis.speak(utterance);
}

function renderAudio(result: MonIADirectorResult) {
  audioZone.innerHTML = '';
  if (result.channel !== 'voice') return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary audioPlay';
  button.textContent = '▶ Écouter le vocal';
  button.addEventListener('click', () => playVoice(result.spokenText || result.text, button));
  audioZone.appendChild(button);

  const note = document.createElement('small');
  note.className = 'status';
  note.textContent = 'Touche ce bouton pour écouter le vocal généré.';
  audioZone.appendChild(note);
}

function renderResult(result: MonIADirectorResult) {
  lastResult = result;
  engine.textContent = `MonIA locale · ${result.source}`;
  engine.dataset.state = result.source;
  answer.textContent = result.spokenText || result.text;
  raw.textContent = JSON.stringify({ detectedTone: currentTone, ...result }, null, 2);
  renderAudio(result);

  if (result.source === 'fallback') {
    diagnostics.textContent = `⚠ Réponse de secours. ${engineStatusText('État moteur')}`;
  } else {
    diagnostics.textContent = `✓ Réponse générée par le modèle local. · Sous-texte : ${toneLabels[currentTone]}`;
  }
}

async function run(channel: MonIAChannel) {
  const text = msg.value.trim() || 'Tu fais quoi là ?';
  setBusy(channel, text);
  try {
    const result = await monia.direct({
      actor: 'Lucas',
      playerText: text,
      requestedChannel: channel,
      context: {
        speaker: 'Marion',
        place: place.value || 'Nîmes',
        time: time.value || '20:30',
        day: 1,
        recentAction: `Test libre MonIA: ${text}`,
        activeObjective: 'Répondre naturellement à Marion dans un environnement de test sans modifier le scénario du jeu',
        relationship: relationship.value,
        memories: ['Contexte de test isolé du scénario principal.'],
        recentEvents: [],
        rules: [
          'Ne jamais révéler un événement futur ou une surprise du jeu.',
          'Lucas reste absolument fidèle.',
          'Répondre comme Lucas, pas comme un assistant.',
          'Ne jamais écrire la réponse de Marion.',
          'Cette page est un bac à sable: ne pas inventer de nouvel événement canon majeur.',
        ],
      },
      availableMedia: ['lucas-intro.mp4'],
    }, 'auto', true);

    renderResult(result);
  } catch (error) {
    engine.textContent = 'Erreur';
    engine.dataset.state = 'error';
    answer.textContent = 'Le test a échoué.';
    raw.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    diagnostics.textContent = `Une erreur JavaScript a interrompu le test. · Sous-texte : ${toneLabels[currentTone]}`;
  }
}

monia.observe(() => {
  diagnostics.textContent = engineStatusText();
});

document.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach(button => {
  button.addEventListener('click', () => void run(button.dataset.channel as MonIAChannel));
});

msg.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void run('text');
});

if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

void lastResult;
