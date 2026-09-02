import { monia } from './runtime';
import type { MonIAChannel } from './director';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = $('msg') as HTMLTextAreaElement;
const place = $('place') as HTMLInputElement;
const time = $('time') as HTMLInputElement;
const relationship = $('relationship') as HTMLSelectElement;
const answer = $('answer');
const raw = $('raw');
const engine = $('engine');

function setBusy(channel: string) {
  engine.textContent = `MonIA locale · ${channel}`;
  answer.textContent = 'Réflexion locale en cours…';
  raw.textContent = 'Chargement du modèle / génération…';
}

async function run(channel: MonIAChannel) {
  const text = msg.value.trim() || 'Tu fais quoi là ?';
  setBusy(channel);
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

    engine.textContent = `MonIA locale · ${result.source}`;
    answer.textContent = result.spokenText || result.text;
    raw.textContent = JSON.stringify(result, null, 2);

    if (channel === 'voice' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(result.spokenText || result.text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.96;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  } catch (error) {
    engine.textContent = 'Erreur';
    answer.textContent = 'Le test a échoué.';
    raw.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach(button => {
  button.addEventListener('click', () => void run(button.dataset.channel as MonIAChannel));
});

msg.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void run('text');
});
