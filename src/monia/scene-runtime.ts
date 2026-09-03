import { monia } from './runtime';
import type { MonIADirectorRequest, MonIADirectorResult } from './director';
import { planDrama } from './drama-planner';
import { composeDramaStudio } from './drama-studio';
import { moniaDramaPlayer } from './drama-player';

const SAVE_KEY = 'marion-lucas-save-v4';
const SEEN_KEY = 'monia-scene-seen-v1';
const ACTIVE_ID = 'moniaDramaScene';
const TOAST_ID = 'moniaSceneOffer';

type LooseSave = {
  day?: number;
  time?: string;
  place?: string;
  relationship?: number;
  messages?: Array<{ from: string; text: string; day: number; read: boolean }>;
  memories?: string[];
  eventHistory?: string[];
  flags?: Record<string, string | number | boolean>;
};

type DirectorSnapshot = {
  channel?: string;
  emotion?: string;
  scene?: MonIADirectorResult['scene'];
  source?: string;
  at?: string;
};

function safe(value: string) {
  return value.replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}

function readSave(): LooseSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as LooseSave : null;
  } catch {
    return null;
  }
}

function chooseVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang.toLowerCase() === 'fr-fr' && v.localService)
    || voices.find(v => v.lang.toLowerCase().startsWith('fr'))
    || voices[0]
    || null;
}

function speak(text: string) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  const clean = text.trim();
  if (!clean) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.94;
  utterance.pitch = 0.9;
  const voice = chooseVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function closeScene() {
  moniaDramaPlayer.stop();
  window.speechSynthesis?.cancel();
  document.getElementById(ACTIVE_ID)?.remove();
}

function mediaForScene(scene: MonIADirectorResult['scene']) {
  const location = (scene?.location || '').toLowerCase();
  if (/nîmes|appartement|marion/.test(location)) {
    return { kind: 'image' as const, src: './resources/appartement-nimes.png' };
  }
  return { kind: 'video' as const, src: './resources/lucas-intro.mp4' };
}

function openFallbackScene(snapshot: DirectorSnapshot, dialogue: string) {
  closeScene();
  const scene = snapshot.scene;
  const duration = Math.max(8, Math.min(30, Number(scene?.duration || 18)));
  const media = mediaForScene(scene);
  const overlay = document.createElement('div');
  overlay.id = ACTIVE_ID;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#080706;color:white;overflow:hidden;font-family:inherit';

  const visual = media.kind === 'video'
    ? `<video id="moniaDramaMedia" src="${media.src}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:moniaDramaCamera 9s ease-in-out infinite alternate"></video>`
    : `<img id="moniaDramaMedia" src="${media.src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:moniaDramaCamera 9s ease-in-out infinite alternate">`;

  overlay.innerHTML = `${visual}<style>@keyframes moniaDramaCamera{0%{transform:scale(1.03) translate3d(-.8%,.2%,0)}45%{transform:scale(1.08) translate3d(.5%,-.4%,0)}100%{transform:scale(1.12) translate3d(-.2%,-.7%,0)}}@keyframes moniaDramaFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}</style><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,.06) 42%,rgba(0,0,0,.78))"></div><div style="position:absolute;inset:0;pointer-events:none;border-top:5vh solid #070605;border-bottom:5vh solid #070605"></div><div style="position:absolute;top:7vh;left:5vw;right:5vw;display:flex;justify-content:space-between;align-items:flex-start;text-shadow:0 2px 14px #000"><div><small style="letter-spacing:.23em;opacity:.8">MONIA · SCÈNE DYNAMIQUE</small><h2 style="font-size:clamp(1.25rem,3vw,2.1rem);margin:.5rem 0 .2rem">${safe(scene?.location || 'Moment')}</h2><span style="opacity:.72">${safe(snapshot.emotion || 'intense')} · ${duration}s</span></div><button id="closeMoniaDrama" style="width:44px;height:44px;border:0;border-radius:50%;background:rgba(0,0,0,.48);color:white;font-size:24px;cursor:pointer">×</button></div><div style="position:absolute;left:7vw;right:7vw;bottom:9vh;max-width:840px;margin:auto;padding:18px 22px;background:rgba(10,8,7,.56);border:1px solid rgba(255,255,255,.14);border-radius:18px;backdrop-filter:blur(12px);animation:moniaDramaFade .65s ease both"><small style="opacity:.7">${safe(scene?.framing || 'plan cinématographique')} · ${safe(scene?.lighting || 'lumière naturelle')}</small><p style="font-size:clamp(1.05rem,2.4vw,1.45rem);line-height:1.5;margin:.6rem 0">${safe(dialogue)}</p><span style="font-size:.85rem;opacity:.66">${safe(scene?.action || 'Le moment se joue naturellement.')}</span><div style="display:flex;gap:10px;margin-top:14px"><button id="replayMoniaDrama" style="border:0;border-radius:999px;padding:10px 16px;cursor:pointer">▶ Réécouter</button><button id="endMoniaDrama" style="border:0;border-radius:999px;padding:10px 16px;background:#8f2929;color:white;cursor:pointer">Terminer la scène</button></div></div>`;

  document.body.appendChild(overlay);
  document.getElementById('closeMoniaDrama')?.addEventListener('click', closeScene);
  document.getElementById('endMoniaDrama')?.addEventListener('click', closeScene);
  document.getElementById('replayMoniaDrama')?.addEventListener('click', () => speak(dialogue));
  window.setTimeout(() => speak(dialogue), 550);
  window.setTimeout(() => {
    if (document.getElementById(ACTIVE_ID)) closeScene();
  }, duration * 1000);
}

