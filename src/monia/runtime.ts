import './surprise-approval';
import './surprise-player';
import './surprise-aftermath';
import './cinematic-approval-guard';
import './early-game-phone-guard';
import './iphone-shell';
import './iphone-interactions';
import './iphone-notifications';
import './life-media-director';
import './commitment-readiness';
import './taurine-life-layer';
import './media-life-layer';
import './family-life-layer';
import './intimacy-life-layer';
import './conception-bridge';
import './france-spain-life-transition';
import './spain-life-engine';
import './madrid-home-life';
import './residence-base-life';
import './long-stay-routine-life';
import './shared-home-life';
import './property-agency-ui';
import './finca-home-life';
import './finca-scene-ambient';
import './finca-life-moments';
import './life-timeline-engine';
import './rare-life-events';
import { MARION_LUCAS_PROFILE, narrationPrompt, type MonIACompactContext } from './profile';
import { moniaStorage } from './storage';
import { askMonIAServerBrain } from './server-brain';
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
  const list = FALLBACKS[action] || ['La journée continue avec son propre rythme.'];
  const narration = list[Math.floor(Math.random() * list.length)] || list[0];
  return { narration, memory: narration, objective: null, source: 'fallback' };
}

function compactContext(context: any): MonIACompactContext {
  return {
    action: String(context?.action || 'idle'),
    place: String(context?.place || ''),
    time: String(context?.time || ''),
    day: Number(context?.day || 1),
    relationship: Number(context?.relationship || 0),
    trust: Number(context?.trust || 0),
    chemistry: Number(context?.chemistry || 0),
    stress: Number(context?.stress || 0),
    energy: Number(context?.energy || 0),
    official: Boolean(context?.official),
    metLucas: Boolean(context?.metLucas),
    memories: Array.isArray(context?.memories) ? context.memories.slice(0, 8).map(String) : [],
  };
}

class MonIARuntime {
  mode: MonIAMode = 'auto';
  status: MonIAStatus = { status: 'idle', progress: 0, label: 'MonIA prête' };
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private listeners = new Set<(s: MonIAStatus) => void>();

  constructor() {
    const saved = moniaStorage.getSettings();
    this.mode = (saved.mode as MonIAMode) || 'auto';
  }

  subscribe(fn: (s: MonIAStatus) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(status: MonIAStatus) {
    this.status = status;
    this.listeners.forEach((fn) => fn(status));
  }

  private supportsWorker() {
    return typeof Worker !== 'undefined';
  }

  async init() {
    if (this.worker || this.status.status === 'loading') return;
    if (!this.supportsWorker()) {
      this.setStatus({ status: 'unsupported', progress: 0, label: 'Mode léger' });
      return;
    }
    this.setStatus({ status: 'loading', progress: 5, label: 'MonIA se prépare…' });
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev) => this.onMessage(ev.data);
      this.worker.onerror = () => {
        this.setStatus({ status: 'error', progress: 0, label: 'MonIA locale indisponible' });
      };
      this.worker.postMessage({ type: 'init', mode: this.mode });
    } catch {
      this.worker = null;
      this.setStatus({ status: 'error', progress: 0, label: 'MonIA locale indisponible' });
    }
  }

  private onMessage(msg: any) {
    if (msg?.type === 'status') {
      this.setStatus(msg.status as MonIAStatus);
      return;
    }
    if (msg?.type === 'result') {
      const p = this.pending.get(Number(msg.id));
      if (!p) return;
      this.pending.delete(Number(msg.id));
      if (p.kind === 'narration') p.resolve(msg.result as MonIAResult);
      else p.resolve(msg.result as MonIADirectorResult);
    }
  }

  async narrate(action: string, context: any): Promise<MonIAResult> {
    const compact = compactContext({ ...context, action });
    const fb = fallback(action);
    if (this.mode === 'light') return fb;
    try {
      const server = await askMonIAServerBrain({ kind: 'narration', prompt: narrationPrompt(compact), profile: MARION_LUCAS_PROFILE });
      if (server?.narration) return { narration: server.narration, memory: server.memory || server.narration, objective: server.objective || null, source: 'local' };
    } catch {}
    if (!this.worker || this.status.status !== 'ready') return fb;
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, { kind: 'narration', resolve, fallback: fb, context: compact });
      this.worker!.postMessage({ type: 'narrate', id, prompt: narrationPrompt(compact), fallback: fb });
      window.setTimeout(() => {
        const p = this.pending.get(id);
        if (!p || p.kind !== 'narration') return;
        this.pending.delete(id);
        resolve(fb);
      }, 4500);
    });
  }

  async direct(request: MonIADirectorRequest): Promise<MonIADirectorResult> {
    const fb = fallbackDirector(request);
    try {
      const server = await askMonIAServerBrain({ kind: 'director', prompt: directorPrompt(request), profile: MARION_LUCAS_PROFILE });
      if (server) {
        const parsed = parseDirectorJSON(server);
        if (parsed) return parsed;
      }
    } catch {}
    if (this.mode === 'light' || !this.worker || this.status.status !== 'ready') return fb;
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, { kind: 'director', resolve, fallback: fb, request });
      this.worker!.postMessage({ type: 'direct', id, prompt: directorPrompt(request), fallback: fb });
      window.setTimeout(() => {
        const p = this.pending.get(id);
        if (!p || p.kind !== 'director') return;
        this.pending.delete(id);
        resolve(fb);
      }, 5000);
    });
  }
}

export const moniaRuntime = new MonIARuntime();

if (typeof window !== 'undefined') {
  (window as any).__moniaRuntime = moniaRuntime;
  window.setTimeout(() => moniaRuntime.init(), 250);
}
