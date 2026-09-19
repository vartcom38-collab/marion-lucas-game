export type MonIAPresentationType='jury'|'gameplay'|'romantic'|'emotion'|'replayability'|'auto';

export type MonIAPresentationRequest={
  type?:MonIAPresentationType;
  duration?:30|45|60|90;
  audience?:'jury'|'player'|'social'|'internal';
  focus?:string[];
  language?:'fr';
  tone?:'premium'|'cinematic'|'emotional'|'gameplay';
};

export type MonIAPresentationPlan={
  type:Exclude<MonIAPresentationType,'auto'>;
  title:string;
  duration:number;
  objective:string;
  priorities:string[];
  mandatory:string[];
  forbidden:string[];
  masterPrompt:string;
};

function chooseType(input:MonIAPresentationRequest):Exclude<MonIAPresentationType,'auto'>{
  if(input.type&&input.type!=='auto')return input.type;
  const focus=(input.focus||[]).join(' ').toLowerCase();
  if(input.audience==='jury')return 'jury';
  if(/rejou|variation|seed|différent|different/.test(focus))return 'replayability';
  if(/gameplay|interface|hud|téléphone|telephone|agenda|carte/.test(focus))return 'gameplay';
  if(/romance|couple|dominic|relation|amour/.test(focus))return 'romantic';
  if(/émotion|emotion|souvenir|temps|intime|sensible/.test(focus))return 'emotion';
  return 'jury';
}

const baseMandatory=[
  'Marion conserve son identité canonique.',
  'Dominic conserve son identité canonique visage + corps + présence.',
  'Dominic parle en français avec V16 lorsqu’il parle.',
  'Marine reste un prototype visuel non canon tant qu’aucune référence définitive n’est fournie.',
  'Le teaser doit montrer qu’il s’agit d’un vrai jeu interactif.',
  'Le monde doit contenir du mouvement, du son et une vraie continuité temporelle.',
  'L’interface doit rester discrète, lisible et premium.',
  'Les cinématiques doivent surgir du gameplay puis rendre la main au joueur.',
];

const baseForbidden=[
  'diaporama ou succession de photos figées',
  'visual novel statique',
  'HUD massif ou interface mobile cheap',
  'Dominic générique ou visage instable',
  'voix anglaise de Dominic',
  'romance instantanée hors chronologie',
  'texte généré illisible incrusté dans la vidéo',
  'montage kitsch ou publicitaire sans gameplay',
];

const configs:Record<Exclude<MonIAPresentationType,'auto'>,{title:string;objective:string;priorities:string[];prompt:string}>={
  jury:{
    title:'Teaser Jury',
    objective:'Convaincre qu’il s’agit d’un life-sim premium riche, cohérent, jouable et rejouable.',
    priorities:['interface','gameplay','Marine','Nîmes vivant','Dominic','téléphone','visio','carrière','vie longue','rejouabilité'],
    prompt:'Présenter le projet comme une démonstration officielle premium. Montrer clairement comment on joue, comment MonIA intervient, comment les personnages vivent et pourquoi une nouvelle partie change.'
  },
  gameplay:{
    title:'Teaser Gameplay',
    objective:'Faire comprendre immédiatement comment le joueur interagit avec le monde.',
    priorities:['HUD discret','choix contextuels','déplacements','conversations','téléphone','agenda','garde-robe','carte','cinématique puis retour gameplay'],
    prompt:'Privilégier les séquences où le joueur agit. Montrer des choix visibles, une vraie conversation avec Marine, un déplacement dans Nîmes, une cinématique contextuelle et le retour instantané au contrôle.'
  },
  romantic:{
    title:'Teaser Romantique',
    objective:'Montrer la montée naturelle de la relation Marion/Dominic sans oublier que c’est un jeu.',
    priorities:['première rencontre','premier message','visio','distance','rapprochement','quotidien','tension','tendresse','futur'],
    prompt:'Construire une progression émotionnelle crédible de la rencontre vers une relation plus profonde. Garder régulièrement des éléments de gameplay et de système pour éviter un simple court-métrage romantique.'
  },
  emotion:{
    title:'Teaser Émotion',
    objective:'Faire ressentir la profondeur humaine, le temps qui passe et la mémoire du monde.',
    priorities:['Marion seule','Marine','silences','choix de vie','distance','souvenirs','visio','temps','foyer','futur'],
    prompt:'Rythme plus sensible et respiré. Utiliser les regards, silences, gestes et environnements comme narration. Garder quelques signes de gameplay pour rappeler que le joueur vit ces moments.'
  },
  replayability:{
    title:'Teaser Rejouabilité',
    objective:'Prouver que deux parties ne suivent jamais exactement le même déroulé.',
    priorities:['même jour variantes','horaires différents','itinéraires différents','Marine à d’autres moments','micro-événements','autres conversations','autres contextes de rencontre'],
    prompt:'Montrer visuellement plusieurs versions d’un même segment de partie. Les grands piliers restent vrais, mais les chemins, timings, conversations et micro-événements changent.'
  }
};

export function buildMonIAPresentationPlan(input:MonIAPresentationRequest={}):MonIAPresentationPlan{
  const type=chooseType(input);
  const cfg=configs[type];
  const duration=input.duration||60;
  const audience=input.audience||'player';
  const focus=input.focus?.length?' Focus supplémentaire demandé: '+input.focus.join(', ')+'.':'';
  const masterPrompt=[
    'Créer '+cfg.title.toLowerCase()+' de '+duration+' secondes pour le jeu Marion & Dominic.',
    'Audience: '+audience+'. Langue: français.',
    'Style photoréaliste premium, cinématographique, immersif, vivant.',
    cfg.objective,
    cfg.prompt,
    'Priorités: '+cfg.priorities.join(', ')+'.',
    'Obligatoire: '+baseMandatory.join(' '),
    'Interdit: '+baseForbidden.join(', ')+'.',
    focus,
    'Découper en plusieurs séquences cohérentes plutôt qu’un seul prompt vidéo géant.',
    'Utiliser MonIA pour le contexte, les identités et la chronologie; utiliser les overlays du lecteur pour les textes et l’interface.'
  ].join(' ');
  return {type,title:cfg.title,duration,objective:cfg.objective,priorities:cfg.priorities,mandatory:baseMandatory,forbidden:baseForbidden,masterPrompt};
}

export function presentationExamples(){
  return {
    jury:buildMonIAPresentationPlan({type:'jury',duration:60,audience:'jury'}),
    gameplay:buildMonIAPresentationPlan({type:'gameplay',duration:45}),
    romantic:buildMonIAPresentationPlan({type:'romantic',duration:45}),
    emotion:buildMonIAPresentationPlan({type:'emotion',duration:45}),
    replayability:buildMonIAPresentationPlan({type:'replayability',duration:45}),
  };
}
