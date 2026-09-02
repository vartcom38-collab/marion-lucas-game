import { monia } from './runtime';
import { inferMessageTone, type MonIAChannel, type MonIADirectorResult, type MonIAMessageTone } from './director';
import { planDrama } from './drama-planner';
import type { MonIADramaPlan } from './drama';
import { moniaVideo, type MonIAVideoRender } from './video-engine';

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
const renderDrama = $('renderDrama') as HTMLButtonElement;
const runnerStatus = $('runnerStatus');
const renderProgress = $('renderProgress');

let lastResult: MonIADirectorResult | null = null;
let lastDramaPlan: MonIADramaPlan | null = null;
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
  raw.textContent = channel === 'scene' ? 'Création des plans, dialogues, réactions et prompts vidéo…' : 'Chargement du modèle / génération…';
  audioZone.innerHTML = '';
  if (channel === 'scene') {
    lastDramaPlan = null;
    renderDrama.disabled = true;
    renderProgress.textContent = '';
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
  const note = document.createElement('small'); note.className = 'status'; note.textContent = 'Touche ce bouton pour écouter le vocal généré.';
  audioZone.appendChild(note);
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
    context: testContext(text), availableMedia: ['lucas-intro.mp4','appartement-nimes.png'],
  }, true);
  lastDramaPlan = plan;
  renderDrama.disabled = false;
  engine.textContent = `MonIA Drama · ${plan.source}`;
  engine.dataset.state = plan.source;
  answer.textContent = `${plan.shots.length} plans · ${plan.targetDuration}s · ${plan.rhythm} · ${plan.location}`;
  raw.textContent = JSON.stringify(plan, null, 2);
  audioZone.innerHTML = '';
  diagnostics.textContent = plan.source === 'fallback' ? `⚠ Storyboard de secours. ${engineStatusText('État moteur')}` : `✓ Storyboard drama généré par MonIA. ${plan.shots.length} prompts vidéo prêts.`;
}

function renderVideoState(render: MonIAVideoRender) {
  engine.textContent = `MonIA Video · ${render.state}`;
  engine.dataset.state = render.state;
  const lines = render.jobs.map(job => `${job.shotId} · ${job.state} · ${Math.round(job.progress)}%`);
  renderProgress.textContent = lines.join('\n');
  if (render.error) diagnostics.textContent = `⚠ ${render.error}`;
  if (render.state === 'runner-offline') runnerStatus.textContent = 'Runner vidéo : hors ligne';
  if (render.state === 'rendering') runnerStatus.textContent = 'Runner vidéo : rendu en cours';
  if (render.state === 'ready') {
    runnerStatus.textContent = 'Runner vidéo : vidéo prête';
    renderDrama.disabled = false;
    if (render.finalUrl) {
      const src = render.finalUrl.startsWith('http') ? render.finalUrl : `${moniaVideo.getRunner()}${render.finalUrl}`;
      videoZone.innerHTML = '';
      const video = document.createElement('video');
      video.controls = true; video.playsInline = true; video.src = src;
      videoZone.appendChild(video);
    }
  }
  if (render.state === 'error') renderDrama.disabled = false;
}

async function startVideoRender() {
  if (!lastDramaPlan) return;
  renderDrama.disabled = true;
  videoZone.innerHTML = '';
  renderProgress.textContent = 'Connexion au MonIA Video Runner…';
  const render = await moniaVideo.render(lastDramaPlan);
  renderVideoState(render);
}

async function refreshRunner() {
  const health = await moniaVideo.health();
  if (!health) {
    runnerStatus.textContent = 'Runner vidéo : hors ligne';
    return;
  }
  runnerStatus.textContent = health.backendConfigured ? 'Runner vidéo : prêt' : 'Runner vidéo : connecté, backend à configurer';
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
moniaVideo.observe(renderVideoState);
renderDrama.addEventListener('click', () => void startVideoRender());
document.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach(button => { button.addEventListener('click', () => void run(button.dataset.channel as MonIAChannel)); });
msg.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void run('text'); });
if ('speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); }
void refreshRunner();
void lastResult;
