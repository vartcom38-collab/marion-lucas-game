export type PresentationIntent='show-game'|'show-interface'|'show-world'|'show-character'|'show-emotion'|'show-replayability';

export type PresentationBrief={
  duration:number;
  intents:PresentationIntent[];
  mustShow:string[];
  avoid:string[];
  language:'fr';
  pace:'slow'|'balanced'|'teaser';
};

export type PresentationShot={
  id:string;
  seconds:number;
  purpose:string;
  source:'generate'|'reuse'|'capture-ui'|'composite';
  scene:string;
  camera:string;
  action:string;
  dialogue?:string;
  interface?:{
    mode:'gameplay'|'phone'|'visio'|'agenda'|'map'|'choices'|'none';
    visibleElements:string[];
    interaction:string;
  };
  continuity:string[];
  qualityGates:string[];
  fallback:string;
};

export type IntelligentPresentationPlan={
  brief:PresentationBrief;
  structure:{opening:string;middle:string;closing:string};
  shots:PresentationShot[];
  globalQualityGates:string[];
  retryPolicy:{
    maxAttemptsPerShot:number;
    reuseSuccessfulShots:boolean;
    regenerateOnlyFailedShots:boolean;
    rejectIf:string[];
  };
};

const gates=[
  'Identité Marion/Dominic stable du début à la fin.',
  'Chaque plan doit servir une idée de jeu précise.',
  'Au moins un élément de gameplay lisible toutes les 6 à 8 secondes.',
  'Aucun faux décor générique présenté comme Nîmes.',
  'L’interface doit être composée par le jeu, jamais générée en texte dans la vidéo.',
  'Les voix doivent être générées séparément puis utilisées comme horloge maître.',
  'Pas de diaporama, pas de simple montage de stock, pas de plan décoratif sans interaction.',
  'Les transitions doivent conserver heure, lumière, tenue, état émotionnel et direction de regard.'
];

export function buildIntelligentPresentationPlan(duration=45):IntelligentPresentationPlan{
  const brief:PresentationBrief={
    duration,
    language:'fr',
    pace:'balanced',
    intents:['show-game','show-interface','show-world','show-character','show-emotion','show-replayability'],
    mustShow:['appartement jouable','Nîmes identifiable','choix contextuels','téléphone','visio','Marine','Dominic','agenda/carte','retour gameplay après cinématique','rejouabilité'],
    avoid:['montage pub abstrait','succession de clips sans relation','faux Nîmes','texte IA incrusté','rythme illisible']
  };
  const shots:PresentationShot[]=[
    {
      id:'ui-opening',seconds:6,purpose:'Faire comprendre en 3 secondes que c’est un jeu.',
      source:'composite',scene:'Appartement de Marion à Nîmes au réveil',
      camera:'caméra joueur / cadrage naturel du décor',
      action:'Marion se déplace, le monde bouge, puis trois actions contextuelles apparaissent.',
      interface:{mode:'choices',visibleElements:['Jour 1','08:54','Téléphone','Se préparer','Sortir'],interaction:'une option est réellement sélectionnée et modifie la scène'},
      continuity:['matin','même tenue','même appartement'],qualityGates:gates,fallback:'capture du jeu réel + animation légère, jamais un plan générique'
    },
    {
      id:'nimes-world',seconds:6,purpose:'Montrer que le monde est vivant et localisé.',
      source:'generate',scene:'Centre de Nîmes identifiable, architecture et ambiance crédibles',
      camera:'marche fluide à hauteur humaine',
      action:'Marion sort, passants/terrasses/scooters vivent autour d’elle.',
      interface:{mode:'map',visibleElements:['Nîmes','destination discrète'],interaction:'la carte se ferme et le déplacement continue'},
      continuity:['fin de matinée','tenue identique'],qualityGates:gates,fallback:'asset Nîmes validé + compositing gameplay'
    },
    {
      id:'marine-conversation',seconds:7,purpose:'Montrer une vraie interaction sociale.',
      source:'generate',scene:'Esplanade / terrasse Nîmes',
      camera:'plan moyen vivant, jamais figé',
      action:'Marine rejoint Marion, marche, s’arrête, réagit pendant la conversation.',
      dialogue:'Alors… maintenant que t’es vraiment installée, ça te fait quoi d’être ici ?',
      interface:{mode:'choices',visibleElements:['réponse courte 1','réponse courte 2','laisser passer'],interaction:'le joueur choisit et la réaction de Marine change'},
      continuity:['Marine prototype cohérente dans le plan','Nîmes reconnaissable'],qualityGates:gates,fallback:'conversation gameplay sans gros plan si l’identité secondaire dérive'
    },
    {
      id:'phone-message',seconds:5,purpose:'Montrer le téléphone comme système de jeu.',
      source:'capture-ui',scene:'Téléphone en surimpression dans la scène',
      camera:'jeu en arrière-plan encore vivant',
      action:'notification puis ouverture du fil de discussion.',
      dialogue:'Tu es bien rentrée ?',
      interface:{mode:'phone',visibleElements:['notification','fil de messages','heure'],interaction:'ouverture puis fermeture naturelle du téléphone'},
      continuity:['après la rencontre','aucun spoiler du contexte exact'],qualityGates:gates,fallback:'UI native du jeu uniquement'
    },
    {
      id:'dominic-visio',seconds:7,purpose:'Montrer une scène générative forte sans perdre le gameplay.',
      source:'generate',scene:'Visio Dominic, intérieur privé',
      camera:'caméra frontale téléphone invisible, bras tendu',
      action:'respiration, regard écran-vers-objectif, micro-mouvements naturels.',
      dialogue:"Je voulais juste t'entendre deux minutes.",
      interface:{mode:'visio',visibleElements:['contrôles visio discrets'],interaction:'appel lancé depuis le téléphone du jeu puis retour à la scène'},
      continuity:['Dominic canon','voix V16','tatouages cohérents si visibles'],qualityGates:gates,fallback:'clip Dominic validé + V16, pas de génération risquée'
    },
    {
      id:'systems-life',seconds:8,purpose:'Montrer la profondeur sans faire une liste.',
      source:'composite',scene:'enchaînement agenda, garde-robe, carte, carrière, voyage',
      camera:'plans courts mais lisibles',
      action:'une action réelle par système, avec conséquence visible.',
      interface:{mode:'agenda',visibleElements:['agenda','carte','garde-robe'],interaction:'chaque écran déclenche une scène et disparaît'},
      continuity:['progression temporelle claire'],qualityGates:gates,fallback:'captures UI réelles + assets validés'
    },
    {
      id:'replay',seconds:6,purpose:'Finir sur la rejouabilité.',
      source:'composite',scene:'trois variantes du même Jour 1',
      camera:'même cadrage de départ puis bifurcations',
      action:'horaires, itinéraires et présence de Marine changent.',
      interface:{mode:'gameplay',visibleElements:['Jour 1','heures différentes'],interaction:'les choix produisent des branches visibles'},
      continuity:['mêmes piliers canon','micro-événements différents'],qualityGates:gates,fallback:'simulation UI déterministe'
    }
  ];
  return {
    brief,
    structure:{opening:'comprendre immédiatement comment on joue',middle:'prouver monde + personnages + systèmes',closing:'faire sentir la vie longue et la rejouabilité'},
    shots,
    globalQualityGates:gates,
    retryPolicy:{
      maxAttemptsPerShot:2,
      reuseSuccessfulShots:true,
      regenerateOnlyFailedShots:true,
      rejectIf:['identité instable','lieu générique','aucune interaction visible','voix non V16','texte vidéo illisible','plan purement décoratif']
    }
  };
}