function relationLabel(value = 0) {
  if (value >= 70) return 'très proches';
  if (value >= 35) return 'proches';
  if (value >= 10) return 'en rapprochement';
  return 'relation naissante';
}

async function openStudioScene(snapshot: DirectorSnapshot, dialogue: string, save: LooseSave) {
  const scene = snapshot.scene;
  const place = scene?.location || save.place || 'Nîmes';
  try {
    const plan = await planDrama({
      title: 'Scène MonIA',
      premise: `${scene?.action || 'Moment partagé.'} ${dialogue}`.trim(),
      actors: ['Marion', 'Lucas'],
      targetDuration: Math.max(15, Math.min(36, Number(scene?.duration || 24))),
      format: '9:16',
      context: {
        speaker: 'Marion',
        place,
        time: save.time || '20:30',
        day: Number(save.day || 1),
        recentAction: scene?.action || 'Une scène immédiate se joue.',
        activeObjective: 'Jouer uniquement la conséquence immédiate déjà autorisée, sans créer de nouveau tournant narratif.',
        relationship: relationLabel(Number(save.relationship || 0)),
        memories: (save.memories || []).slice(0, 5),
        recentEvents: (save.eventHistory || []).slice(-5),
        rules: [
          'Ne jamais révéler un événement futur ou une surprise du jeu.',
          'Ne jamais décider à la place de Marion.',
          'Lucas reste absolument fidèle.',
          'Ne pas inventer de rendez-vous, voyage, rupture, dispute majeure ou déclaration canonique.',
          'Utiliser uniquement une proximité compatible avec le contexte déjà autorisé.',
        ],
      },
      availableMedia: ['atlas-lucas.webp', 'atlas-marion.webp', 'lucas-intro.mp4', 'marion-nimes.mp4', 'appartement-nimes.png'],
    }, true);

    const composition = composeDramaStudio(plan);
    if (!composition.playable) {
      openFallbackScene(snapshot, dialogue);
      return;
    }

    closeScene();
    const overlay = document.createElement('div');
    overlay.id = ACTIVE_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#070605;color:white;display:grid;place-items:center;padding:18px;font-family:inherit';
    overlay.innerHTML = `<div id="moniaRuntimeDramaMount" style="width:min(100%,520px);height:min(100%,92vh);display:grid;place-items:center"></div><button id="closeMoniaDrama" aria-label="Fermer" style="position:absolute;top:max(18px,env(safe-area-inset-top));right:18px;width:46px;height:46px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:rgba(0,0,0,.5);color:white;font-size:26px;z-index:2">×</button><div style="position:absolute;left:18px;top:max(20px,env(safe-area-inset-top));padding:8px 11px;border-radius:999px;background:rgba(0,0,0,.46);font-size:11px;letter-spacing:.14em">MONIA DRAMA STUDIO · ${composition.coverage}%</div>`;
    document.body.appendChild(overlay);
    document.getElementById('closeMoniaDrama')?.addEventListener('click', closeScene);
    const mount = document.getElementById('moniaRuntimeDramaMount');
    if (!mount) return;
    await moniaDramaPlayer.play(composition, mount);
  } catch {
    openFallbackScene(snapshot, dialogue);
  }
}

