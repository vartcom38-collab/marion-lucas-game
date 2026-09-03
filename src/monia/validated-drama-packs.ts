export type ValidatedDramaPackId = 'lucas-solo' | 'marion-solo' | 'duo-i' | 'duo-ii';
export type DramaInteractionTag = 'conversation' | 'complicity' | 'comfort' | 'tension' | 'tenderness' | 'romantic' | 'near-kiss' | 'embrace' | 'silence' | 'reaction';

export type ValidatedDramaPack = {
  id: ValidatedDramaPackId;
  title: string;
  actors: ('Marion' | 'Lucas')[];
  canonStatus: 'validated';
  visualRules: string[];
  moods: string[];
  interactionTags: DramaInteractionTag[];
  intensity: 1 | 2;
};

export const VALIDATED_DRAMA_PACKS: ValidatedDramaPack[] = [
  {
    id:'lucas-solo', title:'Lucas — briques drama officielles', actors:['Lucas'], canonStatus:'validated', intensity:1,
    moods:['neutral','intense','quiet','worried','tender','playful','hurt','angry'],
    interactionTags:['reaction','silence'],
    visualRules:['Même visage Lucas dans chaque plan.','Sans tatouage.','Micro-expressions vivantes, identité inchangée.'],
  },
  {
    id:'marion-solo', title:'Marion — briques drama officielles', actors:['Marion'], canonStatus:'validated', intensity:1,
    moods:['neutral','tender','worried','hurt','playful','quiet','intense'],
    interactionTags:['reaction','silence'],
    visualRules:['Visage exact de Marion conservé.','Aucune dérive d’identité.','Coiffure, lumière et expression peuvent varier.'],
  },
  {
    id:'duo-i', title:'Marion & Lucas — duo I', actors:['Marion','Lucas'], canonStatus:'validated', intensity:1,
    moods:['neutral','tender','quiet','worried','playful','intense'],
    interactionTags:['conversation','complicity','comfort','tension','tenderness','silence','reaction'],
    visualRules:['Deux identités canoniques inchangées.','Proximité douce et crédible.','Aucune action majeure inventée.'],
  },
  {
    id:'duo-ii', title:'Marion & Lucas — duo II', actors:['Marion','Lucas'], canonStatus:'validated', intensity:2,
    moods:['tender','intense','hurt','worried','quiet'],
    interactionTags:['tenderness','romantic','near-kiss','embrace','comfort','tension','silence'],
    visualRules:['Deux identités canoniques inchangées.','Plus romantique et intense, sans forcer l’action.','Utiliser seulement si le contexte autorise cette proximité.'],
  },
];

function norm(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

export function inferDramaInteractionTags(text:string): DramaInteractionTag[] {
  const t=norm(text);
  const out=new Set<DramaInteractionTag>();
  if(/parl|repond|dialog|conversation|ecout/.test(t)) out.add('conversation');
  if(/complic|sourire|taquin|amuse/.test(t)) out.add('complicity');
  if(/reconfort|rassur|soutien|console/.test(t)) out.add('comfort');
  if(/tension|confront|froid|distance|colere|enerve/.test(t)) out.add('tension');
  if(/tendre|tendress|doux|affect|proche/.test(t)) out.add('tenderness');
  if(/romanti|attir|seduc|desir/.test(t)) out.add('romantic');
  if(/presque.*baiser|presque.*embrass|levres|baiser/.test(t)) out.add('near-kiss');
  if(/etreint|enlace|serre.*bras|calin/.test(t)) out.add('embrace');
  if(/silence|sans parler|regard/.test(t)) out.add('silence');
  if(/reaction|reagit|regard|souffle/.test(t)) out.add('reaction');
  return [...out];
}

export function preferredValidatedPacks(input:{actors:string[]; emotion:string; action?:string; reaction?:string; dialogue?:string}) {
  const actors=input.actors.map(norm);
  const both=actors.includes('marion')&&actors.includes('lucas');
  if(!both){
    if(actors.includes('lucas')) return ['lucas-solo'] as ValidatedDramaPackId[];
    if(actors.includes('marion')) return ['marion-solo'] as ValidatedDramaPackId[];
    return [];
  }
  const tags=inferDramaInteractionTags(`${input.action||''} ${input.reaction||''} ${input.dialogue||''} ${input.emotion||''}`);
  const strong=tags.some(tag=>['romantic','near-kiss','embrace'].includes(tag)) || /intense|tender|hurt|worried/i.test(input.emotion||'');
  return strong ? ['duo-ii','duo-i'] : ['duo-i','duo-ii'];
}
