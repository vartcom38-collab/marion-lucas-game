import { monia } from './runtime';
import { fallbackDramaPlan, type MonIADramaPlan, type MonIADramaRequest, type MonIADramaShot } from './drama';
import { selectLucasMotionDirections } from './motion-language';

function lucasPerformance(request: MonIADramaRequest, shot: Omit<MonIADramaShot,'generationPrompt'>) {
  const hasLucas=shot.actors.includes('Lucas')||shot.focusActor==='Lucas';
  if(!hasLucas)return '';
  const intent=[request.premise,shot.emotion,shot.action,shot.reaction,shot.shotSize,request.context.relationship,request.context.place].filter(Boolean).join(' · ');
  const motion=selectLucasMotionDirections({
    intent,
    tags:[
      'cinematic','drama','body_movement','natural',shot.shotSize,shot.emotion,
      request.context.relationship||'',request.context.place||'',
      /two-shot|medium|wide|full/i.test(shot.shotSize)?'physical_presence':'closeup'
    ].filter(Boolean),
    limit:3
  });
  return [
    'LUCAS PERFORMANCE AUTHORITY: Lucas uses the locked official Lucas face and identity.',
    'For wider shots, preserve a coherent masculine build, shoulder line, stance, walking rhythm, weight shifts and protective physical presence learned from the approved male reference bank; this is performance/physical-language guidance, never a source actor identity replacement.',
    'For close contact, use the approved rhythm of eye contact, breath, micro-pause, careful hand placement and restrained lean-in. Never turn this into exaggerated choreography.',
    'Any woman or co-actor visible in a motion reference is blocking/contact information only and must never be copied as Marion or as another character identity.',
    `LUCAS MOTION LANGUAGE: ${motion.join(' | ')}`
  ].join(' ');
}

function videoPrompt(request: MonIADramaRequest, shot: Omit<MonIADramaShot,'generationPrompt'>) {
  const performance=lucasPerformance(request,shot);
  return `Photorealistic cinematic micro-drama, ${request.format || '9:16'}, ${request.context.place}, ${shot.focusActor}, ${shot.shotSize} shot, emotion ${shot.emotion}, ${shot.action}, ${shot.reaction}, camera ${shot.cameraMove}, ${shot.lighting}. ${performance} Keep character appearance, wardrobe, hairstyle and location consistent with adjacent shots. Real human motion: breathing, blinking, subtle head movement, gaze shifts, hand timing, walking rhythm when relevant, body-weight changes and natural posture transitions. Romantic or intimate tension, when requested by the story context, must come from distance, eye contact, breath, pauses, gentle contact and restrained movement rather than exaggerated acting. Family/child interaction, when requested, must use stable support, slow acceleration, protective posture and age-appropriate safe movement. No text, captions, logos or watermarks. True video only; never simulate motion with a still-image zoom.`;
}

function shot(request: MonIADramaRequest, value: Omit<MonIADramaShot,'generationPrompt'>): MonIADramaShot {
  return {...value, generationPrompt: videoPrompt(request, value)};
}

function sceneFlags(request:MonIADramaRequest){
  const text=`${request.premise} ${request.context.relationship||''} ${(request.context.memories||[]).join(' ')} ${(request.context.recentEvents||[]).join(' ')}`.toLowerCase();
  return {
    family:/enfant|bébé|bebe|fille|garçon|garcon|père|pere|famille|parent|porter/.test(text),
    intimate:/baiser|embrass|proxim|intim|tendre|amour|couple|main|caress|visage|chimie|tension/.test(text),
    movement:/marche|marcher|arriv|entre|sort|rejoint|traverse|couloir|rue|déplac|deplac|porte/.test(text),
  };
}

