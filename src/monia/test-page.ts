import { monia } from './runtime';
import { inferMessageTone, type MonIAChannel, type MonIADirectorResult, type MonIAMessageTone } from './director';
import { planDrama } from './drama-planner';
import type { MonIADramaPlan } from './drama';
import { composeDramaStudio, type DramaStudioComposition } from './drama-studio';
import { moniaDramaPlayer } from './drama-player';

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
const videoZone = $('videoZone');
const playDrama = $('playDrama') as HTMLButtonElement;
const studioStatus = $('studioStatus');
const studioProgress = $('studioProgress');

let lastResult: MonIADirectorResult | null = null;
let lastDramaPlan: MonIADramaPlan | null = null;
let lastComposition: DramaStudioComposition | null = null;
let currentTone: MonIAMessageTone = 'neutral';

const toneLabels: Record<MonIAMessageTone, string> = {
  neutral: 'neutre', tender: 'tendre', playful: 'taquin', worried: 'inquiet', jealous: 'jaloux / inquiet',
  hurt: 'blessé / vexé', angry: 'énervé', distant: 'distant', urgent: 'urgent',
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
  answer.textContent = channel === 'scene' ? 'MonIA prépare le storyboard drama…' : 'Réflexion locale en cours…';
  raw.textContent = channel === 'scene' ? 'Création des plans puis composition avec la bibliothèque interne…' : 'Chargement du modèle / génération…';
  audioZone.innerHTML = '';
  if (channel === 'scene') {
    moniaDramaPlayer.stop();
    lastDramaPlan = null;
    lastComposition = null;
    playDrama.disabled = true;
    studioProgress.textContent = '';
    videoZone.innerHTML = '';
  }
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
  utterance.lang = 'fr-FR'; utterance.rate = 0.96; utterance.pitch = 0.9;
  const voice = chooseLocalVoice(); if (voice) utterance.voice = voice;
  if (button) button.textContent = '■ Lecture…';
  const restore = () => { if (button) button.textContent = '▶ Écouter le vocal'; };
  utterance.onend = restore; utterance.onerror = restore;
  window.speechSynthesis.speak(utterance);
}

function renderAudio(result: MonIADirectorResult) {
  audioZone.innerHTML = '';
  if (result.channel !== 'voice') return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'primary audioPlay'; button.textContent = '▶ Écouter le vocal';
  button.addEventListener('click', () => playVoice(result.spokenText || result.text, button));
  audioZone.appendChild(button);
}

function renderResult(result: MonIADirectorResult) {
  lastResult = result;
  engine.textContent = `MonIA locale · ${result.source}`;
  engine.dataset.state = result.source;
  answer.textContent = result.spokenText || result.text;
  raw.textContent = JSON.stringify({ detectedTone: currentTone, ...result }, null, 2);
  renderAudio(result);
  diagnostics.textContent = result.source === 'fallback'
    ? `⚠ Réponse de secours. ${engineStatusText('État moteur')}`
    : `✓ Réponse générée par le modèle local. · Sous-texte : ${toneLabels[currentTone]}`;
}

function testContext(text: string) {
  return {
    speaker: 'Marion', place: place.value || 'Nîmes', time: time.value || '20:30', day: 1,
    recentAction: `Test libre MonIA: ${text}`,
    activeObjective: 'Répondre naturellement à Marion dans un environnement de test sans modifier le scénario du jeu',
    relationship: relationship.value,
    memories: ['Contexte de test isolé du scénario principal.'], recentEvents: [],
    rules: ['Ne jamais révéler un événement futur ou une surprise du jeu.','Lucas reste absolument fidèle.','Répondre comme Lucas, pas comme un assistant.','Ne jamais écrire la réponse de Marion.','Cette page est un bac à sable: ne pas inventer de nouvel événement canon majeur.'],
  };
}

async function runDrama(text: string) {
  const plan = await planDrama({
    title: 'Test drama MonIA', premise: text, actors: ['Marion','Lucas'], targetDuration: 28, format: '9:16',
    context: testContext(text), availableMedia: ['lucas-intro.mp4','marion-nimes.mp4','appartement-nimes.png'],
  }, true);
  const composition = composeDramaStudio(plan);
  lastDramaPlan = plan;
  lastComposition = composition;
  playDrama.disabled = !composition.playable;
  engine.textContent = `MonIA Drama Studio · ${plan.source}`;
  engine.dataset.state = composition.playable ? 'ready' : 'fallback';
  answer.textContent = `${plan.shots.length} plans · ${plan.targetDuration}s · couverture visuelle ${composition.coverage}%`;
  raw.textContent = JSON.stringify({ storyboard: plan, studio: composition }, null, 2);
  audioZone.innerHTML = '';
  studioStatus.textContent = composition.playable ? 'Studio interne : scène jouable' : 'Studio interne : bibliothèque encore incomplète';
  studioProgress.textContent = composition.missingShotIds.length
    ? `Plans sans brique adaptée : ${composition.missingShotIds.join(', ')}`
    : 'Tous les plans ont une brique visuelle serveur.';
  diagnostics.textContent = composition.playable
    ? `✓ Storyboard composé avec la bibliothèque MonIA interne. Couverture ${composition.coverage}%.`
    : `⚠ Storyboard prêt, mais couverture ${composition.coverage}% : il faut enrichir la bibliothèque visuelle avant une lecture complète.`;
}

async function playStudioDrama() {
  if (!lastComposition?.playable) return;
  playDrama.disabled = true;
  studioStatus.textContent = 'Studio interne : lecture en cours';
  await moniaDramaPlayer.play(lastComposition, videoZone);
  playDrama.disabled = false;
  studioStatus.textContent = 'Studio interne : lecture terminée';
}

async function run(channel: MonIAChannel) {
  const text = msg.value.trim() || 'Tu fais quoi là ?';
  setBusy(channel, text);
  try {
    if (channel === 'scene') { await runDrama(text); return; }
    const result = await monia.direct({actor:'Lucas',playerText:text,requestedChannel:channel,context:testContext(text),availableMedia:['lucas-intro.mp4']}, 'auto', true);
    renderResult(result);
  } catch (error) {
    engine.textContent = 'Erreur'; engine.dataset.state = 'error'; answer.textContent = 'Le test a échoué.';
    raw.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    diagnostics.textContent = `Une erreur JavaScript a interrompu le test. · Sous-texte : ${toneLabels[currentTone]}`;
  }
}

monia.observe(() => { diagnostics.textContent = engineStatusText(); });
playDrama.addEventListener('click', () => void playStudioDrama());
document.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach(button => { button.addEventListener('click', () => void run(button.dataset.channel as MonIAChannel)); });
msg.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void run('text'); });
if ('speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); }
void lastDramaPlan;
void lastResult;
