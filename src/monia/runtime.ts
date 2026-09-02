import { MARION_LUCAS_PROFILE, narrationPrompt, type MonIACompactContext } from './profile';
import { moniaStorage } from './storage';
import {
  directorPrompt,
  fallbackDirector,
  parseDirectorJSON,
  type MonIADirectorRequest,
  type MonIADirectorResult,
} from './director';

export type MonIAMode = 'auto' | 'light' | 'advanced';
export type MonIAStatus = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';
  progress: number;
  label: string;
};
export type MonIAResult = {
  narration: string;
  memory: string;
  objective: string | null;
  source: 'local' | 'fallback';
};

type NarrationPending = {
  kind: 'narration';
  resolve: (v: MonIAResult) => void;
  fallback: MonIAResult;
  context: MonIACompactContext;
};

type DirectorPending = {
  kind: 'director';
  resolve: (v: MonIADirectorResult) => void;
  fallback: MonIADirectorResult;
  request: MonIADirectorRequest;
};

type Pending = NarrationPending | DirectorPending;

const FALLBACKS: Record<string, string[]> = {
  breakfast: ['La cuisine prend doucement le rythme du matin. Pendant quelques minutes, l’appartement ressemble déjà un peu plus à une vraie journée qu’à un décor.'],
  sofa: ['Le calme du salon absorbe une partie du bruit de la journée. Rien d’urgent ne vient réclamer ces quelques minutes.'],
  balcony: ['Dehors, Nîmes continue sans attendre. L’air du balcon remet un peu de distance entre Marion et ce qui tournait encore dans sa tête.'],
  readHome: ['Quelques pages suffisent à ralentir le temps dans le salon.'],
  musicHome: ['La musique change discrètement la présence de l’appartement, sans demander autre chose.'],
  cafeHome: ['L’odeur du café s’installe avant même que la journée ait vraiment choisi son rythme.'],
  tidyHome: ['À force de déplacer, ranger et remettre les choses à leur place, l’appartement devient un peu moins neutre.'],
  tidyKitchen: ['La cuisine retrouve son calme, geste après geste.'],
  cookSolo: ['La préparation prend son temps, avec seulement les bruits ordinaires de la cuisine autour.'],
  balconyCoffee: ['La tasse reste chaude entre les mains pendant que la ville bouge en contrebas.'],
  sunsetPause: ['La lumière sur Nîmes change assez vite pour donner l’impression que la journée vient de tourner une page.'],
};

function fallback(action: string): MonIAResult {
  const pool = FALLBACKS[action] || ['Le moment passe simplement, mais il laisse une petite trace dans le rythme de la journée.'];
  return { narration: pool[0], memory: '', objective: null, source: 'fallback' };
}

function parseNarrationJSON(raw: string) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    if (typeof v?.narration !== 'string' || v.narration.length < 3 || v.narration.length > 500) return null;
    return {
      narration: v.narration.trim(),
      memory: typeof v.memory === 'string' ? v.memory.trim().slice(0, 180) : '',
      objective: typeof v.objective === 'string' ? v.objective.trim().slice(0, 100) : null,
    } as const;
  } catch {
    return null;
  }
}

class MonIARuntime {
  readonly profile = MARION_LUCAS_PROFILE;
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Set<(s: MonIAStatus) => void>();
  private state: MonIAStatus = { status: 'idle', progress: 0, label: 'Prête à charger à la première utilisation' };

  isSupported() {
    return typeof Worker !== 'undefined' && typeof indexedDB !== 'undefined' && typeof WebAssembly !== 'undefined';
  }