export async function planDrama(request: MonIADramaRequest, enabled = true): Promise<MonIADramaPlan> {
  const safe = fallbackDramaPlan(request);
  const lead = request.actors.includes('Lucas') ? 'Lucas' : request.actors[0] || 'Lucas';
  const result = await monia.direct({
    actor: lead,
    requestedChannel: 'scene',
    playerText: request.premise,
    context: {
      ...request.context,
      recentAction: `Préparer un mini-drama vidéo à partir de cette prémisse autorisée: ${request.premise}`,
      activeObjective: 'Définir la réaction immédiate, le dialogue bref et le ton; aucun nouveau tournant de scénario.',
      rules: [...(request.context.rules || []), 'Préparer un storyboard de vraie vidéo courte.', 'Ne jamais accepter une image fixe zoomée comme rendu final.', 'Ne jamais inventer un événement futur majeur.', 'Lucas reste absolument fidèle.', 'Dialogue bref et réactions naturelles.', 'Pour Lucas, utiliser son identité canon officielle et le langage corporel approuvé: silhouette, posture, marche, placement des épaules, regard, respiration, gestes de main, proximité, contact et tension contenue. Ne jamais remplacer son identité par celle d’un acteur de référence.', 'Une co-actrice de référence sert seulement au blocking, au contact et au rythme; son apparence ne devient jamais Marion.', 'Utiliser un plan full ou wide seulement si la posture, la marche, le déplacement, le portage ou la distance entre personnages apporte réellement quelque chose.', 'Pour les scènes de couple, faire sentir la chimie par la distance, le regard, la respiration, les mains et les micro-pauses. Contenu intime non explicite uniquement.', 'Pour une scène familiale avec enfant, mouvement protecteur, stable et adapté à l’âge; ne jamais transformer la référence enfant en identité canon.'],
    },
    availableMedia: request.availableMedia || [],
  }, 'advanced', enabled).catch(() => null);

  if (!result) return safe;
  const actors = request.actors.length ? request.actors : [lead];
  const other = actors.find(a => a !== lead);
  const emotion = result.emotion || 'calm';
  const location = result.scene?.location || request.context.place;
  const lighting = result.scene?.lighting || 'realistic cinematic lighting coherent with the time';
  const continuity = `Même lieu, mêmes personnages, mêmes vêtements et coiffures pendant toute la scène à ${location}.`;
  const flags=sceneFlags(request);
  const shots: MonIADramaShot[] = [];

  if(flags.movement){
    shots.push(shot(request,{id:'s1',duration:3.2,shotSize:'wide',cameraMove:'pan-soft',actors:[lead],focusActor:lead,emotion,action:`${lead} entre dans l’espace ou se déplace naturellement dans le lieu, sans poser pour la caméra.`,dialogue:'',reaction:'démarche, épaules, appuis et regard racontent déjà l’état émotionnel',lighting,continuity,transition:'cut'}));
  }else{
    shots.push(shot(request,{id:'s1',duration:3,shotSize:'medium-close',cameraMove:'locked',actors:[lead],focusActor:lead,emotion,action:`${lead} laisse apparaître l’émotion avant de parler.`,dialogue:'',reaction:'regard et respiration subtils, posture et épaules vivantes',lighting,continuity,transition:'cut'}));
  }

  if(other) shots.push(shot(request,{id:`s${shots.length+1}`,duration:2.5,shotSize:'close',cameraMove:'slow-push',actors:[other],focusActor:other,emotion:'attentive',action:`${other} reçoit silencieusement le moment.`,dialogue:'',reaction:'micro-réaction naturelle dans le regard',lighting,continuity,transition:'reaction-cut'}));

  shots.push(shot(request,{id:`s${shots.length+1}`,duration:4,shotSize:'close',cameraMove:'slow-push',actors:[lead],focusActor:lead,emotion,action:result.scene?.action || `${lead} répond.`,dialogue:result.spokenText || result.text,reaction:'expression retenue, regard vivant et respiration naturelle',lighting,continuity,transition:'reaction-cut'}));

  if(other&&flags.intimate){
    shots.push(shot(request,{id:`s${shots.length+1}`,duration:4.2,shotSize:'medium',cameraMove:'handheld-soft',actors:[lead,other],focusActor:lead,emotion,action:'Lucas réduit légèrement la distance seulement si le contexte le justifie; un regard précède le geste, puis une micro-pause et un contact doux de la main ou du visage.',dialogue:'',reaction:'respiration lisible, mains naturelles, lean-in retenu, tension intime non explicite',lighting,continuity,transition:'reaction-cut'}));
  }else if(other){
    shots.push(shot(request,{id:`s${shots.length+1}`,duration:3.8,shotSize:'two-shot',cameraMove:'handheld-soft',actors:[lead,other],focusActor:lead,emotion,action:'Les deux restent dans le même espace; leur distance, leurs mains, leur posture et leurs regards portent le moment.',dialogue:'',reaction:'silence vivant, micro-ajustements corporels, tension ou tendresse selon le contexte',lighting,continuity,transition:'cut'}));
  }

  if(flags.family&&actors.includes('Lucas')){
    shots.push(shot(request,{id:`s${shots.length+1}`,duration:4.4,shotSize:'full',cameraMove:'pan-soft',actors:[lead],focusActor:'Lucas',emotion:'tender',action:'Lucas se déplace avec une posture protectrice et stable; si un enfant est présent dans le contexte, le maintien ou le portage reste naturel, sûr et adapté à son âge.',dialogue:'',reaction:'regard fréquent vers l’enfant, appuis stables, gestes doux sans secousse',lighting,continuity,transition:'match-cut'}));
  }else{
    shots.push(shot(request,{id:`s${shots.length+1}`,duration:3.4,shotSize:'full',cameraMove:'locked',actors:[lead],focusActor:lead,emotion,action:`${lead} change d’appui, fait quelques pas ou s’immobilise; le plan montre clairement sa silhouette et sa façon d’occuper l’espace.`,dialogue:'',reaction:'carrure, épaules, mains, démarche et poids du corps cohérents avec Lucas',lighting,continuity,transition:'match-cut'}));
  }

  if(other) shots.push(shot(request,{id:`s${shots.length+1}`,duration:2.7,shotSize:'extreme-close',cameraMove:'locked',actors:[other],focusActor:other,emotion:'affected',action:`Silence après la phrase ou le geste de ${lead}.`,dialogue:'',reaction:'réaction immédiate dans les yeux et le souffle',lighting,continuity,transition:'cut'}));

  shots.push(shot(request,{id:`s${shots.length+1}`,duration:2.3,shotSize:'detail',cameraMove:'locked',actors:[lead],focusActor:lead,emotion,action:'Insert bref sur un détail de réaction déjà présent.',dialogue:'',reaction:'main, regard, souffle, vêtement ou posture qui prolonge l’émotion',lighting,continuity,transition:'match-cut'}));
  shots.push(shot(request,{id:`s${shots.length+1}`,duration:3.2,shotSize:'close',cameraMove:'slow-pull',actors:[lead],focusActor:lead,emotion,action:`${lead} laisse le silence retomber.`,dialogue:'',reaction:'expression finale sans résolution artificielle',lighting,continuity,transition:'hold'}));

  const wanted=Math.max(12,Math.min(60,request.targetDuration||28));
  const current=shots.reduce((n,s)=>n+s.duration,0);
  const factor=Math.max(.75,Math.min(1.6,wanted/current));
  const timed=shots.map(s=>({...s,duration:Math.round(Math.max(1.5,Math.min(8,s.duration*factor))*10)/10}));
  return {title:request.title||'Drama MonIA',format:request.format||'9:16',targetDuration:Math.round(timed.reduce((n,s)=>n+s.duration,0)*10)/10,rhythm:emotion==='playful'?'playful':emotion==='tender'||emotion==='warm'?'romantic':emotion==='intense'||emotion==='worried'?'tense':'intimate',location,continuityAnchor:`${location} · J${request.context.day} ${request.context.time}`,shots:timed,voiceLines:timed.filter(s=>s.dialogue).map(s=>({actor:s.focusActor,text:s.dialogue,emotion:s.emotion,shotId:s.id})),source:result.source,renderMode:request.renderMode||'true_video_required'};
}
