import type { MonIADramaPlan, MonIADramaShot } from './drama';

export type SceneGenerationShot = {
  id: string;
  status: 'queued' | 'ready' | 'failed';
  shotSize: MonIADramaShot['shotSize'];
  duration: number;
  focusActor: string;
  prompt: string;
  continuityKey: string;
  previousShotId?: string;
};

export type SceneGenerationJob = {
  id: string;
  status: 'candidate-queued' | 'partial' | 'ready' | 'failed';
  createdAt: number;
  route: string;
  approvalRequired: true;
  autoPublish: false;
  continuityKey: string;
  format: '9:16' | '16:9';
  location: string;
  actors: string[];
  shots: SceneGenerationShot[];
};

const KEY = 'monia-scene-generation-queue-v1';

function safeParse(): SceneGenerationJob[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as SceneGenerationJob[] : [];
  } catch {
    return [];
  }
}

function write(jobs: SceneGenerationJob[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(jobs.slice(-12)));
    window.dispatchEvent(new CustomEvent('monia:scene-generation-queue', { detail: jobs }));
  } catch { /* optional */ }
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function queueDramaPlan(plan: MonIADramaPlan, route: string, actors: string[]) {
  const continuityKey = hash([
    route,
    plan.location,
    plan.continuityAnchor,
    actors.join('|'),
    plan.format,
  ].join('::'));

  const shots: SceneGenerationShot[] = plan.shots.map((shot, index) => ({
    id: shot.id,
    status: 'queued',
    shotSize: shot.shotSize,
    duration: shot.duration,
    focusActor: shot.focusActor,
    continuityKey,
    previousShotId: index ? plan.shots[index - 1]?.id : undefined,
    prompt: [
      shot.generationPrompt,
      `SCENE CONTINUITY KEY: ${continuityKey}.`,
      index
        ? `MATCH PREVIOUS SHOT ${plan.shots[index - 1]?.id}: preserve exact canonical faces, body proportions, hairstyle, wardrobe, lighting direction, geography and emotional continuity.`
        : 'FIRST SHOT OF SCENE: establish canonical faces, body proportions, wardrobe, lighting and geography that every following shot must preserve.',
      'Lucas identity authority is the locked official Lucas canon. Never replace him with a motion-reference actor or a lookalike.',
      'Marion identity authority is the locked official Marion canon whenever she is visible.',
      'Motion references may guide body language, stance, walk, hands, proximity, timing and physical tension only.',
      'TRUE VIDEO REQUIRED: real breathing, blinking, gaze motion, body weight changes and natural hand timing. No still-image zoom simulation.',
      'OUTPUT IS CANDIDATE ONLY. Never publish automatically to live gameplay.',
    ].join(' '),
  }));

  const job: SceneGenerationJob = {
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'candidate-queued',
    createdAt: Date.now(),
    route,
    approvalRequired: true,
    autoPublish: false,
    continuityKey,
    format: plan.format,
    location: plan.location,
    actors,
    shots,
  };

  const jobs = safeParse();
  jobs.push(job);
  write(jobs);
  return job;
}

export function getSceneGenerationQueue() {
  return safeParse();
}

export function latestSceneGenerationJob() {
  const jobs = safeParse();
  return jobs[jobs.length - 1] || null;
}

declare global {
  interface Window {
    __moniaSceneGenerationQueue?: () => SceneGenerationJob[];
  }
}

window.__moniaSceneGenerationQueue = getSceneGenerationQueue;