  observe(fn: (s: MonIAStatus) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getStatus() {
    return this.state;
  }

  private setState(s: MonIAStatus) {
    this.state = s;
    this.listeners.forEach(fn => fn(s));
  }

  private ensureWorker() {
    if (this.worker) return this.worker;
    if (!this.isSupported()) {
      this.setState({ status: 'unsupported', progress: 0, label: 'Moteur local incompatible sur cet appareil · secours actif' });
      return null;
    }

    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = e => {
      const m = e.data || {};
      if (m.type === 'status') {
        this.setState({ status: m.status, progress: Number(m.progress || 0), label: String(m.label || '') });
        return;
      }

      const id = String(m.id || '');
      const pending = this.pending.get(id);
      if (!pending) return;

      if (m.type === 'error') {
        this.pending.delete(id);
        pending.resolve(pending.fallback as never);
        return;
      }

      if (m.type !== 'result') return;
      this.pending.delete(id);
      const raw = String(m.text || '');

      if (pending.kind === 'narration') {
        const parsed = parseNarrationJSON(raw);
        if (!parsed) {
          pending.resolve(pending.fallback);
          return;
        }
        const result: MonIAResult = { ...parsed, source: 'local' };
        if (result.memory) {
          void moniaStorage.put({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            kind: 'action',
            text: result.memory,
            day: pending.context.day,
            time: pending.context.time,
            actors: [pending.context.speaker],
            createdAt: Date.now(),
          });
        }
        pending.resolve(result);
        return;
      }

      const parsed = parseDirectorJSON(raw, pending.fallback);
      const result = parsed || pending.fallback;
      if (result.memory) {
        void moniaStorage.put({
          id: `director-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: 'dialogue',
          text: result.memory,
          day: pending.request.context.day,
          time: pending.request.context.time,
          actors: ['Marion', pending.request.actor],
          createdAt: Date.now(),
        });
      }
      pending.resolve(result);
    };

    w.onerror = () => this.setState({ status: 'error', progress: 0, label: 'Erreur du moteur local · secours actif' });
    this.worker = w;
    return w;
  }

  async narrate(context: MonIACompactContext, mode: MonIAMode, enabled: boolean) {
    const safe = fallback(context.recentAction);
    await moniaStorage.put({
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: 'action',
      text: `${context.place} · ${context.recentAction}`,
      day: context.day,
      time: context.time,
      actors: [context.speaker],
      createdAt: Date.now(),
    }).catch(() => undefined);

    if (!enabled) return safe;
    const w = this.ensureWorker();
    if (!w) return safe;

    return new Promise<MonIAResult>(resolve => {
      const id = Math.random().toString(36).slice(2);
      this.pending.set(id, { kind: 'narration', resolve, fallback: safe, context });
      w.postMessage({ type: 'generate', id, mode, task: 'narration', prompt: narrationPrompt(context) });
    });
  }

  async direct(request: MonIADirectorRequest, mode: MonIAMode = 'auto', enabled = true) {
    const safe = fallbackDirector(request);
    await moniaStorage.put({
      id: `dialogue-in-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: 'dialogue',
      text: request.playerText ? `Marion → ${request.actor}: ${request.playerText}` : `Interaction avec ${request.actor}`,
      day: request.context.day,
      time: request.context.time,
      actors: ['Marion', request.actor],
      createdAt: Date.now(),
    }).catch(() => undefined);

    if (!enabled) return safe;
    const w = this.ensureWorker();
    if (!w) return safe;

    return new Promise<MonIADirectorResult>(resolve => {
      const id = Math.random().toString(36).slice(2);
      this.pending.set(id, { kind: 'director', resolve, fallback: safe, request });
      w.postMessage({ type: 'generate', id, mode, task: 'director', prompt: directorPrompt(request) });
    });
  }

  async recentMemories(limit = 16) {
    return moniaStorage.recent(limit);
  }

  async relevantMemories(text: string, day: number, actors: string[] = ['Marion', 'Lucas'], limit = 10) {
    return moniaStorage.relevant({ text, day, actors, limit });
  }

  release() {
    this.worker?.postMessage({ type: 'release' });
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.setState({ status: 'idle', progress: 0, label: 'Modèle libéré · il se rechargera à la prochaine utilisation' });
  }
}

export const monia = new MonIARuntime();
export type { MonIADirectorRequest, MonIADirectorResult } from './director';