function latestSceneText(save: LooseSave) {
  const hit = save.messages?.find(m => m.from === 'Lucas' && m.text.startsWith('🎬 '));
  return hit?.text.replace(/^🎬\s*/, '').trim() || 'Le moment se joue sans un mot de trop.';
}

function offerScene(snapshot: DirectorSnapshot, dialogue: string, save: LooseSave) {
  document.getElementById(TOAST_ID)?.remove();
  const box = document.createElement('div');
  box.id = TOAST_ID;
  box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99998;max-width:min(380px,calc(100vw - 40px));padding:16px 17px;border-radius:18px;background:rgba(20,17,15,.94);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 60px rgba(0,0,0,.35);backdrop-filter:blur(16px);font-family:inherit';
  box.innerHTML = `<small style="letter-spacing:.16em;opacity:.7">MONIA DIRECTOR</small><strong style="display:block;margin:.35rem 0 .45rem">Une scène peut se jouer</strong><span style="display:block;font-size:.88rem;line-height:1.35;opacity:.75">${safe(snapshot.scene?.action || dialogue)}</span><div style="display:flex;gap:9px;margin-top:13px"><button id="playMoniaScene" style="border:0;border-radius:999px;padding:10px 15px;cursor:pointer">▶ Voir la scène</button><button id="dismissMoniaScene" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 15px;background:transparent;color:white;cursor:pointer">Plus tard</button></div>`;
  document.body.appendChild(box);
  document.getElementById('playMoniaScene')?.addEventListener('click', () => {
    box.remove();
    void openStudioScene(snapshot, dialogue, save);
  });
  document.getElementById('dismissMoniaScene')?.addEventListener('click', () => box.remove());
}

let lastSeen = sessionStorage.getItem(SEEN_KEY) || '';
function scanForScene() {
  const save = readSave();
  if (!save?.flags?.moniaLastDirector) return;
  try {
    const snapshot = JSON.parse(String(save.flags.moniaLastDirector)) as DirectorSnapshot;
    if (snapshot.channel !== 'scene' || !snapshot.at || snapshot.at === lastSeen) return;
    lastSeen = snapshot.at;
    sessionStorage.setItem(SEEN_KEY, lastSeen);
    offerScene(snapshot, latestSceneText(save), save);
  } catch {
    // optional runtime: never break the game because of a malformed scene snapshot
  }
}

const originalDirect = monia.direct.bind(monia);
monia.direct = async (request: MonIADirectorRequest, mode = 'auto', enabled = true) => {
  const t = (request.playerText || '').toLowerCase();
  const asksScene = /\b(scène|scene|cinématique|cinematique|drama|mini[- ]?drama)\b/.test(t);
  const next = asksScene && !request.requestedChannel ? { ...request, requestedChannel: 'scene' as const } : request;
  return originalDirect(next, mode, enabled);
};

window.setInterval(scanForScene, 650);
document.addEventListener('visibilitychange', () => { if (!document.hidden) scanForScene(); });
scanForScene();

console.info('[MonIA] Canonical Drama Studio runtime active');
