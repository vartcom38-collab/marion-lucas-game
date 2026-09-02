import { MONIA_DRAMA_LIBRARY, dramaMood, type DramaBrickMood, type DramaBrickShot } from './drama-library';

export type DramaPackSlot = {
  id: string;
  actor: 'Marion' | 'Lucas' | 'Both' | 'Environment';
  shot: DramaBrickShot;
  mood: DramaBrickMood;
  purpose: string;
  priority: 1 | 2 | 3;
  minimum: number;
  dialogueSafe?: boolean;
};

const actorSlots = (actor: 'Marion' | 'Lucas'): DramaPackSlot[] => [
  { id:`${actor.toLowerCase()}-neutral-close`,actor,shot:'close',mood:'neutral',purpose:'regard neutre / écoute / respiration',priority:1,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-neutral-medium`,actor,shot:'medium-close',mood:'neutral',purpose:'plan poitrine neutre polyvalent',priority:1,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-tender-close`,actor,shot:'close',mood:'tender',purpose:'tendresse, proximité, affection contenue',priority:1,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-quiet-reaction`,actor,shot:'close',mood:'quiet',purpose:'silence, écoute, réaction sans dialogue',priority:1,minimum:2 },
  { id:`${actor.toLowerCase()}-worried-close`,actor,shot:'close',mood:'worried',purpose:'inquiétude légère, attente, doute',priority:1,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-intense-close`,actor,shot:'close',mood:'intense',purpose:'tension émotionnelle, regard soutenu',priority:1,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-hurt-close`,actor,shot:'close',mood:'hurt',purpose:'blessure émotionnelle / vexation retenue',priority:2,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-angry-medium`,actor,shot:'medium-close',mood:'angry',purpose:'agacement ou colère sans surjeu',priority:2,minimum:1,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-playful-close`,actor,shot:'close',mood:'playful',purpose:'sourire, taquinerie, légèreté',priority:2,minimum:2,dialogueSafe:true },
  { id:`${actor.toLowerCase()}-detail`,actor,shot:'detail',mood:'neutral',purpose:'mains, téléphone, posture, détail corporel',priority:2,minimum:2 },
  { id:`${actor.toLowerCase()}-extreme-reaction`,actor,shot:'extreme-close',mood:'intense',purpose:'micro-réaction forte dans les yeux / souffle',priority:3,minimum:1 },
];

export const MONIA_DRAMA_PACK_V1: DramaPackSlot[] = [
  ...actorSlots('Marion'),
  ...actorSlots('Lucas'),
  { id:'both-neutral-two-shot',actor:'Both',shot:'two-shot',mood:'neutral',purpose:'présence commune neutre dans le même espace',priority:1,minimum:2 },
  { id:'both-tender-two-shot',actor:'Both',shot:'two-shot',mood:'tender',purpose:'proximité affectueuse sans action scénaristique majeure',priority:1,minimum:2 },
  { id:'both-intense-two-shot',actor:'Both',shot:'two-shot',mood:'intense',purpose:'tension / distance / confrontation douce',priority:2,minimum:2 },
  { id:'environment-home',actor:'Environment',shot:'medium',mood:'quiet',purpose:'respiration appartement / lieu sans personnage',priority:1,minimum:2 },
  { id:'environment-detail',actor:'Environment',shot:'detail',mood:'neutral',purpose:'insert décor / objet / téléphone / fenêtre',priority:2,minimum:3 },
];

function actorMatches(slot: DramaPackSlot, actors: string[]) {
  if (slot.actor === 'Environment') return actors.length === 0;
  if (slot.actor === 'Both') return actors.includes('Marion') && actors.includes('Lucas');
  return actors.includes(slot.actor);
}

export function auditDramaPack() {
  const slots = MONIA_DRAMA_PACK_V1.map(slot => {
    const matching = MONIA_DRAMA_LIBRARY.filter(brick =>
      actorMatches(slot, brick.actors) &&
      brick.shotTags.includes(slot.shot) &&
      brick.moods.some(mood => dramaMood(mood) === slot.mood) &&
      (!slot.dialogueSafe || brick.dialogueSafe)
    );
    return {
      ...slot,
      available: matching.length,
      complete: matching.length >= slot.minimum,
      brickIds: matching.map(brick => brick.id),
      missing: Math.max(0, slot.minimum - matching.length),
    };
  });
  const required = slots.reduce((sum, slot) => sum + slot.minimum, 0);
  const covered = slots.reduce((sum, slot) => sum + Math.min(slot.available, slot.minimum), 0);
  const priority1 = slots.filter(slot => slot.priority === 1);
  return {
    version: 'v1',
    required,
    covered,
    coverage: required ? Math.round((covered / required) * 100) : 0,
    readyForRichDrama: priority1.every(slot => slot.complete),
    missingPriority1: priority1.filter(slot => !slot.complete),
    missing: slots.filter(slot => !slot.complete),
    slots,
  };
}
