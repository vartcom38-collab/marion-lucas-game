import type { MonIADramaPlan, MonIADramaShot } from './drama';
import { CANON_DRAMA_ATLAS_CELLS, type DramaAtlasCrop } from './drama-atlas';
import { preferredValidatedPacks } from './validated-drama-packs';

export type SceneAnchorSpec = {
  id: string;
  sourceUrl: string;
  crop: DramaAtlasCrop;
  actors: string[];
  packId: string;
  status: 'validated';
};

export type SceneGenerationShot = {
  id: string;
  status: 'queued' | 'ready' | 'failed';
  shotSize: MonIADramaShot['shotSize'];
  duration: number;
  focusActor: string;
  actors: string[];
  prompt: string;
  continuityKey: string;
  previousShotId?: string;
  sceneAnchor?: SceneAnchorSpec;
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
  sceneAnchor?: SceneAnchorSpec;
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

function absoluteAssetUrl(src:string){
  try{return new URL(src, location.origin).toString()}catch{return src}
}

function selectValidatedSceneAnchor(plan:MonIADramaPlan, actors:string[]):SceneAnchorSpec|undefined{
  const normalized=actors.map(a=>a.toLowerCase());
  if(!(normalized.includes('lucas')&&normalized.includes('marion')))return undefined;
  const representative=plan.shots.find(s=>s.actors.some(a=>a==='Lucas')&&s.actors.some(a=>a==='Marion')) || plan.shots[0];
  if(!representative)return undefined;
  const packs=preferredValidatedPacks({
    actors:['Marion','Lucas'],
    emotion:representative.emotion,
    action:representative.action,
    reaction:representative.reaction,
    dialogue:representative.dialogue,
  });
  for(const packId of packs){
    const cells=CANON_DRAMA_ATLAS_CELLS.filter(c=>c.packId===packId&&c.actors.includes('Lucas')&&c.actors.includes('Marion'));
    if(!cells.length)continue;
    const text=`${representative.emotion} ${representative.action} ${representative.reaction}`.toLowerCase();
    const scored=cells.map(cell=>({cell,score:(text.includes(cell.mood.toLowerCase())?3:0)+(cell.interaction&&text.includes(cell.interaction.toLowerCase())?4:0)})).sort((a,b)=>b.score-a.score);
    const cell=scored[0]?.cell||cells[0];
    return {id:cell.id,sourceUrl:absoluteAssetUrl(cell.src),crop:cell.crop,actors:[...cell.actors],packId:cell.packId,status:'validated'};
  }
  return undefined;
}

export function queueDramaPlan(plan: MonIADramaPlan, route: string, actors: string[]) {
  const continuityKey = hash([
    route,
    plan.location,
    plan.continuityAnchor,
    actors.join('|'),
    plan.format,
  ].join('::'));
  const sceneAnchor=selectValidatedSceneAnchor(plan,actors);

  const shots: SceneGenerationShot[] = plan.shots.map((shot, index) => {
    const multi=shot.actors.includes('Lucas')&&shot.actors.includes('Marion');
    return {
      id: shot.id,
      status: 'queued',
      shotSize: shot.shotSize,
      duration: shot.duration,
      focusActor: shot.focusActor,
      actors:[...shot.actors],
      continuityKey,
      previousShotId: index ? plan.shots[index - 1]?.id : undefined,
      sceneAnchor:multi?sceneAnchor:undefined,
      prompt: [
        shot.generationPrompt,
        `SCENE CONTINUITY KEY: ${continuityKey}.`,
        sceneAnchor&&multi?`VALIDATED DUO ANCHOR: ${sceneAnchor.id} from ${sceneAnchor.packId}; use it only to preserve the already validated Marion + Lucas identities and physical blocking.`:'',
        index
          ? `MATCH PREVIOUS SHOT ${plan.shots[index - 1]?.id}: preserve exact canonical faces, body proportions, hairstyle, wardrobe, lighting direction, geography and emotional continuity.`
          : 'FIRST SHOT OF SCENE: establish canonical faces, body proportions, wardrobe, lighting and geography that every following shot must preserve.',
        'Lucas identity authority is the locked official Lucas canon. Never replace him with a motion-reference actor or a lookalike.',
        'Marion identity authority is the locked official Marion canon whenever she is visible.',
        'Motion references may guide body language, stance, walk, hands, proximity, timing and physical tension only.',
        'TRUE VIDEO REQUIRED: real breathing, blinking, gaze motion, body weight changes and natural hand timing. No still-image zoom simulation.',
        'OUTPUT IS CANDIDATE ONLY. Never publish automatically to live gameplay.',
      ].filter(Boolean).join(' '),
    };
  });

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
    sceneAnchor,
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
