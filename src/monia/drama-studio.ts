import type { MonIADramaPlan, MonIADramaShot } from './drama';
import { findDramaBricks, type MonIADramaBrick } from './drama-library';

export type DramaStudioClip = {
  shotId: string;
  duration: number;
  media: MonIADramaBrick | null;
  fit: 'cover' | 'contain';
  scale: number;
  panX: number;
  panY: number;
  motion: 'none' | 'push' | 'pull' | 'drift';
  transition: string;
  dialogue: string;
  focusActor: string;
  emotion: string;
  missingReason?: string;
};

export type DramaStudioComposition = {
  title: string;
  format: '9:16' | '16:9';
  duration: number;
  playable: boolean;
  coverage: number;
  clips: DramaStudioClip[];
  missingShotIds: string[];
};

function transformForShot(shot: MonIADramaShot) {
  switch (shot.shotSize) {
    case 'extreme-close': return { scale: 1.55, panX: 0, panY: -4 };
    case 'close': return { scale: 1.34, panX: 0, panY: -2 };
    case 'medium-close': return { scale: 1.17, panX: 0, panY: 0 };
    case 'detail': return { scale: 1.48, panX: 8, panY: 5 };
    default: return { scale: 1, panX: 0, panY: 0 };
  }
}

function motionForShot(shot: MonIADramaShot): DramaStudioClip['motion'] {
  if (shot.cameraMove === 'slow-push') return 'push';
  if (shot.cameraMove === 'slow-pull') return 'pull';
  if (shot.cameraMove === 'handheld-soft' || shot.cameraMove === 'pan-soft') return 'drift';
  return 'none';
}

function chooseMedia(plan: MonIADramaPlan, shot: MonIADramaShot) {
  const ranked = findDramaBricks({
    actors: shot.actors,
    location: plan.location,
    emotion: shot.emotion,
    shotSize: shot.shotSize,
    dialogue: Boolean(shot.dialogue),
  });
  return ranked[0]?.brick || null;
}

export function composeDramaStudio(plan: MonIADramaPlan): DramaStudioComposition {
  const clips = plan.shots.map(shot => {
    const media = chooseMedia(plan, shot);
    const t = transformForShot(shot);
    const clip: DramaStudioClip = {
      shotId: shot.id,
      duration: shot.duration,
      media,
      fit: 'cover',
      scale: t.scale,
      panX: t.panX,
      panY: t.panY,
      motion: motionForShot(shot),
      transition: shot.transition,
      dialogue: shot.dialogue,
      focusActor: shot.focusActor,
      emotion: shot.emotion,
    };
    if (!media) clip.missingReason = `Aucune brique serveur compatible pour ${shot.focusActor} · ${shot.shotSize} · ${shot.emotion}`;
    return clip;
  });

  const missingShotIds = clips.filter(clip => !clip.media).map(clip => clip.shotId);
  const coverage = clips.length ? Math.round(((clips.length - missingShotIds.length) / clips.length) * 100) : 0;
  return {
    title: plan.title,
    format: plan.format,
    duration: clips.reduce((sum, clip) => sum + clip.duration, 0),
    playable: clips.length >= 4 && coverage >= 70,
    coverage,
    clips,
    missingShotIds,
  };
}

export function studioNeeds(plan: MonIADramaPlan) {
  const composition = composeDramaStudio(plan);
  return composition.clips
    .filter(clip => !clip.media)
    .map(clip => ({
      shotId: clip.shotId,
      actor: clip.focusActor,
      emotion: clip.emotion,
      reason: clip.missingReason || 'Brique manquante',
    }));
}
