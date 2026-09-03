import { preferredValidatedPacks, type DramaInteractionTag, type ValidatedDramaPackId } from './validated-drama-packs';
import { CANON_DRAMA_ATLAS_CELLS, type DramaAtlasCrop } from './drama-atlas';

export type DramaBrickKind = 'video' | 'image';
export type DramaBrickMood = 'neutral' | 'tender' | 'playful' | 'worried' | 'hurt' | 'angry' | 'intense' | 'quiet';
export type DramaBrickShot = 'extreme-close' | 'close' | 'medium-close' | 'medium' | 'two-shot' | 'detail';

export type MonIADramaBrick = {
  id: string;
  src: string;
  kind: DramaBrickKind;
  actors: string[];
  locationTags: string[];
  moods: DramaBrickMood[];
  shotTags: DramaBrickShot[];
  loopable: boolean;
  dialogueSafe: boolean;
  reactionSafe: boolean;
  weight: number;
  packId?: ValidatedDramaPackId;
  interactionTags?: DramaInteractionTag[];
  canonValidated?: boolean;
  atlasCrop?: DramaAtlasCrop;
  atlasLabel?: string;
};

// Packs whose atlas binary is physically complete in the repository/build.
// Add the next pack here only after all of its chunks pass checksum validation.
export const ACTIVE_CANON_ATLAS_PACKS = new Set<ValidatedDramaPackId>(['lucas-solo']);

const atlasBricks: MonIADramaBrick[] = CANON_DRAMA_ATLAS_CELLS
  .filter(cell => ACTIVE_CANON_ATLAS_PACKS.has(cell.packId))
  .map(cell => ({
    id: `atlas-${cell.id}`,
    src: cell.src,
    kind: 'image',
    actors: [...cell.actors],
    locationTags: ['generic','home','interior','night','day'],
    moods: [cell.mood as DramaBrickMood],
    shotTags: cell.actors.length === 2 ? ['two-shot','medium-close','close'] : ['close','medium-close','extreme-close'],
    loopable: true,
    dialogueSafe: cell.interaction === 'conversation' || cell.actors.length === 1,
    reactionSafe: true,
    weight: 34,
    packId: cell.packId,
    interactionTags: cell.interaction ? [cell.interaction as DramaInteractionTag] : ['reaction'],
    canonValidated: true,
    atlasCrop: cell.crop,
    atlasLabel: cell.label,
  }));

export const MONIA_DRAMA_LIBRARY: MonIADramaBrick[] = [
  ...atlasBricks,
  {
    id: 'lucas-intro-canon', src: '/resources/lucas-intro.mp4', kind: 'video', actors: ['Lucas'],
    locationTags: ['generic','spain','madrid'], moods: ['neutral','tender','quiet','intense'], shotTags: ['close','medium-close'],
    loopable: false, dialogueSafe: true, reactionSafe: true, weight: 12,
    packId:'lucas-solo', interactionTags:['reaction','silence'], canonValidated:true,
  },
  {
    id: 'marion-nimes-canon', src: '/resources/marion-nimes.mp4', kind: 'video', actors: ['Marion'],
    locationTags: ['nîmes','nimes','generic'], moods: ['neutral','tender','quiet','worried'], shotTags: ['close','medium-close','medium'],
    loopable: false, dialogueSafe: false, reactionSafe: true, weight: 12,
    packId:'marion-solo', interactionTags:['reaction','silence'], canonValidated:true,
  },
  {
    id: 'apartment-nimes-wide', src: '/resources/appartement-nimes.png', kind: 'image', actors: [],
    locationTags: ['appartement','nîmes','nimes','home'], moods: ['neutral','quiet','tender'], shotTags: ['medium','two-shot','detail'],
    loopable: true, dialogueSafe: false, reactionSafe: false, weight: 8,
  },
];

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function dramaMood(value: string): DramaBrickMood {
  const text = normalize(value);
  if (/tender|warm|romantic|affect/.test(text)) return 'tender';
  if (/play|taquin|fun|smil/.test(text)) return 'playful';
  if (/worri|inquiet|peur/.test(text)) return 'worried';
  if (/hurt|bles|vexe|sad/.test(text)) return 'hurt';
  if (/angry|enerve|colere/.test(text)) return 'angry';
  if (/intense|urgent|tension/.test(text)) return 'intense';
  if (/quiet|calm|contained|silence/.test(text)) return 'quiet';
  return 'neutral';
}

export function findDramaBricks(input: {
  actors: string[];
  location: string;
  emotion: string;
  shotSize: DramaBrickShot;
  dialogue?: boolean;
  action?: string;
  reaction?: string;
}) {
  const mood = dramaMood(input.emotion);
  const wantedActors = input.actors.map(normalize);
  const location = normalize(input.location);
  const preferredPacks = preferredValidatedPacks({
    actors: input.actors,
    emotion: input.emotion,
    action: input.action,
    reaction: input.reaction,
  });
  const wantedInteractions = `${input.action || ''} ${input.reaction || ''}`.toLowerCase();

  return MONIA_DRAMA_LIBRARY
    .map(brick => {
      let score = brick.weight;
      const actors = brick.actors.map(normalize);
      if (brick.canonValidated) score += 8;
      if (brick.packId && preferredPacks.includes(brick.packId)) score += 18 - preferredPacks.indexOf(brick.packId) * 5;
      if (brick.interactionTags?.some(tag => wantedInteractions.includes(tag.replace('-', ' ')))) score += 8;
      if (!brick.actors.length) score += input.shotSize === 'detail' || input.shotSize === 'two-shot' ? 5 : 0;
      for (const actor of wantedActors) if (actors.includes(actor)) score += 14;
      if (brick.shotTags.includes(input.shotSize)) score += 8;
      if (brick.moods.includes(mood)) score += 10;
      if (brick.locationTags.some(tag => location.includes(normalize(tag)) || normalize(tag) === 'generic')) score += 4;
      if (input.dialogue && brick.dialogueSafe) score += 6;
      if (!input.dialogue && brick.reactionSafe) score += 4;
      if (wantedActors.length && brick.actors.length && !wantedActors.some(actor => actors.includes(actor))) score -= 30;
      if (wantedActors.length === 2 && brick.actors.length === 1) score -= 24;
      if (wantedActors.length === 1 && brick.actors.length === 2) score -= 24;
      return { brick, score, preferredPacks };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);
}
